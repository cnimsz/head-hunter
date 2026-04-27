import {
  Paragraph, TextRun, AlignmentType, BorderStyle, LevelFormat
} from 'docx';
import { CLASSIC as T } from './tokens.js';

const FONT = T.fonts.body;
const pt = (p) => p * 2;
const sp = (p) => p * 20;
const INDENT_QUARTER_INCH = 360;

function run(text, opts = {}) {
  return new TextRun({
    text,
    font: FONT,
    size: opts.size ?? pt(T.sizes.body),
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

function cvName(text) {
  return para({
    children: [run(text, { size: pt(T.sizes.name), bold: true })],
    spacing: { after: sp(6) }
  });
}

function cvContact(text) {
  return para({
    children: [run(text, { size: pt(T.sizes.contact) })],
    spacing: { after: sp(12) }
  });
}

function cvSectionHeader(text) {
  return para({
    children: [run(text.toUpperCase(), { size: pt(T.sizes.sectionHeader), bold: true })],
    spacing: { before: sp(12), after: sp(6) },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 4, color: T.color.accent, space: 1 }
    }
  });
}

function cvCompany(text, { firstInSection = false } = {}) {
  return para({
    children: [run(text, { size: pt(T.sizes.sectionHeader), bold: true })],
    spacing: { before: firstInSection ? 0 : sp(12), after: 0 }
  });
}

function cvJobTitleLine(text) {
  return para({
    children: [run(text, { size: pt(T.sizes.sectionHeader) })],
    spacing: { after: sp(3) }
  });
}

function cvBullet(text) {
  return new Paragraph({
    children: [run(text, { size: pt(T.sizes.bullet) })],
    spacing: { after: sp(3) },
    alignment: AlignmentType.LEFT,
    numbering: { reference: 'cv-bullets', level: 0 }
  });
}

function cvBody(text, opts = {}) {
  return para({
    children: [run(text, { size: pt(T.sizes.body), italics: opts.italics })],
    spacing: { after: sp(6) }
  });
}

function buildStyles() {
  return {
    default: {
      document: {
        run: { font: FONT, size: pt(T.sizes.body) },
        paragraph: { spacing: { line: 276 } }
      }
    }
  };
}

function buildNumbering() {
  const levelStyle = {
    paragraph: { indent: { left: INDENT_QUARTER_INCH, hanging: INDENT_QUARTER_INCH } },
    run: { font: FONT }
  };
  const level0 = {
    level: 0,
    format: LevelFormat.BULLET,
    text: T.bulletChar,
    alignment: AlignmentType.LEFT,
    style: levelStyle
  };
  return {
    config: [
      { reference: 'cv-bullets', levels: [level0] },
      { reference: 'cl-bullets', levels: [level0] }
    ]
  };
}

function pageProps() {
  const m = T.page.marginTwips;
  return {
    page: {
      size: { width: 12240, height: 15840 },
      margin: { top: m, right: m, bottom: m, left: m }
    }
  };
}

export function renderCV(data) {
  const out = [];
  out.push(cvName(data.name || ''));
  out.push(cvContact(data.contact || ''));
  if (data.summary) out.push(cvBody(data.summary));

  if (data.experience?.length) {
    out.push(cvSectionHeader('EXPERIENCE'));
    data.experience.forEach((role, i) => {
      out.push(cvCompany(role.company, { firstInSection: i === 0 }));
      out.push(cvJobTitleLine(role.titleLine));
      for (const b of role.bullets || []) out.push(cvBullet(b));
    });
  }

  if (data.education?.length) {
    out.push(cvSectionHeader('EDUCATION'));
    for (const e of data.education) out.push(cvBody(e));
  }

  if (data.skills?.length) {
    out.push(cvSectionHeader('SKILLS'));
    for (const s of data.skills) out.push(cvBody(s));
  }

  if (data.certifications?.length) {
    out.push(cvSectionHeader('CERTIFICATIONS'));
    for (const c of data.certifications) out.push(cvBullet(c));
  }

  if (data.publicSpeaking?.length) {
    out.push(cvSectionHeader('PUBLIC SPEAKING AND LOBBYING'));
    for (const p of data.publicSpeaking) out.push(cvBullet(p));
  }

  if (data.startupAchievements?.length) {
    out.push(cvSectionHeader('STARTUP ACHIEVEMENTS'));
    data.startupAchievements.forEach((a, i) => {
      out.push(para({
        children: [run(a.title || '', { size: pt(T.sizes.sectionHeader), bold: true })],
        spacing: { before: i === 0 ? 0 : sp(6), after: 0 }
      }));
      if (a.body) out.push(cvBody(a.body));
    });
  }

  return {
    styles: buildStyles(),
    numbering: buildNumbering(),
    sections: [{ properties: pageProps(), children: out }]
  };
}

export function renderCL(data) {
  const out = [];

  out.push(para({
    children: [run(data.senderName || '', { size: pt(12), bold: true })],
    spacing: { after: 0 }
  }));

  out.push(para({
    children: [run(data.senderContact || '', { size: pt(10) })],
    spacing: { after: sp(24) }
  }));

  out.push(para({
    children: [run(data.date || '', { size: pt(11) })],
    spacing: { after: sp(24) }
  }));

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

  out.push(para({
    children: [run(data.salutation || 'Dear Hiring Team,', { size: pt(11) })],
    spacing: { after: sp(12) }
  }));

  const openingLines = (data.openingParagraph || '').split('\n');
  openingLines.forEach((line, i) => {
    out.push(para({
      children: [run(line, { size: pt(11) })],
      spacing: { after: i === openingLines.length - 1 ? sp(12) : 0 }
    }));
  });

  for (const b of data.bullets || []) {
    out.push(new Paragraph({
      children: [run(b, { size: pt(11) })],
      spacing: { after: sp(6) },
      alignment: AlignmentType.LEFT,
      numbering: { reference: 'cl-bullets', level: 0 }
    }));
  }

  const closingLines = (data.closingParagraph || '').split('\n');
  closingLines.forEach((line, i) => {
    out.push(para({
      children: [run(line, { size: pt(11) })],
      spacing: {
        before: i === 0 ? sp(12) : 0,
        after: i === closingLines.length - 1 ? sp(12) : sp(6)
      }
    }));
  });

  out.push(para({
    children: [run('Best regards,', { size: pt(11) })],
    spacing: { after: sp(24) }
  }));

  out.push(para({
    children: [run(data.signatureName || data.senderName || '', { size: pt(11), bold: true })],
    spacing: { after: 0 }
  }));

  return {
    styles: buildStyles(),
    numbering: buildNumbering(),
    sections: [{ properties: pageProps(), children: out }]
  };
}
