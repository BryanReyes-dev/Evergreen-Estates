
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  schemaFilter: ["public"],
  tablesFilter: [
    "listings",
    "users",
    "reviews",
    "seller_profiles",
  ],

  dbCredentials: {
    url: process.env.DIRECT_URL!,
  },
});
