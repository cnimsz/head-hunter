import { useEffect, useState } from 'react';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase.js';
import { logEvent } from '../lib/promptEvents.js';

// TODO: swap in the real Stripe Payment Link when created.
const STRIPE_DONATE_URL = '';

// Draft persistence key (spec §7). A lost email after an auth-wall round-trip
// is a user who does not come back — even without auth, keeping the input
// across accidental refreshes matters.
const EMAIL_DRAFT_KEY = 'cv-toolkit:waitlist-email-draft';

// Rendered in place of the tool when the capacity band is 'empty' (spec §6).
export default function WaitlistPanel() {
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem(EMAIL_DRAFT_KEY) || '';
    } catch {
      return '';
    }
  });
  const [status, setStatus] = useState('idle'); // 'idle' | 'submitting' | 'joined' | 'already' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    try {
      if (email) localStorage.setItem(EMAIL_DRAFT_KEY, email);
      else localStorage.removeItem(EMAIL_DRAFT_KEY);
    } catch {}
  }, [email]);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus('error');
      setErrorMsg('Enter a valid email address.');
      return;
    }
    if (!isSupabaseConfigured()) {
      setStatus('error');
      setErrorMsg('Waitlist unavailable — Supabase not configured.');
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatus('error');
      setErrorMsg('Waitlist unavailable.');
      return;
    }

    setStatus('submitting');
    setErrorMsg('');
    try {
      const { error } = await supabase.from('waitlist').insert({ email: trimmed });
      if (error) {
        // 23505 = unique_violation on the email column. Not a real error —
        // they were already on the list from before.
        if (error.code === '23505') {
          setStatus('already');
          try {
            localStorage.removeItem(EMAIL_DRAFT_KEY);
          } catch {}
          return;
        }
        console.warn('[waitlist] insert failed:', error);
        setStatus('error');
        setErrorMsg('Could not save your email. Try again in a moment.');
        return;
      }
      setStatus('joined');
      logEvent('waitlist_signup', 'empty');
      try {
        localStorage.removeItem(EMAIL_DRAFT_KEY);
      } catch {}
    } catch (err) {
      console.warn('[waitlist] threw:', err);
      setStatus('error');
      setErrorMsg('Could not save your email. Try again in a moment.');
    }
  }

  function handleDonate() {
    logEvent('capacity_click', 'empty');
    if (STRIPE_DONATE_URL) {
      window.open(STRIPE_DONATE_URL, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-8 p-6 rounded-lg border border-slate-300 bg-slate-50 dark:bg-slate-800/40 dark:border-slate-700">
      <h2 className="text-lg font-semibold mb-2 text-slate-900 dark:text-slate-100">
        Out of credit for now
      </h2>
      <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">
        Awaiting on more donations to refill credits, will notify when refilled.
      </p>

      {status === 'joined' ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          Thanks — you're on the list. We'll email you when credits refill.
        </p>
      ) : status === 'already' ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          You're already on the list. We'll email you when credits refill.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <label htmlFor="waitlist-email" className="text-sm text-slate-700 dark:text-slate-300">
            Email
          </label>
          <input
            id="waitlist-email"
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status === 'error') setStatus('idle');
            }}
            className="px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            placeholder="you@example.com"
            autoComplete="email"
          />
          <div className="flex gap-2 mt-2">
            <button
              type="submit"
              disabled={status === 'submitting'}
              className="px-3 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {status === 'submitting' ? 'Joining…' : 'Notify me'}
            </button>
            <button
              type="button"
              onClick={handleDonate}
              className="px-3 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700"
            >
              Chip in
            </button>
          </div>
          {status === 'error' && errorMsg && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errorMsg}</p>
          )}
        </form>
      )}
    </div>
  );
}
