-- The phone supplies the exact widget state; never persist sensitive lock-screen text in plaintext.
alter table live_activity_devices add column if not exists state_sealed text;
alter table live_activity_devices add column if not exists next_push_at bigint;
alter table live_activity_devices add column if not exists last_push_at bigint;
create index if not exists live_activity_due on live_activity_devices(next_push_at) where next_push_at is not null;
