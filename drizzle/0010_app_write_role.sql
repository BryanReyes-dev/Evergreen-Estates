-- Dedicated application-write login.
-- Configure its password out-of-band; never commit credentials.
--
-- This migration deliberately grants no application-table privileges.

CREATE ROLE evergreen_app
  WITH LOGIN NOINHERIT
       NOSUPERUSER NOCREATEDB NOCREATEROLE
       NOREPLICATION NOBYPASSRLS;
--> statement-breakpoint

GRANT CONNECT ON DATABASE postgres TO evergreen_app;