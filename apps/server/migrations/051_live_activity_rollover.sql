-- Device-scoped ActivityKit push-to-start token for iOS 17.2+ renewals.
-- All tokens and state are AES-GCM sealed via the application DATA_KEY.
create table live_activity_start_devices (
  session_hash text primary key references sessions(token_hash) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  token_sealed text not null,
  last_seen_at bigint not null,
  rotation_pending_at bigint
);
alter table live_activity_devices add column if not exists attributes_sealed text;
