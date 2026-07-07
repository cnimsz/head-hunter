import { useState } from 'react';
import { extractTextFromFile, extractDocxText } from '../lib/cvParser.js';
import { buildCVBlob, buildCoverLetterBlob } from '../lib/docx.js';
import { analyseRevisions } from '../lib/feedback.js';
import { appendLearnings, getLearnings } from '../lib/learnings.js';
import { updateProfileFromText } from '../lib/profile.js';
import Turnstile, { resetTurnstile } from './Turnstile.jsx';

const SKILLS = [
  { id: 'cv', label: 'CV', originalKey: 'cv' },
  { id: 'coverLetter', label: 'Cover Letter', originalKey: 'coverLetter' },
  { id: 'linkedIn', label: 'LinkedIn Message', originalKey: 'linkedInMessage' }
];

function formatRules(rules) {
  return (rules || []).map((r, i) => `${i + 1}. ${r}`).join('\n');
}

function parseRules(text) {
  return (text || '')
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^\d+[.)]\s*/, '')
        .trim()
    )
    .filter(Boolean);
}

// Build the comparison baseline the same way the user got it: render the CV /
// cover letter to a .docx with the same template they downloaded, then extract
// its raw text with the same parser used for their upload. This makes the diff
// apples-to-apples — Word list bullets, title/date layout, and separators cancel
// out, so only genuine edits register instead of docx round-trip artifacts.
async function downloadedBaseline(skill, result, template) {
  try {
    if (skill === 'cv' && result?.cvData) {
      return await extractDocxText(await buildCVBlob(result.cvData, { template }));
    }
    if (skill === 'coverLetter' && result?.clData) {
      return await extractDocxText(await buildCoverLetterBlob(result.clData, { template }));
    }
  } catch {
    // Fall back to the plain-text version if rendering/extraction fails.
  }
  return { cv: result?.cv, coverLetter: result?.coverLetter, linkedIn: result?.linkedInMessage }[
    skill
  ];
}

export default function FeedbackModal({ result, template = 'classic', onClose }) {
  const [revised, setRevised] = useState({ cv: '', coverLetter: '', linkedIn: '' });
  const [status, setStatus] = useState('input');
  const [analysis, setAnalysis] = useState(null);
  const [rulesText, setRulesText] = useState({ cv: '', coverLetter: '', linkedIn: '' });
  const [error, setError] = useState(null);
  const [applied, setApplied] = useState({ cv: false, coverLetter: false, linkedIn: false });
  const [turnstileToken, setTurnstileToken] = useState('');

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
    if (!anyRevised) {
      setError('Paste or upload at least one revised version.');
      return;
    }
    if (!turnstileToken) {
      setError('Solve the bot challenge first.');
      return;
    }
    setError(null);
    // Refresh profile from any pasted-in revisions too (file uploads already
    // update it in handleFile).
    if (revised.cv) updateProfileFromText(revised.cv);
    if (revised.coverLetter) updateProfileFromText(revised.coverLetter);
    const tokenForCall = turnstileToken;
    setTurnstileToken('');
    resetTurnstile();
    setStatus('analysing');
    try {
      const [cvBaseline, clBaseline] = await Promise.all([
        downloadedBaseline('cv', result, template),
        downloadedBaseline('coverLetter', result, template)
      ]);
      const out = await analyseRevisions({
        originals: {
          cv: cvBaseline,
          coverLetter: clBaseline,
          linkedIn: result.linkedInMessage
        },
        revised,
        turnstileToken: tokenForCall
      });
      setAnalysis(out);
      setRulesText({
        cv: formatRules(out?.cv?.rules),
        coverLetter: formatRules(out?.coverLetter?.rules),
        linkedIn: formatRules(out?.linkedIn?.rules)
      });
      setStatus('review');
    } catch (e) {
      setError(e.message || String(e));
      setStatus('input');
    }
  }

  function applySkill(skill) {
    const rules = parseRules(rulesText[skill]);
    if (rules.length === 0) return;
    appendLearnings(skill, rules);
    setApplied((a) => ({ ...a, [skill]: true }));
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
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            ✕
          </button>
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

            <div className="mb-3">
              <Turnstile
                onToken={setTurnstileToken}
                onExpire={() => setTurnstileToken('')}
                onError={() => setTurnstileToken('')}
              />
            </div>

            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={handleAnalyse}
                disabled={!turnstileToken}
                className="px-4 py-2 rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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

        {status === 'analysing' && <p className="text-sm text-slate-500">Analysing changes…</p>}

        {status === 'review' && analysis && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
              Review the rules Claude proposed. Edit, reorder, or delete lines before applying. Each
              numbered line becomes one rule. Apply per skill, or all at once.
            </p>
            {SKILLS.map((s) => {
              const a = analysis[s.id] || {};
              const existingCount = getLearnings(s.id).length;
              const isApplied = applied[s.id];
              const parsedCount = parseRules(rulesText[s.id]).length;
              return (
                <div
                  key={s.id}
                  className="mb-4 border border-slate-200 dark:border-slate-700 rounded p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold">{s.label}</h3>
                    <button
                      onClick={() => applySkill(s.id)}
                      disabled={parsedCount === 0 || isApplied}
                      className="text-xs px-3 py-1 rounded bg-emerald-600 text-white disabled:opacity-40"
                    >
                      {isApplied ? 'Applied ✓' : `Apply ${parsedCount} rule(s)`}
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                    <strong>Summary:</strong> {a.summary || '(no changes detected)'}
                  </p>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">Rules</label>
                  <textarea
                    value={rulesText[s.id]}
                    onChange={(e) => setRulesText((t) => ({ ...t, [s.id]: e.target.value }))}
                    disabled={isApplied}
                    placeholder="No new rules proposed. Add one per line — leading numbering is optional."
                    className="w-full min-h-[120px] px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs leading-relaxed disabled:opacity-60"
                  />
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
