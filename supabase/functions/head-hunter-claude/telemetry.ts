// Fail-open telemetry. Every function here catches its own errors and logs
// them, never throws — the spec §4 non-negotiable is that a counter write
// failure must not break a tailoring request.

import { getServiceClient } from "./db.ts";
import type { ComputedUsage } from "../_shared/pricing.ts";

export interface CallRecord extends ComputedUsage {
  kind: string;    // 'cv' | 'research' | 'coverLetter'
  model: string;
  at?: string;
}

// Check today's tailoring count against the daily cap.
// Fail-open: on DB error, allow through (we log; the human sees no error).
// Under a real outage the spend limit (§2) is still the true ceiling.
export async function checkDailyCap(session_key: string, limit: number): Promise<{
  allowed: boolean;
  count: number;
}> {
  try {
    const supa = getServiceClient();
    const day = new Date().toISOString().slice(0, 10);
    const { data, error } = await supa
      .from("usage_counters")
      .select("tailorings")
      .eq("session_key", session_key)
      .eq("day", day)
      .maybeSingle();
    if (error) {
      console.error("[telemetry] checkDailyCap query failed:", error);
      return { allowed: true, count: 0 };
    }
    const count = (data?.tailorings as number | undefined) ?? 0;
    return { allowed: count < limit, count };
  } catch (e) {
    console.error("[telemetry] checkDailyCap threw:", e);
    return { allowed: true, count: 0 };
  }
}

// Insert a new batch row on call 1. Returns batch_id or null on failure.
// Failing here still lets the call proceed — we lose per-tailoring detail
// but the daily rollup on usage_counters still lands.
export async function startBatch(session_key: string): Promise<string | null> {
  try {
    const supa = getServiceClient();
    const { data, error } = await supa
      .from("generation_batches")
      .insert({ session_key, status: "in_progress" })
      .select("id")
      .single();
    if (error || !data) {
      console.error("[telemetry] startBatch failed:", error);
      return null;
    }
    return data.id as string;
  } catch (e) {
    console.error("[telemetry] startBatch threw:", e);
    return null;
  }
}

// Verify batch_id belongs to this session_key. Cheap DB lookup by PK.
// Anti-pattern to guard against: an attacker echoing someone else's batch_id
// to piggyback usage onto their tailoring.
export async function verifyBatch(batch_id: string, session_key: string): Promise<boolean> {
  try {
    const supa = getServiceClient();
    const { data, error } = await supa
      .from("generation_batches")
      .select("session_key")
      .eq("id", batch_id)
      .maybeSingle();
    if (error || !data) return false;
    return data.session_key === session_key;
  } catch {
    return false;
  }
}

// Record one call's usage. Two atomic RPCs — one for the daily rollup, one
// for the batch row. is_tailoring_start=true increments usage_counters.tailorings.
// research_cache_hit=true flags the batch row for post-hoc cost analysis.
export async function recordCall(opts: {
  session_key: string;
  batch_id: string | null;
  usage: CallRecord;
  is_tailoring_start: boolean;
  research_cache_hit?: boolean;
}): Promise<void> {
  const { session_key, batch_id, usage, is_tailoring_start, research_cache_hit } = opts;
  try {
    const supa = getServiceClient();

    const rollup = supa.rpc("record_usage", {
      p_session_key:        session_key,
      p_input_tokens:       usage.input_tokens,
      p_output_tokens:      usage.output_tokens,
      p_cache_read_tokens:  usage.cache_read_tokens,
      p_cache_write_tokens: usage.cache_write_tokens,
      p_web_searches:       usage.web_searches,
      p_cost_usd:           usage.cost_usd,
      p_is_tailoring_start: is_tailoring_start,
    });

    const batchWrite = batch_id
      ? supa.rpc("record_batch_call", {
          p_batch_id:            batch_id,
          p_call:                { ...usage, at: new Date().toISOString() },
          p_input_tokens:        usage.input_tokens,
          p_output_tokens:       usage.output_tokens,
          p_cache_read_tokens:   usage.cache_read_tokens,
          p_cache_write_tokens:  usage.cache_write_tokens,
          p_web_searches:        usage.web_searches,
          p_cost_usd:            usage.cost_usd,
          p_research_cache_hit:  research_cache_hit ?? false,
        })
      : Promise.resolve({ error: null } as { error: null });

    const [rRoll, rBatch] = await Promise.all([rollup, batchWrite]);
    if ((rRoll as { error?: unknown }).error) {
      console.error("[telemetry] record_usage failed:", (rRoll as { error?: unknown }).error);
    }
    if ((rBatch as { error?: unknown }).error) {
      console.error("[telemetry] record_batch_call failed:", (rBatch as { error?: unknown }).error);
    }
  } catch (e) {
    console.error("[telemetry] recordCall threw:", e);
  }
}

export async function closeBatch(batch_id: string, status: "complete" | "failed" | "partial" = "complete"): Promise<void> {
  try {
    const supa = getServiceClient();
    const { error } = await supa.rpc("close_batch", { p_batch_id: batch_id, p_status: status });
    if (error) console.error("[telemetry] close_batch failed:", error);
  } catch (e) {
    console.error("[telemetry] closeBatch threw:", e);
  }
}
