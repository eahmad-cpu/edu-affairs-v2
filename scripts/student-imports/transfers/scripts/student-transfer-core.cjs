const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const ExcelJS = require("exceljs");
const JSZip = require(require.resolve("jszip", {
  paths: [path.dirname(require.resolve("exceljs/package.json"))],
}));
const {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const WORKFLOW_ROOT = path.resolve(__dirname, "..");
const DEFAULT_INPUT_FILE = path.join(WORKFLOW_ROOT, "inputs", "student-transfer.xlsx");
const DEFAULT_SHEET_NAME = "students";
const EXPECTED_HEADERS = [
  "studentId",
  "nationalId",
  "targetSchoolId",
  "targetAcademicYearId",
  "targetClassId",
  "transferReason",
];
const APPLY_TOKEN = "APPLY_STUDENT_TRANSFER";
const SPREADSHEETML_NAMESPACE = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith("--")) continue;
    const [key, ...valueParts] = arg.slice(2).split("=");
    args[key] = valueParts.join("=");
  }
  return args;
}

function getConfig(args = parseArgs()) {
  return {
    args,
    orgId: (args.orgId || process.env.ORG_ID || "takween").trim(),
    inputFile: args.input
      ? path.resolve(process.cwd(), args.input)
      : DEFAULT_INPUT_FILE,
    sheetName: (args.sheet || DEFAULT_SHEET_NAME).trim(),
  };
}

function readCellText(cell) {
  const value = cell.value;
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (typeof value === "object") {
    if (typeof value.text === "string") return value.text.trim();
    if (value.result != null) return String(value.result).trim();
    if (Array.isArray(value.richText)) return value.richText.map((item) => item.text || "").join("").trim();
  }
  return String(value).trim();
}

function readString(data, key) {
  const value = data?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRow(row) {
  return {
    ...row,
    errors: Array.isArray(row?.errors) ? row.errors : [],
  };
}

function normalizePrefixedSpreadsheetXml(xml) {
  const namespaceDeclaration = new RegExp(`\\s+xmlns:x=(["'])${SPREADSHEETML_NAMESPACE}\\1`);
  if (!namespaceDeclaration.test(xml)) return xml;
  return xml
    .replace(namespaceDeclaration, ` xmlns="${SPREADSHEETML_NAMESPACE}"`)
    .replace(/<(\/?)x:/g, "<$1")
    .replace(/\\s+x:([A-Za-z_][A-Za-z0-9_.-]*)=/g, " $1=");
}

async function loadWorkbook(inputFile) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(inputFile);
    return workbook;
  } catch (originalError) {
    const zip = await JSZip.loadAsync(fs.readFileSync(inputFile));
    let normalized = false;
    for (const entry of Object.values(zip.files)) {
      if (entry.dir || !entry.name.endsWith(".xml")) continue;
      const xml = await entry.async("string");
      const normalizedXml = normalizePrefixedSpreadsheetXml(xml);
      if (normalizedXml === xml) continue;
      zip.file(entry.name, normalizedXml);
      normalized = true;
    }
    if (!normalized) throw originalError;
    await workbook.xlsx.load(await zip.generateAsync({ type: "nodebuffer" }));
    return workbook;
  }
}

async function readExcelRows(config) {
  if (!fs.existsSync(config.inputFile)) {
    throw new Error(`Excel file not found: ${config.inputFile}`);
  }
  const workbook = await loadWorkbook(config.inputFile);
  const worksheet = workbook.getWorksheet(config.sheetName);
  if (!worksheet) {
    return {
      worksheetName: config.sheetName,
      rows: [],
      headerErrors: [`Worksheet not found: "${config.sheetName}".`],
    };
  }

  const headerErrors = [];
  for (let index = 0; index < EXPECTED_HEADERS.length; index += 1) {
    const actual = readCellText(worksheet.getRow(1).getCell(index + 1));
    const expected = EXPECTED_HEADERS[index];
    if (actual !== expected) headerErrors.push(`Column ${index + 1}: expected "${expected}", found "${actual}".`);
  }
  for (let index = EXPECTED_HEADERS.length + 1; index <= worksheet.columnCount; index += 1) {
    const extraHeader = readCellText(worksheet.getRow(1).getCell(index));
    if (extraHeader) headerErrors.push(`Unexpected column ${index}: "${extraHeader}".`);
  }
  if (headerErrors.length > 0) return { worksheetName: worksheet.name, rows: [], headerErrors };

  const rows = [];
  const studentIdRows = new Map();
  const nationalIdRows = new Map();
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const spreadsheetRow = worksheet.getRow(rowNumber);
    const values = EXPECTED_HEADERS.map((_, index) => readCellText(spreadsheetRow.getCell(index + 1)));
    if (values.every((value) => !value)) continue;
    const [studentId, nationalId, targetSchoolId, targetAcademicYearId, targetClassId, transferReason] = values;
    const errors = [];
    if (!studentId) errors.push("studentId is required.");
    if (!nationalId) errors.push("nationalId is required for independent identity verification.");
    if (!targetSchoolId) errors.push("targetSchoolId is required.");
    if (!targetAcademicYearId) errors.push("targetAcademicYearId is required.");
    if (!targetClassId) errors.push("targetClassId is required.");
    if (!transferReason) errors.push("transferReason is required.");
    const row = normalizeRow({
      rowNumber,
      studentId,
      nationalId,
      targetSchoolId,
      targetAcademicYearId,
      targetClassId,
      transferReason,
      errors,
    });
    rows.push(row);
    if (studentId) {
      const matches = studentIdRows.get(studentId) || [];
      matches.push(row);
      studentIdRows.set(studentId, matches);
    }
    if (nationalId) {
      const matches = nationalIdRows.get(nationalId) || [];
      matches.push(row);
      nationalIdRows.set(nationalId, matches);
    }
  }
  for (const [studentId, matches] of studentIdRows) {
    if (matches.length > 1) matches.forEach((row) => row.errors.push(`studentId "${studentId}" is duplicated in rows ${matches.map((item) => item.rowNumber).join(", ")}.`));
  }
  for (const [nationalId, matches] of nationalIdRows) {
    if (matches.length > 1) matches.forEach((row) => row.errors.push(`nationalId "${nationalId}" is duplicated in rows ${matches.map((item) => item.rowNumber).join(", ")}.`));
  }
  return { worksheetName: worksheet.name, rows, headerErrors: [] };
}

async function initializeFirebase(args) {
  if (getApps().length > 0) return;
  const serviceAccountPath = args.serviceAccount || process.env.GOOGLE_APPLICATION_CREDENTIALS || path.resolve(process.cwd(), "service-account.json");
  if (fs.existsSync(serviceAccountPath)) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    initializeApp({ credential: cert(require(path.resolve(serviceAccountPath))) });
    return;
  }
  initializeApp({ credential: applicationDefault() });
}

function enrollmentIdFor(row) {
  return `${row.targetAcademicYearId}*${row.targetSchoolId}*${row.targetClassId}_${row.studentId}`;
}

function enrollmentContextMatches(enrollment, row) {
  return readString(enrollment, "schoolId") === row.targetSchoolId
    && readString(enrollment, "academicYearId") === row.targetAcademicYearId
    && readString(enrollment, "classId") === row.targetClassId;
}

function baseResult(row) {
  return {
    rowNumber: row.rowNumber,
    studentId: row.studentId,
    nationalId: row.nationalId,
    targetSchoolId: row.targetSchoolId,
    targetAcademicYearId: row.targetAcademicYearId,
    targetClassId: row.targetClassId,
    transferReason: row.transferReason,
    action: "BLOCKED",
    personId: "",
    sourceEnrollmentId: "",
    sourceSchoolId: "",
    sourceAcademicYearId: "",
    sourceClassId: "",
    sourceStatus: "",
    destinationEnrollmentId: enrollmentIdFor(row),
    destinationStatus: "",
    activeEnrollmentCount: 0,
    conflicts: [...row.errors],
    followUp: [],
    internal: {},
  };
}

function validateSchoolData(data, orgId, schoolId, conflicts, label = "School") {
  if (!data) return;
  if (readString(data, "orgId") && readString(data, "orgId") !== orgId) conflicts.push(`${label} orgId does not match the selected org.`);
  if (readString(data, "id") && readString(data, "id") !== schoolId) conflicts.push(`${label} document id field does not match ${schoolId}.`);
  if (data.isArchived === true) conflicts.push(`${label} is archived.`);
}

function validateYearData(data, orgId, schoolId, academicYearId, conflicts) {
  if (!data) return;
  if (readString(data, "orgId") && readString(data, "orgId") !== orgId) conflicts.push("Academic year orgId does not match the selected org.");
  if (readString(data, "schoolId") && readString(data, "schoolId") !== schoolId) conflicts.push("Academic year schoolId does not match targetSchoolId.");
  if (readString(data, "id") && readString(data, "id") !== academicYearId) conflicts.push("Academic year document id field does not match targetAcademicYearId.");
  if (data.isActive === false) conflicts.push("Academic year is inactive.");
}

function validateClassData(data, orgId, row, conflicts) {
  if (!data) return;
  if (readString(data, "orgId") && readString(data, "orgId") !== orgId) conflicts.push("Class orgId does not match the selected org.");
  if (readString(data, "schoolId") && readString(data, "schoolId") !== row.targetSchoolId) conflicts.push("Class schoolId does not match targetSchoolId.");
  if (readString(data, "academicYearId") && readString(data, "academicYearId") !== row.targetAcademicYearId) conflicts.push("Class academicYearId does not match targetAcademicYearId.");
  if (readString(data, "id") && readString(data, "id") !== row.targetClassId) conflicts.push("Class document id field does not match targetClassId.");
  if (data.isArchived === true || data.isActive === false || (readString(data, "status") && readString(data, "status") !== "ACTIVE")) conflicts.push("Class is not active.");
}

function validateGradeData(data, orgId, row, gradeId, conflicts) {
  if (!data) return;
  if (readString(data, "orgId") && readString(data, "orgId") !== orgId) conflicts.push("Destination grade orgId does not match the selected org.");
  if (readString(data, "schoolId") && readString(data, "schoolId") !== row.targetSchoolId) conflicts.push("Destination grade schoolId does not match targetSchoolId.");
  if (readString(data, "academicYearId") && readString(data, "academicYearId") !== row.targetAcademicYearId) conflicts.push("Destination grade academicYearId does not match targetAcademicYearId.");
  if (readString(data, "id") && readString(data, "id") !== gradeId) conflicts.push("Destination grade document id field does not match class gradeId.");
  if (data.isArchived === true) conflicts.push("Destination grade is archived.");
}

function validateStreamData(data, orgId, row, streamId, conflicts) {
  if (!data) return;
  if (readString(data, "orgId") && readString(data, "orgId") !== orgId) conflicts.push("Destination stream orgId does not match the selected org.");
  if (readString(data, "schoolId") && readString(data, "schoolId") !== row.targetSchoolId) conflicts.push("Destination stream schoolId does not match targetSchoolId.");
  if (readString(data, "academicYearId") && readString(data, "academicYearId") !== row.targetAcademicYearId) conflicts.push("Destination stream academicYearId does not match targetAcademicYearId.");
  if (readString(data, "id") && readString(data, "id") !== streamId) conflicts.push("Destination stream document id field does not match class streamId.");
  if (data.isArchived === true || data.isActive === false) conflicts.push("Destination stream is inactive or archived.");
}

function schoolType(data) {
  const value = readString(data?.profile, "schoolType");
  return value === "KG" || value === "PRIMARY" ? value : "";
}

function addFollowUpWarnings(result, source, destinationClass) {
  if (source && readString(source, "schoolId") !== result.targetSchoolId) {
    result.followUp.push("Cross-school transfer: review/update studentDirectory using the existing school student-directory backfill.");
    result.followUp.push("Cross-school transfer: review the separate student transport enrollment; it is not changed by this workflow.");
    result.followUp.push("Cross-school transfer: manually review active learning-loss plans, open student cases, and activity registrations; historical records are not rewritten.");
  }
  if (source && !enrollmentContextMatches(source, result)) {
    result.followUp.push("Review destination homework assignment coverage; existing homework submissions remain historical.");
  }
  if (typeof destinationClass?.capacity === "number") {
    result.followUp.push(`Destination class declares capacity ${destinationClass.capacity}; current repository logic has no authoritative transactional capacity enforcement, so capacity is not auto-enforced.`);
  }
}

function record(snapshot) {
  return { id: snapshot.id, path: snapshot.ref.path, data: snapshot.data() || {} };
}

function chooseMostRecentTransferred(enrollments, academicYearId) {
  return enrollments
    .filter((item) => readString(item.data, "academicYearId") === academicYearId && readString(item.data, "status") === "TRANSFERRED")
    .sort((left, right) => Number(right.data.endAt || 0) - Number(left.data.endAt || 0))[0] || null;
}

async function readDestinationContext(db, orgId, row) {
  const schoolRef = db.doc(`orgs/${orgId}/schools/${row.targetSchoolId}`);
  const yearRef = db.doc(`${schoolRef.path}/academicYears/${row.targetAcademicYearId}`);
  const classRef = db.doc(`${yearRef.path}/classes/${row.targetClassId}`);
  const [schoolSnapshot, yearSnapshot, classSnapshot] = await Promise.all([schoolRef.get(), yearRef.get(), classRef.get()]);
  return { schoolRef, yearRef, classRef, schoolSnapshot, yearSnapshot, classSnapshot };
}

async function validateDestinationContext(db, orgId, row, destination, conflicts) {
  const { schoolSnapshot, yearSnapshot, classSnapshot } = destination;
  if (!schoolSnapshot.exists) conflicts.push(`Destination school does not exist: ${destination.schoolRef.path}.`);
  if (!yearSnapshot.exists) conflicts.push(`Destination academic year does not exist: ${destination.yearRef.path}.`);
  if (!classSnapshot.exists) conflicts.push(`Destination class does not exist: ${destination.classRef.path}.`);
  if (schoolSnapshot.exists) validateSchoolData(schoolSnapshot.data() || {}, orgId, row.targetSchoolId, conflicts, "Destination school");
  if (yearSnapshot.exists) validateYearData(yearSnapshot.data() || {}, orgId, row.targetSchoolId, row.targetAcademicYearId, conflicts);
  if (classSnapshot.exists) validateClassData(classSnapshot.data() || {}, orgId, row, conflicts);
  if (conflicts.length > 0 || !classSnapshot.exists) return { gradeId: "", streamId: "", gradeSnapshot: null, streamSnapshot: null };

  const classData = classSnapshot.data() || {};
  const gradeId = readString(classData, "gradeId");
  const streamId = readString(classData, "streamId");
  const gradeRef = gradeId ? db.doc(`${destination.yearRef.path}/grades/${gradeId}`) : null;
  const streamRef = streamId ? db.doc(`${destination.yearRef.path}/streams/${streamId}`) : null;
  const [gradeSnapshot, streamSnapshot] = await Promise.all([
    gradeRef ? gradeRef.get() : Promise.resolve(null),
    streamRef ? streamRef.get() : Promise.resolve(null),
  ]);
  if (gradeRef && !gradeSnapshot.exists) conflicts.push(`Destination grade does not exist: ${gradeRef.path}.`);
  if (streamRef && !streamSnapshot.exists) conflicts.push(`Destination stream does not exist: ${streamRef.path}.`);
  if (gradeSnapshot?.exists) validateGradeData(gradeSnapshot.data() || {}, orgId, row, gradeId, conflicts);
  if (streamSnapshot?.exists) validateStreamData(streamSnapshot.data() || {}, orgId, row, streamId, conflicts);
  return { gradeId, streamId, gradeSnapshot, streamSnapshot };
}

async function resolveTransferRow({ db, orgId, row }) {
  const normalized = normalizeRow(row);
  const result = baseResult(normalized);
  if (result.conflicts.length > 0) return result;

  const studentRef = db.doc(`orgs/${orgId}/students/${normalized.studentId}`);
  const destinationPromise = readDestinationContext(db, orgId, normalized);
  const [studentSnapshot, destination] = await Promise.all([studentRef.get(), destinationPromise]);
  if (!studentSnapshot.exists) result.conflicts.push(`Student does not exist: ${studentRef.path}.`);
  const destinationData = await validateDestinationContext(db, orgId, normalized, destination, result.conflicts);
  if (!studentSnapshot.exists || result.conflicts.length > 0) return result;

  const studentData = studentSnapshot.data() || {};
  if (studentData.isArchived === true) result.conflicts.push(`Student ${normalized.studentId} is archived; transfer is not automatic.`);
  const personId = readString(studentData, "personId");
  if (!personId) result.conflicts.push(`Student ${normalized.studentId} has no linked personId.`);
  if (result.conflicts.length > 0) return result;
  const personRef = db.doc(`orgs/${orgId}/people/${personId}`);
  const [personSnapshot, enrollmentsSnapshot] = await Promise.all([
    personRef.get(),
    db.collection(`orgs/${orgId}/studentEnrollments`).where("studentId", "==", normalized.studentId).get(),
  ]);
  if (!personSnapshot.exists) result.conflicts.push(`Linked Person does not exist: ${personRef.path}.`);
  if (personSnapshot.exists && readString(personSnapshot.data() || {}, "nationalId") !== normalized.nationalId) result.conflicts.push("Input nationalId does not exactly match the Student's linked Person nationalId.");
  if (result.conflicts.length > 0) return result;
  result.personId = personId;

  const enrollments = enrollmentsSnapshot.docs.map(record);
  const activeSameYear = enrollments.filter((item) => readString(item.data, "academicYearId") === normalized.targetAcademicYearId && readString(item.data, "status") === "ACTIVE");
  result.activeEnrollmentCount = activeSameYear.length;
  if (activeSameYear.length > 1) {
    result.conflicts.push(`Student ${normalized.studentId} has multiple ACTIVE enrollments in academic year ${normalized.targetAcademicYearId}.`);
    return result;
  }
  const activeEnrollment = activeSameYear[0] || null;
  const transferredEnrollment = chooseMostRecentTransferred(enrollments, normalized.targetAcademicYearId);
  if (activeEnrollment && enrollmentContextMatches(activeEnrollment.data, normalized)) {
    result.action = "KEEP_EXISTING";
    result.destinationEnrollmentId = activeEnrollment.id;
    result.destinationStatus = "ACTIVE";
    if (transferredEnrollment) {
      result.sourceEnrollmentId = transferredEnrollment.id;
      result.sourceSchoolId = readString(transferredEnrollment.data, "schoolId");
      result.sourceAcademicYearId = readString(transferredEnrollment.data, "academicYearId");
      result.sourceClassId = readString(transferredEnrollment.data, "classId");
      result.sourceStatus = "TRANSFERRED";
    }
    result.followUp.push("No writes required: the student is already ACTIVE in the requested destination.");
    return result;
  }
  if (!activeEnrollment) {
    result.conflicts.push(`Student ${normalized.studentId} has no ACTIVE enrollment in academic year ${normalized.targetAcademicYearId}.`);
    return result;
  }
  result.sourceEnrollmentId = activeEnrollment.id;
  result.sourceSchoolId = readString(activeEnrollment.data, "schoolId");
  result.sourceAcademicYearId = readString(activeEnrollment.data, "academicYearId");
  result.sourceClassId = readString(activeEnrollment.data, "classId");
  result.sourceStatus = readString(activeEnrollment.data, "status");
  if (readString(activeEnrollment.data, "orgId") && readString(activeEnrollment.data, "orgId") !== orgId) {
    result.conflicts.push("Source enrollment orgId does not match the selected org.");
    return result;
  }
  if (result.sourceAcademicYearId !== normalized.targetAcademicYearId) {
    result.conflicts.push("Transfer is restricted to the same academic year.");
    return result;
  }

  const destinationEnrollmentId = enrollmentIdFor(normalized);
  result.destinationEnrollmentId = destinationEnrollmentId;
  const destinationEnrollmentSnapshot = await db.doc(`orgs/${orgId}/studentEnrollments/${destinationEnrollmentId}`).get();
  if (destinationEnrollmentSnapshot.exists) {
    result.conflicts.push(`Destination enrollment ${destinationEnrollmentId} already exists and is not the established active destination.`);
    return result;
  }

  if (result.sourceSchoolId !== normalized.targetSchoolId) {
    const sourceSchoolSnapshot = await db.doc(`orgs/${orgId}/schools/${result.sourceSchoolId}`).get();
    const sourceType = sourceSchoolSnapshot.exists ? schoolType(sourceSchoolSnapshot.data() || {}) : "";
    const targetType = schoolType(destination.schoolSnapshot.data() || {});
    if (!sourceSchoolSnapshot.exists) result.conflicts.push(`Source school does not exist: ${sourceSchoolSnapshot.ref.path}.`);
    else if (!sourceType || !targetType) result.conflicts.push("Cross-school transfer requires valid source and destination school types.");
    else if (sourceType !== targetType) result.conflicts.push(`Cross-school ${sourceType} to ${targetType} transfer is not supported.`);
  }
  if (result.conflicts.length > 0) return result;

  result.action = "TRANSFER";
  result.internal = {
    sourceEnrollment: activeEnrollment,
    destinationClassData: destination.classSnapshot.data() || {},
    gradeId: destinationData.gradeId,
    streamId: destinationData.streamId,
  };
  addFollowUpWarnings(result, activeEnrollment.data, destination.classSnapshot.data() || {});
  return result;
}

async function resolveRows({ config, rows }) {
  await initializeFirebase(config.args);
  const db = getFirestore();
  const results = [];
  for (const row of rows) results.push(await resolveTransferRow({ db, orgId: config.orgId, row }));
  return { db, results };
}

function readApplyReportEntries(reportPath) {
  if (!fs.existsSync(reportPath)) {
    return { entries: [], error: `Transfer report does not exist: ${reportPath}.` };
  }
  try {
    const entries = [];
    const lines = fs.readFileSync(reportPath, "utf8").split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (!line) continue;
      const value = JSON.parse(line);
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { entries: [], error: `Invalid JSONL object in transfer report ${reportPath} at line ${index + 1}.` };
      }
      entries.push({ data: value, reportPath, lineNumber: index + 1 });
    }
    return { entries, error: "" };
  } catch (error) {
    return {
      entries: [],
      error: `Could not read transfer report ${reportPath}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function loadApplyReportEntries(config) {
  const explicitPath = typeof config.args.report === "string" && config.args.report.trim()
    ? path.resolve(process.cwd(), config.args.report)
    : "";
  if (explicitPath) return readApplyReportEntries(explicitPath);

  const reportsDir = path.join(WORKFLOW_ROOT, "reports");
  if (!fs.existsSync(reportsDir)) return { entries: [], error: "" };
  try {
    const reportPaths = fs.readdirSync(reportsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /^student-transfer-apply-.*\.jsonl$/i.test(entry.name))
      .map((entry) => path.join(reportsDir, entry.name));
    const entries = [];
    for (const reportPath of reportPaths) {
      const parsed = readApplyReportEntries(reportPath);
      if (parsed.error) return parsed;
      entries.push(...parsed.entries);
    }
    return { entries, error: "" };
  } catch (error) {
    return {
      entries: [],
      error: `Could not enumerate transfer reports: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function selectMatchingApplyReport({ orgId, row, reportEntries }) {
  const expectedFingerprint = inputFingerprint(row);
  const expectedDestinationId = enrollmentIdFor(row);
  const fingerprintMatches = reportEntries.filter((entry) => (
    entry.data.orgId === orgId
    && entry.data.inputFingerprint === expectedFingerprint
  ));
  if (fingerprintMatches.length === 0) {
    return { entry: null, error: "Matching committed transfer report not found." };
  }

  const validMatches = [];
  for (const entry of fingerprintMatches) {
    const data = entry.data;
    const exactInputMatch = (
      data.result === "TRANSFERRED"
      && data.studentId === row.studentId
      && data.nationalId === row.nationalId
      && data.transferReason === row.transferReason
      && data.targetSchoolId === row.targetSchoolId
      && data.targetAcademicYearId === row.targetAcademicYearId
      && data.targetClassId === row.targetClassId
      && data.destinationEnrollmentId === expectedDestinationId
      && typeof data.sourceEnrollmentId === "string"
      && data.sourceEnrollmentId.trim()
      && data.sourceEnrollmentId !== expectedDestinationId
      && typeof data.personId === "string"
      && data.personId.trim()
    );
    if (!exactInputMatch) {
      return { entry: null, error: "Matching transfer report data does not match the current input." };
    }
    validMatches.push(entry);
  }
  if (validMatches.length !== 1) {
    return { entry: null, error: "Ambiguous committed transfer report: multiple matching report entries were found." };
  }
  return { entry: validMatches[0], error: "" };
}

async function verifyTransferRow({ db, orgId, row, reportEntries }) {
  const normalized = normalizeRow(row);
  const result = baseResult(normalized);
  if (result.conflicts.length > 0) return result;

  const reportMatch = selectMatchingApplyReport({ orgId, row: normalized, reportEntries });
  if (reportMatch.error) {
    result.conflicts.push(reportMatch.error);
    return result;
  }
  const report = reportMatch.entry.data;
  const sourceEnrollmentId = report.sourceEnrollmentId;
  const destinationEnrollmentId = report.destinationEnrollmentId;
  result.sourceEnrollmentId = sourceEnrollmentId;
  result.destinationEnrollmentId = destinationEnrollmentId;

  const studentRef = db.doc(`orgs/${orgId}/students/${normalized.studentId}`);
  const sourceEnrollmentRef = db.doc(`orgs/${orgId}/studentEnrollments/${sourceEnrollmentId}`);
  const destinationEnrollmentRef = db.doc(`orgs/${orgId}/studentEnrollments/${destinationEnrollmentId}`);
  const [studentSnapshot, sourceEnrollmentSnapshot, destinationEnrollmentSnapshot, enrollmentsSnapshot] = await Promise.all([
    studentRef.get(),
    sourceEnrollmentRef.get(),
    destinationEnrollmentRef.get(),
    db.collection(`orgs/${orgId}/studentEnrollments`).where("studentId", "==", normalized.studentId).get(),
  ]);
  if (!studentSnapshot.exists) result.conflicts.push(`Student does not exist: ${studentRef.path}.`);
  if (!sourceEnrollmentSnapshot.exists) result.conflicts.push(`Source enrollment does not exist: ${sourceEnrollmentRef.path}.`);
  if (!destinationEnrollmentSnapshot.exists) result.conflicts.push(`Destination enrollment does not exist: ${destinationEnrollmentRef.path}.`);
  if (!studentSnapshot.exists || !sourceEnrollmentSnapshot.exists || !destinationEnrollmentSnapshot.exists) return result;

  const studentData = studentSnapshot.data() || {};
  const personId = readString(studentData, "personId");
  result.personId = personId;
  if (studentData.isArchived === true) result.conflicts.push("Student is archived.");
  if (!personId) result.conflicts.push("Student has no linked personId.");
  if (personId && personId !== report.personId) result.conflicts.push("Committed transfer report personId does not match the current Student relationship.");
  if (personId) {
    const personSnapshot = await db.doc(`orgs/${orgId}/people/${personId}`).get();
    if (!personSnapshot.exists) result.conflicts.push(`Linked Person does not exist: ${personSnapshot.ref.path}.`);
    else if (readString(personSnapshot.data() || {}, "nationalId") !== normalized.nationalId) result.conflicts.push("Linked Person nationalId does not match input.");
  }

  const destinationData = destinationEnrollmentSnapshot.data() || {};
  result.destinationStatus = readString(destinationData, "status");
  if (readString(destinationData, "studentId") !== normalized.studentId) result.conflicts.push("Destination enrollment studentId does not match input.");
  if (!enrollmentContextMatches(destinationData, normalized)) result.conflicts.push("Destination enrollment school, academic year, or class does not match input.");
  if (result.destinationStatus !== "ACTIVE") result.conflicts.push("Destination enrollment is not ACTIVE.");

  const sourceData = sourceEnrollmentSnapshot.data() || {};
  result.sourceSchoolId = readString(sourceData, "schoolId");
  result.sourceAcademicYearId = readString(sourceData, "academicYearId");
  result.sourceClassId = readString(sourceData, "classId");
  result.sourceStatus = readString(sourceData, "status");
  if (readString(sourceData, "studentId") !== normalized.studentId) result.conflicts.push("Source enrollment studentId does not match input.");
  if (result.sourceAcademicYearId !== normalized.targetAcademicYearId) result.conflicts.push("Source enrollment academic year does not match input.");
  if (result.sourceStatus !== "TRANSFERRED") result.conflicts.push("Source enrollment is not TRANSFERRED.");
  if (!Number.isFinite(sourceData.endAt) || sourceData.endAt <= 0) result.conflicts.push("Transferred source enrollment has no valid endAt timestamp.");
  if (report.sourceSchoolId && report.sourceSchoolId !== result.sourceSchoolId) result.conflicts.push("Committed transfer report sourceSchoolId does not match the source enrollment.");
  if (report.sourceAcademicYearId && report.sourceAcademicYearId !== result.sourceAcademicYearId) result.conflicts.push("Committed transfer report sourceAcademicYearId does not match the source enrollment.");
  if (report.sourceClassId && report.sourceClassId !== result.sourceClassId) result.conflicts.push("Committed transfer report sourceClassId does not match the source enrollment.");

  const enrollments = enrollmentsSnapshot.docs.map(record);
  const activeSameYear = enrollments.filter((item) => readString(item.data, "academicYearId") === normalized.targetAcademicYearId && readString(item.data, "status") === "ACTIVE");
  result.activeEnrollmentCount = activeSameYear.length;
  if (activeSameYear.length !== 1 || activeSameYear[0].id !== destinationEnrollmentId) result.conflicts.push("There is not exactly one ACTIVE enrollment at the intended destination for this academic year.");

  if (result.conflicts.length === 0) result.action = "KEEP_EXISTING";
  return result;
}

async function verifyRows({ config, rows }) {
  const reports = loadApplyReportEntries(config);
  if (reports.error) {
    const results = rows.map((row) => {
      const result = baseResult(normalizeRow(row));
      result.conflicts.push(reports.error);
      return result;
    });
    return { db: null, results };
  }
  await initializeFirebase(config.args);
  const db = getFirestore();
  const results = [];
  for (const row of rows) {
    results.push(await verifyTransferRow({ db, orgId: config.orgId, row, reportEntries: reports.entries }));
  }
  return { db, results };
}

function enrollmentPayload({ enrollmentId, orgId, row, classData, now }) {
  const payload = {
    id: enrollmentId,
    orgId,
    schoolId: row.targetSchoolId,
    academicYearId: row.targetAcademicYearId,
    studentId: row.studentId,
    streamId: readString(classData, "streamId"),
    classId: row.targetClassId,
    status: "ACTIVE",
    startAt: now,
    createdAt: now,
    updatedAt: now,
  };
  const gradeId = readString(classData, "gradeId");
  if (gradeId) payload.gradeId = gradeId;
  return payload;
}

function transactionDestinationRefs(db, orgId, row) {
  const schoolRef = db.doc(`orgs/${orgId}/schools/${row.targetSchoolId}`);
  const yearRef = db.doc(`${schoolRef.path}/academicYears/${row.targetAcademicYearId}`);
  const classRef = db.doc(`${yearRef.path}/classes/${row.targetClassId}`);
  return { schoolRef, yearRef, classRef };
}

function applyValidationError(conflicts) {
  throw new Error(conflicts.join(" | "));
}

async function validateTransactionDestination({ transaction, db, orgId, row, refs, conflicts }) {
  const [schoolSnapshot, yearSnapshot, classSnapshot] = await Promise.all([
    transaction.get(refs.schoolRef),
    transaction.get(refs.yearRef),
    transaction.get(refs.classRef),
  ]);
  if (!schoolSnapshot.exists) conflicts.push(`Destination school no longer exists: ${refs.schoolRef.path}.`);
  if (!yearSnapshot.exists) conflicts.push(`Destination academic year no longer exists: ${refs.yearRef.path}.`);
  if (!classSnapshot.exists) conflicts.push(`Destination class no longer exists: ${refs.classRef.path}.`);
  if (schoolSnapshot.exists) validateSchoolData(schoolSnapshot.data() || {}, orgId, row.targetSchoolId, conflicts, "Destination school");
  if (yearSnapshot.exists) validateYearData(yearSnapshot.data() || {}, orgId, row.targetSchoolId, row.targetAcademicYearId, conflicts);
  if (classSnapshot.exists) validateClassData(classSnapshot.data() || {}, orgId, row, conflicts);
  if (conflicts.length > 0 || !classSnapshot.exists) return { schoolSnapshot, classSnapshot, gradeId: "", streamId: "" };
  const classData = classSnapshot.data() || {};
  const gradeId = readString(classData, "gradeId");
  const streamId = readString(classData, "streamId");
  const gradeRef = gradeId ? db.doc(`${refs.yearRef.path}/grades/${gradeId}`) : null;
  const streamRef = streamId ? db.doc(`${refs.yearRef.path}/streams/${streamId}`) : null;
  const [gradeSnapshot, streamSnapshot] = await Promise.all([
    gradeRef ? transaction.get(gradeRef) : Promise.resolve(null),
    streamRef ? transaction.get(streamRef) : Promise.resolve(null),
  ]);
  if (gradeRef && !gradeSnapshot.exists) conflicts.push(`Destination grade no longer exists: ${gradeRef.path}.`);
  if (streamRef && !streamSnapshot.exists) conflicts.push(`Destination stream no longer exists: ${streamRef.path}.`);
  if (gradeSnapshot?.exists) validateGradeData(gradeSnapshot.data() || {}, orgId, row, gradeId, conflicts);
  if (streamSnapshot?.exists) validateStreamData(streamSnapshot.data() || {}, orgId, row, streamId, conflicts);
  return { schoolSnapshot, classSnapshot, gradeId, streamId };
}

async function applyTransferResult({ db, orgId, result }) {
  if (result.action === "BLOCKED") return { rowNumber: result.rowNumber, action: "BLOCKED", detail: result.conflicts.join(" | ") };
  if (result.action === "KEEP_EXISTING") return { rowNumber: result.rowNumber, action: "KEEP_EXISTING", detail: "No writes required." };
  if (result.action !== "TRANSFER") return { rowNumber: result.rowNumber, action: "BLOCKED", detail: `Unsupported plan action: ${result.action}` };

  const row = normalizeRow(result);
  const sourceEnrollmentRef = db.doc(`orgs/${orgId}/studentEnrollments/${result.sourceEnrollmentId}`);
  const destinationEnrollmentId = enrollmentIdFor(row);
  const destinationEnrollmentRef = db.doc(`orgs/${orgId}/studentEnrollments/${destinationEnrollmentId}`);
  const studentRef = db.doc(`orgs/${orgId}/students/${row.studentId}`);
  const destinationRefs = transactionDestinationRefs(db, orgId, row);
  const transactionResult = await db.runTransaction(async (transaction) => {
    const [studentSnapshot, sourceEnrollmentSnapshot, destinationEnrollmentSnapshot, enrollmentsSnapshot] = await Promise.all([
      transaction.get(studentRef),
      transaction.get(sourceEnrollmentRef),
      transaction.get(destinationEnrollmentRef),
      transaction.get(db.collection(`orgs/${orgId}/studentEnrollments`).where("studentId", "==", row.studentId)),
    ]);
    const conflicts = [];
    if (!studentSnapshot.exists) conflicts.push(`Student no longer exists: ${studentRef.path}.`);
    if (!sourceEnrollmentSnapshot.exists) conflicts.push(`Source enrollment no longer exists: ${sourceEnrollmentRef.path}.`);
    if (destinationEnrollmentSnapshot.exists) conflicts.push("Destination enrollment changed after preview; rerun preview.");
    if (conflicts.length > 0) applyValidationError(conflicts);

    const studentData = studentSnapshot.data() || {};
    const personId = readString(studentData, "personId");
    if (studentData.isArchived === true) conflicts.push("Student became archived after preview.");
    if (!personId || personId !== result.personId) conflicts.push("Student personId changed after preview.");
    const personRef = db.doc(`orgs/${orgId}/people/${personId}`);
    const personSnapshot = await transaction.get(personRef);
    if (!personSnapshot.exists) conflicts.push(`Linked Person no longer exists: ${personRef.path}.`);
    else if (readString(personSnapshot.data() || {}, "nationalId") !== row.nationalId) conflicts.push("Linked Person nationalId changed or no longer matches input.");

    const sourceData = sourceEnrollmentSnapshot.data() || {};
    if (readString(sourceData, "studentId") !== row.studentId) conflicts.push("Source enrollment studentId changed after preview.");
    if (readString(sourceData, "orgId") && readString(sourceData, "orgId") !== orgId) conflicts.push("Source enrollment orgId does not match the selected org.");
    if (readString(sourceData, "status") !== "ACTIVE") conflicts.push("Source enrollment is no longer ACTIVE; rerun preview.");
    if (readString(sourceData, "academicYearId") !== row.targetAcademicYearId) conflicts.push("Source enrollment academic year no longer matches target academic year.");
    if (enrollmentContextMatches(sourceData, row)) conflicts.push("Source enrollment already matches destination; no transfer write is allowed.");

    const activeSameYear = enrollmentsSnapshot.docs.filter((snapshot) => readString(snapshot.data() || {}, "academicYearId") === row.targetAcademicYearId && readString(snapshot.data() || {}, "status") === "ACTIVE");
    if (activeSameYear.length !== 1 || activeSameYear[0].id !== sourceEnrollmentRef.id) conflicts.push("ACTIVE enrollment set changed after preview; rerun preview.");
    const destination = await validateTransactionDestination({ transaction, db, orgId, row, refs: destinationRefs, conflicts });

    if (readString(sourceData, "schoolId") !== row.targetSchoolId) {
      const sourceSchoolRef = db.doc(`orgs/${orgId}/schools/${readString(sourceData, "schoolId")}`);
      const sourceSchoolSnapshot = await transaction.get(sourceSchoolRef);
      const sourceType = sourceSchoolSnapshot.exists ? schoolType(sourceSchoolSnapshot.data() || {}) : "";
      const targetType = destination.schoolSnapshot?.exists ? schoolType(destination.schoolSnapshot.data() || {}) : "";
      if (!sourceSchoolSnapshot.exists) conflicts.push(`Source school no longer exists: ${sourceSchoolRef.path}.`);
      else if (!sourceType || !targetType || sourceType !== targetType) conflicts.push("Cross-school transfer school types are no longer compatible.");
    }
    if (conflicts.length > 0) applyValidationError(conflicts);

    const now = Date.now();
    transaction.update(sourceEnrollmentRef, { status: "TRANSFERRED", endAt: now, updatedAt: now });
    transaction.create(destinationEnrollmentRef, enrollmentPayload({ enrollmentId: destinationEnrollmentId, orgId, row, classData: destination.classSnapshot.data() || {}, now }));
    return { personId, committedAt: now };
  });
  return {
    rowNumber: result.rowNumber,
    action: "TRANSFERRED",
    personId: transactionResult.personId,
    studentId: row.studentId,
    sourceEnrollmentId: result.sourceEnrollmentId,
    destinationEnrollmentId,
    committedAt: transactionResult.committedAt,
  };
}

function inputFingerprint(row) {
  const stable = EXPECTED_HEADERS.map((key) => `${key}=${row[key] || ""}`).join("\n");
  return crypto.createHash("sha256").update(stable).digest("hex");
}

function createApplyReportWriter(config) {
  const reportsDir = path.join(WORKFLOW_ROOT, "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const filename = `student-transfer-apply-${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID()}.jsonl`;
  const reportPath = path.join(reportsDir, filename);
  const descriptor = fs.openSync(reportPath, "ax");
  fs.closeSync(descriptor);
  return {
    reportPath,
    append({ row, result }) {
      const entry = {
        orgId: config.orgId,
        executionTimestamp: new Date(result.committedAt).toISOString(),
        inputFilename: path.basename(config.inputFile),
        rowNumber: row.rowNumber,
        studentId: row.studentId,
        nationalId: row.nationalId,
        personId: result.personId,
        transferReason: row.transferReason,
        sourceEnrollmentId: result.sourceEnrollmentId,
        sourceSchoolId: row.sourceSchoolId,
        sourceAcademicYearId: row.sourceAcademicYearId,
        sourceClassId: row.sourceClassId,
        destinationEnrollmentId: result.destinationEnrollmentId,
        targetSchoolId: row.targetSchoolId,
        targetAcademicYearId: row.targetAcademicYearId,
        targetClassId: row.targetClassId,
        result: result.action,
        inputFingerprint: inputFingerprint(row),
      };
      fs.appendFileSync(reportPath, `${JSON.stringify(entry)}\n`, { encoding: "utf8", flag: "a" });
    },
  };
}

function printResults(title, results) {
  console.log(title);
  console.table(results.map((result) => ({
    row: result.rowNumber,
    action: result.action,
    studentId: result.studentId,
    nationalId: result.nationalId,
    personId: result.personId || "",
    sourceEnrollmentId: result.sourceEnrollmentId || "",
    sourceSchoolId: result.sourceSchoolId || "",
    sourceAcademicYearId: result.sourceAcademicYearId || "",
    sourceClassId: result.sourceClassId || "",
    sourceStatus: result.sourceStatus || "",
    destinationEnrollmentId: result.destinationEnrollmentId || "",
    destinationStatus: result.destinationStatus || "",
    targetSchoolId: result.targetSchoolId || "",
    targetAcademicYearId: result.targetAcademicYearId || "",
    targetClassId: result.targetClassId || "",
    activeEnrollmentCount: result.activeEnrollmentCount ?? "",
    conflicts: result.conflicts?.join(" | ") || "",
    followUp: result.followUp?.join(" | ") || "",
  })));
}

module.exports = {
  APPLY_TOKEN,
  DEFAULT_SHEET_NAME,
  EXPECTED_HEADERS,
  applyTransferResult,
  createApplyReportWriter,
  getConfig,
  initializeFirebase,
  inputFingerprint,
  loadApplyReportEntries,
  printResults,
  readExcelRows,
  resolveRows,
  selectMatchingApplyReport,
  verifyRows,
};
