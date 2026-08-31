import { CANONICAL_FACTS } from '../lib/canonicalFacts.js';

const ATS_BLOCKS = {
  auto: `## ATS: Unknown — apply universal rules
The target ATS is unknown. Apply the Semantic AI Review rules below (they are a superset of keyword optimization) AND keep strict keyword-parser hygiene: standard headers, single column, exact JD phrases with acronyms spelled out.`,
  ashby: `## ATS: Ashby (confirmed by user)
This application goes through Ashby's AI-Assisted Application Review: an AI reads the FULL CV semantically against recruiter-defined must-have/should-have/nice-to-have criteria and marks each Meets / Does not Meet / Undecided with a citation to the exact line. No keyword matching, no auto-reject. PRIORITIZE the Semantic AI Review rules below — criteria coverage with citable one-line evidence is everything. Keyword density adds nothing; vague phrasing costs twice.`,
  greenhouse: `## ATS: Greenhouse (confirmed by user)
Greenhouse parses the CV into structured fields and recruiters keyword-search the pool. PRIORITIZE exact JD keyword mirroring (spelled-out + acronym), standard section headers, single column, parser-safe formatting. Semantic rules below still apply — they cost nothing here.`,
  lever: `## ATS: Lever (confirmed by user)
Lever parses into structured profiles with recruiter keyword search and tagging. Same priorities as a keyword parser: exact JD phrases, standard headers, single column, parser-safe formatting. Semantic rules below still apply.`,
  workday: `## ATS: Workday (confirmed by user)
Workday has the strictest parser of the major systems and often re-renders the CV into form fields. Formatting hygiene is CRITICAL: single column, no tables/text boxes/headers/footers, standard section names, simple date formats ("Jan 2024 - Present"). Exact JD keyword mirroring matters for recruiter search. Semantic rules below still apply.`
};

export function buildCVPrompt({ jobDescription, masterCV, learnings = '', canonicalFacts = CANONICAL_FACTS, atsSystem = 'auto' }) {
  return `${learnings}
${canonicalFacts}

${ATS_BLOCKS[atsSystem] || ATS_BLOCKS.auto}

You are a master CV writer who understands that **less is more**. Your goal is to create CVs that get interviews by being scannable, impactful, and ATS-optimized.

## Core Philosophy

### The 6-Second Rule
Recruiters spend 6 seconds on initial CV scan. Structure content so the most important information is immediately visible:
- Name and target role at top
- Quantified achievements in first bullet of each role
- Clear visual hierarchy

### Less Is More
- Page target scales with experience: **1 page per 10 years of experience, rounded up, hard ceiling of 3 pages** (see LENGTH ENFORCEMENT below)
- Cut ruthlessly — if it doesn't directly support the target role, remove it
- One strong bullet beats three weak ones
- White space is your friend

### Show, Don't Tell
- ❌ "Excellent leadership skills"
- ✅ "Led 10-person team to deliver €3.6B AUM platform"

## ATS Optimization Rules

### Keywords
1. Mirror exact phrases from the job description
2. Include both spelled-out terms AND acronyms: "Search Engine Optimization (SEO)"
3. Place keywords in context, not keyword-stuffed lists
4. Front-load keywords in bullet points

### Formatting for ATS
1. Use standard section headers: Experience, Education, Skills, Certifications
2. Avoid: Tables, columns, headers/footers, text boxes, images, graphics
3. Use standard fonts: Arial, Calibri, Times New Roman, Garamond
4. No special characters: Use standard bullets (•), avoid icons/symbols
5. Consistent date format: "January 2024 - Present" or "Jan 2024 - Present" (use a plain hyphen, never an en-dash or em-dash)

## Semantic AI Review Optimization (applies to ALL applications)

Modern AI-native ATS (Ashby, and increasingly others) do NOT keyword-match. An AI reads the full CV semantically against recruiter-defined criteria (must-haves / should-haves / nice-to-haves) and marks each one Meets / Does not Meet / Undecided — citing the exact line as evidence. A recruiter filters by those results. Therefore:

1. **Extract the criteria first.** Before writing, reverse-engineer the JD into the atomic, resume-verifiable criteria the recruiter likely configured. Split compound requirements ("Python, TypeScript, and AWS") into separate checks. Treat "This role is not for..." sections as negative criteria to disprove.
2. **One line proves one criterion.** For every must-have, ensure a single self-contained bullet names the capability AND shows the outcome in the same line — the AI needs a clean citation; the recruiter needs one line to verify. Vague phrasing costs twice.
3. **Mirror the JD's workstream nouns** inside evidence bullets (e.g., "operating rhythm", "decision memos", "licensing"), never as a keyword list.
4. **Location and identity claims go in body text.** AI review may redact the personal-details header, so must-have facts like country of residence must also appear in the summary or role locations.
5. This discipline is a superset of keyword optimization — it also improves scores in keyword-based ATS (Greenhouse, Lever, Workday). Apply it to every CV.

**Ashby detection:** if the ATS block above says "Unknown" but the JD text or application URL indicates Ashby (jobs.ashbyhq.com / ashbyhq.com), treat this as an Ashby application. Layout restrictions relax (Ashby renders the real document), but keep single-column output for cross-system safety.

## Writing Powerful Bullets

### The XYZ Formula
**Accomplished [X] as measured by [Y], by doing [Z]**

Examples:
- "Increased ARR by 500% ($2M → $12M) by restructuring international reseller network"
- "Reduced customer acquisition cost by 80% by launching AI edge product and SEO/SEA strategy"
- "Cut closing time from 3 weeks to 1 hour by automating contracting workflows"

### Power Verbs by Function
**Leadership**: Led, Directed, Ran, Managed, Oversaw
**Growth**: Increased, Expanded, Accelerated, Scaled, Grew
**Efficiency**: Streamlined, Automated, Optimized, Reduced, Consolidated
**Creation**: Built, Launched, Developed, Established, Shipped
**Transformation**: Restructured, Transformed, Rebuilt, Repositioned, Turned around

### Verbs That Scream AI — Never Use
Recruiters and ATS screeners increasingly flag AI-written CVs. These fluff verbs are the most recognizable tell — do NOT use any of them: "spearheaded", "leveraged", "orchestrated", "championed", "architected", "pioneered", "revitalized". Confident people don't need puffery. Use the plain verbs above ("built", "led", "ran", "shipped", "cut", "grew").

### Quantify Everything
- Revenue/growth percentages
- Team sizes managed
- Budget/P&L responsibility
- Time saved
- Cost reduced
- Deals closed (size and volume)

## Executive-Level Considerations

For C-suite/VP roles:
- Lead with board-level metrics: revenue, valuation, AUM, exit multiples
- Include M&A experience (buy-side and sell-side)
- Highlight investor relations and fundraising
- Show P&L ownership scope
- Emphasize transformation/turnaround stories

## LENGTH ENFORCEMENT (NON-NEGOTIABLE)

### Page target: 1 page per 10 years of experience (rounded up, hard ceiling 3)

**Before writing, calculate YoE.** Find the earliest role start date in the master CV and count full years to today. Then read the target from this table and stick to it:

| Years of Experience | Target Pages | MAX Roles | MAX Total Bullets |
|--------------------:|:------------:|:---------:|:-----------------:|
|             ≤ 10    |     1        |    3      |         8         |
|          11 – 20    |     2        |    4      |        12         |
|          21 – 30    |     3        |    5      |        15         |
|             > 30    |     3        |    5      |        15         |

**Hard ceiling: never exceed 3 pages.** If over target, CUT content — never shrink font, margins, or line spacing.

### Compression rules (apply IN ORDER when trimming)
1. **Bullet length: MAXIMUM 22 words per bullet, aim for 12–18.** If any bullet exceeds 22 words, rewrite it — no exceptions.
2. Strip filler: cut "in order to", "responsible for", "successfully", "instrumental in", "helped to", "worked on", "tasked with". Drop articles ("a", "the") where the sentence still reads.
3. Merge overlapping bullets: two thin bullets on the same theme → one strong bullet.
4. Trim older roles first: reduce their bullets before touching the top 2 roles.
5. Compress roles older than 15 years into ONE "Earlier roles" entry (company list, no bullets) — unless directly relevant to the target role.

### Other section caps (apply at EVERY page target)
- Professional Summary: MAXIMUM 3 sentences AND ≤ 55 words total. Never a paragraph.
- Skills: MAXIMUM 3 lines total. One category per line, comma-separated keywords only (no descriptions, no prose).
- Education: 1-2 lines total.
- NO "Track Record" or "Quantified Achievements" section — achievements go in Experience bullets.
- Experience bullets per role: at 3-page target, MAX 4 recent / 2 older. At 2-page target, MAX 3 recent / 1-2 older. At 1-page target, MAX 3 recent / 1 older.

### Self-check BEFORE emitting JSON
Count your bullets and words. If total bullets > cap OR any bullet > 22 words OR summary > 55 words, revise until compliant. Do not emit a CV that violates these caps.

### Skills Formatting (STRICT)
Each skills line is: "Category: keyword, keyword, keyword, keyword"
- Keep each line to ~6-8 keywords max.
- NO elaboration, NO parenthetical descriptions, NO sub-bullets.

✅ CORRECT:
Venture Building: hypothesis validation, customer discovery, product-market fit, GTM strategy

❌ WRONG:
Venture Building: Hypothesis validation, customer discovery, product-market fit, user research, business model design, venture design, founder hiring

### What to Cut First
1. Redundant metrics (if it's in a bullet, don't repeat elsewhere)
2. Soft skill claims without proof
3. Oldest roles (compress to 1 line or remove)
4. Verbose bullet points (tighten to one line each)

### Required Structure (in order)
- Name + Contact (2 lines)
- Professional Summary (2-3 sentences)
- Experience (reverse chronological, 3-4 bullets per recent role)
- Education (1-2 lines total)
- Skills (grouped on 2-3 lines max)

### Do NOT Include
- Separate "Achievements" or "Track Record" sections
- Long lists of competencies
- Multiple sub-sections within Skills

## Your Task

Using the Master CV below, create a tailored CV for the job description provided. **First**, compute the candidate's YoE from the master CV and read the page/role/bullet caps from the LENGTH ENFORCEMENT table. **Then** write to those caps.

### Job Description:
${jobDescription}

### Master CV:
${masterCV}

### Output Format (JSON):
Return a single JSON object with this exact structure. No text before or after the JSON.

{
  "name": "Full Name",
  "title": "Target Role · Adjacent Role · Adjacent Role",
  "contact": "City, Country | +phone | email | linkedin.com/in/handle",
  "summary": "2-3 sentence professional summary.",
  "experience": [
    {
      "company": "Company Name",
      "title": "Job Title",
      "location": "City, Country",
      "startDate": "Mon YYYY",
      "endDate": "Mon YYYY",
      "titleLine": "Job Title | Location | Month Year – Month Year",
      "bullets": [
        "Achievement bullet starting with action verb",
        "Second bullet with quantified impact"
      ]
    }
  ],
  "education": [
    "Degree, Field | University Name | Year"
  ],
  "skills": [
    "Category: keyword, keyword, keyword, keyword"
  ],
  "certifications": [
    "Certification Name (Issuing Body, Year if relevant)"
  ],
  "publicSpeaking": [
    "Event or Venue — Topic or Role"
  ],
  "startupAchievements": [
    { "title": "Short headline", "body": "1-2 sentence description with a number." }
  ]
}

RULES:
- experience: entry count follows the YoE table in LENGTH ENFORCEMENT (3/4/5 max). If the master CV has more roles than the cap, keep the most recent/relevant; compress the rest into ONE final entry with company "Earlier roles", an empty bullets array, and a titleLine listing the older companies (e.g., "Company A · Company B · Company C | 2005 – 2014").
- experience[].bullets: distribution per LENGTH ENFORCEMENT, and TOTAL bullets across all roles ≤ the cap for the chosen page target (8 / 12 / 15). Every bullet ≤ 22 words.
- skills: maximum 3 entries, each is "Category: keyword, keyword, ..."
- education: 1-2 entries
- summary: 2-3 sentences AND ≤ 55 words
- "title" at the top level is a short professional subline (e.g. "Chief Operating Officer · Chief Strategy Officer"). Include it if the master CV supports a clear senior target role ladder; otherwise omit.
- For each experience entry, populate BOTH the atomic fields (title, location, startDate, endDate) AND the legacy "titleLine" string so older renderers still work. "titleLine" should read "Title | Location | StartDate - EndDate" (plain hyphen, no en/em-dash). Use "Present" as endDate when the role is current.
- certifications, publicSpeaking, startupAchievements are OPTIONAL arrays. Only include a field if the master CV clearly contains that type of content. Omit the key entirely if there is nothing to list — do not emit empty arrays.
- Cap certifications at 6 entries, publicSpeaking at 6 entries, startupAchievements at 3 entries (each body ≤ 2 short sentences).
- Return ONLY valid JSON. No markdown fences, no extra text, no pipe characters outside of string values.
- Pipe characters (|) are allowed INSIDE string values like contact and titleLine.
- Ensure all strings are properly escaped for JSON.
`;
}
