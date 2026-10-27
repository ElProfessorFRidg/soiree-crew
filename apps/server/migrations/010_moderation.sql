-- COM-08: mute (their calls and notes disappear for me) and reports, read by the crew's admins.
create table mutes (
  muter uuid not null references users(id) on delete cascade,
  muted uuid not null references users(id) on delete cascade,
  at bigint not null,
  primary key (muter, muted)
);

create table reports (
  id uuid primary key,
  reporter uuid not null references users(id) on delete cascade,
  target_kind text not null check (target_kind in ('profile', 'party', 'venue')),
  target_id uuid not null,
  crew_id uuid references crews(id) on delete cascade,
  reason text not null check (reason in ('harassment', 'fake', 'inappropriate', 'other')),
  note text not null default '',
  at bigint not null,
  handled_at bigint
);
create index reports_crew on reports(crew_id);
