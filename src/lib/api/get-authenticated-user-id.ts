
import "server-only";
import { getAuth } from "@/lib/auth";

/**
 * Return the canonical user ID from a verified Better Auth session.
 * Never derive identity from request-body fields or URL parameters.
*/

export async function getAuthenticatedUserId(
  request: Request,
): Promise<string | null> {
  const session = await getAuth().api.getSession({
    headers: request.headers,
  });

  return session?.user.id ?? null;
}
