-- Tables for the Écho sound-palace trainer.
-- Keyed by the bundled corpus id. Separate from library_words / review_progress,
-- which belong to the other frenchecho app and are left untouched.

create table if not exists public.echo_library (
  user_id  uuid        not null references auth.users(id) on delete cascade,
  word_id  integer     not null check (word_id between 1 and 100000),
  note     text        not null default '' check (char_length(note) <= 5000),
  known_at timestamptz,
  added_at timestamptz not null default now(),
  primary key (user_id, word_id)
);

create table if not exists public.echo_reviews (
  user_id       uuid        not null references auth.users(id) on delete cascade,
  word_id       integer     not null check (word_id between 1 and 100000),
  due           timestamptz not null default now(),
  interval_days integer     not null default 0 check (interval_days between 0 and 36500),
  reviews       integer     not null default 0 check (reviews >= 0),
  last_reviewed timestamptz,
  primary key (user_id, word_id)
);

create table if not exists public.echo_state (
  user_id    uuid        primary key references auth.users(id) on delete cascade,
  xp         bigint      not null default 0 check (xp >= 0),
  rounds     integer     not null default 0 check (rounds >= 0),
  best       integer     not null default 0 check (best >= 0),
  cursor     integer     not null default 0 check (cursor >= 0),
  levels     text[]      not null default '{A1}' check (
                 array_length(levels, 1) between 1 and 5
                 and levels <@ array['A1','A2','B1','B2','C1']),
  sound      boolean     not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists echo_reviews_due_idx on public.echo_reviews (user_id, due);
create index if not exists echo_library_known_idx on public.echo_library (user_id, known_at);

alter table public.echo_library enable row level security;
alter table public.echo_reviews enable row level security;
alter table public.echo_state   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['echo_library','echo_reviews','echo_state'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select using ((select auth.uid()) = user_id)', t || '_select', t);
    execute format('create policy %I on public.%I for insert with check ((select auth.uid()) = user_id)', t || '_insert', t);
    execute format('create policy %I on public.%I for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t || '_update', t);
    execute format('create policy %I on public.%I for delete using ((select auth.uid()) = user_id)', t || '_delete', t);
  end loop;
end $$;
