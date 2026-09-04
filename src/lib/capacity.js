// Fetch the coarse capacity band from Supabase. Never receives the dollar
// balance — the get_capacity_band() RPC returns { band, runway_bucket } only.
//
// Fallback contract (spec §2): on any polling failure, return the last known
// band rather than inventing 'empty'. A fabricated scarcity signal on a site
// soliciting money is a §5 UWG problem.
import { getSupabaseClient, isSupabaseConfigured } from './supabase.js';

let lastKnown = null;

export function getLastKnownCapacity() {
  return lastKnown;
}

export async function fetchCapacityBand() {
  if (!isSupabaseConfigured()) return lastKnown;
  const supabase = getSupabaseClient();
  if (!supabase) return lastKnown;

  try {
    const { data, error } = await supabase.rpc('get_capacity_band');
    if (error) {
      console.warn('[capacity] get_capacity_band failed, using last known:', error.message);
      return lastKnown;
    }
    // supabase-js returns table-valued RPCs as an array of rows.
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row.band !== 'string') return lastKnown;
    lastKnown = { band: row.band, runwayBucket: row.runway_bucket ?? '' };
    return lastKnown;
  } catch (e) {
    console.warn('[capacity] get_capacity_band threw, using last known:', e?.message ?? e);
    return lastKnown;
  }
}

// Called when the edge fn returns 503 NO_CAPACITY — the balance ran out
// between polls. Set explicitly rather than waiting for the next poll.
export function setEmptyFromProxy() {
  lastKnown = { band: 'empty', runwayBucket: 'out of credit' };
  return lastKnown;
}
