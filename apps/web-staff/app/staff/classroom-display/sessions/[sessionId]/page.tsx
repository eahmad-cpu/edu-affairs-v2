"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import type { ClassroomDisplayViewData } from "@/lib/classroom-display-view-data";

import { useStaffActor } from "@/components/staff/staff-actor-provider";
import { Button } from "@/components/ui/button";
import { loadClassroomDisplayViewData } from "@/lib/classroom-display-view-data";

import { ClassroomStudentScreen } from "./_components/classroom-student-screen";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "حدث خطأ غير متوقع";
}

export default function ClassroomDisplaySessionPage() {
  const params = useParams<{ sessionId: string }>();
  const { actor } = useStaffActor();

  const [data, setData] = useState<ClassroomDisplayViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        if (!actor?.orgId) {
          setData(null);
          setError("لم يتم تحديد المؤسسة الحالية.");
          return;
        }

        const result = await loadClassroomDisplayViewData({
          orgId: actor.orgId,
          sessionId: params.sessionId,
        });

        if (!active) return;

        if (!result) {
          setData(null);
          setError("جلسة شاشة الفصل غير موجودة.");
          return;
        }

        setData(result);
      } catch (error) {
        if (!active) return;
        setData(null);
        setError(getErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [actor?.orgId, params.sessionId]);

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-slate-950 text-white"
      >
        جارٍ تجهيز شاشة الطلاب...
      </main>
    );
  }

  if (error || !data) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white"
      >
        <div className="max-w-md rounded-[2rem] border border-white/10 bg-white/10 p-6 text-center">
          <p className="text-xl font-black">تعذر فتح شاشة الفصل</p>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            {error || "حدث خطأ غير متوقع."}
          </p>

          <Button asChild className="mt-5">
            <Link href="/staff">العودة للرئيسية</Link>
          </Button>
        </div>
      </main>
    );
  }

  return <ClassroomStudentScreen view={data.view} />;
}