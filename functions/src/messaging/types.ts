import type {
  Message,
  MessageParticipantKind,
  MessageType,
  Thread,
  ThreadScopeType,
  ThreadStatus,
  ThreadType,
} from "@takween/contracts";

export type {
  Message,
  MessageParticipantKind,
  MessageType,
  Thread,
  ThreadScopeType,
  ThreadStatus,
  ThreadType,
};

export type CreateOrGetStudentContextThreadInput = {
  orgId: string;
  schoolId: string;
  academicYearId: string;

  studentId: string;

  guardianUid: string;
  guardianPersonId?: string;
  guardianDisplayName?: string;

  targetPersonId?: string;
  targetUid?: string;
  targetRoleKey?: string;
  targetDisplayName?: string;

  classId?: string;
  gradeId?: string;
  termId?: string;

  subjectKey?: string;
  classSubjectOfferingId?: string;
};

export type SendThreadMessageInput = {
  orgId: string;
  threadId: string;
  body: string;
};

export type SendThreadMessageResult = {
  ok: true;
  threadId: string;
  messageId: string;
};