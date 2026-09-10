import { getListingById } from "@/db/supabase/util/GetListingById";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { HeartIcon } from "@hugeicons/core-free-icons";
import { ListingMediaCarousel } from "@/components/ListingMediaCarousel";
import { getMediaType } from "@/db/supabase/util/MediaType";
import { ReviewsSection } from "@/components/ReviewsSection";

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
