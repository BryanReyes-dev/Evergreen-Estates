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
