-- Party album (N-21, O-84, QOL-09). The image is a file next to the database, never in it;
-- only crew members of the party can list it, and files are served through short-lived signed links.
create table photos (
  id uuid primary key,
  party_id uuid not null references parties(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  width integer not null,
  height integer not null,
  bytes integer not null,
  created_at bigint not null
);
create index photos_party on photos(party_id, created_at);
