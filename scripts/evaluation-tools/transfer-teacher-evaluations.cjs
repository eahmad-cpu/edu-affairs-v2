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

const DEFAULT_ORG_ID = "takween";
const DEFAULT_ACADEMIC_YEAR_ID = "ay-1448";
const DEFAULT_TERM_ID = "term-1";

function getArg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);

  if (index === -1) return fallback;

  return process.argv[index + 1] || fallback;
}

const ORG_ID = getArg("org", DEFAULT_ORG_ID);
const ACADEMIC_YEAR_ID = getArg("year", DEFAULT_ACADEMIC_YEAR_ID);
const TERM_ID = getArg("term", DEFAULT_TERM_ID);

const EMAIL = getArg("email").trim().toLowerCase();
const FROM_SCHOOL_ID = getArg("from").trim();
const TO_SCHOOL_ID = getArg("to").trim();

const TRANSFER_REASON = getArg("reason", "TRANSFERRED_TO_SCHOOL");

function requireArgs() {
  const missing = [];

  if (!EMAIL) missing.push("--email");
  if (!FROM_SCHOOL_ID) missing.push("--from");
  if (!TO_SCHOOL_ID) missing.push("--to");

  if (missing.length > 0) {
    console.error("Missing required args:", missing.join(", "));
    console.error("");
    console.error("Example:");
    console.error(
      'node .\\scripts\\evaluation-tools\\transfer-teacher-evaluations.cjs --email "teacher@qz.org.sa" --from "kg-02" --to "kg-01"',
    );
    process.exit(1);
  }

  if (FROM_SCHOOL_ID === TO_SCHOOL_ID) {
    console.error("--from and --to cannot be the same school.");
    process.exit(1);
  }
}

function asString(value, fallback = "") {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function asNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeRoleKey(value) {
  return String(value || "").trim().toUpperCase();
}

function isActive(row) {
  const status = normalizeRoleKey(row?.status);

  if (
    ["REMOVED", "INACTIVE", "ENDED", "ARCHIVED", "DELETED", "CANCELLED"].includes(
      status,
    )
  ) {
    return false;
  }

  if (row?.isActive === false || row?.active === false) {
    return false;
  }

  return (
    row?.status === "ACTIVE" ||
    row?.isActive === true ||
    row?.active === true ||
    !row?.status
  );
}




function isUsableCycle(row) {
  const status = normalizeRoleKey(row?.status);

  if (["OPEN", "ACTIVE"].includes(status)) {
    return true;
  }

  if (!row?.status) {
    return true;
  }

  return false;
}







function isTeacherTarget(row) {
  const targetKind = normalizeRoleKey(row.targetKind);
  const roleKey = normalizeRoleKey(row.targetRoleKey);
  const roleLabel = asString(row.targetRoleLabel);
  const planTitle = asString(row.planTitle);
  const frameworkTitle = asString(row.frameworkTitle);

  const text = [targetKind, roleKey, roleLabel, planTitle, frameworkTitle]
    .filter(Boolean)
    .join(" ");

  return (
    targetKind === "TEACHER" ||
    roleKey.includes("TEACHER") ||
    text.includes("معلم") ||
    text.includes("معلمة")
  );
}

function cleanForCopy(row) {
  const cleaned = { ...row };

  delete cleaned.id;
  delete cleaned.ref;
  delete cleaned.docId;

  delete cleaned.targetPersonId;
  delete cleaned.targetEmail;
  delete cleaned.targetDisplayName;
  delete cleaned.targetName;
  delete cleaned.teacherEmail;
  delete cleaned.teacherName;
  delete cleaned.teacherDisplayName;

  delete cleaned.removedAt;
  delete cleaned.removedBy;
  delete cleaned.removedReason;
  delete cleaned.transferredAt;
  delete cleaned.transferredFromSchoolId;
  delete cleaned.transferredToSchoolId;
  delete cleaned.transferTool;

  return cleaned;
}

function mapIdFromOldSchoolToNewSchool(value) {
  const text = asString(value);

  if (!text.startsWith(`${FROM_SCHOOL_ID}-`)) {
    return null;
  }

  return `${TO_SCHOOL_ID}${text.slice(FROM_SCHOOL_ID.length)}`;
}

function mapPlanIdToTargetSchool(oldPlanId) {
  return mapIdFromOldSchoolToNewSchool(oldPlanId);
}

function mapCycleIdToTargetSchool(oldCycleId, oldPlanId, newPlanId) {
  const cycleId = asString(oldCycleId);

  if (cycleId.startsWith(oldPlanId)) {
    return `${newPlanId}${cycleId.slice(oldPlanId.length)}`;
  }

  return mapIdFromOldSchoolToNewSchool(cycleId);
}

function targetAssignmentId(planId, targetPersonId) {
  return `${planId}-target-${targetPersonId}`;
}

function fallbackEvaluatorAssignmentId(params) {
  return `${params.planId}-${params.cycleId}-${params.targetPersonId}-${params.evaluatorPersonId}`;
}

function buildEvaluatorAssignmentIdFromPattern(
  pattern,
  targetPersonId,
  planId,
  cycleId,
  evaluatorPersonId,
) {
  const patternId = asString(pattern.id);
  const patternTargetPersonId = asString(pattern.targetPersonId);
  const patternCycleId = asString(pattern.cycleId);
  const patternPlanId = asString(pattern.planId);

  if (
    patternId &&
    patternTargetPersonId &&
    patternId.includes(patternTargetPersonId)
  ) {
    let nextId = patternId.split(patternTargetPersonId).join(targetPersonId);

    if (patternCycleId && nextId.includes(patternCycleId)) {
      nextId = nextId.split(patternCycleId).join(cycleId);
    }

    if (patternPlanId && nextId.includes(patternPlanId)) {
      nextId = nextId.split(patternPlanId).join(planId);
    }

    return nextId;
  }

  return fallbackEvaluatorAssignmentId({
    planId,
    cycleId,
    targetPersonId,
    evaluatorPersonId,
  });
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

function sortByCycle(items) {
  return [...items].sort((a, b) => {
    const aOrder = asNumber(a.sequence, asNumber(a.cycleNumber, 9999));
    const bOrder = asNumber(b.sequence, asNumber(b.cycleNumber, 9999));

    if (aOrder !== bOrder) return aOrder - bOrder;

    return asString(a.id).localeCompare(asString(b.id));
  });
}

async function getCollectionRows(orgRef, collectionName) {
  const snap = await orgRef.collection(collectionName).get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    ref: doc.ref,
    ...doc.data(),
  }));
}

async function getUserByEmail(email) {
  const normalized = normalizeEmail(email);

  const usersSnap = await db
    .collection("users")
    .where("email", "==", normalized)
    .limit(5)
    .get();

  if (!usersSnap.empty) {
    const doc = usersSnap.docs[0];
    const row = doc.data();

    return {
      uid: row.uid || doc.id,
      personId: asString(row.personId, doc.id),
      email: normalizeEmail(row.email),
      displayName:
        asString(row.displayName) ||
        asString(row.fullName) ||
        asString(row.name) ||
        normalizeEmail(row.email) ||
        doc.id,
      roleKey: asString(row.roleKey),
      source: "users",
    };
  }

  const orgRef = db.collection("orgs").doc(ORG_ID);
  const peopleSnap = await orgRef
    .collection("people")
    .where("email", "==", normalized)
    .limit(5)
    .get();

  if (!peopleSnap.empty) {
    const doc = peopleSnap.docs[0];
    const row = doc.data();

    return {
      uid: "",
      personId: asString(row.personId, doc.id),
      email: normalizeEmail(row.email),
      displayName:
        asString(row.displayName) ||
        asString(row.fullName) ||
        asString(row.name) ||
        normalizeEmail(row.email) ||
        doc.id,
      roleKey: asString(row.roleKey),
      source: "orgs/people",
    };
  }

  return null;
}

async function getSchoolTitle(orgRef, schoolId) {
  const snap = await orgRef.collection("schools").doc(schoolId).get();

  if (!snap.exists) {
    return schoolId;
  }

  const row = snap.data();

  return (
    asString(row.title) ||
    asString(row.name) ||
    asString(row.displayName) ||
    schoolId
  );
}

function countSubmissions(submissions) {
  return submissions.reduce(
    (acc, row) => {
      const status = normalizeRoleKey(row.status) || "UNKNOWN";

      acc.total += 1;
      acc.byStatus[status] = (acc.byStatus[status] || 0) + 1;

      return acc;
    },
    {
      total: 0,
      byStatus: {},
    },
  );
}

function buildTargetWrite(params) {
  const { oldTarget, newPlan, newTargetId, teacher, toSchoolTitle, now } =
    params;

  const base = cleanForCopy(oldTarget);

  return {
    id: newTargetId,
    orgId: ORG_ID,

    ...base,

    schoolId: TO_SCHOOL_ID,
    schoolTitle: toSchoolTitle,

    academicYearId: ACADEMIC_YEAR_ID,
    termId: TERM_ID,

    planId: newPlan.id,
    planTitle: asString(newPlan.title, asString(oldTarget.planTitle)),
    frameworkId: asString(newPlan.frameworkId, asString(oldTarget.frameworkId)),

    targetKind: "TEACHER",
    targetPersonId: teacher.personId,
    targetEmail: teacher.email,
    targetDisplayName: teacher.displayName,
    targetRoleKey: asString(
      oldTarget.targetRoleKey,
      teacher.roleKey || "TEACHER",
    ),
    targetRoleLabel: asString(oldTarget.targetRoleLabel, "معلم/معلمة"),

    status: "ACTIVE",

    transferredAt: now,
    transferredFromSchoolId: FROM_SCHOOL_ID,
    transferredToSchoolId: TO_SCHOOL_ID,
    transferTool: "transfer-teacher-evaluations.cjs",

    removedAt: admin.firestore.FieldValue.delete(),
    removedReason: admin.firestore.FieldValue.delete(),

    createdAt: now,
    updatedAt: now,
  };
}

function buildCycleWriteFromOld(params) {
  const { oldCycle, newCycleId, newPlan, toSchoolTitle, now } = params;

  const base = { ...oldCycle };

  delete base.id;
  delete base.ref;
  delete base.docId;

  delete base.removedAt;
  delete base.removedReason;

  return {
    id: newCycleId,
    orgId: ORG_ID,

    ...base,

    schoolId: TO_SCHOOL_ID,
    schoolTitle: toSchoolTitle,

    academicYearId: ACADEMIC_YEAR_ID,
    termId: TERM_ID,

    planId: newPlan.id,
    planTitle: asString(newPlan.title, asString(oldCycle.planTitle)),
    frameworkId: asString(newPlan.frameworkId, asString(oldCycle.frameworkId)),

    status: asString(oldCycle.status, "OPEN"),

    transferredTemplateFromCycleId: oldCycle.id,
    transferredTemplateFromSchoolId: FROM_SCHOOL_ID,
    transferTool: "transfer-teacher-evaluations.cjs",

    createdAt: now,
    updatedAt: now,
  };
}

function buildEvaluatorWrite(params) {
  const {
    pattern,
    evaluator,
    newEvaluatorId,
    newTargetId,
    newPlan,
    cycle,
    teacher,
    toSchoolTitle,
    now,
  } = params;

  const base = cleanForCopy(pattern);

  delete base.evaluatorPersonId;
  delete base.evaluatorEmail;
  delete base.evaluatorDisplayName;
  delete base.evaluatorName;
  delete base.evaluatorUid;

  return {
    id: newEvaluatorId,
    orgId: ORG_ID,

    ...base,

    schoolId: TO_SCHOOL_ID,
    schoolTitle: toSchoolTitle,

    academicYearId: ACADEMIC_YEAR_ID,
    termId: TERM_ID,

    planId: newPlan.id,
    planTitle: asString(newPlan.title, asString(pattern.planTitle)),
    frameworkId: asString(newPlan.frameworkId, asString(pattern.frameworkId)),

    cycleId: cycle.id,
    cycleTitle: asString(cycle.title, asString(cycle.shortTitle)),

    targetAssignmentId: newTargetId,
    targetKind: "TEACHER",
    targetPersonId: teacher.personId,
    targetEmail: teacher.email,
    targetDisplayName: teacher.displayName,
    targetRoleKey: asString(pattern.targetRoleKey, teacher.roleKey || "TEACHER"),
    targetRoleLabel: asString(pattern.targetRoleLabel, "معلم/معلمة"),

    evaluatorUid: asString(evaluator.evaluatorUid, asString(evaluator.uid)),
    evaluatorPersonId: asString(evaluator.evaluatorPersonId),
    evaluatorEmail: asString(evaluator.evaluatorEmail),
    evaluatorDisplayName: asString(evaluator.evaluatorDisplayName),
    evaluatorRoleKey: asString(evaluator.evaluatorRoleKey),
    evaluatorRoleLabel: asString(evaluator.evaluatorRoleLabel),

    status: "ACTIVE",

    transferredAt: now,
    transferredFromSchoolId: FROM_SCHOOL_ID,
    transferredToSchoolId: TO_SCHOOL_ID,
    transferTool: "transfer-teacher-evaluations.cjs",

    removedAt: admin.firestore.FieldValue.delete(),
    removedReason: admin.firestore.FieldValue.delete(),

    createdAt: now,
    updatedAt: now,
  };
}

function findTargetSchoolEvaluatorForRole(params) {
  const {
    evaluatorAssignments,
    roleKey,
    oldEvaluatorPersonId,
    newPlanId,
    oldEvaluatorRoleLabel,
  } = params;

  const candidates = evaluatorAssignments
    .filter((row) => row.schoolId === TO_SCHOOL_ID)
    .filter(isActive)
    .filter((row) => normalizeRoleKey(row.evaluatorRoleKey) === roleKey)
    .filter((row) => asString(row.evaluatorPersonId))
    .map((row) => ({
      evaluatorUid: asString(row.evaluatorUid, asString(row.uid)),
      evaluatorPersonId: asString(row.evaluatorPersonId),
      evaluatorEmail: asString(row.evaluatorEmail),
      evaluatorDisplayName: asString(row.evaluatorDisplayName),
      evaluatorRoleKey: asString(row.evaluatorRoleKey),
      evaluatorRoleLabel: asString(
        row.evaluatorRoleLabel,
        oldEvaluatorRoleLabel,
      ),
      sourceAssignmentId: row.id,
      sourcePlanId: row.planId,
      sourceCycleId: row.cycleId,
      score:
        (row.planId === newPlanId ? 100 : 0) +
        (row.targetKind === "TEACHER" ? 25 : 0) +
        (asString(row.evaluatorPersonId) === oldEvaluatorPersonId ? 50 : 0),
    }));

  const unique = uniqueBy(
    candidates,
    (row) => `${row.evaluatorPersonId}__${row.evaluatorRoleKey}`,
  ).sort((a, b) => b.score - a.score);

  const exactSamePerson = unique.find(
    (row) => row.evaluatorPersonId === oldEvaluatorPersonId,
  );

  if (exactSamePerson) {
    return {
      status: "FOUND",
      evaluator: exactSamePerson,
      candidates: unique,
    };
  }

  if (unique.length === 1) {
    return {
      status: "FOUND",
      evaluator: unique[0],
      candidates: unique,
    };
  }

  if (unique.length > 1) {
    return {
      status: "MULTIPLE",
      evaluator: null,
      candidates: unique,
    };
  }

  return {
    status: "NONE",
    evaluator: null,
    candidates: [],
  };
}

async function commitInChunks(writes, chunkSize = 450) {
  let committed = 0;

  for (let i = 0; i < writes.length; i += chunkSize) {
    const batch = db.batch();
    const chunk = writes.slice(i, i + chunkSize);

    for (const write of chunk) {
      batch.set(write.ref, write.data, { merge: true });
    }

    await batch.commit();
    committed += chunk.length;
  }

  return committed;
}

async function main() {
  requireArgs();

  console.log(APPLY ? "APPLY mode" : "Preview mode - no writes");

  const orgRef = db.collection("orgs").doc(ORG_ID);
  const now = Date.now();

  const teacher = await getUserByEmail(EMAIL);

  if (!teacher) {
    console.error(`Could not find user/person by email: ${EMAIL}`);
    process.exit(1);
  }

  const [fromSchoolTitle, toSchoolTitle] = await Promise.all([
    getSchoolTitle(orgRef, FROM_SCHOOL_ID),
    getSchoolTitle(orgRef, TO_SCHOOL_ID),
  ]);

  const [plans, cycles, targetAssignments, evaluatorAssignments, submissions] =
    await Promise.all([
      getCollectionRows(orgRef, "evaluationPlans"),
      getCollectionRows(orgRef, "evaluationCycles"),
      getCollectionRows(orgRef, "evaluationTargetAssignments"),
      getCollectionRows(orgRef, "evaluationEvaluatorAssignments"),
      getCollectionRows(orgRef, "evaluationSubmissions"),
    ]);

  const plansById = new Map(plans.map((plan) => [plan.id, plan]));
  const cyclesById = new Map(cycles.map((cycle) => [cycle.id, cycle]));

  const oldActiveTargets = targetAssignments
    .filter((row) => row.schoolId === FROM_SCHOOL_ID)
    .filter((row) => row.targetPersonId === teacher.personId)
    .filter((row) => {
      return !row.academicYearId || row.academicYearId === ACADEMIC_YEAR_ID;
    })
    .filter((row) => {
      return !row.termId || row.termId === TERM_ID;
    })
    .filter(isActive)
    .filter(isTeacherTarget);

  const oldActiveEvaluators = evaluatorAssignments
    .filter((row) => row.schoolId === FROM_SCHOOL_ID)
    .filter((row) => row.targetPersonId === teacher.personId)
    .filter((row) => {
      return !row.academicYearId || row.academicYearId === ACADEMIC_YEAR_ID;
    })
    .filter((row) => {
      return !row.termId || row.termId === TERM_ID;
    })
    .filter(isActive);

  const oldSubmissions = submissions
    .filter((row) => row.schoolId === FROM_SCHOOL_ID)
    .filter((row) => row.targetPersonId === teacher.personId)
    .filter((row) => {
      return !row.academicYearId || row.academicYearId === ACADEMIC_YEAR_ID;
    })
    .filter((row) => {
      return !row.termId || row.termId === TERM_ID;
    });

  const newExistingTargetsForTeacher = targetAssignments
    .filter((row) => row.schoolId === TO_SCHOOL_ID)
    .filter((row) => row.targetPersonId === teacher.personId)
    .filter((row) => {
      return !row.academicYearId || row.academicYearId === ACADEMIC_YEAR_ID;
    })
    .filter((row) => {
      return !row.termId || row.termId === TERM_ID;
    })
    .filter(isActive);

  const conflicts = [];
  const warnings = [];

  if (oldActiveTargets.length === 0) {
    conflicts.push({
      reason: "NO_ACTIVE_TEACHER_TARGET_ASSIGNMENTS_IN_FROM_SCHOOL",
      email: teacher.email,
      personId: teacher.personId,
      fromSchoolId: FROM_SCHOOL_ID,
    });
  }

  if (oldActiveEvaluators.length === 0) {
    warnings.push({
      reason: "NO_ACTIVE_EVALUATOR_ASSIGNMENTS_IN_FROM_SCHOOL",
      note: "The script can create targets only if patterns exist in the target school.",
    });
  }

  if (newExistingTargetsForTeacher.length > 0) {
    warnings.push({
      reason: "TEACHER_ALREADY_HAS_ACTIVE_TARGET_ASSIGNMENTS_IN_TO_SCHOOL",
      count: newExistingTargetsForTeacher.length,
      note: "The script is idempotent and will merge matching new docs, but review this before applying.",
      sample: newExistingTargetsForTeacher.slice(0, 10).map((row) => ({
        id: row.id,
        planId: row.planId,
        targetDisplayName: row.targetDisplayName,
      })),
    });
  }

  const mappedPlans = [];

  for (const oldTarget of oldActiveTargets) {
    const oldPlanId = asString(oldTarget.planId);
    const newPlanId = mapPlanIdToTargetSchool(oldPlanId);

    if (!newPlanId) {
      conflicts.push({
        reason: "OLD_PLAN_ID_DOES_NOT_START_WITH_FROM_SCHOOL_ID",
        oldPlanId,
        fromSchoolId: FROM_SCHOOL_ID,
      });
      continue;
    }

    const oldPlan = plansById.get(oldPlanId) || null;
    const newPlan = plansById.get(newPlanId) || null;

    if (!oldPlan) {
      warnings.push({
        reason: "OLD_PLAN_NOT_FOUND_BUT_TARGET_EXISTS",
        oldPlanId,
      });
    }

    if (!newPlan) {
      conflicts.push({
        reason: "MATCHING_NEW_PLAN_NOT_FOUND",
        oldPlanId,
        expectedNewPlanId: newPlanId,
      });
      continue;
    }

    if (!isActive(newPlan)) {
      conflicts.push({
        reason: "MATCHING_NEW_PLAN_NOT_ACTIVE",
        oldPlanId,
        newPlanId,
        newPlanStatus: newPlan.status,
      });
      continue;
    }

    mappedPlans.push({
      oldTarget,
      oldPlanId,
      newPlanId,
      oldPlan,
      newPlan,
    });
  }

  const transferPlanRows = [];
  const newTargetWrites = [];
  const newEvaluatorWrites = [];
  const newCycleWrites = [];
  const planUpdateWrites = [];
  const removeOldTargetWrites = [];
  const removeOldEvaluatorWrites = [];

  for (const item of mappedPlans) {
    let newPlanCycles = sortByCycle(
      cycles
        .filter((cycle) => cycle.planId === item.newPlanId)
        .filter((cycle) => {
          return !cycle.academicYearId || cycle.academicYearId === ACADEMIC_YEAR_ID;
        })
        .filter((cycle) => {
          return !cycle.termId || cycle.termId === TERM_ID;
        })
        .filter(isUsableCycle)
    );

    const oldPlanCycles = sortByCycle(
      cycles
        .filter((cycle) => cycle.planId === item.oldPlanId)
        .filter((cycle) => {
          return !cycle.academicYearId || cycle.academicYearId === ACADEMIC_YEAR_ID;
        })
        .filter((cycle) => {
          return !cycle.termId || cycle.termId === TERM_ID;
        })
        .filter(isUsableCycle)
    );

    const createdCyclesFromOld = [];

    if (newPlanCycles.length === 0) {
      if (oldPlanCycles.length === 0) {
        conflicts.push({
          reason: "NO_ACTIVE_CYCLES_IN_OLD_OR_NEW_PLAN",
          oldPlanId: item.oldPlanId,
          newPlanId: item.newPlanId,
        });
        continue;
      }

      for (const oldCycle of oldPlanCycles) {
        const newCycleId = mapCycleIdToTargetSchool(
          oldCycle.id,
          item.oldPlanId,
          item.newPlanId,
        );

        if (!newCycleId) {
          conflicts.push({
            reason: "CANNOT_MAP_OLD_CYCLE_ID_TO_NEW_SCHOOL",
            oldPlanId: item.oldPlanId,
            newPlanId: item.newPlanId,
            oldCycleId: oldCycle.id,
          });
          continue;
        }

        const existingNewCycle = cyclesById.get(newCycleId);
        const cycleData = existingNewCycle
          ? {
              ...existingNewCycle,
              id: existingNewCycle.id,
            }
          : buildCycleWriteFromOld({
              oldCycle,
              newCycleId,
              newPlan: item.newPlan,
              toSchoolTitle,
              now,
            });

        const finalCycle = {
          ...cycleData,
          id: newCycleId,
          sourceOldCycleId: oldCycle.id,
          source: existingNewCycle ? "EXISTING_INACTIVE_OR_UNFILTERED" : "CREATED_FROM_OLD",
        };

        createdCyclesFromOld.push(finalCycle);

        newCycleWrites.push({
          type: "set",
          ref: orgRef.collection("evaluationCycles").doc(newCycleId),
          label: `${existingNewCycle ? "reactivate" : "create"}-cycle:${newCycleId}`,
          data: {
            ...(existingNewCycle
              ? {
                  status: "OPEN",
                  schoolId: TO_SCHOOL_ID,
                  schoolTitle: toSchoolTitle,
                  academicYearId: ACADEMIC_YEAR_ID,
                  termId: TERM_ID,
                  planId: item.newPlanId,
                  planTitle: asString(item.newPlan.title),
                  frameworkId: asString(item.newPlan.frameworkId),
                  updatedAt: now,
                }
              : cycleData),
          },
        });
      }

      newPlanCycles = sortByCycle(createdCyclesFromOld);

      planUpdateWrites.push({
        type: "set",
        ref: orgRef.collection("evaluationPlans").doc(item.newPlanId),
        label: `update-plan-cycle-count:${item.newPlanId}`,
        data: {
          cycleCount: newPlanCycles.length,
          updatedAt: now,
        },
      });

      warnings.push({
        reason: "NEW_PLAN_CYCLES_WILL_BE_CREATED_FROM_OLD_PLAN",
        oldPlanId: item.oldPlanId,
        newPlanId: item.newPlanId,
        cyclesToCreateOrReactivate: newPlanCycles.length,
      });
    }

    if (newPlanCycles.length === 0) {
      conflicts.push({
        reason: "NO_ACTIVE_CYCLES_FOR_NEW_PLAN_AFTER_REPAIR",
        oldPlanId: item.oldPlanId,
        newPlanId: item.newPlanId,
      });
      continue;
    }

    const newTargetId = targetAssignmentId(item.newPlanId, teacher.personId);
    const newTargetRef = orgRef
      .collection("evaluationTargetAssignments")
      .doc(newTargetId);

    newTargetWrites.push({
      type: "set",
      ref: newTargetRef,
      label: `create-or-update-target:${newTargetId}`,
      data: buildTargetWrite({
        oldTarget: item.oldTarget,
        newPlan: item.newPlan,
        newTargetId,
        teacher,
        toSchoolTitle,
        now,
      }),
    });

    const cyclePatternSummary = [];

    for (const cycle of newPlanCycles) {
      let uniquePatterns = uniqueBy(
        evaluatorAssignments
          .filter((row) => row.schoolId === TO_SCHOOL_ID)
          .filter((row) => row.planId === item.newPlanId)
          .filter((row) => row.cycleId === cycle.id)
          .filter((row) => row.targetPersonId !== teacher.personId)
          .filter(isActive),
        (row) => {
          return [
            asString(row.evaluatorPersonId),
            asString(row.evaluatorRoleKey),
            asString(row.evaluatorEmail),
          ].join("__");
        },
      );

      let patternSource = "TARGET_SCHOOL_SAME_PLAN_SAME_CYCLE";

      if (uniquePatterns.length === 0) {
        const sourceOldCycleId = asString(cycle.sourceOldCycleId);
        const oldCycleIdForThisNewCycle =
          sourceOldCycleId ||
          oldPlanCycles.find((oldCycle) => {
            const mapped = mapCycleIdToTargetSchool(
              oldCycle.id,
              item.oldPlanId,
              item.newPlanId,
            );

            return mapped === cycle.id;
          })?.id ||
          "";

        const oldPatternsForSameCycle = uniqueBy(
          oldActiveEvaluators
            .filter((row) => row.planId === item.oldPlanId)
            .filter((row) => row.cycleId === oldCycleIdForThisNewCycle)
            .filter(isActive),
          (row) => {
            return [
              asString(row.evaluatorPersonId),
              asString(row.evaluatorRoleKey),
              asString(row.evaluatorEmail),
            ].join("__");
          },
        );

        const resolvedPatterns = [];

        for (const oldPattern of oldPatternsForSameCycle) {
          const roleKey = normalizeRoleKey(oldPattern.evaluatorRoleKey);

          if (!roleKey) {
            conflicts.push({
              reason: "OLD_PATTERN_WITHOUT_EVALUATOR_ROLE_KEY",
              oldPlanId: item.oldPlanId,
              oldCycleId: oldCycleIdForThisNewCycle,
              oldPatternId: oldPattern.id,
            });
            continue;
          }

          const lookup = findTargetSchoolEvaluatorForRole({
            evaluatorAssignments,
            roleKey,
            oldEvaluatorPersonId: asString(oldPattern.evaluatorPersonId),
            oldEvaluatorRoleLabel: asString(oldPattern.evaluatorRoleLabel),
            newPlanId: item.newPlanId,
          });

          if (lookup.status === "NONE") {
            conflicts.push({
              reason: "NO_TARGET_SCHOOL_EVALUATOR_FOUND_FOR_ROLE",
              newPlanId: item.newPlanId,
              newCycleId: cycle.id,
              oldPlanId: item.oldPlanId,
              oldCycleId: oldCycleIdForThisNewCycle,
              evaluatorRoleKey: roleKey,
              oldEvaluatorPersonId: oldPattern.evaluatorPersonId,
              oldEvaluatorDisplayName: oldPattern.evaluatorDisplayName || "",
              note:
                "Create at least one active evaluator assignment in the target school for this evaluator role, or seed the target school evaluations first.",
            });
            continue;
          }

          if (lookup.status === "MULTIPLE") {
            conflicts.push({
              reason: "MULTIPLE_TARGET_SCHOOL_EVALUATORS_FOUND_FOR_ROLE",
              newPlanId: item.newPlanId,
              newCycleId: cycle.id,
              evaluatorRoleKey: roleKey,
              oldEvaluatorPersonId: oldPattern.evaluatorPersonId,
              candidates: lookup.candidates.map((candidate) => ({
                evaluatorPersonId: candidate.evaluatorPersonId,
                evaluatorEmail: candidate.evaluatorEmail,
                evaluatorDisplayName: candidate.evaluatorDisplayName,
                evaluatorRoleKey: candidate.evaluatorRoleKey,
                evaluatorRoleLabel: candidate.evaluatorRoleLabel,
                sourceAssignmentId: candidate.sourceAssignmentId,
                sourcePlanId: candidate.sourcePlanId,
              })),
              note:
                "More than one evaluator with the same role exists in the target school. Use a cleaner target-school pattern before applying.",
            });
            continue;
          }

          resolvedPatterns.push({
            pattern: oldPattern,
            evaluator: lookup.evaluator,
          });
        }

        uniquePatterns = resolvedPatterns;
        patternSource = "OLD_PLAN_SAME_CYCLE_PLUS_TARGET_SCHOOL_ROLE_LOOKUP";
      } else {
        uniquePatterns = uniquePatterns.map((pattern) => ({
          pattern,
          evaluator: {
            evaluatorUid: asString(pattern.evaluatorUid, asString(pattern.uid)),
            evaluatorPersonId: asString(pattern.evaluatorPersonId),
            evaluatorEmail: asString(pattern.evaluatorEmail),
            evaluatorDisplayName: asString(pattern.evaluatorDisplayName),
            evaluatorRoleKey: asString(pattern.evaluatorRoleKey),
            evaluatorRoleLabel: asString(pattern.evaluatorRoleLabel),
            sourceAssignmentId: pattern.id,
            sourcePlanId: pattern.planId,
            sourceCycleId: pattern.cycleId,
          },
        }));
      }

      if (uniquePatterns.length === 0) {
        conflicts.push({
          reason: "NO_EVALUATOR_PATTERN_FOUND_FOR_NEW_CYCLE",
          newPlanId: item.newPlanId,
          cycleId: cycle.id,
          note:
            "The cycle exists or will be created, but no evaluator could be resolved safely.",
        });
        continue;
      }

      cyclePatternSummary.push({
        cycleId: cycle.id,
        cycleTitle: cycle.title || cycle.shortTitle || "",
        patternSource,
        evaluatorPatterns: uniquePatterns.map(({ pattern, evaluator }) => ({
          patternId: pattern.id,
          evaluatorPersonId: evaluator.evaluatorPersonId,
          evaluatorEmail: evaluator.evaluatorEmail || "",
          evaluatorDisplayName: evaluator.evaluatorDisplayName || "",
          evaluatorRoleKey: evaluator.evaluatorRoleKey || "",
          evaluatorRoleLabel: evaluator.evaluatorRoleLabel || "",
          patternTargetPersonId: pattern.targetPersonId,
          patternTargetDisplayName: pattern.targetDisplayName || "",
          sourceAssignmentId: evaluator.sourceAssignmentId || pattern.id,
          sourcePlanId: evaluator.sourcePlanId || pattern.planId,
        })),
      });

      for (const { pattern, evaluator } of uniquePatterns) {
        const evaluatorPersonId = asString(evaluator.evaluatorPersonId);

        const newEvaluatorId = buildEvaluatorAssignmentIdFromPattern(
          pattern,
          teacher.personId,
          item.newPlanId,
          cycle.id,
          evaluatorPersonId,
        );

        const newEvaluatorRef = orgRef
          .collection("evaluationEvaluatorAssignments")
          .doc(newEvaluatorId);

        newEvaluatorWrites.push({
          type: "set",
          ref: newEvaluatorRef,
          label: `create-or-update-evaluator:${newEvaluatorId}`,
          data: buildEvaluatorWrite({
            pattern,
            evaluator,
            newEvaluatorId,
            newTargetId,
            newPlan: item.newPlan,
            cycle,
            teacher,
            toSchoolTitle,
            now,
          }),
        });
      }
    }

    transferPlanRows.push({
      oldPlanId: item.oldPlanId,
      newPlanId: item.newPlanId,
      oldPlanTitle: item.oldPlan?.title || item.oldTarget.planTitle || "",
      newPlanTitle: item.newPlan.title || "",
      cyclesCount: newPlanCycles.length,
      cyclesCreatedOrReactivatedFromOldPlan: createdCyclesFromOld.length,
      newTargetId,
      cyclePatternSummary,
    });
  }

  for (const oldTarget of oldActiveTargets) {
    removeOldTargetWrites.push({
      type: "set",
      ref: oldTarget.ref,
      label: `remove-old-target:${oldTarget.id}`,
      data: {
        status: "REMOVED",
        removedAt: now,
        removedReason: TRANSFER_REASON,
        transferredAt: now,
        transferredFromSchoolId: FROM_SCHOOL_ID,
        transferredToSchoolId: TO_SCHOOL_ID,
        transferTool: "transfer-teacher-evaluations.cjs",
        updatedAt: now,
      },
    });
  }

  for (const oldEvaluator of oldActiveEvaluators) {
    removeOldEvaluatorWrites.push({
      type: "set",
      ref: oldEvaluator.ref,
      label: `remove-old-evaluator:${oldEvaluator.id}`,
      data: {
        status: "REMOVED",
        removedAt: now,
        removedReason: TRANSFER_REASON,
        transferredAt: now,
        transferredFromSchoolId: FROM_SCHOOL_ID,
        transferredToSchoolId: TO_SCHOOL_ID,
        transferTool: "transfer-teacher-evaluations.cjs",
        updatedAt: now,
      },
    });
  }

  const allWrites = [
    ...newCycleWrites,
    ...planUpdateWrites,
    ...newTargetWrites,
    ...newEvaluatorWrites,
    ...removeOldTargetWrites,
    ...removeOldEvaluatorWrites,
  ];

  const report = {
    decision:
      conflicts.length > 0
        ? "STOPPED"
        : APPLY
          ? "READY_TO_APPLY"
          : "SAFE_PREVIEW",

    mode: APPLY ? "APPLY" : "PREVIEW",

    input: {
      orgId: ORG_ID,
      academicYearId: ACADEMIC_YEAR_ID,
      termId: TERM_ID,
      email: EMAIL,
      fromSchoolId: FROM_SCHOOL_ID,
      fromSchoolTitle,
      toSchoolId: TO_SCHOOL_ID,
      toSchoolTitle,
    },

    teacher,

    currentState: {
      oldActiveTeacherTargetAssignments: oldActiveTargets.length,
      oldActiveEvaluatorAssignments: oldActiveEvaluators.length,
      oldSubmissions: countSubmissions(oldSubmissions),
      existingActiveTargetsInToSchool: newExistingTargetsForTeacher.length,
    },

    plannedChanges: {
      createOrReactivateNewCycles: newCycleWrites.length,
      updateNewPlansCycleCount: planUpdateWrites.length,
      createOrUpdateNewTargetAssignments: newTargetWrites.length,
      createOrUpdateNewEvaluatorAssignments: newEvaluatorWrites.length,
      removeOldTargetAssignments: removeOldTargetWrites.length,
      removeOldEvaluatorAssignments: removeOldEvaluatorWrites.length,
      totalWrites: allWrites.length,
    },

    transferPlans: transferPlanRows,

    warnings,
    conflicts,

    safety: {
      deletes: 0,
      submissionsTouched: 0,
      oldAssignmentsAction: "status becomes REMOVED",
      historicalSubmissionsRemain: true,
      requiresApplyFlag: true,
    },
  };

  console.dir(report, { depth: 80 });

  if (conflicts.length > 0) {
    console.log("");
    console.log("Stopped. Fix conflicts before applying.");
    process.exit(1);
  }

  if (!APPLY) {
    console.log("");
    console.log("No writes performed.");
    console.log("Review the report carefully.");
    console.log("Run again with --apply to transfer assignments.");
    return;
  }

  const committed = await commitInChunks(allWrites);

  console.dir({
    decision: "APPLIED",
    committedWrites: committed,
    createdOrReactivatedNewCycles: newCycleWrites.length,
    updatedNewPlansCycleCount: planUpdateWrites.length,
    createdOrUpdatedTargets: newTargetWrites.length,
    createdOrUpdatedEvaluators: newEvaluatorWrites.length,
    removedOldTargets: removeOldTargetWrites.length,
    removedOldEvaluators: removeOldEvaluatorWrites.length,
    submissionsTouched: 0,
  });
}

main().catch((err) => {
  console.error("Transfer failed:", err);
  process.exit(1);
});