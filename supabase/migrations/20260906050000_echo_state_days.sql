-- Days on which at least one card was answered, as local YYYY-MM-DD keys.
-- Current and longest streaks are derived from this rather than stored, so
-- they cannot drift out of step with the days themselves.
alter table public.echo_state
  add column if not exists days text[] not null default '{}'
    check (array_length(days, 1) is null or array_length(days, 1) <= 4000);
