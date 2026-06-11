"use client";

import Link from "next/link";
import { UsersRound } from "lucide-react";

import type { ClassStudentsData } from "@/hooks/use-class-students";

export function ClassStudentsSection({
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