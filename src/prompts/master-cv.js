export function buildMasterCVPrompt({ cvs }) {
  const sections = cvs
    .map((c, i) => `===== CV ${i + 1}: ${c.filename} =====\n${c.text}`)
    .join('\n\n');

  return `You are an expert CV writer. You have been given ${cvs.length} CV(s) from the same candidate, written for different roles or over time. Review them all and synthesise a single comprehensive MASTER CV that captures the full breadth of the candidate's experience, skills, education, achievements and credentials.

Rules:
- Include every distinct role, employer, project, qualification, certification, publication, award, and skill that appears in any source CV. Do not drop anything substantive.
- Deduplicate overlapping entries; merge conflicting details into the most complete and recent version.
- Preserve exact dates, titles, company names, and metrics as given. Never invent information.
- Use reverse-chronological order within each section.
- Structure with clear headings: Summary, Experience, Education, Skills, Certifications, Projects, Publications/Awards (include only sections that have content).
- Write in a neutral, professional tone. This is a master reference document — comprehensive, not tailored to any specific job.
- Output plain text / markdown only. No commentary before or after.

Source CVs:

${sections}

Now produce the MASTER CV.`;
}
