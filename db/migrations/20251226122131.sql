-- Create "books" table
CREATE TABLE "public"."books" (
  "id" bigserial NOT NULL,
  "title" text NOT NULL,
  "author" text NOT NULL,
  "published_year" integer NOT NULL,
  "isbn" text NOT NULL,
  "genre" text NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "books_isbn_key" UNIQUE ("isbn")
);
