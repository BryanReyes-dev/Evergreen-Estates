import "dotenv/config";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { and, eq, inArray, sql } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { lstat, readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import { seedListings, seedReviews, seedSellers, validateSeedData } from "@/db/seed/data";
import { isSeedFixtureIdentity } from "@/db/seed/auth-fixtures";
import { account, session, verification } from "@/db/auth-schema";
import { listings, reviews, sellerProfiles, users } from "@/db/schema";
import { MAX_MEDIA_FILE_BYTES } from "@/lib/media/file-limits";

const EXPECTED_PROJECT_REF = "vcsotaclvwvbpqiljkuk";
const STORAGE_BUCKET = "property-images";
const MAX_ACTIVE_LISTINGS_PER_SELLER = 3;

// The applied Drizzle ledger hash for migration 0011
// (d23ee45dadfe79d8ff2346b80fc07872a1c7edebd4b88bc511a83a944ea6baed) does not
// match the tracked SQL bytes (SHA-256
// 5f654419803188a68ae069c3a3d873821cdae57c9a58c9ecd5b7bae44a8f9af4). The
// original byte sequence was not recovered; LF/CRLF and final-newline variants
// did not reproduce the ledger hash. Never edit migration 0011 or its ledger row.
//
// Explicit review disposition (2026-10-23): accept the residual provenance
// discrepancy for this fixture workflow because migration 0021 has been applied
// and live role/grant/membership/policy/RLS checks plus the complete dry-run pass.
// This does NOT resolve or repair the historical checksum. Set this acknowledgement
// to false to block apply mode again.
const HISTORICAL_0011_DISCREPANCY_ACKNOWLEDGED = true;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CONTENT_TYPES: Record<string, string> = {
  avif: "image/avif",
  gif: "image/gif",
  jpg: "image/jpeg",
  mp4: "video/mp4",
  mov: "video/quicktime",
  png: "image/png",
  webm: "video/webm",
  webp: "image/webp",
};

type Mode = "dry-run" | "apply";

type AppClientModule = typeof import("@/db/drizzle/app-client");
type AuthClientModule = typeof import("@/db/drizzle/auth-client");
type StorageAdminModule = typeof import("@/db/supabase/storage-admin");
type AppTransaction = Parameters<AppClientModule["withAppUserTransaction"]>[1] extends
  (transaction: infer T) => Promise<unknown> ? T : never;

let appClientModule: AppClientModule | undefined;
let authClientModule: AuthClientModule | undefined;
let storageAdminModule: StorageAdminModule | undefined;
let appDatabase: ReturnType<AppClientModule["getAppDrizzleDb"]> | undefined;
let authDatabase: ReturnType<AuthClientModule["getAuthDrizzleDb"]> | undefined;

const authSchema = { user: users, session, account, verification };

type CliOptions = {
  mode: Mode;
  confirmedProject?: string;
};

type SellerRecord = typeof seedSellers[number];
type ListingRecord = typeof seedListings[number];
type ReviewRecord = typeof seedReviews[number];

type AuthUserRow = {
  id: string;
  name: string;
  email: string;
};

type CredentialRow = {
  userId: string;
  accountId: string;
  providerId: string;
  hasPassword: boolean;
};

type SellerPlan = {
  seller: SellerRecord;
  user: AuthUserRow | null;
  status: "create" | "reuse";
};

type MediaManifestEntry = {
  listingId: string;
  filename: string;
  path: string;
  localPath: string;
  size: number;
  contentType: string;
};

type ExistingListingRow = {
  id: string;
  media: string[];
  tags: string[];
  title: string;
  price: string;
  beds: number;
  baths: number;
  sqft: number;
  address: string;
  description: string;
  createdAt: string;
  sellerUserId: string | null;
  updatedAt: string;
};

type ExistingReviewRow = {
  id: string;
  listingId: string;
  userId: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

type StoragePlan = {
  entries: MediaManifestEntry[];
  identical: MediaManifestEntry[];
  missing: MediaManifestEntry[];
  extraObjects: number;
  conflicts: string[];
};

class PopulationError extends Error {}

async function loadServerHelpers(): Promise<void> {
  // The existing server-side clients intentionally import Next's
  // `server-only` marker. A standalone Node script has no Next bundler to alias
  // it, so map only that marker to Next's empty server-side stub before loading
  // the existing helpers. This does not replace or bypass their code.
  const nodeRequire = createRequire(path.join(process.cwd(), "scripts", "populate.ts"));
  type ModuleResolver = {
    _resolveFilename: (
      request: string,
      parent: unknown,
      isMain?: boolean,
      options?: unknown,
    ) => string;
  };
  const moduleApi = nodeRequire("node:module") as ModuleResolver;
  const resolveFilename = moduleApi._resolveFilename;
  moduleApi._resolveFilename = function (request, parent, isMain, options) {
    if (request === "server-only") {
      return nodeRequire.resolve("next/dist/compiled/server-only/empty");
    }
    return resolveFilename.call(moduleApi, request, parent, isMain, options);
  };

  const [appClient, authClient, storageAdmin] = await Promise.all([
    import("@/db/drizzle/app-client"),
    import("@/db/drizzle/auth-client"),
    import("@/db/supabase/storage-admin"),
  ]);
  appClientModule = appClient;
  authClientModule = authClient;
  storageAdminModule = storageAdmin;
}

function requireDbHelpers(): void {
  if (!appClientModule || !authClientModule || !storageAdminModule) {
    throw new PopulationError("The existing server-side database and Storage helpers were not initialized.");
  }
}

function getAppDb(): ReturnType<AppClientModule["getAppDrizzleDb"]> {
  requireDbHelpers();
  if (!appClientModule) throw new PopulationError("The app database helper is unavailable.");
  appDatabase ??= appClientModule.getAppDrizzleDb();
  return appDatabase;
}

function getAuthDb(): ReturnType<AuthClientModule["getAuthDrizzleDb"]> {
  requireDbHelpers();
  if (!authClientModule) throw new PopulationError("The auth database helper is unavailable.");
  authDatabase ??= authClientModule.getAuthDrizzleDb();
  return authDatabase;
}

function withOwnerTransaction<T>(
  userId: string,
  operation: (transaction: AppTransaction) => Promise<T>,
): Promise<T> {
  requireDbHelpers();
  if (!appClientModule) throw new PopulationError("The app transaction helper is unavailable.");
  return appClientModule.withAppUserTransaction(userId, operation);
}

function isFixtureMediaFilenameAllowed(filename: string): boolean {
  requireDbHelpers();
  if (!storageAdminModule) throw new PopulationError("The Storage filename helper is unavailable.");
  return storageAdminModule.isAllowedListingMediaFilename(filename);
}

function parseArgs(args: string[]): CliOptions {
  let applySeen = false;
  let dryRunSeen = false;
  let confirmedProject: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--apply") {
      applySeen = true;
      continue;
    }

    if (arg === "--dry-run") {
      dryRunSeen = true;
      continue;
    }

    if (arg === "--confirm-project") {
      confirmedProject = args[index + 1];
      if (!confirmedProject || confirmedProject.startsWith("--")) {
        throw new PopulationError("--confirm-project requires a project reference.");
      }
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Evergreen Estates population script",
          "",
          "Default: read-only dry-run",
          `Write mode: --apply --confirm-project ${EXPECTED_PROJECT_REF}`,
          "Seller passwords for new accounts come from the ignored seed/credentials file using POPULATE_PASSWORD_<SELLER_KEY>=<password> entries.",
        ].join("\n"),
      );
      process.exit(0);
    }

    throw new PopulationError(`Unknown option: ${arg}`);
  }

  if (applySeen && dryRunSeen) {
    throw new PopulationError("Use either --apply or --dry-run, not both.");
  }

  const mode: Mode = applySeen ? "apply" : "dry-run";
  if (mode === "apply" && confirmedProject !== EXPECTED_PROJECT_REF) {
    throw new PopulationError(
      `Write mode requires --confirm-project ${EXPECTED_PROJECT_REF}.`,
    );
  }

  if (mode === "dry-run" && confirmedProject && confirmedProject !== EXPECTED_PROJECT_REF) {
    throw new PopulationError("The confirmed project reference does not match the expected target.");
  }

  return { mode, confirmedProject };
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new PopulationError(`Missing required environment setting: ${name}.`);
  }
  return value;
}

function projectRefFromDatabaseUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    const directHost = parsed.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
    if (directHost) return directHost[1].toLowerCase();

    const poolerHost = parsed.hostname.endsWith(".pooler.supabase.com");
    const username = decodeURIComponent(parsed.username);
    const usernameRef = username.match(/\.([a-z0-9]{20,})$/i);
    if (poolerHost && usernameRef) return usernameRef[1].toLowerCase();

    // Some Supabase pooler formats include the project reference in the host.
    const hostRef = parsed.hostname.match(/^([a-z0-9]{20,})\.pooler\.supabase\.com$/i);
    if (hostRef) return hostRef[1].toLowerCase();

    return null;
  } catch {
    return null;
  }
}

function validateProjectConfiguration(): void {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  let supabaseRef: string | null = null;
  try {
    const hostname = new URL(supabaseUrl).hostname;
    const match = hostname.match(/^([a-z0-9]+)\.supabase\.co$/i);
    supabaseRef = match?.[1]?.toLowerCase() ?? null;
  } catch {
    throw new PopulationError("NEXT_PUBLIC_SUPABASE_URL is not a valid Supabase URL.");
  }

  if (supabaseRef !== EXPECTED_PROJECT_REF) {
    throw new PopulationError("NEXT_PUBLIC_SUPABASE_URL does not target the expected Supabase project.");
  }

  const requiredConnections = ["APP_DATABASE_URL", "AUTH_DATABASE_URL"];
  const optionalConnections = ["DIRECT_URL", "DRIZZLE_DATABASE_URL"];

  for (const name of requiredConnections) {
    const value = getRequiredEnv(name);
    if (projectRefFromDatabaseUrl(value) !== EXPECTED_PROJECT_REF) {
      throw new PopulationError(`${name} cannot be verified as targeting the expected Supabase project.`);
    }
  }

  for (const name of optionalConnections) {
    const value = process.env[name]?.trim();
    if (value && projectRefFromDatabaseUrl(value) !== EXPECTED_PROJECT_REF) {
      throw new PopulationError(`${name} cannot be verified as targeting the expected Supabase project.`);
    }
  }

  getRequiredEnv("SUPABASE_SECRET_KEY");
  console.log(`PASS: configured Supabase and database connection targets match ${EXPECTED_PROJECT_REF}.`);
}

function validateAuthProvisioningConfig(sellers: SellerPlan[], mode: Mode): void {
  if (mode !== "apply" || !sellers.some(({ status }) => status === "create")) return;

  if (getRequiredEnv("BETTER_AUTH_SECRET").length < 32) {
    throw new PopulationError("BETTER_AUTH_SECRET must meet Better Auth's minimum 32-character secret length.");
  }

  try {
    const url = new URL(getRequiredEnv("BETTER_AUTH_URL"));
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("unsupported protocol");
  } catch {
    throw new PopulationError("BETTER_AUTH_URL must be a valid HTTP or HTTPS URL when provisioning accounts.");
  }
}

function getPasswordKey(seller: SellerRecord): string {
  return `POPULATE_PASSWORD_${seller.key.toUpperCase()}`;
}

async function readSellerCredentials(sellers: SellerPlan[]): Promise<Map<string, string>> {
  const requiredPlans = sellers.filter((plan) => plan.status === "create");
  const passwords = new Map<string, string>();
  if (requiredPlans.length === 0) return passwords;

  const credentialsPath = path.resolve(process.cwd(), "seed", "credentials");
  let contents: string;
  try {
    contents = await readFile(credentialsPath, "utf8");
  } catch {
    throw new PopulationError("Missing seed/credentials. Add the required POPULATE_PASSWORD_<SELLER_KEY> entries without committing the file.");
  }

  const expectedKeys = new Set(seedSellers.map(getPasswordKey));
  const parsed = new Map<string, string>();
  for (const [index, line] of contents.split(/\r?\n/).entries()) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) {
      throw new PopulationError(`Invalid seed/credentials format on line ${index + 1}; expected KEY=VALUE.`);
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1);
    if (!expectedKeys.has(key)) {
      throw new PopulationError(`Unknown credential key on line ${index + 1}: ${key}.`);
    }
    if (parsed.has(key)) {
      throw new PopulationError(`Duplicate credential key in seed/credentials: ${key}.`);
    }
    parsed.set(key, value);
  }

  for (const plan of requiredPlans) {
    const key = getPasswordKey(plan.seller);
    const password = parsed.get(key);
    if (!password) {
      throw new PopulationError(`Missing required ${key} value in seed/credentials for seller ${plan.seller.key}.`);
    }
    if (password.length < 8 || password.length > 128) {
      throw new PopulationError(`${key} in seed/credentials must be 8–128 characters for seller ${plan.seller.key}.`);
    }
    passwords.set(plan.seller.key, password);
  }

  console.log(`Seller credentials: ${passwords.size} required values validated from seed/credentials; values hidden.`);
  return passwords;
}

function validateStaticFixtures(): void {
  validateSeedData();

  const listingIds = new Set(seedListings.map(({ id }) => id));
  if (listingIds.size !== seedListings.length || seedListings.some(({ id }) => !UUID_PATTERN.test(id))) {
    throw new PopulationError("Fixture listing IDs must be unique UUIDs.");
  }

  const sellerKeys = new Set(seedSellers.map(({ key }) => key));
  if (sellerKeys.size !== seedSellers.length) {
    throw new PopulationError("Fixture seller keys must be unique.");
  }

  const perSeller = new Map<string, number>();
  for (const listing of seedListings) {
    if (!sellerKeys.has(listing.sellerKey)) {
      throw new PopulationError(`Listing ${listing.id} references an unknown seller key.`);
    }
    perSeller.set(listing.sellerKey, (perSeller.get(listing.sellerKey) ?? 0) + 1);
    if (listing.media.some((filename) => !isFixtureMediaFilenameAllowed(filename))) {
      throw new PopulationError(`Listing ${listing.id} contains an invalid fixture media filename.`);
    }
  }

  for (const seller of seedSellers) {
    if (perSeller.get(seller.key) !== MAX_ACTIVE_LISTINGS_PER_SELLER) {
      throw new PopulationError(`Seller ${seller.key} must have exactly three fixture listings.`);
    }
  }

  const reviewIds = new Set(seedReviews.map(({ id }) => id));
  if (reviewIds.size !== seedReviews.length || seedReviews.some(({ id }) => !UUID_PATTERN.test(id))) {
    throw new PopulationError("Fixture review IDs must be unique UUIDs.");
  }
}

async function buildMediaManifest(): Promise<MediaManifestEntry[]> {
  const entries: MediaManifestEntry[] = [];
  const repositoryRoot = path.resolve(process.cwd());
  const mediaRoot = path.resolve(repositoryRoot, "seed", "images", "listings");
  const repositoryRootReal = await realpath(repositoryRoot);
  const mediaRootReal = await realpath(mediaRoot).catch(() => {
    throw new PopulationError("The local fixture media directory is missing.");
  });

  if (!isPathInside(repositoryRootReal, mediaRootReal)) {
    throw new PopulationError("The local fixture media directory resolves outside the repository.");
  }

  for (const listing of seedListings) {
    const listingDirectory = path.resolve(mediaRoot, listing.id);
    if (!isPathInside(mediaRoot, listingDirectory)) {
      throw new PopulationError(`Unsafe local fixture directory for listing ${listing.id}.`);
    }
    const listingDirectoryReal = await realpath(listingDirectory).catch(() => {
      throw new PopulationError(`Missing local media directory for listing ${listing.id}.`);
    });
    if (!isPathInside(mediaRootReal, listingDirectoryReal)) {
      throw new PopulationError(`Local media directory for listing ${listing.id} resolves outside the fixture tree.`);
    }

    for (const filename of listing.media) {
      if (!isFixtureMediaFilenameAllowed(filename)) {
        throw new PopulationError(`Invalid fixture filename for listing ${listing.id}.`);
      }

      const localPath = path.resolve(listingDirectory, filename);
      if (!isPathInside(listingDirectory, localPath)) {
        throw new PopulationError(`Unsafe local fixture path for listing ${listing.id}.`);
      }

      const localPathReal = await realpath(localPath).catch(() => {
        throw new PopulationError(`Missing local media asset: ${listing.id}/${filename}.`);
      });
      if (!isPathInside(listingDirectoryReal, localPathReal)) {
        throw new PopulationError(`Local media asset ${listing.id}/${filename} resolves outside its listing folder.`);
      }
      const fileStat = await lstat(localPath).catch(() => {
        throw new PopulationError(`Missing local media asset: ${listing.id}/${filename}.`);
      });

      if (fileStat.isSymbolicLink() || !fileStat.isFile() || fileStat.size <= 0 || fileStat.size > MAX_MEDIA_FILE_BYTES) {
        throw new PopulationError(
          `Media asset ${listing.id}/${filename} must be a non-empty file no larger than ${MAX_MEDIA_FILE_BYTES} bytes.`,
        );
      }

      const extension = path.extname(filename).slice(1).toLowerCase();
      const contentType = CONTENT_TYPES[extension];
      if (!contentType) {
        throw new PopulationError(`Unsupported fixture media type for ${filename}.`);
      }

      entries.push({
        listingId: listing.id,
        filename,
        path: `listings/${listing.id}/${filename}`,
        localPath,
        size: fileStat.size,
        contentType,
      });
    }
  }

  if (entries.length !== 48 || new Set(entries.map(({ path: objectPath }) => objectPath)).size !== 48) {
    throw new PopulationError(`Expected 48 unique fixture media paths; found ${entries.length}.`);
  }

  return entries;
}

function isPathInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative !== "" && relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function createStorageClient() {
  return createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SECRET_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

async function verifyStorageBucket(storage: ReturnType<typeof createStorageClient>): Promise<void> {
  const { data, error } = await storage.storage.getBucket(STORAGE_BUCKET);
  if (error || !data) {
    throw new PopulationError("Could not verify the property-images Storage bucket.");
  }
  if (data.id !== STORAGE_BUCKET || data.name !== STORAGE_BUCKET) {
    throw new PopulationError("The configured Storage bucket does not match property-images.");
  }
  if (data.public !== false) {
    throw new PopulationError("Refusing to use property-images because the bucket is public.");
  }

  const fileSizeLimit = Number(data.file_size_limit);
  if (!Number.isFinite(fileSizeLimit) || fileSizeLimit < MAX_MEDIA_FILE_BYTES) {
    throw new PopulationError("The private property-images bucket limit is missing or below the shared media size limit.");
  }

  const requiredMimeTypes = [...new Set(Object.values(CONTENT_TYPES))].sort();
  const configuredMimeTypes = [...(data.allowed_mime_types ?? [])].sort();
  if (
    configuredMimeTypes.length !== requiredMimeTypes.length ||
    requiredMimeTypes.some((contentType, index) => configuredMimeTypes[index] !== contentType)
  ) {
    throw new PopulationError("The property-images bucket MIME allowlist does not match the supported fixture media types.");
  }

  console.log("PASS: property-images is private and its size/MIME limits cover the fixture media.");
}

async function verifyDbRoles(): Promise<void> {
  requireDbHelpers();
  const appDb = getAppDb();
  const authDb = getAuthDb();

  type RoleRow = {
    role_name: string;
    is_superuser: boolean;
    bypasses_rls: boolean;
    seller_profile_insert: boolean;
    listing_insert: boolean;
    review_insert: boolean;
    seller_profile_owner_policy: boolean;
    listing_owner_policy: boolean;
    review_owner_policy: boolean;
    seller_profile_rls: boolean;
    listing_rls: boolean;
    review_rls: boolean;
    listing_cap_trigger: boolean;
  };

  try {
    const appRows = await appDb.execute(sql`
      select
        current_user::text as role_name,
        role.rolsuper as is_superuser,
        role.rolbypassrls as bypasses_rls,
        has_column_privilege(current_user, 'public.seller_profiles', 'user_id', 'INSERT')
          and has_column_privilege(current_user, 'public.seller_profiles', 'display_name', 'INSERT')
          and has_column_privilege(current_user, 'public.seller_profiles', 'bio', 'INSERT')
          and has_column_privilege(current_user, 'public.seller_profiles', 'avatar_url', 'INSERT')
          and has_column_privilege(current_user, 'public.seller_profiles', 'contact_email', 'INSERT')
          and has_column_privilege(current_user, 'public.seller_profiles', 'contact_phone', 'INSERT')
          and has_column_privilege(current_user, 'public.seller_profiles', 'preferred_contact_method', 'INSERT')
          and has_column_privilege(current_user, 'public.seller_profiles', 'is_published', 'INSERT')
          as seller_profile_insert,
        has_column_privilege(current_user, 'public.listings', 'id', 'INSERT')
          and has_column_privilege(current_user, 'public.listings', 'media', 'INSERT')
          and has_column_privilege(current_user, 'public.listings', 'tags', 'INSERT')
          and has_column_privilege(current_user, 'public.listings', 'title', 'INSERT')
          and has_column_privilege(current_user, 'public.listings', 'price', 'INSERT')
          and has_column_privilege(current_user, 'public.listings', 'beds', 'INSERT')
          and has_column_privilege(current_user, 'public.listings', 'baths', 'INSERT')
          and has_column_privilege(current_user, 'public.listings', 'sqft', 'INSERT')
          and has_column_privilege(current_user, 'public.listings', 'address', 'INSERT')
          and has_column_privilege(current_user, 'public.listings', 'description', 'INSERT')
          and has_column_privilege(current_user, 'public.listings', 'created_at', 'INSERT')
          and has_column_privilege(current_user, 'public.listings', 'seller_user_id', 'INSERT')
          and has_column_privilege(current_user, 'public.listings', 'updated_at', 'INSERT')
          as listing_insert,
        has_column_privilege(current_user, 'public.reviews', 'id', 'INSERT')
          and has_column_privilege(current_user, 'public.reviews', 'listing_id', 'INSERT')
          and has_column_privilege(current_user, 'public.reviews', 'user_id', 'INSERT')
          and has_column_privilege(current_user, 'public.reviews', 'rating', 'INSERT')
          and has_column_privilege(current_user, 'public.reviews', 'comment', 'INSERT')
          and has_column_privilege(current_user, 'public.reviews', 'created_at', 'INSERT')
          and has_column_privilege(current_user, 'public.reviews', 'updated_at', 'INSERT')
          as review_insert,
        exists (
          select 1 from pg_policies
          where schemaname = 'public'
            and tablename = 'seller_profiles'
            and policyname = 'App can create own seller profile'
            and cmd = 'INSERT'
            and 'evergreen_app'::name = any(roles)
            and position('app.current_user_id' in coalesce(with_check, '')) > 0
        ) as seller_profile_owner_policy,
        exists (
          select 1 from pg_policies
          where schemaname = 'public'
            and tablename = 'listings'
            and policyname = 'App can create own listings'
            and cmd = 'INSERT'
            and 'evergreen_app'::name = any(roles)
            and position('app.current_user_id' in coalesce(with_check, '')) > 0
        ) as listing_owner_policy,
        exists (
          select 1 from pg_policies
          where schemaname = 'public'
            and tablename = 'reviews'
            and policyname = 'Users can create their own reviews'
            and cmd = 'INSERT'
            and 'evergreen_app'::name = any(roles)
            and position('app.current_user_id' in coalesce(with_check, '')) > 0
        ) as review_owner_policy,
        (select relrowsecurity from pg_class where oid = 'public.seller_profiles'::regclass) as seller_profile_rls,
        (select relrowsecurity from pg_class where oid = 'public.listings'::regclass) as listing_rls,
        (select relrowsecurity from pg_class where oid = 'public.reviews'::regclass) as review_rls,
        exists (
          select 1 from pg_trigger
          where tgrelid = 'public.listings'::regclass
            and tgname = 'listings_enforce_max_three_per_seller'
            and tgenabled <> 'D'
        ) as listing_cap_trigger
      from pg_roles as role
      where role.rolname = current_user
    `) as unknown as RoleRow[];

    const app = appRows[0];
    if (
      !app || app.role_name !== "evergreen_app" || app.is_superuser || app.bypasses_rls ||
      !app.seller_profile_insert || !app.listing_insert || !app.review_insert ||
      !app.seller_profile_owner_policy || !app.listing_owner_policy || !app.review_owner_policy ||
      !app.seller_profile_rls || !app.listing_rls || !app.review_rls ||
      !app.listing_cap_trigger
    ) {
      const status = app
        ? `role=${app.role_name}, superuser=${app.is_superuser}, bypassrls=${app.bypasses_rls}, inserts=${app.seller_profile_insert}/${app.listing_insert}/${app.review_insert}, owner-policies=${app.seller_profile_owner_policy}/${app.listing_owner_policy}/${app.review_owner_policy}, rls=${app.seller_profile_rls}/${app.listing_rls}/${app.review_rls}, listing-cap-trigger=${app.listing_cap_trigger}`
        : "no role row returned";
      throw new PopulationError(`APP_DATABASE_URL is not the expected restricted evergreen_app writer or lacks required column inserts (${status}).`);
    }

    const authRows = await authDb.execute(sql`
      select
        current_user::text as role_name,
        role.rolsuper as is_superuser,
        role.rolbypassrls as bypasses_rls,
        has_column_privilege(current_user, 'public.users', 'id', 'INSERT')
          and has_column_privilege(current_user, 'public.users', 'name', 'INSERT')
          and has_column_privilege(current_user, 'public.users', 'email', 'INSERT')
          and has_column_privilege(current_user, 'public.users', 'email_verified', 'INSERT')
          and has_column_privilege(current_user, 'public.users', 'image', 'INSERT')
          and has_column_privilege(current_user, 'public.users', 'created_at', 'INSERT')
          and has_column_privilege(current_user, 'public.users', 'updated_at', 'INSERT')
          as user_insert,
        has_column_privilege(current_user, 'public.account', 'account_id', 'INSERT')
          and has_column_privilege(current_user, 'public.account', 'provider_id', 'INSERT')
          and has_column_privilege(current_user, 'public.account', 'user_id', 'INSERT')
          and has_column_privilege(current_user, 'public.account', 'password', 'INSERT')
          and has_column_privilege(current_user, 'public.account', 'created_at', 'INSERT')
          and has_column_privilege(current_user, 'public.account', 'updated_at', 'INSERT')
          as credential_insert,
        exists (
          select 1 from pg_policies
          where schemaname = 'public'
            and tablename = 'users'
            and policyname = 'Evergreen auth can manage users'
            and cmd = 'ALL'
            and 'evergreen_auth'::name = any(roles)
        ) as user_policy,
        exists (
          select 1 from pg_policies
          where schemaname = 'public'
            and tablename = 'account'
            and policyname = 'Evergreen auth can manage accounts'
            and cmd = 'ALL'
            and 'evergreen_auth'::name = any(roles)
        ) as credential_policy,
        (select relrowsecurity from pg_class where oid = 'public.users'::regclass) as user_rls,
        (select relrowsecurity from pg_class where oid = 'public.account'::regclass) as credential_rls
      from pg_roles as role
      where role.rolname = current_user
    `) as unknown as Array<{
      role_name: string;
      is_superuser: boolean;
      bypasses_rls: boolean;
      user_insert: boolean;
      credential_insert: boolean;
      user_policy: boolean;
      credential_policy: boolean;
      user_rls: boolean;
      credential_rls: boolean;
    }>;

    const auth = authRows[0];
    if (
      !auth || auth.role_name !== "evergreen_auth" || auth.is_superuser || auth.bypasses_rls ||
      !auth.user_insert || !auth.credential_insert ||
      !auth.user_policy || !auth.credential_policy || !auth.user_rls || !auth.credential_rls
    ) {
      throw new PopulationError("AUTH_DATABASE_URL is not the expected restricted evergreen_auth role with required Better Auth insert permissions.");
    }
  } catch (error) {
    if (error instanceof PopulationError) throw error;
    throw new PopulationError("Could not verify the configured application and Better Auth database roles.");
  }
}

async function verifyLiveSchemaContract(): Promise<void> {
  requireDbHelpers();
  const appDb = getAppDb();
  const authDb = getAuthDb();

  type RoleRow = {
    role_name: string;
    can_login: boolean;
    inherits: boolean;
    is_superuser: boolean;
    bypasses_rls: boolean;
    can_create_db: boolean;
    can_create_role: boolean;
    can_replicate: boolean;
  };
  type MembershipRow = {
    granted_role: string;
    member_role: string;
    inherit_option: boolean;
    set_option: boolean;
    admin_option: boolean;
  };
  type GrantRow = {
    grantee: string;
    table_name: string;
    column_name: string | null;
    privilege_type: string;
    scope: string;
  };
  type PolicyRow = {
    table_name: string;
    policy_name: string;
    command: string;
    roles: string[];
    qual: string | null;
    with_check: string | null;
    permissive: string;
  };
  type RlsRow = { table_name: string; enabled: boolean };
  type TriggerRow = {
    trigger_name: string;
    enabled: string;
    definition: string;
    function_definition: string;
    function_volatility: string;
    security_definer: boolean;
    function_config: string[] | null;
  };
  type PrivilegeRow = {
    app_role: string;
    app_select: boolean;
    app_seller_profile_insert: boolean;
    app_listing_insert: boolean;
    app_review_insert: boolean;
    app_seller_profile_update: boolean;
    app_listing_update: boolean;
    app_review_update: boolean;
    app_seller_profile_delete: boolean;
    app_listing_delete: boolean;
    app_review_delete: boolean;
    app_ownership_columns_immutable: boolean;
    app_saved_listings_select_update: boolean;
    app_user_column_privileges_scoped: boolean;
    app_users_table_write_denied: boolean;
    runtime_inherited_select: boolean;
    runtime_users_email_denied: boolean;
    runtime_saved_listings_select_denied: boolean;
    auth_users_crud: boolean;
    auth_users_delete_denied: boolean;
    auth_saved_listings_access_denied: boolean;
    auth_users_table_privileges_denied: boolean;
    auth_account_crud: boolean;
    auth_session_crud: boolean;
    auth_verification_crud: boolean;
  };
  type AuthConnectionRow = {
    role_name: string;
    can_login: boolean;
    inherits: boolean;
    is_superuser: boolean;
    bypasses_rls: boolean;
  };

  const requiredRoles = ["evergreen_read", "evergreen_runtime", "evergreen_app", "evergreen_auth"];
  const authTables = new Set(["users", "account", "session", "verification"]);
  const allRlsTables = new Set(["listings", "reviews", "seller_profiles", "users", "account", "session", "verification"]);
  const normalizeExpression = (value: string | null): string =>
    (value ?? "").toLowerCase().replace(/[\s()"]+/g, "");

  // Migration 0019 is required by the saved-home UI.
  try {
    const savedSchemaRows = await appDb.execute(sql`
      select
        exists (
          select 1 from pg_attribute
          where attrelid = 'public.users'::regclass
            and attname = 'saved_listings'
            and atttypid = 'uuid[]'::regtype
            and attnotnull
            and not attisdropped
        ) as column_ready,
        exists (
          select 1 from pg_constraint
          where conrelid = 'public.users'::regclass
            and conname = 'users_saved_listings_max_100'
            and contype = 'c'
            and convalidated
            and position('cardinality(saved_listings) <= 100' in pg_get_constraintdef(oid)) > 0
        ) as cap_check_ready
    `) as unknown as Array<{ column_ready: boolean; cap_check_ready: boolean }>;
    if (savedSchemaRows[0]?.column_ready !== true || savedSchemaRows[0]?.cap_check_ready !== true) {
      throw new PopulationError(
        "The saved_listings column or its 100-item CHECK constraint is missing. Review and apply migration 0019 in the intended database before population.",
      );
    }
  } catch (error) {
    if (error instanceof PopulationError) throw error;
    throw new PopulationError("Could not inspect saved-list schema; verify migration 0019 and database access.");
  }

  let roles: RoleRow[];
  let memberships: MembershipRow[];
  let grants: GrantRow[];
  let policies: PolicyRow[];
  let rls: RlsRow[];
  let triggers: TriggerRow[];
  let privileges: PrivilegeRow[];
  let authConnections: AuthConnectionRow[] = [];
  let catalogStage = "role attributes";

  try {
    catalogStage = "role attributes";
    roles = await appDb.execute(sql`
      select rolname::text as role_name, rolcanlogin as can_login,
             rolinherit as inherits, rolsuper as is_superuser,
             rolbypassrls as bypasses_rls, rolcreatedb as can_create_db,
             rolcreaterole as can_create_role, rolreplication as can_replicate
      from pg_roles
      where rolname in ('evergreen_read', 'evergreen_runtime', 'evergreen_app', 'evergreen_auth')
    `) as unknown as RoleRow[];

    catalogStage = "role memberships";
    memberships = await appDb.execute(sql`
      select granted.rolname::text as granted_role, member.rolname::text as member_role,
             membership.inherit_option, membership.set_option, membership.admin_option
      from pg_auth_members as membership
      join pg_roles as granted on granted.oid = membership.roleid
      join pg_roles as member on member.oid = membership.member
      where granted.rolname in ('evergreen_read', 'evergreen_runtime', 'evergreen_app', 'evergreen_auth')
         or member.rolname in ('evergreen_read', 'evergreen_runtime', 'evergreen_app', 'evergreen_auth')
    `) as unknown as MembershipRow[];

    catalogStage = "shared-read and runtime grants";
    grants = await appDb.execute(sql`
      select grantee::text as grantee, table_name::text as table_name,
             null::text as column_name, privilege_type::text as privilege_type,
             'TABLE'::text as scope
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name in ('listings', 'reviews', 'seller_profiles', 'users')
        and grantee in ('evergreen_read', 'evergreen_runtime')
      union all
      select grantee.rolname::text as grantee, relation.relname::text as table_name,
             attribute.attname::text as column_name, acl.privilege_type::text as privilege_type,
             'COLUMN'::text as scope
      from pg_attribute as attribute
      join pg_class as relation on relation.oid = attribute.attrelid
      join pg_namespace as namespace on namespace.oid = relation.relnamespace
      cross join lateral aclexplode(attribute.attacl) as acl
      join pg_roles as grantee on grantee.oid = acl.grantee
      where namespace.nspname = 'public'
        and relation.relname in ('listings', 'reviews', 'seller_profiles', 'users')
        and attribute.attnum > 0
        and not attribute.attisdropped
        and attribute.attacl is not null
        and grantee.rolname in ('evergreen_read', 'evergreen_runtime')
    `) as unknown as GrantRow[];

    catalogStage = "RLS policy definitions";
    policies = await appDb.execute(sql`
      select tablename::text as table_name, policyname::text as policy_name,
             cmd::text as command, roles::text[] as roles, qual, with_check,
             permissive::text as permissive
      from pg_policies
      where schemaname = 'public'
        and tablename in ('listings', 'reviews', 'seller_profiles', 'users', 'account', 'session', 'verification')
    `) as unknown as PolicyRow[];

    catalogStage = "RLS table settings";
    rls = await appDb.execute(sql`
      select relation.relname::text as table_name, relation.relrowsecurity as enabled
      from pg_class as relation
      join pg_namespace as namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname in ('listings', 'reviews', 'seller_profiles', 'users', 'account', 'session', 'verification')
    `) as unknown as RlsRow[];

    catalogStage = "listing-cap trigger";
    triggers = await appDb.execute(sql`
      select trigger.tgname::text as trigger_name, trigger.tgenabled::text as enabled,
             pg_get_triggerdef(trigger.oid) as definition,
             pg_get_functiondef(function.oid) as function_definition,
             function.provolatile::text as function_volatility,
             function.prosecdef as security_definer,
             function.proconfig as function_config
      from pg_trigger as trigger
      join pg_class as relation on relation.oid = trigger.tgrelid
      join pg_namespace as namespace on namespace.oid = relation.relnamespace
      join pg_proc as function on function.oid = trigger.tgfoid
      where namespace.nspname = 'public'
        and relation.relname = 'listings'
        and not trigger.tgisinternal
    `) as unknown as TriggerRow[];

    catalogStage = "application and auth privileges";
    privileges = await appDb.execute(sql`
      select
        current_user::text as app_role,
        has_table_privilege('evergreen_app', 'public.listings', 'SELECT')
          and has_table_privilege('evergreen_app', 'public.reviews', 'SELECT')
          and has_table_privilege('evergreen_app', 'public.seller_profiles', 'SELECT')
          and has_column_privilege('evergreen_app', 'public.users', 'id', 'SELECT')
          and has_column_privilege('evergreen_app', 'public.users', 'name', 'SELECT') as app_select,
        has_column_privilege('evergreen_app', 'public.seller_profiles', 'user_id', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.seller_profiles', 'display_name', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.seller_profiles', 'bio', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.seller_profiles', 'avatar_url', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.seller_profiles', 'contact_email', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.seller_profiles', 'contact_phone', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.seller_profiles', 'preferred_contact_method', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.seller_profiles', 'is_published', 'INSERT') as app_seller_profile_insert,
        has_column_privilege('evergreen_app', 'public.listings', 'id', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.listings', 'media', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.listings', 'tags', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.listings', 'title', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.listings', 'price', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.listings', 'beds', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.listings', 'baths', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.listings', 'sqft', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.listings', 'address', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.listings', 'description', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.listings', 'created_at', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.listings', 'seller_user_id', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.listings', 'updated_at', 'INSERT') as app_listing_insert,
        has_column_privilege('evergreen_app', 'public.reviews', 'id', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.reviews', 'listing_id', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.reviews', 'user_id', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.reviews', 'rating', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.reviews', 'comment', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.reviews', 'created_at', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.reviews', 'updated_at', 'INSERT') as app_review_insert,
        has_column_privilege('evergreen_app', 'public.seller_profiles', 'display_name', 'UPDATE')
          and has_column_privilege('evergreen_app', 'public.seller_profiles', 'bio', 'UPDATE')
          and has_column_privilege('evergreen_app', 'public.seller_profiles', 'avatar_url', 'UPDATE')
          and has_column_privilege('evergreen_app', 'public.seller_profiles', 'contact_email', 'UPDATE')
          and has_column_privilege('evergreen_app', 'public.seller_profiles', 'contact_phone', 'UPDATE')
          and has_column_privilege('evergreen_app', 'public.seller_profiles', 'preferred_contact_method', 'UPDATE')
          and has_column_privilege('evergreen_app', 'public.seller_profiles', 'is_published', 'UPDATE')
          and has_column_privilege('evergreen_app', 'public.seller_profiles', 'updated_at', 'UPDATE') as app_seller_profile_update,
        has_column_privilege('evergreen_app', 'public.listings', 'media', 'UPDATE')
          and has_column_privilege('evergreen_app', 'public.listings', 'tags', 'UPDATE')
          and has_column_privilege('evergreen_app', 'public.listings', 'title', 'UPDATE')
          and has_column_privilege('evergreen_app', 'public.listings', 'price', 'UPDATE')
          and has_column_privilege('evergreen_app', 'public.listings', 'beds', 'UPDATE')
          and has_column_privilege('evergreen_app', 'public.listings', 'baths', 'UPDATE')
          and has_column_privilege('evergreen_app', 'public.listings', 'sqft', 'UPDATE')
          and has_column_privilege('evergreen_app', 'public.listings', 'address', 'UPDATE')
          and has_column_privilege('evergreen_app', 'public.listings', 'description', 'UPDATE')
          and has_column_privilege('evergreen_app', 'public.listings', 'updated_at', 'UPDATE') as app_listing_update,
        has_column_privilege('evergreen_app', 'public.reviews', 'rating', 'UPDATE')
          and has_column_privilege('evergreen_app', 'public.reviews', 'comment', 'UPDATE')
          and has_column_privilege('evergreen_app', 'public.reviews', 'updated_at', 'UPDATE') as app_review_update,
        has_table_privilege('evergreen_app', 'public.seller_profiles', 'DELETE') as app_seller_profile_delete,
        has_table_privilege('evergreen_app', 'public.listings', 'DELETE') as app_listing_delete,
        has_table_privilege('evergreen_app', 'public.reviews', 'DELETE') as app_review_delete,
        not has_column_privilege('evergreen_app', 'public.seller_profiles', 'user_id', 'UPDATE')
          and not has_column_privilege('evergreen_app', 'public.listings', 'seller_user_id', 'UPDATE')
          and not has_column_privilege('evergreen_app', 'public.reviews', 'id', 'UPDATE')
          and not has_column_privilege('evergreen_app', 'public.reviews', 'listing_id', 'UPDATE')
          and not has_column_privilege('evergreen_app', 'public.reviews', 'user_id', 'UPDATE') as app_ownership_columns_immutable,
        has_column_privilege('evergreen_app', 'public.users', 'saved_listings', 'SELECT')
          and has_column_privilege('evergreen_app', 'public.users', 'saved_listings', 'UPDATE') as app_saved_listings_select_update,
        has_column_privilege('evergreen_app', 'public.users', 'saved_listings', 'SELECT')
          and has_column_privilege('evergreen_app', 'public.users', 'saved_listings', 'UPDATE')
          and not has_column_privilege('evergreen_app', 'public.users', 'saved_listings', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.users', 'preferences', 'SELECT')
          and has_column_privilege('evergreen_app', 'public.users', 'preferences', 'UPDATE')
          and not has_column_privilege('evergreen_app', 'public.users', 'preferences', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.users', 'image', 'UPDATE')
          and not has_column_privilege('evergreen_app', 'public.users', 'image', 'INSERT')
          and has_column_privilege('evergreen_app', 'public.users', 'updated_at', 'UPDATE')
          and not has_column_privilege('evergreen_app', 'public.users', 'updated_at', 'INSERT')
          and not has_column_privilege('evergreen_app', 'public.users', 'id', 'UPDATE')
          and not has_column_privilege('evergreen_app', 'public.users', 'name', 'UPDATE')
          and not has_column_privilege('evergreen_app', 'public.users', 'email', 'UPDATE')
          and not has_column_privilege('evergreen_app', 'public.users', 'email_verified', 'UPDATE')
          and not has_column_privilege('evergreen_app', 'public.users', 'created_at', 'UPDATE')
          and not has_column_privilege('evergreen_app', 'public.users', 'email', 'SELECT')
          and not has_column_privilege('evergreen_app', 'public.users', 'email_verified', 'SELECT')
          and not has_column_privilege('evergreen_app', 'public.users', 'created_at', 'SELECT')
          and not has_column_privilege('evergreen_app', 'public.users', 'updated_at', 'SELECT') as app_user_column_privileges_scoped,
        not has_table_privilege('evergreen_app', 'public.users', 'INSERT')
          and not has_table_privilege('evergreen_app', 'public.users', 'UPDATE')
          and not has_table_privilege('evergreen_app', 'public.users', 'DELETE') as app_users_table_write_denied,
        not has_column_privilege('evergreen_runtime', 'public.users', 'saved_listings', 'SELECT') as runtime_saved_listings_select_denied,
        has_table_privilege('evergreen_runtime', 'public.listings', 'SELECT')
          and has_table_privilege('evergreen_runtime', 'public.reviews', 'SELECT')
          and has_table_privilege('evergreen_runtime', 'public.seller_profiles', 'SELECT')
          and has_column_privilege('evergreen_runtime', 'public.users', 'id', 'SELECT')
          and has_column_privilege('evergreen_runtime', 'public.users', 'name', 'SELECT') as runtime_inherited_select,
        not has_column_privilege('evergreen_runtime', 'public.users', 'email', 'SELECT') as runtime_users_email_denied,
        has_column_privilege('evergreen_auth', 'public.users', 'id', 'SELECT')
          and has_column_privilege('evergreen_auth', 'public.users', 'name', 'SELECT')
          and has_column_privilege('evergreen_auth', 'public.users', 'email', 'SELECT')
          and has_column_privilege('evergreen_auth', 'public.users', 'email_verified', 'SELECT')
          and has_column_privilege('evergreen_auth', 'public.users', 'image', 'SELECT')
          and has_column_privilege('evergreen_auth', 'public.users', 'created_at', 'SELECT')
          and has_column_privilege('evergreen_auth', 'public.users', 'updated_at', 'SELECT')
          and has_column_privilege('evergreen_auth', 'public.users', 'id', 'INSERT')
          and has_column_privilege('evergreen_auth', 'public.users', 'name', 'INSERT')
          and has_column_privilege('evergreen_auth', 'public.users', 'email', 'INSERT')
          and has_column_privilege('evergreen_auth', 'public.users', 'email_verified', 'INSERT')
          and has_column_privilege('evergreen_auth', 'public.users', 'image', 'INSERT')
          and has_column_privilege('evergreen_auth', 'public.users', 'created_at', 'INSERT')
          and has_column_privilege('evergreen_auth', 'public.users', 'updated_at', 'INSERT')
          and has_column_privilege('evergreen_auth', 'public.users', 'name', 'UPDATE')
          and has_column_privilege('evergreen_auth', 'public.users', 'email', 'UPDATE')
          and has_column_privilege('evergreen_auth', 'public.users', 'email_verified', 'UPDATE')
          and has_column_privilege('evergreen_auth', 'public.users', 'image', 'UPDATE')
          and has_column_privilege('evergreen_auth', 'public.users', 'updated_at', 'UPDATE') as auth_users_crud,
        not has_table_privilege('evergreen_auth', 'public.users', 'DELETE') as auth_users_delete_denied,
        not has_column_privilege('evergreen_auth', 'public.users', 'saved_listings', 'SELECT')
          and not has_column_privilege('evergreen_auth', 'public.users', 'saved_listings', 'INSERT')
          and not has_column_privilege('evergreen_auth', 'public.users', 'saved_listings', 'UPDATE') as auth_saved_listings_access_denied,
        not has_table_privilege('evergreen_auth', 'public.users', 'SELECT')
          and not has_table_privilege('evergreen_auth', 'public.users', 'INSERT')
          and not has_table_privilege('evergreen_auth', 'public.users', 'UPDATE') as auth_users_table_privileges_denied,
        has_table_privilege('evergreen_auth', 'public.account', 'SELECT')
          and has_table_privilege('evergreen_auth', 'public.account', 'INSERT')
          and has_table_privilege('evergreen_auth', 'public.account', 'UPDATE')
          and has_table_privilege('evergreen_auth', 'public.account', 'DELETE') as auth_account_crud,
        has_table_privilege('evergreen_auth', 'public.session', 'SELECT')
          and has_table_privilege('evergreen_auth', 'public.session', 'INSERT')
          and has_table_privilege('evergreen_auth', 'public.session', 'UPDATE')
          and has_table_privilege('evergreen_auth', 'public.session', 'DELETE') as auth_session_crud,
        has_table_privilege('evergreen_auth', 'public.verification', 'SELECT')
          and has_table_privilege('evergreen_auth', 'public.verification', 'INSERT')
          and has_table_privilege('evergreen_auth', 'public.verification', 'UPDATE')
          and has_table_privilege('evergreen_auth', 'public.verification', 'DELETE') as auth_verification_crud
    `) as unknown as PrivilegeRow[];

    catalogStage = "AUTH_DATABASE_URL role";
    authConnections = await authDb.execute(sql`
      select current_user::text as role_name, rolcanlogin as can_login,
             rolinherit as inherits, rolsuper as is_superuser, rolbypassrls as bypasses_rls
      from pg_roles
      where rolname = current_user
    `) as unknown as AuthConnectionRow[];
  } catch {
    throw new PopulationError(`Read-only live database catalog check failed at ${catalogStage}; population is blocked.`);
  }

  const expectedRoleSettings: Record<string, { canLogin: boolean; inherits: boolean }> = {
    evergreen_read: { canLogin: false, inherits: true },
    evergreen_runtime: { canLogin: true, inherits: true },
    evergreen_app: { canLogin: true, inherits: false },
    evergreen_auth: { canLogin: true, inherits: false },
  };
  const roleAttributesPassed = roles.length === requiredRoles.length && requiredRoles.every((roleName) => {
    const role = roles.find((row) => row.role_name === roleName);
    const expected = expectedRoleSettings[roleName];
    return Boolean(role) && role!.can_login === expected.canLogin && role!.inherits === expected.inherits &&
      !role!.is_superuser && !role!.bypasses_rls && !role!.can_create_db && !role!.can_create_role && !role!.can_replicate;
  });

  const expectedMemberships = [
    { granted_role: "evergreen_read", member_role: "evergreen_app", inherit_option: true, set_option: false, admin_option: false },
    { granted_role: "evergreen_read", member_role: "evergreen_runtime", inherit_option: true, set_option: false, admin_option: false },
  ];
  const postgresMemberships = memberships.filter((row) => row.member_role === "postgres");
  const nonPostgresMemberships = memberships.filter((row) => row.member_role !== "postgres");
  const membershipSettingsPassed = nonPostgresMemberships.length === expectedMemberships.length &&
    expectedMemberships.every((expected) => nonPostgresMemberships.some((row) =>
      row.granted_role === expected.granted_role && row.member_role === expected.member_role &&
      row.inherit_option === expected.inherit_option && row.set_option === expected.set_option &&
      row.admin_option === expected.admin_option,
    )) && postgresMemberships.every((row) => !row.inherit_option && !row.set_option);

  const sharedTableGrants = grants.filter((row) => row.grantee === "evergreen_read" && row.scope === "TABLE");
  const sharedColumnGrants = grants.filter((row) => row.grantee === "evergreen_read" && row.scope === "COLUMN");
  const expectedSharedTableGrants = new Set(["listings:SELECT", "reviews:SELECT", "seller_profiles:SELECT"]);
  const expectedSharedColumnGrants = new Set(["users.id:SELECT", "users.name:SELECT", "users.image:SELECT"]);
  const sharedTableGrantsPassed = sharedTableGrants.length === expectedSharedTableGrants.size &&
    sharedTableGrants.every((row) => expectedSharedTableGrants.has(`${row.table_name}:${row.privilege_type}`));
  const sharedColumnGrantsPassed = sharedColumnGrants.length === expectedSharedColumnGrants.size &&
    sharedColumnGrants.every((row) => expectedSharedColumnGrants.has(`${row.table_name}.${row.column_name}:${row.privilege_type}`));
  const runtimeDirectGrantsAbsent = grants.filter((row) => row.grantee === "evergreen_runtime").length === 0;

  const sharedExpected = [
    { table: "listings", name: "Shared read role can read listings", qual: "true" },
    { table: "reviews", name: "Shared read role can read reviews", qual: "true" },
    { table: "seller_profiles", name: "Shared read role can read published seller storefronts", qual: "(is_published = true)" },
    { table: "users", name: "Shared read role can read application user identity", qual: "true" },
  ];
  const sharedTableSet = new Set(["listings", "reviews", "seller_profiles", "users"]);
  const actualSharedPolicies = policies.filter((row) => sharedTableSet.has(row.table_name) && row.roles.includes("evergreen_read"));
  const sharedPoliciesPassed = actualSharedPolicies.length === sharedExpected.length && sharedExpected.every((expected) => {
    const matches = actualSharedPolicies.filter((row) => row.table_name === expected.table && row.policy_name === expected.name);
    return matches.length === 1 && matches[0].command === "SELECT" && matches[0].permissive === "PERMISSIVE" &&
      matches[0].roles.length === 1 && matches[0].roles[0] === "evergreen_read" &&
      normalizeExpression(matches[0].qual) === normalizeExpression(expected.qual) && matches[0].with_check === null;
  });
  const obsoleteRuntimePoliciesAbsent = !policies.some((row) =>
    sharedTableSet.has(row.table_name) && row.command === "SELECT" && row.roles.includes("evergreen_runtime"),
  );

  const ownerExpected = [
    { table: "seller_profiles", name: "App can read own seller profile", command: "SELECT", column: "user_id" },
    { table: "seller_profiles", name: "App can create own seller profile", command: "INSERT", column: "user_id" },
    { table: "seller_profiles", name: "App can update own seller profile", command: "UPDATE", column: "user_id" },
    { table: "seller_profiles", name: "Owners can delete their seller profile", command: "DELETE", column: "user_id" },
    { table: "listings", name: "App can create own listings", command: "INSERT", column: "seller_user_id" },
    { table: "listings", name: "App can update own listings", command: "UPDATE", column: "seller_user_id" },
    { table: "listings", name: "App can delete own listings", command: "DELETE", column: "seller_user_id" },
    { table: "reviews", name: "Users can create their own reviews", command: "INSERT", column: "user_id" },
    { table: "reviews", name: "Users can update their own reviews", command: "UPDATE", column: "user_id" },
    { table: "reviews", name: "Users can delete their own reviews", command: "DELETE", column: "user_id" },
  ];
  const ownerTableSet = new Set(["seller_profiles", "listings", "reviews"]);
  const actualOwnerPolicies = policies.filter((row) => ownerTableSet.has(row.table_name) && row.roles.includes("evergreen_app"));
  const ownerPoliciesPassed = actualOwnerPolicies.length === ownerExpected.length && ownerExpected.every((expected) => {
    const matches = actualOwnerPolicies.filter((row) => row.table_name === expected.table && row.policy_name === expected.name);
    if (matches.length !== 1) return false;
    const row = matches[0];
    if (row.command !== expected.command || row.permissive !== "PERMISSIVE" || row.roles.length !== 1 || row.roles[0] !== "evergreen_app") return false;
    const ownerExpression = normalizeExpression(`(${expected.column} = (NULLIF(current_setting('app.current_user_id'::text, true), ''::text))::uuid)`);
    const qualMatches = row.command === "INSERT" ? row.qual === null : normalizeExpression(row.qual) === ownerExpression;
    const checkMatches = row.command === "INSERT" || row.command === "UPDATE"
      ? normalizeExpression(row.with_check) === ownerExpression
      : row.with_check === null;
    return qualMatches && checkMatches;
  });

  const expectedSavedListingPolicies = [
    { name: "App can read own saved listings", command: "SELECT", permissive: "PERMISSIVE" },
    { name: "App can only read own users row", command: "SELECT", permissive: "RESTRICTIVE" },
    { name: "App can update own saved listings", command: "UPDATE", permissive: "PERMISSIVE" },
  ] as const;
  const actualSavedListingPolicies = policies.filter((row) =>
    row.table_name === "users" &&
    expectedSavedListingPolicies.some((expected) => expected.name === row.policy_name),
  );
  const savedOwnerExpression = normalizeExpression(
    "id = (NULLIF(current_setting('app.current_user_id'::text, true), ''::text))::uuid",
  );
  const savedListingPoliciesPassed =
    actualSavedListingPolicies.length === expectedSavedListingPolicies.length &&
    expectedSavedListingPolicies.every((expected) => {
      const matches = actualSavedListingPolicies.filter((row) => row.policy_name === expected.name);
      if (matches.length !== 1) return false;
      const row = matches[0];
      return row.command === expected.command &&
        row.permissive === expected.permissive &&
        row.roles.length === 1 &&
        row.roles[0] === "evergreen_app" &&
        normalizeExpression(row.qual) === savedOwnerExpression &&
        (expected.command === "UPDATE"
          ? normalizeExpression(row.with_check) === savedOwnerExpression
          : row.with_check === null);
    });

  const authExpected = [
    ["users", "Evergreen auth can manage users"],
    ["account", "Evergreen auth can manage accounts"],
    ["session", "Evergreen auth can manage sessions"],
    ["verification", "Evergreen auth can manage verifications"],
  ] as const;
  const actualAuthPolicies = policies.filter((row) => authTables.has(row.table_name) && row.roles.includes("evergreen_auth"));
  const authPoliciesPassed = actualAuthPolicies.length === authExpected.length && authExpected.every(([table, name]) => {
    const matches = actualAuthPolicies.filter((row) => row.table_name === table && row.policy_name === name);
    return matches.length === 1 && matches[0].command === "ALL" && matches[0].permissive === "PERMISSIVE" &&
      matches[0].roles.length === 1 && matches[0].roles[0] === "evergreen_auth" &&
      normalizeExpression(matches[0].qual) === "true" && normalizeExpression(matches[0].with_check) === "true";
  });

  const rlsPassed = rls.length === allRlsTables.size && [...allRlsTables].every((table) =>
    rls.some((row) => row.table_name === table && row.enabled),
  );
  const savedCleanupTriggers = triggers.filter(
    (row) => row.trigger_name === "listings_remove_deleted_ids_from_saved_listings",
  );
  const savedCleanupTrigger = savedCleanupTriggers[0];
  const normalizedSavedCleanupTrigger = savedCleanupTrigger?.definition.toLowerCase().replace(/\s+/g, " ") ?? "";
  const normalizedSavedCleanupFunction = savedCleanupTrigger?.function_definition.toLowerCase().replace(/\s+/g, " ") ?? "";
  const savedCleanupTriggerPassed =
    savedCleanupTriggers.length === 1 &&
    savedCleanupTrigger.enabled === "O" &&
    savedCleanupTrigger.security_definer &&
    Boolean(savedCleanupTrigger.function_config?.some((value) => value.toLowerCase().replace(/\s+/g, "") === "search_path=pg_catalog,public")) &&
    normalizedSavedCleanupTrigger.includes("after delete on public.listings") &&
    normalizedSavedCleanupFunction.includes("array_remove(saved_listings, old.id)") &&
    normalizedSavedCleanupFunction.includes("saved_listings @> array[old.id]::uuid[]");

  const capTriggers = triggers.filter((row) => row.trigger_name === "listings_enforce_max_three_per_seller");
  const capTrigger = capTriggers[0];
  const normalizedTrigger = capTrigger?.definition.toLowerCase().replace(/\s+/g, " ") ?? "";
  const normalizedFunction = capTrigger?.function_definition.toLowerCase().replace(/\s+/g, " ") ?? "";
  const capTriggerPassed = capTriggers.length === 1 && capTrigger.enabled === "O" &&
    capTrigger.function_volatility === "v" && !capTrigger.security_definer &&
    Boolean(capTrigger.function_config?.some((value) => value.toLowerCase().replace(/\s+/g, "") === "search_path=pg_catalog,public")) &&
    normalizedTrigger.includes("before insert or update of seller_user_id") &&
    normalizedFunction.includes("pg_advisory_xact_lock") &&
    normalizedFunction.includes("hashtextextended(new.seller_user_id::text, 0)") &&
    normalizedFunction.includes("new.seller_user_id is null") &&
    normalizedFunction.includes("existing_count >= 3");

  const app = privileges[0];
  const appPrivilegesPassed = privileges.length === 1 && app.app_role === "evergreen_app" && app.app_select &&
    app.app_seller_profile_insert && app.app_listing_insert && app.app_review_insert &&
    app.app_seller_profile_update && app.app_listing_update && app.app_review_update &&
    app.app_seller_profile_delete && app.app_listing_delete && app.app_review_delete &&
    app.app_ownership_columns_immutable && app.app_saved_listings_select_update &&
    app.app_user_column_privileges_scoped && app.app_users_table_write_denied;
  const runtimePrivilegesPassed = privileges.length === 1 && app.runtime_inherited_select &&
    app.runtime_users_email_denied && app.runtime_saved_listings_select_denied;
  const authPrivilegesPassed = privileges.length === 1 && app.auth_users_crud && app.auth_users_delete_denied &&
    app.auth_saved_listings_access_denied && app.auth_users_table_privileges_denied &&
    app.auth_account_crud && app.auth_session_crud && app.auth_verification_crud;
  const authConnection = authConnections[0];
  const authConnectionPassed = authConnections.length === 1 && authConnection.role_name === "evergreen_auth" &&
    authConnection.can_login && !authConnection.inherits && !authConnection.is_superuser && !authConnection.bypasses_rls;

  const checks = [
    ["configured project connections", true],
    ["required database role login/inheritance attributes", roleAttributesPassed],
    ["shared-read membership settings", membershipSettingsPassed],
    ["evergreen_read table grants", sharedTableGrantsPassed],
    ["evergreen_read users.id/name/avatar-only column grants", sharedColumnGrantsPassed],
    ["absence of evergreen_runtime direct grants and intended inherited reads", runtimeDirectGrantsAbsent && runtimePrivilegesPassed],
    ["shared-read policies and absence of obsolete runtime policies", sharedPoliciesPassed && obsoleteRuntimePoliciesAbsent],
    ["RLS enabled on application and Better Auth tables", rlsPassed],
    ["owner-scoped CRUD policies", ownerPoliciesPassed],
    ["saved-list owner-only RLS policies", savedListingPoliciesPassed],
    ["listing deletion cleans saved-list references", savedCleanupTriggerPassed],
    ["saved-list/preferences/avatar column grants and role isolation", app.app_user_column_privileges_scoped &&
      app.app_users_table_write_denied && app.runtime_saved_listings_select_denied &&
      app.auth_saved_listings_access_denied && app.auth_users_table_privileges_denied],
    ["APP_DATABASE_URL write privileges and ownership-column restrictions", appPrivilegesPassed],
    ["AUTH_DATABASE_URL role, privileges, and policies", authConnectionPassed && authPrivilegesPassed && authPoliciesPassed],
    ["concurrency-safe three-listing trigger", capTriggerPassed],
  ] as const;

  for (const [label, passed] of checks) {
    console.log(`${passed ? "PASS" : "FAIL"}: ${label}.`);
  }
  console.log(
    `Catalog observation: postgres has ${postgresMemberships.length} membership(s) on ${[...new Set(postgresMemberships.map((row) => row.granted_role))].sort().join(", ") || "no application roles"}; INHERIT and SET ROLE are disabled for those memberships, which were left unchanged.`,
  );

  const failures = checks.filter(([, passed]) => !passed).map(([label]) => label);
  if (failures.length > 0) {
    throw new PopulationError(`Required live schema checks failed: ${failures.join("; ")}. Population is blocked.`);
  }
}

async function inspectSellerAccounts(): Promise<SellerPlan[]> {
  requireDbHelpers();
  const authDb = getAuthDb();
  let userRows: AuthUserRow[];
  try {
    userRows = await authDb
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(inArray(sql<string>`lower(${users.email})`, seedSellers.map(({ email }) => email)));
  } catch {
    throw new PopulationError("Could not inspect the fixture sellers using AUTH_DATABASE_URL.");
  }

  const usersByNormalizedEmail = new Map<string, AuthUserRow[]>();
  for (const user of userRows) {
    const normalizedEmail = user.email.toLowerCase();
    usersByNormalizedEmail.set(normalizedEmail, [
      ...(usersByNormalizedEmail.get(normalizedEmail) ?? []),
      user,
    ]);
  }
  const foundIds = userRows.map(({ id }) => id);
  const credentialRows: CredentialRow[] = foundIds.length === 0
    ? []
    : await authDb
      .select({
        userId: account.userId,
        accountId: account.accountId,
        providerId: account.providerId,
        hasPassword: sql<boolean>`(${account.password} is not null and length(${account.password}) > 0)`.as("has_password"),
      })
      .from(account)
      .where(inArray(account.userId, foundIds));

  const plans: SellerPlan[] = [];
  const conflicts: string[] = [];

  for (const seller of seedSellers) {
    const matchingUsers = usersByNormalizedEmail.get(seller.email.toLowerCase()) ?? [];
    if (matchingUsers.length > 1) {
      conflicts.push(`seller ${seller.key}: more than one existing identity matches the fixture email case-insensitively`);
      continue;
    }

    const user = matchingUsers[0] ?? null;
    if (!user) {
      plans.push({ seller, user: null, status: "create" });
      continue;
    }

    if (user.email !== seller.email || user.name !== seller.name || !UUID_PATTERN.test(user.id)) {
      conflicts.push(`seller ${seller.key}: existing Better Auth identity does not match the fixture name or UUID`);
      continue;
    }

    const credentials = credentialRows.filter(
      (candidate) => candidate.userId === user.id && candidate.providerId === "credential",
    );
    if (
      credentials.length !== 1 ||
      credentials[0].accountId !== user.id ||
      !credentials[0].hasPassword
    ) {
      conflicts.push(`seller ${seller.key}: existing identity does not have exactly one valid Better Auth credential account`);
      continue;
    }

    plans.push({ seller, user, status: "reuse" });
  }

  if (conflicts.length > 0) {
    printConflicts(conflicts);
    throw new PopulationError("Seller identity conflicts must be resolved before population.");
  }

  return plans;
}

function printConflicts(conflicts: string[]): void {
  console.log("Conflicts:");
  for (const conflict of conflicts) console.log(`  - ${conflict}`);
}

function timestampToMicroseconds(value: string | Date): number | null {
  const text = value instanceof Date ? value.toISOString() : value;
  const match = text.match(/\.(\d+)(?:Z|[+-]\d{2}(?::?\d{2})?)?$/i);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return null;
  const fraction = (match?.[1] ?? "").padEnd(6, "0").slice(0, 6);
  const extraMicroseconds = Number(fraction.slice(3) || "0");
  const timestamp = parsed * 1000 + extraMicroseconds;
  return Number.isSafeInteger(timestamp) ? timestamp : null;
}

function sameTimestamp(actual: string | Date, expected: string): boolean {
  const actualMicros = timestampToMicroseconds(actual);
  const expectedMicros = timestampToMicroseconds(expected);
  return actualMicros !== null && expectedMicros !== null && actualMicros === expectedMicros;
}

function sameStringArray(actual: string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function listingMatches(actual: ExistingListingRow, expected: ListingRecord, userId: string): boolean {
  return actual.sellerUserId === userId &&
    sameStringArray(actual.media, expected.media) &&
    sameStringArray(actual.tags, expected.tags) &&
    actual.title === expected.title &&
    Number(actual.price) === expected.price &&
    actual.beds === expected.beds &&
    actual.baths === expected.baths &&
    actual.sqft === expected.sqft &&
    actual.address === expected.address &&
    actual.description === expected.description &&
    sameTimestamp(actual.createdAt, expected.createdAt) &&
    sameTimestamp(actual.updatedAt, expected.updatedAt);
}

function reviewMatches(actual: ExistingReviewRow, expected: ReviewRecord, userId: string): boolean {
  return actual.listingId === expected.listingId &&
    actual.userId === userId &&
    actual.rating === expected.rating &&
    actual.comment === expected.comment &&
    sameTimestamp(actual.createdAt, expected.createdAt) &&
    sameTimestamp(actual.updatedAt, expected.updatedAt);
}

type DatabasePlan = {
  profileCreations: number;
  profileReuses: number;
  listingCreations: number;
  listingReuses: number;
  reviewCreations: number;
  reviewReuses: number;
  conflicts: string[];
};

async function inspectApplicationRecords(sellerPlans: SellerPlan[]): Promise<DatabasePlan> {
  requireDbHelpers();
  const appDb = getAppDb();
  const sellerByKey = new Map(sellerPlans.map((plan) => [plan.seller.key, plan]));
  const knownUserIds = sellerPlans.flatMap((plan) => plan.user ? [plan.user.id] : []);
  const fixtureListingIds = seedListings.map(({ id }) => id);
  const fixtureReviewIds = seedReviews.map(({ id }) => id);
  const conflicts: string[] = [];

  const listingRows = await appDb
    .select({
      id: listings.id,
      media: listings.media,
      tags: listings.tags,
      title: listings.title,
      price: listings.price,
      beds: listings.beds,
      baths: listings.baths,
      sqft: listings.sqft,
      address: listings.address,
      description: listings.description,
      createdAt: listings.createdAt,
      sellerUserId: listings.sellerUserId,
      updatedAt: listings.updatedAt,
    })
    .from(listings)
    .where(inArray(listings.id, fixtureListingIds)) as ExistingListingRow[];
  const listingsById = new Map(listingRows.map((row) => [row.id, row]));

  const reviewRows = await appDb
    .select({
      id: reviews.id,
      listingId: reviews.listingId,
      userId: reviews.userId,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
    })
    .from(reviews)
    .where(inArray(reviews.id, fixtureReviewIds)) as ExistingReviewRow[];
  const reviewsById = new Map(reviewRows.map((row) => [row.id, row]));

  let profileCreations = 0;
  let profileReuses = 0;
  let listingCreations = 0;
  let listingReuses = 0;
  let reviewCreations = 0;
  let reviewReuses = 0;

  for (const plan of sellerPlans) {
    if (!plan.user) {
      profileCreations += 1;
      continue;
    }

    try {
      const existingProfiles = await withOwnerTransaction(plan.user.id, async (tx) =>
        tx.select({
          userId: sellerProfiles.userId,
          displayName: sellerProfiles.displayName,
          bio: sellerProfiles.bio,
          avatarUrl: sellerProfiles.avatarUrl,
          contactEmail: sellerProfiles.contactEmail,
          contactPhone: sellerProfiles.contactPhone,
          preferredContactMethod: sellerProfiles.preferredContactMethod,
          isPublished: sellerProfiles.isPublished,
        }).from(sellerProfiles).where(eq(sellerProfiles.userId, plan.user!.id)),
      );

      const expected = plan.seller.profile;
      if (existingProfiles.length === 0) {
        profileCreations += 1;
      } else if (
        existingProfiles.length === 1 &&
        existingProfiles[0].displayName === expected.displayName &&
        existingProfiles[0].bio === expected.bio &&
        existingProfiles[0].avatarUrl === expected.avatarUrl &&
        existingProfiles[0].contactEmail === expected.contactEmail &&
        existingProfiles[0].contactPhone === expected.contactPhone &&
        existingProfiles[0].preferredContactMethod === expected.preferredContactMethod &&
        existingProfiles[0].isPublished === expected.isPublished
      ) {
        profileReuses += 1;
      } else {
        conflicts.push(`seller ${plan.seller.key}: seller profile conflicts with fixture data`);
      }
    } catch {
      throw new PopulationError(`Could not inspect the seller profile for ${plan.seller.key} using APP_DATABASE_URL.`);
    }
  }

  for (const expected of seedListings) {
    const seller = sellerByKey.get(expected.sellerKey);
    const existing = listingsById.get(expected.id);

    if (!seller?.user) {
      if (existing) conflicts.push(`listing ${expected.id}: fixture ID already exists before its intended seller identity is available`);
      else listingCreations += 1;
      continue;
    }

    if (!existing) {
      listingCreations += 1;
    } else if (listingMatches(existing, expected, seller.user.id)) {
      listingReuses += 1;
    } else {
      conflicts.push(`listing ${expected.id}: existing row or seller ownership conflicts with fixture data`);
    }
  }

  const knownReviewerIds = new Set(knownUserIds);
  for (const expected of seedReviews) {
    const reviewer = sellerByKey.get(expected.reviewerKey);
    const existing = reviewsById.get(expected.id);

    if (!reviewer?.user) {
      if (existing) conflicts.push(`review ${expected.id}: fixture ID already exists before its intended reviewer identity is available`);
      else reviewCreations += 1;
      continue;
    }

    if (!existing) {
      reviewCreations += 1;
    } else if (reviewMatches(existing, expected, reviewer.user.id)) {
      reviewReuses += 1;
    } else {
      conflicts.push(`review ${expected.id}: existing row or reviewer relationship conflicts with fixture data`);
    }
  }

  if (knownReviewerIds.size > 0) {
    const pairRows = await appDb
      .select({ id: reviews.id, listingId: reviews.listingId, userId: reviews.userId })
      .from(reviews)
      .where(and(
        inArray(reviews.listingId, fixtureListingIds),
        inArray(reviews.userId, [...knownReviewerIds]),
      ));

    const expectedPairIds = new Set(seedReviews.flatMap((review) => {
      const reviewer = sellerByKey.get(review.reviewerKey);
      return reviewer?.user ? [`${review.listingId}:${reviewer.user.id}:${review.id}`] : [];
    }));

    for (const row of pairRows) {
      const isExpected = expectedPairIds.has(`${row.listingId}:${row.userId}:${row.id}`);
      const isFixturePair = seedReviews.some((review) => {
        const reviewer = sellerByKey.get(review.reviewerKey);
        return review.listingId === row.listingId && reviewer?.user?.id === row.userId;
      });
      if (isFixturePair && !isExpected) {
        conflicts.push(`review pair ${row.listingId}/${row.userId}: an unrelated review ID already occupies the fixture relationship`);
      }
    }
  }

  for (const seller of seedSellers) {
    const sellerPlan = sellerByKey.get(seller.key);
    if (!sellerPlan?.user) continue;

    const existingOwnedListings = await withOwnerTransaction(sellerPlan.user.id, async (tx) =>
      tx.select({ id: listings.id })
        .from(listings)
        .where(eq(listings.sellerUserId, sellerPlan.user!.id)),
    );
    const missingFixtureRows = seedListings.filter((listing) =>
      listing.sellerKey === seller.key && !listingsById.has(listing.id),
    ).length;

    if (existingOwnedListings.length + missingFixtureRows > MAX_ACTIVE_LISTINGS_PER_SELLER) {
      conflicts.push(
        `seller ${seller.key}: existing listings plus missing fixtures would exceed the ${MAX_ACTIVE_LISTINGS_PER_SELLER}-listing cap`,
      );
    }
  }

  return {
    profileCreations,
    profileReuses,
    listingCreations,
    listingReuses,
    reviewCreations,
    reviewReuses,
    conflicts,
  };
}

async function compareExistingStorageObject(
  storageBucket: ReturnType<ReturnType<typeof createStorageClient>["storage"]["from"]>,
  entry: MediaManifestEntry,
): Promise<boolean> {
  const { data, error } = await storageBucket.download(entry.path);
  if (error || !data) {
    throw new PopulationError(`Could not download existing fixture object ${entry.listingId}/${entry.filename} for byte comparison.`);
  }
  const [remoteBytes, localBytes] = await Promise.all([
    data.arrayBuffer().then((value) => Buffer.from(value)),
    readFile(entry.localPath),
  ]);
  return remoteBytes.equals(localBytes);
}

async function inspectStorage(entries: MediaManifestEntry[]): Promise<StoragePlan> {
  const storage = createStorageClient();
  await verifyStorageBucket(storage);
  const bucket = storage.storage.from(STORAGE_BUCKET);
  const identical: MediaManifestEntry[] = [];
  const missing: MediaManifestEntry[] = [];
  const conflicts: string[] = [];
  const expectedNamesByListing = new Map<string, Set<string>>();
  const existingNamesByListing = new Map<string, Set<string>>();

  for (const entry of entries) {
    const filenames = expectedNamesByListing.get(entry.listingId) ?? new Set<string>();
    filenames.add(entry.filename);
    expectedNamesByListing.set(entry.listingId, filenames);
  }

  let extraObjects = 0;
  for (const [listingId, expectedNames] of expectedNamesByListing) {
    const { data, error } = await bucket.list(`listings/${listingId}`, { limit: 1000 });
    if (error || !data) {
      throw new PopulationError(`Could not list fixture Storage folder for listing ${listingId}.`);
    }
    existingNamesByListing.set(listingId, new Set(data.map((item) => item.name)));
    extraObjects += data.filter((item) => !expectedNames.has(item.name)).length;
  }

  for (const entry of entries) {
    const isListed = existingNamesByListing.get(entry.listingId)?.has(entry.filename) ?? false;
    if (!isListed) {
      missing.push(entry);
      continue;
    }

    try {
      if (!(await compareExistingStorageObject(bucket, entry))) {
        conflicts.push(`Storage byte conflict at ${entry.listingId}/${entry.filename}; the object was left unchanged`);
      } else {
        identical.push(entry);
      }
    } catch {
      conflicts.push(`Could not byte-verify existing Storage object ${entry.listingId}/${entry.filename}`);
    }
  }

  return { entries, identical, missing, extraObjects, conflicts };
}

function printPlan(input: {
  options: CliOptions;
  sellerPlans: SellerPlan[];
  databasePlan: DatabasePlan;
  storagePlan: StoragePlan;
}): void {
  const { options, sellerPlans, databasePlan, storagePlan } = input;
  console.log(`Mode: ${options.mode}`);
  console.log(`Target project: ${EXPECTED_PROJECT_REF} (all configured connection targets verified)`);
  console.log(`Fixture records: ${seedSellers.length} sellers, ${seedListings.length} listings, ${seedReviews.length} reviews, ${storagePlan.entries.length} media assets`);
  console.log(`Better Auth: ${sellerPlans.filter(({ status }) => status === "create").length} planned account creations; ${sellerPlans.filter(({ status }) => status === "reuse").length} valid accounts reused`);
  console.log(`Seller profiles: ${databasePlan.profileCreations} planned creations; ${databasePlan.profileReuses} reused`);
  console.log(`Listings: ${databasePlan.listingCreations} planned creations; ${databasePlan.listingReuses} reused`);
  console.log(`Reviews: ${databasePlan.reviewCreations} planned creations; ${databasePlan.reviewReuses} reused`);
  console.log(`Storage: ${storagePlan.missing.length} missing; ${storagePlan.identical.length} existing objects verified byte-for-byte and skipped`);
  if (storagePlan.extraObjects > 0) {
    console.log(`Storage: ${storagePlan.extraObjects} additional objects in fixture listing folders will be preserved untouched`);
  }
  if (HISTORICAL_0011_DISCREPANCY_ACKNOWLEDGED) {
    console.log("Migration provenance: the 0011 checksum mismatch remains unresolved but explicitly acknowledged; migration 0021 is applied, live schema/security checks passed, and no checksum or ledger repair was attempted.");
  }
  if (databasePlan.conflicts.length > 0 || storagePlan.conflicts.length > 0) {
    printConflicts([...databasePlan.conflicts, ...storagePlan.conflicts]);
  }
}

function createPopulationAuth() {
  requireDbHelpers();
  return betterAuth({
    appName: "Evergreen Estates",
    baseURL: getRequiredEnv("BETTER_AUTH_URL"),
    secret: getRequiredEnv("BETTER_AUTH_SECRET"),
    database: drizzleAdapter(getAuthDb(), {
      provider: "pg",
      schema: authSchema,
    }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
    },
    advanced: {
      database: {
        generateId: "uuid",
      },
    },
    logger: {
      disabled: true,
    },
  });
}

async function getVerifiedUserByEmail(seller: SellerRecord): Promise<AuthUserRow | null> {
  requireDbHelpers();
  const authDb = getAuthDb();
  const found = await authDb
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.email, seller.email));
  if (found.length === 0) return null;
  if (found.length !== 1 || found[0].name !== seller.name || !UUID_PATTERN.test(found[0].id)) {
    throw new PopulationError(`Seller ${seller.key} identity changed during population; stop and rerun preflight.`);
  }

  const credential = await authDb
    .select({
      userId: account.userId,
      accountId: account.accountId,
      providerId: account.providerId,
      hasPassword: sql<boolean>`(${account.password} is not null and length(${account.password}) > 0)`.as("has_password"),
    })
    .from(account)
    .where(and(eq(account.userId, found[0].id), eq(account.providerId, "credential")));

  if (credential.length !== 1 || credential[0].accountId !== found[0].id || !credential[0].hasPassword) {
    throw new PopulationError(`Seller ${seller.key} does not have a valid Better Auth credential account.`);
  }
  return found[0];
}

async function markFixtureSellerVerified(seller: SellerRecord, userId: string): Promise<void> {
  // This helper is reachable only from the manually invoked populate script.
  // Public registration never imports or calls the fixture allowlist.
  if (!isSeedFixtureIdentity(seller.email, seller.name)) {
    throw new PopulationError("Refusing to verify an identity outside the exact synthetic fixture allowlist.");
  }

  requireDbHelpers();
  const updated = await getAuthDb()
    .update(users)
    .set({ emailVerified: true })
    .where(and(
      eq(users.id, userId),
      eq(users.email, seller.email),
      eq(users.name, seller.name),
    ))
    .returning({ id: users.id });

  if (updated.length !== 1 || updated[0].id !== userId) {
    throw new PopulationError("Could not mark the allowlisted fixture seller as verified; stop and inspect the account state.");
  }
}

async function provisionSellerAccounts(
  sellerPlans: SellerPlan[],
  passwords: Map<string, string>,
): Promise<Map<string, string>> {
  const auth = sellerPlans.some(({ status }) => status === "create")
    ? createPopulationAuth()
    : null;
  const userIds = new Map<string, string>();

  for (const plan of sellerPlans) {
    if (plan.user) {
      await markFixtureSellerVerified(plan.seller, plan.user.id);
      userIds.set(plan.seller.key, plan.user.id);
      continue;
    }

    const existing = await getVerifiedUserByEmail(plan.seller);
    if (existing) {
      await markFixtureSellerVerified(plan.seller, existing.id);
      userIds.set(plan.seller.key, existing.id);
      console.log(`Account ${plan.seller.key}: reused after concurrent creation`);
      continue;
    }

    const password = passwords.get(plan.seller.key);
    if (!password || password.length < 8 || password.length > 128) {
      throw new PopulationError(`Missing or invalid ${getPasswordKey(plan.seller)} in seed/credentials; no account was created for ${plan.seller.key}.`);
    }

    try {
      if (!auth) throw new PopulationError("Better Auth was not initialized for a required new seller.");
      const result = await auth.api.signUpEmail({
        body: {
          name: plan.seller.name,
          email: plan.seller.email,
          password,
        },
      });
      if (result.token) {
        throw new PopulationError("Better Auth unexpectedly created a session; stop before continuing.");
      }
    } catch (error) {
      if (error instanceof PopulationError) throw error;
      // Never print the Better Auth error object: providers may attach request
      // details. A successful concurrent signup can still be safely reused.
    }

    const created = await getVerifiedUserByEmail(plan.seller);
    if (!created) {
      throw new PopulationError(`Better Auth did not provision seller ${plan.seller.key}; rerun after reviewing the account state.`);
    }

    await markFixtureSellerVerified(plan.seller, created.id);
    userIds.set(plan.seller.key, created.id);
    console.log(`Account ${plan.seller.key}: provisioned through Better Auth and verified through the fixture-only allowlist (UUID ${created.id})`);
  }

  return userIds;
}

function profileValues(seller: SellerRecord, userId: string) {
  return {
    userId,
    ...seller.profile,
  };
}

async function createMissingProfiles(
  sellerPlans: SellerPlan[],
  userIds: Map<string, string>,
): Promise<void> {
  requireDbHelpers();
  for (const plan of sellerPlans) {
    const userId = userIds.get(plan.seller.key);
    if (!userId) throw new PopulationError(`Missing canonical user UUID for seller ${plan.seller.key}.`);

    const rows = await withOwnerTransaction(userId, async (tx) =>
      tx.select({
        displayName: sellerProfiles.displayName,
        bio: sellerProfiles.bio,
        avatarUrl: sellerProfiles.avatarUrl,
        contactEmail: sellerProfiles.contactEmail,
        contactPhone: sellerProfiles.contactPhone,
        preferredContactMethod: sellerProfiles.preferredContactMethod,
        isPublished: sellerProfiles.isPublished,
      }).from(sellerProfiles).where(eq(sellerProfiles.userId, userId)),
    );
    if (rows.length > 0) {
      const expected = plan.seller.profile;
      if (
        rows.length !== 1 ||
        rows[0].displayName !== expected.displayName ||
        rows[0].bio !== expected.bio ||
        rows[0].avatarUrl !== expected.avatarUrl ||
        rows[0].contactEmail !== expected.contactEmail ||
        rows[0].contactPhone !== expected.contactPhone ||
        rows[0].preferredContactMethod !== expected.preferredContactMethod ||
        rows[0].isPublished !== expected.isPublished
      ) {
        throw new PopulationError(`Seller profile for ${plan.seller.key} changed after preflight; no profile overwrite was attempted.`);
      }
      continue;
    }

    await withOwnerTransaction(userId, async (tx) => {
      await tx.insert(sellerProfiles).values(profileValues(plan.seller, userId));
    });
    console.log(`Seller profile ${plan.seller.key}: created`);
  }
}

async function uploadMissingMedia(storagePlan: StoragePlan): Promise<void> {
  const storage = createStorageClient();
  const bucket = storage.storage.from(STORAGE_BUCKET);
  let uploaded = 0;

  for (const entry of storagePlan.missing) {
    const bytes = await readFile(entry.localPath);
    if (bytes.length !== entry.size || bytes.length <= 0 || bytes.length > MAX_MEDIA_FILE_BYTES) {
      throw new PopulationError(`Local media asset ${entry.listingId}/${entry.filename} changed after preflight or exceeds the shared size limit.`);
    }
    const { error } = await bucket.upload(entry.path, bytes, {
      contentType: entry.contentType,
      upsert: false,
    });

    if (error) {
      // Another run may have won the non-overwriting upload race. Reuse only
      // after comparing actual downloaded bytes; never replace the object.
      const { data: files, error: listError } = await bucket.list(`listings/${entry.listingId}`, { limit: 1000 });
      const exists = files?.some((file) => file.name === entry.filename) ?? false;
      if (listError || !exists || !(await compareExistingStorageObject(bucket, entry))) {
        throw new PopulationError(`Could not upload fixture object ${entry.listingId}/${entry.filename}; any existing object was left unchanged.`);
      }
      console.log(`Storage ${entry.listingId}/${entry.filename}: identical concurrent object reused`);
      continue;
    }

    if (!(await compareExistingStorageObject(bucket, entry))) {
      throw new PopulationError(`Uploaded fixture object ${entry.listingId}/${entry.filename} failed byte verification; it was left in place.`);
    }
    uploaded += 1;
    console.log(`Storage ${entry.listingId}/${entry.filename}: uploaded and byte-verified`);
  }

  console.log(`Storage upload phase complete: ${uploaded} new objects uploaded; no objects were deleted or overwritten.`);
}

async function createMissingListings(userIds: Map<string, string>): Promise<void> {
  requireDbHelpers();
  const appDb = getAppDb();

  for (const seller of seedSellers) {
    const userId = userIds.get(seller.key);
    if (!userId) throw new PopulationError(`Missing canonical user UUID for seller ${seller.key}.`);

    const ownedRows = await withOwnerTransaction(userId, async (tx) =>
      tx.select({ id: listings.id })
        .from(listings)
        .where(eq(listings.sellerUserId, userId)),
    );

    if (ownedRows.length + seedListings.filter((listing) => listing.sellerKey === seller.key && !ownedRows.some((row) => row.id === listing.id)).length > MAX_ACTIVE_LISTINGS_PER_SELLER) {
      throw new PopulationError(`Seller ${seller.key} would exceed the ${MAX_ACTIVE_LISTINGS_PER_SELLER}-listing cap; no further listings were written.`);
    }

    for (const listing of seedListings.filter((candidate) => candidate.sellerKey === seller.key)) {
      const existingRows = await appDb
        .select({
          id: listings.id,
          media: listings.media,
          tags: listings.tags,
          title: listings.title,
          price: listings.price,
          beds: listings.beds,
          baths: listings.baths,
          sqft: listings.sqft,
          address: listings.address,
          description: listings.description,
          createdAt: listings.createdAt,
          sellerUserId: listings.sellerUserId,
          updatedAt: listings.updatedAt,
        })
        .from(listings)
        .where(eq(listings.id, listing.id));
      if (existingRows.length > 0) {
        if (existingRows.length !== 1 || !listingMatches(existingRows[0], listing, userId)) {
          throw new PopulationError(`Listing ${listing.id} changed after preflight; no existing row was overwritten.`);
        }
        continue;
      }

      await withOwnerTransaction(userId, async (tx) => {
        await tx.insert(listings).values({
          id: listing.id,
          media: [...listing.media],
          tags: [...listing.tags],
          title: listing.title,
          price: String(listing.price),
          beds: listing.beds,
          baths: listing.baths,
          sqft: listing.sqft,
          address: listing.address,
          description: listing.description,
          createdAt: listing.createdAt,
          sellerUserId: userId,
          updatedAt: listing.updatedAt,
        });
      });
      console.log(`Listing ${listing.id}: created for seller ${seller.key}`);
    }
  }
}

async function createMissingReviews(userIds: Map<string, string>): Promise<void> {
  requireDbHelpers();
  const appDb = getAppDb();

  for (const review of seedReviews) {
    const userId = userIds.get(review.reviewerKey);
    if (!userId) throw new PopulationError(`Missing canonical reviewer UUID for ${review.reviewerKey}.`);

    const existingRows = await appDb
      .select({
        id: reviews.id,
        listingId: reviews.listingId,
        userId: reviews.userId,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
      })
      .from(reviews)
      .where(eq(reviews.id, review.id));
    if (existingRows.length > 0) {
      if (existingRows.length !== 1 || !reviewMatches(existingRows[0], review, userId)) {
        throw new PopulationError(`Review ${review.id} changed after preflight; no existing row was overwritten.`);
      }
      continue;
    }

    await withOwnerTransaction(userId, async (tx) => {
      await tx.insert(reviews).values({
        id: review.id,
        listingId: review.listingId,
        userId,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
      });
    });
    console.log(`Review ${review.id}: created`);
  }
}

async function closeDatabaseClients(): Promise<void> {
  const closures: Promise<unknown>[] = [];
  if (appDatabase) closures.push(appDatabase.$client.end({ timeout: 5 }));
  if (authDatabase) closures.push(authDatabase.$client.end({ timeout: 5 }));
  await Promise.allSettled(closures);
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  validateProjectConfiguration();
  await loadServerHelpers();
  validateStaticFixtures();
  const mediaManifest = await buildMediaManifest();

  console.log(`Preflight target: ${EXPECTED_PROJECT_REF}`);
  console.log("Validating database roles, seller identities, fixture rows, listing caps, and private Storage objects...");

  try {
    await verifyDbRoles();
    await verifyLiveSchemaContract();
  } catch (error) {
    if (error instanceof PopulationError) throw error;
    throw new PopulationError("Live schema contract preflight failed; population is blocked.");
  }

  const sellerPlans = await inspectSellerAccounts();
  const databasePlan = await inspectApplicationRecords(sellerPlans);
  const storagePlan = await inspectStorage(mediaManifest);

  printPlan({ options, sellerPlans, databasePlan, storagePlan });

  if (databasePlan.conflicts.length > 0 || storagePlan.conflicts.length > 0) {
    throw new PopulationError("Fixture record conflicts must be resolved before population.");
  }

  if (options.mode === "dry-run") {
    console.log("Dry-run complete. No auth, database, or Storage writes were performed.");
    return;
  }

  // The exact historical 0011 bytes remain unknown. Do not claim the hash was
  // resolved or update the ledger. This explicit acknowledgement allows writes
  // only after migration 0021 is applied and the live preflight passes.
  if (!HISTORICAL_0011_DISCREPANCY_ACKNOWLEDGED) {
    throw new PopulationError(
      "Apply is blocked because the 0011 checksum discrepancy has not been explicitly acknowledged. Dry-run remains available.",
    );
  }

  if (options.confirmedProject !== EXPECTED_PROJECT_REF) {
    throw new PopulationError("Write mode lost its explicit target project confirmation.");
  }

  validateAuthProvisioningConfig(sellerPlans, options.mode);
  const passwords = await readSellerCredentials(sellerPlans);
  const userIds = await provisionSellerAccounts(sellerPlans, passwords);
  await createMissingProfiles(sellerPlans, userIds);
  await uploadMissingMedia(storagePlan);
  await createMissingListings(userIds);
  await createMissingReviews(userIds);
  console.log("Population completed. No existing or unrelated rows or Storage objects were deleted.");
}

run()
  .catch((error: unknown) => {
    if (error instanceof PopulationError) {
      console.error(`Population stopped: ${error.message}`);
    } else {
      console.error("Population stopped after an unexpected failure. Review the connection, permissions, and target state; no automatic cleanup was attempted.");
    }
    process.exitCode = 1;
  })
  .finally(closeDatabaseClients);
