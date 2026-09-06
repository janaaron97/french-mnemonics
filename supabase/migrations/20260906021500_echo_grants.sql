-- Row-level security decides which rows a request may touch; it does not grant
-- the privilege to touch the table at all. Without these the client fails with
-- "permission denied for table echo_library". anon gets nothing: the app
-- requires a signed-in user.

grant select, insert, update, delete on public.echo_library to authenticated;
grant select, insert, update, delete on public.echo_reviews to authenticated;
grant select, insert, update, delete on public.echo_state   to authenticated;

revoke select, insert, update, delete on public.echo_library from anon;
revoke select, insert, update, delete on public.echo_reviews from anon;
revoke select, insert, update, delete on public.echo_state   from anon;
