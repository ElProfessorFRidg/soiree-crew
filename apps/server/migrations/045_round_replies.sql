-- QOL-03: a round answered from its notification. 'ok' confirms it; 'not_me' takes the member out
-- of it: their drink from the round is removed and the expense is split among the others.
create table round_replies (
  round_id uuid not null references rounds(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  reply text not null check (reply in ('ok', 'not_me')),
  at bigint not null,
  primary key (round_id, user_id)
);
