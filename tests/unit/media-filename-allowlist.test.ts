import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

import { isAllowedListingMediaFilename } from "@/db/supabase/storage-admin";

describe("listing media filename allowlist", () => {
  it("accepts every supported image and video extension", () => {
    for (const filename of [
      "front.jpg",
      "plan.png",
      "living-room.webp",
      "cover.avif",
      "tour.gif",
      "tour.mp4",
      "tour.webm",
      "tour.mov",
    ]) {
      expect(isAllowedListingMediaFilename(filename), filename).toBe(true);
    }
  });

  it("preserves safe legacy filenames with spaces and parentheses", () => {
    expect(isAllowedListingMediaFilename("house tour (1).gif")).toBe(true);
  });

  it("rejects empty names, dot segments, and hidden extension-only names", () => {
    for (const filename of ["", ".", "..", ".jpg"]) {
      expect(isAllowedListingMediaFilename(filename), JSON.stringify(filename)).toBe(false);
    }
  });

  it("rejects path traversal and nested paths", () => {
    for (const filename of [
      "../secret.jpg",
      "folder/photo.jpg",
      "folder\\photo.jpg",
      "listings/123/photo.jpg",
    ]) {
      expect(isAllowedListingMediaFilename(filename), filename).toBe(false);
    }
  });

  it("rejects unsupported types, query-like characters, and control characters", () => {
    for (const filename of [
      "payload.svg",
      "payload.html",
      "photo.jpg?download=1",
      "photo?.jpg",
      "photo\n.jpg",
      "photo\u0000.jpg",
    ]) {
      expect(isAllowedListingMediaFilename(filename), filename).toBe(false);
    }
  });

  it("rejects filenames longer than 255 characters and accepts the boundary", () => {
    expect(isAllowedListingMediaFilename("a".repeat(251) + ".jpg")).toBe(true);
    expect(isAllowedListingMediaFilename("a".repeat(252) + ".jpg")).toBe(false);
  });
});
