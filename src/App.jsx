import { useEffect, useState } from 'react';
import InputPanel from './components/InputPanel.jsx';
import OutputPanel from './components/OutputPanel.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import JobSearchPanel from './components/JobSearchPanel.jsx';
import WaitlistPanel from './components/WaitlistPanel.jsx';
import CapacityIndicator from './components/CapacityIndicator.jsx';
import { getTheme, saveTheme, getMasterCV } from './lib/storage.js';
import { generateApplication } from './lib/claude.js';
import { getProfile, profileForGeneration } from './lib/profile.js';
import { getSupabaseClient, isSupabaseConfigured } from './lib/supabase.js';
import { fetchCapacityBand, setEmptyFromProxy } from './lib/capacity.js';

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
  // Three-value capacity state (per capacity-indicator-banner-spec.md):
  //   undefined  = initial load, RPC in flight (banner shows nothing)
  //   null       = RPC failed or returned null (banner shows 'unknown')
  //   { band, runwayBucket } = success
  // Do NOT collapse null and undefined — the banner would flash unknown
  // copy on every page load.
  const [capacity, setCapacity] = useState(undefined);

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

  // Initial capacity poll. Distinguish RPC failure (null → unknown) from
  // in-flight (undefined → loading). Do not swallow nulls.
  useEffect(() => {
    fetchCapacityBand().then((c) => setCapacity(c ?? null));
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
      // Balance just dropped; re-poll so the indicator reflects post-call state.
      fetchCapacityBand().then((c) => setCapacity(c ?? null));
    } catch (e) {
      const msg = e.message || String(e);
      // Proxy returned 503 NO_CAPACITY between polls. Skip the waitlist
      // wait — flip UI immediately.
      if (msg === 'NO_CAPACITY') {
        setCapacity(setEmptyFromProxy());
        setError(null);
      } else {
        setError(msg);
      }
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
      <CapacityIndicator capacity={capacity} />
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

      {capacity?.band === 'empty' ? (
        <main className="p-4 max-w-7xl mx-auto">
          <WaitlistPanel />
        </main>
      ) : (
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
      )}

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {jobSearchOpen && (
        <JobSearchPanel seedJDText={jobSearchSeedJD} onClose={() => setJobSearchOpen(false)} />
      )}
    </div>
  );
}
