-- N-04: outing polls. A few slots, everyone answers yes / maybe / no, closing one creates the party.
create table polls (
  id uuid primary key,
  crew_id uuid not null references crews(id) on delete cascade,
  created_by uuid not null references users(id) on delete cascade,
  title text not null,
  place text not null default '',
  plan text not null default '',
  created_at bigint not null,
  closed_at bigint,
  party_id uuid references parties(id) on delete set null
);
create index polls_crew on polls(crew_id, created_at);

create table poll_slots (
  id uuid primary key,
  poll_id uuid not null references polls(id) on delete cascade,
  starts_at bigint not null,
  ends_at bigint not null
);

create table poll_votes (
  slot_id uuid not null references poll_slots(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  answer text not null check (answer in ('yes', 'maybe', 'no')),
  at bigint not null,
  primary key (slot_id, user_id)
);

-- N-05: the weekdays someone usually goes out, per crew. Monday = 1 ... Sunday = 7.
create table usual_nights (
  crew_id uuid not null references crews(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  weekdays text not null default '[]',
  primary key (crew_id, user_id)
);
