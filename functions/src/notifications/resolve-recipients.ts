import {
  NotificationEventData,
  ResolvedNotificationRecipient,
} from "./types";

/**
 * Skeleton فقط.
 *
 * الآن نحل المستلمين المباشرين فقط:
 * - targetGuardianId
 * - targetStaffPersonId
 * - targetPersonId
 *
 * لاحقًا سنضيف:
 * - أولياء أمور طلاب فصل كامل
 * - أعضاء محادثة الشات
 * - المعلمين المسندين
 * - مشرفي الباص
 */
export async function resolveRecipients(
  eventData: NotificationEventData,
): Promise<ResolvedNotificationRecipient[]> {
  const recipients: ResolvedNotificationRecipient[] = [];

  if (eventData.targetGuardianId) {
    recipients.push({
      recipientKind: "GUARDIAN",
      guardianId: eventData.targetGuardianId,
      studentId: eventData.targetStudentId ?? "",
    });
  }

  if (eventData.targetStaffPersonId) {
    recipients.push({
      recipientKind: "STAFF",
      staffPersonId: eventData.targetStaffPersonId,
      recipientPersonId: eventData.targetStaffPersonId,
    });
  }

  if (eventData.targetPersonId) {
    recipients.push({
      recipientKind: "PERSON",
      recipientPersonId: eventData.targetPersonId,
    });
  }

  if (eventData.actorUid && eventData.type === "CUSTOM") {
    recipients.push({
      recipientKind: "USER",
      recipientUid: eventData.actorUid,
      recipientPersonId: eventData.actorPersonId ?? "",
    });
  }

  return dedupeRecipients(recipients);
}

function dedupeRecipients(
  recipients: ResolvedNotificationRecipient[],
): ResolvedNotificationRecipient[] {
  const seen = new Set<string>();

  return recipients.filter((recipient) => {
    const key = [
      recipient.recipientKind,
      recipient.recipientUid ?? "",
      recipient.recipientPersonId ?? "",
      recipient.guardianId ?? "",
      recipient.staffPersonId ?? "",
      recipient.studentId ?? "",
    ].join(":");

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}