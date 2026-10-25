import { afterEach, describe, expect, it, vi } from "vitest";

import { isSeedFixtureIdentity } from "../src/db/seed/auth-fixtures";
import { seedSellers } from "../src/db/seed/data";
import { sendAuthEmail } from "../src/lib/auth-email";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("fixture email verification allowlist", () => {
  it("allows only the exact enumerated fixture identities", () => {
    for (const seller of seedSellers) {
      expect(isSeedFixtureIdentity(seller.email, seller.name)).toBe(true);
    }
    expect(isSeedFixtureIdentity("person@example.com", "Person")).toBe(false);
    expect(isSeedFixtureIdentity(seedSellers[0].email, "Different Name")).toBe(false);
    expect(isSeedFixtureIdentity(seedSellers[0].email.toUpperCase(), seedSellers[0].name)).toBe(false);
  });
});

describe("transactional auth email sender", () => {
  it("sends through Resend with the server key and escapes dynamic HTML", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    vi.stubEnv("AUTH_EMAIL_FROM", "Evergreen Estates <auth@example.test>");
    const mockedFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", mockedFetch);

    await sendAuthEmail({
      to: "person@example.test",
      subject: "Verify",
      heading: "Verify your account",
      message: "Please verify your email.",
      actionLabel: "Verify email",
      actionUrl: "https://example.test/verify?token=a&next=%3Cscript%3E",
    });

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const [url, request] = mockedFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((request.headers as Record<string, string>).Authorization).toBe("Bearer test-resend-key");
    const body = JSON.parse(String(request.body)) as { from: string; to: string[]; html: string; text: string };
    expect(body.from).toBe("Evergreen Estates <auth@example.test>");
    expect(body.to).toEqual(["person@example.test"]);
    expect(body.html).toContain("&amp;next=%3Cscript%3E");
    expect(body.html).not.toContain("<script>");
    expect(body.text).toContain("https://example.test/verify?token=a&next=%3Cscript%3E");
  });

  it("fails closed when provider secrets are missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("AUTH_EMAIL_FROM", "");
    const mockedFetch = vi.fn();
    vi.stubGlobal("fetch", mockedFetch);
    await expect(sendAuthEmail({
      to: "person@example.test",
      subject: "Reset",
      heading: "Reset your password",
      message: "Choose a new password.",
      actionLabel: "Reset password",
      actionUrl: "https://example.test/reset",
    })).rejects.toThrow("Transactional email delivery is not configured.");
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});
