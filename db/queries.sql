-- name: CreateBook :one
insert into books (
  user_id,
  title,
  author,
  published_year,
  isbn,
  genre
) values (
  $1,
  $2,
  $3,
  $4,
  $5,
  $6
)
returning id,
          user_id,
          title,
          author,
          published_year,
          isbn,
          genre,
          created_at;

-- name: GetBook :one
select id,
        user_id,
        title,
        author,
        published_year,
        isbn,
        genre,
        created_at
from books
where id = $1;

-- name: UpdateBook :one
update books
set title = $3,
    author = $4,
    published_year = $5,
    isbn = $6,
    genre = $7
where id = $1 and user_id = $2
returning id,
          user_id,
          title,
          author,
          published_year,
          isbn,
          genre,
          created_at;

-- name: DeleteBook :execrows
delete from books
where id = $1 and user_id = $2;

-- name: ListBooks :many
select id,
       user_id,
       title,
       author,
       published_year,
       isbn,
       genre,
       created_at
from books
order by id
limit $1 offset $2;

-- name: CountBooks :one
select count(*)::bigint as total
from books;

-- name: SearchBooks :many
select id,
       user_id,
       title,
       author,
       published_year,
       isbn,
       genre,
       created_at
from books
where title ilike '%' || $1 || '%' or author ilike '%' || $1 || '%'
order by id
limit $2 offset $3;

-- name: CountBooksBySearch :one
select count(*)::bigint as total
from books
where title ilike '%' || $1 || '%' or author ilike '%' || $1 || '%';

-- name: CreateDocument :one
insert into documents as d
(
  book_id,
  filename,
  object_key,
  content_type,
  size_bytes,
  status,
  checksum
)
select $1, $3, $4, $5, $6, $7, $8
from books as b
where b.id = $1
  and b.user_id = $2
returning d.id,
          d.book_id,
          d.filename,
          d.object_key,
          d.content_type,
          d.size_bytes,
          d.status,
          d.checksum,
          d.created_at,
          d.updated_at;

-- name: GetDocument :one
select id,
       book_id,
       filename,
       object_key,
       content_type,
       size_bytes,
       status,
       checksum,
       created_at,
       updated_at
from documents
where id = $1;

-- name: UpdateDocumentStatus :one
update documents as d
set status = $3,
    updated_at = now()
from books as b
where d.id = $1
  and d.book_id = b.id
  and b.user_id = $2
returning d.id,
          d.book_id,
          d.filename,
          d.object_key,
          d.content_type,
          d.size_bytes,
          d.status,
          d.checksum,
          d.created_at,
          d.updated_at;

-- name: DeleteDocument :execrows
delete from documents
using books
where documents.id = $1
  and documents.book_id = $2
  and documents.book_id = books.id
  and books.user_id = $3;

-- name: ListDocumentsByBook :many
select id,
       book_id,
       filename,
       object_key,
       content_type,
       size_bytes,
       status,
       checksum,
       created_at,
       updated_at
from documents
where book_id = $1
order by id
limit $2 offset $3;

-- name: CountDocumentsByBook :one
select count(*)::bigint as total
from documents
where book_id = $1;

-- name: GetDocumentByObjectKey :one
select id,
       book_id,
       filename,
       object_key,
       content_type,
       size_bytes,
       status,
       checksum,
       created_at,
       updated_at
from documents
where object_key = $1;

-- name: UpdateFullDocument :one
update documents as d
set filename = $3,
    content_type = $4,
    size_bytes = $5,
    status = $6,
    checksum = $7,
    updated_at = now()
from books as b
where d.id = $1
  and d.book_id = b.id
  and b.user_id = $2
returning d.id,
          d.book_id,
          d.filename,
          d.object_key,
          d.content_type,
          d.size_bytes,
          d.status,
          d.checksum,
          d.created_at,
          d.updated_at;

-- name: InsertOrUpdateDocument :one
insert into documents 
(
  book_id,
  filename,
  object_key,
  content_type,
  size_bytes,
  status,
  checksum
) 
select $1, $3, $4, $5, $6, $7, $8
from books as b
where b.id = $1
  and b.user_id = $2
on conflict (object_key) do update
set book_id = excluded.book_id,
    filename = excluded.filename,
    content_type = excluded.content_type,
    size_bytes = excluded.size_bytes,
    status = excluded.status,
    checksum = excluded.checksum,
    updated_at = now()
returning id,
          book_id,
          filename,
          object_key,
          content_type,
          size_bytes,
          status,
          checksum,
          created_at,
          updated_at;

-- name: CheckBookOwnership :one
select id
from books
where id = $1 and user_id = $2;

-- name: CheckDocumentOwnership :one
select d.id
from documents d
join books b on d.book_id = b.id
where d.id = $1 and b.user_id = $2;

-- name: DeleteDocumentsByBook :execrows
delete from documents as d
using books as b
where d.book_id = b.id
  and d.book_id = $1
  and b.user_id = $2;
