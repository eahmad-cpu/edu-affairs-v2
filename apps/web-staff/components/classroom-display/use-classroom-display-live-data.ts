"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  ClassroomDisplaySession,
  StudentGamificationEvent,
} from "@takween/contracts";
import {
  buildClassroomDisplayView,
  type ClassroomDisplayView,
} from "@takween/domain";

import {
  loadClassStudents,
  loadClassTitle,
  loadSchoolName,
  subscribeClassroomDisplaySession,
  subscribeSessionGamificationEvents,
  toFeedInputs,
  toStudentInputs,
} from "@/lib/classroom-display-view-data";

type StudentDisplayRow = Awaited<ReturnType<typeof loadClassStudents>>[number];

export type UseClassroomDisplayLiveDataResult = {
  view: ClassroomDisplayView | null;
  session: ClassroomDisplaySession | null;
  loading: boolean;
  error: string;
  lastUpdatedAt: number | null;
  isLive: boolean;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "حدث خطأ غير متوقع";
}

export function useClassroomDisplayLiveData(params: {
  orgId: string;
  sessionId: string;
}): UseClassroomDisplayLiveDataResult {
  const [session, setSession] = useState<ClassroomDisplaySession | null>(null);
  const [schoolName, setSchoolName] = useState("");
  const [classTitle, setClassTitle] = useState("");
  const [students, setStudents] = useState<StudentDisplayRow[]>([]);
  const [events, setEvents] = useState<StudentGamificationEvent[]>([]);

  const [loading, setLoading] = useState(true);
  const [baseDataLoaded, setBaseDataLoaded] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!params.orgId || !params.sessionId) {
      setLoading(false);
      setError("لم يتم تحديد المؤسسة أو الجلسة.");
      return;
    }

    setLoading(true);
    setError("");
    setSession(null);
    setSchoolName("");
    setClassTitle("");
    setStudents([]);
    setEvents([]);
    setBaseDataLoaded(false);
    setLastUpdatedAt(null);

    const unsubscribeSession = subscribeClassroomDisplaySession(
      {
        orgId: params.orgId,
        sessionId: params.sessionId,
      },
      (nextSession) => {
        setSession(nextSession);
        setLastUpdatedAt(Date.now());

        if (!nextSession) {
          setError("جلسة شاشة الفصل غير موجودة.");
          setLoading(false);
        }
      },
      (error) => {
        setError(getErrorMessage(error));
        setLoading(false);
      },
    );

    return () => {
      unsubscribeSession();
    };
  }, [params.orgId, params.sessionId]);

  useEffect(() => {
    if (!session) return;

    const currentSession: ClassroomDisplaySession = session;

    let active = true;

    async function loadBaseData() {
      setLoading(true);
      setError("");
      setBaseDataLoaded(false);

      try {
        const [nextSchoolName, nextClassTitle, nextStudents] =
          await Promise.all([
            loadSchoolName(currentSession),
            loadClassTitle(currentSession),
            loadClassStudents(currentSession),
          ]);

        if (!active) return;

        setSchoolName(nextSchoolName);
        setClassTitle(nextClassTitle);
        setStudents(nextStudents);
        setBaseDataLoaded(true);
        setLastUpdatedAt(Date.now());
      } catch (error) {
        if (!active) return;
        setError(getErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadBaseData();

    return () => {
      active = false;
    };
  }, [
    session?.id,
    session?.orgId,
    session?.schoolId,
    session?.academicYearId,
    session?.classId,
  ]);

  useEffect(() => {
    if (!session) return;

    const currentSession: ClassroomDisplaySession = session;

    const unsubscribeEvents = subscribeSessionGamificationEvents(
      currentSession,
      (nextEvents) => {
        setEvents(nextEvents);
        setLastUpdatedAt(Date.now());
      },
      (error) => {
        setError(getErrorMessage(error));
      },
    );

    return () => {
      unsubscribeEvents();
    };
  }, [
    session?.id,
    session?.orgId,
    session?.schoolId,
    session?.academicYearId,
    session?.termId,
    session?.classId,
    session?.subjectKey,
    session?.classSubjectOfferingId,
  ]);

  const view = useMemo(() => {
    if (!session || !baseDataLoaded) return null;

    return buildClassroomDisplayView({
      session,
      schoolName,
      classTitle,
      subjectTitle: session.subjectKey || "المادة",
      students: toStudentInputs({ students, events }),
      feedItems: toFeedInputs(events),
    });
  }, [baseDataLoaded, classTitle, events, schoolName, session, students]);

  return {
    view,
    session,
    loading,
    error,
    lastUpdatedAt,
    isLive: Boolean(session && baseDataLoaded && !error),
  };
}
