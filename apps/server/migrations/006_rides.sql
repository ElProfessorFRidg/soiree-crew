-- Who goes home with whom (N-27). A group is everyone pointing at the same leader;
-- the leader points at themself. No addresses, no positions: only who and how.
alter table party_members add column home_with uuid references users(id) on delete set null;
alter table party_members add column home_mode text check (home_mode in ('walk', 'car', 'ride', 'transit'));
-- "Can I walk you home?": the person who offered, until it is answered.
alter table party_members add column home_offer_from uuid references users(id) on delete set null;
