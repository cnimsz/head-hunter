import { getMasterCV, clearMasterCV } from '../lib/storage.js';

export default function SettingsModal({ onClose }) {
  const masterCV = getMasterCV();

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

        <div className="flex items-center justify-between">
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

        <div className="mt-6 flex items-center justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600">Close</button>
        </div>
      </div>
    </div>
  );
}
