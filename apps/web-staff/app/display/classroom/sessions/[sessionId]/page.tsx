"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

import { ClassroomStudentScreen } from "@/components/classroom-display/classroom-student-screen";
import { useClassroomDisplayLiveData } from "@/components/classroom-display/use-classroom-display-live-data";
import { Button } from "@/components/ui/button";

export default function PublicClassroomDisplaySessionPage() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();

  const orgId = searchParams.get("orgId") ?? "";
  const themeKey = searchParams.get("theme") ?? "STARS";

  const { view, session, loading, error, isLive, lastUpdatedAt } =
    useClassroomDisplayLiveData({
      orgId,
      sessionId: params.sessionId,
    });

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

  if (error || !view) {
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

  return (
    <ClassroomStudentScreen
      view={view}
      isLive={isLive}
      lastUpdatedAt={lastUpdatedAt}
      themeKey={session?.displayThemeKey ?? themeKey}
    />
  );
}
