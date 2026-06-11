import type {
  MembershipRole,
  OperationalAssignment,
  StudentTransportAttendanceRecord,
  StudentTransportEnrollment,
  TransportAttendanceBatch,
  TransportAttendanceBatchRecordRef,
  TransportAttendanceBatchRecordRefStatus,
  TransportAttendanceBatchStatus,
  TransportAttendanceBatchStudentRow,
  TransportAttendanceBatchStudentRowStatus,
  TransportAttendanceStatus,
  TransportTripDirection,
} from "@takween/contracts";

export type TransportRouteLike = {
  id: string;
  orgId: string;
  schoolId?: string;
  title?: string;
  name?: string;
  isArchived?: boolean;
};

export type TransportTargetStudent = {
  studentId: string;
  studentDisplayName?: string;
  enrollmentId?: string;
  transportEnrollmentId?: string;
};

export type BuildTransportAttendanceBatchParams = {
  id: string;
  orgId: string;
  schoolId: string;
  academicYearId: string;
  schoolDayId: string;

  routeId: string;
  tripDirection: TransportTripDirection;

  scopeId?: string;

  status?: TransportAttendanceBatchStatus;

  createdByPersonId: string;
  createdByRoleKey: MembershipRole;

  operationalAssignmentId?: string;

  recordedAt?: number;
  submittedAt?: number;
  reviewedAt?: number;
  lockedAt?: number;
  cancelledAt?: number;

  students: TransportTargetStudent[];
  rows?: TransportAttendanceBatchStudentRow[];

  notes?: string;

  nowMs?: number;
};

export type TransportAttendanceStatusCounts = Record<
  TransportAttendanceStatus,
  number
>;

export type TransportAttendanceBatchSummary = {
  targetCount: number;
  completedCount: number;
  missingCount: number;
  pendingCount: number;

  boardedCount: number;
  notBoardedCount: number;
  droppedOffCount: number;
  notDroppedOffCount: number;
  excusedCount: number;

  completionPercentage: number;
  successPercentage: number;
  issuePercentage: number;

  statusCounts: TransportAttendanceStatusCounts;
};

function createEmptyTransportStatusCounts(): TransportAttendanceStatusCounts {
  return {
    BOARDED: 0,
    NOT_BOARDED: 0,
    DROPPED_OFF: 0,
    NOT_DROPPED_OFF: 0,
    EXCUSED: 0,
  };
}

function getExpectedCompletedStatus(
  tripDirection: TransportTripDirection,
): TransportAttendanceStatus {
  return tripDirection === "MORNING_TO_SCHOOL"
    ? "BOARDED"
    : "DROPPED_OFF";
}

function getExpectedIssueStatus(
  tripDirection: TransportTripDirection,
): TransportAttendanceStatus {
  return tripDirection === "MORNING_TO_SCHOOL"
    ? "NOT_BOARDED"
    : "NOT_DROPPED_OFF";
}

function isCompletedTransportRow(row: TransportAttendanceBatchStudentRow) {
  return row.completed === true || row.rowStatus === "COMPLETED";
}

function isMissingTransportRow(row: TransportAttendanceBatchStudentRow) {
  return row.rowStatus === "EXCUSED" || row.rowStatus === "SKIPPED";
}

function normalizeTransportRow(params: {
  student: TransportTargetStudent;
  tripDirection: TransportTripDirection;
}): TransportAttendanceBatchStudentRow {
  return {
    studentId: params.student.studentId,
    studentDisplayName: params.student.studentDisplayName ?? "",
    enrollmentId: params.student.enrollmentId ?? "",
    transportEnrollmentId: params.student.transportEnrollmentId ?? "",

    status: getExpectedCompletedStatus(params.tripDirection),
    rowStatus: "PENDING",

    note: "",

    completed: false,
    recordId: "",
  };
}

function buildTransportRecordRef(params: {
  row: TransportAttendanceBatchStudentRow;
  status: TransportAttendanceBatchRecordRefStatus;
}): TransportAttendanceBatchRecordRef {
  return {
    studentId: params.row.studentId,
    transportEnrollmentId: params.row.transportEnrollmentId ?? "",
    recordId: params.row.recordId ?? "",
    status: params.status,
  };
}

export function getVisibleRoutesForActor(params: {
  actorPersonId: string;
  routes: TransportRouteLike[];
  operationalAssignments: OperationalAssignment[];
  nowMs?: number;
}): TransportRouteLike[] {
  const nowMs = params.nowMs ?? Date.now();

  const routeIds = new Set<string>();

  for (const assignment of params.operationalAssignments) {
    if (assignment.actorPersonId !== params.actorPersonId) continue;
    if (assignment.isActive === false) continue;
    if (assignment.status === "ENDED" || assignment.status === "SUSPENDED") {
      continue;
    }

    if (typeof assignment.startAt === "number" && assignment.startAt > nowMs) {
      continue;
    }

    if (typeof assignment.endAt === "number" && assignment.endAt < nowMs) {
      continue;
    }

    if (assignment.operationKind !== "TRANSPORT_ATTENDANCE") continue;

    if (assignment.scopeType === "ROUTE" && assignment.scopeId) {
      routeIds.add(assignment.scopeId);
    }

    for (const routeId of assignment.targetRouteIds) {
      routeIds.add(routeId);
    }
  }

  return params.routes
    .filter((route) => routeIds.has(route.id))
    .filter((route) => route.isArchived !== true);
}

export function getRouteStudents(params: {
  routeId: string;
  enrollments: StudentTransportEnrollment[];
  students?: TransportTargetStudent[];
  nowMs?: number;
}): TransportTargetStudent[] {
  const nowMs = params.nowMs ?? Date.now();
  const studentMap = new Map<string, TransportTargetStudent>();

  for (const student of params.students ?? []) {
    studentMap.set(student.studentId, student);
  }

  return params.enrollments
    .filter((enrollment) => {
      if (enrollment.routeId !== params.routeId) return false;
      if (enrollment.status !== "ACTIVE") return false;
      if (typeof enrollment.startAt === "number" && enrollment.startAt > nowMs) {
        return false;
      }
      if (typeof enrollment.endAt === "number" && enrollment.endAt < nowMs) {
        return false;
      }

      return true;
    })
    .map((enrollment) => {
      const student = studentMap.get(enrollment.studentId);

      return {
        studentId: enrollment.studentId,
        studentDisplayName: student?.studentDisplayName ?? "",
        enrollmentId: enrollment.enrollmentId,
        transportEnrollmentId: enrollment.id,
      };
    });
}

export function canRecordTransportAttendance(params: {
  actorPersonId: string;
  routeId: string;
  operationalAssignments: OperationalAssignment[];
  nowMs?: number;
}): boolean {
  const visibleRoutes = getVisibleRoutesForActor({
    actorPersonId: params.actorPersonId,
    routes: [
      {
        id: params.routeId,
        orgId: "",
      },
    ],
    operationalAssignments: params.operationalAssignments,
    nowMs: params.nowMs,
  });

  return visibleRoutes.some((route) => route.id === params.routeId);
}

export function buildTransportAttendanceBatch(
  params: BuildTransportAttendanceBatchParams,
): TransportAttendanceBatch {
  const nowMs = params.nowMs ?? Date.now();

  const rows =
    params.rows ??
    params.students.map((student) =>
      normalizeTransportRow({
        student,
        tripDirection: params.tripDirection,
      }),
    );

  const summary = calculateTransportBatchSummary({
    rows,
    targetCount: params.students.length,
  });

  const recordRefs = rows.map((row) => {
    if (isCompletedTransportRow(row)) {
      return buildTransportRecordRef({
        row,
        status: "COMPLETED",
      });
    }

    if (isMissingTransportRow(row)) {
      return buildTransportRecordRef({
        row,
        status: "MISSING",
      });
    }

    return buildTransportRecordRef({
      row,
      status: "PENDING",
    });
  });

  return {
    id: params.id,
    orgId: params.orgId,
    schoolId: params.schoolId,
    academicYearId: params.academicYearId,
    schoolDayId: params.schoolDayId,

    routeId: params.routeId,
    tripDirection: params.tripDirection,

    scopeType: "ROUTE",
    scopeId: params.scopeId ?? params.routeId,

    status: params.status ?? "DRAFT",

    createdByPersonId: params.createdByPersonId,
    createdByRoleKey: params.createdByRoleKey,

    operationalAssignmentId: params.operationalAssignmentId ?? "",

    recordedAt: params.recordedAt,
    submittedAt: params.submittedAt,
    reviewedAt: params.reviewedAt,
    lockedAt: params.lockedAt,
    cancelledAt: params.cancelledAt,

    targetStudentIds: params.students.map((student) => student.studentId),
    targetCount: summary.targetCount,
    completedCount: summary.completedCount,
    missingCount: summary.missingCount,

    studentRows: rows,
    recordRefs,

    notes: params.notes ?? "",

    createdAt: nowMs,
    updatedAt: nowMs,
  };
}

export function buildTransportRecordsFromBatch(params: {
  batch: TransportAttendanceBatch;
  rows?: TransportAttendanceBatchStudentRow[];
  recordedAt?: number;
  nowMs?: number;
}): StudentTransportAttendanceRecord[] {
  const nowMs = params.nowMs ?? Date.now();
  const recordedAt = params.recordedAt ?? params.batch.recordedAt ?? nowMs;
  const rows = params.rows ?? params.batch.studentRows;

  return rows
    .filter((row) => isCompletedTransportRow(row))
    .map((row) => {
      return {
        id: row.recordId || `${params.batch.id}-${row.studentId}`,
        orgId: params.batch.orgId,
        schoolId: params.batch.schoolId,
        academicYearId: params.batch.academicYearId,
        schoolDayId: params.batch.schoolDayId,

        studentId: row.studentId,
        enrollmentId: row.enrollmentId,
        transportEnrollmentId: row.transportEnrollmentId,
        routeId: params.batch.routeId,

        tripDirection: params.batch.tripDirection,
        status: row.status,
        batchId: params.batch.id,

        recordedByPersonId: params.batch.createdByPersonId,
        recorderRoleKey: params.batch.createdByRoleKey,
        recordedAt,

        note: row.note,

        createdAt: nowMs,
        updatedAt: nowMs,
      };
    });
}

export function calculateTransportBatchSummary(params: {
  rows: TransportAttendanceBatchStudentRow[];
  targetCount?: number;
}): TransportAttendanceBatchSummary {
  const statusCounts = createEmptyTransportStatusCounts();

  let completedCount = 0;
  let missingCount = 0;

  for (const row of params.rows) {
    if (isCompletedTransportRow(row)) {
      completedCount += 1;
      statusCounts[row.status] += 1;
      continue;
    }

    if (isMissingTransportRow(row)) {
      missingCount += 1;
    }
  }

  const targetCount = Math.max(params.targetCount ?? params.rows.length, 0);
  const pendingCount = Math.max(0, targetCount - completedCount - missingCount);

  const boardedCount = statusCounts.BOARDED;
  const notBoardedCount = statusCounts.NOT_BOARDED;
  const droppedOffCount = statusCounts.DROPPED_OFF;
  const notDroppedOffCount = statusCounts.NOT_DROPPED_OFF;
  const excusedCount = statusCounts.EXCUSED;

  const successCount = boardedCount + droppedOffCount;
  const issueCount = notBoardedCount + notDroppedOffCount;

  const completionPercentage =
    targetCount === 0 ? 0 : Math.round((completedCount / targetCount) * 100);

  const successPercentage =
    targetCount === 0 ? 0 : Math.round((successCount / targetCount) * 100);

  const issuePercentage =
    targetCount === 0 ? 0 : Math.round((issueCount / targetCount) * 100);

  return {
    targetCount,
    completedCount,
    missingCount,
    pendingCount,

    boardedCount,
    notBoardedCount,
    droppedOffCount,
    notDroppedOffCount,
    excusedCount,

    completionPercentage,
    successPercentage,
    issuePercentage,

    statusCounts,
  };
}

export function calculateTransportStatusCounts(params: {
  records: StudentTransportAttendanceRecord[];
}): TransportAttendanceStatusCounts {
  const statusCounts = createEmptyTransportStatusCounts();

  for (const record of params.records) {
    statusCounts[record.status] += 1;
  }

  return statusCounts;
}

export function updateTransportRow(params: {
  row: TransportAttendanceBatchStudentRow;
  status: TransportAttendanceStatus;
  rowStatus?: TransportAttendanceBatchStudentRowStatus;
  note?: string;
}): TransportAttendanceBatchStudentRow {
  return {
    ...params.row,
    status: params.status,
    rowStatus: params.rowStatus ?? "COMPLETED",
    note: params.note ?? params.row.note,
    completed: true,
  };
}

export function markTransportRowAsIssue(params: {
  row: TransportAttendanceBatchStudentRow;
  tripDirection: TransportTripDirection;
  note?: string;
}): TransportAttendanceBatchStudentRow {
  return updateTransportRow({
    row: params.row,
    status: getExpectedIssueStatus(params.tripDirection),
    note: params.note,
  });
}

export function markTransportRowAsSuccess(params: {
  row: TransportAttendanceBatchStudentRow;
  tripDirection: TransportTripDirection;
  note?: string;
}): TransportAttendanceBatchStudentRow {
  return updateTransportRow({
    row: params.row,
    status: getExpectedCompletedStatus(params.tripDirection),
    note: params.note,
  });
}