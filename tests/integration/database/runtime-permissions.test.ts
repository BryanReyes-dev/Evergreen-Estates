import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import dotenv from "dotenv";
import postgres from "postgres";

const RUN_DB_INTEGRATION_TESTS = process.env.RUN_DB_INTEGRATION_TESTS === "true";

// Load credentials only when a developer explicitly opts into this read-only suite.
if (RUN_DB_INTEGRATION_TESTS) {
  dotenv.config({ path: ".env" });
}

const connectionUrl = RUN_DB_INTEGRATION_TESTS
  ? process.env.DRIZZLE_DATABASE_URL
  : undefined;

const sql = connectionUrl
  ? postgres(connectionUrl, {
      prepare: false,
      max: 1,
      connect_timeout: 10,
    })
  : null;

function getDatabase() {
  if (!sql) {
    throw new Error("DRIZZLE_DATABASE_URL is missing from .env");
  }

  return sql;
}

beforeAll(() => {
  if (RUN_DB_INTEGRATION_TESTS) {
    getDatabase();
  }
});

afterAll(async () => {
  if (sql) {
    await sql.end();
  }
});

describe.skipIf(!RUN_DB_INTEGRATION_TESTS)(
  "evergreen_runtime database permissions",
  () => {
  it("has the expected read-only permissions", async () => {
    const db = getDatabase();

    const [permissions] = await db`
      SELECT
        current_user AS connected_as,
        has_table_privilege(
          current_user, 'public.listings', 'SELECT'
        ) AS can_read_listings,
        has_table_privilege(
          current_user, 'public.reviews', 'SELECT'
        ) AS can_read_reviews,
        has_table_privilege(
          current_user, 'public.seller_profiles', 'SELECT'
        ) AS can_read_seller_profiles,
        has_table_privilege(
          current_user, 'public.listings', 'INSERT'
        ) AS can_insert_listings,
        has_table_privilege(
          current_user, 'public.listings', 'UPDATE'
        ) AS can_update_listings,
        has_column_privilege(
          current_user, 'public.users', 'id', 'SELECT'
        ) AS can_read_user_ids,
        has_column_privilege(
          current_user, 'public.users', 'name', 'SELECT'
        ) AS can_read_user_names,
        has_column_privilege(
          current_user, 'public.users', 'email', 'SELECT'
        ) AS can_read_user_emails,
        has_schema_privilege(
          current_user, 'drizzle', 'USAGE'
        ) AS can_access_migrations
    `;

    expect(permissions.connected_as).toBe("evergreen_runtime");

    expect(permissions.can_read_listings).toBe(true);
    expect(permissions.can_read_reviews).toBe(true);
    expect(permissions.can_read_seller_profiles).toBe(true);

    expect(permissions.can_insert_listings).toBe(false);
    expect(permissions.can_update_listings).toBe(false);

    expect(permissions.can_read_user_ids).toBe(true);
    expect(permissions.can_read_user_names).toBe(true);
    expect(permissions.can_read_user_emails).toBe(false);

    expect(permissions.can_access_migrations).toBe(false);
  });

  it("can execute the approved public read queries", async () => {
    const db = getDatabase();

    const [counts] = await db`
      SELECT
        (SELECT count(*) FROM public.listings) AS listings,
        (SELECT count(*) FROM public.reviews) AS reviews,
        (
          SELECT count(*) FROM public.seller_profiles
        ) AS visible_seller_profiles
    `;

    expect(counts).toBeDefined();
    expect(counts.listings).toBeDefined();
    expect(counts.reviews).toBeDefined();
    expect(counts.visible_seller_profiles).toBeDefined();
  });
});
