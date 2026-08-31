// Supabase Edge Function: gap-analysis
//
// Backend for the cv-gap-analysis skill. Authenticated via Supabase Auth —
// requires a valid user JWT in the Authorization header. Calls Anthropic
// (with web_search enabled) to produce the structured gap analysis, then
// persists a run row + N finding rows scoped to the user via RLS.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { recordAnthropicUsage, userSessionKey } from "../_shared/cost.ts";
import { MODEL_PRICING } from "../_shared/pricing.ts";

const ALLOWED_ORIGINS = [
  "https://head-hunter-fawn.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
];

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 8000;

// Startup guard: MODEL must have a pricing entry. Without it cost silently
// records as $0 (pricing.ts:71 unknown-model branch). Refuse to serve instead.
if (!MODEL_PRICING[MODEL]) {
  throw new Error(
    `[startup] MODEL "${MODEL}" has no MODEL_PRICING entry — refusing to start.`,
  );
}
const MAX_BODY_BYTES = 200_000;
const WEB_SEARCH_MAX_USES = 5;

// Per-user rate limit. Lower than the public head-hunter-claude limit because
// each gap-analysis call may also incur web_search costs.
const RATE_LIMIT_MAX = 8;
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

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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

// Same loose-JSON extractor as src/lib/claude.js. The model is asked to return
// pure JSON but sometimes wraps in markdown fences or trails with commentary.
function extractJson(text: string): unknown {
  let clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model response");
  }
  let candidate = clean.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    candidate = candidate.replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(candidate);
  }
}

const VALID_TIERS = new Set(["highest", "medium", "hiding"]);

interface RawGap {
  title?: unknown;
  rationale?: unknown;
  question?: unknown;
  impact_tier?: unknown;
}

interface FindingInsert {
  run_id: string;
  user_id: string;
  gap_title: string;
  gap_rationale: string;
  gap_question: string;
  impact_rank: number;
  impact_tier: string;
  status: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError(405, "Method not allowed", corsHeaders);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonError(401, "Missing Authorization header", corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("SUPABASE_URL or SUPABASE_ANON_KEY missing");
    return jsonError(500, "Server misconfigured", corsHeaders);
  }

  // User-scoped client. RLS applies to every read/write here.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonError(401, "Invalid or expired session", corsHeaders);
  }
  const userId = userData.user.id;

  if (!checkRateLimit(userId)) {
    return jsonError(
      429,
      "Too many gap analyses in the last minute. Wait and retry.",
      corsHeaders,
    );
  }

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    console.error("ANTHROPIC_API_KEY secret missing");
    return jsonError(500, "Server misconfigured", corsHeaders);
  }

  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) {
    return jsonError(413, "Request body too large", corsHeaders);
  }

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return jsonError(413, "Request body too large", corsHeaders);
    }
    body = JSON.parse(raw);
  } catch {
    return jsonError(400, "Invalid JSON body", corsHeaders);
  }

  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  if (prompt.length < 50) {
    return jsonError(400, "Missing or too-short prompt", corsHeaders);
  }

  const jdUrl = typeof body.jd_url === "string" ? body.jd_url : null;
  const jdExcerpt =
    typeof body.jd_excerpt === "string" ? body.jd_excerpt.slice(0, 500) : null;
  const companyName =
    typeof body.company_name === "string" ? body.company_name : null;
  const roleTitle = typeof body.role_title === "string" ? body.role_title : null;
  const tailoredCvId =
    typeof body.tailored_cv_id === "string" ? body.tailored_cv_id : null;
  const useWebSearch = body.use_web_search !== false;

  // Insert the run row up front so we have an id to attach findings to. If the
  // model call fails later we still keep the row (status='in_progress') for
  // forensics — the user-facing flow doesn't need it but operators do.
  const { data: run, error: runErr } = await supabase
    .from("gap_analysis_runs")
    .insert({
      user_id: userId,
      tailored_cv_id: tailoredCvId,
      jd_url: jdUrl,
      jd_excerpt: jdExcerpt,
      company_name: companyName,
      role_title: roleTitle,
      status: "in_progress",
    })
    .select()
    .single();

  if (runErr || !run) {
    console.error("Failed to insert run:", runErr);
    return jsonError(500, "Failed to start run", corsHeaders);
  }

  const upstream: Record<string, unknown> = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  };
  if (useWebSearch) {
    upstream.tools = [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: WEB_SEARCH_MAX_USES,
      },
    ];
  }

  let analysis: Record<string, unknown>;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(upstream),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("Anthropic error", res.status, errBody.slice(0, 500));
      return jsonError(502, `Model API error ${res.status}`, corsHeaders);
    }

    const data = await res.json();
    // Record cost to usage_counters BEFORE any subsequent validation so the
    // ledger reflects reality even if we later fail to parse the response.
    // Fail-open — never throws.
    await recordAnthropicUsage({
      session_key: userSessionKey(userId),
      model: MODEL,
      usage: data?.usage,
    });
    const blocks = Array.isArray(data?.content) ? data.content : [];
    // With web_search the response is a mix of tool_use / tool_result / text
    // blocks. The model's final answer is the LAST text block.
    const textBlocks = blocks.filter(
      (b: { type?: string; text?: unknown }) =>
        b?.type === "text" && typeof b.text === "string",
    );
    const text = textBlocks.length
      ? (textBlocks[textBlocks.length - 1].text as string)
      : "";
    if (!text) {
      return jsonError(502, "Empty model response", corsHeaders);
    }
    analysis = extractJson(text) as Record<string, unknown>;
  } catch (e) {
    console.error("Gap analysis failed:", e);
    return jsonError(500, "Generation failed. Try again.", corsHeaders);
  }

  const rawGaps = Array.isArray(analysis?.gaps) ? (analysis.gaps as RawGap[]) : [];
  if (!rawGaps.length) {
    return jsonError(502, "Model returned no gaps", corsHeaders);
  }

  // Validate and shape findings for insert. Drop unusable rows; cap at 20.
  const findings: FindingInsert[] = [];
  for (let i = 0; i < rawGaps.length && findings.length < 20; i++) {
    const g = rawGaps[i];
    const title = typeof g.title === "string" ? g.title.trim().slice(0, 200) : "";
    const rationale =
      typeof g.rationale === "string" ? g.rationale.trim().slice(0, 2000) : "";
    const question =
      typeof g.question === "string" ? g.question.trim().slice(0, 1000) : "";
    const tier =
      typeof g.impact_tier === "string" && VALID_TIERS.has(g.impact_tier)
        ? g.impact_tier
        : "medium";
    if (!title || !question) continue;
    findings.push({
      run_id: run.id,
      user_id: userId,
      gap_title: title,
      gap_rationale: rationale,
      gap_question: question,
      impact_rank: findings.length + 1,
      impact_tier: tier,
      status: "open",
    });
  }

  if (!findings.length) {
    return jsonError(502, "Model returned no usable findings", corsHeaders);
  }

  const { data: insertedFindings, error: findingsErr } = await supabase
    .from("gap_analysis_findings")
    .insert(findings)
    .select();

  if (findingsErr || !insertedFindings) {
    console.error("Failed to insert findings:", findingsErr);
    return jsonError(500, "Failed to save findings", corsHeaders);
  }

  const rawScore = analysis?.match_score;
  const matchScore =
    typeof rawScore === "number" && Number.isFinite(rawScore)
      ? Math.max(0, Math.min(100, Math.round(rawScore)))
      : null;
  const rawRationale = analysis?.score_rationale;
  const matchScoreRationale =
    typeof rawRationale === "string" && rawRationale.trim()
      ? rawRationale.trim().slice(0, 500)
      : null;

  await supabase
    .from("gap_analysis_runs")
    .update({
      total_gaps: insertedFindings.length,
      match_score: matchScore,
      match_score_rationale: matchScoreRationale,
    })
    .eq("id", run.id);

  return new Response(
    JSON.stringify({
      run_id: run.id,
      findings: insertedFindings,
      reframe: analysis?.reframe ?? null,
      shortest_path: Array.isArray(analysis?.shortest_path)
        ? analysis.shortest_path
        : [],
      match_score: matchScore,
      match_score_rationale: matchScoreRationale,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
