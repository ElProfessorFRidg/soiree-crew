create table drink_recommendations (
  venue_id uuid not null references venues(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  drink_id text not null,
  updated_at bigint not null,
  primary key (venue_id, user_id)
);
