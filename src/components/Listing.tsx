import Link from "next/link";
import Image from "next/image";
import { Houselisting } from "@/app/types";
import { getMediaType } from "@/db/supabase/util/MediaType";

export interface ListingProps {
  listing: Pick<
    Houselisting,
    "id" | "media" | "title" | "price" | "description"
  >;
}

const Listing = ({ listing }: ListingProps) => {
  const featuredMedia = listing.media[0];
  const featuredMediaType = featuredMedia
    ? getMediaType(featuredMedia)
    : null;

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="m-4 block max-w-[25rem] overflow-hidden rounded-lg bg-[#202324] shadow-md"
    >
      <div className="relative aspect-[4/3] w-full">
        {featuredMedia && featuredMediaType === "video" ? (
          <video
            src={featuredMedia}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
            aria-label={`${listing.title} video`}
          />
        ) : featuredMedia ? (
          <Image
            src={featuredMedia}
            alt={`${listing.title} Image`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25rem"
            className="w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-[#3A3F42]" aria-label="No listing media" />
        )}
      </div>

      <div className="p-4">
        <h2 className="mb-2 text-xl font-semibold">{listing.title}</h2>

        <span className="font-bold text-green-600">
          ${listing.price.toLocaleString()}
        </span>

        <p className="text-sm text-white">{listing.description}</p>
      </div>
    </Link>
  );
};

export default Listing;
