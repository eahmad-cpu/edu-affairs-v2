"use client";

import Link from "next/link";
import { useMemo, type ComponentType } from "react";
import { useParams, useSearchParams } from "next/navigation";

import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  FileText,
  GraduationCap,
  HeartHandshake,
  Layers3,
  MessageSquareText,
  School,
  Sparkles,
  Target,
  UsersRound,
} from "lucide-react";

import { buildClassSubjectWorkspaces } from "@takween/domain";
import type {
  ClassSubjectOffering,
  MembershipRole,
  TeacherAssignment,
  TeacherAssignmentClassLink,
} from "@takween/contracts";

import { useStaffActor } from "@/components/staff/staff-actor-provider";
import { PrimaryClassSubjectsSection } from "@/components/staff/classes/primary-class-subjects-section";
import {
  useClassStudents,
  type ClassStudentsData,
} from "@/hooks/use-class-students";

type StaffVisibleClass = {
  id: string;
  schoolType?: string;
  orgId?: string;
  schoolId?: string;
  academicYearId?: string;
  gradeId?: string;
  streamId?: string;
  code?: string;
  title?: string;
  sectionLabel?: string;
  order?: number;
  capacity?: number;
  studentCount?: number;
  studentsCount?: number;
  enrolledStudentCount?: number;
  schoolName?: string;
  gradeTitle?: string;
  academicYearTitle?: string;
};

type StaffActorCurrentTerm = {
  id: string;
  orgId?: string;
  academicYearId: string;
  title: string;
  shortTitle?: string;
  order?: number;
  status?: string;
  isCurrent?: boolean;
  startsAt?: number;
  endsAt?: number;
};

type StaffActorLike = {
  uid?: string;
  personId?: string;
  orgId?: string;
  roles?: MembershipRole[];
  visibleClasses?: StaffVisibleClass[];
  classSubjectOfferings?: ClassSubjectOffering[];
  teacherAssignments?: TeacherAssignment[];
  teacherAssignmentClassLinks?: TeacherAssignmentClassLink[];
  currentTerm?: StaffActorCurrentTerm | null;
  currentTermsByAcademicYear?: Record<string, StaffActorCurrentTerm>;
};

type OperationCard = {
  title: string;
  description: string;
  status: "ACTIVE" | "READY_SOON" | "FUTURE";
  icon: ComponentType<{ className?: string }>;
  href?: string;
  actionLabel?: string;
};

type ClassSubjectWorkspace = ReturnType<
  typeof buildClassSubjectWorkspaces
>[number];

type WorkspaceGroupKey =
  | "CLASS_TEACHER_DOMAINS"
  | "VALUES_DOMAINS"
  | "CORNERS_DOMAINS"
  | "HOMEROOM_ASSIGNMENT"
  | "OTHER_DOMAINS";

const CLASS_TEACHER_DOMAIN_KEYS = new Set([
  "QURAN",
  "LEARNING_GARDENS",
  "NUMBERS",
  "ARABIC",
  "KG_QURAN",
  "KG_LEARNING_GARDENS",
  "KG_NUMBERS",
]);

const VALUES_DOMAIN_KEYS = new Set([
  "VALUES",
  "ASMAA_ALLAH",
  "ASMA_ALLAH",
  "NAMES_OF_ALLAH",
  "KG_VALUES",
]);

const CORNERS_DOMAIN_KEYS = new Set(["CORNERS", "ACTIVITIES", "KG_CORNERS"]);

const HOMEROOM_ASSIGNMENT_KEYS = new Set(["CLASS", "HOMEROOM"]);

function getParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function getClassTitle(item: StaffVisibleClass) {
  return item.title || item.code || item.id;
}

function getStudentCount(item: StaffVisibleClass) {
  return (
    item.studentCount ?? item.studentsCount ?? item.enrolledStudentCount ?? null
  );
}

function matchesRequestedClass(
  item: StaffVisibleClass,
  classId: string,
  schoolId: string | null,
  academicYearId: string | null,
) {
  if (item.id !== classId) return false;

  if (schoolId && item.schoolId !== schoolId) return false;
  if (academicYearId && item.academicYearId !== academicYearId) return false;

  return true;
}

function matchesClassSubjectOfferingContext(
  offering: ClassSubjectOffering,
  classInfo: StaffVisibleClass,
) {
  if (offering.classId !== classInfo.id) return false;

  if (classInfo.schoolId && offering.schoolId !== classInfo.schoolId) {
    return false;
  }

  if (
    classInfo.academicYearId &&
    offering.academicYearId !== classInfo.academicYearId
  ) {
    return false;
  }

  if (
    classInfo.gradeId &&
    offering.gradeId &&
    offering.gradeId !== classInfo.gradeId
  ) {
    return false;
  }

  return true;
}

function buildClassesHref() {
  return "/staff/classes";
}

function buildClassContextParams(item: StaffVisibleClass) {
  const params = new URLSearchParams();

  if (item.id) params.set("classId", item.id);
  if (item.schoolId) params.set("schoolId", item.schoolId);
  if (item.academicYearId) params.set("academicYearId", item.academicYearId);

  return params;
}

function buildClassDomainsAnchorHref() {
  return "#class-domains";
}

function buildNewMeasurementBatchHref(
  item: StaffVisibleClass,
  subjectContext?: {
    classSubjectOfferingId?: string;
    subjectKey?: string;
    teacherAssignmentId?: string;
  },
) {
  const params = new URLSearchParams();

  if (item.schoolId) params.set("schoolId", item.schoolId);
  if (item.academicYearId) params.set("academicYearId", item.academicYearId);

  if (subjectContext?.classSubjectOfferingId) {
    params.set("classSubjectOfferingId", subjectContext.classSubjectOfferingId);
  }

  if (subjectContext?.subjectKey) {
    params.set("subjectKey", subjectContext.subjectKey);
  }

  if (subjectContext?.teacherAssignmentId) {
    params.set("teacherAssignmentId", subjectContext.teacherAssignmentId);
  }

  const query = params.toString();

  return `/staff/classes/${encodeURIComponent(item.id)}/measurements/batches/new${
    query ? `?${query}` : ""
  }`;
}

function buildLearningLossHref(
  item: StaffVisibleClass,
  subjectContext?: {
    classSubjectOfferingId?: string;
    subjectKey?: string;
  },
) {
  const params = buildClassContextParams(item);

  if (subjectContext?.classSubjectOfferingId) {
    params.set("classSubjectOfferingId", subjectContext.classSubjectOfferingId);
  }

  if (subjectContext?.subjectKey) {
    params.set("subjectKey", subjectContext.subjectKey);
  }

  const query = params.toString();

  return `/staff/learning-loss${query ? `?${query}` : ""}`;
}

function buildManualLearningLossHref(
  item: StaffVisibleClass,
  subjectContext?: {
    classSubjectOfferingId?: string;
    subjectKey?: string;
  },
) {
  const params = buildClassContextParams(item);

  if (subjectContext?.classSubjectOfferingId) {
    params.set("classSubjectOfferingId", subjectContext.classSubjectOfferingId);
  }

  if (subjectContext?.subjectKey) {
    params.set("subjectKey", subjectContext.subjectKey);
  }

  const query = params.toString();

  return `/staff/learning-loss/manual${query ? `?${query}` : ""}`;
}

function normalizeSubjectKey(value?: string) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeStageKey(value?: string) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function isPrimaryClass(classInfo: StaffVisibleClass) {
  const schoolType = normalizeStageKey(classInfo.schoolType);
  const gradeId = normalizeStageKey(classInfo.gradeId);

  return schoolType === "PRIMARY" || /^G[1-6]$/.test(gradeId);
}

function isKgClass(classInfo: StaffVisibleClass) {
  const schoolType = normalizeStageKey(classInfo.schoolType);
  const gradeId = normalizeStageKey(classInfo.gradeId);

  return schoolType === "KG" || gradeId.startsWith("KG");
}

function getWorkspaceSubjectKey(workspace: ClassSubjectWorkspace) {
  return normalizeSubjectKey(workspace.subjectKey || workspace.subjectId);
}

function getWorkspaceGroupKey(
  workspace: ClassSubjectWorkspace,
): WorkspaceGroupKey {
  const subjectKey = getWorkspaceSubjectKey(workspace);

  if (HOMEROOM_ASSIGNMENT_KEYS.has(subjectKey)) {
    return "HOMEROOM_ASSIGNMENT";
  }

  if (CLASS_TEACHER_DOMAIN_KEYS.has(subjectKey)) {
    return "CLASS_TEACHER_DOMAINS";
  }

  if (VALUES_DOMAIN_KEYS.has(subjectKey)) {
    return "VALUES_DOMAINS";
  }

  if (CORNERS_DOMAIN_KEYS.has(subjectKey)) {
    return "CORNERS_DOMAINS";
  }

  return "OTHER_DOMAINS";
}

function isHomeroomAssignment(workspace: ClassSubjectWorkspace) {
  return getWorkspaceGroupKey(workspace) === "HOMEROOM_ASSIGNMENT";
}

function getWorkspaceGroupMeta(groupKey: WorkspaceGroupKey): {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  toneClassName: string;
} {
  switch (groupKey) {
    case "CLASS_TEACHER_DOMAINS":
      return {
        title: "مجالات معلمة الصف",
        description:
          "القرآن، بساتين المعرفة، والأرقام تُدرّس أو تُتابع من خلال معلمة الصف.",
        icon: BookOpen,
        toneClassName:
          "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
      };

    case "VALUES_DOMAINS":
      return {
        title: "مجالات القيم",
        description:
          "أسماء الله الحسنى والقيم تُتابع من خلال معلمة القيم حسب إسنادها.",
        icon: HeartHandshake,
        toneClassName:
          "bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
      };

    case "CORNERS_DOMAINS":
      return {
        title: "مجالات الأركان والأنشطة",
        description:
          "الأركان والأنشطة تُتابع من خلال معلمة الأركان حسب إسنادها.",
        icon: Sparkles,
        toneClassName:
          "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
      };

    case "HOMEROOM_ASSIGNMENT":
      return {
        title: "إسناد الفصل",
        description:
          "هذا يوضح الإسناد العام لمعلمة الصف، ولا يُستخدم كمدخل مباشر للقياسات.",
        icon: GraduationCap,
        toneClassName:
          "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      };

    case "OTHER_DOMAINS":
    default:
      return {
        title: "مواد أخرى",
        description:
          "مواد إضافية مرتبطة بالفصل، وتُعامل حسب نوعها وقوالبها المتاحة.",
        icon: Layers3,
        toneClassName:
          "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
      };
  }
}

function getWorkspaceKindLabel(groupKey: WorkspaceGroupKey) {
  switch (groupKey) {
    case "CLASS_TEACHER_DOMAINS":
      return "معلمة الصف";
    case "VALUES_DOMAINS":
      return "معلمة القيم";
    case "CORNERS_DOMAINS":
      return "معلمة الأركان";
    case "HOMEROOM_ASSIGNMENT":
      return "إسناد عام";
    case "OTHER_DOMAINS":
    default:
      return "مادة";
  }
}

function getWorkspaceActionLabel(operationKey: string) {
  switch (operationKey) {
    case "STUDENT_MEASUREMENTS":
      return "إدخال قياس / متابعة";
    case "LEARNING_LOSS":
      return "الفاقد";
    case "NOTES":
      return "ملاحظات";
    case "GAMIFICATION":
      return "تحفيز";
    case "HOMEWORK":
      return "واجبات";
    case "LESSON_PREP":
      return "تحضير";
    case "QUESTION_BANK":
      return "بنك أسئلة";
    case "CURRICULUM_PLAN":
      return "توزيع المنهج";
    case "RESOURCES":
      return "مذكرات وملحقات";
    default:
      return "";
  }
}

function buildSubjectOperationHref(params: {
  classInfo: StaffVisibleClass;
  offeringId: string;
  subjectKey: string;
  teacherAssignmentId?: string;
  operationKey: string;
}) {
  const normalizedSubjectKey = normalizeSubjectKey(params.subjectKey);

  if (HOMEROOM_ASSIGNMENT_KEYS.has(normalizedSubjectKey)) {
    return "";
  }

  const subjectContext = {
    classSubjectOfferingId: params.offeringId,
    subjectKey: params.subjectKey,
    teacherAssignmentId: params.teacherAssignmentId,
  };

  switch (params.operationKey) {
    case "STUDENT_MEASUREMENTS":
      return buildNewMeasurementBatchHref(params.classInfo, subjectContext);

    case "LEARNING_LOSS":
      return buildLearningLossHref(params.classInfo, subjectContext);

    default:
      return "";
  }
}

function buildOperationCards(classInfo: StaffVisibleClass): OperationCard[] {
  return [
    {
      title: "طلاب الفصل",
      description:
        "قائمة الطلاب النشطين داخل الفصل، وهي نقطة الانطلاق لأي تشغيل على الطالب.",
      status: "ACTIVE",
      icon: UsersRound,
      href: "#class-students",
      actionLabel: "عرض الطلاب",
    },
    {
      title: "القياسات والمتابعات",
      description:
        "ابدأ القياس أو المتابعة من المادة أو المجال المناسب داخل الفصل.",
      status: "ACTIVE",
      icon: BookOpen,
      href: buildClassDomainsAnchorHref(),
      actionLabel: "اختيار مادة",
    },
    {
      title: "الفاقد التعليمي",
      description:
        "متابعة خطط الفاقد المفتوحة، وفتح خطة تلقائية أو يدوية، وتسجيل القياس الأول والثاني.",
      status: "ACTIVE",
      icon: Target,
      href: buildLearningLossHref(classInfo),
      actionLabel: "إدارة الفاقد",
    },
    {
      title: "فتح فاقد يدوي",
      description:
        "فتح خطة فاقد لطالب من هذا السياق عند الحاجة، حتى لو لم ينتج الفاقد من قياس تلقائي.",
      status: "ACTIVE",
      icon: HeartHandshake,
      href: buildManualLearningLossHref(classInfo),
      actionLabel: "فتح يدوي",
    },
    {
      title: "حضور اليوم",
      description:
        "سيكون مدخل تسجيل حضور الفصل اليومي في Milestone 9، مع دفعة حضور وسجلات فردية.",
      status: "READY_SOON",
      icon: ClipboardCheck,
    },
    {
      title: "الملاحظات",
      description:
        "إضافة ملاحظات تشغيلية على طالب أو مجموعة طلاب من سياق الفصل في مرحلة لاحقة.",
      status: "FUTURE",
      icon: MessageSquareText,
    },
    {
      title: "القضايا والإحالات",
      description:
        "إحالة طالب أو متابعة قضية من سياق الفصل حسب الصلاحية ومسار الإحالة.",
      status: "FUTURE",
      icon: FileText,
    },
    {
      title: "التحفيز",
      description: "تحفيز طالب أو مجموعة طلاب وربط النقاط أو الشارات لاحقًا.",
      status: "FUTURE",
      icon: Sparkles,
    },
  ];
}

function getSubjectOperationIcon(operationKey: string) {
  switch (operationKey) {
    case "STUDENT_MEASUREMENTS":
      return ClipboardCheck;

    case "LEARNING_LOSS":
      return Target;

    case "HOMEWORK":
    case "LESSON_PREP":
    case "QUESTION_BANK":
    case "CURRICULUM_PLAN":
    case "RESOURCES":
      return FileText;

    case "GAMIFICATION":
      return Sparkles;

    case "NOTES":
      return MessageSquareText;

    default:
      return BookOpen;
  }
}

function getCurrentTermForClass(
  actor: StaffActorLike | null,
  classInfo: StaffVisibleClass | null,
) {
  const academicYearId = classInfo?.academicYearId || "";

  if (!actor || !academicYearId) return null;

  return (
    actor.currentTermsByAcademicYear?.[academicYearId] ??
    actor.currentTerm ??
    null
  );
}

function getTermDisplayTitle(term: StaffActorCurrentTerm | null) {
  if (!term) return "غير محدد";
  return term.title || term.shortTitle || term.id;
}

export default function StaffClassDetailsPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const { actor } = useStaffActor();
  const staffActor = actor as StaffActorLike | null;

  const classId = decodeURIComponent(getParamValue(params.classId));
  const schoolId = searchParams.get("schoolId");
  const academicYearId = searchParams.get("academicYearId");

  const classes = useMemo(() => {
    return staffActor?.visibleClasses ?? [];
  }, [staffActor]);

  const classInfo = useMemo(() => {
    return (
      classes.find((item) =>
        matchesRequestedClass(item, classId, schoolId, academicYearId),
      ) ??
      classes.find((item) => item.id === classId) ??
      null
    );
  }, [classes, classId, schoolId, academicYearId]);

  const currentTerm = useMemo(() => {
    return getCurrentTermForClass(staffActor, classInfo);
  }, [staffActor, classInfo]);

  const contextualClassSubjectOfferings = useMemo(() => {
    if (!staffActor || !classInfo) return [];

    return (staffActor.classSubjectOfferings ?? []).filter((offering) =>
      matchesClassSubjectOfferingContext(offering, classInfo),
    );
  }, [staffActor, classInfo]);

  const classSubjectWorkspaces = useMemo(() => {
    if (!staffActor || !classInfo) return [];

    return buildClassSubjectWorkspaces({
      actorPersonId: staffActor.personId || staffActor.uid || "",
      actorRoleKeys: staffActor.roles ?? [],
      classId: classInfo.id,
      classSubjectOfferings: contextualClassSubjectOfferings,
      teacherAssignments: staffActor.teacherAssignments ?? [],
      teacherAssignmentClassLinks: staffActor.teacherAssignmentClassLinks ?? [],
      includeInactiveOfferingsForAdmins: false,
    });
  }, [staffActor, classInfo, contextualClassSubjectOfferings]);

  const resolvedOrgId = classInfo?.orgId || staffActor?.orgId || "";
  const resolvedSchoolId = classInfo?.schoolId || schoolId || "";
  const resolvedAcademicYearId =
    classInfo?.academicYearId || academicYearId || "";

  const classStudents = useClassStudents({
    orgId: resolvedOrgId,
    classId,
    schoolId: resolvedSchoolId,
    academicYearId: resolvedAcademicYearId,
    enabled: !!classInfo && !!resolvedOrgId,
  });

  const operationCards = useMemo(() => {
    return classInfo ? buildOperationCards(classInfo) : [];
  }, [classInfo]);

  if (!staffActor) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-slate-50 p-4 text-slate-950 dark:bg-slate-950 dark:text-slate-50 sm:p-6"
      >
        <section className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              جاري تحميل بيانات المستخدم...
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (!classInfo) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-slate-50 p-4 text-slate-950 dark:bg-slate-950 dark:text-slate-50 sm:p-6"
      >
        <section className="mx-auto flex max-w-7xl flex-col gap-6">
          <Link
            href={buildClassesHref()}
            className="inline-flex w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowRight className="h-4 w-4" />
            الرجوع إلى فصولي
          </Link>

          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <h1 className="mt-4 text-xl font-bold">الفصل غير موجود</h1>

            <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-amber-900 dark:text-amber-100">
              لم يتم العثور على هذا الفصل داخل{" "}
              <span className="font-mono">actor.visibleClasses</span>. قد يكون
              الفصل خارج نطاق المستخدم أو أن الرابط لا يحتوي على المدرسة والسنة
              الصحيحة.
            </p>

            <div className="mt-5 rounded-2xl bg-white/70 p-4 text-sm text-amber-900 dark:bg-slate-950/40 dark:text-amber-100">
              <span className="font-semibold">classId:</span>{" "}
              <span className="font-mono">{classId}</span>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const estimatedStudentCount = getStudentCount(classInfo);
  const studentCount = classStudents.data?.totalCount ?? estimatedStudentCount;

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 p-4 text-slate-950 dark:bg-slate-950 dark:text-slate-50 sm:p-6"
    >
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-4">
          <Link
            href={buildClassesHref()}
            className="inline-flex w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowRight className="h-4 w-4" />
            الرجوع إلى فصولي
          </Link>

          <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 bg-gradient-to-l from-emerald-50 via-white to-white p-6 dark:border-slate-800 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 sm:p-8">
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                    <Layers3 className="h-3.5 w-3.5" />
                    مركز تشغيل الفصل
                  </div>

                  <div className="space-y-2">
                    <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">
                      {getClassTitle(classInfo)}
                    </h1>

                    <p className="max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-400">
                      هذه صفحة التشغيل اليومية للفصل: الطلاب، مواد الفصل،
                      القياسات والمتابعات، الفاقد التعليمي، ثم لاحقًا الحضور
                      والملاحظات والقضايا والتحفيز.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <a
                      href={buildClassDomainsAnchorHref()}
                      className="inline-flex h-10 items-center justify-center rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                    >
                      اختيار مادة / مجال
                    </a>

                    <Link
                      href={buildLearningLossHref(classInfo)}
                      className="inline-flex h-10 items-center justify-center rounded-2xl border border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50 dark:border-emerald-900 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                    >
                      الفاقد التعليمي
                    </Link>

                    <Link
                      href={buildManualLearningLossHref(classInfo)}
                      className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      فتح فاقد يدوي
                    </Link>
                  </div>
                </div>

                {classInfo.sectionLabel ? (
                  <div className="w-fit rounded-3xl bg-slate-950 px-5 py-3 text-white dark:bg-slate-50 dark:text-slate-950">
                    <p className="text-xs opacity-70">الشعبة</p>
                    <p className="text-2xl font-bold">
                      {classInfo.sectionLabel}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-5">
              <SummaryCard
                icon={School}
                label="المدرسة"
                value={classInfo.schoolName || classInfo.schoolId || "غير محدد"}
              />

              <SummaryCard
                icon={CalendarDays}
                label="السنة الدراسية"
                value={
                  classInfo.academicYearTitle ||
                  classInfo.academicYearId ||
                  "غير محدد"
                }
              />

              <SummaryCard
                icon={CalendarDays}
                label="الفصل الدراسي"
                value={getTermDisplayTitle(currentTerm)}
              />

              <SummaryCard
                icon={GraduationCap}
                label="الصف / المستوى"
                value={classInfo.gradeTitle || classInfo.gradeId || "غير محدد"}
              />

              <SummaryCard
                icon={UsersRound}
                label="الطلاب"
                value={
                  classStudents.loading
                    ? "جاري القراءة..."
                    : studentCount !== null
                      ? `${studentCount} طالب`
                      : classInfo.capacity
                        ? `السعة ${classInfo.capacity}`
                        : "لا يوجد طلاب"
                }
              />
            </div>
          </div>
        </div>

        {!currentTerm ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
            لم يتم تحديد الفصل الدراسي الحالي لهذه السنة الدراسية. راجع إعدادات
            السنة الدراسية أو seed الخاص بـ academic terms.
          </div>
        ) : null}

        {isPrimaryClass(classInfo) ? (
          <PrimaryClassSubjectsSection
            classInfo={classInfo}
            workspaces={classSubjectWorkspaces}
          />
        ) : (
          <ClassSubjectWorkspacesSection
            classInfo={classInfo}
            workspaces={classSubjectWorkspaces}
          />
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-1">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
              </div>

              <div>
                <h2 className="font-bold">بيانات الفصل</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  مصدرها actor.visibleClasses
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-2 text-sm">
              <InfoRow label="معرّف الفصل" value={classInfo.id} />
              <InfoRow label="الكود" value={classInfo.code || "غير محدد"} />
              <InfoRow
                label="المدرسة"
                value={classInfo.schoolId || "غير محدد"}
              />
              <InfoRow
                label="السنة"
                value={classInfo.academicYearId || "غير محدد"}
              />
              <InfoRow
                label="الفصل الدراسي"
                value={getTermDisplayTitle(currentTerm)}
              />
              <InfoRow label="الصف" value={classInfo.gradeId || "غير محدد"} />
              <InfoRow
                label="المسار"
                value={classInfo.streamId || "غير محدد"}
              />
              <InfoRow
                label="الترتيب"
                value={
                  typeof classInfo.order === "number"
                    ? String(classInfo.order)
                    : "غير محدد"
                }
              />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-sky-50 p-3 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                <HeartHandshake className="h-5 w-5" />
              </div>

              <div>
                <h2 className="font-bold">مساحات تشغيل الفصل العامة</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  هذه العمليات على مستوى الفصل عمومًا، أما العمليات المرتبطة
                  بمادة أو مجال فتظهر في الكروت بالأعلى.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {operationCards.map((item) => (
                <OperationWorkspaceCard key={item.title} item={item} />
              ))}
            </div>
          </div>
        </div>

        <ClassStudentsSection
          data={classStudents.data}
          loading={classStudents.loading}
          error={classStudents.error}
          measurementHref={buildClassDomainsAnchorHref()}
          learningLossHref={buildLearningLossHref(classInfo)}
        />
      </section>
    </main>
  );
}

function ClassSubjectWorkspacesSection({
  classInfo,
  workspaces,
}: {
  classInfo: StaffVisibleClass;
  workspaces: ReturnType<typeof buildClassSubjectWorkspaces>;
}) {
  const groups = useMemo(() => {
    const order: WorkspaceGroupKey[] = [
      "CLASS_TEACHER_DOMAINS",
      "VALUES_DOMAINS",
      "CORNERS_DOMAINS",
      "OTHER_DOMAINS",
      "HOMEROOM_ASSIGNMENT",
    ];

    const map = new Map<WorkspaceGroupKey, ClassSubjectWorkspace[]>();

    for (const groupKey of order) {
      map.set(groupKey, []);
    }

    for (const workspace of workspaces) {
      const groupKey = getWorkspaceGroupKey(workspace);
      map.get(groupKey)?.push(workspace);
    }

    return order
      .map((groupKey) => ({
        groupKey,
        items: map.get(groupKey) ?? [],
      }))
      .filter((group) => group.items.length > 0);
  }, [workspaces]);

  const operationalDomainsCount = workspaces.filter(
    (workspace) => !isHomeroomAssignment(workspace),
  ).length;

  return (
    <div
      id="class-domains"
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div className="flex items-center gap-5">
          <div className="rounded-2xl bg-violet-50 p-3 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
            <BookOpen className="h-5 w-5" />
          </div>

          <div>
            <h2 className="font-bold">مواد / مجالات الفصل</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              المواد والمجالات المتاحة داخل الفصل حسب إسنادك وصلاحياتك.
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-950 dark:text-slate-200">
          {operationalDomainsCount} عنصر تشغيلي
        </div>
      </div>

      {workspaces.length === 0 ? (
        <div className="mt-5 rounded-3xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
          <h3 className="font-bold">
            لا توجد مواد أو مجالات متاحة لك داخل هذا الفصل
          </h3>
          <p className="mt-2 text-sm leading-7 text-slate-500 dark:text-slate-400">
            تأكد من وجود ClassSubjectOffering للفصل، ومن ربط المستخدم بالمادة
            المناسبة من خلال TeacherAssignment أو TeacherAssignmentClassLink.
          </p>
        </div>
      ) : groups.length === 0 ? (
        <div className="mt-5 rounded-3xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
          <h3 className="font-bold">لا توجد عناصر تشغيلية ظاهرة</h3>
          <p className="mt-2 text-sm leading-7 text-slate-500 dark:text-slate-400">
            قد تكون البيانات الحالية تحتوي على إسناد فصل عام فقط، وليس على مواد
            أو مجالات تشغيلية.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {groups.map((group) => {
            const meta = getWorkspaceGroupMeta(group.groupKey);
            const Icon = meta.icon;

            return (
              <section
                key={group.groupKey}
                className="mb-4 rounded-3xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-2xl p-3 ${meta.toneClassName}`}>
                      <Icon className="h-5 w-5" />
                    </div>

                    <div>
                      <h3 className="font-bold">{meta.title}</h3>
                      <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {meta.description}
                      </p>
                    </div>
                  </div>

                  <span className="w-fit rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800">
                    {group.items.length.toLocaleString("ar-SA")} عنصر
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((workspace) => (
                    <ClassSubjectWorkspaceCard
                      key={workspace.offeringId}
                      classInfo={classInfo}
                      workspace={workspace}
                      groupKey={group.groupKey}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClassSubjectWorkspaceCard({
  classInfo,
  workspace,
  groupKey,
}: {
  classInfo: StaffVisibleClass;
  workspace: ClassSubjectWorkspace;
  groupKey: WorkspaceGroupKey;
}) {
  const isHomeroom = groupKey === "HOMEROOM_ASSIGNMENT";
  const availableOperations = isHomeroom
    ? []
    : (workspace.availableOperations ?? []);

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold">
            {workspace.displayName || workspace.subjectTitle}
          </h3>

          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
            {workspace.subjectKey || workspace.subjectId}
          </p>
        </div>

        <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900">
          {workspace.status === "ACTIVE" ? "نشطة" : workspace.status}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
          {getWorkspaceKindLabel(groupKey)}
        </span>

        {isHomeroom ? (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900">
            ليس مدخل قياس
          </span>
        ) : null}
      </div>

      {isHomeroom ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          هذا إسناد عام للفصل. إدخال القياسات والمتابعات يتم من مادة أو مجال
          محدد.
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {availableOperations.length === 0 ? (
            <span className="rounded-2xl bg-slate-100 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              لا توجد عمليات متاحة الآن
            </span>
          ) : null}

          {availableOperations.map((operation) => {
            const Icon = getSubjectOperationIcon(operation.operationKey);
            const href = buildSubjectOperationHref({
              classInfo,
              offeringId: workspace.offeringId,
              subjectKey: workspace.subjectKey,
              teacherAssignmentId: workspace.teacherAssignmentIds?.[0],
              operationKey: operation.operationKey,
            });

            const content = (
              <>
                <Icon className="h-3.5 w-3.5" />
                {getWorkspaceActionLabel(operation.operationKey) ||
                  operation.title}
              </>
            );

            if (!href) {
              return (
                <span
                  key={operation.operationKey}
                  className="inline-flex h-9 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-400 dark:border-slate-800 dark:bg-slate-900"
                >
                  {content}
                </span>
              );
            }

            return (
              <Link
                key={operation.operationKey}
                href={href}
                className={
                  operation.isPrimary
                    ? "inline-flex h-9 items-center gap-1.5 rounded-2xl bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700"
                    : "inline-flex h-9 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                }
              >
                {content}
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-4 grid gap-2 text-xs">
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-950">
          <span className="text-slate-500 dark:text-slate-400">الإسنادات</span>
          <span className="font-semibold">
            {workspace.teacherAssignmentIds.length}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-950">
          <span className="text-slate-500 dark:text-slate-400">offering</span>
          <span className="max-w-[10rem] truncate font-mono">
            {workspace.offeringId}
          </span>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-white p-3 text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 truncate font-bold text-slate-950 dark:text-slate-50">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 px-3 py-2 dark:border-slate-800">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="truncate text-left font-medium text-slate-800 dark:text-slate-100">
        {value}
      </span>
    </div>
  );
}

function OperationWorkspaceCard({ item }: { item: OperationCard }) {
  const Icon = item.icon;

  const content = (
    <div className="group rounded-3xl border border-slate-100 bg-slate-50 p-4 transition hover:border-emerald-200 hover:bg-white dark:border-slate-800 dark:bg-slate-950 dark:hover:border-emerald-900 dark:hover:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="rounded-2xl bg-white p-3 text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
            <Icon className="h-5 w-5" />
          </div>

          <div>
            <h3 className="font-bold">{item.title}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {item.description}
            </p>
          </div>
        </div>

        <ChevronLeft className="mt-1 h-4 w-4 text-slate-300 transition group-hover:text-emerald-500" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800">
          {item.status === "ACTIVE"
            ? "مفعل الآن"
            : item.status === "READY_SOON"
              ? "قادم في Milestone 9"
              : "مرحلة لاحقة"}
        </span>

        {item.actionLabel ? (
          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900">
            {item.actionLabel}
          </span>
        ) : null}
      </div>
    </div>
  );

  if (!item.href) {
    return <div className="opacity-80">{content}</div>;
  }

  if (item.href.startsWith("#")) {
    return <a href={item.href}>{content}</a>;
  }

  return <Link href={item.href}>{content}</Link>;
}

function ClassStudentsSection({
  data,
  loading,
  error,
  measurementHref,
  learningLossHref,
}: {
  data: ClassStudentsData | null;
  loading: boolean;
  error: string | null;
  measurementHref: string;
  learningLossHref: string;
}) {
  const rows = data?.rows ?? [];

  return (
    <div
      id="class-students"
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
            <UsersRound className="h-5 w-5" />
          </div>

          <div>
            <h2 className="font-bold">طلاب الفصل</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              الطلاب النشطون داخل هذا الفصل.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={measurementHref}
            className="inline-flex h-9 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            إدخال قياس
          </a>

          <Link
            href={learningLossHref}
            className="inline-flex h-9 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            الفاقد
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="mt-5 rounded-3xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            جاري تحميل الطلاب...
          </p>
        </div>
      ) : error ? (
        <div className="mt-5 rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm leading-7 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-5 rounded-3xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
          <h3 className="font-bold">لا يوجد طلاب ظاهرون في هذا الفصل</h3>
          <p className="mt-2 text-sm leading-7 text-slate-500 dark:text-slate-400">
            إذا كان الفصل به طلاب، راجع تسجيلات الطلاب أو صلاحيات قراءة
            studentEnrollments.
          </p>
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-3xl border border-slate-100 dark:border-slate-800">
          <div className="hidden grid-cols-[1.5fr_1fr_1fr] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500 dark:bg-slate-950 dark:text-slate-400 md:grid">
            <span>الطالب</span>
            <span>القيد</span>
            <span>الحالة</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row) => (
              <div
                key={row.studentId}
                className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[1.5fr_1fr_1fr]"
              >
                <div>
                  <p className="font-semibold text-slate-950 dark:text-slate-50">
                    {row.displayName || row.studentId}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {row.studentId}
                  </p>
                </div>

                <div className="text-slate-600 dark:text-slate-300">
                  {row.enrollmentId || "غير محدد"}
                </div>

                <div>
                  <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900">
                    نشط
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
