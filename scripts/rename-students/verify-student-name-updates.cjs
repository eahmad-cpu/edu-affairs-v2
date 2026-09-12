const fs = require("node:fs");
const path = require("node:path");
const ExcelJS = require("exceljs");

const {
  cert,
  getApps,
  initializeApp,
} = require("firebase-admin/app");

const {
  getFirestore,
} = require("firebase-admin/firestore");

const ORG_ID = "takween";
const SHEET_NAME = "updates";

const INPUT_FILE = path.resolve(
  process.cwd(),
  "scripts",
  "rename-students",
  "inputs",
  "student-name-updates.xlsx",
);

const REPORT_FILE = path.resolve(
  process.cwd(),
  "scripts",
  "rename-students",
  "reports",
  "student-name-updates-verify.json",
);

const SERVICE_ACCOUNT_FILE = path.resolve(
  process.cwd(),
  "scripts",
  "service-account.json",
);

if (!fs.existsSync(SERVICE_ACCOUNT_FILE)) {
  throw new Error(
    `Service account file not found: ${SERVICE_ACCOUNT_FILE}`,
  );
}

const serviceAccount = JSON.parse(
  fs.readFileSync(SERVICE_ACCOUNT_FILE, "utf8"),
);

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const db = getFirestore();

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNationalId(value) {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .trim();
}

function ensureReportDirectory() {
  fs.mkdirSync(path.dirname(REPORT_FILE), {
    recursive: true,
  });
}

async function readInputRows() {
  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error(`Input file not found: ${INPUT_FILE}`);
  }

  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.readFile(
    INPUT_FILE,
  );

  const worksheet =
    workbook.getWorksheet(SHEET_NAME);

  if (!worksheet) {
    throw new Error(
      `Worksheet "${SHEET_NAME}" not found.`,
    );
  }

  const headers = new Map();

  worksheet
    .getRow(1)
    .eachCell((cell, columnNumber) => {
      headers.set(
        normalizeText(cell.text),
        columnNumber,
      );
    });

  const nationalIdColumn =
    headers.get("nationalId");

  const newDisplayNameColumn =
    headers.get("newDisplayName");

  if (
    !nationalIdColumn ||
    !newDisplayNameColumn
  ) {
    throw new Error(
      'Required columns are: "nationalId" and "newDisplayName".',
    );
  }

  const rows = [];

  for (
    let rowNumber = 2;
    rowNumber <= worksheet.rowCount;
    rowNumber += 1
  ) {
    const row =
      worksheet.getRow(rowNumber);

    const nationalId =
      normalizeNationalId(
        row.getCell(
          nationalIdColumn,
        ).text,
      );

    const newDisplayName =
      normalizeText(
        row.getCell(
          newDisplayNameColumn,
        ).text,
      );

    if (
      !nationalId &&
      !newDisplayName
    ) {
      continue;
    }

    rows.push({
      excelRow: rowNumber,
      nationalId,
      newDisplayName,
    });
  }

  return rows;
}

async function findPeopleByNationalId(nationalId) {
  return db
    .collection(`orgs/${ORG_ID}/people`)
    .where("nationalId", "==", nationalId)
    .get();
}

async function findStudentsByPersonId(personId) {
  return db
    .collection(`orgs/${ORG_ID}/students`)
    .where("personId", "==", personId)
    .get();
}

async function main() {
  console.log("");
  console.log("========================================");
  console.log(" VERIFY STUDENT NAME UPDATES");
  console.log("========================================");
  console.log(`Org: ${ORG_ID}`);
  console.log(`Input: ${INPUT_FILE}`);
  console.log("");

  const rows = await readInputRows();

  const results = [];
  const problems = [];

  for (const row of rows) {
    const peopleSnapshot =
      await findPeopleByNationalId(
        row.nationalId,
      );

    if (peopleSnapshot.size === 0) {
      problems.push({
        excelRow: row.excelRow,
        nationalId: row.nationalId,
        reason: "PERSON_NOT_FOUND",
      });

      continue;
    }

    if (peopleSnapshot.size > 1) {
      problems.push({
        excelRow: row.excelRow,
        nationalId: row.nationalId,
        matches: peopleSnapshot.size,
        reason:
          "MULTIPLE_PEOPLE_WITH_SAME_NATIONAL_ID",
      });

      continue;
    }

    const personDoc =
      peopleSnapshot.docs[0];

    const person =
      personDoc.data();

    const actualDisplayName =
      normalizeText(
        person.displayName,
      );

    const personOk =
      actualDisplayName ===
      row.newDisplayName;

    const studentsSnapshot =
      await findStudentsByPersonId(
        personDoc.id,
      );

    const studentProblems = [];

    for (
      const studentDoc
      of studentsSnapshot.docs
    ) {
      const student =
        studentDoc.data();

      if (
        typeof student.displayName ===
        "string"
      ) {
        const studentDisplayName =
          normalizeText(
            student.displayName,
          );

        if (
          studentDisplayName !==
          row.newDisplayName
        ) {
          studentProblems.push({
            studentId:
              studentDoc.id,
            actualDisplayName:
              studentDisplayName,
          });
        }
      }
    }

    const result =
      personOk &&
      studentProblems.length === 0
        ? "OK"
        : "FAILED";

    results.push({
      excelRow: row.excelRow,
      nationalId: row.nationalId,
      personId: personDoc.id,
      expectedDisplayName:
        row.newDisplayName,
      actualDisplayName,
      linkedStudents:
        studentsSnapshot.size,
      result,
    });

    if (!personOk) {
      problems.push({
        nationalId: row.nationalId,
        personId: personDoc.id,
        expectedDisplayName:
          row.newDisplayName,
        actualDisplayName,
        reason:
          "PERSON_DISPLAY_NAME_MISMATCH",
      });
    }

    for (
      const studentProblem
      of studentProblems
    ) {
      problems.push({
        nationalId: row.nationalId,
        personId: personDoc.id,
        studentId:
          studentProblem.studentId,
        expectedDisplayName:
          row.newDisplayName,
        actualDisplayName:
          studentProblem.actualDisplayName,
        reason:
          "STUDENT_DISPLAY_NAME_MISMATCH",
      });
    }
  }

  const report = {
    decision:
      problems.length === 0
        ? "VERIFIED"
        : "FAILED",

    generatedAt:
      new Date().toISOString(),

    orgId: ORG_ID,
    inputFile: INPUT_FILE,

    summary: {
      inputRows: rows.length,

      verified:
        results.filter(
          (item) =>
            item.result === "OK",
        ).length,

      failed:
        results.filter(
          (item) =>
            item.result === "FAILED",
        ).length,

      problems: problems.length,
    },

    results,
    problems,
  };

  ensureReportDirectory();

  fs.writeFileSync(
    REPORT_FILE,
    JSON.stringify(report, null, 2),
    "utf8",
  );

  console.table(
    results.map((item) => ({
      nationalId:
        item.nationalId,
      personId: item.personId,
      expected:
        item.expectedDisplayName,
      actual:
        item.actualDisplayName,
      result: item.result,
    })),
  );

  if (problems.length > 0) {
    console.log("");
    console.log("Problems:");
    console.table(problems);
  }

  console.log("");
  console.log({
    decision: report.decision,
    ...report.summary,
  });

  console.log("");
  console.log(`Report: ${REPORT_FILE}`);

  if (problems.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("");
  console.error("Verify failed:");
  console.error(error);
  process.exitCode = 1;
});