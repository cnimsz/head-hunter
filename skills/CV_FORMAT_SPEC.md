# CV Formatting Specification

## ATS-Safe Professional Format

### Document Settings
- **Page Size:** US Letter (8.5" x 11")
- **Margins:** 1" all sides (0.75" acceptable if tight on space)
- **Font:** Arial or Calibri only
- **Line Spacing:** 1.15

### Typography Hierarchy

| Element | Font | Size | Style | Spacing After |
|---------|------|------|-------|---------------|
| Name | Arial | 18pt | Bold | 6pt |
| Contact Line | Arial | 10pt | Regular | 12pt |
| Section Headers | Arial | 12pt | Bold, ALL CAPS | 6pt |
| Company Name | Arial | 11pt | Bold | 0pt |
| Job Title + Dates | Arial | 11pt | Regular | 3pt |
| Bullet Points | Arial | 10.5pt | Regular | 3pt |
| Body Text | Arial | 10.5pt | Regular | 6pt |

### Section Headers
- ALL CAPS
- Bold
- Add a thin bottom border (0.5pt, dark gray #333333)
- 12pt space before, 6pt space after

```
EXPERIENCE
─────────────────────────────────────────────────
```

### Contact Line Format
Single line, separated by vertical bars:
```
City, Country | +Country XXX XXX XXXX | you@email.com | linkedin.com/in/yourhandle
```

### Professional Summary
- 2-3 lines maximum
- No header needed if directly under contact info
- Italic optional for visual distinction
- 10.5pt font

### Experience Entries

**Format:**
```
Company Name
Job Title | Location | Month Year – Month Year

• Achievement bullet starting with action verb and including metrics
• Second achievement bullet with quantified impact
• Third achievement bullet showing scope or scale
```

**Rules:**
- Company name on its own line, bold
- Title, location, dates on second line (not bold)
- 3-5 bullets per role (recent roles), 1-2 for older roles
- Bullets indented 0.25"
- No orphaned bullets (keep role header with at least one bullet)

### Bullet Formatting
- Use standard bullet character (•)
- Left indent: 0.25"
- Hanging indent: 0.25"
- No nested bullets in CV (keep flat)
- Each bullet is one line (two max if absolutely necessary)

### Skills Section
- Single line with comma separation, OR
- Grouped by category on separate lines:

```
SKILLS
─────────────────────────────────────────────────
Languages: German (fluent), French (conversational)
Technical: Salesforce, HubSpot, SQL, Python
Certifications: AWS Solutions Architect, PMP
```

### Education Section
```
EDUCATION
─────────────────────────────────────────────────
MBA, Finance | University Name | Year
BA, Economics | University Name | Year
```

### What NOT to Include (ATS Killers)
- ❌ Tables or columns
- ❌ Text boxes
- ❌ Headers/footers with content
- ❌ Images, logos, or graphics
- ❌ Icons (phone icon, email icon, etc.)
- ❌ Colored backgrounds
- ❌ Custom fonts
- ❌ Symbols beyond standard bullets (•)

### Page Break Rules
- Never break in the middle of a role
- Keep section header with at least one entry
- Second page header: Name only, right-aligned, 10pt

---

## Implementation in docx.js

```javascript
const styles = {
  name: { font: 'Arial', size: 36, bold: true }, // 18pt = 36 half-points
  contactLine: { font: 'Arial', size: 20 },
  sectionHeader: { font: 'Arial', size: 24, bold: true, allCaps: true },
  companyName: { font: 'Arial', size: 22, bold: true },
  jobTitle: { font: 'Arial', size: 22 },
  bullet: { font: 'Arial', size: 21 },
  body: { font: 'Arial', size: 21 }
};

const spacing = {
  afterName: 120,        // 6pt
  afterContact: 240,     // 12pt
  beforeSection: 240,    // 12pt
  afterSection: 120,     // 6pt
  afterCompany: 0,
  afterJobTitle: 60,     // 3pt
  afterBullet: 60        // 3pt
};
```
