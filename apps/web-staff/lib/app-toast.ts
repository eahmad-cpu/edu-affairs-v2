"use client";

import { toast, type ExternalToast } from "sonner";

import { getErrorMessage } from "@/lib/error-message";

type ToastOptions = ExternalToast;

function success(message: string, options?: ToastOptions) {
  return toast.success(message, options);
}

function error(message: string, options?: ToastOptions) {
  return toast.error(message, options);
}

function warning(message: string, options?: ToastOptions) {
  return toast.warning(message, options);
}

function info(message: string, options?: ToastOptions) {
  return toast.info(message, options);
}

/** Shows a safe Arabic message while retaining the original error in DevTools. */
function showErrorToast(errorValue: unknown, options?: ToastOptions) {
  console.error("Web-staff operation failed:", errorValue);
  return toast.error(getErrorMessage(errorValue), options);
}

export const appToast = {
  success,
  error,
  warning,
  info,
  showErrorToast,
};

export { showErrorToast };
