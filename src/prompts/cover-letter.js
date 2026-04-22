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

Line 1 - JD Interpretation:
  "Here is what I understood from the JD: [one sentence on what the company is doing and what they need]."

Line 2 - Candidate Bio:
  "Me: [location, credentials, years of experience, domain]."

Lines 3-9 - Evidence (3 short factual bullets):
  Factual one-liners. NO bold prefixes. NO explanatory tails that tie back to the company ("giving [Company] a proven blueprint", "mirroring the challenge you face", etc.). Each bullet is a standalone fact with a number.

Line 10 - Disarming opener to close:
  "Am I way off?"

Lines 11-12 - No-oriented close:
  "Would you be opposed to a brief conversation to explore whether my background aligns with what you are building at [Company]?"

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

## AI Detection - Patterns That Get You Flagged

Cover letters are routinely screened for AI generation. The following patterns are immediate red flags. Avoid ALL of them:

### Patterns that scream AI
- "You need X:" bullet intros - the single most recognizable AI cover letter pattern. Do not use.
- Bold prefixes on bullets ("**Scaled operations:**", "**Led teams:**") - even without "You need", the parallel skeleton reads as a template.
- Explanatory tails that connect a fact back to the company: "giving [Company] a proven blueprint from day one", "directly mirroring the challenge you face today", "combining the structured reasoning your culture demands". Cut all of these. State the fact, stop.
- Meta-framing labels used as standalone headers ("What I got from the JD:", "My relevant experience:"). The "Here is what I understood from the JD:" line IS allowed because it reads as conversational, not as a content architecture label.
- Connective tissue inside bullets: "while simultaneously", "enabling a", "by establishing", "which led to". Short factual sentences only.
- Sterile, over-polished prose with no voice. If every sentence is grammatically perfect and topic-neutral, it reads as AI.
- Fluff verbs: "spearheaded", "leveraged", "orchestrated", "championed", "architected" (when used vaguely). Confident people don't need puffery. Use plain verbs: "built", "led", "ran", "shipped", "cut", "grew".

### What reads as human
- The "Me:" fragment is a strong human signal precisely because it's terse and unconventional. Keep it fragmentary.
- Short factual bullets without connectors read as a founder pitching, not a template.
- Domain specificity (regulator names, protocol names, system names the candidate actually works with) cannot be faked and anchors credibility. Pull these from the CV verbatim.
- "Am I way off?" before the no-oriented close reads as a specific person, not a model.
- Every proof point should carry a number. Metric density is hard to fake.

### The test before emitting
Read each bullet and ask: could any senior executive in this field have written this, or does it sound like this specific person? If it's generic, rewrite with more domain-specific nouns and numbers from the CV.

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
  "openingParagraph": "Here is what I understood from the JD: <one sentence>.\\nMe: <location, credentials, years of experience, domain>.",
  "bullets": [
    "Short factual one-liner with a number. No bold prefix. No tail connecting back to the company.",
    "Short factual one-liner with a number. No bold prefix. No tail connecting back to the company.",
    "Short factual one-liner with a number. No bold prefix. No tail connecting back to the company."
  ],
  "closingParagraph": "Am I way off?\\nWould you be opposed to a brief conversation to explore whether my background aligns with what you are building at <Company>?",
  "signatureName": "<same as senderName>"
}

STRICT RULES:
- senderName / senderContact / signatureName: use the values given in "Sender Identity" above verbatim. If those are blank, fall back to the name and contact line from the Tailored CV. NEVER use placeholder or example data from this prompt.
- signatureName must equal senderName.
- openingParagraph: EXACTLY two lines separated by a single \\n character. Line 1 begins "Here is what I understood from the JD:". Line 2 begins "Me:".
- bullets: EXACTLY 3 items. Each is a short factual one-liner with a metric. NO bold prefixes ("**Scaled X:**"). NO explanatory tails that connect the fact back to the company.
- closingParagraph: EXACTLY two lines separated by a single \\n character. Line 1 is "Am I way off?". Line 2 is a no-oriented close beginning "Would you be opposed to".
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
