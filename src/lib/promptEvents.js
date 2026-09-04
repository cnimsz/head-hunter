// Silent-fail insert into public.prompt_events. RLS on the table permits
// insert for anon + authenticated (Phase 0 migration), so no service_role
// needed. Analytics must never break UX — every path swallows errors.
import { getSupabaseClient, isSupabaseConfigured } from './supabase.js';

const KINDS = new Set([
  'capacity_impression',
  'capacity_click',
  'capacity_dismiss',
  'waitlist_signup'
]);

export async function logEvent(kind, band = null) {
  if (!KINDS.has(kind)) return;
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('prompt_events')
      .insert({ kind, band });
    if (error) console.warn(`[prompt_events] ${kind} insert failed:`, error.message);
  } catch (e) {
    console.warn(`[prompt_events] ${kind} threw:`, e?.message ?? e);
  }
}
