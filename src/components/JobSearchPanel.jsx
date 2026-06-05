import { useEffect, useRef, useState } from 'react';
import AuthGate from './AuthGate.jsx';
import {
  listActiveCandidates,
  refreshCandidates,
  submitJobsearchFeedback
} from '../lib/jobsearch.js';
import { getMasterCV } from '../lib/storage.js';

const TARGET_ACTIVE = 3;

const PASS_REASONS = [
  ['career_direction', 'Not aligned with my career direction'],
  ['wrong_seniority', 'Wrong seniority level'],
  ['wrong_geography', 'Wrong geography'],
  ['comp_low', 'Comp likely too low'],
  ['industry_not_interesting', 'Industry / vertical not interesting'],
  ['company_stage', 'Company stage not a fit'],
  ['already_in_process', 'Already applied or in process elsewhere'],
  ['other', 'Other']
];

const APPLY_REASONS = [
  ['responsibilities_fit', 'Strong fit on responsibilities'],
  ['industry_fit', 'Strong fit on industry / vertical'],
  ['comp_right', 'Compensation looks right'],
  ['company_team', 'Strong company / team'],
  ['level_scope', 'Right level / scope'],
  ['other', 'Other']
];

export default function JobSearchPanel({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-40 bg-black/50 flex justify-center items-start overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Find Roles"
    >
      <div className="relative bg-white dark:bg-slate-900 w-full max-w-5xl min-h-full md:min-h-0 md:my-8 md:rounded-lg shadow-2xl flex flex-col">
        <AuthGate
          title="Sign in to find roles"
          subtitle="We scope your role discovery and feedback to you. One-time magic link — no password."
        >
          <PanelBody onClose={onClose} />
        </AuthGate>
        <FloatingCloseButton onClose={onClose} />
      </div>
    </div>
  );
}

function FloatingCloseButton({ onClose }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xl z-10"
      aria-label="Close"
    >
      ✕
    </button>
  );
}

function PanelBody({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [feedbackFor, setFeedbackFor] = useState(null); // { candidate, action }
  const [exhausted, setExhausted] = useState(false);
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        if (!getMasterCV()?.text) {
          setError('Save a Master CV first — jobsearch needs it to find matching roles.');
          setLoading(false);
          return;
        }
        const initial = await listActiveCandidates();
        if (cancelled) return;
        const list = initial.candidates || [];
        if (list.length >= TARGET_ACTIVE) {
          setCandidates(list);
          setLoading(false);
          return;
        }
        // Pool under-filled — top up.
        const refreshed = await refreshCandidates();
        if (cancelled) return;
        setCandidates(refreshed.candidates || []);
        if ((refreshed.candidates || []).length === 0) setExhausted(true);
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  async function handleFeedbackSubmit({ candidate, action, reasonCode, freeText }) {
    setBusy(true);
    setError(null);
    try {
      const result = await submitJobsearchFeedback({
        candidateId: candidate.id,
        action,
        reasonCode,
        freeText
      });
      setCandidates(result.candidates || []);
      if ((result.candidates || []).length === 0) setExhausted(true);
      setFeedbackFor(null);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col">
        <Header />
        <div className="p-6 text-sm text-slate-600 dark:text-slate-300">
          Finding roles tailored to your Master CV…
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header activeCount={candidates.length} />

      {error && (
        <div className="mx-5 mt-4 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded p-3">
          {error}
        </div>
      )}

      <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
        {Array.from({ length: TARGET_ACTIVE }).map((_, i) => {
          const c = candidates[i];
          if (c) {
            return (
              <CandidateCard
                key={c.id}
                candidate={c}
                disabled={busy}
                onPass={() => setFeedbackFor({ candidate: c, action: 'pass' })}
                onApply={() => setFeedbackFor({ candidate: c, action: 'apply' })}
              />
            );
          }
          return <EmptySlot key={`empty-${i}`} exhausted={exhausted} busy={busy} />;
        })}
      </div>

      <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-5 py-3 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {candidates.length} of {TARGET_ACTIVE} active
        </span>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm font-medium"
        >
          Close
        </button>
      </div>

      {feedbackFor && (
        <FeedbackModal
          candidate={feedbackFor.candidate}
          action={feedbackFor.action}
          busy={busy}
          onCancel={() => setFeedbackFor(null)}
          onSubmit={(payload) => handleFeedbackSubmit({ ...feedbackFor, ...payload })}
        />
      )}
    </div>
  );
}

function Header({ activeCount }) {
  return (
    <div className="px-5 pt-5 pb-3 border-b border-slate-200 dark:border-slate-800">
      <h2 className="text-lg font-semibold">Find Roles</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
        Three roles at a time. Pass or Apply on each one to refresh the pool.
      </p>
      {typeof activeCount === 'number' && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          {activeCount} of {TARGET_ACTIVE} active
        </p>
      )}
    </div>
  );
}

function CandidateCard({ candidate, onPass, onApply, disabled }) {
  function handleApply() {
    // Open the JD in a new tab first, then surface the feedback modal so the
    // user can react to what they just read. Spec: Apply both opens the JD
    // and asks for a reason.
    window.open(candidate.jd_url, '_blank', 'noopener,noreferrer');
    onApply();
  }

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 p-4 flex flex-col h-full">
      <h3 className="text-base font-semibold leading-tight">{candidate.company}</h3>
      <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">{candidate.title}</p>
      {candidate.location && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{candidate.location}</p>
      )}
      {candidate.why_chosen && (
        <p className="text-sm italic text-slate-600 dark:text-slate-300 mt-3">
          {candidate.why_chosen}
        </p>
      )}
      <div className="flex-1" />
      <div className="flex gap-2 mt-4">
        <button
          type="button"
          onClick={onPass}
          disabled={disabled}
          className="flex-1 px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          aria-label={`Pass on ${candidate.company} ${candidate.title}`}
        >
          ✕ Pass
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={disabled}
          className="flex-1 px-3 py-1.5 text-sm rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-medium disabled:opacity-50"
        >
          Apply ↗
        </button>
      </div>
    </div>
  );
}

function EmptySlot({ exhausted, busy }) {
  return (
    <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 flex items-center justify-center text-center text-sm text-slate-500 dark:text-slate-400 min-h-[200px]">
      {busy
        ? 'Finding more roles…'
        : exhausted
        ? 'No new roles right now — check back later.'
        : 'Finding more roles…'}
    </div>
  );
}

function FeedbackModal({ candidate, action, busy, onCancel, onSubmit }) {
  const [reasonCode, setReasonCode] = useState('');
  const [freeText, setFreeText] = useState('');
  const reasons = action === 'apply' ? APPLY_REASONS : PASS_REASONS;
  const title =
    action === 'apply' ? 'What made this role appealing?' : 'Why pass on this role?';
  const requiresFreeText = reasonCode === 'other';
  const submitDisabled =
    busy || !reasonCode || (requiresFreeText && !freeText.trim());

  function handleSubmit(e) {
    e.preventDefault();
    if (submitDisabled) return;
    onSubmit({ reasonCode, freeText: freeText.trim() });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-md p-5"
      >
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {candidate.company} — {candidate.title}
        </p>

        <div className="mt-4 space-y-2">
          {reasons.map(([code, label]) => (
            <label key={code} className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="reason"
                value={code}
                checked={reasonCode === code}
                onChange={() => setReasonCode(code)}
                className="mt-1"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        <textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder={
            requiresFreeText
              ? 'Required — tell us more.'
              : 'Optional — anything specific (free text).'
          }
          rows={2}
          className="mt-3 w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
        />

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitDisabled}
            className="px-3 py-1.5 text-sm rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Working…' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  );
}
