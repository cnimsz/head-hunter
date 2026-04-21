import { useState } from 'react';
import { compileMasterCV, extractCVsFromZip, MAX_CVS } from '../lib/compileMasterCV.js';
import { saveMasterCV } from '../lib/storage.js';
import { updateProfileFromText } from '../lib/profile.js';

export default function MasterCVCompiler({ onClose, onCompiled }) {
  const [zipFile, setZipFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function handleCompile() {
    setError(null);
    if (!zipFile) {
      setError('Choose a .zip file first.');
      return;
    }
    try {
      setStatus('extracting');
      const cvs = await extractCVsFromZip(zipFile, setProgress);
      setStatus('compiling');
      setProgress({ filename: `Synthesising master CV from ${cvs.length} CV(s)…` });
      const masterText = await compileMasterCV({ cvs });
      const filename = `Master CV (${cvs.length} sources).md`;
      saveMasterCV(masterText, filename);
      // Feed every source CV into the profile so we capture identity even
      // if the synthesised master drops a field (e.g. phone). Master runs
      // last so its values win on ties.
      for (const cv of cvs) updateProfileFromText(cv.text);
      updateProfileFromText(masterText);
      setResult({ text: masterText, count: cvs.length, filename });
      setStatus('done');
      onCompiled?.();
    } catch (e) {
      setError(e.message || String(e));
      setStatus('idle');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 border border-slate-200 dark:border-slate-800">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold">Compile a Master CV</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {status !== 'done' && (
          <>
            <ol className="text-sm text-slate-600 dark:text-slate-300 list-decimal list-inside space-y-1 mb-4">
              <li>Gather any number of your CVs (up to {MAX_CVS}) in PDF, DOCX, TXT or MD format.</li>
              <li>Put them all into a single folder and compress that folder into a <strong>.zip</strong> file.</li>
              <li>Upload the .zip below. We'll unzip, review every CV, and synthesise one comprehensive Master CV.</li>
            </ol>

            <input
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              onChange={(e) => {
                setZipFile(e.target.files?.[0] || null);
                setError(null);
              }}
              disabled={status !== 'idle'}
              className="text-sm mb-3 block"
            />

            {zipFile && (
              <p className="text-xs text-slate-500 mb-3">
                Selected: {zipFile.name} ({(zipFile.size / 1024).toFixed(1)} KB)
              </p>
            )}

            {status === 'extracting' && progress && (
              <p className="text-xs text-slate-500 mb-2">
                Extracting {progress.current}/{progress.total}: {progress.filename}
              </p>
            )}
            {status === 'compiling' && progress && (
              <p className="text-xs text-slate-500 mb-2">{progress.filename}</p>
            )}

            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={handleCompile}
                disabled={!zipFile || status !== 'idle'}
                className="px-4 py-2 rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'extracting' && 'Extracting…'}
                {status === 'compiling' && 'Compiling…'}
                {status === 'idle' && 'Compile Master CV'}
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

        {status === 'done' && result && (
          <>
            <p className="text-sm text-emerald-600 mb-3">
              Master CV compiled from {result.count} source CV(s) and saved. It is now selected as your saved CV.
            </p>
            <textarea
              readOnly
              value={result.text}
              className="w-full h-80 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => navigator.clipboard.writeText(result.text)}
                className="px-4 py-2 rounded border border-slate-300 dark:border-slate-700 text-sm"
              >
                Copy
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm font-medium"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
