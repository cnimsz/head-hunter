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

const MAX_TOKENS_CAP = 8000;
const MAX_BODY_BYTES = 200_000;

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimit = new Map<string, { count: number; resetAt: number }>();

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
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-hh-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function jsonError(status: number, message: string, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonError(405, "Method not allowed", corsHeaders);
  }

  const appToken = Deno.env.get("HEAD_HUNTER_APP_TOKEN");
  if (!appToken) {
    console.error("Server misconfiguration: HEAD_HUNTER_APP_TOKEN not set");
    return jsonError(500, "Server misconfigured", corsHeaders);
  }
  if (req.headers.get("x-hh-token") !== appToken) {
    return jsonError(401, "Unauthorized", corsHeaders);
  }

  const ip = getClientIp(req);
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
    const { model, max_tokens, messages, masterCV } = body;

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

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: cappedMaxTokens, messages: finalMessages }),
    });

    const responseBody = await res.text();
    return new Response(responseBody, {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Generation failed:", e);
    return jsonError(500, "Generation failed. Try again.", corsHeaders);
  }
});
