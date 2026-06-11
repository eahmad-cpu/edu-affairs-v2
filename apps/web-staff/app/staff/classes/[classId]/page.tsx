"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";

import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  HeartHandshake,
  Layers3,
  School,
  UsersRound,
} from "lucide-react";

import { buildClassSubjectWorkspaces } from "@takween/domain";

import { useStaffActor } from "@/components/staff/staff-actor-provider";
import { PrimaryClassSubjectsSection } from "@/components/staff/classes/primary-class-subjects-section";
import { useClassStudents } from "@/hooks/use-class-students";

import {
  InfoRow,
  OperationWorkspaceCard,
  SummaryCard,
} from "./_components/class-page-cards";
import {
  buildClassDomainsAnchorHref,
  buildClassesHref,
  buildLearningLossHref,
  buildManualLearningLossHref,
  buildOperationCards,
  getClassTitle,
  getCurrentTermForClass,
  getParamValue,
  getStudentCount,
  getTermDisplayTitle,
  isPrimaryClass,
  matchesClassSubjectOfferingContext,
  matchesRequestedClass,
} from "./_components/class-page-helpers";
import { ClassStudentsSection } from "./_components/class-students-section";
import { ClassSubjectWorkspacesSection } from "./_components/class-subject-workspaces-section";
import type { StaffActorLike } from "./_components/class-page-types";

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
            currentTerm={currentTerm}
          />
        ) : (
          <ClassSubjectWorkspacesSection
            classInfo={classInfo}
            workspaces={classSubjectWorkspaces}
            currentTerm={currentTerm}
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
