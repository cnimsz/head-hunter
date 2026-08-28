// Public Anthropic proxy for the CV tailoring pipeline.
//
// Auth: Turnstile on call 1 → HMAC session token on calls 2 & 3. NOT
// Supabase Auth — the tailoring flow is intentionally public.
//
// Phase 0 additions (spec: /specs/phase-0-guardrails.md):
//   • session_key derived from IP + secret (no user_id available).
//   • Daily tailoring cap enforced on call 1 (Turnstile).
//   • Per-tailoring batch id issued on call 1, echoed as x-batch-id on 2 & 3.
//   • Four-component cost capture (input, output, cache read, cache write)
//     plus web_searches at $0.01 each. Price map in ./pricing.ts.
//   • Fail-open telemetry — a counter write failure never breaks generation.
//   • Company research cache with 30-day TTL, keyed on normalised company_key.
//   • Balance short-circuit: balance ≤ 0 → 503 { error: "NO_CAPACITY" }.
//
// Unchanged: Turnstile verification, HMAC session tokens, per-IP rate limit,
// model allow-list, max_tokens cap, body size cap, tool allow-list.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { computeCostUsd } from "./pricing.ts";
import { normaliseCompanyKey } from "./company_key.ts";
import { deriveSessionKey } from "./session_key.ts";
import {
  checkDailyCap,
  startBatch,
  verifyBatch,
  recordCall,
  closeBatch,
} from "./telemetry.ts";
import {
  readCompanyResearch,
  writeCompanyResearch,
  schedulePurge,
} from "./company_cache.ts";
import { getBalanceUsd } from "./balance.ts";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = [
  "https://head-hunter-fawn.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
];

const ALLOWED_MODELS = new Set([
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
  "claude-opus-4-7",
]);

const ALLOWED_TOOL_TYPES = new Set(["web_search_20250305"]);
const ALLOWED_CALL_KINDS = new Set(["cv", "research", "coverLetter"]);

const MAX_TOOLS = 4;
const MAX_TOOL_USES = 10;
const MAX_TOKENS_CAP = 8000;
const MAX_BODY_BYTES = 200_000;

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimit = new Map<string, { count: number; resetAt: number }>();

const SESSION_TTL_MS = 10 * 60 * 1000;
const SESSION_FUTURE_SLOP_MS = 60_000;

const DAILY_CALL_LIMIT = Number(Deno.env.get("DAILY_CALL_LIMIT") ?? "5");

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// ---------------------------------------------------------------------------
// Helpers (rate limit, IP, CORS)
// ---------------------------------------------------------------------------

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || "unknown";
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, cf-turnstile-token, x-session-token, x-batch-id, x-call-kind",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Expose-Headers": "x-session-token, x-batch-id",
  };
}

function jsonError(
  status: number,
  message: string,
  corsHeaders: Record<string, string>,
  extra: Record<string, unknown> = {},
) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// HMAC session token — unchanged
// ---------------------------------------------------------------------------

let cachedHmacKey: CryptoKey | null = null;

async function getHmacKey(): Promise<CryptoKey> {
  if (cachedHmacKey) return cachedHmacKey;
  const secret = Deno.env.get("HEAD_HUNTER_SESSION_SECRET");
  if (!secret) throw new Error("HEAD_HUNTER_SESSION_SECRET not set");
  cachedHmacKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return cachedHmacKey;
}

function b64url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function issueSessionToken(ip: string): Promise<string> {
  const key = await getHmacKey();
  const ts = Date.now();
  const payload = `${ts}.${ip}`;
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return `v1.${ts}.${b64url(sig)}`;
}

async function verifySessionToken(token: string, ip: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const ts = Number(parts[1]);
  if (!Number.isFinite(ts)) return false;
  const now = Date.now();
  if (now - ts > SESSION_TTL_MS) return false;
  if (ts - now > SESSION_FUTURE_SLOP_MS) return false;
  let sigBytes: Uint8Array;
  try { sigBytes = fromB64url(parts[2]); } catch { return false; }
  const key = await getHmacKey();
  return await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes as BufferSource,
    new TextEncoder().encode(`${ts}.${ip}`),
  );
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) { console.error("TURNSTILE_SECRET_KEY not set"); return false; }
  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (ip && ip !== "unknown") form.set("remoteip", ip);
  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const data = await res.json();
    return data?.success === true;
  } catch (e) {
    console.error("Turnstile siteverify failed:", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Small helper: return UTC midnight (spec §4 asks for resets_at on 429)
// ---------------------------------------------------------------------------

function nextUtcMidnightIso(): string {
  const now = new Date();
  const next = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0,
  ));
  return next.toISOString();
}

// Wrap a synthesised "cache hit" payload so the client sees the same shape
// it does from Anthropic.
function synthesizeCacheHitResponse(research: Record<string, unknown>): unknown {
  return {
    id: `cache_hit_${Date.now()}`,
    type: "message",
    role: "assistant",
    model: "cache",
    content: [{ type: "text", text: JSON.stringify(research) }],
    stop_reason: "end_turn",
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError(405, "Method not allowed", corsHeaders);
  }

  const ip = getClientIp(req);
  const turnstileToken = req.headers.get("cf-turnstile-token");
  const sessionToken   = req.headers.get("x-session-token");
  const clientBatchId  = req.headers.get("x-batch-id");
  const callKindHdr    = req.headers.get("x-call-kind");
  const callKind = callKindHdr && ALLOWED_CALL_KINDS.has(callKindHdr) ? callKindHdr : null;

  // ---- Auth: Turnstile OR session token -----------------------------------
  let issueNewSession = false;
  if (turnstileToken) {
    const ok = await verifyTurnstile(turnstileToken, ip);
    if (!ok) return jsonError(401, "Bot challenge failed", corsHeaders);
    issueNewSession = true;
  } else if (sessionToken) {
    const ok = await verifySessionToken(sessionToken, ip);
    if (!ok) return jsonError(401, "Session expired or invalid", corsHeaders);
  } else {
    return jsonError(401, "Missing bot challenge or session token", corsHeaders);
  }

  // ---- Per-IP rate limit (unchanged) --------------------------------------
  if (!checkRateLimit(ip)) {
    return jsonError(429, "Too many requests. Try again shortly.", corsHeaders);
  }

  // ---- Derive session_key (used for all counter reads/writes) -------------
  let session_key: string;
  try {
    session_key = await deriveSessionKey(ip);
  } catch (e) {
    console.error("Session-key derivation failed:", e);
    return jsonError(500, "Server misconfigured", corsHeaders);
  }

  // ---- Balance short-circuit (capacity-indicator §6) ----------------------
  const balance = await getBalanceUsd();
  if (balance !== null && balance <= 0) {
    return jsonError(503, "NO_CAPACITY", corsHeaders);
  }

  // ---- Daily cap on new tailorings (call 1 = Turnstile) -------------------
  // The cap is per session_key per UTC day. Fail-open on DB error.
  let batchId: string | null = null;
  const isTailoringStart = issueNewSession; // Turnstile = new batch

  if (isTailoringStart) {
    const cap = await checkDailyCap(session_key, DAILY_CALL_LIMIT);
    if (!cap.allowed) {
      return jsonError(429, "DAILY_LIMIT", corsHeaders, {
        resets_at: nextUtcMidnightIso(),
        limit: DAILY_CALL_LIMIT,
      });
    }
    batchId = await startBatch(session_key);
    // If startBatch failed we continue without per-batch detail; the daily
    // rollup on usage_counters still lands.
  } else {
    // Call 2 or 3. We want to record usage against the existing batch when
    // possible, but a telemetry failure on call 1 (startBatch returned null,
    // so the client has no x-batch-id) must not hard-fail this call. Non-
    // negotiable §9: telemetry failures never break a tailoring.
    //
    //   x-batch-id present + valid    → record to that batch (happy path)
    //   x-batch-id present + invalid  → 403 (hostile / bad state)
    //   x-batch-id missing            → warn, proceed without batch detail
    if (clientBatchId) {
      const ok = await verifyBatch(clientBatchId, session_key);
      if (!ok) {
        return jsonError(403, "Invalid batch id for this session", corsHeaders);
      }
      batchId = clientBatchId;
    } else {
      console.warn("[telemetry] continuation call without x-batch-id — likely startBatch failure upstream; proceeding without batch detail");
      batchId = null;
    }
  }

  // ---- Anthropic key -----------------------------------------------------
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.error("Server misconfiguration: ANTHROPIC_API_KEY secret not set");
    return jsonError(500, "Server misconfigured", corsHeaders);
  }

  // ---- Body parse and validation -----------------------------------------
  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) {
    return jsonError(413, "Request body too large", corsHeaders);
  }

  let body: {
    model?: unknown;
    max_tokens?: unknown;
    messages?: unknown;
    masterCV?: unknown;
    tools?: unknown;
    companyName?: unknown;
  };
  try {
    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return jsonError(413, "Request body too large", corsHeaders);
    }
    body = JSON.parse(rawBody);
  } catch {
    return jsonError(400, "Invalid JSON body", corsHeaders);
  }

  const model      = typeof body.model === "string" ? body.model : "";
  const messages   = body.messages;
  const masterCV   = typeof body.masterCV === "string" ? body.masterCV : null;
  const tools      = body.tools;
  const companyName = typeof body.companyName === "string" ? body.companyName : null;

  if (!ALLOWED_MODELS.has(model)) return jsonError(400, "Unsupported model", corsHeaders);
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonError(400, "Missing messages", corsHeaders);
  }
  const max_tokens_raw = body.max_tokens;
  const cappedMaxTokens = Math.min(
    typeof max_tokens_raw === "number" && Number.isFinite(max_tokens_raw)
      ? max_tokens_raw
      : MAX_TOKENS_CAP,
    MAX_TOKENS_CAP,
  );

  // ---- Tool allow-list & clamp -------------------------------------------
  let safeTools: unknown = undefined;
  let hasWebSearch = false;
  if (tools !== undefined && tools !== null) {
    if (!Array.isArray(tools) || tools.length === 0) {
      return jsonError(400, "tools must be a non-empty array", corsHeaders);
    }
    if (tools.length > MAX_TOOLS) {
      return jsonError(400, "Too many tools requested", corsHeaders);
    }
    const sanitized: unknown[] = [];
    for (const t of tools) {
      if (!t || typeof t !== "object") {
        return jsonError(400, "Invalid tool entry", corsHeaders);
      }
      const type = (t as Record<string, unknown>).type;
      if (typeof type !== "string" || !ALLOWED_TOOL_TYPES.has(type)) {
        return jsonError(400, "Unsupported tool type", corsHeaders);
      }
      if (type === "web_search_20250305") {
        hasWebSearch = true;
        const name = (t as Record<string, unknown>).name;
        const maxUses = (t as Record<string, unknown>).max_uses;
        const cappedMaxUses = Math.min(
          typeof maxUses === "number" && Number.isFinite(maxUses)
            ? Number(maxUses) : MAX_TOOL_USES,
          MAX_TOOL_USES,
        );
        sanitized.push({
          type,
          name: typeof name === "string" ? name : "web_search",
          max_uses: cappedMaxUses,
        });
      }
    }
    safeTools = sanitized;
  }

  // ---- Company research cache check (research call only) ------------------
  // Only tests the cache when this is the research call AND we have a usable
  // company name. On a live hit, skip the Anthropic call, record a $0
  // "call" against the counters, and return a synthesised response.
  //
  // Correctness caveat: spec §6 says "return the cached payload" — that
  // means a second applicant to the same company gets the first applicant's
  // hiringManager and linkedInMessage. Both are role/CV-specific; caching
  // them is a spec bug. Flagged in the phase-0 report. Left as spec-literal.
  const isResearchCall = hasWebSearch || callKind === "research";
  let cacheHit = false;
  if (isResearchCall && companyName) {
    const key = normaliseCompanyKey(companyName);
    if (key) {
      const hit = await readCompanyResearch(key);
      if (hit) {
        cacheHit = true;
        // Fire-and-forget lazy purge of expired rows (at most once per isolate).
        schedulePurge();
        // Cost = 0, but usage_counters.calls still increments (spec §6).
        const usage = { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0,
                        cache_write_tokens: 0, web_searches: 0, cost_usd: 0,
                        kind: "research", model: "cache" };
        await recordCall({
          session_key, batch_id: batchId, usage,
          is_tailoring_start: false, research_cache_hit: true,
        });
        const payload = synthesizeCacheHitResponse(hit.research);
        const headers: Record<string, string> = {
          ...corsHeaders,
          "Content-Type": "application/json",
        };
        if (batchId) headers["x-batch-id"] = batchId;
        if (issueNewSession) headers["x-session-token"] = await issueSessionToken(ip);
        return new Response(JSON.stringify(payload), { status: 200, headers });
      }
    }
  }

  // ---- Restructure messages for prompt caching on masterCV ---------------
  // Marks the master CV as ephemeral cache_control so calls 2 and 3 pay only
  // the read rate (10% of input). Removed from the research call by the
  // client — it wasn't used there and inflated cache-write cost.
  const msgArr = messages as Array<{ content?: unknown; role?: unknown }>;
  let finalMessages: unknown[] = msgArr;
  if (masterCV && msgArr.length === 1 && typeof msgArr[0].content === "string") {
    finalMessages = [
      {
        role: "user",
        content: [
          { type: "text", text: masterCV, cache_control: { type: "ephemeral" } },
          { type: "text", text: msgArr[0].content },
        ],
      },
    ];
  }

  const upstreamPayload: Record<string, unknown> = {
    model,
    max_tokens: cappedMaxTokens,
    messages: finalMessages,
  };
  if (safeTools) upstreamPayload.tools = safeTools;

  // ---- Anthropic call ----------------------------------------------------
  let anthropicRes: Response;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(upstreamPayload),
    });
  } catch (e) {
    console.error("Anthropic fetch threw:", e);
    if (batchId) closeBatch(batchId, "failed");
    return jsonError(502, "Upstream network error", corsHeaders);
  }

  const responseBody = await anthropicRes.text();
  let parsedResponse: Record<string, unknown> | null = null;
  try { parsedResponse = JSON.parse(responseBody); } catch { /* keep null */ }

  // ---- Cost capture & telemetry (fail-open) ------------------------------
  if (anthropicRes.ok && parsedResponse) {
    const usageBlock = (parsedResponse as { usage?: unknown }).usage as
      Parameters<typeof computeCostUsd>[1];
    const usage = computeCostUsd(model, usageBlock);
    const callRecord = {
      kind: callKind ?? (hasWebSearch ? "research" : (issueNewSession ? "cv" : "unknown")),
      model,
      ...usage,
    };
    // Await so we can't lose the write to isolate shutdown. recordCall is
    // fail-open (never throws), so awaiting only adds latency, not risk.
    await recordCall({
      session_key,
      batch_id: batchId,
      usage: callRecord,
      is_tailoring_start: isTailoringStart,
    });

    // ---- Company research cache write on miss --------------------------
    if (isResearchCall && !cacheHit && companyName) {
      const key = normaliseCompanyKey(companyName);
      if (key) {
        // Extract the JSON payload from the last text block.
        const blocks = Array.isArray((parsedResponse as { content?: unknown }).content)
          ? (parsedResponse as { content: Array<{ type?: string; text?: string }> }).content
          : [];
        const textBlocks = blocks.filter((b) => b?.type === "text" && typeof b.text === "string");
        const text = textBlocks.length ? textBlocks[textBlocks.length - 1].text ?? "" : "";
        try {
          // Loose JSON extract (fenced or not).
          const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
          const s = cleaned.indexOf("{");
          const e = cleaned.lastIndexOf("}");
          if (s !== -1 && e > s) {
            const research = JSON.parse(cleaned.slice(s, e + 1));
            await writeCompanyResearch({
              company_key:   key,
              company_name:  companyName.trim(),
              research,
              searches_used: usage.web_searches,
            });
          }
        } catch (err) {
          console.error("[cache write] failed to parse research JSON:", err);
        }
      }
    }

    // Close the batch when the last call of the pipeline completes.
    if (callKind === "coverLetter" && batchId) {
      await closeBatch(batchId, "complete");
    }
  } else if (batchId) {
    // Upstream error — mark the batch failed so post-hoc queries can filter.
    await closeBatch(batchId, "failed");
  }

  // ---- Return response ----------------------------------------------------
  const responseHeaders: Record<string, string> = {
    ...corsHeaders,
    "Content-Type": "application/json",
  };
  if (batchId) responseHeaders["x-batch-id"] = batchId;
  if (issueNewSession && anthropicRes.ok) {
    responseHeaders["x-session-token"] = await issueSessionToken(ip);
  }
  return new Response(responseBody, { status: anthropicRes.status, headers: responseHeaders });
});
