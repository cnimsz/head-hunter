import { useEffect, useMemo, useRef, useState } from 'react';
import AuthGate from './AuthGate.jsx';
import Turnstile, { resetTurnstile } from './Turnstile.jsx';
import {
  runGapAnalysis,
  updateFinding,
  completeRun,
  appendAnswerToMasterCV
} from '../lib/gapAnalysis.js';
import { getMasterCV } from '../lib/storage.js';

const TIER_LABEL = {
  highest: 'Highest impact',
  medium: 'Medium impact',
  hiding: 'Hiding in background'
};

const TIER_BORDER = {
  highest: 'border-t-red-500',
  medium: 'border-t-amber-400',
  hiding: 'border-t-slate-400'
};

const TIER_BADGE = {
  highest: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  hiding: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
};

export default function GapAnalysisPanel({
  tailoredCvText,
  jobDescription,
  companyName,
  roleTitle,
  onRetailor,
  onClose
}) {
  return (
    <div
      className="fixed inset-0 z-40 bg-black/50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Gap Analysis"
    >
      <div className="bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-full md:w-[40%] md:min-w-[480px] max-w-[720px] h-full overflow-y-auto shadow-2xl flex flex-col">
        <AuthGate
          title="Sign in to run Gap Analysis"
          subtitle="We scope your gap-analysis history to you. One-time magic link — no password."
        >
          <PanelBody
            tailoredCvText={tailoredCvText}
            jobDescription={jobDescription}
            companyName={companyName}
            roleTitle={roleTitle}
            onRetailor={onRetailor}
            onClose={onClose}
          />
        </AuthGate>
        {/* Render a close affordance even in the auth-gated state so users
            can back out without signing in. */}
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
      className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xl"
      aria-label="Close gap analysis"
    >
      ✕
    </button>
  );
}

function PanelBody({ tailoredCvText, jobDescription, companyName, roleTitle, onRetailor, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [run, setRun] = useState(null); // { run_id, findings, reframe, shortest_path }
  const [findingState, setFindingState] = useState({}); // id -> { status, answer, applied, masterCvSection }
  const [turnstileToken, setTurnstileToken] = useState('');
  const [retailoring, setRetailoring] = useState(false);
  const hasRunRef = useRef(false);
  // Snapshot the inputs at mount so re-renders never trigger a second (paid)
  // gap-analysis call. The panel is opened with the values the user wants
  // analysed; if they change, they close and re-open it.
  const inputsRef = useRef({ tailoredCvText, jobDescription, companyName, roleTitle });

  useEffect(() => {
    // StrictMode runs effects twice in dev; the ref guard ensures we only kick
    // off the (paid) analysis once.
    if (hasRunRef.current) return;
    hasRunRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const result = await runGapAnalysis(inputsRef.current);
        if (cancelled) return;
        setRun(result);
        const init = {};
        for (const f of result.findings) {
          init[f.id] = { status: 'open', answer: '', applied: false, masterCvSection: null };
        }
        setFindingState(init);
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const addressedCount = useMemo(
    () => Object.values(findingState).filter((s) => s.status !== 'open').length,
    [findingState]
  );
  const appliedCount = useMemo(
    () => Object.values(findingState).filter((s) => s.applied).length,
    [findingState]
  );
  const canRetailor = appliedCount > 0 && Boolean(onRetailor);
  const retailorReady = canRetailor && Boolean(turnstileToken);

  async function handleDone() {
    if (run?.run_id) {
      try {
        await completeRun(run.run_id, addressedCount);
      } catch (e) {
        console.warn('completeRun failed:', e);
      }
    }
    if (retailorReady) {
      setRetailoring(true);
      try {
        await onRetailor({ turnstileToken });
      } catch (e) {
        console.warn('retailor failed:', e);
      } finally {
        setRetailoring(false);
        resetTurnstile();
      }
    }
    onClose();
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col">
        <Header companyName={companyName} roleTitle={roleTitle} />
        <div className="p-6 text-sm text-slate-600 dark:text-slate-300">
          Analysing your CV against the JD… this usually takes 15–30 seconds because we search for
          named specifics about the hiring company.
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col">
        <Header companyName={companyName} roleTitle={roleTitle} />
        <div className="p-6 space-y-3">
          <div className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded p-3">
            {error}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!run) return null;
  const totalGaps = run.findings.length;

  return (
    <div className="flex-1 flex flex-col">
      <Header
        companyName={companyName}
        roleTitle={roleTitle}
        totalGaps={totalGaps}
        addressedCount={addressedCount}
        matchScore={run.match_score}
        matchScoreRationale={run.match_score_rationale}
      />

      <div className="px-5 py-3 flex-1 space-y-3">
        {run.findings.map((f) => (
          <GapCard
            key={f.id}
            finding={f}
            state={findingState[f.id]}
            onChange={(patch) =>
              setFindingState((prev) => ({ ...prev, [f.id]: { ...prev[f.id], ...patch } }))
            }
          />
        ))}

        {run.reframe && <ReframeCard reframe={run.reframe} />}

        {Array.isArray(run.shortest_path) && run.shortest_path.length > 0 && (
          <ShortestPathCard questions={run.shortest_path} />
        )}
      </div>

      <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-5 py-3 space-y-3">
        {canRetailor && (
          <div className="space-y-2">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {appliedCount} answer{appliedCount === 1 ? '' : 's'} added to your Master CV.
              Solve the bot challenge to re-tailor your CV with the new info.
            </p>
            <Turnstile
              onToken={setTurnstileToken}
              onExpire={() => setTurnstileToken('')}
              onError={() => setTurnstileToken('')}
            />
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {addressedCount} of {totalGaps} addressed
          </span>
          <button
            type="button"
            onClick={handleDone}
            disabled={retailoring || (canRetailor && !retailorReady)}
            className="px-4 py-2 rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {retailoring
              ? 'Re-tailoring…'
              : canRetailor
                ? 'Done & Re-tailor'
                : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Header({ companyName, roleTitle, totalGaps, addressedCount, matchScore, matchScoreRationale }) {
  const subject = [companyName, roleTitle].filter(Boolean).join(' · ') || 'Tailored CV';
  return (
    <div className="px-5 pt-5 pb-3 border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold">Gap Analysis</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subject}</p>
        </div>
        {typeof matchScore === 'number' && (
          <MatchScoreBadge score={matchScore} />
        )}
      </div>
      {typeof matchScore === 'number' && matchScoreRationale && (
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 italic">
          {matchScoreRationale}
        </p>
      )}
      {typeof totalGaps === 'number' && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          {totalGaps} gaps found · {addressedCount} addressed
        </p>
      )}
    </div>
  );
}

function MatchScoreBadge({ score }) {
  const tone =
    score >= 80
      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800'
      : score >= 50
        ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800'
        : 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-200 dark:border-red-800';
  return (
    <div
      className={`flex flex-col items-center justify-center border rounded px-3 py-1.5 min-w-[72px] ${tone}`}
      title="Estimated match between this tailored CV and the JD, before gap answers are applied."
    >
      <span className="text-xl font-bold leading-none">{score}<span className="text-xs font-medium">%</span></span>
      <span className="text-[10px] uppercase tracking-wide mt-0.5">Match</span>
    </div>
  );
}

function GapCard({ finding, state, onChange }) {
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState(null);
  const status = state?.status || 'open';
  const answer = state?.answer || '';

  if (status !== 'open') {
    return (
      <div className="border border-slate-200 dark:border-slate-700 rounded p-3 bg-slate-50 dark:bg-slate-800/30 text-sm flex items-center gap-2">
        <span className="text-emerald-600">✓</span>
        <span className="font-medium">{finding.gap_title}</span>
        <span className="text-xs text-slate-500 ml-auto">{statusLabel(status)}</span>
      </div>
    );
  }

  async function handleAddToCV() {
    setLocalError(null);
    if (!answer.trim()) {
      setLocalError('Write a one-sentence answer first, or use Doesn’t apply.');
      return;
    }
    if (!getMasterCV()?.text) {
      setLocalError('No Master CV in this browser — save one before adding evidence.');
      return;
    }
    setBusy(true);
    try {
      const section = appendAnswerToMasterCV({
        gapTitle: finding.gap_title,
        gapQuestion: finding.gap_question,
        userAnswer: answer
      });
      await updateFinding(finding.id, {
        status: 'answered',
        user_answer: answer.trim(),
        applied_to_master: true,
        master_cv_section: section
      });
      onChange({ status: 'answered', applied: true, masterCvSection: section });
    } catch (e) {
      setLocalError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSkip() {
    setLocalError(null);
    setBusy(true);
    try {
      await updateFinding(finding.id, { status: 'skipped' });
      onChange({ status: 'skipped' });
    } catch (e) {
      setLocalError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDoesntApply() {
    setLocalError(null);
    setBusy(true);
    try {
      await updateFinding(finding.id, { status: 'doesnt_apply' });
      onChange({ status: 'doesnt_apply' });
    } catch (e) {
      setLocalError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`border-t-4 ${TIER_BORDER[finding.impact_tier] || TIER_BORDER.medium} border-x border-b border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 p-4`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold flex-1">{finding.gap_title}</h3>
        <span
          className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded ${TIER_BADGE[finding.impact_tier] || TIER_BADGE.medium}`}
        >
          {TIER_LABEL[finding.impact_tier] || finding.impact_tier}
        </span>
      </div>
      {finding.gap_rationale && (
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{finding.gap_rationale}</p>
      )}
      <p className="text-sm italic text-slate-700 dark:text-slate-200 mt-2">{finding.gap_question}</p>

      <textarea
        value={answer}
        onChange={(e) => onChange({ answer: e.target.value })}
        placeholder="Your answer in one sentence. If you don't have it, click Doesn't apply."
        rows={3}
        className="mt-3 w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
      />

      {localError && <p className="text-xs text-red-600 mt-2">{localError}</p>}

      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          onClick={handleAddToCV}
          disabled={busy}
          className="px-3 py-1.5 text-sm rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-medium disabled:opacity-50"
        >
          {busy ? 'Working…' : 'Add to CV'}
        </button>
        <button
          type="button"
          onClick={handleSkip}
          disabled={busy}
          className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-700 disabled:opacity-50"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={handleDoesntApply}
          disabled={busy}
          className="px-3 py-1.5 text-sm rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-50"
        >
          Doesn&rsquo;t apply
        </button>
      </div>
    </div>
  );
}

function ReframeCard({ reframe }) {
  return (
    <div className="border border-emerald-300 dark:border-emerald-800 rounded p-4 bg-emerald-50 dark:bg-emerald-900/20">
      <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 mb-1">
        Reframe — not a gap, but worth knowing
      </h3>
      {reframe.summary && (
        <p className="text-sm text-emerald-900 dark:text-emerald-100">{reframe.summary}</p>
      )}
      {reframe.positioning_line && (
        <p className="text-sm italic text-emerald-900 dark:text-emerald-100 mt-2">
          Suggested positioning line: &ldquo;{reframe.positioning_line}&rdquo;
        </p>
      )}
    </div>
  );
}

function ShortestPathCard({ questions }) {
  return (
    <div className="border border-slate-300 dark:border-slate-700 rounded p-4 bg-slate-50 dark:bg-slate-800/40">
      <h3 className="text-sm font-semibold mb-2">Shortest path forward</h3>
      <p className="text-xs text-slate-500 mb-2">
        Answering these unlocks the biggest CV improvements in one round.
      </p>
      <ol className="list-decimal pl-5 text-sm space-y-1">
        {questions.map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ol>
    </div>
  );
}

function statusLabel(status) {
  if (status === 'answered') return 'Added to CV';
  if (status === 'skipped') return 'Skipped';
  if (status === 'doesnt_apply') return "Doesn't apply";
  return status;
}
