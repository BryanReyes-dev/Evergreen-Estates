import { seedSellers } from "./data";

/**
 * Script-only allowlist for synthetic demo identities.
 * Never import this in a request handler or public auth route.
 */
export function isSeedFixtureIdentity(email: string, name: string): boolean {
  return seedSellers.some((seller) => seller.email === email && seller.name === name);
}
