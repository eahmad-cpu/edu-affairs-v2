import type {
  HomeworkQuestionSnapshot,
  HomeworkStatus,
  HomeworkSubmissionStatus,
  QuestionBankItem,
  StudentHomeworkAnswer,
  StudentHomeworkAssignment,
  StudentHomeworkSubmission,
} from "@takween/contracts";

export type HomeworkSubjectContext = {
  orgId: string;
  schoolId?: string;
  schoolType?: string;
  academicYearId?: string;
  termId?: string;
  gradeId?: string;
  subjectKey: string;
  classSubjectOfferingId?: string;
};

export type HomeworkValidationResult = {
  ok: boolean;
  errors: string[];
};

export type HomeworkSubmissionScoreResult = {
  score: number;
  maxScore: number;
  answers: StudentHomeworkAnswer[];
  autoGradedCount: number;
  manualPendingCount: number;
};

function hasValue(value: string | undefined | null) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeText(value: string | undefined | null) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function uniq(values: string[]) {
  return Array.from(new Set(values));
}

function numberOrZero(value: number | undefined | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function matchesOptionalField(
  itemValue: string | undefined,
  contextValue: string | undefined
) {
  if (!hasValue(itemValue)) return true;
  if (!hasValue(contextValue)) return false;
  return itemValue === contextValue;
}

function getDifficultyOrder(difficulty: QuestionBankItem["difficulty"]) {
  const order: Record<QuestionBankItem["difficulty"], number> = {
    EASY: 1,
    MEDIUM: 2,
    HARD: 3,
    CHALLENGE: 4,
  };

  return order[difficulty] ?? 99;
}

/**
 * يفلتر أسئلة بنك الأسئلة حسب سياق المادة والفصل الدراسي.
 *
 * القاعدة:
 * - orgId و subjectKey أساسيان.
 * - termId إذا وصل في السياق يجب أن يطابق.
 * - الحقول الاختيارية في السؤال مثل schoolId / gradeId / classSubjectOfferingId
 *   إن كانت فارغة تعتبر عامة، وإن كانت موجودة يجب أن تطابق السياق.
 */
export function filterQuestionBankForSubjectContext(params: {
  items: QuestionBankItem[];
  context: HomeworkSubjectContext;
  includeInactive?: boolean;
}) {
  const { items, context, includeInactive = false } = params;

  return items
    .filter((item) => {
      if (item.orgId !== context.orgId) return false;
      if (item.subjectKey !== context.subjectKey) return false;

      if (!includeInactive && item.isActive !== true) return false;
      if (item.isArchived === true) return false;

      if (hasValue(context.termId) && item.termId !== context.termId) {
        return false;
      }

      if (
        hasValue(context.schoolType) &&
        item.schoolType &&
        item.schoolType !== context.schoolType
      ) {
        return false;
      }

      if (!matchesOptionalField(item.schoolId, context.schoolId)) return false;

      if (
        !matchesOptionalField(item.academicYearId, context.academicYearId)
      ) {
        return false;
      }

      if (!matchesOptionalField(item.gradeId, context.gradeId)) return false;

      if (
        !matchesOptionalField(
          item.classSubjectOfferingId,
          context.classSubjectOfferingId
        )
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      const difficultyDiff =
        getDifficultyOrder(a.difficulty) - getDifficultyOrder(b.difficulty);

      if (difficultyDiff !== 0) return difficultyDiff;

      return a.prompt.localeCompare(b.prompt, "ar");
    });
}

/**
 * يحوّل QuestionBankItem إلى Snapshot داخل الواجب.
 *
 * مهم:
 * الواجب لا يعتمد على السؤال الأصلي فقط.
 * نحفظ نسخة السؤال وقت إنشاء الواجب حتى لا تتغير الواجبات القديمة
 * عند تعديل بنك الأسئلة لاحقًا.
 */
export function buildHomeworkQuestionSnapshot(
  item: QuestionBankItem,
  options: {
    id?: string;
    order?: number;
  } = {}
): HomeworkQuestionSnapshot {
  return {
    id: options.id ?? item.id,
    questionBankItemId: item.id,
    questionType: item.questionType,
    title: item.title,
    prompt: item.prompt,
    choices: item.choices,
    correctAnswer: item.correctAnswer,
    correctChoiceIds: item.correctChoiceIds,
    explanation: item.explanation,
    difficulty: item.difficulty,
    maxScore: item.maxScore,
    gradingMode: item.gradingMode,
    order: options.order ?? 0,
  };
}

export function calculateHomeworkMaxScore(
  questions: HomeworkQuestionSnapshot[]
) {
  return questions.reduce((total, question) => {
    return total + numberOrZero(question.maxScore);
  }, 0);
}

export function validateQuestionBankItem(
  item: QuestionBankItem
): HomeworkValidationResult {
  const errors: string[] = [];

  if (!hasValue(item.prompt)) {
    errors.push("نص السؤال مطلوب.");
  }

  if (numberOrZero(item.maxScore) <= 0) {
    errors.push("درجة السؤال يجب أن تكون أكبر من صفر.");
  }

  if (item.questionType === "MULTIPLE_CHOICE") {
    if (item.choices.length < 2) {
      errors.push("سؤال الاختيار من متعدد يحتاج اختيارين على الأقل.");
    }

    const choiceIds = new Set(item.choices.map((choice) => choice.id));
    const validCorrectChoiceIds = item.correctChoiceIds.filter((choiceId) =>
      choiceIds.has(choiceId)
    );

    if (validCorrectChoiceIds.length === 0) {
      errors.push("يجب تحديد اختيار صحيح واحد على الأقل.");
    }

    if (validCorrectChoiceIds.length !== item.correctChoiceIds.length) {
      errors.push("بعض الاختيارات الصحيحة غير موجودة ضمن الاختيارات.");
    }
  }

  if (item.questionType === "TRUE_FALSE") {
    const answer = normalizeText(item.correctAnswer);

    if (answer !== "true" && answer !== "false") {
      errors.push('سؤال صح/خطأ يحتاج correctAnswer بقيمة "true" أو "false".');
    }
  }

  if (item.questionType === "SHORT_ANSWER") {
    if (item.gradingMode === "AUTO" && !hasValue(item.correctAnswer)) {
      errors.push("التصحيح الآلي للإجابة القصيرة يحتاج إجابة نموذجية.");
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function validateHomeworkQuestions(
  questions: HomeworkQuestionSnapshot[]
): HomeworkValidationResult {
  const errors: string[] = [];

  if (questions.length === 0) {
    errors.push("يجب إضافة سؤال واحد على الأقل للواجب.");
  }

  const ids = questions.map((question) => question.id);
  const uniqueIds = uniq(ids);

  if (uniqueIds.length !== ids.length) {
    errors.push("يوجد تكرار في معرفات أسئلة الواجب.");
  }

  questions.forEach((question, index) => {
    const label = `السؤال رقم ${index + 1}`;

    if (!hasValue(question.prompt)) {
      errors.push(`${label}: نص السؤال مطلوب.`);
    }

    if (numberOrZero(question.maxScore) <= 0) {
      errors.push(`${label}: الدرجة يجب أن تكون أكبر من صفر.`);
    }

    if (question.questionType === "MULTIPLE_CHOICE") {
      if (question.choices.length < 2) {
        errors.push(`${label}: يجب إضافة اختيارين على الأقل.`);
      }

      const choiceIds = new Set(question.choices.map((choice) => choice.id));
      const hasValidCorrectChoice = question.correctChoiceIds.some((choiceId) =>
        choiceIds.has(choiceId)
      );

      if (!hasValidCorrectChoice) {
        errors.push(`${label}: يجب تحديد اختيار صحيح.`);
      }
    }

    if (question.questionType === "TRUE_FALSE") {
      const answer = normalizeText(question.correctAnswer);

      if (answer !== "true" && answer !== "false") {
        errors.push(`${label}: إجابة صح/خطأ يجب أن تكون true أو false.`);
      }
    }

    if (
      question.questionType === "SHORT_ANSWER" &&
      question.gradingMode === "AUTO" &&
      !hasValue(question.correctAnswer)
    ) {
      errors.push(`${label}: التصحيح الآلي يحتاج إجابة نموذجية.`);
    }
  });

  return {
    ok: errors.length === 0,
    errors,
  };
}

function gradeSingleAnswer(params: {
  question: HomeworkQuestionSnapshot;
  answer: StudentHomeworkAnswer | undefined;
}) {
  const { question, answer } = params;

  const maxScore = numberOrZero(question.maxScore);

  if (!answer) {
    return {
      score: 0,
      maxScore,
      isCorrect: false,
      manualPending: false,
    };
  }

  if (question.gradingMode === "MANUAL") {
    return {
      score: numberOrZero(answer.score),
      maxScore,
      isCorrect: answer.isCorrect,
      manualPending: typeof answer.score !== "number",
    };
  }

  if (question.questionType === "MULTIPLE_CHOICE") {
    const expected = uniq(question.correctChoiceIds).sort();
    const actual = uniq(answer.selectedChoiceIds).sort();

    const isCorrect =
      expected.length > 0 &&
      expected.length === actual.length &&
      expected.every((choiceId, index) => choiceId === actual[index]);

    return {
      score: isCorrect ? maxScore : 0,
      maxScore,
      isCorrect,
      manualPending: false,
    };
  }

  if (question.questionType === "TRUE_FALSE") {
    const expected = normalizeText(question.correctAnswer) === "true";
    const actual = answer.booleanAnswer;

    const isCorrect = typeof actual === "boolean" && actual === expected;

    return {
      score: isCorrect ? maxScore : 0,
      maxScore,
      isCorrect,
      manualPending: false,
    };
  }

  if (question.questionType === "SHORT_ANSWER") {
    if (question.gradingMode === "MIXED" && !hasValue(question.correctAnswer)) {
      return {
        score: numberOrZero(answer.score),
        maxScore,
        isCorrect: answer.isCorrect,
        manualPending: typeof answer.score !== "number",
      };
    }

    const expected = normalizeText(question.correctAnswer);
    const actual = normalizeText(answer.answerText);

    const isCorrect = hasValue(expected) && actual === expected;

    return {
      score: isCorrect ? maxScore : 0,
      maxScore,
      isCorrect,
      manualPending: false,
    };
  }

  return {
    score: 0,
    maxScore,
    isCorrect: false,
    manualPending: true,
  };
}

export function calculateHomeworkSubmissionScore(params: {
  assignment: StudentHomeworkAssignment;
  submission: StudentHomeworkSubmission;
}): HomeworkSubmissionScoreResult {
  const { assignment, submission } = params;

  const answersByQuestionId = new Map(
    submission.answers.map((answer) => [answer.questionId, answer])
  );

  let score = 0;
  let maxScore = 0;
  let autoGradedCount = 0;
  let manualPendingCount = 0;

  const nextAnswers = assignment.questions.map((question) => {
    const currentAnswer = answersByQuestionId.get(question.id);

    const result = gradeSingleAnswer({
      question,
      answer: currentAnswer,
    });

    score += result.score;
    maxScore += result.maxScore;

    if (result.manualPending) {
      manualPendingCount += 1;
    } else {
      autoGradedCount += 1;
    }

    const nextAnswer: StudentHomeworkAnswer = {
      questionId: question.id,
      questionBankItemId: question.questionBankItemId,
      questionType: question.questionType,

      selectedChoiceIds: currentAnswer?.selectedChoiceIds ?? [],
      answerText: currentAnswer?.answerText ?? "",
      booleanAnswer: currentAnswer?.booleanAnswer,

      score: result.score,
      maxScore: result.maxScore,

      isCorrect: result.isCorrect,
      feedback: currentAnswer?.feedback ?? "",

      gradedAt: currentAnswer?.gradedAt,
      gradedByPersonId: currentAnswer?.gradedByPersonId ?? "",
    };

    return nextAnswer;
  });

  return {
    score,
    maxScore,
    answers: nextAnswers,
    autoGradedCount,
    manualPendingCount,
  };
}

export function resolveHomeworkStatus(params: {
  assignment: StudentHomeworkAssignment;
  now?: number;
}): HomeworkStatus {
  const { assignment, now = Date.now() } = params;

  if (assignment.status === "CANCELLED") return "CANCELLED";
  if (assignment.status === "LOCKED") return "LOCKED";
  if (assignment.status === "CLOSED") return "CLOSED";

  if (assignment.lockedAt && assignment.lockedAt <= now) {
    return "LOCKED";
  }

  if (assignment.closedAt && assignment.closedAt <= now) {
    return "CLOSED";
  }

  if (
    assignment.status === "DRAFT" &&
    assignment.publishMode === "SCHEDULED" &&
    assignment.scheduledPublishAt &&
    assignment.scheduledPublishAt <= now
  ) {
    return "PUBLISHED";
  }

  return assignment.status;
}

export function resolveSubmissionStatus(params: {
  assignment: StudentHomeworkAssignment;
  submission: StudentHomeworkSubmission;
  now?: number;
}): HomeworkSubmissionStatus {
  const { assignment, submission } = params;

  if (submission.status === "CANCELLED") return "CANCELLED";
  if (submission.status === "GRADED") return "GRADED";
  if (submission.status === "RETURNED") return "RETURNED";

  if (submission.gradedAt) {
    return "GRADED";
  }

  if (submission.submittedAt) {
    if (assignment.dueAt && submission.submittedAt > assignment.dueAt) {
      return "LATE_SUBMITTED";
    }

    return "SUBMITTED";
  }

  if (submission.answers.length > 0) {
    return "IN_PROGRESS";
  }

  return "NOT_STARTED";
}

export function isHomeworkPastDue(params: {
  assignment: StudentHomeworkAssignment;
  now?: number;
}) {
  const { assignment, now = Date.now() } = params;

  return Boolean(assignment.dueAt && assignment.dueAt < now);
}

export function buildHomeworkSubmissionSkeleton(params: {
  id: string;
  assignment: StudentHomeworkAssignment;
  studentId: string;
  enrollmentId?: string;
  now?: number;
}): StudentHomeworkSubmission {
  const { id, assignment, studentId, enrollmentId = "", now = Date.now() } =
    params;

  return {
    id,

    orgId: assignment.orgId,
    schoolId: assignment.schoolId,
    academicYearId: assignment.academicYearId,

    termId: assignment.termId,
    termTitle: assignment.termTitle,
    termShortTitle: assignment.termShortTitle,

    homeworkId: assignment.id,

homeworkTitle: assignment.title,
homeworkDescription: assignment.description,
homeworkDueAt: assignment.dueAt,
homeworkPublishedAt: assignment.publishedAt,
homeworkQuestions: assignment.questions,

studentId,
enrollmentId,

    gradeId: assignment.gradeId,
    classId: assignment.classId,

    subjectKey: assignment.subjectKey,
    classSubjectOfferingId: assignment.classSubjectOfferingId,

    answers: [],

    score: 0,
    maxScore: calculateHomeworkMaxScore(assignment.questions),

    status: "NOT_STARTED",

    startedAt: now,
    submittedAt: undefined,
    gradedAt: undefined,
    returnedAt: undefined,

    gradedByPersonId: "",
    feedback: "",

    isLate: false,
    note: "",

    createdAt: now,
    updatedAt: now,
  };
}





export type StudentHomeworkDisplayStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "DUE_SOON"
  | "OVERDUE"
  | "SUBMITTED"
  | "LATE_SUBMITTED"
  | "GRADED"
  | "RETURNED"
  | "CANCELLED";

export type StudentHomeworkAnswerProgress = {
  answeredCount: number;
  totalCount: number;
  percentage: number;
  missingQuestionIds: string[];
};

export function filterHomeworkSubmissionsForStudent(params: {
  submissions: StudentHomeworkSubmission[];
  studentId: string;
  includeCancelled?: boolean;
}) {
  const { submissions, studentId, includeCancelled = false } = params;

  return submissions.filter((submission) => {
    if (submission.studentId !== studentId) return false;
    if (!includeCancelled && submission.status === "CANCELLED") return false;

    return true;
  });
}

export function resolveStudentHomeworkDisplayStatus(params: {
  submission: StudentHomeworkSubmission;
  now?: number;
  dueSoonThresholdMs?: number;
}): StudentHomeworkDisplayStatus {
  const {
    submission,
    now = Date.now(),
    dueSoonThresholdMs = 24 * 60 * 60 * 1000,
  } = params;

  if (submission.status === "CANCELLED") return "CANCELLED";
  if (submission.status === "GRADED") return "GRADED";
  if (submission.status === "RETURNED") return "RETURNED";

  if (submission.gradedAt) return "GRADED";

  if (submission.submittedAt) {
    const isLate =
      submission.isLate ||
      submission.status === "LATE_SUBMITTED" ||
      Boolean(
        submission.homeworkDueAt &&
          submission.submittedAt > submission.homeworkDueAt,
      );

    return isLate ? "LATE_SUBMITTED" : "SUBMITTED";
  }

  if (submission.homeworkDueAt && submission.homeworkDueAt < now) {
    return "OVERDUE";
  }

  if (
    submission.homeworkDueAt &&
    submission.homeworkDueAt >= now &&
    submission.homeworkDueAt - now <= dueSoonThresholdMs
  ) {
    return "DUE_SOON";
  }

  if (submission.status === "IN_PROGRESS" || submission.answers.length > 0) {
    return "IN_PROGRESS";
  }

  return "NOT_STARTED";
}

export function filterActiveHomeworkSubmissions(params: {
  submissions: StudentHomeworkSubmission[];
  now?: number;
}) {
  const { submissions, now = Date.now() } = params;

  return submissions.filter((submission) => {
    const displayStatus = resolveStudentHomeworkDisplayStatus({
      submission,
      now,
    });

    return [
      "NOT_STARTED",
      "IN_PROGRESS",
      "DUE_SOON",
      "OVERDUE",
      "RETURNED",
    ].includes(displayStatus);
  });
}

export function filterCompletedHomeworkSubmissions(params: {
  submissions: StudentHomeworkSubmission[];
  now?: number;
}) {
  const { submissions, now = Date.now() } = params;

  return submissions.filter((submission) => {
    const displayStatus = resolveStudentHomeworkDisplayStatus({
      submission,
      now,
    });

    return ["SUBMITTED", "LATE_SUBMITTED", "GRADED"].includes(displayStatus);
  });
}

function isHomeworkAnswerFilled(answer: StudentHomeworkAnswer) {
  if (answer.questionType === "MULTIPLE_CHOICE") {
    return answer.selectedChoiceIds.length > 0;
  }

  if (answer.questionType === "TRUE_FALSE") {
    return typeof answer.booleanAnswer === "boolean";
  }

  if (answer.questionType === "SHORT_ANSWER") {
    return hasValue(answer.answerText);
  }

  return false;
}

export function calculateSubmissionAnswerProgress(
  submission: StudentHomeworkSubmission,
): StudentHomeworkAnswerProgress {
  const totalCount = submission.homeworkQuestions.length;

  if (totalCount === 0) {
    return {
      answeredCount: 0,
      totalCount: 0,
      percentage: 0,
      missingQuestionIds: [],
    };
  }

  const answersByQuestionId = new Map(
    submission.answers.map((answer) => [answer.questionId, answer]),
  );

  const missingQuestionIds: string[] = [];

  let answeredCount = 0;

  submission.homeworkQuestions.forEach((question) => {
    const answer = answersByQuestionId.get(question.id);

    if (answer && isHomeworkAnswerFilled(answer)) {
      answeredCount += 1;
      return;
    }

    missingQuestionIds.push(question.id);
  });

  return {
    answeredCount,
    totalCount,
    percentage: Math.round((answeredCount / totalCount) * 100),
    missingQuestionIds,
  };
}

export function sortStudentHomeworkSubmissions(params: {
  submissions: StudentHomeworkSubmission[];
  now?: number;
}) {
  const { submissions, now = Date.now() } = params;

  const statusOrder: Record<StudentHomeworkDisplayStatus, number> = {
    OVERDUE: 1,
    DUE_SOON: 2,
    RETURNED: 3,
    IN_PROGRESS: 4,
    NOT_STARTED: 5,
    SUBMITTED: 6,
    LATE_SUBMITTED: 7,
    GRADED: 8,
    CANCELLED: 9,
  };

  return [...submissions].sort((a, b) => {
    const aStatus = resolveStudentHomeworkDisplayStatus({
      submission: a,
      now,
    });

    const bStatus = resolveStudentHomeworkDisplayStatus({
      submission: b,
      now,
    });

    const statusDiff = statusOrder[aStatus] - statusOrder[bStatus];

    if (statusDiff !== 0) return statusDiff;

    const aDue = a.homeworkDueAt ?? Number.MAX_SAFE_INTEGER;
    const bDue = b.homeworkDueAt ?? Number.MAX_SAFE_INTEGER;

    if (aDue !== bDue) return aDue - bDue;

    const aPublished = a.homeworkPublishedAt ?? a.createdAt ?? 0;
    const bPublished = b.homeworkPublishedAt ?? b.createdAt ?? 0;

    return bPublished - aPublished;
  });
}

export function buildStudentHomeworkSummary(params: {
  submissions: StudentHomeworkSubmission[];
  now?: number;
}) {
  const { submissions, now = Date.now() } = params;

  const summary = {
    total: submissions.length,
    notStarted: 0,
    inProgress: 0,
    dueSoon: 0,
    overdue: 0,
    submitted: 0,
    lateSubmitted: 0,
    graded: 0,
    returned: 0,
    cancelled: 0,
  };

  submissions.forEach((submission) => {
    const status = resolveStudentHomeworkDisplayStatus({
      submission,
      now,
    });

    switch (status) {
      case "NOT_STARTED":
        summary.notStarted += 1;
        break;
      case "IN_PROGRESS":
        summary.inProgress += 1;
        break;
      case "DUE_SOON":
        summary.dueSoon += 1;
        break;
      case "OVERDUE":
        summary.overdue += 1;
        break;
      case "SUBMITTED":
        summary.submitted += 1;
        break;
      case "LATE_SUBMITTED":
        summary.lateSubmitted += 1;
        break;
      case "GRADED":
        summary.graded += 1;
        break;
      case "RETURNED":
        summary.returned += 1;
        break;
      case "CANCELLED":
        summary.cancelled += 1;
        break;
    }
  });

  return summary;
}



