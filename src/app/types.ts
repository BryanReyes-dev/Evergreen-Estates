import { EmblaOptionsType } from "embla-carousel";

export interface Houselisting {
  id: string;
  images: string[];
  tags: string[];
  title: string;
  price: number;
  stars: number;
  beds: number;
  baths: number;
  sqft: number;
  address: string;
  description: string;
  seller: string;
}

export interface FeaturedCommunitiesProps {
    listings: Houselisting[]
}

export type ListingMedia = {
  type: "image" | "gif" | "video";
  src: string;
  alt?: string;
};
export  type ListingMediaCarouselProps = {
  media: ListingMedia[];
  options?: EmblaOptionsType;
};

export interface filters {
    price: [number, number] | null
    tags: string[] | null
    search: string | null
}

export interface SearchParams {
    query?: string;
    price?: string;
    tag?: string | string[];
}

