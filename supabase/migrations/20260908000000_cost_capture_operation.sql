-- Phase 0 addendum — universal cost capture (per specs/phase-0-addendum-cost-capture.md).
--
-- The Aug 31 addendum instrumented gap-analysis and jobsearch (both write
-- via _shared/cost.ts.recordAnthropicUsage), and fixed the tailoring-batch
-- under-report (all 3 calls now hit generation_batches with breakdown_len=3).
-- This migration completes the addendum by adding per-operation discrimination
-- to the daily rollup, so:
--
--   1. The daily-cap query can filter to operation='tailoring' — gap-analysis
--      calls no longer count against any tailoring quota (they never did in
--      practice because the keyspaces are split, but the intent is now
--      enforced by the query, not by attribution accident).
--   2. Per-operation analytics become possible ("how much did gap-analysis
--      spend today?" answerable in one SQL select).
--
-- Column values used going forward:
--   'tailoring'    — head-hunter-claude proxy calls that are NOT the research
--                    subcall (cv, coverLetter, feedback, masterCV). This is
--                    the balance-and-capped bucket.
--   'research'     — the web_search-enabled Haiku research call inside a
--                    tailoring pipeline. Split out because its economics
--                    (web search fees) are meaningfully different.
--   'gap_analysis' — the gap-analysis edge fn's single Anthropic call.
--   'jobsearch'    — the jobsearch edge fn's why-chosen Anthropic call.

-- Add the column with default 'tailoring' so existing rows have a value,
-- then reattribute the rows we can identify. Anything session_key like
-- 'user:%' came from an auth-gated edge fn; both gap-analysis and jobsearch
-- write those keys, but gap-analysis dominates in practice. Best-effort
-- attribution — historical data is imprecise by construction (the rollup
-- pre-dates per-op discrimination). New writes will be accurate.
alter table public.usage_counters
  add column if not exists operation text not null default 'tailoring';

alter table public.usage_counters
  drop constraint if exists usage_counters_operation_chk;

alter table public.usage_counters
  add constraint usage_counters_operation_chk
  check (operation in ('tailoring','gap_analysis','jobsearch','research'));

update public.usage_counters
   set operation = 'gap_analysis'
 where session_key like 'user:%'
   and operation = 'tailoring';

-- Composite key (session_key, day, operation) — a single session can spend
-- on multiple operations in the same day and each needs its own daily row.
-- record_usage() then upserts by (session_key, day, operation) so the
-- attribution stays clean.
alter table public.usage_counters
  drop constraint if exists usage_counters_pkey;

alter table public.usage_counters
  add primary key (session_key, day, operation);

create index if not exists usage_counters_operation_idx
  on public.usage_counters (operation, updated_at);

-- Signature change on record_usage — must DROP then CREATE (CREATE OR REPLACE
-- can't change signatures). Grant to service_role only, same as before.
drop function if exists public.record_usage(text, bigint, bigint, bigint, bigint, integer, numeric, boolean);

create or replace function public.record_usage(
  p_session_key         text,
  p_operation           text,
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
    session_key, day, operation,
    tailorings, calls,
    input_tokens, output_tokens,
    cache_read_tokens, cache_write_tokens,
    web_searches, est_cost_usd, updated_at
  )
  values (
    p_session_key, (now() at time zone 'utc')::date, p_operation,
    case when p_is_tailoring_start then 1 else 0 end, 1,
    p_input_tokens, p_output_tokens,
    p_cache_read_tokens, p_cache_write_tokens,
    p_web_searches, p_cost_usd, now()
  )
  on conflict (session_key, day, operation) do update set
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

revoke execute on function public.record_usage(text, text, bigint, bigint, bigint, bigint, integer, numeric, boolean) from public;
grant  execute on function public.record_usage(text, text, bigint, bigint, bigint, bigint, integer, numeric, boolean) to service_role;
