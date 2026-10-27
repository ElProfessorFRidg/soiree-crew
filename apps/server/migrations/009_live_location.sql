-- N-07: a position shared during a party, by choice. One row per member, sealed,
-- gone after 15 minutes without an update and as soon as the party ends (SEC-06).
create table party_locations (
  party_id uuid not null references parties(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  sealed text not null,
  at bigint not null,
  primary key (party_id, user_id)
);
