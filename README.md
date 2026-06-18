# Head Hunter

A one-screen web app: paste a job description, get a tailored CV, cover letter, and LinkedIn message. All file parsing runs in the browser; Claude calls are proxied through a Supabase Edge Function so the Anthropic API key never reaches the client.

**Live:** https://head-hunter-fawn.vercel.app

## Stack

- React 18 + Vite 5 + Tailwind CSS 3 (no TypeScript)
- `docx` + `file-saver` for DOCX export
- `pdfjs-dist` + `mammoth` + `jszip` for client-side CV parsing
- Supabase Edge Functions (Deno) — `head-hunter-claude`, `gap-analysis`, `jobsearch`
- Cloudflare Turnstile + HMAC session tokens for bot protection
- Supabase Auth (magic link) gates the Gap Analysis and Find Roles features
- Deployed on Vercel

## Commands

```bash
npm install
npm run dev       # Vite dev server on :5173
npm run build     # Production build → dist/
npm run preview   # Serve the production build locally
```

## Environment

Copy `.env.example` to `.env.local` and fill in:

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL — edge function URLs are derived from it |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key — enables Auth-gated features |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key (public by design) |

Server-side secrets (`ANTHROPIC_API_KEY`, `TURNSTILE_SECRET_KEY`, `HEAD_HUNTER_SESSION_SECRET`) live as Supabase secrets, never in the client bundle.

## Repo layout

```
src/             React app — components, prompts, lib helpers, DOCX templates
supabase/        Edge functions (Deno) + SQL migrations
skills/          Skill specs (reference docs, not used at runtime)
specs/           Design specs for the gap-analysis and jobsearch features
tests/           Sample inputs used by the test-pipeline skill
```

See [`CLAUDE.md`](./CLAUDE.md) for architecture details, the generation pipeline, structured-data schemas, and design decisions.
