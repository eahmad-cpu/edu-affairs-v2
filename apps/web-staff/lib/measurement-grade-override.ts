/**
 * Temporary operational measurement-grade exception for
 * p-an-alslman / kg-04 / kg2-b / LEARNING_GARDENS.
 *
 * It is intentionally limited to selecting templates and writing NEW
 * measurement data. It does not change the class, offering, or assignment.
 */

const TARGET = {
  actorPersonId: "p-an-alslman",
  schoolId: "kg-04",
  classId: "kg2-b",
  academicYearId: "ay-1448",
  termId: "term-1",
  subjectKey: "LEARNING_GARDENS",
  classSubjectOfferingId: "kg-04-kg2-b-learning-gardens",
  teacherAssignmentId:
    "teacher-provisioning__p-an-alslman__kg-04__ay-1448__term-1__kg-04-kg2-b-learning-gardens",
  measurementGradeId: "kg3",
} as const;

export type MeasurementGradeOverrideContext = {
  actorPersonId?: string;
  schoolId?: string;
  classId?: string;
  academicYearId?: string;
  termId?: string;
  subjectKey?: string;
  classSubjectOfferingId?: string;
  teacherAssignmentId?: string;
  classGradeId?: string;
};

function text(value: string | undefined) {
  return value?.trim() ?? "";
}

function canonicalSubjectKey(value: string | undefined) {
  return text(value).replace(/[\s-]+/g, "_").toUpperCase();
}

export function resolveMeasurementGradeId(
  context: MeasurementGradeOverrideContext,
) {
  const matchesTarget =
    text(context.actorPersonId) === TARGET.actorPersonId &&
    text(context.schoolId) === TARGET.schoolId &&
    text(context.classId) === TARGET.classId &&
    text(context.academicYearId) === TARGET.academicYearId &&
    text(context.termId) === TARGET.termId &&
    canonicalSubjectKey(context.subjectKey) === TARGET.subjectKey &&
    text(context.classSubjectOfferingId) === TARGET.classSubjectOfferingId &&
    text(context.teacherAssignmentId) === TARGET.teacherAssignmentId;

  return matchesTarget ? TARGET.measurementGradeId : text(context.classGradeId);
}
