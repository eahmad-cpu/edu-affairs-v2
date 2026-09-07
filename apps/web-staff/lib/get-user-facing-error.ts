import { getErrorDetails, getErrorMessage } from "@/lib/error-message";

export type UserFacingError = {
  title: string;
  message: string;
};

export function getUserFacingError(error: unknown): UserFacingError {
  const { code, message } = getErrorDetails(error);
  const userMessage = getErrorMessage(error);

  if (
    code === "permission-denied" ||
    code.endsWith("/permission-denied") ||
    /missing or insufficient permissions|permission denied|permission-denied/i.test(
      message,
    )
  ) {
    return {
      title: "لا تملك الصلاحية المطلوبة",
      message: userMessage,
    };
  }

  if (
    code === "unauthenticated" ||
    code.endsWith("/unauthenticated") ||
    /session expired|token expired|unauthenticated/i.test(message)
  ) {
    return { title: "انتهت جلسة تسجيل الدخول", message: userMessage };
  }

  return { title: "تعذر إكمال العملية", message: userMessage };
}
