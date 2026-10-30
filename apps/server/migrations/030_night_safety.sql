-- N-29: how long a member may give no sign of life before the party is told. Per party.
alter table parties add column quiet_after_minutes integer not null default 45;
-- N-29: when the party was last told this member went quiet; told again only after a new sign of life.
alter table party_members add column quiet_alerted_at bigint;
-- O-88: when the crew was told this member's estimate went past 2.0 g/L.
alter table party_members add column danger_alerted_at bigint;
-- O-37: first sign of life at the party (a drink, a water, a status).
alter table party_members add column arrived_at bigint;
-- QOL-10: when the battery went under 10 %, and the last shared position at that moment, sealed.
-- The position goes with the party, like every other one (SEC-06).
alter table party_members add column battery_low_at bigint;
alter table party_members add column last_known_sealed text;
alter table party_members add column last_known_at bigint;
-- N-36: the people who were told first, so the others are told once, later.
alter table party_members add column unwell_widened_at bigint;
