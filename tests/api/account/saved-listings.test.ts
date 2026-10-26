import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  getAuthenticatedUserId: vi.fn(),
  withAppUserTransaction: vi.fn(),
  getDrizzleDb: vi.fn(),
}));

vi.mock("@/lib/api/get-authenticated-user-id", () => ({ getAuthenticatedUserId: mocks.getAuthenticatedUserId }));
vi.mock("@/db/drizzle/app-client", () => ({ withAppUserTransaction: mocks.withAppUserTransaction }));
vi.mock("@/db/drizzle/client", () => ({ getDrizzleDb: mocks.getDrizzleDb }));
vi.mock("server-only", () => ({}));

import { GET, PATCH } from "@/app/api/v1/users/me/saved-listings/route";

const USER_ID = "22222222-2222-4222-8222-222222222222";
const LISTING_ID = "11111111-1111-4111-8111-111111111111";
const URL = "http://localhost/api/v1/users/me/saved-listings";

type ApiBody = { error?: string | { code?: string; message?: string }; data?: unknown; diagnostics?: Record<string, unknown> };
async function bodyOf(response: Response): Promise<ApiBody> {
  return response.json() as Promise<ApiBody>;
}
function errorCode(body: ApiBody) {
  return typeof body.error === "string" ? body.error : body.error?.code;
}
function request(body: unknown, method = "PATCH") {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (method !== "GET" && method !== "HEAD") init.body = JSON.stringify(body);
  return new Request(URL, init);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthenticatedUserId.mockResolvedValue(USER_ID);
  const readLimit = vi.fn().mockResolvedValue([]);
  const readWhere = vi.fn(() => ({ limit: readLimit }));
  const readFrom = vi.fn(() => ({ where: readWhere }));
  mocks.getDrizzleDb.mockReturnValue({
    select: vi.fn(() => ({ from: readFrom })),
  });
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


describe("GET /api/v1/users/me/saved-listings — current user's saved home IDs", () => {
  it("returns only the authenticated user's saved-listing state", async () => {
    const selectLimit = vi.fn().mockResolvedValue([{ savedListingIds: [LISTING_ID] }]);
    const selectWhere = vi.fn(() => ({ limit: selectLimit }));
    const selectFrom = vi.fn(() => ({ where: selectWhere }));
    const select = vi.fn(() => ({ from: selectFrom }));
    mocks.withAppUserTransaction.mockImplementation(
      async (_userId, operation) => operation({ select }),
    );

    const response = await GET(new Request(URL));

    expect(response.status).toBe(200);
    expect(await bodyOf(response)).toEqual({
      data: { savedListingIds: [LISTING_ID] },
    });
    expect(mocks.withAppUserTransaction).toHaveBeenCalledWith(
      USER_ID,
      expect.any(Function),
    );
  });
});

describe("PATCH /api/v1/users/me/saved-listings — successful save transition", () => {
  it("checks listing existence and writes the change through the authenticated user's transaction", async () => {
    const selectLimit = vi.fn().mockResolvedValue([{ id: LISTING_ID }]);
    const selectWhere = vi.fn(() => ({ limit: selectLimit }));
    const selectFrom = vi.fn(() => ({ where: selectWhere }));
    const select = vi.fn(() => ({ from: selectFrom }));

    const returning = vi.fn().mockResolvedValue([{ savedListingIds: [LISTING_ID] }]);
    const updateWhere = vi.fn(() => ({ returning }));
    const updateSet = vi.fn(() => ({ where: updateWhere }));
    const update = vi.fn(() => ({ set: updateSet }));

    mocks.withAppUserTransaction.mockImplementation(
      async (_userId, operation) => operation({ select, update }),
    );

    const response = await PATCH(request({ listingId: LISTING_ID, saved: true }));

    expect(response.status).toBe(200);
    expect(await bodyOf(response)).toEqual({
      data: { savedListingIds: [LISTING_ID] },
    });
    expect(mocks.withAppUserTransaction).toHaveBeenCalledWith(
      USER_ID,
      expect.any(Function),
    );
    expect(update).toHaveBeenCalledOnce();
  });

  it("distinguishes a listing visible to the read connection but missing to the save transaction", async () => {
    const appSelectLimit = vi.fn().mockResolvedValue([]);
    const appSelectWhere = vi.fn(() => ({ limit: appSelectLimit }));
    const appSelectFrom = vi.fn(() => ({ where: appSelectWhere }));
    const databaseContext = {
      databaseName: "postgres",
      currentRole: "evergreen_app",
      sessionRole: "evergreen_app",
      currentSchema: "public",
      searchPath: '"$user", public',
      resolvedListingsTable: "public.listings",
      publicListingsTable: "public.listings",
      isExpectedAppRole: true,
      canSelectPublicListings: true,
      canUseReadRole: true,
      publicListingIdVisible: false,
      resolvedListingIdVisible: false,
      visiblePublicListingCount: 13,
      visibleResolvedListingCount: 13,
    };
    const diagnosticLimit = vi.fn().mockResolvedValue([databaseContext]);
    const diagnosticWhere = vi.fn(() => ({ limit: diagnosticLimit }));
    const diagnosticFrom = vi.fn(() => ({ where: diagnosticWhere }));
    const appSelect = vi.fn()
      .mockImplementationOnce(() => ({ from: appSelectFrom }))
      .mockImplementationOnce(() => ({ from: diagnosticFrom }));
    const update = vi.fn();

    mocks.withAppUserTransaction.mockImplementation(
      async (_userId, operation) => operation({ select: appSelect, update }),
    );

    const readLimit = vi.fn().mockResolvedValue([{ id: LISTING_ID }]);
    const readWhere = vi.fn(() => ({ limit: readLimit }));
    const readFrom = vi.fn(() => ({ where: readWhere }));
    const readSelect = vi.fn(() => ({ from: readFrom }));
    mocks.getDrizzleDb.mockReturnValue({ select: readSelect });

    const response = await PATCH(request({ listingId: LISTING_ID, saved: true }));

    expect(response.status).toBe(503);
    const responseBody = await bodyOf(response);
    expect(errorCode(responseBody)).toBe("LISTING_LOOKUP_MISMATCH");
    expect(responseBody.diagnostics).toEqual(databaseContext);
    expect(readSelect).toHaveBeenCalledOnce();
    expect(update).not.toHaveBeenCalled();
  });

  it("does not write a saved state for a listing that no longer exists", async () => {
    const selectLimit = vi.fn().mockResolvedValue([]);
    const selectWhere = vi.fn(() => ({ limit: selectLimit }));
    const selectFrom = vi.fn(() => ({ where: selectWhere }));
    const select = vi.fn(() => ({ from: selectFrom }));
    const update = vi.fn();

    mocks.withAppUserTransaction.mockImplementation(
      async (_userId, operation) => operation({ select, update }),
    );

    const response = await PATCH(request({ listingId: LISTING_ID, saved: true }));

    expect(response.status).toBe(404);
    expect(errorCode(await bodyOf(response))).toBe("LISTING_NOT_FOUND");
    expect(update).not.toHaveBeenCalled();
  });
});
