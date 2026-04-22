function formatToday() {
  const d = new Date();
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function buildCoverLetterPrompt({
  jobDescription,
  tailoredCV,
  hiringManager,
  companyBrief,
  senderName = '',
  senderContact = '',
  today = formatToday(),
  learnings = ''
}) {
  return `${learnings}
You create concise, high-impact cover letters. Maximum 12 lines, exactly 3 bullet points.

## Core Methodology: 5-to-3 Matching

### Step 1: Extract 5 Key Points from Job Description
Identify the 5 most critical requirements:
1. Must-have skills explicitly stated
2. Core responsibilities of the role
3. Problems they need solved
4. Cultural/team fit indicators
5. Industry-specific expertise required

### Step 2: Match 3 from CV
Select the 3 most powerful matches from the candidate's CV that directly address the key points.

### Step 3: Create Value-Focused Bullets
Formula: [Their need] + [Your relevant achievement] + [Implied benefit to them]

## Format Requirements

### Length: Maximum 12 Lines
The entire cover letter must fit in 12 lines (excluding header/signature).

### Structure (12 lines total)

Line 1-2: Opening Hook
- Show you understand their challenge or connect personally to the company

Line 3-4: Bridge Statement
- Why you're the right fit — transition into your evidence

Line 5-10: Three Bullet Points
- [Bullet 1: Match to Key Point #1]
- [Bullet 2: Match to Key Point #2]
- [Bullet 3: Match to Key Point #3]

Line 11-12: Confident Close
- Use a no-oriented question (Chris Voss technique)

## The No-Oriented Close

People feel safe saying "no" and anxious when pressured for "yes."

| ❌ Yes-Oriented (Weak) | ✅ No-Oriented (Strong) |
|------------------------|-------------------------|
| "I'd welcome the opportunity..." | "Would it be unreasonable to connect..." |
| "I hope to hear from you..." | "Would you be opposed to a brief conversation..." |

## Writing Rules

### Do:
- Address by name (use hiring manager if known)
- Show, don't tell — quantify everything
- Mirror their language from the job description
- Use "build" not "maintain"
- Include timeline specificity ("in under 12 months")

### Don't:
- Repeat the CV verbatim
- Use clichés ("passionate team player")
- Be generic - every sentence should be specific to THIS job
- Exceed 12 lines
- Use em-dashes (—) or en-dashes (–). Use a plain hyphen (-) and use it sparingly. Real people rarely use dashes in writing; em-dashes in particular are a well-known AI tell.

## Your Task

Write a cover letter for this application.

### Sender Identity (use EXACTLY as given — do not alter, substitute, or invent):
- senderName: ${senderName || '(extract from CV header)'}
- senderContact: ${senderContact || '(extract from CV header)'}

### Hiring Manager: ${hiringManager || 'Dear Hiring Team'}

### Company Context:
${companyBrief}

### Job Description:
${jobDescription}

### Tailored CV:
${tailoredCV}

### Output Format (JSON):
Return a single JSON object with this exact structure. No text before or after the JSON.

{
  "senderName": "<the exact senderName provided above, or the candidate's name from the CV>",
  "senderContact": "<the exact senderContact provided above, or the contact line from the CV>",
  "date": "${today}",
  "recipient": {
    "name": "Ms. Jane Smith",
    "title": "VP of Operations",
    "company": "Company Name",
    "location": "City, Country"
  },
  "salutation": "Dear Ms. Smith,",
  "openingParagraph": "2-3 sentences max. Hook + bridge to value.",
  "bullets": [
    "First proof point: their need → your achievement → implied benefit",
    "Second proof point: their need → your achievement → implied benefit",
    "Third proof point: their need → your achievement → implied benefit"
  ],
  "closingParagraph": "1-2 sentences with no-oriented close.",
  "signatureName": "<same as senderName>"
}

STRICT RULES:
- senderName / senderContact / signatureName: use the values given in "Sender Identity" above verbatim. If those are blank, fall back to the name and contact line from the Tailored CV. NEVER use placeholder or example data from this prompt.
- signatureName must equal senderName.
- openingParagraph: 2-3 sentences max.
- bullets: EXACTLY 3 items. Each is a single string, 1-2 lines max.
- closingParagraph: 1-2 sentences max. Must use a no-oriented question (Chris Voss technique).
- Total body content (opening + bullets + closing): 12 lines max.
- recipient.name: Use hiring manager name if known, otherwise null.
- recipient.title: Their job title if known, otherwise null.
- salutation: "Dear [Name]," if known, otherwise "Dear Hiring Team,"
- Do NOT include a "closing" field — the closing line "Best regards," is handled by the formatter.
- Return ONLY valid JSON. No markdown fences, no extra text, no pipe characters outside of string values.
- Pipe characters (|) are allowed INSIDE string values like senderContact.
- Ensure all strings are properly escaped for JSON.
`;
}
