-- COM-11: a venue's owner claims its public page. The server operator checks the claim.
-- Owners post hours, happy hours and events and answer reviews; they can never delete or hide one.
create table place_claims (
  id uuid primary key,
  venue_id uuid not null references venues(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  status text not null check (status in ('pending', 'approved', 'rejected')),
  -- How the operator can check it: a role and a business phone, website or email. Sealed.
  proof text not null,
  requested_at bigint not null,
  decided_at bigint,
  decided_by uuid references users(id) on delete set null
);
create index place_claims_venue on place_claims(venue_id);
create unique index place_claims_one_pending on place_claims(venue_id, user_id) where status = 'pending';

create table place_info (
  venue_id uuid primary key references venues(id) on delete cascade,
  hours text not null default '',
  happy_hours text not null default '',
  updated_by uuid references users(id) on delete set null,
  updated_at bigint not null
);

create table review_replies (
  review_id uuid primary key references place_reviews(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  text text not null,
  at bigint not null
);

alter table place_events add column official boolean not null default false;
