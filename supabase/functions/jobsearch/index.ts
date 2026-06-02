// Supabase Edge Function: jobsearch
//
// Backend for the jobsearch skill. Authenticated via Supabase Auth — requires
// a valid user JWT in the Authorization header. Three actions, dispatched by
// body.action:
//
//   list_active     — return the user's current `status='active'` candidates
//   refresh         — top up the active pool to 3 (source → freshness → score
//                     → dedup → persist → why_chosen)
//   submit_feedback — update candidate status, insert feedback row, recompute
//                     user signals, then refresh
//
// JSearch via RapidAPI is the v1 source. If RAPIDAPI_KEY is unset the client
// returns a small deterministic stub so the rest of the flow stays testable.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// The supabase-js generics are awkward to thread through helper signatures
// (createClient defaults the schema to "public" but the helper signatures
// inferred via ReturnType collapse it to never). We only need the runtime
// methods, so a local untyped alias keeps the helpers readable.
// deno-lint-ignore no-explicit-any
type SbClient = any;

const ALLOWED_ORIGINS = [
  "https://head-hunter-fawn.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
];

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1200;
const MAX_BODY_BYTES = 200_000;
const TARGET_ACTIVE = 3;
const RATE_LIMIT_MAX = 12;
const RATE_LIMIT_WINDOW_MS = 60_000;
const FRESHNESS_TIMEOUT_MS = 6_000;
const JSEARCH_RESULT_BUDGET = 20; // how many JSearch hits to consider per refresh

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

function jsonOk(payload: unknown, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// JSearch client
// ---------------------------------------------------------------------------

interface NormalizedJob {
  company: string;
  title: string;
  location: string;
  jd_url: string;
  external_id: string;
  source: "jsearch" | "stub";
  description_excerpt: string;
}

function pickJSearchLocation(j: Record<string, unknown>): string {
  const city = typeof j.job_city === "string" ? j.job_city : "";
  const state = typeof j.job_state === "string" ? j.job_state : "";
  const country = typeof j.job_country === "string" ? j.job_country : "";
  const remote = j.job_is_remote === true ? "Remote" : "";
  return [remote, [city, state].filter(Boolean).join(", "), country]
    .filter(Boolean)
    .join(" · ");
}

async function searchJobsJSearch(
  query: string,
  apiKey: string,
): Promise<NormalizedJob[]> {
  const url = new URL("https://jsearch.p.rapidapi.com/search");
  url.searchParams.set("query", query);
  url.searchParams.set("num_pages", "1");
  url.searchParams.set("page", "1");
  url.searchParams.set("date_posted", "month");

  const res = await fetch(url.toString(), {
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    },
  });
  if (!res.ok) {
    console.error("JSearch error", res.status, await res.text().catch(() => ""));
    return [];
  }
  const body = await res.json();
  const data: Record<string, unknown>[] = Array.isArray(body?.data)
    ? body.data
    : [];

  const out: NormalizedJob[] = [];
  for (const j of data.slice(0, JSEARCH_RESULT_BUDGET)) {
    const company = typeof j.employer_name === "string" ? j.employer_name : "";
    const title = typeof j.job_title === "string" ? j.job_title : "";
    const apply = typeof j.job_apply_link === "string" ? j.job_apply_link : "";
    if (!company || !title || !apply) continue;
    const desc = typeof j.job_description === "string" ? j.job_description : "";
    out.push({
      company: company.trim().slice(0, 200),
      title: title.trim().slice(0, 200),
      location: pickJSearchLocation(j).slice(0, 200),
      jd_url: apply,
      external_id:
        typeof j.job_id === "string" ? j.job_id : `${company}::${title}`,
      source: "jsearch",
      description_excerpt: desc.slice(0, 1500),
    });
  }
  return out;
}

function stubJobs(): NormalizedJob[] {
  return [
    {
      company: "Stripe",
      title: "Senior Account Executive — Embedded Finance",
      location: "Berlin · Hybrid",
      jd_url: "https://stripe.com/jobs/listing/sae-embedded-berlin",
      external_id: "stub-stripe-sae-embedded",
      source: "stub",
      description_excerpt:
        "Sell Stripe's embedded finance suite to fintech and platform customers across DACH. 7+ years closing six- and seven-figure enterprise SaaS deals expected.",
    },
    {
      company: "Circle",
      title: "Director, Enterprise Sales — EMEA",
      location: "Remote (EMEA)",
      jd_url: "https://www.circle.com/careers/director-enterprise-emea",
      external_id: "stub-circle-director-emea",
      source: "stub",
      description_excerpt:
        "Lead Circle's stablecoin enterprise GTM across EMEA. Sell USDC programmable money rails to banks, payment processors, and fintech platforms.",
    },
    {
      company: "Mollie",
      title: "VP Sales, DACH",
      location: "Amsterdam / Berlin",
      jd_url: "https://jobs.mollie.com/vp-sales-dach",
      external_id: "stub-mollie-vp-dach",
      source: "stub",
      description_excerpt:
        "Run Mollie's DACH commercial team. Manage a quota-carrying team selling payments and BNPL to merchants from SMB to upper mid-market.",
    },
    {
      company: "Chainalysis",
      title: "Sales Director — Banking & FSI, EMEA",
      location: "London / Berlin · Hybrid",
      jd_url: "https://www.chainalysis.com/careers/sales-director-fsi-emea",
      external_id: "stub-chainalysis-sd-fsi",
      source: "stub",
      description_excerpt:
        "Sell Chainalysis compliance and investigations products into Tier-1 banks and FSI buyers across EMEA. Existing relationships into compliance, risk, and FCC orgs strongly preferred.",
    },
    {
      company: "Vercel",
      title: "Strategic Account Director — Financial Services",
      location: "Remote (EMEA)",
      jd_url: "https://vercel.com/careers/strategic-ae-fs",
      external_id: "stub-vercel-sad-fs",
      source: "stub",
      description_excerpt:
        "Own Vercel's strategic FS accounts in EMEA. Sell Next.js / Vercel platform to digital and engineering leaders at banks and insurers replatforming away from legacy stacks.",
    },
  ];
}

async function sourceCandidates(
  query: string,
  apiKey: string | undefined,
): Promise<NormalizedJob[]> {
  if (!apiKey) return stubJobs();
  const jobs = await searchJobsJSearch(query, apiKey);
  if (!jobs.length) {
    // JSearch returned nothing or errored; fall back to stub so the user sees
    // something rather than an empty pool.
    console.warn("JSearch returned 0 jobs; falling back to stub");
    return stubJobs();
  }
  return jobs;
}

// ---------------------------------------------------------------------------
// Freshness check
// ---------------------------------------------------------------------------

async function checkFreshness(
  url: string,
): Promise<"open" | "filled" | "404"> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FRESHNESS_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 404 || res.status === 410) return "404";
    // We can't reliably detect "filled" without per-ATS scrapers; v1 treats
    // any other response as open.
    return "open";
  } catch (e) {
    // Network errors, timeouts, CORS blocks — treat as open optimistically.
    // The user can dismiss it manually if the link 404s on click.
    console.warn("Freshness check failed for", url, e);
    return "open";
  }
}

// ---------------------------------------------------------------------------
// Query building, scoring, signal derivation
// ---------------------------------------------------------------------------

interface UserSignals {
  avoided_industries?: string[];
  preferred_industries?: string[];
  avoided_companies?: string[];
  preferred_companies?: string[];
  ideal_seniority?: string;
  geo?: string;
  salary_floor_eur?: number;
  derived_pass_reason_counts?: Record<string, number>;
  derived_apply_reason_counts?: Record<string, number>;
}

const SENIORITY_HINTS = [
  "vp",
  "vice president",
  "head of",
  "director",
  "senior",
  "lead",
  "principal",
  "chief",
];

const INDUSTRY_HINTS = [
  "fintech",
  "crypto",
  "payments",
  "saas",
  "banking",
  "insurance",
  "infrastructure",
  "ai",
  "cybersecurity",
];

function buildQueryFromCV(masterCvText: string, signals: UserSignals): string {
  const lower = (masterCvText || "").toLowerCase();
  const sen =
    SENIORITY_HINTS.find((s) => lower.includes(s)) || "director";
  const inds = INDUSTRY_HINTS.filter((i) => lower.includes(i)).slice(0, 2);
  const ind = inds.length ? inds.join(" ") : "fintech";
  const geo = signals.geo || guessGeo(lower) || "Berlin";
  // JSearch's query API expects natural-language strings.
  return `${sen} sales ${ind} ${geo}`;
}

function guessGeo(lowerCv: string): string {
  const cities = [
    "berlin",
    "london",
    "amsterdam",
    "munich",
    "paris",
    "dublin",
    "remote",
  ];
  for (const c of cities) if (lowerCv.includes(c)) return c;
  return "";
}

function scoreCandidate(
  job: NormalizedJob,
  cvLower: string,
  signals: UserSignals,
): number {
  const blob = `${job.title} ${job.company} ${job.description_excerpt} ${job.location}`
    .toLowerCase();
  let score = 0;

  // Seniority alignment.
  for (const s of SENIORITY_HINTS) {
    if (blob.includes(s) && cvLower.includes(s)) score += 1.5;
  }

  // Industry overlap.
  for (const i of INDUSTRY_HINTS) {
    if (blob.includes(i) && cvLower.includes(i)) score += 2;
  }

  // Geo overlap.
  const geo = (signals.geo || "").toLowerCase();
  if (geo && blob.includes(geo)) score += 1;
  if (blob.includes("remote")) score += 0.5;

  // Avoided industries / companies.
  for (const a of signals.avoided_industries || []) {
    if (a && blob.includes(a.toLowerCase())) score -= 3;
  }
  for (const a of signals.avoided_companies || []) {
    if (a && job.company.toLowerCase() === a.toLowerCase()) score -= 5;
  }

  // Preferred industries / companies.
  for (const p of signals.preferred_industries || []) {
    if (p && blob.includes(p.toLowerCase())) score += 1.5;
  }
  for (const p of signals.preferred_companies || []) {
    if (p && job.company.toLowerCase() === p.toLowerCase()) score += 3;
  }

  return score;
}

interface FeedbackRow {
  action: "pass" | "apply";
  reason_code: string;
  free_text: string | null;
  candidate_id: string;
}

// Deterministic signal derivation. Reads recent pass/apply feedback rows
// (joined with the candidate they targeted) and produces a preferences_json
// object. We do NOT use the LLM here — reproducibility matters.
function recomputeSignals(
  feedback: FeedbackRow[],
  candidatesById: Map<string, NormalizedJob>,
  existing: UserSignals,
): UserSignals {
  const passCounts: Record<string, number> = {};
  const applyCounts: Record<string, number> = {};

  const avoidedIndustries = new Set(
    (existing.avoided_industries || []).map((s) => s.toLowerCase()),
  );
  const preferredIndustries = new Set(
    (existing.preferred_industries || []).map((s) => s.toLowerCase()),
  );
  const avoidedCompanies = new Set(
    (existing.avoided_companies || []).map((s) => s.toLowerCase()),
  );
  const preferredCompanies = new Set(
    (existing.preferred_companies || []).map((s) => s.toLowerCase()),
  );

  for (const f of feedback) {
    const job = candidatesById.get(f.candidate_id);
    if (f.action === "pass") {
      passCounts[f.reason_code] = (passCounts[f.reason_code] || 0) + 1;
      if (!job) continue;
      const blob =
        `${job.title} ${job.description_excerpt} ${job.location}`.toLowerCase();
      if (f.reason_code === "industry_not_interesting") {
        for (const i of INDUSTRY_HINTS) {
          if (blob.includes(i)) avoidedIndustries.add(i);
        }
      } else if (f.reason_code === "wrong_geography") {
        // Don't infer a positive geo from a pass; user signals it explicitly.
      } else if (f.reason_code === "company_stage") {
        avoidedCompanies.add(job.company.toLowerCase());
      }
    } else {
      applyCounts[f.reason_code] = (applyCounts[f.reason_code] || 0) + 1;
      if (!job) continue;
      const blob =
        `${job.title} ${job.description_excerpt} ${job.location}`.toLowerCase();
      if (
        f.reason_code === "industry_fit" ||
        f.reason_code === "responsibilities_fit"
      ) {
        for (const i of INDUSTRY_HINTS) {
          if (blob.includes(i)) preferredIndustries.add(i);
        }
      } else if (f.reason_code === "company_team") {
        preferredCompanies.add(job.company.toLowerCase());
      }
    }
  }

  return {
    ...existing,
    avoided_industries: Array.from(avoidedIndustries),
    preferred_industries: Array.from(preferredIndustries),
    avoided_companies: Array.from(avoidedCompanies),
    preferred_companies: Array.from(preferredCompanies),
    derived_pass_reason_counts: passCounts,
    derived_apply_reason_counts: applyCounts,
  };
}

// ---------------------------------------------------------------------------
// why_chosen generation (Anthropic)
// ---------------------------------------------------------------------------

interface PreScored {
  job: NormalizedJob;
  score: number;
}

interface WhyChosenInput {
  picks: PreScored[];
  masterCvSummary: string;
  signalsSummary: string;
}

async function generateWhyChosenLines(
  input: WhyChosenInput,
  anthropicKey: string,
): Promise<string[]> {
  if (!input.picks.length) return [];
  const picksBlock = input.picks
    .map(
      (p, i) =>
        `${i + 1}. ${p.job.company} — ${p.job.title} (${p.job.location})\n   JD excerpt: ${p.job.description_excerpt.slice(0, 800)}`,
    )
    .join("\n\n");

  const prompt = `You are explaining to a senior commercial executive why each of the following roles was surfaced to them. The candidate writes one-line "why this role for you" explanations for their own shortlists — match that tone. Direct, named-specific, no hype, no preamble.

Each line MUST:
- Be ONE sentence, max 28 words.
- Name at least one concrete fit signal that is true based on the candidate context (industry overlap, named buyer pool, geo, seniority, product line).
- NEVER invent named customers, deal sizes, or quotas. If you don't have a concrete signal, write the line about the role itself ("greenfield DACH seat at a payments scaleup").
- Never start with "This role" or "This is a great fit" — start with the substantive reason.

## Candidate context

${input.masterCvSummary}

## Derived preferences

${input.signalsSummary || "(none yet — this is an early run)"}

## Candidates

${picksBlock}

## Output

Return ONE JSON array of strings, one per candidate, in the same order as above. No markdown, no commentary, no object wrapper.

Example:
["Stripe is doubling down on embedded finance in DACH and the role maps directly to the institutional + fintech mix in your last two roles.", "..."]`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    console.error(
      "Anthropic why_chosen error",
      res.status,
      (await res.text().catch(() => "")).slice(0, 500),
    );
    return input.picks.map(() => "");
  }
  const data = await res.json();
  const blocks = Array.isArray(data?.content) ? data.content : [];
  const text = blocks
    .filter((b: { type?: string }) => b?.type === "text")
    .map((b: { text?: string }) => b.text || "")
    .join("\n");
  let arr: unknown;
  try {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1) throw new Error("no array");
    arr = JSON.parse(text.slice(start, end + 1));
  } catch (e) {
    console.warn("why_chosen JSON parse failed:", e);
    return input.picks.map(() => "");
  }
  if (!Array.isArray(arr)) return input.picks.map(() => "");
  return input.picks.map((_, i) =>
    typeof arr[i] === "string" ? (arr[i] as string).trim() : "",
  );
}

function summarizeSignals(s: UserSignals): string {
  const parts: string[] = [];
  if (s.preferred_industries?.length)
    parts.push(`Preferred industries: ${s.preferred_industries.join(", ")}`);
  if (s.avoided_industries?.length)
    parts.push(`Avoided industries: ${s.avoided_industries.join(", ")}`);
  if (s.preferred_companies?.length)
    parts.push(`Preferred companies: ${s.preferred_companies.join(", ")}`);
  if (s.avoided_companies?.length)
    parts.push(`Avoided companies: ${s.avoided_companies.join(", ")}`);
  if (s.geo) parts.push(`Geo: ${s.geo}`);
  if (s.ideal_seniority) parts.push(`Seniority: ${s.ideal_seniority}`);
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Core refresh
// ---------------------------------------------------------------------------

interface RefreshArgs {
  supabase: SbClient;
  userId: string;
  masterCvText: string;
  anthropicKey: string;
  jsearchKey: string | undefined;
}

async function loadUserSignals(
  supabase: SbClient,
  userId: string,
): Promise<UserSignals> {
  const { data, error } = await supabase
    .from("jobsearch_user_signals")
    .select("preferences_json")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.warn("loadUserSignals failed:", error);
    return {};
  }
  return (data?.preferences_json as UserSignals) || {};
}

async function loadActiveCount(
  supabase: SbClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("jobsearch_candidates")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) {
    console.warn("loadActiveCount failed:", error);
    return 0;
  }
  return count || 0;
}

async function loadSeenKeys(
  supabase: SbClient,
  userId: string,
): Promise<Set<string>> {
  // Anything we've already shown this user — active, dismissed, or applied —
  // should not re-surface. Dedup by lower(company)::lower(title).
  const { data, error } = await supabase
    .from("jobsearch_candidates")
    .select("company, title")
    .eq("user_id", userId);
  if (error) {
    console.warn("loadSeenKeys failed:", error);
    return new Set();
  }
  const out = new Set<string>();
  for (const r of (data || []) as { company: string; title: string }[]) {
    out.add(`${r.company.toLowerCase()}::${r.title.toLowerCase()}`);
  }
  return out;
}

async function refreshPool({
  supabase,
  userId,
  masterCvText,
  anthropicKey,
  jsearchKey,
}: RefreshArgs): Promise<unknown[]> {
  const activeCount = await loadActiveCount(supabase, userId);
  const slots = Math.max(0, TARGET_ACTIVE - activeCount);
  if (slots === 0) return [];

  const signals = await loadUserSignals(supabase, userId);
  const query = buildQueryFromCV(masterCvText, signals);
  const sourced = await sourceCandidates(query, jsearchKey);
  if (!sourced.length) return [];

  const seen = await loadSeenKeys(supabase, userId);
  const cvLower = (masterCvText || "").toLowerCase();

  // Dedup against seen, then score.
  const scored: PreScored[] = [];
  for (const j of sourced) {
    const key = `${j.company.toLowerCase()}::${j.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    scored.push({ job: j, score: scoreCandidate(j, cvLower, signals) });
  }
  scored.sort((a, b) => b.score - a.score);

  // Take top 3 * slots so freshness drops don't leave us empty.
  const headroom = Math.max(slots * 3, slots + 2);
  const candidatesPreFreshness = scored.slice(0, headroom);

  // Freshness check in parallel.
  const freshnessResults = await Promise.all(
    candidatesPreFreshness.map((c) => checkFreshness(c.job.jd_url)),
  );

  const live: PreScored[] = [];
  for (let i = 0; i < candidatesPreFreshness.length; i++) {
    if (freshnessResults[i] !== "404") live.push(candidatesPreFreshness[i]);
    if (live.length >= slots) break;
  }
  if (!live.length) return [];

  // why_chosen via Anthropic.
  const summaryHead = masterCvText.slice(0, 3000);
  const whyChosen = await generateWhyChosenLines(
    {
      picks: live,
      masterCvSummary: summaryHead,
      signalsSummary: summarizeSignals(signals),
    },
    anthropicKey,
  );

  const inserts = live.map((p, i) => ({
    user_id: userId,
    company: p.job.company,
    title: p.job.title,
    location: p.job.location,
    jd_url: p.job.jd_url,
    why_chosen: whyChosen[i] || null,
    source_score: p.score,
    status: "active",
    jd_status: "open",
    jd_freshness_checked_at: new Date().toISOString(),
    source: p.job.source,
    external_id: p.job.external_id,
  }));

  const { data, error } = await supabase
    .from("jobsearch_candidates")
    .insert(inserts)
    .select();
  if (error) {
    console.error("Failed to insert candidates:", error);
    return [];
  }
  return data || [];
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

async function handleListActive(
  supabase: SbClient,
  userId: string,
  corsHeaders: Record<string, string>,
) {
  const { data, error } = await supabase
    .from("jobsearch_candidates")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("list_active failed:", error);
    return jsonError(500, "Failed to load candidates", corsHeaders);
  }
  return jsonOk({ candidates: data || [] }, corsHeaders);
}

async function handleRefresh(
  supabase: SbClient,
  userId: string,
  masterCvText: string,
  anthropicKey: string,
  jsearchKey: string | undefined,
  corsHeaders: Record<string, string>,
) {
  const newCandidates = await refreshPool({
    supabase,
    userId,
    masterCvText,
    anthropicKey,
    jsearchKey,
  });
  // Return current active pool so the client can render without a second call.
  const { data, error } = await supabase
    .from("jobsearch_candidates")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Post-refresh fetch failed:", error);
    return jsonError(500, "Refresh succeeded but reload failed", corsHeaders);
  }
  return jsonOk(
    { candidates: data || [], newly_added: newCandidates.length },
    corsHeaders,
  );
}

async function recomputeSignalsForUser(
  supabase: SbClient,
  userId: string,
) {
  const [feedbackRes, candidatesRes, signalsRes] = await Promise.all([
    supabase
      .from("jobsearch_feedback")
      .select("action, reason_code, free_text, candidate_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("jobsearch_candidates")
      .select("id, company, title, location, jd_url, source, external_id")
      .eq("user_id", userId),
    supabase
      .from("jobsearch_user_signals")
      .select("preferences_json")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (feedbackRes.error) {
    console.warn("Signal recompute: feedback load failed", feedbackRes.error);
    return;
  }

  const candidatesById = new Map<string, NormalizedJob>();
  for (const c of (candidatesRes.data || []) as Array<{
    id: string;
    company: string;
    title: string;
    location: string | null;
    jd_url: string;
    source: string | null;
    external_id: string | null;
  }>) {
    candidatesById.set(c.id, {
      company: c.company,
      title: c.title,
      location: c.location || "",
      jd_url: c.jd_url,
      external_id: c.external_id || "",
      source: (c.source as "jsearch" | "stub") || "jsearch",
      description_excerpt: "",
    });
  }

  const existing =
    (signalsRes.data?.preferences_json as UserSignals) || {};
  const updated = recomputeSignals(
    (feedbackRes.data || []) as FeedbackRow[],
    candidatesById,
    existing,
  );

  const { error } = await supabase
    .from("jobsearch_user_signals")
    .upsert(
      { user_id: userId, preferences_json: updated, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) console.warn("Signal upsert failed:", error);
}

async function handleSubmitFeedback(
  supabase: SbClient,
  userId: string,
  body: Record<string, unknown>,
  masterCvText: string,
  anthropicKey: string,
  jsearchKey: string | undefined,
  corsHeaders: Record<string, string>,
) {
  const candidateId =
    typeof body.candidate_id === "string" ? body.candidate_id : "";
  const action = body.action === "apply" ? "apply" : body.action === "pass" ? "pass" : "";
  const reasonCode =
    typeof body.reason_code === "string" ? body.reason_code.slice(0, 64) : "";
  const freeText =
    typeof body.free_text === "string" ? body.free_text.slice(0, 1000) : null;

  if (!candidateId || !action || !reasonCode) {
    return jsonError(400, "candidate_id, action, reason_code required", corsHeaders);
  }

  const newCandidateStatus = action === "apply" ? "applied" : "dismissed";
  const { error: updErr } = await supabase
    .from("jobsearch_candidates")
    .update({ status: newCandidateStatus })
    .eq("id", candidateId)
    .eq("user_id", userId);
  if (updErr) {
    console.error("Candidate status update failed:", updErr);
    return jsonError(500, "Failed to update candidate", corsHeaders);
  }

  const { error: insErr } = await supabase
    .from("jobsearch_feedback")
    .insert({
      user_id: userId,
      candidate_id: candidateId,
      action,
      reason_code: reasonCode,
      free_text: freeText,
    });
  if (insErr) {
    console.error("Feedback insert failed:", insErr);
    return jsonError(500, "Failed to record feedback", corsHeaders);
  }

  await recomputeSignalsForUser(supabase, userId);

  return await handleRefresh(
    supabase,
    userId,
    masterCvText,
    anthropicKey,
    jsearchKey,
    corsHeaders,
  );
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

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
      "Too many jobsearch requests in the last minute. Wait and retry.",
      corsHeaders,
    );
  }

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    console.error("ANTHROPIC_API_KEY secret missing");
    return jsonError(500, "Server misconfigured", corsHeaders);
  }
  // Optional — if unset, the source falls back to a 5-row stub.
  const jsearchKey = Deno.env.get("RAPIDAPI_KEY");

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
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return jsonError(400, "Invalid JSON body", corsHeaders);
  }

  const action = typeof body.action === "string" ? body.action : "";
  const masterCvText =
    typeof body.master_cv_text === "string"
      ? body.master_cv_text.slice(0, 100_000)
      : "";

  if (action === "list_active") {
    return await handleListActive(supabase, userId, corsHeaders);
  }
  if (action === "refresh") {
    if (!masterCvText) {
      return jsonError(
        400,
        "master_cv_text required for refresh (save a Master CV first)",
        corsHeaders,
      );
    }
    return await handleRefresh(
      supabase,
      userId,
      masterCvText,
      anthropicKey,
      jsearchKey,
      corsHeaders,
    );
  }
  if (action === "submit_feedback") {
    return await handleSubmitFeedback(
      supabase,
      userId,
      body,
      masterCvText,
      anthropicKey,
      jsearchKey,
      corsHeaders,
    );
  }
  return jsonError(
    400,
    "Unknown action. Expected list_active | refresh | submit_feedback",
    corsHeaders,
  );
});
