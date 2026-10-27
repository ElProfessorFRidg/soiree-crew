-- Radar (N-01 to N-03): who goes out, and when. Statuses are seen by crew members only (PROF-05).

create table night_statuses (
  user_id uuid not null references users(id) on delete cascade,
  -- Night key YYYY-MM-DD: a status belongs to a night and expires with it.
  night text not null,
  status text not null check (status in ('going_out', 'maybe', 'home', 'unavailable')),
  from_minute integer,
  to_minute integer,
  place text not null default '',
  updated_at bigint not null,
  primary key (user_id, night)
);

create table out_calls (
  id uuid primary key,
  crew_id uuid not null references crews(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  night text not null,
  note text not null default '',
  party_id uuid references parties(id) on delete set null,
  created_at bigint not null
);
create index out_calls_crew_night on out_calls(crew_id, night);

create table out_call_replies (
  call_id uuid not null references out_calls(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  reply text not null check (reply in ('in', 'maybe', 'no')),
  at bigint not null,
  primary key (call_id, user_id)
);

-- SOS alerts (N-28) are kept only as long as the party lasts plus a day.
create table sos_alerts (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  crew_id uuid not null references crews(id) on delete cascade,
  party_id uuid references parties(id) on delete set null,
  sealed_location text,
  created_at bigint not null,
  resolved_at bigint
);
