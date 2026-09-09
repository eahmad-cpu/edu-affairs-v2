"use strict";

const { buildPlan, initAdmin, publicReport } = require("./kg-teacher-assignment-reconciler-core.cjs");

async function main() {
  initAdmin();
  const report = await buildPlan();
  const pending = (report.summary.create || 0) +
    (report.summary.end || 0) +
    (report.summary.transferMembershipScope || 0);
  const transfersVerified = report.transfers.every((transfer) => transfer.verification?.passed === true);
  const status = report.blockers.length > 0
    ? "BLOCKED"
    : pending > 0
      ? "NOT_RECONCILED"
      : transfersVerified
        ? "VERIFIED"
        : "NOT_RECONCILED";
  console.log(JSON.stringify({ status, transfersVerified, report: publicReport(report) }, null, 2));
  if (status !== "VERIFIED") process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ status: "BLOCKED", blockers: [error.message] }, null, 2));
  process.exitCode = 1;
});
