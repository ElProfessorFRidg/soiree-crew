-- AC-12: replay protection that works with the offline queue (research/anticheat.md §2.6).
-- Per install: the last sequence number and the hash chain head; regressions are refused.
create table install_chains (
  install_id text primary key,
  user_id uuid not null references users(id) on delete cascade,
  last_seq bigint not null,
  last_hash text not null,
  updated_at bigint not null
);

-- The nonce book: single-use, 24 h, issued while online and spent offline.
create table event_nonces (
  nonce text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at bigint not null,
  used_at bigint
);
create index event_nonces_user on event_nonces(user_id, used_at);

-- What the envelope of a drink proved: ok, stale (over 24 h old), broken_chain, no_nonce or unknown_age.
alter table drinks add column envelope_trust text;
