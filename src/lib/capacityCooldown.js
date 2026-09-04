// 3-day per-browser cooldown on the capacity donation prompt (spec §5).
// localStorage is a soft rate-limiter — trivially clearable, and that's fine;
// per-user profile storage would gate this to signed-in users, which is a
// tiny fraction of the anon tailoring flow.

const KEY = 'cv-toolkit:capacity-dismissed-at';
const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

export function isPromptOnCooldown(now = Date.now()) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return now - ts < COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function markPromptDismissed(now = Date.now()) {
  try {
    localStorage.setItem(KEY, String(now));
  } catch {
    // localStorage disabled/full → cooldown just no-ops. Next impression
    // fires immediately; not ideal but not broken.
  }
}
