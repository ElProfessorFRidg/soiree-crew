-- AI-02: the night told as a short story, published to the recap once someone who was there approves it.
create table party_narrations (
  party_id uuid primary key references parties(id) on delete cascade,
  text text not null,
  tone text not null check (tone in ('plain', 'epic', 'roast')),
  author_id uuid not null references users(id) on delete cascade,
  at bigint not null
);

-- <ai_features>: opt-in per crew, off by default.
alter table crews add column ai_enabled boolean not null default false;
