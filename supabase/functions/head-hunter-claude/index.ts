import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

// Server tools we forward to Anthropic. Keep this allow-list tight — anything
// unrecognized is rejected so a compromised client cannot enable arbitrary
// server tools that bill against our key.
const ALLOWED_TOOL_TYPES = new Set([
  "web_search_20250305",
]);
const MAX_TOOLS = 4;
const MAX_TOOL_USES = 10;

const MAX_TOKENS_CAP = 8000;
const MAX_BODY_BYTES = 200_000;

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimit = new Map<string, { count: number; resetAt: number }>();

const SESSION_TTL_MS = 10 * 60 * 1000;
const SESSION_FUTURE_SLOP_MS = 60_000;

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

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
      "Content-Type, Authorization, cf-turnstile-token, x-session-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Expose-Headers": "x-session-token",
  };
}

function jsonError(
  status: number,
  message: string,
  corsHeaders: Record<string, string>,
) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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
  try {
    sigBytes = fromB64url(parts[2]);
  } catch {
    return false;
  }

  const key = await getHmacKey();
  return await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    new TextEncoder().encode(`${ts}.${ip}`),
  );
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) {
    console.error("TURNSTILE_SECRET_KEY not set");
    return false;
  }
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
  const sessionToken = req.headers.get("x-session-token");

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

  if (!checkRateLimit(ip)) {
    return jsonError(429, "Too many requests. Try again shortly.", corsHeaders);
  }

  const apiKey = Deno.env.get("HEAD_HUNTER");
  if (!apiKey) {
    console.error("Server misconfiguration: HEAD_HUNTER secret not set");
    return jsonError(500, "Server misconfigured", corsHeaders);
  }

  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) {
    return jsonError(413, "Request body too large", corsHeaders);
  }

  try {
    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return jsonError(413, "Request body too large", corsHeaders);
    }

    const body = JSON.parse(rawBody);
    const { model, max_tokens, messages, masterCV, tools } = body;

    if (typeof model !== "string" || !ALLOWED_MODELS.has(model)) {
      return jsonError(400, "Unsupported model", corsHeaders);
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonError(400, "Missing messages", corsHeaders);
    }
    const cappedMaxTokens = Math.min(
      Number.isFinite(max_tokens) ? max_tokens : MAX_TOKENS_CAP,
      MAX_TOKENS_CAP,
    );

    let safeTools: unknown = undefined;
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
          const name = (t as Record<string, unknown>).name;
          const maxUses = (t as Record<string, unknown>).max_uses;
          const cappedMaxUses = Math.min(
            Number.isFinite(maxUses) ? Number(maxUses) : MAX_TOOL_USES,
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

    // When masterCV is provided separately, restructure messages to enable
    // prompt caching. The master CV is stable across the 3-call pipeline,
    // so marking it cacheable saves ~90% of its input token cost on calls 2+3.
    let finalMessages = messages;
    if (masterCV && messages.length === 1 && typeof messages[0].content === "string") {
      finalMessages = [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: masterCV,
              cache_control: { type: "ephemeral" },
            },
            {
              type: "text",
              text: messages[0].content,
            },
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

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(upstreamPayload),
    });

    const responseBody = await res.text();
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": "application/json",
    };
    if (issueNewSession && res.ok) {
      responseHeaders["x-session-token"] = await issueSessionToken(ip);
    }
    return new Response(responseBody, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (e) {
    console.error("Generation failed:", e);
    return jsonError(500, "Generation failed. Try again.", corsHeaders);
  }
});
