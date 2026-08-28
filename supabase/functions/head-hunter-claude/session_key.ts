// Derive a stable, opaque session_key from the client IP + a server secret.
//
// Since the public tailoring proxy is unauthenticated (Turnstile + HMAC
// session token, no Supabase JWT), we can't attribute usage to auth.uid().
// Instead we roll up per session_key — an SHA-256 hash of `${salt}\n${ip}`,
// so identical IPs land on identical keys across calls in a batch.
//
// Trade-offs: same coffee-shop NAT → shared counter. VPN hop → new counter.
// Both are acceptable for the daily cap's purpose (stop *one user* draining).
// A hostile actor with mobile-VPN can trivially bypass the cap; the real
// ceiling is the Anthropic Console spend limit (§2), not this counter.
//
// The raw IP is never persisted anywhere — only the hash lands in the DB.

export async function deriveSessionKey(ip: string): Promise<string> {
  const salt = Deno.env.get("HEAD_HUNTER_SESSION_SECRET");
  if (!salt) throw new Error("HEAD_HUNTER_SESSION_SECRET not set");
  const data = new TextEncoder().encode(`${salt}\n${ip}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hash);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}
