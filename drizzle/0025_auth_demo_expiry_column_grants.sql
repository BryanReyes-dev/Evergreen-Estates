-- The demo-mode user-create hook reads and updates only the demo expiry marker.
-- Keep this access column-scoped rather than granting broad users-table UPDATE privileges.
GRANT SELECT (demo_expires_at) ON TABLE public.users TO evergreen_auth;
--> statement-breakpoint
GRANT UPDATE (demo_expires_at) ON TABLE public.users TO evergreen_auth;
