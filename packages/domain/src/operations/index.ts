import {
  resolveTermContext,
  type TermContextInput,
} from "../term-context";

import type {
  OperationalAssignment,
  OperationKind,
  OperationScopeType,
  OperationTargetKind,
  StaffTask,
  StaffTaskPriority,
  StaffTaskStatus,
} from "@takween/contracts";

export function calculateBatchCompletion(params: {
  targetCount: number;
  completedCount: number;
  missingCount?: number;
}) {
  const targetCount = Math.max(0, params.targetCount);
  const completedCount = Math.max(0, params.completedCount);
  const missingCount = Math.max(0, params.missingCount ?? 0);

  const pendingCount = Math.max(0, targetCount - completedCount - missingCount);
  const completionPercentage =
    targetCount === 0 ? 0 : Math.round((completedCount / targetCount) * 100);

  return {
    targetCount,
    completedCount,
    missingCount,
    pendingCount,
    completionPercentage,
    isComplete: targetCount > 0 && completedCount + missingCount >= targetCount,
  };
}

export function buildStaffTaskFromAssignment(params: {
  id: string;
  assignment: OperationalAssignment;
  taskTitle: string;
  taskDescription?: string;
  targetKind?: OperationTargetKind;
  targetId?: string;
  targetLabel?: string;
  termContext?: TermContextInput;
  status?: StaffTaskStatus;
  priority?: StaffTaskPriority;
  dueAt?: number;
  actionLabel?: string;
  actionHref?: string;
  createdAt?: number;
  updatedAt?: number;
}): StaffTask {
  const now = Date.now();

  return {
    id: params.id,
    orgId: params.assignment.orgId,
    ...resolveTermContext(params.termContext),
    actorPersonId: params.assignment.actorPersonId,
    actorRoleKey: params.assignment.actorRoleKey,

    taskKind: params.assignment.operationKind,
    taskTitle: params.taskTitle,
    taskDescription: params.taskDescription ?? "",

    scopeType: params.assignment.scopeType,
    scopeId: params.assignment.scopeId ?? "",
    scopeLabel: params.assignment.scopeLabel ?? "",

    targetKind: params.targetKind ?? params.assignment.targetKind,
    targetId: params.targetId ?? "",
    targetLabel: params.targetLabel ?? "",

    status: params.status ?? "PENDING",
    priority: params.priority ?? "NORMAL",

    dueAt: params.dueAt,
    availableFrom: params.assignment.startAt,
    availableUntil: params.assignment.endAt,

    sourceType: "OPERATIONAL_ASSIGNMENT",
    sourceId: params.assignment.id,
    sourcePath: `orgs/${params.assignment.orgId}/operationalAssignments/${params.assignment.id}`,

    actionLabel: params.actionLabel ?? "",
    actionHref: params.actionHref ?? "",

    isArchived: false,

    createdAt: params.createdAt ?? now,
    updatedAt: params.updatedAt ?? now,
  };
}

export function validateOperationScope(params: {
  operationKind: OperationKind;
  allowedOperationKinds: OperationKind[];
  scopeType?: OperationScopeType;
  allowedScopeTypes?: OperationScopeType[];
}) {
  const operationAllowed = params.allowedOperationKinds.includes(
    params.operationKind,
  );

  const scopeAllowed =
    !params.scopeType ||
    !params.allowedScopeTypes ||
    params.allowedScopeTypes.includes(params.scopeType);

  return {
    ok: operationAllowed && scopeAllowed,
    operationAllowed,
    scopeAllowed,
  };
}
