import { and, desc, eq } from "drizzle-orm";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import Listing from "@/components/Listing";
import { getDrizzleDb } from "@/db/drizzle/client";
import { listings, sellerProfiles } from "@/db/schema";
import getMediaUrls from "@/db/supabase/util/GetMediaUrls";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Published storefronts are public but must remain request-rendered: listing
// media URLs are signed and expire.
export const dynamic = "force-dynamic";

type PublicSellerProfile = {
  userId: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  preferredContactMethod: string;
  isPublished: boolean;
};

export default async function PublicSellerPage({
  params,
}: {
  params: Promise<{ sellerId: string }>;
}) {
  const { sellerId } = await params;

  if (!UUID_PATTERN.test(sellerId)) notFound();

  let profile: PublicSellerProfile | null = null;
  let sellerListings: Array<{
    id: string;
    media: string[];
    title: string;
    price: number;
    description: string;
  }> = [];

  try {
    const db = getDrizzleDb();

    // RLS on seller_profiles allows the shared read role to see only profiles
    // marked published. Keep this predicate explicit as documentation too.
    const [seller] = await db
      .select({
        userId: sellerProfiles.userId,
        displayName: sellerProfiles.displayName,
        bio: sellerProfiles.bio,
        avatarUrl: sellerProfiles.avatarUrl,
        contactEmail: sellerProfiles.contactEmail,
        contactPhone: sellerProfiles.contactPhone,
        preferredContactMethod: sellerProfiles.preferredContactMethod,
        isPublished: sellerProfiles.isPublished,
      })
      .from(sellerProfiles)
      .where(
        and(
          eq(sellerProfiles.userId, sellerId),
          eq(sellerProfiles.isPublished, true),
        ),
      )
      .limit(1);

    if (!seller) notFound();
    profile = seller;

    const rows = await db
      .select({
        id: listings.id,
        media: listings.media,
        title: listings.title,
        price: listings.price,
        description: listings.description,
      })
      .from(listings)
      .where(eq(listings.sellerUserId, sellerId))
      .orderBy(desc(listings.createdAt));

    sellerListings = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        media: await getMediaUrls(row.id, row.media),
        title: row.title,
        price: Number(row.price),
        description: row.description,
      })),
    );
  } catch (error) {
    // Preserve Next's notFound behavior while giving actual service failures
    // a useful page state. Never expose database or credential details.
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    console.error("Could not load published seller storefront.", error);
    return (
      <main className="mx-auto min-h-[60vh] w-full max-w-3xl px-4 py-10 text-white sm:px-6 sm:py-14">
        <h1 className="text-2xl font-semibold">Seller profile unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-white/65">
          This public profile could not be loaded right now. Please try again later.
        </p>
        <Link href="/search" className="mt-5 inline-flex min-h-11 items-center underline underline-offset-4">
          Browse listings
        </Link>
      </main>
    );
  }

  if (!profile) notFound();

  return (
    <main className="min-h-screen bg-[#141616] px-4 py-8 text-white sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-5xl">
        <header className="rounded-xl border border-white/10 bg-[#202324] p-5 sm:p-8">
          {profile.avatarUrl && (
            <Image
              src={profile.avatarUrl}
              alt={profile.displayName + " profile"}
              width={96}
              height={96}
              unoptimized
              className="mb-4 h-20 w-20 rounded-full border border-white/15 object-cover sm:h-24 sm:w-24"
            />
          )}
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a6d78f]">
            Seller profile
          </p>
          <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
            {profile.displayName}
          </h1>
          {profile.bio && (
            <p className="mt-4 max-w-3xl whitespace-pre-wrap break-words text-sm leading-7 text-white/75">
              {profile.bio}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2 border-t border-white/10 pt-5 text-sm sm:flex-row sm:flex-wrap sm:gap-5">
            {profile.preferredContactMethod === "email" && profile.contactEmail && (
              <a className="inline-flex min-h-11 items-center underline underline-offset-4" href={"mailto:" + profile.contactEmail}>
                Contact by email
              </a>
            )}
            {profile.preferredContactMethod === "phone" && profile.contactPhone && (
              <a className="inline-flex min-h-11 items-center underline underline-offset-4" href={"tel:" + profile.contactPhone}>
                Contact by phone
              </a>
            )}
          </div>
        </header>

        <section className="mt-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold sm:text-2xl">Properties from {profile.displayName}</h2>
              <p className="mt-1 text-sm text-white/60">
                {sellerListings.length} {sellerListings.length === 1 ? "property" : "properties"} listed
              </p>
            </div>
          </div>

          {sellerListings.length === 0 ? (
            <p className="mt-5 rounded-lg border border-dashed border-white/15 p-5 text-sm text-white/60">
              This seller has not published any listings yet.
            </p>
          ) : (
            <div className="mt-5 grid grid-cols-1 justify-items-center gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sellerListings.map((listing) => (
                <Listing key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
