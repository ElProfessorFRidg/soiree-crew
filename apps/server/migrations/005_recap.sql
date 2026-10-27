-- Recap reactions (O-41): one emoji per person per participant, editable.

create table recap_reactions (
  party_id uuid not null references parties(id) on delete cascade,
  from_id uuid not null references users(id) on delete cascade,
  to_id uuid not null references users(id) on delete cascade,
  emoji text not null,
  at bigint not null,
  primary key (party_id, from_id, to_id)
);

-- When each member first opened the recap, so the morning screen stops pointing at it (QOL-20).
alter table party_members add column recap_seen_at bigint;
