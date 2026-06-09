# Gap Analysis — Reference Output

> This is the canonical example of the `cv-gap-analysis` skill's output quality. Captured from a May 29, 2026 strategy session in claude.ai. The skill should produce analysis at this depth, with this structure and tone, not a watered-down generic version.
>
> **Context:** Candidate is Colin Nimsz (Berlin-based commercial executive). The CV being analyzed was tailored for the Fireblocks "Sales Director, Dynamic" role (greenfield EMEA seat selling embedded-wallet infrastructure post the Dynamic acquisition). The CV had already been gap-filled once for deal sizes, methodologies, and US time-zone overlap — so this second pass surfaces what remained.

---

## Quality bar — what "good" looks like

A gap analysis run should produce:

1. **Three tiers of gaps**, ranked by interview-blocking impact:
   - **Highest-impact** — quantitative claims a recruiter will literally scan for (deal sizes, quota %, AUM, headcount). 1–3 gaps in this tier.
   - **Medium-impact** — structural credibility signals (sales methodology, language fluency, time-zone overlap, certifications). 1–3 gaps in this tier.
   - **Hiding-in-background** — likely the candidate has the data but it isn't surfaced (pipeline metrics, win rates, named accounts, niche speaking venues). 1–3 gaps in this tier.

   Total across all three tiers: **3–9 gaps**. Be selective — only surface gaps that are genuinely interview-blocking; do not pad to hit the upper bound.

2. **Each gap has three parts:**
   - **Title** — what's missing, in one phrase
   - **Rationale** — why it matters specifically for *this* role, with concrete reference to the hiring company's context (named hiring manager, named customers, named verticals)
   - **Question** — a single sentence the candidate can answer in one sentence back

3. **A reframe** at the end if applicable — something that looks like a weakness but is actually a strength for this specific role, with one suggested positioning line to capture it.

4. **A "shortest path forward" close** — the smallest number of questions (3–5) whose answers unlock the most material CV improvements. Numbered, terse, no preamble.

---

## Reference output (verbatim from May 29, 2026)

> Note: this capture has 10 gaps — it predates the 2026-06-09 tightening from 8–12 to **3–9**. Match its depth, named specificity, and tone, but not its count.


Honest gap analysis against the JD. I'll rank them by interview-blocking impact, then tell you which ones I can plug if you give me the data.

### Highest-impact gaps

**1. Deal sizes (ACV/TCV).** The CV says "closed enterprise deals with Honda, VW, Siemens" but never names the contract value. For a Sales Director role evaluating quota credibility, this is the single biggest miss. Fireblocks' sellers carry six- and seven-figure ACV territories — Dakin will scan for that number. If any of those deals were €100K+ ACV, multi-year, or expansion deals, we should name the figure. Even ranges work ("€150K–€500K ACV enterprise contracts").

**2. Quota attainment.** Nowhere in the CV does a quota number appear. "500% ARR growth" is a company metric, not a personal one. Senior sales hiring almost always asks "what was your number and what % did you hit?" If you have any year where you hit 100%+ of quota at Brighter AI or CI HUB, that's a free line. President's Club, top regional rep, fastest to ramp — anything like that should go in.

**3. Crypto-native customer experience.** Dynamic's existing customer roster is heavily crypto-native — Circle, Kraken, Stripe, Magic Eden, Rain, Lighter. Your CV is strong on TradFi/institutional (BlackRock-pedigree team, regulators, tokenized funds) but light on direct sales to exchanges, wallets, fintechs, or stablecoin issuers. Have you sold to or partnered with anyone in that segment? Even one named logo would change the read.

### Medium-impact gaps

**4. German language proficiency.** Berlin-based ≠ native-German. The JD doesn't require German, but Dakin building out DACH coverage will absolutely care. Are you native, C1, B2, or English-only? If you're C1+, this goes in the Core Competencies row immediately.

**5. US time-zone overlap.** The JD specifically requires "comfortable having some overlap with US time zones." Berlin is 6 hours ahead of NYC. The role has heavy US headquarters interaction and Dynamic is a US-based acquisition. A one-line note in the summary like "operates with daily US East Coast overlap" removes a silent objection.

**6. Sales methodology / certifications.** No MEDDIC, MEDDPICC, Challenger Sale, Sandler, Force Management, or Command of the Message reference. Fireblocks runs a structured sales motion. If you've been formally trained on any of these (or used them in practice — Brighter AI or CI HUB likely had a methodology), that's an instant credibility line.

**7. Active customer/partner network.** The Porter angle works in part because BNY is a Fireblocks customer. Do you have warm relationships into any other Fireblocks customers — BNP Paribas, ANZ, Revolut, Stripe, Circle, Kraken, Bankhaus von der Heydt (the German bank that uses Fireblocks)? Or into the DACH banking buyer pool (Deutsche Bank, Commerzbank, DZ, LBBW, Helaba, Bankhaus Lampe)? Even 2-3 named accounts where you have a buying contact = a "first 90 days" pipeline story.

### Things that might be hiding in your background

**8. Pipeline / forecast metrics.** "Doubled qualified pipeline" is in there but vague. Do you remember: pipeline volume in €, win rate %, average sales cycle, ASP? Any of these numbers turn soft claims into hard ones.

**9. Crypto-native speaking / writing.** Speaking at BaFin/ECB/Oxford is institutional gravitas. But have you ever spoken or written at Consensus, EthDenver, EthCC, DevCon, Permissionless, Token2049, Money 20/20? Even one crypto-native venue rebalances the perceived center of gravity from "regulator-friendly" to "crypto-native AND regulator-friendly," which is exactly Fireblocks' positioning.

**10. Direct MPC / wallet security understanding.** Fireblocks' core tech is MPC-CMP and TEEs. You don't need to be an engineer, but signalling familiarity ("conversant in MPC wallet architecture, key management, and policy engines") in the summary lets the reader pre-qualify you as not-just-a-sales-suit.

### A reframe — not a gap, but worth knowing

Your TradFi heaviness is **not** a weakness for this role even though Dynamic's roster is crypto-native. Fireblocks' 2026 thesis (per their "Financial Grid" report) is that banks and TradFi institutions are the *next* embedded-wallet adopters. A Dynamic seller who can credibly walk into Deutsche Bank and explain why they need embedded wallets is more valuable than one more crypto-native rep. We can lean into this if you want — add a positioning line in the summary like "Bridges crypto-native infrastructure to TradFi buyers — the institutional adoption gap Fireblocks is solving."

---

**The shortest path forward:** answer me on these four, and I'll regenerate the CV with the gaps filled in your next reply.

1. Largest single deal ACV/TCV you personally closed, and at which company
2. Any quota attainment number ≥100% you can cite (year + % is fine)
3. German language level (native / C1 / B2 / B1 / none)
4. Any direct sales or partnership relationship into a crypto-native firm or a Fireblocks-adjacent buyer (named is best, but "yes — exchange in DACH" works)

If the answer to any of these is "I don't have that," tell me and I'll leave it out cleanly rather than fudge it. Half-truths on a CV that goes to a VP of EMEA Sales fail fast in the screen.

---

## What the skill should learn from this example

Six properties to replicate:

1. **Named specificity.** "BNP Paribas, ANZ, Revolut, Stripe, Circle, Kraken, Bankhaus von der Heydt" — not "banks." "MEDDIC, MEDDPICC, Challenger Sale, Sandler, Force Management, Command of the Message" — not "sales methodologies." The skill must research the target company's customer base and ecosystem to produce this level of specificity. Generic gap analysis ("you should add metrics") is failure.

2. **Role-specific rationale.** Every gap explains why it matters for *this* hiring manager at *this* company with *this* product line. "Dakin will scan for that number" is materially different from "recruiters like numbers."

3. **One question per gap.** Not multiple-choice, not open-ended brainstorm prompts. Each question fits in one sentence and can be answered in one sentence.

4. **Honest "leave it out" framing.** The skill must explicitly invite the user to say "I don't have that" — never fudge, never extrapolate. This is the integrity baseline.

5. **Reframe section.** Identify at least one apparent weakness that's actually a strength for this specific role, and propose a positioning line.

6. **Shortest-path close.** End with the 3–5 highest-leverage questions, numbered, prioritized for the user to answer in one round. This is how the skill stays interactive without becoming a survey.

---

## What this example does NOT show

For completeness, when running the skill:

- The Master CV update step happens AFTER the user answers. This reference captures only the analysis output, not the update flow.
- The "doesn't apply" suppression mechanic kicks in for subsequent runs.
- The tiered ranking should be visually distinguished in the UI (color border, section header), not just structurally as it appears here.
