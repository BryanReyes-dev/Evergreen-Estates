import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  getAuthenticatedUserId: vi.fn(),
  withAppUserTransaction: vi.fn(),
  getUserAvatarUrl: vi.fn(),
}));

vi.mock("@/lib/api/get-authenticated-user-id", () => ({ getAuthenticatedUserId: mocks.getAuthenticatedUserId }));
vi.mock("@/db/drizzle/app-client", () => ({ withAppUserTransaction: mocks.withAppUserTransaction }));
vi.mock("@/db/supabase/storage-admin", () => ({ getUserAvatarUrl: mocks.getUserAvatarUrl }));
vi.mock("server-only", () => ({}));

import { GET, PATCH } from "@/app/api/v1/users/me/profile/route";

const USER_ID = "22222222-2222-4222-8222-222222222222";
const URL = "http://localhost/api/v1/users/me/profile";

type ApiBody = { error?: string | { code?: string; message?: string }; data?: unknown };
async function bodyOf(response: Response): Promise<ApiBody> {
  return response.json() as Promise<ApiBody>;
}
function errorCode(body: ApiBody) {
  return typeof body.error === "string" ? body.error : body.error?.code;
}
function request(body: unknown, method = "PATCH") {
  return new Request(URL, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthenticatedUserId.mockResolvedValue(USER_ID);
});

describe("/api/v1/users/me/profile — account preferences", () => {
  it("requires authentication for private profile settings", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);
    const response = await GET(new Request(URL));

    expect(response.status).toBe(401);
    expect(errorCode(await bodyOf(response))).toBe("UNAUTHENTICATED");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("rejects preference writes for unauthenticated users", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);
    const response = await PATCH(request({
      preferences: { defaultSort: "newest", viewMode: "grid" },
    }));

    expect(response.status).toBe(401);
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("does not allow callers to patch identity fields through the preferences endpoint", async () => {
    const response = await PATCH(request({
      preferences: { defaultSort: "newest", viewMode: "grid" },
      name: "Unexpected name update",
    }));

    expect(response.status).toBe(400);
    expect(errorCode(await bodyOf(response))).toBe("UNSUPPORTED_FIELD");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("rejects unsupported sorting and layout preferences", async () => {
    const response = await PATCH(request({
      preferences: { defaultSort: "recent-first", viewMode: "tiles" },
    }));

    expect(response.status).toBe(400);
    expect(errorCode(await bodyOf(response))).toBe("INVALID_PREFERENCES");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("requires exactly both supported preference keys", async () => {
    const missingKey = await PATCH(request({
      preferences: { defaultSort: "newest" },
    }));
    expect(missingKey.status).toBe(400);
    expect(errorCode(await bodyOf(missingKey))).toBe("INVALID_PREFERENCES");

    const extraKey = await PATCH(request({
      preferences: { defaultSort: "newest", viewMode: "grid", ownerId: USER_ID },
    }));
    expect(extraKey.status).toBe(400);
    expect(errorCode(await bodyOf(extraKey))).toBe("INVALID_PREFERENCES");
  });
});
