-- N-18: a drink bought in a round remembers the round, so dropping it also drops your share of the expense.
-- No foreign key: a round left with nobody is deleted, and its dropped drinks keep the id so a retry still knows them.
alter table drinks add column round_id uuid;
create index drinks_round on drinks(round_id) where round_id is not null;
