import type {
  OperationalAssignment,
  OperationKind,
  TeacherAssignment,
} from "@takween/contracts";

function isActiveByTimeRange(item: {
  isActive?: boolean;
  status?: string;
  startAt?: number;
  endAt?: number;
}, nowMs: number) {
  if (item.isActive === false) return false;
  if (item.status && ["ENDED", "SUSPENDED", "CANCELLED"].includes(item.status)) {
    return false;
  }

  if (typeof item.startAt === "number" && item.startAt > nowMs) return false;
  if (typeof item.endAt === "number" && item.endAt < nowMs) return false;

  return true;
}

export function getActiveOperationalAssignmentsForActor(params: {
  actorPersonId: string;
  assignments: OperationalAssignment[];
  nowMs?: number;
}): OperationalAssignment[] {
  const nowMs = params.nowMs ?? Date.now();

  return params.assignments.filter((assignment) => {
    return (
      assignment.actorPersonId === params.actorPersonId &&
      isActiveByTimeRange(assignment, nowMs)
    );
  });
}

export function getAssignmentsByOperationKind(params: {
  operationKind: OperationKind;
  assignments: OperationalAssignment[];
}): OperationalAssignment[] {
  return params.assignments.filter(
    (assignment) => assignment.operationKind === params.operationKind,
  );
}

export function getActiveTeacherAssignmentsForActor(params: {
  actorPersonId: string;
  assignments: TeacherAssignment[];
  nowMs?: number;
}): TeacherAssignment[] {
  const nowMs = params.nowMs ?? Date.now();

  return params.assignments.filter((assignment) => {
    return (
      assignment.teacherPersonId === params.actorPersonId &&
      isActiveByTimeRange(assignment, nowMs)
    );
  });
}

export function hasOperationalAssignmentPermission(params: {
  assignment: OperationalAssignment;
  permission: string;
}): boolean {
  return params.assignment.permissions.includes(
    params.permission as never,
  );
}