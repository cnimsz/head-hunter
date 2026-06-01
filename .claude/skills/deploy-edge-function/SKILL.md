---
name: deploy-edge-function
description: Deploy the Head Hunter Supabase Edge Function to production. Use when the user says "deploy the function," "push the edge function," "ship the backend," or after making changes to supabase/functions/head-hunter-claude/index.ts. Handles first-time setup (init, link, secrets) and incremental deploys.
disable-model-invocation: true
allowed-tools: Bash, Read
---

# Deploy Head Hunter Edge Function

Deploy the Supabase Edge Function for Head Hunter, with smoke test and log verification.

## Pre-flight checks

Before deploying, verify:

1. Check the current working tree:
   ```bash
   git status
   ```
   If there are uncommitted changes to `supabase/functions/**`, ask the user whether to commit first or proceed with uncommitted code.

2. Check that `supabase/config.toml` exists. If not, run:
   ```bash
   npx supabase init
   ```

3. Check that the project is linked:
   ```bash
   npx supabase status
   ```
   If not linked, run:
   ```bash
   npx supabase link --project-ref bcenuebydpkyfmtzfcku
   ```

4. Check that all required secrets are set:
   ```bash
   npx supabase secrets list
   ```
   Look for `ANTHROPIC_API_KEY`, `TURNSTILE_SECRET_KEY`, and `HEAD_HUNTER_SESSION_SECRET`. If any are missing, ask the user for the value (prompt them — do not log or echo) and run:
   ```bash
   npx supabase secrets set ANTHROPIC_API_KEY=<value>
   npx supabase secrets set TURNSTILE_SECRET_KEY=<value>
   npx supabase secrets set HEAD_HUNTER_SESSION_SECRET=<value>  # openssl rand -hex 32
   ```

## Type-check the function

```bash
cd supabase/functions/head-hunter-claude && deno check index.ts
```

If this fails, do not proceed. Report the error to the user.

## Deploy

```bash
npx supabase functions deploy head-hunter-claude
```

## Smoke test

The function is gated by Cloudflare Turnstile + HMAC session tokens. A real end-to-end POST needs a token from a browser-solved Turnstile widget, which is awkward from the CLI. Instead, run two reachability probes that prove the function is deployed and its auth gate is alive:

```bash
EDGE_URL=https://bcenuebydpkyfmtzfcku.supabase.co/functions/v1/head-hunter-claude
ORIGIN=https://head-hunter-fawn.vercel.app

# 1. CORS preflight — expect HTTP 204 with the prod origin echoed back
curl -s -D - -o /dev/null -X OPTIONS "$EDGE_URL" \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,cf-turnstile-token"

# 2. POST without auth — expect HTTP 401 with body {"error":"Missing bot challenge or session token"}
curl -s -w "\nHTTP %{http_code}\n" -X POST "$EDGE_URL" \
  -H "Origin: $ORIGIN" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4-6","max_tokens":50,"messages":[{"role":"user","content":"hi"}]}'

# 3. POST with bad turnstile token — expect HTTP 401 {"error":"Bot challenge failed"}
#    (Proves TURNSTILE_SECRET_KEY is set and siteverify is reachable from the function.)
curl -s -w "\nHTTP %{http_code}\n" -X POST "$EDGE_URL" \
  -H "Origin: $ORIGIN" \
  -H "Content-Type: application/json" \
  -H "cf-turnstile-token: dummy-test-token-xxx" \
  -d '{"model":"claude-sonnet-4-6","max_tokens":50,"messages":[{"role":"user","content":"hi"}]}'
```

For a true end-to-end test, open https://head-hunter-fawn.vercel.app, solve the Turnstile widget, paste `tests/sample-jd.txt`, and click Generate.

If the smoke test fails, tail logs:

```bash
npx supabase functions logs head-hunter-claude --tail 50
```

## Report back

Tell the user:
- Deploy status (success/failure)
- Function URL
- Smoke test result
- Any warnings from the logs

Do NOT echo the API key value at any point, even if you see it in a config file.
