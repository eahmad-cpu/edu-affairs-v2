const {
  getTarget,
  getDb,
  findClass,
  inspectRelations,
  printClassInfo,
  getActiveEnrollments,
  getActiveRelations,
  getScanErrors,
  getRelationDeactivationPatch,
} = require("./class-deactivation-common.cjs");

async function main() {
  const target = getTarget();
  const db = getDb();

  console.log("");
  console.log("CLASS DEACTIVATION APPLY");

  if (
    process.env.APPLY_CLASS_DEACTIVATION !== "1"
  ) {
    throw new Error(
      "Apply flag missing. Set APPLY_CLASS_DEACTIVATION=1"
    );
  }

  const confirmation = String(
    process.env.CONFIRM_CLASS_ID || ""
  ).trim();

  if (confirmation !== target.classId) {
    throw new Error(
      `CONFIRM_CLASS_ID must exactly equal "${target.classId}"`
    );
  }

  const foundClass = await findClass(
    db,
    target
  );

  printClassInfo(target, foundClass);

  console.log("");
  console.log(
    "Running safety scans immediately before write..."
  );

  const relations = await inspectRelations(
    db,
    target
  );

  const scanErrors =
    getScanErrors(relations);

  const activeEnrollments =
    getActiveEnrollments(relations);

  const activeRelations =
    getActiveRelations(relations);

  if (scanErrors.length > 0) {
    console.log("");
    console.log("SAFETY SCAN ERRORS:");

    for (const item of scanErrors) {
      console.log(
        `- ${item.collectionId}: ${item.error}`
      );
    }

    throw new Error(
      "Apply blocked because one or more safety scans failed."
    );
  }

  if (activeEnrollments.length > 0) {
    console.log("");
    console.log(
      "ACTIVE STUDENT ENROLLMENTS:"
    );

    for (const doc of activeEnrollments) {
      const data = doc.data();

      console.log(
        "-",
        doc.ref.path,
        "| studentId:",
        data.studentId || "(unknown)",
        "| status:",
        data.enrollmentStatus ||
          data.status ||
          "(none)"
      );
    }

    throw new Error(
      "Apply blocked because active student enrollments still reference this class."
    );
  }

  const classNeedsArchive =
    foundClass.data.isArchived !== true;

  const totalWrites =
    activeRelations.length +
    (classNeedsArchive ? 1 : 0);

  if (totalWrites > 500) {
    throw new Error(
      `Apply blocked: ${totalWrites} writes are required, which exceeds the Firestore atomic batch limit of 500.`
    );
  }

  if (totalWrites === 0) {
    console.log("");
    console.log(
      "DECISION: CLASS IS ALREADY ARCHIVED AND CLEAN"
    );

    return;
  }

  console.log("");
  console.log("========================================");
  console.log("APPLY PLAN");
  console.log("========================================");

  console.log(
    "relationsToDeactivate:",
    activeRelations.length
  );

  console.log(
    "classToArchive:",
    classNeedsArchive ? 1 : 0
  );

  console.log(
    "totalWrites:",
    totalWrites
  );

  console.log(
    "deactivationReason:",
    target.reason
  );

  const now = Date.now();

  const batch = db.batch();

  for (const relation of activeRelations) {
    const patch =
      getRelationDeactivationPatch(
        relation,
        target,
        now
      );

    console.log("");
    console.log(
      `DEACTIVATE [${relation.collectionId}]`
    );

    console.log(relation.path);

    console.log(
      "  old status:",
      relation.data.status || "(none)"
    );

    console.log(
      "  new status:",
      patch.status
    );

    if (
      relation.collectionId ===
      "classSubjectOfferings"
    ) {
      console.log(
        "  isArchived: true"
      );
    } else {
      console.log(
        "  isActive: false"
      );
    }

    batch.update(
      relation.ref,
      patch
    );
  }

  if (classNeedsArchive) {
    console.log("");
    console.log("ARCHIVE CLASS");
    console.log(foundClass.ref.path);

    batch.update(foundClass.ref, {
      isArchived: true,
      isActive: false,
      updatedAt: now,
      archivedAt: now,
      deactivatedAt: now,
      deactivationReason: target.reason,
    });
  }

  console.log("");
  console.log(
    "Committing atomic Firestore batch..."
  );

  await batch.commit();

  console.log("");
  console.log(
    "Batch committed. Running verification..."
  );

  const verificationClass =
    await foundClass.ref.get();

  if (!verificationClass.exists) {
    throw new Error(
      "Verification failed: class document no longer exists."
    );
  }

  const verificationClassData =
    verificationClass.data() || {};

  if (
    verificationClassData.isArchived !== true
  ) {
    throw new Error(
      "Verification failed: class isArchived is not true."
    );
  }

  const verificationRelations =
    await inspectRelations(
      db,
      target
    );

  const verificationErrors =
    getScanErrors(
      verificationRelations
    );

  if (verificationErrors.length > 0) {
    console.log("");
    console.log(
      "WARNING: Post-write verification scan had errors:"
    );

    for (const item of verificationErrors) {
      console.log(
        `- ${item.collectionId}: ${item.error}`
      );
    }

    throw new Error(
      "Write completed, but post-write verification could not finish."
    );
  }

  const remainingActiveEnrollments =
    getActiveEnrollments(
      verificationRelations
    );

  const remainingActiveRelations =
    getActiveRelations(
      verificationRelations
    );

  console.log("");
  console.log("========================================");
  console.log("VERIFICATION");
  console.log("========================================");

  console.log(
    "classArchived:",
    verificationClassData.isArchived === true
  );

  console.log(
    "classIsActive:",
    verificationClassData.isActive
  );

  console.log(
    "activeEnrollments:",
    remainingActiveEnrollments.length
  );

  console.log(
    "activeRelatedRecords:",
    remainingActiveRelations.length
  );

  if (
    remainingActiveEnrollments.length > 0
  ) {
    throw new Error(
      "Verification failed: active enrollments remain."
    );
  }

  if (
    remainingActiveRelations.length > 0
  ) {
    console.log("");
    console.log(
      "REMAINING ACTIVE RELATIONS:"
    );

    for (
      const relation
      of remainingActiveRelations
    ) {
      console.log(
        `- [${relation.collectionId}] ${relation.path}`
      );
    }

    throw new Error(
      "Verification failed: active related records remain."
    );
  }

  console.log("");
  console.log("========================================");
  console.log("APPLIED AND VERIFIED");
  console.log("========================================");

  console.log("orgId:", target.orgId);
  console.log("schoolId:", target.schoolId);
  console.log(
    "academicYearId:",
    target.academicYearId
  );
  console.log("classId:", target.classId);

  console.log(
    "relationsDeactivated:",
    activeRelations.length
  );

  console.log(
    "classArchived: true"
  );

  console.log(
    "remainingActiveRelations: 0"
  );

  console.log(
    "remainingActiveEnrollments: 0"
  );

  console.log("");
  console.log(
    "No records were deleted."
  );

  console.log(
    "Historical records remain preserved."
  );

  console.log("");
  console.log(
    "DECISION: APPLIED_AND_VERIFIED"
  );
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("");
    console.error("FAILED");
    console.error(error);
    process.exit(1);
  });