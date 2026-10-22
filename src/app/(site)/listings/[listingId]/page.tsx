import { getListingById } from "@/db/queries/listings";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { and, eq } from "drizzle-orm";

import { ListingMediaCarousel } from "@/components/ListingMediaCarousel";
import { ListingOwnerActions } from "@/components/ListingOwnerActions";
import { SaveListingButton } from "@/components/SaveListingButton";
import { ReviewsSection } from "@/components/ReviewsSection";
import { getMediaType } from "@/db/supabase/util/MediaType";
import { withAppUserTransaction } from "@/db/drizzle/app-client";
import { listings } from "@/db/schema";
import { getAuth } from "@/lib/auth";

async function canManageListing(listingId: string): Promise<boolean> {
  try {
    const session = await getAuth().api.getSession({
      headers: await headers(),
    });

    if (!session?.user.id) return false;

    return await withAppUserTransaction(session.user.id, async (tx) => {
      const [listing] = await tx
        .select({ id: listings.id })
        .from(listings)
        .where(
          and(
            eq(listings.id, listingId),
            eq(listings.sellerUserId, session.user.id),
          ),
        )
        .limit(1);

      return Boolean(listing);
    });
  } catch (error) {
    console.error("Could not verify listing ownership.", error);
    return false;
  }
}

export default async function ListingDetails({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;
  const listing = await getListingById(listingId);

  if (!listing) {
    return (
      <main className="px-4 py-10 text-white">
        <h1 className="text-2xl font-semibold">Listing not found</h1>
        <p className="mt-2 text-sm text-white/60">
          This property may have been removed or the link may be incorrect.
        </p>
        <Link href="/search" className="mt-4 inline-flex min-h-11 items-center text-sm underline underline-offset-4">
          Return to search
        </Link>
      </main>
    );
  }

  const canManage = await canManageListing(listing.id);
  const averageRating =
    listing.reviews.length > 0
      ? listing.reviews.reduce((sum, review) => sum + review.rating, 0) /
        listing.reviews.length
      : null;

  const media = listing.media.map((src) => ({
    type: getMediaType(src),
    src,
  }));
  const featuredMedia = media[0];

  return (
    <main className="min-h-screen bg-[#141616] pb-8">
      {featuredMedia ? (
        featuredMedia.type === "video" ? (
          <video
            src={featuredMedia.src}
            controls
            playsInline
            preload="metadata"
            className="max-h-[70vh] w-full bg-black object-contain"
            aria-label={listing.title + " featured video"}
          />
        ) : (
          <div className="relative h-[35vh] min-h-64 w-full bg-black sm:h-[55vh]">
            <Image
              src={featuredMedia.src}
              fill
              sizes="100vw"
              alt={listing.title + " featured property media"}
              className="object-cover"
              priority
            />
          </div>
        )
      ) : (
        <div className="flex aspect-[16/9] max-h-[55vh] items-center justify-center bg-[#202324] text-sm text-white/50">
          No property media available yet
        </div>
      )}

      <section className="mx-auto w-full max-w-5xl px-4 py-5 text-white sm:px-6 sm:py-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold sm:text-3xl">{listing.title}</h1>
            <p className="mt-2 text-sm text-white/65">{listing.address}</p>
            <p className="mt-4 text-2xl font-semibold text-[#a6d78f]">
              {"$" + listing.price.toLocaleString()}
            </p>
            {averageRating === null ? (
              <p className="mt-2 text-sm text-white/60">Not yet rated · No reviews yet</p>
            ) : (
              <p className="mt-2 text-sm text-white/75">
                {averageRating.toFixed(1)} ★ · {listing.reviews.length} {listing.reviews.length === 1 ? "review" : "reviews"}
              </p>
            )}
          </div>

          <div className="flex flex-col items-start gap-3 sm:min-w-52">
            <SaveListingButton listingId={listing.id} />
            {canManage && (
              <>
                <ListingOwnerActions listingId={listing.id} />
                <Link
                  href={"/listings/" + encodeURIComponent(listing.id) + "/media"}
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/20 px-4 text-sm font-medium text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]"
                >
                  Manage listing media
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-[#202324] p-3 text-center sm:gap-4 sm:p-4">
          <div>
            <p className="text-xl font-semibold">{listing.beds}</p>
            <p className="mt-1 text-xs text-white/60 sm:text-sm">Bedrooms</p>
          </div>
          <div>
            <p className="text-xl font-semibold">{listing.baths}</p>
            <p className="mt-1 text-xs text-white/60 sm:text-sm">Bathrooms</p>
          </div>
          <div>
            <p className="text-xl font-semibold">{listing.sqft.toLocaleString()}</p>
            <p className="mt-1 text-xs text-white/60 sm:text-sm">Square feet</p>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-xl font-semibold">About this property</h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-white/75">
            {listing.description}
          </p>
          {listing.tags.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Property tags">
              {listing.tags.map((tag) => (
                <li key={tag} className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70">
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {media.length > 1 && (
        <section className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <h2 className="mb-3 text-xl font-semibold text-white">Property gallery</h2>
          <ListingMediaCarousel options={{ loop: true }} media={media} />
        </section>
      )}

      <ReviewsSection listingId={listing.id} reviews={listing.reviews} />
    </main>
  );
}
