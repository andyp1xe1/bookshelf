create table books (
  id bigserial primary key,
  user_id text not null,
  title text not null,
  author text not null,
  published_year int not null,
  isbn text not null unique,
  genre text,
  created_at timestamptz not null default now()
);

create table documents (
  id bigserial primary key,
  book_id bigint references books(id) on delete cascade,
  filename text not null,
  object_key text not null unique,
  content_type text not null,
  size_bytes bigint not null,
  status text not null,
  checksum text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
