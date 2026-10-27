-- COM-01 to COM-10, PROF-04: the public side of venues. A "place" is every crew's venue within
-- 40 m of each other (TER-07); nothing here is tied to one crew.

create table place_reviews (
  id uuid primary key,
  venue_id uuid not null references venues(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  -- {prices, vibe, music, service, queue, safe}: 1 to 5 each.
  ratings text not null,
  text text not null default '',
  audience text not null check (audience in ('public', 'anonymous', 'friends', 'me')),
  visited_at bigint not null,
  created_at bigint not null,
  updated_at bigint not null,
  unique (venue_id, user_id)
);

create table review_votes (
  review_id uuid not null references place_reviews(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (review_id, user_id)
);

create table place_tags (
  venue_id uuid not null references venues(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  tag text not null,
  primary key (venue_id, user_id, tag)
);

-- COM-07: the door, never who is inside.
create table door_reports (
  venue_id uuid not null references venues(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  id_check text not null check (id_check in ('always', 'sometimes', 'never')),
  age_policy text check (age_policy in ('adults', 'allAgesEarly')),
  at bigint not null,
  primary key (venue_id, user_id)
);

create table place_events (
  id uuid primary key,
  venue_id uuid not null references venues(id) on delete cascade,
  created_by uuid not null references users(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('dj', 'student', 'match', 'concert', 'quiz', 'other')),
  starts_at bigint not null,
  created_at bigint not null
);

create table event_rsvps (
  event_id uuid not null references place_events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (event_id, user_id)
);

-- COM-10: places a crew wants to try, for "Where to?".
create table want_to_go (
  crew_id uuid not null references crews(id) on delete cascade,
  venue_id uuid not null references venues(id) on delete cascade,
  added_by uuid not null references users(id) on delete cascade,
  at bigint not null,
  primary key (crew_id, venue_id)
);

-- COM-03, COM-05: off by default; who can send me friend requests.
alter table profiles add column regular_opt_in boolean not null default false;
alter table profiles add column open_to_meet boolean not null default false;
alter table profiles add column requests_from text not null default 'everyone' check (requests_from in ('nobody', 'friendsOfFriends', 'everyone'));

-- COM-04: a crew's name shows on public profiles only if the crew agrees.
alter table crews add column public_name boolean not null default false;
