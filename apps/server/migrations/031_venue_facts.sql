-- N-08, COM-01: opening hours and happy hours a crew enters for its venue while no owner has claimed
-- the place. Stored as a weekly schedule (JSON, see src/hours.ts) so "open now" can be computed.
create table venue_hours (
  venue_id uuid primary key references venues(id) on delete cascade,
  schedule text not null,
  updated_by uuid references users(id) on delete set null,
  updated_at bigint not null
);

-- COM-11: the owner can give the same weekly schedule next to the free text; owner data wins.
alter table place_info add column schedule text;

-- N-08: one HQ per crew, enforced by the database too.
update venues v set is_hq = false
where is_hq and exists (select 1 from venues o where o.crew_id = v.crew_id and o.is_hq and (o.created_at, o.id) < (v.created_at, v.id));
create unique index venues_one_hq on venues(crew_id) where is_hq;

-- N-09: every price anyone noted, kept. venue_prices stays the latest per person for medians.
create table venue_price_history (
  id uuid primary key,
  venue_id uuid not null references venues(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  kind text not null,
  amount integer not null check (amount > 0),
  currency text not null,
  at bigint not null
);
create index venue_price_history_venue on venue_price_history(venue_id, kind, at);

insert into venue_price_history (id, venue_id, user_id, kind, amount, currency, at)
select gen_random_uuid(), venue_id, user_id, kind, amount, currency, at from venue_prices;
