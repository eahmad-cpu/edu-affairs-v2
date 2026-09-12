const {
  APPLY_TOKEN,
  applyTransferResult,
  createApplyReportWriter,
  getConfig,
  printResults,
  readExcelRows,
  resolveRows,
} = require("./student-transfer-core.cjs");

async function main() {
  const config = getConfig();
  const isApply = config.args.apply === APPLY_TOKEN;
  const excel = await readExcelRows(config);
  if (excel.headerErrors.length > 0) {
    excel.headerErrors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }
  const { db, results } = await resolveRows({ config, rows: excel.rows });
  printResults(isApply ? "Student transfer apply plan" : `Student transfer dry run (pass --apply=${APPLY_TOKEN} to write)`, results);
  if (!isApply) {
    if (results.some((result) => result.action === "BLOCKED")) process.exitCode = 1;
    return;
  }

  let reportWriter = null;
  const applied = [];
  for (const result of results) {
    try {
      const appliedResult = await applyTransferResult({ db, orgId: config.orgId, result });
      applied.push(appliedResult);
      if (appliedResult.action === "TRANSFERRED") {
        if (!reportWriter) reportWriter = createApplyReportWriter(config);
        reportWriter.append({ row: result, result: appliedResult });
      }
    } catch (error) {
      applied.push({
        rowNumber: result.rowNumber,
        action: "BLOCKED",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }
  console.table(applied);
  if (reportWriter) console.log(`Immutable append-only transfer report: ${reportWriter.reportPath}`);
  if (applied.some((result) => result.action === "BLOCKED")) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Student transfer apply failed:", error);
  process.exitCode = 1;
});
