import {
  Paragraph, TextRun, AlignmentType, BorderStyle, LevelFormat, ShadingType,
  Tab, TabStopType
} from 'docx';
import { EXECUTIVE as T } from './tokens.js';

const BODY_FONT = T.fonts.body;
const HEADING_FONT = T.fonts.heading;
const pt = (p) => p * 2;
const sp = (p) => p * 20;
const INDENT = 360;

const PAGE_WIDTH = 12240;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * T.page.marginTwips;
const RIGHT_TAB = CONTENT_WIDTH;

function runText(text, {
  size = pt(T.sizes.body), bold = false, italics = false,
  color, font = BODY_FONT, characterSpacing
} = {}) {
  const opts = { text, font, size, bold, italics };
  if (color) opts.color = color;
  if (characterSpacing) opts.characterSpacing = characterSpacing;
  return new TextRun(opts);
}

function sectionHeader(label) {
  return new Paragraph({
    children: [runText(label.toUpperCase(), {
      size: pt(T.sizes.sectionHeader),
      bold: true,
      color: T.color.header,
      font: HEADING_FONT,
      characterSpacing: 20
    })],
    spacing: { before: sp(14), after: sp(6) },
    border: {
      left: { style: BorderStyle.SINGLE, size: 16, color: T.color.header, space: 8 }
    },
    indent: { left: 140 }
  });
}

function nameBlock(data) {
  const paras = [];
  paras.push(new Paragraph({
    children: [runText(data.name || '', {
      size: pt(T.sizes.name), bold: true, color: T.color.name
    })],
    spacing: { after: sp(2) }
  }));
  if (data.title) {
    paras.push(new Paragraph({
      children: [runText(data.title, {
        size: pt(T.sizes.subline), italics: true, color: T.color.subline
      })],
      spacing: { after: sp(2) }
    }));
  }
  paras.push(new Paragraph({
    children: [runText(data.contact || '', {
      size: pt(T.sizes.contact), color: T.color.contact
    })],
    spacing: { after: sp(8) },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 4, color: T.color.accent, space: 6 }
    }
  }));
  return paras;
}

function dateRange(role) {
  if (!role.startDate && !role.endDate) return '';
  const start = role.startDate || '';
  const end = role.endDate || '';
  if (start && end) return `${start} – ${end}`;
  return start || end;
}

function summaryBlock(text) {
  return new Paragraph({
    children: [runText(text, { size: pt(T.sizes.body) })],
    spacing: { before: sp(8), after: sp(10) },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: T.summaryShading },
    indent: { left: 140, right: 140 }
  });
}

function roleHeader(role) {
  const out = [];
  const dates = dateRange(role);
  const hasAtomic = !!(role.title || dates || role.location);

  if (hasAtomic) {
    const line1Children = [
      runText(role.title || '', {
        size: pt(T.sizes.roleTitle), bold: true, color: T.color.name
      })
    ];
    if (dates) {
      line1Children.push(new TextRun({ children: [new Tab()], font: BODY_FONT }));
      line1Children.push(runText(dates, {
        size: pt(T.sizes.roleDates), italics: true, color: T.color.contact
      }));
    }
    out.push(new Paragraph({
      children: line1Children,
      spacing: { before: sp(8), after: 0 },
      tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }]
    }));

    const line2Parts = [];
    if (role.company) {
      line2Parts.push(runText(role.company, {
        size: pt(T.sizes.body), color: T.color.body
      }));
    }
    if (role.company && role.location) {
      line2Parts.push(runText(' · ', { size: pt(T.sizes.body), color: T.color.contact }));
    }
    if (role.location) {
      line2Parts.push(runText(role.location, {
        size: pt(T.sizes.body), italics: true, color: T.color.contact
      }));
    }
    if (line2Parts.length) {
      out.push(new Paragraph({
        children: line2Parts,
        spacing: { after: sp(3) }
      }));
    }
  } else {
    out.push(new Paragraph({
      children: [runText(role.titleLine || '', {
        size: pt(T.sizes.roleTitle), bold: true, color: T.color.name
      })],
      spacing: { before: sp(8), after: 0 }
    }));
    out.push(new Paragraph({
      children: [runText(role.company || '', {
        size: pt(T.sizes.body), italics: true, color: T.color.body
      })],
      spacing: { after: sp(3) }
    }));
  }
  return out;
}

function bullet(text, ref = 'cv-bullets') {
  return new Paragraph({
    children: [runText(text, { size: pt(T.sizes.bullet) })],
    spacing: { after: sp(3) },
    alignment: AlignmentType.LEFT,
    numbering: { reference: ref, level: 0 }
  });
}

function body(text) {
  return new Paragraph({
    children: [runText(text, { size: pt(T.sizes.body) })],
    spacing: { after: sp(4) }
  });
}

function buildStyles() {
  return {
    default: {
      document: {
        run: { font: BODY_FONT, size: pt(T.sizes.body) },
        paragraph: { spacing: { line: 276 } }
      }
    }
  };
}

function buildNumbering() {
  const level0 = {
    level: 0,
    format: LevelFormat.BULLET,
    text: T.bulletChar,
    alignment: AlignmentType.LEFT,
    style: {
      paragraph: { indent: { left: INDENT, hanging: INDENT } },
      run: { font: BODY_FONT }
    }
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
  for (const p of nameBlock(data)) out.push(p);
  if (data.summary) out.push(summaryBlock(data.summary));

  if (data.experience?.length) {
    out.push(sectionHeader('Experience'));
    data.experience.forEach((role) => {
      for (const p of roleHeader(role)) out.push(p);
      for (const b of role.bullets || []) out.push(bullet(b));
    });
  }

  if (data.education?.length) {
    out.push(sectionHeader('Education'));
    for (const e of data.education) out.push(body(e));
  }

  if (data.skills?.length) {
    out.push(sectionHeader('Skills'));
    for (const s of data.skills) out.push(body(s));
  }

  if (data.certifications?.length) {
    out.push(sectionHeader('Certifications'));
    for (const c of data.certifications) out.push(bullet(c));
  }

  if (data.publicSpeaking?.length) {
    out.push(sectionHeader('Public Speaking and Lobbying'));
    for (const p of data.publicSpeaking) out.push(bullet(p));
  }

  if (data.startupAchievements?.length) {
    out.push(sectionHeader('Startup Achievements'));
    data.startupAchievements.forEach((a) => {
      out.push(new Paragraph({
        children: [runText(a.title || '', {
          size: pt(T.sizes.roleTitle), bold: true, color: T.color.name
        })],
        spacing: { before: sp(6), after: 0 }
      }));
      if (a.body) out.push(body(a.body));
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

  out.push(new Paragraph({
    children: [runText(data.senderName || '', {
      size: pt(T.sizes.letterheadName), bold: true, color: T.color.name
    })],
    spacing: { after: sp(2) }
  }));
  if (data.title) {
    out.push(new Paragraph({
      children: [runText(data.title, {
        size: pt(11), italics: true, color: T.color.subline
      })],
      spacing: { after: sp(2) }
    }));
  }
  out.push(new Paragraph({
    children: [runText(data.senderContact || '', {
      size: pt(T.sizes.contact), color: T.color.contact
    })],
    spacing: { after: sp(8) },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 4, color: T.color.accent, space: 6 }
    }
  }));
  out.push(new Paragraph({ children: [runText('')], spacing: { after: sp(12) } }));

  out.push(new Paragraph({
    children: [runText(data.date || '', { size: pt(11) })],
    spacing: { after: sp(18) }
  }));

  const r = data.recipient || {};
  const recipientLines = [r.name, r.title, r.company, r.location].filter(Boolean);
  recipientLines.forEach((line, i) => {
    out.push(new Paragraph({
      children: [runText(line, { size: pt(11) })],
      spacing: { after: i === recipientLines.length - 1 ? sp(18) : 0 }
    }));
  });
  if (!recipientLines.length) {
    out.push(new Paragraph({ children: [runText('')], spacing: { after: sp(18) } }));
  }

  out.push(new Paragraph({
    children: [runText(data.salutation || 'Dear Hiring Team,', { size: pt(11) })],
    spacing: { after: sp(10) }
  }));

  const openingLines = (data.openingParagraph || '').split('\n');
  openingLines.forEach((line, i) => {
    out.push(new Paragraph({
      children: [runText(line, { size: pt(11) })],
      spacing: { after: i === openingLines.length - 1 ? sp(10) : 0 }
    }));
  });

  for (const b of data.bullets || []) {
    out.push(bullet(b, 'cl-bullets'));
  }

  const closingLines = (data.closingParagraph || '').split('\n');
  closingLines.forEach((line, i) => {
    out.push(new Paragraph({
      children: [runText(line, { size: pt(11) })],
      spacing: {
        before: i === 0 ? sp(10) : 0,
        after: i === closingLines.length - 1 ? sp(10) : sp(6)
      }
    }));
  });

  out.push(new Paragraph({
    children: [runText('Best regards,', { size: pt(11) })],
    spacing: { after: sp(18) }
  }));

  out.push(new Paragraph({
    children: [runText(data.signatureName || data.senderName || '', {
      size: pt(11), bold: true, italics: true, color: T.color.name
    })],
    spacing: { after: 0 }
  }));

  return {
    styles: buildStyles(),
    numbering: buildNumbering(),
    sections: [{ properties: pageProps(), children: out }]
  };
}
