-- Per-word learning activity. `reviews` already counts every answer; these split
-- it by outcome. clean = spelled exactly and unaided, and drives mastery
-- (10 clean answers retires a word to your known words automatically).
alter table public.echo_reviews
  add column if not exists clean  integer not null default 0 check (clean  >= 0),
  add column if not exists close  integer not null default 0 check (close  >= 0),
  add column if not exists missed integer not null default 0 check (missed >= 0);
