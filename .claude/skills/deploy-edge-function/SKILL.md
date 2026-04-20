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
   npx supabase link --project-ref kntzxuzplmuccqvpntql
   ```

4. Check that the Anthropic API key secret is set:
   ```bash
   npx supabase secrets list
   ```
   Look for `HEAD_HUNTER`. If missing, ask the user for the key (prompt them — do not log or echo the value) and run:
   ```bash
   npx supabase secrets set HEAD_HUNTER=<value>
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

Test against the deployed function:

```bash
curl -X POST https://kntzxuzplmuccqvpntql.supabase.co/functions/v1/head-hunter-claude \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":100,"messages":[{"role":"user","content":"Reply with the word hello"}]}' \
  --max-time 30
```

Confirm the response is 200 and contains valid JSON with a `content` array.

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
