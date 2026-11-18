-- Upgrade older installations that applied migration 048 before token encryption.
-- Never convert plaintext inside SQL: only the application has DATA_KEY.
-- New registrations always use token_sealed; old rows are removed rather than exposed.
alter table live_activity_devices add column if not exists token_sealed text;
-- Existing plaintext tokens cannot be safely converted in SQL without the server key.
-- The app must re-register them through the authenticated API.
delete from live_activity_devices where token_sealed is null;
alter table live_activity_devices alter column token_sealed set not null;
alter table live_activity_devices drop column if exists token;
