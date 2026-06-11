import {
  resolveTermContext,
  type TermContextInput,
} from "../term-context";

import type {
  CasePriority,
  CaseStatus,
  Membership,
  MembershipRole,
  OperationalAssignment,
  StaffTask,
  StudentCase,
  StudentCaseOriginKind,
  StudentCaseRoutingActionType,
  StudentCaseRoutingEvent,
  StudentCaseType,
} from "@takween/contracts";

import type { ActorAccessContext } from "../access";
import { canRunOperation } from "../access";

export type BuildStudentCaseParams = {
  id: string;

  orgId: string;
  schoolId: string;
  academicYearId: string;
termContext?: TermContextInput;
  studentId: string;

  caseType: StudentCaseType;

  title: string;
  description?: string;

  status?: CaseStatus;
  priority?: CasePriority;
  originKind?: StudentCaseOriginKind;

  currentOwnerRoleKey?: MembershipRole;
  currentAssignedPersonId?: string;

  createdByPersonId: string;
  createdByRoleKey?: MembershipRole;

  latestNote?: string;

  guardianNotifiedOnCreate?: boolean;
  guardianNotifiedOnForward?: boolean;
  guardianNotifiedOnClose?: boolean;

  nowMs?: number;
};

export type StudentCaseSummary = {
  totalCount: number;

  openCount: number;
  inProgressCount: number;
  referredCount: number;
  resolvedCount: number;
  closedCount: number;
  cancelledCount: number;

  lowPriorityCount: number;
  mediumPriorityCount: number;
  highPriorityCount: number;
  criticalPriorityCount: number;

  assignedToMeCount: number;
  createdByMeCount: number;
};

export type StudentCaseVisibleAction =
  | "VIEW"
  | "ADD_NOTE"
  | "ASSIGN"
  | "FORWARD"
  | "RETURN"
  | "ESCALATE"
  | "RESOLVE"
  | "CLOSE"
  | "CANCEL"
  | "REOPEN";

function getMembershipRole(membership: Membership): MembershipRole | undefined {
  return membership.roleKey ?? membership.role;
}

function actorRoleKeys(context: ActorAccessContext): MembershipRole[] {
  return (context.memberships ?? [])
    .filter((membership) => membership.orgId === context.orgId)
    .filter((membership) => membership.isActive !== false)
    .map((membership) => getMembershipRole(membership))
    .filter((roleKey): roleKey is MembershipRole => !!roleKey);
}

function hasCaseManagementPermission(context: ActorAccessContext): boolean {
  return (context.memberships ?? []).some((membership) => {
    if (membership.orgId !== context.orgId) return false;
    if (membership.isActive === false) return false;

    return (
      membership.permissions?.manageCases === true ||
      membership.permissions?.manageOrg === true ||
      membership.permissions?.manageSchools === true ||
      membership.scopes?.canAccessAllSchools === true
    );
  });
}

function isActiveAssignment(params: {
  assignment: OperationalAssignment;
  actorPersonId: string;
  operationKind: "STUDENT_CASE_REFERRAL" | "STUDENT_CASE_HANDLING";
  nowMs: number;
}) {
  const { assignment, actorPersonId, operationKind, nowMs } = params;

  if (assignment.actorPersonId !== actorPersonId) return false;
  if (assignment.operationKind !== operationKind) return false;
  if (assignment.isActive === false) return false;
  if (assignment.status === "ENDED" || assignment.status === "SUSPENDED") {
    return false;
  }

  if (typeof assignment.startAt === "number" && assignment.startAt > nowMs) {
    return false;
  }

  if (typeof assignment.endAt === "number" && assignment.endAt < nowMs) {
    return false;
  }

  return true;
}

function isCaseOpenForWork(studentCase: StudentCase): boolean {
  return (
    studentCase.status === "OPEN" ||
    studentCase.status === "IN_PROGRESS" ||
    studentCase.status === "REFERRED" ||
    studentCase.status === "RESOLVED"
  );
}

function isCaseFinal(studentCase: StudentCase): boolean {
  return studentCase.status === "CLOSED" || studentCase.status === "CANCELLED";
}

function priorityToTaskPriority(priority: CasePriority): StaffTask["priority"] {
  switch (priority) {
    case "CRITICAL":
      return "URGENT";
    case "HIGH":
      return "HIGH";
    case "MEDIUM":
      return "NORMAL";
    case "LOW":
    default:
      return "LOW";
  }
}

function caseStatusToTaskStatus(status: CaseStatus): StaffTask["status"] {
  switch (status) {
    case "OPEN":
    case "REFERRED":
      return "PENDING";
    case "IN_PROGRESS":
      return "IN_PROGRESS";
    case "RESOLVED":
      return "NEEDS_REVIEW";
    case "CLOSED":
      return "COMPLETED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "PENDING";
  }
}

export function canCreateStudentCase(params: {
  context: ActorAccessContext;
  caseType?: StudentCaseType;
  classId?: string;
  originKind?: StudentCaseOriginKind;
  nowMs?: number;
}): boolean {
  if (params.caseType?.isActive === false) return false;

  if (
    params.originKind === "TEACHER_REFERRAL" &&
    params.caseType &&
    !params.caseType.allowTeacherCreate
  ) {
    return false;
  }

  if (hasCaseManagementPermission(params.context)) return true;

  return canRunOperation({
    context: params.context,
    operationKind: "STUDENT_CASE_REFERRAL",
    permission: "CREATE",
    scopeType: params.classId ? "CLASS" : undefined,
    scopeId: params.classId,
    nowMs: params.nowMs,
  });
}

export function canViewStudentCase(params: {
  context: ActorAccessContext;
  case: StudentCase;
}): boolean {
  const { context, case: studentCase } = params;

  if (studentCase.orgId !== context.orgId) return false;

  if (hasCaseManagementPermission(context)) return true;

  if (studentCase.createdByPersonId === context.actorPersonId) return true;

  if (studentCase.currentAssignedPersonId === context.actorPersonId) {
    return true;
  }

  const roles = actorRoleKeys(context);

  return roles.includes(studentCase.currentOwnerRoleKey);
}

export function canHandleStudentCase(params: {
  context: ActorAccessContext;
  case: StudentCase;
}): boolean {
  const { context, case: studentCase } = params;

  if (!canViewStudentCase(params)) return false;
  if (isCaseFinal(studentCase)) return false;

  if (hasCaseManagementPermission(context)) return true;

  if (studentCase.currentAssignedPersonId === context.actorPersonId) {
    return true;
  }

  const roles = actorRoleKeys(context);

  return roles.includes(studentCase.currentOwnerRoleKey);
}

export function canForwardStudentCase(params: {
  context: ActorAccessContext;
  case: StudentCase;
  caseType?: StudentCaseType;
  toOwnerRoleKey: MembershipRole;
}): boolean {
  if (!canHandleStudentCase(params)) return false;

  if (!params.caseType) return true;

  return params.caseType.allowedForwardToRoleKeys.includes(
    params.toOwnerRoleKey,
  );
}

export function canCloseStudentCase(params: {
  context: ActorAccessContext;
  case: StudentCase;
}): boolean {
  if (!canHandleStudentCase(params)) return false;

  return (
    params.case.status === "RESOLVED" ||
    hasCaseManagementPermission(params.context)
  );
}

export function resolveCaseInitialOwner(params: {
  caseType: StudentCaseType;
  preferredAssignedPersonId?: string;
}): {
  ownerRoleKey: MembershipRole;
  assignedPersonId: string;
} {
  return {
    ownerRoleKey: params.caseType.defaultOwnerRoleKey,
    assignedPersonId: params.preferredAssignedPersonId ?? "",
  };
}

export function buildStudentCase(params: BuildStudentCaseParams): StudentCase {
  const nowMs = params.nowMs ?? Date.now();

  const initialOwner = resolveCaseInitialOwner({
    caseType: params.caseType,
    preferredAssignedPersonId: params.currentAssignedPersonId,
  });

  return {
    id: params.id,

    orgId: params.orgId,
    schoolId: params.schoolId,
    academicYearId: params.academicYearId,
    ...resolveTermContext(params.termContext),
    studentId: params.studentId,

    caseTypeId: params.caseType.id,
    title: params.title,
    description: params.description ?? "",

    status: params.status ?? "OPEN",
    priority: params.priority ?? "MEDIUM",
    originKind: params.originKind ?? "MANUAL",

    currentOwnerRoleKey:
      params.currentOwnerRoleKey ?? initialOwner.ownerRoleKey,
    currentAssignedPersonId:
      params.currentAssignedPersonId ?? initialOwner.assignedPersonId,

    createdByPersonId: params.createdByPersonId,
    createdByRoleKey: params.createdByRoleKey,
    createdAt: nowMs,

    latestNote: params.latestNote ?? "",

    guardianNotifiedOnCreate:
      params.guardianNotifiedOnCreate ?? params.caseType.notifyGuardianOnCreate,
    guardianNotifiedOnForward: params.guardianNotifiedOnForward ?? false,
    guardianNotifiedOnClose: params.guardianNotifiedOnClose ?? false,

    resolvedAt: undefined,
    resolvedByPersonId: "",

    closedAt: undefined,
    closedByPersonId: "",

    cancelledAt: undefined,
    cancelledByPersonId: "",

    updatedAt: nowMs,
  };
}

export function buildStudentCaseRoutingEvent(params: {
  id: string;
  case: StudentCase;
  actionType: StudentCaseRoutingActionType;

  fromOwnerRoleKey?: MembershipRole;
  fromAssignedPersonId?: string;

  toOwnerRoleKey?: MembershipRole;
  toAssignedPersonId?: string;

  performedByPersonId: string;
  performedByRoleKey?: MembershipRole;

  performedAt?: number;
  note?: string;

  nowMs?: number;
}): StudentCaseRoutingEvent {
  const nowMs = params.nowMs ?? Date.now();
  const performedAt = params.performedAt ?? nowMs;

  return {
    id: params.id,
    caseId: params.case.id,
    orgId: params.case.orgId,

    actionType: params.actionType,

    fromOwnerRoleKey:
      params.fromOwnerRoleKey ?? params.case.currentOwnerRoleKey,
    fromAssignedPersonId:
      params.fromAssignedPersonId ?? params.case.currentAssignedPersonId,

    toOwnerRoleKey: params.toOwnerRoleKey,
    toAssignedPersonId: params.toAssignedPersonId ?? "",

    performedByPersonId: params.performedByPersonId,
    performedByRoleKey: params.performedByRoleKey,

    performedAt,
    note: params.note ?? "",

    createdAt: nowMs,
    updatedAt: nowMs,
  };
}

export function assignStudentCase(params: {
  case: StudentCase;
  toOwnerRoleKey?: MembershipRole;
  toAssignedPersonId?: string;
  note?: string;
  updatedAt?: number;
}): StudentCase {
  const updatedAt = params.updatedAt ?? Date.now();

  return {
    ...params.case,
    status: "IN_PROGRESS",
    currentOwnerRoleKey:
      params.toOwnerRoleKey ?? params.case.currentOwnerRoleKey,
    currentAssignedPersonId:
      params.toAssignedPersonId ?? params.case.currentAssignedPersonId,
    latestNote: params.note ?? params.case.latestNote,
    updatedAt,
  };
}

export function forwardStudentCase(params: {
  case: StudentCase;
  toOwnerRoleKey: MembershipRole;
  toAssignedPersonId?: string;
  notifyGuardian?: boolean;
  note?: string;
  updatedAt?: number;
}): StudentCase {
  const updatedAt = params.updatedAt ?? Date.now();

  return {
    ...params.case,
    status: "REFERRED",
    currentOwnerRoleKey: params.toOwnerRoleKey,
    currentAssignedPersonId: params.toAssignedPersonId ?? "",
    latestNote: params.note ?? params.case.latestNote,
    guardianNotifiedOnForward:
      params.notifyGuardian ?? params.case.guardianNotifiedOnForward,
    updatedAt,
  };
}

export function returnStudentCase(params: {
  case: StudentCase;
  toOwnerRoleKey: MembershipRole;
  toAssignedPersonId?: string;
  note?: string;
  updatedAt?: number;
}): StudentCase {
  const updatedAt = params.updatedAt ?? Date.now();

  return {
    ...params.case,
    status: "REFERRED",
    currentOwnerRoleKey: params.toOwnerRoleKey,
    currentAssignedPersonId: params.toAssignedPersonId ?? "",
    latestNote: params.note ?? params.case.latestNote,
    updatedAt,
  };
}

export function resolveStudentCase(params: {
  case: StudentCase;
  resolvedByPersonId: string;
  note?: string;
  resolvedAt?: number;
  autoClose?: boolean;
}): StudentCase {
  const resolvedAt = params.resolvedAt ?? Date.now();

  return {
    ...params.case,
    status: params.autoClose ? "CLOSED" : "RESOLVED",
    resolvedAt,
    resolvedByPersonId: params.resolvedByPersonId,
    closedAt: params.autoClose ? resolvedAt : params.case.closedAt,
    closedByPersonId: params.autoClose
      ? params.resolvedByPersonId
      : params.case.closedByPersonId,
    latestNote: params.note ?? params.case.latestNote,
    updatedAt: resolvedAt,
  };
}

export function closeStudentCase(params: {
  case: StudentCase;
  closedByPersonId: string;
  notifyGuardian?: boolean;
  note?: string;
  closedAt?: number;
}): StudentCase {
  const closedAt = params.closedAt ?? Date.now();

  return {
    ...params.case,
    status: "CLOSED",
    closedAt,
    closedByPersonId: params.closedByPersonId,
    guardianNotifiedOnClose:
      params.notifyGuardian ?? params.case.guardianNotifiedOnClose,
    latestNote: params.note ?? params.case.latestNote,
    updatedAt: closedAt,
  };
}

export function cancelStudentCase(params: {
  case: StudentCase;
  cancelledByPersonId: string;
  note?: string;
  cancelledAt?: number;
}): StudentCase {
  const cancelledAt = params.cancelledAt ?? Date.now();

  return {
    ...params.case,
    status: "CANCELLED",
    cancelledAt,
    cancelledByPersonId: params.cancelledByPersonId,
    latestNote: params.note ?? params.case.latestNote,
    updatedAt: cancelledAt,
  };
}

export function reopenStudentCase(params: {
  case: StudentCase;
  toOwnerRoleKey?: MembershipRole;
  toAssignedPersonId?: string;
  note?: string;
  reopenedAt?: number;
}): StudentCase {
  const reopenedAt = params.reopenedAt ?? Date.now();

  return {
    ...params.case,
    status: "OPEN",
    currentOwnerRoleKey:
      params.toOwnerRoleKey ?? params.case.currentOwnerRoleKey,
    currentAssignedPersonId:
      params.toAssignedPersonId ?? params.case.currentAssignedPersonId,
    resolvedAt: undefined,
    resolvedByPersonId: "",
    closedAt: undefined,
    closedByPersonId: "",
    cancelledAt: undefined,
    cancelledByPersonId: "",
    latestNote: params.note ?? params.case.latestNote,
    updatedAt: reopenedAt,
  };
}

export function filterStudentCasesForActor(params: {
  context: ActorAccessContext;
  cases: StudentCase[];
  includeClosed?: boolean;
  includeCancelled?: boolean;
}): StudentCase[] {
  return params.cases.filter((studentCase) => {
    if (studentCase.orgId !== params.context.orgId) return false;
    if (!params.includeClosed && studentCase.status === "CLOSED") return false;
    if (!params.includeCancelled && studentCase.status === "CANCELLED") {
      return false;
    }

    return canViewStudentCase({
      context: params.context,
      case: studentCase,
    });
  });
}

export function getVisibleCaseActions(params: {
  context: ActorAccessContext;
  case: StudentCase;
  caseType?: StudentCaseType;
}): StudentCaseVisibleAction[] {
  if (!canViewStudentCase(params)) return [];

  const actions: StudentCaseVisibleAction[] = ["VIEW"];

  if (!isCaseFinal(params.case) && canHandleStudentCase(params)) {
    actions.push("ADD_NOTE", "ASSIGN");

    if (
      !params.caseType ||
      params.caseType.allowedForwardToRoleKeys.length > 0
    ) {
      actions.push("FORWARD");
    }

    actions.push("RETURN", "ESCALATE", "RESOLVE", "CANCEL");
  }

  if (canCloseStudentCase(params)) {
    actions.push("CLOSE");
  }

  if (hasCaseManagementPermission(params.context) && isCaseFinal(params.case)) {
    actions.push("REOPEN");
  }

  return Array.from(new Set(actions));
}

export function calculateStudentCaseSummary(params: {
  cases: StudentCase[];
  actorPersonId?: string;
}): StudentCaseSummary {
  let openCount = 0;
  let inProgressCount = 0;
  let referredCount = 0;
  let resolvedCount = 0;
  let closedCount = 0;
  let cancelledCount = 0;

  let lowPriorityCount = 0;
  let mediumPriorityCount = 0;
  let highPriorityCount = 0;
  let criticalPriorityCount = 0;

  let assignedToMeCount = 0;
  let createdByMeCount = 0;

  for (const studentCase of params.cases) {
    switch (studentCase.status) {
      case "OPEN":
        openCount += 1;
        break;
      case "IN_PROGRESS":
        inProgressCount += 1;
        break;
      case "REFERRED":
        referredCount += 1;
        break;
      case "RESOLVED":
        resolvedCount += 1;
        break;
      case "CLOSED":
        closedCount += 1;
        break;
      case "CANCELLED":
        cancelledCount += 1;
        break;
      default:
        break;
    }

    switch (studentCase.priority) {
      case "LOW":
        lowPriorityCount += 1;
        break;
      case "MEDIUM":
        mediumPriorityCount += 1;
        break;
      case "HIGH":
        highPriorityCount += 1;
        break;
      case "CRITICAL":
        criticalPriorityCount += 1;
        break;
      default:
        break;
    }

    if (
      params.actorPersonId &&
      studentCase.currentAssignedPersonId === params.actorPersonId
    ) {
      assignedToMeCount += 1;
    }

    if (
      params.actorPersonId &&
      studentCase.createdByPersonId === params.actorPersonId
    ) {
      createdByMeCount += 1;
    }
  }

  return {
    totalCount: params.cases.length,

    openCount,
    inProgressCount,
    referredCount,
    resolvedCount,
    closedCount,
    cancelledCount,

    lowPriorityCount,
    mediumPriorityCount,
    highPriorityCount,
    criticalPriorityCount,

    assignedToMeCount,
    createdByMeCount,
  };
}

export function buildCaseTasksForActor(params: {
  context: ActorAccessContext;
  cases: StudentCase[];
  termContext?: TermContextInput;
  nowMs?: number;
}): StaffTask[] {
  const nowMs = params.nowMs ?? Date.now();

  return filterStudentCasesForActor({
    context: params.context,
    cases: params.cases,
  })
    .filter((studentCase) => isCaseOpenForWork(studentCase))
    .map((studentCase) => ({
      id: `case-task-${studentCase.id}`,
      orgId: studentCase.orgId,
      ...resolveTermContext(studentCase),
      actorPersonId: params.context.actorPersonId,
      actorRoleKey: studentCase.currentOwnerRoleKey,

      taskKind: "STUDENT_CASE_HANDLING",
      taskTitle: studentCase.title,
      taskDescription: studentCase.latestNote || studentCase.description,

      scopeType: "CASE",
      scopeId: studentCase.id,
      scopeLabel: studentCase.title,

      targetKind: "CASE",
      targetId: studentCase.id,
      targetLabel: studentCase.title,

      status: caseStatusToTaskStatus(studentCase.status),
      priority: priorityToTaskPriority(studentCase.priority),

      dueAt: undefined,
      availableFrom: studentCase.createdAt,
      availableUntil: undefined,

      sourceType: "STUDENT_CASE",
      sourceId: studentCase.id,
      sourcePath: `orgs/${studentCase.orgId}/studentCases/${studentCase.id}`,

      actionLabel: "فتح القضية",
      actionHref: `/cases/${studentCase.id}`,

      isArchived: false,

      createdAt: nowMs,
      updatedAt: nowMs,
    }));
}
