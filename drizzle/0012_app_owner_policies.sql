CREATE POLICY "App can create own listings" ON "listings" AS PERMISSIVE FOR INSERT TO "evergreen_app" WITH CHECK ("listings"."seller_user_id" = 
  nullif(current_setting('app.current_user_id', true), '')::uuid
);--> statement-breakpoint
CREATE POLICY "App can update own listings" ON "listings" AS PERMISSIVE FOR UPDATE TO "evergreen_app" USING ("listings"."seller_user_id" = 
  nullif(current_setting('app.current_user_id', true), '')::uuid
) WITH CHECK ("listings"."seller_user_id" = 
  nullif(current_setting('app.current_user_id', true), '')::uuid
);--> statement-breakpoint
CREATE POLICY "App can delete own listings" ON "listings" AS PERMISSIVE FOR DELETE TO "evergreen_app" USING ("listings"."seller_user_id" = 
  nullif(current_setting('app.current_user_id', true), '')::uuid
);--> statement-breakpoint
CREATE POLICY "App can read own seller profile" ON "seller_profiles" AS PERMISSIVE FOR SELECT TO "evergreen_app" USING ("seller_profiles"."user_id" = 
  nullif(current_setting('app.current_user_id', true), '')::uuid
);--> statement-breakpoint
CREATE POLICY "App can create own seller profile" ON "seller_profiles" AS PERMISSIVE FOR INSERT TO "evergreen_app" WITH CHECK ("seller_profiles"."user_id" = 
  nullif(current_setting('app.current_user_id', true), '')::uuid
);--> statement-breakpoint
CREATE POLICY "App can update own seller profile" ON "seller_profiles" AS PERMISSIVE FOR UPDATE TO "evergreen_app" USING ("seller_profiles"."user_id" = 
  nullif(current_setting('app.current_user_id', true), '')::uuid
) WITH CHECK ("seller_profiles"."user_id" = 
  nullif(current_setting('app.current_user_id', true), '')::uuid
);