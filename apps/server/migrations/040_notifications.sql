-- O-38, N-35: every notification a person gets, kept as their inbox. Rows hold ids and names the
-- app shows once signed in; pushes built from them carry generic text only (QOL-27, MSG-04).
create table notifications (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  kind text not null,
  party_id uuid references parties(id) on delete cascade,
  crew_id uuid references crews(id) on delete cascade,
  actor_id uuid references users(id) on delete set null,
  -- The thing the app opens: an out call, a conversation, a venue, an SOS alert.
  ref_id text,
  params text not null default '{}',
  -- Bursts on the same thing merge into the unread row (QOL-30): a chat, a party's rounds.
  collapse_key text,
  count int not null default 1,
  created_at bigint not null,
  read_at bigint,
  -- How it went out: sent, passive (no sound, quiet hours), held (summary after quiet hours), silent.
  delivery text not null
);
create index notifications_user_created on notifications(user_id, created_at desc);
create unique index notifications_open_collapse on notifications(user_id, collapse_key) where collapse_key is not null and read_at is null;
create index notifications_held on notifications(delivery) where delivery = 'held';

-- N-35: types switched off (absent means on) and the phone's time zone for quiet hours.
create table notification_settings (
  user_id uuid primary key references users(id) on delete cascade,
  types text not null default '{}',
  time_zone text,
  updated_at bigint not null
);

-- QOL-30: "mute this party until morning".
create table notification_party_mutes (
  user_id uuid not null references users(id) on delete cascade,
  party_id uuid not null references parties(id) on delete cascade,
  until bigint not null,
  primary key (user_id, party_id)
);

-- O-38: push tokens, tied to the session that registered them, so signing out drops them.
create table push_devices (
  token text primary key,
  user_id uuid not null references users(id) on delete cascade,
  session_hash text not null references sessions(token_hash) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  created_at bigint not null,
  last_seen_at bigint not null
);
create index push_devices_user on push_devices(user_id);

-- One-shot and throttled events: recap ready once per party, an overtake once per hour per pair.
create table notification_marks (
  user_id uuid not null references users(id) on delete cascade,
  key text not null,
  at bigint not null,
  primary key (user_id, key)
);

-- RANK-02: last known places on a party's live board, to spot who overtook whom.
create table party_board_ranks (
  party_id uuid not null references parties(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  rank int not null,
  primary key (party_id, user_id)
);
