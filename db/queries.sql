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

-- name: CreateDocument :one
INSERT INTO documents (
  book_id,
  filename,
  object_key,
  content_type,
  size_bytes,
  status,
  checksum
) VALUES (
  $1,
  $2,
  $3,
  $4,
  $5,
  $6,
  $7
)
RETURNING id, book_id, filename, object_key, content_type, size_bytes, status, checksum, created_at, updated_at;

-- name: GetDocument :one
SELECT id, book_id, filename, object_key, content_type, size_bytes, status, checksum, created_at, updated_at
FROM documents
WHERE id = $1;

-- name: UpdateDocumentStatus :one
UPDATE documents
SET status = $2,
    updated_at = now()
WHERE id = $1
RETURNING id, book_id, filename, object_key, content_type, size_bytes, status, checksum, created_at, updated_at;

-- name: DeleteDocument :execrows
DELETE FROM documents
WHERE id = $1;

-- name: ListDocumentsByBook :many
SELECT id, book_id, filename, object_key, content_type, size_bytes, status, checksum, created_at, updated_at
FROM documents
WHERE book_id = $1
ORDER BY id
LIMIT $2 OFFSET $3;

-- name: CountDocumentsByBook :one
SELECT count(*)::bigint AS total
FROM documents
WHERE book_id = $1;

-- name: GetDocumentByObjectKey :one
SELECT id, book_id, filename, object_key, content_type, size_bytes, status, checksum, created_at, updated_at
FROM documents
WHERE object_key = $1;

-- name: UpdateFullDocument :one
UPDATE documents
SET filename = $2,
    object_key = $3,
    content_type = $4,
    size_bytes = $5,
    status = $6,
    checksum = $7,
    updated_at = now()
WHERE id = $1
RETURNING id, book_id, filename, object_key, content_type, size_bytes, status, checksum, created_at, updated_at;

-- name: InsertOrUpdateDocument :one
INSERT INTO documents (
  book_id,
  filename,
  object_key,
  content_type,
  size_bytes,
  status,
  checksum
) VALUES (
  $1,
  $2,
  $3,
  $4,
  $5,
  $6,
  $7
) ON CONFLICT (object_key) DO UPDATE
SET book_id = EXCLUDED.book_id,
    filename = EXCLUDED.filename,
    content_type = EXCLUDED.content_type,
    size_bytes = EXCLUDED.size_bytes,
    status = EXCLUDED.status,
    checksum = EXCLUDED.checksum,
    updated_at = now()
RETURNING id, book_id, filename, object_key, content_type, size_bytes, status, checksum, created_at, updated_at;
