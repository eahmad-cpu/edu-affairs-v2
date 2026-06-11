

import {
  resolveTermContext,
  type TermContextInput,
} from "../term-context";


import type {
  EvaluationCycle,
  EvaluationPlan,
  EvaluationSubmission,
  EvaluationSubmissionItemScore,
  EvaluationSubmissionStatus,
  EvaluationSummaryReadModel,
  EvaluatorPolicy,
  Membership,
  MembershipRole,
  OperationalAssignment,
  StaffTask,
} from "@takween/contracts";

export type EvaluationTargetPerson = {
  personId: string;
  displayName?: string;
  roleKey?: MembershipRole;
  schoolId?: string;
};

export type EvaluationScoreResult = {
  totalScore: number;
  maxScore: number;
  percentage: number;
  weightedScore: number;
};

export type EvaluationCycleProgressSummary = {
  cycleId: string;
  cycleLabel: string;

  targetCount: number;
  draftCount: number;
  submittedCount: number;
  underReviewCount: number;
  approvedCount: number;
  returnedCount: number;
  lockedCount: number;
  cancelledCount: number;
  missingCount: number;

  completedCount: number;
  completionPercentage: number;
};

export type CumulativeEvaluationScore = {
  targetPersonId: string;
  submissionsCount: number;
  approvedSubmissionsCount: number;
  totalScore: number;
  maxScore: number;
  percentage: number;
};

function getMembershipRole(membership: Membership): MembershipRole | undefined {
  return membership.roleKey ?? membership.role;
}

function getSubmissionTargetPersonId(submission: EvaluationSubmission): string {
  return submission.targetPersonId || submission.targetTeacherPersonId;
}

function isIncludedSubmissionStatus(
  status: EvaluationSubmissionStatus,
): boolean {
  return status === "APPROVED" || status === "LOCKED";
}

function isActiveOperationalEvaluationAssignment(params: {
  assignment: OperationalAssignment;
  actorPersonId: string;
  nowMs: number;
}): boolean {
  const { assignment, actorPersonId, nowMs } = params;

  if (assignment.actorPersonId !== actorPersonId) return false;
  if (assignment.operationKind !== "STAFF_EVALUATION") return false;
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

function planMatchesActorRole(params: {
  plan: EvaluationPlan;
  actorRoleKeys: MembershipRole[];
}): boolean {
  return params.actorRoleKeys.includes(params.plan.evaluatorRoleKey);
}

function planMatchesTargetRole(params: {
  plan: EvaluationPlan;
  target: EvaluationTargetPerson;
}): boolean {
  return (
    !!params.target.roleKey &&
    params.plan.targetRoleKey === params.target.roleKey
  );
}

function planMatchesSchool(params: {
  plan: EvaluationPlan;
  target: EvaluationTargetPerson;
}): boolean {
  if (!params.plan.schoolId) return true;
  if (!params.target.schoolId) return true;

  return params.plan.schoolId === params.target.schoolId;
}

function policyAllowsEvaluation(params: {
  policy: EvaluatorPolicy;
  actorRoleKeys: MembershipRole[];
  target: EvaluationTargetPerson;
  schoolId?: string;
}): boolean {
  const { policy, actorRoleKeys, target, schoolId } = params;

  if (!policy.isActive) return false;
  if (!policy.canEvaluate) return false;
  if (!actorRoleKeys.includes(policy.evaluatorRoleKey)) return false;
  if (!target.roleKey || target.roleKey !== policy.targetRoleKey) return false;

  if (policy.schoolId && schoolId && policy.schoolId !== schoolId) {
    return false;
  }

  if (policy.scopeType === "SCHOOL" && policy.scopeId && schoolId) {
    return policy.scopeId === schoolId;
  }

  return true;
}

function buildSubmissionId(params: {
  planId: string;
  cycleId: string;
  evaluatorPersonId: string;
  targetPersonId: string;
}): string {
  return [
    "eval",
    params.planId,
    params.cycleId || "no-cycle",
    params.evaluatorPersonId,
    params.targetPersonId,
  ].join("-");
}

function buildEvaluationTaskId(params: {
  planId: string;
  cycleId: string;
  evaluatorPersonId: string;
  targetPersonId: string;
}): string {
  return [
    "evaluation-task",
    params.planId,
    params.cycleId || "no-cycle",
    params.evaluatorPersonId,
    params.targetPersonId,
  ].join("-");
}

function mapSubmissionStatusToTaskStatus(
  status: EvaluationSubmissionStatus,
): StaffTask["status"] {
  switch (status) {
    case "DRAFT":
      return "DRAFT";
    case "SUBMITTED":
      return "SUBMITTED";
    case "UNDER_REVIEW":
      return "NEEDS_REVIEW";
    case "RETURNED":
      return "RETURNED";
    case "APPROVED":
    case "LOCKED":
      return "COMPLETED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "PENDING";
  }
}

export function getEvaluationTargetsForActor(params: {
  actorPersonId: string;
  actorMemberships: Membership[];
  targets: EvaluationTargetPerson[];
  plans: EvaluationPlan[];
  evaluatorPolicies?: EvaluatorPolicy[];
  operationalAssignments?: OperationalAssignment[];
  nowMs?: number;
}): EvaluationTargetPerson[] {
  const nowMs = params.nowMs ?? Date.now();

  const actorRoleKeys = params.actorMemberships
    .filter((membership) => membership.personId === params.actorPersonId)
    .filter((membership) => membership.isActive !== false)
    .map((membership) => getMembershipRole(membership))
    .filter((roleKey): roleKey is MembershipRole => !!roleKey);

  const explicitTargetIds = new Set<string>();

  for (const assignment of params.operationalAssignments ?? []) {
    if (
      isActiveOperationalEvaluationAssignment({
        assignment,
        actorPersonId: params.actorPersonId,
        nowMs,
      })
    ) {
      for (const targetPersonId of assignment.targetPersonIds) {
        explicitTargetIds.add(targetPersonId);
      }
    }
  }

  const result = params.targets.filter((target) => {
    if (explicitTargetIds.has(target.personId)) return true;

    const allowedByPlan = params.plans.some((plan) => {
      if (!plan.isActive) return false;
      if (!planMatchesActorRole({ plan, actorRoleKeys })) return false;
      if (!planMatchesTargetRole({ plan, target })) return false;
      if (!planMatchesSchool({ plan, target })) return false;

      return true;
    });

    if (allowedByPlan) return true;

    return (params.evaluatorPolicies ?? []).some((policy) =>
      policyAllowsEvaluation({
        policy,
        actorRoleKeys,
        target,
        schoolId: target.schoolId,
      }),
    );
  });

  const unique = new Map<string, EvaluationTargetPerson>();

  for (const target of result) {
    unique.set(target.personId, target);
  }

  return Array.from(unique.values());
}

export function buildEvaluationSubmissionDraft(params: {
  id?: string;
  plan: EvaluationPlan;
  cycle: EvaluationCycle;
  evaluatorPersonId: string;
  evaluatorRoleKey?: MembershipRole;
  target: EvaluationTargetPerson;
  nowMs?: number;
}): EvaluationSubmission {
  const nowMs = params.nowMs ?? Date.now();
  const targetPersonId = params.target.personId;

  return {
    id:
      params.id ??
      buildSubmissionId({
        planId: params.plan.id,
        cycleId: params.cycle.id,
        evaluatorPersonId: params.evaluatorPersonId,
        targetPersonId,
      }),

    planId: params.plan.id,
    cycleId: params.cycle.id,

    orgId: params.plan.orgId || params.cycle.orgId,
    schoolId: params.plan.schoolId || params.cycle.schoolId,
    academicYearId: params.cycle.academicYearId,

    evaluatorPersonId: params.evaluatorPersonId,
    evaluatorRoleKey: params.evaluatorRoleKey ?? params.plan.evaluatorRoleKey,

    targetPersonId,
    targetTeacherPersonId:
      params.plan.targetKind === "TEACHER" ? targetPersonId : "",
    targetRoleKey: params.target.roleKey ?? params.plan.targetRoleKey,

    cycleLabel: params.cycle.label,
    templateKey: params.plan.templateKey,

    status: "DRAFT",

    submittedAt: undefined,
    reviewedAt: undefined,
    approvedAt: undefined,
    lockedAt: undefined,

    reviewedByPersonId: "",
    approvedByPersonId: "",

    totalScore: 0,
    maxScore: 0,
    weightedScore: 0,

    summary: "",
    recommendations: "",

    createdAt: nowMs,
    updatedAt: nowMs,
  };
}

export function calculateSubmissionScore(params: {
  itemScores: EvaluationSubmissionItemScore[];
}): EvaluationScoreResult {
  let totalScore = 0;
  let maxScore = 0;

  for (const item of params.itemScores) {
    const weight = item.weight || 1;

    totalScore += item.score * weight;
    maxScore += item.maxScore * weight;
  }

  const percentage =
    maxScore === 0 ? 0 : Math.round((totalScore / maxScore) * 100);

  return {
    totalScore,
    maxScore,
    percentage,
    weightedScore: percentage,
  };
}

export function applySubmissionScore(params: {
  submission: EvaluationSubmission;
  itemScores: EvaluationSubmissionItemScore[];
  updatedAt?: number;
}): EvaluationSubmission {
  const score = calculateSubmissionScore({
    itemScores: params.itemScores,
  });

  return {
    ...params.submission,
    totalScore: score.totalScore,
    maxScore: score.maxScore,
    weightedScore: score.weightedScore,
    updatedAt: params.updatedAt ?? Date.now(),
  };
}

export function submitEvaluationSubmission(params: {
  submission: EvaluationSubmission;
  submittedAt?: number;
}): EvaluationSubmission {
  const submittedAt = params.submittedAt ?? Date.now();

  return {
    ...params.submission,
    status: "SUBMITTED",
    submittedAt,
    updatedAt: submittedAt,
  };
}

export function approveEvaluationSubmission(params: {
  submission: EvaluationSubmission;
  approvedByPersonId: string;
  approvedAt?: number;
}): EvaluationSubmission {
  const approvedAt = params.approvedAt ?? Date.now();

  return {
    ...params.submission,
    status: "APPROVED",
    approvedAt,
    approvedByPersonId: params.approvedByPersonId,
    updatedAt: approvedAt,
  };
}

export function returnEvaluationSubmission(params: {
  submission: EvaluationSubmission;
  reviewedByPersonId: string;
  reviewedAt?: number;
}): EvaluationSubmission {
  const reviewedAt = params.reviewedAt ?? Date.now();

  return {
    ...params.submission,
    status: "RETURNED",
    reviewedAt,
    reviewedByPersonId: params.reviewedByPersonId,
    updatedAt: reviewedAt,
  };
}

export function lockEvaluationSubmission(params: {
  submission: EvaluationSubmission;
  lockedAt?: number;
}): EvaluationSubmission {
  const lockedAt = params.lockedAt ?? Date.now();

  return {
    ...params.submission,
    status: "LOCKED",
    lockedAt,
    updatedAt: lockedAt,
  };
}

export function buildEvaluationTasksForActor(params: {
  actorPersonId: string;
  actorMemberships: Membership[];
  targets: EvaluationTargetPerson[];
  plans: EvaluationPlan[];
  cycles: EvaluationCycle[];
  submissions?: EvaluationSubmission[];
  termContext?: TermContextInput;
  evaluatorPolicies?: EvaluatorPolicy[];
  operationalAssignments?: OperationalAssignment[];
  nowMs?: number;
}): StaffTask[] {
  const nowMs = params.nowMs ?? Date.now();

  const actorRoleKeys = params.actorMemberships
    .filter((membership) => membership.personId === params.actorPersonId)
    .filter((membership) => membership.isActive !== false)
    .map((membership) => getMembershipRole(membership))
    .filter((roleKey): roleKey is MembershipRole => !!roleKey);

  const targets = getEvaluationTargetsForActor({
    actorPersonId: params.actorPersonId,
    actorMemberships: params.actorMemberships,
    targets: params.targets,
    plans: params.plans,
    evaluatorPolicies: params.evaluatorPolicies,
    operationalAssignments: params.operationalAssignments,
    nowMs,
  });

  const submissionsByKey = new Map<string, EvaluationSubmission>();

  for (const submission of params.submissions ?? []) {
    const targetPersonId = getSubmissionTargetPersonId(submission);

    submissionsByKey.set(
      `${submission.planId}|${submission.cycleId}|${submission.evaluatorPersonId}|${targetPersonId}`,
      submission,
    );
  }

  const tasks: StaffTask[] = [];

  for (const plan of params.plans) {
    if (!plan.isActive) continue;
    if (!actorRoleKeys.includes(plan.evaluatorRoleKey)) continue;

    const planCycles = params.cycles.filter((cycle) => {
      if (cycle.planId !== plan.id) return false;
      if (!cycle.isOpen && !cycle.isLocked) return false;
      return true;
    });

    const planTargets = targets.filter((target) => {
      return (
        planMatchesTargetRole({ plan, target }) &&
        planMatchesSchool({ plan, target })
      );
    });

    for (const cycle of planCycles) {
      for (const target of planTargets) {
        const key = `${plan.id}|${cycle.id}|${params.actorPersonId}|${target.personId}`;
        const submission = submissionsByKey.get(key);

        const status = submission
          ? mapSubmissionStatusToTaskStatus(submission.status)
          : "PENDING";

        tasks.push({
          id: buildEvaluationTaskId({
            planId: plan.id,
            cycleId: cycle.id,
            evaluatorPersonId: params.actorPersonId,
            targetPersonId: target.personId,
          }),

          orgId: plan.orgId || cycle.orgId,
          ...resolveTermContext(params.termContext),
          actorPersonId: params.actorPersonId,
          actorRoleKey: plan.evaluatorRoleKey,

          taskKind: "STAFF_EVALUATION",
          taskTitle: `${plan.title} - ${target.displayName ?? target.personId}`,
          taskDescription: cycle.label,

          scopeType: "PERSON",
          scopeId: target.personId,
          scopeLabel: target.displayName ?? target.personId,

          targetKind: "STAFF",
          targetId: target.personId,
          targetLabel: target.displayName ?? target.personId,

          status,
          priority: "NORMAL",

          dueAt: cycle.endsAt,
          availableFrom: cycle.startsAt,
          availableUntil: cycle.endsAt,

          sourceType: submission ? "EVALUATION_SUBMISSION" : "EVALUATION_CYCLE",
          sourceId: submission?.id ?? cycle.id,
          sourcePath: submission
            ? `orgs/${plan.orgId || cycle.orgId}/evaluationSubmissions/${submission.id}`
            : `orgs/${plan.orgId || cycle.orgId}/evaluationCycles/${cycle.id}`,

          actionLabel: submission ? "فتح التقييم" : "بدء التقييم",
          actionHref: submission
            ? `/evaluations/submissions/${submission.id}`
            : `/evaluations/cycles/${cycle.id}/targets/${target.personId}`,

          isArchived: false,

          createdAt: nowMs,
          updatedAt: nowMs,
        });
      }
    }
  }

  return tasks;
}

export function calculateEvaluationCycleProgress(params: {
  cycle: EvaluationCycle;
  targets: EvaluationTargetPerson[];
  submissions: EvaluationSubmission[];
}): EvaluationCycleProgressSummary {
  const targetIds = new Set(params.targets.map((target) => target.personId));

  const submissions = params.submissions.filter((submission) => {
    if (submission.cycleId !== params.cycle.id) return false;

    return targetIds.has(getSubmissionTargetPersonId(submission));
  });

  let draftCount = 0;
  let submittedCount = 0;
  let underReviewCount = 0;
  let approvedCount = 0;
  let returnedCount = 0;
  let lockedCount = 0;
  let cancelledCount = 0;

  for (const submission of submissions) {
    switch (submission.status) {
      case "DRAFT":
        draftCount += 1;
        break;
      case "SUBMITTED":
        submittedCount += 1;
        break;
      case "UNDER_REVIEW":
        underReviewCount += 1;
        break;
      case "APPROVED":
        approvedCount += 1;
        break;
      case "RETURNED":
        returnedCount += 1;
        break;
      case "LOCKED":
        lockedCount += 1;
        break;
      case "CANCELLED":
        cancelledCount += 1;
        break;
      default:
        break;
    }
  }

  const targetCount = targetIds.size;
  const completedCount = approvedCount + lockedCount;
  const missingCount = Math.max(0, targetCount - submissions.length);
  const completionPercentage =
    targetCount === 0 ? 0 : Math.round((completedCount / targetCount) * 100);

  return {
    cycleId: params.cycle.id,
    cycleLabel: params.cycle.label,

    targetCount,
    draftCount,
    submittedCount,
    underReviewCount,
    approvedCount,
    returnedCount,
    lockedCount,
    cancelledCount,
    missingCount,

    completedCount,
    completionPercentage,
  };
}

export function calculateCumulativeEvaluationScore(params: {
  targetPersonId: string;
  targetRoleKey?: MembershipRole;
  submissions: EvaluationSubmission[];
  includedStatuses?: EvaluationSubmissionStatus[];
}): CumulativeEvaluationScore {
  const includedStatuses = params.includedStatuses ?? ["APPROVED", "LOCKED"];

  const includedSubmissions = params.submissions.filter((submission) => {
    const targetPersonId = getSubmissionTargetPersonId(submission);

    return (
      targetPersonId === params.targetPersonId &&
      includedStatuses.includes(submission.status)
    );
  });

  let totalScore = 0;
  let maxScore = 0;

  for (const submission of includedSubmissions) {
    totalScore += submission.weightedScore || submission.totalScore;
    maxScore += submission.weightedScore ? 100 : submission.maxScore;
  }

  const percentage =
    maxScore === 0 ? 0 : Math.round((totalScore / maxScore) * 100);

  return {
    targetPersonId: params.targetPersonId,
    submissionsCount: params.submissions.filter(
      (submission) =>
        getSubmissionTargetPersonId(submission) === params.targetPersonId,
    ).length,
    approvedSubmissionsCount: includedSubmissions.length,
    totalScore,
    maxScore,
    percentage,
  };
}

export function buildEvaluationSummaryReadModel(params: {
  id: string;
  orgId: string;
  schoolId?: string;
  academicYearId: string;
  targetPersonId: string;
  targetRoleKey?: MembershipRole;
  submissions: EvaluationSubmission[];
  nowMs?: number;
}): EvaluationSummaryReadModel {
  const nowMs = params.nowMs ?? Date.now();

  const targetSubmissions = params.submissions.filter((submission) => {
    return getSubmissionTargetPersonId(submission) === params.targetPersonId;
  });

  const includedSubmissions = targetSubmissions.filter((submission) =>
    isIncludedSubmissionStatus(submission.status),
  );

  let totalScore = 0;
  let maxScore = 0;

  for (const submission of includedSubmissions) {
    totalScore += submission.weightedScore || submission.totalScore;
    maxScore += submission.weightedScore ? 100 : submission.maxScore;
  }

  const percentage =
    maxScore === 0 ? 0 : Math.round((totalScore / maxScore) * 100);

  const lastSubmission = [...targetSubmissions].sort((a, b) => {
    const aTime =
      a.approvedAt ?? a.submittedAt ?? a.updatedAt ?? a.createdAt ?? 0;
    const bTime =
      b.approvedAt ?? b.submittedAt ?? b.updatedAt ?? b.createdAt ?? 0;

    return bTime - aTime;
  })[0];

  return {
    id: params.id,
    orgId: params.orgId,
    schoolId: params.schoolId ?? "",
    academicYearId: params.academicYearId,

    targetPersonId: params.targetPersonId,
    targetRoleKey: params.targetRoleKey,

    submissionsCount: targetSubmissions.length,
    approvedSubmissionsCount: includedSubmissions.length,

    totalScore,
    maxScore,
    percentage,

    lastSubmissionAt:
      lastSubmission?.approvedAt ??
      lastSubmission?.submittedAt ??
      lastSubmission?.updatedAt ??
      lastSubmission?.createdAt,
    lastCycleLabel: lastSubmission?.cycleLabel ?? "",

    createdAt: nowMs,
    updatedAt: nowMs,
  };
}

export function buildEvaluationSummaryReadModels(params: {
  orgId: string;
  schoolId?: string;
  academicYearId: string;
  targets: EvaluationTargetPerson[];
  submissions: EvaluationSubmission[];
  nowMs?: number;
}): EvaluationSummaryReadModel[] {
  return params.targets.map((target) =>
    buildEvaluationSummaryReadModel({
      id: `evaluation-summary-${params.academicYearId}-${target.personId}`,
      orgId: params.orgId,
      schoolId: params.schoolId ?? target.schoolId ?? "",
      academicYearId: params.academicYearId,
      targetPersonId: target.personId,
      targetRoleKey: target.roleKey,
      submissions: params.submissions,
      nowMs: params.nowMs,
    }),
  );
}
