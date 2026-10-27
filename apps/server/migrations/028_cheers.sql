-- JOY-01: two phones bumped together. Each phone reports its knock; two knocks from members of the
-- same crew within 1.5 s make a cheers, which also proves the two were side by side (AC-04).
create table cheer_bumps (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  crew_id uuid not null references crews(id) on delete cascade,
  at bigint not null,
  matched boolean not null default false
);
create index cheer_bumps_crew_at on cheer_bumps(crew_id, at);

create table cheers (
  id uuid primary key,
  crew_id uuid not null references crews(id) on delete cascade,
  user_a uuid not null references users(id) on delete cascade,
  user_b uuid not null references users(id) on delete cascade,
  venue_id uuid references venues(id) on delete set null,
  at bigint not null
);
create index cheers_crew_at on cheers(crew_id, at);
