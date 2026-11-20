-- ActivityKit tokens are scoped to a single Live Activity and authenticated session.
-- No APNs private keys or BAC data are persisted here.
create table live_activity_devices (
  token_hash text primary key,
  token_sealed text not null,
  activity_id text not null,
  user_id uuid not null references users(id) on delete cascade,
  session_hash text not null references sessions(token_hash) on delete cascade,
  created_at bigint not null,
  last_seen_at bigint not null,
  expires_at bigint not null,
  unique (user_id, activity_id)
);
create index live_activity_devices_expiry on live_activity_devices(expires_at);
