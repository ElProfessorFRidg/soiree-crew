-- QOL-02: the time zone the phone last reported; the day boundary itself lives in the synced preferences.
alter table users add column time_zone text;

-- QOL-21: birthday as month and day; the optional year only ever goes back to its owner.
alter table profiles add column birth_month smallint;
alter table profiles add column birth_day smallint;
alter table profiles add column birth_year smallint;

-- N-06: one private calendar feed per person and crew. The feed is found by the token's hash; the
-- token itself is sealed (SEC-08 key) so the app can show the link again, and a leaked database
-- alone gives no working link. Rotating replaces the row, revoking deletes it.
create table calendar_tokens (
  token_hash text primary key,
  sealed_token text not null,
  user_id uuid not null references users(id) on delete cascade,
  crew_id uuid not null references crews(id) on delete cascade,
  created_at bigint not null,
  unique (user_id, crew_id)
);
