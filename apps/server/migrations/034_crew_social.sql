-- QOL-11: a crew mate's nickname, and who gave it, so the crew sees it and anyone can undo it.
alter table crew_members add column nickname_set_by uuid references users(id) on delete set null;
alter table crew_members add column nickname_at bigint;

-- N-31: reactions and short comments on crew feed lines. A line is named by the stable key the feed builds.
create table feed_reactions (
  crew_id uuid not null references crews(id) on delete cascade,
  item_key text not null,
  user_id uuid not null references users(id) on delete cascade,
  reaction text not null check (reaction in ('laugh', 'fire', 'love', 'cheers', 'wow')),
  at bigint not null,
  primary key (crew_id, item_key, user_id, reaction)
);

create table feed_comments (
  id uuid primary key,
  crew_id uuid not null references crews(id) on delete cascade,
  item_key text not null,
  user_id uuid not null references users(id) on delete cascade,
  text text not null,
  created_at bigint not null
);
create index feed_comments_item on feed_comments(crew_id, item_key);

-- Who a comment mentions; seen_at clears the in-app marker.
create table feed_mentions (
  comment_id uuid not null references feed_comments(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  seen_at bigint,
  primary key (comment_id, user_id)
);
create index feed_mentions_user on feed_mentions(user_id);

-- COM-05: people from outside the crew at a party, who invited them, and whether they may bring their crew.
alter table party_members add column guest boolean not null default false;
alter table party_members add column invited_by uuid references users(id) on delete set null;
alter table party_members add column may_bring_crew boolean not null default false;

-- COM-05: a party the hosts open at one of their venues, shown on that place's public page.
alter table parties add column open_venue_id uuid references venues(id) on delete set null;

create table party_join_requests (
  party_id uuid not null references parties(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  status text not null check (status in ('pending', 'approved', 'refused')),
  at bigint not null,
  decided_by uuid references users(id) on delete set null,
  primary key (party_id, user_id)
);
