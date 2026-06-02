-- Jobsearch tables, indexes, and RLS.
--
-- Three tables backing the jobsearch skill:
--   jobsearch_candidates    — one row per surfaced role; the 3-card pool
--   jobsearch_feedback      — one row per Pass / Apply submission
--   jobsearch_user_signals  — per-user derived preferences_json, recomputed
--                             after each feedback submission
--
-- Everything is scoped by user_id (= auth.uid()). user_id is denormalized
-- onto feedback so RLS policies don't need to join to candidates.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.jobsearch_candidates (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  company                 text not null,
  title                   text not null,
  location                text,
  jd_url                  text not null,
  why_chosen              text,                       -- model-generated, 1 line
  source_score            real not null default 0,    -- deterministic relevance score
  status                  text not null default 'active'
                            check (status in ('active', 'dismissed', 'applied')),
  jd_status               text not null default 'open'
                            check (jd_status in ('open', 'filled', '404')),
  jd_freshness_checked_at timestamptz,
  source                  text,                       -- e.g. 'jsearch', 'stub'
  external_id             text,                       -- JSearch job_id when available
  created_at              timestamptz not null default now()
);

-- One index for the "show me my active 3" read path.
create index jobsearch_candidates_user_status_idx
  on public.jobsearch_candidates (user_id, status, created_at desc);

-- Used by the dedup check: "has this user already seen company+title?"
-- Case-insensitive so trivial casing differences from JSearch don't slip through.
create index jobsearch_candidates_user_dedup_idx
  on public.jobsearch_candidates (user_id, lower(company), lower(title));

create table public.jobsearch_feedback (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  candidate_id  uuid not null references public.jobsearch_candidates(id) on delete cascade,
  action        text not null check (action in ('pass', 'apply')),
  reason_code   text not null,
  free_text     text,
  created_at    timestamptz not null default now()
);

create index jobsearch_feedback_user_created_idx
  on public.jobsearch_feedback (user_id, created_at desc);

create index jobsearch_feedback_candidate_idx
  on public.jobsearch_feedback (candidate_id);

create table public.jobsearch_user_signals (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  preferences_json jsonb not null default '{}'::jsonb,
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

alter table public.jobsearch_candidates    enable row level security;
alter table public.jobsearch_feedback      enable row level security;
alter table public.jobsearch_user_signals  enable row level security;

-- jobsearch_candidates -----------------------------------------------------

create policy "candidates: select own"
  on public.jobsearch_candidates for select
  to authenticated
  using (auth.uid() = user_id);

create policy "candidates: insert own"
  on public.jobsearch_candidates for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "candidates: update own"
  on public.jobsearch_candidates for update
  to authenticated
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "candidates: delete own"
  on public.jobsearch_candidates for delete
  to authenticated
  using (auth.uid() = user_id);

-- jobsearch_feedback -------------------------------------------------------

create policy "feedback: select own"
  on public.jobsearch_feedback for select
  to authenticated
  using (auth.uid() = user_id);

create policy "feedback: insert own"
  on public.jobsearch_feedback for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "feedback: update own"
  on public.jobsearch_feedback for update
  to authenticated
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "feedback: delete own"
  on public.jobsearch_feedback for delete
  to authenticated
  using (auth.uid() = user_id);

-- jobsearch_user_signals ---------------------------------------------------

create policy "signals: select own"
  on public.jobsearch_user_signals for select
  to authenticated
  using (auth.uid() = user_id);

create policy "signals: insert own"
  on public.jobsearch_user_signals for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "signals: update own"
  on public.jobsearch_user_signals for update
  to authenticated
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "signals: delete own"
  on public.jobsearch_user_signals for delete
  to authenticated
  using (auth.uid() = user_id);
