import { useMemo, useState } from 'react';
import { extractTextFromFile } from '../lib/cvParser.js';
import { getMasterCV, saveMasterCV } from '../lib/storage.js';
import MasterCVCompiler from './MasterCVCompiler.jsx';

const STEP_LABEL = {
  idle: '',
  cv: 'Creating CV…',
  research: 'Researching company…',
  coverLetter: 'Writing cover letter…',
  done: 'Done'
};

export default function InputPanel({ onGenerate, isGenerating, currentStep }) {
  const initialSaved = getMasterCV();
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

  const canGenerate = useMemo(() => {
    if (!jobDescription.trim()) return false;
    if (useSavedCV && savedCV?.text) return true;
    if (cvFileText) return true;
    return false;
  }, [jobDescription, useSavedCV, savedCV, cvFileText]);

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
    onGenerate({ jobDescription: jobDescription.trim(), cvText, companyName: companyName.trim() });
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

      <label className="text-sm font-medium mt-2">Company Name <span className="text-slate-400 font-normal">(optional)</span></label>
      <input
        type="text"
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
        placeholder="e.g. Acme Robotics"
        className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
      />

      <div className="mt-2">
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium">Master CV</label>
          <button
            type="button"
            onClick={() => setCompilerOpen(true)}
            className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Compile from .zip
          </button>
        </div>
        {savedCV && (
          <label className="flex items-center gap-2 text-sm mb-2">
            <input
              type="checkbox"
              checked={useSavedCV}
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
              className="text-sm"
            />
            <label className="flex items-center gap-2 text-xs text-slate-500 mt-1">
              <input
                type="checkbox"
                checked={saveThisCV}
                onChange={(e) => setSaveThisCV(e.target.checked)}
              />
              Save this CV for next time
            </label>
            {parsing && <p className="text-xs text-slate-500 mt-1">Reading file…</p>}
            {cvFile && cvFileText && !parsing && (
              <p className="text-xs text-emerald-600 mt-1">Loaded {cvFile.name} ({cvFileText.length.toLocaleString()} chars).</p>
            )}
            {parseError && <p className="text-xs text-red-600 mt-1">{parseError}</p>}
          </>
        )}
      </div>

      <button
        type="submit"
        disabled={!canGenerate || isGenerating}
        className="mt-3 px-4 py-2 rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isGenerating ? STEP_LABEL[currentStep] || 'Generating…' : 'Generate'}
      </button>

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
