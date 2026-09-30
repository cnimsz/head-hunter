// Server-side helper: report one Anthropic call's usage into the shared
// credit pool, so the <funding-status> pill reflects spend from every project
// that draws on the same Anthropic account.
//
// Runs anywhere with global fetch (Cloudflare Workers, Node 18+, Deno, Bun).
// NEVER call this from browser code — `projectKey` is a secret.
//
// Usage (Cloudflare Worker):
//   const msg = await anthropic.messages.create({ model, ... });
//   ctx.waitUntil(reportUsage({
//     endpoint: env.USAGE_REPORT_URL,     // https://<ref>.supabase.co/functions/v1/report-usage
//     projectKey: env.USAGE_REPORT_KEY,   // this project's secret from USAGE_REPORT_KEYS
//     model: msg.model,
//     usage: msg.usage
//   }));
//
// Never throws. Resolves true when the report was accepted, false otherwise —
// a failed report must never break the caller's request.

export async function reportUsage({ endpoint, projectKey, model, usage, timeoutMs = 5000 }) {
  if (!endpoint || !projectKey || !model || !usage) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-project-key': projectKey },
      body: JSON.stringify({ model, usage }),
      signal: controller.signal
    });
    if (!res.ok) console.warn(`[report-usage] HTTP ${res.status}`);
    return res.ok;
  } catch (e) {
    console.warn('[report-usage] failed:', e?.message ?? e);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
