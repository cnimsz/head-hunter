// Types for report-usage.js, so TypeScript projects can import it directly.

export declare const DEFAULT_REPORT_USAGE_URL: string;

export interface AnthropicUsageLike {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  server_tool_use?: { web_search_requests?: number };
}

export interface UsageRecordLike {
  model: string;
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  web_search_requests?: number;
  /** Message Batches API result — tokens bill at 50%. */
  batch?: boolean;
}

export declare function configureUsageReporting(opts?: {
  projectKey?: string;
  endpoint?: string;
}): void;

export declare function reportUsage(opts: {
  endpoint: string;
  projectKey: string;
  model: string;
  usage: AnthropicUsageLike;
  batch?: boolean;
  timeoutMs?: number;
}): Promise<boolean>;

export declare function reportUsageRecord(record: UsageRecordLike): Promise<boolean>;
