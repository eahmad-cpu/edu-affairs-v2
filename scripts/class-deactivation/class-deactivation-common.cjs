const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(
  path.resolve("service-account.json")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const db = admin.firestore();

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }

  return value;
}

function getTarget() {
  return {
    orgId: requiredEnv("ORG_ID"),
    schoolId: requiredEnv("SCHOOL_ID"),
    academicYearId: requiredEnv("ACADEMIC_YEAR_ID"),
    classId: requiredEnv("CLASS_ID"),
    reason:
      String(
        process.env.DEACTIVATION_REASON ||
          "CLASS_DEACTIVATED"
      ).trim() || "CLASS_DEACTIVATED",
  };
}

function getDb() {
  return db;
}

async function findClass(db, target) {
  const classRef = db.doc(
    `orgs/${target.orgId}/schools/${target.schoolId}/academicYears/${target.academicYearId}/classes/${target.classId}`
  );

  const snapshot = await classRef.get();

  if (!snapshot.exists) {
    throw new Error(
      `Class not found: ${target.orgId}/${target.schoolId}/${target.academicYearId}/${target.classId}`
    );
  }

  const data = snapshot.data() || {};

  return {
    gradeId: data.gradeId || null,
    ref: classRef,
    snapshot,
    data,
  };
}

function getAcademicYearId(data) {
  return (
    data.academicYearId ||
    data.yearId ||
    data.academicYearIdValue ||
    null
  );
}

function hasClassReference(data, target) {
  if (!data) {
    return false;
  }

  if (data.classId === target.classId) {
    return true;
  }

  if (data.targetClassId === target.classId) {
    return true;
  }

  if (data.scope?.classId === target.classId) {
    return true;
  }

  if (
    data.scopeType === "CLASS" &&
    data.scopeId === target.classId
  ) {
    return true;
  }

  if (
    Array.isArray(data.classIds) &&
    data.classIds.includes(target.classId)
  ) {
    return true;
  }

  if (
    Array.isArray(data.scope?.classIds) &&
    data.scope.classIds.includes(target.classId)
  ) {
    return true;
  }

  return false;
}

function belongsToTarget(data, target) {
  if (!hasClassReference(data, target)) {
    return false;
  }

  if (
    data.schoolId &&
    data.schoolId !== target.schoolId
  ) {
    return false;
  }

  const academicYearId = getAcademicYearId(data);

  if (
    academicYearId &&
    academicYearId !== target.academicYearId
  ) {
    return false;
  }

  return true;
}

async function scanDirectCollection(
  db,
  collectionId,
  target
) {
  const collectionPath =
    `orgs/${target.orgId}/${collectionId}`;

  try {
    const snapshot = await db
      .collection(collectionPath)
      .get();

    const docs = snapshot.docs.filter((doc) =>
      belongsToTarget(doc.data(), target)
    );

    return {
      collectionId,
      path: collectionPath,
      scannedCount: snapshot.size,
      docs,
      error: null,
    };
  } catch (error) {
    return {
      collectionId,
      path: collectionPath,
      scannedCount: 0,
      docs: [],
      error:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }
}

async function inspectRelations(db, target) {
  const collectionIds = [
    "studentEnrollments",
    "classSubjectOfferings",
    "teacherAssignments",
    "teacherAssignmentClassLinks",
    "operationalAssignments",
  ];

  const relations = {};

  for (const collectionId of collectionIds) {
    relations[collectionId] =
      await scanDirectCollection(
        db,
        collectionId,
        target
      );
  }

  return relations;
}

function normalizeStatus(data) {
  return String(
    data.enrollmentStatus ||
      data.status ||
      ""
  )
    .trim()
    .toUpperCase();
}

function isActiveEnrollment(data) {
  if (data.isActive === false) {
    return false;
  }

  const status = normalizeStatus(data);

  const inactiveStatuses = new Set([
    "INACTIVE",
    "REMOVED",
    "ARCHIVED",
    "TRANSFERRED",
    "GRADUATED",
    "CANCELLED",
    "CANCELED",
    "WITHDRAWN",
    "ENDED",
  ]);

  if (inactiveStatuses.has(status)) {
    return false;
  }

  const activeStatuses = new Set([
    "ACTIVE",
    "ENROLLED",
    "CURRENT",
  ]);

  if (activeStatuses.has(status)) {
    return true;
  }

  return true;
}

function isActiveRelation(
  collectionId,
  data
) {
  if (
    collectionId === "classSubjectOfferings"
  ) {
    if (data.isArchived === true) {
      return false;
    }

    if (
      ["ARCHIVED", "ENDED"].includes(
        normalizeStatus(data)
      )
    ) {
      return false;
    }

    return true;
  }

  if (data.isActive === false) {
    return false;
  }

  const status = normalizeStatus(data);

  if (
    [
      "INACTIVE",
      "REMOVED",
      "ARCHIVED",
      "CANCELLED",
      "CANCELED",
      "ENDED",
      "DISABLED",
    ].includes(status)
  ) {
    return false;
  }

  return true;
}

function getActiveEnrollments(relations) {
  const docs =
    relations.studentEnrollments?.docs || [];

  return docs.filter((doc) =>
    isActiveEnrollment(doc.data())
  );
}

function getActiveRelations(relations) {
  const collectionIds = [
    "classSubjectOfferings",
    "teacherAssignments",
    "teacherAssignmentClassLinks",
    "operationalAssignments",
  ];

  const result = [];

  for (const collectionId of collectionIds) {
    const relation = relations[collectionId];

    if (!relation) {
      continue;
    }

    for (const doc of relation.docs) {
      if (
        !isActiveRelation(
          collectionId,
          doc.data()
        )
      ) {
        continue;
      }

      result.push({
        collectionId,
        ref: doc.ref,
        path: doc.ref.path,
        data: doc.data(),
      });
    }
  }

  return result;
}

function getScanErrors(relations) {
  const errors = [];

  for (const [
    collectionId,
    relation,
  ] of Object.entries(relations)) {
    if (!relation.error) {
      continue;
    }

    errors.push({
      collectionId,
      error: relation.error,
    });
  }

  return errors;
}

function getRelationDeactivationPatch(
  relation,
  target,
  now
) {
  switch (relation.collectionId) {
    case "classSubjectOfferings":
      return {
        isArchived: true,
        status: "ARCHIVED",
        updatedAt: now,
        archivedAt: now,
        deactivatedAt: now,
        deactivationReason: target.reason,
      };

    case "teacherAssignments":
    case "teacherAssignmentClassLinks":
    case "operationalAssignments":
      return {
        isActive: false,
        status: "ENDED",
        updatedAt: now,
        endedAt: now,
        deactivatedAt: now,
        deactivationReason: target.reason,
      };

    default:
      throw new Error(
        `Unsupported relation collection: ${relation.collectionId}`
      );
  }
}

function getPlannedState(collectionId) {
  if (
    collectionId ===
    "classSubjectOfferings"
  ) {
    return {
      status: "ARCHIVED",
      label: "isArchived: true",
    };
  }

  return {
    status: "ENDED",
    label: "isActive: false",
  };
}

function printClassInfo(target, foundClass) {
  const data = foundClass.data;

  console.log("");
  console.log("========================================");
  console.log("CLASS");
  console.log("========================================");

  console.log("orgId:", target.orgId);
  console.log("schoolId:", target.schoolId);
  console.log(
    "academicYearId:",
    target.academicYearId
  );
  console.log(
    "gradeId:",
    foundClass.gradeId || "(none)"
  );
  console.log("classId:", target.classId);

  console.log(
    "title:",
    data.title ||
      data.name ||
      data.displayName ||
      "(no title)"
  );

  console.log(
    "isArchived:",
    data.isArchived === true
  );

  console.log(
    "isActive:",
    data.isActive
  );

  console.log("path:", foundClass.ref.path);
}

function printRelations(relations) {
  console.log("");
  console.log("========================================");
  console.log("RELATED RECORDS");
  console.log("========================================");

  for (const [
    collectionId,
    relation,
  ] of Object.entries(relations)) {
    console.log("");
    console.log(collectionId);

    console.log(
      "  scanned:",
      relation.scannedCount
    );

    console.log(
      "  matched:",
      relation.docs.length
    );

    if (relation.error) {
      console.log(
        "  QUERY ERROR:",
        relation.error
      );

      continue;
    }

    for (const doc of relation.docs.slice(0, 30)) {
      const data = doc.data();

      console.log("  -", doc.ref.path);

      console.log(
        "    status:",
        data.enrollmentStatus ||
          data.status ||
          "(none)",
        "| isActive:",
        data.isActive,
        "| isArchived:",
        data.isArchived
      );
    }

    if (relation.docs.length > 30) {
      console.log(
        `  ... ${relation.docs.length - 30} more`
      );
    }
  }
}

module.exports = {
  getTarget,
  getDb,
  findClass,
  inspectRelations,
  printClassInfo,
  printRelations,
  getActiveEnrollments,
  getActiveRelations,
  getScanErrors,
  getRelationDeactivationPatch,
  getPlannedState,
};