-- "Where to?" (N-11): one vote per member per party, changeable.
create table venue_votes (
  party_id uuid not null references parties(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  venue_id uuid not null references venues(id) on delete cascade,
  at bigint not null,
  primary key (party_id, user_id)
);
