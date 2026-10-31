-- "Me détecter avec mon crew": the latest coarse position of a person who turned it on, nothing
-- older. Rounded to about 100 m by the phone and again here; deleted 30 min after it was sent
-- (the sweeper) or when the switch goes off. Never shown to anyone: it only finds crew members
-- who are together at night.
create table whereabouts (
  user_id uuid primary key references users(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  at bigint not null,
  -- The phone's "mute until morning", so the crew nudge keeps quiet too.
  muted_until bigint
);
create index whereabouts_at on whereabouts(at);

-- Every "go out?" nudge, from the phone (outing, times only) or from the crew match, and what
-- followed: 'forgot' (something logged within 90 min, or back-dated before it), 'unused' (nothing
-- logged that night), 'logged' (logged later that night: neither). No place is kept.
create table outing_nudges (
  user_id uuid not null references users(id) on delete cascade,
  at bigint not null,
  source text not null check (source in ('local', 'crew')),
  outcome text check (outcome in ('forgot', 'unused', 'logged')),
  primary key (user_id, at)
);
create index outing_nudges_open on outing_nudges(at) where outcome is null;

-- How each person answers the nudges: a moving average of "forgot" (1) against "unused" (0),
-- the run of ignored nights, and the pause it caused.
create table outing_habits (
  user_id uuid primary key references users(id) on delete cascade,
  score real not null default 0.5,
  ignored_streak int not null default 0,
  last_ignored_at bigint,
  paused_until bigint,
  updated_at bigint not null
);
