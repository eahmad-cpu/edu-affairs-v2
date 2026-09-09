"use strict";

const { buildPlan, initAdmin, publicReport } = require("./kg-teacher-assignment-reconciler-core.cjs");

async function main() {
  initAdmin();
  const report = await buildPlan();
  console.log(JSON.stringify(publicReport(report), null, 2));
  const collections = [
    "teacherAssignments",
    "teacherAssignmentClassLinks",
    "operationalAssignments",
  ];
  const countByCollection = (action) => Object.fromEntries(
    collections.map((collection) => [
      collection,
      report.actions.filter((item) => item.action === action && item.collection === collection).length,
    ]),
  );
  const inputRowsByNumber = new Map(report.inputRows.map((row) => [row.rowNumber, row]));
  const desiredTeacherAssignments = new Set();
  for (const target of report.offeringsByClass) {
    const row = inputRowsByNumber.get(target.rowNumber);
    if (!row) continue;
    for (const offeringId of target.offeringIds) {
      desiredTeacherAssignments.add([
        row.personId,
        target.classId,
        offeringId,
        row.assignmentRole,
      ].join("|"));
    }
  }
  const creates = countByCollection("CREATE");
  const ends = countByCollection("END");
  console.log(JSON.stringify({
    dryRunSummary: {
      createByCollection: creates,
      endByCollection: ends,
      transferCount: report.transfers.length,
      transferSummaries: report.transfers.map((transfer) => ({
        teacherEmail: transfer.teacher.email,
        personId: transfer.teacher.personId,
        fromSchoolId: transfer.fromSchoolId,
        toSchoolId: transfer.toSchoolId,
        status: transfer.status,
        oldActiveCounts: transfer.oldActiveCounts,
        newDesiredCounts: transfer.newDesiredCounts,
      })),
      writesByCollectionAction: report.writesByCollectionAction,
      distinctDesiredTeacherClassOfferingRoles: desiredTeacherAssignments.size,
      totalCreate: report.summary.create || 0,
      totalEnd: report.summary.end || 0,
    },
  }, null, 2));
  if (report.blockers.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ status: "BLOCKED", blockers: [error.message] }, null, 2));
  process.exitCode = 1;
});
