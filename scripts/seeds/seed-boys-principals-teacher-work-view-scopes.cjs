/* eslint-disable no-console */

const admin = require("firebase-admin");
const path = require("path");

const APPLY = process.argv.includes("--apply");

const ORG_ID = "takween";
const CAPABILITY = "TEACHER_WORK_VIEW";

const TARGETS = [
  {
    label: "مدير السيح",
    personId: "p-a-s-alkmays",
    schoolId: "mrb-boys-sayh",
  },
  {
    label: "مدير الفالح",
    personId: "staff-EJP7cQWlOldemQo6R6TciBZXSFt2",
    schoolId: "mrb-boys-faleh",
  },
];

function initAdmin() {
  if (admin.apps.length) return;

  const serviceAccountPath = path.resolve(
    __dirname,
    "../service-account.json",
  );

  const serviceAccount = require(serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildScopeId(personId, schoolId) {
  return `${personId}__${CAPABILITY}__${schoolId}`;
}

async function main() {
  initAdmin();

  const db = admin.firestore();
  const writes = [];

  console.log(
    APPLY
      ? "Boys principals TEACHER_WORK_VIEW - APPLY mode"
      : "Boys principals TEACHER_WORK_VIEW - PREVIEW mode (read-only)",
  );

  console.log("");

  for (const target of TARGETS) {
    const personRef = db.doc(
      `orgs/${ORG_ID}/people/${target.personId}`,
    );

    const personSnap = await personRef.get();

    assert(
      personSnap.exists,
      `Person not found: ${target.personId}`,
    );

    const schoolRef = db.doc(
      `orgs/${ORG_ID}/schools/${target.schoolId}`,
    );

    const schoolSnap = await schoolRef.get();

    assert(
      schoolSnap.exists,
      `School not found: ${target.schoolId}`,
    );

    const scopeId = buildScopeId(
      target.personId,
      target.schoolId,
    );

    const scopeRef = db.doc(
      `orgs/${ORG_ID}/personSupervisionScopes/${scopeId}`,
    );

    const scopeSnap = await scopeRef.get();
    const existing = scopeSnap.exists
      ? scopeSnap.data()
      : null;

    const now = Date.now();

    const desiredScope = {
      id: scopeId,
      orgId: ORG_ID,
      personId: target.personId,
      capability: CAPABILITY,
      schoolId: target.schoolId,
      subjectScope: "ALL_SUBJECTS",
      subjectKeys: [],
      isActive: true,
      createdAt:
        typeof existing?.createdAt === "number"
          ? existing.createdAt
          : now,
      updatedAt: now,
    };

    console.log("========================================");
    console.log(target.label);
    console.log("----------------------------------------");
    console.log(
      "Person:",
      personSnap.data()?.displayName || target.personId,
    );
    console.log("Person ID:", target.personId);
    console.log(
      "School:",
      schoolSnap.data()?.name || target.schoolId,
    );
    console.log("School ID:", target.schoolId);
    console.log("Scope ID:", scopeId);
    console.log(
      "Existing:",
      scopeSnap.exists ? "YES" : "NO",
    );
    console.log("");

    console.dir(desiredScope, {
      depth: null,
    });

    console.log("");

    writes.push({
      ...target,
      scopeId,
      scopeRef,
      desiredScope,
    });
  }

  console.log("========================================");
  console.log("Total scopes:", writes.length);
  console.log("");

  if (!APPLY) {
    console.log("PREVIEW COMPLETE");
    console.log("No writes performed.");
    return;
  }

  const batch = db.batch();

  for (const item of writes) {
    batch.set(
      item.scopeRef,
      item.desiredScope,
      { merge: true },
    );
  }

  await batch.commit();

  console.log("Writes completed.");
  console.log("");
  console.log("Verifying...");
  console.log("");

  for (const item of writes) {
    const snap = await item.scopeRef.get();

    assert(
      snap.exists,
      `Scope missing: ${item.scopeId}`,
    );

    const data = snap.data() || {};

    assert(
      data.personId === item.personId,
      `Invalid personId: ${item.scopeId}`,
    );

    assert(
      data.schoolId === item.schoolId,
      `Invalid schoolId: ${item.scopeId}`,
    );

    assert(
      data.capability === CAPABILITY,
      `Invalid capability: ${item.scopeId}`,
    );

    assert(
      data.isActive === true,
      `Scope inactive: ${item.scopeId}`,
    );

    console.log(
      `OK: ${item.label} -> ${item.schoolId}`,
    );
  }

  console.log("");
  console.log("========================================");
  console.log(
    "Boys principals TEACHER_WORK_VIEW scopes provisioned successfully.",
  );
}

main().catch((error) => {
  console.error("");
  console.error(
    "TEACHER_WORK_VIEW provisioning failed:",
  );
  console.error(error);
  process.exitCode = 1;
});