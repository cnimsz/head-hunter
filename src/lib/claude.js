import { buildCVPrompt } from '../prompts/cv-writer.js';
import { buildJobResearchPrompt } from '../prompts/job-research.js';
import { buildCoverLetterPrompt } from '../prompts/cover-letter.js';
import { formatLearningsBlock } from './learnings.js';

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 8000;

async function callClaude({ apiKey, prompt }) {
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }]
      })
    });
  } catch (e) {
    throw new Error(`Network error calling Claude: ${e.message}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401) throw new Error('Invalid API key. Check it in Settings.');
    if (res.status === 429) throw new Error('Rate limited by Anthropic. Wait and retry.');
    throw new Error(`Claude API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error('Malformed response from Claude (no text content).');
  return text;
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

function cvDataToText(d) {
  const lines = [];
  lines.push(d.name, d.contact, '');
  if (d.summary) lines.push(d.summary, '');
  lines.push('EXPERIENCE', '');
  for (const role of d.experience || []) {
    lines.push(role.company, role.titleLine);
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
  }
  return lines.join('\n').trim();
}

export async function generateApplication({
  apiKey,
  jobDescription,
  cvText,
  companyName,
  onStep = () => {}
}) {
  onStep('cv');
  const cvRaw = await callClaude({
    apiKey,
    prompt: buildCVPrompt({ jobDescription, masterCV: cvText, learnings: formatLearningsBlock('cv') })
  });
  const cvData = extractJson(cvRaw);
  const cv = cvDataToText(cvData);

  onStep('research');
  const researchRaw = await callClaude({
    apiKey,
    prompt: buildJobResearchPrompt({
      jobDescription,
      companyName,
      cvHighlights: cv.slice(0, 2000),
      learnings: formatLearningsBlock('linkedIn')
    })
  });
  const research = extractJson(researchRaw);
  const hiringManagerName =
    research.hiringManager && typeof research.hiringManager === 'object'
      ? research.hiringManager.name || null
      : research.hiringManager || null;

  onStep('coverLetter');
  const clRaw = await callClaude({
    apiKey,
    prompt: buildCoverLetterPrompt({
      jobDescription,
      tailoredCV: cv,
      hiringManager: hiringManagerName,
      companyBrief: research.companyBrief,
      learnings: formatLearningsBlock('coverLetter')
    })
  });
  const clData = extractJson(clRaw);
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
