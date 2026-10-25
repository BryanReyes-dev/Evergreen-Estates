import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { NextRequest } from "next/server";

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: (...conditions: unknown[]) => ({ kind: "and", conditions }),
    eq: (left: unknown, right: unknown) => ({ kind: "eq", left, right }),
  };
});

const mocks = vi.hoisted(() => ({
  getListingById: vi.fn(),
  withAppUserTransaction: vi.fn(),
  deleteListingMediaObjects: vi.fn(),
  getAuthenticatedUserId: vi.fn(),
}));

vi.mock("@/db/queries/listings", () => ({ getListingById: mocks.getListingById }));
vi.mock("@/db/drizzle/app-client", () => ({ withAppUserTransaction: mocks.withAppUserTransaction }));
vi.mock("@/db/supabase/storage-admin", () => ({ deleteListingMediaObjects: mocks.deleteListingMediaObjects }));
vi.mock("@/lib/api/get-authenticated-user-id", () => ({ getAuthenticatedUserId: mocks.getAuthenticatedUserId }));
vi.mock("server-only", () => ({}));

import { GET, PATCH, DELETE } from "@/app/api/v1/listings/[id]/route";
import { listings } from "@/db/schema";

const USER_ID = "22222222-2222-4222-8222-222222222222";
const LISTING_ID = "11111111-1111-4111-8111-111111111111";
const URL = "http://localhost/api/v1/listings/" + LISTING_ID;

function request(body: unknown, method: string, id = LISTING_ID): NextRequest {
  return new NextRequest("http://localhost/api/v1/listings/" + id, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

type ApiBody = { error?: string | { code?: string; message?: string; fields?: string[] }; data?: unknown };
async function bodyOf(response: Response): Promise<ApiBody> {
  return response.json() as Promise<ApiBody>;
}
function errorCode(body: ApiBody): string | undefined {
  return typeof body.error === "string" ? body.error : body.error?.code;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getListingById.mockResolvedValue(null);
  mocks.getAuthenticatedUserId.mockResolvedValue(USER_ID);
});

describe("GET /api/v1/listings/[id] — public listing detail", () => {
  it("returns a listing in the standard data envelope", async () => {
    const listing = { id: LISTING_ID, title: "Sample property" };
    mocks.getListingById.mockResolvedValue(listing);

    const response = await GET(new Request(URL), {
      params: Promise.resolve({ id: LISTING_ID }),
    });

    expect(response.status).toBe(200);
    expect(await bodyOf(response)).toEqual({ data: listing });
    expect(mocks.getListingById).toHaveBeenCalledWith(LISTING_ID);
  });

  it("returns 404 when a listing does not exist", async () => {
    const response = await GET(new Request(URL), {
      params: Promise.resolve({ id: LISTING_ID }),
    });

    expect(response.status).toBe(404);
    expect(errorCode(await bodyOf(response))).toBe("LISTING_NOT_FOUND");
  });
});

describe("PATCH /api/v1/listings/[id] — owner-scoped listing updates", () => {
  it("requires authentication", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);

    const response = await PATCH(request({ title: "New title" }, "PATCH"), {
      params: Promise.resolve({ id: LISTING_ID }),
    });

    expect(response.status).toBe(401);
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("rejects invalid listing UUIDs", async () => {
    const response = await PATCH(request({ title: "New title" }, "PATCH", "not-a-uuid"), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });

    expect(response.status).toBe(400);
    expect((await bodyOf(response)).error).toBe("INVALID_LISTING_ID");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("rejects unsupported fields and empty updates", async () => {
    const unsupported = await PATCH(
      request({ title: "New title", sellerUserId: USER_ID }, "PATCH"),
      { params: Promise.resolve({ id: LISTING_ID }) },
    );
    expect(unsupported.status).toBe(400);
    expect((await bodyOf(unsupported)).error).toBe("UNSUPPORTED_FIELDS");

    const empty = await PATCH(request({}, "PATCH"), {
      params: Promise.resolve({ id: LISTING_ID }),
    });
    expect(empty.status).toBe(400);
    expect((await bodyOf(empty)).error).toBe("EMPTY_UPDATE");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("rejects invalid price and title updates before querying the database", async () => {
    const badTitle = await PATCH(request({ title: "x" }, "PATCH"), {
      params: Promise.resolve({ id: LISTING_ID }),
    });
    expect(badTitle.status).toBe(400);
    expect((await bodyOf(badTitle)).error).toBe("INVALID_TITLE");

    const badPrice = await PATCH(request({ price: "NaN" }, "PATCH"), {
      params: Promise.resolve({ id: LISTING_ID }),
    });
    expect(badPrice.status).toBe(400);
    expect((await bodyOf(badPrice)).error).toBe("INVALID_PRICE");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/v1/listings/[id] — owner-scoped deletion", () => {
  it("requires authentication", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);

    const response = await DELETE(request({}, "DELETE"), {
      params: Promise.resolve({ id: LISTING_ID }),
    });

    expect(response.status).toBe(401);
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
    expect(mocks.deleteListingMediaObjects).not.toHaveBeenCalled();
  });

  it("rejects invalid listing UUIDs before database or Storage access", async () => {
    const response = await DELETE(request({}, "DELETE", "not-a-uuid"), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });

    expect(response.status).toBe(400);
    expect((await bodyOf(response)).error).toBe("INVALID_LISTING_ID");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
    expect(mocks.deleteListingMediaObjects).not.toHaveBeenCalled();
  });

  it("does not delete Storage objects for a listing the user does not own", async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    mocks.withAppUserTransaction.mockImplementation(
      async (_userId, operation) => operation({ select }),
    );

    const response = await DELETE(request({}, "DELETE"), {
      params: Promise.resolve({ id: LISTING_ID }),
    });

    expect(response.status).toBe(404);
    expect((await bodyOf(response)).error).toBe("LISTING_NOT_FOUND");
    expect(mocks.deleteListingMediaObjects).not.toHaveBeenCalled();
  });
});


describe("PATCH /api/v1/listings/[id] — successful owner-scoped update", () => {
  it("normalizes validated fields and predicates the update on the signed-in owner", async () => {
    const updatedRow = { id: LISTING_ID };
    const returning = vi.fn().mockResolvedValue([updatedRow]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const listing = {
      id: LISTING_ID,
      title: "Updated title",
      price: 275000,
      beds: 3,
      baths: 2,
      sqft: 1500,
      address: "15 Cedar Street",
      description: "An updated description.",
      tags: ["garden"],
      media: [],
      reviews: [],
    };
    mocks.withAppUserTransaction.mockImplementation(
      async (userId, operation) => operation({ update }),
    );
    mocks.getListingById.mockResolvedValue(listing);

    const response = await PATCH(request({
      title: "  Updated title  ",
      address: "  15 Cedar Street  ",
    }, "PATCH"), {
      params: Promise.resolve({ id: LISTING_ID }),
    });

    expect(response.status).toBe(200);
    expect(await bodyOf(response)).toEqual({ data: listing });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      title: "Updated title",
      address: "15 Cedar Street",
      updatedAt: expect.any(String),
    }));
    expect(mocks.withAppUserTransaction).toHaveBeenCalledWith(
      USER_ID,
      expect.any(Function),
    );
    const predicate = where.mock.calls[0][0] as {
      kind: string;
      conditions: Array<{ kind: string; left: unknown; right: unknown }>;
    };
    expect(predicate.kind).toBe("and");
    expect(predicate.conditions).toContainEqual({
      kind: "eq",
      left: listings.id,
      right: LISTING_ID,
    });
    expect(predicate.conditions).toContainEqual({
      kind: "eq",
      left: listings.sellerUserId,
      right: USER_ID,
    });
  });
});


describe("DELETE /api/v1/listings/[id] — media cleanup ordering", () => {
  it("removes registered media before deleting the owned database listing", async () => {
    const events: string[] = [];
    const ownedListing = { id: LISTING_ID, media: ["front.jpg", "tour.gif"] };

    const selectLimit = vi.fn().mockResolvedValue([ownedListing]);
    const selectWhere = vi.fn(() => ({ limit: selectLimit }));
    const selectFrom = vi.fn(() => ({ where: selectWhere }));
    const select = vi.fn(() => ({ from: selectFrom }));

    const deleteReturning = vi.fn().mockResolvedValue([{ id: LISTING_ID }]);
    const deleteWhere = vi.fn(() => ({ returning: deleteReturning }));
    const deleteRow = vi.fn(() => ({ where: deleteWhere }));

    mocks.withAppUserTransaction
      .mockImplementationOnce(async (_userId, operation) => {
        events.push("ownership-read");
        return operation({ select });
      })
      .mockImplementationOnce(async (_userId, operation) => {
        events.push("database-delete");
        return operation({ delete: deleteRow });
      });
    mocks.deleteListingMediaObjects.mockImplementation(async () => {
      events.push("storage-delete");
    });

    const response = await DELETE(request({}, "DELETE"), {
      params: Promise.resolve({ id: LISTING_ID }),
    });

    expect(response.status).toBe(204);
    expect(mocks.deleteListingMediaObjects).toHaveBeenCalledWith({
      listingId: LISTING_ID,
      filenames: ["front.jpg", "tour.gif"],
    });
    expect(events).toEqual([
      "ownership-read",
      "storage-delete",
      "database-delete",
    ]);
    expect(mocks.withAppUserTransaction).toHaveBeenNthCalledWith(
      1,
      USER_ID,
      expect.any(Function),
    );
    expect(mocks.withAppUserTransaction).toHaveBeenNthCalledWith(
      2,
      USER_ID,
      expect.any(Function),
    );
  });
});
