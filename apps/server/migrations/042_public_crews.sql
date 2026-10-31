-- Public crews (open = true) are listed on the server, readable before signing up. Two optional
-- fields help people find the right one: what kind of crew it is and the city it goes out in.
-- Both stay empty (null) until an admin sets them; the listing never shows members.
alter table crews add column category text check (category in ('bars', 'students', 'sport', 'flatmates', 'colleagues', 'other'));
alter table crews add column city text check (char_length(city) <= 60);
alter table crews add constraint crews_description_length check (char_length(description) <= 200);
