# Phase 0 Addendum — Universal Cost Capture

Amends `phase-0-guardrails-FINAL.md` §4 (usage counter) and §5 (spend tracking).
Supersedes any part of §4 that makes cost capture the client's responsibility.

## Problem

`get_balance_usd()` derives balance from `usage_counters.est_cost_usd`. Anything that
spends on the API but doesn't write there is invisible to the capacity indicator, so the
indicator overstates runway.

Two known gaps:

1. **`gap-analysis` Edge Function.** Deployed on the same project, holds the same key,
   proxies Anthropic. Confirm whether it writes a cost row. Expectation: it does not.
2. **Tailoring batch under-reporting.** Only the CV call of the three-call
   `generateApplication` batch reached `generation_batches`; research and coverLetter
   completed client-side and wrote nothing. Console spend ~$0.24 against a recorded
   $0.102 — roughly 2.4× under-report.

Both have the same root cause: tracking is triggered by the client passing `x-batch-id`
and `x-session-token`, so any caller that omits them spends silently.

## Principle

> Any Edge Function holding the Anthropic API key writes its own cost row from the
> response `usage` block before returning. This is unconditional. Client-supplied
> headers are correlation metadata only — never the trigger for tracking.

A function that returns a `200` without having written a cost row is a bug, whatever
the client sent.

## Schema

Assumption to verify against the live schema before writing the migration: `usage_counters`
is keyed by session/user and day, and carries `est_cost_usd` plus a tailoring count.
Reconcile column names against the actual table; the shape below is the intent, not a
literal diff.

```sql
-- Discriminate billable-and-capped from billable-only.
alter table public.usage_counters
  add column if not exists operation text not null default 'tailoring';

-- Values: 'tailoring' | 'gap_analysis' | 'jobsearch' | 'research'
alter table public.usage_counters
  add constraint usage_counters_operation_chk
  check (operation in ('tailoring','gap_analysis','jobsearch','research'));

create index if not exists usage_counters_operation_idx
  on public.usage_counters (operation, updated_at);
```

Do **not** change `get_balance_usd()`. It sums `est_cost_usd` across all rows, which is
already the behaviour we want — every operation reduces balance. Adding the column
without touching the function is the point.

**Do** change the daily-limit query to filter:

```sql
-- Cap applies to tailorings only.
select coalesce(sum(tailorings_used), 0)
  from public.usage_counters
 where session_token = $1
   and day = current_date
   and operation = 'tailoring';
```

Gap analysis costs money, decrements the indicator, and does not consume anyone's 10/day.

## Edge Function change

Both `head-hunter-claude` and `gap-analysis` get the same helper. Extract it to a shared
module rather than duplicating — `supabase/functions/_shared/track-cost.ts`.

```ts
// Called after every Anthropic response, before returning to the client.
// Failures here must not fail the user's request — log and continue.
export async function trackCost(
  supabase: SupabaseClient,
  args: {
    sessionToken: string | null;
    operation: 'tailoring' | 'gap_analysis' | 'jobsearch' | 'research';
    usage: AnthropicUsage;   // response.usage
    model: string;
    batchId?: string | null; // correlation only
  }
): Promise<void>
```

Requirements:

- Cost derived from `usage` using the existing price map in §4. Include
  `cache_creation_input_tokens` and `cache_read_input_tokens` if present — they are
  priced differently from plain input and are easy to drop.
- Include server-tool cost. If the call used web search, add per-search cost from the
  §4 rules. Gap analysis may or may not search; read `server_tool_use` off the response
  rather than assuming.
- If `sessionToken` is null, still write the row against a sentinel
  (`'unattributed'`). A row that can't be attributed to a user is far better than
  no row — the balance must stay correct even when attribution fails.
- Wrap in try/catch. A tracking failure logs to `last_error` and returns; it never
  propagates to the user. Losing a cost row is bad, failing a paid request is worse.

Streaming note: if either function streams, `usage` only appears on the terminal
`message_delta` event. Track after the stream closes, not at first token, or every
streamed call records zero.

## Verification

Do not mark this done on a code read. Required evidence:

1. **Ledger delta test.** Record `get_balance_usd()`. Run one gap analysis. Re-read.
   The delta must be non-zero and within an order of magnitude of the Console figure
   for that call.
2. **No-header test.** Call `gap-analysis` directly with `x-batch-id` and
   `x-session-token` omitted. A cost row must still be written, under the sentinel
   session. This is the test that proves the client is out of the loop.
3. **Cap isolation test.** Run gap analysis five times against one session. The
   tailoring count for that session must remain unchanged.
4. **Batch reconciliation.** Run one full `generateApplication`. `call_breakdown` must
   contain three entries, not one. This is the pre-existing bug — do not close this
   addendum while it is open, since it is the same failure mode.
5. **Console reconciliation.** After the above, compare 24h Console spend against
   `sum(est_cost_usd)` over the same window. Under-reporting beyond ~15% means
   something is still untracked; find it before launch.

## Out of scope, flagged

Gap analysis is currently uncapped. Once tracking lands you will be able to see what it
actually costs per run, and whether an unbounded loop on the Master CV is an abuse vector
worth its own daily limit. Decide after there's data — do not guess a number now.
