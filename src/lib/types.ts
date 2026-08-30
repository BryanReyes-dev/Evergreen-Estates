export  default interface Houselisting {
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
};
