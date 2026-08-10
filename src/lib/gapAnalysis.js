import { getSupabaseClient, gapAnalysisFunctionUrl } from './supabase.js';
import { getMasterCV, saveMasterCV, getAtsSystem } from './storage.js';
import { buildGapAnalysisPrompt } from '../prompts/gap-analysis.js';

const MASTER_UPDATES_HEADER = '## Gap-Analysis Updates';
const MASTER_UPDATES_PREAMBLE =
  '(Facts surfaced by the cv-gap-analysis skill. The CV writer should integrate these into the appropriate Experience bullets, Skills, Summary, or Certifications when tailoring — do NOT copy this section verbatim into a tailored CV.)';

/**
 * Run a gap analysis. Calls the edge function, which persists the run + findings
 * and returns them. Caller must be signed in (the function rejects otherwise).
 *
 * @param {Object} args
 * @param {string} args.tailoredCvText  Tailored CV text the user is reviewing.
 * @param {string} args.jobDescription  Full JD text.
 * @param {string} [args.companyName]   "Company - Role" or just company.
 * @param {string} [args.roleTitle]
 * @param {string} [args.jdUrl]
 * @returns {Promise<{ run_id: string, findings: Array, reframe: object|null, shortest_path: string[] }>}
 */
export async function runGapAnalysis({
  tailoredCvText,
  jobDescription,
  companyName,
  roleTitle,
  jdUrl
}) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured.');
  const fnUrl = gapAnalysisFunctionUrl();
  if (!fnUrl) throw new Error('Supabase URL not configured.');

  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in.');
  const userId = session.user.id;

  const master = getMasterCV();
  const masterCvText = master?.text || '';

  // Suppress "doesn't apply" gaps the user has previously dismissed.
  const { data: dismissed, error: dismissedErr } = await supabase
    .from('gap_analysis_findings')
    .select('gap_title')
    .eq('user_id', userId)
    .eq('status', 'doesnt_apply');
  if (dismissedErr) {
    console.warn('Failed to load dismissed gaps; proceeding without suppression:', dismissedErr);
  }
  const previouslyDismissed = (dismissed || []).map((r) => r.gap_title);

  const prompt = buildGapAnalysisPrompt({
    tailoredCvText,
    jobDescription,
    masterCvText,
    companyName,
    roleTitle,
    previouslyDismissed,
    atsSystem: getAtsSystem()
  });

  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify({
      prompt,
      jd_url: jdUrl || null,
      jd_excerpt: (jobDescription || '').slice(0, 500),
      company_name: companyName || null,
      role_title: roleTitle || null
    })
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    let msg = `Gap analysis failed (${res.status})`;
    try {
      const j = JSON.parse(raw);
      if (j?.error) msg = j.error;
    } catch {}
    if (res.status === 401) msg = 'Session expired. Sign in again and retry.';
    if (res.status === 429) msg = 'Rate limit reached. Wait a minute and retry.';
    throw new Error(msg);
  }

  return await res.json();
}

/**
 * Patch a single finding. RLS ensures the user can only touch their own rows.
 */
export async function updateFinding(findingId, patch) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured.');
  const update = { ...patch };
  if (patch.status && patch.status !== 'open' && !patch.answered_at) {
    update.answered_at = new Date().toISOString();
  }
  const { error } = await supabase.from('gap_analysis_findings').update(update).eq('id', findingId);
  if (error) throw new Error(error.message);
}

/**
 * Mark the run complete and stamp the addressed count.
 */
export async function completeRun(runId, addressedCount) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured.');
  const { error } = await supabase
    .from('gap_analysis_runs')
    .update({
      status: 'complete',
      addressed_count: addressedCount,
      completed_at: new Date().toISOString()
    })
    .eq('id', runId);
  if (error) throw new Error(error.message);
}

/**
 * Splice a gap answer into the Master CV (localStorage), via saveMasterCV().
 *
 * Strategy: append the new fact as a Q/A entry under a dedicated
 * "Gap-Analysis Updates" section near the end of the Master CV. We don't try
 * to surgically locate the exact bullet — the Master CV is free-form text
 * and structural splicing would be brittle. The CV writer prompt is fed the
 * WHOLE Master CV on next tailoring, so it will pick up the new facts and
 * integrate them into the right bullet / section.
 *
 * Returns the master_cv_section label written, for persistence on the finding.
 */
export function appendAnswerToMasterCV({ gapTitle, gapQuestion, userAnswer }) {
  const current = getMasterCV();
  if (!current?.text) {
    throw new Error('No Master CV found in this browser. Save one first.');
  }
  const answer = (userAnswer || '').trim();
  if (!answer) throw new Error('Answer is empty.');

  const stamp = new Date().toISOString().slice(0, 10);
  const entry = `- **${gapTitle}** (${stamp})\n` + `  Q: ${gapQuestion}\n` + `  A: ${answer}`;

  let updatedText;
  if (current.text.includes(MASTER_UPDATES_HEADER)) {
    // Append to the existing section, just below the header + preamble line.
    const re = new RegExp(`(${escapeRegExp(MASTER_UPDATES_HEADER)}[^\\n]*\\n(?:[^\\n]*\\n)?)`);
    if (re.test(current.text)) {
      updatedText = current.text.replace(re, `$1${entry}\n`);
    } else {
      updatedText = current.text.replace(
        MASTER_UPDATES_HEADER,
        `${MASTER_UPDATES_HEADER}\n${entry}`
      );
    }
  } else {
    updatedText =
      current.text.trimEnd() +
      `\n\n${MASTER_UPDATES_HEADER}\n${MASTER_UPDATES_PREAMBLE}\n\n${entry}\n`;
  }

  saveMasterCV(updatedText, current.filename || 'Master CV.md');
  return 'Gap-Analysis Updates';
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
