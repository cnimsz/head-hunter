import JSZip from 'jszip';
import mammoth from 'mammoth';
import { buildMasterCVPrompt } from '../prompts/master-cv.js';

const MAX_CVS = 100;
const SUPPORTED = ['.pdf', '.docx', '.txt', '.md'];

function hasSupportedExt(name) {
  const lower = name.toLowerCase();
  return SUPPORTED.some((ext) => lower.endsWith(ext));
}

async function extractFromArrayBuffer(filename, arrayBuffer) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.docx')) {
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    return value.trim();
  }
  if (lower.endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let out = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      out += content.items.map((it) => it.str).join(' ') + '\n\n';
    }
    return out.trim();
  }
  if (lower.endsWith('.txt') || lower.endsWith('.md')) {
    return new TextDecoder().decode(arrayBuffer).trim();
  }
  throw new Error(`Unsupported file type: ${filename}`);
}

export async function extractCVsFromZip(zipFile, onProgress = () => {}) {
  const zip = await JSZip.loadAsync(zipFile);
  const entries = Object.values(zip.files).filter(
    (e) => !e.dir && hasSupportedExt(e.name) && !e.name.startsWith('__MACOSX/')
  );

  if (entries.length === 0) {
    throw new Error('No supported CV files found in zip (PDF, DOCX, TXT, MD).');
  }
  if (entries.length > MAX_CVS) {
    throw new Error(`Too many CVs: ${entries.length}. Maximum is ${MAX_CVS}.`);
  }

  const cvs = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    onProgress({ current: i + 1, total: entries.length, filename: entry.name });
    try {
      const ab = await entry.async('arraybuffer');
      const text = await extractFromArrayBuffer(entry.name, ab);
      if (text) cvs.push({ filename: entry.name.split('/').pop(), text });
    } catch (err) {
      console.warn(`Skipping ${entry.name}: ${err.message}`);
    }
  }

  if (cvs.length === 0) throw new Error('Could not extract text from any CV in the zip.');
  return cvs;
}

const EDGE_FN_URL = 'https://jxsjgwrkymhtnkwhwtoz.supabase.co/functions/v1/head-hunter-claude';

export async function compileMasterCV({ cvs }) {
  const prompt = buildMasterCVPrompt({ cvs });

  const res = await fetch(EDGE_FN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 429) throw new Error('Rate limited by Anthropic. Wait and retry.');
    throw new Error(`Claude API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error('Malformed response from Claude (no text content).');
  return text.trim();
}

export { MAX_CVS };
