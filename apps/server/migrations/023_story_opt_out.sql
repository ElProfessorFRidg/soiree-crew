-- N-37: someone can say no to appearing in stories that leave the crew (recap card, photo strip).
alter table profiles add column story_opt_out boolean not null default false;
