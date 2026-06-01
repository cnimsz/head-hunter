import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client = null;
let warned = false;

export function isSupabaseConfigured() {
  return Boolean(URL && ANON_KEY);
}

/**
 * Singleton Supabase client. Returns null if env vars are missing, so callers
 * can render a fallback ("not configured") rather than throw at module load.
 *
 * `detectSessionInUrl: true` + `flowType: 'pkce'` means the client auto-exchanges
 * the magic-link `?code=...` query param into a session when the page loads. The
 * App component should call this once at mount so that exchange happens even if
 * the AuthGate isn't mounted yet.
 */
export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    if (!warned) {
      console.warn(
        'Supabase env vars missing (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY). ' +
          'Gap analysis and jobsearch will be disabled until they are set.'
      );
      warned = true;
    }
    return null;
  }
  if (!client) {
    client = createClient(URL, ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'cv-toolkit:auth'
      }
    });
  }
  return client;
}

export function gapAnalysisFunctionUrl() {
  if (!URL) return null;
  return `${URL.replace(/\/+$/, '')}/functions/v1/gap-analysis`;
}
