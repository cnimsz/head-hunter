# Add the credits pill to a project (drop-in)

This folder adds Head Hunter's **Credits ▮▮▮ Plenty · Free — funded by your
donations · CLICK ME** pill to another project, wired to the **shared credit
pool**. The pill reads the live balance, and the project's own Anthropic spend
counts against it.

The only thing you change is **the Stripe link**.

---

## 1. Copy this folder into the project root

```
your-project/
├── funding-status/        ← this whole folder
├── public/index.html
├── src/
└── package.json
```

## 2. Set this project's Stripe link

Open `funding-status/funding-status.config.json` and replace `donateUrl`:

```json
"donateUrl": "https://donate.stripe.com/xxxxxxxxxxxx",
```

Leave everything else as it is. The project name comes from `package.json`,
and the shared-pool settings are already filled in. The other fields are
optional overrides, listed under [Options](#options).

## 3. Run the installer

```bash
node funding-status/install.mjs
```

It will:
- **Inline the pill into your page** (`public/index.html` by default). The pill goes
  at the end of `<header>`, or at the top of `<body>` if there's no header. There's no
  separate asset, so it works on every route, under any base path (e.g. `/v2`), with no build step.
- **Copy the server helper** to `src/funding-status/`.
- Print the remaining steps.

Safe to re-run: it replaces its own marked blocks. Other options:
`--dry-run` shows what would change and writes nothing; `--uninstall` removes everything it added.

**At this point the pill is live.** It shows the shared balance and links to
your Stripe page. Steps 4–6 make this project's own spend count against that balance.

## 4. Hook your Anthropic calls (backend, ~8 lines)

After each Anthropic call, report its usage. `reportUsageRecord` never throws,
has a 5-second timeout, and does nothing (one warning) if no key is set.

**Fantasy-football-reporter:** every call already flows through one sink, so
the hook goes there.

`src/db/llm_calls.ts`:
```ts
import { reportUsageRecord } from "../funding-status/report-usage.js";
// …inside sink(), right after the llm_calls insert:
      await reportUsageRecord(r);   // funding-status: shared credit pool
```

`src/index.ts`: add the import, and the configure line as the first line of both `fetch` and `scheduled`:
```ts
import { configureUsageReporting } from "./funding-status/report-usage.js";
    configureUsageReporting({ projectKey: env.USAGE_REPORT_KEY });
```

`src/worker/env.ts`: add to `Env`:
```ts
  USAGE_REPORT_KEY?: string;
```

The local runner (`npm run report`, etc.) reads `USAGE_REPORT_KEY` from the
shell automatically, so it needs no code change.

**Any other project:** call this after each Anthropic response, with `msg` being the API response:
```ts
await reportUsageRecord({
  model: msg.model,
  input_tokens: msg.usage.input_tokens,
  output_tokens: msg.usage.output_tokens,
  cache_creation_input_tokens: msg.usage.cache_creation_input_tokens,
  cache_read_input_tokens: msg.usage.cache_read_input_tokens,
  web_search_requests: msg.usage.server_tool_use?.web_search_requests,
  batch: false,            // true for Message Batches API results (billed at 50%)
});
```

## 5. Give the backend its key

Use the key registered for this project in Head Hunter's `USAGE_REPORT_KEYS`
Supabase secret (`<project-name>:<key>`).

```bash
npx wrangler secret put USAGE_REPORT_KEY
```

For local runs, also add `USAGE_REPORT_KEY=<key>` to the shell environment (or `.dev.vars`).

A new project needs a key added to `USAGE_REPORT_KEYS` first:
generate one with `openssl rand -hex 32` and append `,<project-name>:<key>`.

## 6. Stripe: send donors back to the thank-you notice

In the Stripe dashboard, open this project's Payment Link, go to **After payment**,
choose **Don't show confirmation page / redirect**, and enter:

```
https://<this-site>/?donated=1
```

## 7. Check it

- Open the site. The pill shows in the header, and clicking it opens your Stripe page.
- Run one report or generation. A `project:<project-name>` row with `operation = external`
  appears in Head Hunter's `usage_counters`.

---

## Let Claude Code do steps 3–5

In the target project, ask Claude Code:

> Install the funding-status kit in `./funding-status`: follow `funding-status/INSTALL.md`.
> The Stripe link is `<your link>`. Run the installer, add the backend hook from step 4,
> then run the project's type-check and tests.

---

## Options

All fields live in `funding-status.config.json`:

| Field | Default | Meaning |
|---|---|---|
| `donateUrl` | **required** | Stripe Payment Link. The whole pill links here |
| `project` | `package.json` name | Must match the name in `USAGE_REPORT_KEYS` |
| `tagline` | `Free — funded by your donations` | Second line of the pill |
| `ctaText` | `CLICK ME` | Badge text |
| `emptyText` | `Out — paused` | Label when credits run out |
| `thanksText` | `Thank you — your donation keeps this running.` | Shown after `?donated=1` |
| `notify` | `off` | Empty-state "Notify me": `off`, a URL (`https://…` / `mailto:…`), or `""` to fire a `funding-status:notify` event |
| `theme` | `auto` | `auto` follows the OS; `light` / `dark` to force |
| `htmlFiles` | auto-detect | Pages to install into, e.g. `["public/index.html"]` |
| `serverHelperDir` | `src/funding-status` | Where the server helper is copied |

Change any of these and re-run `node funding-status/install.mjs`.

## Notes

- **Credits running out doesn't stop this project.** The pill will say
  "Out", but only Head Hunter blocks its own generations. To pause here too, check
  `get_capacity_band()` before calling Anthropic.
- **Worker subrequests:** each report is one outbound request, so one per Anthropic call.
  That's small next to a 1,000-request budget, but it counts.
- **Updating the pill later:** copy the newer `funding-status/` folder over this one,
  keeping your `funding-status.config.json`, then re-run the installer.
