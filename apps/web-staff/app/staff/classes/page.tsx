"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  GraduationCap,
  Layers3,
  School,
  Search,
  UsersRound,
} from "lucide-react";

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
  displayName?: string;
  name?: string;
  personName?: string;
  visibleClasses?: StaffVisibleClass[];
};

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

function buildClassHref(item: StaffVisibleClass) {
  const params = new URLSearchParams();

  if (item.schoolId) params.set("schoolId", item.schoolId);
  if (item.academicYearId) params.set("academicYearId", item.academicYearId);

  const query = params.toString();

  return `/staff/classes/${encodeURIComponent(item.id)}${
    query ? `?${query}` : ""
  }`;
}

function matchesSearch(item: StaffVisibleClass, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return true;

  const haystack = [
    item.id,
    item.title,
    item.code,
    item.sectionLabel,
    item.schoolId,
    item.schoolName,
    item.gradeId,
    item.gradeTitle,
    item.academicYearId,
    item.academicYearTitle,
    item.streamId,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

export default function StaffClassesPage() {
  const { actor } = useStaffActor();
  const staffActor = actor as StaffActorLike | null;

  const [searchQuery, setSearchQuery] = useState("");

  const classes = useMemo(() => {
    const list = staffActor?.visibleClasses ?? [];

    return [...list].sort((a, b) => {
      const schoolCompare = (a.schoolId ?? "").localeCompare(
        b.schoolId ?? "",
        "ar"
      );

      if (schoolCompare !== 0) return schoolCompare;

      const gradeCompare = (a.gradeId ?? "").localeCompare(
        b.gradeId ?? "",
        "ar"
      );

      if (gradeCompare !== 0) return gradeCompare;

      return (a.order ?? 0) - (b.order ?? 0);
    });
  }, [staffActor]);

  const filteredClasses = useMemo(() => {
    return classes.filter((item) => matchesSearch(item, searchQuery));
  }, [classes, searchQuery]);

  const schoolCount = useMemo(() => {
    return new Set(classes.map((item) => item.schoolId).filter(Boolean)).size;
  }, [classes]);

  const gradeCount = useMemo(() => {
    return new Set(classes.map((item) => item.gradeId).filter(Boolean)).size;
  }, [classes]);

  if (!staffActor) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-50 p-4 text-slate-950 dark:bg-slate-950 dark:text-slate-50 sm:p-6">
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

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 p-4 text-slate-950 dark:bg-slate-950 dark:text-slate-50 sm:p-6">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div className="space-y-2">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Milestone 6A
              </p>

              <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  فصولي
                </h1>

                <p className="max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-400">
                  هنا تظهر الفصول المسموح لك العمل عليها حسب الدور والإسنادات.
                  ربط الطلاب سيتم في مرحلة لاحقة.
                </p>
              </div>
            </div>

            <Link
              href="/staff"
              className="inline-flex w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="h-4 w-4" />
              الرجوع للرئيسية
            </Link>
          </div>

          {/* <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-7 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100">
            <span className="font-semibold">تنبيه تنفيذي:</span>{" "}
            هذه الصفحة تعتمد الآن على{" "}
            <span className="font-mono">actor.visibleClasses</span> فقط، ولا
            تقرأ الطلاب أو الدفعات أو الحضور.
          </div> */}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  إجمالي الفصول
                </p>
                <p className="mt-1 text-3xl font-bold">{classes.length}</p>
              </div>

              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <BookOpen className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  المدارس
                </p>
                <p className="mt-1 text-3xl font-bold">{schoolCount}</p>
              </div>

              <div className="rounded-2xl bg-sky-50 p-3 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                <School className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  الصفوف / المستويات
                </p>
                <p className="mt-1 text-3xl font-bold">{gradeCount}</p>
              </div>

              <div className="rounded-2xl bg-violet-50 p-3 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                <GraduationCap className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="relative">
            <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="ابحث باسم الفصل أو المدرسة أو الصف..."
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white pr-11 pl-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-800 dark:bg-slate-950 dark:focus:border-emerald-400"
            />
          </div>
        </div>

        {classes.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              <BookOpen className="h-6 w-6" />
            </div>

            <h2 className="mt-4 text-lg font-bold">لا توجد فصول ظاهرة لك</h2>

            <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-slate-500 dark:text-slate-400">
              لم يتم العثور على فصول داخل{" "}
              <span className="font-mono">actor.visibleClasses</span>. راجع
              إسنادات المستخدم أو منطق بناء Staff Actor.
            </p>
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-bold">لا توجد نتائج مطابقة</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              جرّب البحث باسم فصل أو مدرسة أو صف آخر.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredClasses.map((item) => {
              const studentCount = getStudentCount(item);

              return (
                <article
                  key={`${item.schoolId ?? "school"}:${item.academicYearId ?? "year"}:${item.id}`}
                  className="group flex min-h-64 flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-900"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          <Layers3 className="h-3.5 w-3.5" />
                          فصل
                        </div>

                        <h2 className="text-xl font-bold leading-8">
                          {getClassTitle(item)}
                        </h2>
                      </div>

                      {item.sectionLabel ? (
                        <span className="rounded-2xl bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {item.sectionLabel}
                        </span>
                      ) : null}
                    </div>

                    <div className="grid gap-2 text-sm">
                      <InfoRow
                        label="المدرسة"
                        value={item.schoolName || item.schoolId || "غير محدد"}
                      />

                      <InfoRow
                        label="السنة"
                        value={
                          item.academicYearTitle ||
                          item.academicYearId ||
                          "غير محدد"
                        }
                      />

                      <InfoRow
                        label="الصف / المستوى"
                        value={item.gradeTitle || item.gradeId || "غير محدد"}
                      />

                      <InfoRow
                        label="المسار"
                        value={item.streamId || "غير محدد"}
                      />
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-950">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <UsersRound className="h-4 w-4" />
                        الطلاب
                      </div>

                      <div className="font-semibold text-slate-950 dark:text-slate-50">
                        {studentCount !== null
                          ? `${studentCount} طالب`
                          : item.capacity
                            ? `السعة ${item.capacity}`
                            : "يربط لاحقًا"}
                      </div>
                    </div>

                    <Link
                      href={buildClassHref(item)}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
                    >
                      فتح تفاصيل الفصل
                      <ChevronLeft className="h-4 w-4" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
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