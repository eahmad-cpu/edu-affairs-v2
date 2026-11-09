#!/usr/bin/env node
"use strict";

/*
 * Read-only Firestore inspection for KG3 Learning Gardens page-2 readiness.
 *
 * This script has no Firestore write path and accepts no arguments. It reads
 * only the target templates plus measurement batches that reference them, then
 * writes a local JSON report for review.
 *
 * Usage:
 *   node scripts/kindergarten/inspect-kg3-learning-gardens-page2-readiness.cjs
 */

const admin = require("firebase-admin");
const fs = require("node:fs");
const path = require("node:path");

const ORG_ID = "takween";
const ACADEMIC_YEAR_ID = "ay-1448";
const TERM_ID = "term-1";
const GRADE_ID = "kg3";
const SUBJECT_KEY = "LEARNING_GARDENS";
const TEMPLATE_COLLECTIONS = [
  "studentAssessmentTemplates",
  "studentTrackerTemplates",
];
const BATCH_COLLECTION = "studentMeasurementBatches";
const REPORT_PATH = path.resolve(
  process.cwd(),
  "scripts",
  "kindergarten",
  "reports",
  "inspect-kg3-learning-gardens-page2-readiness-report.json",
);
const OPEN_BATCH_STATUSES = new Set(["DRAFT", "IN_PROGRESS"]);
const FINAL_BATCH_STATUSES = new Set(["SUBMITTED", "REVIEWED", "LOCKED"]);

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

function ownOrNull(value, key) {
  return hasOwn(value, key) ? value[key] ?? null : null;
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

function templateTermIds(template) {
  const values = [
    ...asArray(template.applicableTermIds),
    template.termId,
    template.termKey,
  ];
  return values.map(text).filter(Boolean);
}

function isTargetTemplate(template) {
  return (
    text(template.orgId) === ORG_ID &&
    text(template.academicYearId) === ACADEMIC_YEAR_ID &&
    normalized(template.gradeId) === normalized(GRADE_ID) &&
    normalized(template.subjectKey) === SUBJECT_KEY &&
    templateTermIds(template).includes(TERM_ID)
  );
}

function itemTitle(item) {
  return text(item?.itemTitle) || text(item?.title);
}

function orderedTemplateItems(template) {
  return asArray(template.templateItems)
    .map((item, index) => ({ item: item && typeof item === "object" ? item : {}, index }))
    .sort((left, right) => {
      const leftOrder = finiteNumber(left.item.order) ? left.item.order : left.index + 1;
      const rightOrder = finiteNumber(right.item.order) ? right.item.order : right.index + 1;
      return leftOrder - rightOrder || left.index - right.index;
    })
    .map(({ item }, index) => ({
      order: finiteNumber(item.order) ? item.order : index + 1,
      itemKey: text(item.itemKey),
      itemId: text(item.itemId),
      itemTitle: itemTitle(item),
      maxScore: finiteNumber(item.maxScore) ? item.maxScore : null,
    }));
}

function parseAssessmentDetails(template) {
  const searchable = [template.id, template.code, template.templateCode, template.title]
    .map(text)
    .join(" ");
  const assessmentNumber = Number(
    searchable.match(/assessment[_\s-]?(\d+)/i)?.[1] ||
      searchable.match(/(?:قياس|assessment)\s*(?:رقم\s*)?(\d+)/i)?.[1],
  );
  const week = Number(searchable.match(/week[_\s-]?(\d+)/i)?.[1]);

  return {
    assessmentNumber: Number.isInteger(assessmentNumber) ? assessmentNumber : null,
    week: Number.isInteger(week) ? week : null,
  };
}

function templateIssues(items) {
  const issues = [];
  const keys = new Map();
  const ids = new Map();

  for (const item of items) {
    if (!item.itemKey) issues.push({ type: "MISSING_TEMPLATE_ITEM_KEY", order: item.order });
    if (!item.itemId) issues.push({ type: "MISSING_TEMPLATE_ITEM_ID", order: item.order });
    if (item.itemKey) {
      keys.set(item.itemKey, (keys.get(item.itemKey) || 0) + 1);
    }
    if (item.itemId) {
      ids.set(item.itemId, (ids.get(item.itemId) || 0) + 1);
    }
  }

  for (const [itemKey, count] of keys) {
    if (count > 1) issues.push({ type: "DUPLICATE_TEMPLATE_ITEM_KEY", itemKey, count });
  }
  for (const [itemId, count] of ids) {
    if (count > 1) issues.push({ type: "DUPLICATE_TEMPLATE_ITEM_ID", itemId, count });
  }
  return issues;
}

function createTemplateRecord(snapshot, collection) {
  const template = snapshot.data() || {};
  const items = orderedTemplateItems(template);
  const details = parseAssessmentDetails({ id: snapshot.id, ...template });

  return {
    templateId: snapshot.id,
    firestorePath: snapshot.ref.path,
    templateCollection: collection,
    title: text(template.title),
    code: text(template.code || template.templateCode),
    assessmentNumber: details.assessmentNumber,
    week: details.week,
    status: text(template.status),
    isActive: template.isActive === true,
    maxScore: finiteNumber(template.maxScore) ? template.maxScore : null,
    templateItemsCount: items.length,
    templateItems: items,
    templateItemIssues: templateIssues(items),
  };
}

function itemPairMatches(item, templateItem) {
  return (
    text(item?.itemKey) === templateItem.itemKey &&
    text(item?.itemId) === templateItem.itemId
  );
}

function inspectRow(row, rowIndex, templateItems) {
  const rowObject = row && typeof row === "object" ? row : null;
  const hasItemScores = Boolean(rowObject && hasOwn(rowObject, "itemScores"));
  const items = asArray(rowObject?.itemScores);
  const count = items.length;
  const numericScoreCount = items.filter((item) => finiteNumber(item?.score)).length;
  const missingIdentifiers = [];
  const mismatches = [];
  const invalidItems = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item || typeof item !== "object") {
      invalidItems.push(index + 1);
      continue;
    }
    if (!text(item.itemKey) || !text(item.itemId)) {
      missingIdentifiers.push(index + 1);
      continue;
    }
    const templateItem = templateItems[index];
    if (!templateItem || !itemPairMatches(item, templateItem)) {
      mismatches.push({
        position: index + 1,
        itemKey: text(item.itemKey),
        itemId: text(item.itemId),
        expectedItemKey: templateItem?.itemKey || null,
        expectedItemId: templateItem?.itemId || null,
      });
    }
  }

  let shape;
  if (!rowObject) shape = "INVALID_ROW";
  else if (!hasItemScores) shape = "MISSING_ITEM_SCORES";
  else if (!Array.isArray(rowObject.itemScores)) shape = "NON_ARRAY_ITEM_SCORES";
  else if (count === 0) shape = "EMPTY_ITEM_SCORES";
  else if (invalidItems.length > 0) shape = "NON_OBJECT_ITEM_SCORE";
  else if (missingIdentifiers.length > 0) shape = "MISSING_ITEM_IDENTIFIERS";
  else if (count > templateItems.length) shape = "MORE_ITEMS_THAN_TEMPLATE";
  else if (mismatches.length > 0) shape = "ITEM_IDENTIFIER_MISMATCH";
  else if (count === templateItems.length) shape = "EXACT_TEMPLATE_SNAPSHOT";
  else shape = "TEMPLATE_PREFIX_SNAPSHOT";

  return {
    rowIndex: rowIndex + 1,
    itemScoresPresent: hasItemScores,
    itemScoresCount: count,
    numericItemScoresCount: numericScoreCount,
    hasNumericItemScores: numericScoreCount > 0,
    rowMaxScore: ownOrNull(rowObject || {}, "maxScore"),
    rowScore: ownOrNull(rowObject || {}, "score"),
    shape,
    missingIdentifierPositions: missingIdentifiers,
    invalidItemPositions: invalidItems,
    identifierMismatches: mismatches,
  };
}

function summarizeRowShapes(rowInspections) {
  return rowInspections.reduce((counts, row) => {
    counts[row.shape] = (counts[row.shape] || 0) + 1;
    return counts;
  }, {});
}

function uniqueNonNull(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined))];
}

function createBatchRecord(snapshot, templateById) {
  const batch = snapshot.data() || {};
  const templateId = text(batch.templateId);
  const template = templateById.get(templateId);
  const rows = asArray(batch.studentRows);
  const rowInspections = rows.map((row, index) =>
    inspectRow(row, index, template?.templateItems || []),
  );
  const itemScoresCounts = rowInspections.map((row) => row.itemScoresCount);
  const numericScoresStored = rowInspections.reduce(
    (total, row) => total + row.numericItemScoresCount,
    0,
  );
  const nonEmptyShapes = rowInspections
    .filter((row) => row.itemScoresCount > 0)
    .map((row) => row.shape);

  return {
    batchId: snapshot.id,
    firestorePath: snapshot.ref.path,
    templateId,
    schoolId: text(batch.schoolId),
    classId: text(batch.classId),
    academicYearId: text(batch.academicYearId),
    status: text(batch.status),
    createdByPersonId: text(batch.createdByPersonId) || null,
    numberOfStudentRows: rows.length,
    itemScoresCountsByRow: itemScoresCounts,
    minimumItemScoresCountPerRow: itemScoresCounts.length ? Math.min(...itemScoresCounts) : 0,
    maximumItemScoresCountPerRow: itemScoresCounts.length ? Math.max(...itemScoresCounts) : 0,
    rowsWithEnteredNumericScores: rowInspections.filter((row) => row.hasNumericItemScores).length,
    numericItemScoresStored: numericScoresStored,
    batchMaxScore: ownOrNull(batch, "maxScore"),
    rowMaxScoresPresent: uniqueNonNull(rowInspections.map((row) => row.rowMaxScore)),
    rowShapeCounts: summarizeRowShapes(rowInspections),
    rowInspections,
    snapshotAssessment: {
      hasEmbeddedItemScores: rowInspections.some((row) => row.itemScoresPresent),
      allRowsHaveEmbeddedItemScores: rows.length > 0 && rowInspections.every((row) => row.itemScoresPresent),
      nonEmptySnapshotRows: rowInspections.filter((row) => row.itemScoresCount > 0).length,
      allNonEmptyRowsMatchCurrentTemplate:
        nonEmptyShapes.length > 0 &&
        nonEmptyShapes.every(
          (shape) =>
            shape === "EXACT_TEMPLATE_SNAPSHOT" ||
            shape === "TEMPLATE_PREFIX_SNAPSHOT",
        ),
      allNonEmptyRowsExactCurrentTemplate:
        nonEmptyShapes.length > 0 &&
        nonEmptyShapes.every((shape) => shape === "EXACT_TEMPLATE_SNAPSHOT"),
    },
  };
}

function countStatuses(batches) {
  const counts = {
    DRAFT: 0,
    IN_PROGRESS: 0,
    SUBMITTED: 0,
    REVIEWED: 0,
    LOCKED: 0,
    other: 0,
  };
  for (const batch of batches) {
    const status = normalized(batch.status);
    if (hasOwn(counts, status)) counts[status] += 1;
    else counts.other += 1;
  }
  return counts;
}

function openBatchAnalysis(batches) {
  const openBatches = batches.filter((batch) => OPEN_BATCH_STATUSES.has(normalized(batch.status)));
  const rows = openBatches.flatMap((batch) =>
    batch.rowInspections.map((row) => ({ batchId: batch.batchId, ...row })),
  );
  const unexpectedRows = rows.filter(
    (row) =>
      ![
        "EXACT_TEMPLATE_SNAPSHOT",
        "TEMPLATE_PREFIX_SNAPSHOT",
        "EMPTY_ITEM_SCORES",
      ].includes(row.shape),
  );
  const batchesWithMixedShapes = openBatches.filter(
    (batch) => Object.keys(batch.rowShapeCounts).length > 1,
  );
  const rowsWithMissingItemScores = rows.filter(
    (row) => row.shape === "MISSING_ITEM_SCORES" || row.shape === "NON_ARRAY_ITEM_SCORES",
  );
  const scoredRowsWithUnsafeShape = rows.filter(
    (row) =>
      row.hasNumericItemScores &&
      !["EXACT_TEMPLATE_SNAPSHOT", "TEMPLATE_PREFIX_SNAPSHOT"].includes(row.shape),
  );
  const snapshotRows = rows.filter((row) => row.itemScoresPresent && row.itemScoresCount > 0);
  const allSnapshotKeysStable =
    snapshotRows.length > 0 &&
    snapshotRows.every((row) =>
      ["EXACT_TEMPLATE_SNAPSHOT", "TEMPLATE_PREFIX_SNAPSHOT"].includes(row.shape),
    );
  const requiresExplicitRowExtension = snapshotRows.length > 0;

  return {
    batchCount: openBatches.length,
    studentRowsContainOwnItemScoresSnapshot: snapshotRows.length > 0,
    snapshotRowsCount: snapshotRows.length,
    existingItemKeysAndItemIdsStableAndMatchTemplate: allSnapshotKeysStable,
    existingScoresCanBePreservedByAppendOnlyMigration:
      allSnapshotKeysStable && scoredRowsWithUnsafeShape.length === 0,
    addingTemplateItemsAloneUpdatesExistingDraftRowsAutomatically: false,
    rationale:
      snapshotRows.length > 0
        ? "Existing open batches contain embedded itemScores snapshots. A template-only change cannot append entries inside already-stored batch rows."
        : "No non-empty embedded open-row snapshots were found; application behavior would need separate confirmation before relying on template-only changes.",
    futureMigrationRequiresExplicitOpenRowExtension: requiresExplicitRowExtension,
    extensionGuidance: requiresExplicitRowExtension
      ? "Append empty item-score entries after every existing row itemScores array only after the future page-2 items and exact identifiers are approved. Preserve all existing array entries and scores unchanged."
      : "Do not infer row-extension behavior from this inspection; no non-empty open-row snapshots were available.",
    batchesWithMixedRowShapes: batchesWithMixedShapes.map((batch) => batch.batchId),
    unexpectedRows,
    rowsWithMissingItemScores,
    rowsWithScoresAtRisk: scoredRowsWithUnsafeShape,
    rowsWithEnteredNumericScores: rows.filter((row) => row.hasNumericItemScores).length,
    numericItemScoresStored: rows.reduce(
      (total, row) => total + row.numericItemScoresCount,
      0,
    ),
  };
}

function submittedAnalysis(batches) {
  const finalBatches = batches.filter((batch) => FINAL_BATCH_STATUSES.has(normalized(batch.status)));
  return {
    batchCount: finalBatches.length,
    batches: finalBatches.map((batch) => ({
      batchId: batch.batchId,
      status: batch.status,
      templateId: batch.templateId,
      numberOfStudentRows: batch.numberOfStudentRows,
      maximumItemScoresCountPerRow: batch.maximumItemScoresCountPerRow,
      currentTemplateItemsCount: batch.templateId ? null : null,
      containsOldFirstPageOnlySnapshot:
        batch.snapshotAssessment.nonEmptySnapshotRows > 0 &&
        batch.snapshotAssessment.allNonEmptyRowsExactCurrentTemplate,
      snapshotConclusion:
        batch.snapshotAssessment.nonEmptySnapshotRows === 0
          ? "No non-empty row itemScores snapshot was present."
          : batch.snapshotAssessment.allNonEmptyRowsExactCurrentTemplate
            ? "Rows exactly match the current first-page-only template item snapshot."
            : "Rows do not all exactly match the current template; review before drawing a page-snapshot conclusion.",
    })),
  };
}

function buildRisks(templates, openAnalysis, batches) {
  const risks = [];
  const templateProblems = templates.flatMap((template) =>
    template.templateItemIssues.map((issue) => ({ templateId: template.templateId, ...issue })),
  );
  if (templateProblems.length > 0) {
    risks.push({
      severity: "BLOCKING",
      type: "TEMPLATE_ITEM_IDENTIFIER_PROBLEM",
      details: templateProblems,
    });
  }
  if (openAnalysis.unexpectedRows.length > 0) {
    risks.push({
      severity: "BLOCKING",
      type: "UNEXPECTED_OPEN_ROW_SHAPES",
      details: openAnalysis.unexpectedRows,
    });
  }
  if (openAnalysis.rowsWithScoresAtRisk.length > 0) {
    risks.push({
      severity: "BLOCKING",
      type: "SCORED_OPEN_ROWS_WITH_UNSAFE_SHAPE",
      details: openAnalysis.rowsWithScoresAtRisk,
    });
  }
  if (openAnalysis.futureMigrationRequiresExplicitOpenRowExtension) {
    risks.push({
      severity: "REQUIRES_FUTURE_MIGRATION_STEP",
      type: "OPEN_BATCH_ROW_SNAPSHOTS",
      details:
        "Existing DRAFT/IN_PROGRESS batch rows have embedded itemScores; template-only changes will not extend them.",
    });
  }
  if (batches.some((batch) => FINAL_BATCH_STATUSES.has(normalized(batch.status)))) {
    risks.push({
      severity: "REVIEW_REQUIRED",
      type: "FINAL_BATCHES_PRESENT",
      details:
        "SUBMITTED, REVIEWED, and LOCKED batches are report-only and must remain untouched until separately reviewed.",
    });
  }
  return risks;
}

function printSummary(report) {
  console.log("\nKG3 Learning Gardens page-2 readiness inspection");
  console.log("=".repeat(52));
  console.log(`Templates: ${report.templates.length}`);
  for (const template of report.templates) {
    console.log(
      `  - ${template.templateId} | assessment=${template.assessmentNumber ?? "n/a"} | week=${template.week ?? "n/a"} | items=${template.templateItemsCount} | maxScore=${template.maxScore ?? "n/a"}`,
    );
  }
  console.log("Batch status counts:", report.statusCounts);
  console.log(
    `Open batches (DRAFT + IN_PROGRESS): ${report.draftAndInProgressAnalysis.batchCount}`,
  );
  console.log(
    `Final batches (SUBMITTED + REVIEWED + LOCKED): ${report.submittedAnalysis.batchCount}`,
  );
  console.log(
    `Embedded open-row snapshots: ${report.draftAndInProgressAnalysis.studentRowsContainOwnItemScoresSnapshot}`,
  );
  console.log(
    `Stable open-row identifiers: ${report.draftAndInProgressAnalysis.existingItemKeysAndItemIdsStableAndMatchTemplate}`,
  );
  console.log(
    `Existing open-row scores preserved by append only: ${report.draftAndInProgressAnalysis.existingScoresCanBePreservedByAppendOnlyMigration}`,
  );
  console.log(
    `Future open-row extension required: ${report.draftAndInProgressAnalysis.futureMigrationRequiresExplicitOpenRowExtension}`,
  );
  console.log(
    `Unexpected open rows: ${report.draftAndInProgressAnalysis.unexpectedRows.length}; mixed-shape open batches: ${report.draftAndInProgressAnalysis.batchesWithMixedRowShapes.length}`,
  );
  console.log(
    `Final batches retaining the current first-page-only snapshot: ${report.submittedAnalysis.batches.filter((batch) => batch.containsOldFirstPageOnlySnapshot).length}`,
  );
  console.log(`Safe to append second page: ${report.safeToAppendSecondPage}`);
  console.log(`Blocking reasons: ${report.blockingReasons.length}`);
  console.log(`JSON report: ${REPORT_PATH}`);
}

async function loadBatches(db, templateIds) {
  const batches = [];
  for (let index = 0; index < templateIds.length; index += 30) {
    const templateIdChunk = templateIds.slice(index, index + 30);
    if (templateIdChunk.length === 0) continue;
    const snapshot = await db
      .collection(`orgs/${ORG_ID}/${BATCH_COLLECTION}`)
      .where("templateId", "in", templateIdChunk)
      .get();
    batches.push(...snapshot.docs);
  }
  return batches;
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const collectionSnapshots = await Promise.all(
    TEMPLATE_COLLECTIONS.map(async (collection) => ({
      collection,
      snapshot: await db.collection(`orgs/${ORG_ID}/${collection}`).get(),
    })),
  );
  const templates = collectionSnapshots
    .flatMap(({ collection, snapshot }) =>
      snapshot.docs
        .filter((document) => isTargetTemplate(document.data() || {}))
        .map((document) => createTemplateRecord(document, collection)),
    )
    .sort(
      (left, right) =>
        (left.assessmentNumber ?? Number.MAX_SAFE_INTEGER) -
          (right.assessmentNumber ?? Number.MAX_SAFE_INTEGER) ||
        (left.week ?? Number.MAX_SAFE_INTEGER) - (right.week ?? Number.MAX_SAFE_INTEGER) ||
        left.templateId.localeCompare(right.templateId, "en"),
    );
  const templateById = new Map(templates.map((template) => [template.templateId, template]));
  const batchSnapshots = await loadBatches(db, templates.map((template) => template.templateId));
  const batches = batchSnapshots
    .map((snapshot) => createBatchRecord(snapshot, templateById))
    .sort((left, right) => left.batchId.localeCompare(right.batchId, "en"));
  const draftAndInProgressAnalysis = openBatchAnalysis(batches);
  const submitted = submittedAnalysis(batches);
  const risks = buildRisks(templates, draftAndInProgressAnalysis, batches);
  const blockingReasons = risks
    .filter((risk) => risk.severity === "BLOCKING")
    .map((risk) => risk.type);

  const report = {
    metadata: {
      generatedAt: new Date().toISOString(),
      readOnlyFirestoreInspection: true,
      localReportPath: REPORT_PATH,
      organizationId: ORG_ID,
      academicYearId: ACADEMIC_YEAR_ID,
      termId: TERM_ID,
      gradeId: GRADE_ID,
      subjectKey: SUBJECT_KEY,
      collectionsInspected: [...TEMPLATE_COLLECTIONS, BATCH_COLLECTION],
    },
    templates,
    batches,
    statusCounts: countStatuses(batches),
    draftAndInProgressAnalysis,
    submittedAnalysis: submitted,
    existingItemKeys: Object.fromEntries(
      templates.map((template) => [
        template.templateId,
        template.templateItems.map((item) => ({
          order: item.order,
          itemKey: item.itemKey,
          itemId: item.itemId,
        })),
      ]),
    ),
    unexpectedShapes: {
      templateItemIssues: templates.flatMap((template) =>
        template.templateItemIssues.map((issue) => ({ templateId: template.templateId, ...issue })),
      ),
      openRows: draftAndInProgressAnalysis.unexpectedRows,
      openBatchesWithMixedRowShapes: draftAndInProgressAnalysis.batchesWithMixedRowShapes,
      openRowsWithMissingItemScores: draftAndInProgressAnalysis.rowsWithMissingItemScores,
    },
    risks,
    recommendedMigrationStrategy: {
      keepSameTemplateIds: true,
      preserveExistingItemKeysAndItemIds: true,
      preserveEveryExistingScore: true,
      appendNewItemsAfterExistingItems: true,
      neverReorderOrRenameExistingItems: true,
      updateFinalBatches: false,
      extendDraftAndInProgressRowsOnlyIfRequired:
        draftAndInProgressAnalysis.futureMigrationRequiresExplicitOpenRowExtension,
      note:
        "Before any future write, re-read the exact current templates and open batches, validate every existing positional itemKey/itemId pair, then append only approved new items and empty score entries without changing prior entries.",
    },
    safeToAppendSecondPage: blockingReasons.length === 0,
    blockingReasons,
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  printSummary(report);
}

main().catch((error) => {
  console.error("Inspection failed. No Firestore writes were attempted.");
  console.error(error);
  process.exitCode = 1;
});
