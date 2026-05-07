import { readFileSync } from 'node:fs';
import { buildJobResearchPrompt } from '../src/prompts/job-research.js';

const EDGE_URL = 'https://kntzxuzplmuccqvpntql.supabase.co/functions/v1/head-hunter-claude';
const MODEL = 'claude-sonnet-4-6';
const TOKEN = process.env.VITE_HH_APP_TOKEN;
if (!TOKEN) {
  console.error('Missing VITE_HH_APP_TOKEN env var');
  process.exit(1);
}

const jd = readFileSync(new URL('./sample-jd.txt', import.meta.url), 'utf8');

// Use a real, well-known company so web_search has a fighting chance to verify a
// real hiring manager. The synthetic "TechScale" in sample-jd.txt is fictional,
// so we substitute a known Berlin SaaS CRO scenario.
const realCompany = 'Personio';
const realJD = jd.replace(/TechScale/g, realCompany).replace(
  /About us:[\s\S]*?The role:/,
  `About us:\nPersonio is a Munich/Berlin-based HR platform serving SMBs across Europe.\n\nThe role:`,
);

const prompt = buildJobResearchPrompt({
  jobDescription: realJD,
  companyName: realCompany,
  cvHighlights:
    'Scaled SaaS ARR from €5M to €60M over 4 years at a DACH B2B SaaS. Built and led 35-person commercial org. Closed strategic enterprise accounts in fintech and insurance.',
});

const payload = {
  model: MODEL,
  max_tokens: 8000,
  messages: [{ role: 'user', content: prompt }],
  tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }],
};

const start = Date.now();
const res = await fetch(EDGE_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-hh-token': TOKEN },
  body: JSON.stringify(payload),
});
const elapsed = Date.now() - start;
const data = await res.json();

console.log(`HTTP ${res.status}  •  ${elapsed} ms`);
console.log(`stop_reason: ${data.stop_reason}`);
console.log(`usage:`, JSON.stringify(data.usage, null, 2));

const blocks = Array.isArray(data?.content) ? data.content : [];
const toolUseCount = blocks.filter((b) => b?.type === 'server_tool_use').length;
const toolResultCount = blocks.filter((b) => b?.type === 'web_search_tool_result').length;
const textBlocks = blocks.filter((b) => b?.type === 'text' && typeof b.text === 'string');

console.log(`server_tool_use blocks: ${toolUseCount}`);
console.log(`web_search_tool_result blocks: ${toolResultCount}`);
console.log(`text blocks: ${textBlocks.length}`);

if (!textBlocks.length) {
  console.error('FAIL: no text block in response');
  console.error('Full response:', JSON.stringify(data, null, 2).slice(0, 2000));
  process.exit(1);
}

const finalText = textBlocks[textBlocks.length - 1].text;
console.log('\n--- FINAL TEXT BLOCK (first 1500 chars) ---');
console.log(finalText.slice(0, 1500));
console.log('--- END ---\n');

let parsed;
try {
  let clean = finalText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const s = clean.indexOf('{');
  const e = clean.lastIndexOf('}');
  parsed = JSON.parse(clean.slice(s, e + 1));
} catch (e) {
  console.error('FAIL: JSON parse error:', e.message);
  process.exit(1);
}

const hm = parsed.hiringManager;
console.log('PARSED hiringManager:', JSON.stringify(hm, null, 2));
console.log(`linkedInMessage (${parsed.linkedInCharCount ?? parsed.linkedInMessage?.length} chars):`);
console.log(parsed.linkedInMessage);

const checks = {
  'hiringManager is object': hm && typeof hm === 'object',
  'has confidence field': hm && typeof hm.confidence === 'string',
  'has rationale field': hm && typeof hm.rationale === 'string' && hm.rationale.length > 20,
  'linkedInUrl is null OR matches linkedin.com/(in|pub)/<slug>':
    !hm?.linkedInUrl ||
    /^https:\/\/(www\.)?linkedin\.com\/(in|pub)\/[^/]+\/?$/i.test(hm.linkedInUrl),
  'linkedInMessage <= 300 chars': (parsed.linkedInMessage?.length ?? 0) <= 300,
  'companyBrief present': typeof parsed.companyBrief === 'string' && parsed.companyBrief.length > 0,
};

console.log('\n--- VALIDATION ---');
let allPass = true;
for (const [name, pass] of Object.entries(checks)) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`);
  if (!pass) allPass = false;
}

if (toolUseCount === 0) {
  console.log('WARN  model did not invoke web_search at all');
}

process.exit(allPass ? 0 : 1);
