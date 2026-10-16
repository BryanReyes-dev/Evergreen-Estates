-- Dedicated runtime principal for Better Auth. Set its password out-of-band.
CREATE ROLE evergreen_auth
  WITH LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
       NOREPLICATION NOBYPASSRLS;
--> statement-breakpoint

CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "image" text;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint

-- Authentication tables are server-only. RLS and grants restrict all CRUD to
-- the dedicated evergreen_auth login; the read-only evergreen_runtime role
-- does not receive access to these tables.
ALTER TABLE public.account ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.session ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.verification ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "Evergreen auth can manage users"
ON public.users AS PERMISSIVE FOR ALL TO evergreen_auth
USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Evergreen auth can manage accounts"
ON public.account AS PERMISSIVE FOR ALL TO evergreen_auth
USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Evergreen auth can manage sessions"
ON public.session AS PERMISSIVE FOR ALL TO evergreen_auth
USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Evergreen auth can manage verifications"
ON public.verification AS PERMISSIVE FOR ALL TO evergreen_auth
USING (true) WITH CHECK (true);--> statement-breakpoint

GRANT CONNECT ON DATABASE postgres TO evergreen_auth;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO evergreen_auth;--> statement-breakpoint

-- Never expose these tables to Supabase API roles; grant only the auth server.
REVOKE ALL PRIVILEGES
ON TABLE public.users, public.account, public.session, public.verification
FROM PUBLIC, anon, authenticated, service_role;--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.users, public.account, public.session, public.verification
TO evergreen_auth;--> statement-breakpoint
