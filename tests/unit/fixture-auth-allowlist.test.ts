import { describe, expect, it } from "vite-plus/test";

import { isSeedFixtureIdentity } from "@/db/seed/auth-fixtures";
import { seedSellers } from "@/db/seed/data";

describe("seed-only authentication verification allowlist", () => {
  it("allows each exact seeded seller email and name pair", () => {
    for (const seller of seedSellers) {
      expect(isSeedFixtureIdentity(seller.email, seller.name)).toBe(true);
    }
  });

  it("rejects an unknown email even when the name matches a fixture", () => {
    expect(
      isSeedFixtureIdentity("attacker@example.com", seedSellers[0].name),
    ).toBe(false);
  });

  it("rejects a changed name even when the email matches a fixture", () => {
    expect(
      isSeedFixtureIdentity(seedSellers[0].email, "Different Person"),
    ).toBe(false);
  });

  it("does not allow email/name combinations assembled from different fixtures", () => {
    expect(
      isSeedFixtureIdentity(seedSellers[0].email, seedSellers[1].name),
    ).toBe(false);
  });

  it("requires exact case-sensitive fixture identity values", () => {
    expect(
      isSeedFixtureIdentity(
        seedSellers[0].email.toUpperCase(),
        seedSellers[0].name,
      ),
    ).toBe(false);
    expect(
      isSeedFixtureIdentity(
        seedSellers[0].email,
        seedSellers[0].name.toUpperCase(),
      ),
    ).toBe(false);
  });
});
