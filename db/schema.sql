CREATE TABLE books (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  published_year INT NOT NULL,
  isbn TEXT NOT NULL UNIQUE,
  genre TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
