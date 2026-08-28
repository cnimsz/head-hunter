// Company research cache — 30-day TTL, keyed on the normalised company_key.
// Spec §6: highest-leverage cost lever in phase 0. Two users applying to the
// same company should not both incur $0.05 in web_search fees.
//
// IMPORTANT CAVEAT (see the phase-0 report): the current cache stores the
// *entire* research payload (companyBrief + hiringManager + linkedInMessage),
// per spec §6. That is spec-literal but produces the wrong hiringManager /
// linkedInMessage for the second applicant (both are role- and CV-specific,
// not company-generic). A safer variant would cache only companyBrief and
// regenerate the personalised fields with web_search disabled. Left as
// spec-literal for now — the correctness concern is flagged in the report.

import { getServiceClient } from "./db.ts";

export interface CachedResearch {
  company_key:  string;
  company_name: string;
  research:     Record<string, unknown>;
  searches_used: number;
  created_at:   string;
  expires_at:   string;
}

// Live cache hit → returns the cached payload. Miss / expired → returns null.
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

// Upsert cache entry. Refreshes expires_at on write so a hot company stays warm.
export async function writeCompanyResearch(opts: {
  company_key:  string;
  company_name: string;
  research:     Record<string, unknown>;
  searches_used: number;
}): Promise<void> {
  try {
    const supa = getServiceClient();
    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    const { error } = await supa
      .from("company_research")
      .upsert({
        company_key:   opts.company_key,
        company_name:  opts.company_name,
        research:      opts.research,
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
