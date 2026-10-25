import Link from "next/link";
import Image from "next/image";
import { Houselisting } from "@/app/types";
import { getMediaType } from "@/db/supabase/util/MediaType";
import { SaveListingButton } from "@/components/SaveListingButton";

export interface ListingProps {
  listing: Pick<
    Houselisting,
    "id" | "sellerUserId" | "media" | "title" | "price" | "description"
  >;
}

const Listing = ({ listing }: ListingProps) => {
  const featuredMedia = listing.media[0];
  const featuredMediaType = featuredMedia
    ? getMediaType(featuredMedia)
    : null;

  return (
    <article className="relative m-0 block w-full max-w-[25rem] overflow-hidden rounded-lg bg-[#202324] shadow-md">
      <div className="absolute right-3 top-3 z-10"><SaveListingButton listingId={listing.id} /></div>
      <Link href={`/listings/${listing.id}`} className="block">
      <div className="relative aspect-[4/3] w-full">
        {featuredMedia && featuredMediaType === "video" ? (
          <video
            src={featuredMedia}
            muted
            playsInline
            preload="metadata"
            tabIndex={-1}
            className="h-full w-full object-cover"
            aria-hidden="true"
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
          <div aria-hidden="true" className="h-full w-full bg-[#3A3F42]" />
        )}
      </div>

      <div className="p-4">
        <h2 className="mb-2 break-words text-xl font-semibold">{listing.title}</h2>

        <span className="font-bold text-green-600">
          ${listing.price.toLocaleString()}
        </span>

        <p className="break-words text-sm text-white">{listing.description}</p>
      </div>
      </Link>
      {listing.sellerUserId && (
        <div className="border-t border-white/10 px-4 py-3">
          <Link
            href={"/sellers/" + encodeURIComponent(listing.sellerUserId)}
            className="inline-flex min-h-10 items-center text-sm font-medium text-[#a6d78f] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]"
          >
            View seller profile
          </Link>
        </div>
      )}
    </article>
  );
};

export default Listing;
