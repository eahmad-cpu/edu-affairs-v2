"use strict";

/**
 * Adds the twelve NEW 1448 / term-1 KG Learning Gardens assessment templates.
 *
 * Safety rules:
 * - Dry run is the default.
 * - Writes require BOTH --apply and the exact --confirm token below.
 * - An existing target document aborts apply; this script never overwrites it.
 * - The only write target is orgs/takween/studentAssessmentTemplates/{targetId}.
 */

const admin = require("firebase-admin");
const path = require("path");

const ORG_ID = "takween";
const COLLECTION_NAME = "studentAssessmentTemplates";
const CONFIRMATION_TOKEN = "KG_LEARNING_GARDENS_TERM1_ASSESSMENTS";
const APPLY_REQUESTED = process.argv.includes("--apply");
const APPLY_CONFIRMED = process.argv.includes(
  `--confirm=${CONFIRMATION_TOKEN}`,
);
const APPLY = APPLY_REQUESTED && APPLY_CONFIRMED;

const ACADEMIC_YEAR_ID = "ay-1448";
const TERM_ID = "term-1";
const SUBJECT_KEY = "LEARNING_GARDENS";
const SUBJECT_ID = "learning-gardens";
const SUBJECT_TITLE = "بساتين المعرفة";
const LEARNING_LOSS_THRESHOLD_PERCENTAGE = 60;

const LEVEL_TITLES = {
  kg1: "المستوى الأول",
  kg2: "المستوى الثاني",
  kg3: "المستوى الثالث",
};

const ASSESSMENT_TITLES = ["الأول", "الثاني", "الثالث", "الرابع"];
const WEEK_TITLES = {
  6: "السادس",
  9: "التاسع",
  13: "الثالث عشر",
  16: "السادس عشر",
};

const TERM_1_SCHEDULE = [
  { assessmentNumber: 1, week: 6, order: 201 },
  { assessmentNumber: 2, week: 9, order: 202 },
  { assessmentNumber: 3, week: 13, order: 203 },
  { assessmentNumber: 4, week: 16, order: 204 },
];

const ITEM_SCORES = {
  kg1: {
    1: [{ title: "الدرجة", maxScore: 15 }],
    2: [{ title: "الدرجة", maxScore: 15 }],
    3: [{ title: "الدرجة", maxScore: 15 }],
    4: [{ title: "الدرجة", maxScore: 15 }],
  },
  kg2: {
    1: [
      { title: "حروف", maxScore: 7 },
      { title: "حرفين", maxScore: 4 },
      { title: "كلمات", maxScore: 4 },
    ],
    2: [
      { title: "حروف", maxScore: 7 },
      { title: "حرفين", maxScore: 4 },
      { title: "كلمات", maxScore: 4 },
    ],
    3: [
      { title: "حروف", maxScore: 7 },
      { title: "كلمات", maxScore: 8 },
    ],
    4: [
      { title: "حروف", maxScore: 7 },
      { title: "كلمات", maxScore: 8 },
    ],
  },
  kg3: {
    1: [
      { title: "حروف", maxScore: 7 },
      { title: "حرفين", maxScore: 4 },
      { title: "كلمات", maxScore: 4 },
    ],
    2: [
      { title: "حروف", maxScore: 7 },
      { title: "كلمات", maxScore: 8 },
    ],
    3: [
      { title: "حروف", maxScore: 7 },
      { title: "كلمات", maxScore: 8 },
    ],
    4: [
      { title: "حروف", maxScore: 7 },
      { title: "كلمات", maxScore: 8 },
    ],
  },
};

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

function sumItemMaxScores(items) {
  return items.reduce((sum, item) => sum + item.maxScore, 0);
}

function templateKind(assessmentNumber) {
  if (assessmentNumber <= 3) {
    return `KG_MEASUREMENT_${assessmentNumber}`;
  }

  // The current contract has KG slots only for assessments 1–3.
  return "CUSTOM_ASSESSMENT";
}

function assessmentSlot(assessmentNumber) {
  if (assessmentNumber <= 3) {
    return `KG_MEASUREMENT_${assessmentNumber}`;
  }

  return "CUSTOM";
}

function buildTemplateItems(templateId, itemDefinitions) {
  return itemDefinitions.map((item, index) => {
    const order = index + 1;
    const itemId = `${templateId}-${order}`;

    return {
      itemKey: itemId,
      itemId,
      itemTitle: item.title,
      title: item.title,
      category: SUBJECT_KEY,
      valueType: "NUMERIC",
      maxScore: item.maxScore,
      weight: 1,
      affectsTotal: true,
      required: true,
      order,
    };
  });
}

function buildTemplate({ gradeId, assessmentNumber, week, order }) {
  const templateId = `${gradeId}-learning-gardens-term1-week${String(week).padStart(2, "0")}-assessment-${assessmentNumber}`;
  const code = `${gradeId.toUpperCase()}_LEARNING_GARDENS_TERM1_WEEK${String(week).padStart(2, "0")}_ASSESSMENT_${assessmentNumber}`;
  const title = `${SUBJECT_TITLE} — ${LEVEL_TITLES[gradeId]} — القياس ${ASSESSMENT_TITLES[assessmentNumber - 1]} — الفصل الدراسي الأول — الأسبوع ${WEEK_TITLES[week]}`;
  const templateItems = buildTemplateItems(
    templateId,
    ITEM_SCORES[gradeId][assessmentNumber],
  );

  return {
    id: templateId,
    code,
    title,

    orgId: ORG_ID,
    schoolType: "KG",
    schoolId: "",
    academicYearId: ACADEMIC_YEAR_ID,
    applicableTermIds: [TERM_ID],
    gradeId,

    subjectKey: SUBJECT_KEY,
    subjectId: SUBJECT_ID,
    subjectTitle: SUBJECT_TITLE,

    kind: templateKind(assessmentNumber),
    assessmentSlot: assessmentSlot(assessmentNumber),
    evaluatorRoleKey: "KG_TEACHER",

    maxScore: 15,
    scoreType: "NUMERIC",
    totalScoreLabel: "المجموع: 15",
    templateItems,

    requiresLearningLossFollowUp: true,
    learningLossThresholdPercentage: LEARNING_LOSS_THRESHOLD_PERCENTAGE,

    isActive: true,
    status: "ACTIVE",
    order,

    source: "seed-kg-learning-gardens-term1-assessments",
  };
}

function buildTemplates() {
  return ["kg1", "kg2", "kg3"].flatMap((gradeId) =>
    TERM_1_SCHEDULE.map((schedule) => buildTemplate({ gradeId, ...schedule })),
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(`Validation failed: ${message}`);
}

function sameItemStructure(items, expectedItems) {
  return (
    items.length === expectedItems.length &&
    items.every(
      (item, index) =>
        item.itemTitle === expectedItems[index].title &&
        item.maxScore === expectedItems[index].maxScore,
    )
  );
}

function validateTemplates(templates) {
  assert(templates.length === 12, "exactly 12 templates are required");

  const uniqueIds = new Set(templates.map((template) => template.id));
  const uniqueCodes = new Set(templates.map((template) => template.code));
  assert(uniqueIds.size === templates.length, "template IDs must be unique");
  assert(uniqueCodes.size === templates.length, "template codes must be unique");

  for (const gradeId of ["kg1", "kg2", "kg3"]) {
    const gradeTemplates = templates.filter(
      (template) => template.gradeId === gradeId,
    );
    assert(gradeTemplates.length === 4, `${gradeId} must have four templates`);
  }

  for (const template of templates) {
    const assessmentNumber = Number(template.id.match(/assessment-(\d+)$/)?.[1]);
    const week = Number(template.id.match(/week(\d+)-assessment/)?.[1]);
    const itemSum = sumItemMaxScores(template.templateItems);

    assert(template.maxScore === 15, `${template.id} maxScore must be 15`);
    assert(itemSum === 15, `${template.id} item max-score sum must be 15`);
    assert(template.subjectKey === SUBJECT_KEY, `${template.id} subjectKey`);
    assert(template.schoolType === "KG", `${template.id} schoolType`);
    assert(template.schoolId === "", `${template.id} must be generic schoolId`);
    assert(template.academicYearId === ACADEMIC_YEAR_ID, `${template.id} academicYearId`);
    assert(
      template.applicableTermIds.length === 1 &&
        template.applicableTermIds[0] === TERM_ID,
      `${template.id} applicableTermIds`,
    );
    assert(
      template.title.includes("الفصل الدراسي الأول"),
      `${template.id} must include the first-semester title`,
    );
    assert([6, 9, 13, 16].includes(week), `${template.id} week`);
    assert(
      Number.isInteger(assessmentNumber) && assessmentNumber >= 1 && assessmentNumber <= 4,
      `${template.id} assessment number`,
    );
    assert(
      sameItemStructure(
        template.templateItems,
        ITEM_SCORES[template.gradeId][assessmentNumber],
      ),
      `${template.id} item structure`,
    );
  }
}

function printTemplate(action, template) {
  const itemSum = sumItemMaxScores(template.templateItems);
  const week = Number(template.id.match(/week(\d+)-assessment/)?.[1]);

  console.log(`\n${action} ${COLLECTION_NAME}/${template.id}`);
  console.log({
    title: template.title,
    gradeId: template.gradeId,
    academicYearId: template.academicYearId,
    subjectKey: template.subjectKey,
    week,
    itemCount: template.templateItems.length,
    items: template.templateItems.map((item) => ({
      title: item.itemTitle,
      maxScore: item.maxScore,
    })),
    calculatedItemMaxScoreSum: itemSum,
    templateMaxScore: template.maxScore,
  });
}

async function main() {
  if (APPLY_REQUESTED && !APPLY_CONFIRMED) {
    throw new Error(
      `Refusing to apply without --confirm=${CONFIRMATION_TOKEN}.`,
    );
  }

  const templates = buildTemplates();
  validateTemplates(templates);

  initAdmin();
  const db = admin.firestore();
  const collectionRef = db.collection(`orgs/${ORG_ID}/${COLLECTION_NAME}`);
  const targetSnapshots = await Promise.all(
    templates.map((template) => collectionRef.doc(template.id).get()),
  );

  const existingIds = [];
  let created = 0;
  let updated = 0;

  for (let index = 0; index < templates.length; index += 1) {
    const template = templates[index];
    const exists = targetSnapshots[index].exists;
    const action = exists ? "UPDATE" : "CREATE";

    if (exists) {
      updated += 1;
      existingIds.push(template.id);
    } else {
      created += 1;
    }

    printTemplate(action, template);
  }

  console.log("\nSummary");
  console.log({
    mode: APPLY ? "APPLY" : "DRY RUN",
    targetCollection: `orgs/${ORG_ID}/${COLLECTION_NAME}`,
    targetTemplates: templates.length,
    created,
    updated,
  });

  if (existingIds.length > 0) {
    console.warn(
      `WARNING: ${existingIds.length} target ID(s) already exist. No existing document will be overwritten.`,
    );
    console.warn(existingIds);
  }

  if (!APPLY) {
    console.log(
      `\nDry run only. To apply, use: node scripts/kindergarten/seed-kg-learning-gardens-term1-assessments.cjs --apply --confirm=${CONFIRMATION_TOKEN}`,
    );
    return;
  }

  assert(
    existingIds.length === 0,
    "apply aborted because one or more target template IDs already exist",
  );

  const now = Date.now();
  const batch = db.batch();
  for (const template of templates) {
    batch.create(collectionRef.doc(template.id), {
      ...template,
      createdAt: now,
      updatedAt: now,
    });
  }

  await batch.commit();
  console.log(`\nCreated ${templates.length} new assessment templates.`);
}

main().catch((error) => {
  console.error("KG Learning Gardens term-1 assessment seed failed.");
  console.error(error);
  process.exitCode = 1;
});
