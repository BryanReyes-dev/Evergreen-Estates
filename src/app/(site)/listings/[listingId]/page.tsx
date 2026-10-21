import { getListingById } from "@/db/queries/listings";
import { headers } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { and, eq } from "drizzle-orm";
import { HugeiconsIcon } from "@hugeicons/react";
import { HeartIcon } from "@hugeicons/core-free-icons";
import { ListingMediaCarousel } from "@/components/ListingMediaCarousel";
import { getMediaType } from "@/db/supabase/util/MediaType";
import { ReviewsSection } from "@/components/ReviewsSection";
import { withAppUserTransaction } from "@/db/drizzle/app-client";
import { listings } from "@/db/schema";
import { getAuth } from "@/lib/auth";

async function canManageListingMedia(listingId: string): Promise<boolean> {
  try {
    const session = await getAuth().api.getSession({
      headers: await headers(),
    });

    if (!session?.user.id) return false;

    return withAppUserTransaction(session.user.id, async (tx) => {
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
    console.error("Could not verify listing media ownership:", error);
    return false;
  }
}

const ListingDetails = async ({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) => {
  const { listingId } = await params;
  const listing = await getListingById(listingId);

  if (!listing) {
    return <div>No listing details found.</div>;
  }

  const canManageMedia = await canManageListingMedia(listing.id);

  const averageRating =
    listing.reviews.length > 0
      ? listing.reviews.reduce((sum, review) => sum + review.rating, 0) /
        listing.reviews.length
      : 0;

  const media = listing.media.map((src) => ({
    type: getMediaType(src),
    src,
  }));

  const featuredMedia = media[0];

  return (
    <div>
      {featuredMedia ? (
        featuredMedia.type === "video" ? (
          <video
            src={featuredMedia.src}
            controls
            playsInline
            preload="metadata"
            className="h-auto w-full"
          />
        ) : (
          <Image
            src={featuredMedia.src}
            width={1200}
            height={800}
            alt={`${listing.title} Image`}
            className="h-auto w-full [mask-image:linear-gradient(to_bottom,rgba(0,0,0,1),rgba(0,0,0,0))]"
            priority
          />
        )
      ) : (
        <div className="aspect-[3/2] w-full bg-gray-200" />
      )}

      <div className="-0 left-0 flex flex-col justify-end p-2">
        <div className="flex items-center justify-between">
          <HugeiconsIcon size={35} icon={HeartIcon} />
          <h1 className="ml-2 flex justify-end bg-inherit font-lato text-[1.7rem] font-light text-white">
            ${listing.price.toLocaleString()}
          </h1>
        </div>

        <span className="flex justify-end font-kanit text-sm text-white">
          {averageRating.toFixed(1)}★
        </span>

        <h1 className="ml-2 bg-inherit font-maitree text-[1.7rem] text-white">
          {listing.title}
        </h1>
        <h1 className="ml-2 bg-inherit font-kanit text-[1rem] text-[#474848]">
          {listing.address}
        </h1>
        {canManageMedia && (
          <Link
            href={`/listings/${listing.id}/media`}
            className="ml-2 mt-4 inline-flex min-h-11 items-center rounded-full border border-[#78b75c]/60 bg-[#202324] px-5 text-sm font-medium text-white transition-colors hover:bg-[#78b75c]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]"
          >
            Manage listing media
          </Link>
        )}
        <p className="p-2 text-white">{listing.description}</p>
      </div>

      {media.length > 0 && (
        <ListingMediaCarousel options={{ loop: true }} media={media} />
      )}

      <ReviewsSection reviews={listing.reviews} />
    </div>
  );
};

export default ListingDetails;
