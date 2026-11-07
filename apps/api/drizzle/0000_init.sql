CREATE SEQUENCE "public"."ugent_rev" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"team_id" text,
	"title" text NOT NULL,
	"date" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"sample" boolean DEFAULT false NOT NULL,
	"rev" bigint NOT NULL,
	"start" text NOT NULL,
	"dur" integer NOT NULL,
	"kind" text NOT NULL,
	"fixed" boolean DEFAULT false NOT NULL,
	"needs_power" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"team_id" text,
	"title" text NOT NULL,
	"date" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"sample" boolean DEFAULT false NOT NULL,
	"rev" bigint NOT NULL,
	"important" boolean DEFAULT false NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL,
	"done_at" bigint
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"platform" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"lang" text DEFAULT 'en' NOT NULL,
	"peak" text DEFAULT 'morning' NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"plan_expires_at" timestamp with time zone,
	"team_id" text,
	"team_role" text,
	"chat_day" text DEFAULT '' NOT NULL,
	"chat_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE INDEX "events_owner_rev" ON "events" USING btree ("owner_id","rev");--> statement-breakpoint
CREATE INDEX "events_team_rev" ON "events" USING btree ("team_id","rev");--> statement-breakpoint
CREATE INDEX "tasks_owner_rev" ON "tasks" USING btree ("owner_id","rev");--> statement-breakpoint
CREATE INDEX "tasks_team_rev" ON "tasks" USING btree ("team_id","rev");