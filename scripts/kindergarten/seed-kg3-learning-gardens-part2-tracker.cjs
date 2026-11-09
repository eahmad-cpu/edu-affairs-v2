#!/usr/bin/env node
"use strict";

/*
 * Creates only the standalone KG3 Learning Gardens page-2 tracker.
 *
 * Default: DRY RUN
 * Apply: node scripts/kindergarten/seed-kg3-learning-gardens-part2-tracker.cjs --apply --confirm=KG3_LEARNING_GARDENS_PART2_TRACKER
 *
 * This script never reads or writes measurement batches and never modifies an
 * existing template. Apply creates exactly one previously missing document.
 */

const admin = require("firebase-admin");
const path = require("node:path");

const ORG_ID = "takween";
const COLLECTION_NAME = "studentTrackerTemplates";
const TEMPLATE_ID = "kg3-learning-gardens-part2-tracker";
const CONFIRMATION = "KG3_LEARNING_GARDENS_PART2_TRACKER";
const APPLY_REQUESTED = process.argv.includes("--apply");
const APPLY_CONFIRMED = process.argv.includes(`--confirm=${CONFIRMATION}`);
const APPLY = APPLY_REQUESTED && APPLY_CONFIRMED;

const ITEM_MAX_SCORE = 3;
const TOTAL_MAX_SCORE = 54;
const SUBJECT_KEY = "LEARNING_GARDENS";
const SUBJECT_ID = "learning-gardens";
const SUBJECT_TITLE = "بساتين المعرفة";
const ITEM_TITLES = [
  "ز",
  "كلمات",
  "ط",
  "ل",
  "و",
  "ت",
  "ج",
  "ض",
  "ق",
  "كلمات",
  "ع",
  "ي",
  "ذ",
  "ن",
  "ظ",
  "هـ",
  "غ",
  "كلمات",
];

function assert(condition, message) {
  if (!condition) throw new Error(`Validation failed: ${message}`);
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

function buildTemplateItems() {
  return ITEM_TITLES.map((title, index) => {
    const order = index + 1;
    const itemId = `${TEMPLATE_ID}-${order}`;

    return {
      itemKey: itemId,
      itemId,
      itemTitle: title,
      title,
      category: SUBJECT_KEY,
      valueType: "NUMERIC",
      maxScore: ITEM_MAX_SCORE,
      weight: 1,
      affectsTotal: true,
      required: false,
      order,
    };
  });
}

function buildTemplate() {
  const templateItems = buildTemplateItems();

  return {
    id: TEMPLATE_ID,
    code: "KG3_LEARNING_GARDENS_PART2_TRACKER",
    title: "بساتين المعرفة — المستوى الثالث — الجزء الثاني — متابعة الفصل الأول",
    orgId: ORG_ID,
    schoolType: "KG",
    schoolId: "",
    academicYearId: "",
    gradeId: "kg3",
    subjectKey: SUBJECT_KEY,
    subjectId: SUBJECT_ID,
    subjectTitle: SUBJECT_TITLE,
    kind: "KG_LEARNING_GARDENS_TRACKER",
    evaluatorRoleKey: "KG_TEACHER",
    defaultLessonTitle: "متابعة بساتين المعرفة — المستوى الثالث — الجزء الثاني",
    isContinuous: true,
    maxScore: TOTAL_MAX_SCORE,
    itemMaxScore: ITEM_MAX_SCORE,
    scoreScaleLabel: "الدرجة العظمى لكل بند: 3",
    totalScoreLabel: "المجموع: 54",
    templateItems,
    requiresLearningLossFollowUp: true,
    learningLossThresholdPercentage: 60,
    isActive: true,
    status: "ACTIVE",
    order: 111,
    ownerRoleKey: "KG_CLASS_TEACHER",
    ownerRoleLabel: "معلمة الصف",
    source: "seed-kg3-learning-gardens-part2-tracker",
  };
}

function validateTemplate(template) {
  assert(template.id === TEMPLATE_ID, "template ID must be stable");
  assert(template.gradeId === "kg3", "gradeId must be kg3");
  assert(template.subjectKey === SUBJECT_KEY, "subjectKey must be LEARNING_GARDENS");
  assert(template.templateItems.length === 18, "exactly 18 page-2 items are required");
  assert(template.maxScore === TOTAL_MAX_SCORE, "maxScore must be 54");
  assert(template.itemMaxScore === ITEM_MAX_SCORE, "itemMaxScore must be 3");

  const itemKeys = new Set();
  const itemIds = new Set();
  for (let index = 0; index < template.templateItems.length; index += 1) {
    const item = template.templateItems[index];
    const order = index + 1;
    const expectedId = `${TEMPLATE_ID}-${order}`;

    assert(item.order === order, `item ${order} order must be ${order}`);
    assert(item.itemKey === expectedId, `item ${order} itemKey must be ${expectedId}`);
    assert(item.itemId === expectedId, `item ${order} itemId must be ${expectedId}`);
    assert(item.itemTitle === ITEM_TITLES[index], `item ${order} title must match page 2`);
    assert(item.maxScore === ITEM_MAX_SCORE, `item ${order} maxScore must be 3`);
    assert(item.category === SUBJECT_KEY, `item ${order} category must match subject`);
    assert(item.valueType === "NUMERIC", `item ${order} valueType must be NUMERIC`);
    assert(item.weight === 1, `item ${order} weight must be 1`);
    assert(item.affectsTotal === true, `item ${order} must affect total`);
    assert(item.required === false, `item ${order} must be optional`);
    assert(!itemKeys.has(item.itemKey), `item ${order} itemKey must be unique`);
    assert(!itemIds.has(item.itemId), `item ${order} itemId must be unique`);
    itemKeys.add(item.itemKey);
    itemIds.add(item.itemId);
  }

  assert(itemKeys.size === 18, "all 18 itemKeys must be unique");
  assert(itemIds.size === 18, "all 18 itemIds must be unique");
  assert(
    template.templateItems.filter((item) => item.itemTitle === "كلمات").length === 3,
    "the three كلمات columns must remain separate items",
  );
  assert(
    template.templateItems.reduce((sum, item) => sum + item.maxScore, 0) ===
      TOTAL_MAX_SCORE,
    "item max-score sum must be 54",
  );
}

function printPreview(template, targetPath, action) {
  console.log("\nKG3 Learning Gardens page-2 tracker");
  console.log("=".repeat(44));
  console.log({
    templateId: template.id,
    title: template.title,
    gradeId: template.gradeId,
    subjectKey: template.subjectKey,
    itemCount: template.templateItems.length,
    maxScore: template.maxScore,
    targetFirestorePath: targetPath,
    action,
    writesPerformed: 0,
  });
  console.table(
    template.templateItems.map((item) => ({
      order: item.order,
      itemKey: item.itemKey,
      title: item.itemTitle,
      maxScore: item.maxScore,
    })),
  );
}

async function main() {
  if (APPLY_REQUESTED && !APPLY_CONFIRMED) {
    throw new Error(`Apply requires --confirm=${CONFIRMATION}.`);
  }
  if (!APPLY_REQUESTED && APPLY_CONFIRMED) {
    throw new Error("Confirmation is not valid without --apply.");
  }

  const template = buildTemplate();
  validateTemplate(template);
  initAdmin();

  const db = admin.firestore();
  const targetRef = db.doc(`orgs/${ORG_ID}/${COLLECTION_NAME}/${TEMPLATE_ID}`);
  const targetSnapshot = await targetRef.get();
  const action = targetSnapshot.exists ? "EXISTS" : "WOULD_CREATE";

  printPreview(template, targetRef.path, action);

  if (!APPLY) {
    console.log("No Firestore writes were made.");
    console.log(
      `Manual apply: node scripts/kindergarten/seed-kg3-learning-gardens-part2-tracker.cjs --apply --confirm=${CONFIRMATION}`,
    );
    return;
  }

  if (targetSnapshot.exists) {
    throw new Error(
      `${targetRef.path} already exists. Refusing to overwrite an existing template.`,
    );
  }

  const now = Date.now();
  await targetRef.create({
    ...template,
    createdAt: now,
    updatedAt: now,
  });
  console.log("Created exactly one Firestore document.");
}

main().catch((error) => {
  console.error("KG3 Learning Gardens page-2 tracker seed failed.");
  console.error(error);
  process.exitCode = 1;
});
