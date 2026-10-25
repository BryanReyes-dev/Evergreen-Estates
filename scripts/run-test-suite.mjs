import { spawn } from "node:child_process";

const suites = {
  all: {
    description: "Full suite: unit tests, mocked API tests, and the read-only PostgreSQL permission integration test.",
    paths: ["tests"],
    integration: true,
  },
  fast: {
    description: "Fast, isolated unit and mocked API route tests; no database connection is opened.",
    paths: ["tests/unit", "tests/api"],
  },
  unit: {
    description: "Pure unit tests for fixture integrity and application preference helpers.",
    paths: ["tests/unit"],
  },
  api: {
    description: "Mock-isolated HTTP route tests for authentication, request validation, and authorization guards.",
    paths: ["tests/api"],
  },
  integration: {
    description: "Read-only PostgreSQL integration tests using DRIZZLE_DATABASE_URL from .env.",
    paths: ["tests/integration"],
    integration: true,
  },
  "seed-data": {
    description: "Fixture counts, relationships, timestamps, contact data, and media manifest integrity.",
    paths: ["tests/unit/seed-data.test.ts"],
  },
  "listing-collection": {
    description: "Listing search parsing and listing-creation authorization, validation, and seller eligibility.",
    paths: ["tests/api/listings/listings-collection.test.ts"],
  },
  "listing-item": {
    description: "Listing detail reads and owner-scoped update/delete validation.",
    paths: ["tests/api/listings/listing-item.test.ts"],
  },
  "listing-media": {
    description: "Listing media-order validation, reordering, and stale-write conflict behavior.",
    paths: ["tests/api/listings/media-order.test.ts"],
  },
  reviews: {
    description: "Review create/edit/delete authentication and validation guards.",
    paths: ["tests/api/reviews/review-routes.test.ts"],
  },
  "seller-profiles": {
    description: "Seller enrollment and profile update authentication, contact validation, and unsupported-field guards.",
    paths: ["tests/api/seller-profiles/seller-profiles.test.ts"],
  },
  "saved-listings": {
    description: "Private saved-home access, user-ID protection, listing-ID validation, and boolean save-state validation.",
    paths: ["tests/api/account/saved-listings.test.ts"],
  },
  "account-profile": {
    description: "Account preference authentication, key-shape, sort, and layout validation.",
    paths: ["tests/api/account/profile-preferences.test.ts"],
  },
  "media-upload": {
    description: "Listing media upload URL and completion path validation before database or Storage operations.",
    paths: ["tests/api/media/upload-validation.test.ts"],
  },
  "media-delete": {
    description: "Listing media deletion authentication, ownership, registration, and Storage/database cleanup ordering.",
    paths: ["tests/api/media/delete-media.test.ts"],
  },
  avatar: {
    description: "Avatar authentication, multipart input, and actual image-signature validation.",
    paths: ["tests/api/account/avatar.test.ts"],
  },
  "db-permissions": {
    description: "Read-only checks for the evergreen_runtime PostgreSQL role's allowed and denied privileges.",
    paths: ["tests/integration/database/runtime-permissions.test.ts"],
    integration: true,
  },
};

const selected = process.argv[2] ?? "all";
const suite = suites[selected];
if (!suite) {
  process.stderr.write(
    "Unknown suite: " + selected + "\nAvailable suites: " + Object.keys(suites).join(", ") + "\n",
  );
  process.exit(2);
}

const env = { ...process.env };
if (suite.integration) {
  env.RUN_DB_INTEGRATION_TESTS = "true";
} else {
  delete env.RUN_DB_INTEGRATION_TESTS;
}

process.stdout.write(
  "\n[Evergreen Estates tests] " + suite.description + "\n" +
  "[Evergreen Estates tests] Files: " + suite.paths.join(", ") + "\n\n",
);

const child = spawn("vp", ["test", "run", ...suite.paths], {
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});
child.once("error", (error) => {
  process.stderr.write("Unable to start the Vite+ test runner: " + error.message + "\n");
  process.exitCode = 1;
});
child.once("close", (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
