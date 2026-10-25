import { describe, expect, it } from "vite-plus/test";

import { MAX_MEDIA_FILE_BYTES } from "@/lib/media/file-limits";

describe("listing media upload size limit", () => {
  it("enforces the documented 50,000,000-byte per-file limit", () => {
    expect(MAX_MEDIA_FILE_BYTES).toBe(50_000_000);
  });

  it("uses decimal megabytes rather than a 50 MiB binary limit", () => {
    expect(MAX_MEDIA_FILE_BYTES).toBe(50 * 1_000_000);
    expect(MAX_MEDIA_FILE_BYTES).not.toBe(50 * 1024 * 1024);
  });
});
