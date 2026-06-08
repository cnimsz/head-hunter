import { buildCVPrompt } from '../prompts/cv-writer.js';
import { buildJobResearchPrompt } from '../prompts/job-research.js';
import { buildCoverLetterPrompt } from '../prompts/cover-letter.js';
import { formatLearningsBlock } from './learnings.js';

export const MODEL = 'claude-sonnet-4-6';
// Research call uses Haiku to draw from a separate rate-limit pool —
// web_search inflates input tokens enough to blow Sonnet's Tier 1 ITPM.
export const RESEARCH_MODEL = 'claude-haiku-4-5-20251001';
export const MAX_TOKENS = 8000;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const EDGE_FN_URL = SUPABASE_URL
  ? `${SUPABASE_URL}/functions/v1/head-hunter-claude`
  : '';

async function callClaude({ prompt, masterCV, tools, turnstileToken, sessionToken, model }) {
  if (!EDGE_FN_URL) {
    throw new Error('VITE_SUPABASE_URL is not configured. Set it in .env.local (dev) and Vercel env (prod).');
  }
  const payload = {
    model: model || MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }]
  };
  if (masterCV) payload.masterCV = masterCV;
  if (tools) payload.tools = tools;

  const headers = { 'Content-Type': 'application/json' };
  if (turnstileToken) headers['cf-turnstile-token'] = turnstileToken;
  else if (sessionToken) headers['x-session-token'] = sessionToken;
  else throw new Error('Missing bot challenge token. Solve the challenge and retry.');

  let res;
  try {
    res = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
  } catch (e) {
    throw new Error(`Network error calling Claude: ${e.message}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401) throw new Error('Bot challenge failed or session expired. Refresh and retry.');
    if (res.status === 429) throw new Error('Rate limit reached. Wait a minute and retry.');
    if (res.status === 413) throw new Error('Your CV or job description is too long. Trim and retry.');
    throw new Error(`Claude API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const newSession = res.headers.get('x-session-token') || null;

  const data = await res.json();
  // When server tools (e.g. web_search) are used, the response contains a
  // mix of tool-use, tool-result, and text blocks. The model's final answer
  // is the LAST text block. Without tools, that's still content[0].
  const blocks = Array.isArray(data?.content) ? data.content : [];
  const textBlocks = blocks.filter((b) => b?.type === 'text' && typeof b.text === 'string');
  const text = textBlocks.length ? textBlocks[textBlocks.length - 1].text : '';
  if (!text) throw new Error('Malformed response from Claude (no text content).');
  return { text, sessionToken: newSession };
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
  turnstileToken,
  onStep = () => {}
}) {
  if (!turnstileToken) throw new Error('Bot challenge required. Solve the challenge and retry.');

  onStep('cv');
  const cvCall = await callClaude({
    prompt: buildCVPrompt({ jobDescription, masterCV: cvText, learnings: formatLearningsBlock('cv') }),
    masterCV: cvText,
    turnstileToken
  });
  let session = cvCall.sessionToken;
  if (!session) throw new Error('Server did not return a session token. Refresh and retry.');
  const cvData = sanitizeDashes(extractJson(cvCall.text));
  const cv = cvDataToText(cvData);

  onStep('research');
  const researchCall = await callClaude({
    prompt: buildJobResearchPrompt({
      jobDescription,
      companyName,
      cvHighlights: cv.slice(0, 2000),
      learnings: formatLearningsBlock('linkedIn')
    }),
    masterCV: cvText,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
    sessionToken: session,
    model: RESEARCH_MODEL
  });
  const research = sanitizeDashes(extractJson(researchCall.text));
  const hiringManagerName =
    research.hiringManager && typeof research.hiringManager === 'object'
      ? research.hiringManager.name || null
      : research.hiringManager || null;

  onStep('coverLetter');
  const clCall = await callClaude({
    prompt: buildCoverLetterPrompt({
      jobDescription,
      tailoredCV: cv,
      hiringManager: hiringManagerName,
      companyBrief: research.companyBrief,
      senderName: profile?.name || cvData?.name || '',
      senderContact: profile?.contactLine || cvData?.contact || '',
      learnings: formatLearningsBlock('coverLetter')
    }),
    masterCV: cvText,
    sessionToken: session
  });
  const clData = sanitizeDashes(extractJson(clCall.text));
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
