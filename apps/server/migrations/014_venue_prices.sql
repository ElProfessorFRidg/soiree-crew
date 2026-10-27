-- N-09: what a drink costs at a bar, as the crew saw it. One price per person, drink and bar; the latest wins.
create table venue_prices (
  venue_id uuid not null references venues(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  kind text not null,
  amount integer not null check (amount > 0),
  currency text not null,
  at bigint not null,
  primary key (venue_id, user_id, kind)
);
