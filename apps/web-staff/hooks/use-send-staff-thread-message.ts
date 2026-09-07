"use client";

import { useCallback, useState } from "react";
import { httpsCallable } from "firebase/functions";

import { functions } from "@/lib/firebase";
import { getErrorMessage as getSafeErrorMessage } from "@/lib/error-message";

type SendThreadMessageInput = {
  orgId: string;
  threadId: string;
  body: string;
};

type SendThreadMessageResult = {
  ok: true;
  messageId: string;
};

export function useSendStaffThreadMessage() {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const sendMessage = useCallback(
    async (input: SendThreadMessageInput) => {
      const body = input.body.trim();

      if (!input.orgId || !input.threadId || !body) {
        setError("اكتب رسالة قبل الإرسال");
        return null;
      }

      setSending(true);
      setError("");

      try {
        const callable = httpsCallable<
          SendThreadMessageInput,
          SendThreadMessageResult
        >(functions, "sendThreadMessage");

        const result = await callable({
          orgId: input.orgId,
          threadId: input.threadId,
          body,
        });

        return result.data;
      } catch (error) {
        console.error("Failed to send staff thread message:", error);
        const message = getSafeErrorMessage(error);
        setError(message);
        return null;
      } finally {
        setSending(false);
      }
    },
    [],
  );

  return {
    sendMessage,
    sending,
    error,
    clearError: () => setError(""),
  };
}
