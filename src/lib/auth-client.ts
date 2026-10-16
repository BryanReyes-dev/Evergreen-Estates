import { createAuthClient } from "better-auth/react";

// The client uses the same-origin /api/auth endpoint by default.
export const authClient = createAuthClient();
