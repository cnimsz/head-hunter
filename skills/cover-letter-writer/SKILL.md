---
name: cover-letter-writer
description: Creates concise, high-impact cover letters (max 12 lines, 3 bullet points). Use this skill whenever the user asks to write, create, or draft a cover letter, application letter, or letter of introduction for a job application. This skill MUST run after the cv-writer and job-description-research skills. Triggers include requests for cover letters, application letters, or when a user has just created a CV and needs to complete their application package.
---

# Cover Letter Writer Skill

Creates concise, high-impact cover letters that complement the CV. 

## Workflow Position

```
1. cv-writer                    → Creates tailored CV
2. job-description-research     → Researches company + identifies hiring manager
3. cover-letter-writer          → THIS SKILL: Creates cover letter
```

## Prerequisites Check

Before writing a cover letter, verify you have:
1. **Job description** — Required to identify employer's key needs
2. **Master CV or tailored CV** — Required to match candidate's experience
3. **Hiring manager name** (optional but preferred) — From job-description-research skill

If JD or CV is missing, prompt the user:
> "To create an effective cover letter, I need:
> 1. The job description (paste or upload)
> 2. Your CV or Master CV
> 
> Please provide these so I can match your experience to the employer's specific needs."

If hiring manager is available from research, address the letter to them.
If not, use "Dear Hiring Team,"

---

## Core Methodology: 5-to-3 Matching

### Step 1: Extract 5 Key Points from Job Description
Analyze the job description and identify the **5 most critical requirements** the employer is seeking. Prioritize:
1. Must-have skills explicitly stated
2. Core responsibilities of the role
3. Problems they need solved
4. Cultural/team fit indicators
5. Industry-specific expertise required

### Step 2: Match 3 from Master CV
Review the candidate's CV and select the **3 most powerful matches** — achievements, experiences, or skills that directly address one of the 5 key points. Choose matches that:
- Have quantified results (metrics, percentages, revenue)
- Demonstrate solving similar problems
- Show relevant industry/domain expertise
- Are from recent, relevant roles

### Step 3: Create Value-Focused Bullets
Write 3 bullet points that:
- Lead with the employer's need (not your achievement)
- Connect your experience to their specific challenge
- Show the outcome/value you delivered
- Imply future success for them

**Formula**: [Their need] + [Your relevant achievement] + [Implied benefit to them]

---

## Format Requirements

### Length: Maximum 12 Lines
The entire cover letter must fit in 12 lines or fewer (excluding header/signature). This forces precision and respects the recruiter's time.

### Structure (12 lines total)

```
[Line 1: JD Interpretation]
"Here is what I understood from the JD: [one sentence on what the company is doing and what they need]."

[Line 2: Candidate Bio]
"Me: [location, credentials, years of experience, domain]."

[Line 3-9: Evidence — prose OR short factual bullets]
Either fold all three proof points into one dense paragraph,
OR use 3 short factual bullets without bold prefixes or explanatory tails.

[Line 10: Disarming opener to close]
"Am I way off?"

[Line 11-12: No-Oriented Close]
"Would you be opposed to a brief conversation to explore whether my background aligns with what you are building at [Company]?"
```

---

## AI Detection — Critical Rules

Cover letters are now routinely screened for AI generation. The following patterns are **immediate flags** to a savvy recruiter or hiring manager. Avoid all of them:

### Patterns that scream AI
- **"You need X:"** bullet intros — the single most recognizable AI cover letter pattern
- **Three parallel bold-prefixed bullets** — the skeleton is visible even without "You need"
- **Explanatory tail sentences** that connect back to the company: "giving [Company] a proven blueprint from day one," "directly mirroring the challenge you face today," "combining the structured reasoning your culture demands" — cut all of these
- **Meta-framing labels** like "What I got from the JD:" as a standalone header — reads as AI content architecture
- **Complete sentences with connective tissue** in bullets: "while simultaneously," "enabling a," "by establishing," "which led to"
- **Sterile prose** — clean to the point of having no voice or personality

### What reads as human
- **"Me:" fragment** — terse, confident, unconventional; the single strongest human signal
- **Short factual bullets without connectors** — reads as a founder pitching, not a template
- **Domain specificity** — BaFin, CSSF, JFSC, S110, eIDAS etc. cannot be faked and anchors credibility
- **Idiosyncratic framing** — "Am I way off?" before the Voss close signals a specific person, not a model
- **Metric density** — numbers in every proof point

### The test before delivering
Read the letter and ask: could this have been written by any senior executive in this field, or does it sound like *this specific person*? If the former, it will be flagged. The "Me:" line and domain specifics are what make it the latter.

---

## Research-Backed Best Practices

### What Recruiters Actually Want (Zety 2024 Survey of 753 Recruiters)
- **27%** look for relevant experience connecting to role demands
- **24%** assess personality and communication ability
- **19%** check for connection to the company
- **13%** verify understanding of job description
- **9%** want to learn motivation
- **4%** notice quantifiable achievements

**Implication**: Lead with relevant experience, demonstrate communication skill through concise writing, and show you researched the company.

### Critical Statistics
- **83%** of hiring managers say a great cover letter can land an interview even with a weak resume
- **81%** of recruiters have rejected applicants based solely on cover letters
- **89%** of hiring professionals expect cover letters
- **Stories are 22x more memorable than facts** — frame achievements as mini-narratives

### The Problem-Solution Format Wins
Research shows the Problem-Solution format outperforms all others:
1. Identify their problem/challenge
2. Position yourself as the solution
3. Provide evidence you've solved similar problems before

---

## Writing Rules

### Do:
- **Address by name** — Research the hiring manager; never use "To Whom It May Concern"
- **Show, don't tell** — "Led turnaround delivering 5X ROI" not "Strong leadership skills"
- **Quantify everything** — Numbers are proof; claims without numbers are opinions
- **Mirror their language** — Use keywords from the job description
- **Research the company** — Reference recent news, challenges, or initiatives
- **Use a no-oriented close** — See Chris Voss technique below

### Don't:
- **Don't repeat the CV** — The cover letter adds context, not redundancy
- **Don't use clichés** — "Passionate team player" tells them nothing
- **Don't be generic** — Every sentence should be specific to THIS job at THIS company
- **Don't apologize** — Never highlight what you lack; focus on what you bring
- **Don't use bullet points in isolation** — Bullets need context from the surrounding prose
- **Don't use "—", use "-"** — People don't use this "—" they use "-" and not very often
- **Don't exceed 12 lines** — If you can't be concise, you won't get read
- **Don't use fluff words like "spearheaded"** — Confident people don't need to use puffery

---

## The No-Oriented Close (Chris Voss Technique)

From FBI hostage negotiator Chris Voss ("Never Split the Difference"): People feel safe saying "no" and anxious when pressured for "yes." A no-oriented question flips this — phrase your close so "no" gives you what you want.

### Why It Works
- "Yes" feels like commitment/trap → creates resistance
- "No" feels safe/protective → lowers guard
- Saying "no" gives the reader a sense of control and agency

### The Transformation

| ❌ Yes-Oriented (Weak) | ✅ No-Oriented (Strong) |
|------------------------|-------------------------|
| "I'd welcome the opportunity to discuss..." | "Would it be unreasonable to connect..." |
| "I hope to hear from you..." | "Would you be opposed to a brief conversation..." |
| "I look forward to speaking with you..." | "Is there any reason we shouldn't discuss..." |
| "Can we schedule a call?" | "Would it be a bad idea to schedule a call?" |

### Best No-Oriented Closes for Cover Letters

1. **"Would it be unreasonable to connect and explore how this experience could drive results for [Company]?"**
2. **"Is there any reason we shouldn't discuss how I could contribute to [specific goal]?"**
3. **"Would you be opposed to a brief conversation about [specific value you'd bring]?"**

**Note**: Don't overuse or it becomes manipulative. One no-oriented question in the close is enough. Keep it natural and professional.

---

## Template

```
Dear [Hiring Manager Name],

Here is what I understood from the JD: [One sentence — what the company is building and what the role requires].

Me: [Location], [credentials], [CXO/title] [X]+ years [domain expertise].
[Proof point 1 — fact. Proof point 2 — fact. Proof point 3 — fact with metric.]

Am I way off? Would you be opposed to a brief conversation to explore whether my background aligns with what you are building at [Company]?

Best regards,
[Full Name]
```

**Prose variant** (when bullets feel too structured):
Fold all three proof points into the "Me:" paragraph as consecutive sentences. No bullets, no bold, no connectors — just facts separated by periods.

**Bullet variant** (when facts are distinct enough to scan):
Use plain bullets without bold prefixes. No "You need X:" framing. No explanatory tails. Each bullet is one or two clipped sentences — fact, metric, done.

---

## Example: Applying the 5-to-3 Method

**Job**: VP of Sales at SaaS Company

**5 Key Points from JD**:
1. Scale ARR from $10M to $50M
2. Build and lead enterprise sales team
3. Develop partner/channel strategy
4. Implement sales methodology (MEDDIC)
5. Board-level reporting and forecasting

**3 Best Matches from CV**:
1. "Achieved 500% ARR growth by restructuring partner network"
2. "Recruited and trained team of 10 from Goldman Sachs, BlackRock"
3. "Implemented BANT/MEDDICC frameworks, doubling forecast accuracy"

**Resulting Bullets**:
• Scaling ARR through partnerships: Drove 500% ARR growth at CI HUB by restructuring the international reseller network—experience directly applicable to your channel expansion goals.
• Building elite sales teams: Recruited and developed a 10-person team from top-tier firms (Goldman Sachs, BlackRock) to service 30+ institutional clients at Scaling Funds.
• Sales methodology and forecasting: Implemented BANT/MEDDICC qualification frameworks that doubled forecast accuracy and sales pipeline quality.

---

## Output Checklist

Before delivering the cover letter, verify:
- [ ] Maximum 12 lines (excluding header/signature)
- [ ] Opens with "Here is what I understood from the JD:" framing
- [ ] "Me:" fragment as bio line — not a full sentence
- [ ] Proof points are facts with metrics — no explanatory tails connecting back to the company
- [ ] No "You need X:" bullet framing
- [ ] No three parallel bold-prefixed bullets
- [ ] No connective tissue: "while simultaneously," "enabling a," "combining the," "directly mirroring"
- [ ] "Am I way off?" before the Voss close
- [ ] No-oriented close (Chris Voss technique) — signed with full name
- [ ] Domain specifics present (regulators, frameworks, institutions by name)
- [ ] Passes the human voice test: sounds like THIS person, not any senior executive

---

## Integration with CV Writer Skill

This skill is designed to run as part of a complete application package:

1. **First**: Run `cv-writer` skill to create tailored 2-page CV
2. **Then**: Run `cover-letter-writer` skill using same JD and CV
3. **Output**: Cohesive application where CV provides depth and cover letter provides narrative

The cover letter should complement, not duplicate, the CV. If the CV shows WHAT you did, the cover letter explains WHY it matters to THIS employer.
