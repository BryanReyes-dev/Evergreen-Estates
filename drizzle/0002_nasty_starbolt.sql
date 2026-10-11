ALTER TABLE "seller_profiles" DROP CONSTRAINT "seller_profiles_contact_method_check";--> statement-breakpoint
ALTER TABLE "seller_profiles" ALTER COLUMN "contact_email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_contact_method_check" CHECK ((
			"seller_profiles"."preferred_contact_method" = 'email'
			AND "seller_profiles"."contact_email" IS NOT NULL
		) OR (
			"seller_profiles"."preferred_contact_method" = 'phone'
			AND "seller_profiles"."contact_phone" IS NOT NULL
		));