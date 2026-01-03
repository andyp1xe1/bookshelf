-- Replace system user_id with specific user ID
UPDATE "public"."books" 
SET "user_id" = 'user_37imF4i2sRlwaKmvarSWxNtBxIr' 
WHERE "user_id" = 'system';
