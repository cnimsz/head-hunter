-- funding-status module: let other projects share the credit pool.
--
-- 1. prompt_events.project — the reusable <funding-status> pill tags its
--    impression/click events with the host project's name so analytics can
--    be split per project. Nullable: rows written before this migration (and
--    Head Hunter's WaitlistPanel, which doesn't pass one) stay NULL.
--
-- 2. usage_counters.operation gains 'external' — spend reported by other
--    projects via the report-usage edge function. Their rows use
--    session_key = 'project:<name>'. get_balance_usd() / get_capacity_band()
--    already sum every usage_counters row regardless of session_key, so the
--    shared balance picks these up with no function changes. The daily
--    tailoring cap filters on operation = 'tailoring' and is unaffected.
--
-- Additive only; safe to apply before the client/edge-function deploy.

alter table public.prompt_events
  add column if not exists project text;

-- prompt_events accepts anon inserts (public anon key), so constrain the new
-- column like kind/band already are — no oversized strings or junk labels.
-- Same rule as PROJECT_NAME_RE in funding-status.js and report-usage.
alter table public.prompt_events
  drop constraint if exists prompt_events_project_chk;

alter table public.prompt_events
  add constraint prompt_events_project_chk
  check (project is null or project ~ '^[a-z0-9][a-z0-9-]{0,39}$');

alter table public.usage_counters
  drop constraint if exists usage_counters_operation_chk;

alter table public.usage_counters
  add constraint usage_counters_operation_chk
  check (operation in ('tailoring','gap_analysis','jobsearch','research','external'));
