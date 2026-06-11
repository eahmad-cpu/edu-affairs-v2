"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  FileText,
  GraduationCap,
  Layers3,
  Plus,
  RefreshCw,
  School,
  Target,
  UsersRound,
} from "lucide-react";
import type { ComponentType } from "react";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import type { StudentMeasurementBatch } from "@takween/contracts";

import { db } from "@/lib/firebase";
import { useStaffActor } from "@/components/staff/staff-actor-provider";

type StaffVisibleClass = {
  id: string;
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

type StaffActorLike = {
  orgId?: string;
  visibleClasses?: StaffVisibleClass[];
};

type MeasurementBatchDoc = StudentMeasurementBatch & {
  id: string;
  isCompensationBatch?: boolean;
  originalBatchId?: string;
  compensationReason?: string;
};

type LoadingState = "idle" | "loading" | "success" | "error";

type MeasurementActionCard = {
  title: string;
  description: string;
  status: "ACTIVE" | "READY_SOON" | "FUTURE";
  icon: ComponentType<{ className?: string }>;
  href?: string;
  actionLabel?: string;
};

function getParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "حدث خطأ غير متوقع";
}

function getClassTitle(item: StaffVisibleClass) {
  return item.title || item.code || item.id;
}

function getStudentCount(item: StaffVisibleClass) {
  return (
    item.studentCount ??
    item.studentsCount ??
    item.enrolledStudentCount ??
    null
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

function buildClassQuery(item: StaffVisibleClass) {
  const params = new URLSearchParams();

  if (item.schoolId) params.set("schoolId", item.schoolId);
  if (item.academicYearId) params.set("academicYearId", item.academicYearId);

  const queryString = params.toString();

  return queryString ? `?${queryString}` : "";
}

function buildClassHref(item: StaffVisibleClass) {
  return `/staff/classes/${encodeURIComponent(item.id)}${buildClassQuery(item)}`;
}

function buildStudentsHref() {
  return "/staff/students";
}

function buildBatchNewHref(item: StaffVisibleClass) {
  return `/staff/classes/${encodeURIComponent(
    item.id,
  )}/measurements/batches/new${buildClassQuery(item)}`;
}

function buildBatchViewHref(batchId: string) {
  return `/staff/measurements/batches/${batchId}`;
}

function buildBatchEditHref(batchId: string) {
  return `/staff/measurements/batches/${batchId}/edit`;
}

function buildLearningLossHref(item: StaffVisibleClass) {
  const params = new URLSearchParams();

  if (item.id) params.set("classId", item.id);
  if (item.schoolId) params.set("schoolId", item.schoolId);
  if (item.academicYearId) params.set("academicYearId", item.academicYearId);

  const queryString = params.toString();

  return `/staff/learning-loss${queryString ? `?${queryString}` : ""}`;
}

function formatDate(value?: number) {
  if (!value) return "غير محدد";

  try {
    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "غير محدد";
  }
}

function getBatchKindLabel(value?: string) {
  switch (value) {
    case "ASSESSMENT":
      return "قياس رسمي";
    case "TRACKER":
      return "متابعة";
    case "KG_VALUES":
      return "قيم";
    case "KG_CORNERS":
      return "أركان";
    case "KG_QURAN":
      return "قرآن";
    case "LEARNING_LOSS_TRACKER":
      return "متابعة فاقد";
    case "CUSTOM":
      return "مخصص";
    default:
      return value || "غير محدد";
  }
}

function getBatchStatusLabel(value?: string) {
  switch (value) {
    case "DRAFT":
      return "مسودة";
    case "IN_PROGRESS":
      return "قيد الإدخال";
    case "SUBMITTED":
      return "مرسلة";
    case "REVIEWED":
      return "تمت مراجعتها";
    case "LOCKED":
      return "مقفلة";
    case "CANCELLED":
      return "ملغاة";
    default:
      return value || "غير محدد";
  }
}

function getBatchStatusTone(value?: string) {
  switch (value) {
    case "DRAFT":
    case "IN_PROGRESS":
      return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900";
    case "SUBMITTED":
    case "REVIEWED":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900";
    case "LOCKED":
      return "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";
    case "CANCELLED":
      return "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";
  }
}

function isEditableBatch(batch: MeasurementBatchDoc) {
  return batch.status === "DRAFT" || batch.status === "IN_PROGRESS";
}

function isSameClassContext(batch: MeasurementBatchDoc, classInfo: StaffVisibleClass) {
  if (batch.classId !== classInfo.id) return false;

  if (classInfo.schoolId && batch.schoolId && batch.schoolId !== classInfo.schoolId) {
    return false;
  }

  if (
    classInfo.academicYearId &&
    batch.academicYearId &&
    batch.academicYearId !== classInfo.academicYearId
  ) {
    return false;
  }

  return true;
}

function buildMeasurementActionCards(
  classInfo: StaffVisibleClass,
): MeasurementActionCard[] {
  return [
    {
      title: "إدخال قياس / متابعة",
      description:
        "بدء دفعة جديدة لطلاب الفصل، ثم حفظها كمسودة أو إرسالها لإنشاء السجلات الفردية.",
      status: "ACTIVE",
      icon: Plus,
      href: buildBatchNewHref(classInfo),
      actionLabel: "بدء دفعة",
    },
    {
      title: "دفعات القياس",
      description:
        "عرض المسودات والدفعات المرسلة، وفتح أي دفعة للعرض أو التعديل إذا كانت ما زالت مسودة.",
      status: "ACTIVE",
      icon: FileText,
      actionLabel: "مفعّل",
    },
    {
      title: "الدفعات التعويضية",
      description:
        "الدفعات التعويضية للغائبين والمعذورين تظهر هنا ضمن دفعات الفصل، وتُفتح من صفحة الدفعة الأصلية.",
      status: "ACTIVE",
      icon: ClipboardList,
      actionLabel: "مفعّل",
    },
    {
      title: "الفاقد التعليمي",
      description:
        "فتح صفحة الفاقد لعرض الخطط المفتوحة والطلاب المرشحين ضمن هذا الفصل.",
      status: "ACTIVE",
      icon: Target,
      href: buildLearningLossHref(classInfo),
      actionLabel: "إدارة الفاقد",
    },
    {
      title: "ملخص الأداء",
      description:
        "لاحقًا سنعرض ملخصًا تحليليًا للدرجات ونسب الإكمال ومؤشرات الفاقد على مستوى الفصل.",
      status: "FUTURE",
      icon: BarChart3,
    },
  ];
}

export default function StaffClassMeasurementsPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const { actor } = useStaffActor();
  const staffActor = actor as StaffActorLike | null;

  const classId = decodeURIComponent(getParamValue(params.classId));
  const schoolId = searchParams.get("schoolId");
  const academicYearId = searchParams.get("academicYearId");

  const [batchesStatus, setBatchesStatus] = useState<LoadingState>("idle");
  const [batchesError, setBatchesError] = useState<string | null>(null);
  const [batches, setBatches] = useState<MeasurementBatchDoc[]>([]);

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

  const resolvedOrgId = classInfo?.orgId || staffActor?.orgId || "";

  const measurementActions = useMemo(() => {
    return classInfo ? buildMeasurementActionCards(classInfo) : [];
  }, [classInfo]);

  const loadBatches = useCallback(async () => {
    if (!resolvedOrgId || !classInfo) return;

    setBatchesStatus("loading");
    setBatchesError(null);

    try {
      const batchesRef = collection(
        db,
        "orgs",
        resolvedOrgId,
        "studentMeasurementBatches",
      );

      const batchesQuery = query(
        batchesRef,
        where("classId", "==", classInfo.id),
      );

      const batchesSnap = await getDocs(batchesQuery);

      const loadedBatches = batchesSnap.docs
        .map((item) => {
          return {
            id: item.id,
            ...(item.data() as Omit<MeasurementBatchDoc, "id">),
          };
        })
        .filter((item) => isSameClassContext(item, classInfo))
        .sort((a, b) => {
          const aDate = a.updatedAt ?? a.createdAt ?? a.measuredAt ?? 0;
          const bDate = b.updatedAt ?? b.createdAt ?? b.measuredAt ?? 0;

          return bDate - aDate;
        });

      setBatches(loadedBatches);
      setBatchesStatus("success");
    } catch (error: unknown) {
      setBatches([]);
      setBatchesError(getErrorMessage(error));
      setBatchesStatus("error");
    }
  }, [resolvedOrgId, classInfo]);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  const batchesSummary = useMemo(() => {
    const total = batches.length;
    const drafts = batches.filter(
      (item) => item.status === "DRAFT" || item.status === "IN_PROGRESS",
    ).length;
    const submitted = batches.filter(
      (item) => item.status === "SUBMITTED" || item.status === "REVIEWED",
    ).length;
    const compensation = batches.filter(
      (item) => item.isCompensationBatch === true,
    ).length;

    const totalTargets = batches.reduce((sum, item) => {
      return sum + (typeof item.targetCount === "number" ? item.targetCount : 0);
    }, 0);

    const completedTargets = batches.reduce((sum, item) => {
      return (
        sum + (typeof item.completedCount === "number" ? item.completedCount : 0)
      );
    }, 0);

    return {
      total,
      drafts,
      submitted,
      compensation,
      totalTargets,
      completedTargets,
    };
  }, [batches]);

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
            href="/staff/classes"
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
              <span className="font-mono">actor.visibleClasses</span>. تأكد من
              أن الرابط يحتوي على المدرسة والسنة الصحيحة.
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

  const studentCount = getStudentCount(classInfo);

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 p-4 text-slate-950 dark:bg-slate-950 dark:text-slate-50 sm:p-6"
    >
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildClassHref(classInfo)}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowRight className="h-4 w-4" />
            الرجوع إلى الفصل
          </Link>

          <Link
            href="/staff/classes"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <BookOpen className="h-4 w-4" />
            فصولي
          </Link>

          <Link
            href={buildStudentsHref()}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <UsersRound className="h-4 w-4" />
            طلابي
          </Link>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 bg-gradient-to-l from-emerald-50 via-white to-white p-6 dark:border-slate-800 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 sm:p-8">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                  <Layers3 className="h-3.5 w-3.5" />
                  قياسات ومتابعات الفصل
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">
                    قياسات ومتابعات {getClassTitle(classInfo)}
                  </h1>

                  <p className="max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-400">
                    هذه الصفحة أصبحت مركز قياسات الفصل: تبدأ منها دفعة جديدة،
                    وتراجع المسودات والدفعات المرسلة، وتفتح الدفعات التعويضية
                    والفاقد التعليمي المرتبط بهذا الفصل.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={buildBatchNewHref(classInfo)}
                  className="inline-flex w-fit items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
                >
                  <Plus className="h-4 w-4" />
                  إدخال نتائج قياس
                </Link>

                <Link
                  href={buildLearningLossHref(classInfo)}
                  className="inline-flex w-fit items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-5 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50 dark:border-emerald-900 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                >
                  <Target className="h-4 w-4" />
                  الفاقد التعليمي
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
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
              icon={GraduationCap}
              label="الصف / المستوى"
              value={classInfo.gradeTitle || classInfo.gradeId || "غير محدد"}
            />

            <SummaryCard
              icon={UsersRound}
              label="الطلاب"
              value={
                studentCount !== null
                  ? `${studentCount} طالب`
                  : classInfo.capacity
                    ? `السعة ${classInfo.capacity}`
                    : "يربط من التسجيلات"
              }
            />
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          <MetricCard label="إجمالي الدفعات" value={batchesSummary.total} />
          <MetricCard label="مسودات" value={batchesSummary.drafts} />
          <MetricCard label="مرسلة / مراجعة" value={batchesSummary.submitted} />
          <MetricCard label="تعويضية" value={batchesSummary.compensation} />
          <MetricCard label="طلاب مستهدفون" value={batchesSummary.totalTargets} />
          <MetricCard label="مكتملون" value={batchesSummary.completedTargets} />
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-1">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
              </div>

              <div>
                <h2 className="font-bold">قرار التشغيل</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  web-staff يدخل النتائج فقط
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-3xl bg-slate-50 p-4 text-sm leading-7 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
              <p>
                إنشاء وإدارة قوالب القياس والمتابعة يكون في{" "}
                <span className="font-semibold">web-admin</span>.
              </p>

              <p className="mt-3">
                أما هذه الصفحة فتستخدم القوالب الموجودة لبدء{" "}
                <span className="font-semibold">دفعة إدخال نتائج</span> أو
                متابعة دفعات تم إنشاؤها بالفعل.
              </p>

              <p className="mt-3">
                الدفعة المرسلة تنشئ سجلات فردية، أما المسودة فتبقى داخل
                StudentMeasurementBatch فقط.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-sky-50 p-3 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                <ClipboardList className="h-5 w-5" />
              </div>

              <div>
                <h2 className="font-bold">مساحات القياس</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  ما تم تفعيله الآن داخل Milestone 7 و 8.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {measurementActions.map((item) => (
                <MeasurementActionCard key={item.title} item={item} />
              ))}
            </div>
          </div>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 dark:border-slate-800 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-violet-50 p-3 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                <FileText className="h-5 w-5" />
              </div>

              <div>
                <h2 className="font-bold">دفعات القياس السابقة</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  المسودات والدفعات المرسلة والدفعات التعويضية الخاصة بهذا
                  الفصل.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadBatches()}
              disabled={batchesStatus === "loading"}
              className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" />
              {batchesStatus === "loading" ? "جاري التحديث..." : "تحديث"}
            </button>
          </div>

          {batchesError ? (
            <div className="m-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-7 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100">
              حدث خطأ أثناء قراءة الدفعات: {batchesError}
            </div>
          ) : null}

          {batchesStatus === "loading" ? (
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-40 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800"
                />
              ))}
            </div>
          ) : batches.length === 0 ? (
            <div className="p-5">
              <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  <FileText className="h-6 w-6" />
                </div>

                <h3 className="mt-4 font-bold">لا توجد دفعات قياس بعد</h3>

                <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-slate-500 dark:text-slate-400">
                  ابدأ أول دفعة قياس أو متابعة لهذا الفصل، ثم ستظهر هنا
                  المسودات والدفعات المرسلة والدفعات التعويضية.
                </p>

                <Link
                  href={buildBatchNewHref(classInfo)}
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4" />
                  إنشاء أول دفعة
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 p-5 lg:grid-cols-2">
              {batches.map((batch) => (
                <BatchCard key={batch.id} batch={batch} />
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
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

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950 dark:text-slate-50">
        {value.toLocaleString("ar-SA")}
      </p>
    </div>
  );
}

function MeasurementActionCard({ item }: { item: MeasurementActionCard }) {
  const Icon = item.icon;

  const content = (
    <div className="group h-full rounded-3xl border border-slate-100 bg-slate-50 p-4 transition hover:border-emerald-200 hover:bg-white dark:border-slate-800 dark:bg-slate-950 dark:hover:border-emerald-900 dark:hover:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-2xl bg-white p-3 text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
          <Icon className="h-5 w-5" />
        </div>

        {item.href ? (
          <ChevronLeft className="mt-1 h-4 w-4 text-slate-300 transition group-hover:text-emerald-500" />
        ) : null}
      </div>

      <h3 className="mt-4 font-bold">{item.title}</h3>

      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
        {item.description}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800">
          {item.status === "ACTIVE"
            ? "مفعل الآن"
            : item.status === "READY_SOON"
              ? "قادم قريبًا"
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

  if (!item.href) return content;

  return <Link href={item.href}>{content}</Link>;
}

function BatchCard({ batch }: { batch: MeasurementBatchDoc }) {
  const latestDate = batch.updatedAt ?? batch.createdAt ?? batch.measuredAt;
  const editable = isEditableBatch(batch);

  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getBatchStatusTone(
                batch.status,
              )}`}
            >
              {getBatchStatusLabel(batch.status)}
            </span>

            {batch.isCompensationBatch === true ? (
              <span className="inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900">
                دفعة تعويضية
              </span>
            ) : null}
          </div>

          <h3 className="mt-3 truncate text-lg font-bold">
            {batch.templateTitle || batch.templateId || "دفعة قياس"}
          </h3>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {getBatchKindLabel(batch.batchKind)} —{" "}
            {batch.assessmentSlot || batch.assessmentKind || batch.trackerKind || "غير محدد"}
          </p>
        </div>

        <div className="text-sm text-slate-500 dark:text-slate-400">
          {formatDate(latestDate)}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MiniInfo label="المستهدفون" value={batch.targetCount ?? 0} />
        <MiniInfo label="المكتمل" value={batch.completedCount ?? 0} />
        <MiniInfo label="الناقص" value={batch.missingCount ?? 0} />
      </div>

      {batch.isCompensationBatch === true && batch.originalBatchId ? (
        <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-3 text-xs leading-6 text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-200">
          منشأة من الدفعة الأصلية:
          <span className="mx-1 font-mono">{batch.originalBatchId}</span>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={buildBatchViewHref(batch.id)}
          className="inline-flex h-10 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-950 dark:hover:bg-slate-200"
        >
          عرض الدفعة
        </Link>

        <Link
          href={buildBatchEditHref(batch.id)}
          className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {editable ? "إدخال / تعديل" : "فتح صفحة الإدخال"}
        </Link>
      </div>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white p-3 text-center dark:bg-slate-900">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-950 dark:text-slate-50">
        {value.toLocaleString("ar-SA")}
      </p>
    </div>
  );
}