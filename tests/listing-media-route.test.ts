import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedUserId: vi.fn(),
  withAppUserTransaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/api/get-authenticated-user-id", () => ({
  getAuthenticatedUserId: mocks.getAuthenticatedUserId,
}));

vi.mock("@/db/drizzle/app-client", () => ({
  withAppUserTransaction: mocks.withAppUserTransaction,
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();

  return {
    ...actual,
    and: (...conditions: unknown[]) => ({ kind: "and", conditions }),
    eq: (left: unknown, right: unknown) => ({ kind: "eq", left, right }),
  };
});

import { listings } from "@/db/schema";
import { PATCH } from "../src/app/api/v1/listings/[id]/media/route";

const LISTING_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

type ApiResponseBody = {
  error?: { code: string };
  data?: { listingId: string; filenames: string[] };
};

function makeTransaction(
  listing: { id: string; media: string[] } | null,
  updated: { id: string; media: string[] } | null,
) {
  const selectLimit = vi.fn(async () => listing ? [listing] : []);
  const selectWhere = vi.fn(() => ({ limit: selectLimit }));
  const selectFrom = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from: selectFrom }));

  const updateReturning = vi.fn(async () => updated ? [updated] : []);
  const updateWhere = vi.fn((condition: unknown) => {
    void condition;
    return { returning: updateReturning };
  });
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));

  return {
    tx: { select, update },
    selectLimit,
    updateSet,
    updateWhere,
    updateReturning,
  };
}

function makeRequest(body: unknown, listingId = LISTING_ID) {
  return new Request(`http://localhost/api/v1/listings/${listingId}/media`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function responseBody(response: Response): Promise<ApiResponseBody> {
  return response.json() as Promise<ApiResponseBody>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthenticatedUserId.mockResolvedValue(USER_ID);
});

describe("PATCH /api/v1/listings/[id]/media", () => {
  it("requires an authenticated session", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);

    const response = await PATCH(makeRequest({ filenames: [] }), {
      params: Promise.resolve({ id: LISTING_ID }),
    });

    expect(response.status).toBe(401);
    expect((await responseBody(response)).error?.code).toBe("UNAUTHENTICATED");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("rejects an invalid listing UUID", async () => {
    const response = await PATCH(makeRequest({ filenames: [] }, "not-a-uuid"), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });

    expect(response.status).toBe(400);
    expect((await responseBody(response)).error?.code).toBe("INVALID_LISTING_ID");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it.each([
    ["unexpected fields", { filenames: ["front.jpg"], ownerId: USER_ID }],
    ["non-string entries", { filenames: ["front.jpg", 7] }],
    ["duplicate filenames", { filenames: ["front.jpg", "front.jpg"] }],
    ["path separators", { filenames: ["../front.jpg"] }],
    ["backslash path separators", { filenames: ["..\\front.jpg"] }],
    ["full URLs", { filenames: ["https://example.com/front.jpg"] }],
    ["invalid filenames", { filenames: ["front.svg"] }],
  ])("rejects %s", async (_caseName, body) => {
    const response = await PATCH(makeRequest(body), {
      params: Promise.resolve({ id: LISTING_ID }),
    });

    expect(response.status).toBe(400);
    expect((await responseBody(response)).error?.code).toBe("INVALID_MEDIA_ORDER");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("reorders an exact permutation, preserving legacy filenames", async () => {
    const currentMedia = ["Front Entrance (2).jpg", "Living room.jpg", "tour.gif"];
    const filenames = ["tour.gif", "Living room.jpg", "Front Entrance (2).jpg"];
    const transaction = makeTransaction(
      { id: LISTING_ID, media: currentMedia },
      { id: LISTING_ID, media: filenames },
    );
    mocks.withAppUserTransaction.mockImplementation(
      async (_userId, operation) => operation(transaction.tx),
    );

    const response = await PATCH(makeRequest({ filenames }), {
      params: Promise.resolve({ id: LISTING_ID }),
    });

    expect(response.status).toBe(200);
    expect(await responseBody(response)).toEqual({
      data: { listingId: LISTING_ID, filenames },
    });
    expect(mocks.withAppUserTransaction).toHaveBeenCalledWith(
      USER_ID,
      expect.any(Function),
    );
    expect(transaction.updateSet).toHaveBeenCalledWith({
      media: filenames,
      updatedAt: expect.any(String),
    });

    const updateWhere = transaction.updateWhere.mock.calls[0][0] as {
      conditions: Array<{ kind: string; left: unknown; right: unknown }>;
    };
    expect(updateWhere.conditions).toContainEqual({
      kind: "eq",
      left: listings.media,
      right: currentMedia,
    });
  });

  it("returns 404 for a listing not owned by the authenticated user", async () => {
    const transaction = makeTransaction(null, null);
    mocks.withAppUserTransaction.mockImplementation(
      async (_userId, operation) => operation(transaction.tx),
    );

    const response = await PATCH(makeRequest({ filenames: [] }), {
      params: Promise.resolve({ id: LISTING_ID }),
    });

    expect(response.status).toBe(404);
    expect((await responseBody(response)).error?.code).toBe("LISTING_NOT_FOUND");
    expect(transaction.updateSet).not.toHaveBeenCalled();
  });

  it("returns 409 when the submitted list is not the registered permutation", async () => {
    const transaction = makeTransaction(
      { id: LISTING_ID, media: ["front.jpg", "inside.jpg"] },
      null,
    );
    mocks.withAppUserTransaction.mockImplementation(
      async (_userId, operation) => operation(transaction.tx),
    );

    const response = await PATCH(
      makeRequest({ filenames: ["front.jpg", "new.jpg"] }),
      { params: Promise.resolve({ id: LISTING_ID }) },
    );

    expect(response.status).toBe(409);
    expect((await responseBody(response)).error?.code).toBe("MEDIA_ORDER_CONFLICT");
    expect(transaction.updateSet).not.toHaveBeenCalled();
  });

  it("returns 409 when the media array changes before the conditional update", async () => {
    const transaction = makeTransaction(
      { id: LISTING_ID, media: ["front.jpg", "inside.jpg"] },
      null,
    );
    mocks.withAppUserTransaction.mockImplementation(
      async (_userId, operation) => operation(transaction.tx),
    );

    const response = await PATCH(
      makeRequest({ filenames: ["inside.jpg", "front.jpg"] }),
      { params: Promise.resolve({ id: LISTING_ID }) },
    );

    expect(response.status).toBe(409);
    expect((await responseBody(response)).error?.code).toBe("MEDIA_ORDER_CONFLICT");
    expect(transaction.updateWhere).toHaveBeenCalledOnce();
  });
});
