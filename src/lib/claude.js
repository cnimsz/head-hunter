import { buildCVPrompt } from '../prompts/cv-writer.js';
import { buildJobResearchPrompt } from '../prompts/job-research.js';
import { buildCoverLetterPrompt } from '../prompts/cover-letter.js';
import { formatLearningsBlock } from './learnings.js';

export const MODEL = 'claude-sonnet-4-6';
export const MAX_TOKENS = 8000;
export const EDGE_FN_URL = 'https://kntzxuzplmuccqvpntql.supabase.co/functions/v1/head-hunter-claude';
export const APP_TOKEN = import.meta.env?.VITE_HH_APP_TOKEN || '';

async function callClaude({ prompt, masterCV }) {
  const payload = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }]
  };
  if (masterCV) payload.masterCV = masterCV;

  let res;
  try {
    res = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hh-token': APP_TOKEN
      },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    throw new Error(`Network error calling Claude: ${e.message}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401) throw new Error('App token rejected by server. Check your deployment config.');
    if (res.status === 429) throw new Error('Rate limit reached. Wait a minute and retry.');
    if (res.status === 413) throw new Error('Your CV or job description is too long. Trim and retry.');
    throw new Error(`Claude API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error('Malformed response from Claude (no text content).');
  return text;
}

function sanitizeDashes(value) {
  if (typeof value === 'string') return value.replace(/[—–]/g, '-');
  if (Array.isArray(value)) return value.map(sanitizeDashes);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeDashes(v);
    return out;
  }
  return value;
}

function extractJson(text) {
  // Strip markdown fences
  let clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // Extract the outermost JSON object
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in Claude response.');
  }
  let candidate = clean.slice(start, end + 1);

  // First try parsing as-is (handles pipe chars inside string values correctly)
  try {
    return JSON.parse(candidate);
  } catch (e1) {
    // Fix common issues: unescaped control chars, trailing commas
    try {
      // Remove trailing commas before } or ]
      candidate = candidate.replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(candidate);
    } catch (e2) {
      console.error('JSON parse error:', e2.message);
      console.error('Raw text (first 500 chars):', text.slice(0, 500));
      throw new Error('Failed to parse JSON from Claude response.');
    }
  }
}

function clDataToText(d) {
  const lines = [];
  lines.push(d.senderName || '', d.senderContact || '', '');
  lines.push(d.date || '', '');
  const r = d.recipient || {};
  if (r.name) lines.push(r.name);
  if (r.title) lines.push(r.title);
  if (r.company) lines.push(r.company);
  if (r.location) lines.push(r.location);
  lines.push('');
  lines.push(d.salutation || '', '');
  lines.push(d.openingParagraph || '', '');
  for (const b of d.bullets || []) lines.push(`• ${b}`);
  lines.push('');
  lines.push(d.closingParagraph || '', '');
  lines.push('Best regards,', '');
  lines.push(d.signatureName || '');
  return lines.join('\n').trim();
}

function roleSublineText(role) {
  if (!role) return '';
  const dates = role.startDate && role.endDate
    ? `${role.startDate} - ${role.endDate}`
    : (role.startDate || role.endDate || '');
  const parts = [role.title, role.location, dates].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  return role.titleLine || '';
}

function cvDataToText(d) {
  const lines = [];
  lines.push(d.name);
  if (d.title) lines.push(d.title);
  lines.push(d.contact, '');
  if (d.summary) lines.push(d.summary, '');
  lines.push('EXPERIENCE', '');
  for (const role of d.experience || []) {
    lines.push(role.company, roleSublineText(role));
    for (const b of role.bullets || []) lines.push(`• ${b}`);
    lines.push('');
  }
  if (d.education?.length) {
    lines.push('EDUCATION');
    for (const e of d.education) lines.push(e);
    lines.push('');
  }
  if (d.skills?.length) {
    lines.push('SKILLS');
    for (const s of d.skills) lines.push(s);
    lines.push('');
  }
  if (d.certifications?.length) {
    lines.push('CERTIFICATIONS');
    for (const c of d.certifications) lines.push(`• ${c}`);
    lines.push('');
  }
  if (d.publicSpeaking?.length) {
    lines.push('PUBLIC SPEAKING AND LOBBYING');
    for (const p of d.publicSpeaking) lines.push(`• ${p}`);
    lines.push('');
  }
  if (d.startupAchievements?.length) {
    lines.push('STARTUP ACHIEVEMENTS');
    for (const a of d.startupAchievements) {
      lines.push(a.title || '');
      if (a.body) lines.push(a.body);
    }
  }
  return lines.join('\n').trim();
}

export async function generateApplication({
  jobDescription,
  cvText,
  companyName,
  profile = null,
  onStep = () => {}
}) {
  onStep('cv');
  const cvRaw = await callClaude({
    prompt: buildCVPrompt({ jobDescription, masterCV: cvText, learnings: formatLearningsBlock('cv') }),
    masterCV: cvText
  });
  const cvData = sanitizeDashes(extractJson(cvRaw));
  const cv = cvDataToText(cvData);

  onStep('research');
  const researchRaw = await callClaude({
    prompt: buildJobResearchPrompt({
      jobDescription,
      companyName,
      cvHighlights: cv.slice(0, 2000),
      learnings: formatLearningsBlock('linkedIn')
    }),
    masterCV: cvText
  });
  const research = sanitizeDashes(extractJson(researchRaw));
  const hiringManagerName =
    research.hiringManager && typeof research.hiringManager === 'object'
      ? research.hiringManager.name || null
      : research.hiringManager || null;

  onStep('coverLetter');
  const clRaw = await callClaude({
    prompt: buildCoverLetterPrompt({
      jobDescription,
      tailoredCV: cv,
      hiringManager: hiringManagerName,
      companyBrief: research.companyBrief,
      senderName: profile?.name || cvData?.name || '',
      senderContact: profile?.contactLine || cvData?.contact || '',
      learnings: formatLearningsBlock('coverLetter')
    }),
    masterCV: cvText
  });
  const clData = sanitizeDashes(extractJson(clRaw));
  const coverLetter = clDataToText(clData);

  const hiringManagerDetails =
    research.hiringManager && typeof research.hiringManager === 'object'
      ? research.hiringManager
      : hiringManagerName
        ? { name: hiringManagerName }
        : null;

  return {
    cv,
    cvData,
    coverLetter,
    clData,
    linkedInMessage: research.linkedInMessage || '',
    linkedInCharCount: research.linkedInCharCount ?? (research.linkedInMessage?.length || 0),
    hiringManager: hiringManagerName,
    hiringManagerDetails,
    companyBrief: research.companyBrief || ''
  };
}

export { callClaude };
