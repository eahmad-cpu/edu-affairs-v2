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

const EVALUATOR = {
  uid: "4ElchyeiopfV5OsCLG3a0tBfc9g2",
  personId: "p-a-almansur",
  email: "a-almansur@qz.org.sa",
  displayName: "اسماء محمد المنصور",
  roleKey: "ADMIN_SUPERVISOR",
  roleLabel: "مشرفة إدارية",
};

const SCHOOLS = [
  { schoolId: "mrb-girls", schoolTitle: "منار الريادة بنات" },
  { schoolId: "kg-01", schoolTitle: "روضة واحة الرياحين الأولى" },
  { schoolId: "kg-02", schoolTitle: "روضة واحة الرياحين الثانية" },
  { schoolId: "kg-03", schoolTitle: "روضة واحة الرياحين الثالثة" },
  { schoolId: "kg-04", schoolTitle: "روضة واحة الرياحين الرابعة" },
];

const SCHOOL_IDS = new Set(SCHOOLS.map((school) => school.schoolId));

/**
 * المطلوب:
 * - استبعاد المعلمات
 * - استبعاد المديرات
 * - استبعاد المشرفات
 * - استبعاد مسؤولات الرعاية / الحاضنات فقط
 * - عدم استبعاد الموجهات الطلابيات
 * - عدم استبعاد الوكيلات
 */
const EXCLUDED_TARGET_ROLE_KEYS = new Set([
  // Teachers
  "TEACHER",
  "KG_TEACHER",
  "BOYS_TEACHER",
  "GIRLS_TEACHER",

  // Principals
  "PRINCIPAL",
  "KG_PRINCIPAL",
  "BOYS_PRINCIPAL",
  "GIRLS_PRINCIPAL",

  // Supervisors
  "EDU_SUPERVISOR",
  "KG_EDU_SUPERVISOR",
  "BOYS_EDU_SUPERVISOR",
  "GIRLS_EDU_SUPERVISOR",
  "ADMIN_SUPERVISOR",

  // Care / welfare only
  "NURSERY_CAREGIVER",
  "CARE_SUPERVISOR",
  "STUDENT_CARE",
  "STUDENT_WELFARE",
  "WELFARE_SUPERVISOR",
]);

const EXCLUDED_TEXT_KEYWORDS = [
  "الحاضنة",
  "حاضنة",
  "الرعاية",
  "مسؤولة الرعاية",
  "مسؤولات الرعاية",
  "مشرفة الرعاية",
  "مشرفات الرعاية",
];

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

function normalizeRoleKey(value) {
  return String(value || "").trim().toUpperCase();
}

function getSchoolTitle(schoolId) {
  return SCHOOLS.find((school) => school.schoolId === schoolId)?.schoolTitle || schoolId;
}

function includesExcludedKeyword(...values) {
  const text = values
    .filter(Boolean)
    .map((value) => String(value).trim())
    .join(" ");

  return EXCLUDED_TEXT_KEYWORDS.some((keyword) => text.includes(keyword));
}

/**
 * نريد الفترية فقط:
 * - periodic
 * - three-times
 * - الدورية
 * - الفترية
 * - ثلاث مرات
 *
 * ونستبعد:
 * - weekly
 * - every-two-weeks
 * - الأسبوعية
 * - كل أسبوعين
 */
function isPeriodicEvaluationPlan(...values) {
  const text = values
    .filter(Boolean)
    .map((value) => String(value).trim())
    .join(" ")
    .toLowerCase();

  const isAllowedPeriodic =
    text.includes("periodic") ||
    text.includes("three-times") ||
    text.includes("الدورية") ||
    text.includes("الفترية") ||
    text.includes("ثلاث مرات");

  const isExcludedWeekly =
    text.includes("weekly") ||
    text.includes("every-two-weeks") ||
    text.includes("الأسبوعية") ||
    text.includes("اسبوعية") ||
    text.includes("كل أسبوعين") ||
    text.includes("كل اسبوعين");

  return isAllowedPeriodic && !isExcludedWeekly;
}

function isTargetAllowed(target) {
  if (!target) return false;
  if (!isActive(target)) return false;

  if (!SCHOOL_IDS.has(target.schoolId)) {
    return false;
  }

  if (target.academicYearId && target.academicYearId !== ACADEMIC_YEAR_ID) {
    return false;
  }

  if (target.termId && target.termId !== TERM_ID) {
    return false;
  }

  if (target.targetPersonId === EVALUATOR.personId) {
    return false;
  }

  const roleKey = normalizeRoleKey(target.targetRoleKey);

  if (EXCLUDED_TARGET_ROLE_KEYS.has(roleKey)) {
    return false;
  }

  if (
    includesExcludedKeyword(
      target.targetRoleKey,
      target.targetRoleLabel,
      target.targetDisplayName,
      target.targetName,
      target.targetEmail,
      target.planTitle,
      target.frameworkTitle
    )
  ) {
    return false;
  }

  if (
    !isPeriodicEvaluationPlan(
      target.planId,
      target.planTitle,
      target.frameworkId,
      target.frameworkTitle
    )
  ) {
    return false;
  }

  return true;
}

function getPlanCycleCount(plan) {
  if (
    !isPeriodicEvaluationPlan(
      plan.id,
      plan.title,
      plan.shortTitle,
      plan.frequency,
      plan.frequencyLabel,
      plan.planSlug
    )
  ) {
    return 0;
  }

  // التقييمات الفترية فقط = 3 مرات
  return 3;
}

function getCycleTitle(plan, cycleNumber) {
  const text = [plan.id, plan.title, plan.shortTitle]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("three-times") || text.includes("ثلاث مرات")) {
    return `المرة ${cycleNumber}`;
  }

  if (
    text.includes("periodic") ||
    text.includes("الدورية") ||
    text.includes("الفترية")
  ) {
    return `الفترة ${cycleNumber}`;
  }

  return `الدورة ${cycleNumber}`;
}

function cycleIdFor(planId, cycleNumber) {
  return `${planId}-cycle-${String(cycleNumber).padStart(2, "0")}`;
}

function evaluatorAssignmentId(cycleId, targetPersonId, evaluatorPersonId) {
  return `admin-supervisor__${cycleId}__${targetPersonId}__${evaluatorPersonId}`;
}

async function getPlansMap(orgRef) {
  const snap = await orgRef.collection("evaluationPlans").get();

  const map = new Map();

  for (const doc of snap.docs) {
    map.set(doc.id, {
      id: doc.id,
      ...doc.data(),
    });
  }

  return map;
}

async function getExistingCyclesByPlan(orgRef) {
  const snap = await orgRef.collection("evaluationCycles").get();

  const map = new Map();

  for (const doc of snap.docs) {
    const row = {
      id: doc.id,
      ref: doc.ref,
      ...doc.data(),
    };

    if (!row.planId) continue;

    if (!map.has(row.planId)) {
      map.set(row.planId, []);
    }

    map.get(row.planId).push(row);
  }

  return map;
}

async function getExistingEvaluatorAssignments(orgRef) {
  const snap = await orgRef.collection("evaluationEvaluatorAssignments").get();

  const ids = new Set();

  for (const doc of snap.docs) {
    ids.add(doc.id);
  }

  return ids;
}

async function getCandidateTargets(orgRef) {
  const snap = await orgRef.collection("evaluationTargetAssignments").get();

  return snap.docs
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
    .filter(isTargetAllowed);
}

function uniqueBy(items, getKey) {
  const map = new Map();

  for (const item of items) {
    const key = getKey(item);

    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  return Array.from(map.values());
}

function sortByArabicName(items) {
  return items.sort((a, b) => {
    const aName = a.targetDisplayName || a.displayName || "";
    const bName = b.targetDisplayName || b.displayName || "";

    return aName.localeCompare(bName, "ar");
  });
}

async function main() {
  console.log(APPLY ? "APPLY mode" : "Preview mode - no writes");

  const orgRef = db.collection("orgs").doc(ORG_ID);
  const now = Date.now();

  const plansMap = await getPlansMap(orgRef);
  const existingCyclesByPlan = await getExistingCyclesByPlan(orgRef);
  const existingEvaluatorAssignmentIds = await getExistingEvaluatorAssignments(orgRef);
  const targets = await getCandidateTargets(orgRef);

  const planIds = Array.from(
    new Set(targets.map((target) => target.planId).filter(Boolean))
  );

  const cycleWrites = [];
  const planWrites = [];
  const evaluatorWrites = [];
  const skipped = [];
  const alreadyExistingEvaluatorAssignments = [];

  const cyclesByPlanAfterRepair = new Map();

  for (const planId of planIds) {
    const plan = plansMap.get(planId);

    if (!plan) {
      skipped.push({
        reason: "PLAN_NOT_FOUND",
        planId,
      });
      continue;
    }

    if (!isActive(plan)) {
      skipped.push({
        reason: "PLAN_NOT_ACTIVE",
        planId,
        planStatus: plan.status,
      });
      continue;
    }

    const requiredCycleCount = getPlanCycleCount(plan);

    if (requiredCycleCount <= 0) {
      skipped.push({
        reason: "PLAN_NOT_PERIODIC",
        planId,
        planTitle: plan.title || "",
      });
      continue;
    }

    const existingCycles = existingCyclesByPlan.get(planId) || [];
    const usableCycles = [];

    for (let cycleNumber = 1; cycleNumber <= requiredCycleCount; cycleNumber++) {
      const generatedCycleId = cycleIdFor(planId, cycleNumber);

      const existing =
        existingCycles.find((cycle) => cycle.id === generatedCycleId) ||
        existingCycles.find(
          (cycle) => Number(cycle.sequence || cycle.cycleNumber || 0) === cycleNumber
        );

      if (existing) {
        usableCycles.push({
          ...existing,
          id: existing.id,
        });

        if (!isActive(existing)) {
          cycleWrites.push({
            label: `reactivate-cycle:${existing.id}`,
            ref: orgRef.collection("evaluationCycles").doc(existing.id),
            data: {
              status: "ACTIVE",
              updatedAt: now,
            },
          });
        }

        continue;
      }

      const cycleTitle = getCycleTitle(plan, cycleNumber);

      const cycle = {
        id: generatedCycleId,
        orgId: ORG_ID,

        schoolId: plan.schoolId,
        schoolTitle: plan.schoolTitle || getSchoolTitle(plan.schoolId),

        academicYearId: plan.academicYearId || ACADEMIC_YEAR_ID,
        termId: plan.termId || TERM_ID,

        planId,
        planTitle: plan.title || "",
        frameworkId: plan.frameworkId || "",

        title: cycleTitle,
        shortTitle: cycleTitle,
        sequence: cycleNumber,
        cycleNumber,

        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      };

      usableCycles.push(cycle);

      cycleWrites.push({
        label: `create-cycle:${generatedCycleId}`,
        ref: orgRef.collection("evaluationCycles").doc(generatedCycleId),
        data: cycle,
      });
    }

    cyclesByPlanAfterRepair.set(planId, usableCycles);

    planWrites.push({
      label: `update-plan:${planId}`,
      ref: orgRef.collection("evaluationPlans").doc(planId),
      data: {
        cycleCount: requiredCycleCount,
        updatedAt: now,
      },
    });
  }

  for (const target of targets) {
    const plan = plansMap.get(target.planId);

    if (!plan || !isActive(plan)) {
      continue;
    }

    const cycles = cyclesByPlanAfterRepair.get(target.planId) || [];

    if (cycles.length === 0) {
      skipped.push({
        reason: "NO_CYCLES_AFTER_REPAIR",
        targetId: target.id,
        targetDisplayName: target.targetDisplayName,
        targetRoleKey: target.targetRoleKey || "",
        targetRoleLabel: target.targetRoleLabel || "",
        planId: target.planId,
        planTitle: plan.title || "",
      });
      continue;
    }

    for (const cycle of cycles) {
      const id = evaluatorAssignmentId(
        cycle.id,
        target.targetPersonId,
        EVALUATOR.personId
      );

      if (existingEvaluatorAssignmentIds.has(id)) {
        alreadyExistingEvaluatorAssignments.push(id);
      }

      evaluatorWrites.push({
        label: `evaluator:${id}`,
        ref: orgRef.collection("evaluationEvaluatorAssignments").doc(id),
        data: {
          id,
          orgId: ORG_ID,

          schoolId: target.schoolId,
          schoolTitle:
            target.schoolTitle ||
            plan.schoolTitle ||
            getSchoolTitle(target.schoolId),

          academicYearId:
            target.academicYearId ||
            plan.academicYearId ||
            ACADEMIC_YEAR_ID,

          termId:
            target.termId ||
            plan.termId ||
            TERM_ID,

          planId: target.planId,
          planTitle: plan.title || target.planTitle || "",
          frameworkId: target.frameworkId || plan.frameworkId || "",

          cycleId: cycle.id,
          cycleTitle: cycle.title || cycle.shortTitle || "",

          targetAssignmentId: target.id,
          targetKind: target.targetKind || plan.targetKind || "STAFF",
          targetPersonId: target.targetPersonId,
          targetEmail: target.targetEmail || "",
          targetDisplayName:
            target.targetDisplayName ||
            target.targetName ||
            target.targetEmail ||
            target.targetPersonId,
          targetRoleKey: target.targetRoleKey || "",
          targetRoleLabel: target.targetRoleLabel || "",

          evaluatorUid: EVALUATOR.uid,
          evaluatorPersonId: EVALUATOR.personId,
          evaluatorEmail: EVALUATOR.email,
          evaluatorDisplayName: EVALUATOR.displayName,
          evaluatorRoleKey: EVALUATOR.roleKey,
          evaluatorRoleLabel: EVALUATOR.roleLabel,

          status: "ACTIVE",
          removedAt: admin.firestore.FieldValue.delete(),

          createdAt: now,
          updatedAt: now,
        },
      });
    }
  }

  const allWrites = [...cycleWrites, ...planWrites, ...evaluatorWrites];

  const groupedTargetsMap = targets.reduce((acc, target) => {
    const schoolId = target.schoolId;

    if (!acc[schoolId]) {
      acc[schoolId] = {
        schoolId,
        schoolTitle: target.schoolTitle || getSchoolTitle(schoolId),
        targetAssignmentDocsCount: 0,
        targetPeople: {},
      };
    }

    acc[schoolId].targetAssignmentDocsCount += 1;

    const personKey = target.targetPersonId;

    if (!acc[schoolId].targetPeople[personKey]) {
      acc[schoolId].targetPeople[personKey] = {
        targetPersonId: target.targetPersonId,
        targetEmail: target.targetEmail || "",
        targetDisplayName: target.targetDisplayName || "",
        targetRoleKey: target.targetRoleKey || "",
        targetRoleLabel: target.targetRoleLabel || "",
        plans: [],
      };
    }

    acc[schoolId].targetPeople[personKey].plans.push(target.planId);

    return acc;
  }, {});

  const groupedTargets = Object.values(groupedTargetsMap).map((school) => ({
    ...school,
    targetPeople: sortByArabicName(Object.values(school.targetPeople)),
  }));

  const uniquePlans = uniqueBy(
    targets.map((target) => {
      const plan = plansMap.get(target.planId);

      return {
        planId: target.planId,
        schoolId: target.schoolId,
        schoolTitle: target.schoolTitle || getSchoolTitle(target.schoolId),
        planTitle: plan?.title || target.planTitle || "",
        cycleCount: plan ? getPlanCycleCount(plan) : 0,
      };
    }),
    (item) => item.planId
  ).sort((a, b) => a.planId.localeCompare(b.planId));

  const roleCounts = targets.reduce((acc, target) => {
    const key = `${target.targetRoleKey || "UNKNOWN"} | ${target.targetRoleLabel || ""}`;

    acc[key] = (acc[key] || 0) + 1;

    return acc;
  }, {});

  console.dir(
    {
      decision: APPLY ? "READY_TO_APPLY" : "SAFE_PREVIEW",

      evaluator: EVALUATOR,
      schools: SCHOOLS,

      filters: {
        includedPlans: "periodic / three-times only",
        excludedPlans: "weekly / every-two-weeks",
        excludedPeople:
          "teachers, principals, supervisors, nursery caregivers, student care/welfare",
        includedPeople:
          "vice principals, admin assistants, media specialists, activity coordinators, school monitors, student counselors",
      },

      candidateTargetsCount: targets.length,
      uniquePlansCount: uniquePlans.length,

      cyclesToCreateOrReactivate: cycleWrites.length,
      plansToUpdate: planWrites.length,
      evaluatorAssignmentsToWrite: evaluatorWrites.length,
      alreadyExistingEvaluatorAssignments:
        alreadyExistingEvaluatorAssignments.length,

      totalWrites: allWrites.length,
      skippedCount: skipped.length,

      roleCounts,
      uniquePlans,
      groupedTargets,
      skipped,
    },
    { depth: 40 }
  );

  if (!APPLY) {
    console.log("No writes performed.");
    console.log("Review groupedTargets and uniquePlans carefully.");
    console.log("Run with --apply to write cycles and evaluator assignments.");
    return;
  }

  let committed = 0;

  for (let i = 0; i < allWrites.length; i += 450) {
    const batch = db.batch();
    const chunk = allWrites.slice(i, i + 450);

    for (const write of chunk) {
      batch.set(write.ref, write.data, { merge: true });
    }

    await batch.commit();

    committed += chunk.length;
  }

  console.dir({
    decision: "APPLIED",
    committedWrites: committed,
    cyclesCreatedOrReactivated: cycleWrites.length,
    plansUpdated: planWrites.length,
    evaluatorAssignmentsWritten: evaluatorWrites.length,
    alreadyExistingEvaluatorAssignments:
      alreadyExistingEvaluatorAssignments.length,
  });
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});