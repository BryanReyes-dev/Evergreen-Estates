export type ListingMediaType = "image" | "video";

export const getMediaType = (src: string): ListingMediaType => {
  const extension = src
    .split("?")[0]
    .split("#")[0]
    .split(".")
    .pop()
    ?.toLowerCase();

  if (["mp4", "webm", "mov"].includes(extension ?? "")) {
    return "video";
  }

  return "image";
};
