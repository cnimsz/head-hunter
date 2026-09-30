-- Lock down internal SECURITY DEFINER RPCs.
-- (Applied to production 2026-09-30 via the Supabase MCP; version matches.)
--
-- Earlier migrations ran `revoke execute ... from public`, but Supabase's
-- default privileges grant EXECUTE on new public-schema functions DIRECTLY
-- to anon and authenticated, so those explicit grants survived and anyone
-- holding the (public) anon key could call these via /rest/v1/rpc/*:
-- inflate/deflate the cost ledger, close batches, trigger purges, or read
-- the raw dollar balance.
--
-- Every caller of these five is an Edge Function using the service_role
-- client (_shared/cost.ts, head-hunter-claude/{balance,telemetry,
-- company_cache}.ts); service_role keeps its explicit grant, so nothing
-- that works today stops working.
--
-- get_capacity_band() is intentionally left executable by anon +
-- authenticated: the public <funding-status> pill calls it from the browser
-- and it only returns a coarse band, never the balance.
--
-- Going forward: any new SECURITY DEFINER function must revoke EXECUTE from
-- anon, authenticated (not just PUBLIC) unless it is meant to be public.

revoke execute on function public.record_usage(text, text, bigint, bigint, bigint, bigint, integer, numeric, boolean) from anon, authenticated;
revoke execute on function public.record_batch_call(uuid, jsonb, bigint, bigint, bigint, bigint, integer, numeric, boolean) from anon, authenticated;
revoke execute on function public.close_batch(uuid, text) from anon, authenticated;
revoke execute on function public.purge_expired_company_research() from anon, authenticated;
revoke execute on function public.get_balance_usd() from anon, authenticated;

-- Belt and braces: make sure service_role still holds EXECUTE on all five.
grant execute on function public.record_usage(text, text, bigint, bigint, bigint, bigint, integer, numeric, boolean) to service_role;
grant execute on function public.record_batch_call(uuid, jsonb, bigint, bigint, bigint, bigint, integer, numeric, boolean) to service_role;
grant execute on function public.close_batch(uuid, text) to service_role;
grant execute on function public.purge_expired_company_research() to service_role;
grant execute on function public.get_balance_usd() to service_role;
