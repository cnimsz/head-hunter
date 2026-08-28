// Normalise a free-text company name to a stable cache key for
// company_research. The input comes from InputPanel's optional
// "Company Name and Job Title" field (e.g. "Acme Robotics - Senior Engineer"
// or plain "Acme Robotics GmbH"), so we peel role suffixes and legal forms.
//
// Two variants of the same company MUST land on the same key. Two different
// companies MUST NOT collapse — false positives poison the cache and serve
// the wrong companyBrief to the wrong user. When in doubt (short input,
// nothing left after stripping), return null and let the caller skip the cache.

// Role separator used by the InputPanel placeholder text: " - Role".
const ROLE_SEP_RE = /\s+[-–—]\s+/;

// Legal suffixes to strip from the end. Ordered longest-first so
// "GmbH & Co. KG" matches before "GmbH". Unicode-lowercased before matching.
const LEGAL_SUFFIXES: string[] = [
  "gmbh & co. kg",
  "gmbh & co kg",
  "s.à r.l.",
  "s.a r.l.",
  "s.p.a.",
  "s.a.",
  "n.v.",
  "b.v.",
  "kgaa",
  "gmbh",
  "corporation",
  "incorporated",
  "corp",
  "inc",
  "limited",
  "ltd.",
  "ltd",
  "plc",
  "llc",
  "llp",
  "co.,",
  "co.",
  "co",
  "ohg",
  "kg",
  "ag",
  "se",
  "ug",
  "pty",
  "e.k.",
  "ek",
];

export function normaliseCompanyKey(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = String(input).trim();
  if (!s) return null;

  // 1) Peel " - Role" suffix (matches the InputPanel format).
  const parts = s.split(ROLE_SEP_RE);
  s = parts[0].trim();

  // 2) Lowercase (locale-aware).
  s = s.toLocaleLowerCase("en-US");

  // 3) Strip legal suffixes at the end. Repeat once to handle
  //    stacked forms ("Foo GmbH & Co. KG" → "Foo GmbH" → "Foo").
  for (let pass = 0; pass < 2; pass++) {
    for (const suf of LEGAL_SUFFIXES) {
      if (s === suf) { s = ""; break; }
      if (s.endsWith(" " + suf) || s.endsWith("," + suf) || s.endsWith(", " + suf)) {
        s = s.slice(0, s.length - suf.length - 1).replace(/[,\s]+$/, "").trim();
        break;
      }
    }
  }

  // 4) Strip punctuation (keep letters, numbers, whitespace — Unicode-aware).
  s = s.replace(/[^\p{L}\p{N}\s]/gu, "");

  // 5) Collapse whitespace.
  s = s.replace(/\s+/g, " ").trim();

  if (s.length < 2) return null;
  return s;
}
