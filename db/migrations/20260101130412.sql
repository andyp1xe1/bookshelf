-- Modify "books" table
ALTER TABLE "public"."books" ADD COLUMN "user_id" text;

-- Backfill existing rows with placeholder user
UPDATE "public"."books" SET "user_id" = 'system' WHERE "user_id" IS NULL;

-- Enforce NOT NULL after backfill
ALTER TABLE "public"."books" ALTER COLUMN "user_id" SET NOT NULL;