-- Mastery splits off from the outcome log. clean/close/missed now record every
-- answer, whichever round it came from; `spelled` counts only the clean answers
-- where you produced the French yourself, and that is what retires a word.
-- Backfilled from clean, which is exactly what mastery meant before, so no
-- existing progress moves.
alter table public.echo_reviews
  add column if not exists spelled integer not null default 0 check (spelled >= 0);
update public.echo_reviews set spelled = clean where spelled = 0 and clean > 0;
