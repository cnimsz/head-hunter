// Balance check with a short-lived in-memory cache (per isolate).
// Called on every incoming request before the Anthropic call, per
// capacity-indicator.md §6 — when balance ≤ 0 the proxy returns 503 with
// { error: "NO_CAPACITY" } and the UI shows the waitlist.
//
// The DB read is cheap but not free; the cache TTL trades a few seconds of
// stale-empty for per-request Postgres load. A user seeing tailoring succeed
// with a balance in the red is preferable to every 200ms of Postgres latency
// bleeding into every generation.

import { getServiceClient } from "./db.ts";

const CACHE_TTL_MS = 30_000; // 30s

// value = null means "unknown" (unseeded ledger or transient error). The
// edge function treats null as "don't block". Number(null) is 0 in JS, so
// coercing eagerly would fire 503 NO_CAPACITY on an unseeded ledger — bug
// that hit prod once already.
let cached: { value: number | null; expiresAt: number } | null = null;

export async function getBalanceUsd(): Promise<number | null> {
  const now = Date.now();
  if (cached && now < cached.expiresAt) return cached.value;
  try {
    const supa = getServiceClient();
    const { data, error } = await supa.rpc("get_balance_usd");
    if (error) {
      console.error("[balance] get_balance_usd failed:", error);
      return null; // don't cache — retry on next request
    }
    // SQL NULL (no top-ups seeded) → JS null. Do NOT coerce to Number.
    if (data === null || data === undefined) {
      cached = { value: null, expiresAt: now + CACHE_TTL_MS };
      return null;
    }
    // PostgREST can return numeric as string when precision is high; handle both.
    const val = typeof data === "number" ? data : Number(data);
    if (!Number.isFinite(val)) {
      console.error("[balance] get_balance_usd returned non-finite:", data);
      return null;
    }
    cached = { value: val, expiresAt: now + CACHE_TTL_MS };
    return val;
  } catch (e) {
    console.error("[balance] getBalanceUsd threw:", e);
    return null;
  }
}

// For tests or after a top-up (Colin manually inserts a row) — clear the cache.
export function invalidateBalanceCache(): void {
  cached = null;
}
