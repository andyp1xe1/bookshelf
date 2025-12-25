-- name: CreateBook :one
INSERT INTO books (
  title,
  author,
  published_year,
  isbn,
  genre
) VALUES (
  $1,
  $2,
  $3,
  $4,
  $5
)
RETURNING id, title, author, published_year, isbn, genre, created_at;

-- name: GetBook :one
SELECT id, title, author, published_year, isbn, genre, created_at
FROM books
WHERE id = $1;

-- name: UpdateBook :one
UPDATE books
SET title = $2,
    author = $3,
    published_year = $4,
    isbn = $5,
    genre = $6
WHERE id = $1
RETURNING id, title, author, published_year, isbn, genre, created_at;

-- name: DeleteBook :execrows
DELETE FROM books
WHERE id = $1;

-- name: ListBooks :many
SELECT id, title, author, published_year, isbn, genre, created_at
FROM books
ORDER BY id
LIMIT $1 OFFSET $2;

-- name: CountBooks :one
SELECT count(*)::bigint AS total
FROM books;

-- name: SearchBooks :many
SELECT id, title, author, published_year, isbn, genre, created_at
FROM books
WHERE title ILIKE '%' || $1 || '%' OR author ILIKE '%' || $1 || '%'
ORDER BY id
LIMIT $2 OFFSET $3;

-- name: CountBooksBySearch :one
SELECT count(*)::bigint AS total
FROM books
WHERE title ILIKE '%' || $1 || '%' OR author ILIKE '%' || $1 || '%';
