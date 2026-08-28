// Shared cost-capture helper for any edge function that calls Anthropic.
//
// Purpose: keep every Anthropic call — tailoring proxy, gap-analysis, jobsearch
// — reporting into the SAME usage_counters ledger, so get_balance_usd() reflects
// true spend across all surfaces. If any function's calls bypass this, the
// derived balance drifts and the capacity indicator (spec §5) becomes wrong.
//
// Design: fail-open. A cost-capture failure logs and returns; it never throws
// or blocks the caller. That's the non-negotiable from spec §4 / §9.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { computeCostUsd, type RawUsage } from "./pricing.ts";

let cachedServiceClient: SupabaseClient | null = null;

// Service-role client for RPC calls that need to bypass RLS. Never returned
// to any user-code path. Cached per-isolate.
export function getServiceClient(): SupabaseClient {
  if (cachedServiceClient) return cachedServiceClient;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
  cachedServiceClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedServiceClient;
}

// Suggested session_key format for authenticated calls (gap-analysis, jobsearch):
//   `user:${auth.uid()}`
// so the daily rollup lands on a stable per-user row and doesn't collide with
// the head-hunter-claude session_keys (which are SHA-256 hashes of IP+salt).
export function userSessionKey(userId: string): string {
  return `user:${userId}`;
}

// Record one Anthropic call's cost into usage_counters. Session_key is
// opaque text — pass whatever attribution identifier the caller has.
// Never throws. Never blocks. Set p_is_tailoring_start=false (tailoring
// count is tracked only by head-hunter-claude, which uses its own path).
export async function recordAnthropicUsage(opts: {
  session_key: string;
  model:       string;
  usage:       RawUsage | undefined | null;
}): Promise<void> {
  try {
    const { session_key, model, usage } = opts;
    const c = computeCostUsd(model, usage);
    const supa = getServiceClient();
    const { error } = await supa.rpc("record_usage", {
      p_session_key:        session_key,
      p_input_tokens:       c.input_tokens,
      p_output_tokens:      c.output_tokens,
      p_cache_read_tokens:  c.cache_read_tokens,
      p_cache_write_tokens: c.cache_write_tokens,
      p_web_searches:       c.web_searches,
      p_cost_usd:           c.cost_usd,
      p_is_tailoring_start: false,
    });
    if (error) console.error("[cost] record_usage failed:", error);
  } catch (e) {
    console.error("[cost] recordAnthropicUsage threw:", e);
  }
}
