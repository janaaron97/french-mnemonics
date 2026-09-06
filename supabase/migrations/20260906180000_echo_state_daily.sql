-- Words studied per day, for the line on the Progress page. `days` already
-- says which days you were active; this says how many distinct words each one
-- covered. Days recorded before this column existed have no count, and the
-- chart breaks its line over them rather than drawing a false zero.
alter table public.echo_state
  add column if not exists daily jsonb not null default '{}'::jsonb;
