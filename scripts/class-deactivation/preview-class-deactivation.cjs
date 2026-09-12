const {
  getTarget,
  getDb,
  findClass,
  inspectRelations,
  printClassInfo,
  printRelations,
  getActiveEnrollments,
  getActiveRelations,
  getScanErrors,
  getPlannedState,
} = require("./class-deactivation-common.cjs");

async function main() {
  const target = getTarget();
  const db = getDb();

  console.log("");
  console.log("CLASS DEACTIVATION PREVIEW");
  console.log("NO WRITES WILL BE PERFORMED");

  const foundClass = await findClass(
    db,
    target
  );

  printClassInfo(target, foundClass);

  const relations = await inspectRelations(
    db,
    target
  );

  printRelations(relations);

  const scanErrors =
    getScanErrors(relations);

  const activeEnrollments =
    getActiveEnrollments(relations);

  const activeRelations =
    getActiveRelations(relations);

  console.log("");
  console.log("========================================");
  console.log("SAFETY");
  console.log("========================================");

  console.log(
    "scanErrors:",
    scanErrors.length
  );

  console.log(
    "activeEnrollments:",
    activeEnrollments.length
  );

  console.log(
    "activeRelatedRecords:",
    activeRelations.length
  );

  if (scanErrors.length > 0) {
    console.log("");
    console.log(
      "BLOCKER: One or more safety scans failed."
    );

    for (const item of scanErrors) {
      console.log(
        `- ${item.collectionId}: ${item.error}`
      );
    }
  }

  if (activeEnrollments.length > 0) {
    console.log("");
    console.log(
      "BLOCKER: Active student enrollments still reference this class."
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
  }

  if (activeRelations.length > 0) {
    console.log("");
    console.log("========================================");
    console.log("PLANNED RELATION CHANGES");
    console.log("========================================");

    for (const relation of activeRelations) {
      const planned =
        getPlannedState(
          relation.collectionId
        );

      console.log("");
      console.log(
        `[${relation.collectionId}]`
      );

      console.log(relation.path);

      console.log(
        "  current status:",
        relation.data.status || "(none)"
      );

      console.log(
        "  new status:",
        planned.status
      );

      console.log(
        `  ${planned.label}`
      );
    }
  }

  const classNeedsArchive =
    foundClass.data.isArchived !== true;

  console.log("");
  console.log("========================================");
  console.log("WRITE PLAN");
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
    activeRelations.length +
      (classNeedsArchive ? 1 : 0)
  );

  console.log(
    "deactivationReason:",
    target.reason
  );

  console.log("");
  console.log("========================================");

  if (scanErrors.length > 0) {
    console.log(
      "DECISION: BLOCKED DUE TO SAFETY SCAN ERRORS"
    );
  } else if (activeEnrollments.length > 0) {
    console.log(
      "DECISION: BLOCKED DUE TO ACTIVE ENROLLMENTS"
    );
  } else if (
    activeRelations.length +
      (classNeedsArchive ? 1 : 0) >
    500
  ) {
    console.log(
      "DECISION: BLOCKED - MORE THAN 500 ATOMIC WRITES REQUIRED"
    );
  } else if (
    !classNeedsArchive &&
    activeRelations.length === 0
  ) {
    console.log(
      "DECISION: CLASS IS ALREADY ARCHIVED AND CLEAN"
    );
  } else {
    console.log(
      "DECISION: READY FOR APPLY"
    );
  }

  console.log("========================================");
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