-- Phase 0 guardrails: usage accounting, credit ledger, company-research cache,
-- prompt instrumentation, waitlist. Ship first — nothing else in phase 0 depends
-- on any other migration.
--
-- Auth model (deliberate divergence from the spec draft):
--
--   The public tailoring proxy (head-hunter-claude) is intentionally
--   unauthenticated — Turnstile + a 10-min HMAC session token gates it, not
--   Supabase Auth. Requiring a JWT there would kill the public flow. So
--   usage_counters, generation_batches, and prompt_events key on a
--   `session_key` (opaque text derived by the Edge Function from IP + a server
--   secret) instead of auth.uid(). No table under this migration is reachable
--   from an anon or authenticated client SELECT — the "session_key A cannot
--   read session_key B" property is enforced by the absence of policies, not
--   by comparing keys. Only service_role (used exclusively by Edge Functions)
--   writes and reads these.
--
--   The only exceptions:
--     - prompt_events allows anon+authenticated inserts (the capacity
--       indicator fires on the public flow and must log impressions).
--     - waitlist allows anon+authenticated inserts (empty-state signup).
--
-- =============================================================================
-- usage_counters — per-session daily rollup, drives the daily cap
-- =============================================================================
create table if not exists public.usage_counters (
  session_key        text    not null,
  day                date    not null default (now() at time zone 'utc')::date,
  tailorings         integer not null default 0,   -- batches started; the cap enforces on this
  calls              integer not null default 0,   -- raw Anthropic calls, for reconciliation
  input_tokens       bigint  not null default 0,
  output_tokens      bigint  not null default 0,
  cache_read_tokens  bigint  not null default 0,
  cache_write_tokens bigint  not null default 0,
  web_searches       integer not null default 0,
  est_cost_usd       numeric(10,6) not null default 0,
  updated_at         timestamptz   not null default now(),
  primary key (session_key, day)
);

alter table public.usage_counters enable row level security;
-- No policies. service_role only.

-- =============================================================================
-- generation_batches — one row per tailoring (3 Anthropic calls, one batch)
-- =============================================================================
-- Enables true cost-per-tailoring analytics later. The Edge Function issues a
-- new id on call 1 and echoes it back to the client via an `x-batch-id`
-- header; calls 2 and 3 send it back so their usage lands on the same row.
create table if not exists public.generation_batches (
  id                  uuid primary key default gen_random_uuid(),
  session_key         text not null,
  status              text not null default 'in_progress'
                        check (status in ('in_progress','complete','failed','partial')),
  calls               integer not null default 0,
  input_tokens        bigint  not null default 0,
  output_tokens       bigint  not null default 0,
  cache_read_tokens   bigint  not null default 0,
  cache_write_tokens  bigint  not null default 0,
  web_searches        integer not null default 0,
  est_cost_usd        numeric(10,6) not null default 0,
  research_cache_hit  boolean not null default false,
  call_breakdown      jsonb   not null default '[]'::jsonb,  -- [{kind, model, input, output, cache_read, cache_write, web_searches, cost_usd}]
  started_at          timestamptz not null default now(),
  completed_at        timestamptz
);

create index if not exists idx_generation_batches_session_started
  on public.generation_batches (session_key, started_at desc);

alter table public.generation_batches enable row level security;
-- No policies. service_role only.

-- =============================================================================
-- credit_topups — manual purchases; the numerator of get_balance_usd()
-- =============================================================================
create table if not exists public.credit_topups (
  id           uuid primary key default gen_random_uuid(),
  amount_usd   numeric(10,2) not null check (amount_usd > 0),
  purchased_at timestamptz not null default now(),
  note         text,
  created_at   timestamptz not null default now()
);

alter table public.credit_topups enable row level security;
-- No policies. service_role only. Balance reaches the client only via the RPC
-- defined in capacity-indicator.md, never by direct select.

-- =============================================================================
-- company_research — 30-day cache, keyed on a normalised company_key
-- =============================================================================
create table if not exists public.company_research (
  company_key   text primary key,              -- lowercased, trimmed, punctuation + legal-suffix stripped
  company_name  text not null,                 -- display form, kept for humans
  research      jsonb not null,                -- full research payload (companyBrief, hiringManager, linkedInMessage)
  searches_used integer not null default 0,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '30 days')
);

create index if not exists idx_company_research_expiry
  on public.company_research (expires_at);

alter table public.company_research enable row level security;
-- No policies. service_role only.

-- =============================================================================
-- prompt_events — capacity indicator instrumentation
-- =============================================================================
-- Consumed by capacity-indicator.md. Fires on the public tailoring flow, so
-- inserts must succeed for anon; user_id is nullable and session_key carries
-- attribution instead. Reads are service_role only (no select policy).
create table if not exists public.prompt_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  session_key text,
  kind        text not null check (kind in
                ('capacity_impression','capacity_click','capacity_dismiss','waitlist_signup')),
  band        text check (band is null or band in ('green','amber','red','empty')),
  created_at  timestamptz not null default now()
);

create index if not exists idx_prompt_events_kind_created
  on public.prompt_events (kind, created_at desc);

alter table public.prompt_events enable row level security;

-- Anyone can log their own impression/click/dismiss. The check constraint on
-- kind already restricts what can be inserted; RLS just opens the door.
create policy "prompt_events: anon+auth can insert"
  on public.prompt_events for insert
  to anon, authenticated
  with check (true);

-- =============================================================================
-- waitlist — empty-state signups
-- =============================================================================
create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  user_id     uuid references auth.users(id) on delete set null,
  notified_at timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.waitlist enable row level security;

create policy "waitlist: anon+auth can join"
  on public.waitlist for insert
  to anon, authenticated
  with check (true);
-- No select policy. service_role reads for the notify batch.

-- =============================================================================
-- get_balance_usd() — self-derived balance (see spec §5)
-- =============================================================================
-- SECURITY DEFINER so the Edge Function (service_role) can invoke it and read
-- across credit_topups + usage_counters without granting either to callers.
-- Execute is revoked from PUBLIC so anon/authenticated cannot call it — the
-- raw dollar figure never reaches the client. Only get_capacity_band()
-- (defined in the capacity-indicator migration) will be exposed to clients.
create or replace function public.get_balance_usd()
returns numeric
language sql
security definer
set search_path = public
as $$
  with latest as (
    select purchased_at
      from public.credit_topups
     order by purchased_at desc
     limit 1
  )
  select coalesce((select sum(amount_usd) from public.credit_topups), 0)
       - coalesce((
           select sum(est_cost_usd)
             from public.usage_counters
            where updated_at >= (select purchased_at from latest)
         ), 0);
$$;

revoke execute on function public.get_balance_usd() from public;
grant  execute on function public.get_balance_usd() to service_role;

-- =============================================================================
-- record_usage() — atomic upsert into usage_counters (avoids read-modify-write races)
-- =============================================================================
-- Called by the Edge Function after every Anthropic call. p_is_tailoring_start
-- is true only on the first call of a new batch, so `tailorings` is incremented
-- exactly once per generation.
create or replace function public.record_usage(
  p_session_key         text,
  p_input_tokens        bigint,
  p_output_tokens       bigint,
  p_cache_read_tokens   bigint,
  p_cache_write_tokens  bigint,
  p_web_searches        integer,
  p_cost_usd            numeric,
  p_is_tailoring_start  boolean
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.usage_counters (
    session_key, day,
    tailorings, calls,
    input_tokens, output_tokens,
    cache_read_tokens, cache_write_tokens,
    web_searches, est_cost_usd, updated_at
  )
  values (
    p_session_key, (now() at time zone 'utc')::date,
    case when p_is_tailoring_start then 1 else 0 end, 1,
    p_input_tokens, p_output_tokens,
    p_cache_read_tokens, p_cache_write_tokens,
    p_web_searches, p_cost_usd, now()
  )
  on conflict (session_key, day) do update set
    tailorings         = usage_counters.tailorings + excluded.tailorings,
    calls              = usage_counters.calls + 1,
    input_tokens       = usage_counters.input_tokens + excluded.input_tokens,
    output_tokens      = usage_counters.output_tokens + excluded.output_tokens,
    cache_read_tokens  = usage_counters.cache_read_tokens + excluded.cache_read_tokens,
    cache_write_tokens = usage_counters.cache_write_tokens + excluded.cache_write_tokens,
    web_searches       = usage_counters.web_searches + excluded.web_searches,
    est_cost_usd       = usage_counters.est_cost_usd + excluded.est_cost_usd,
    updated_at         = now();
$$;

revoke execute on function public.record_usage(text, bigint, bigint, bigint, bigint, integer, numeric, boolean) from public;
grant  execute on function public.record_usage(text, bigint, bigint, bigint, bigint, integer, numeric, boolean) to service_role;

-- =============================================================================
-- record_batch_call() — atomic update on a batch row
-- =============================================================================
create or replace function public.record_batch_call(
  p_batch_id            uuid,
  p_call                jsonb,
  p_input_tokens        bigint,
  p_output_tokens       bigint,
  p_cache_read_tokens   bigint,
  p_cache_write_tokens  bigint,
  p_web_searches        integer,
  p_cost_usd            numeric,
  p_research_cache_hit  boolean default false
) returns void
language sql
security definer
set search_path = public
as $$
  update public.generation_batches
     set calls              = calls + 1,
         input_tokens       = input_tokens + p_input_tokens,
         output_tokens      = output_tokens + p_output_tokens,
         cache_read_tokens  = cache_read_tokens + p_cache_read_tokens,
         cache_write_tokens = cache_write_tokens + p_cache_write_tokens,
         web_searches       = web_searches + p_web_searches,
         est_cost_usd       = est_cost_usd + p_cost_usd,
         research_cache_hit = research_cache_hit or p_research_cache_hit,
         call_breakdown     = call_breakdown || jsonb_build_array(p_call)
   where id = p_batch_id;
$$;

revoke execute on function public.record_batch_call(uuid, jsonb, bigint, bigint, bigint, bigint, integer, numeric, boolean) from public;
grant  execute on function public.record_batch_call(uuid, jsonb, bigint, bigint, bigint, bigint, integer, numeric, boolean) to service_role;

-- =============================================================================
-- close_batch() — mark completion; used by the last call of a batch
-- =============================================================================
create or replace function public.close_batch(
  p_batch_id uuid,
  p_status   text default 'complete'
) returns void
language sql
security definer
set search_path = public
as $$
  update public.generation_batches
     set status       = p_status,
         completed_at = now()
   where id = p_batch_id
     and status = 'in_progress';
$$;

revoke execute on function public.close_batch(uuid, text) from public;
grant  execute on function public.close_batch(uuid, text) to service_role;

-- =============================================================================
-- Purge expired company_research rows (lazy — called opportunistically)
-- =============================================================================
create or replace function public.purge_expired_company_research() returns integer
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.company_research
     where expires_at < now()
    returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke execute on function public.purge_expired_company_research() from public;
grant  execute on function public.purge_expired_company_research() to service_role;
