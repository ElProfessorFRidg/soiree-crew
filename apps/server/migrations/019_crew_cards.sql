-- N-33: cards written by the crew for its games. They play only once the crew admin approved them.
create table crew_cards (
  id uuid primary key,
  crew_id uuid not null references crews(id) on delete cascade,
  author_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('neverEver', 'pointBlank', 'verdict', 'truth', 'dare', 'bigDare')),
  level text not null check (level in ('normal', 'hard', 'extreme')),
  text text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at bigint not null,
  reviewed_by uuid references users(id) on delete set null
);
create index crew_cards_crew on crew_cards(crew_id, status);
