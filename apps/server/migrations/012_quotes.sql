-- N-23: lines of the night, written by anyone who was there, voted by the crew.
create table party_quotes (
  id uuid primary key,
  party_id uuid not null references parties(id) on delete cascade,
  said_by uuid references users(id) on delete set null,
  added_by uuid not null references users(id) on delete cascade,
  text text not null,
  created_at bigint not null
);
create index party_quotes_party on party_quotes(party_id);

create table party_quote_votes (
  quote_id uuid not null references party_quotes(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (quote_id, user_id)
);
