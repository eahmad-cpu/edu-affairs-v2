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

const APPLY_FLAG =
  process.env.APPLY_STUDENT_NAME_UPDATES === "1";

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
  "student-name-updates-apply.json",
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
  const seen = new Map();

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

    if (seen.has(row.nationalId)) {
      conflicts.push({
        excelRow: row.excelRow,
        nationalId: row.nationalId,
        previousExcelRow:
          seen.get(row.nationalId),
        reason:
          "DUPLICATE_NATIONAL_ID_IN_INPUT",
      });
    } else {
      seen.set(
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
  console.log(" APPLY STUDENT NAME UPDATES");
  console.log("========================================");
  console.log(`Org: ${ORG_ID}`);
  console.log(`Input: ${INPUT_FILE}`);
  console.log(`Apply flag: ${APPLY_FLAG}`);
  console.log("");

  if (!APPLY_FLAG) {
    console.log({
      decision: "BLOCKED",
      reason:
        "APPLY_STUDENT_NAME_UPDATES_NOT_SET",
    });

    console.log("");
    console.log(
      'Set APPLY_STUDENT_NAME_UPDATES="1" before running.',
    );

    process.exitCode = 1;
    return;
  }

  const rows = await readInputRows();

  const conflicts = validateRows(rows);

  const prepared = [];

  if (conflicts.length === 0) {
    for (const row of rows) {
      const peopleSnapshot =
        await findPeopleByNationalId(
          row.nationalId,
        );

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
          reason:
            "MULTIPLE_PEOPLE_WITH_SAME_NATIONAL_ID",
        });

        continue;
      }

      const personDoc =
        peopleSnapshot.docs[0];

      const person = personDoc.data();

      const studentsSnapshot =
        await findStudentsByPersonId(
          personDoc.id,
        );

      prepared.push({
        row,
        personDoc,
        person,
        studentDocs:
          studentsSnapshot.docs,
      });
    }
  }

  if (conflicts.length > 0) {
    const report = {
      decision: "BLOCKED",
      generatedAt:
        new Date().toISOString(),

      conflicts,

      safety: {
        writes: 0,
        deletes: 0,
      },
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
      committedWrites: 0,
    });

    process.exitCode = 1;
    return;
  }

  const writes = [];
  const results = [];

  const updatedAt = Date.now();

  for (const item of prepared) {
    const {
      row,
      personDoc,
      person,
      studentDocs,
    } = item;

    const oldDisplayName =
      normalizeText(person.displayName);

    let personUpdated = false;
    let studentsUpdated = 0;

    if (
      oldDisplayName !==
      row.newDisplayName
    ) {
      writes.push({
        ref: personDoc.ref,
        data: {
          displayName:
            row.newDisplayName,
          updatedAt,
        },
      });

      personUpdated = true;
    }

    for (const studentDoc of studentDocs) {
      const student = studentDoc.data();

      /*
       * Only update student.displayName if
       * that field already exists.
       *
       * We do not introduce a new field into
       * student documents that do not currently
       * use displayName.
       */
      if (
        typeof student.displayName ===
          "string" &&
        normalizeText(
          student.displayName,
        ) !== row.newDisplayName
      ) {
        writes.push({
          ref: studentDoc.ref,
          data: {
            displayName:
              row.newDisplayName,
            updatedAt,
          },
        });

        studentsUpdated += 1;
      }
    }

    results.push({
      excelRow: row.excelRow,
      nationalId: row.nationalId,
      personId: personDoc.id,
      oldDisplayName,
      newDisplayName:
        row.newDisplayName,
      personUpdated,
      linkedStudents:
        studentDocs.length,
      studentsUpdated,
    });
  }

  /*
   * Commit in groups below Firestore's
   * 500-write batch limit.
   */
  const BATCH_SIZE = 400;

  let committedWrites = 0;

  for (
    let index = 0;
    index < writes.length;
    index += BATCH_SIZE
  ) {
    const chunk = writes.slice(
      index,
      index + BATCH_SIZE,
    );

    const batch = db.batch();

    for (const write of chunk) {
      batch.update(
        write.ref,
        write.data,
      );
    }

    await batch.commit();

    committedWrites += chunk.length;
  }

  const report = {
    decision: "APPLIED",

    generatedAt:
      new Date().toISOString(),

    orgId: ORG_ID,
    inputFile: INPUT_FILE,

    summary: {
      inputRows: rows.length,

      peopleUpdated:
        results.filter(
          (item) =>
            item.personUpdated,
        ).length,

      studentDocumentsUpdated:
        results.reduce(
          (total, item) =>
            total +
            item.studentsUpdated,
          0,
        ),

      committedWrites,
    },

    results,

    safety: {
      deletes: 0,
      applyFlagRequired: true,
    },
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
      oldName:
        item.oldDisplayName,
      newName:
        item.newDisplayName,
      personUpdated:
        item.personUpdated,
      studentsUpdated:
        item.studentsUpdated,
    })),
  );

  console.log("");
  console.log({
    decision: "APPLIED",
    ...report.summary,
  });

  console.log("");
  console.log(`Report: ${REPORT_FILE}`);
}

main().catch((error) => {
  console.error("");
  console.error("Apply failed:");
  console.error(error);
  process.exitCode = 1;
});