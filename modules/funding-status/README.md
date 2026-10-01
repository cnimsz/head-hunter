# funding-status

A drop-in "credits" pill for any web project that draws on the shared
Anthropic account:

```
┌──────────────────────────────────────────────────────┐
│ Credits ▮▮▮ Plenty                       SUPPORT US  │  ← whole pill links
│ Free — kept running by supporters                    │    to your support page
└──────────────────────────────────────────────────────┘
```

- **3 stages:** Plenty (3 green segments) · Getting low (2 amber) · Very low or out (1 red).
  Each stage has a word label as well as a colour. Coarse on purpose, because the runway estimate isn't precise.
- **Shared pool:** every project reads the same balance: `get_capacity_band()`
  on Head Hunter's Supabase project (`bcenuebydpkyfmtzfcku`). The RPC only
  returns a band, never a dollar amount.
- **Framework-free:** one standard Web Component, no dependencies and no build step.
  Styles live in a Shadow DOM, so they don't clash with the host page's CSS.

| File | Runs in | Purpose |
|---|---|---|
| `funding-status.js` | browser | the `<funding-status>` element |
| `report-usage.js` | your server (Worker / Node / Deno) | reports your Anthropic spend into the shared pool |

---

## Add it to a project (3 steps)

### 1. Copy the file and load it

Copy `funding-status.js` into anywhere your site serves static files (for
Fantasy-football-reporter: `public/funding-status.js`).

```html
<script type="module" src="/funding-status.js"></script>
```

### 2. Drop in the tag with your project's description

```html
<funding-status
  project="fantasy-football-reporter"
  supabase-url="https://bcenuebydpkyfmtzfcku.supabase.co"
  anon-key="<Head Hunter's Supabase anon key — public, same one Head Hunter ships>"
  support-url="https://ko-fi.com/<your-page>"
  tagline="Weekly reports — kept free by readers like you"
  empty-text="Out — reports paused"
></funding-status>
```

The anon key and URL are public by design (Head Hunter already ships them in its
bundle). The RPC is `SECURITY DEFINER` and only ever returns a coarse band.

### 3. Report your spend (server side)

The pill is only accurate if **every** project's Anthropic calls count against the
shared balance. After each Anthropic call in your backend:

```js
import { reportUsage } from './report-usage.js';

const msg = await anthropic.messages.create({ model, max_tokens, messages });
ctx.waitUntil(reportUsage({                 // Workers: don't block the response
  endpoint:   env.USAGE_REPORT_URL,         // https://bcenuebydpkyfmtzfcku.supabase.co/functions/v1/report-usage
  projectKey: env.USAGE_REPORT_KEY,         // this project's secret (see below)
  model:      msg.model,
  usage:      msg.usage
}));
```

`reportUsage` never throws, and a failed report never breaks your request.

Guardrails on the endpoint, so one project can't drain the shared pool (and pause Head Hunter):
- each report is capped at real API limits (1M input tokens total, 200K output)
- there is a per-project **daily cap on reported spend**. The default is $25/day and you can
  change it with the `USAGE_REPORT_DAILY_CAP_USD` Supabase secret. Once a project passes the cap,
  further reports get `429` until the next UTC day
- `60` reports/min per project

**One-time setup per project** (in Head Hunter's Supabase):
1. Generate a secret: `openssl rand -hex 32`.
2. Add `<project-name>:<secret>` to the `USAGE_REPORT_KEYS` Supabase secret
   (comma-separated for multiple projects, e.g.
   `fantasy-football-reporter:ab12…,other-app:cd34…`). Project names use
   lowercase letters, digits and dashes. Secrets must be at least 16 characters.
3. Store the same secret in your project as `USAGE_REPORT_KEY`
   (`wrangler secret put USAGE_REPORT_KEY` for a Worker). **Never ship it to the browser.**

The model must have a price in Head Hunter's
`supabase/functions/_shared/pricing.ts`, otherwise the report is rejected with 400.
Add a new model there before you switch to it.

---

## Reference

### Attributes

| Attribute | Purpose | Default |
|---|---|---|
| `supabase-url`, `anon-key` | Where to read the shared band and log analytics | none (no fetch → "Status unavailable") |
| `support-url` | Any support page, e.g. Ko-fi (`http(s)` only). The whole pill becomes the link (new tab, `rel="noopener noreferrer"`) and shows the CTA badge | unset = plain pill, no link |
| `tagline` | Second line | `Free — kept running by supporters` |
| `cta-text` | Badge on the right (only shown when `support-url` is set) | `Support Us` |
| `empty-text` | Stage label when credits are out | `Out — paused` |
| `project` | Tags analytics events (`prompt_events.project`) | `unknown` |
| `band` | Host-controlled mode: `green` / `amber` / `red` / `empty` / `unknown` / `loading`. When set, the element does **not** fetch | unset |
| `theme` | `light`, `dark`, or `auto` (follows the OS) | `auto` |

It polls every 5 minutes. If a poll fails it keeps the last known band and
never shows a false "empty".

### Events (bubble out to `document`)

| Event | `detail` | Use it to |
|---|---|---|
| `funding-status:change` | `{ band }` | gate your own UI (e.g. disable a Generate button on `empty`) |
| `funding-status:notify` | none | the user clicked "Notify me" (empty state). Show or focus your waitlist form |

```js
document.addEventListener('funding-status:change', (e) => {
  generateBtn.disabled = e.detail.band === 'empty';
});
```

### React hosts

React 18 passes string props straight through as attributes. Use a ref for the events:

```jsx
import '../modules/funding-status/funding-status.js';

const ref = useRef(null);
useEffect(() => {
  const node = ref.current;
  node.addEventListener('funding-status:notify', openWaitlist);
  return () => node.removeEventListener('funding-status:notify', openWaitlist);
}, []);

<funding-status ref={ref} project="my-app" theme={theme} support-url={SUPPORT_URL} … />
```

Head Hunter itself uses host-controlled mode (`band={…}`), because its app
already polls the band to gate the tool. See `src/App.jsx`.

### Styling hooks

The pill is exposed as `::part(pill)`, so a host can adjust spacing or shadows:

```css
funding-status::part(pill) { box-shadow: 0 1px 4px rgb(0 0 0 / .1); }
```

---

## Keeping copies in sync

This folder in the Head Hunter repo is the source of truth. After changing
`funding-status.js` or `report-usage.js`, copy the files into each project that
uses them again.

**Breaking change (Ko-fi switch):** the `donate-url` attribute was renamed to
`support-url`, and the `thanks-text` / `?donated=1` return notice was removed
(Ko-fi has no after-payment redirect). Update the tag in each project when you
recopy.

## Not automated yet

Ko-fi tips don't add credit to the pool on their own. Top-ups are still rows
inserted by hand into `credit_topups`. A Ko-fi webhook (Settings → API) that
inserts them is a planned follow-up.
