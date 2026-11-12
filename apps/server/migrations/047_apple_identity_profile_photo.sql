-- O-01: the Apple identity an account was made with. Only the stable subject is kept, never the
-- token. One Apple identity opens one account.
create table apple_identities (
  sub text primary key,
  user_id uuid not null references users(id) on delete cascade,
  created_at bigint not null
);
create index apple_identities_user on apple_identities(user_id);

-- O-04: the profile photo, one per account. The file sits next to the album photos and is served
-- through the same signed links.
create table profile_photos (
  user_id uuid primary key references users(id) on delete cascade,
  id uuid not null unique,
  bytes integer not null,
  updated_at bigint not null
);
