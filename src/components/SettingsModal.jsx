import { useState } from 'react';
import { getMasterCV, clearMasterCV } from '../lib/storage.js';
import { getProfile, saveProfile, clearProfile } from '../lib/profile.js';
import { clearLearnings, getLearnings } from '../lib/learnings.js';

const inputCls = 'w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm';

export default function SettingsModal({ onClose }) {
  const [masterCV, setMasterCV] = useState(() => getMasterCV());
  const [profile, setProfile] = useState(() => getProfile() || { name: '', email: '', phone: '', location: '', linkedin: '' });
  const [savedMsg, setSavedMsg] = useState('');

  const cvRules = getLearnings('cv').length;
  const clRules = getLearnings('coverLetter').length;
  const liRules = getLearnings('linkedIn').length;

  function updateField(key, value) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  function handleSaveProfile() {
    saveProfile(profile);
    setSavedMsg('Saved');
    setTimeout(() => setSavedMsg(''), 1500);
  }

  function handleClearProfile() {
    clearProfile();
    setProfile({ name: '', email: '', phone: '', location: '', linkedin: '' });
  }

  function handleClearCV() {
    clearMasterCV();
    setMasterCV(null);
  }

  function handleClearLearnings() {
    clearLearnings('cv');
    clearLearnings('coverLetter');
    clearLearnings('linkedIn');
    setSavedMsg('Learnings cleared');
    setTimeout(() => setSavedMsg(''), 1500);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">✕</button>
        </div>

        <section className="mb-5">
          <h3 className="text-sm font-semibold mb-2">Your Identity</h3>
          <p className="text-xs text-slate-500 mb-3">
            Auto-filled from your uploaded CVs. These appear on every cover letter you generate — edit
            anything that looks wrong. Stored only in this browser.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="text-xs text-slate-500">Name</label>
              <input className={inputCls} value={profile.name || ''} onChange={(e) => updateField('name', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500">Email</label>
              <input className={inputCls} value={profile.email || ''} onChange={(e) => updateField('email', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500">Phone</label>
              <input className={inputCls} value={profile.phone || ''} onChange={(e) => updateField('phone', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500">Location</label>
              <input className={inputCls} value={profile.location || ''} onChange={(e) => updateField('location', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500">LinkedIn</label>
              <input className={inputCls} value={profile.linkedin || ''} onChange={(e) => updateField('linkedin', e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleSaveProfile}
              className="px-3 py-1.5 text-xs rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            >
              Save
            </button>
            <button
              onClick={handleClearProfile}
              className="px-3 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-600"
            >
              Clear
            </button>
            {savedMsg && <span className="text-xs text-emerald-600">{savedMsg}</span>}
          </div>
        </section>

        <section className="mb-5">
          <h3 className="text-sm font-semibold mb-2">Saved CV</h3>
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
                onClick={handleClearCV}
                className="text-xs text-red-600 hover:underline"
              >
                Clear saved CV
              </button>
            )}
          </div>
        </section>

        <section className="mb-5">
          <h3 className="text-sm font-semibold mb-2">Learned preferences</h3>
          <p className="text-xs text-slate-500 mb-2">
            Rules learned from your past edits. Applied only in this browser.
          </p>
          <div className="text-xs text-slate-600 dark:text-slate-300 mb-2">
            CV: {cvRules} · Cover letter: {clRules} · LinkedIn: {liRules}
          </div>
          {(cvRules + clRules + liRules > 0) && (
            <button
              onClick={handleClearLearnings}
              className="text-xs text-red-600 hover:underline"
            >
              Clear all learned rules
            </button>
          )}
        </section>

        <p className="text-[11px] text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-3">
          Everything above — your CV, identity, and learned preferences — lives only in this browser
          (localStorage). It is not sent to any server except as part of an active generation request.
        </p>

        <div className="mt-4 flex items-center justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600">Close</button>
        </div>
      </div>
    </div>
  );
}
