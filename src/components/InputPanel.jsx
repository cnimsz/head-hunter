import { useMemo, useState } from 'react';
import { extractTextFromFile } from '../lib/cvParser.js';
import { getMasterCV, saveMasterCV, getConsent, setConsent } from '../lib/storage.js';
import { updateProfileFromText } from '../lib/profile.js';
import MasterCVCompiler from './MasterCVCompiler.jsx';
import Turnstile, { resetTurnstile } from './Turnstile.jsx';

const STEP_LABEL = {
  idle: '',
  cv: 'Creating CV…',
  research: 'Researching company…',
  coverLetter: 'Writing cover letter…',
  done: 'Done'
};

export default function InputPanel({ onGenerate, isGenerating, currentStep, onFindRoles }) {
  const initialSaved = getMasterCV();
  const [consent, setConsentState] = useState(getConsent());
  const [jobDescription, setJobDescription] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [cvFile, setCvFile] = useState(null);
  const [cvFileText, setCvFileText] = useState('');
  const [useSavedCV, setUseSavedCV] = useState(Boolean(initialSaved));
  const [saveThisCV, setSaveThisCV] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [compilerOpen, setCompilerOpen] = useState(false);
  const [savedCV, setSavedCV] = useState(initialSaved);
  const [turnstileToken, setTurnstileToken] = useState('');

  function handleConsentChange(checked) {
    if (!checked && consent) {
      const ok = window.confirm(
        'Withdrawing consent will permanently delete your saved Master CV, profile, and learned style preferences from this browser. Continue?'
      );
      if (!ok) return;
    }
    setConsent(checked);
    setConsentState(checked);
    if (!checked) {
      setSavedCV(null);
      setUseSavedCV(false);
      setCvFile(null);
      setCvFileText('');
      setParseError(null);
    }
  }

  const canGenerate = useMemo(() => {
    if (!consent) return false;
    if (!jobDescription.trim()) return false;
    if (!turnstileToken) return false;
    if (useSavedCV && savedCV?.text) return true;
    if (cvFileText) return true;
    return false;
  }, [consent, jobDescription, turnstileToken, useSavedCV, savedCV, cvFileText]);

  async function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setCvFile(f);
    setParseError(null);
    setParsing(true);
    try {
      const text = await extractTextFromFile(f);
      setCvFileText(text);
      if (saveThisCV) saveMasterCV(text, f.name);
      updateProfileFromText(text);
      setUseSavedCV(false);
    } catch (err) {
      setParseError(err.message || 'Failed to read file.');
      setCvFileText('');
    } finally {
      setParsing(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const cvText = useSavedCV ? savedCV?.text : cvFileText;
    const tokenForCall = turnstileToken;
    // Token is single-use server-side. Clear it locally and reset the widget so
    // the user must re-solve the challenge before another generation.
    setTurnstileToken('');
    resetTurnstile();
    onGenerate({
      jobDescription: jobDescription.trim(),
      cvText,
      companyName: companyName.trim(),
      turnstileToken: tokenForCall
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-lg p-4"
    >
      <label className="text-sm font-medium">Job Description</label>
      <textarea
        required
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
        placeholder="Paste the full job posting here…"
        className="w-full min-h-[220px] px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
      />

      <label className="text-sm font-medium mt-2">
        Company Name and Job Title <span className="text-slate-400 font-normal">(optional)</span>
      </label>
      <input
        type="text"
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
        placeholder="e.g. Acme Robotics - Senior Engineer"
        className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
      />

      <div className="mt-2">
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium">Master CV</label>
          <button
            type="button"
            onClick={() => setCompilerOpen(true)}
            disabled={!consent}
            className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Compile from .zip
          </button>
        </div>

        <div className="mb-3 p-3 rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => handleConsentChange(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-slate-700 dark:text-slate-200">
              <strong>Required.</strong> I consent to (1) this app storing my Master CV, profile
              details, and learned style preferences in this browser's local storage, and (2) my job
              description and CV text being sent to Anthropic (via a Supabase proxy) as necessary
              for the app to generate tailored documents. Unchecking this box will permanently
              delete all data this app has stored in this browser.
            </span>
          </label>
        </div>

        {savedCV && (
          <label className={`flex items-center gap-2 text-sm mb-2 ${!consent ? 'opacity-50' : ''}`}>
            <input
              type="checkbox"
              checked={useSavedCV}
              disabled={!consent}
              onChange={(e) => setUseSavedCV(e.target.checked)}
            />
            Use saved CV: <span className="font-medium">{savedCV.filename}</span>
          </label>
        )}
        {!useSavedCV && (
          <>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={handleFile}
              disabled={!consent}
              className="text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <label
              className={`flex items-center gap-2 text-xs text-slate-500 mt-1 ${!consent ? 'opacity-50' : ''}`}
            >
              <input
                type="checkbox"
                checked={saveThisCV}
                disabled={!consent}
                onChange={(e) => setSaveThisCV(e.target.checked)}
              />
              Save this CV for next time
            </label>
            {parsing && <p className="text-xs text-slate-500 mt-1">Reading file…</p>}
            {cvFile && cvFileText && !parsing && (
              <p className="text-xs text-emerald-600 mt-1">
                Loaded {cvFile.name} ({cvFileText.length.toLocaleString()} chars).
              </p>
            )}
            {parseError && <p className="text-xs text-red-600 mt-1">{parseError}</p>}
          </>
        )}
      </div>

      <div className="mt-2">
        <Turnstile
          onToken={setTurnstileToken}
          onExpire={() => setTurnstileToken('')}
          onError={() => setTurnstileToken('')}
        />
      </div>

      <button
        type="submit"
        disabled={!canGenerate || isGenerating}
        className="mt-3 px-4 py-2 rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isGenerating ? STEP_LABEL[currentStep] || 'Generating…' : 'Generate'}
      </button>

      {onFindRoles && (
        <button
          type="button"
          onClick={() => onFindRoles(jobDescription.trim())}
          className="px-4 py-2 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium"
        >
          Find Roles
        </button>
      )}

      {compilerOpen && (
        <MasterCVCompiler
          onClose={() => setCompilerOpen(false)}
          onCompiled={() => {
            const latest = getMasterCV();
            setSavedCV(latest);
            setUseSavedCV(true);
            setCvFile(null);
            setCvFileText('');
          }}
        />
      )}
    </form>
  );
}
