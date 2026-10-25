import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  getAuthenticatedUserId: vi.fn(),
  withAppUserTransaction: vi.fn(),
  uploadListingMediaCaptions: vi.fn(),
}));

vi.mock("@/lib/api/get-authenticated-user-id", () => ({
  getAuthenticatedUserId: mocks.getAuthenticatedUserId,
}));
vi.mock("@/db/drizzle/app-client", () => ({
  withAppUserTransaction: mocks.withAppUserTransaction,
}));
vi.mock("@/db/supabase/storage-admin", () => ({
  isAllowedListingMediaFilename: (filename: string) =>
    /^[a-zA-Z0-9][a-zA-Z0-9 ._()-]*\.(jpg|png|webp|avif|gif|mp4|webm|mov)$/i.test(filename),
  uploadListingMediaCaptions: mocks.uploadListingMediaCaptions,
}));
vi.mock("server-only", () => ({}));

import { POST } from "@/app/api/v1/listings/[id]/media/[filename]/captions/route";

const USER_ID = "22222222-2222-4222-8222-222222222222";
const LISTING_ID = "11111111-1111-4111-8111-111111111111";
const VIDEO_FILENAME = "44444444-4444-4444-8444-444444444444.mp4";
const URL = `http://localhost/api/v1/listings/${LISTING_ID}/media/${VIDEO_FILENAME}/captions`;
const VALID_VTT = [
  "WEBVTT",
  "",
  "00:00:01.000 --> 00:00:03.000",
  "Welcome to the property tour.",
  "",
].join("\n");

function requestWithFile(
  filename = "tour.vtt",
  content = VALID_VTT,
): Request {
  const formData = new FormData();
  formData.set("file", new File([content], filename, { type: "text/vtt" }));
  return new Request(URL, { method: "POST", body: formData });
}

function mockListing(media: string[]) {
  const limit = vi.fn().mockResolvedValue([{ id: LISTING_ID, media }]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  mocks.withAppUserTransaction.mockImplementation(
    async (_userId, operation) => operation({ select } as never),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthenticatedUserId.mockResolvedValue(USER_ID);
  mockListing([VIDEO_FILENAME]);
  mocks.uploadListingMediaCaptions.mockResolvedValue({ filename: "44444444-4444-4444-8444-444444444444.vtt" });
});

describe("POST listing media captions", () => {
  it("requires authentication before database or Storage access", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);

    const response = await POST(requestWithFile(), {
      params: Promise.resolve({ id: LISTING_ID, filename: VIDEO_FILENAME }),
    });

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
    expect(mocks.uploadListingMediaCaptions).not.toHaveBeenCalled();
  });

  it("rejects invalid WebVTT content before checking listing ownership", async () => {
    const response = await POST(requestWithFile("tour.vtt", "not WebVTT"), {
      params: Promise.resolve({ id: LISTING_ID, filename: VIDEO_FILENAME }),
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_CAPTION_FILE");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
    expect(mocks.uploadListingMediaCaptions).not.toHaveBeenCalled();
  });

  it("rejects captions for a video that is not registered on the user's listing", async () => {
    mockListing([]);

    const response = await POST(requestWithFile(), {
      params: Promise.resolve({ id: LISTING_ID, filename: VIDEO_FILENAME }),
    });

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("MEDIA_NOT_FOUND");
    expect(mocks.uploadListingMediaCaptions).not.toHaveBeenCalled();
  });

  it("stores captions only after validating the owner's registered video", async () => {
    const response = await POST(requestWithFile(), {
      params: Promise.resolve({ id: LISTING_ID, filename: VIDEO_FILENAME }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      data: {
        listingId: LISTING_ID,
        videoFilename: VIDEO_FILENAME,
        filename: "44444444-4444-4444-8444-444444444444.vtt",
        uploaded: true,
      },
    });
    expect(mocks.uploadListingMediaCaptions).toHaveBeenCalledWith({
      listingId: LISTING_ID,
      videoFilename: VIDEO_FILENAME,
      content: VALID_VTT,
      size: new TextEncoder().encode(VALID_VTT).byteLength,
    });
  });
});
