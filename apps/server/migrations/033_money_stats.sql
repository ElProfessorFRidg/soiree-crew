-- N-19: an expense can be tied to a party or a trip of the crew (venue_id already exists), carry a
-- receipt photo, and be paid in another currency than the pool's. `rate` is the decimal the person
-- typed (1 unit of the expense currency in pool currency), kept as text so no float is stored.
-- `pool_amount` is the converted amount the server computed from it, in the pool's minor units.
alter table expenses add column party_id uuid references parties(id) on delete set null;
alter table expenses add column rate text;
alter table expenses add column pool_amount integer check (pool_amount is null or pool_amount > 0);
-- The receipt is a JPEG next to the database, like party photos. Only the pool's members get a link.
alter table expenses add column receipt_id uuid;

-- O-70: when someone joined a pool, so an added member is told apart from the founders.
alter table pool_members add column added_at bigint;
alter table pool_members add column added_by uuid references users(id) on delete set null;
