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
[Line 1-2: Opening Hook]
Engaging opener that shows you understand their challenge or connects personally to the company.

[Line 3-4: Bridge Statement]  
Why you're the right fit — transition into your evidence.

[Line 5-10: Three Bullet Points]
• [Bullet 1: Match to Key Point #1]
• [Bullet 2: Match to Key Point #2]  
• [Bullet 3: Match to Key Point #3]

[Line 11-12: Confident Close]
Forward-looking statement + clear call to action.
```

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
- **Don't exceed 12 lines** — If you can't be concise, you won't get read

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

[Opening Hook: Reference a specific company challenge, recent news, or why this role excites you — show you've done your research and understand their world.]

[Bridge: One sentence positioning yourself as the solution to their needs.]

• [Key Point 1: Their need → Your achievement → Implied benefit]
• [Key Point 2: Their need → Your achievement → Implied benefit]
• [Key Point 3: Their need → Your achievement → Implied benefit]

[No-Oriented Close: "Would it be unreasonable to connect and explore how this experience could [specific benefit for them]?"]

Best regards,
[Name]
```

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
- [ ] Exactly 3 bullet points
- [ ] Each bullet connects their need → your proof → their benefit
- [ ] Hiring manager addressed by name (or "Dear Hiring Team" if unavailable)
- [ ] Opening references something specific about the company
- [ ] No clichés or generic phrases
- [ ] Quantified achievements in bullets
- [ ] No-oriented close (Chris Voss technique)
- [ ] Keywords from job description naturally included
- [ ] Does NOT repeat CV verbatim — adds context

---

## Integration with CV Writer Skill

This skill is designed to run as part of a complete application package:

1. **First**: Run `cv-writer` skill to create tailored 2-page CV
2. **Then**: Run `cover-letter-writer` skill using same JD and CV
3. **Output**: Cohesive application where CV provides depth and cover letter provides narrative

The cover letter should complement, not duplicate, the CV. If the CV shows WHAT you did, the cover letter explains WHY it matters to THIS employer.
