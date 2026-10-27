-- O-01: an optional email and password to sign in again without another phone.
-- The email is found by a keyed hash and kept sealed; the password only as a scrypt hash.
create table credentials (
  user_id uuid primary key references users(id) on delete cascade,
  email_lookup text unique,
  email_sealed text,
  password_hash text not null,
  updated_at bigint not null
);
