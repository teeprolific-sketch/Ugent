CREATE TABLE "connections" (
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"account" text,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"scopes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connections_user_id_provider_pk" PRIMARY KEY("user_id","provider")
);
--> statement-breakpoint
CREATE TABLE "support_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"topic" text NOT NULL,
	"message" text NOT NULL,
	"contact" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_business" (
	"user_id" text PRIMARY KEY NOT NULL,
	"phone_number_id" text NOT NULL,
	"display_number" text DEFAULT '' NOT NULL,
	"auto_reply_on" boolean DEFAULT true NOT NULL,
	"auto_reply" text DEFAULT 'Thanks for your message. I''m focused on work right now and will reply soon.' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wa_business_phone_number_id_unique" UNIQUE("phone_number_id")
);
--> statement-breakpoint
CREATE TABLE "wa_inbox" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"from_number" text NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"auto_replied" boolean DEFAULT false NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"user_id" text NOT NULL,
	"product" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_user_id_product_pk" PRIMARY KEY("user_id","product")
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "assignee_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "hustle" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "wake" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sleep" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "focus_until" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "wa_inbox_user_at" ON "wa_inbox" USING btree ("user_id","at");