import { useEffect, useState } from 'react';
import InputPanel from './components/InputPanel.jsx';
import OutputPanel from './components/OutputPanel.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import JobSearchPanel from './components/JobSearchPanel.jsx';
import { getTheme, saveTheme, getMasterCV } from './lib/storage.js';
import { generateApplication } from './lib/claude.js';
import { getProfile, profileForGeneration } from './lib/profile.js';
import { getSupabaseClient, isSupabaseConfigured } from './lib/supabase.js';

export default function App() {
  const [theme, setTheme] = useState(getTheme());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [jobSearchOpen, setJobSearchOpen] = useState(false);
  const [jobSearchSeedJD, setJobSearchSeedJD] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState('idle');
  const [lastInputs, setLastInputs] = useState({ companyName: '', jobDescription: '' });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    saveTheme(theme);
  }, [theme]);

  // Touch the Supabase client on mount so it picks up magic-link `?code=...`
  // params from the URL and exchanges them for a session, even if AuthGate
  // isn't mounted yet. No-op when Supabase env vars aren't configured.
  useEffect(() => {
    getSupabaseClient();
  }, []);

  async function handleGenerate({ jobDescription, cvText, companyName, turnstileToken, atsSystem }) {
    setError(null);
    setResult(null);
    setIsGenerating(true);
    setLastInputs({ companyName: companyName || '', jobDescription: jobDescription || '' });
    try {
      const out = await generateApplication({
        jobDescription,
        cvText,
        companyName,
        profile: profileForGeneration(getProfile()),
        turnstileToken,
        atsSystem,
        onStep: setCurrentStep
      });
      setResult(out);
      setCurrentStep('done');
    } catch (e) {
      setError(e.message || String(e));
      setCurrentStep('idle');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRetailorAfterGap({ turnstileToken }) {
    const master = getMasterCV();
    if (!master?.text) {
      setError('No Master CV found in this browser. Save one before re-tailoring.');
      return;
    }
    await handleGenerate({
      jobDescription: lastInputs.jobDescription,
      cvText: master.text,
      companyName: lastInputs.companyName,
      turnstileToken
    });
  }

  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">CV Toolkit</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="px-2 py-1 rounded text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀︎' : '☾'}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="px-2 py-1 rounded text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Settings"
          >
            ⚙
          </button>
        </div>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 max-w-7xl mx-auto">
        <InputPanel
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          currentStep={currentStep}
          onFindRoles={
            isSupabaseConfigured()
              ? (currentJD) => {
                  setJobSearchSeedJD(currentJD || '');
                  setJobSearchOpen(true);
                }
              : null
          }
        />
        <OutputPanel
          result={result}
          error={error}
          companyName={lastInputs.companyName}
          jobDescription={lastInputs.jobDescription}
          onRetailor={handleRetailorAfterGap}
        />
      </main>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {jobSearchOpen && (
        <JobSearchPanel seedJDText={jobSearchSeedJD} onClose={() => setJobSearchOpen(false)} />
      )}
    </div>
  );
}
