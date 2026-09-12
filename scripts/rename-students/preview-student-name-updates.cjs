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
  "student-name-updates-preview.json",
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
  await workbook.xlsx.readFile(INPUT_FILE);

  const worksheet = workbook.getWorksheet(SHEET_NAME);

  if (!worksheet) {
    throw new Error(
      `Worksheet "${SHEET_NAME}" not found. Available sheets: ${workbook.worksheets
        .map((sheet) => sheet.name)
        .join(", ")}`,
    );
  }

  const headerRow = worksheet.getRow(1);

  const headers = new Map();

  headerRow.eachCell((cell, columnNumber) => {
    headers.set(
      normalizeText(cell.text),
      columnNumber,
    );
  });

  const nationalIdColumn = headers.get("nationalId");
  const newDisplayNameColumn = headers.get("newDisplayName");

  if (!nationalIdColumn || !newDisplayNameColumn) {
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
    const row = worksheet.getRow(rowNumber);

    const nationalId = normalizeNationalId(
      row.getCell(nationalIdColumn).text,
    );

    const newDisplayName = normalizeText(
      row.getCell(newDisplayNameColumn).text,
    );

    if (!nationalId && !newDisplayName) {
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

function validateRows(rows) {
  const conflicts = [];
  const seenNationalIds = new Map();

  for (const row of rows) {
    if (!row.nationalId) {
      conflicts.push({
        excelRow: row.excelRow,
        reason: "MISSING_NATIONAL_ID",
      });

      continue;
    }

    if (!/^\d{10}$/.test(row.nationalId)) {
      conflicts.push({
        excelRow: row.excelRow,
        nationalId: row.nationalId,
        reason: "INVALID_NATIONAL_ID",
      });
    }

    if (!row.newDisplayName) {
      conflicts.push({
        excelRow: row.excelRow,
        nationalId: row.nationalId,
        reason: "MISSING_NEW_DISPLAY_NAME",
      });
    }

    if (seenNationalIds.has(row.nationalId)) {
      conflicts.push({
        excelRow: row.excelRow,
        nationalId: row.nationalId,
        previousExcelRow: seenNationalIds.get(
          row.nationalId,
        ),
        reason: "DUPLICATE_NATIONAL_ID_IN_INPUT",
      });
    } else {
      seenNationalIds.set(
        row.nationalId,
        row.excelRow,
      );
    }
  }

  return conflicts;
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
  console.log(" PREVIEW STUDENT NAME UPDATES");
  console.log("========================================");
  console.log(`Org: ${ORG_ID}`);
  console.log(`Input: ${INPUT_FILE}`);
  console.log("");

  const rows = await readInputRows();

  const conflicts = validateRows(rows);

  if (conflicts.length > 0) {
    const report = {
      decision: "BLOCKED",
      reason: "INPUT_VALIDATION_FAILED",
      generatedAt: new Date().toISOString(),
      orgId: ORG_ID,
      inputFile: INPUT_FILE,
      rowsCount: rows.length,
      conflicts,
    };

    ensureReportDirectory();

    fs.writeFileSync(
      REPORT_FILE,
      JSON.stringify(report, null, 2),
      "utf8",
    );

    console.table(conflicts);

    console.log("");
    console.log({
      decision: "BLOCKED",
      conflicts: conflicts.length,
      reportFile: REPORT_FILE,
    });

    process.exitCode = 1;
    return;
  }

  const preview = [];

  for (const row of rows) {
    const peopleSnapshot =
      await findPeopleByNationalId(row.nationalId);

    if (peopleSnapshot.size === 0) {
      conflicts.push({
        excelRow: row.excelRow,
        nationalId: row.nationalId,
        reason: "PERSON_NOT_FOUND",
      });

      continue;
    }

    if (peopleSnapshot.size > 1) {
      conflicts.push({
        excelRow: row.excelRow,
        nationalId: row.nationalId,
        matches: peopleSnapshot.size,
        reason: "MULTIPLE_PEOPLE_WITH_SAME_NATIONAL_ID",
      });

      continue;
    }

    const personDoc = peopleSnapshot.docs[0];
    const person = personDoc.data();

    const oldDisplayName = normalizeText(
      person.displayName,
    );

    const studentsSnapshot =
      await findStudentsByPersonId(personDoc.id);

    const linkedStudents =
      studentsSnapshot.docs.map((studentDoc) => {
        const student = studentDoc.data();

        return {
          studentId: studentDoc.id,
          hasDisplayName:
            typeof student.displayName === "string",
          displayName:
            typeof student.displayName === "string"
              ? normalizeText(student.displayName)
              : null,
        };
      });

    preview.push({
      excelRow: row.excelRow,
      nationalId: row.nationalId,
      personId: personDoc.id,
      oldDisplayName,
      newDisplayName: row.newDisplayName,

      personAction:
        oldDisplayName === row.newDisplayName
          ? "NO_CHANGE"
          : "UPDATE",

      linkedStudentsCount:
        linkedStudents.length,

      linkedStudents,
    });
  }

  const report = {
    decision:
      conflicts.length > 0
        ? "BLOCKED"
        : "READY",

    generatedAt: new Date().toISOString(),

    orgId: ORG_ID,
    inputFile: INPUT_FILE,

    summary: {
      inputRows: rows.length,

      peopleToUpdate: preview.filter(
        (item) => item.personAction === "UPDATE",
      ).length,

      peopleNoChange: preview.filter(
        (item) =>
          item.personAction === "NO_CHANGE",
      ).length,

      conflicts: conflicts.length,
    },

    preview,
    conflicts,

    safety: {
      writes: 0,
      deletes: 0,
      previewOnly: true,
    },
  };

  ensureReportDirectory();

  fs.writeFileSync(
    REPORT_FILE,
    JSON.stringify(report, null, 2),
    "utf8",
  );

  console.table(
    preview.map((item) => ({
      row: item.excelRow,
      nationalId: item.nationalId,
      personId: item.personId,
      oldName: item.oldDisplayName,
      newName: item.newDisplayName,
      action: item.personAction,
      linkedStudents:
        item.linkedStudentsCount,
    })),
  );

  if (conflicts.length > 0) {
    console.log("");
    console.log("Conflicts:");
    console.table(conflicts);
  }

  console.log("");
  console.log(report.summary);

  console.log("");
  console.log(`Report: ${REPORT_FILE}`);

  console.log("");
  console.log("NO WRITES WERE MADE.");

  if (conflicts.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("");
  console.error("Preview failed:");
  console.error(error);
  process.exitCode = 1;
});