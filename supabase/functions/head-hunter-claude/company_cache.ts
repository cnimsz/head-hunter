// Company research cache — 30-day TTL, keyed on the normalised company_key.
// Spec §6: highest-leverage cost lever in phase 0.
//
// Design (post-spec-review): we cache ONLY the `companyBrief`. hiringManager
// and linkedInMessage are role- and CV-specific — caching those served the
// wrong hiring manager and pitch to a second applicant. Instead:
//
//   Cache miss: normal research call runs web_search fully, we extract only
//               companyBrief and cache it.
//   Cache hit:  we still call Anthropic (so hiringManager and linkedInMessage
//               are regenerated for THIS applicant + role) but we suppress
//               web_search and pass the cached brief in via a system prompt.
//               After the model returns, we splice the cached brief back into
//               the JSON so the model can't paraphrase it.
//
// Net savings on a hit vs. a miss: the ~$0.01–$0.03 in web-search fees and,
// bigger, the input-token inflation from having 3 search results dumped into
// context (~$0.02–$0.05 in Haiku input on a real research call).

import { getServiceClient } from "./db.ts";

export interface CachedResearch {
  company_key:  string;
  company_name: string;
  research:     Record<string, unknown>;   // { companyBrief: string } — that's the whole schema now
  searches_used: number;
  created_at:   string;
  expires_at:   string;
}

// Live cache hit → returns the cached row. Miss / expired → returns null.
// Callers should verify `research?.companyBrief` is a non-empty string
// before treating this as a usable hit — a legacy row could have other keys.
export async function readCompanyResearch(company_key: string): Promise<CachedResearch | null> {
  try {
    const supa = getServiceClient();
    const { data, error } = await supa
      .from("company_research")
      .select("company_key, company_name, research, searches_used, created_at, expires_at")
      .eq("company_key", company_key)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error) {
      console.error("[company_cache] read failed:", error);
      return null;
    }
    return (data as CachedResearch) ?? null;
  } catch (e) {
    console.error("[company_cache] read threw:", e);
    return null;
  }
}

// Upsert cache entry — writes ONLY the companyBrief, no personal fields.
// Refreshes expires_at so a hot company stays warm.
export async function writeCompanyResearch(opts: {
  company_key:  string;
  company_name: string;
  companyBrief: string;
  searches_used: number;
}): Promise<void> {
  if (!opts.companyBrief || typeof opts.companyBrief !== "string") {
    console.warn("[company_cache] refusing to write empty companyBrief for", opts.company_key);
    return;
  }
  try {
    const supa = getServiceClient();
    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    const { error } = await supa
      .from("company_research")
      .upsert({
        company_key:   opts.company_key,
        company_name:  opts.company_name,
        research:      { companyBrief: opts.companyBrief },
        searches_used: opts.searches_used,
        created_at:    nowIso,
        expires_at:    expiresIso,
      }, { onConflict: "company_key" });
    if (error) console.error("[company_cache] write failed:", error);
  } catch (e) {
    console.error("[company_cache] write threw:", e);
  }
}

// Fire-and-forget lazy purge (called at most once per isolate lifetime).
let purgedOnce = false;
export function schedulePurge(): void {
  if (purgedOnce) return;
  purgedOnce = true;
  (async () => {
    try {
      const supa = getServiceClient();
      const { data, error } = await supa.rpc("purge_expired_company_research");
      if (error) console.error("[company_cache] purge failed:", error);
      else if (typeof data === "number" && data > 0) {
        console.log(`[company_cache] purged ${data} expired rows`);
      }
    } catch (e) {
      console.error("[company_cache] purge threw:", e);
    }
  })();
}
