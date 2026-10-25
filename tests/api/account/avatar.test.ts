import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  getAuthenticatedUserId: vi.fn(),
  withAppUserTransaction: vi.fn(),
  deleteUserAvatarObject: vi.fn(),
  getUserAvatarUrl: vi.fn(),
  uploadUserAvatar: vi.fn(),
}));

vi.mock("@/lib/api/get-authenticated-user-id", () => ({ getAuthenticatedUserId: mocks.getAuthenticatedUserId }));
vi.mock("@/db/drizzle/app-client", () => ({ withAppUserTransaction: mocks.withAppUserTransaction }));
vi.mock("@/db/supabase/storage-admin", () => ({
  deleteUserAvatarObject: mocks.deleteUserAvatarObject,
  getUserAvatarUrl: mocks.getUserAvatarUrl,
  MAX_USER_AVATAR_BYTES: 5 * 1024 * 1024,
  uploadUserAvatar: mocks.uploadUserAvatar,
}));
vi.mock("server-only", () => ({}));

import { POST, DELETE } from "@/app/api/v1/users/me/avatar/route";

const USER_ID = "22222222-2222-4222-8222-222222222222";
const URL = "http://localhost/api/v1/users/me/avatar";

type ApiBody = { error?: string | { code?: string; message?: string }; data?: unknown };
async function bodyOf(response: Response): Promise<ApiBody> {
  return response.json() as Promise<ApiBody>;
}
function errorCode(body: ApiBody) {
  return typeof body.error === "string" ? body.error : body.error?.code;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthenticatedUserId.mockResolvedValue(USER_ID);
});

describe("POST /api/v1/users/me/avatar — safe avatar upload validation", () => {
  it("requires authentication before reading multipart data", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);
    const response = await POST(new Request(URL, { method: "POST" }));

    expect(response.status).toBe(401);
    expect(errorCode(await bodyOf(response))).toBe("UNAUTHENTICATED");
    expect(mocks.uploadUserAvatar).not.toHaveBeenCalled();
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("rejects a non-multipart request", async () => {
    const response = await POST(new Request(URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }));

    expect(response.status).toBe(400);
    expect(errorCode(await bodyOf(response))).toBe("INVALID_MULTIPART_FORM");
    expect(mocks.uploadUserAvatar).not.toHaveBeenCalled();
  });

  it("rejects a missing avatar file", async () => {
    const form = new FormData();
    const response = await POST(new Request(URL, { method: "POST", body: form }));

    expect(response.status).toBe(400);
    expect(errorCode(await bodyOf(response))).toBe("AVATAR_REQUIRED");
    expect(mocks.uploadUserAvatar).not.toHaveBeenCalled();
  });

  it("rejects a fake image signature even when the filename and content type claim PNG", async () => {
    const form = new FormData();
    form.set("file", new File(["this is not an image"], "avatar.png", { type: "image/png" }));
    const response = await POST(new Request(URL, { method: "POST", body: form }));

    expect(response.status).toBe(400);
    expect(errorCode(await bodyOf(response))).toBe("INVALID_AVATAR_TYPE");
    expect(mocks.uploadUserAvatar).not.toHaveBeenCalled();
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/v1/users/me/avatar — restore the initials avatar", () => {
  it("requires authentication before deleting profile media", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);
    const response = await DELETE(new Request(URL, { method: "DELETE" }));

    expect(response.status).toBe(401);
    expect(errorCode(await bodyOf(response))).toBe("UNAUTHENTICATED");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
    expect(mocks.deleteUserAvatarObject).not.toHaveBeenCalled();
  });
});


describe("POST /api/v1/users/me/avatar — successful validated upload", () => {
  it("accepts a matching JPEG signature and attaches the uploaded path to the authenticated account", async () => {
    const uploadedPath = "avatars/" + USER_ID + "/avatar.jpg";
    const uploadedBytes = new Uint8Array([0xff, 0xd8, 0xff]);
    mocks.uploadUserAvatar.mockResolvedValue(uploadedPath);
    mocks.getUserAvatarUrl.mockResolvedValue("https://example.test/signed-avatar");

    const selectForUpdate = vi.fn().mockResolvedValue([{ image: null }]);
    const selectLimit = vi.fn(() => ({ for: selectForUpdate }));
    const selectWhere = vi.fn(() => ({ limit: selectLimit }));
    const selectFrom = vi.fn(() => ({ where: selectWhere }));
    const select = vi.fn(() => ({ from: selectFrom }));

    const updateReturning = vi.fn().mockResolvedValue([{ image: uploadedPath }]);
    const updateWhere = vi.fn(() => ({ returning: updateReturning }));
    const updateSet = vi.fn(() => ({ where: updateWhere }));
    const update = vi.fn(() => ({ set: updateSet }));

    mocks.withAppUserTransaction.mockImplementation(
      async (userId, operation) => operation({ select, update }),
    );

    const form = new FormData();
    form.set("file", new File([uploadedBytes], "avatar.jpg", { type: "image/jpeg" }));

    const response = await POST(new Request(URL, { method: "POST", body: form }));

    expect(response.status).toBe(200);
    expect(await bodyOf(response)).toMatchObject({
      data: {
        image: uploadedPath,
        imageUrl: "https://example.test/signed-avatar",
      },
    });
    expect(mocks.uploadUserAvatar).toHaveBeenCalledWith({
      userId: USER_ID,
      contentType: "image/jpeg",
      bytes: uploadedBytes,
    });
    expect(mocks.withAppUserTransaction).toHaveBeenCalledWith(
      USER_ID,
      expect.any(Function),
    );
    expect(mocks.deleteUserAvatarObject).not.toHaveBeenCalled();
  });
});
