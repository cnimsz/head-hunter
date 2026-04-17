---
name: job-description-research
description: Research companies and identify hiring managers for job applications. Use this skill after creating a CV but before writing a cover letter. Triggers include requests to research a company, find the hiring manager, identify who a role reports to, or prepare for an application. This skill finds the actual supervisor (not HR) by researching company structure, press releases, LinkedIn, and recent hires. Output includes a 12-line company brief, hiring manager identification, and a LinkedIn outreach message under 300 characters.
---

# Job Description Research Skill

Research the company and identify the hiring manager. Runs AFTER cv-writer, BEFORE cover-letter-writer.

## Workflow Position

```
1. cv-writer                    → Creates tailored CV
2. job-description-research     → THIS SKILL: Research + find hiring manager
3. cover-letter-writer          → Creates cover letter addressed to hiring manager
```

## Outputs

1. **Company Brief** (12 lines max) — Key context for tailoring the cover letter
2. **Hiring Manager Identification** — The actual supervisor, not HR
3. **LinkedIn Outreach Message** (under 300 characters) — For connection requests

---

## Part 1: Company Research (12 Lines Max)

### What to Research

1. **Company basics**: Size, revenue, industry position, headquarters
2. **Recent news**: Expansions, acquisitions, new products, leadership changes
3. **Strategic priorities**: What are they investing in? What problems are they solving?
4. **Culture signals**: Values, work style, what they celebrate
5. **Team context**: Size of the department, recent hires in this area
6. **Why this role exists**: Growth? Replacement? New initiative?

### Research Sources

| Source | What to Find |
|--------|--------------|
| Company website | About page, newsroom, leadership team, careers page messaging |
| Press releases | Recent announcements, expansions, strategic initiatives |
| LinkedIn | Company page, recent posts, employee count by function |
| News articles | Recent coverage, industry analysis, executive interviews |
| Glassdoor/Blind | Culture insights, interview experiences, org structure hints |
| Crunchbase/PitchBook | Funding, investors, growth trajectory (for startups) |
| SEC filings | 10-K, proxy statements for public companies (org charts, compensation) |

### Output Format: Company Brief (12 Lines Max)

```
[Company Name] — [Industry] — [Size: employees/revenue]

CONTEXT: [1-2 sentences on what the company does and market position]

RECENT NEWS: [Key developments in last 6-12 months relevant to this role]

STRATEGIC PRIORITIES: [What they're investing in / problems they're solving]

WHY THIS ROLE: [Growth, replacement, new initiative — if identifiable]

CULTURE: [Key values or work style signals]

TEAM: [Department size, recent hires, reporting structure if known]
```

---

## Part 2: Hiring Manager Identification

### The Goal

Find the **actual supervisor** — the person this role will report to day-to-day. This is NOT:
- HR / Talent Acquisition (they screen, don't supervise)
- The CEO (unless it's a direct report role)
- A generic "hiring team"

### Research Methodology

#### Step 1: Analyze the Job Description
- Look for explicit reporting line (e.g., "reports to the Global Industry & Accounts Growth Leader")
- What level is this role? (IC, Manager, Director, VP, C-suite)
- What function? (Sales, Marketing, Operations, Finance, Strategy, etc.)
- Who would logically supervise this level in this function?

**Typical reporting structures:**

| Role Level | Likely Reports To |
|------------|-------------------|
| Individual Contributor | Manager or Senior Manager |
| Manager | Director or Senior Director |
| Director | VP or SVP |
| VP | SVP, EVP, or C-suite |
| SVP/EVP | C-suite or CEO |
| C-suite | CEO or Board |

#### Step 2: Search LinkedIn

**Search queries to use:**
- `[Company] [Function] Director` (e.g., "EY Strategy Director")
- `[Company] [Function] VP` 
- `[Company] Head of [Function]`
- `[Company] [exact title from JD reporting line]`

**What to look for:**
- Title that would logically supervise this role
- Location match (if role is location-specific)
- Tenure (someone established, not a recent hire at same level)
- Team size mentioned in their profile
- Recent activity (are they active/posting about hiring or growth?)

#### Step 3: Search Press Releases & News

**Search queries:**
- `[Company] [Function] hire`
- `[Company] [Function] expansion`
- `[Company] appoints [Function]`
- `[Company] promotes [Function]`

**What to look for:**
- Recent leadership appointments in this function
- Quotes from leaders discussing growth/hiring
- Org changes that created this role

#### Step 4: Research Company Structure

**For large companies:**
- Check investor relations for org charts
- Look at proxy statements (DEF 14A) for executive structure
- Search for company org chart images
- Look at "Our Leadership" pages

**For startups:**
- Check Crunchbase for leadership team
- Look at "About" or "Team" page
- Search AngelList/Wellfound

#### Step 5: Cross-Reference

- Does the person's background match managing this function?
- Do they have posts about hiring or growing their team?
- Are there other team members who report to them (visible on LinkedIn)?

### Output: Hiring Manager Identification

**If confident (one clear answer):**
```
HIRING MANAGER IDENTIFIED

Name: [Full Name]
Title: [Their title]
LinkedIn: [URL]
Confidence: High

Rationale: [1-2 sentences on why this is likely the supervisor]

→ Proceeding to cover letter addressed to [Mr./Ms. Last Name]
```

**If uncertain (multiple possibilities):**
```
HIRING MANAGER CANDIDATES

The job description states this role reports to [title from JD]. 
This specific title is difficult to identify externally. Top candidates:

1. [Full Name] — [Title]
   LinkedIn: [URL]
   Rationale: [Why they might be the supervisor]

2. [Full Name] — [Title]
   LinkedIn: [URL]
   Rationale: [Why they might be the supervisor]

3. [Full Name] — [Title]
   LinkedIn: [URL]
   Rationale: [Why they might be the supervisor]

RECOMMENDATION: [Which seems most likely and why]

→ Please confirm which candidate to use, or I'll address to "Dear Hiring Team" if none can be confirmed.
```

---

## Part 3: LinkedIn Outreach Message (Under 300 Characters)

After identifying the hiring manager, create a brief connection request message.

### Rules
- **Maximum 300 characters** (LinkedIn limit for connection requests)
- Reference the specific role
- Highlight ONE compelling credential that matches their top need
- No generic "I'd love to connect"
- Use a no-oriented question close (Chris Voss technique)

### Formula
```
[Reference to role] + [One quantified achievement matching their need] + [No-oriented question]
```

### Character Counting
LinkedIn connection requests have a hard 300 character limit. Count carefully:
- Spaces count
- Punctuation counts
- Line breaks count as 1 character

### Examples

**Bad (Generic):**
> "Hi, I'd love to connect and learn more about opportunities at your company." (79 chars — but useless)

**Good (Specific + No-oriented close):**
> "Noticed the Industry Strategy Lead role at EY. I've scaled €0→€3.6B AUM and led a turnaround to 5X ROI acquisition. Would it be unreasonable to discuss how this experience could fit?" (186 chars ✓)

**Good (Shorter version):**
> "Saw the Industry Strategy Lead role—scaled AUM €0→€3.6B, led turnaround to 5X ROI acquisition. Would a brief conversation be a bad idea?" (138 chars ✓)

### Template
```
[Saw/Noticed] the [Role] role. [One quantified achievement matching their top need]. [No-oriented question: "Would it be unreasonable to..." / "Would a brief conversation be a bad idea?"]
```

---

## Integration with Other Skills

### Receives Input From: cv-writer
- Candidate's key achievements and metrics
- Relevant experience highlights
- Target role positioning

### Provides Output To: cover-letter-writer
- Hiring manager name for salutation
- Company context for opening hook
- Strategic priorities for bullet point framing
- LinkedIn message for outreach

### Handoff Format
```
═══════════════════════════════════════════════════════════════
RESEARCH COMPLETE — Ready for Cover Letter
═══════════════════════════════════════════════════════════════

HIRING MANAGER: [Name] OR "Hiring Team" (if unconfirmed)
SALUTATION: "Dear [Mr./Ms. Last Name]," OR "Dear Hiring Team,"

KEY COMPANY CONTEXT FOR COVER LETTER:
• [Point 1 to reference in opening]
• [Point 2 for bullet framing]
• [Point 3 for close]

LINKEDIN OUTREACH ([X] chars):
"[Message]"

═══════════════════════════════════════════════════════════════
```

---

## Checklist Before Handoff

- [ ] Company brief is 12 lines or fewer
- [ ] Hiring manager identified (or top 3 candidates presented)
- [ ] LinkedIn URL provided (if available)
- [ ] Rationale for hiring manager selection documented
- [ ] LinkedIn message under 300 characters
- [ ] Character count verified
- [ ] Key company context extracted for cover letter use
- [ ] User has confirmed hiring manager (if multiple candidates)

---

## Common Pitfalls to Avoid

1. **Confusing HR with the hiring manager** — Talent Acquisition screens; they don't supervise the role
2. **Defaulting to the CEO** — Unless it's a C-suite role, the CEO is rarely the direct supervisor
3. **Ignoring the JD's explicit reporting line** — If it says "reports to VP of X", search for that title
4. **LinkedIn message too long** — Count characters; 300 is a hard limit
5. **Generic LinkedIn message** — Always include a specific, quantified achievement
6. **Missing the "no-oriented" close** — Use Chris Voss technique for higher response rates
