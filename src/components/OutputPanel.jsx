import { useState, useEffect } from 'react';
import { generateCVDocx, generateCoverLetterDocx } from '../lib/docx.js';
import FeedbackModal from './FeedbackModal.jsx';
import EditableCV from './EditableCV.jsx';
import EditableCoverLetter from './EditableCoverLetter.jsx';

const TABS = [
  { id: 'cv', label: 'CV' },
  { id: 'coverLetter', label: 'Cover Letter' },
  { id: 'linkedIn', label: 'Research & Outreach' }
];

export default function OutputPanel({ result, error, companyName }) {
  const [tab, setTab] = useState('cv');
  const [copied, setCopied] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedCvData, setEditedCvData] = useState(null);
  const [editedClData, setEditedClData] = useState(null);

  useEffect(() => {
    setIsEditing(false);
    setEditedCvData(null);
    setEditedClData(null);
  }, [result]);

  const activeCvData = editedCvData || result?.cvData;
  const activeClData = editedClData || result?.clData;

  const displayText = result
    ? { cv: result.cv, coverLetter: result.coverLetter, linkedIn: result.linkedInMessage }[tab]
    : '';

  function handleEdit() {
    setIsEditing(true);
    if (tab === 'cv' && result?.cvData) setEditedCvData(structuredClone(result.cvData));
    if (tab === 'coverLetter' && result?.clData) setEditedClData(structuredClone(result.clData));
  }

  function handleCancel() {
    setIsEditing(false);
    if (tab === 'cv') setEditedCvData(null);
    if (tab === 'coverLetter') setEditedClData(null);
  }

  async function copy() {
    if (!result) return;
    const toCopy = tab === 'linkedIn' ? result.linkedInMessage || '' : displayText;
    if (!toCopy) return;
    await navigator.clipboard.writeText(toCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  async function download() {
    if (!result) return;
    const companyAndRole = companyName || '';
    if (tab === 'cv') {
      const data = activeCvData;
      const name = data?.name || firstLine(result.cv) || 'Candidate';
      await generateCVDocx(data, name, { companyAndRole });
    }
    if (tab === 'coverLetter') {
      const data = activeClData;
      const name = data?.senderName || data?.signatureName || firstLine(result.cv) || 'Candidate';
      await generateCoverLetterDocx(data, name, { companyAndRole });
    }
  }

  const canEdit = result && tab !== 'linkedIn' &&
    ((tab === 'cv' && result.cvData) || (tab === 'coverLetter' && result.clData));

  return (
    <div className="flex flex-col bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-lg p-4 min-h-[500px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setIsEditing(false); }}
              className={`px-3 py-1.5 text-sm rounded ${
                tab === t.id
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {result && (
          <div className="flex gap-2">
            {canEdit && (
              isEditing ? (
                <>
                  <button
                    onClick={handleCancel}
                    className="px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={download}
                    className="px-2.5 py-1 text-xs rounded bg-blue-600 text-white border border-blue-600"
                  >
                    Save & Download .docx
                  </button>
                </>
              ) : (
                <button
                  onClick={handleEdit}
                  className="px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-slate-600"
                >
                  Edit
                </button>
              )
            )}
            {!isEditing && (
              <>
                <button
                  onClick={copy}
                  disabled={!displayText}
                  className="px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 disabled:opacity-50"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
                {tab !== 'linkedIn' && (
                  <button
                    onClick={download}
                    className="px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-slate-600"
                  >
                    Download .docx
                  </button>
                )}
                <button
                  onClick={() => setFeedbackOpen(true)}
                  className="px-2.5 py-1 text-xs rounded border border-emerald-400 text-emerald-700 dark:text-emerald-300"
                  title="Upload your edited versions to teach the skills your style"
                >
                  Refine from edits
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {result?.hiringManager && (
        <div className="text-xs mb-2 inline-flex items-center gap-1 text-slate-500">
          <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200">
            Addressed to: {result.hiringManager}
          </span>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded p-3 mb-2">
          {error}
        </div>
      )}

      {tab === 'linkedIn' && result ? (
        <LinkedInView result={result} />
      ) : isEditing && tab === 'cv' && editedCvData ? (
        <EditableCV data={editedCvData} onChange={setEditedCvData} />
      ) : isEditing && tab === 'coverLetter' && editedClData ? (
        <EditableCoverLetter data={editedClData} onChange={setEditedClData} />
      ) : tab === 'cv' && result?.cvData ? (
        <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-3 overflow-auto">
          <CVDisplay data={result.cvData} />
        </div>
      ) : tab === 'coverLetter' && result?.clData ? (
        <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-3 overflow-auto">
          <CoverLetterDisplay data={result.clData} />
        </div>
      ) : (
        <div className="flex-1 whitespace-pre-wrap font-mono text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-3 overflow-auto">
          {displayText || <span className="text-slate-400 font-sans">Output will appear here after you click Generate.</span>}
        </div>
      )}

      {feedbackOpen && result && (
        <FeedbackModal result={result} onClose={() => setFeedbackOpen(false)} />
      )}
    </div>
  );
}

function CVDisplay({ data }) {
  if (!data) return null;
  return (
    <div className="space-y-3 font-sans text-sm">
      <h1 className="text-lg font-bold">{data.name}</h1>
      <p className="text-xs text-slate-500 dark:text-slate-400">{data.contact}</p>
      {data.summary && <p className="text-slate-700 dark:text-slate-300">{data.summary}</p>}

      {data.experience?.length > 0 && (
        <>
          <h2 className="font-bold text-xs uppercase tracking-wide border-b border-slate-300 dark:border-slate-600 pb-1 mt-4">Experience</h2>
          {data.experience.map((role, i) => (
            <div key={i} className="mb-3">
              <p className="font-bold">{role.company}</p>
              <p className="text-slate-600 dark:text-slate-400">{role.titleLine}</p>
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                {(role.bullets || []).map((b, j) => <li key={j}>{b}</li>)}
              </ul>
            </div>
          ))}
        </>
      )}

      {data.education?.length > 0 && (
        <>
          <h2 className="font-bold text-xs uppercase tracking-wide border-b border-slate-300 dark:border-slate-600 pb-1 mt-4">Education</h2>
          {data.education.map((e, i) => <p key={i}>{e}</p>)}
        </>
      )}

      {data.skills?.length > 0 && (
        <>
          <h2 className="font-bold text-xs uppercase tracking-wide border-b border-slate-300 dark:border-slate-600 pb-1 mt-4">Skills</h2>
          {data.skills.map((s, i) => <p key={i}>{s}</p>)}
        </>
      )}
    </div>
  );
}

function CoverLetterDisplay({ data }) {
  if (!data) return null;
  const r = data.recipient || {};
  return (
    <div className="space-y-4 font-sans text-sm">
      <div>
        <p className="font-bold">{data.senderName}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{data.senderContact}</p>
      </div>

      <p>{data.date}</p>

      <div>
        {r.name && <p>{r.name}</p>}
        {r.title && <p>{r.title}</p>}
        {r.company && <p>{r.company}</p>}
        {r.location && <p>{r.location}</p>}
      </div>

      <p>{data.salutation}</p>

      <p className="whitespace-pre-wrap">{data.openingParagraph}</p>

      <ul className="list-disc pl-5 space-y-2">
        {(data.bullets || []).map((b, i) => <li key={i}>{b}</li>)}
      </ul>

      <p className="whitespace-pre-wrap">{data.closingParagraph}</p>

      <div className="pt-2">
        <p>Best regards,</p>
        <p className="font-bold pt-4">{data.signatureName}</p>
      </div>
    </div>
  );
}

function firstLine(s) {
  return (s || '').split(/\r?\n/)[0]?.trim() || '';
}

function LinkedInView({ result }) {
  const msg = result.linkedInMessage || '';
  const charCount = result.linkedInCharCount ?? msg.length;
  const hm = result.hiringManagerDetails;
  const overLimit = charCount > 300;

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-auto">
      <Section title="LinkedIn Message">
        <div className="whitespace-pre-wrap font-mono text-sm">
          {msg || <span className="text-slate-400 font-sans">No message generated.</span>}
        </div>
        {msg && (
          <div className={`mt-2 text-xs ${overLimit ? 'text-red-600' : 'text-slate-500'}`}>
            {charCount} / 300 characters{overLimit ? ' — over limit' : ''}
          </div>
        )}
      </Section>

      <Section title="Hiring Manager">
        {hm ? (
          <dl className="text-sm grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
            {hm.name && (<><dt className="text-slate-500">Name</dt><dd>{hm.name}</dd></>)}
            {hm.title && (<><dt className="text-slate-500">Title</dt><dd>{hm.title}</dd></>)}
            {hm.confidence && (<><dt className="text-slate-500">Confidence</dt><dd>{hm.confidence}</dd></>)}
            {hm.rationale && (<><dt className="text-slate-500">Rationale</dt><dd>{hm.rationale}</dd></>)}
          </dl>
        ) : (
          <div className="text-sm text-slate-400">Not identified.</div>
        )}
      </Section>

      <Section title="Company Brief">
        <div className="whitespace-pre-wrap text-sm">
          {result.companyBrief || <span className="text-slate-400">No brief generated.</span>}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{title}</div>
      {children}
    </div>
  );
}
