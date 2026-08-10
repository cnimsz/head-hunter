/**
 * Canonical CV facts — corrections the user has made that must NEVER be
 * reverted by any generation pass. Injected into every CV prompt.
 * Add new corrections here (not only to localStorage learnings) so they
 * survive cache clears and apply on every device.
 */
export const CANONICAL_FACTS = `## CANONICAL CV FACTS (NON-NEGOTIABLE — never deviate, never revert)

- CI HUB title: "Chief Sales Officer (CSO) / Acting COO" — NEVER "Chief Strategy Officer"
- CI HUB metric: "Onboarding time dropped 80%" — NEVER support ticket resolution time
- CI HUB custody/infra partners: Upvest and Tangany — NOT Solaris Bank
- Brighter AI deal sizes: €100K–€500K ACV (not €150K)
- Brighter AI methodologies: MEDDPICC and BANT
- Scaling Funds ACV range: €200K–€3M; methodology: Challenger Sale
- Solaris Bank partnership belongs to Scaling Funds
- Consulting methodology: Command the Message
- Education: "Loyola University" — NEVER "Loyola Maryland" or "Loyola University Maryland"
- Contact: cnimsz@gmail.com | +49 176 7794 4244
- Say "PE/VC-backed", never "PE-backed"

Structure rules:
- No standalone "Track Record" section — straight to Experience
- Scaling Funds partnerships bullet must include "eIDAS, and GDPR"
- Include the bullet on "first video identification and eSignature for professional and institutional investors in EU and Channel Islands"
- Speaking section is titled "Public Speaking and Lobbying" — SuperReturns, MIPIM, ExpoREAL, Oxford`;
