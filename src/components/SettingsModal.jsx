import { useState } from 'react';
import { getApiKey, saveApiKey, clearApiKey, getMasterCV, clearMasterCV } from '../lib/storage.js';

export default function SettingsModal({ onClose }) {
  const [apiKey, setApiKey] = useState(getApiKey() || '');
  const [saved, setSaved] = useState(false);
  const masterCV = getMasterCV();

  function handleSave() {
    if (apiKey.trim()) saveApiKey(apiKey.trim());
    else clearApiKey();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">✕</button>
        </div>

        <label className="block text-sm font-medium mb-1">Anthropic API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-..."
          className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
        />
        <p className="text-xs text-slate-500 mt-1">
          Stored in this browser only (localStorage). Never sent anywhere except api.anthropic.com.
        </p>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm">
            {masterCV ? (
              <>Saved CV: <span className="font-medium">{masterCV.filename}</span></>
            ) : (
              <span className="text-slate-500">No saved CV.</span>
            )}
          </div>
          {masterCV && (
            <button
              onClick={() => { clearMasterCV(); onClose(); }}
              className="text-xs text-red-600 hover:underline"
            >
              Clear saved CV
            </button>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          {saved && <span className="text-xs text-emerald-600 mr-2">Saved</span>}
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600">Close</button>
          <button onClick={handleSave} className="px-3 py-1.5 text-sm rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">Save</button>
        </div>
      </div>
    </div>
  );
}
