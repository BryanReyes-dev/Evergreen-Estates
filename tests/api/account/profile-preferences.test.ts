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


describe("PATCH /api/v1/users/me/profile — save valid preferences", () => {
  it("writes preferences through the current user's transaction and returns the normalized profile", async () => {
    const preferences = { defaultSort: "price-high", viewMode: "list" };
    const updateReturning = vi.fn().mockResolvedValue([{ id: USER_ID }]);
    const updateWhere = vi.fn(() => ({ returning: updateReturning }));
    const updateSet = vi.fn(() => ({ where: updateWhere }));
    const update = vi.fn(() => ({ set: updateSet }));

    const accountRow = {
      name: "Example User",
      image: null,
      preferences,
    };
    const selectLimit = vi.fn().mockResolvedValue([accountRow]);
    const selectWhere = vi.fn(() => ({ limit: selectLimit }));
    const selectFrom = vi.fn(() => ({ where: selectWhere }));
    const select = vi.fn(() => ({ from: selectFrom }));

    mocks.withAppUserTransaction
      .mockImplementationOnce(async (userId, operation) => operation({ update }))
      .mockImplementationOnce(async (userId, operation) => operation({ select }));
    mocks.getUserAvatarUrl.mockResolvedValue(null);

    const response = await PATCH(request({ preferences }));

    expect(response.status).toBe(200);
    expect(await bodyOf(response)).toMatchObject({
      data: {
        name: "Example User",
        image: null,
        imageUrl: null,
        preferences,
      },
    });
    expect(mocks.withAppUserTransaction).toHaveBeenNthCalledWith(
      1,
      USER_ID,
      expect.any(Function),
    );
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      preferences,
      updatedAt: expect.any(String),
    }));
    expect(mocks.getUserAvatarUrl).toHaveBeenCalledWith({
      userId: USER_ID,
      image: null,
    });
  });
});
