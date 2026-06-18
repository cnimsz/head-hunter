---
name: test-pipeline
description: CLI smoke for the Head Hunter generation pipeline. Verifies the production build compiles, the deployed edge function is reachable, and the Turnstile/session auth guard is active. The full happy path (Turnstile-solved generation) requires a browser — this skill explicitly lists what CLI cannot reach.
allowed-tools: Bash, Read, Write, Edit
---

# Test the Head Hunter Pipeline End-to-End

The edge function gates every request behind Cloudflare Turnstile (first call) or an HMAC session token (subsequent calls). Both require a real browser session — CLI cannot mint a valid Turnstile token against a production Supabase deployment.

This skill runs every check that *is* possible without a browser, then prints a short checklist of what the user must verify in the browser to fully sign off.

## Configuration to read

```bash
grep -E "^export const MODEL|^export const RESEARCH_MODEL" src/lib/claude.js
grep VITE_SUPABASE_URL .env.local 2>/dev/null || true
```

Derive the edge function URL from `VITE_SUPABASE_URL`. If the env var isn't set locally, fall back to the production URL from CLAUDE.md (`https://bcenuebydpkyfmtzfcku.supabase.co`).

## CLI checks (run all)

### 1. Build smoke

```bash
npm run build 2>&1 | tail -10
```

**Pass:** `built in <N>s`, no TS/syntax errors, no missing-import errors.
**Fail:** any compile error → stop and report.

### 2. Sample JD readable

```bash
test -s tests/sample-jd.txt && wc -l tests/sample-jd.txt
```

**Pass:** file exists and is non-empty.

### 3. Edge function reachability + auth guard

```bash
SUPABASE_URL="${VITE_SUPABASE_URL:-https://bcenuebydpkyfmtzfcku.supabase.co}"
EDGE_URL="$SUPABASE_URL/functions/v1/head-hunter-claude"

curl -sS -o /tmp/hh-ping.json -w "HTTP %{http_code} in %{time_total}s\n" \
  -X POST "$EDGE_URL" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4-6","max_tokens":50,"messages":[{"role":"user","content":"hi"}]}' \
  --max-time 15
cat /tmp/hh-ping.json
```

**Pass:** `HTTP 401` *and* body is exactly `{"error":"Missing bot challenge or session token"}`. That proves the function is deployed, the new auth code is live, and rejects unauthenticated traffic in <1s.

**Fail modes:**
- `HTTP 5xx` → deploy issue; suggest `supabase functions deploy head-hunter-claude`.
- `HTTP 404` → wrong URL or function not deployed.
- `HTTP 200` with content → **security regression** — auth guard is open; investigate immediately.
- `HTTP 401` with a different body → the error string has drifted; update this skill or the function.

### 4. CORS preflight

```bash
curl -sS -o /dev/null -w "HTTP %{http_code}\n" \
  -X OPTIONS "$EDGE_URL" \
  -H "Origin: https://head-hunter-fawn.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  --max-time 10
```

**Pass:** `HTTP 204`.

### 5. (Optional) Full local smoke via `supabase functions serve`

Only run when the user explicitly asks for a full smoke or when something failed upstream. Requires Docker + Supabase CLI.

```bash
# In one terminal:
SUPABASE_FUNCTIONS_PORT=54321 supabase functions serve head-hunter-claude --env-file ./supabase/.env.test

# supabase/.env.test (gitignored) — uses Cloudflare's always-pass test secret:
#   ANTHROPIC_API_KEY=<real key>
#   TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
#   HEAD_HUNTER_SESSION_SECRET=$(openssl rand -hex 32)

# In another terminal:
curl -sS -w "\nHTTP %{http_code} in %{time_total}s\n" \
  -X POST http://localhost:54321/functions/v1/head-hunter-claude \
  -H "Content-Type: application/json" \
  -H "cf-turnstile-token: any-string-the-test-secret-accepts-everything" \
  -d "$(jq -n --arg jd "$(cat tests/sample-jd.txt)" '{
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        messages: [{role:"user", content: ("Generate a 2-paragraph mock CV for this JD as JSON {name, summary}: " + $jd)}]
      }')" \
  --max-time 60
```

**Pass:** HTTP 200, body has `content[0].text` containing parseable JSON, plus a `x-session-token` response header. Token usage visible in `usage`.

## What CLI cannot verify (browser checklist)

Hand these to the user; mark this skill complete only after they confirm:

- [ ] Open https://head-hunter-fawn.vercel.app, paste `tests/sample-jd.txt`, upload any CV, solve Turnstile, click **Generate**. All three tabs (CV / Cover Letter / Research & Outreach) render without errors.
- [ ] Click **Download .docx** for both CV and Cover Letter; both open cleanly in Word.
- [ ] Click **Refine from edits**, paste a revised CV, solve the (in-modal) Turnstile, click **Analyse changes**. Confirm style rules appear and **Apply** persists them.
- [ ] Click **Run Gap Analysis**. Confirm findings render, **Add to CV** writes to the Master CV, and **Done & Re-tailor** kicks off a new generation when answers were added.

## Failure modes to catch

- **Auth string drift**: the 401 body must match exactly — if it changes, this skill needs updating *and* the client error mapping in `src/lib/claude.js` likely needs updating too.
- **5xx from edge function**: deploy issue; user should run their deploy command for that function.
- **Build failures**: surface the first error line — almost always a missing import or a typo in a recent edit.
- **Reachability without a token returning 200**: security regression — never ignore. Investigate before merging anything.
