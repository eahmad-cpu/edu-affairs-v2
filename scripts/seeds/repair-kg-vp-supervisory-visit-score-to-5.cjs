const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.resolve("service-account.json"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const db = admin.firestore();

const APPLY = process.argv.includes("--apply");

const ORG_ID = "takween";

const FRAMEWORK_ID = "kg-vp-supervisory-visit-v1";
const SECTION_ID = "kg-vp-supervisory-visit-v1__main";

const ITEMS_COUNT = 22;
const ITEM_MAX_SCORE = 5;
const TOTAL_MAX_SCORE = ITEMS_COUNT * ITEM_MAX_SCORE;

async function main() {
  console.log(APPLY ? "APPLY mode" : "Preview mode - no writes");

  const orgRef = db.collection("orgs").doc(ORG_ID);
  const now = Date.now();

  const itemsSnap = await orgRef
    .collection("evaluationRubricItems")
    .where("frameworkId", "==", FRAMEWORK_ID)
    .get();

  const items = itemsSnap.docs.map((doc) => ({
    id: doc.id,
    ref: doc.ref,
    ...doc.data(),
  }));

  const activeItems = items.filter((item) => item.status === "ACTIVE");

  const writes = [];

  writes.push({
    label: `framework:${FRAMEWORK_ID}`,
    ref: orgRef.collection("evaluationFrameworks").doc(FRAMEWORK_ID),
    data: {
      totalMaxScore: TOTAL_MAX_SCORE,
      updatedAt: now,
    },
  });

  writes.push({
    label: `section:${SECTION_ID}`,
    ref: orgRef.collection("evaluationRubricSections").doc(SECTION_ID),
    data: {
      maxScore: TOTAL_MAX_SCORE,
      weight: 100,
      updatedAt: now,
    },
  });

  for (const item of activeItems) {
    writes.push({
      label: `item:${item.id}`,
      ref: item.ref,
      data: {
        maxScore: ITEM_MAX_SCORE,
        weight: 1,
        isScored: true,
        inputKind: item.inputKind || "BOOLEAN",
        updatedAt: now,
      },
    });
  }

  console.dir(
    {
      decision: APPLY ? "READY_TO_APPLY" : "SAFE_PREVIEW",
      frameworkId: FRAMEWORK_ID,
      sectionId: SECTION_ID,
      activeItemsFound: activeItems.length,
      expectedItemsCount: ITEMS_COUNT,
      itemMaxScoreBefore: "1",
      itemMaxScoreAfter: ITEM_MAX_SCORE,
      sectionWeightAfter: 100,
      totalMaxScoreAfter: TOTAL_MAX_SCORE,
      writesCount: writes.length,
      itemSamples: activeItems.slice(0, 5).map((item) => ({
        id: item.id,
        title: item.title,
        currentMaxScore: item.maxScore,
        newMaxScore: ITEM_MAX_SCORE,
      })),
    },
    { depth: 20 }
  );

  if (activeItems.length !== ITEMS_COUNT) {
    console.log(
      `Warning: expected ${ITEMS_COUNT} active items, but found ${activeItems.length}.`
    );
  }

  if (!APPLY) {
    console.log("No writes performed.");
    console.log("Run with --apply to update Firestore.");
    return;
  }

  const batch = db.batch();

  for (const write of writes) {
    batch.update(write.ref, write.data);
  }

  await batch.commit();

  console.dir({
    decision: "APPLIED",
    updatedDocs: writes.length,
    updatedItems: activeItems.length,
    totalMaxScore: TOTAL_MAX_SCORE,
    sectionWeight: 100,
    itemMaxScore: ITEM_MAX_SCORE,
  });
}

main().catch((err) => {
  console.error("Repair failed:", err);
  process.exit(1);
});