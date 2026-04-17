const input = 'w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm';
const label = 'text-xs font-semibold uppercase tracking-wide text-slate-500';

export default function EditableCoverLetter({ data, onChange }) {
  function set(path, value) {
    const d = structuredClone(data);
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let cur = d;
    for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
    cur[keys[keys.length - 1]] = value;
    onChange(d);
  }

  function removeBullet(bi) {
    const d = structuredClone(data);
    d.bullets.splice(bi, 1);
    onChange(d);
  }

  function addBullet() {
    const d = structuredClone(data);
    d.bullets.push('');
    onChange(d);
  }

  const r = data.recipient || {};

  return (
    <div className="flex-1 overflow-auto space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className={label}>Sender Name</div>
          <input className={input} value={data.senderName || ''} onChange={(e) => set('senderName', e.target.value)} />
        </div>
        <div>
          <div className={label}>Sender Contact</div>
          <input className={input} value={data.senderContact || ''} onChange={(e) => set('senderContact', e.target.value)} />
        </div>
      </div>

      <div>
        <div className={label}>Date</div>
        <input className={input} value={data.date || ''} onChange={(e) => set('date', e.target.value)} />
      </div>

      <div>
        <div className={label}>Recipient</div>
        <div className="grid grid-cols-2 gap-2">
          <input className={input} placeholder="Name" value={r.name || ''} onChange={(e) => set('recipient.name', e.target.value)} />
          <input className={input} placeholder="Title" value={r.title || ''} onChange={(e) => set('recipient.title', e.target.value)} />
          <input className={input} placeholder="Company" value={r.company || ''} onChange={(e) => set('recipient.company', e.target.value)} />
          <input className={input} placeholder="Location" value={r.location || ''} onChange={(e) => set('recipient.location', e.target.value)} />
        </div>
      </div>

      <div>
        <div className={label}>Salutation</div>
        <input className={input} value={data.salutation || ''} onChange={(e) => set('salutation', e.target.value)} />
      </div>

      <div>
        <div className={label}>Opening Paragraph</div>
        <textarea className={input} rows={3} value={data.openingParagraph || ''} onChange={(e) => set('openingParagraph', e.target.value)} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <div className={label}>Bullets (3 required)</div>
          {(data.bullets || []).length < 3 && (
            <button onClick={addBullet} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">+ Add</button>
          )}
        </div>
        {(data.bullets || []).map((b, bi) => (
          <div key={bi} className="flex gap-1 mb-1">
            <span className="text-slate-400 text-sm mt-1 shrink-0">&bull;</span>
            <textarea className={`${input} flex-1`} rows={2} value={b} onChange={(e) => set(`bullets[${bi}]`, e.target.value)} />
            <button onClick={() => removeBullet(bi)} className="text-xs text-red-500 hover:underline shrink-0">x</button>
          </div>
        ))}
      </div>

      <div>
        <div className={label}>Closing Paragraph</div>
        <textarea className={input} rows={2} value={data.closingParagraph || ''} onChange={(e) => set('closingParagraph', e.target.value)} />
      </div>

      <div>
        <div className={label}>Signature Name</div>
        <input className={input} value={data.signatureName || ''} onChange={(e) => set('signatureName', e.target.value)} />
      </div>
    </div>
  );
}
