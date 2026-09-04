-- capacity-indicator: expose a coarse capacity signal (band + runway bucket)
-- to unauthenticated + authenticated clients WITHOUT ever leaking the actual
-- balance figure. The band is derived from get_balance_usd() (service_role
-- only) inside a SECURITY DEFINER wrapper.
--
-- Contract from /specs/capacity-indicator.md:
--   daily_burn  = max(trailing_24h_spend, trailing_7day_avg_daily_spend, floor)
--   runway_days = balance_usd / daily_burn
--
--   band = 'green'  when runway_days > 21   -- indicator hidden entirely
--        = 'amber'  when 7 <= runway_days <= 21
--        = 'red'    when runway_days < 7
--        = 'empty'  when balance <= 0
--
-- Unknown balance (no top-up recorded, get_balance_usd() returns NULL) is
-- reported as 'green' + bucket "plenty". Matches the "NULL = don't block"
-- contract in the edge function — same treatment on the read path.
--
-- The floor stops a quiet week reporting infinite runway and pinning the
-- band to green while the balance actually drains. Tuned once here; the
-- reconciliation test (spec §10 in phase-0) will surface drift.

create or replace function public.get_capacity_band()
returns table (band text, runway_bucket text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance         numeric;
  v_24h_spend       numeric;
  v_7d_avg          numeric;
  v_daily_burn      numeric;
  v_runway          numeric;
  v_floor constant  numeric := 0.50;   -- min $/day used in daily_burn; tune here
begin
  v_balance := public.get_balance_usd();

  -- Empty short-circuit — matches the edge fn's balance <= 0 check.
  if v_balance is not null and v_balance <= 0 then
    band := 'empty';
    runway_bucket := 'out of credit';
    return next;
    return;
  end if;

  -- Unknown balance (unseeded ledger) → 'green'. Matches the edge fn's
  -- "NULL means allow through" contract on the read path.
  if v_balance is null then
    band := 'green';
    runway_bucket := 'plenty';
    return next;
    return;
  end if;

  -- Trailing spend windows. usage_counters.updated_at is timestamptz.
  select coalesce(sum(est_cost_usd), 0)
    into v_24h_spend
    from public.usage_counters
   where updated_at >= now() - interval '24 hours';

  select coalesce(sum(est_cost_usd), 0) / 7.0
    into v_7d_avg
    from public.usage_counters
   where updated_at >= now() - interval '7 days';

  v_daily_burn := greatest(v_24h_spend, v_7d_avg, v_floor);
  v_runway     := v_balance / v_daily_burn;

  if v_runway > 21 then
    band := 'green';
    runway_bucket := 'plenty';
  elsif v_runway >= 7 then
    band := 'amber';
    runway_bucket := 'a few weeks';
  else
    band := 'red';
    runway_bucket := 'about a week';
  end if;

  return next;
end;
$$;

-- SECURITY DEFINER + explicit grants: anyone can read the band, no one can
-- reach get_balance_usd() or the underlying tables directly (RLS still off
-- for public, service_role only per phase-0).
revoke execute on function public.get_capacity_band() from public;
grant  execute on function public.get_capacity_band() to anon, authenticated;
