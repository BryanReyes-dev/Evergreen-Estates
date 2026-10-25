const GENERIC_SIGN_UP_ERROR = "Your account could not be created. Check the details or try signing in.";

/** Turn known Better Auth signup errors into actionable messages for the user. */
export function getSignUpErrorMessage(code?: string | null): string {
  if (code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
    return "An account with this email already exists. Switch to Sign in. If you do not remember the password, use Forgot password on the sign-in screen.";
  }

  return GENERIC_SIGN_UP_ERROR;
}
