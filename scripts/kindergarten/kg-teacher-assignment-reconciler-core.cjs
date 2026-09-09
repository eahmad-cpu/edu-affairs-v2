"use strict";

const admin = require("firebase-admin");
const ExcelJS = require("exceljs");
const fs = require("node:fs");
const path = require("node:path");

const ORG_ID = process.env.KG_ORG_ID || "takween";
const ACADEMIC_YEAR_ID = process.env.KG_ACADEMIC_YEAR_ID || "ay-1448";
const SOURCE = "KG_TEACHER_ASSIGNMENT_RECONCILER";
const VERSION = 1;
const MANAGED_BY = "KG_TEACHER_ASSIGNMENT_RECONCILER";
const HISTORICAL_MANAGED_BY = new Set([
  "TEACHER_PROVISIONING",
  MANAGED_BY,
]);
const HISTORICAL_SOURCES = new Set([
  "TEACHER_PROVISIONING_ENGINE",
  SOURCE,
]);

const INPUT_PATH = path.resolve(
  __dirname,
  "inputs",
  "kg-teacher-assignment-map.xlsx",
);

/*
 * Transfers are deliberately kept outside the assignment workbook.  A row moving
 * between schools is not enough evidence to change a teacher's school scope.
 */
const TRANSFER_ACTIONS = [
  "TRANSFER_MEMBERSHIP_SCOPE",
  "END_OLD_TEACHER_ASSIGNMENT",
  "END_OLD_CLASS_LINK",
  "END_OLD_OPERATIONAL_ASSIGNMENT",
  "CREATE_NEW_TEACHER_ASSIGNMENT",
  "CREATE_NEW_CLASS_LINK",
  "CREATE_NEW_OPERATIONAL_ASSIGNMENT",
  "KEEP_HISTORY",
  "BLOCKED",
];

const DISTRIBUTION_HEADERS = [
  "schoolId",
  "schoolName",
  "assignmentRole",
  "gradeId",
  "classId",
  "teacherEmail",
  "personId",
  "teacherDisplayName",
];

const CLASS_TEACHER_ROLES = new Set([
  "معلمة الصف - المستوى الأول",
  "معلمة الصف - المستوى الثاني",
  "معلمة الصف - المستوى الثالث",
]);

const VALUES_ROLE = "معلمة القيم";
const CORNERS_ROLE = "معلمة الأركان";
const VALUES_SUBJECT_KEY = "VALUES";
const CORNERS_SUBJECT_KEY = "CORNERS";

const ALLOWED_ROLES = new Set([
  ...CLASS_TEACHER_ROLES,
  VALUES_ROLE,
  CORNERS_ROLE,
]);

const MODULE_OPERATION_MAP = new Map([
  ["ASSESSMENTS", "STUDENT_MEASUREMENT"],
  ["LEARNING_LOSS", "LEARNING_LOSS_FOLLOWUP"],
  ["HOMEWORK", "STUDENT_HOMEWORK"],
  ["LESSON_PREP", "LESSON_PREP"],
  ["GAMIFICATION", "STUDENT_GAMIFICATION"],
  ["VIRTUAL_CLASSES", "VIRTUAL_CLASS"],
  ["NOTES", "STUDENT_NOTES"],
]);

const ALLOWED_OPERATION_KINDS = new Set([
  "STUDENT_MEASUREMENT",
  "STUDENT_TRACKER",
  "LEARNING_LOSS_FOLLOWUP",
  "STUDENT_HOMEWORK",
  "LESSON_PREP",
  "STUDENT_NOTES",
  "STUDENT_GAMIFICATION",
  "STUDENT_CASE_REFERRAL",
  "VIRTUAL_CLASS",
]);

const OPERATION_TITLES = {
  STUDENT_MEASUREMENT: "قياسات الطلاب",
  STUDENT_TRACKER: "متابعة الطلاب",
  LEARNING_LOSS_FOLLOWUP: "متابعة الفاقد التعليمي",
  STUDENT_HOMEWORK: "واجبات الطلاب",
  LESSON_PREP: "تحضير الدروس",
  STUDENT_NOTES: "ملاحظات الطلاب",
  STUDENT_GAMIFICATION: "تحفيز الطلاب",
  VIRTUAL_CLASS: "الفصول الافتراضية",
};

function text(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value).trim();
  if (value && typeof value === "object" && typeof value.text === "string") {
    return value.text.trim();
  }
  return "";
}

function email(value) {
  return text(value).toLowerCase();
}

function active(data) {
  const status = text(data.status).toUpperCase();
  return data.isArchived !== true &&
    data.isActive !== false &&
    data.active !== false &&
    !["ARCHIVED", "ENDED", "INACTIVE", "DISABLED"].includes(status);
}

function activeOffering(data) {
  return text(data.status).toUpperCase() === "ACTIVE" &&
    data.isArchived !== true &&
    data.active !== false;
}

function dataOf(snapshot) {
  return { id: snapshot.id, path: snapshot.ref.path, ...(snapshot.data() || {}) };
}

function stableId(parts) {
  return parts
    .map((part) => text(part).replaceAll("/", "-").replace(/\s+/g, "-"))
    .filter(Boolean)
    .join("__");
}

function isManaged(data) {
  return HISTORICAL_MANAGED_BY.has(text(data.managedBy)) ||
    HISTORICAL_SOURCES.has(text(data.provisioningSource));
}

function scopeMatches(data, schoolId, termId) {
  return text(data.orgId) === ORG_ID &&
    text(data.schoolId) === schoolId &&
    text(data.academicYearId) === ACADEMIC_YEAR_ID &&
    text(data.termId) === termId;
}

function isKgId(value) {
  return /^kg(?:1|2|3)(?:-|$)/i.test(text(value));
}

function operationKey(personId, classId, offeringId, operationKind) {
  return [personId, classId, offeringId, operationKind].join("|");
}

function assignmentKey(personId, classId, offeringId, assignmentRole) {
  return [personId, classId, offeringId, assignmentRole].join("|");
}

function assignmentOfferingKey(personId, classId, offeringId) {
  return [personId, classId, offeringId].join("|");
}

function classKey(schoolId, classId) {
  return [schoolId, classId].join("|");
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map(text).filter(Boolean))).sort();
}

function sameStrings(left, right) {
  const normalizedLeft = uniqueStrings(Array.isArray(left) ? left : []);
  const normalizedRight = uniqueStrings(Array.isArray(right) ? right : []);
  return normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function isWriteAction(action) {
  return action === "CREATE" || action === "END" ||
    action === "TRANSFER_MEMBERSHIP_SCOPE" ||
    action.startsWith("CREATE_NEW_") ||
    action.startsWith("END_OLD_");
}

function isCreateAction(action) {
  return action === "CREATE" || action.startsWith("CREATE_NEW_");
}

function isEndAction(action) {
  return action === "END" || action.startsWith("END_OLD_");
}

function getInputPath() {
  const argument = process.argv.find((item) => item.startsWith("--input="));
  return argument ? path.resolve(process.cwd(), argument.slice("--input=".length)) : INPUT_PATH;
}

function getTransferInputPath() {
  const argument = process.argv.find((item) => item.startsWith("--transfer-input="));
  return argument
    ? path.resolve(process.cwd(), argument.slice("--transfer-input=".length))
    : "";
}

function readTransfers(transferInputPath) {
  if (!transferInputPath) return [];
  if (!fs.existsSync(transferInputPath)) {
    throw new Error(`Transfer input file not found: ${transferInputPath}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(transferInputPath, "utf8"));
  } catch (error) {
    throw new Error(`Transfer input is not valid JSON: ${error.message}`);
  }

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.transfers)) {
    throw new Error('Transfer input must be an object with a "transfers" array.');
  }

  return parsed.transfers.map((item, index) => ({
    inputIndex: index,
    personId: text(item?.personId),
    teacherEmail: email(item?.teacherEmail),
    transferFromSchoolId: text(item?.transferFromSchoolId),
    transferToSchoolId: text(item?.transferToSchoolId),
  }));
}

async function readDistribution(inputPath) {
  if (!fs.existsSync(inputPath)) throw new Error(`Input workbook not found: ${inputPath}`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(inputPath);
  const worksheet = workbook.getWorksheet("التوزيع");
  if (!worksheet) throw new Error('Worksheet "التوزيع" not found.');

  const headerMap = new Map();
  worksheet.getRow(1).eachCell((cell, columnNumber) => {
    const header = text(cell.value);
    if (header) headerMap.set(header, columnNumber);
  });
  const missingHeaders = DISTRIBUTION_HEADERS.filter((header) => !headerMap.has(header));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing distribution columns: ${missingHeaders.join(", ")}`);
  }

  const rows = [];
  for (let rowNumber = 2; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values = Object.fromEntries(
      DISTRIBUTION_HEADERS.map((header) => [header, text(row.getCell(headerMap.get(header)).value)]),
    );
    if (Object.values(values).every((value) => !value)) continue;

    const gradeIds = values.gradeId.split(",").map(text).filter(Boolean);
    const classIds = values.classId.split(",").map(text).filter(Boolean);
    rows.push({ rowNumber, ...values, gradeIds, classIds });
  }
  if (rows.length === 0) throw new Error("Worksheet التوزيع has no populated assignment rows.");
  return rows;
}

function initAdmin() {
  if (admin.apps.length > 0) return;
  const serviceAccountPath = path.resolve(
    process.env.SERVICE_ACCOUNT_PATH || path.join(process.cwd(), "service-account.json"),
  );
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Service account not found: ${serviceAccountPath}`);
  }
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

async function collection(db, collectionPath) {
  const snapshot = await db.collection(collectionPath).get();
  return snapshot.docs.map(dataOf);
}

async function resolveTeacher({ db, row, people, memberships, nestedMembershipCache }) {
  const rowPersonId = text(row.personId);
  const rowEmail = email(row.teacherEmail);
  const idMatches = rowPersonId ? people.filter((person) => person.id === rowPersonId) : [];
  const emailMatches = rowEmail
    ? people.filter((person) => email(person.email) === rowEmail)
    : [];

  let matches;
  if (rowPersonId && rowEmail) {
    matches = idMatches.filter((person) => email(person.email) === rowEmail);
  } else if (rowPersonId) {
    matches = idMatches;
  } else {
    matches = emailMatches;
  }

  if (matches.length !== 1) {
    throw new Error(`teacher identity is ${matches.length === 0 ? "not found" : "ambiguous"}`);
  }

  const person = matches[0];
  const canonicalEmail = email(person.email);
  if (rowEmail && canonicalEmail !== rowEmail) throw new Error("teacherEmail does not match canonical Person email");
  if (text(row.teacherDisplayName) && text(row.teacherDisplayName) !== text(person.displayName)) {
    throw new Error("teacherDisplayName does not match canonical Person displayName");
  }

  const scopedMemberships = memberships.filter((membership) => {
    const roleKey = text(membership.roleKey || membership.role);
    const schools = Array.isArray(membership.scopes?.schoolIds) ? membership.scopes.schoolIds.map(text) : [];
    return active(membership) &&
      roleKey === "KG_TEACHER" &&
      (text(membership.personId) === person.id || text(membership.uid) === text(person.uid)) &&
      (schools.includes(row.schoolId) || text(membership.scopeId) === row.schoolId || text(membership.schoolId) === row.schoolId);
  });

  if (scopedMemberships.length > 1) throw new Error("multiple active KG_TEACHER memberships match this school");
  if (scopedMemberships.length === 1) {
    return {
      personId: person.id,
      email: canonicalEmail,
      displayName: text(person.displayName),
      uid: text(scopedMemberships[0].uid),
      membershipPath: scopedMemberships[0].path,
    };
  }

  let authUser = null;
  if (canonicalEmail) {
    try {
      authUser = await admin.auth().getUserByEmail(canonicalEmail);
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }
  }
  if (!authUser) throw new Error("no active KG_TEACHER membership validates this school");

  const uid = authUser.uid;
  let nested = nestedMembershipCache.get(uid);
  if (!nested) {
    const snapshot = await db.doc(`users/${uid}/orgMemberships/${ORG_ID}`).get();
    nested = snapshot.exists ? dataOf(snapshot) : null;
    nestedMembershipCache.set(uid, nested);
  }
  const nestedSchools = Array.isArray(nested?.scopes?.schoolIds) ? nested.scopes.schoolIds.map(text) : [];
  if (!nested || !active(nested) || text(nested.personId) !== person.id ||
      text(nested.roleKey || nested.role) !== "KG_TEACHER" ||
      (!nestedSchools.includes(row.schoolId) && text(nested.scopeId) !== row.schoolId)) {
    throw new Error("no active KG_TEACHER membership validates this school");
  }
  return {
    personId: person.id,
    email: canonicalEmail,
    displayName: text(person.displayName),
    uid,
    membershipPath: nested.path,
  };
}

function isKgTeacherRole(data) {
  return text(data?.roleKey || data?.role) === "KG_TEACHER";
}

function membershipMatchesSchoolScope({ membership, uid, personId, schoolId }) {
  return Boolean(membership) &&
    active(membership) &&
    isKgTeacherRole(membership) &&
    text(membership.uid) === uid &&
    text(membership.personId) === personId &&
    text(membership.scopeType) === "SCHOOL" &&
    text(membership.scopeId) === schoolId &&
    sameStrings(membership.scopes?.schoolIds, [schoolId]);
}

function profileMatchesSchoolScope({ user, claims, uid, personId, schoolId }) {
  return text(user?.personId) === personId &&
    sameStrings(user?.schoolIds, [schoolId]) &&
    text(claims?.orgId) === ORG_ID &&
    text(claims?.personId) === personId &&
    text(claims?.role) === "teacher" &&
    text(claims?.roleKey) === "KG_TEACHER" &&
    sameStrings(claims?.schoolIds, [schoolId]) &&
    Boolean(uid);
}

function transferRowMatches(transfer, row) {
  const rowPersonId = text(row.personId);
  const rowEmail = email(row.teacherEmail);
  if (rowPersonId && rowPersonId !== transfer.teacher.personId) return false;
  if (rowEmail && rowEmail !== transfer.teacher.email) return false;
  return Boolean(rowPersonId || rowEmail);
}

function isKgTeacherAssignment(assignment, kgOfferingById) {
  return text(assignment.targetScopeType) === "CLASS" &&
    (isKgId(assignment.gradeId) || kgOfferingById.has(text(assignment.classSubjectOfferingId)));
}

function buildTransferredScopes(currentScopes, toSchoolId) {
  const scopes = currentScopes && typeof currentScopes === "object" ? currentScopes : {};
  return {
    ...scopes,
    schoolIds: [toSchoolId],
    gradeIds: [],
    classIds: [],
    subjectKeys: [],
    routeIds: Array.isArray(scopes.routeIds) ? scopes.routeIds.map(text).filter(Boolean) : [],
    canAccessAllSchools: false,
  };
}

function buildTransferMembershipWrites({ transfer, now }) {
  const { teacher, toSchoolId, current } = transfer;
  const newClaims = {
    ...current.claims,
    orgId: ORG_ID,
    personId: teacher.personId,
    role: "teacher",
    roleKey: "KG_TEACHER",
    schoolIds: [toSchoolId],
  };

  return {
    claims: {
      oldClaims: current.claims,
      newClaims,
    },
    writes: [
      {
        collection: "users",
        id: teacher.uid,
        path: `users/${teacher.uid}`,
        payload: {
          schoolIds: [toSchoolId],
          roleKey: "KG_TEACHER",
          updatedAt: now,
        },
      },
      {
        collection: "orgMemberships",
        id: ORG_ID,
        path: `users/${teacher.uid}/orgMemberships/${ORG_ID}`,
        payload: {
          role: "teacher",
          roleKey: "KG_TEACHER",
          scopeType: "SCHOOL",
          scopeId: toSchoolId,
          scopes: buildTransferredScopes(current.userMembership.scopes, toSchoolId),
          updatedAt: now,
        },
      },
      {
        collection: "memberships",
        id: teacher.uid,
        path: `orgs/${ORG_ID}/memberships/${teacher.uid}`,
        payload: {
          role: "teacher",
          roleKey: "KG_TEACHER",
          scopeType: "SCHOOL",
          scopeId: toSchoolId,
          scopes: buildTransferredScopes(current.orgMembership.scopes, toSchoolId),
          updatedAt: now,
        },
      },
    ],
  };
}

async function resolveTransfer({ db, request, state, now }) {
  const errors = [];
  const fromSchoolId = request.transferFromSchoolId;
  const toSchoolId = request.transferToSchoolId;

  if (!request.personId && !request.teacherEmail) {
    errors.push("transfer requires personId or teacherEmail");
  }
  if (!fromSchoolId || !toSchoolId) {
    errors.push("transferFromSchoolId and transferToSchoolId are required");
  }
  if (fromSchoolId === toSchoolId) {
    errors.push("transferFromSchoolId and transferToSchoolId must differ");
  }
  if (!/^kg-/i.test(fromSchoolId) || !/^kg-/i.test(toSchoolId)) {
    errors.push("transfer schools must be KG school IDs");
  }
  if (errors.length > 0) {
    return {
      id: `transfer-input-${request.inputIndex + 1}`,
      fromSchoolId,
      toSchoolId,
      status: "BLOCKED",
      blockers: errors,
      teacher: { uid: "", personId: request.personId, email: request.teacherEmail, displayName: "" },
      oldActiveCounts: { teacherAssignments: 0, teacherAssignmentClassLinks: 0, operationalAssignments: 0 },
      newDesiredCounts: { teacherAssignments: 0, teacherAssignmentClassLinks: 0, operationalAssignments: 0 },
    };
  }

  const idMatches = request.personId
    ? state.people.filter((person) => text(person.id) === request.personId)
    : [];
  const emailMatches = request.teacherEmail
    ? state.people.filter((person) => email(person.email) === request.teacherEmail)
    : [];
  const matches = request.personId && request.teacherEmail
    ? idMatches.filter((person) => email(person.email) === request.teacherEmail)
    : request.personId ? idMatches : emailMatches;

  if (matches.length !== 1) {
    errors.push(`teacher identity is ${matches.length === 0 ? "not found" : "ambiguous"}`);
  }
  const person = matches[0];
  const canonicalEmail = person ? email(person.email) : request.teacherEmail;

  let authUser = null;
  if (canonicalEmail) {
    try {
      authUser = await admin.auth().getUserByEmail(canonicalEmail);
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }
  }
  if (!authUser) errors.push("Firebase Auth user is not found");

  const uid = authUser?.uid || "";
  const [destinationSchoolSnap, userSnap, usersByEmailSnap, userMembershipSnap, orgMembershipSnap] = uid
    ? await Promise.all([
      db.doc(`orgs/${ORG_ID}/schools/${toSchoolId}`).get(),
      db.doc(`users/${uid}`).get(),
      db.collection("users").where("email", "==", canonicalEmail).limit(2).get(),
      db.doc(`users/${uid}/orgMemberships/${ORG_ID}`).get(),
      db.doc(`orgs/${ORG_ID}/memberships/${uid}`).get(),
    ])
    : [null, null, null, null, null];

  if (!destinationSchoolSnap?.exists) errors.push(`destination school does not exist: ${toSchoolId}`);
  if (!userSnap?.exists) errors.push("users document is not found for the Auth uid");
  if (usersByEmailSnap && usersByEmailSnap.size !== 1) errors.push("users email identity is missing or ambiguous");
  if (usersByEmailSnap?.docs[0] && usersByEmailSnap.docs[0].id !== uid) {
    errors.push("Firebase Auth uid does not match the users email identity");
  }
  if (!userMembershipSnap?.exists || !orgMembershipSnap?.exists) {
    errors.push("both membership mirrors are required for a transfer");
  }

  const user = userSnap?.data() || {};
  const userMembership = userMembershipSnap?.data() || {};
  const orgMembership = orgMembershipSnap?.data() || {};
  const claims = authUser?.customClaims || {};
  const personId = text(person?.id);
  const teacher = {
    uid,
    personId,
    email: canonicalEmail,
    displayName: text(person?.displayName),
  };

  const activeLegacyMemberships = state.memberships.filter((membership) =>
    active(membership) && isKgTeacherRole(membership) &&
    text(membership.personId) === personId && text(membership.uid) === uid,
  );
  if (activeLegacyMemberships.length !== 1 ||
      activeLegacyMemberships[0]?.path !== `orgs/${ORG_ID}/memberships/${uid}`) {
    errors.push("active KG_TEACHER organization membership is ambiguous or does not match the Auth uid");
  }

  const sourceMembershipMatches = membershipMatchesSchoolScope({
    membership: userMembership, uid, personId, schoolId: fromSchoolId,
  }) && membershipMatchesSchoolScope({
    membership: orgMembership, uid, personId, schoolId: fromSchoolId,
  }) && profileMatchesSchoolScope({ user, claims, uid, personId, schoolId: fromSchoolId });
  const destinationMembershipMatches = membershipMatchesSchoolScope({
    membership: userMembership, uid, personId, schoolId: toSchoolId,
  }) && membershipMatchesSchoolScope({
    membership: orgMembership, uid, personId, schoolId: toSchoolId,
  }) && profileMatchesSchoolScope({ user, claims, uid, personId, schoolId: toSchoolId });

  let status = "BLOCKED";
  if (sourceMembershipMatches) status = "PENDING";
  else if (destinationMembershipMatches) status = "COMPLETED";
  else errors.push("membership, users.schoolIds, and Auth claims must all point exclusively to the transfer source or destination school");

  const kgOfferingById = new Map(
    state.offerings.filter((offering) => isKgId(offering.gradeId)).map((offering) => [text(offering.id), offering]),
  );
  const activeTeacherAssignments = state.assignments.filter((assignment) =>
    active(assignment) && text(assignment.orgId) === ORG_ID && text(assignment.teacherPersonId) === personId,
  );
  const activeSourceAssignments = activeTeacherAssignments.filter((assignment) => text(assignment.schoolId) === fromSchoolId);
  const activeKgSourceAssignments = activeSourceAssignments.filter((assignment) => isKgTeacherAssignment(assignment, kgOfferingById));
  const unrelatedActiveSourceAssignments = activeSourceAssignments.filter((assignment) => !isKgTeacherAssignment(assignment, kgOfferingById));
  const activeOutsideExpectedSchool = activeTeacherAssignments.filter((assignment) => {
    if (!isKgTeacherAssignment(assignment, kgOfferingById)) return false;
    const expectedSchoolId = status === "COMPLETED" ? toSchoolId : fromSchoolId;
    return text(assignment.schoolId) !== expectedSchoolId;
  });

  if (unrelatedActiveSourceAssignments.length > 0) {
    errors.push("active non-KG teacher assignments in the source school make this transfer unsafe");
  }
  if (activeOutsideExpectedSchool.length > 0) {
    errors.push("active KG teacher assignments exist outside the single allowed transfer school scope");
  }
  if (status === "PENDING" && activeKgSourceAssignments.length === 0) {
    errors.push("no active KG teacher assignments exist in the transfer source school");
  }

  const transfer = {
    id: stableId(["kg-teacher-transfer", personId || request.personId || request.teacherEmail, fromSchoolId, toSchoolId]),
    request,
    fromSchoolId,
    toSchoolId,
    status: errors.length > 0 ? "BLOCKED" : status,
    blockers: errors,
    teacher,
    current: { user, userMembership, orgMembership, claims },
    sourceAssignments: state.assignments.filter((assignment) =>
      text(assignment.orgId) === ORG_ID && text(assignment.teacherPersonId) === personId &&
      text(assignment.schoolId) === fromSchoolId && isKgTeacherAssignment(assignment, kgOfferingById),
    ),
    oldActiveAssignments: activeKgSourceAssignments,
    kgOfferingById,
    oldActiveCounts: { teacherAssignments: activeKgSourceAssignments.length, teacherAssignmentClassLinks: 0, operationalAssignments: 0 },
    newDesiredCounts: { teacherAssignments: 0, teacherAssignmentClassLinks: 0, operationalAssignments: 0 },
    membershipWrites: null,
  };
  if (transfer.status === "PENDING") {
    transfer.membershipWrites = buildTransferMembershipWrites({ transfer, now });
  }
  return transfer;
}

function expectedOperationKinds(offering) {
  const candidates = new Set();
  for (const moduleKey of Array.isArray(offering.enabledModuleKeys) ? offering.enabledModuleKeys : []) {
    const operationKind = MODULE_OPERATION_MAP.get(text(moduleKey));
    if (operationKind) candidates.add(operationKind);
  }
  if (Array.isArray(offering.enabledModuleKeys) &&
      offering.enabledModuleKeys.includes("ASSESSMENTS") &&
      offering.assessmentPolicy?.trackerTemplateIds?.length > 0) {
    candidates.add("STUDENT_TRACKER");
  }
  if (offering.assessmentPolicy?.allowLearningLoss !== true) candidates.delete("LEARNING_LOSS_FOLLOWUP");
  if (offering.curriculumPolicy?.homeworkEnabled !== true) candidates.delete("STUDENT_HOMEWORK");
  return Array.from(candidates).filter((kind) => ALLOWED_OPERATION_KINDS.has(kind));
}

function selectOfferingsForRole({ row, target, matches, blockers }) {
  const subjectKey = (offering) => text(offering.subjectKey).toUpperCase();
  let selected;
  if (CLASS_TEACHER_ROLES.has(row.assignmentRole)) {
    selected = matches.filter((offering) => {
      const key = subjectKey(offering);
      return key !== VALUES_SUBJECT_KEY && key !== CORNERS_SUBJECT_KEY;
    });
  } else if (row.assignmentRole === VALUES_ROLE) {
    selected = matches.filter((offering) => subjectKey(offering) === VALUES_SUBJECT_KEY);
  } else if (row.assignmentRole === CORNERS_ROLE) {
    selected = matches.filter((offering) => subjectKey(offering) === CORNERS_SUBJECT_KEY);
  } else {
    blockers.push(`row ${row.rowNumber}: unknown assignmentRole`);
    return [];
  }

  if (selected.length === 0) {
    const expected = row.assignmentRole === VALUES_ROLE
      ? VALUES_SUBJECT_KEY
      : row.assignmentRole === CORNERS_ROLE
        ? CORNERS_SUBJECT_KEY
        : "non-VALUES/non-CORNERS";
    blockers.push(`row ${row.rowNumber}: required active offering is missing for ${target.schoolId}/${target.classId}/${expected}`);
    return [];
  }

  const bySubject = new Map();
  for (const offering of selected) {
    const key = subjectKey(offering);
    const offerings = bySubject.get(key) || [];
    offerings.push(offering);
    bySubject.set(key, offerings);
  }
  for (const [key, offerings] of bySubject) {
    if (offerings.length > 1) {
      blockers.push(`row ${row.rowNumber}: multiple active offerings for ${target.schoolId}/${target.classId}/${key}`);
    }
  }
  return Array.from(bySubject.values()).map((offerings) => offerings[0]);
}

function assignmentPayload({ id, teacher, schoolId, termId, classTarget, offering, now, role }) {
  return {
    id,
    orgId: ORG_ID,
    schoolId,
    academicYearId: ACADEMIC_YEAR_ID,
    termId,
    teacherPersonId: teacher.personId,
    supervisorPersonId: "",
    assignmentKind: "SUBJECT_TEACHER",
    targetScopeType: "CLASS",
    targetScopeId: classTarget.classId,
    coverageMode: "EXPLICIT_CLASSES",
    subjectKey: text(offering.subjectKey),
    subjectId: text(offering.subjectId),
    classSubjectOfferingId: offering.id,
    gradeId: classTarget.gradeId,
    streamId: text(offering.streamId),
    isHomeroom: false,
    roleInAssignment: "MAIN",
    status: "ACTIVE",
    startAt: now,
    note: `KG bulk assignment role: ${role}`,
    provisioningSource: SOURCE,
    provisioningVersion: VERSION,
    managedBy: MANAGED_BY,
  };
}

function linkPayload({ id, assignmentId, schoolId, termId, classTarget, offering }) {
  return {
    id,
    assignmentId,
    orgId: ORG_ID,
    schoolId,
    academicYearId: ACADEMIC_YEAR_ID,
    termId,
    classId: classTarget.classId,
    gradeId: classTarget.gradeId,
    streamId: text(offering.streamId),
    classSubjectOfferingId: offering.id,
    order: 0,
    isPrimaryClass: true,
    provisioningSource: SOURCE,
    provisioningVersion: VERSION,
    managedBy: MANAGED_BY,
  };
}

function operationPayload({ id, teacher, schoolId, termId, classTarget, offering, assignmentId, operationKind, now }) {
  return {
    id,
    orgId: ORG_ID,
    schoolId,
    academicYearId: ACADEMIC_YEAR_ID,
    termId,
    gradeId: classTarget.gradeId,
    classId: classTarget.classId,
    subjectKey: text(offering.subjectKey),
    classSubjectOfferingId: offering.id,
    title: OPERATION_TITLES[operationKind] || operationKind,
    description: "KG bulk operational assignment linked to a class subject offering",
    status: "ACTIVE",
    isActive: true,
    startAt: now,
    actorPersonId: teacher.personId,
    actorMembershipId: "",
    actorRoleKey: "KG_TEACHER",
    operationKind,
    scopeType: "CLASS",
    scopeId: classTarget.classId,
    scopeLabel: offering.id,
    coverageMode: "SINGLE_SCOPE",
    targetKind: "CLASS",
    targetPersonIds: [],
    targetStudentIds: [],
    targetClassIds: [classTarget.classId],
    targetGradeIds: [classTarget.gradeId],
    targetRouteIds: [],
    targetRoleKeys: [],
    permissions: ["VIEW", "CREATE", "UPDATE_DRAFT", "SUBMIT"],
    sourceTeacherAssignmentId: assignmentId,
    sourceMembershipId: "",
    note: "Created by KG teacher assignment reconciler",
    provisioningSource: SOURCE,
    provisioningVersion: VERSION,
    managedBy: MANAGED_BY,
  };
}

function endedPayload(now) {
  return {
    status: "ENDED",
    isActive: false,
    endAt: now,
    updatedAt: now,
    endedByProvisioningSource: SOURCE,
  };
}

function transferEndedPayload(now) {
  return {
    ...endedPayload(now),
    active: false,
    endedAt: now,
  };
}

function pushAction(actions, collectionName, document, action, reason = "", transfer = null) {
  actions.push({
    collection: collectionName,
    id: document.id,
    path: document.path || `orgs/${ORG_ID}/${collectionName}/${document.id}`,
    action,
    ...(reason ? { reason } : {}),
    ...(transfer ? {
      transferId: transfer.id,
      teacherEmail: transfer.teacher.email,
      personId: transfer.teacher.personId,
      fromSchoolId: transfer.fromSchoolId,
      toSchoolId: transfer.toSchoolId,
    } : {}),
    payload: document.payload,
  });
}

function addEndAction(actions, collectionName, item, now, reason) {
  pushAction(actions, collectionName, {
    id: item.id,
    path: item.path,
    payload: endedPayload(now),
  }, "END", reason);
}

function expectedAssignmentMatches(existing, expected) {
  return active(existing) &&
    text(existing.orgId) === ORG_ID &&
    text(existing.schoolId) === expected.schoolId &&
    text(existing.academicYearId) === ACADEMIC_YEAR_ID &&
    text(existing.termId) === expected.termId &&
    text(existing.teacherPersonId) === expected.teacherPersonId &&
    text(existing.assignmentKind) === "SUBJECT_TEACHER" &&
    text(existing.targetScopeType) === "CLASS" &&
    text(existing.targetScopeId) === expected.targetScopeId &&
    text(existing.subjectKey) === expected.subjectKey &&
    text(existing.classSubjectOfferingId) === expected.classSubjectOfferingId &&
    text(existing.gradeId) === expected.gradeId &&
    existing.isHomeroom !== true;
}

function expectedLinkMatches(existing, expected) {
  return active(existing) &&
    text(existing.assignmentId || existing.teacherAssignmentId) === expected.assignmentId &&
    text(existing.orgId) === ORG_ID &&
    text(existing.schoolId) === expected.schoolId &&
    text(existing.academicYearId) === ACADEMIC_YEAR_ID &&
    text(existing.termId) === expected.termId &&
    text(existing.classId) === expected.classId &&
    text(existing.gradeId) === expected.gradeId &&
    text(existing.classSubjectOfferingId) === expected.classSubjectOfferingId;
}

function expectedOperationMatches(existing, expected) {
  return active(existing) &&
    text(existing.orgId) === ORG_ID &&
    text(existing.schoolId) === expected.schoolId &&
    text(existing.academicYearId) === ACADEMIC_YEAR_ID &&
    text(existing.termId) === expected.termId &&
    text(existing.actorPersonId) === expected.actorPersonId &&
    text(existing.classId) === expected.classId &&
    text(existing.subjectKey) === expected.subjectKey &&
    text(existing.classSubjectOfferingId) === expected.classSubjectOfferingId &&
    text(existing.operationKind) === expected.operationKind &&
    text(existing.scopeType) === "CLASS" &&
    text(existing.scopeId || existing.classId) === expected.classId &&
    (!text(existing.sourceTeacherAssignmentId) || text(existing.sourceTeacherAssignmentId) === expected.sourceTeacherAssignmentId);
}

function findById(documents, id) {
  return documents.find((item) => item.id === id) || null;
}

async function loadState(db, rows) {
  const requestedClasses = new Map();
  for (const row of rows) {
    for (let index = 0; index < Math.max(row.gradeIds.length, row.classIds.length); index += 1) {
      const gradeId = row.gradeIds.length === 1 ? row.gradeIds[0] : row.gradeIds[index];
      const classId = row.classIds[index];
      if (gradeId && classId) requestedClasses.set(classKey(row.schoolId, classId), { schoolId: row.schoolId, classId, gradeId });
    }
  }

  const classRefs = Array.from(requestedClasses.values()).map((target) => db.doc(
    `orgs/${ORG_ID}/schools/${target.schoolId}/academicYears/${ACADEMIC_YEAR_ID}/classes/${target.classId}`,
  ));
  const [terms, people, memberships, offerings, assignments, links, operations, classSnapshots] = await Promise.all([
    collection(db, `orgs/${ORG_ID}/academicYears/${ACADEMIC_YEAR_ID}/terms`),
    collection(db, `orgs/${ORG_ID}/people`),
    collection(db, `orgs/${ORG_ID}/memberships`),
    collection(db, `orgs/${ORG_ID}/classSubjectOfferings`),
    collection(db, `orgs/${ORG_ID}/teacherAssignments`),
    collection(db, `orgs/${ORG_ID}/teacherAssignmentClassLinks`),
    collection(db, `orgs/${ORG_ID}/operationalAssignments`),
    classRefs.length > 0 ? db.getAll(...classRefs) : Promise.resolve([]),
  ]);

  return {
    terms,
    people,
    memberships,
    offerings,
    assignments,
    links,
    operations,
    classes: classSnapshots.map(dataOf),
    requestedClasses,
  };
}

function blockTransfer(transfer, message) {
  if (!transfer.blockers.includes(message)) transfer.blockers.push(message);
  transfer.status = "BLOCKED";
}

function transferActionName(transfer, regularAction, transferAction) {
  return transfer ? transferAction : regularAction;
}

function oldAssignmentKey(assignment) {
  return [
    text(assignment.classId || assignment.targetScopeId),
    text(assignment.classSubjectOfferingId),
  ].join("|");
}

function planTransferOldSchoolReconciliation({ state, transfer, actions, now }) {
  if (transfer.status === "BLOCKED") return;

  const allSourceAssignmentIds = new Set(transfer.sourceAssignments.map((assignment) => assignment.id));
  const sourceAssignmentKeys = new Set(transfer.sourceAssignments.map(oldAssignmentKey));
  const sourceLinks = state.links.filter((link) =>
    allSourceAssignmentIds.has(text(link.assignmentId || link.teacherAssignmentId)),
  );
  const activeSourceLinks = sourceLinks.filter(active);
  const allSourceOperations = state.operations.filter((operation) =>
    allSourceAssignmentIds.has(text(operation.sourceTeacherAssignmentId)) ||
    (text(operation.orgId) === ORG_ID &&
      text(operation.schoolId) === transfer.fromSchoolId &&
      text(operation.actorPersonId) === transfer.teacher.personId &&
      text(operation.scopeType) === "CLASS" &&
      sourceAssignmentKeys.has([
        text(operation.classId || operation.scopeId),
        text(operation.classSubjectOfferingId),
      ].join("|"))),
  );
  const activeSourceOperations = allSourceOperations.filter(active);
  const unrelatedActiveOperations = state.operations.filter((operation) =>
    active(operation) && text(operation.orgId) === ORG_ID &&
    text(operation.schoolId) === transfer.fromSchoolId &&
    text(operation.actorPersonId) === transfer.teacher.personId &&
    !allSourceOperations.some((candidate) => candidate.id === operation.id),
  );

  transfer.oldActiveCounts.teacherAssignments = transfer.oldActiveAssignments.length;
  transfer.oldActiveCounts.teacherAssignmentClassLinks = activeSourceLinks.length;
  transfer.oldActiveCounts.operationalAssignments = activeSourceOperations.length;
  transfer.historyCounts = {
    teacherAssignments: transfer.sourceAssignments.filter((assignment) => !active(assignment)).length,
    teacherAssignmentClassLinks: sourceLinks.filter((link) => !active(link)).length,
    operationalAssignments: allSourceOperations.filter((operation) => !active(operation)).length,
  };

  if (unrelatedActiveOperations.length > 0) {
    blockTransfer(transfer, "active source-school operational assignments are not traceable to the KG assignment graph");
    return;
  }

  if (transfer.status === "COMPLETED") {
    if (transfer.oldActiveCounts.teacherAssignments > 0 ||
        transfer.oldActiveCounts.teacherAssignmentClassLinks > 0 ||
        transfer.oldActiveCounts.operationalAssignments > 0) {
      blockTransfer(transfer, "completed transfer still has active source-school KG graph records");
      return;
    }
    for (const assignment of transfer.sourceAssignments) {
      pushAction(actions, "teacherAssignments", assignment, "KEEP_HISTORY", "historical source-school assignment is retained", transfer);
    }
    for (const link of sourceLinks) {
      pushAction(actions, "teacherAssignmentClassLinks", link, "KEEP_HISTORY", "historical source-school class link is retained", transfer);
    }
    for (const operation of allSourceOperations) {
      pushAction(actions, "operationalAssignments", operation, "KEEP_HISTORY", "historical source-school operational assignment is retained", transfer);
    }
    return;
  }

  pushAction(actions, "membershipScope", {
    id: transfer.teacher.uid,
    path: `users/${transfer.teacher.uid}/orgMemberships/${ORG_ID}`,
  }, "TRANSFER_MEMBERSHIP_SCOPE", `${transfer.fromSchoolId} -> ${transfer.toSchoolId}`, transfer);

  for (const assignment of transfer.oldActiveAssignments) {
    pushAction(actions, "teacherAssignments", {
      id: assignment.id,
      path: assignment.path,
      payload: transferEndedPayload(now),
    }, "END_OLD_TEACHER_ASSIGNMENT", "explicit KG teacher transfer", transfer);
  }
  for (const link of activeSourceLinks) {
    pushAction(actions, "teacherAssignmentClassLinks", {
      id: link.id,
      path: link.path,
      payload: transferEndedPayload(now),
    }, "END_OLD_CLASS_LINK", "dependent on an old-school KG teacher assignment", transfer);
  }
  for (const operation of activeSourceOperations) {
    pushAction(actions, "operationalAssignments", {
      id: operation.id,
      path: operation.path,
      payload: transferEndedPayload(now),
    }, "END_OLD_OPERATIONAL_ASSIGNMENT", "dependent on an old-school KG teacher assignment", transfer);
  }
}

function finalizeTransferPlans({ transfers, actions, blockers }) {
  for (const transfer of transfers) {
    const sourceAssignments = transfer.sourceAssignments || [];
    for (const blocker of transfer.blockers) {
      if (!blockers.includes(`transfer ${transfer.id}: ${blocker}`)) {
        blockers.push(`transfer ${transfer.id}: ${blocker}`);
      }
    }

    const transferActions = actions.filter((action) => action.transferId === transfer.id);
    const transferWrites = transferActions.filter((action) =>
      action.action !== "TRANSFER_MEMBERSHIP_SCOPE" && isWriteAction(action.action),
    );
    const membershipWriteCount = transfer.status === "PENDING" ? 3 : 0;
    transfer.firestoreWriteCount = transferWrites.length + membershipWriteCount;
    if (transfer.firestoreWriteCount > 450) {
      const writeLimitBlocker = `transfer requires ${transfer.firestoreWriteCount} Firestore writes; the single atomic transfer limit is 450`;
      blockTransfer(transfer, writeLimitBlocker);
      if (!blockers.includes(`transfer ${transfer.id}: ${writeLimitBlocker}`)) {
        blockers.push(`transfer ${transfer.id}: ${writeLimitBlocker}`);
      }
    }

    const destinationActions = transferActions.filter((action) =>
      action.action.startsWith("CREATE_NEW_") || action.action === "KEEP",
    );
    const destinationCreates = destinationActions.filter((action) => action.action.startsWith("CREATE_NEW_"));
    const destinationKeeps = destinationActions.filter((action) => action.action === "KEEP");
    const keptByCollection = (collectionName) => destinationKeeps.filter((action) => action.collection === collectionName).length;
    const createByCollection = (collectionName) => destinationCreates.filter((action) => action.collection === collectionName).length;

    transfer.verification = {
      sameUidAndPersonId: Boolean(transfer.teacher.uid && transfer.teacher.personId),
      membershipScopeOnlyDestination: transfer.status === "COMPLETED",
      usersSchoolIdsAndAuthClaimsMatch: transfer.status === "COMPLETED",
      zeroActiveOldTeacherAssignments: transfer.oldActiveCounts.teacherAssignments === 0,
      zeroActiveOldClassLinks: transfer.oldActiveCounts.teacherAssignmentClassLinks === 0,
      zeroActiveOldOperationalAssignments: transfer.oldActiveCounts.operationalAssignments === 0,
      destinationGraphComplete:
        transfer.status === "COMPLETED" &&
        createByCollection("teacherAssignments") === 0 &&
        createByCollection("teacherAssignmentClassLinks") === 0 &&
        createByCollection("operationalAssignments") === 0 &&
        keptByCollection("teacherAssignments") === transfer.newDesiredCounts.teacherAssignments &&
        keptByCollection("teacherAssignmentClassLinks") === transfer.newDesiredCounts.teacherAssignmentClassLinks &&
        keptByCollection("operationalAssignments") === transfer.newDesiredCounts.operationalAssignments,
      historicalOldSchoolRecordsRetained:
        transfer.historyCounts &&
        transfer.historyCounts.teacherAssignments > 0 &&
        sourceAssignments.every((assignment) => !active(assignment)),
    };
    transfer.verification.passed = transfer.status === "COMPLETED" &&
      Object.entries(transfer.verification)
        .filter(([key]) => key !== "passed")
        .every(([, value]) => value === true);
  }
}

function validateClass({ target, klass }) {
  if (!klass) throw new Error(`class not found: ${target.schoolId}/${target.classId}`);
  if (text(klass.orgId) !== ORG_ID || text(klass.schoolId) !== target.schoolId ||
      text(klass.academicYearId) !== ACADEMIC_YEAR_ID || text(klass.id) !== target.classId) {
    throw new Error("class relationship does not match the row scope");
  }
  if (text(klass.gradeId) !== target.gradeId || !isKgId(klass.gradeId) || klass.isArchived === true) {
    throw new Error("class grade/scope is not an active KG class");
  }
}

function buildPlanReport({ inputPath, transferInputPath, termId, rows, actions, blockers, teachers, offeringsByClass, transfers = [] }) {
  const cleanActions = actions.map(({ payload, ...action }) => action);
  const counts = cleanActions.reduce((result, action) => {
    result[action.action] = (result[action.action] || 0) + 1;
    return result;
  }, {});
  const writesByCollectionAction = cleanActions
    .filter((action) => isWriteAction(action.action))
    .reduce((result, action) => {
      const key = `${action.collection}:${action.action}`;
      result[key] = (result[key] || 0) + 1;
      return result;
    }, {});
  const transferReports = transfers.map((transfer) => {
    const groupedActions = Object.fromEntries(
      TRANSFER_ACTIONS.map((actionName) => [
        actionName,
        cleanActions.filter((action) => action.transferId === transfer.id && action.action === actionName),
      ]),
    );
    groupedActions.BLOCKED = transfer.blockers.map((reason) => ({
      action: "BLOCKED",
      teacherEmail: transfer.teacher.email,
      personId: transfer.teacher.personId,
      fromSchoolId: transfer.fromSchoolId,
      toSchoolId: transfer.toSchoolId,
      reason,
    }));
    return {
      id: transfer.id,
      status: transfer.status,
      teacher: transfer.teacher,
      fromSchoolId: transfer.fromSchoolId,
      toSchoolId: transfer.toSchoolId,
      oldActiveCounts: transfer.oldActiveCounts,
      historicalCounts: transfer.historyCounts || {
        teacherAssignments: 0,
        teacherAssignmentClassLinks: 0,
        operationalAssignments: 0,
      },
      newDesiredCounts: transfer.newDesiredCounts,
      firestoreWriteCount: transfer.firestoreWriteCount || 0,
      actionGroups: groupedActions,
      verification: transfer.verification,
    };
  });
  return {
    metadata: {
      mode: "DRY_RUN",
      orgId: ORG_ID,
      academicYearId: ACADEMIC_YEAR_ID,
      termId,
      inputPath,
      transferInputPath: transferInputPath || null,
      source: SOURCE,
      version: VERSION,
      offeringsModified: false,
      offeringModulesModified: false,
    },
    excelColumnsConsumed: [
      "schoolId",
      "assignmentRole",
      "gradeId",
      "classId",
      "teacherEmail",
      "personId",
      "teacherDisplayName",
    ],
    inputRows: rows.map((row) => ({
      rowNumber: row.rowNumber,
      schoolId: row.schoolId,
      assignmentRole: row.assignmentRole,
      gradeId: row.gradeId,
      classId: row.classId,
      teacherEmail: row.teacherEmail,
      personId: row.personId,
      teacherDisplayName: row.teacherDisplayName,
    })),
    resolvedTeachers: teachers,
    offeringsByClass,
    actions: cleanActions,
    transfers: transferReports,
    writesByCollectionAction,
    summary: {
      create: cleanActions.filter((action) => isCreateAction(action.action)).length,
      keep: counts.KEEP || 0,
      end: cleanActions.filter((action) => isEndAction(action.action)).length,
      transferMembershipScope: counts.TRANSFER_MEMBERSHIP_SCOPE || 0,
      blocked: blockers.length,
    },
    blockers: Array.from(new Set(blockers)),
    _writes: actions.filter((action) => isWriteAction(action.action) && !action.transferId),
    _transfers: transfers,
    _transferActions: actions.filter((action) => Boolean(action.transferId)),
  };
}

async function buildPlan({
  inputPath = getInputPath(),
  transferInputPath = getTransferInputPath(),
  now = Date.now(),
  offeringOverrides = [],
} = {}) {
  const rows = await readDistribution(inputPath);
  const transferRequests = readTransfers(transferInputPath);
  const db = admin.firestore();
  const state = await loadState(db, rows);
  const overridesById = new Map(
    offeringOverrides
      .filter((offering) => offering && text(offering.id))
      .map((offering) => [text(offering.id), offering]),
  );
  if (overridesById.size > 0) {
    const existingIds = new Set();
    state.offerings = state.offerings.map((offering) => {
      existingIds.add(text(offering.id));
      return overridesById.has(text(offering.id))
        ? { ...offering, ...overridesById.get(text(offering.id)) }
        : offering;
    });
    for (const [id, offering] of overridesById) {
      if (!existingIds.has(id)) state.offerings.push(offering);
    }
  }
  const blockers = [];
  const actions = [];
  const teachers = [];
  const offeringsByClass = [];
  const nestedMembershipCache = new Map();
  const transfers = [];
  const transferPersonIds = new Set();
  for (const request of transferRequests) {
    const transfer = await resolveTransfer({ db, request, state, now });
    if (transfer.teacher.personId) {
      if (transferPersonIds.has(transfer.teacher.personId)) {
        blockTransfer(transfer, "the same teacher appears in more than one explicit transfer request");
      }
      transferPersonIds.add(transfer.teacher.personId);
    }
    if (transfer.status !== "BLOCKED") {
      const relatedRows = rows.filter((row) => transferRowMatches(transfer, row));
      const destinationRows = relatedRows.filter((row) => row.schoolId === transfer.toSchoolId);
      const nonDestinationRows = relatedRows.filter((row) => row.schoolId !== transfer.toSchoolId);
      if (destinationRows.length === 0) {
        blockTransfer(transfer, "the KG assignment map has no destination rows for this explicit transfer");
      }
      if (nonDestinationRows.length > 0) {
        blockTransfer(transfer, "the KG assignment map still assigns this transfer teacher outside the destination school");
      }
      transfer.destinationRowNumbers = new Set(destinationRows.map((row) => row.rowNumber));
    }
    transfers.push(transfer);
  }
  const termCandidates = state.terms.filter((term) => text(term.status).toUpperCase() === "ACTIVE" || term.isCurrent === true);
  const termId = termCandidates.length === 1 ? text(termCandidates[0].id) : "";
  if (termCandidates.length !== 1) {
    blockers.push(`expected exactly one active/current term; found ${termCandidates.length}`);
  }

  const classTargets = new Map();
  for (const row of rows) {
    if (!row.schoolId || !/^kg-/i.test(row.schoolId)) blockers.push(`row ${row.rowNumber}: schoolId is not a KG school`);
    if (!ALLOWED_ROLES.has(row.assignmentRole)) blockers.push(`row ${row.rowNumber}: unknown assignmentRole`);
    if (row.gradeIds.length === 0 || row.classIds.length === 0 || row.gradeIds.length !== row.classIds.length && row.gradeIds.length !== 1) {
      blockers.push(`row ${row.rowNumber}: gradeId/classId lists do not resolve one-to-one`);
      continue;
    }
    for (let index = 0; index < row.classIds.length; index += 1) {
      const target = {
        schoolId: row.schoolId,
        gradeId: row.gradeIds.length === 1 ? row.gradeIds[0] : row.gradeIds[index],
        classId: row.classIds[index],
      };
      classTargets.set(classKey(target.schoolId, target.classId), target);
    }
  }

  for (const target of classTargets.values()) {
    const klass = state.classes.find((item) => item.id === target.classId && item.schoolId === target.schoolId);
    try {
      validateClass({ target, klass });
    } catch (error) {
      blockers.push(`${target.schoolId}/${target.classId}: ${error.message}`);
    }
  }

  const resolvedRows = [];
  const teacherClassRoles = new Map();
  for (const row of rows) {
    if (!row.schoolId || !row.assignmentRole || row.classIds.length === 0 || row.gradeIds.length === 0) continue;
    const matchingTransfers = transfers.filter((transfer) =>
      transferRowMatches(transfer, row),
    );
    if (matchingTransfers.length > 1) {
      blockers.push(`row ${row.rowNumber}: multiple explicit transfers match this teacher`);
      continue;
    }
    const transfer = matchingTransfers[0] || null;
    if (transfer?.status === "BLOCKED") {
      blockers.push(`row ${row.rowNumber}: explicit transfer is blocked: ${transfer.blockers.join("; ")}`);
      continue;
    }
    if (transfer && row.schoolId !== transfer.toSchoolId) {
      blockTransfer(transfer, "the KG assignment map contains a transfer-teacher row outside the destination school");
      blockers.push(`row ${row.rowNumber}: explicit transfer row is outside ${transfer.toSchoolId}`);
      continue;
    }
    let teacher;
    try {
      teacher = transfer
        ? transfer.teacher
        : await resolveTeacher({ db, row, people: state.people, memberships: state.memberships, nestedMembershipCache });
    } catch (error) {
      blockers.push(`row ${row.rowNumber}: ${error.message}`);
      continue;
    }
    teachers.push({ rowNumber: row.rowNumber, schoolId: row.schoolId, personId: teacher.personId, email: teacher.email, displayName: teacher.displayName, membershipPath: teacher.membershipPath });
    for (let index = 0; index < row.classIds.length; index += 1) {
      const target = {
        schoolId: row.schoolId,
        gradeId: row.gradeIds.length === 1 ? row.gradeIds[0] : row.gradeIds[index],
        classId: row.classIds[index],
      };
      const roleKey = `${teacher.personId}|${target.schoolId}|${target.classId}|${row.assignmentRole}`;
      if (teacherClassRoles.has(roleKey)) {
        blockers.push(`row ${row.rowNumber}: duplicate teacher/class assignment`);
      } else {
        teacherClassRoles.set(roleKey, true);
      }
      if (!state.requestedClasses.has(classKey(target.schoolId, target.classId))) continue;
      resolvedRows.push({ row, teacher, target, transfer });
    }
  }

  const desiredAssignmentKeys = new Set();
  const desiredAssignmentOfferingKeys = new Set();
  const desiredOperationKeys = new Set();
  const targetTeacherSchools = new Set();

  // Never create or end anything when the term is not uniquely resolved.
  if (!termId) {
    finalizeTransferPlans({ transfers, actions, blockers });
    return buildPlanReport({ inputPath, transferInputPath, termId, rows, actions, blockers, teachers, offeringsByClass, transfers });
  }

  for (const resolved of resolvedRows) {
    const { row, teacher, target, transfer } = resolved;
    const klass = state.classes.find((item) => item.id === target.classId && item.schoolId === target.schoolId);
    if (!klass || text(klass.gradeId) !== target.gradeId) continue;
    targetTeacherSchools.add(`${teacher.personId}|${target.schoolId}`);
    const matches = state.offerings.filter((offering) =>
      activeOffering(offering) &&
      text(offering.orgId) === ORG_ID &&
      text(offering.schoolId) === target.schoolId &&
      text(offering.academicYearId) === ACADEMIC_YEAR_ID &&
      text(offering.classId) === target.classId &&
      text(offering.gradeId) === target.gradeId &&
      Boolean(text(offering.subjectKey)),
    );
    if (matches.length === 0) {
      blockers.push(`row ${row.rowNumber}: no active offerings for ${target.schoolId}/${target.classId}`);
      continue;
    }
    const offerings = selectOfferingsForRole({ row, target, matches, blockers });
    if (offerings.length === 0) continue;
    offeringsByClass.push({ rowNumber: row.rowNumber, schoolId: target.schoolId, gradeId: target.gradeId, classId: target.classId, offeringIds: offerings.map((offering) => offering.id) });
    for (const offering of offerings) {
      const aKey = assignmentKey(teacher.personId, target.classId, offering.id, row.assignmentRole);
      if (desiredAssignmentKeys.has(aKey)) {
        blockers.push(`row ${row.rowNumber}: duplicate teacher/class/offering assignment`);
        continue;
      }
      desiredAssignmentKeys.add(aKey);
      desiredAssignmentOfferingKeys.add(assignmentOfferingKey(teacher.personId, target.classId, offering.id));
      const deterministicAssignmentId = stableId(["teacher-provisioning", teacher.personId, target.schoolId, ACADEMIC_YEAR_ID, termId, offering.id]);
      const existingOfferingAssignments = state.assignments.filter((assignment) =>
        active(assignment) && scopeMatches(assignment, target.schoolId, termId) &&
        text(assignment.teacherPersonId) === teacher.personId && text(assignment.classSubjectOfferingId) === offering.id,
      );
      if (existingOfferingAssignments.length > 1) {
        blockers.push(`row ${row.rowNumber}: multiple active teacher assignments for offering ${offering.id}`);
        continue;
      }
      const existingAssignment = existingOfferingAssignments[0] || null;
      const assignmentId = existingAssignment?.id || deterministicAssignmentId;
      const expectedAssignment = assignmentPayload({
        id: assignmentId,
        teacher,
        schoolId: target.schoolId,
        termId,
        classTarget: target,
        offering,
        now,
        role: row.assignmentRole,
      });
      if (transfer) transfer.newDesiredCounts.teacherAssignments += 1;
      if (existingAssignment) {
        if (!expectedAssignmentMatches(existingAssignment, expectedAssignment)) {
          blockers.push(`row ${row.rowNumber}: active assignment does not exactly match ${offering.id}`);
          continue;
        }
        pushAction(actions, "teacherAssignments", { id: existingAssignment.id, path: existingAssignment.path }, "KEEP", "", transfer);
      } else {
        const occupied = findById(state.assignments, deterministicAssignmentId);
        if (occupied) {
          blockers.push(`row ${row.rowNumber}: deterministic assignment ID is already occupied: ${deterministicAssignmentId}`);
          continue;
        }
        pushAction(actions, "teacherAssignments", { id: deterministicAssignmentId, payload: expectedAssignment }, transferActionName(transfer, "CREATE", "CREATE_NEW_TEACHER_ASSIGNMENT"), "", transfer);
      }
      const deterministicLinkId = stableId([assignmentId, "class-link", target.classId]);
      const matchingLinks = state.links.filter((link) => active(link) && text(link.assignmentId || link.teacherAssignmentId) === assignmentId);
      if (matchingLinks.length > 1) {
        blockers.push(`row ${row.rowNumber}: multiple active class links for ${assignmentId}`);
      } else if (matchingLinks.length === 1) {
        const expectedLink = linkPayload({ id: matchingLinks[0].id, assignmentId, schoolId: target.schoolId, termId, classTarget: target, offering });
        if (!expectedLinkMatches(matchingLinks[0], expectedLink)) blockers.push(`row ${row.rowNumber}: active class link does not exactly match ${assignmentId}`);
        else {
          if (transfer) transfer.newDesiredCounts.teacherAssignmentClassLinks += 1;
          pushAction(actions, "teacherAssignmentClassLinks", { id: matchingLinks[0].id, path: matchingLinks[0].path }, "KEEP", "", transfer);
        }
      } else {
        const occupied = findById(state.links, deterministicLinkId);
        if (occupied) blockers.push(`row ${row.rowNumber}: deterministic class-link ID is already occupied: ${deterministicLinkId}`);
        else {
          if (transfer) transfer.newDesiredCounts.teacherAssignmentClassLinks += 1;
          pushAction(actions, "teacherAssignmentClassLinks", { id: deterministicLinkId, payload: linkPayload({ id: deterministicLinkId, assignmentId, schoolId: target.schoolId, termId, classTarget: target, offering }) }, transferActionName(transfer, "CREATE", "CREATE_NEW_CLASS_LINK"), "", transfer);
        }
      }

      for (const operationKind of expectedOperationKinds(offering)) {
        const oKey = operationKey(teacher.personId, target.classId, offering.id, operationKind);
        desiredOperationKeys.add(oKey);
        const deterministicOperationId = stableId(["teacher-provisioning", teacher.personId, target.schoolId, ACADEMIC_YEAR_ID, termId, offering.id, operationKind]);
        const existingOperations = state.operations.filter((operation) =>
          active(operation) && scopeMatches(operation, target.schoolId, termId) &&
          text(operation.actorPersonId) === teacher.personId && text(operation.classSubjectOfferingId) === offering.id &&
          text(operation.classId) === target.classId && text(operation.operationKind) === operationKind,
        );
        if (existingOperations.length > 1) {
          blockers.push(`row ${row.rowNumber}: multiple active operational assignments for ${offering.id}/${operationKind}`);
          continue;
        }
        const existingOperation = existingOperations[0] || null;
        const operationId = existingOperation?.id || deterministicOperationId;
        const expectedOperation = operationPayload({ id: operationId, teacher, schoolId: target.schoolId, termId, classTarget: target, offering, assignmentId, operationKind, now });
        if (transfer) transfer.newDesiredCounts.operationalAssignments += 1;
        if (existingOperation) {
          if (!expectedOperationMatches(existingOperation, expectedOperation)) blockers.push(`row ${row.rowNumber}: operational assignment does not exactly match ${offering.id}/${operationKind}`);
          else pushAction(actions, "operationalAssignments", { id: existingOperation.id, path: existingOperation.path }, "KEEP", "", transfer);
        } else {
          const occupied = findById(state.operations, deterministicOperationId);
          if (occupied) blockers.push(`row ${row.rowNumber}: deterministic operational ID is already occupied: ${deterministicOperationId}`);
          else pushAction(actions, "operationalAssignments", { id: deterministicOperationId, payload: expectedOperation }, transferActionName(transfer, "CREATE", "CREATE_NEW_OPERATIONAL_ASSIGNMENT"), "", transfer);
        }
      }
    }
  }

  const kgOfferingById = new Map(state.offerings.filter((offering) => isKgId(offering.gradeId)).map((offering) => [offering.id, offering]));
  const endedAssignmentIds = new Set();
  for (const assignment of state.assignments) {
    const personId = text(assignment.teacherPersonId);
    const schoolId = text(assignment.schoolId);
    if (!active(assignment) || !isManaged(assignment) || !scopeMatches(assignment, schoolId, termId) ||
        !targetTeacherSchools.has(`${personId}|${schoolId}`) || text(assignment.targetScopeType) !== "CLASS" ||
        !text(assignment.classSubjectOfferingId) || (!isKgId(assignment.gradeId) && !kgOfferingById.has(text(assignment.classSubjectOfferingId)))) continue;
    const key = assignmentOfferingKey(personId, text(assignment.targetScopeId), text(assignment.classSubjectOfferingId));
    if (!desiredAssignmentOfferingKeys.has(key)) {
      endedAssignmentIds.add(assignment.id);
      addEndAction(actions, "teacherAssignments", assignment, now, "managed assignment is absent from the Excel map");
    }
  }

  for (const link of state.links) {
    if (!active(link) || !scopeMatches(link, text(link.schoolId), termId)) continue;
    const parent = state.assignments.find((assignment) => assignment.id === text(link.assignmentId || link.teacherAssignmentId));
    if (!parent || !scopeMatches(parent, text(link.schoolId), termId) || !isManaged(parent) ||
        !targetTeacherSchools.has(`${text(parent.teacherPersonId)}|${text(link.schoolId)}`)) continue;
    if (!text(link.classId) || (!isKgId(link.gradeId) && !kgOfferingById.has(text(link.classSubjectOfferingId)))) continue;
    const key = assignmentOfferingKey(text(parent.teacherPersonId), text(link.classId), text(link.classSubjectOfferingId));
    if (endedAssignmentIds.has(parent.id) || !desiredAssignmentOfferingKeys.has(key)) {
      addEndAction(actions, "teacherAssignmentClassLinks", link, now, "managed class link is absent from the Excel map");
    }
  }

  for (const operation of state.operations) {
    const personId = text(operation.actorPersonId);
    const schoolId = text(operation.schoolId);
    if (!active(operation) || !isManaged(operation) || !scopeMatches(operation, schoolId, termId) ||
        !targetTeacherSchools.has(`${personId}|${schoolId}`) || text(operation.scopeType) !== "CLASS" ||
        (!isKgId(operation.gradeId) && !kgOfferingById.has(text(operation.classSubjectOfferingId)))) continue;
    const key = operationKey(personId, text(operation.classId), text(operation.classSubjectOfferingId), text(operation.operationKind));
    if (endedAssignmentIds.has(text(operation.sourceTeacherAssignmentId)) || !desiredOperationKeys.has(key)) {
      addEndAction(actions, "operationalAssignments", operation, now, "managed operational assignment is absent from the Excel map or source assignment ended");
    }
  }

  for (const transfer of transfers) {
    const destinationRowBlockers = blockers.filter((blocker) =>
      Array.from(transfer.destinationRowNumbers || []).some((rowNumber) =>
        blocker.startsWith(`row ${rowNumber}:`),
      ),
    );
    if (destinationRowBlockers.length > 0) {
      blockTransfer(transfer, "one or more destination desired class/role rows are invalid");
    }
    if (transfer.status !== "BLOCKED" && transfer.newDesiredCounts.teacherAssignments === 0) {
      blockTransfer(transfer, "destination desired class/role rows did not resolve to any valid KG assignments");
    }
    planTransferOldSchoolReconciliation({ state, transfer, actions, now });
  }
  finalizeTransferPlans({ transfers, actions, blockers });

  const report = buildPlanReport({ inputPath, transferInputPath, termId, rows, actions, blockers, teachers, offeringsByClass, transfers });
  return report;
}

async function applyTransferPlan({ db, transfer, actions }) {
  if (transfer.status !== "PENDING" || !transfer.membershipWrites) {
    return { firestoreWrites: 0, authClaimsUpdated: false };
  }

  const graphWrites = actions.filter((action) =>
    action.transferId === transfer.id &&
    action.action !== "TRANSFER_MEMBERSHIP_SCOPE" &&
    isWriteAction(action.action),
  );
  const writeCount = transfer.membershipWrites.writes.length + graphWrites.length;
  if (writeCount > 450) {
    throw new Error(`Transfer ${transfer.id} exceeds the single atomic transfer limit.`);
  }

  const auth = admin.auth();
  const authUser = await auth.getUser(transfer.teacher.uid);
  if (email(authUser.email) !== transfer.teacher.email) {
    throw new Error(`Transfer ${transfer.id} Auth identity changed after preview.`);
  }
  const currentClaims = authUser.customClaims || {};
  if (!profileMatchesSchoolScope({
    user: transfer.current.user,
    claims: currentClaims,
    uid: transfer.teacher.uid,
    personId: transfer.teacher.personId,
    schoolId: transfer.fromSchoolId,
  })) {
    throw new Error(`Transfer ${transfer.id} Auth claims no longer match the source school scope.`);
  }

  const newClaims = {
    ...currentClaims,
    orgId: ORG_ID,
    personId: transfer.teacher.personId,
    role: "teacher",
    roleKey: "KG_TEACHER",
    schoolIds: [transfer.toSchoolId],
  };

  // This mirrors the existing school-scope repair convention.  A failed Firestore
  // transaction rolls the claims back before the error is surfaced.
  await auth.setCustomUserClaims(transfer.teacher.uid, newClaims);
  try {
    await db.runTransaction(async (transaction) => {
      const membershipRefs = transfer.membershipWrites.writes.map((write) => db.doc(write.path));
      const graphRefs = graphWrites.map((write) => db.doc(write.path));
      const snapshots = [];
      for (const ref of [...membershipRefs, ...graphRefs]) {
        snapshots.push(await transaction.get(ref));
      }

      const [userSnap, userMembershipSnap, orgMembershipSnap] = snapshots;
      if (!userSnap.exists || !userMembershipSnap.exists || !orgMembershipSnap.exists ||
          !membershipMatchesSchoolScope({
            membership: userMembershipSnap.data(),
            uid: transfer.teacher.uid,
            personId: transfer.teacher.personId,
            schoolId: transfer.fromSchoolId,
          }) ||
          !membershipMatchesSchoolScope({
            membership: orgMembershipSnap.data(),
            uid: transfer.teacher.uid,
            personId: transfer.teacher.personId,
            schoolId: transfer.fromSchoolId,
          }) ||
          !sameStrings(userSnap.data()?.schoolIds, [transfer.fromSchoolId])) {
        throw new Error(`Transfer ${transfer.id} school scope changed after preview.`);
      }

      graphWrites.forEach((write, index) => {
        const snapshot = snapshots[membershipRefs.length + index];
        if (write.action.startsWith("END_OLD_")) {
          if (!snapshot.exists || !active(snapshot.data())) {
            throw new Error(`Transfer ${transfer.id} old graph changed after preview: ${write.path}`);
          }
          return;
        }
        if (write.action.startsWith("CREATE_NEW_") && snapshot.exists) {
          throw new Error(`Transfer ${transfer.id} destination graph changed after preview: ${write.path}`);
        }
      });

      transfer.membershipWrites.writes.forEach((write, index) => {
        transaction.set(membershipRefs[index], write.payload, { merge: true });
      });
      graphWrites.forEach((write, index) => {
        const ref = graphRefs[index];
        if (write.action.startsWith("CREATE_NEW_")) {
          transaction.create(ref, write.payload);
        } else {
          transaction.set(ref, write.payload, { merge: true });
        }
      });
    });
  } catch (error) {
    try {
      await auth.setCustomUserClaims(transfer.teacher.uid, currentClaims);
    } catch (rollbackError) {
      console.error(`Could not roll back Auth claims for transfer ${transfer.id}.`);
      console.error(rollbackError);
    }
    throw error;
  }

  return { firestoreWrites: writeCount, authClaimsUpdated: true };
}

async function applyPlan(report) {
  if (report.blockers.length > 0) throw new Error(`Apply blocked: ${report.blockers.join(" | ")}`);
  const db = admin.firestore();
  let firestoreWrites = 0;
  let authClaimsUpdated = 0;

  for (const transfer of report._transfers || []) {
    const result = await applyTransferPlan({ db, transfer, actions: report._transferActions || [] });
    firestoreWrites += result.firestoreWrites;
    authClaimsUpdated += result.authClaimsUpdated ? 1 : 0;
  }

  const uniqueWrites = new Map();
  for (const write of report._writes || []) {
    uniqueWrites.set(`${write.collection}/${write.id}`, write);
  }
  const entries = Array.from(uniqueWrites.values());
  for (let offset = 0; offset < entries.length; offset += 450) {
    const batch = db.batch();
    for (const write of entries.slice(offset, offset + 450)) {
      batch.set(db.doc(write.path || `orgs/${ORG_ID}/${write.collection}/${write.id}`), write.payload, { merge: true });
    }
    await batch.commit();
  }

  return {
    firestoreWrites: firestoreWrites + entries.length,
    authClaimsUpdated,
  };
}

function publicReport(report) {
  const { _writes, _transfers, _transferActions, ...visible } = report;
  return visible;
}

module.exports = {
  ACADEMIC_YEAR_ID,
  INPUT_PATH,
  SOURCE,
  applyPlan,
  buildPlan,
  initAdmin,
  publicReport,
};
