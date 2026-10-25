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
  getAuthenticatedUserId: vi.fn(),
  withAppUserTransaction: vi.fn(),
  getDrizzleDb: vi.fn(),
}));

vi.mock("@/lib/api/get-authenticated-user-id", () => ({ getAuthenticatedUserId: mocks.getAuthenticatedUserId }));
vi.mock("@/db/drizzle/app-client", () => ({ withAppUserTransaction: mocks.withAppUserTransaction }));
vi.mock("@/db/drizzle/client", () => ({ getDrizzleDb: mocks.getDrizzleDb }));
vi.mock("server-only", () => ({}));

import { GET, POST } from "@/app/api/v1/listings/[id]/reviews/route";
import { PATCH, DELETE } from "@/app/api/v1/listings/[id]/reviews/[reviewId]/route";
import { reviews } from "@/db/schema";

const USER_ID = "22222222-2222-4222-8222-222222222222";
const LISTING_ID = "11111111-1111-4111-8111-111111111111";
const REVIEW_ID = "33333333-3333-4333-8333-333333333333";
const URL = "http://localhost/api/v1/listings/" + LISTING_ID + "/reviews";

function jsonRequest(url: string, method: string, body: unknown): NextRequest {
  return new NextRequest(url, {
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
  mocks.getAuthenticatedUserId.mockResolvedValue(USER_ID);
});

describe("GET /api/v1/listings/[id]/reviews — public review reads", () => {
  it("rejects malformed listing IDs without querying the database", async () => {
    const response = await GET(new Request("http://localhost/api/v1/listings/bad/reviews"), {
      params: Promise.resolve({ id: "bad" }),
    });

    expect(response.status).toBe(400);
    expect((await bodyOf(response)).error).toBe("INVALID_LISTING_ID");
    expect(mocks.getDrizzleDb).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/listings/[id]/reviews — review creation", () => {
  it("requires authentication", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);

    const response = await POST(jsonRequest(URL, "POST", { rating: 5, comment: "Great home" }), {
      params: Promise.resolve({ id: LISTING_ID }),
    });

    expect(response.status).toBe(401);
    expect((await bodyOf(response)).error).toBe("UNAUTHENTICATED");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("rejects invalid listing IDs before reading or writing reviews", async () => {
    const response = await POST(jsonRequest(URL, "POST", { rating: 5, comment: "Great home" }), {
      params: Promise.resolve({ id: "bad" }),
    });

    expect(response.status).toBe(400);
    expect((await bodyOf(response)).error).toBe("INVALID_LISTING_ID");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("rejects caller-supplied reviewer identity and invalid ratings", async () => {
    const unsupported = await POST(
      jsonRequest(URL, "POST", { rating: 5, comment: "Great home", userId: USER_ID }),
      { params: Promise.resolve({ id: LISTING_ID }) },
    );
    expect(unsupported.status).toBe(400);
    expect((await bodyOf(unsupported)).error).toBe("UNSUPPORTED_FIELDS");

    const rating = await POST(
      jsonRequest(URL, "POST", { rating: 6, comment: "Great home" }),
      { params: Promise.resolve({ id: LISTING_ID }) },
    );
    expect(rating.status).toBe(400);
    expect((await bodyOf(rating)).error).toBe("INVALID_RATING");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("rejects an empty or overlong review comment", async () => {
    const empty = await POST(
      jsonRequest(URL, "POST", { rating: 4, comment: "  " }),
      { params: Promise.resolve({ id: LISTING_ID }) },
    );
    expect(empty.status).toBe(400);
    expect((await bodyOf(empty)).error).toBe("INVALID_COMMENT");

    const long = await POST(
      jsonRequest(URL, "POST", { rating: 4, comment: "x".repeat(5001) }),
      { params: Promise.resolve({ id: LISTING_ID }) },
    );
    expect(long.status).toBe(400);
    expect((await bodyOf(long)).error).toBe("INVALID_COMMENT");
  });
});

describe("PATCH /api/v1/listings/[id]/reviews/[reviewId] — author-scoped edits", () => {
  it("requires authentication and valid listing/review IDs", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);
    const unauthenticated = await PATCH(jsonRequest(URL, "PATCH", { rating: 4 }), {
      params: Promise.resolve({ id: LISTING_ID, reviewId: REVIEW_ID }),
    });
    expect(unauthenticated.status).toBe(401);

    mocks.getAuthenticatedUserId.mockResolvedValue(USER_ID);
    const invalidId = await PATCH(jsonRequest(URL, "PATCH", { rating: 4 }), {
      params: Promise.resolve({ id: LISTING_ID, reviewId: "bad" }),
    });
    expect(invalidId.status).toBe(400);
    expect((await bodyOf(invalidId)).error).toBe("INVALID_ID");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("rejects empty, unsupported, and invalid rating changes without database access", async () => {
    const empty = await PATCH(jsonRequest(URL, "PATCH", {}), {
      params: Promise.resolve({ id: LISTING_ID, reviewId: REVIEW_ID }),
    });
    expect(empty.status).toBe(400);
    expect((await bodyOf(empty)).error).toBe("EMPTY_UPDATE");

    const unsupported = await PATCH(jsonRequest(URL, "PATCH", { userId: "other" }), {
      params: Promise.resolve({ id: LISTING_ID, reviewId: REVIEW_ID }),
    });
    expect(unsupported.status).toBe(400);
    expect((await bodyOf(unsupported)).error).toBe("UNSUPPORTED_FIELDS");

    const invalidRating = await PATCH(jsonRequest(URL, "PATCH", { rating: 0 }), {
      params: Promise.resolve({ id: LISTING_ID, reviewId: REVIEW_ID }),
    });
    expect(invalidRating.status).toBe(400);
    expect((await bodyOf(invalidRating)).error).toBe("INVALID_RATING");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/v1/listings/[id]/reviews/[reviewId] — author-scoped deletion", () => {
  it("requires authentication and valid IDs before attempting deletion", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);
    const unauthenticated = await DELETE(jsonRequest(URL, "DELETE", {}), {
      params: Promise.resolve({ id: LISTING_ID, reviewId: REVIEW_ID }),
    });
    expect(unauthenticated.status).toBe(401);

    mocks.getAuthenticatedUserId.mockResolvedValue(USER_ID);
    const invalidId = await DELETE(jsonRequest(URL, "DELETE", {}), {
      params: Promise.resolve({ id: "bad", reviewId: REVIEW_ID }),
    });
    expect(invalidId.status).toBe(400);
    expect((await bodyOf(invalidId)).error).toBe("INVALID_ID");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });
});


describe("PATCH /api/v1/listings/[id]/reviews/[reviewId] — author binding", () => {
  it("updates only a row matching the authenticated reviewer, listing, and review", async () => {
    const returnedReview = {
      id: REVIEW_ID,
      listingId: LISTING_ID,
      userId: USER_ID,
      rating: 4,
      comment: "Updated comment",
      createdAt: "2026-01-01T12:00:00.000Z",
      updatedAt: "2026-01-02T12:00:00.000Z",
    };
    const returning = vi.fn().mockResolvedValue([returnedReview]);
    const where = vi.fn((condition: unknown) => {
      void condition;
      return { returning };
    });
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));

    mocks.withAppUserTransaction.mockImplementation(
      async (userId, operation) => operation({ update }),
    );

    const response = await PATCH(
      jsonRequest(URL, "PATCH", { rating: 4, comment: " Updated comment " }),
      { params: Promise.resolve({ id: LISTING_ID, reviewId: REVIEW_ID }) },
    );

    expect(response.status).toBe(200);
    expect(await bodyOf(response)).toMatchObject({
      data: {
        id: REVIEW_ID,
        listing_id: LISTING_ID,
        user_id: USER_ID,
        rating: 4,
        comment: "Updated comment",
      },
    });
    expect(mocks.withAppUserTransaction).toHaveBeenCalledWith(
      USER_ID,
      expect.any(Function),
    );
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      rating: 4,
      comment: "Updated comment",
      updatedAt: expect.any(String),
    }));

    const predicate = where.mock.calls[0][0] as {
      kind: string;
      conditions: Array<{ kind: string; left: unknown; right: unknown }>;
    };
    expect(predicate.kind).toBe("and");
    expect(predicate.conditions).toContainEqual({
      kind: "eq",
      left: reviews.userId,
      right: USER_ID,
    });
    expect(predicate.conditions).toContainEqual({
      kind: "eq",
      left: reviews.listingId,
      right: LISTING_ID,
    });
    expect(predicate.conditions).toContainEqual({
      kind: "eq",
      left: reviews.id,
      right: REVIEW_ID,
    });
  });

  it("returns not-found if the review is not owned by the authenticated user", async () => {
    const returning = vi.fn().mockResolvedValue([]);
    const where = vi.fn((condition: unknown) => {
      void condition;
      return { returning };
    });
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    mocks.withAppUserTransaction.mockImplementation(
      async (_userId, operation) => operation({ update }),
    );

    const response = await PATCH(
      jsonRequest(URL, "PATCH", { rating: 4 }),
      { params: Promise.resolve({ id: LISTING_ID, reviewId: REVIEW_ID }) },
    );

    expect(response.status).toBe(404);
    expect(errorCode(await bodyOf(response))).toBe("REVIEW_NOT_FOUND");
  });
});
