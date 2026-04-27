const input = 'w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm';
const label = 'text-xs font-semibold uppercase tracking-wide text-slate-500';

export default function EditableCV({ data, onChange }) {
  function set(path, value) {
    const d = structuredClone(data);
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let cur = d;
    for (let i = 0; i < keys.length - 1; i++) {
      if (cur[keys[i]] === undefined || cur[keys[i]] === null) {
        cur[keys[i]] = isNaN(Number(keys[i + 1])) ? {} : [];
      }
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
    onChange(d);
  }

  function removeBullet(ri, bi) {
    const d = structuredClone(data);
    d.experience[ri].bullets.splice(bi, 1);
    onChange(d);
  }

  function addBullet(ri) {
    const d = structuredClone(data);
    d.experience[ri].bullets.push('');
    onChange(d);
  }

  function removeRole(ri) {
    const d = structuredClone(data);
    d.experience.splice(ri, 1);
    onChange(d);
  }

  function addRole() {
    const d = structuredClone(data);
    if (!d.experience) d.experience = [];
    d.experience.push({ company: '', title: '', location: '', startDate: '', endDate: '', titleLine: '', bullets: [''] });
    onChange(d);
  }

  function removeSkill(si) {
    const d = structuredClone(data);
    d.skills.splice(si, 1);
    onChange(d);
  }

  function addSkill() {
    const d = structuredClone(data);
    if (!d.skills) d.skills = [];
    d.skills.push('');
    onChange(d);
  }

  function removeEdu(ei) {
    const d = structuredClone(data);
    d.education.splice(ei, 1);
    onChange(d);
  }

  function addEdu() {
    const d = structuredClone(data);
    if (!d.education) d.education = [];
    d.education.push('');
    onChange(d);
  }

  function listAdd(field) {
    const d = structuredClone(data);
    if (!d[field]) d[field] = [];
    d[field].push('');
    onChange(d);
  }

  function listRemove(field, i) {
    const d = structuredClone(data);
    d[field].splice(i, 1);
    onChange(d);
  }

  function achievementAdd() {
    const d = structuredClone(data);
    if (!d.startupAchievements) d.startupAchievements = [];
    d.startupAchievements.push({ title: '', body: '' });
    onChange(d);
  }

  function achievementRemove(i) {
    const d = structuredClone(data);
    d.startupAchievements.splice(i, 1);
    onChange(d);
  }

  return (
    <div className="flex-1 overflow-auto space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-3">
      <div>
        <div className={label}>Name</div>
        <input className={`${input} font-bold text-base`} value={data.name || ''} onChange={(e) => set('name', e.target.value)} />
      </div>

      <div>
        <div className={label}>Professional Title (subline)</div>
        <input className={input} placeholder="e.g. Chief Operating Officer · Chief Strategy Officer" value={data.title || ''} onChange={(e) => set('title', e.target.value)} />
      </div>

      <div>
        <div className={label}>Contact</div>
        <input className={input} value={data.contact || ''} onChange={(e) => set('contact', e.target.value)} />
      </div>

      <div>
        <div className={label}>Professional Summary</div>
        <textarea className={input} rows={3} value={data.summary || ''} onChange={(e) => set('summary', e.target.value)} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <div className={label}>Experience</div>
          <button onClick={addRole} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">+ Add role</button>
        </div>
        {(data.experience || []).map((role, ri) => (
          <div key={ri} className="border border-slate-200 dark:border-slate-700 rounded p-2 mb-2">
            <div className="flex gap-2 mb-1">
              <input className={`${input} flex-1 font-semibold`} placeholder="Company" value={role.company || ''} onChange={(e) => set(`experience[${ri}].company`, e.target.value)} />
              <button onClick={() => removeRole(ri)} className="text-xs text-red-500 hover:underline shrink-0">Remove</button>
            </div>
            <input className={`${input} mb-1`} placeholder="Title (e.g. COO — AI for Enterprise)" value={role.title || ''} onChange={(e) => set(`experience[${ri}].title`, e.target.value)} />
            <div className="flex gap-1 mb-1">
              <input className={`${input} flex-1`} placeholder="Location" value={role.location || ''} onChange={(e) => set(`experience[${ri}].location`, e.target.value)} />
              <input className={`${input} w-32`} placeholder="Start (Jan 2024)" value={role.startDate || ''} onChange={(e) => set(`experience[${ri}].startDate`, e.target.value)} />
              <input className={`${input} w-32`} placeholder="End (Present)" value={role.endDate || ''} onChange={(e) => set(`experience[${ri}].endDate`, e.target.value)} />
            </div>
            <input className={`${input} mb-1 text-xs text-slate-500`} placeholder="titleLine (legacy fallback)" value={role.titleLine || ''} onChange={(e) => set(`experience[${ri}].titleLine`, e.target.value)} />
            {(role.bullets || []).map((b, bi) => (
              <div key={bi} className="flex gap-1 mb-1">
                <span className="text-slate-400 text-sm mt-1 shrink-0">&bull;</span>
                <input className={`${input} flex-1`} value={b} onChange={(e) => set(`experience[${ri}].bullets[${bi}]`, e.target.value)} />
                <button onClick={() => removeBullet(ri, bi)} className="text-xs text-red-500 hover:underline shrink-0">x</button>
              </div>
            ))}
            <button onClick={() => addBullet(ri)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">+ Add bullet</button>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <div className={label}>Education</div>
          <button onClick={addEdu} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">+ Add</button>
        </div>
        {(data.education || []).map((e, ei) => (
          <div key={ei} className="flex gap-1 mb-1">
            <input className={`${input} flex-1`} value={e} onChange={(ev) => set(`education[${ei}]`, ev.target.value)} />
            <button onClick={() => removeEdu(ei)} className="text-xs text-red-500 hover:underline shrink-0">x</button>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <div className={label}>Skills</div>
          <button onClick={addSkill} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">+ Add</button>
        </div>
        {(data.skills || []).map((s, si) => (
          <div key={si} className="flex gap-1 mb-1">
            <input className={`${input} flex-1`} value={s} onChange={(e) => set(`skills[${si}]`, e.target.value)} />
            <button onClick={() => removeSkill(si)} className="text-xs text-red-500 hover:underline shrink-0">x</button>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <div className={label}>Certifications</div>
          <button onClick={() => listAdd('certifications')} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">+ Add</button>
        </div>
        {(data.certifications || []).map((c, i) => (
          <div key={i} className="flex gap-1 mb-1">
            <input className={`${input} flex-1`} value={c} onChange={(e) => set(`certifications[${i}]`, e.target.value)} />
            <button onClick={() => listRemove('certifications', i)} className="text-xs text-red-500 hover:underline shrink-0">x</button>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <div className={label}>Public Speaking and Lobbying</div>
          <button onClick={() => listAdd('publicSpeaking')} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">+ Add</button>
        </div>
        {(data.publicSpeaking || []).map((p, i) => (
          <div key={i} className="flex gap-1 mb-1">
            <input className={`${input} flex-1`} value={p} onChange={(e) => set(`publicSpeaking[${i}]`, e.target.value)} />
            <button onClick={() => listRemove('publicSpeaking', i)} className="text-xs text-red-500 hover:underline shrink-0">x</button>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <div className={label}>Startup Achievements</div>
          <button onClick={achievementAdd} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">+ Add</button>
        </div>
        {(data.startupAchievements || []).map((a, i) => (
          <div key={i} className="border border-slate-200 dark:border-slate-700 rounded p-2 mb-2">
            <div className="flex gap-2 mb-1">
              <input className={`${input} flex-1 font-semibold`} placeholder="Headline" value={a.title || ''} onChange={(e) => set(`startupAchievements[${i}].title`, e.target.value)} />
              <button onClick={() => achievementRemove(i)} className="text-xs text-red-500 hover:underline shrink-0">Remove</button>
            </div>
            <textarea className={input} rows={2} placeholder="Body" value={a.body || ''} onChange={(e) => set(`startupAchievements[${i}].body`, e.target.value)} />
          </div>
        ))}
      </div>
    </div>
  );
}
