import { useEffect, useRef, useState } from 'react';
import { isPromptOnCooldown, markPromptDismissed } from '../lib/capacityCooldown.js';
import { logEvent } from '../lib/promptEvents.js';

// TODO: swap in the real Stripe Payment Link when created.
const STRIPE_DONATE_URL = '';

// Session-scoped impression throttle: log capacity_impression at most once
// per band per browser-tab session (spec resolution 6). sessionStorage clears
// on tab close, which matches how "session" reads in analytics.
const IMPRESSION_SESSION_KEY = 'cv-toolkit:capacity-impressions-logged';

function readImpressionSet() {
  try {
    const raw = sessionStorage.getItem(IMPRESSION_SESSION_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeImpressionSet(set) {
  try {
    sessionStorage.setItem(IMPRESSION_SESSION_KEY, JSON.stringify([...set]));
  } catch {
    // sessionStorage disabled/full — impression may double-log this session.
    // Not fatal; analytics tolerates it.
  }
}

// Runway bucket text comes verbatim from the RPC (do not parse a number
// out of it — the underlying estimate is not precise enough). Copy trimmed
// for compact inline placement in the header row.
function copyFor(band, runwayBucket) {
  switch (band) {
    case 'green':
      return 'Free — funded by donations';
    case 'amber':
      return `Credits running low · ${runwayBucket || 'a few weeks'} left`;
    case 'red':
      return 'Under a week of credits left';
    case 'empty':
      return 'Out of credits — tailoring paused';
    case 'unknown':
    default:
      return "Can't check credit balance right now";
  }
}

// Bubble tint per state. All states get a visible pill (the whole point of
// the header treatment is that donations always stand out); escalation is
// carried by tint strength + border colour + text weight.
function toneClasses(band) {
  switch (band) {
    case 'amber':
      return {
        bg: 'bg-amber-100 dark:bg-amber-500/25',
        border: 'border-amber-400 dark:border-amber-500',
        text: 'text-amber-900 dark:text-amber-100'
      };
    case 'red':
      return {
        bg: 'bg-red-100 dark:bg-red-500/30',
        border: 'border-red-400 dark:border-red-500',
        text: 'text-red-900 dark:text-red-100'
      };
    case 'empty':
      return {
        bg: 'bg-red-200 dark:bg-red-500/50',
        border: 'border-red-500 dark:border-red-400',
        text: 'text-red-900 dark:text-red-50'
      };
    case 'unknown':
      return {
        bg: 'bg-slate-100 dark:bg-slate-800',
        border: 'border-slate-300 dark:border-slate-600',
        text: 'text-slate-700 dark:text-slate-300'
      };
    case 'green':
    default:
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-500/15',
        border: 'border-emerald-400 dark:border-emerald-500/60',
        text: 'text-emerald-800 dark:text-emerald-100'
      };
  }
}

// Focus the WaitlistPanel input if present (empty state renders the
// WaitlistPanel below when the tool is suspended).
function focusWaitlistInput() {
  const el = document.getElementById('waitlist-email');
  if (el instanceof HTMLInputElement) {
    el.focus();
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// Inline pill rendered inside the App header, on the same row as the title
// and the settings widget. Always present in the DOM — green is a visible
// (quiet) state, not an absent one.
//   capacity === undefined → loading (invisible placeholder, preserves layout)
//   capacity === null      → RPC failed → 'unknown' band
//   capacity === object    → { band, runwayBucket }
export default function CapacityIndicator({ capacity }) {
  const isLoading = capacity === undefined;
  const band = isLoading ? null : capacity === null ? 'unknown' : capacity.band;
  const runwayBucket = capacity && capacity.runwayBucket;

  // Cooldown gates the Donate button only, never the pill itself. Empty
  // ignores the cooldown — a user who can't run the tool needs both the
  // Donate and Notify me CTAs regardless of what they dismissed last week.
  const [ctaDismissed, setCtaDismissed] = useState(() => isPromptOnCooldown());
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(m.matches);
    const handler = (e) => setPrefersReducedMotion(e.matches);
    m.addEventListener?.('change', handler);
    return () => m.removeEventListener?.('change', handler);
  }, []);

  // Impressions: once per band per session. Skip loading and skip unknown.
  useEffect(() => {
    if (!band || band === 'unknown') return;
    const seen = readImpressionSet();
    if (seen.has(band)) return;
    seen.add(band);
    writeImpressionSet(seen);
    logEvent('capacity_impression', band);
  }, [band]);

  // Cross-fade the text on band change. Skip under prefers-reduced-motion.
  const [visibleBand, setVisibleBand] = useState(band);
  const [fadeIn, setFadeIn] = useState(true);
  const bandRef = useRef(band);
  useEffect(() => {
    if (bandRef.current === band) return;
    bandRef.current = band;
    if (prefersReducedMotion) {
      setVisibleBand(band);
      setFadeIn(true);
      return;
    }
    setFadeIn(false);
    const t = window.setTimeout(() => {
      setVisibleBand(band);
      setFadeIn(true);
    }, 120);
    return () => window.clearTimeout(t);
  }, [band, prefersReducedMotion]);

  function handleDismiss() {
    markPromptDismissed();
    setCtaDismissed(true);
    logEvent('capacity_dismiss', band || 'unknown');
  }

  function handleDonate() {
    logEvent('capacity_click', band || 'unknown');
    if (STRIPE_DONATE_URL) {
      window.open(STRIPE_DONATE_URL, '_blank', 'noopener,noreferrer');
    }
  }

  const tone = toneClasses(visibleBand || 'green');

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold whitespace-nowrap transition-colors duration-200 ${
        tone.bg
      } ${tone.border} ${tone.text} ${
        fadeIn && !isLoading ? 'opacity-100' : 'opacity-0'
      } transition-opacity`}
    >
      {!isLoading && (
        <>
          <span>{copyFor(visibleBand || 'green', runwayBucket)}</span>
          {renderCta({
            band: visibleBand,
            ctaDismissed,
            tone,
            onDonate: handleDonate,
            onEmailCapture: focusWaitlistInput,
            onDismiss: handleDismiss
          })}
        </>
      )}
    </div>
  );
}

// CTA per state — text buttons, no filled sub-pills (the bubble itself is
// the visual weight). Cooldown suppresses the Donate CTA for
// green/amber/red/unknown; empty always shows both Donate and Notify me.
function renderCta({ band, ctaDismissed, onDonate, onEmailCapture, onDismiss }) {
  const link =
    'font-bold text-blue-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-blue-300';

  if (band === 'empty') {
    return (
      <>
        <span aria-hidden="true" className="opacity-40">
          ·
        </span>
        <button type="button" onClick={onDonate} className={link}>
          Donate
        </button>
        <span aria-hidden="true" className="opacity-40">
          ·
        </span>
        <button type="button" onClick={onEmailCapture} className={link}>
          Notify me
        </button>
      </>
    );
  }

  if (ctaDismissed) return null;

  return (
    <>
      <span aria-hidden="true" className="opacity-40">
        ·
      </span>
      <button type="button" onClick={onDonate} className={link}>
        Donate
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Hide donate prompt"
        title="Hide for 3 days"
        className="ml-0.5 rounded px-1 opacity-70 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      >
        ✕
      </button>
    </>
  );
}
