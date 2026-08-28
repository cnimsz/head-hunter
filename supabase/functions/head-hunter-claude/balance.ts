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

let cached: { value: number; expiresAt: number } | null = null;

export async function getBalanceUsd(): Promise<number | null> {
  const now = Date.now();
  if (cached && now < cached.expiresAt) return cached.value;
  try {
    const supa = getServiceClient();
    const { data, error } = await supa.rpc("get_balance_usd");
    if (error) {
      console.error("[balance] get_balance_usd failed:", error);
      return null;
    }
    const val = Number(data);
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
