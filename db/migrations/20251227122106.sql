-- Create "documents" table
CREATE TABLE "public"."documents" (
  "id" bigserial NOT NULL,
  "book_id" bigint NULL,
  "filename" text NOT NULL,
  "object_key" text NOT NULL,
  "content_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "status" text NOT NULL,
  "checksum" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "documents_object_key_key" UNIQUE ("object_key"),
  CONSTRAINT "documents_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
