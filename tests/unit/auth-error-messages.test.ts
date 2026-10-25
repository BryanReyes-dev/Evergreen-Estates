import { describe, expect, it } from "vite-plus/test";

import { getSignUpErrorMessage } from "@/lib/auth-error-messages";

describe("signup error messages", () => {
  it("explains duplicate-email signup failures and gives an actionable recovery path", () => {
    expect(getSignUpErrorMessage("USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")).toBe(
      "An account with this email already exists. Switch to Sign in. If you do not remember the password, use Forgot password on the sign-in screen.",
    );
  });

  it("uses a generic message for other signup failures", () => {
    expect(getSignUpErrorMessage("INTERNAL_SERVER_ERROR")).toBe(
      "Your account could not be created. Check the details or try signing in.",
    );
    expect(getSignUpErrorMessage()).toBe(
      "Your account could not be created. Check the details or try signing in.",
    );
  });
});
