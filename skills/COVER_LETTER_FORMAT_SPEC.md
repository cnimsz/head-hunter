# Cover Letter Formatting Specification

## ATS-Safe Professional Format

### Document Settings
- **Page Size:** US Letter (8.5" x 11")
- **Margins:** 1" all sides
- **Font:** Arial or Calibri only
- **Line Spacing:** 1.15
- **Alignment:** Left-aligned (no justified text)

### Typography

| Element | Font | Size | Style | Spacing After |
|---------|------|------|-------|---------------|
| Sender Name | Arial | 12pt | Bold | 0pt |
| Sender Contact | Arial | 10pt | Regular | 12pt |
| Date | Arial | 11pt | Regular | 12pt |
| Recipient Block | Arial | 11pt | Regular | 12pt |
| Salutation | Arial | 11pt | Regular | 12pt |
| Body Paragraphs | Arial | 11pt | Regular | 12pt |
| Bullet Points | Arial | 11pt | Regular | 6pt |
| Closing | Arial | 11pt | Regular | 24pt |
| Signature Name | Arial | 11pt | Bold | 0pt |

### Document Structure

```
Your Name
City, Country | +Country XXX XXX XXXX | you@email.com

[Date: April 15, 2026]

[Recipient Name]
[Title]
[Company Name]
[City, Country]

Dear [Mr./Ms. Last Name],

[Opening paragraph: 2-3 sentences. Hook + bridge to your value.]

[Evidence section with exactly 3 bullets:]

• [Bullet 1: Their need → Your achievement → Implied benefit]

• [Bullet 2: Their need → Your achievement → Implied benefit]

• [Bullet 3: Their need → Your achievement → Implied benefit]

[Closing paragraph: 1-2 sentences. No-oriented close.]

Best regards,

Your Name
```

### Spacing Rules

| Between Elements | Spacing |
|------------------|---------|
| Name → Contact | 0pt (same block) |
| Contact → Date | 24pt (two line breaks) |
| Date → Recipient | 24pt |
| Recipient → Salutation | 24pt |
| Salutation → Body | 12pt |
| Between paragraphs | 12pt |
| Before bullet section | 12pt |
| Between bullets | 6pt |
| After bullet section | 12pt |
| Body → Closing | 12pt |
| Closing → Signature | 24pt (space for actual signature) |

### Bullet Formatting
- Standard bullet character (•)
- Left indent: 0.25"
- Hanging indent: 0.25"
- Each bullet is 1-2 lines maximum
- Bold the key metric or result within each bullet (optional)

**Example bullet with bold metric:**
```
• Scaling through partnerships: Drove **500% ARR growth** at CI HUB by restructuring the international reseller network—directly applicable to your channel expansion goals.
```

### Salutation Rules
| Scenario | Format |
|----------|--------|
| Known name (male) | Dear Mr. [Last Name], |
| Known name (female) | Dear Ms. [Last Name], |
| Unknown gender | Dear [First Name] [Last Name], |
| Unknown person | Dear Hiring Team, |

Never use:
- ❌ To Whom It May Concern
- ❌ Dear Sir or Madam
- ❌ Dear Hiring Manager (use "Hiring Team" instead)

### Closing Options
| Tone | Closing |
|------|---------|
| Standard professional | Best regards, |
| Warmer | Kind regards, |
| Formal | Sincerely, |

### What NOT to Include (ATS Killers)
- ❌ Tables or columns
- ❌ Text boxes
- ❌ Letterhead images/logos
- ❌ Colored text or backgrounds
- ❌ Headers/footers
- ❌ Different fonts for "style"
- ❌ Centered text (left-align everything)

### Length Enforcement
- **Maximum 12 lines** of body content (excluding header/signature)
- If over, cut—never shrink font or reduce margins
- One page only, always

---

## Implementation in docx.js

```javascript
const coverLetterStyles = {
  senderName: { font: 'Arial', size: 24, bold: true },   // 12pt
  senderContact: { font: 'Arial', size: 20 },            // 10pt
  date: { font: 'Arial', size: 22 },                     // 11pt
  recipient: { font: 'Arial', size: 22 },                // 11pt
  salutation: { font: 'Arial', size: 22 },               // 11pt
  body: { font: 'Arial', size: 22 },                     // 11pt
  bullet: { font: 'Arial', size: 22 },                   // 11pt
  closing: { font: 'Arial', size: 22 },                  // 11pt
  signature: { font: 'Arial', size: 22, bold: true }     // 11pt
};

const coverLetterSpacing = {
  afterSenderBlock: 480,    // 24pt
  afterDate: 480,           // 24pt
  afterRecipient: 480,      // 24pt
  afterSalutation: 240,     // 12pt
  afterParagraph: 240,      // 12pt
  afterBullet: 120,         // 6pt
  afterClosing: 480         // 24pt
};
```
