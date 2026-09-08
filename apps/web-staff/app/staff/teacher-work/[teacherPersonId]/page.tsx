"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  Loader2,
  X,
} from "lucide-react";

import { useStaffActor } from "@/components/staff/staff-actor-provider";
import { Button } from "@/components/ui/button";
import { canAccessTeacherWork } from "@/lib/teacher-work-access";
import {
  loadTeacherWorkDetail,
  teacherWorkMetricLabels,
  teacherWorkMetricOrder,
  type TeacherWorkLessonPrep,
  type TeacherWorkDrillDownItem,
  type TeacherWorkDrillDowns,
  type TeacherWorkMetric,
  type TeacherWorkMetricKey,
  type TeacherWorkPeriod,
  type TeacherWorkSummary,
} from "@/lib/teacher-work";

const periods: Array<{ value: TeacherWorkPeriod; label: string }> = [
  { value: "WEEK", label: "هذا الأسبوع" },
  { value: "MONTH", label: "هذا الشهر" },
  { value: "ALL", label: "الكل" },
];

const emptyDrillDowns: TeacherWorkDrillDowns = {
  measurements: [],
  learningLoss: [],
  notes: [],
  gamification: [],
  homework: [],
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "تعذر تحميل أعمال المعلم.";
}

function formatDate(value: number | null) {
  if (!value) return "لا يوجد نشاط مسجل";
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function safeText(value: string, fallback = "غير محدد") {
  return value.trim() || fallback;
}

function lessonPrepStatusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "مسودة",
    SUBMITTED: "مرسل",
    APPROVED: "معتمد",
    RETURNED: "معاد للتعديل",
    LOCKED: "مقفل",
    CANCELLED: "ملغي",
  };

  return labels[status] || "غير محدد";
}

function lessonPrepStatusClass(status: string) {
  const styles: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    SUBMITTED: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
    APPROVED:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    RETURNED:
      "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100",
    LOCKED:
      "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200",
    CANCELLED: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
  };

  return styles[status] || styles.DRAFT;
}

function drillDownStatusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "مسودة",
    SUBMITTED: "مرسل",
    PUBLISHED: "منشور",
    ACTIVE: "نشط",
    IN_PROGRESS: "قيد التنفيذ",
    CLOSED: "مغلق",
    RECORDED: "مسجل",
    REVIEWED: "تمت مراجعته",
    LOCKED: "مقفل",
    CANCELLED: "ملغي",
    REVERSED: "تم عكسه",
    ARCHIVED: "مؤرشف",
    NEEDS_FOLLOW_UP: "يحتاج متابعة",
  };

  return labels[status] || status || "مسجل";
}

function detailDate(value: number | null) {
  return value ? formatDate(value) : "غير محدد";
}

function detailLabel(value: string, labels: Record<string, string>) {
  return labels[value] || safeText(value);
}

function chipList(values: string[]) {
  return values.length ? values.join(" • ") : "لا توجد بيانات مسجلة";
}

function MetricCard({
  metricKey,
  metric,
}: {
  metricKey: TeacherWorkMetricKey;
  metric: TeacherWorkMetric;
}) {
  const rows: Array<[string, number | undefined]> = [];
  if (metricKey === "measurements") rows.push(["دفعات مرسلة", metric.submittedCount]);
  if (metricKey === "learningLoss") rows.push(["نشطة", metric.activeCount], ["مغلقة", metric.closedCount]);
  if (metricKey === "notes" || metricKey === "gamification") rows.push(["طلاب متأثرون", metric.uniqueStudents]);
  if (metricKey === "homework") rows.push(["مسودات", metric.draftCount], ["منشورة", metric.publishedCount], ["مغلقة", metric.closedCount]);
  if (metricKey === "lessonPrep") rows.push(["مسودات", metric.draftCount], ["مرسلة", metric.submittedCount], ["معتمدة", metric.approvedCount], ["معادة", metric.returnedCount]);

  return (
    <article className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-bold text-foreground">{teacherWorkMetricLabels[metricKey]}</h2>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-sm font-bold text-primary">
          {metric.count.toLocaleString("ar-SA")}
        </span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        آخر نشاط: {formatDate(metric.latestActivityAt)}
      </p>
      {rows.filter(([, value]) => value !== undefined).length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {rows
            .filter(([, value]) => value !== undefined)
            .map(([label, value]) => (
              <span key={label} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                {label}: {value?.toLocaleString("ar-SA")}
              </span>
            ))}
        </div>
      ) : null}
      {metric.classLabels.length || metric.subjectLabels.length ? (
        <p className="mt-4 text-xs leading-6 text-muted-foreground">
          {[...metric.subjectLabels, ...metric.classLabels].slice(0, 5).join(" • ")}
        </p>
      ) : null}
    </article>
  );
}

function LessonPrepDetails({
  prep,
  onClose,
}: {
  prep: TeacherWorkLessonPrep;
  onClose: () => void;
}) {
  const sections = [
    ["أهداف الدرس", prep.objectives],
    ["نواتج التعلم", prep.learningOutcomes],
    ["التمهيد", prep.warmup],
    ["خطوات عرض الدرس", prep.lessonSteps],
    ["الاستراتيجيات المستخدمة", prep.strategies],
    ["الوسائل التعليمية", prep.resources],
    ["التقويم", prep.assessment],
    ["الواجب / الملاحظات", prep.homeworkNote],
  ] as const;

  return (
    <section className="mt-3 rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 dark:bg-primary/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-foreground">{safeText(prep.lessonTitle, "تحضير درس")}</h3>
          <p className="mt-1 text-xs text-muted-foreground">عرض للقراءة فقط</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="إغلاق التحضير">
          <X className="size-4" />
        </Button>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <p><span className="text-muted-foreground">الوحدة: </span>{safeText(prep.unitTitle)}</p>
        <p><span className="text-muted-foreground">الأسبوع: </span>{safeText(prep.weekLabel)}</p>
        <p><span className="text-muted-foreground">رقم الدرس: </span>{safeText(prep.lessonNumber)}</p>
        <p><span className="text-muted-foreground">المدة: </span>{prep.durationMinutes ? `${prep.durationMinutes} دقيقة` : "غير محددة"}</p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {sections.map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-xl border bg-card p-3">
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-foreground">
              {safeText(value, "لا توجد بيانات مسجلة")}
            </p>
          </div>
        ))}
      </div>

      {prep.returnReason ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-semibold">سبب الإعادة</p>
          <p className="mt-1 whitespace-pre-wrap">{prep.returnReason}</p>
        </div>
      ) : null}
      {prep.approvalNote ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
          <p className="font-semibold">ملاحظة المشرف</p>
          <p className="mt-1 whitespace-pre-wrap">{prep.approvalNote}</p>
        </div>
      ) : null}
    </section>
  );
}

function LessonPrepList({ lessonPreps }: { lessonPreps: TeacherWorkLessonPrep[] }) {
  const [openedPrepId, setOpenedPrepId] = useState<string | null>(null);

  if (!lessonPreps.length) {
    return (
      <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        لا توجد تحاضير دروس ضمن الفترة المحددة.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {lessonPreps.map((prep) => {
        const isOpen = openedPrepId === prep.id;
        return (
          <article key={prep.id} className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-foreground">{safeText(prep.lessonTitle, "تحضير درس")}</h3>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${lessonPrepStatusClass(prep.status)}`}>
                    {lessonPrepStatusLabel(prep.status)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span>{safeText(prep.subjectLabel, "المادة غير محددة")}</span>
                  <span aria-hidden>•</span>
                  <span>{safeText(prep.classLabel, "الفصل غير محدد")}</span>
                  <span aria-hidden>•</span>
                  <span>{safeText(prep.lessonDate, "تاريخ الدرس غير محدد")}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setOpenedPrepId(isOpen ? null : prep.id)}>
                {isOpen ? "إغلاق" : "فتح"}
                <ChevronLeft className="size-4" />
              </Button>
            </div>
            {isOpen ? <LessonPrepDetails prep={prep} onClose={() => setOpenedPrepId(null)} /> : null}
          </article>
        );
      })}
    </div>
  );
}

function DetailFields({ fields }: { fields: Array<[string, ReactNode]> }) {
  return (
    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
      {fields.map(([label, value]) => (
        <p key={label} className="min-w-0">
          <span className="text-muted-foreground">{label}: </span>
          <span className="break-words text-foreground">{value}</span>
        </p>
      ))}
    </div>
  );
}

function DetailSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border bg-card p-3">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-foreground">{children}</div>
    </div>
  );
}

function DrillDownDetails({
  item,
  onClose,
}: {
  item: TeacherWorkDrillDownItem;
  onClose: () => void;
}) {
  const details = (() => {
    switch (item.kind) {
      case "measurements":
        return (
          <DetailFields
            fields={[
              ["نوع الدفعة", detailLabel(item.details.batchKind, {
                ASSESSMENT: "تقييم",
                TRACKER: "متابعة",
                KG_VALUES: "قيم الروضة",
                KG_CORNERS: "أركان الروضة",
                KG_QURAN: "القرآن الكريم",
                LEARNING_LOSS_TRACKER: "متابعة الفاقد التعليمي",
                CUSTOM: "مخصص",
              })],
              ["قالب القياس", safeText(item.details.templateTitle)],
              ["نوع التقييم", detailLabel(item.details.assessmentKind, {
                KG_TEACHER_MEASUREMENT: "قياس معلم الروضة",
                KG_VP_MEASUREMENT: "قياس وكيل الروضة",
                KG_MEASUREMENT_1: "قياس الروضة الأول",
                KG_MEASUREMENT_2: "قياس الروضة الثاني",
                KG_MEASUREMENT_3: "قياس الروضة الثالث",
                KG_VALUES_ASSESSMENT: "قياس القيم",
                KG_CORNERS_ASSESSMENT: "قياس الأركان",
                PRIMARY_DIAGNOSTIC_TEST: "اختبار تشخيصي",
                PRIMARY_PERIODIC_TEST_1: "اختبار دوري أول",
                PRIMARY_PERIODIC_TEST_2: "اختبار دوري ثانٍ",
                PRIMARY_CENTRAL_MEASUREMENT_1: "قياس مركزي أول",
                PRIMARY_CENTRAL_MEASUREMENT_2: "قياس مركزي ثانٍ",
                CUSTOM_ASSESSMENT: "تقييم مخصص",
              })],
              ["نوع المتابعة", detailLabel(item.details.trackerKind, {
                KG_QURAN_TRACKER: "متابعة القرآن",
                KG_LEARNING_GARDENS_TRACKER: "متابعة حدائق التعلم",
                KG_NUMBERS_TRACKER: "متابعة الأعداد",
                KG_VALUES_TRACKER: "متابعة القيم",
                KG_CORNERS_TRACKER: "متابعة الأركان",
                KG_LOSS_TRACKER: "متابعة فاقد الروضة",
                PRIMARY_QURAN_TRACKER: "متابعة القرآن",
                PRIMARY_LOSS_TRACKER: "متابعة الفاقد",
                CUSTOM_TRACKER: "متابعة مخصصة",
              })],
              ["تاريخ القياس", detailDate(item.details.measuredAt)],
              ["تاريخ الإرسال", detailDate(item.details.submittedAt)],
              ["الطلاب المستهدفون", item.details.targetCount?.toLocaleString("ar-SA") ?? "غير محدد"],
              ["المكتمل", item.details.completedCount?.toLocaleString("ar-SA") ?? "غير محدد"],
              ["غير المكتمل", item.details.missingCount?.toLocaleString("ar-SA") ?? "غير محدد"],
            ]}
          />
        );
      case "learningLoss":
        return (
          <>
            <DetailFields
              fields={[
                ["مصدر الخطة", safeText(item.details.sourceTitle)],
                ["بداية الخطة", detailDate(item.details.planStartAt)],
                ["نهاية الخطة", detailDate(item.details.planEndAt)],
                ["تاريخ الإغلاق", detailDate(item.details.closedAt)],
                ["مؤشر التحسن", detailLabel(item.details.improvementIndicator, {
                  UNKNOWN: "غير محدد",
                  NO_IMPROVEMENT: "لم يتحسن",
                  PARTIAL_IMPROVEMENT: "تحسن جزئي",
                  IMPROVED: "تحسن",
                  REGRESSED: "تراجع",
                })],
              ]}
            />
            <DetailSection label="الخطة العلاجية">
              {safeText(item.details.planText, "لا توجد بيانات مسجلة")}
            </DetailSection>
            <DetailSection label="المهارات المحددة">
              {chipList(item.details.lostSkillTitles)}
            </DetailSection>
            <DetailSection label="الإجراءات العلاجية">
              {chipList(item.details.remediationActionTitles)}
            </DetailSection>
          </>
        );
      case "notes":
        return (
          <>
            <DetailFields
              fields={[
                ["الفئة", detailLabel(item.details.category, {
                  GENERAL: "عامة",
                  EDUCATIONAL: "تعليمية",
                  BEHAVIORAL: "سلوكية",
                  ADMINISTRATIVE: "إدارية",
                  ATTENDANCE: "حضور",
                  TRANSPORT: "نقل",
                  GUARDIAN_COMMUNICATION: "تواصل مع ولي الأمر",
                  LEARNING_LOSS: "فاقد تعليمي",
                  POSITIVE: "إيجابية",
                  CARE: "رعائية",
                  FOLLOW_UP: "متابعة",
                  CUSTOM: "مخصصة",
                })],
                ["الأولوية", detailLabel(item.details.priority, {
                  INFO: "معلومات",
                  FOLLOW_UP: "تحتاج متابعة",
                  IMPORTANT: "مهمة",
                  URGENT: "عاجلة",
                })],
                ["تاريخ التسجيل", detailDate(item.details.recordedAt)],
                ["حالة المتابعة", detailLabel(item.details.followUpStatus, {
                  NONE: "لا توجد",
                  NEEDED: "مطلوبة",
                  IN_PROGRESS: "قيد المتابعة",
                  DONE: "مكتملة",
                  CANCELLED: "ملغاة",
                })],
                ["تاريخ المتابعة", detailDate(item.details.followUpAt)],
                ["مستوى الرؤية", detailLabel(item.details.visibility, {
                  PRIVATE_TO_AUTHOR: "للكاتب فقط",
                  STAFF_ONLY: "للطاقم فقط",
                  STAFF_INTERNAL: "للطاقم الداخلي",
                  SCHOOL_LEADERSHIP: "لقيادة المدرسة",
                  ADMIN_ONLY: "للإدارة فقط",
                  STUDENT_SUPPORT_TEAM: "لفريق الدعم الطلابي",
                  TRANSPORT_TEAM: "لفريق النقل",
                  GUARDIAN_VISIBLE: "ظاهر لولي الأمر",
                  PARENT_VISIBLE: "ظاهر لولي الأمر",
                })],
              ]}
            />
            <DetailSection label="نص الملاحظة">
              {item.details.bodyVisible
                ? safeText(item.details.body, "لا توجد بيانات مسجلة")
                : "لا يمكن عرض نص هذه الملاحظة وفق مستوى الخصوصية المسجل."}
            </DetailSection>
          </>
        );
      case "gamification":
        return (
          <DetailFields
            fields={[
              ["نوع الحدث", detailLabel(item.details.eventType, {
                XP_ADD: "إضافة خبرة",
                XP_REMOVE: "خصم خبرة",
                POINTS_ADD: "إضافة نقاط",
                POINTS_REMOVE: "خصم نقاط",
                BADGE_AWARDED: "منح شارة",
                BADGE_REVOKED: "سحب شارة",
                LEVEL_UP: "ترقية مستوى",
                STREAK_UPDATED: "تحديث سلسلة الإنجاز",
                POSITIVE_NOTE: "ملاحظة إيجابية",
                QUEST_COMPLETED: "إتمام مهمة",
                CUSTOM: "تحفيز مخصص",
              })],
              ["القيمة", item.details.value === null ? "غير محدد" : `${item.details.value.toLocaleString("ar-SA")} ${detailLabel(item.details.valueKind, {
                XP: "خبرة",
                POINTS: "نقطة",
                BADGE_VALUE: "قيمة شارة",
                STREAK: "سلسلة",
                LEVEL: "مستوى",
                CUSTOM: "قيمة",
              })}`],
              ["سبب التحفيز", safeText(item.details.reasonTitle)],
              ["التصنيف", safeText(item.details.categoryTitle)],
              ["الشارة", safeText(item.details.badgeTitle)],
              ["تاريخ الحدث", detailDate(item.details.occurredAt)],
              ["مستوى العرض", detailLabel(item.details.visibility, {
                STAFF_ONLY: "للطاقم فقط",
                STUDENT_DISPLAY: "عرض الطالب",
                GUARDIAN_VISIBLE: "ظاهر لولي الأمر",
                STUDENT_AND_GUARDIAN_VISIBLE: "ظاهر للطالب وولي الأمر",
                PUBLIC_LEADERBOARD: "لوحة المتصدرين",
                EVERYONE: "للجميع",
              })],
            ]}
          />
        );
      case "homework":
        return (
          <>
            <DetailFields
              fields={[
                ["تاريخ النشر", detailDate(item.details.publishedAt)],
                ["النشر المجدول", detailDate(item.details.scheduledPublishAt)],
                ["تاريخ الاستحقاق", detailDate(item.details.dueAt)],
                ["تاريخ الإغلاق", detailDate(item.details.closedAt)],
                ["الدرجة الكاملة", item.details.maxScore?.toLocaleString("ar-SA") ?? "غير محدد"],
                ["عدد الأسئلة", item.details.questionCount?.toLocaleString("ar-SA") ?? "غير محدد"],
                ["الطلاب المستهدفون", item.details.targetCount?.toLocaleString("ar-SA") ?? "غير محدد"],
                ["التسليمات", item.details.submittedCount?.toLocaleString("ar-SA") ?? "غير محدد"],
                ["تم التصحيح", item.details.gradedCount?.toLocaleString("ar-SA") ?? "غير محدد"],
                ["لم يُسلّم", item.details.missingCount?.toLocaleString("ar-SA") ?? "غير محدد"],
              ]}
            />
            <DetailSection label="تعليمات الواجب">
              {safeText(item.details.description, "لا توجد بيانات مسجلة")}
            </DetailSection>
          </>
        );
      default:
        return null;
    }
  })();

  return (
    <section className="mt-3 rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 dark:bg-primary/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-foreground">{safeText(item.title)}</h3>
          <p className="mt-1 text-xs text-muted-foreground">عرض للقراءة فقط</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="إغلاق التفاصيل">
          <X className="size-4" />
        </Button>
      </div>
      {details}
    </section>
  );
}

function ModuleDrillDown({
  metric,
  items,
}: {
  metric: TeacherWorkMetric;
  items: TeacherWorkDrillDownItem[];
}) {
  const [openedItemId, setOpenedItemId] = useState<string | null>(null);

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        لا توجد سجلات ضمن الفترة المحددة.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {metric.count.toLocaleString("ar-SA")} سجلًا ضمن الفترة المحددة
      </p>
      {items.map((item) => {
        const isOpen = openedItemId === item.id;
        return (
          <article key={item.id} className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-foreground">{item.title}</h3>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    {drillDownStatusLabel(item.status)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {[safeText(item.subjectLabel, "المادة غير محددة"), safeText(item.classLabel, "الفصل غير محدد")].join(" • ")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.activityAt)}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setOpenedItemId(isOpen ? null : item.id)}>
                {isOpen ? "إغلاق" : "فتح"}
                <ChevronLeft className="size-4" />
              </Button>
            </div>
            {isOpen ? <DrillDownDetails item={item} onClose={() => setOpenedItemId(null)} /> : null}
          </article>
        );
      })}
    </div>
  );
}

export default function TeacherWorkDetailPage() {
  const { actor } = useStaffActor();
  const params = useParams<{ teacherPersonId: string }>();
  const teacherPersonId = decodeURIComponent(params.teacherPersonId || "");
  const [period, setPeriod] = useState<TeacherWorkPeriod>("MONTH");
  const [teacher, setTeacher] = useState<TeacherWorkSummary | null>(null);
  const [lessonPreps, setLessonPreps] = useState<TeacherWorkLessonPrep[]>([]);
  const [drillDowns, setDrillDowns] = useState<TeacherWorkDrillDowns>(emptyDrillDowns);
  const [selectedModule, setSelectedModule] = useState<TeacherWorkMetricKey>("measurements");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestRequestId = useRef(0);
  const canAccess = canAccessTeacherWork(actor);

  const load = useCallback(async () => {
    if (!canAccess || !teacherPersonId) return;
    const requestId = ++latestRequestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await loadTeacherWorkDetail({
        orgId: actor.orgId,
        academicYearId: actor.currentTerm?.academicYearId,
        teacherPersonId,
        period,
      });
      if (requestId !== latestRequestId.current) return;
      setTeacher(result?.teacher ?? null);
      setLessonPreps(result?.lessonPreps ?? []);
      setDrillDowns(result?.drillDowns ?? emptyDrillDowns);
    } catch (nextError) {
      if (requestId !== latestRequestId.current) return;
      setError(errorMessage(nextError));
    } finally {
      if (requestId !== latestRequestId.current) return;
      setLoading(false);
    }
  }, [actor, canAccess, period, teacherPersonId]);

  useEffect(() => {
    if (canAccess) void load();
    else setLoading(false);
  }, [canAccess, load]);

  const identity = useMemo(() => [
    ...(teacher?.schoolNames ?? []),
    ...(teacher?.subjectLabels ?? []),
    ...(teacher?.classLabels ?? []),
  ].filter(Boolean).join(" • "), [teacher]);

  if (!canAccess) return null;

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6" dir="rtl">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/staff/teacher-work"><ArrowRight className="size-4" />العودة إلى المعلمين</Link>
        </Button>
      </div>

      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">متابعة أعمال المعلمين</p>
          <h1 className="mt-1 text-2xl font-bold">{teacher?.displayName || "أعمال المعلم"}</h1>
          {identity ? <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{identity}</p> : null}
        </div>
        <div className="inline-flex w-fit rounded-xl bg-muted p-1">
          {periods.map((item) => (
            <button key={item.value} type="button" onClick={() => setPeriod(item.value)} className={`rounded-lg px-3 py-2 text-sm transition ${period === item.value ? "bg-background font-semibold text-foreground shadow-sm" : "text-muted-foreground"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {error ? <section className="rounded-2xl border border-destructive/30 bg-card p-4 text-sm text-destructive"><p>{error}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>إعادة المحاولة</Button></section> : null}
      {loading ? <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground"><Loader2 className="ml-2 inline size-4 animate-spin" />جارٍ تحميل الأعمال…</div> : null}
      {!loading && !error && !teacher ? <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">لم يتم العثور على معلم نشط ضمن نطاقك.</div> : null}

      {!loading && teacher ? (
        <section className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="rounded-2xl border bg-card p-3 shadow-sm lg:sticky lg:top-6 lg:h-fit">
            <p className="px-3 pb-2 pt-1 text-xs font-semibold text-muted-foreground">وحدات العمل</p>
            <nav className="hidden space-y-1 lg:block">
              {teacherWorkMetricOrder.map((key) => (
                <button key={key} type="button" onClick={() => setSelectedModule(key)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-right text-sm transition ${selectedModule === key ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>
                  <span>{teacherWorkMetricLabels[key]}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${selectedModule === key ? "bg-primary-foreground/15 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {teacher.metrics[key].count.toLocaleString("ar-SA")}
                  </span>
                </button>
              ))}
            </nav>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {teacherWorkMetricOrder.map((key) => (
                <button key={key} type="button" onClick={() => setSelectedModule(key)} className={`shrink-0 rounded-xl px-3 py-2 text-sm transition ${selectedModule === key ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  {teacherWorkMetricLabels[key]} <span className="mr-1 text-xs opacity-80">{teacher.metrics[key].count.toLocaleString("ar-SA")}</span>
                </button>
              ))}
            </div>
          </aside>

          <div className="min-w-0">
            <div className="mb-4 flex items-center gap-2">
              <BookOpen className="size-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">{teacherWorkMetricLabels[selectedModule]}</h2>
            </div>
            {selectedModule === "lessonPrep" ? (
              <LessonPrepList lessonPreps={lessonPreps} />
            ) : (
              <ModuleDrillDown
                metric={teacher.metrics[selectedModule]}
                items={drillDowns[selectedModule]}
              />
            )}
          </div>
        </section>
      ) : null}

      <p className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="size-3.5" />المؤشرات والعرض للمتابعة فقط؛ لا تتضمن أي إجراءات اعتماد أو تعديل.</p>
    </main>
  );
}
