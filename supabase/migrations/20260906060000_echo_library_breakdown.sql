-- An AI breakdown of a sentence, generated on request from the round and read
-- back on the word's page. explain_of records which sentence it explains, so a
-- breakdown is never shown against a sentence it was not written for.
alter table public.echo_library
  add column if not exists explain    text,
  add column if not exists explain_of text;
