// Client-side extraction of plain text from uploaded CV files (PDF or DOCX).
import mammoth from 'mammoth';

export async function extractTextFromFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx')) return extractDocx(file);
  if (name.endsWith('.pdf')) return extractPdf(file);
  if (name.endsWith('.txt') || name.endsWith('.md')) return file.text();
  throw new Error('Unsupported file type. Use PDF, DOCX, TXT, or MD.');
}

async function extractDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return value.trim();
}

async function extractPdf(file) {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let out = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    out += content.items.map((it) => it.str).join(' ') + '\n\n';
  }
  return out.trim();
}
