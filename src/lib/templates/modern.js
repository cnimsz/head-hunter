import {
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  LevelFormat,
  ShadingType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  VerticalAlign
} from 'docx';
import { MODERN as T } from './tokens.js';

const BODY_FONT = T.fonts.body;
const pt = (p) => p * 2;
const sp = (p) => p * 20;
const INDENT = 300;

const PAGE_WIDTH = 12240;
const PAGE_HEIGHT = 15840;
const MARGIN = T.page.marginTwips;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const SIDEBAR_WIDTH = Math.round(CONTENT_WIDTH * T.columns.sidebarFraction);
const MAIN_WIDTH = CONTENT_WIDTH - SIDEBAR_WIDTH;
const CELL_PAD = 170;

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const CELL_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

function runText(
  text,
  {
    size = pt(T.sizes.body),
    bold = false,
    italics = false,
    color,
    font = BODY_FONT,
    characterSpacing
  } = {}
) {
  const opts = { text, font, size, bold, italics };
  if (color) opts.color = color;
  if (characterSpacing) opts.characterSpacing = characterSpacing;
  return new TextRun(opts);
}

function bodyPara(text, { after = 6 } = {}) {
  return new Paragraph({
    children: [runText(text, { size: pt(T.sizes.body) })],
    spacing: { after: sp(after) }
  });
}

function spacer(after) {
  return new Paragraph({ children: [runText('')], spacing: { after: sp(after), line: 120 } });
}

// ---- Header band (accent-filled name + subline + contact) -------------------

function bandShading() {
  return { type: ShadingType.CLEAR, color: 'auto', fill: T.band };
}

function bandBlock(lines) {
  const shade = bandShading();
  return lines.map(
    (ln, i) =>
      new Paragraph({
        children: [runText(ln.text, ln.opts)],
        shading: shade,
        spacing: {
          before: i === 0 ? sp(6) : 0,
          after: i === lines.length - 1 ? sp(6) : 0
        },
        indent: { left: 140, right: 140 }
      })
  );
}

function cvHeader(data) {
  const lines = [
    { text: data.name || '', opts: { size: pt(T.sizes.name), bold: true, color: T.color.onBand } }
  ];
  if (data.title) {
    lines.push({
      text: data.title,
      opts: { size: pt(T.sizes.sectionHeader), color: T.color.onBandMuted, characterSpacing: 20 }
    });
  }
  if (data.contact) {
    lines.push({
      text: data.contact,
      opts: { size: pt(T.sizes.contact), color: T.color.onBandMuted }
    });
  }
  return [...bandBlock(lines), spacer(6)];
}

// ---- Section headers --------------------------------------------------------

function sectionHeader(label, { firstInColumn = false } = {}) {
  return new Paragraph({
    children: [
      runText(label.toUpperCase(), {
        size: pt(T.sizes.sectionHeader),
        bold: true,
        color: T.color.header,
        characterSpacing: 24
      })
    ],
    spacing: { before: firstInColumn ? 0 : sp(10), after: sp(4) },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 8, color: T.color.accent, space: 3 }
    }
  });
}

function bullet(text, { reference = 'cv-bullets' } = {}) {
  return new Paragraph({
    children: [runText(text, { size: pt(T.sizes.bullet) })],
    spacing: { after: sp(2) },
    alignment: AlignmentType.LEFT,
    numbering: { reference, level: 0 }
  });
}

function skillLine(line) {
  const idx = line.indexOf(':');
  if (idx > 0) {
    const cat = line.slice(0, idx);
    const rest = line.slice(idx + 1).trim();
    return new Paragraph({
      children: [
        runText(cat, { size: pt(T.sizes.body), bold: true, color: T.color.accent }),
        runText(': ' + rest, { size: pt(T.sizes.body) })
      ],
      spacing: { after: sp(3) }
    });
  }
  return new Paragraph({
    children: [runText(line, { size: pt(T.sizes.body) })],
    spacing: { after: sp(3) }
  });
}

// ---- Sidebar (Summary, Skills, Education, Certifications, Speaking) ----------

function sidebarParagraphs(data) {
  const out = [];
  let first = true;
  const header = (label) => {
    out.push(sectionHeader(label, { firstInColumn: first }));
    first = false;
  };

  if (data.summary) {
    header('Summary');
    out.push(bodyPara(data.summary));
  }
  if (data.skills?.length) {
    header('Skills');
    for (const s of data.skills) out.push(skillLine(s));
  }
  if (data.education?.length) {
    header('Education');
    for (const e of data.education) out.push(bodyPara(e, { after: 4 }));
  }
  if (data.certifications?.length) {
    header('Certifications');
    for (const c of data.certifications) out.push(bullet(c));
  }
  if (data.publicSpeaking?.length) {
    header('Public Speaking');
    for (const p of data.publicSpeaking) out.push(bullet(p));
  }
  if (!out.length) out.push(new Paragraph({ children: [runText('')] }));
  return out;
}

// ---- Main column (Experience, Startup Achievements) -------------------------

function roleSubline(role) {
  const dates =
    role.startDate && role.endDate
      ? `${role.startDate} - ${role.endDate}`
      : role.startDate || role.endDate || '';
  const parts = [role.title || '', role.location || '', dates].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  return role.titleLine || '';
}

function experienceRole(role) {
  const out = [];
  out.push(
    new Paragraph({
      children: [
        runText(role.company || '', {
          size: pt(T.sizes.roleTitle),
          bold: true,
          color: T.color.accent
        })
      ],
      spacing: { before: sp(6), after: 0 }
    })
  );
  const sub = roleSubline(role);
  if (sub) {
    out.push(
      new Paragraph({
        children: [runText(sub, { size: pt(T.sizes.body), italics: true, color: T.color.muted })],
        spacing: { after: sp(3) }
      })
    );
  }
  for (const b of role.bullets || []) out.push(bullet(b));
  return out;
}

function achievement(a) {
  const out = [];
  out.push(
    new Paragraph({
      children: [
        runText(a.title || '', { size: pt(T.sizes.body), bold: true, color: T.color.accent })
      ],
      spacing: { before: sp(4), after: 0 }
    })
  );
  if (a.body) out.push(bodyPara(a.body, { after: 3 }));
  return out;
}

function mainParagraphs(data) {
  const out = [];
  let first = true;
  const roles = data.experience || [];
  if (roles.length) {
    out.push(sectionHeader('Experience', { firstInColumn: first }));
    first = false;
    for (const role of roles) for (const p of experienceRole(role)) out.push(p);
  }
  if (data.startupAchievements?.length) {
    out.push(sectionHeader('Startup Achievements', { firstInColumn: first }));
    first = false;
    for (const a of data.startupAchievements) for (const p of achievement(a)) out.push(p);
  }
  if (!out.length) out.push(new Paragraph({ children: [runText('')] }));
  return out;
}

// ---- Two-panel body table ---------------------------------------------------

function bodyTable(data) {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [SIDEBAR_WIDTH, MAIN_WIDTH],
    borders: { ...CELL_BORDERS, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
    rows: [
      new TableRow({
        cantSplit: false,
        children: [
          new TableCell({
            width: { size: SIDEBAR_WIDTH, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: T.sidebarFill },
            margins: { top: CELL_PAD, bottom: CELL_PAD, left: CELL_PAD, right: CELL_PAD },
            verticalAlign: VerticalAlign.TOP,
            borders: CELL_BORDERS,
            children: sidebarParagraphs(data)
          }),
          new TableCell({
            width: { size: MAIN_WIDTH, type: WidthType.DXA },
            margins: { top: CELL_PAD, bottom: CELL_PAD, left: CELL_PAD + 60, right: 60 },
            verticalAlign: VerticalAlign.TOP,
            borders: CELL_BORDERS,
            children: mainParagraphs(data)
          })
        ]
      })
    ]
  });
}

// ---- Shared doc scaffolding -------------------------------------------------

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
  return {
    page: {
      size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
      margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN }
    }
  };
}

export function renderCV(data) {
  const children = [...cvHeader(data), bodyTable(data)];
  return {
    styles: buildStyles(),
    numbering: buildNumbering(),
    sections: [{ properties: pageProps(), children }]
  };
}

// ---- Cover letter (matching band header + standard letter body) -------------

function clHeader(data) {
  const lines = [
    { text: data.senderName || '', opts: { size: pt(18), bold: true, color: T.color.onBand } }
  ];
  if (data.senderContact) {
    lines.push({
      text: data.senderContact,
      opts: { size: pt(T.sizes.contact), color: T.color.onBandMuted }
    });
  }
  return [...bandBlock(lines), spacer(12)];
}

export function renderCL(data) {
  const out = [...clHeader(data)];

  out.push(
    new Paragraph({
      children: [runText(data.date || '', { size: pt(11) })],
      spacing: { after: sp(18) }
    })
  );

  const r = data.recipient || {};
  const recipientLines = [r.name, r.title, r.company, r.location].filter(Boolean);
  recipientLines.forEach((line, i) => {
    out.push(
      new Paragraph({
        children: [runText(line, { size: pt(11) })],
        spacing: { after: i === recipientLines.length - 1 ? sp(18) : 0 }
      })
    );
  });
  if (!recipientLines.length) {
    out.push(new Paragraph({ children: [runText('')], spacing: { after: sp(18) } }));
  }

  out.push(
    new Paragraph({
      children: [runText(data.salutation || 'Dear Hiring Team,', { size: pt(11) })],
      spacing: { after: sp(10) }
    })
  );

  const openingLines = (data.openingParagraph || '').split('\n');
  openingLines.forEach((line, i) => {
    out.push(
      new Paragraph({
        children: [runText(line, { size: pt(11) })],
        spacing: { after: i === openingLines.length - 1 ? sp(10) : 0 }
      })
    );
  });

  for (const b of data.bullets || []) {
    out.push(
      new Paragraph({
        children: [runText(b, { size: pt(11) })],
        spacing: { after: sp(6) },
        alignment: AlignmentType.LEFT,
        numbering: { reference: 'cl-bullets', level: 0 }
      })
    );
  }

  const closingLines = (data.closingParagraph || '').split('\n');
  closingLines.forEach((line, i) => {
    out.push(
      new Paragraph({
        children: [runText(line, { size: pt(11) })],
        spacing: {
          before: i === 0 ? sp(10) : 0,
          after: i === closingLines.length - 1 ? sp(10) : sp(6)
        }
      })
    );
  });

  out.push(
    new Paragraph({
      children: [runText('Best regards,', { size: pt(11) })],
      spacing: { after: sp(18) }
    })
  );

  out.push(
    new Paragraph({
      children: [
        runText(data.signatureName || data.senderName || '', {
          size: pt(11),
          bold: true,
          color: T.color.name
        })
      ],
      spacing: { after: 0 }
    })
  );

  return {
    styles: buildStyles(),
    numbering: buildNumbering(),
    sections: [{ properties: pageProps(), children: out }]
  };
}
