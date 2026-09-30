// Supabase Edge Function: report-usage
//
// Lets OTHER projects that share Head Hunter's Anthropic account report their
// Anthropic spend into the same usage_counters ledger, so get_balance_usd()
// and the <funding-status> pill reflect the true shared balance. Without it,
// an outside project's spend is invisible and the pill reads "Plenty" while
// the real balance drains.
//
// Server-to-server only (no CORS — browsers must never hold a project key).
// Auth: header `x-project-key: <secret>`, matched against the Supabase secret
//   USAGE_REPORT_KEYS = "fantasy-football-reporter:<secret>,other-project:<secret>"
// Each project gets its own secret so one can be revoked without touching
// the others. Rows land as session_key = "project:<name>", operation =
// "external".
//
// Body: { model: string, usage: <Anthropic `usage` object, verbatim>,
//         batch?: boolean }   // true for Message Batches API results (50% tokens)
// Responses: 204 recorded · 400 bad body/unknown model · 401 bad key ·
//            405 · 413 too large · 429 rate limited or daily $ cap reached ·
//            502 ledger write failed (caller may retry).
//
// Cost capture reuses recordAnthropicUsage and the single MODEL_PRICING
// source of truth.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient, recordAnthropicUsage } from "../_shared/cost.ts";
import { computeCostUsd, MODEL_PRICING, type RawUsage } from "../_shared/pricing.ts";

const MAX_BODY_BYTES = 10_000;
// Bounds at real API limits (1M-token context, well under 200K output), so a
// leaked key or buggy client can't record an absurd cost in one report.
const MAX_INPUT_TOKENS = 1_000_000; // input + cache read + cache write combined
const MAX_OUTPUT_TOKENS = 200_000;
const MAX_WEB_SEARCHES = 100;
// Per-project daily ceiling on reported spend. The shared balance funds Head
// Hunter too — one misbehaving project must not be able to drain it to
// "empty" (which 503s every Head Hunter user). Override with the
// USAGE_REPORT_DAILY_CAP_USD secret.
const DAILY_CAP_USD = (() => {
  const v = Number(Deno.env.get("USAGE_REPORT_DAILY_CAP_USD") ?? "25");
  return Number.isFinite(v) && v > 0 ? v : 25;
})();
const PROJECT_NAME_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

// Per-project rate limit (in-memory, per-isolate — same pattern as the other
// edge functions). Generous: a report is cheap, and one real Anthropic call
// produces exactly one report.
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimit = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimit.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// Parse USAGE_REPORT_KEYS once per isolate. Malformed entries are skipped
// with a log line rather than taking the whole function down.
function loadProjectKeys(): Array<{ project: string; secret: string }> {
  const raw = Deno.env.get("USAGE_REPORT_KEYS") ?? "";
  const out: Array<{ project: string; secret: string }> = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    const project = idx > 0 ? trimmed.slice(0, idx) : "";
    const secret = idx > 0 ? trimmed.slice(idx + 1) : "";
    if (!PROJECT_NAME_RE.test(project) || secret.length < 16) {
      console.error(`[report-usage] skipping malformed USAGE_REPORT_KEYS entry for "${project}"`);
      continue;
    }
    out.push({ project, secret });
  }
  return out;
}
const PROJECT_KEYS = loadProjectKeys();

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

// Compare against every entry (no early exit) so timing doesn't reveal which
// project matched.
function projectForKey(key: string | null): string | null {
  if (!key) return null;
  let match: string | null = null;
  for (const { project, secret } of PROJECT_KEYS) {
    if (timingSafeEqual(key, secret)) match = project;
  }
  return match;
}

function count(v: unknown, max: number): number | null {
  if (v === undefined || v === null) return 0;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > max) return null;
  return v;
}

// Accept only the fields computeCostUsd reads, each a bounded non-negative
// integer. Anything else in the Anthropic usage object is ignored.
function sanitizeUsage(u: unknown): RawUsage | null {
  if (!u || typeof u !== "object") return null;
  const r = u as Record<string, unknown>;
  const input = count(r.input_tokens, MAX_INPUT_TOKENS);
  const output = count(r.output_tokens, MAX_OUTPUT_TOKENS);
  const cacheRead = count(r.cache_read_input_tokens, MAX_INPUT_TOKENS);
  const cacheWrite = count(r.cache_creation_input_tokens, MAX_INPUT_TOKENS);
  const stu = r.server_tool_use as Record<string, unknown> | undefined;
  const searches = count(stu && typeof stu === "object" ? stu.web_search_requests : 0, MAX_WEB_SEARCHES);
  if ([input, output, cacheRead, cacheWrite, searches].some((n) => n === null)) return null;
  if (input! + cacheRead! + cacheWrite! > MAX_INPUT_TOKENS) return null;
  return {
    input_tokens: input!,
    output_tokens: output!,
    cache_read_input_tokens: cacheRead!,
    cache_creation_input_tokens: cacheWrite!,
    server_tool_use: { web_search_requests: searches! },
  };
}

// Today's (UTC) reported spend for this project. The usage_counters primary
// key is (session_key, day, operation), so this is at most one row. On a
// read error, fail open — blocking would lose real spend from the ledger,
// and per-report size is already bounded above.
async function spentTodayUsd(sessionKey: string): Promise<number> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await getServiceClient()
      .from("usage_counters")
      .select("est_cost_usd")
      .eq("session_key", sessionKey)
      .eq("day", today)
      .eq("operation", "external")
      .maybeSingle();
    if (error) {
      console.error("[report-usage] daily-cap read failed:", error);
      return 0;
    }
    const v = Number(data?.est_cost_usd ?? 0);
    return Number.isFinite(v) ? v : 0;
  } catch (e) {
    console.error("[report-usage] daily-cap read threw:", e);
    return 0;
  }
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method !== "POST") return jsonError(405, "Method not allowed");

  const project = projectForKey(req.headers.get("x-project-key"));
  if (!project) return jsonError(401, "Invalid project key");

  if (!checkRateLimit(project)) return jsonError(429, "Rate limit exceeded");

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return jsonError(413, "Body too large");
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return jsonError(413, "Body too large");
  }

  let body: { model?: unknown; usage?: unknown; batch?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return jsonError(400, "Body must be JSON");
  }

  const model = typeof body.model === "string" ? body.model : "";
  // Reject rather than record $0 — the caller needs to know its model isn't
  // priced (add it to _shared/pricing.ts).
  // Own-property check: "constructor"/"__proto__" etc. are truthy on a plain
  // object literal and would record NaN cost.
  if (!Object.hasOwn(MODEL_PRICING, model)) {
    return jsonError(400, `Unknown or unpriced model "${model}"`);
  }

  const usage = sanitizeUsage(body.usage);
  if (!usage) return jsonError(400, "Invalid usage object");

  const batch = body.batch === true;
  const sessionKey = `project:${project}`;
  const thisCall = computeCostUsd(model, usage, { batch }).cost_usd;
  if ((await spentTodayUsd(sessionKey)) + thisCall > DAILY_CAP_USD) {
    console.error(`[report-usage] ${project} hit daily cap $${DAILY_CAP_USD}`);
    return jsonError(429, "Daily reporting cap reached for this project");
  }

  const ok = await recordAnthropicUsage({
    session_key: sessionKey,
    operation: "external",
    model,
    usage,
    batch,
  });
  // Unlike the proxies (where the Anthropic call already happened and cost
  // capture is best-effort), recording IS this endpoint's job — tell the
  // caller when it didn't happen.
  if (!ok) return jsonError(502, "Failed to record usage");

  return new Response(null, { status: 204 });
});
