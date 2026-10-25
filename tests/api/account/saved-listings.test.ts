import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  getAuthenticatedUserId: vi.fn(),
  withAppUserTransaction: vi.fn(),
}));

vi.mock("@/lib/api/get-authenticated-user-id", () => ({ getAuthenticatedUserId: mocks.getAuthenticatedUserId }));
vi.mock("@/db/drizzle/app-client", () => ({ withAppUserTransaction: mocks.withAppUserTransaction }));
vi.mock("server-only", () => ({}));

import { GET, PATCH } from "@/app/api/v1/users/me/saved-listings/route";

const USER_ID = "22222222-2222-4222-8222-222222222222";
const LISTING_ID = "11111111-1111-4111-8111-111111111111";
const URL = "http://localhost/api/v1/users/me/saved-listings";

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

describe("GET /api/v1/users/me/saved-listings — private saved-home reads", () => {
  it("requires authentication and does not open an app transaction", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);
    const response = await GET(new Request(URL));

    expect(response.status).toBe(401);
    expect(errorCode(await bodyOf(response))).toBe("UNAUTHENTICATED");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/v1/users/me/saved-listings — owner-bound save state", () => {
  it("requires authentication", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);
    const response = await PATCH(request({ listingId: LISTING_ID, saved: true }));

    expect(response.status).toBe(401);
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const response = await PATCH(new Request(URL, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: "{",
    }));

    expect(response.status).toBe(400);
    expect(errorCode(await bodyOf(response))).toBe("INVALID_JSON");
  });

  it("rejects caller-supplied user IDs or complete saved arrays", async () => {
    const response = await PATCH(request({
      listingId: LISTING_ID,
      saved: true,
      userId: "another-user",
      savedListingIds: [LISTING_ID],
    }));

    expect(response.status).toBe(400);
    expect(errorCode(await bodyOf(response))).toBe("UNSUPPORTED_FIELD");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("requires a valid listing UUID and an explicit boolean saved state", async () => {
    const invalidId = await PATCH(request({ listingId: "../../listing", saved: true }));
    expect(invalidId.status).toBe(400);
    expect(errorCode(await bodyOf(invalidId))).toBe("INVALID_LISTING_ID");

    const invalidState = await PATCH(request({ listingId: LISTING_ID, saved: "true" }));
    expect(invalidState.status).toBe(400);
    expect(errorCode(await bodyOf(invalidState))).toBe("INVALID_SAVED_STATE");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });
});
