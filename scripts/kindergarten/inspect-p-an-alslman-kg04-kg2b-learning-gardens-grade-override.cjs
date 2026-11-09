#!/usr/bin/env node
"use strict";

/*
 * Read-only inspection for a future-only measurement-grade override decision.
 *
 * The script has no Firestore write path, accepts no arguments, and writes
 * only its local JSON report. It never changes class, offering, assignment,
 * batch, record, template, enrollment, attendance, or student data.
 */

const admin = require("firebase-admin");
const fs = require("node:fs");
const path = require("node:path");

const ORG_ID = "takween";
const TEACHER_PERSON_ID = "p-an-alslman";
const SCHOOL_ID = "kg-04";
const CLASS_ID = "kg2-b";
const ACADEMIC_YEAR_ID = "ay-1448";
const TERM_ID = "term-1";
const SUBJECT_KEY = "LEARNING_GARDENS";
const OFFERING_ID = "kg-04-kg2-b-learning-gardens";
const ASSIGNMENT_ID =
  "teacher-provisioning__p-an-alslman__kg-04__ay-1448__term-1__kg-04-kg2-b-learning-gardens";
const CURRENT_GRADE_ID = "kg2";
const FUTURE_MEASUREMENT_GRADE_ID = "kg3";
const REPORT_PATH = path.resolve(
  process.cwd(),
  "scripts",
  "kindergarten",
  "reports",
  "inspect-p-an-alslman-kg04-kg2b-learning-gardens-grade-override.json",
);
const TEMPLATE_COLLECTIONS = [
  "studentAssessmentTemplates",
  "studentTrackerTemplates",
];
const OPEN_STATUSES = new Set(["DRAFT", "IN_PROGRESS"]);
const FINAL_STATUSES = new Set(["SUBMITTED", "REVIEWED", "LOCKED"]);

if (process.argv.length > 2) {
  throw new Error(
    "This inspection is read-only and accepts no options. There is no --apply mode.",
  );
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalized(value) {
  return text(value).replace(/[\s-]+/g, "_").toUpperCase();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function toPlain(value) {
  if (value === undefined || value === null || typeof value !== "object") {
    return value ?? null;
  }
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(toPlain);
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, toPlain(entry)]),
  );
}

function timestampOrNull(value) {
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (finiteNumber(value)) return new Date(value).toISOString();
  return null;
}

function initAdmin() {
  if (admin.apps.length > 0) return;
  const serviceAccountPath = path.resolve(
    process.env.SERVICE_ACCOUNT_PATH ||
      path.join(process.cwd(), "service-account.json"),
  );
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

function activeState(data) {
  return {
    status: text(data.status) || null,
    isActive: hasOwn(data, "isActive") ? data.isActive === true : null,
    active:
      normalized(data.status) === "ACTIVE" &&
      (!hasOwn(data, "isActive") || data.isActive === true),
  };
}

function coreContextMatches(data) {
  return (
    text(data.schoolId) === SCHOOL_ID &&
    text(data.classId) === CLASS_ID &&
    normalized(data.subjectKey) === SUBJECT_KEY
  );
}

function operationalContextMatches(data) {
  return (
    coreContextMatches(data) &&
    (text(data.teacherAssignmentId) === ASSIGNMENT_ID ||
      text(data.classSubjectOfferingId) === OFFERING_ID)
  );
}

function termIds(data) {
  return [
    ...asArray(data.applicableTermIds),
    data.termId,
    data.termKey,
  ]
    .map(text)
    .filter(Boolean);
}

function batchStatusCounts(batches) {
  const counts = {
    DRAFT: 0,
    IN_PROGRESS: 0,
    SUBMITTED: 0,
    REVIEWED: 0,
    LOCKED: 0,
    CANCELLED: 0,
    other: 0,
  };
  for (const batch of batches) {
    const status = normalized(batch.status);
    if (hasOwn(counts, status)) counts[status] += 1;
    else counts.other += 1;
  }
  return counts;
}

function countNumericItemScores(rows) {
  return asArray(rows).reduce(
    (count, row) =>
      count +
      asArray(row?.itemScores).filter((item) => finiteNumber(item?.score)).length,
    0,
  );
}

function trackerOrAssessmentTemplateGrade(template, templateId) {
  if (template) return text(template.gradeId) || null;
  if (text(templateId).startsWith("kg3-")) return "kg3";
  if (text(templateId).startsWith("kg2-")) return "kg2";
  return null;
}

function createBatchRecord(snapshot, templateById) {
  const data = snapshot.data() || {};
  const rows = asArray(data.studentRows);
  const templateId = text(data.templateId);
  const template = templateById.get(templateId);

  return {
    batchId: snapshot.id,
    firestorePath: snapshot.ref.path,
    status: text(data.status) || null,
    batchKind: text(data.batchKind) || null,
    templateId: templateId || null,
    templateTitle: text(data.templateTitle) || text(template?.title) || null,
    gradeId: text(data.gradeId) || null,
    classId: text(data.classId) || null,
    classSubjectOfferingId: text(data.classSubjectOfferingId) || null,
    teacherAssignmentId: text(data.teacherAssignmentId) || null,
    createdByPersonId: text(data.createdByPersonId) || null,
    createdAt: timestampOrNull(data.createdAt),
    updatedAt: timestampOrNull(data.updatedAt),
    studentRowsCount: rows.length,
    completedCount: finiteNumber(data.completedCount)
      ? data.completedCount
      : rows.filter((row) => normalized(row?.status) === "COMPLETED").length,
    targetCount: finiteNumber(data.targetCount) ? data.targetCount : rows.length,
    recordRefsCount: asArray(data.recordRefs).length,
    exactOperationalContext: operationalContextMatches(data),
    templateGradeId: trackerOrAssessmentTemplateGrade(template, templateId),
    numericItemScoresEntered: countNumericItemScores(rows),
    studentRowsContainItemScoresSnapshots: rows.some((row) =>
      Array.isArray(row?.itemScores),
    ),
    studentRowsWithItemScoresSnapshots: rows.filter((row) =>
      Array.isArray(row?.itemScores),
    ).length,
  };
}

function recordSummary(snapshot) {
  const data = snapshot.data() || {};
  return {
    recordId: snapshot.id,
    batchId: text(data.batchId) || null,
    templateId: text(data.templateId) || null,
    gradeId: text(data.gradeId) || null,
    classId: text(data.classId) || null,
    classSubjectOfferingId: text(data.classSubjectOfferingId) || null,
    subjectKey: text(data.subjectKey) || null,
    createdAt: timestampOrNull(data.createdAt),
    updatedAt: timestampOrNull(data.updatedAt),
  };
}

function valuesWithCounts(records, field) {
  return records.reduce((counts, record) => {
    const value = record[field] || "(missing)";
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function classRecord(snapshot) {
  if (!snapshot.exists) return null;
  const data = snapshot.data() || {};
  return {
    classId: snapshot.id,
    title: text(data.title) || text(data.name) || null,
    gradeId: text(data.gradeId) || null,
    schoolId: text(data.schoolId) || SCHOOL_ID,
    academicYearId: text(data.academicYearId) || ACADEMIC_YEAR_ID,
  };
}

function offeringRecord(snapshot) {
  if (!snapshot.exists) return null;
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    classId: text(data.classId) || null,
    gradeId: text(data.gradeId) || null,
    schoolId: text(data.schoolId) || null,
    academicYearId: text(data.academicYearId) || null,
    subjectKey: text(data.subjectKey) || null,
    ...activeState(data),
  };
}

function assignmentRecord(snapshot) {
  if (!snapshot.exists) return null;
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    teacherPersonId: text(data.teacherPersonId) || null,
    classId: text(data.classId) || null,
    gradeId: text(data.gradeId) || null,
    schoolId: text(data.schoolId) || null,
    academicYearId: text(data.academicYearId) || null,
    termId: text(data.termId) || null,
    classSubjectOfferingId: text(data.classSubjectOfferingId) || null,
    subjectKey: text(data.subjectKey) || null,
    ...activeState(data),
  };
}

function linkRecord(snapshot) {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    assignmentId: text(data.assignmentId) || null,
    classId: text(data.classId) || null,
    gradeId: text(data.gradeId) || null,
    schoolId: text(data.schoolId) || null,
    academicYearId: text(data.academicYearId) || null,
    termId: text(data.termId) || null,
    classSubjectOfferingId: text(data.classSubjectOfferingId) || null,
    isPrimaryClass: data.isPrimaryClass === true,
  };
}

function createTemplateRecord(snapshot, collection) {
  const data = snapshot.data() || {};
  const active = activeState(data);
  const eligibleTerm =
    termIds(data).length === 0 || termIds(data).includes(TERM_ID);
  const eligibleYear =
    !text(data.academicYearId) || text(data.academicYearId) === ACADEMIC_YEAR_ID;

  return {
    templateId: snapshot.id,
    firestorePath: snapshot.ref.path,
    templateCollection: collection,
    templateKind: text(data.kind) || text(data.templateKind) || null,
    title: text(data.title) || null,
    gradeId: text(data.gradeId) || null,
    subjectKey: text(data.subjectKey) || null,
    activeState: active,
    eligibleIfMeasurementGradeIsKg3:
      active.active && eligibleTerm && eligibleYear,
    eligibilityReason:
      active.active && eligibleTerm && eligibleYear
        ? "Active KG3 template with compatible year and term scope."
        : "Inactive or not compatible with the target academic-year/term scope.",
  };
}

function buildOpenAnalysis(batches) {
  return batches
    .filter((batch) => OPEN_STATUSES.has(normalized(batch.status)))
    .map((batch) => ({
      batchId: batch.batchId,
      status: batch.status,
      exactOperationalContext: batch.exactOperationalContext,
      currentGradeId: batch.gradeId,
      templateId: batch.templateId,
      templateGradeId: batch.templateGradeId,
      templateIsKg2: batch.templateGradeId === "kg2",
      templateIsKg3: batch.templateGradeId === "kg3",
      enteredNumericScores: batch.numericItemScoresEntered,
      studentRowsContainItemScoresSnapshots:
        batch.studentRowsContainItemScoresSnapshots,
      futureOnlyTemplateSelectionLeavesDraftUnchanged: true,
      recommendedHandling:
        batch.gradeId === CURRENT_GRADE_ID
          ? "PRESERVE_AS_HISTORICAL_KG2_DATA"
          : "REVIEW_SEPARATELY_BEFORE_ANY_MIGRATION",
    }));
}

function buildFinalAnalysis(batches, assessmentRecords, trackerEntries) {
  const assessmentByBatch = new Map();
  const trackerByBatch = new Map();
  for (const record of assessmentRecords) {
    if (!record.batchId) continue;
    const entries = assessmentByBatch.get(record.batchId) || [];
    entries.push(record.recordId);
    assessmentByBatch.set(record.batchId, entries);
  }
  for (const record of trackerEntries) {
    if (!record.batchId) continue;
    const entries = trackerByBatch.get(record.batchId) || [];
    entries.push(record.recordId);
    trackerByBatch.set(record.batchId, entries);
  }

  return batches
    .filter((batch) => FINAL_STATUSES.has(normalized(batch.status)))
    .map((batch) => {
      const assessmentRecordIds = assessmentByBatch.get(batch.batchId) || [];
      const trackerEntryIds = trackerByBatch.get(batch.batchId) || [];
      return {
        batchId: batch.batchId,
        status: batch.status,
        currentGradeId: batch.gradeId,
        templateId: batch.templateId,
        templateGradeId: batch.templateGradeId,
        assessmentRecordsExist: assessmentRecordIds.length > 0,
        trackerEntriesExist: trackerEntryIds.length > 0,
        linkedRecordIds: [...assessmentRecordIds, ...trackerEntryIds],
        historicalFinalDataShouldRemainUntouched: true,
      };
    });
}

function buildSafetyAssessment(context, openBatches, templates, records) {
  const blockingReasons = [];
  const risks = [];

  if (!context.classDocument) blockingReasons.push("CLASS_DOCUMENT_NOT_FOUND");
  if (!context.classSubjectOffering) blockingReasons.push("CLASS_SUBJECT_OFFERING_NOT_FOUND");
  if (!context.teacherAssignment) blockingReasons.push("TEACHER_ASSIGNMENT_NOT_FOUND");
  if (context.classDocument?.gradeId !== CURRENT_GRADE_ID) {
    blockingReasons.push("CLASS_GRADE_DOES_NOT_MATCH_EXPECTED_KG2");
  }
  if (context.classSubjectOffering?.gradeId && context.classSubjectOffering.gradeId !== CURRENT_GRADE_ID) {
    blockingReasons.push("OFFERING_GRADE_DOES_NOT_MATCH_EXPECTED_KG2");
  }
  if (context.teacherAssignment?.gradeId && context.teacherAssignment.gradeId !== CURRENT_GRADE_ID) {
    blockingReasons.push("ASSIGNMENT_GRADE_DOES_NOT_MATCH_EXPECTED_KG2");
  }
  if (
    !templates.some((template) => template.eligibleIfMeasurementGradeIsKg3)
  ) {
    blockingReasons.push("NO_ELIGIBLE_ACTIVE_KG3_LEARNING_GARDENS_TEMPLATE");
  }

  if (openBatches.length > 0) {
    risks.push({
      type: "OPEN_HISTORICAL_BATCHES_PRESENT",
      details:
        "Existing DRAFT and IN_PROGRESS batches must remain bound to their current KG2 snapshots and must not be re-selected, rewritten, or migrated by a future-only override.",
    });
  }
  if (records.gradeIdValues.includes(FUTURE_MEASUREMENT_GRADE_ID)) {
    risks.push({
      type: "EXISTING_KG3_HISTORICAL_RECORDS",
      details:
        "Existing KG3 records were found in a KG2 context and should be reviewed before relying on a strict historical KG2 baseline.",
    });
  }
  if (!templates.some((template) => template.templateId === "kg3-learning-gardens-part2-tracker" && template.eligibleIfMeasurementGradeIsKg3)) {
    risks.push({
      type: "PART2_TRACKER_NOT_CURRENTLY_AVAILABLE",
      details:
        "The proposed part-2 tracker is not yet an active Firestore template; it cannot be selected until separately created.",
    });
  }

  return {
    safeForFutureOnlyOverride: blockingReasons.length === 0,
    blockingReasons,
    risks,
    recommendedImplementationBoundary:
      "Introduce an explicit, narrowly scoped measurementGradeId=kg3 decision only when creating a new Learning Gardens measurement or tracker for this exact teacherAssignmentId/classSubjectOfferingId. Use it solely for template eligibility and the gradeId written to newly created batch and record documents. Do not mutate or reinterpret the class, offering, assignment, links, students, enrollments, attendance, or any existing batch/record; explicitly exclude existing DRAFT, IN_PROGRESS, SUBMITTED, REVIEWED, and LOCKED batches.",
  };
}

function printSummary(report) {
  const safety = report.safetyAssessment;
  console.log("\nKG2-B Learning Gardens measurement-grade override inspection");
  console.log("=".repeat(62));
  console.log("Class:", report.context.classDocument);
  console.log("Offering:", report.context.classSubjectOffering);
  console.log("Assignment:", report.context.teacherAssignment);
  console.log("Batch status counts:", report.batchStatusCounts);
  console.log(`Open batches: ${report.openBatchAnalysis.length}`);
  if (report.openBatchAnalysis.length > 0) {
    console.table(
      report.openBatchAnalysis.map((batch) => ({
        batchId: batch.batchId,
        status: batch.status,
        gradeId: batch.currentGradeId,
        templateId: batch.templateId,
        templateGradeId: batch.templateGradeId,
        numericScores: batch.enteredNumericScores,
      })),
    );
  }
  console.log(`Final batches: ${report.finalBatchAnalysis.length}`);
  console.log(
    `Historical records: assessments=${report.records.totalAssessmentRecords}, trackers=${report.records.totalTrackerEntries}`,
  );
  console.log(`Stored record grades: ${report.records.gradeIdValues.join(", ") || "none"}`);
  console.log(
    `Eligible active KG3 templates: ${report.kg3Templates.filter((template) => template.eligibleIfMeasurementGradeIsKg3).length}`,
  );
  console.table(
    report.kg3Templates.map((template) => ({
      templateId: template.templateId,
      kind: template.templateKind,
      eligible: template.eligibleIfMeasurementGradeIsKg3,
    })),
  );
  console.log(`Safe for future-only override: ${safety.safeForFutureOnlyOverride}`);
  console.log(`Blocking reasons: ${safety.blockingReasons.length}`);
  console.log(`Risks: ${safety.risks.length}`);
  console.log(`JSON report: ${REPORT_PATH}`);
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const orgPath = `orgs/${ORG_ID}`;
  const [classSnapshot, offeringSnapshot, assignmentSnapshot, linksSnapshot] =
    await Promise.all([
      db.doc(`${orgPath}/schools/${SCHOOL_ID}/academicYears/${ACADEMIC_YEAR_ID}/classes/${CLASS_ID}`).get(),
      db.doc(`${orgPath}/classSubjectOfferings/${OFFERING_ID}`).get(),
      db.doc(`${orgPath}/teacherAssignments/${ASSIGNMENT_ID}`).get(),
      db.collection(`${orgPath}/teacherAssignmentClassLinks`).where("assignmentId", "==", ASSIGNMENT_ID).get(),
    ]);

  const [batchSnapshot, assessmentRecordsSnapshot, trackerEntriesSnapshot, ...templateSnapshots] =
    await Promise.all([
      db.collection(`${orgPath}/studentMeasurementBatches`).where("schoolId", "==", SCHOOL_ID).get(),
      db.collection(`${orgPath}/studentAssessmentRecords`).where("schoolId", "==", SCHOOL_ID).get(),
      db.collection(`${orgPath}/studentTrackerEntries`).where("schoolId", "==", SCHOOL_ID).get(),
      ...TEMPLATE_COLLECTIONS.map((collection) => db.collection(`${orgPath}/${collection}`).get()),
    ]);

  const allTemplates = templateSnapshots.flatMap((snapshot, index) =>
    snapshot.docs.map((document) => createTemplateRecord(document, TEMPLATE_COLLECTIONS[index])),
  );
  const templateById = new Map(allTemplates.map((template) => [template.templateId, template]));
  const batches = batchSnapshot.docs
    .filter((document) => operationalContextMatches(document.data() || {}))
    .map((document) => createBatchRecord(document, templateById))
    .sort((left, right) => left.batchId.localeCompare(right.batchId, "en"));
  const assessmentRecords = assessmentRecordsSnapshot.docs
    .filter((document) => coreContextMatches(document.data() || {}))
    .map(recordSummary)
    .sort((left, right) => left.recordId.localeCompare(right.recordId, "en"));
  const trackerEntries = trackerEntriesSnapshot.docs
    .filter((document) => coreContextMatches(document.data() || {}))
    .map(recordSummary)
    .sort((left, right) => left.recordId.localeCompare(right.recordId, "en"));
  const allRecords = [...assessmentRecords, ...trackerEntries];
  const kg3Templates = allTemplates
    .filter(
      (template) =>
        template.gradeId === FUTURE_MEASUREMENT_GRADE_ID &&
        normalized(template.subjectKey) === SUBJECT_KEY &&
        normalized(template.activeState.status) === "ACTIVE" &&
        template.activeState.isActive === true &&
        (template.templateCollection === "studentAssessmentTemplates" ||
          template.templateCollection === "studentTrackerTemplates"),
    )
    .sort((left, right) => left.templateId.localeCompare(right.templateId, "en"));
  const context = {
    classDocument: classRecord(classSnapshot),
    classSubjectOffering: offeringRecord(offeringSnapshot),
    teacherAssignment: assignmentRecord(assignmentSnapshot),
    teacherAssignmentClassLinks: linksSnapshot.docs.map(linkRecord),
  };
  const records = {
    totalAssessmentRecords: assessmentRecords.length,
    totalTrackerEntries: trackerEntries.length,
    assessmentRecords,
    trackerEntries,
    gradeIdDistribution: valuesWithCounts(allRecords, "gradeId"),
    gradeIdValues: Object.keys(valuesWithCounts(allRecords, "gradeId")),
    templateIdsUsed: Object.keys(valuesWithCounts(allRecords, "templateId")),
    batchIdsUsed: Object.keys(valuesWithCounts(allRecords, "batchId")),
    anyRecordsUseKg3: allRecords.some(
      (record) => record.gradeId === FUTURE_MEASUREMENT_GRADE_ID,
    ),
    allHistoricalRecordsConsistentlyKg2:
      allRecords.length > 0 &&
      allRecords.every((record) => record.gradeId === CURRENT_GRADE_ID),
  };
  const openBatchAnalysis = buildOpenAnalysis(batches);
  const finalBatchAnalysis = buildFinalAnalysis(batches, assessmentRecords, trackerEntries);
  const safetyAssessment = buildSafetyAssessment(context, openBatchAnalysis, kg3Templates, records);
  const report = {
    metadata: {
      generatedAt: new Date().toISOString(),
      readOnlyFirestoreInspection: true,
      organizationId: ORG_ID,
      target: {
        teacherPersonId: TEACHER_PERSON_ID,
        schoolId: SCHOOL_ID,
        classId: CLASS_ID,
        academicYearId: ACADEMIC_YEAR_ID,
        termId: TERM_ID,
        subjectKey: SUBJECT_KEY,
        classSubjectOfferingId: OFFERING_ID,
        teacherAssignmentId: ASSIGNMENT_ID,
        currentGradeId: CURRENT_GRADE_ID,
        futureMeasurementGradeId: FUTURE_MEASUREMENT_GRADE_ID,
      },
      localReportPath: REPORT_PATH,
    },
    context,
    batches,
    batchStatusCounts: batchStatusCounts(batches),
    openBatchAnalysis,
    finalBatchAnalysis,
    records,
    kg3Templates,
    safetyAssessment,
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(toPlain(report), null, 2)}\n`, "utf8");
  printSummary(report);
}

main().catch((error) => {
  console.error("Inspection failed. No Firestore writes were attempted.");
  console.error(error);
  process.exitCode = 1;
});
