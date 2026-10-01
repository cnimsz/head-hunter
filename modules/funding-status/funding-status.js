// <funding-status> — a drop-in, framework-free credits pill.
//
// Shows a coarse 3-stage credit meter (Plenty / Getting low / Very low-or-out)
// plus a tagline, and — when a support URL is set (e.g. a Ko-fi page) — turns
// the whole pill into a link to it. One plain ES module, no dependencies, no build
// step; styles live in a Shadow DOM so they never collide with the host page.
//
// All projects read the SAME shared credit pool: the get_capacity_band() RPC
// on Head Hunter's Supabase project. That RPC only ever returns a coarse band,
// never the dollar balance. See README.md in this folder for setup.

const TAG = 'funding-status';
const POLL_MS = 5 * 60 * 1000;
const FADE_MS = 120;

const DEFAULTS = {
  tagline: 'Free — kept running by supporters',
  ctaText: 'Support',
  emptyText: 'Out — paused',
  project: 'unknown'
};

// Bands the prompt_events.band check constraint accepts. 'unknown' and
// 'loading' are client-only states and are logged as null.
const LOGGABLE_BANDS = new Set(['green', 'amber', 'red', 'empty']);
const PROJECT_NAME_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const KNOWN_BANDS = new Set(['green', 'amber', 'red', 'empty', 'unknown', 'loading']);

// Three-stage meter. Deliberately coarse — the underlying runway estimate is
// not precise enough for anything finer. `filled` = lit segments out of 3;
// the word label carries the same meaning so colour is never the only signal.
function stageFor(band, emptyText) {
  switch (band) {
    case 'green':
      return { filled: 3, label: 'Plenty' };
    case 'amber':
      return { filled: 2, label: 'Getting low' };
    case 'red':
      return { filled: 1, label: 'Very low' };
    case 'empty':
      return { filled: 1, label: emptyText };
    default:
      return { filled: 0, label: 'Status unavailable' };
  }
}

const STYLES = `
:host {
  display: inline-block;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.25;
  --fs-seg-off: rgba(203, 213, 225, 0.7);
  --fs-badge-fg: #ffffff;
  --fs-focus: #3b82f6;
  --fs-notify-border: #cbd5e1;
  --fs-notify-text: #1d4ed8;
  --fs-notify-hover: #f1f5f9;
}
:host([hidden]) { display: none; }

/* Light tones (Tailwind emerald/amber/red/slate equivalents). */
.pill[data-band="green"]   { --bg: #ecfdf5; --border: #34d399; --text: #065f46; --fill: #10b981; }
.pill[data-band="amber"]   { --bg: #fef3c7; --border: #fbbf24; --text: #78350f; --fill: #f59e0b; }
.pill[data-band="red"]     { --bg: #fee2e2; --border: #f87171; --text: #7f1d1d; --fill: #dc2626; }
.pill[data-band="empty"]   { --bg: #fecaca; --border: #ef4444; --text: #7f1d1d; --fill: #dc2626; }
.pill[data-band="unknown"],
.pill[data-band="loading"] { --bg: #f1f5f9; --border: #cbd5e1; --text: #334155; --fill: #94a3b8; }

/* Dark tones — applied for theme="dark", or theme="auto"/unset when the OS
   prefers dark. Kept as one block, duplicated for the two selectors. */
:host([theme="dark"]) {
  --fs-seg-off: rgba(71, 85, 105, 0.7);
  --fs-badge-fg: #0f172a;
  --fs-focus: #60a5fa;
  --fs-notify-border: #475569;
  --fs-notify-text: #93c5fd;
  --fs-notify-hover: #1e293b;
}
:host([theme="dark"]) .pill[data-band="green"]   { --bg: #064e3b; --border: #10b981; --text: #d1fae5; --fill: #10b981; }
:host([theme="dark"]) .pill[data-band="amber"]   { --bg: #4a3108; --border: #f59e0b; --text: #fef3c7; --fill: #f59e0b; }
:host([theme="dark"]) .pill[data-band="red"]     { --bg: #4c1414; --border: #ef4444; --text: #fee2e2; --fill: #ef4444; }
:host([theme="dark"]) .pill[data-band="empty"]   { --bg: #7f1d1d; --border: #f87171; --text: #fef2f2; --fill: #ef4444; }
:host([theme="dark"]) .pill[data-band="unknown"],
:host([theme="dark"]) .pill[data-band="loading"] { --bg: #1e293b; --border: #475569; --text: #cbd5e1; --fill: #64748b; }
@media (prefers-color-scheme: dark) {
  :host(:not([theme="light"])) {
    --fs-seg-off: rgba(71, 85, 105, 0.7);
    --fs-badge-fg: #0f172a;
    --fs-focus: #60a5fa;
    --fs-notify-border: #475569;
    --fs-notify-text: #93c5fd;
    --fs-notify-hover: #1e293b;
  }
  :host(:not([theme="light"])) .pill[data-band="green"]   { --bg: #064e3b; --border: #10b981; --text: #d1fae5; --fill: #10b981; }
  :host(:not([theme="light"])) .pill[data-band="amber"]   { --bg: #4a3108; --border: #f59e0b; --text: #fef3c7; --fill: #f59e0b; }
  :host(:not([theme="light"])) .pill[data-band="red"]     { --bg: #4c1414; --border: #ef4444; --text: #fee2e2; --fill: #ef4444; }
  :host(:not([theme="light"])) .pill[data-band="empty"]   { --bg: #7f1d1d; --border: #f87171; --text: #fef2f2; --fill: #ef4444; }
  :host(:not([theme="light"])) .pill[data-band="unknown"],
  :host(:not([theme="light"])) .pill[data-band="loading"] { --bg: #1e293b; --border: #475569; --text: #cbd5e1; --fill: #64748b; }
}

.wrap { display: inline-flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; }

.pill {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 6px 8px 6px 12px;
  border: 1px solid var(--border); border-radius: 16px;
  background: var(--bg); color: var(--text);
  text-decoration: none;
  transition: opacity 120ms ease, box-shadow 150ms ease, filter 150ms ease;
}
.pill.fading, .pill[data-band="loading"] { opacity: 0; }
a.pill { cursor: pointer; }
a.pill:hover { box-shadow: 0 1px 3px rgba(0,0,0,.15); filter: brightness(0.97); }
a.pill:focus-visible { outline: 2px solid var(--fs-focus); outline-offset: 2px; }

.lines { display: flex; flex-direction: column; align-items: flex-start; }
.l1 { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; white-space: nowrap; }
.l2 { font-weight: 500; opacity: .85; white-space: nowrap; }
.muted { font-weight: 500; opacity: .8; }

.meter { display: inline-flex; gap: 2px; }
.seg { width: 20px; height: 10px; border-radius: 2px; background: var(--fs-seg-off); }
.seg.on { background: var(--fill); }

.cta {
  flex-shrink: 0;
  padding: 4px 8px; border-radius: 999px;
  background: var(--text); color: var(--fs-badge-fg);
  font-size: 11px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase;
  white-space: nowrap;
  transition: transform 150ms ease;
}
a.pill:hover .cta, a.pill:focus-visible .cta { transform: translateX(2px) scale(1.05); }

.notify {
  font: inherit; cursor: pointer;
}
.notify {
  padding: 4px 12px; border-radius: 999px;
  border: 1px solid var(--fs-notify-border); background: transparent;
  color: var(--fs-notify-text); font-weight: 700;
}
.notify:hover { background: var(--fs-notify-hover); }
.notify:focus-visible { outline: 2px solid var(--fs-focus); outline-offset: 2px; }

.sr {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .pill, .cta { transition: none; }
  a.pill:hover .cta, a.pill:focus-visible .cta { transform: none; }
}
`;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

export class FundingStatus extends HTMLElement {
  static get observedAttributes() {
    return [
      'band',
      'supabase-url',
      'anon-key',
      'support-url',
      'tagline',
      'cta-text',
      'empty-text',
      'project'
    ];
  }

  constructor() {
    super();
    this._root = this.attachShadow({ mode: 'open' });
    const style = el('style');
    style.textContent = STYLES;
    this._root.appendChild(style);
    this._container = el('div', 'wrap');
    this._root.appendChild(this._container);

    this._fetchedBand = null; // last successful poll result
    this._fetchSettled = false; // at least one poll finished (ok or not)
    this._shownBand = null; // band currently painted (lags during fade)
    this._lastEmitted = null;
    this._pollTimer = null;
    this._fadeTimer = null;
  }

  connectedCallback() {
    this._shownBand = this._effectiveBand();
    this._render();
    this._afterBandSettled();
    this._syncPolling();
  }

  disconnectedCallback() {
    this._stopPolling();
    window.clearTimeout(this._fadeTimer);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this.isConnected) return;
    if (name === 'band' || name === 'supabase-url' || name === 'anon-key') {
      this._syncPolling();
      this._onBandMaybeChanged();
    } else {
      this._render();
    }
  }

  // --- configuration -------------------------------------------------------

  _attr(name, fallback) {
    const v = this.getAttribute(name);
    return v == null || v === '' ? fallback : v;
  }

  get _supportUrl() {
    const url = this._attr('support-url', '');
    // Only http(s) links — never render a javascript: or other scheme href.
    return /^https?:\/\//i.test(url) ? url : '';
  }

  // Must match the prompt_events.project check constraint (and report-usage's
  // project-name rule); anything else is logged as the default.
  get _project() {
    const p = this._attr('project', DEFAULTS.project);
    return PROJECT_NAME_RE.test(p) ? p : DEFAULTS.project;
  }

  get _supabaseConfig() {
    const url = this._attr('supabase-url', '').replace(/\/+$/, '');
    const key = this._attr('anon-key', '');
    return url && key ? { url, key } : null;
  }

  // Host-controlled mode: a `band` attribute wins and disables fetching.
  // Otherwise: loading until the first poll settles, then the last good band
  // (spec: never fabricate 'empty' on a failed poll), else 'unknown'.
  _effectiveBand() {
    const attr = this.getAttribute('band');
    if (attr != null) return KNOWN_BANDS.has(attr) ? attr : 'unknown';
    if (!this._supabaseConfig) return 'unknown';
    if (this._fetchedBand) return this._fetchedBand;
    return this._fetchSettled ? 'unknown' : 'loading';
  }

  // --- data ----------------------------------------------------------------

  _syncPolling() {
    const shouldPoll = this.getAttribute('band') == null && this._supabaseConfig;
    if (shouldPoll && !this._pollTimer) {
      this._poll();
      this._pollTimer = window.setInterval(() => this._poll(), POLL_MS);
    } else if (!shouldPoll) {
      this._stopPolling();
    }
  }

  _stopPolling() {
    if (this._pollTimer) window.clearInterval(this._pollTimer);
    this._pollTimer = null;
  }

  async _poll() {
    const cfg = this._supabaseConfig;
    if (!cfg) return;
    try {
      const res = await fetch(`${cfg.url}/rest/v1/rpc/get_capacity_band`, {
        method: 'POST',
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${cfg.key}`,
          'Content-Type': 'application/json'
        },
        body: '{}'
      });
      if (res.ok) {
        const data = await res.json();
        const row = Array.isArray(data) ? data[0] : data;
        if (row && typeof row.band === 'string' && KNOWN_BANDS.has(row.band)) {
          this._fetchedBand = row.band;
        }
      } else {
        console.warn(`[funding-status] get_capacity_band HTTP ${res.status}; keeping last known band`);
      }
    } catch (e) {
      console.warn('[funding-status] get_capacity_band failed; keeping last known band', e);
    }
    this._fetchSettled = true;
    this._onBandMaybeChanged();
  }

  // Silent-fail analytics insert. Never blocks or breaks the UI. If the
  // `project` column isn't there yet (migration not applied), retry once
  // without it so impressions still land.
  async _logEvent(kind, band) {
    const cfg = this._supabaseConfig;
    if (!cfg) return;
    const base = { kind, band: LOGGABLE_BANDS.has(band) ? band : null };
    const send = (body) =>
      fetch(`${cfg.url}/rest/v1/prompt_events`, {
        method: 'POST',
        keepalive: true,
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${cfg.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(body)
      });
    try {
      const res = await send({ ...base, project: this._project });
      if (res.status === 400) await send(base);
    } catch {
      // Analytics must never break UX.
    }
  }

  _logImpression(band) {
    if (!LOGGABLE_BANDS.has(band)) return;
    const key = `${TAG}:impressions:${this._project}`;
    let seen;
    try {
      seen = new Set(JSON.parse(sessionStorage.getItem(key) || '[]'));
    } catch {
      seen = new Set();
    }
    if (seen.has(band)) return;
    seen.add(band);
    try {
      sessionStorage.setItem(key, JSON.stringify([...seen]));
    } catch {
      // sessionStorage unavailable — may double-log this session; harmless.
    }
    this._logEvent('capacity_impression', band);
  }

  // --- band transitions ----------------------------------------------------

  _onBandMaybeChanged() {
    const next = this._effectiveBand();
    // Cancel any pending fade first — a band that flips back within the fade
    // window must not let the stale timer paint (and log) the old target.
    window.clearTimeout(this._fadeTimer);
    const pending = this._container.querySelector('.pill.fading');
    if (next === this._shownBand) {
      if (pending) pending.classList.remove('fading');
      this._render();
      return;
    }
    const pill = this._container.querySelector('.pill');
    if (!pill || prefersReducedMotion() || this._shownBand === 'loading') {
      this._shownBand = next;
      this._render();
      this._afterBandSettled();
      return;
    }
    pill.classList.add('fading');
    this._fadeTimer = window.setTimeout(() => {
      this._shownBand = next;
      this._render();
      this._afterBandSettled();
    }, FADE_MS);
  }

  _afterBandSettled() {
    const band = this._shownBand;
    if (band === 'loading' || band === this._lastEmitted) return;
    this._lastEmitted = band;
    this._logImpression(band);
    this.dispatchEvent(
      new CustomEvent(`${TAG}:change`, { detail: { band }, bubbles: true, composed: true })
    );
  }

  // --- rendering -----------------------------------------------------------

  _render() {
    const band = this._shownBand || 'loading';
    const isLoading = band === 'loading';
    const tagline = this._attr('tagline', DEFAULTS.tagline);
    const ctaText = this._attr('cta-text', DEFAULTS.ctaText);
    const stage = stageFor(band, this._attr('empty-text', DEFAULTS.emptyText));
    const supportUrl = this._supportUrl;

    const frag = document.createDocumentFragment();

    const status = el('div');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    // The whole pill is the support link when a URL is configured. Without
    // one it's a plain status pill — never a dead link.
    const pill = el(supportUrl ? 'a' : 'div', 'pill');
    pill.dataset.band = band;
    pill.setAttribute('part', 'pill');
    if (supportUrl) {
      pill.href = supportUrl;
      pill.target = '_blank';
      pill.rel = 'noopener noreferrer';
      pill.setAttribute(
        'aria-label',
        `Credits: ${stage.label}. ${tagline}. ${ctaText} (opens in a new tab)`
      );
      pill.addEventListener('click', () => this._logEvent('capacity_click', band));
    }

    if (!isLoading) {
      const lines = el('span', 'lines');
      const l1 = el('span', 'l1');
      l1.appendChild(el('span', 'muted', 'Credits'));
      const meter = el('span', 'meter');
      meter.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 3; i++) {
        meter.appendChild(el('span', i < stage.filled ? 'seg on' : 'seg'));
      }
      l1.appendChild(meter);
      const label = el('span');
      label.appendChild(el('span', 'sr', 'Credits: '));
      label.appendChild(document.createTextNode(stage.label));
      l1.appendChild(label);
      lines.appendChild(l1);
      lines.appendChild(el('span', 'l2', tagline));
      pill.appendChild(lines);

      if (supportUrl) {
        const cta = el('span', 'cta', ctaText);
        cta.setAttribute('aria-hidden', 'true');
        pill.appendChild(cta);
      }
    }
    status.appendChild(pill);
    frag.appendChild(status);

    if (band === 'empty') {
      const notify = el('button', 'notify', 'Notify me');
      notify.type = 'button';
      notify.addEventListener('click', () =>
        this.dispatchEvent(new CustomEvent(`${TAG}:notify`, { bubbles: true, composed: true }))
      );
      frag.appendChild(notify);
    }

    this._container.replaceChildren(frag);
  }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG)) {
  customElements.define(TAG, FundingStatus);
}
