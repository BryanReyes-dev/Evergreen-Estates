import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthenticatedUserId: vi.fn(),
  withAppUserTransaction: vi.fn(),
  createListingMediaUpload: vi.fn(),
  inspectListingMediaObject: vi.fn(),
}));

vi.mock("@/lib/api/get-authenticated-user-id", () => ({ getAuthenticatedUserId: mocks.getAuthenticatedUserId }));
vi.mock("@/db/drizzle/app-client", () => ({ withAppUserTransaction: mocks.withAppUserTransaction }));
vi.mock("@/db/supabase/storage-admin", () => ({
  createListingMediaUpload: mocks.createListingMediaUpload,
  inspectListingMediaObject: mocks.inspectListingMediaObject,
}));
vi.mock("server-only", () => ({}));

import { POST as createUpload } from "@/app/api/v1/listings/[id]/media/upload-url/route";
import { POST as completeUpload } from "@/app/api/v1/listings/[id]/media/complete/route";
import { MAX_MEDIA_FILE_BYTES } from "@/lib/media/file-limits";

const USER_ID = "22222222-2222-4222-8222-222222222222";
const LISTING_ID = "11111111-1111-4111-8111-111111111111";
const URL = "http://localhost/api/v1/listings/" + LISTING_ID + "/media";

type ApiBody = { error?: string | { code?: string; message?: string }; data?: unknown };
async function bodyOf(response: Response): Promise<ApiBody> {
  return response.json() as Promise<ApiBody>;
}
function errorCode(body: ApiBody) {
  return typeof body.error === "string" ? body.error : body.error?.code;
}
function request(url: string, method: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthenticatedUserId.mockResolvedValue(USER_ID);
});

describe("POST listing media upload-url — validate before Storage access", () => {
  it("requires an authenticated user", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);
    const response = await createUpload(request(URL + "/upload-url", "POST", {
      contentType: "image/jpeg",
      size: 100,
    }), { params: Promise.resolve({ id: LISTING_ID }) });

    expect(response.status).toBe(401);
    expect(errorCode(await bodyOf(response))).toBe("UNAUTHENTICATED");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
    expect(mocks.createListingMediaUpload).not.toHaveBeenCalled();
  });

  it("rejects an invalid listing UUID before database access", async () => {
    const response = await createUpload(request("http://localhost/api/v1/listings/bad/media/upload-url", "POST", {
      contentType: "image/jpeg",
      size: 100,
    }), { params: Promise.resolve({ id: "bad" }) });

    expect(response.status).toBe(400);
    expect(errorCode(await bodyOf(response))).toBe("INVALID_LISTING_ID");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("rejects unsupported content types", async () => {
    const response = await createUpload(request(URL + "/upload-url", "POST", {
      contentType: "text/html",
      size: 100,
    }), { params: Promise.resolve({ id: LISTING_ID }) });

    expect(response.status).toBe(415);
    expect(errorCode(await bodyOf(response))).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("rejects invalid sizes and oversized media before requesting an upload", async () => {
    for (const size of [0, -1, 1.5]) {
      const invalid = await createUpload(request(URL + "/upload-url", "POST", {
        contentType: "image/jpeg",
        size,
      }), { params: Promise.resolve({ id: LISTING_ID }) });
      expect(invalid.status).toBe(400);
      expect(errorCode(await bodyOf(invalid))).toBe("INVALID_MEDIA_SIZE");
    }

    const oversized = await createUpload(request(URL + "/upload-url", "POST", {
      contentType: "video/mp4",
      size: MAX_MEDIA_FILE_BYTES + 1,
    }), { params: Promise.resolve({ id: LISTING_ID }) });

    expect(oversized.status).toBe(413);
    expect(errorCode(await bodyOf(oversized))).toBe("MEDIA_TOO_LARGE");
    expect(mocks.createListingMediaUpload).not.toHaveBeenCalled();
  });
});

describe("POST listing media complete — media path binding", () => {
  it("requires authentication before checking ownership or inspecting Storage", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);
    const response = await completeUpload(request(URL + "/complete", "POST", {
      path: "listings/" + LISTING_ID + "/44444444-4444-4444-8444-444444444444.jpg",
    }), { params: Promise.resolve({ id: LISTING_ID }) });

    expect(response.status).toBe(401);
    expect(errorCode(await bodyOf(response))).toBe("UNAUTHENTICATED");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
    expect(mocks.inspectListingMediaObject).not.toHaveBeenCalled();
  });

  it("rejects traversal and paths belonging to another listing", async () => {
    const traversal = await completeUpload(request(URL + "/complete", "POST", {
      path: "listings/" + LISTING_ID + "/../avatar.jpg",
    }), { params: Promise.resolve({ id: LISTING_ID }) });
    expect(traversal.status).toBe(400);
    expect(errorCode(await bodyOf(traversal))).toBe("INVALID_MEDIA_PATH");

    const otherListing = await completeUpload(request(URL + "/complete", "POST", {
      path: "listings/33333333-3333-4333-8333-333333333333/44444444-4444-4444-8444-444444444444.jpg",
    }), { params: Promise.resolve({ id: LISTING_ID }) });
    expect(otherListing.status).toBe(400);
    expect(errorCode(await bodyOf(otherListing))).toBe("INVALID_MEDIA_PATH");
    expect(mocks.inspectListingMediaObject).not.toHaveBeenCalled();
  });
});


describe("POST listing media upload-url — authorized upload preparation", () => {
  it("issues a bounded upload only after verifying listing ownership", async () => {
    const selectLimit = vi.fn().mockResolvedValue([{ id: LISTING_ID }]);
    const selectWhere = vi.fn(() => ({ limit: selectLimit }));
    const selectFrom = vi.fn(() => ({ where: selectWhere }));
    const select = vi.fn(() => ({ from: selectFrom }));
    const upload = {
      path: "listings/" + LISTING_ID + "/44444444-4444-4444-8444-444444444444.jpg",
      token: "mock-upload-token",
      contentType: "image/jpeg",
      mediaKind: "image",
    };
    mocks.createListingMediaUpload.mockResolvedValue(upload);
    mocks.withAppUserTransaction.mockImplementation(
      async (_userId, operation) => operation({ select }),
    );

    const response = await createUpload(request(URL + "/upload-url", "POST", {
      contentType: "image/jpeg",
      size: 1024,
    }), { params: Promise.resolve({ id: LISTING_ID }) });

    expect(response.status).toBe(201);
    expect(await bodyOf(response)).toMatchObject({
      data: {
        bucket: "property-images",
        path: upload.path,
        token: upload.token,
        contentType: "image/jpeg",
        mediaKind: "image",
        uploadMethod: "standard",
      },
    });
    expect(mocks.withAppUserTransaction).toHaveBeenCalledWith(
      USER_ID,
      expect.any(Function),
    );
    expect(mocks.createListingMediaUpload).toHaveBeenCalledWith({
      listingId: LISTING_ID,
      contentType: "image/jpeg",
    });
  });
});
