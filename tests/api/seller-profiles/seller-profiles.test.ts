import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthenticatedUserId: vi.fn(),
  withAppUserTransaction: vi.fn(),
}));

vi.mock("@/lib/api/get-authenticated-user-id", () => ({ getAuthenticatedUserId: mocks.getAuthenticatedUserId }));
vi.mock("@/db/drizzle/app-client", () => ({ withAppUserTransaction: mocks.withAppUserTransaction }));
vi.mock("server-only", () => ({}));

import { POST, GET, PATCH, DELETE } from "@/app/api/v1/seller-profiles/route";

const USER_ID = "22222222-2222-4222-8222-222222222222";
const URL = "http://localhost/api/v1/seller-profiles";

type ApiBody = { error?: string | { code?: string; message?: string; fields?: string[] }; data?: unknown };
async function bodyOf(response: Response): Promise<ApiBody> {
  return response.json() as Promise<ApiBody>;
}
function errorCode(body: ApiBody) {
  return typeof body.error === "string" ? body.error : body.error?.code;
}
function request(body: unknown, method: string): NextRequest {
  return new NextRequest(URL, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthenticatedUserId.mockResolvedValue(USER_ID);
});

describe("POST /api/v1/seller-profiles — seller enrollment validation", () => {
  it("requires authentication", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);
    const response = await POST(request({}, "POST"));

    expect(response.status).toBe(401);
    expect(errorCode(await bodyOf(response))).toBe("UNAUTHENTICATED");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("rejects caller-supplied ownership fields", async () => {
    const response = await POST(request({
      displayName: "Seller",
      preferredContactMethod: "email",
      contactEmail: "seller@example.com",
      userId: "somebody-else",
    }, "POST"));

    expect(response.status).toBe(400);
    expect(errorCode(await bodyOf(response))).toBe("UNSUPPORTED_FIELD");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("validates display name and preferred contact method", async () => {
    const emptyName = await POST(request({
      displayName: "  ",
      preferredContactMethod: "email",
      contactEmail: "seller@example.com",
    }, "POST"));
    expect(emptyName.status).toBe(400);
    expect(errorCode(await bodyOf(emptyName))).toBe("INVALID_DISPLAY_NAME");

    const invalidMethod = await POST(request({
      displayName: "Seller",
      preferredContactMethod: "sms",
      contactEmail: "seller@example.com",
    }, "POST"));
    expect(invalidMethod.status).toBe(400);
    expect(errorCode(await bodyOf(invalidMethod))).toBe("INVALID_CONTACT_METHOD");
  });

  it("requires valid contact information for the selected method", async () => {
    const missingEmail = await POST(request({
      displayName: "Seller",
      preferredContactMethod: "email",
    }, "POST"));
    expect(missingEmail.status).toBe(400);
    expect(errorCode(await bodyOf(missingEmail))).toBe("CONTACT_EMAIL_REQUIRED");

    const invalidEmail = await POST(request({
      displayName: "Seller",
      preferredContactMethod: "email",
      contactEmail: "not-an-email",
    }, "POST"));
    expect(invalidEmail.status).toBe(400);
    expect(errorCode(await bodyOf(invalidEmail))).toBe("INVALID_CONTACT_EMAIL");

    const missingPhone = await POST(request({
      displayName: "Seller",
      preferredContactMethod: "phone",
    }, "POST"));
    expect(missingPhone.status).toBe(400);
    expect(errorCode(await bodyOf(missingPhone))).toBe("CONTACT_PHONE_REQUIRED");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/seller-profiles — current seller profile", () => {
  it("requires authentication before reading a profile", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);
    const response = await GET(new NextRequest(URL));

    expect(response.status).toBe(401);
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/v1/seller-profiles — protected seller profile updates", () => {
  it("rejects unauthenticated requests and unknown owner fields", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);
    const unauthenticated = await PATCH(request({ displayName: "Updated" }, "PATCH"));
    expect(unauthenticated.status).toBe(401);

    mocks.getAuthenticatedUserId.mockResolvedValue(USER_ID);
    const unsupported = await PATCH(request({ displayName: "Updated", userId: "another-user" }, "PATCH"));
    expect(unsupported.status).toBe(400);
    expect(errorCode(await bodyOf(unsupported))).toBe("UNSUPPORTED_FIELDS");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });

  it("rejects invalid contact details before writing", async () => {
    const response = await PATCH(request({ contactEmail: "bad-address" }, "PATCH"));

    expect(response.status).toBe(400);
    expect(errorCode(await bodyOf(response))).toBe("INVALID_CONTACT_EMAIL");
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/v1/seller-profiles — protected profile deletion", () => {
  it("requires authentication", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);
    const response = await DELETE(new NextRequest(URL, { method: "DELETE" }));

    expect(response.status).toBe(401);
    expect(mocks.withAppUserTransaction).not.toHaveBeenCalled();
  });
});


describe("POST /api/v1/seller-profiles — successful profile enrollment", () => {
  it("normalizes contact data and creates a private profile owned by the signed-in user", async () => {
    const createdProfile = {
      userId: USER_ID,
      displayName: "Seller One",
      bio: null,
      avatarUrl: null,
      contactEmail: "seller@example.com",
      contactPhone: null,
      preferredContactMethod: "email",
      isPublished: false,
    };
    const returning = vi.fn().mockResolvedValue([createdProfile]);
    const onConflictDoNothing = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoNothing }));
    const insert = vi.fn(() => ({ values }));

    mocks.withAppUserTransaction.mockImplementation(
      async (userId, operation) => operation({ insert }),
    );

    const response = await POST(request({
      displayName: "  Seller One  ",
      bio: "  ",
      preferredContactMethod: "email",
      contactEmail: " Seller@Example.com ",
    }, "POST"));

    expect(response.status).toBe(201);
    expect(await bodyOf(response)).toMatchObject({ data: createdProfile });
    expect(mocks.withAppUserTransaction).toHaveBeenCalledWith(
      USER_ID,
      expect.any(Function),
    );
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      userId: USER_ID,
      displayName: "Seller One",
      bio: null,
      contactEmail: "seller@example.com",
      preferredContactMethod: "email",
      isPublished: false,
    }));
  });
});
