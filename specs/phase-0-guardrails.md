# Spec — Phase 0 Guardrails

**Target:** `/specs/phase-0-guardrails.md`
**Supabase project:** `bcenuebydpkyfmtzfcku`
**Depends on:** nothing. Ship first.
**Blocks:** `capacity-indicator.md`

---

## 1. Purpose

1. Stop one user draining the credit balance in a day.
2. Produce true cost-per-active-user — including web search, which is not a token cost.
3. Expose a balance figure good enough to drive the capacity indicator.
4. Cut avoidable spend by caching company research.

Credits do not auto-reload. Total exposure is capped at the balance purchased. The risk being managed is **silent outage and avoidable burn**, not runaway billing.

**Launch balance: $50.**

---

## 2. Console setup — Colin does this, not Claude Code

Already done:
- Workspace `Headhunter` created.
- Opus 5 workspace rate limits: 30 req/min, 150K input tok/min, 40K output tok/min.

Still to do:
- **Manage → Spend limits: set $35/month with a 50–75% threshold alert.** This is the only true ceiling. Every other limit is throttling.
- Cap Sonnet 5, Fable 5 and any other model at ~5 req/min. Currently they inherit org limits (10K req/min), so a one-line model change in code would bypass every cap set so far.
- Batch requests: **0**. Nothing here uses the Batch API.
- Web search: **10/sec**. Enough for two concurrent research calls. Note this is a burst limit and provides no meaningful budget protection — the spend limit does that.
- Create the API key inside `Headhunter`, swap the Supabase secret, redeploy, verify a live tailoring, then revoke the old Default-workspace key. Do not archive any workspace — archiving revokes all its keys irreversibly.
- Console low-balance email alert.
- Record the top-up in `credit_topups` (see §5).

---

## 3. Schema

```sql
-- Per-user daily usage
create table if not exists public.usage_counters (
  user_id        uuid not null references auth.users(id) on delete cascade,
  day            date not null default (now() at time zone 'utc')::date,
  calls          integer not null default 0,
  input_tokens   bigint  not null default 0,
  output_tokens  bigint  not null default 0,
  cache_read_tokens  bigint not null default 0,
  cache_write_tokens bigint not null default 0,
  web_searches   integer not null default 0,
  est_cost_usd   numeric(10,6) not null default 0,
  updated_at     timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.usage_counters enable row level security;

create policy "read own usage" on public.usage_counters
  for select to authenticated using (user_id = auth.uid());
-- Writes are service_role only. No insert/update policy.

-- Manual credit purchases
create table if not exists public.credit_topups (
  id           uuid primary key default gen_random_uuid(),
  amount_usd   numeric(10,2) not null check (amount_usd > 0),
  purchased_at timestamptz not null default now(),
  note         text,
  created_at   timestamptz not null default now()
);
alter table public.credit_topups enable row level security;
-- No policies. service_role only. Balance reaches the client via the RPC in
-- capacity-indicator.md, never by direct select.

-- Cached company research
create table if not exists public.company_research (
  company_key  text primary key,          -- lowercased, trimmed, punctuation stripped
  company_name text not null,
  research     jsonb not null,
  searches_used integer not null default 0,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '30 days')
);
create index if not exists idx_company_research_expiry
  on public.company_research (expires_at);
alter table public.company_research enable row level security;
-- No policies. Read and written by the Edge Function under service_role.

-- Prompt instrumentation (consumed by capacity-indicator.md)
create table if not exists public.prompt_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  kind       text not null check (kind in
               ('capacity_impression','capacity_click','capacity_dismiss','waitlist_signup')),
  band       text,
  created_at timestamptz not null default now()
);
alter table public.prompt_events enable row level security;
create policy "insert own events" on public.prompt_events
  for insert to authenticated with check (user_id = auth.uid());

-- Waitlist (consumed by capacity-indicator.md)
create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  user_id     uuid references auth.users(id) on delete set null,
  notified_at timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.waitlist enable row level security;
create policy "anyone can join" on public.waitlist
  for insert to anon, authenticated with check (true);
-- No select policy. service_role reads for the notify batch.
```

---

## 4. Edge Function — daily cap and cost capture

Wrap every Anthropic call in the existing proxy.

**Before the call**
- Resolve `auth.uid()` from the JWT. Reject unauthenticated requests with `401`.
- Read today's row. If `calls >= DAILY_CALL_LIMIT` (env var, start at **10**), return `429` with `{ error: "DAILY_LIMIT", resets_at: <UTC midnight> }`. Human-readable copy, not a stack trace.

**After the call — capture all four cost components**

| Source | Field | Notes |
|---|---|---|
| Input tokens | `usage.input_tokens` | |
| Output tokens | `usage.output_tokens` | |
| Cache tokens | `usage.cache_read_input_tokens`, `usage.cache_creation_input_tokens` | Price differently from standard input — do not fold into `input_tokens` |
| **Web searches** | `usage.server_tool_use.web_search_requests` | **$0.01 per search, billed per search not per token** |

**Web search is the one most likely to be missed and the most damaging to omit.** A research call with `max_uses: 5` incurs $0.05 in search fees that appear nowhere in the token counts. Omitting it makes `est_cost_usd` under-report, which makes the capacity indicator show green while the balance drains — the exact failure the indicator exists to prevent.

Hold the price map in a constants file, not scattered literals. It must cover: per-model input, output, cache-read and cache-write rates, plus the flat per-search fee.

**Notes**
- `est_cost_usd` is the **balance source of truth** under §5, not merely a per-user metric. Accuracy matters.
- Fail open on counter write errors — log and serve the request. Telemetry must never break the product.
- Single `upsert ... on conflict (user_id, day) do update` rather than read-then-write, to avoid races on concurrent requests.
- Handle a `429` from Anthropic as "busy, try again shortly" in the UI. Hitting your own rate limit during a spike is the worst moment to look broken.

---

## 5. Balance

No public credit-balance endpoint exists — `GET /v1/organizations/balance` returns 404. Balance is derived.

```sql
create or replace function public.get_balance_usd()
returns numeric language sql security definer set search_path = public as $$
  with latest as (
    select purchased_at from public.credit_topups
    order by purchased_at desc limit 1
  )
  select coalesce((select sum(amount_usd) from public.credit_topups), 0)
       - coalesce((
           select sum(est_cost_usd) from public.usage_counters
            where updated_at >= (select purchased_at from latest)
         ), 0);
$$;
```

**Seeding the ledger.** Record the **balance the Console shows after topping up**, not the amount purchased — recording the purchase ignores what was already there and what was spent before the ledger existed. One row, `purchased_at = now()`. Everything prior is out of scope. Repeat on every future top-up.

**Why self-derived rather than the Admin API.** The Admin Usage API needs an Admin key, which requires a non-individual organization. This account is an Individual Org, so only workspace keys are available. The self-derived ledger removes that dependency entirely, and is real-time where the Admin API lags ~5 minutes.

**Known limits.** Counts only traffic through the proxy — Colin's own Claude Code and Console usage is invisible to it. Drifts if the price map goes stale.

**Reconciliation.** Console → API keys shows per-key Cost. Compare monthly against `get_balance_usd()`. Divergence beyond ~10% means the price map is wrong.

*Upgrade path, if ever needed: convert to a team organization, create an Admin key, and poll `/v1/organizations/usage_report/messages` with `bucket_width=1h` (the cost report only supports daily buckets — too coarse for a runway calculation). Workload Identity Federation was considered and rejected: it requires an OIDC provider (GitHub Actions, AWS, GCP, Entra, Kubernetes) and Supabase Edge Functions provide no identity token to exchange.*

---

## 6. Company research cache

**Highest-leverage cost optimisation in this spec.** Job seekers cluster hard on the same employers. Two users applying to the same company should not trigger two research passes at $0.05 each.

- Before any research call, normalise the company name (lowercase, trim, strip punctuation and legal suffixes — GmbH, Inc, Ltd, AG) into `company_key`.
- Look up `company_research`. On a live hit (`expires_at > now()`), return the cached payload and make **no** Anthropic call.
- On a miss, run research, store the result with `searches_used`, and set a 30-day TTL.
- A cache hit still increments `calls` in `usage_counters` — the user consumed their daily allowance — but adds nothing to `est_cost_usd`.
- Purge expired rows on a schedule, or lazily on read.

Also reduce `max_uses` in `src/lib/claude.js` from **5 to 3** and compare output against a handful of real job descriptions. If quality holds, that's 40% off every uncached research call. Keep the `Math.min(max_uses, MAX_TOOL_USES)` server-side clamp — a client must never be able to request more than the ceiling.

---

## 7. Model choice

Verify which model the Edge Function requests (`grep -rn '"model"' supabase/functions/`; check Supabase secrets if it comes from an env var).

If it's Opus, run the same CV and job description through Opus and Sonnet and compare. Tailoring against a stored master with explicit canonical-facts rules is constrained rewriting, not open-ended reasoning — Sonnet is likely sufficient, at several times less per token. On a $50 balance that's the difference between a few hundred runs and a few thousand. Gap analysis may justify the stronger model; the tailoring pass probably does not.

Report the finding before changing anything.

---

## 8. Build order

1. Migration — all tables above, RLS, `get_balance_usd()`.
2. Edge Function: daily cap, four-component cost capture, fail-open telemetry.
3. Company research cache.
4. Model comparison — report, don't change.

`capacity-indicator.md` follows once `get_balance_usd()` returns sane values.

---

## 9. Non-negotiables

- `service_role` never reaches the client. Anon key plus RLS.
- RLS enabled on every table before it ships.
- The balance figure never crosses to the client — band only, per `capacity-indicator.md`.
- No feature gated behind donating.
- Test every policy with `set role authenticated; set request.jwt.claims.sub = '<uuid>';` before declaring done.

---

## 10. Acceptance

- [ ] Unauthenticated request to the proxy → `401`.
- [ ] 11th call in a UTC day by one user → `429` with `DAILY_LIMIT`, no Anthropic call made.
- [ ] `usage_counters` shows correct `calls`, non-zero token counts, and correct cache-token split after a real tailoring.
- [ ] A research call performing web searches increments `web_searches` and raises `est_cost_usd` by ~$0.01 per search.
- [ ] `est_cost_usd` summed over a test session matches the Console's per-key Cost within ~10%. **This is the test that catches a wrong price map.**
- [ ] A user cannot select another user's `usage_counters` row.
- [ ] No client-reachable path returns `credit_topups` rows or a raw balance.
- [ ] `get_balance_usd()` returns the full top-up total when `usage_counters` is empty, and drops by roughly the expected amount after a tailoring.
- [ ] Second research call for the same company makes no Anthropic call and adds nothing to `est_cost_usd`.
- [ ] Expired cache entry triggers a fresh research call.
- [ ] Counter write failure does not break a tailoring request.
