-- House pint: the strength of a bar's draught pint, entered once by a crew member checked in there
-- and shared with the crew, so "Pinte" and "Encore" log the right strength at that bar.
-- The range mirrors HOUSE_PINT_ABV in src/routes/venueFacts.ts: no beer on tap is under 2 % or above 14 %.
create table venue_house_pints (
  venue_id uuid primary key references venues(id) on delete cascade,
  abv numeric(4, 3) not null check (abv >= 0.02 and abv <= 0.14),
  updated_by uuid references users(id) on delete set null,
  updated_at bigint not null
);
