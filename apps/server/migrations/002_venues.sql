-- Venues, check-ins and territories (N-08, N-10, TER-01 to TER-09, AC-01 to AC-09).

create table venues (
  id uuid primary key,
  crew_id uuid not null references crews(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('bar', 'club', 'spot', 'home')),
  -- Venue position only, never a person's (TER-09). Homes stay off the territory map.
  lat double precision not null,
  lng double precision not null,
  address text not null default '',
  radius_m integer not null default 75,
  is_hq boolean not null default false,
  created_by uuid not null references users(id),
  created_at bigint not null
);
create index venues_crew on venues(crew_id);

create table check_ins (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  venue_id uuid not null references venues(id) on delete cascade,
  party_id uuid references parties(id) on delete set null,
  at bigint not null,
  ended_at bigint,
  last_proof_at bigint not null,
  verdict text not null check (verdict in ('accepted', 'unverified', 'rejected', 'not_here')),
  risk integer not null,
  -- Signal names and points only. Raw coordinates are deleted after the verdict (SEC-06).
  signals text not null,
  config_version integer not null,
  corroborated boolean not null default false,
  private boolean not null default false,
  -- Keyed hash of the fix rounded to 1e-6 degrees, to spot identical coordinates later without keeping GPS.
  fix_hash text not null,
  overturned_by uuid references users(id),
  created_at bigint not null
);
create index check_ins_user_time on check_ins(user_id, at);
create index check_ins_venue_time on check_ins(venue_id, at);

create table drink_confirmations (
  drink_id uuid not null references drinks(id) on delete cascade,
  confirmer_id uuid not null references users(id) on delete cascade,
  at bigint not null,
  primary key (drink_id, confirmer_id)
);

alter table crew_members add column territory_opt_out boolean not null default false;
alter table crew_members add column leaderboard_opt_out boolean not null default false;
alter table crews add column leaderboard_enabled boolean not null default true;

create table workplace_exclusions (
  venue_id uuid not null references venues(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (venue_id, user_id)
);

create table reigns (
  id uuid primary key,
  venue_id uuid not null references venues(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  season text not null,
  started_at bigint not null,
  ended_at bigint,
  ended_reason text
);
create index reigns_venue on reigns(venue_id, season);

-- Nights and seasons start at 06:00 in the crew's own time zone.
alter table crews add column time_zone text not null default 'Europe/Paris';
