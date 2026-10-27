-- N-32: who brings what to a party.
create table party_items (
  id uuid primary key,
  party_id uuid not null references parties(id) on delete cascade,
  label text not null,
  added_by uuid not null references users(id) on delete cascade,
  claimed_by uuid references users(id) on delete set null,
  done boolean not null default false,
  created_at bigint not null
);
create index party_items_party on party_items(party_id, created_at);
