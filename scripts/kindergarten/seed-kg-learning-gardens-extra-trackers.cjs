/*
 * Additional Learning Gardens tracker templates for kindergarten.
 *
 * Default:
 *   DRY RUN
 *
 * Apply:
 *   node scripts/kindergarten/seed-kg-learning-gardens-extra-trackers.cjs --apply --confirm=KG_LEARNING_GARDENS_EXTRA_TRACKERS
 *
 * Creates only 3 generic KG tracker templates:
 *   kg1 -> all KG schools
 *   kg2 -> all KG schools
 *   kg3 -> all KG schools
 *
 * They are restricted to LEARNING_GARDENS.
 */

const admin = require("firebase-admin");
const path = require("node:path");

const ORG_ID = process.env.ORG_ID || "takween";

const CONFIRMATION = "KG_LEARNING_GARDENS_EXTRA_TRACKERS";

const APPLY_REQUESTED = process.argv.includes("--apply");
const APPLY_CONFIRMED = process.argv.includes(`--confirm=${CONFIRMATION}`);
const APPLY = APPLY_REQUESTED && APPLY_CONFIRMED;

const ITEM_MAX_SCORE = 3;
const LEARNING_LOSS_THRESHOLD_PERCENTAGE = 60;

const SUBJECT_KEY = "LEARNING_GARDENS";
const SUBJECT_ID = "learning-gardens";
const SUBJECT_TITLE = "بساتين المعرفة";

const now = Date.now();

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

function makeItems(templateId, titles) {
  return titles.map((title, index) => {
    const order = index + 1;

    return {
      itemKey: `${templateId}-${order}`,
      itemId: `${templateId}-${order}`,
      itemTitle: title,
      title,

      category: "LEARNING_GARDENS",
      valueType: "NUMERIC",

      maxScore: ITEM_MAX_SCORE,
      weight: 1,
      affectsTotal: true,
      required: false,

      order,
    };
  });
}

function buildTrackerTemplate({
  id,
  code,
  title,
  gradeId,
  levelTitle,
  itemTitles,
  order,
}) {
  const templateItems = makeItems(id, itemTitles);
  const maxScore = templateItems.reduce(
    (sum, item) => sum + item.maxScore,
    0,
  );

  return {
    id,
    code,
    title,

    orgId: ORG_ID,

    // Generic for all four kindergarten schools.
    schoolType: "KG",
    schoolId: "",
    academicYearId: "",

    // Restricts each template to its own kindergarten level.
    gradeId,

    subjectKey: SUBJECT_KEY,
    subjectId: SUBJECT_ID,
    subjectTitle: SUBJECT_TITLE,

    kind: "KG_LEARNING_GARDENS_TRACKER",
    evaluatorRoleKey: "KG_TEACHER",

    defaultLessonTitle: `متابعة بساتين المعرفة — ${levelTitle}`,
    isContinuous: true,

    maxScore,
    itemMaxScore: ITEM_MAX_SCORE,
    scoreScaleLabel: "الدرجة العظمى لكل بند: 3",
    totalScoreLabel: `المجموع: ${maxScore}`,

    templateItems,

    requiresLearningLossFollowUp: true,
    learningLossThresholdPercentage:
      LEARNING_LOSS_THRESHOLD_PERCENTAGE,

    isActive: true,
    status: "ACTIVE",
    order,

    ownerRoleKey: "KG_CLASS_TEACHER",
    ownerRoleLabel: "معلمة الصف",

    source: "seed-kg-learning-gardens-extra-trackers",
    createdAt: now,
    updatedAt: now,
  };
}

/*
 * KG1
 *
 * اسم الطالب/ة does NOT belong to the template.
 * Student names come from the class roster.
 */
const KG1_ITEMS = [
  "وحدة أهلا وسهلا",
  "ما قبل الكتابة",
  "ب",
  "ح",
  "س",
  "ر",
  "م",
  "ش",
  "ك",
  "أ",
  "خ",
  "ف",
  "ص",
  "د",
  "ث",
  "ز",
];

/*
 * KG2
 *
 * حرفين appears twice intentionally.
 * كلمات appears twice intentionally.
 *
 * itemKey is based on position, so duplicate visible titles
 * remain separate independent columns.
 */
const KG2_ITEMS = [
  "وحدة أهلا وسهلا",
  "ما قبل الكتابة",
  "ب",
  "ح",
  "س",
  "ر",
  "حرفين",
  "م",
  "ش",
  "ك",
  "حرفين",
  "كلمات",
  "أ",
  "خ",
  "ف",
  "ص",
  "د",
  "ث",
  "ز",
  "كلمات",
];

/*
 * KG3
 *
 * No "وحدة أهلا وسهلا".
 * Ends at ث.
 */
const KG3_ITEMS = [
  "ما قبل الكتابة",
  "ب",
  "ح",
  "س",
  "ر",
  "حرفين",
  "م",
  "ش",
  "ك",
  "حرفين",
  "كلمات",
  "أ",
  "خ",
  "ف",
  "ص",
  "د",
  "ث",
];

const trackerTemplates = [
  buildTrackerTemplate({
    id: "kg1-learning-gardens-extra-tracker",
    code: "KG1_LEARNING_GARDENS_EXTRA_TRACKER",
    title: "بساتين المعرفة — المستوى الأول — متابعة الفصل الأول",
    gradeId: "kg1",
    levelTitle: "المستوى الأول",
    itemTitles: KG1_ITEMS,
    order: 110,
  }),

  buildTrackerTemplate({
    id: "kg2-learning-gardens-extra-tracker",
    code: "KG2_LEARNING_GARDENS_EXTRA_TRACKER",
    title: "بساتين المعرفة — المستوى الثاني — متابعة الفصل الأول",
    gradeId: "kg2",
    levelTitle: "المستوى الثاني",
    itemTitles: KG2_ITEMS,
    order: 110,
  }),

  buildTrackerTemplate({
    id: "kg3-learning-gardens-extra-tracker",
    code: "KG3_LEARNING_GARDENS_EXTRA_TRACKER",
    title: "بساتين المعرفة — المستوى الثالث — متابعة الفصل الأول",
    gradeId: "kg3",
    levelTitle: "المستوى الثالث",
    itemTitles: KG3_ITEMS,
    order: 110,
  }),
];

async function inspectExistingTemplate(db, template) {
  const ref = db
    .collection("orgs")
    .doc(ORG_ID)
    .collection("studentTrackerTemplates")
    .doc(template.id);

  const snap = await ref.get();

  return {
    ref,
    exists: snap.exists,
  };
}

async function main() {
  initAdmin();

  const db = admin.firestore();

  console.log("");
  console.log("==============================================");
  console.log("KG Learning Gardens additional trackers");
  console.log("==============================================");
  console.log({
    orgId: ORG_ID,
    mode: APPLY ? "APPLY" : "DRY_RUN",
    subjectKey: SUBJECT_KEY,
    schoolType: "KG",
    targetSchools: ["kg-01", "kg-02", "kg-03", "kg-04"],
  });
  console.log("");

  if (APPLY_REQUESTED && !APPLY_CONFIRMED) {
    throw new Error(
      `Apply requested without confirmation. Use --confirm=${CONFIRMATION}`,
    );
  }

  const result = {
    mode: APPLY ? "APPLY" : "DRY_RUN",
    created: 0,
    updated: 0,
    unchanged: 0,
    templates: [],
  };

  for (const template of trackerTemplates) {
    const { ref, exists } = await inspectExistingTemplate(db, template);

    const action = exists ? "UPDATE" : "CREATE";

    console.log("----------------------------------------------");
    console.log(`${APPLY ? "APPLY" : "DRY RUN"} ${action}`);
    console.log(ref.path);
    console.log({
      title: template.title,
      gradeId: template.gradeId,
      subjectKey: template.subjectKey,
      schoolId: template.schoolId,
      schoolType: template.schoolType,
      itemsCount: template.templateItems.length,
      maxScore: template.maxScore,
      itemMaxScore: template.itemMaxScore,
      items: template.templateItems.map((item) => ({
        order: item.order,
        itemKey: item.itemKey,
        title: item.itemTitle,
      })),
    });

    if (APPLY) {
      await ref.set(template, { merge: false });
    }

    if (exists) {
      result.updated += 1;
    } else {
      result.created += 1;
    }

    result.templates.push({
      id: template.id,
      gradeId: template.gradeId,
      items: template.templateItems.length,
      action,
    });
  }

  console.log("");
  console.log("==============================================");
  console.log("Result");
  console.log("==============================================");
  console.log(result);

  if (!APPLY) {
    console.log("");
    console.log("No Firestore writes were made.");
    console.log("");
    console.log("To apply:");
    console.log(
      `node scripts/kindergarten/seed-kg-learning-gardens-extra-trackers.cjs --apply --confirm=${CONFIRMATION}`,
    );
  }
}

main().catch((error) => {
  console.error("");
  console.error("Failed to seed KG Learning Gardens additional trackers.");
  console.error(error);
  process.exit(1);
});