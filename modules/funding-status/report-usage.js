// Server-side helper: report one Anthropic call's usage into the shared
// credit pool, so the <funding-status> pill reflects spend from every project
// that draws on the same Anthropic account.
//
// Runs anywhere with global fetch (Cloudflare Workers, Node 18+, Deno, Bun).
// NEVER import this into browser code — the project key is a secret.
//
// Two ways to use it:
//
// 1. Configure once, then hand it each usage record (simplest):
//
//      import { configureUsageReporting, reportUsageRecord } from './report-usage.js';
//      configureUsageReporting({ projectKey: env.USAGE_REPORT_KEY });  // Worker entry
//      ...
//      await reportUsageRecord({ model, input_tokens, output_tokens, batch });
//
//    In Node the key is also read from process.env.USAGE_REPORT_KEY, so a
//    local CLI needs no configure call.
//
// 2. Pass everything explicitly:
//
//      await reportUsage({ endpoint, projectKey, model: msg.model, usage: msg.usage });
//
// Never throws. Resolves true when the report was accepted, false otherwise —
// a failed report must never break the caller's request.

export const DEFAULT_REPORT_USAGE_URL =
  'https://bcenuebydpkyfmtzfcku.supabase.co/functions/v1/report-usage';

let configured = { endpoint: '', projectKey: '' };
let warnedUnconfigured = false;

/** Set the project key (and optionally the endpoint) once, e.g. at Worker start. */
export function configureUsageReporting({ projectKey, endpoint } = {}) {
  configured = {
    endpoint: endpoint || configured.endpoint || '',
    projectKey: projectKey || configured.projectKey || ''
  };
}

function envVar(name) {
  try {
    // Node / Bun / Deno-with-node-compat. Absent in a plain Worker.
    return (globalThis.process && globalThis.process.env && globalThis.process.env[name]) || '';
  } catch {
    return '';
  }
}

function resolveConfig() {
  return {
    endpoint: configured.endpoint || envVar('USAGE_REPORT_URL') || DEFAULT_REPORT_USAGE_URL,
    projectKey: configured.projectKey || envVar('USAGE_REPORT_KEY')
  };
}

export async function reportUsage({ endpoint, projectKey, model, usage, batch = false, timeoutMs = 5000 }) {
  if (!endpoint || !projectKey || !model || !usage) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-project-key': projectKey },
      body: JSON.stringify({ model, usage, batch: batch === true }),
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

/**
 * Report a flat usage record — the shape most usage ledgers already keep
 * (model + token counts + optional web_search_requests / batch). Uses the
 * configured key; silently skips (one warning) when no key is set, so a
 * project without the secret keeps working.
 */
export async function reportUsageRecord(record) {
  const { endpoint, projectKey } = resolveConfig();
  if (!projectKey) {
    if (!warnedUnconfigured) {
      warnedUnconfigured = true;
      console.warn('[report-usage] USAGE_REPORT_KEY not set — shared credit pool not updated');
    }
    return false;
  }
  if (!record || !record.model) return false;
  return reportUsage({
    endpoint,
    projectKey,
    model: record.model,
    batch: record.batch === true,
    usage: {
      input_tokens: record.input_tokens ?? 0,
      output_tokens: record.output_tokens ?? 0,
      cache_creation_input_tokens: record.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: record.cache_read_input_tokens ?? 0,
      server_tool_use: { web_search_requests: record.web_search_requests ?? 0 }
    }
  });
}
