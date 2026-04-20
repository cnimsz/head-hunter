---
name: ship-it
description: Full production deploy for Head Hunter. Runs linting, builds, deploys the Supabase Edge Function, deploys the Vercel frontend to production, and smoke-tests the live URL end-to-end. Use when ready to push changes to the live app. This is a destructive action that updates production.
disable-model-invocation: true
allowed-tools: Bash, Read
---

# Ship Head Hunter to Production

Full production deploy of both the edge function and the frontend, with smoke tests before and after.

## Pre-flight

1. **Confirm the user wants to deploy.** Restate what will happen:
   > "I'm about to deploy the edge function AND push a new production build to Vercel. This will immediately affect the live app at https://head-hunter-fawn.vercel.app. Confirm? (yes/no)"

   If they say anything other than "yes," stop.

2. **Check git state:**
   ```bash
   git status
   git log --oneline -5
   ```
   Show the user the last 5 commits and ask: "These changes will go live. OK to proceed?"

3. **Lint and build:**
   ```bash
   npm run build
   ```
   If the build fails, stop. Do not proceed with broken code.

## Deploy the edge function

Invoke the `deploy-edge-function` skill. Wait for it to complete with a successful smoke test before continuing.

If the edge function deploy fails, STOP. Do not deploy the frontend — a frontend without a working backend is worse than nothing changing.

## Deploy the frontend

```bash
vercel --prod
```

Watch for build errors in the output. If the build fails on Vercel's side (even after a clean local build), check:
- Are env vars configured in Vercel? `vercel env ls`
- Is the framework preset correct? `vercel inspect`

## Post-deploy smoke test

Once the production URL is updated:

1. Fetch the landing page and verify HTTP 200:
   ```bash
   curl -I https://head-hunter-fawn.vercel.app
   ```

2. Prompt the user to manually smoke-test: paste a JD, generate all three outputs, confirm they render and download.

## Report

Summary format:

```
Shipped Head Hunter at $(date)

Commits deployed:
- <hash> <message>
- <hash> <message>

Edge function: https://kntzxuzplmuccqvpntql.supabase.co/functions/v1/head-hunter-claude
Frontend: https://head-hunter-fawn.vercel.app

Smoke test: PASS / FAIL
Notes: <any warnings or observations>
```

## Rollback

If the smoke test fails:

```bash
# Rollback the frontend on Vercel
vercel rollback

# For the edge function, redeploy the previous git commit's version of index.ts:
git stash
git checkout HEAD~1 -- supabase/functions/head-hunter-claude/index.ts
npx supabase functions deploy head-hunter-claude
git checkout HEAD -- supabase/functions/head-hunter-claude/index.ts
git stash pop
```

Warn the user: "Rolled back. Both frontend and edge function are on the previous version. Diagnose the failure before attempting another deploy."
