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

const FRAMEWORK_FIXES = [
  {
    frameworkId: "kg-vp-supervisory-plan-v1",
    sectionId: "kg-vp-supervisory-plan-v1__main",
    totalMaxScore: 2,
    serviceYearsItemId: "kg-vp-supervisory-plan-v1__service-years",
  },
  {
    frameworkId: "kg-vp-supervisory-visit-v1",
    sectionId: "kg-vp-supervisory-visit-v1__main",
    totalMaxScore: 22,
  },
];

async function main() {
  console.log(APPLY ? "APPLY mode" : "Preview mode - no writes");

  const orgRef = db.collection("orgs").doc(ORG_ID);
  const now = Date.now();

  const writes = [];

  for (const fix of FRAMEWORK_FIXES) {
    writes.push({
      label: `framework:${fix.frameworkId}`,
      ref: orgRef.collection("evaluationFrameworks").doc(fix.frameworkId),
      data: {
        totalMaxScore: fix.totalMaxScore,
        updatedAt: now,
      },
    });

    writes.push({
      label: `section:${fix.sectionId}`,
      ref: orgRef.collection("evaluationRubricSections").doc(fix.sectionId),
      data: {
        maxScore: fix.totalMaxScore,
        weight: 100,
        updatedAt: now,
      },
    });

    if (fix.serviceYearsItemId) {
      writes.push({
        label: `item:${fix.serviceYearsItemId}`,
        ref: orgRef.collection("evaluationRubricItems").doc(fix.serviceYearsItemId),
        data: {
          inputKind: "TEXT",
          responseKind: "TEXT",
          fieldType: "TEXT",
          isScored: false,
          isRequired: false,
          weight: 0,
          maxScore: admin.firestore.FieldValue.delete(),
          updatedAt: now,
        },
      });
    }
  }

  console.dir(
    {
      decision: APPLY ? "READY_TO_APPLY" : "SAFE_PREVIEW",
      writesCount: writes.length,
      writes: writes.map((x) => x.label),
      changes: {
        serviceYears: "TEXT / open field / not scored / no maxScore",
        sectionsWeight: "100 instead of 1",
        supervisoryPlanTotalMaxScore: 2,
        supervisoryVisitTotalMaxScore: 22,
      },
    },
    { depth: 20 }
  );

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
  });
}

main().catch((err) => {
  console.error("Repair failed:", err);
  process.exit(1);
});