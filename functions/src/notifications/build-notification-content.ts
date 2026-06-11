import { BuiltNotificationContent, NotificationEventData } from "./types";

function stringFromPayload(
  payload: Record<string, unknown> | undefined,
  key: string,
  fallback = "",
) {
  const value = payload?.[key];
  return typeof value === "string" ? value : fallback;
}

export function buildNotificationContent(
  eventData: NotificationEventData,
): BuiltNotificationContent {
  const payload = eventData.payload ?? {};

  if (eventData.type === "VIRTUAL_CLASS_SCHEDULED") {
    return {
      title: "تمت جدولة حصة افتراضية",
      body: "لديك حصة افتراضية جديدة.",
      targetRoute: "VIRTUAL_CLASS_SESSION",
      targetParams: {
        sessionId: eventData.sourceId ?? "",
        classId: eventData.targetClassId ?? "",
      },
      data: {
        type: eventData.type,
        sourceType: eventData.sourceType ?? "",
        sourceId: eventData.sourceId ?? "",
        targetRoute: "VIRTUAL_CLASS_SESSION",
      },
      channels: ["IN_APP", "PUSH"],
    };
  }

  if (eventData.type === "CHAT_MESSAGE_CREATED") {
    return {
      title: "رسالة جديدة",
      body: "لديك رسالة جديدة من المدرسة.",
      targetRoute: "CHAT_CONVERSATION",
      targetParams: {
        conversationId:
          eventData.targetConversationId ||
          stringFromPayload(payload, "conversationId"),
        threadId: eventData.targetThreadId ?? "",
        messageId: eventData.sourceId ?? "",
      },
      data: {
        type: eventData.type,
        sourceType: eventData.sourceType ?? "",
        sourceId: eventData.sourceId ?? "",
        conversationId:
          eventData.targetConversationId ||
          stringFromPayload(payload, "conversationId"),
        threadId: eventData.targetThreadId ?? "",
        targetRoute: "CHAT_CONVERSATION",
      },
      channels: ["IN_APP", "PUSH"],
    };
  }

  if (eventData.type === "HOMEWORK_PUBLISHED") {
    return {
      title: "واجب جديد",
      body: "تم نشر واجب جديد.",
      targetRoute: "HOMEWORK_ASSIGNMENT",
      targetParams: {
        homeworkId: eventData.sourceId ?? "",
        classId: eventData.targetClassId ?? "",
      },
      data: {
        type: eventData.type,
        sourceType: eventData.sourceType ?? "",
        sourceId: eventData.sourceId ?? "",
        targetRoute: "HOMEWORK_ASSIGNMENT",
      },
      channels: ["IN_APP", "PUSH"],
    };
  }

  if (eventData.type === "GENERAL_ANNOUNCEMENT_PUBLISHED") {
    return {
      title: stringFromPayload(payload, "title", "تعميم جديد"),
      body: stringFromPayload(payload, "body", "لديك تعميم جديد من المدرسة."),
      targetRoute: "ANNOUNCEMENT",
      targetParams: {
        announcementId: eventData.sourceId ?? "",
      },
      data: {
        type: eventData.type,
        sourceType: eventData.sourceType ?? "",
        sourceId: eventData.sourceId ?? "",
        targetRoute: "ANNOUNCEMENT",
      },
      channels: ["IN_APP", "PUSH"],
    };
  }

  if (
    eventData.type === "FINANCE_INVOICE_ISSUED" ||
    eventData.type === "FINANCE_PAYMENT_DUE" ||
    eventData.type === "FINANCE_PAYMENT_REMINDER" ||
    eventData.type === "FINANCE_BALANCE_UPDATED"
  ) {
    return {
      title: "إشعار مالي",
      body: "لديك تحديث مالي من المدرسة.",
      targetRoute: "FINANCE",
      targetParams: {
        sourceType: eventData.sourceType ?? "",
        sourceId: eventData.sourceId ?? "",
        studentId: eventData.targetStudentId ?? "",
      },
      data: {
        type: eventData.type,
        sourceType: eventData.sourceType ?? "",
        sourceId: eventData.sourceId ?? "",
        targetRoute: "FINANCE",
        studentId: eventData.targetStudentId ?? "",
      },
      channels: ["IN_APP", "PUSH"],
    };
  }

  if (eventData.type === "FINANCE_PAYMENT_RECEIVED") {
    return {
      title: "تم تسجيل دفعة",
      body: "تم تحديث السجل المالي.",
      targetRoute: "FINANCE",
      targetParams: {
        sourceType: eventData.sourceType ?? "",
        sourceId: eventData.sourceId ?? "",
        studentId: eventData.targetStudentId ?? "",
      },
      data: {
        type: eventData.type,
        sourceType: eventData.sourceType ?? "",
        sourceId: eventData.sourceId ?? "",
        targetRoute: "FINANCE",
        studentId: eventData.targetStudentId ?? "",
      },
      channels: ["IN_APP", "PUSH"],
    };
  }

  return {
    title: "إشعار جديد",
    body: "لديك تحديث جديد في المنصة.",
    targetRoute: "NOTIFICATION_DETAILS",
    targetParams: {
      sourceType: eventData.sourceType ?? "",
      sourceId: eventData.sourceId ?? "",
    },
    data: {
      type: eventData.type ?? "CUSTOM",
      sourceType: eventData.sourceType ?? "",
      sourceId: eventData.sourceId ?? "",
      targetRoute: "NOTIFICATION_DETAILS",
    },
    channels: ["IN_APP", "PUSH"],
  };
}
