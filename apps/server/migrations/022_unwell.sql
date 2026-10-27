-- N-36: "not feeling well", private to the crew of the live party; cleared when fine or home.
alter table party_members add column unwell_at bigint;
