-- PROF-09: who can find me by search. By default only someone who types my exact username.
alter table profiles add column findable text not null default 'username' check (findable in ('search', 'username', 'nobody'));
