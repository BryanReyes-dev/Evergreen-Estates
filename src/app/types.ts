import { EmblaOptionsType } from "embla-carousel";

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Houselisting {
  id: string;
  media: string[];
  tags: string[];
  title: string;
  price: number;
  stars: number;
  beds: number;
  baths: number;
  sqft: number;
  address: string;
  description: string;
  created_at: string;
  seller: string;
  reviews: Review[];
}

export interface Review {
  id: string;
  listing_id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
  user: User;
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

