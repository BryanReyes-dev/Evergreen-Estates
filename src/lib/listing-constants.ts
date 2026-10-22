export const MIN_LISTING_PRICE = 10_000;
export const MAX_LISTING_PRICE = 10_000_000;

export const SUPPORTED_LISTING_TAGS = [
  "Swimming Pool",
  "Garage",
  "Basement",
  "Attic",
  "Fireplace",
  "Garden",
  "Balcony",
  "Patio",
  "Air Conditioning",
  "Heating System",
  "Hardwood Floors",
  "Carpeted Floors",
] as const;

export const SUPPORTED_LISTING_TAG_VALUES = SUPPORTED_LISTING_TAGS.map((tag) =>
  tag.toLowerCase(),
);
