-- AC-04: a member at the same bar confirms an unverified check-in in one tap.
create table checkin_confirmations (
  check_in_id uuid not null references check_ins(id) on delete cascade,
  confirmer_id uuid not null references users(id) on delete cascade,
  at bigint not null,
  primary key (check_in_id, confirmer_id)
);
create index checkin_confirmations_confirmer on checkin_confirmations(confirmer_id, at);
