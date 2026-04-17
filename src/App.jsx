import { useEffect, useState } from 'react';
import InputPanel from './components/InputPanel.jsx';
import OutputPanel from './components/OutputPanel.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import { getTheme, saveTheme, getApiKey } from './lib/storage.js';
import { generateApplication } from './lib/claude.js';

export default function App() {
  const [theme, setTheme] = useState(getTheme());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState('idle');
  const [lastInputs, setLastInputs] = useState({ companyName: '', jobDescription: '' });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    saveTheme(theme);
  }, [theme]);

  async function handleGenerate({ jobDescription, cvText, companyName }) {
    const apiKey = getApiKey();
    if (!apiKey) {
      setSettingsOpen(true);
      setError('Add your Anthropic API key in Settings first.');
      return;
    }
    setError(null);
    setResult(null);
    setIsGenerating(true);
    setLastInputs({ companyName: companyName || '', jobDescription: jobDescription || '' });
    try {
      const out = await generateApplication({
        apiKey,
        jobDescription,
        cvText,
        companyName,
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
        />
        <OutputPanel
          result={result}
          error={error}
          companyName={lastInputs.companyName}
          jobDescription={lastInputs.jobDescription}
        />
      </main>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
