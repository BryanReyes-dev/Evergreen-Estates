"use client";

import { motion } from "framer-motion";
import { Liquid } from "liquid-gooey";
import useEmblaCarousel from "embla-carousel-react";
import { CircleIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  ArrowBigLeftDashIcon,
  ArrowBigRightDashIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ListingMediaCarouselProps } from "@/app/types";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export const ListingMediaCarousel = ({
  media,
  options,
}: ListingMediaCarouselProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [indicatorX, setIndicatorX] = useState(0);
  const [emblaRef, emblaApi] = useEmblaCarousel(options);
  const paginationContainerRef = useRef<HTMLDivElement | null>(null);
  const paginationRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const liquidRef = useRef<HTMLDivElement | null>(null);
  const uiSize = 20;
  const indicatorSize = uiSize - 7;
  const arrowSize = uiSize + 9;

  const onSelect = () => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  };

  useEffect(() => {
    const selectedButton = paginationRefs.current[selectedIndex];
    const paginationContainer = paginationContainerRef.current;

    if (!selectedButton || !paginationContainer) return;

    const buttonRect = selectedButton.getBoundingClientRect();
    const containerRect = paginationContainer.getBoundingClientRect();

    const x =
      buttonRect.left -
      containerRect.left +
      buttonRect.width / 2 -
      indicatorSize / 2;

    setIndicatorX(x);
  }, [selectedIndex, indicatorSize]);

  useEffect(() => {
    if (!emblaApi) return;

    onSelect();
    emblaApi.on("select", onSelect);

    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  if (media.length === 0) return null;

  return (
    <div className="relative">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {media.map((item, index) => (
            <div className="min-w-0 flex-[0_0_100%]" key={`${item.src}-${index}`}>
              {item.type === "video" ? (
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
              ) : (
                <Image
                  src={item.src}
                  alt={item.alt ?? `Listing Image ${index + 1}`}
                  className="h-full w-full object-cover"
                  width={1200}
                  height={800}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between">
        <Button type="button" onClick={() => emblaApi?.scrollPrev()}>
          <HugeiconsIcon icon={ArrowBigLeftDashIcon} size={arrowSize} />
        </Button>

        <div
          ref={paginationContainerRef}
          className="relative flex items-center"
        >
          {media.map((_, index) => (
            <Button
              key={index}
              ref={(element) => {
                paginationRefs.current[index] = element;
              }}
              type="button"
              onClick={() => emblaApi?.scrollTo(index)}
              aria-label={`Go to listing media ${index + 1}`}
              aria-current={selectedIndex === index ? "true" : undefined}
            >
              <HugeiconsIcon
                icon={CircleIcon}
                size={uiSize}
                className={
                  selectedIndex === index ? "text-blue-500" : "text-gray-300"
                }
              />
            </Button>
          ))}

          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 flex items-center">
              <Liquid ref={liquidRef}>
                <Liquid.Item
                  effect="move"
                  move={{
                    springiness: 0.7,
                    wobble: 2,
                    stretch: 5,
                    trail: 4,
                  }}
                >
                  <motion.div
                    className="rounded-full bg-white"
                    animate={{ x: indicatorX }}
                    transition={{
                      type: "spring",
                      stiffness: 100,
                      damping: 10,
                    }}
                    style={{
                      height: `${indicatorSize}px`,
                      width: `${indicatorSize}px`,
                    }}
                  />
                </Liquid.Item>
              </Liquid>
            </div>
          </div>
        </div>

        <Button type="button" onClick={() => emblaApi?.scrollNext()}>
          <HugeiconsIcon icon={ArrowBigRightDashIcon} size={arrowSize} />
        </Button>
      </div>
    </div>
  );
};
