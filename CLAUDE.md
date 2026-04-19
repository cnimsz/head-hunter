# CV Toolkit App (Head Hunter)

One-screen web app: Paste job description → Get tailored CV, cover letter, and LinkedIn message.
All processing runs client-side in the browser — no backend.

## Tech Stack

- **Framework:** React 18 + Vite 5
- **Styling:** Tailwind CSS 3 (dark mode via class toggle)
- **Document generation:** `docx` + `file-saver`
- **File parsing:** `pdfjs-dist` (PDF), `mammoth` (DOCX), `jszip` (ZIP)
- **API:** Anthropic Messages API — claude-sonnet-4-20250514, proxied via Supabase Edge Function (`head-hunter-claude`)
- **Supabase:** Project ref `kntzxuzplmuccqvpntql` — edge function uses `HEAD_HUNTER` secret for the Anthropic API key
- **Storage:** localStorage (prefix: `cv-toolkit:`)
- **Deploy:** Vercel — https://head-hunter-fawn.vercel.app

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        APP SHELL                                │
│  App.jsx — layout, theme, state orchestration                   │
└─────────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   INPUT     │ │   CLAUDE    │ │   OUTPUT    │ │   STORAGE   │
│   PANEL     │ │   ENGINE    │ │   PANEL     │ │   LAYER     │
│             │ │ claude.js   │ │ + Editable  │ │ storage.js  │
│             │ │ + prompts/  │ │ + Feedback  │ │ learnings.js│
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
       │                                │              │
┌──────┴──────┐                  ┌──────┴──────┐ ┌────┴────────┐
│  CV Parser  │                  │  DOCX Gen   │ │ Master CV   │
│ cvParser.js │                  │  docx.js    │ │ Compiler    │
└─────────────┘                  └─────────────┘ └─────────────┘
```

## File Structure

```
head-hunter/
├── CLAUDE.md
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── main.jsx                        ← Entry point
│   ├── App.jsx                         ← Shell, theme, state orchestration
│   ├── index.css                       ← Tailwind directives
│   ├── components/
│   │   ├── InputPanel.jsx              ← Job description + CV upload form
│   │   ├── OutputPanel.jsx             ← Tabbed results (CV/CL/LinkedIn) + display components
│   │   ├── EditableCV.jsx              ← Structured CV editing form
│   │   ├── EditableCoverLetter.jsx     ← Structured cover letter editing form
│   │   ├── FeedbackModal.jsx           ← Upload revised docs → extract style rules
│   │   ├── MasterCVCompiler.jsx        ← Upload .zip of CVs → synthesize master CV
│   │   └── SettingsModal.jsx           ← Saved CV management
│   ├── lib/
│   │   ├── claude.js                   ← API calls, generation pipeline, JSON extraction
│   │   ├── cvParser.js                 ← PDF/DOCX/TXT text extraction (client-side)
│   │   ├── docx.js                     ← Structured data → formatted .docx download
│   │   ├── storage.js                  ← localStorage wrapper (CV, theme)
│   │   ├── learnings.js                ← Learned style rules persistence
│   │   ├── feedback.js                 ← Diff analysis via Claude
│   │   └── compileMasterCV.js          ← ZIP extraction + master CV synthesis
│   └── prompts/
│       ├── cv-writer.js                ← CV tailoring prompt (→ structured JSON)
│       ├── job-research.js             ← Company research + hiring manager + LinkedIn msg
│       ├── cover-letter.js             ← Cover letter prompt (→ structured JSON)
│       ├── master-cv.js                ← Multi-CV synthesis prompt
│       └── feedback.js                 ← Diff analysis → style rules prompt
├── skills/                             ← Reference skill docs (not used at runtime)
│   ├── CV_FORMAT_SPEC.md
│   ├── COVER_LETTER_FORMAT_SPEC.md
│   ├── cv-writer/SKILL.md
│   ├── cover-letter-writer/SKILL.md
│   └── job-description-research/SKILL.md
└── public/
    └── favicon.svg
```

## Generation Pipeline

Three sequential Claude API calls per generation:

1. **CV Writer** — `jobDescription` + `masterCV` → structured `cvData` JSON
2. **Job Research** — `jobDescription` + `companyName` + CV highlights → `hiringManager`, `companyBrief`, `linkedInMessage`
3. **Cover Letter** — `jobDescription` + `tailoredCV` + `hiringManager` + `companyBrief` → structured `clData` JSON

Progress tracked via `onStep` callback: `'cv'` → `'research'` → `'coverLetter'` → `'done'`

## Structured Data Formats

### CV Data (cvData)
```js
{
  name: string,
  contact: string,
  summary: string,
  experience: [{ company: string, titleLine: string, bullets: string[] }],
  education: string[],
  skills: string[]          // format: "Category: keyword, keyword, …"
}
```

### Cover Letter Data (clData)
```js
{
  senderName: string,
  senderContact: string,    // hardcoded: "Berlin, Germany | +49 176 7794 4244 | CNimsz@gmail.com"
  date: string,
  recipient: { name, title, company, location },
  salutation: string,
  openingParagraph: string,
  bullets: string[],        // exactly 3
  closingParagraph: string,
  signatureName: string
}
```

### Job Research Output
```js
{
  companyBrief: string,     // 12 lines max
  hiringManager: { name, title, confidence: 'high'|'medium'|'low', rationale },
  linkedInMessage: string,  // <300 characters
  linkedInCharCount: number
}
```

## Key Patterns

**Browser-only execution:** All file parsing (PDF via pdfjs, DOCX via mammoth, ZIP via jszip) runs client-side. Claude API calls are proxied through a Supabase Edge Function (`head-hunter-claude`) that holds the Anthropic API key as a secret — no key is stored or exposed client-side.

**Structured output → editable forms → DOCX:** Claude returns JSON matching the schemas above. OutputPanel renders it as formatted display. Users can switch to edit mode (EditableCV / EditableCoverLetter) to modify structured fields. DOCX generation takes the structured data directly — no markdown→docx conversion needed.

**Learned preferences:** Users upload revised versions of generated docs via FeedbackModal. Claude diffs original vs revised and extracts durable style rules. Rules are stored in localStorage (`cv-toolkit:learnings:{skill}`, max 40 per skill) and appended to future prompts via `formatLearningsBlock()`.

**Master CV compiler:** Upload a .zip of multiple CV files → extract text from each → send to Claude to synthesize one comprehensive master CV → save for future tailoring.

## DOCX Formatting

- Font: Arial throughout
- CV: Name 14pt bold, section headers 11pt bold uppercase with bottom border, body 10.5pt
- Cover letter: Sender 12pt bold, body 11pt, signature 11pt bold
- Line spacing: 1.15 (276 twips)
- Margins: 1 inch all sides
- Page size: US Letter
- Bullets: Proper numbering references (not Unicode)
- Filenames: sanitized, include company + role when available

## API Configuration

All Claude API calls are proxied through a Supabase Edge Function:

```js
edge_function: 'https://kntzxuzplmuccqvpntql.supabase.co/functions/v1/head-hunter-claude'
model: 'claude-sonnet-4-20250514'
max_tokens: 8000
// Anthropic API key is stored as Supabase secret HEAD_HUNTER — never exposed to the client
```

Error handling: 429 → rate limit, plus network and JSON parse errors.

## Commands

```bash
npm run dev       # Start dev server (Vite)
npm run build     # Production build
npm run preview   # Preview production build
```

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API key storage | Supabase Edge Function secret | Key never exposed to client |
| CV parsing | pdfjs-dist + mammoth | Client-side only, no server upload |
| Response streaming | Not yet | Simpler error handling |
| State management | useState + props | App is small enough |
| Styling | Tailwind only | No custom CSS to debug |
| Output format | Structured JSON → forms | Enables editing + clean DOCX |
| Learnings | localStorage rules | Persists across sessions, no backend |

## Backlog

- [ ] Response streaming for better UX
- [ ] Application history (save past generations)
- [ ] Multiple CV profiles
- [ ] Direct LinkedIn integration
- [ ] PDF export option
