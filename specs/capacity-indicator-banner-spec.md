# Capacity Indicator — Top Banner Rebuild (v2)

Supersedes the placement, visibility and copy rules in `capacity-indicator.md`.
Rewrites `src/components/CapacityIndicator.jsx`.

v2 incorporates the repo audit. Where this document and the audit disagreed, the audit won.

## Intent

The shipped component returns `null` on green, sits below the output panel, and requires a
completed tailoring plus a passed cooldown check before rendering. It is therefore absent
from the DOM almost always. Users never learn it exists, and it cannot be inspected without
faking ledger data.

Four rules change:

1. **Always rendered.** Green is a quiet state, not an absent one.
2. **Top banner.** Full-width strip above the existing header/tab row.
3. **Status and CTA decouple.** The bar always shows. The CTA inside it is cooldown-gated.
4. **Read failure is its own state**, distinct from both "fine" and "out of credits".

## States

`get_capacity_band()` already returns green / amber / red / empty and is **not to be
modified**. `loading` and `unknown` are client-side only.

| State | Trigger | Copy | CTA |
|---|---|---|---|
| `loading` | RPC in flight | *(none — shell only)* | none |
| `green` | band `green` | Free, funded by donations. | Chip in |
| `amber` | band `amber` | Credits running low — {bucket} left. €4 keeps it running for a day. | Chip in |
| `red` | band `red` | Under a week of credits left. €4 keeps it running for a day. | Chip in |
| `empty` | band `empty` | Out of credits. Tailoring is paused until donations refill it. | Chip in |
| `unknown` | RPC rejected or returned null | Can't check credit balance right now. | Chip in |

`{bucket}` is `runway_bucket` from the RPC, used verbatim ("a few weeks"). Do not derive a
number from it and do not change the RPC to emit one.

`unknown` must not claim anything about funds or availability. `get_capacity_band()` is
independent of `head-hunter-claude`, so tailoring usually still works when this state shows.

## Capacity state in App.jsx

The current `.then(c => c && setCapacity(c))` collapses "still loading" and "read failed"
into the same null. Three distinct values are required:

```js
// undefined = loading (initial)
// null      = read failed  -> unknown
// object    = { band, runwayBucket }
const [capacity, setCapacity] = useState(undefined);
```

- Resolve to `null` on rejection **and** on a null/empty RPC return.
- Poll on mount and after each successful tailoring, as now.
- Keep the existing `NO_CAPACITY` proxy-error path calling `setEmptyFromProxy()`.
- `capacity` is owned by `App.jsx`. Do not introduce an `AppShell` wrapper.
- Stop passing `capacity` to `OutputPanel`. Remove the prop and the `result && capacity`
  gate there.

## Placement

`<CapacityBanner />` renders in `App.jsx` as the first child, above the existing header/tab
row, full bleed, outside the two-column layout.

**The empty-state branch is unchanged.** When `capacity?.band === 'empty'`, `App.jsx`
continues to render `<WaitlistPanel />` in place of `InputPanel` + `OutputPanel`. The banner
sits above that takeover. Do **not** delete `WaitlistPanel`, do not move its form into the
banner, and do not leave the tool UI mounted in the empty state — a working-looking form
that errors on submit is worse than the takeover.

## Visual

The app is dark-themed on a near-black canvas with a blue accent on the action buttons. The
current `bg-amber-50` / `bg-red-50` washes are light-theme values and read as bright bars
against this canvas. Replace them.

- Single line, ~32px tall, full bleed. Identical height in every state including `loading`,
  so the header never shifts.
- State is carried by a 3px left-edge rule plus text colour. Background stays near canvas on
  green, gaining low-opacity tint escalating through amber, red, empty.
- Escalation is contrast and fill only — never height, never size.
- Text left, CTA right. CTA is a text button. Replace the filled `bg-amber-600` /
  `bg-red-600` pills.
- Keep the ✕ dismiss control.
- No entrance animation, no pulsing. Cross-fade the text only when the band changes while
  the page is open; skip under `prefers-reduced-motion`.
- Each state's copy is distinct, so colour is never the sole carrier of meaning.

## Behaviour

- Cooldown (`cv-toolkit:capacity-dismissed-at`, 3-day window) gates **only** the CTA and the
  ✕. The status line always renders. The current `if (dismissed) return null` is removed.
- `empty` ignores the cooldown — a user who cannot run the tool needs the CTA regardless of
  what they dismissed last week.
- `loading` renders the shell with no text and no CTA.
- `role="status"` plus `aria-live="polite"` (currently missing). Visible keyboard focus on
  the CTA and ✕.

## Analytics

Green now renders on every page load, so `capacity_impression` volume changes by orders of
magnitude and green would swamp the series.

- Add a `band` dimension to `capacity_impression`, `capacity_dismiss` and `capacity_click`.
- Fire `capacity_impression` at most once per band per session, keyed in `sessionStorage`
  (`cv-toolkit:capacity-impression:{band}`). Not once per render, not once per page load.
- Do not log an impression for `loading`.

## Preview route

`src/routes/CapacityPreview.jsx`, rendering all six states stacked with static props. No RPC
call, no ledger writes, no band override in `App.jsx`.

The app is a single-mount SPA with no router. **Do not add `react-router-dom`.** Use a
minimal check in `src/main.jsx`:

```js
const isPreview =
  import.meta.env.VITE_ENABLE_PREVIEW_ROUTES === 'true' &&
  window.location.pathname === '/capacity-preview';
```

Mount `<CapacityPreview />` instead of `<App />` when true. Vercel Preview builds run in
production mode, so `import.meta.env.DEV` will not work there — the explicit variable is
required. Leave it unset in Production.

## Out of scope — do not touch

- `get_capacity_band()` and migration `20260831000000_capacity_indicator.sql`.
- `get_balance_usd()`, `usage_counters`, `credit_topups`.
- Band thresholds. They are provisional until `phase-0-addendum-cost-capture.md` lands,
  because untracked gap-analysis and tailoring spend currently inflate the balance.
- `WaitlistPanel.jsx` and the `App.jsx` empty-state branch, beyond adding the banner above.
- Adding any routing dependency.

Files you may create or modify: `src/components/CapacityBanner.jsx` (new, replacing
`CapacityIndicator.jsx`), `src/routes/CapacityPreview.jsx` (new), `src/App.jsx`,
`src/components/OutputPanel.jsx` (prop removal only), `src/main.jsx`.

## Verification

Run these and report results. Do not report the task complete on a code read alone.

1. Load the app with no tailoring run. Green banner present at top, above the header row.
2. Complete one tailoring. Banner still present, unchanged, no layout shift.
3. `/capacity-preview` with `VITE_ENABLE_PREVIEW_ROUTES=true` shows all six states.
4. Same route on a build with the variable unset renders the normal app, not the preview.
5. Set `cv-toolkit:capacity-dismissed-at` to now. Reload. Banner renders; CTA and ✕ absent.
6. Force an RPC failure (bad function name). Banner shows `unknown` — not green, not empty,
   no crash — and the failure is logged to console.
7. Throttle the network. Confirm `loading` shows a blank shell and does not flash the
   `unknown` copy before resolving.
8. Confirm header row position is pixel-identical across all six states.
