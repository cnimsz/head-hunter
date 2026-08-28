-- Follow-up: get_balance_usd() must return NULL when no top-up has been
-- recorded yet. Returning 0 caused the Edge Function's `balance <= 0` check
-- to fire 503 NO_CAPACITY on every request until the first credit_topups
-- row landed — which blocks testing and initial onboarding.
--
-- Contract: NULL = "unknown, don't block". Numeric = the derived balance.
-- The Edge Function already treats NULL as "allow through".

create or replace function public.get_balance_usd()
returns numeric
language sql
security definer
set search_path = public
as $$
  with latest as (
    select purchased_at
      from public.credit_topups
     order by purchased_at desc
     limit 1
  )
  select case
    when not exists (select 1 from public.credit_topups) then null
    else coalesce((select sum(amount_usd) from public.credit_topups), 0)
       - coalesce((
           select sum(est_cost_usd)
             from public.usage_counters
            where updated_at >= (select purchased_at from latest)
         ), 0)
  end;
$$;

revoke execute on function public.get_balance_usd() from public;
grant  execute on function public.get_balance_usd() to service_role;
