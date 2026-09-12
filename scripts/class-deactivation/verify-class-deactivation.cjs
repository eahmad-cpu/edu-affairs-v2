const {
  getTarget,
  getDb,
  findClass,
  inspectRelations,
  printClassInfo,
  getActiveEnrollments,
  getActiveRelations,
} = require("./class-deactivation-common.cjs");

async function main() {
  const target = getTarget();
  const db = getDb();

  console.log("");
  console.log("CLASS DEACTIVATION VERIFY");

  const foundClass = await findClass(db, target);

  printClassInfo(target, foundClass);

  const relations = await inspectRelations(db, target);

  const activeEnrollments =
    getActiveEnrollments(relations);

  const activeRelations =
    getActiveRelations(relations);

  console.log("");
  console.log("========================================");
  console.log("VERIFY RESULT");
  console.log("========================================");

  console.log(
    "classInactive:",
    foundClass.data.isActive === false
  );

  console.log(
    "activeEnrollments:",
    activeEnrollments.length
  );

  console.log(
    "activeRelatedRecords:",
    activeRelations.length
  );

  if (activeRelations.length > 0) {
    console.log("");
    console.log(
      "Active relations still pointing to class:"
    );

    for (const item of activeRelations) {
      console.log(
        `- [${item.collection}] ${item.path}`
      );
    }
  }

  console.log("");

  if (
    foundClass.data.isActive === false &&
    activeEnrollments.length === 0
  ) {
    console.log("DECISION: VERIFIED");
  } else {
    console.log("DECISION: VERIFY FAILED");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("");
  console.error("FAILED");
  console.error(error);
  process.exit(1);
});