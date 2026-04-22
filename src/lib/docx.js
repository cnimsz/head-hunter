import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  LevelFormat
} from 'docx';
import { saveAs } from 'file-saver';

const FONT = 'Arial';

// docx sizes are in half-points; spacing is in 1/20 pt; indents are in twips (1/1440 inch)
const pt = (p) => p * 2;
const sp = (p) => p * 20;
const INDENT_QUARTER_INCH = 360;

function run(text, opts = {}) {
  return new TextRun({
    text,
    font: FONT,
    size: opts.size ?? pt(10.5),
    bold: opts.bold ?? false,
    italics: opts.italics ?? false
  });
}

function para({ children, spacing, alignment, indent, border }) {
  return new Paragraph({
    children,
    spacing,
    alignment: alignment ?? AlignmentType.LEFT,
    indent,
    border
  });
}

function blank(after = 0) {
  return para({ children: [run('')], spacing: { after: sp(after) } });
}

// --- CV ------------------------------------------------------------------

function cvName(text) {
  return para({
    children: [run(text, { size: pt(14), bold: true })],
    spacing: { after: sp(6) }
  });
}

function cvContact(text) {
  return para({
    children: [run(text, { size: pt(10) })],
    spacing: { after: sp(12) }
  });
}

function cvSectionHeader(text) {
  return para({
    children: [run(text.toUpperCase(), { size: pt(11), bold: true })],
    spacing: { before: sp(12), after: sp(6) },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 4, color: '808080', space: 1 }
    }
  });
}

function cvCompany(text, { firstInSection = false } = {}) {
  return para({
    children: [run(text, { size: pt(11), bold: true })],
    spacing: { before: firstInSection ? 0 : sp(12), after: 0 }
  });
}

function cvJobTitleLine(text) {
  return para({
    children: [run(text, { size: pt(11) })],
    spacing: { after: sp(3) }
  });
}

function cvBullet(text) {
  return new Paragraph({
    children: [run(text, { size: pt(10.5) })],
    spacing: { after: sp(3) },
    alignment: AlignmentType.LEFT,
    numbering: { reference: 'cv-bullets', level: 0 }
  });
}

function cvBody(text, opts = {}) {
  return para({
    children: [run(text, { size: pt(10.5), italics: opts.italics })],
    spacing: { after: sp(6) }
  });
}

function buildCVFromData(data) {
  const out = [];

  out.push(cvName(data.name || ''));
  out.push(cvContact(data.contact || ''));

  if (data.summary) {
    out.push(cvBody(data.summary));
  }

  if (data.experience?.length) {
    out.push(cvSectionHeader('EXPERIENCE'));
    data.experience.forEach((role, i) => {
      out.push(cvCompany(role.company, { firstInSection: i === 0 }));
      out.push(cvJobTitleLine(role.titleLine));
      for (const b of role.bullets || []) {
        out.push(cvBullet(b));
      }
    });
  }

  if (data.education?.length) {
    out.push(cvSectionHeader('EDUCATION'));
    for (const e of data.education) {
      out.push(cvBody(e));
    }
  }

  if (data.skills?.length) {
    out.push(cvSectionHeader('SKILLS'));
    for (const s of data.skills) {
      out.push(cvBody(s));
    }
  }

  return out;
}

function isBullet(line) {
  return /^\s*[-•*]\s+/.test(line);
}

function stripBullet(line) {
  return line.replace(/^\s*[-•*]\s+/, '').trim();
}

// --- Cover Letter --------------------------------------------------------

function buildCLFromData(data) {
  const out = [];

  // Sender name — 12pt bold
  out.push(para({
    children: [run(data.senderName || '', { size: pt(12), bold: true })],
    spacing: { after: 0 }
  }));

  // Sender contact — 10pt
  out.push(para({
    children: [run(data.senderContact || '', { size: pt(10) })],
    spacing: { after: sp(24) }
  }));

  // Date — 11pt
  out.push(para({
    children: [run(data.date || '', { size: pt(11) })],
    spacing: { after: sp(24) }
  }));

  // Recipient block — 11pt
  const r = data.recipient || {};
  const recipientLines = [r.name, r.title, r.company, r.location].filter(Boolean);
  recipientLines.forEach((line, i) => {
    out.push(para({
      children: [run(line, { size: pt(11) })],
      spacing: { after: i === recipientLines.length - 1 ? sp(24) : 0 }
    }));
  });
  if (!recipientLines.length) {
    out.push(para({ children: [run('')], spacing: { after: sp(24) } }));
  }

  // Salutation — 11pt
  out.push(para({
    children: [run(data.salutation || 'Dear Hiring Team,', { size: pt(11) })],
    spacing: { after: sp(12) }
  }));

  // Opening paragraph — 11pt
  out.push(para({
    children: [run(data.openingParagraph || '', { size: pt(11) })],
    spacing: { after: sp(12) }
  }));

  // Bullets — 11pt with numbering
  for (const b of data.bullets || []) {
    out.push(new Paragraph({
      children: [run(b, { size: pt(11) })],
      spacing: { after: sp(6) },
      alignment: AlignmentType.LEFT,
      numbering: { reference: 'cl-bullets', level: 0 }
    }));
  }

  // Closing paragraph — 11pt, 12pt gap above to separate from bullets
  out.push(para({
    children: [run(data.closingParagraph || '', { size: pt(11) })],
    spacing: { before: sp(12), after: sp(12) }
  }));

  // Closing line — 11pt
  out.push(para({
    children: [run('Best regards,', { size: pt(11) })],
    spacing: { after: sp(24) }
  }));

  // Signature — 11pt bold
  out.push(para({
    children: [run(data.signatureName || data.senderName || '', { size: pt(11), bold: true })],
    spacing: { after: 0 }
  }));

  return out;
}

// --- Document wrapper ----------------------------------------------------

function buildDoc(children) {
  return new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: pt(10.5) },
          paragraph: { spacing: { line: 276 } } // 1.15 line spacing
        }
      }
    },
    numbering: {
      config: [
        {
          reference: 'cv-bullets',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '\u2022',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: INDENT_QUARTER_INCH, hanging: INDENT_QUARTER_INCH } },
                run: { font: FONT }
              }
            }
          ]
        },
        {
          reference: 'cl-bullets',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '\u2022',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: INDENT_QUARTER_INCH, hanging: INDENT_QUARTER_INCH } },
                run: { font: FONT }
              }
            }
          ]
        }
      ]
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 }, // US Letter
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } // 1"
        }
      },
      children
    }]
  });
}

function safeFilename(s) {
  return (s || 'output').replace(/[^a-z0-9_]+/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'output';
}

function suffix({ companyAndRole } = {}) {
  return companyAndRole ? `_${safeFilename(companyAndRole)}` : '';
}

export async function generateCVDocx(contentOrData, candidateName = 'CV', meta = {}) {
  const children = buildCVFromData(contentOrData);
  const doc = buildDoc(children);
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${safeFilename(candidateName)}_CV${suffix(meta)}.docx`);
  return blob;
}

export async function generateCoverLetterDocx(contentOrData, candidateName = 'Candidate', meta = {}) {
  const children = buildCLFromData(contentOrData);
  const doc = buildDoc(children);
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${safeFilename(candidateName)}_CoverLetter${suffix(meta)}.docx`);
  return blob;
}
