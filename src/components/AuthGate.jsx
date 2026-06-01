import { useEffect, useState } from 'react';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase.js';

/**
 * Gates a feature behind Supabase Auth (magic link). Renders children when
 * the user has a session, otherwise shows a small inline sign-in form.
 *
 * Intentionally NOT mounted at app load — only when the user opens a feature
 * that requires identity (gap analysis, jobsearch). Existing app surfaces
 * stay public.
 */
export default function AuthGate({ title = 'Sign in to continue', subtitle, children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!mounted) return;
      setSession(sess);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!isSupabaseConfigured()) {
    return (
      <div className="p-6 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded">
        Sign-in is not configured. Set <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
        <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> to enable this feature.
      </div>
    );
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading…</div>;
  }

  if (session?.user) return children;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const supabase = getSupabaseClient();
      const { error: signInErr } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: window.location.origin }
      });
      if (signInErr) throw signInErr;
      setSent(true);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-6">
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{subtitle}</p>}

      {sent ? (
        <div className="space-y-3">
          <div className="text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900 rounded p-3">
            Magic link sent to <strong>{email.trim()}</strong>. Open it on this device — this
            panel will refresh automatically once you're signed in.
          </div>
          <button
            type="button"
            onClick={() => { setSent(false); setEmail(''); }}
            className="text-xs text-slate-500 underline"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
          />
          <button
            type="submit"
            disabled={sending || !email.trim()}
            className="px-4 py-2 rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending…' : 'Send magic link'}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            We use Supabase Auth to scope your gap-analysis history to you. No password — just an
            email link.
          </p>
        </form>
      )}
    </div>
  );
}
