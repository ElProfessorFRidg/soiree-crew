-- TER-02, RANK-05, N-24: finished games, reported by the phone the game ran on. The winner is
-- computed by the server from the penalties reported, the venue from the reporter's own check-in.
-- Guests (players without an account) count as players, never by name.
create table game_results (
  id uuid primary key,
  crew_id uuid not null references crews(id) on delete cascade,
  party_id uuid references parties(id) on delete set null,
  venue_id uuid references venues(id) on delete set null,
  game_id text not null,
  recorded_by uuid references users(id) on delete set null,
  winner_id uuid references users(id) on delete set null,
  players integer not null,
  -- Members with an account among the players; a win counts on boards from two members up.
  members integer not null,
  guests integer not null default 0,
  record_key text,
  record_user_id uuid references users(id) on delete set null,
  record_count integer,
  played_at bigint not null,
  created_at bigint not null
);
create index game_results_crew on game_results(crew_id, played_at);
create index game_results_party on game_results(party_id);

create table game_result_members (
  result_id uuid not null references game_results(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  penalties integer not null,
  primary key (result_id, user_id)
);
create index game_result_members_user on game_result_members(user_id);
