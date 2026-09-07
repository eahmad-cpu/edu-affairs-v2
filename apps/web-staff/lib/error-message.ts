type ErrorWithDetails = {
  code?: unknown;
  message?: unknown;
};

const PERMISSION_MESSAGE =
  "ليس لديك صلاحية للوصول إلى هذه البيانات أو تنفيذ هذا الإجراء.";
const SESSION_MESSAGE =
  "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى.";
const SERVICE_UNAVAILABLE_MESSAGE =
  "تعذر الاتصال بالخدمة حاليًا. حاول مرة أخرى بعد قليل.";
const NOT_FOUND_MESSAGE = "البيانات المطلوبة غير موجودة أو تم حذفها.";
const ALREADY_EXISTS_MESSAGE = "هذا السجل موجود بالفعل.";
const FAILED_PRECONDITION_MESSAGE =
  "لا يمكن تنفيذ هذا الإجراء في الحالة الحالية.";
const TIMEOUT_MESSAGE =
  "استغرقت العملية وقتًا أطول من المتوقع. حاول مرة أخرى.";
const NETWORK_MESSAGE =
  "تعذر الاتصال بالإنترنت. تحقق من الاتصال ثم حاول مجددًا.";
const UNKNOWN_MESSAGE =
  "تعذر إكمال العملية. حاول مرة أخرى، وإذا استمرت المشكلة فتواصل مع الإدارة.";

export type ErrorDetails = {
  code: string;
  message: string;
};

export function getErrorDetails(error: unknown): ErrorDetails {
  if (typeof error === "string") {
    return { code: "", message: error };
  }

  if (!error || typeof error !== "object") {
    return { code: "", message: "" };
  }

  const value = error as ErrorWithDetails;

  return {
    code: typeof value.code === "string" ? value.code.trim().toLowerCase() : "",
    message:
      typeof value.message === "string"
        ? value.message.trim()
        : error instanceof Error
          ? error.message
          : "",
  };
}

function hasCode(code: string, ...values: string[]) {
  return values.some(
    (value) => code === value || code.endsWith(`/${value}`),
  );
}

function includesAny(value: string, fragments: string[]) {
  return fragments.some((fragment) => value.includes(fragment));
}

/**
 * Converts Firebase and browser errors into safe Arabic messages for staff.
 * The original error must remain available to developer diagnostics separately.
 */
export function getErrorMessage(error: unknown): string {
  const { code, message } = getErrorDetails(error);
  const normalizedMessage = message.toLowerCase();

  if (
    hasCode(code, "permission-denied") ||
    includesAny(normalizedMessage, [
      "missing or insufficient permissions",
      "permission denied",
      "permission-denied",
      "insufficient permissions",
    ])
  ) {
    return PERMISSION_MESSAGE;
  }

  if (
    hasCode(
      code,
      "unauthenticated",
      "user-token-expired",
      "id-token-expired",
      "invalid-user-token",
      "requires-recent-login",
    ) ||
    includesAny(normalizedMessage, [
      "unauthenticated",
      "session expired",
      "user token expired",
      "id token expired",
    ])
  ) {
    return SESSION_MESSAGE;
  }

  if (
    hasCode(code, "unavailable") ||
    includesAny(normalizedMessage, [
      "service unavailable",
      "service is unavailable",
      "currently unavailable",
      "temporarily unavailable",
    ])
  ) {
    return SERVICE_UNAVAILABLE_MESSAGE;
  }

  if (hasCode(code, "not-found") || normalizedMessage.includes("not found")) {
    return NOT_FOUND_MESSAGE;
  }
  if (
    hasCode(code, "already-exists") ||
    normalizedMessage.includes("already exists")
  ) {
    return ALREADY_EXISTS_MESSAGE;
  }
  if (
    hasCode(code, "failed-precondition") ||
    normalizedMessage.includes("failed precondition")
  ) {
    return FAILED_PRECONDITION_MESSAGE;
  }
  if (
    hasCode(code, "deadline-exceeded", "timeout") ||
    includesAny(normalizedMessage, ["deadline exceeded", "timed out", "timeout"])
  ) {
    return TIMEOUT_MESSAGE;
  }

  if (
    hasCode(code, "network-request-failed", "network-error") ||
    includesAny(normalizedMessage, [
      "network request failed",
      "failed to fetch",
      "networkerror",
      "network error",
      "internet connection",
      "offline",
    ])
  ) {
    return NETWORK_MESSAGE;
  }

  return UNKNOWN_MESSAGE;
}
