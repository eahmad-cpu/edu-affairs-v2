import { resolveTermContext } from "../term-context";


import type {
  StudentAssessmentRecord,
  StudentAssessmentTemplate,
  StudentMeasurementBatch,
  StudentMeasurementBatchStudentRow,
  StudentTrackerEntry,
  StudentTrackerTemplate,
} from "@takween/contracts";

export type LearningLossDecision = {
  needsLearningLossFollowUp: boolean;
  reason: string;
  scorePercentage: number | null;
};

type LearningLossCapableTemplate = Pick<
  StudentAssessmentTemplate | StudentTrackerTemplate,
  | "requiresLearningLossFollowUp"
  | "learningLossThresholdScore"
  | "learningLossThresholdPercentage"
>;

function calculatePercentage(score?: number, maxScore?: number): number | null {
  if (typeof score !== "number") return null;
  if (typeof maxScore !== "number") return null;
  if (maxScore <= 0) return null;

  return (score / maxScore) * 100;
}

export function calculateLearningLossDecision(params: {
  template: LearningLossCapableTemplate;
  score?: number;
  maxScore?: number;
}): LearningLossDecision {
  const scorePercentage = calculatePercentage(params.score, params.maxScore);

  if (!params.template.requiresLearningLossFollowUp) {
    return {
      needsLearningLossFollowUp: false,
      reason: "القالب لا يتطلب متابعة فاقد تعليمي",
      scorePercentage,
    };
  }

  if (
    typeof params.template.learningLossThresholdScore === "number" &&
    typeof params.score === "number" &&
    params.score < params.template.learningLossThresholdScore
  ) {
    return {
      needsLearningLossFollowUp: true,
      reason: "درجة الطالب أقل من حد الفاقد المحدد في القالب",
      scorePercentage,
    };
  }

  if (
    typeof params.template.learningLossThresholdPercentage === "number" &&
    typeof scorePercentage === "number" &&
    scorePercentage < params.template.learningLossThresholdPercentage
  ) {
    return {
      needsLearningLossFollowUp: true,
      reason: "نسبة الطالب أقل من حد الفاقد المحدد في القالب",
      scorePercentage,
    };
  }

  return {
    needsLearningLossFollowUp: false,
    reason: "درجة الطالب لا تستدعي فتح خطة فاقد",
    scorePercentage,
  };
}

function calculateLearningLossDecisionWithoutTemplate(params: {
  score?: number;
  maxScore?: number;
}): LearningLossDecision {
  return {
    needsLearningLossFollowUp: false,
    reason: "لم يتم تمرير قالب لحساب قرار الفاقد",
    scorePercentage: calculatePercentage(params.score, params.maxScore),
  };
}

export function buildStudentAssessmentRecordsFromBatch(params: {
  batch: StudentMeasurementBatch;
  template: StudentAssessmentTemplate;
  rows?: StudentMeasurementBatchStudentRow[];
  nowMs?: number;
}): StudentAssessmentRecord[] {
  const nowMs = params.nowMs ?? Date.now();
  const rows = params.rows ?? params.batch.studentRows;

  return rows
    .filter((row) => row.status === "COMPLETED")
    .map((row) => {
      const decision = calculateLearningLossDecision({
        template: params.template,
        score: row.score,
        maxScore: row.maxScore,
      });

      return {
        id: row.recordId || `${params.batch.id}-${row.studentId}`,
        orgId: params.batch.orgId,
        schoolId: params.batch.schoolId,
        academicYearId: params.batch.academicYearId,
        ...resolveTermContext(params.batch),
        studentId: row.studentId,
        enrollmentId: row.enrollmentId,

        gradeId: params.batch.gradeId,
        classId: params.batch.classId,
        classSubjectOfferingId: params.batch.classSubjectOfferingId,

        templateId: params.batch.templateId || params.template.id,
        kind: params.template.kind,
        assessmentSlot: params.batch.assessmentSlot,
        subjectKey: params.batch.subjectKey || params.template.subjectKey,

        evaluatorRoleKey: params.template.evaluatorRoleKey,
        assessedByPersonId: params.batch.createdByPersonId,
        measuredAt: params.batch.measuredAt ?? nowMs,

        score: row.score,
        maxScore: row.maxScore,

        level: row.level,
        passed: row.passed,
        notes: row.note,
        status: "PUBLISHED",

        batchId: params.batch.id,
        batchKind: params.batch.batchKind,

        itemScores: row.itemScores,

        needsLearningLossFollowUp: decision.needsLearningLossFollowUp,
        learningLossPlanId: "",
        learningLossTriggerReason: decision.reason,

        createdAt: nowMs,
        updatedAt: nowMs,
      };
    });
}

export function buildStudentTrackerEntriesFromBatch(params: {
  batch: StudentMeasurementBatch;
  template?: StudentTrackerTemplate;
  rows?: StudentMeasurementBatchStudentRow[];
  nowMs?: number;
}): StudentTrackerEntry[] {
  const nowMs = params.nowMs ?? Date.now();
  const rows = params.rows ?? params.batch.studentRows;

  if (!params.batch.trackerKind) return [];

  const trackerKind = params.batch.trackerKind;

  return rows
    .filter((row) => row.status === "COMPLETED")
    .map((row) => {
      const decision = params.template
        ? calculateLearningLossDecision({
            template: params.template,
            score: row.score,
            maxScore: row.maxScore,
          })
        : calculateLearningLossDecisionWithoutTemplate({
            score: row.score,
            maxScore: row.maxScore,
          });

      return {
        id: row.recordId || `${params.batch.id}-${row.studentId}`,
        orgId: params.batch.orgId,
        schoolId: params.batch.schoolId,
        academicYearId: params.batch.academicYearId,
        ...resolveTermContext(params.batch),
        studentId: row.studentId,
        enrollmentId: row.enrollmentId,

        gradeId: params.batch.gradeId,
        classId: params.batch.classId,
        classSubjectOfferingId: params.batch.classSubjectOfferingId,

        templateId: params.batch.templateId || params.template?.id || "",
        kind: trackerKind,

        subjectKey:
          params.batch.subjectKey || params.template?.subjectKey || "",

        evaluatorRoleKey:
          params.template?.evaluatorRoleKey || params.batch.createdByRoleKey,
        recordedByPersonId: params.batch.createdByPersonId,
        recordedAt: params.batch.measuredAt ?? nowMs,

        topicTitle:
          params.batch.templateTitle || params.template?.title || "متابعة طالب",
        lessonKey: "",
        lessonTitle: params.template?.defaultLessonTitle || "",

        score: row.score,
        maxScore: row.maxScore,

        valueText: row.valueText,
        level: row.level,
        completed: row.completed ?? row.status === "COMPLETED",

        notes: row.note,
        status: "RECORDED",

        batchId: params.batch.id,
        batchKind: params.batch.batchKind,

        itemScores: row.itemScores,

        needsLearningLossFollowUp: decision.needsLearningLossFollowUp,
        learningLossPlanId: "",
        learningLossTriggerReason: decision.reason,

        createdAt: nowMs,
        updatedAt: nowMs,
      };
    });
}
