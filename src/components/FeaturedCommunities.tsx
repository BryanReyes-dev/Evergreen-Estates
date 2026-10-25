import type { Houselisting } from "@/app/types";
import Image from "next/image";

import Listing from "./Listing";

interface FeaturedCommunitiesProps {
  listings: Houselisting[];
}

const HOME_LISTING_IMAGE_SIZES =
  "(max-width: 519px) calc(100vw - 2rem), (max-width: 639px) calc((100vw - 3rem) / 2), (max-width: 1023px) calc((100vw - 4rem) / 2), (max-width: 1279px) calc((100vw - 6rem) / 3), 18.25rem";

const FeaturedCommunities = ({ listings }: FeaturedCommunitiesProps) => {
  return (
    <section className="mx-auto w-full min-w-0 max-w-7xl bg-[#141616] px-4 py-8 text-[#228100] sm:px-6 lg:px-8">
      <div className="mb-5 flex min-w-0 items-center gap-3">
        <Image
          src="/images/logo/evergreen_logo.png"
          alt="Evergreen Estates Logo"
          width={50}
          height={50}
          className="h-10 w-10 shrink-0 sm:h-12 sm:w-12"
        />
        <h2 className="min-w-0 break-words text-xl font-bold leading-tight sm:text-2xl md:text-4xl">
          Featured Communities
        </h2>
      </div>
      <div className="grid min-w-0 grid-cols-1 justify-items-center gap-4 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {listings.map((listing) => (
          <Listing key={listing.id} listing={listing} imageSizes={HOME_LISTING_IMAGE_SIZES} />
        ))}
      </div>
    </section>
  );
};

export default FeaturedCommunities;
