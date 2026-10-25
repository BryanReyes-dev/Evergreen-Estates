import { spawn } from "node:child_process";

const suites = {
  all: {
    description:
      "Full suite: pure unit tests, mocked HTTP Route Handler tests, and read-only PostgreSQL permission integration tests.",
    paths: ["tests"],
    integration: true,
  },
  fast: {
    description:
      "Fast, isolated unit and mocked API tests. No database connection is opened.",
    paths: ["tests/unit", "tests/api"],
  },
  unit: {
    description:
      "Pure unit tests for authentication safeguards, fixture identity allowlists, account preferences, media constraints, and seed integrity.",
    paths: ["tests/unit"],
  },
  api: {
    description:
      "Mock-isolated HTTP Route Handler tests for input validation, authentication, ownership, and authorization.",
    paths: ["tests/api"],
  },
  integration: {
    description:
      "Read-only PostgreSQL integration tests. Requires DRIZZLE_DATABASE_URL for the evergreen_runtime role.",
    paths: ["tests/integration"],
    integration: true,
  },
  "seed-data": {
    description:
      "Seed fixture counts, relationships, timestamps, contact details, and local media manifest integrity.",
    paths: ["tests/unit/seed-data.test.ts"],
  },
  "account-preferences": {
    description:
      "Pure unit tests for default listing sort/layout normalization and strict preference validation.",
    paths: ["tests/unit/account-preferences.test.ts"],
  },
  "auth-config": {
    description:
      "Authentication configuration, signup error messages, token lifetime, password-reset session revocation, and rate limits.",
    paths: ["tests/unit/auth-configuration.test.ts", "tests/unit/auth-error-messages.test.ts"],
  },
  "fixture-auth": {
    description:
      "Ensures only exact synthetic fixture email/name pairs pass the seed-only identity allowlist.",
    paths: ["tests/unit/fixture-auth-allowlist.test.ts"],
  },
  "media-limits": {
    description:
      "Verifies the documented decimal 50,000,000-byte per-file listing-media limit.",
    paths: ["tests/unit/media-file-limits.test.ts"],
  },
  "media-filenames": {
    description:
      "Verifies safe listing media filenames, supported image/video extensions, path traversal protection, and length limits.",
    paths: ["tests/unit/media-filename-allowlist.test.ts"],
  },
  "listing-collection": {
    description:
      "Public listing-search parsing plus listing-creation authentication, validation, seller eligibility, and owner binding.",
    paths: ["tests/api/listings/listings-collection.test.ts"],
  },
  "listing-item": {
    description:
      "Public listing detail behavior and owner-scoped update/delete validation.",
    paths: ["tests/api/listings/listing-item.test.ts"],
  },
  "listing-media": {
    description:
      "Listing media order validation, safe reordering, and stale-write conflict behavior.",
    paths: ["tests/api/listings/media-order.test.ts"],
  },
  reviews: {
    description:
      "Review collection/item authentication, rating/comment validation, and author-scoped create/edit/delete rules.",
    paths: ["tests/api/reviews/review-routes.test.ts"],
  },
  "seller-profiles": {
    description:
      "Seller profile enrollment and updates, contact details, authentication, and unsupported-field protections.",
    paths: ["tests/api/seller-profiles/seller-profiles.test.ts"],
  },
  "saved-listings": {
    description:
      "Private saved-home reads and writes, user-ID protection, listing UUID checks, and save-state validation.",
    paths: ["tests/api/account/saved-listings.test.ts"],
  },
  "account-profile": {
    description:
      "Account settings API authentication, preference shape, supported sort/layout values, and avatar URL handling.",
    paths: ["tests/api/account/profile-preferences.test.ts"],
  },
  "media-upload": {
    description:
      "Listing media upload URL/completion validation before database or privileged Storage operations.",
    paths: ["tests/api/media/upload-validation.test.ts"],
  },
  "media-delete": {
    description:
      "Listing media deletion authentication, ownership, registration, and Storage/database cleanup ordering.",
    paths: ["tests/api/media/delete-media.test.ts"],
  },
  "media-captions": {
    description:
      "WebVTT caption-file validation, authenticated video-caption uploads, and owner/registration checks.",
    paths: ["tests/unit/media-captions.test.ts", "tests/api/media/caption-upload.test.ts"],
  },
  "media-display": {
    description:
      "GIF source URL detection and optional-caption video-player rendering.",
    paths: ["tests/unit/media-display.test.ts"],
  },
  "demo-retention": {
    description:
      "Demo-mode verification bypass, 24-hour retention, storage-before-database cleanup ordering, concurrency guard, and skip-button copy.",
    paths: ["tests/unit/auth-configuration.test.ts", "tests/unit/demo-account-retention.test.ts"],
  },
  avatar: {
    description:
      "Avatar upload authentication, multipart input handling, and actual image-signature validation.",
    paths: ["tests/api/account/avatar.test.ts"],
  },
  "db-permissions": {
    description:
      "Read-only verification of the evergreen_runtime database role's allowed reads and denied writes/private access.",
    paths: ["tests/integration/database/runtime-permissions.test.ts"],
    integration: true,
  },
};

const selected = process.argv[2] ?? "all";
const suite = suites[selected];

if (!suite) {
  process.stderr.write(
    "Unknown test suite: " +
      selected +
      "\nAvailable suites: " +
      Object.keys(suites).join(", ") +
      "\n",
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
  "\n[Evergreen Estates tests] " +
    suite.description +
    "\n[Evergreen Estates tests] Test paths: " +
    suite.paths.join(", ") +
    "\n[Evergreen Estates tests] Runner: vp test run " +
    suite.paths.join(" ") +
    "\n\n",
);

const child = spawn("vp", ["test", "run", ...suite.paths], {
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.once("error", (error) => {
  process.stderr.write(
    "Unable to start Vite+ (vp test): " + error.message + "\n",
  );
  process.exitCode = 1;
});

child.once("close", (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
