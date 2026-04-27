// Per-template style tokens. Sizes are in pt (converted to half-points at render time);
// spacings are in pt (converted to twentieths of a point at render time).

export const CLASSIC = {
  id: 'classic',
  label: 'Classic',
  fonts: { body: 'Arial', heading: 'Arial', name: 'Arial' },
  sizes: { name: 14, contact: 10, sectionHeader: 11, body: 10.5, bullet: 10.5 },
  color: { name: '000000', header: '000000', body: '000000', accent: '808080' },
  page: { marginTwips: 1440 },
  bulletChar: '•'
};

export const MODERN = {
  id: 'modern',
  label: 'Modern',
  fonts: { body: 'Calibri', heading: 'Calibri', name: 'Calibri' },
  sizes: { name: 20, contact: 10, sectionHeader: 12, body: 10.5, bullet: 10.5 },
  color: { name: '1A4D5C', header: '1A4D5C', body: '111827', accent: '1A4D5C' },
  page: { marginTwips: 1134 },
  columns: { count: 2, spaceTwips: 360, sidebarFraction: 0.38 },
  bulletChar: '•'
};

export const EXECUTIVE = {
  id: 'executive',
  label: 'Executive',
  fonts: { body: 'Georgia', heading: 'Calibri', name: 'Georgia' },
  sizes: {
    name: 22, subline: 12, contact: 10,
    sectionHeader: 11, body: 11, bullet: 11,
    roleTitle: 11.5, roleDates: 10.5,
    letterheadName: 16
  },
  color: {
    name: '0B2545', header: '0B2545', body: '111827',
    subline: '333333', contact: '555555', accent: '0B2545'
  },
  page: { marginTwips: 1020 },
  summaryShading: 'F5F5F0',
  bulletChar: '–'
};

export const TEMPLATES = { classic: CLASSIC, modern: MODERN, executive: EXECUTIVE };

export function getTemplate(id) {
  return TEMPLATES[id] || CLASSIC;
}
