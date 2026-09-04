"use client";

import useEmblaCarousel from "embla-carousel-react";
import { Button } from "@/components/ui/button";
import {
  ArrowBigLeftDashIcon,
  ArrowBigRightDashIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ListingMediaCarouselProps } from "@/app/types";
import Image from "next/image";

const EmblaCarousel = (props: ListingMediaCarouselProps) => {
  const { media, options } = props;

  const [emblaRef, emblaApi] = useEmblaCarousel(options);

  return (
    <div className="relative">

      <div className="overflow-hidden" ref={emblaRef}>

        <div className="flex">

          {media.map((item, index) => (
            <div className="min-w-0 flex-[0_0_100%]" key={index}>
              {(() => {
                console.log("MEDIA ITEM:", item);
                switch (item.type) {
                  case "image":
                    return (
                      <Image
                        src={item.src}
                        alt={`Listing Image ${index + 1}`}
                        className="h-full w-full object-cover"
                        width={1200}
                        height={800}
                      />
                    );
 
                  case "gif":
                    return (

                      <img
                        src={item.src}
                        alt={`Listing GIF ${index + 1}`}
                        className="h-full w-full object-cover"
                        width={1200}
                        height={800}
                      />
                    );

                  case "video":
                    return (
                      <video
                        src={item.src}
                        className="h-full w-full object-cover"
                        autoPlay
                        muted
                        loop
                        playsInline
                        controls
                        preload="metadata"
                        disablePictureInPicture
                        disableRemotePlayback
                      />
                    );

                  default:
                    return null;
                }
              })()}
            </div>
          ))}
        </div>

      
      </div>

      <Button type="button" onClick={() => emblaApi?.scrollPrev()}>

        <HugeiconsIcon
          icon={ArrowBigLeftDashIcon}
          size={24}
        />

      </Button>

      <Button type="button" onClick={() => emblaApi?.scrollNext()}>
        <HugeiconsIcon
          icon={ArrowBigRightDashIcon}
          size={24}
        />
      </Button>
    </div>
  );
};

export default EmblaCarousel;