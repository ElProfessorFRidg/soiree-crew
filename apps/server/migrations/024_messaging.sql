-- MSG-01, MSG-02 (ADR 0005): the server is the MLS delivery service. It knows who is in which
-- conversation and keeps ciphertext in order; it never holds a key that opens a message.

-- One MLS client per signed-in device. The signature key is public and kept after sign-out,
-- so old leaves in a group can still be checked; a device is active while its session exists.
create table chat_devices (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  session_hash text references sessions(token_hash) on delete set null,
  signature_key text not null,
  created_at bigint not null
);
create index chat_devices_user on chat_devices(user_id);
create unique index chat_devices_session on chat_devices(session_hash);

-- One-time key packages; claiming one deletes it.
create table chat_key_packages (
  ref text primary key,
  device_id uuid not null references chat_devices(id) on delete cascade,
  data text not null,
  created_at bigint not null
);
create index chat_key_packages_device on chat_key_packages(device_id, created_at);

create table conversations (
  id uuid primary key,
  kind text not null check (kind in ('crew', 'party', 'direct')),
  crew_id uuid unique references crews(id) on delete cascade,
  party_id uuid unique references parties(id) on delete cascade,
  user_a uuid references users(id) on delete cascade,
  user_b uuid references users(id) on delete cascade,
  -- Null until a device has created the MLS group; then the epoch of the last accepted commit.
  epoch bigint,
  init_device uuid,
  init_at bigint,
  disappear_seconds integer not null default 0,
  created_at bigint not null,
  unique (user_a, user_b),
  check ((kind = 'crew') = (crew_id is not null)),
  check ((kind = 'party') = (party_id is not null)),
  check ((kind = 'direct') = (user_a is not null and user_b is not null and user_a < user_b))
);

-- Devices that are leaves of the group, as declared by the commits the server accepted.
create table conversation_devices (
  conversation_id uuid not null references conversations(id) on delete cascade,
  device_id uuid not null references chat_devices(id) on delete cascade,
  joined_seq bigint not null,
  primary key (conversation_id, device_id)
);
create index conversation_devices_device on conversation_devices(device_id);

create table chat_messages (
  seq bigserial primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_device uuid not null references chat_devices(id) on delete cascade,
  kind text not null check (kind in ('commit', 'application')),
  epoch bigint not null,
  data text not null,
  created_at bigint not null,
  expires_at bigint not null
);
create index chat_messages_conversation on chat_messages(conversation_id, seq);
create index chat_messages_expiry on chat_messages(expires_at);

create table chat_welcomes (
  id uuid primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  device_id uuid not null references chat_devices(id) on delete cascade,
  key_package_ref text not null,
  data text not null,
  after_seq bigint not null,
  created_at bigint not null
);
create index chat_welcomes_device on chat_welcomes(device_id);

-- MSG-03: encrypted media; the key is inside the message, never here.
create table chat_blobs (
  id uuid primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  uploader uuid not null references users(id) on delete cascade,
  bytes integer not null,
  created_at bigint not null,
  expires_at bigint not null
);
create index chat_blobs_expiry on chat_blobs(expires_at);

-- MSG-08: one encrypted history backup per person, opened only with their recovery key.
create table chat_backups (
  user_id uuid primary key references users(id) on delete cascade,
  bytes integer not null,
  updated_at bigint not null
);

-- MSG-07: a reported message arrives decrypted by the reporter's own device, sealed at rest.
alter table reports drop constraint reports_target_kind_check;
alter table reports add constraint reports_target_kind_check check (target_kind in ('profile', 'party', 'venue', 'message'));
alter table reports add column evidence text;
