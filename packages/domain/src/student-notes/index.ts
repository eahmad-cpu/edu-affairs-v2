import type { MembershipRole, StudentNote } from "@takween/contracts";
import { resolveTermContext, type TermContextInput } from "../term-context";

export type StudentNoteStudentInput = {
  studentId: string;
  studentDisplayName?: string;
  enrollmentId?: string;
  gradeId?: string;
  classId?: string;
  classSubjectOfferingId?: string;
};

export type BuildStudentNoteInput = {
  id: string;

  orgId: string;
  schoolId: string;
  academicYearId: string;
  termContext?: TermContextInput;
  studentId: string;
  enrollmentId?: string;
  gradeId?: string;
  classId?: string;
  classSubjectOfferingId?: string;
  category?: StudentNote["category"];
  priority?: StudentNote["priority"];
  visibility?: StudentNote["visibility"];
  status?: StudentNote["status"];

  groupNoteId?: string;

  title?: string;
  body: string;

  recordedByPersonId: string;
  recordedByRoleKey?: MembershipRole;
  recordedAt?: number;

  followUpStatus?: StudentNote["followUpStatus"];
  followUpAt?: number;
  followUpByPersonId?: string;
  followUpNote?: string;

  sourceType?: StudentNote["sourceType"];
  sourceId?: string;
  sourcePath?: string;

  linkedCaseId?: string;
  linkedAttendanceBatchId?: string;
  linkedAttendanceRecordId?: string;
  linkedTransportAttendanceRecordId?: string;
  linkedAssessmentRecordId?: string;
  linkedMeasurementBatchId?: string;
  linkedTrackerEntryId?: string;
  linkedLearningLossPlanId?: string;

  tags?: string[];

  now: number;
};

export type BuildGroupStudentNotesInput = {
  idPrefix: string;
  groupNoteId?: string;

  orgId: string;
  schoolId: string;
  academicYearId: string;
  termContext?: TermContextInput;
  classSubjectOfferingId?: string;

  students: StudentNoteStudentInput[];

  category?: StudentNote["category"];
  priority?: StudentNote["priority"];
  visibility?: StudentNote["visibility"];
  status?: StudentNote["status"];

  title?: string;
  body: string;

  recordedByPersonId: string;
  recordedByRoleKey?: MembershipRole;
  recordedAt?: number;

  followUpStatus?: StudentNote["followUpStatus"];
  followUpAt?: number;
  followUpByPersonId?: string;
  followUpNote?: string;

  sourceType?: StudentNote["sourceType"];
  sourceId?: string;
  sourcePath?: string;

  linkedCaseId?: string;
  linkedAttendanceBatchId?: string;
  linkedAttendanceRecordId?: string;
  linkedTransportAttendanceRecordId?: string;
  linkedAssessmentRecordId?: string;
  linkedMeasurementBatchId?: string;
  linkedTrackerEntryId?: string;
  linkedLearningLossPlanId?: string;

  tags?: string[];

  now: number;
};

export type StudentNoteValidationResult = {
  ok: boolean;
  errors: string[];
};

export type StudentNoteSummary = {
  totalCount: number;
  activeCount: number;
  needsFollowUpCount: number;
  resolvedCount: number;
  archivedCount: number;
  cancelledCount: number;

  infoCount: number;
  followUpCount: number;
  importantCount: number;
  urgentCount: number;
};

export function normalizeStudentNoteTags(tags: string[] = []): string[] {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => tag.toLowerCase()),
    ),
  );
}

export function createStudentNoteGroupId(params: {
  orgId: string;
  classId?: string;
  recordedAt: number;
  idPrefix?: string;
}) {
  const scope = params.classId || "students";
  const prefix = params.idPrefix || "student-note-group";

  return `${prefix}_${params.orgId}_${scope}_${params.recordedAt}`;
}

export function resolveStudentNoteStatus(params: {
  status?: StudentNote["status"];
  followUpStatus?: StudentNote["followUpStatus"];
}): StudentNote["status"] {
  if (params.status) return params.status;

  if (params.followUpStatus === "NEEDED") {
    return "NEEDS_FOLLOW_UP";
  }

  return "ACTIVE";
}

export function validateStudentNoteInput(
  input: Pick<
    BuildStudentNoteInput,
    | "studentId"
    | "body"
    | "recordedByPersonId"
    | "followUpStatus"
    | "followUpAt"
    | "status"
    | "sourceType"
    | "sourceId"
  >,
): StudentNoteValidationResult {
  const errors: string[] = [];

  if (!input.studentId.trim()) {
    errors.push("يجب تحديد الطالب.");
  }

  if (!input.body.trim()) {
    errors.push("يجب كتابة نص الملاحظة.");
  }

  if (!input.recordedByPersonId.trim()) {
    errors.push("يجب تحديد من سجّل الملاحظة.");
  }

  if (input.followUpStatus === "NEEDED" && !input.followUpAt) {
    errors.push("يجب تحديد تاريخ المتابعة عند طلب متابعة لاحقة.");
  }

  if (input.status === "NEEDS_FOLLOW_UP" && input.followUpStatus !== "NEEDED") {
    errors.push(
      "إذا كانت الملاحظة تحتاج متابعة فيجب جعل followUpStatus = NEEDED.",
    );
  }

  if (input.sourceType && input.sourceType !== "MANUAL" && !input.sourceId) {
    errors.push("يجب تحديد sourceId عند ربط الملاحظة بمصدر غير يدوي.");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function buildStudentNote(input: BuildStudentNoteInput): StudentNote {
  const followUpStatus = input.followUpStatus ?? "NONE";
  const status = resolveStudentNoteStatus({
    status: input.status,
    followUpStatus,
  });

  const validation = validateStudentNoteInput({
    studentId: input.studentId,
    body: input.body,
    recordedByPersonId: input.recordedByPersonId,
    followUpStatus,
    followUpAt: input.followUpAt,
    status,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
  });

  if (!validation.ok) {
    throw new Error(validation.errors.join(" "));
  }

  return {
    id: input.id,

    orgId: input.orgId,
    schoolId: input.schoolId,
    academicYearId: input.academicYearId,
    ...resolveTermContext(input.termContext),
    studentId: input.studentId,
    enrollmentId: input.enrollmentId ?? "",
    gradeId: input.gradeId ?? "",
    classId: input.classId ?? "",
    classSubjectOfferingId: input.classSubjectOfferingId ?? "",
    category: input.category ?? "GENERAL",
    priority: input.priority ?? "INFO",
    visibility: input.visibility ?? "STAFF_ONLY",
    status,

    groupNoteId: input.groupNoteId ?? "",

    title: input.title ?? "",
    body: input.body.trim(),

    recordedByPersonId: input.recordedByPersonId,
    recordedByRoleKey: input.recordedByRoleKey,
    recordedAt: input.recordedAt ?? input.now,

    followUpStatus,
    followUpAt: input.followUpAt,
    followUpByPersonId: input.followUpByPersonId ?? "",
    followUpNote: input.followUpNote ?? "",

    sourceType: input.sourceType ?? "MANUAL",
    sourceId: input.sourceId ?? "",
    sourcePath: input.sourcePath ?? "",

    linkedCaseId: input.linkedCaseId ?? "",
    linkedAttendanceBatchId: input.linkedAttendanceBatchId ?? "",
    linkedAttendanceRecordId: input.linkedAttendanceRecordId ?? "",
    linkedTransportAttendanceRecordId:
      input.linkedTransportAttendanceRecordId ?? "",
    linkedAssessmentRecordId: input.linkedAssessmentRecordId ?? "",
    linkedMeasurementBatchId: input.linkedMeasurementBatchId ?? "",
    linkedTrackerEntryId: input.linkedTrackerEntryId ?? "",
    linkedLearningLossPlanId: input.linkedLearningLossPlanId ?? "",

    tags: normalizeStudentNoteTags(input.tags),

    archivedByPersonId: "",
    cancelledByPersonId: "",
    cancelReason: "",

    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function buildGroupStudentNotes(
  input: BuildGroupStudentNotesInput,
): StudentNote[] {
  const recordedAt = input.recordedAt ?? input.now;

  const groupNoteId =
    input.groupNoteId ??
    createStudentNoteGroupId({
      orgId: input.orgId,
      classId: input.students[0]?.classId,
      recordedAt,
      idPrefix: input.idPrefix,
    });

  return input.students.map((student, index) =>
    buildStudentNote({
      id: `${input.idPrefix}_${student.studentId}_${index + 1}`,

      orgId: input.orgId,
      schoolId: input.schoolId,
      academicYearId: input.academicYearId,
      termContext: input.termContext,
      studentId: student.studentId,
      enrollmentId: student.enrollmentId ?? "",
      gradeId: student.gradeId ?? "",
      classId: student.classId ?? "",
      classSubjectOfferingId: student.classSubjectOfferingId ?? "",
      category: input.category,
      priority: input.priority,
      visibility: input.visibility,
      status: input.status,

      groupNoteId,

      title: input.title,
      body: input.body,

      recordedByPersonId: input.recordedByPersonId,
      recordedByRoleKey: input.recordedByRoleKey,
      recordedAt,

      followUpStatus: input.followUpStatus,
      followUpAt: input.followUpAt,
      followUpByPersonId: input.followUpByPersonId,
      followUpNote: input.followUpNote,

      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourcePath: input.sourcePath,

      linkedCaseId: input.linkedCaseId,
      linkedAttendanceBatchId: input.linkedAttendanceBatchId,
      linkedAttendanceRecordId: input.linkedAttendanceRecordId,
      linkedTransportAttendanceRecordId:
        input.linkedTransportAttendanceRecordId,
      linkedAssessmentRecordId: input.linkedAssessmentRecordId,
      linkedMeasurementBatchId: input.linkedMeasurementBatchId,
      linkedTrackerEntryId: input.linkedTrackerEntryId,
      linkedLearningLossPlanId: input.linkedLearningLossPlanId,

      tags: input.tags,

      now: input.now,
    }),
  );
}

export function markStudentNoteAsNeedsFollowUp(
  note: StudentNote,
  params: {
    followUpAt: number;
    followUpByPersonId?: string;
    followUpNote?: string;
    now: number;
  },
): StudentNote {
  return {
    ...note,
    status: "NEEDS_FOLLOW_UP",
    followUpStatus: "NEEDED",
    followUpAt: params.followUpAt,
    followUpByPersonId: params.followUpByPersonId ?? note.followUpByPersonId,
    followUpNote: params.followUpNote ?? note.followUpNote,
    updatedAt: params.now,
  };
}

export function markStudentNoteFollowUpInProgress(
  note: StudentNote,
  params: {
    followUpByPersonId: string;
    followUpNote?: string;
    now: number;
  },
): StudentNote {
  return {
    ...note,
    status: "NEEDS_FOLLOW_UP",
    followUpStatus: "IN_PROGRESS",
    followUpByPersonId: params.followUpByPersonId,
    followUpNote: params.followUpNote ?? note.followUpNote,
    updatedAt: params.now,
  };
}

export function cancelStudentNoteFollowUp(
  note: StudentNote,
  params: {
    followUpByPersonId: string;
    followUpNote?: string;
    now: number;
  },
): StudentNote {
  return {
    ...note,
    status: note.status === "NEEDS_FOLLOW_UP" ? "ACTIVE" : note.status,
    followUpStatus: "CANCELLED",
    followUpByPersonId: params.followUpByPersonId,
    followUpNote: params.followUpNote ?? note.followUpNote,
    updatedAt: params.now,
  };
}

export function markStudentNoteAsResolved(
  note: StudentNote,
  params: {
    followUpByPersonId?: string;
    followUpNote?: string;
    now: number;
  },
): StudentNote {
  return {
    ...note,
    status: "RESOLVED",
    followUpStatus: "DONE",
    followUpByPersonId: params.followUpByPersonId ?? note.followUpByPersonId,
    followUpNote: params.followUpNote ?? note.followUpNote,
    updatedAt: params.now,
  };
}

export function archiveStudentNote(
  note: StudentNote,
  params: {
    archivedByPersonId: string;
    now: number;
  },
): StudentNote {
  return {
    ...note,
    status: "ARCHIVED",
    archivedAt: params.now,
    archivedByPersonId: params.archivedByPersonId,
    updatedAt: params.now,
  };
}

export function cancelStudentNote(
  note: StudentNote,
  params: {
    cancelledByPersonId: string;
    cancelReason?: string;
    now: number;
  },
): StudentNote {
  return {
    ...note,
    status: "CANCELLED",
    cancelledAt: params.now,
    cancelledByPersonId: params.cancelledByPersonId,
    cancelReason: params.cancelReason ?? "",
    updatedAt: params.now,
  };
}

export function calculateStudentNotesSummary(
  notes: StudentNote[],
): StudentNoteSummary {
  return notes.reduce<StudentNoteSummary>(
    (summary, note) => {
      summary.totalCount += 1;

      switch (note.status) {
        case "ACTIVE":
          summary.activeCount += 1;
          break;
        case "NEEDS_FOLLOW_UP":
          summary.needsFollowUpCount += 1;
          break;
        case "RESOLVED":
          summary.resolvedCount += 1;
          break;
        case "ARCHIVED":
          summary.archivedCount += 1;
          break;
        case "CANCELLED":
          summary.cancelledCount += 1;
          break;
      }

      switch (note.priority) {
        case "INFO":
          summary.infoCount += 1;
          break;
        case "FOLLOW_UP":
          summary.followUpCount += 1;
          break;
        case "IMPORTANT":
          summary.importantCount += 1;
          break;
        case "URGENT":
          summary.urgentCount += 1;
          break;
      }

      return summary;
    },
    {
      totalCount: 0,
      activeCount: 0,
      needsFollowUpCount: 0,
      resolvedCount: 0,
      archivedCount: 0,
      cancelledCount: 0,

      infoCount: 0,
      followUpCount: 0,
      importantCount: 0,
      urgentCount: 0,
    },
  );
}
