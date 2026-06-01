-- Gap analysis tables, indexes, and RLS.
--
-- Two tables backing the cv-gap-analysis skill:
--   gap_analysis_runs       — one row per "Run Gap Analysis" click
--   gap_analysis_findings   — N rows per run (the individual gap cards)
--
-- Everything is scoped by user_id (= auth.uid()). user_id is denormalized
-- onto findings so RLS policies don't need to join to runs.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.gap_analysis_runs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  tailored_cv_id  uuid,            -- nullable: tailored CVs aren't yet persisted
  jd_url          text,
  jd_excerpt      text,            -- first ~500 chars, for human-readable identification
  company_name    text,
  role_title      text,
  status          text not null default 'in_progress'
                    check (status in ('in_progress', 'complete')),
  total_gaps      int  not null default 0,
  addressed_count int  not null default 0,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create index gap_analysis_runs_user_created_idx
  on public.gap_analysis_runs (user_id, created_at desc);

create table public.gap_analysis_findings (
  id                  uuid primary key default gen_random_uuid(),
  run_id              uuid not null references public.gap_analysis_runs(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  gap_title           text not null,
  gap_rationale       text not null,
  gap_question        text not null,
  impact_rank         int  not null,
  impact_tier         text not null check (impact_tier in ('highest', 'medium', 'hiding')),
  status              text not null default 'open'
                        check (status in ('open', 'answered', 'skipped', 'doesnt_apply')),
  user_answer         text,
  applied_to_master   boolean not null default false,
  master_cv_section   text,
  created_at          timestamptz not null default now(),
  answered_at         timestamptz
);

create index gap_analysis_findings_run_idx
  on public.gap_analysis_findings (run_id);

create index gap_analysis_findings_user_status_idx
  on public.gap_analysis_findings (user_id, status);

-- Fast path for the "doesn't apply" suppression check in future runs.
create index gap_analysis_findings_user_doesntapply_idx
  on public.gap_analysis_findings (user_id)
  where status = 'doesnt_apply';

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

alter table public.gap_analysis_runs     enable row level security;
alter table public.gap_analysis_findings enable row level security;

-- gap_analysis_runs --------------------------------------------------------

create policy "runs: select own"
  on public.gap_analysis_runs for select
  to authenticated
  using (auth.uid() = user_id);

create policy "runs: insert own"
  on public.gap_analysis_runs for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "runs: update own"
  on public.gap_analysis_runs for update
  to authenticated
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "runs: delete own"
  on public.gap_analysis_runs for delete
  to authenticated
  using (auth.uid() = user_id);

-- gap_analysis_findings ----------------------------------------------------

create policy "findings: select own"
  on public.gap_analysis_findings for select
  to authenticated
  using (auth.uid() = user_id);

create policy "findings: insert own"
  on public.gap_analysis_findings for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "findings: update own"
  on public.gap_analysis_findings for update
  to authenticated
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "findings: delete own"
  on public.gap_analysis_findings for delete
  to authenticated
  using (auth.uid() = user_id);
