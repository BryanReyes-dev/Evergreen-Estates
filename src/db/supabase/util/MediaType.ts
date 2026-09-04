export const getMediaType = (src: string) => {
  const extension = src
    .split("?")[0]
    .split("#")[0]
    .split(".")
    .pop()
    ?.toLowerCase();

  if (extension === "gif") {
    return "gif";
  }

  if (["mp4", "webm"].includes(extension ?? "")) {
    return "video";
  }

  return "image";
};