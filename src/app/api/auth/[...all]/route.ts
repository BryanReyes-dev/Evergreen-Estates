import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/lib/auth";

// Initialize Better Auth on the first request rather than at module import,
// allowing Next.js builds to complete before the auth DB credentials are set.
export async function GET(request: Request) {
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request: Request) {
  return toNextJsHandler(getAuth()).POST(request);
}
