-- One person, several crews: friends, school, family, work, a sports team. Each says what it is.
alter table crews add column kind text not null default 'friends' check (kind in ('friends', 'school', 'family', 'work', 'sport', 'other'));
-- Open crews are listed on the server and anyone signed in there can join without an invite
-- (a student union, a running club). Off by default; only an admin turns it on.
alter table crews add column open boolean not null default false;
alter table crews add column description text not null default '';
create index crews_open on crews(open) where open;
