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
const ACADEMIC_YEAR_ID = "ay-1448";
const TERM_ID = "term-1";

const EVALUATOR_PERSON_ID = "p-a-almansur";

const SCHOOL_IDS = new Set([
  "mrb-girls",
  "kg-01",
  "kg-02",
  "kg-03",
  "kg-04",
]);

function isActive(row) {
  const status = String(row.status || "").toUpperCase();

  if (["REMOVED", "INACTIVE", "ENDED", "ARCHIVED", "DELETED"].includes(status)) {
    return false;
  }

  if (row.isActive === false || row.active === false) {
    return false;
  }

  return (
    row.status === "ACTIVE" ||
    row.isActive === true ||
    row.active === true ||
    !row.status
  );
}

function roleWithLam(roleLabel) {
  const label = String(roleLabel || "").trim();

  if (!label) {
    return "للموظفة";
  }

  if (label.startsWith("ال")) {
    return `لل${label.slice(2)}`;
  }

  return `ل${label}`;
}

function getFrequencyLabel(row) {
  const oldTitle = String(row.planTitle || row.title || "").trim();

  const parts = oldTitle
    .split(" - ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return parts[1];
  }

  const text = [
    row.planId,
    row.planTitle,
    row.frameworkId,
    row.cycleTitle,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("three-times") || text.includes("ثلاث مرات")) {
    return "المتابعة ثلاث مرات";
  }

  if (text.includes("periodic") || text.includes("الدورية")) {
    return "المتابعة الدورية";
  }

  if (text.includes("الفترية")) {
    return "المتابعة الفترية";
  }

  return "المتابعة الفترية";
}

function getSchoolTitle(row) {
  return String(row.schoolTitle || row.schoolId || "").trim();
}

function buildNewPlanTitle(row) {
  const targetRoleLabel = row.targetRoleLabel || "";
  const frequencyLabel = getFrequencyLabel(row);
  const schoolTitle = getSchoolTitle(row);

  return [
    `تقييم المشرفة الإدارية ${roleWithLam(targetRoleLabel)}`,
    frequencyLabel,
    schoolTitle,
    "الفصل الأول",
  ]
    .filter(Boolean)
    .join(" - ");
}

async function main() {
  console.log(APPLY ? "APPLY mode" : "Preview mode - no writes");

  const orgRef = db.collection("orgs").doc(ORG_ID);
  const now = Date.now();

  const snap = await orgRef.collection("evaluationEvaluatorAssignments").get();

  const assignments = snap.docs
    .map((doc) => ({
      docId: doc.id,
      ref: doc.ref,
      ...doc.data(),
    }))
    .filter((row) => row.evaluatorPersonId === EVALUATOR_PERSON_ID)
    .filter((row) => SCHOOL_IDS.has(row.schoolId))
    .filter((row) => {
      return !row.academicYearId || row.academicYearId === ACADEMIC_YEAR_ID;
    })
    .filter((row) => {
      return !row.termId || row.termId === TERM_ID;
    })
    .filter(isActive);

  const writes = [];
  const samples = [];

  for (const row of assignments) {
    const newPlanTitle = buildNewPlanTitle(row);

    writes.push({
      ref: row.ref,
      id: row.docId,
      data: {
        planTitle: newPlanTitle,
        displayTitle: newPlanTitle,
        evaluatorDisplayTitle: newPlanTitle,
        title: newPlanTitle,
        updatedAt: now,
      },
    });

    if (samples.length < 20) {
      samples.push({
        id: row.docId,
        targetDisplayName: row.targetDisplayName || "",
        targetRoleLabel: row.targetRoleLabel || "",
        oldPlanTitle: row.planTitle || "",
        newPlanTitle,
      });
    }
  }

  const roleCounts = assignments.reduce((acc, row) => {
    const key = `${row.targetRoleKey || "UNKNOWN"} | ${row.targetRoleLabel || ""}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  console.dir(
    {
      decision: APPLY ? "READY_TO_APPLY" : "SAFE_PREVIEW",
      evaluatorPersonId: EVALUATOR_PERSON_ID,
      assignmentsFound: assignments.length,
      writesCount: writes.length,
      roleCounts,
      samples,
      note:
        "This script updates only Asmaa's evaluationEvaluatorAssignments titles. It does not change global evaluationPlans.",
    },
    { depth: 30 }
  );

  if (!APPLY) {
    console.log("No writes performed.");
    console.log("Run with --apply to update titles.");
    return;
  }

  let committed = 0;

  for (let i = 0; i < writes.length; i += 450) {
    const batch = db.batch();
    const chunk = writes.slice(i, i + 450);

    for (const write of chunk) {
      batch.set(write.ref, write.data, { merge: true });
    }

    await batch.commit();
    committed += chunk.length;
  }

  console.dir({
    decision: "APPLIED",
    updatedAssignments: committed,
  });
}

main().catch((err) => {
  console.error("Repair failed:", err);
  process.exit(1);
});