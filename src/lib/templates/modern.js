import {
  Paragraph, TextRun, AlignmentType, BorderStyle, LevelFormat,
  SectionType, ColumnBreak, Column
} from 'docx';
import { MODERN as T } from './tokens.js';

const BODY_FONT = T.fonts.body;
const pt = (p) => p * 2;
const sp = (p) => p * 20;
const INDENT = 360;

const PAGE_WIDTH = 12240;
const PAGE_HEIGHT = 15840;
const MARGIN = T.page.marginTwips;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const COL_SPACE = T.columns.spaceTwips;
const SIDEBAR_WIDTH = Math.round((CONTENT_WIDTH - COL_SPACE) * T.columns.sidebarFraction);
const MAIN_WIDTH = CONTENT_WIDTH - COL_SPACE - SIDEBAR_WIDTH;

const SPLIT_AFTER_ROLE = 3;

function runText(text, {
  size = pt(T.sizes.body), bold = false, italics = false,
  color, font = BODY_FONT
} = {}) {
  const opts = { text, font, size, bold, italics };
  if (color) opts.color = color;
  return new TextRun(opts);
}

function sectionHeader(label, { firstInColumn = false } = {}) {
  return new Paragraph({
    children: [runText(label, {
      size: pt(T.sizes.sectionHeader), bold: true, color: T.color.header
    })],
    spacing: { before: firstInColumn ? 0 : sp(8), after: sp(4) },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 8, color: T.color.accent, space: 2 }
    }
  });
}

function columnBreak() {
  return new Paragraph({
    children: [new ColumnBreak()],
    spacing: { before: 0, after: 0, line: 0 }
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
  paras.push(new Paragraph({
    children: [runText(data.contact || '', { size: pt(T.sizes.contact) })],
    spacing: { after: sp(4) }
  }));
  return paras;
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

function sidebarSummaryAndSkills(data) {
  const out = [];
  let first = true;
  if (data.summary) {
    out.push(sectionHeader('Summary', { firstInColumn: first }));
    first = false;
    out.push(new Paragraph({
      children: [runText(data.summary, { size: pt(T.sizes.body) })],
      spacing: { after: sp(6) }
    }));
  }
  if (data.skills?.length) {
    out.push(sectionHeader('Skills', { firstInColumn: first }));
    first = false;
    for (const s of data.skills) out.push(skillLine(s));
  }
  if (data.certifications?.length) {
    for (const p of sidebarList('Certifications', data.certifications, { firstInColumn: first })) {
      out.push(p);
    }
    first = false;
  }
  if (data.publicSpeaking?.length) {
    for (const p of sidebarList('Public Speaking', data.publicSpeaking, { firstInColumn: first })) {
      out.push(p);
    }
    first = false;
  }
  return out;
}

function sidebarEducation(data, { firstInColumn = true } = {}) {
  const out = [];
  if (data.education?.length) {
    out.push(sectionHeader('Education', { firstInColumn }));
    for (const e of data.education) {
      out.push(new Paragraph({
        children: [runText(e, { size: pt(T.sizes.body) })],
        spacing: { after: sp(4) }
      }));
    }
  }
  return out;
}

function roleSubline(role) {
  const dates = role.startDate && role.endDate
    ? `${role.startDate} – ${role.endDate}`
    : (role.startDate || role.endDate || '');
  const parts = [role.title || '', role.location || '', dates].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  return role.titleLine || '';
}

function experienceRole(role) {
  const out = [];
  out.push(new Paragraph({
    children: [runText(role.company || '', {
      size: pt(T.sizes.body), bold: true, color: T.color.accent
    })],
    spacing: { before: sp(6), after: 0 }
  }));
  out.push(new Paragraph({
    children: [runText(roleSubline(role), {
      size: pt(T.sizes.body), italics: true
    })],
    spacing: { after: sp(3) }
  }));
  for (const b of role.bullets || []) {
    out.push(new Paragraph({
      children: [runText(b, { size: pt(T.sizes.bullet) })],
      spacing: { after: sp(2) },
      alignment: AlignmentType.LEFT,
      numbering: { reference: 'cv-bullets', level: 0 }
    }));
  }
  return out;
}

function sidebarList(label, items, { firstInColumn = false } = {}) {
  const out = [sectionHeader(label, { firstInColumn })];
  for (const item of items) {
    out.push(new Paragraph({
      children: [runText(item, { size: pt(T.sizes.body) })],
      spacing: { after: sp(3) },
      alignment: AlignmentType.LEFT,
      numbering: { reference: 'cv-bullets', level: 0 }
    }));
  }
  return out;
}

function startupAchievements(items) {
  const out = [sectionHeader('Startup Achievements', { firstInColumn: false })];
  items.forEach((a) => {
    out.push(new Paragraph({
      children: [runText(a.title || '', {
        size: pt(T.sizes.body), bold: true, color: T.color.accent
      })],
      spacing: { before: sp(4), after: 0 }
    }));
    if (a.body) {
      out.push(new Paragraph({
        children: [runText(a.body, { size: pt(T.sizes.body) })],
        spacing: { after: sp(3) }
      }));
    }
  });
  return out;
}

function mainExperience(roles, { label = 'Experience' } = {}) {
  const out = [sectionHeader(label, { firstInColumn: true })];
  for (const role of roles) {
    for (const p of experienceRole(role)) out.push(p);
  }
  return out;
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

function fullWidthProps() {
  return {
    page: {
      size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
      margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN }
    }
  };
}

function twoColumnProps({ type }) {
  return {
    type,
    page: {
      size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
      margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN }
    },
    column: {
      count: 2,
      space: COL_SPACE,
      equalWidth: false,
      children: [
        new Column({ width: SIDEBAR_WIDTH, space: COL_SPACE }),
        new Column({ width: MAIN_WIDTH })
      ]
    }
  };
}

export function renderCV(data) {
  const roles = data.experience || [];
  const splits = roles.length > SPLIT_AFTER_ROLE;
  const page1Roles = splits ? roles.slice(0, SPLIT_AFTER_ROLE) : roles;
  const page2Roles = splits ? roles.slice(SPLIT_AFTER_ROLE) : [];

  const sections = [];

  sections.push({
    properties: fullWidthProps(),
    children: nameBlock(data)
  });

  const page1Sidebar = sidebarSummaryAndSkills(data);
  if (!splits && data.education?.length) {
    const firstInCol = page1Sidebar.length === 0;
    for (const p of sidebarEducation(data, { firstInColumn: firstInCol })) {
      page1Sidebar.push(p);
    }
  }
  const page1Main = mainExperience(page1Roles, { label: 'Experience' });
  if (!splits && data.startupAchievements?.length) {
    for (const p of startupAchievements(data.startupAchievements)) page1Main.push(p);
  }

  sections.push({
    properties: twoColumnProps({ type: SectionType.CONTINUOUS }),
    children: [...page1Sidebar, columnBreak(), ...page1Main]
  });

  if (splits) {
    const page2Sidebar = sidebarEducation(data, { firstInColumn: true });
    const page2Main = mainExperience(page2Roles, { label: 'Experience (continued)' });
    if (data.startupAchievements?.length) {
      for (const p of startupAchievements(data.startupAchievements)) page2Main.push(p);
    }
    sections.push({
      properties: twoColumnProps({ type: SectionType.NEXT_PAGE }),
      children: [...page2Sidebar, columnBreak(), ...page2Main]
    });
  }

  return {
    styles: buildStyles(),
    numbering: buildNumbering(),
    sections
  };
}

export function renderCL(data) {
  const out = [];

  out.push(new Paragraph({
    children: [runText(data.senderName || '', {
      size: pt(14), bold: true, color: T.color.name
    })],
    spacing: { after: sp(2) }
  }));
  out.push(new Paragraph({
    children: [runText(data.senderContact || '', { size: pt(T.sizes.contact) })],
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
    out.push(new Paragraph({
      children: [runText(b, { size: pt(11) })],
      spacing: { after: sp(6) },
      alignment: AlignmentType.LEFT,
      numbering: { reference: 'cl-bullets', level: 0 }
    }));
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
      size: pt(11), bold: true, color: T.color.name
    })],
    spacing: { after: 0 }
  }));

  return {
    styles: buildStyles(),
    numbering: buildNumbering(),
    sections: [{ properties: fullWidthProps(), children: out }]
  };
}
