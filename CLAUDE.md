# CV Toolkit App

One-screen web app: Paste job description → Get tailored CV, cover letter, and LinkedIn message.

## Tech Stack

- **Framework:** React 18 + Vite
- **Styling:** Tailwind CSS
- **Document generation:** `docx` npm package
- **API:** Anthropic Messages API (user provides key)
- **Storage:** localStorage
- **Deploy:** Vercel

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        APP SHELL (M1)                          │
│  Layout, theme, responsive container                           │
└─────────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   INPUT     │ │   CLAUDE    │ │   OUTPUT    │ │   STORAGE   │
│   PANEL     │ │   ENGINE    │ │   PANEL     │ │   LAYER     │
│    (M2)     │ │    (M3)     │ │    (M4)     │ │    (M5)     │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
                                                      │
                                               ┌──────┴──────┐
                                               │   DOCX GEN  │
                                               │    (M6)     │
                                               └─────────────┘
```

## File Structure

```
cv-toolkit-app/
├── CLAUDE.md              ← You are here
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── src/
│   ├── App.jsx              ← M1: Shell
│   ├── index.css
│   ├── components/
│   │   ├── InputPanel.jsx   ← M2: Input
│   │   ├── OutputPanel.jsx  ← M4: Output
│   │   └── SettingsModal.jsx
│   ├── lib/
│   │   ├── claude.js        ← M3: Engine
│   │   ├── storage.js       ← M5: Storage
│   │   └── docx.js          ← M6: Doc gen
│   └── prompts/
│       ├── cv-writer.js
│       ├── job-research.js
│       └── cover-letter.js
└── public/
    └── favicon.svg
```

## Module Status

| Module | Status | Owner | Notes |
|--------|--------|-------|-------|
| M1: App Shell | NOT STARTED | — | No dependencies |
| M2: Input Panel | NOT STARTED | — | No dependencies |
| M3: Claude Engine | NOT STARTED | — | No dependencies |
| M4: Output Panel | NOT STARTED | — | No dependencies |
| M5: Storage Layer | NOT STARTED | — | No dependencies |
| M6: Docx Generator | NOT STARTED | — | No dependencies |
| Integration | BLOCKED | — | Needs M1-M6 |
| Deploy | BLOCKED | — | Needs integration |

## Module Specs

### M1: App Shell

**File:** `src/App.jsx` + `src/index.css`

- Two-column layout (input left, output right)
- Collapses to single column on mobile (breakpoint: 768px)
- Dark/light mode toggle (persist preference)
- Header: app name + settings gear icon
- Settings modal for API key entry
- Tailwind only, no custom CSS

### M2: Input Panel

**File:** `src/components/InputPanel.jsx`

**UI Elements:**
- Job Description textarea (required, placeholder with example)
- Master CV: file upload (PDF/DOCX) OR "Use saved CV" toggle if one exists
- Company Name text field (optional, helps research step)
- Generate button (disabled until JD provided)
- Loading state with step indicator ("Creating CV...", "Researching company...", "Writing cover letter...")

**State:**
```js
{
  jobDescription: string,
  cvFile: File | null,
  useSavedCV: boolean,
  companyName: string,
  isGenerating: boolean,
  currentStep: 'idle' | 'cv' | 'research' | 'coverLetter' | 'done'
}
```

### M3: Claude Engine

**File:** `src/lib/claude.js`

**Main function:**
```js
async function generateApplication({ 
  apiKey, 
  jobDescription, 
  cvText, 
  companyName 
}) → {
  cv: string,
  coverLetter: string,
  linkedInMessage: string,
  hiringManager: string | null,
  companyBrief: string
}
```

**Flow:**
1. Call CV Writer prompt → get tailored CV
2. Call Job Research prompt → get company brief + hiring manager + LinkedIn message
3. Call Cover Letter prompt (with CV + research context) → get cover letter
4. Return structured object

**API call pattern:**
```js
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }]
  })
});
```

**Error handling:** Throw with descriptive messages for: invalid API key, rate limit, network error, malformed response.

### M4: Output Panel

**File:** `src/components/OutputPanel.jsx`

**UI Elements:**
- Tabs: CV | Cover Letter | LinkedIn
- Hiring manager badge (if identified): "Addressed to: [Name]"
- Content area: rendered markdown/text
- Action buttons per tab:
  - Copy to clipboard
  - Download .docx (CV and Cover Letter only)
- Empty state when no output

### M5: Storage Layer

**File:** `src/lib/storage.js`

```js
// API Key
saveApiKey(key: string): void
getApiKey(): string | null
clearApiKey(): void

// Master CV (stores extracted text + original filename)
saveMasterCV(text: string, filename: string): void
getMasterCV(): { text: string, filename: string } | null
clearMasterCV(): void

// Settings
saveTheme(theme: 'light' | 'dark'): void
getTheme(): 'light' | 'dark'
```

**Implementation:** localStorage with `cv-toolkit:` prefix for all keys.

### M6: Docx Generator

**File:** `src/lib/docx.js`

```js
async function generateCVDocx(content: string, candidateName: string): Promise<Blob>
async function generateCoverLetterDocx(content: string, recipientName: string): Promise<Blob>
```

**Formatting:**
- Font: Arial 11pt
- Margins: 1 inch
- Headings: Bold, 14pt
- Bullets: Proper list formatting (not unicode bullets)
- Page size: US Letter

## Prompts

Store prompts as JS template literals in `src/prompts/`. Each exports a function that takes inputs and returns the full prompt string.

**cv-writer.js:** Embed full CV Writer skill. Input: `{ jobDescription, masterCV }`

**job-research.js:** Embed full Job Research skill. Input: `{ jobDescription, companyName, cvHighlights }`

**cover-letter.js:** Embed full Cover Letter skill. Input: `{ jobDescription, tailoredCV, hiringManager, companyBrief }`

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API key storage | localStorage | Simple, user controls their key, no backend needed |
| CV parsing | PDF.js for PDF, mammoth for DOCX | Client-side, no upload to server |
| Response streaming | No (V1) | Simpler error handling, add in V2 |
| State management | React useState + props | App is small, no need for Redux/Zustand |
| Styling | Tailwind only | Fast, consistent, no CSS debugging |

## Commands

```bash
# Dev
npm run dev

# Build
npm run build

# Preview production build
npm run preview
```

## V2 Backlog (Not V1)

- [ ] Response streaming for better UX
- [ ] Application history (save past generations)
- [ ] Multiple CV profiles
- [ ] Direct LinkedIn integration
- [ ] PDF export option
- [ ] Editable outputs before download
