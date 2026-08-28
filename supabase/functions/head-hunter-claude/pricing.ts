// Anthropic per-model price map. THE single source of truth — the spec §4
// requires this to live in one constants file, not scattered literals. When
// Anthropic changes rates, edit here. The reconciliation test in spec §10
// (est_cost_usd within ~10% of Console per-key Cost) will catch stale values.
//
// Values are $ per token — the published rates are per Mtok, divided by 1e6.
// Cache write and cache read use Anthropic's standard 1.25× / 0.1× multipliers
// on the base input rate; verify these hold when a new model is added.

export interface ModelPricing {
  input: number;
  output: number;
  cache_read: number;
  cache_write: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Sonnet 4.6 — $3 / $15 per Mtok (published in CLAUDE.md)
  "claude-sonnet-4-6": {
    input:       3.00 / 1_000_000,
    output:     15.00 / 1_000_000,
    cache_read:  0.30 / 1_000_000,   // 0.1× input
    cache_write: 3.75 / 1_000_000,   // 1.25× input
  },
  // Haiku 4.5 — $1 / $5 per Mtok
  "claude-haiku-4-5-20251001": {
    input:       1.00 / 1_000_000,
    output:      5.00 / 1_000_000,
    cache_read:  0.10 / 1_000_000,
    cache_write: 1.25 / 1_000_000,
  },
  // Opus 4.7 — $5 / $25 per Mtok
  "claude-opus-4-7": {
    input:       5.00 / 1_000_000,
    output:     25.00 / 1_000_000,
    cache_read:  0.50 / 1_000_000,
    cache_write: 6.25 / 1_000_000,
  },
};

// Anthropic web_search: $10 per 1000 searches, flat. Not a token cost.
// The most likely-to-miss line item — omitting it makes est_cost_usd
// under-report, which is the exact failure phase-0 exists to prevent.
export const WEB_SEARCH_COST_USD = 0.01;

export interface RawUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  server_tool_use?: { web_search_requests?: number };
}

export interface ComputedUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  web_searches: number;
  cost_usd: number;
}

export function computeCostUsd(model: string, usage: RawUsage | undefined | null): ComputedUsage {
  const u = usage ?? {};
  const input_tokens        = u.input_tokens ?? 0;
  const output_tokens       = u.output_tokens ?? 0;
  const cache_read_tokens   = u.cache_read_input_tokens ?? 0;
  const cache_write_tokens  = u.cache_creation_input_tokens ?? 0;
  const web_searches        = u.server_tool_use?.web_search_requests ?? 0;

  const p = MODEL_PRICING[model];
  if (!p) {
    // Unknown model — don't fabricate a rate. Log loudly; cost lands as 0
    // for this call and the reconciliation test will surface the drift.
    console.error(`[pricing] Unknown model "${model}" — cost recorded as 0 for this call`);
    return { input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, web_searches, cost_usd: 0 };
  }

  const cost_usd =
      input_tokens       * p.input
    + output_tokens      * p.output
    + cache_read_tokens  * p.cache_read
    + cache_write_tokens * p.cache_write
    + web_searches       * WEB_SEARCH_COST_USD;

  return { input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, web_searches, cost_usd };
}
