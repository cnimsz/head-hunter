import { getSupabaseClient, jobsearchFunctionUrl } from './supabase.js';
import { getMasterCV } from './storage.js';

/**
 * POST to the jobsearch edge function with a signed-in session JWT.
 *
 * @param {object} payload
 * @returns {Promise<any>}
 */
async function callJobsearch(payload) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured.');
  const fnUrl = jobsearchFunctionUrl();
  if (!fnUrl) throw new Error('Supabase URL not configured.');

  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in.');

  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    let msg = `Jobsearch failed (${res.status})`;
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
 * Return the user's current active candidates without sourcing new ones.
 * Cheap — no model call.
 *
 * @returns {Promise<{ candidates: Array<object> }>}
 */
export async function listActiveCandidates() {
  return await callJobsearch({ action: 'list_active' });
}

/**
 * Top up the active pool to 3. Requires a Master CV in localStorage; the
 * edge function uses it to build the JSearch query and the per-candidate
 * "why this role for you" lines.
 *
 * @param {object} [opts]
 * @param {string} [opts.currentJDText]  Optional JD currently pasted in the
 *   tailoring panel. If provided, the edge function persists it as a
 *   transient signal (decays over 7 days) AND uses it to bias this refresh.
 * @returns {Promise<{ candidates: Array<object>, newly_added: number }>}
 */
export async function refreshCandidates({ currentJDText } = {}) {
  const master = getMasterCV();
  if (!master?.text) {
    throw new Error('Save a Master CV first — the jobsearch needs it to find matching roles.');
  }
  return await callJobsearch({
    action: 'refresh',
    master_cv_text: master.text,
    current_jd_text: (currentJDText || '').slice(0, 20000)
  });
}

/**
 * Submit pass / apply feedback for one candidate. The edge function records
 * the feedback, recomputes the user signals, and refreshes the pool. The
 * returned `candidates` array is the new active pool ready to render.
 *
 * @param {object} args
 * @param {string} args.candidateId
 * @param {'pass'|'apply'} args.action
 * @param {string} args.reasonCode
 * @param {string} [args.freeText]
 * @returns {Promise<{ candidates: Array<object>, newly_added: number }>}
 */
export async function submitJobsearchFeedback({ candidateId, action, reasonCode, freeText }) {
  if (!candidateId) throw new Error('candidateId required');
  if (action !== 'pass' && action !== 'apply') {
    throw new Error("action must be 'pass' or 'apply'");
  }
  if (!reasonCode) throw new Error('reasonCode required');

  const master = getMasterCV();
  return await callJobsearch({
    action: 'submit_feedback',
    candidate_id: candidateId,
    feedback_action: action,
    reason_code: reasonCode,
    free_text: freeText || '',
    master_cv_text: master?.text || ''
  });
}
