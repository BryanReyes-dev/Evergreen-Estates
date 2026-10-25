import { describe, expect, it } from "vite-plus/test";

import {
  captionFilenameForVideo,
  MAX_CAPTION_FILE_BYTES,
  validateWebVttCaptionFile,
} from "@/lib/media/captions";

const validCaptions = [
  "WEBVTT",
  "",
  "00:00:01.000 --> 00:00:03.000",
  "Welcome to the property tour.",
  "",
].join("\n");

function fileMetadata(name: string, content: string) {
  return {
    name,
    size: new TextEncoder().encode(content).byteLength,
  };
}

describe("listing video captions", () => {
  it("accepts valid WebVTT captions with at least one timed cue", () => {
    expect(
      validateWebVttCaptionFile(fileMetadata("tour.vtt", validCaptions), validCaptions),
    ).toBeNull();
  });

  it("maps each supported video extension to a companion VTT filename", () => {
    expect(captionFilenameForVideo("tour.mp4")).toBe("tour.vtt");
    expect(captionFilenameForVideo("tour.webm")).toBe("tour.vtt");
    expect(captionFilenameForVideo("tour.mov")).toBe("tour.vtt");
    expect(captionFilenameForVideo("photo.jpg")).toBeNull();
  });

  it("rejects files that are not WebVTT captions", () => {
    expect(
      validateWebVttCaptionFile(fileMetadata("tour.txt", validCaptions), validCaptions),
    ).toContain(".vtt");
    expect(
      validateWebVttCaptionFile(fileMetadata("tour.vtt", "not a caption file"), "not a caption file"),
    ).toContain("WEBVTT header");
  });

  it("rejects WebVTT files without a timed caption cue", () => {
    const noCue = "WEBVTT\n\nThis file contains no timed captions.\n";
    expect(
      validateWebVttCaptionFile(fileMetadata("tour.vtt", noCue), noCue),
    ).toContain("caption cue");
  });

  it("rejects caption files over the one-megabyte limit", () => {
    const oversized = "x".repeat(MAX_CAPTION_FILE_BYTES + 1);
    expect(
      validateWebVttCaptionFile(fileMetadata("tour.vtt", oversized), oversized),
    ).toContain("no larger than");
  });
});
