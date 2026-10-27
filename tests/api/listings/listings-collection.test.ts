import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  getFilteredListings: vi.fn(),
  getAuthenticatedUserId: vi.fn(),
  withAppUserTransaction: vi.fn(),
  getMediaUrls: vi.fn(),
}));

vi.mock("@/db/queries/listings", () => ({ getFilteredListings: mocks.getFilteredListings }));
vi.mock("@/db/drizzle/app-client", () => ({ withAppUserTransaction: mocks.withAppUserTransaction }));
vi.mock("@/lib/api/get-authenticated-user-id", () => ({ getAuthenticatedUserId: mocks.getAuthenticatedUserId }));
vi.mock("@/db/supabase/util/GetMediaUrls", () => ({ default: mocks.getMediaUrls }));
vi.mock("server-only", () => ({}));

import { GET, POST } from "@/app/api/v1/listings/route";

const USER_ID = "22222222-2222-4222-8222-222222222222";
const URL = "http://localhost/api/v1/listings";

const validListing = {
  title: "Quiet family home",
  price: 250000,
  beds: 3,
  baths: 2,
  sqft: 1500,
  address: "15 Cedar Street",
  description: "A comfortable home near parks.",
  tags: [],
};

function jsonRequest(url: string, body: unknown, method = "POST") {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (method !== "GET" && method !== "HEAD") init.body = JSON.stringify(body);
  return new Request(url, init);
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
  mocks.getFilteredListings.mockResolvedValue([]);
  mocks.getAuthenticatedUserId.mockResolvedValue(USER_ID);
});

describe("GET /api/v1/listings — public listing search", () => {
  it("rejects malformed price ranges before querying listings", async () => {
    const response = await GET(new Request(URL + "?price=500000"));
    const body = await bodyOf(response);

    expect(response.status).toBe(400);
    expect(errorCode(body)).toBe("INVALID_PRICE_RANGE");
    expect(mocks.getFilteredListings).not.toHaveBeenCalled();
  });

  it("passes parsed price, trimmed search, and repeated supported tag filters to the read query", async () => {
    const response = await GET(
      new Request(URL + "?price=100000-500000&query=%20Duplex%20&tag=garden&tag=garage"),
    );

    expect(response.status).toBe(200);
    expect(await bodyOf(response)).toEqual({ data: [] });
    expect(mocks.getFilteredListings).toHaveBeenCalledWith({
      price: [100000, 500000],
      tags: ["garden", "garage"],
      search: "Duplex",
    });
  });

  it("returns the read query's listing collection in the data envelope", async () => {
    const rows = [{ id: "listing-1", title: "Sample property" }];
    mocks.getFilteredListings.mockResolvedValue(rows);

    const response = await GET(new Request(URL));

    expect(response.status).toBe(200);
    expect(await bodyOf(response)).toEqual({ data: rows });
  });
});

describe("POST /api/v1/listings — secure listing creation", () => {
  it("requires a signed-in user before parsing or writing a listing", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);

    const response = await POST(jsonRequest(URL, validListing));

    expect(response.status).toBe(401);
    expect(errorCode(await bodyOf(response))).toBe("UNAUTHENTICATED");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON without opening a database transaction", async () => {
    const response = await POST(new Request(URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }));

    expect(response.status).toBe(400);
    expect(errorCode(await bodyOf(response))).toBe("INVALID_REQUEST_BODY");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("rejects caller-supplied owner IDs and unsupported properties", async () => {
    const response = await POST(jsonRequest(URL, { ...validListing, sellerUserId: USER_ID }));

    expect(response.status).toBe(400);
    expect(errorCode(await bodyOf(response))).toBe("UNSUPPORTED_FIELD");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("rejects invalid price and title values before writing", async () => {
    const badTitle = await POST(jsonRequest(URL, { ...validListing, title: " " }));
    expect(badTitle.status).toBe(400);
    expect(errorCode(await bodyOf(badTitle))).toBe("INVALID_TITLE");

    const badPrice = await POST(jsonRequest(URL, { ...validListing, price: 1 }));
    expect(badPrice.status).toBe(400);
    expect(errorCode(await bodyOf(badPrice))).toBe("INVALID_PRICE");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("rejects unapproved listing tags before writing", async () => {
    const response = await POST(jsonRequest(URL, {
      ...validListing,
      tags: ["definitely-not-a-supported-tag"],
    }));

    expect(response.status).toBe(400);
    expect(errorCode(await bodyOf(response))).toBe("INVALID_TAGS");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("requires a seller profile before allowing listing creation", async () => {
    const profileLimit = vi.fn().mockResolvedValue([]);
    const profileForUpdate = vi.fn(() => ({ limit: profileLimit }));
    const profileWhere = vi.fn(() => ({ for: profileForUpdate }));
    const profileFrom = vi.fn(() => ({ where: profileWhere }));
    const select = vi.fn(() => ({ from: profileFrom }));
    const insert = vi.fn();

    mocks.withAppUserTransaction.mockImplementation(
      async (_userId, operation) => operation({ select, insert }),
    );

    const response = await POST(jsonRequest(URL, validListing));

    expect(response.status).toBe(409);
    expect(errorCode(await bodyOf(response))).toBe("SELLER_PROFILE_REQUIRED");
    expect(insert).not.toHaveBeenCalled();
  });

  it("requires a seller profile to be published before listing creation", async () => {
    const profileLimit = vi.fn().mockResolvedValue([{ userId: USER_ID, isPublished: false }]);
    const profileForUpdate = vi.fn(() => ({ limit: profileLimit }));
    const profileWhere = vi.fn(() => ({ for: profileForUpdate }));
    const profileFrom = vi.fn(() => ({ where: profileWhere }));
    const select = vi.fn(() => ({ from: profileFrom }));
    const insert = vi.fn();

    mocks.withAppUserTransaction.mockImplementation(
      async (_userId, operation) => operation({ select, insert }),
    );

    const response = await POST(jsonRequest(URL, validListing));

    expect(response.status).toBe(409);
    expect(errorCode(await bodyOf(response))).toBe("SELLER_PROFILE_NOT_PUBLIC");
    expect(insert).not.toHaveBeenCalled();
  });
});


describe("POST /api/v1/listings — successful owner-bound creation", () => {
  it("creates the listing under the authenticated seller after published-profile verification", async () => {
    const createdAt = "2026-01-01T12:00:00.000Z";
    const created = {
      id: "44444444-4444-4444-8444-444444444444",
      media: [],
      tags: ["garden"],
      title: "Quiet family home",
      price: "250000",
      beds: 3,
      baths: 2,
      sqft: 1500,
      address: "15 Cedar Street",
      description: "A comfortable home near parks.",
      createdAt,
    };

    const profileLimit = vi.fn().mockResolvedValue([
      { userId: USER_ID, isPublished: true },
    ]);
    const profileForUpdate = vi.fn(() => ({ limit: profileLimit }));
    const profileWhere = vi.fn(() => ({ for: profileForUpdate }));
    const profileFrom = vi.fn(() => ({ where: profileWhere }));
    const select = vi.fn(() => ({ from: profileFrom }));
    const returning = vi.fn().mockResolvedValue([created]);
    const values = vi.fn(() => ({ returning }));
    const insert = vi.fn(() => ({ values }));

    mocks.withAppUserTransaction.mockImplementation(
      async (userId, operation) => operation({ select, insert }),
    );

    const response = await POST(jsonRequest(URL, {
      ...validListing,
      title: "  Quiet family home  ",
      address: "  15 Cedar Street  ",
      tags: ["Garden", "garden"],
    }));

    expect(response.status).toBe(201);
    expect(await bodyOf(response)).toMatchObject({
      data: {
        id: created.id,
        title: "Quiet family home",
        price: 250000,
        address: "15 Cedar Street",
        tags: ["garden"],
        media: [],
        reviews: [],
      },
    });
    expect(mocks.withAppUserTransaction).toHaveBeenCalledWith(
      USER_ID,
      expect.any(Function),
    );
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      sellerUserId: USER_ID,
      title: "Quiet family home",
      price: "250000",
      address: "15 Cedar Street",
      tags: ["garden"],
      media: [],
    }));
  });
});
