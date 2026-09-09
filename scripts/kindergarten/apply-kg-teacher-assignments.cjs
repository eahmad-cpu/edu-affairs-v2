"use strict";

const { applyPlan, buildPlan, initAdmin, publicReport } = require("./kg-teacher-assignment-reconciler-core.cjs");

const APPLY_TOKEN = "APPLY_KG_TEACHER_ASSIGNMENTS";
const TRANSFER_APPLY_TOKEN = "APPLY_KG_TEACHER_TRANSFER";

async function main() {
  const applyArguments = process.argv.filter((argument) => argument.startsWith("--apply="));
  if (applyArguments.length > 1) throw new Error("Refusing to apply: provide at most one --apply token.");

  initAdmin();
  const report = await buildPlan();
  const applying = applyArguments.length === 1;
  const requiredToken = report.transfers.length > 0
    ? TRANSFER_APPLY_TOKEN
    : APPLY_TOKEN;
  if (applying && applyArguments[0] !== `--apply=${requiredToken}`) {
    throw new Error(`Refusing to apply: use --apply=${requiredToken}`);
  }
  if (applying) {
    const result = await applyPlan(report);
    report.metadata.mode = "APPLY";
    report.metadata.firestoreWritesPerformed = true;
    report.metadata.firestoreWriteCount = result.firestoreWrites;
    report.metadata.firebaseAuthClaimsUpdated = result.authClaimsUpdated;
  } else {
    report.metadata.mode = "DRY_RUN";
    report.metadata.firestoreWritesPerformed = false;
  }
  console.log(JSON.stringify(publicReport(report), null, 2));
  if (report.blockers.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ status: "BLOCKED", blockers: [error.message] }, null, 2));
  process.exitCode = 1;
});
