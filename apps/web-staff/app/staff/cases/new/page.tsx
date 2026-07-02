"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  FileText,
  Loader2,
  Save,
  User,
  UserCheck,
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";

import type {
  StudentCase,
  StudentCaseParentVisibility,
  StudentCasePriority,
} from "@takween/contracts";

import { useRequireAuth } from "@/hooks/use-require-auth";
import { db } from "@/lib/firebase";
import { ensureSelectedOrgId } from "@/lib/org";
import { createStudentCaseReferral } from "@/lib/student-cases";

type StaffIdentity = {
  personId: string;
  displayName?: string;
  roleKey?: string;
};

const PRIORITY_OPTIONS: { value: StudentCasePriority; label: string }[] = [
  { value: "LOW", label: "منخفضة" },
  { value: "NORMAL", label: "عادية" },
  { value: "HIGH", label: "عالية" },
  { value: "URGENT", label: "عاجلة" },
];

const PARENT_VISIBILITY_OPTIONS: {
  value: StudentCaseParentVisibility;
  label: string;
}[] = [
  { value: "INTERNAL_ONLY", label: "داخلي فقط" },
  { value: "SUMMARY_VISIBLE", label: "ملخص لولي الأمر" },
  { value: "FULL_VISIBLE", label: "ظاهر بالكامل لولي الأمر" },
];

const CASE_TYPE_OPTIONS = [
  { value: "BEHAVIOR", label: "سلوكية" },
  { value: "ACADEMIC", label: "تعليمية" },
  { value: "ATTENDANCE", label: "حضور وغياب" },
  { value: "HEALTH", label: "صحية" },
  { value: "SOCIAL", label: "اجتماعية" },
  { value: "OTHER", label: "أخرى" },
];

async function loadStaffIdentity(uid: string): Promise<StaffIdentity> {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    return {
      personId: uid,
    };
  }

  const data = userSnap.data() as {
    personId?: string;
    displayName?: string;
    name?: string;
    roleKey?: string;
    role?: string;
  };

  return {
    personId: data.personId ?? uid,
    displayName: data.displayName ?? data.name,
    roleKey: data.roleKey ?? data.role,
  };
}

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <span className="mb-1 block text-xs text-slate-400">
      {children}
      {required ? <span className="text-red-300"> *</span> : null}
    </span>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-500"
      placeholder={placeholder}
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  required,
  rows = 4,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      rows={rows}
      className="w-full resize-none rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-500"
      placeholder={placeholder}
    />
  );
}

export default function NewStudentCasePage() {
  const router = useRouter();
  const { user, checkingAuth } = useRequireAuth();

  const [orgId, setOrgId] = useState<string | null>(null);
  const [identity, setIdentity] = useState<StaffIdentity | null>(null);

  const [schoolId, setSchoolId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [termId, setTermId] = useState("");
  const [termTitle, setTermTitle] = useState("");
  const [termShortTitle, setTermShortTitle] = useState("");

  const [studentId, setStudentId] = useState("");
  const [studentPersonId, setStudentPersonId] = useState("");
  const [studentDisplayName, setStudentDisplayName] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [gradeTitle, setGradeTitle] = useState("");
  const [classId, setClassId] = useState("");
  const [classTitle, setClassTitle] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [caseTypeKey, setCaseTypeKey] = useState("BEHAVIOR");
  const [caseTypeTitle, setCaseTypeTitle] = useState("سلوكية");
  const [priority, setPriority] = useState<StudentCasePriority>("NORMAL");

  const [assigneePersonId, setAssigneePersonId] = useState("");
  const [assigneeDisplayName, setAssigneeDisplayName] = useState("");
  const [assigneeRoleKey, setAssigneeRoleKey] = useState("");

  const [parentVisibility, setParentVisibility] =
    useState<StudentCaseParentVisibility>("INTERNAL_ONLY");
  const [parentVisibleSummary, setParentVisibleSummary] = useState("");

  const [loadingContext, setLoadingContext] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadContext = useCallback(async () => {
    if (!user) return;

    setLoadingContext(true);
    setError(null);

    try {
      const nextOrgId = await ensureSelectedOrgId(user.uid);

      if (!nextOrgId) {
        setOrgId(null);
        setIdentity(null);
        setError("لم يتم العثور على مؤسسة مرتبطة بهذا المستخدم.");
        return;
      }

      const nextIdentity = await loadStaffIdentity(user.uid);

      setOrgId(nextOrgId);
      setIdentity(nextIdentity);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "تعذر تحميل بيانات المستخدم.");
    } finally {
      setLoadingContext(false);
    }
  }, [user]);

  useEffect(() => {
    if (!checkingAuth && user) {
      void loadContext();
    }
  }, [checkingAuth, user, loadContext]);

  function handleCaseTypeChange(nextCaseTypeKey: string) {
    setCaseTypeKey(nextCaseTypeKey);

    const option = CASE_TYPE_OPTIONS.find((item) => item.value === nextCaseTypeKey);
    setCaseTypeTitle(option?.label ?? nextCaseTypeKey);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!orgId || !identity) {
      setError("بيانات المؤسسة أو المستخدم غير مكتملة.");
      return;
    }

    if (!schoolId.trim()) {
      setError("أدخل معرف المدرسة.");
      return;
    }

    if (!academicYearId.trim()) {
      setError("أدخل معرف السنة الدراسية.");
      return;
    }

    if (!studentId.trim() || !studentDisplayName.trim()) {
      setError("أدخل بيانات الطالب الأساسية.");
      return;
    }

    if (!title.trim() || !description.trim()) {
      setError("أدخل عنوان القضية ووصفها.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const createdCase: StudentCase = await createStudentCaseReferral({
        orgId,
        schoolId: schoolId.trim(),
        academicYearId: academicYearId.trim(),

        termId: termId.trim() || undefined,
        termTitle: termTitle.trim() || undefined,
        termShortTitle: termShortTitle.trim() || undefined,

        student: {
          studentId: studentId.trim(),
          studentPersonId: studentPersonId.trim() || undefined,
          studentDisplayName: studentDisplayName.trim(),

          gradeId: gradeId.trim() || undefined,
          gradeTitle: gradeTitle.trim() || undefined,

          classId: classId.trim() || undefined,
          classTitle: classTitle.trim() || undefined,
        },

        title: title.trim(),
        description: description.trim(),

        caseTypeKey: caseTypeKey.trim(),
        caseTypeTitle: caseTypeTitle.trim() || undefined,

        priority,

        createdBy: {
          personId: identity.personId,
          displayName: identity.displayName,
          roleKey: identity.roleKey,
        },

        assignee: assigneePersonId.trim()
          ? {
              personId: assigneePersonId.trim(),
              displayName:
                assigneeDisplayName.trim() || assigneePersonId.trim(),
              roleKey: assigneeRoleKey.trim() || undefined,
            }
          : undefined,

        parentVisibility,
        parentVisibleSummary: parentVisibleSummary.trim() || undefined,
      });

      router.push(`/staff/cases/${createdCase.id}`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "تعذر إنشاء الإحالة.");
    } finally {
      setSaving(false);
    }
  }

  if (checkingAuth || loadingContext) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-center py-24">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4 text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin" />
            جاري تجهيز صفحة الإحالة...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Link
            href="/staff/cases"
            className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-100"
          >
            <ArrowRight className="h-4 w-4" />
            الرجوع للقضايا
          </Link>
        </div>

        <header className="rounded-3xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
            <FileText className="h-4 w-4" />
            إحالة طالب جديدة
          </div>

          <h1 className="text-2xl font-bold text-slate-50">
            إنشاء قضية / إحالة طالب
          </h1>

          <p className="mt-2 text-sm leading-7 text-slate-400">
            هذه نسخة MVP بإدخال يدوي مؤقت للطالب والمحال إليه. لاحقًا سنربطها
            باختيار الطالب من فصولي وقائمة المستلمين حسب المدرسة والصلاحيات.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-400">
              المؤسسة الحالية:{" "}
              <span className="font-medium text-slate-100">{orgId ?? "—"}</span>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-400">
              المنشئ:{" "}
              <span className="font-medium text-slate-100">
                {identity?.displayName ?? identity?.personId ?? "—"}
              </span>
            </div>
          </div>
        </header>

        {error ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">تعذر إنشاء الإحالة</p>
              <p className="mt-1 text-red-100/80">{error}</p>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <section className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="mb-5 flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-300" />
                <h2 className="text-lg font-bold text-slate-50">
                  بيانات القضية
                </h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <FieldLabel required>عنوان القضية</FieldLabel>
                  <TextInput
                    value={title}
                    onChange={setTitle}
                    required
                    placeholder="مثال: تكرار مخالفة سلوكية داخل الفصل"
                  />
                </label>

                <label className="block md:col-span-2">
                  <FieldLabel required>وصف القضية</FieldLabel>
                  <TextArea
                    value={description}
                    onChange={setDescription}
                    required
                    placeholder="اكتب وصفًا واضحًا لما حدث..."
                    rows={5}
                  />
                </label>

                <label className="block">
                  <FieldLabel>نوع القضية</FieldLabel>
                  <select
                    value={caseTypeKey}
                    onChange={(event) =>
                      handleCaseTypeChange(event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
                  >
                    {CASE_TYPE_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <FieldLabel>الأولوية</FieldLabel>
                  <select
                    value={priority}
                    onChange={(event) =>
                      setPriority(event.target.value as StudentCasePriority)
                    }
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
                  >
                    {PRIORITY_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="mb-5 flex items-center gap-2">
                <User className="h-5 w-5 text-emerald-300" />
                <h2 className="text-lg font-bold text-slate-50">
                  بيانات الطالب
                </h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <FieldLabel required>studentId</FieldLabel>
                  <TextInput
                    value={studentId}
                    onChange={setStudentId}
                    required
                    placeholder="student-..."
                  />
                </label>

                <label className="block">
                  <FieldLabel>studentPersonId</FieldLabel>
                  <TextInput
                    value={studentPersonId}
                    onChange={setStudentPersonId}
                    placeholder="person-..."
                  />
                </label>

                <label className="block md:col-span-2">
                  <FieldLabel required>اسم الطالب</FieldLabel>
                  <TextInput
                    value={studentDisplayName}
                    onChange={setStudentDisplayName}
                    required
                    placeholder="اسم الطالب"
                  />
                </label>

                <label className="block">
                  <FieldLabel>gradeId</FieldLabel>
                  <TextInput
                    value={gradeId}
                    onChange={setGradeId}
                    placeholder="g1"
                  />
                </label>

                <label className="block">
                  <FieldLabel>اسم الصف</FieldLabel>
                  <TextInput
                    value={gradeTitle}
                    onChange={setGradeTitle}
                    placeholder="أول ابتدائي"
                  />
                </label>

                <label className="block">
                  <FieldLabel>classId</FieldLabel>
                  <TextInput
                    value={classId}
                    onChange={setClassId}
                    placeholder="g1-general-1"
                  />
                </label>

                <label className="block">
                  <FieldLabel>اسم الفصل</FieldLabel>
                  <TextInput
                    value={classTitle}
                    onChange={setClassTitle}
                    placeholder="أول ابتدائي / العام / أ"
                  />
                </label>
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
              <h2 className="text-base font-bold text-slate-50">
                سياق المدرسة والسنة
              </h2>

              <div className="mt-4 space-y-3">
                <label className="block">
                  <FieldLabel required>schoolId</FieldLabel>
                  <TextInput
                    value={schoolId}
                    onChange={setSchoolId}
                    required
                    placeholder="mrb-boys-sayh"
                  />
                </label>

                <label className="block">
                  <FieldLabel required>academicYearId</FieldLabel>
                  <TextInput
                    value={academicYearId}
                    onChange={setAcademicYearId}
                    required
                    placeholder="ay-1448"
                  />
                </label>

                <label className="block">
                  <FieldLabel>termId</FieldLabel>
                  <TextInput
                    value={termId}
                    onChange={setTermId}
                    placeholder="term-1"
                  />
                </label>

                <label className="block">
                  <FieldLabel>اسم الفصل الدراسي</FieldLabel>
                  <TextInput
                    value={termTitle}
                    onChange={setTermTitle}
                    placeholder="الفصل الدراسي الأول"
                  />
                </label>

                <label className="block">
                  <FieldLabel>اختصار الفصل الدراسي</FieldLabel>
                  <TextInput
                    value={termShortTitle}
                    onChange={setTermShortTitle}
                    placeholder="ف1"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="mb-4 flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-emerald-300" />
                <h2 className="text-base font-bold text-slate-50">
                  الإحالة إلى
                </h2>
              </div>

              <p className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-6 text-amber-100">
                اختيار المستلم يدوي مؤقت. لاحقًا سيظهر كقائمة مرشد/وكيل/مدير
                حسب المدرسة والصلاحيات.
              </p>

              <div className="space-y-3">
                <label className="block">
                  <FieldLabel>personId</FieldLabel>
                  <TextInput
                    value={assigneePersonId}
                    onChange={setAssigneePersonId}
                    placeholder="personId للمحال إليه"
                  />
                </label>

                <label className="block">
                  <FieldLabel>اسم المحال إليه</FieldLabel>
                  <TextInput
                    value={assigneeDisplayName}
                    onChange={setAssigneeDisplayName}
                    placeholder="مثال: المرشد الطلابي"
                  />
                </label>

                <label className="block">
                  <FieldLabel>roleKey</FieldLabel>
                  <TextInput
                    value={assigneeRoleKey}
                    onChange={setAssigneeRoleKey}
                    placeholder="COUNSELOR"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
              <h2 className="text-base font-bold text-slate-50">
                ظهور ولي الأمر
              </h2>

              <div className="mt-4 space-y-3">
                <label className="block">
                  <FieldLabel>مستوى الظهور</FieldLabel>
                  <select
                    value={parentVisibility}
                    onChange={(event) =>
                      setParentVisibility(
                        event.target.value as StudentCaseParentVisibility
                      )
                    }
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
                  >
                    {PARENT_VISIBILITY_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <FieldLabel>ملخص ولي الأمر — اختياري</FieldLabel>
                  <TextArea
                    value={parentVisibleSummary}
                    onChange={setParentVisibleSummary}
                    rows={3}
                    placeholder="اكتب ملخصًا مناسبًا لولي الأمر إن لزم..."
                  />
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              إنشاء الإحالة
            </button>
          </aside>
        </form>
      </div>
    </main>
  );
}