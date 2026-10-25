import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { isGifMediaSource } from "@/lib/media/media-source";
import { ListingVideoPlayer } from "@/components/ListingVideoPlayer";

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

describe("listing video playback", () => {
  const baseProps = {
    src: "/listing-tour.mp4",
    label: "Property tour video",
    className: "w-full",
  };

  it("renders playable video controls when captions are absent", () => {
    const markup = renderToStaticMarkup(
      createElement(ListingVideoPlayer, baseProps),
    );

    expect(markup).toContain("<video");
    expect(markup).toContain('src="/listing-tour.mp4"');
    expect(markup).toContain('aria-label="Property tour video"');
    expect(markup).toContain("controls");
    expect(markup).not.toContain("<track");
  });

  it("renders autoplaying videos muted and looping when autoplay is enabled", () => {
    const markup = renderToStaticMarkup(
      createElement(ListingVideoPlayer, {
        ...baseProps,
        autoPlay: true,
        loop: true,
      }),
    );

    expect(markup).toContain("autoplay");
    expect(markup).toContain("muted");
    expect(markup).toContain("loop");
  });

  it("does not add autoplay attributes when autoplay is disabled", () => {
    const markup = renderToStaticMarkup(
      createElement(ListingVideoPlayer, baseProps),
    );

    expect(markup).not.toContain("autoplay");
  });

  it("adds an English caption track when a VTT URL is available", () => {
    const markup = renderToStaticMarkup(
      createElement(ListingVideoPlayer, {
        ...baseProps,
        captionSrc: "/listing-tour.vtt",
      }),
    );

    expect(markup).toContain("<track");
    expect(markup).toContain('src="/listing-tour.vtt"');
    expect(markup).toContain('label="English captions"');
  });
});
