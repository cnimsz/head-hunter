import { Document, Packer } from 'docx';
import { saveAs } from 'file-saver';

import * as classic from './templates/classic.js';
import * as modern from './templates/modern.js';
import * as executive from './templates/executive.js';

const TEMPLATES = { classic, modern, executive };

function pickTemplate(id) {
  return TEMPLATES[id] || TEMPLATES.classic;
}

function buildDocFrom(result) {
  return new Document({
    styles: result.styles,
    numbering: result.numbering,
    sections: result.sections
  });
}

function safeFilename(s) {
  return (
    (s || 'output')
      .replace(/[^a-z0-9_]+/gi, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 60) || 'output'
  );
}

function suffix({ companyAndRole } = {}) {
  return companyAndRole ? `_${safeFilename(companyAndRole)}` : '';
}

export async function buildCVBlob(data, meta = {}) {
  const tpl = pickTemplate(meta.template);
  const doc = buildDocFrom(tpl.renderCV(data));
  return Packer.toBlob(doc);
}

export async function buildCoverLetterBlob(data, meta = {}) {
  const tpl = pickTemplate(meta.template);
  const doc = buildDocFrom(tpl.renderCL(data));
  return Packer.toBlob(doc);
}

export async function generateCVDocx(data, candidateName = 'CV', meta = {}) {
  const blob = await buildCVBlob(data, meta);
  saveAs(blob, `${safeFilename(candidateName)}_CV${suffix(meta)}.docx`);
  return blob;
}

export async function generateCoverLetterDocx(data, candidateName = 'Candidate', meta = {}) {
  const blob = await buildCoverLetterBlob(data, meta);
  saveAs(blob, `${safeFilename(candidateName)}_CL${suffix(meta)}.docx`);
  return blob;
}
