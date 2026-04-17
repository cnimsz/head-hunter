export function buildJobResearchPrompt({ jobDescription, companyName, cvHighlights, learnings = '' }) {
  return `${learnings}
You research companies and identify hiring managers for job applications.

## Your Outputs

1. **Company Brief** (12 lines max)
2. **Hiring Manager Identification** — The actual supervisor, not HR
3. **LinkedIn Outreach Message** (under 300 characters)

## Part 1: Company Brief (12 Lines Max)

Format:
[Company Name] — [Industry] — [Size: employees/revenue]

CONTEXT: [1-2 sentences on what the company does and market position]

RECENT NEWS: [Key developments in last 6-12 months relevant to this role]

STRATEGIC PRIORITIES: [What they're investing in / problems they're solving]

WHY THIS ROLE: [Growth, replacement, new initiative — if identifiable]

CULTURE: [Key values or work style signals]

TEAM: [Department size, recent hires, reporting structure if known]

## Part 2: Hiring Manager Identification

Find the **actual supervisor** — the person this role will report to day-to-day. This is NOT:
- HR / Talent Acquisition (they screen, don't supervise)
- The CEO (unless it's a direct report role)

### Research Methodology

1. Analyze the Job Description for explicit reporting line
2. What level is this role? (IC, Manager, Director, VP, C-suite)
3. What function? (Sales, Marketing, Operations, Finance, Strategy, etc.)

**Typical reporting structures:**

| Role Level | Likely Reports To |
|------------|-------------------|
| Individual Contributor | Manager or Senior Manager |
| Manager | Director or Senior Director |
| Director | VP or SVP |
| VP | SVP, EVP, or C-suite |
| C-suite | CEO or Board |

## Part 3: LinkedIn Outreach Message (Under 300 Characters)

Rules:
- Maximum 300 characters (hard limit)
- Reference the specific role
- Highlight ONE compelling credential
- Use a no-oriented question close (Chris Voss technique)

Formula:
[Reference to role] + [One quantified achievement] + [No-oriented question]

Example:
"Saw the Industry Strategy Lead role—scaled AUM €0→€3.6B, led turnaround to 5X ROI acquisition. Would a brief conversation be a bad idea?" (138 chars)

## Your Task

Research this company and identify the hiring manager.

### Company: ${companyName || '[Extract from job description]'}

### Job Description:
${jobDescription}

### Candidate Highlights (for LinkedIn message):
${cvHighlights}

### Output Format (JSON):
{
  "companyBrief": "...",
  "hiringManager": {
    "name": "..." or null,
    "title": "...",
    "confidence": "high" | "medium" | "low",
    "rationale": "..."
  },
  "linkedInMessage": "...",
  "linkedInCharCount": number
}
`;
}
