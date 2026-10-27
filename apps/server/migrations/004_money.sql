-- Shared expenses (O-70, N-19) and rounds (N-18). Amounts in minor units with their currency (PREF-06).

create table pools (
  id uuid primary key,
  crew_id uuid not null references crews(id) on delete cascade,
  party_id uuid references parties(id) on delete set null,
  name text not null,
  currency text not null,
  created_by uuid not null references users(id),
  created_at bigint not null,
  closed_at bigint
);
create index pools_crew on pools(crew_id);

create table pool_members (
  pool_id uuid not null references pools(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (pool_id, user_id)
);

create table expenses (
  id uuid primary key,
  pool_id uuid not null references pools(id) on delete cascade,
  payer_id uuid not null references users(id) on delete cascade,
  amount integer not null check (amount > 0),
  currency text not null,
  description text not null,
  split text not null,
  venue_id uuid references venues(id) on delete set null,
  created_by uuid not null references users(id),
  created_at bigint not null,
  deleted_at bigint
);
create index expenses_pool on expenses(pool_id);

create table repayments (
  id uuid primary key,
  pool_id uuid not null references pools(id) on delete cascade,
  from_id uuid not null references users(id) on delete cascade,
  to_id uuid not null references users(id) on delete cascade,
  amount integer not null check (amount > 0),
  currency text not null,
  created_by uuid not null references users(id),
  created_at bigint not null
);

create table rounds (
  id uuid primary key,
  party_id uuid not null references parties(id) on delete cascade,
  payer_id uuid not null references users(id) on delete cascade,
  amount integer not null default 0,
  currency text not null,
  member_ids text not null,
  expense_id uuid references expenses(id) on delete set null,
  created_at bigint not null
);
create index rounds_party on rounds(party_id);

-- Payment details shown to the crew to settle up (N-19). Sealed like every other sensitive field (SEC-04).
create table payment_details (
  user_id uuid primary key references users(id) on delete cascade,
  sealed text not null,
  updated_at bigint not null
);
