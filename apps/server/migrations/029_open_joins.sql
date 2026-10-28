-- Members who came in through an open crew (no invite). They cannot join a night already under way.
alter table crew_members add column via_open boolean not null default false;
