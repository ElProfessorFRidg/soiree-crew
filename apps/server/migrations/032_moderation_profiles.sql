-- COM-08, O-77: every piece of user content can be reported. author_id is who posted it, so an
-- upheld report reaches the right person; decision and ground are the statement of reasons (DSA).
alter table reports drop constraint reports_target_kind_check;
alter table reports add constraint reports_target_kind_check check (target_kind in ('profile', 'party', 'venue', 'message', 'review', 'photo', 'quote', 'card'));
alter table reports drop constraint reports_reason_check;
alter table reports add constraint reports_reason_check check (reason in ('harassment', 'fake', 'inappropriate', 'personalData', 'other'));
alter table reports add column author_id uuid references users(id) on delete set null;
alter table reports add column decision text check (decision in ('upheld', 'dismissed'));
alter table reports add column ground text;
alter table reports add column decided_by uuid references users(id) on delete set null;
create index reports_operator on reports(at) where crew_id is null and decision is null;

-- COM-08: one strike per upheld report (operator decision); three in 180 days stop posting for a while.
create table strikes (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  report_id uuid references reports(id) on delete set null,
  ground text not null,
  at bigint not null
);
create index strikes_user on strikes(user_id, at);

create table posting_bans (
  user_id uuid primary key references users(id) on delete cascade,
  until bigint not null
);

-- COM-08 (DSA statement of reasons): what was decided about my content, or about my report, and why.
create table moderation_notices (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  report_id uuid references reports(id) on delete set null,
  kind text not null check (kind in ('removed', 'kept', 'reportUpheld', 'reportDismissed')),
  target_kind text not null,
  ground text not null,
  excerpt text not null default '',
  decided_by text not null check (decided_by in ('crew', 'operator')),
  strikes integer not null default 0,
  banned_until bigint,
  at bigint not null,
  read_at bigint,
  appeal text,
  appealed_at bigint,
  appeal_outcome text check (appeal_outcome in ('reversed', 'confirmed'))
);
create index moderation_notices_user on moderation_notices(user_id, at);

-- COM-02, QOL-09: photos on a review. Files sit next to the party album's, served through the same signed links.
create table review_photos (
  id uuid primary key,
  review_id uuid not null references place_reviews(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  width integer not null,
  height integer not null,
  bytes integer not null,
  created_at bigint not null
);
create index review_photos_review on review_photos(review_id);

-- PROF-03: single reviews and single figures hidden from everyone but me, like venues.
alter table profiles add column hidden_reviews text not null default '[]';
alter table profiles add column hidden_stats text not null default '[]';

-- TER-11: "I work here" waits for a crew admin (or the venue's owner). Rows from before stay in force.
alter table workplace_exclusions add column status text not null default 'approved' check (status in ('pending', 'approved', 'rejected'));
alter table workplace_exclusions add column requested_by uuid references users(id) on delete set null;
alter table workplace_exclusions add column requested_at bigint;
alter table workplace_exclusions add column decided_by uuid references users(id) on delete set null;
alter table workplace_exclusions add column decided_at bigint;

-- PROF-02 (games section), N-24: the server knew nothing about games. A finished game posts its
-- winner when the winner and the poster are account holders at the same table.
create table game_wins (
  id uuid primary key,
  game_id text not null,
  winner_id uuid not null references users(id) on delete cascade,
  posted_by uuid not null references users(id) on delete cascade,
  players integer not null,
  at bigint not null
);
create index game_wins_winner on game_wins(winner_id);

-- O-43: a personal link that turns into a friend request to its owner.
create table referral_codes (
  user_id uuid primary key references users(id) on delete cascade,
  code text not null unique,
  created_at bigint not null
);
