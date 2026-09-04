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

// Runway bucket text comes verbatim from the RPC (spec resolution 3). Do not
// parse a number out of it — the underlying estimate is not precise enough.
function copyFor(band, runwayBucket) {
  switch (band) {
    case 'green':
      return 'Free, funded by donations.';
    case 'amber':
      return `Credits running low — about ${runwayBucket || 'a few weeks'} left at current use.`;
    case 'red':
      return 'Under a week of credits left.';
    case 'empty':
      return 'Out of credits. Tailoring is paused until donations refill it.';
    case 'unknown':
    default:
      return "Can't check credit balance right now.";
  }
}

// State is carried by a 3px left rule + text colour + progressively stronger
// tint (spec §Visual). Never a saturated wash. Never colour alone — copy is
// distinct across bands.
function toneClasses(band) {
  switch (band) {
    case 'amber':
      return {
        // Very light amber tint over the canvas; slightly stronger in dark.
        bg: 'bg-amber-500/5 dark:bg-amber-500/10',
        rule: 'border-l-amber-500',
        text: 'text-amber-900 dark:text-amber-100'
      };
    case 'red':
      return {
        bg: 'bg-red-500/5 dark:bg-red-500/15',
        rule: 'border-l-red-500',
        text: 'text-red-900 dark:text-red-100'
      };
    case 'empty':
      return {
        // Most tint of the escalation ladder.
        bg: 'bg-red-500/10 dark:bg-red-500/25',
        rule: 'border-l-red-600',
        text: 'text-red-900 dark:text-red-100'
      };
    case 'unknown':
      return {
        // Neutral — never claim scarcity when the read failed.
        bg: 'bg-transparent',
        rule: 'border-l-slate-400 dark:border-l-slate-500',
        text: 'text-slate-600 dark:text-slate-400'
      };
    case 'green':
    default:
      return {
        // Green is quiet: no tint, muted rule, muted text.
        bg: 'bg-transparent',
        rule: 'border-l-slate-300 dark:border-l-slate-700',
        text: 'text-slate-600 dark:text-slate-400'
      };
  }
}

// Focus the WaitlistPanel input if present (empty state renders the
// WaitlistPanel below the banner per spec resolution 1).
function focusWaitlistInput() {
  const el = document.getElementById('waitlist-email');
  if (el instanceof HTMLInputElement) {
    el.focus();
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// The banner. Rendered by App.jsx above the header (spec §Visual: full-width
// strip above the existing header row). Always present in the DOM — green is
// a quiet state, not an absent one (spec resolution: three-value capacity —
// undefined = loading, null = failed, object = success).
export default function CapacityIndicator({ capacity }) {
  const isLoading = capacity === undefined;
  const band = isLoading ? null : capacity === null ? 'unknown' : capacity.band;
  const runwayBucket = capacity && capacity.runwayBucket;

  // Cooldown gates the CTA only, never the banner itself (spec §Behaviour).
  // Empty ignores the cooldown — a user who can't run the tool needs the
  // email capture path regardless of what they dismissed last week.
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

  // Impressions: once per band per session. Skip loading and skip unknown
  // (unknown is a client-side error state — nothing user-relevant to attribute).
  useEffect(() => {
    if (!band || band === 'unknown') return;
    const seen = readImpressionSet();
    if (seen.has(band)) return;
    seen.add(band);
    writeImpressionSet(seen);
    logEvent('capacity_impression', band);
  }, [band]);

  // Cross-fade the text on band change (spec §Visual). Skip under
  // prefers-reduced-motion. Container height is stable — only text opacity.
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

  // Container is always in DOM at a fixed 32px height to prevent layout
  // shifts as capacity resolves. Loading = invisible contents, same height.
  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full border-l-[3px] ${tone.rule} ${tone.bg} transition-colors duration-200`}
    >
      <div
        className={`mx-auto flex h-8 max-w-7xl items-center gap-3 px-4 text-xs ${tone.text} transition-opacity duration-100 ${
          fadeIn && !isLoading ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {!isLoading && (
          <>
            <span className="flex-1 truncate">
              {copyFor(visibleBand || 'green', runwayBucket)}
            </span>
            {renderCta({
              band: visibleBand,
              ctaDismissed,
              onDonate: handleDonate,
              onEmailCapture: focusWaitlistInput,
              onDismiss: handleDismiss
            })}
          </>
        )}
      </div>
    </div>
  );
}

// CTA per state. All are text buttons — no filled pills (spec §Visual).
// Cooldown suppresses the Donate CTA for green/amber/red/unknown; empty
// always shows its "Notify me" link (spec §Behaviour: empty ignores cooldown).
function renderCta({ band, ctaDismissed, onDonate, onEmailCapture, onDismiss }) {
  if (band === 'empty') {
    return (
      <button
        type="button"
        onClick={onEmailCapture}
        className="rounded font-medium text-blue-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-blue-300"
      >
        Notify me
      </button>
    );
  }

  if (ctaDismissed) return null;

  const donateLabel = 'Donate';
  return (
    <>
      <button
        type="button"
        onClick={onDonate}
        className="rounded font-medium text-blue-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-blue-300"
      >
        {donateLabel}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Hide donate prompt"
        title="Hide for 3 days"
        className="rounded px-1 text-slate-500 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-slate-500 dark:hover:text-slate-200"
      >
        ✕
      </button>
    </>
  );
}
