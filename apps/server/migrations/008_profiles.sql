-- Profiles with an audience per section (PROF-01 to PROF-08), friends (O-39) and blocks (COM-08).

create table profiles (
  user_id uuid primary key references users(id) on delete cascade,
  bio text not null default '',
  country text not null default '',
  -- {section: "me" | "crews" | "friends" | "everyone"}; missing sections use the defaults in code.
  audiences text not null default '{}',
  -- PROF-03: venue ids hidden from everyone but me.
  hidden_venues text not null default '[]',
  updated_at bigint not null
);

-- One row per pair, smaller id first.
create table friendships (
  user_a uuid not null references users(id) on delete cascade,
  user_b uuid not null references users(id) on delete cascade,
  requested_by uuid not null references users(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  at bigint not null,
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create table blocks (
  blocker uuid not null references users(id) on delete cascade,
  blocked uuid not null references users(id) on delete cascade,
  at bigint not null,
  primary key (blocker, blocked)
);
