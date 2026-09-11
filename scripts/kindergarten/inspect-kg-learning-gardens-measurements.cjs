/*
 * Read-only inspection for KG Learning Gardens measurement templates.
 *
 * Usage:
 *   node scripts/kindergarten/inspect-kg-learning-gardens-measurements.cjs
 *
 * This script never writes to Firestore. It only reads the two template
 * collections and targeted measurement batches that reference discovered IDs.
 */

const admin = require("firebase-admin");
const fs = require("node:fs");
const path = require("node:path");

const ORG_ID = "takween";
const TARGET_GRADES = ["kg1", "kg2", "kg3"];
const TEMPLATE_COLLECTIONS = [
  { name: "studentAssessmentTemplates", templateType: "ASSESSMENT" },
  { name: "studentTrackerTemplates", templateType: "TRACKER" },
];
const REPORT_PATH = path.resolve(
  process.cwd(),
  "scripts",
  "kindergarten",
  "inspect-kg-learning-gardens-measurements-report.json",
);

if (process.argv.length > 2) {
  throw new Error(
    "This inspection is read-only and accepts no options. There is no --apply mode.",
  );
}

function initAdmin() {
  if (admin.apps.length > 0) return;

  const serviceAccountPath = path.resolve(
    process.env.SERVICE_ACCOUNT_PATH ||
      path.join(process.cwd(), "service-account.json"),
  );
  const serviceAccount = require(serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeKey(value) {
  return text(value).replace(/[\s-]+/g, "_").toUpperCase();
}

function normalizeTitle(value) {
  return text(value).replace(/\s+/g, " ").toLowerCase();
}

function toPlain(value) {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value.toDate === "function") return value.toDate().toISOString();

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entryValue]) => [key, toPlain(entryValue)])
      .filter(([, entryValue]) => entryValue !== undefined),
  );
}

function dataOf(snapshot) {
  return {
    id: snapshot.id,
    path: snapshot.ref.path,
    ...(snapshot.data() || {}),
  };
}

function isLearningGardensTemplate(data) {
  const subjectKey = normalizeKey(data.subjectKey);
  const subjectId = normalizeKey(data.subjectId);
  const subjectTitle = normalizeTitle(data.subjectTitle);
  const title = normalizeTitle(data.title);
  const code = normalizeKey(data.code || data.templateCode);

  return (
    subjectKey === "LEARNING_GARDENS" ||
    subjectId === "LEARNING_GARDENS" ||
    subjectTitle.includes("بساتين المعرفة") ||
    title.includes("بساتين المعرفة") ||
    code.includes("LEARNING_GARDENS")
  );
}

function isEffectiveActive(data) {
  const status = normalizeKey(data.status);
  const inactiveStatus = new Set([
    "INACTIVE",
    "ARCHIVED",
    "DEPRECATED",
    "DISABLED",
    "ENDED",
    "CLOSED",
  ]);

  return data.isActive === true && !inactiveStatus.has(status);
}

function isDeprecated(data) {
  const status = normalizeKey(data.status);
  const searchable = [
    data.code,
    data.templateCode,
    data.title,
    data.kind,
    data.templateKind,
  ]
    .map((value) => text(value).toLowerCase())
    .join(" ");

  return (
    data.isActive === false ||
    ["INACTIVE", "ARCHIVED", "DEPRECATED", "ENDED", "DISABLED"].includes(
      status,
    ) ||
    data.isArchived === true ||
    /\blegacy\b|\bold\b|\bdeprecated\b/.test(searchable)
  );
}

function pickMatchingFields(data, pattern) {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([key]) => pattern.test(key))
      .map(([key, value]) => [key, toPlain(value)]),
  );
}

function getTemplateItems(data) {
  return (Array.isArray(data.templateItems) ? data.templateItems : [])
    .map((item, index) => ({ item: item || {}, index }))
    .sort((left, right) => {
      const leftOrder =
        typeof left.item.order === "number" ? left.item.order : 0;
      const rightOrder =
        typeof right.item.order === "number" ? right.item.order : 0;

      return leftOrder - rightOrder || left.index - right.index;
    })
    .map(({ item }) => ({
      order: typeof item.order === "number" ? item.order : 0,
      itemKey: text(item.itemKey),
      itemId: text(item.itemId),
      itemTitle: text(item.itemTitle || item.title),
      title: text(item.title),
      category: text(item.category),
      valueType: text(item.valueType),
      maxScore: typeof item.maxScore === "number" ? item.maxScore : null,
      weight: typeof item.weight === "number" ? item.weight : null,
      affectsTotal:
        typeof item.affectsTotal === "boolean" ? item.affectsTotal : null,
    }));
}

function createTemplateRecord(data, source) {
  const templateItems = getTemplateItems(data);
  const hasCompleteItemScores =
    templateItems.length > 0 &&
    templateItems.every((item) => typeof item.maxScore === "number");
  const itemMaxScoreSum = hasCompleteItemScores
    ? templateItems.reduce((sum, item) => sum + item.maxScore, 0)
    : null;
  const maxScore = typeof data.maxScore === "number" ? data.maxScore : null;

  return {
    firestorePath: data.path,
    id: data.id,
    code: text(data.code || data.templateCode),
    title: text(data.title),
    kind: text(data.kind),
    templateType: text(data.templateKind) || source.templateType,
    templateCollection: source.name,
    orgId: text(data.orgId),
    schoolType: text(data.schoolType),
    schoolId: text(data.schoolId),
    academicYearId: text(data.academicYearId),
    gradeId: text(data.gradeId),
    subjectKey: text(data.subjectKey),
    subjectId: text(data.subjectId),
    subjectTitle: text(data.subjectTitle),
    status: text(data.status),
    isActive: data.isActive === true,
    effectiveActive: isEffectiveActive(data),
    order: typeof data.order === "number" ? data.order : null,
    maxScore,
    itemMaxScore: typeof data.itemMaxScore === "number" ? data.itemMaxScore : null,
    itemMaxScoreSum,
    measurementFields: {
      assessmentSlot: text(data.assessmentSlot),
      assessmentKind: text(data.assessmentKind),
      assessmentType: text(data.assessmentType),
      measurementType: text(data.measurementType),
      measurementKind: text(data.measurementKind),
      trackerKind: text(data.trackerKind),
      scoreType: text(data.scoreType),
      evaluatorRoleKey: text(data.evaluatorRoleKey),
    },
    continuousOfficialFields: pickMatchingFields(data, /continuous|official/i),
    learningLossConfiguration: pickMatchingFields(
      data,
      /learningLoss|threshold/i,
    ),
    requiresLearningLossFollowUp: data.requiresLearningLossFollowUp === true,
    learningLossThresholdPercentage:
      typeof data.learningLossThresholdPercentage === "number"
        ? data.learningLossThresholdPercentage
        : null,
    templateItemsCount: templateItems.length,
    templateItems,
    deprecated: isDeprecated(data),
  };
}

function addWarning(warnings, type, message, templates) {
  warnings.push({
    type,
    message,
    templates: templates.map((template) => ({
      id: template.id,
      code: template.code,
      title: template.title,
      firestorePath: template.firestorePath,
    })),
  });
}

function chunk(values, size) {
  const chunks = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

async function loadUsage(db, templateIds) {
  const uniqueIds = Array.from(new Set(templateIds.filter(Boolean)));
  const usageByTemplateId = Object.fromEntries(
    uniqueIds.map((templateId) => [templateId, []]),
  );

  if (uniqueIds.length === 0) {
    return {
      available: true,
      collection: "studentMeasurementBatches",
      queriedTemplateIds: [],
      countsByTemplateId: {},
      referencesByTemplateId: {},
    };
  }

  try {
    const batchesRef = db.collection(
      `orgs/${ORG_ID}/studentMeasurementBatches`,
    );

    for (const templateIdChunk of chunk(uniqueIds, 30)) {
      const snapshot = await batchesRef
        .where("templateId", "in", templateIdChunk)
        .get();

      snapshot.docs.forEach((document) => {
        const data = document.data() || {};
        const templateId = text(data.templateId);

        if (!usageByTemplateId[templateId]) return;

        usageByTemplateId[templateId].push({
          id: document.id,
          firestorePath: document.ref.path,
          status: text(data.status),
          batchKind: text(data.batchKind),
          schoolId: text(data.schoolId),
          academicYearId: text(data.academicYearId),
          gradeId: text(data.gradeId),
          classId: text(data.classId),
          subjectKey: text(data.subjectKey),
        });
      });
    }

    return {
      available: true,
      collection: "studentMeasurementBatches",
      queriedTemplateIds: uniqueIds,
      countsByTemplateId: Object.fromEntries(
        Object.entries(usageByTemplateId).map(([templateId, references]) => [
          templateId,
          references.length,
        ]),
      ),
      referencesByTemplateId: usageByTemplateId,
    };
  } catch (error) {
    return {
      available: false,
      collection: "studentMeasurementBatches",
      queriedTemplateIds: uniqueIds,
      error: error instanceof Error ? error.message : String(error),
      countsByTemplateId: {},
      referencesByTemplateId: {},
    };
  }
}

function createSummaryByGrade(templates) {
  return Object.fromEntries(
    TARGET_GRADES.map((gradeId) => {
      const gradeTemplates = templates.filter(
        (template) => template.gradeId.toLowerCase() === gradeId,
      );

      return [
        gradeId,
        {
          totalMatchingTemplates: gradeTemplates.length,
          activeTemplates: gradeTemplates.filter(
            (template) => template.effectiveActive,
          ).length,
          inactiveTemplates: gradeTemplates.filter(
            (template) => !template.effectiveActive,
          ).length,
          templates: gradeTemplates.map((template) => ({
            id: template.id,
            code: template.code,
            title: template.title,
            templateType: template.templateType,
            maxScore: template.maxScore,
            templateItemsCount: template.templateItemsCount,
            firestorePath: template.firestorePath,
          })),
        },
      ];
    }),
  );
}

function findWarnings(templates) {
  const warnings = [];
  const byId = new Map();
  const byCode = new Map();
  const byOverlapKey = new Map();

  for (const template of templates) {
    if (!byId.has(template.id)) byId.set(template.id, []);
    byId.get(template.id).push(template);

    if (template.code) {
      if (!byCode.has(template.code)) byCode.set(template.code, []);
      byCode.get(template.code).push(template);
    }

    if (template.schoolId) {
      addWarning(
        warnings,
        "UNEXPECTED_SCHOOL_ID",
        `Expected generic schoolId \"\" but found \"${template.schoolId}\".`,
        [template],
      );
    }

    if (normalizeKey(template.subjectKey) !== "LEARNING_GARDENS") {
      addWarning(
        warnings,
        "UNEXPECTED_SUBJECT_KEY",
        `Expected subjectKey LEARNING_GARDENS but found \"${template.subjectKey || "(missing)"}\".`,
        [template],
      );
    }

    if (!template.gradeId) {
      addWarning(
        warnings,
        "MISSING_GRADE_ID",
        "Template is missing gradeId.",
        [template],
      );
    } else if (!TARGET_GRADES.includes(template.gradeId.toLowerCase())) {
      addWarning(
        warnings,
        "UNEXPECTED_GRADE_ID",
        `Expected kg1, kg2, or kg3 but found \"${template.gradeId}\".`,
        [template],
      );
    }

    if (
      typeof template.maxScore === "number" &&
      typeof template.itemMaxScoreSum === "number" &&
      Math.abs(template.maxScore - template.itemMaxScoreSum) > 0.000001
    ) {
      addWarning(
        warnings,
        "MAX_SCORE_MISMATCH",
        `maxScore (${template.maxScore}) differs from the sum of item max scores (${template.itemMaxScoreSum}).`,
        [template],
      );
    }

    if (template.deprecated) {
      addWarning(
        warnings,
        "POSSIBLY_DEPRECATED",
        "Template appears inactive, archived, ended, disabled, or legacy/deprecated.",
        [template],
      );
    }

    const overlapKind = normalizeKey(
      template.measurementFields.assessmentSlot ||
        template.measurementFields.trackerKind ||
        template.measurementFields.assessmentKind ||
        template.kind ||
        template.code,
    );
    const overlapKey = [
      template.gradeId.toLowerCase(),
      normalizeKey(template.subjectKey),
      template.templateType,
      overlapKind,
    ].join("|");

    if (!byOverlapKey.has(overlapKey)) byOverlapKey.set(overlapKey, []);
    byOverlapKey.get(overlapKey).push(template);
  }

  for (const [id, entries] of byId) {
    if (entries.length > 1) {
      addWarning(
        warnings,
        "DUPLICATE_TEMPLATE_ID",
        `Template ID \"${id}\" appears ${entries.length} times across inspected collections.`,
        entries,
      );
    }
  }

  for (const [code, entries] of byCode) {
    if (entries.length > 1) {
      addWarning(
        warnings,
        "DUPLICATE_TEMPLATE_CODE",
        `Template code \"${code}\" appears ${entries.length} times.`,
        entries,
      );
    }
  }

  for (const [key, entries] of byOverlapKey) {
    if (entries.length > 1) {
      addWarning(
        warnings,
        "POTENTIAL_TEMPLATE_OVERLAP",
        `Multiple templates share grade/subject/type/measurement key: ${key}.`,
        entries,
      );
    }
  }

  return warnings;
}

function printReport(report) {
  console.log("\nKG Learning Gardens measurement template inspection");
  console.log("=".repeat(58));
  console.log(`Org: ${report.metadata.orgId}`);
  console.log(`Collections: ${report.metadata.collectionsInspected.join(", ")}`);
  console.log(`Matching templates: ${report.templates.length}`);

  for (const gradeId of TARGET_GRADES) {
    const summary = report.summaryByGrade[gradeId];
    console.log(
      `\n${gradeId}: ${summary.totalMatchingTemplates} total, ${summary.activeTemplates} active, ${summary.inactiveTemplates} inactive`,
    );

    for (const template of summary.templates) {
      console.log(
        `  - ${template.id} | ${template.title || "(untitled)"} | maxScore=${template.maxScore ?? "n/a"} | items=${template.templateItemsCount}`,
      );
    }
  }

  const outsideTargetGrades = report.templates.filter(
    (template) => !TARGET_GRADES.includes(template.gradeId.toLowerCase()),
  );
  if (outsideTargetGrades.length > 0) {
    console.log(
      `\nOutside kg1/kg2/kg3 or missing grade: ${outsideTargetGrades.length}`,
    );
  }

  console.log(`\nWarnings: ${report.warnings.length}`);
  for (const warning of report.warnings) {
    console.log(`  - [${warning.type}] ${warning.message}`);
  }

  if (report.usage.available) {
    const totalReferences = Object.values(report.usage.countsByTemplateId).reduce(
      (sum, count) => sum + count,
      0,
    );
    console.log(`\nTargeted batch references: ${totalReferences}`);
  } else {
    console.log(`\nBatch usage unavailable: ${report.usage.error}`);
  }

  console.log(`\nJSON report: ${REPORT_PATH}`);
}

async function main() {
  initAdmin();
  const db = admin.firestore();

  const collectionSnapshots = await Promise.all(
    TEMPLATE_COLLECTIONS.map(async (source) => ({
      source,
      snapshot: await db.collection(`orgs/${ORG_ID}/${source.name}`).get(),
    })),
  );

  const templates = collectionSnapshots
    .flatMap(({ source, snapshot }) =>
      snapshot.docs
        .map(dataOf)
        .filter(
          (data) =>
            text(data.orgId) === ORG_ID &&
            normalizeKey(data.schoolType) === "KG" &&
            isLearningGardensTemplate(data),
        )
        .map((data) => createTemplateRecord(data, source)),
    )
    .sort((left, right) => {
      const gradeCompare = left.gradeId.localeCompare(right.gradeId, "en");
      if (gradeCompare !== 0) return gradeCompare;

      const orderCompare = (left.order ?? 0) - (right.order ?? 0);
      if (orderCompare !== 0) return orderCompare;

      return left.firestorePath.localeCompare(right.firestorePath, "en");
    });

  const usage = await loadUsage(
    db,
    templates.map((template) => template.id),
  );

  templates.forEach((template) => {
    template.usageCount = usage.countsByTemplateId[template.id] ?? null;
  });

  const report = {
    metadata: {
      generatedAt: new Date().toISOString(),
      orgId: ORG_ID,
      schoolType: "KG",
      targetSubject: "LEARNING_GARDENS",
      targetGrades: TARGET_GRADES,
      expectedSchoolId: "",
      readOnly: true,
      collectionsInspected: [
        ...TEMPLATE_COLLECTIONS.map((source) => source.name),
        "studentMeasurementBatches (targeted templateId lookups only)",
      ],
    },
    templates,
    summaryByGrade: createSummaryByGrade(templates),
    warnings: findWarnings(templates),
    usage,
  };

  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  printReport(report);
}

main().catch((error) => {
  console.error("Inspection failed. No Firestore writes were attempted.");
  console.error(error);
  process.exitCode = 1;
});
