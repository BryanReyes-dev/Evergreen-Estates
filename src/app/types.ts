import { EmblaOptionsType } from "embla-carousel";

export interface User {
  id: string;
  name: string;
  email: string;
}

export type PublicUserData = Pick<User, "id" | "name"> & { image?: string | null };

export interface Houselisting {
  id: string;
  sellerUserId?: string | null;
  media: string[];
  tags: string[];
  title: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  address: string;
  description: string;
  created_at: string;
  reviews: Review[];
}

export interface Review {
  id: string;
  listing_id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
  user: PublicUserData;
}

export interface FeaturedCommunitiesProps {
  listings: Houselisting[];
}

export type ListingMedia = {
  type: "image" | "video";
  src: string;
  alt?: string;
};

export type ListingMediaCarouselProps = {
  media: ListingMedia[];
  options?: EmblaOptionsType;
};

export interface filters {
  price: [number, number] | null;
  tags: string[] | null;
  search: string | null;
}

export interface SearchParams {
  query?: string;
  price?: string;
  tag?: string | string[];
}
