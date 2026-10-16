import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/lib/auth";

// Keep initialization lazy so builds don't require the auth DB credentials.
// Cache the wrapper after the first request instead of constructing it per request.
type AuthHandlers = ReturnType<typeof toNextJsHandler>;

let authHandlers: AuthHandlers | undefined;

function getAuthHandlers(): AuthHandlers {
  if (!authHandlers) {
    authHandlers = toNextJsHandler(getAuth());
  }

  return authHandlers;
}

export async function GET(request: Request) {
  return getAuthHandlers().GET(request);
}

export async function POST(request: Request) {
  return getAuthHandlers().POST(request);
}
