-- Add a model-produced match score (0-100) and a short rationale to each
-- gap-analysis run. Populated by the gap-analysis edge function from the
-- same JSON response that produces the gaps. Nullable so existing rows
-- (and any future run where the model omits the field) remain valid.

alter table public.gap_analysis_runs
  add column match_score           smallint
    check (match_score is null or (match_score between 0 and 100)),
  add column match_score_rationale text;
