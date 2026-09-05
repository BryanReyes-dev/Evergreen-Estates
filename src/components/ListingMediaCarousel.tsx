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
import { useEffect, useState, useRef } from "react";

export const ListingMediaCarousel = (props: ListingMediaCarouselProps) => {
  const { media, options } = props;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [indicatorX, setIndicatorX] = useState(0);
  const [emblaRef, emblaApi] = useEmblaCarousel(options);
  const paginationContainerRef = useRef<HTMLDivElement | null>(null);
  const paginationRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const liquidRef = useRef<HTMLDivElement | null>(null);
  const ui_size = 20; // Size of the pagination buttons
  const indicatorSize = ui_size - 7;
  const arrowSize = ui_size + 9; // Size of the arrow buttons
  
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
  }, [selectedIndex]);


  useEffect(() => {
      if (!emblaApi) return;

      onSelect();
      emblaApi.on("select", onSelect);

      return () => {
        emblaApi.off("select", onSelect);
      };
  }, [emblaApi]);
 

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


      <div className= " flex justify-between " >
        <Button type="button" onClick={() => emblaApi?.scrollPrev()}>

          <HugeiconsIcon
            icon={ArrowBigLeftDashIcon}
            size={arrowSize}
          />

        </Button>

    
        <div  ref={paginationContainerRef} className=" relative flex items-center  ">
          
          {media.map((_, index) => (
            <Button 
              key={index} 
              ref={(element) => {
                paginationRefs.current[index] = element;
              }}
              type="button"
              onClick={() => emblaApi?.scrollTo(index)
              }>
              <HugeiconsIcon
                icon={CircleIcon}
                size={ui_size}
                className={selectedIndex === index ? "text-blue-500" : "text-gray-300"}
              />
            </Button>
          ))}
        


          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 flex items-center">
              <Liquid ref={liquidRef}>
                <Liquid.Item
                  effect="move"
                  move={{
                    springiness: .7,
                    wobble: 2,
                    stretch: 5,
                    trail: 4,
                  }}
                >
                  <motion.div
                    className=" rounded-full bg-white"
                    animate={{ x: indicatorX }}
                    transition={{
                      type: "spring",
                      stiffness: 100,
                      damping: 10,
                    }}
                    style={{ height: `${indicatorSize}px`, width: `${indicatorSize}px` }}
                  />
                </Liquid.Item>
              </Liquid>
            </div>
          </div>


        </div>
          
        <Button type="button" onClick={() => emblaApi?.scrollNext()}>
          <HugeiconsIcon
            icon={ArrowBigRightDashIcon}
            size={arrowSize}
          />
        </Button>
      </div>

      
    </div>
  );
};

