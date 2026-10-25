import { describe, expect, it } from "vite-plus/test";

import { isGifMediaSource } from "@/lib/media/media-source";

describe("GIF media source detection", () => {
  it("recognizes a plain GIF URL", () => {
    expect(isGifMediaSource("https://cdn.example.test/property-tour.gif")).toBe(true);
  });

  it("recognizes signed GIF URLs with query strings or fragments", () => {
    expect(
      isGifMediaSource("https://storage.example.test/tour.GIF?token=secret"),
    ).toBe(true);
    expect(isGifMediaSource("https://storage.example.test/tour.gif#frame")).toBe(true);
  });

  it("does not classify other image or video formats as GIFs", () => {
    expect(isGifMediaSource("https://cdn.example.test/photo.webp")).toBe(false);
    expect(isGifMediaSource("https://cdn.example.test/tour.mp4?token=secret")).toBe(false);
  });
});
