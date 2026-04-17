const PREFIX = 'cv-toolkit:learnings:';
const MAX_RULES = 40;

const VALID = new Set(['cv', 'coverLetter', 'linkedIn']);

function key(skill) {
  if (!VALID.has(skill)) throw new Error(`Unknown skill: ${skill}`);
  return PREFIX + skill;
}

export function getLearnings(skill) {
  const raw = localStorage.getItem(key(skill));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLearnings(skill, rules) {
  localStorage.setItem(key(skill), JSON.stringify(rules.slice(-MAX_RULES)));
}

export function appendLearnings(skill, newRules) {
  const existing = getLearnings(skill);
  const merged = [...existing];
  for (const r of newRules) {
    const rule = (r || '').trim();
    if (!rule) continue;
    if (!merged.some((e) => e.toLowerCase() === rule.toLowerCase())) merged.push(rule);
  }
  saveLearnings(skill, merged);
  return merged;
}

export function clearLearnings(skill) {
  localStorage.removeItem(key(skill));
}

export function formatLearningsBlock(skill) {
  const rules = getLearnings(skill);
  if (rules.length === 0) return '';
  const lines = rules.map((r, i) => `${i + 1}. ${r}`).join('\n');
  return `\n\n## Learned Preferences (from prior user edits — follow these strictly)\n${lines}\n`;
}
