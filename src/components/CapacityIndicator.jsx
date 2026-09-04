import { useEffect, useState } from 'react';
import { isPromptOnCooldown, markPromptDismissed } from '../lib/capacityCooldown.js';
import { logEvent } from '../lib/promptEvents.js';

// TODO: swap in the real Stripe Payment Link when created.
const STRIPE_DONATE_URL = '';

// Slim, dismissible bar rendered below the CV output on a successful
// tailoring. Spec §4: post-tailoring only — never global chrome. Never on
// green (indicator absent from DOM entirely — spec §3).
export default function CapacityIndicator({ band, runwayBucket }) {
  const [dismissed, setDismissed] = useState(() => isPromptOnCooldown());
  const [impressionLogged, setImpressionLogged] = useState(false);

  useEffect(() => {
    setDismissed(isPromptOnCooldown());
    setImpressionLogged(false);
  }, [band]);

  useEffect(() => {
    if (!band || band === 'green' || band === 'empty') return;
    if (dismissed || impressionLogged) return;
    logEvent('capacity_impression', band);
    setImpressionLogged(true);
  }, [band, dismissed, impressionLogged]);

  if (!band || band === 'green' || band === 'empty') return null;
  if (dismissed) return null;

  function handleDismiss() {
    markPromptDismissed();
    setDismissed(true);
    logEvent('capacity_dismiss', band);
  }

  function handleDonate() {
    logEvent('capacity_click', band);
    if (STRIPE_DONATE_URL) {
      window.open(STRIPE_DONATE_URL, '_blank', 'noopener,noreferrer');
    }
  }

  const isRed = band === 'red';
  const tone = isRed
    ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-red-950/40'
    : 'border-amber-400 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40';
  const textTone = isRed
    ? 'text-red-900 dark:text-red-100'
    : 'text-amber-900 dark:text-amber-100';
  const message = isRed
    ? `Compute has ${runwayBucket || 'about a week'} of runway left. €4 keeps it running for a day.`
    : `Compute has ${runwayBucket || 'a few weeks'} of runway. €4 keeps it running for a day.`;

  return (
    <div
      role="status"
      className={`mt-3 flex items-center gap-3 rounded border px-3 py-2 text-sm ${tone} ${textTone}`}
    >
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={handleDonate}
        className={
          isRed
            ? 'px-2.5 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700'
            : 'px-2.5 py-1 text-xs rounded bg-amber-600 text-white hover:bg-amber-700'
        }
      >
        Chip in
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="px-1.5 py-0.5 text-xs opacity-70 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}
