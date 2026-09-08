const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.resolve("service-account.json"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const db = admin.firestore();

const APPLY = process.argv.includes("--apply");

const ORG_ID = "takween";
const ACADEMIC_YEAR_ID = "ay-1448";
const TERM_ID = "term-1";

const KG_SCHOOLS = [
  {
    schoolId: "kg-01",
    schoolTitle: "روضة واحة الرياحين الأولى",
    vp: {
      uid: "ms10LdA0k5TVkiJo4VO6pprmcOh2",
      personId: "staff-ms10LdA0k5TVkiJo4VO6pprmcOh2",
      email: "t.alamer@qz.org.sa",
      displayName: "تماضر صالح محمد العامر",
      roleKey: "KG_VP",
      roleLabel: "وكيلة الروضة",
    },
  },
  {
    schoolId: "kg-02",
    schoolTitle: "روضة واحة الرياحين الثانية",
    vp: {
      uid: "yC5MUiMlxCXt9RnrjPmT85Ko34t1",
      personId: "p-h-aljower",
      email: "h.aljower@qz.org.sa",
      displayName: "هاجر أحمد فهد الجوير",
      roleKey: "KG_VP",
      roleLabel: "وكيلة الروضة",
    },
  },
  {
    schoolId: "kg-03",
    schoolTitle: "روضة واحة الرياحين الثالثة",
    vp: {
      uid: "tfvc13fv0DOLqAjQ8s8cpojRMVG2",
      personId: "p-s-alslman",
      email: "s.alslman@qz.org.sa",
      displayName: "ساره سعد أحمد السلمان",
      roleKey: "KG_VP",
      roleLabel: "وكيلة الروضة",
    },
  },
  {
    schoolId: "kg-04",
    schoolTitle: "روضة واحة الرياحين الرابعة",
    vp: {
      uid: "2DtRW3PPQLSjuZR1Pyp1WucwzKy1",
      personId: "p-h-alshaya",
      email: "h.alshaya@qz.org.sa",
      displayName: "حصه عبدالرزاق احمد الشايع",
      roleKey: "KG_VP",
      roleLabel: "وكيلة الروضة",
    },
  },
];

const FRAMEWORKS = [
  {
    frameworkId: "kg-vp-supervisory-plan-v1",
    title: "الخطة الإشرافية للوكيلة",
    shortTitle: "الخطة الإشرافية",
    planSlug: "kg-vp-supervisory-plan",
    sectionTitle: "بنود الخطة الإشرافية",
    items: [
      {
        key: "service-years",
        title: "سنوات الخدمة",
        maxScore: 0,
        inputKind: "TEXT",
        isScored: false,
      },
      {
        key: "visit-completed",
        title: "تمت الزيارة",
        maxScore: 1,
        inputKind: "BOOLEAN",
        isScored: true,
      },
      {
        key: "report-delivered",
        title: "تم تسليم التقرير",
        maxScore: 1,
        inputKind: "BOOLEAN",
        isScored: true,
      },
    ],
  },
  {
    frameworkId: "kg-vp-supervisory-visit-v1",
    title: "زيارة إشرافية للوكيلة",
    shortTitle: "زيارة إشرافية",
    planSlug: "kg-vp-supervisory-visit",
    sectionTitle: "بنود الزيارة الإشرافية",
    items: [
      "حسن المظهر ووضوح الصوت مع الاتزان والثقة بالنفس",
      "الخطة اليومية أو الأسبوعية وفق الخطة الدراسية المقررة",
      "كتابة الموضوع والتاريخ والعنوان وتقسيم السبورة",
      "التمهيد للدرس بشكل جذاب ومشوق ومناسب (صورة، قصة، سؤال، ......)",
      "عرض الدرس بطريقة متسلسلة ومترابطة ومشوقة",
      "ربط الدرس الجديد بالدرس السابق وفق الأهداف وخبرات الطلاب",
      "تنوع الأسئلة ومشاركة أكبر عدد من الطلاب مع مراعاة الفروق الفردية",
      "استخدام استراتيجيات تدريس فعالة ومناسبة للدرس",
      "إثارة انتباه الطلاب مع التشجيع والتحضير",
      "تهيئة بيئة الصف قبل بدء الدرس (التنظيم)",
      "إدارة الوقت بفعالية أثناء الشرح",
      "معالجة السلوك بأسلوب تربوي ومناسب",
      "مناسبة الوسيلة للدرس والطلاب",
      "توظيف الوسيلة في وقتها المناسب",
      "تفعيل سجل الواجبات وتقييم الطلاب",
      "تحقيق أهداف الدرس",
      "تقديم تغذية راجعة (تدربْ، تأكدْ، تحققْ من فهمك، ........)",
      "ختم وإغلاق الدرس بمراجعة النقاط الأساسية أو نشاط عملي (أوراق عمل، تدريب جماعي،.......)",
      "متابعة المتعثرين",
      "أوراق الفاقد التعليمي",
      "خطة الفاقد التعليمي",
      "الالتزام بالزي الرسمي",
    ].map((title, index) => ({
      key: `item-${String(index + 1).padStart(2, "0")}`,
      title,
      maxScore: 1,
      inputKind: "BOOLEAN",
      isScored: true,
    })),
  },
];

function isActive(row) {
  const status = String(row.status || "").toUpperCase();

  if (["REMOVED", "INACTIVE", "ENDED", "ARCHIVED", "DELETED"].includes(status)) {
    return false;
  }

  if (row.isActive === false || row.active === false) {
    return false;
  }

  return row.status === "ACTIVE" || row.isActive === true || row.active === true || !row.status;
}

function getTeacherPersonId(row) {
  return row.teacherPersonId || row.personId || row.staffPersonId || row.targetPersonId || null;
}

function getSchoolId(row) {
  return row.schoolId || row.orgUnitId || row.scopeSchoolId || row.assignedSchoolId || null;
}

function sectionId(frameworkId) {
  return `${frameworkId}__main`;
}

function itemId(frameworkId, itemKey) {
  return `${frameworkId}__${itemKey}`;
}

function planId(schoolId, framework) {
  return `${schoolId}-${ACADEMIC_YEAR_ID}-${TERM_ID}-${framework.planSlug}`;
}

function cycleId(planIdValue, visitNo) {
  return `${planIdValue}-visit-${String(visitNo).padStart(2, "0")}`;
}

function targetAssignmentId(planIdValue, teacherPersonId) {
  return `${planIdValue}-target-${teacherPersonId}`;
}

function evaluatorAssignmentId(planIdValue, cycleIdValue, teacherPersonId, vpPersonId) {
  return `${planIdValue}-${cycleIdValue}-${teacherPersonId}-${vpPersonId}`;
}

function totalMaxScore(framework) {
  return framework.items.reduce((sum, item) => sum + Number(item.maxScore || 0), 0);
}

async function getUserByPersonId(personId, cache) {
  if (cache.has(personId)) {
    return cache.get(personId);
  }

  const snap = await db.collection("users").where("personId", "==", personId).limit(5).get();

  if (snap.empty) {
    const fallback = {
      uid: "",
      personId,
      email: "",
      displayName: personId,
      roleKey: "KG_TEACHER",
      roleLabel: "معلمة",
    };

    cache.set(personId, fallback);
    return fallback;
  }

  const row = snap.docs[0].data();

  const user = {
    uid: row.uid || snap.docs[0].id,
    personId: row.personId || personId,
    email: String(row.email || "").trim().toLowerCase(),
    displayName: row.displayName || row.name || row.fullName || row.email || personId,
    roleKey: row.roleKey || "KG_TEACHER",
    roleLabel: "معلمة",
  };

  cache.set(personId, user);
  return user;
}

async function getTeachersBySchool(orgRef, schoolIdValue, userCache) {
  const snap = await orgRef.collection("teacherAssignments").get();

  const rows = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((row) => getSchoolId(row) === schoolIdValue)
    .filter(isActive);

  const personIds = Array.from(new Set(rows.map(getTeacherPersonId).filter(Boolean)));

  const teachers = [];

  for (const personId of personIds) {
    teachers.push(await getUserByPersonId(personId, userCache));
  }

  return teachers.sort((a, b) => a.displayName.localeCompare(b.displayName, "ar"));
}

function pushFrameworkWrites(orgRef, writes, now) {
  for (const framework of FRAMEWORKS) {
    const frameworkRef = orgRef.collection("evaluationFrameworks").doc(framework.frameworkId);
    const mainSectionId = sectionId(framework.frameworkId);

    writes.push({
      ref: frameworkRef,
      data: {
        id: framework.frameworkId,
        orgId: ORG_ID,
        title: framework.title,
        shortTitle: framework.shortTitle,
        description: `${framework.title} - لوكيلات الروضات`,
        targetKind: "TEACHER",
        evaluatorRoleKey: "KG_VP",
        evaluatorRoleLabel: "وكيلة الروضة",
        planKind: "VISIT_BASED",
        version: 1,
        totalMaxScore: totalMaxScore(framework),
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      },
    });

    writes.push({
      ref: orgRef.collection("evaluationRubricSections").doc(mainSectionId),
      data: {
        id: mainSectionId,
        orgId: ORG_ID,
        frameworkId: framework.frameworkId,
        title: framework.sectionTitle,
        order: 1,
        maxScore: totalMaxScore(framework),
        weight: 1,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      },
    });

    framework.items.forEach((item, index) => {
      const id = itemId(framework.frameworkId, item.key);

      writes.push({
        ref: orgRef.collection("evaluationRubricItems").doc(id),
        data: {
          id,
          orgId: ORG_ID,
          frameworkId: framework.frameworkId,
          sectionId: mainSectionId,
          key: item.key,
          title: item.title,
          inputKind: item.inputKind,
          isScored: item.isScored,
          maxScore: item.maxScore,
          order: index + 1,
          weight: item.isScored ? 1 : 0,
          status: "ACTIVE",
          createdAt: now,
          updatedAt: now,
        },
      });
    });
  }
}

async function pushPlanCycleAssignmentWrites(orgRef, writes, now, school, teachers) {
  for (const framework of FRAMEWORKS) {
    const planIdValue = planId(school.schoolId, framework);

    writes.push({
      ref: orgRef.collection("evaluationPlans").doc(planIdValue),
      data: {
        id: planIdValue,
        orgId: ORG_ID,
        schoolId: school.schoolId,
        schoolTitle: school.schoolTitle,
        academicYearId: ACADEMIC_YEAR_ID,
        termId: TERM_ID,
        frameworkId: framework.frameworkId,
        title: `${framework.title} - ${school.schoolTitle} - الفصل الأول`,
        shortTitle: framework.shortTitle,
        planKind: "VISIT_BASED",
        targetKind: "TEACHER",
        evaluatorRoleKey: "KG_VP",
        evaluatorRoleLabel: "وكيلة الروضة",
        cycleCount: 2,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      },
    });

    for (let visit = 1; visit <= 2; visit++) {
      const cycleIdValue = cycleId(planIdValue, visit);

      writes.push({
        ref: orgRef.collection("evaluationCycles").doc(cycleIdValue),
        data: {
          id: cycleIdValue,
          orgId: ORG_ID,
          schoolId: school.schoolId,
          schoolTitle: school.schoolTitle,
          academicYearId: ACADEMIC_YEAR_ID,
          termId: TERM_ID,
          planId: planIdValue,
          frameworkId: framework.frameworkId,
          title: `الزيارة ${visit}`,
          shortTitle: `زيارة ${visit}`,
          sequence: visit,
          cycleNumber: visit,
          status: "ACTIVE",
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    for (const teacher of teachers) {
      const targetId = targetAssignmentId(planIdValue, teacher.personId);

      writes.push({
        ref: orgRef.collection("evaluationTargetAssignments").doc(targetId),
        data: {
          id: targetId,
          orgId: ORG_ID,
          schoolId: school.schoolId,
          schoolTitle: school.schoolTitle,
          academicYearId: ACADEMIC_YEAR_ID,
          termId: TERM_ID,
          planId: planIdValue,
          frameworkId: framework.frameworkId,
          targetKind: "TEACHER",
          targetPersonId: teacher.personId,
          targetEmail: teacher.email,
          targetDisplayName: teacher.displayName,
          targetRoleKey: teacher.roleKey || "KG_TEACHER",
          targetRoleLabel: "معلمة",
          status: "ACTIVE",
          removedAt: admin.firestore.FieldValue.delete(),
          updatedAt: now,
          createdAt: now,
        },
      });

      for (let visit = 1; visit <= 2; visit++) {
        const cycleIdValue = cycleId(planIdValue, visit);
        const evaluatorId = evaluatorAssignmentId(
          planIdValue,
          cycleIdValue,
          teacher.personId,
          school.vp.personId
        );

        writes.push({
          ref: orgRef.collection("evaluationEvaluatorAssignments").doc(evaluatorId),
          data: {
            id: evaluatorId,
            orgId: ORG_ID,
            schoolId: school.schoolId,
            schoolTitle: school.schoolTitle,
            academicYearId: ACADEMIC_YEAR_ID,
            termId: TERM_ID,
            planId: planIdValue,
            frameworkId: framework.frameworkId,
            cycleId: cycleIdValue,
            targetKind: "TEACHER",
            targetPersonId: teacher.personId,
            targetEmail: teacher.email,
            targetDisplayName: teacher.displayName,
            targetRoleKey: teacher.roleKey || "KG_TEACHER",
            targetRoleLabel: "معلمة",
            evaluatorPersonId: school.vp.personId,
            evaluatorEmail: school.vp.email,
            evaluatorDisplayName: school.vp.displayName,
            evaluatorRoleKey: school.vp.roleKey,
            evaluatorRoleLabel: school.vp.roleLabel,
            status: "ACTIVE",
            removedAt: admin.firestore.FieldValue.delete(),
            updatedAt: now,
            createdAt: now,
          },
        });
      }
    }
  }
}

async function commitInChunks(writes, chunkSize = 450) {
  let committed = 0;

  for (let i = 0; i < writes.length; i += chunkSize) {
    const batch = db.batch();
    const chunk = writes.slice(i, i + chunkSize);

    for (const write of chunk) {
      batch.set(write.ref, write.data, { merge: true });
    }

    await batch.commit();
    committed += chunk.length;
  }

  return committed;
}

async function main() {
  console.log(APPLY ? "APPLY mode" : "Preview mode - no writes");

  const orgRef = db.collection("orgs").doc(ORG_ID);
  const userCache = new Map();
  const now = Date.now();

  const writes = [];
  const summary = [];

  pushFrameworkWrites(orgRef, writes, now);

  for (const school of KG_SCHOOLS) {
    const teachers = await getTeachersBySchool(orgRef, school.schoolId, userCache);

    summary.push({
      schoolId: school.schoolId,
      schoolTitle: school.schoolTitle,
      vp: school.vp,
      teachersCount: teachers.length,
      teacherSamples: teachers.slice(0, 10).map((teacher) => ({
        personId: teacher.personId,
        email: teacher.email,
        displayName: teacher.displayName,
      })),
      plannedAssignmentDocsForSchool: teachers.length * 6,
    });

    await pushPlanCycleAssignmentWrites(orgRef, writes, now, school, teachers);
  }

  console.dir(
    {
      decision: APPLY ? "READY_TO_APPLY" : "SAFE_PREVIEW",
      orgId: ORG_ID,
      academicYearId: ACADEMIC_YEAR_ID,
      termId: TERM_ID,
      frameworks: FRAMEWORKS.map((framework) => ({
        frameworkId: framework.frameworkId,
        title: framework.title,
        visits: 2,
        itemsCount: framework.items.length,
        totalMaxScore: totalMaxScore(framework),
      })),
      schoolsCount: KG_SCHOOLS.length,
      plannedWrites: writes.length,
      summary,
    },
    { depth: 20 }
  );

  if (!APPLY) {
    console.log("No writes performed.");
    console.log("Run with --apply to write changes.");
    return;
  }

  const committed = await commitInChunks(writes);

  console.dir({
    decision: "APPLIED",
    committedWrites: committed,
  });
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});