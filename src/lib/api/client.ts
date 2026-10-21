/**
 * Small client-side helpers for the application's JSON Route Handler responses.
 *
 * The API currently returns both structured errors ({ error: { message } }) and
 * short error codes ({ error: "CODE" }). Normalize both without leaking raw
 * server exceptions into the interface.
 */

type ErrorPayload = {
  error?: string | { code?: string; message?: string };
  message?: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Please sign in and try again.",
  INVALID_JSON: "The request could not be read. Check the fields and try again.",
  INVALID_REQUEST_BODY: "Some form data is invalid. Check the fields and try again.",
  SELLER_PROFILE_REQUIRED: "Create your seller profile before creating a listing.",
  SELLER_PROFILE_EXISTS: "A seller profile already exists for this account.",
  SELLER_PROFILE_NOT_FOUND: "No seller profile was found for this account.",
  SELLER_HAS_LISTINGS: "Delete your listings before deleting your seller profile.",
  LISTING_LIMIT_REACHED: "A seller can own at most three listings.",
  REVIEW_ALREADY_EXISTS: "You have already reviewed this listing.",
  REVIEW_NOT_FOUND: "This review is no longer available.",
  LISTING_NOT_FOUND: "This listing is no longer available or you do not own it.",
  INVALID_CONTACT_CONFIGURATION:
    "Add a contact detail for your selected preferred contact method.",
  INVALID_CONTACT_EMAIL: "Enter a valid contact email address.",
  INVALID_CONTACT_PHONE: "Enter a valid contact phone number.",
  INVALID_PREFERRED_CONTACT_METHOD: "Choose email or phone as your preferred contact method.",
  INVALID_IS_PUBLISHED: "The profile visibility setting is invalid.",
  LISTING_DELETE_FAILED: "The listing could not be deleted. Try again.",
  REVIEW_CREATE_FAILED: "Your review could not be saved. Try again.",
  REVIEW_UPDATE_FAILED: "Your review could not be updated. Try again.",
  REVIEW_DELETE_FAILED: "Your review could not be deleted. Try again.",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeErrorMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  const error = payload.error;
  if (typeof error === "string") {
    return ERROR_MESSAGES[error] ?? fallback;
  }

  if (isRecord(error)) {
    if (typeof error.message === "string" && error.message.trim()) {
      return error.message;
    }

    if (typeof error.code === "string") {
      return ERROR_MESSAGES[error.code] ?? fallback;
    }
  }

  return fallback;
}

/** Parse a successful response with a { data: ... } envelope. */
export async function readApiData<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(normalizeErrorMessage(payload, fallbackMessage));
  }

  if (isRecord(payload) && "data" in payload) {
    return payload.data as T;
  }

  throw new Error(fallbackMessage);
}

/** Check a successful response, including 204 No Content delete responses. */
export async function ensureApiSuccess(
  response: Response,
  fallbackMessage: string,
): Promise<void> {
  const payload: unknown =
    response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(normalizeErrorMessage(payload, fallbackMessage));
  }
}
