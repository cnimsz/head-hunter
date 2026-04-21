const KEY = 'cv-toolkit:profile';

const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/in\/[\w-]+\/?/i;
const PHONE_RE = /(?:\+\d{1,3}[\s.\-]?)?(?:\(\d{1,4}\)[\s.\-]?)?\d{2,4}[\s.\-]?\d{2,4}[\s.\-]?\d{2,5}/;

export function getProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile) {
  const clean = {
    name: profile?.name || '',
    email: profile?.email || '',
    phone: profile?.phone || '',
    location: profile?.location || '',
    linkedin: profile?.linkedin || '',
    updatedAt: new Date().toISOString()
  };
  localStorage.setItem(KEY, JSON.stringify(clean));
  return clean;
}

export function clearProfile() {
  localStorage.removeItem(KEY);
}

function looksLikeName(line) {
  if (!line) return false;
  if (/\d/.test(line)) return false;
  if (/@/.test(line)) return false;
  if (line.length > 60) return false;
  const words = line.trim().split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  return words.every((w) => /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ''.\-]+$/.test(w));
}

function stripContactTokens(contactLine, { email, phone, linkedin }) {
  let remaining = contactLine;
  for (const token of [email, phone, linkedin].filter(Boolean)) {
    remaining = remaining.replace(token, '');
  }
  return remaining
    .split(/[|•·,;]/)
    .map((s) => s.trim())
    .filter((s) => s && !/^[-—–]+$/.test(s))
    .join(', ');
}

export function extractProfileFromText(text) {
  if (!text || typeof text !== 'string') return {};

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 25);

  if (lines.length === 0) return {};

  const contactLineIndex = lines.findIndex((l) => EMAIL_RE.test(l));
  const contactLine = contactLineIndex >= 0 ? lines[contactLineIndex] : '';

  const email = (contactLine.match(EMAIL_RE) || text.match(EMAIL_RE) || [''])[0];
  const linkedinRaw = (contactLine.match(LINKEDIN_RE) || text.match(LINKEDIN_RE) || [''])[0];
  const linkedin = linkedinRaw
    ? linkedinRaw.replace(/^https?:\/\//i, '').replace(/\/$/, '')
    : '';

  // Run phone regex but avoid matching the email, linkedin, or dates.
  let phone = '';
  const phoneSearchScope = contactLine || text.slice(0, 400);
  const phoneCandidates = phoneSearchScope.matchAll(new RegExp(PHONE_RE.source, 'g'));
  for (const m of phoneCandidates) {
    const token = m[0].trim();
    if (!token) continue;
    if (email && email.includes(token)) continue;
    if (linkedin && linkedin.includes(token)) continue;
    const digits = token.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) continue;
    phone = token;
    break;
  }

  let name = '';
  if (contactLineIndex > 0) {
    for (let i = contactLineIndex - 1; i >= 0; i--) {
      if (looksLikeName(lines[i])) {
        name = lines[i];
        break;
      }
    }
  }
  if (!name) {
    for (const l of lines.slice(0, 5)) {
      if (looksLikeName(l)) {
        name = l;
        break;
      }
    }
  }

  const location = contactLine
    ? stripContactTokens(contactLine, { email, phone, linkedin })
    : '';

  const out = {};
  if (name) out.name = name;
  if (email) out.email = email;
  if (phone) out.phone = phone;
  if (location) out.location = location;
  if (linkedin) out.linkedin = linkedin;
  return out;
}

export function mergeProfile(current, incoming) {
  const base = current || {};
  const merged = { ...base };
  for (const k of ['name', 'email', 'phone', 'location', 'linkedin']) {
    if (incoming?.[k]) merged[k] = incoming[k];
  }
  return merged;
}

export function updateProfileFromText(text) {
  const extracted = extractProfileFromText(text);
  if (Object.keys(extracted).length === 0) return getProfile();
  const merged = mergeProfile(getProfile(), extracted);
  return saveProfile(merged);
}

export function getContactLine(profile) {
  if (!profile) return '';
  const parts = [profile.location, profile.phone, profile.email, profile.linkedin]
    .map((p) => (p || '').trim())
    .filter(Boolean);
  return parts.join(' | ');
}

export function profileForGeneration(profile) {
  if (!profile) return null;
  return {
    name: profile.name || '',
    contactLine: getContactLine(profile)
  };
}
