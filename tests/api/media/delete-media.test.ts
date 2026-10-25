import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthenticatedUserId: vi.fn(),
  withAppUserTransaction: vi.fn(),
  deleteListingMediaObjects: vi.fn(),
  isAllowedListingMediaFilename: vi.fn(),
}));

vi.mock("@/lib/api/get-authenticated-user-id", () => ({
  getAuthenticatedUserId: mocks.getAuthenticatedUserId,
}));
vi.mock("@/db/drizzle/app-client", () => ({
  withAppUserTransaction: mocks.withAppUserTransaction,
}));
vi.mock("@/db/supabase/storage-admin", () => ({
  deleteListingMediaObjects: mocks.deleteListingMediaObjects,
  isAllowedListingMediaFilename: mocks.isAllowedListingMediaFilename,
}));
vi.mock("server-only", () => ({}));
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: (...conditions: unknown[]) => ({ kind: "and", conditions }),
    eq: (left: unknown, right: unknown) => ({ kind: "eq", left, right }),
    arrayContains: (column: unknown, values: unknown[]) => ({
      kind: "arrayContains",
      column,
      values,
    }),
  };
});

import { DELETE } from "@/app/api/v1/listings/[id]/media/[filename]/route";
import { listings } from "@/db/schema";

const USER_ID = "22222222-2222-4222-8222-222222222222";
const LISTING_ID = "11111111-1111-4111-8111-111111111111";
const FILENAME = "front.jpg";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthenticatedUserId.mockResolvedValue(USER_ID);
  mocks.isAllowedListingMediaFilename.mockImplementation(
    (filename: string) => filename === "front.jpg" || filename === "tour.gif",
  );
});

function request(id = LISTING_ID, filename = FILENAME) {
  return new NextRequest("http://localhost/api/v1/listings/" + id + "/media/" + filename, {
    method: "DELETE",
  });
}

async function bodyOf(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function makeSelectTransaction(row: { id: string; media: string[] } | null) {
  const limit = vi.fn().mockResolvedValue(row ? [row] : []);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { tx: { select }, select, limit };
}

describe("DELETE /api/v1/listings/[id]/media/[filename] — secure media deletion", () => {
  it("requires authentication before database or Storage access", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);

    const response = await DELETE(request(), {
      params: Promise.resolve({ id: LISTING_ID, filename: FILENAME }),
    });

    expect(response.status).toBe(401);
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
    expect(mocks.deleteListingMediaObjects).not.toHaveBeenCalled();
  });

  it("rejects malformed listing UUIDs and disallowed filenames before access", async () => {
    const invalidId = await DELETE(request("not-a-uuid"), {
      params: Promise.resolve({ id: "not-a-uuid", filename: FILENAME }),
    });
    expect(invalidId.status).toBe(400);
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();

    const invalidFilename = await DELETE(request(LISTING_ID, "../outside.jpg"), {
      params: Promise.resolve({ id: LISTING_ID, filename: "../outside.jpg" }),
    });
    expect(invalidFilename.status).toBe(400);
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
    expect(mocks.deleteListingMediaObjects).not.toHaveBeenCalled();
  });

  it("does not access Storage when the listing is not owned by the current user", async () => {
    const transaction = makeSelectTransaction(null);
    mocks.withAppUserTransaction.mockImplementation(
      async (_userId, operation) => operation(transaction.tx),
    );

    const response = await DELETE(request(), {
      params: Promise.resolve({ id: LISTING_ID, filename: FILENAME }),
    });

    expect(response.status).toBe(404);
    expect((await bodyOf(response)).error).toBe("LISTING_NOT_FOUND");
    expect(mocks.deleteListingMediaObjects).not.toHaveBeenCalled();
  });

  it("does not delete an unregistered filename", async () => {
    const transaction = makeSelectTransaction({ id: LISTING_ID, media: ["different.jpg"] });
    mocks.withAppUserTransaction.mockImplementation(
      async (_userId, operation) => operation(transaction.tx),
    );

    const response = await DELETE(request(), {
      params: Promise.resolve({ id: LISTING_ID, filename: FILENAME }),
    });

    expect(response.status).toBe(404);
    expect((await bodyOf(response)).error).toBe("MEDIA_NOT_FOUND");
    expect(mocks.deleteListingMediaObjects).not.toHaveBeenCalled();
  });

  it("deletes the private Storage object before conditionally removing its database registration", async () => {
    const events: string[] = [];
    const ownerRead = makeSelectTransaction({ id: LISTING_ID, media: [FILENAME, "tour.gif"] });

    const returning = vi.fn().mockResolvedValue([{ id: LISTING_ID }]);
    const updateWhere = vi.fn((condition: unknown) => {
      void condition;
      return { returning };
    });
    const updateSet = vi.fn(() => ({ where: updateWhere }));
    const update = vi.fn(() => ({ set: updateSet }));
    const updateTx = { update };

    mocks.withAppUserTransaction
      .mockImplementationOnce(async (_userId, operation) => {
        events.push("ownership-read");
        return operation(ownerRead.tx);
      })
      .mockImplementationOnce(async (_userId, operation) => {
        events.push("database-update");
        return operation(updateTx);
      });
    mocks.deleteListingMediaObjects.mockImplementation(async () => {
      events.push("storage-delete");
    });

    const response = await DELETE(request(), {
      params: Promise.resolve({ id: LISTING_ID, filename: FILENAME }),
    });

    expect(response.status).toBe(204);
    expect(mocks.deleteListingMediaObjects).toHaveBeenCalledWith({
      listingId: LISTING_ID,
      filenames: [FILENAME],
    });
    expect(events).toEqual([
      "ownership-read",
      "storage-delete",
      "database-update",
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

    const condition = updateWhere.mock.calls[0][0] as {
      kind: string;
      conditions: Array<{ kind: string; left?: unknown; right?: unknown }>;
    };
    expect(condition.kind).toBe("and");
    expect(condition.conditions).toContainEqual({
      kind: "eq",
      left: listings.sellerUserId,
      right: USER_ID,
    });
  });
});
