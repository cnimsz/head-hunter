const PREFIX = 'cv-toolkit:';
const k = (name) => PREFIX + name;

export function saveMasterCV(text, filename) {
  localStorage.setItem(k('cv'), JSON.stringify({ text, filename }));
}
export function getMasterCV() {
  const raw = localStorage.getItem(k('cv'));
  return raw ? JSON.parse(raw) : null;
}
export function clearMasterCV() { localStorage.removeItem(k('cv')); }

export function saveTheme(theme) { localStorage.setItem(k('theme'), theme); }
export function getTheme() {
  const t = localStorage.getItem(k('theme'));
  if (t === 'light' || t === 'dark') return t;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
