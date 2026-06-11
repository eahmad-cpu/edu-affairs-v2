import type {
  LearningLossImprovementIndicator,
  StudentLearningLossPlan,
  StudentLearningLossPlanStatus,
} from "@takween/contracts";

export type LearningLossFollowUpState =
  | "NEEDS_FIRST_CHECK"
  | "NEEDS_SECOND_CHECK"
  | "CHECKS_COMPLETED";

export type LearningLossImprovementComparison = {
  baseScore: number;
  baseMaxScore: number;
  targetScore: number;
  targetMaxScore: number;
  comparisonLabel: string;
};

export type LearningLossImprovementResult = {
  delta?: number;
  percentage?: number;
  indicator: LearningLossImprovementIndicator;
  comparisonLabel: string;
};

export type LearningLossImprovementUpdateFields = {
  improvementIndicator: LearningLossImprovementIndicator;
  improvementDelta?: number;
  improvementPercentage?: number;
};

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function hasLearningLossBaseline(plan: StudentLearningLossPlan) {
  return isNumber(plan.baselineScore) && isPositiveNumber(plan.baselineMaxScore);
}

export function hasLearningLossFirstCheck(plan: StudentLearningLossPlan) {
  return (
    isNumber(plan.firstCheckScore) && isPositiveNumber(plan.firstCheckMaxScore)
  );
}

export function hasLearningLossSecondCheck(plan: StudentLearningLossPlan) {
  return (
    isNumber(plan.secondCheckScore) && isPositiveNumber(plan.secondCheckMaxScore)
  );
}

export function getLearningLossFollowUpState(
  plan: StudentLearningLossPlan
): LearningLossFollowUpState {
  if (!hasLearningLossFirstCheck(plan)) return "NEEDS_FIRST_CHECK";
  if (!hasLearningLossSecondCheck(plan)) return "NEEDS_SECOND_CHECK";

  return "CHECKS_COMPLETED";
}

export function getLearningLossFollowUpStateLabel(
  value: LearningLossFollowUpState
) {
  switch (value) {
    case "NEEDS_FIRST_CHECK":
      return "تحتاج القياس الأول";
    case "NEEDS_SECOND_CHECK":
      return "تحتاج القياس الثاني";
    case "CHECKS_COMPLETED":
      return "اكتملت القياسات";
    default:
      return "غير محدد";
  }
}

export function resolveLearningLossImprovementComparison(
  plan: StudentLearningLossPlan
): LearningLossImprovementComparison | null {
  const baselineScore = plan.baselineScore;
  const baselineMaxScore = plan.baselineMaxScore;

  const firstCheckScore = plan.firstCheckScore;
  const firstCheckMaxScore = plan.firstCheckMaxScore;

  const secondCheckScore = plan.secondCheckScore;
  const secondCheckMaxScore = plan.secondCheckMaxScore;

  const hasSafeBaseline =
    isNumber(baselineScore) && isPositiveNumber(baselineMaxScore);

  const hasSafeFirstCheck =
    isNumber(firstCheckScore) && isPositiveNumber(firstCheckMaxScore);

  const hasSafeSecondCheck =
    isNumber(secondCheckScore) && isPositiveNumber(secondCheckMaxScore);

  if (hasSafeSecondCheck) {
    if (hasSafeBaseline) {
      return {
        baseScore: baselineScore,
        baseMaxScore: baselineMaxScore,
        targetScore: secondCheckScore,
        targetMaxScore: secondCheckMaxScore,
        comparisonLabel: "من القياس الأساسي إلى القياس الثاني",
      };
    }

    if (hasSafeFirstCheck) {
      return {
        baseScore: firstCheckScore,
        baseMaxScore: firstCheckMaxScore,
        targetScore: secondCheckScore,
        targetMaxScore: secondCheckMaxScore,
        comparisonLabel: "من القياس الأول إلى القياس الثاني",
      };
    }
  }

  if (hasSafeFirstCheck && hasSafeBaseline) {
    return {
      baseScore: baselineScore,
      baseMaxScore: baselineMaxScore,
      targetScore: firstCheckScore,
      targetMaxScore: firstCheckMaxScore,
      comparisonLabel: "من القياس الأساسي إلى القياس الأول",
    };
  }

  return null;
}

export function resolveLearningLossIndicator(
  percentageDelta?: number
): LearningLossImprovementIndicator {
  if (!isNumber(percentageDelta)) return "UNKNOWN";

  if (percentageDelta >= 10) return "IMPROVED";
  if (percentageDelta > 0) return "PARTIAL_IMPROVEMENT";
  if (percentageDelta === 0) return "NO_IMPROVEMENT";

  return "REGRESSED";
}

export function calculateLearningLossImprovement(
  plan: StudentLearningLossPlan
): LearningLossImprovementResult {
  const comparison = resolveLearningLossImprovementComparison(plan);

  if (!comparison) {
    return {
      delta: undefined,
      percentage: undefined,
      indicator: "UNKNOWN",
      comparisonLabel: "لم يكتمل أساس المقارنة بعد",
    };
  }

  const baselinePercentage =
    (comparison.baseScore / comparison.baseMaxScore) * 100;

  const targetPercentage =
    (comparison.targetScore / comparison.targetMaxScore) * 100;

  const percentageDelta = targetPercentage - baselinePercentage;
  const scoreDelta = comparison.targetScore - comparison.baseScore;

  return {
    delta: scoreDelta,
    percentage: percentageDelta,
    indicator: resolveLearningLossIndicator(percentageDelta),
    comparisonLabel: comparison.comparisonLabel,
  };
}

export function resolveLearningLossStatus(
  plan: StudentLearningLossPlan
): StudentLearningLossPlanStatus {
  const followUpState = getLearningLossFollowUpState(plan);
  const improvement = calculateLearningLossImprovement(plan);

  if (followUpState === "NEEDS_FIRST_CHECK") {
    return plan.status || "ACTIVE";
  }

  if (followUpState === "NEEDS_SECOND_CHECK") {
    return "IN_PROGRESS";
  }

  if (improvement.indicator === "IMPROVED") return "IMPROVED";

  if (improvement.indicator === "PARTIAL_IMPROVEMENT") {
    return "PARTIALLY_IMPROVED";
  }

  return "NOT_IMPROVED";
}

export function buildLearningLossImprovementUpdateFields(
  improvement: LearningLossImprovementResult
): LearningLossImprovementUpdateFields {
  const fields: LearningLossImprovementUpdateFields = {
    improvementIndicator: improvement.indicator,
  };

  if (isNumber(improvement.delta)) {
    fields.improvementDelta = improvement.delta;
  }

  if (isNumber(improvement.percentage)) {
    fields.improvementPercentage = improvement.percentage;
  }

  return fields;
}