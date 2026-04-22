import { useState } from 'react';
import { extractTextFromFile } from '../lib/cvParser.js';
import { analyseRevisions } from '../lib/feedback.js';
import { appendLearnings, getLearnings } from '../lib/learnings.js';
import { updateProfileFromText } from '../lib/profile.js';

const SKILLS = [
  { id: 'cv', label: 'CV', originalKey: 'cv' },
  { id: 'coverLetter', label: 'Cover Letter', originalKey: 'coverLetter' },
  { id: 'linkedIn', label: 'LinkedIn Message', originalKey: 'linkedInMessage' }
];

export default function FeedbackModal({ result, onClose }) {
  const [revised, setRevised] = useState({ cv: '', coverLetter: '', linkedIn: '' });
  const [status, setStatus] = useState('input');
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [applied, setApplied] = useState({ cv: false, coverLetter: false, linkedIn: false });

  async function handleFile(skill, file) {
    if (!file) return;
    setError(null);
    try {
      const text = await extractTextFromFile(file);
      setRevised((r) => ({ ...r, [skill]: text }));
      if (skill === 'cv' || skill === 'coverLetter') updateProfileFromText(text);
    } catch (e) {
      setError(`${skill}: ${e.message}`);
    }
  }

  function handleText(skill, value) {
    setRevised((r) => ({ ...r, [skill]: value }));
  }

  async function handleAnalyse() {
    const anyRevised = Object.values(revised).some((v) => v.trim());
    if (!anyRevised) { setError('Paste or upload at least one revised version.'); return; }
    setError(null);
    // Refresh profile from any pasted-in revisions too (file uploads already
    // update it in handleFile).
    if (revised.cv) updateProfileFromText(revised.cv);
    if (revised.coverLetter) updateProfileFromText(revised.coverLetter);
    setStatus('analysing');
    try {
      const out = await analyseRevisions({
        originals: {
          cv: result.cv,
          coverLetter: result.coverLetter,
          linkedIn: result.linkedInMessage
        },
        revised
      });
      setAnalysis(out);
      setStatus('review');
    } catch (e) {
      setError(e.message || String(e));
      setStatus('input');
    }
  }

  function applySkill(skill) {
    const rules = (analysis?.[skill]?.rules || [])
      .map((r) => (r || '').trim())
      .filter(Boolean);
    if (rules.length === 0) return;
    appendLearnings(skill, rules);
    setApplied((a) => ({ ...a, [skill]: true }));
  }

  function updateSummary(skill, value) {
    setAnalysis((a) => ({
      ...a,
      [skill]: { ...(a?.[skill] || {}), summary: value }
    }));
  }

  function updateRule(skill, index, value) {
    setAnalysis((a) => {
      const current = a?.[skill] || {};
      const rules = [...(current.rules || [])];
      rules[index] = value;
      return { ...a, [skill]: { ...current, rules } };
    });
  }

  function deleteRule(skill, index) {
    setAnalysis((a) => {
      const current = a?.[skill] || {};
      const rules = (current.rules || []).filter((_, i) => i !== index);
      return { ...a, [skill]: { ...current, rules } };
    });
  }

  function addRule(skill) {
    setAnalysis((a) => {
      const current = a?.[skill] || { summary: '', rules: [] };
      return { ...a, [skill]: { ...current, rules: [...(current.rules || []), ''] } };
    });
  }

  function applyAll() {
    for (const s of SKILLS) applySkill(s.id);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 border border-slate-200 dark:border-slate-800">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Refine from your edits</h2>
            <p className="text-xs text-slate-500 mt-1">
              Upload or paste your revised versions. Claude compares them to the originals, extracts
              style rules, and (with your confirmation) teaches them to each skill so future
              generations reflect your preferences.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">✕</button>
        </div>

        {status === 'input' && (
          <>
            {SKILLS.map((s) => (
              <div key={s.id} className="mb-4">
                <label className="text-sm font-medium block mb-1">Revised {s.label}</label>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  onChange={(e) => handleFile(s.id, e.target.files?.[0])}
                  className="text-xs mb-2 block"
                />
                <textarea
                  value={revised[s.id]}
                  onChange={(e) => handleText(s.id, e.target.value)}
                  placeholder={`Paste revised ${s.label} here, or upload above. Leave blank to skip.`}
                  className="w-full min-h-[100px] px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>
            ))}

            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={handleAnalyse}
                className="px-4 py-2 rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm font-medium"
              >
                Analyse changes
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded border border-slate-300 dark:border-slate-700 text-sm"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {status === 'analysing' && (
          <p className="text-sm text-slate-500">Analysing changes…</p>
        )}

        {status === 'review' && analysis && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
              Review and edit what Claude identified. Fix any inaccurate summaries, reword rules, delete
              ones you disagree with, or add your own. Apply per skill, or all at once.
            </p>
            {SKILLS.map((s) => {
              const a = analysis[s.id] || {};
              const rules = a.rules || [];
              const existingCount = getLearnings(s.id).length;
              const isApplied = applied[s.id];
              const validRuleCount = rules.filter((r) => (r || '').trim()).length;
              return (
                <div key={s.id} className="mb-4 border border-slate-200 dark:border-slate-700 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold">{s.label}</h3>
                    <button
                      onClick={() => applySkill(s.id)}
                      disabled={validRuleCount === 0 || isApplied}
                      className="text-xs px-3 py-1 rounded bg-emerald-600 text-white disabled:opacity-40"
                    >
                      {isApplied ? 'Applied ✓' : `Apply ${validRuleCount} rule(s)`}
                    </button>
                  </div>

                  <label className="text-[11px] font-medium text-slate-500 block mb-1">Summary</label>
                  <textarea
                    value={a.summary || ''}
                    onChange={(e) => updateSummary(s.id, e.target.value)}
                    disabled={isApplied}
                    placeholder="(no changes detected)"
                    className="w-full min-h-[48px] px-2 py-1 mb-3 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs disabled:opacity-60"
                  />

                  <label className="text-[11px] font-medium text-slate-500 block mb-1">Rules</label>
                  {rules.length > 0 ? (
                    <ul className="space-y-1 mb-2">
                      {rules.map((r, i) => (
                        <li key={i} className="flex gap-2 items-start">
                          <span className="text-xs text-slate-400 pt-1.5 w-4 text-right">{i + 1}.</span>
                          <textarea
                            value={r}
                            onChange={(e) => updateRule(s.id, i, e.target.value)}
                            disabled={isApplied}
                            rows={1}
                            className="flex-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs disabled:opacity-60"
                          />
                          <button
                            onClick={() => deleteRule(s.id, i)}
                            disabled={isApplied}
                            className="text-slate-400 hover:text-red-600 text-xs px-1 pt-1 disabled:opacity-40"
                            aria-label="Delete rule"
                          >✕</button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400 mb-2">No new rules proposed.</p>
                  )}
                  <button
                    onClick={() => addRule(s.id)}
                    disabled={isApplied}
                    className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40"
                  >
                    + Add rule
                  </button>

                  <p className="text-[10px] text-slate-400 mt-2">
                    Currently {existingCount} learned rule(s) stored for this skill.
                  </p>
                </div>
              );
            })}

            <div className="flex gap-2 mt-4">
              <button
                onClick={applyAll}
                className="px-4 py-2 rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm font-medium"
              >
                Apply all
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded border border-slate-300 dark:border-slate-700 text-sm"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
