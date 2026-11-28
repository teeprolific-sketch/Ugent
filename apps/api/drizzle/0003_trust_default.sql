ALTER TABLE "users" ALTER COLUMN "trust_level" SET DEFAULT 2;--> statement-breakpoint
-- Before launch, everyone was created at level 1, which blocked calls and messages. Move them to the new default.
UPDATE "users" SET "trust_level" = 2 WHERE "trust_level" = 1;
