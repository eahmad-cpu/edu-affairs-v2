"use client";

import { useCallback, useMemo } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useDocumentLoader } from "@/hooks/use-document-loader";
import type { VisibleStudentClass } from "@/hooks/use-visible-students";

export type StaffStudentEnrollmentRow = {
  id: string;
  orgId?: string;
  schoolId?: string;
  academicYearId?: string;
  studentId: string;
  gradeId?: string;
  streamId?: string;
  classId?: string;
  status?: string;
  startAt?: number;
  endAt?: number;
};

export type StaffStudentRecord = {
  id: string;
  personId?: string;
  orgId?: string;
  isArchived?: boolean;
};

export type StaffStudentPerson = {
  id: string;
  displayName?: string;
  nationalId?: string;
  phone?: string;
  email?: string;
};

export type StaffStudentProfileData = {
  orgId: string;
  studentId: string;

  displayName: string;
  nationalId: string;
  phone: string;
  email: string;

  enrollment: StaffStudentEnrollmentRow;
  student: StaffStudentRecord | null;
  person: StaffStudentPerson | null;
  classInfo: VisibleStudentClass;

  classId: string;
  classTitle: string;
  schoolId: string;
  schoolName: string;
  academicYearId: string;
  academicYearTitle: string;
  gradeId: string;
  gradeTitle: string;
  streamId: string;

  studentExists: boolean;
  personExists: boolean;
};

type UseStaffStudentProfileOptions = {
  orgId: string;
  studentId: string;
  visibleClasses: VisibleStudentClass[];
  enabled?: boolean;
};

function makeExactClassKey(params: {
  schoolId?: string;
  academicYearId?: string;
  classId?: string;
}) {
  return [
    params.schoolId ?? "",
    params.academicYearId ?? "",
    params.classId ?? "",
  ].join("::");
}

function getClassTitle(item: VisibleStudentClass) {
  return item.title || item.code || item.id;
}

function getDisplayName(params: {
  person: StaffStudentPerson | null;
  student: StaffStudentRecord | null;
  enrollment: StaffStudentEnrollmentRow;
}) {
  return (
    params.person?.displayName ||
    params.student?.id ||
    params.enrollment.studentId ||
    "طالب غير مكتمل البيانات"
  );
}

function createClassLookups(visibleClasses: VisibleStudentClass[]) {
  const classByExactKey = new Map<string, VisibleStudentClass>();
  const classById = new Map<string, VisibleStudentClass>();
  const classIdCounts = new Map<string, number>();

  for (const item of visibleClasses) {
    const exactKey = makeExactClassKey({
      schoolId: item.schoolId,
      academicYearId: item.academicYearId,
      classId: item.id,
    });

    classByExactKey.set(exactKey, item);
    classById.set(item.id, item);
    classIdCounts.set(item.id, (classIdCounts.get(item.id) ?? 0) + 1);
  }

  return {
    classByExactKey,
    classById,
    classIdCounts,
  };
}

function resolveClassForEnrollment(params: {
  enrollment: StaffStudentEnrollmentRow;
  classByExactKey: Map<string, VisibleStudentClass>;
  classById: Map<string, VisibleStudentClass>;
  classIdCounts: Map<string, number>;
}) {
  const { enrollment, classByExactKey, classById, classIdCounts } = params;

  if (!enrollment.classId) return null;

  const exactKey = makeExactClassKey({
    schoolId: enrollment.schoolId,
    academicYearId: enrollment.academicYearId,
    classId: enrollment.classId,
  });

  const exactMatch = classByExactKey.get(exactKey);

  if (exactMatch) return exactMatch;

  const classIdCount = classIdCounts.get(enrollment.classId) ?? 0;

  if (classIdCount === 1) {
    return classById.get(enrollment.classId) ?? null;
  }

  return null;
}

function chooseBestVisibleEnrollment(params: {
  enrollments: StaffStudentEnrollmentRow[];
  classByExactKey: Map<string, VisibleStudentClass>;
  classById: Map<string, VisibleStudentClass>;
  classIdCounts: Map<string, number>;
}) {
  const { enrollments, classByExactKey, classById, classIdCounts } = params;

  for (const enrollment of enrollments) {
    const classInfo = resolveClassForEnrollment({
      enrollment,
      classByExactKey,
      classById,
      classIdCounts,
    });

    if (classInfo) {
      return {
        enrollment,
        classInfo,
      };
    }
  }

  return null;
}

async function buildStudentProfile(params: {
  orgId: string;
  enrollment: StaffStudentEnrollmentRow;
  classInfo: VisibleStudentClass;
}): Promise<StaffStudentProfileData> {
  const { orgId, enrollment, classInfo } = params;

  const studentRef = doc(db, "orgs", orgId, "students", enrollment.studentId);
  const studentSnap = await getDoc(studentRef);

  const student = studentSnap.exists()
    ? ({
        id: studentSnap.id,
        ...(studentSnap.data() as Omit<StaffStudentRecord, "id">),
      } satisfies StaffStudentRecord)
    : null;

  let person: StaffStudentPerson | null = null;

  if (student?.personId) {
    const personRef = doc(db, "orgs", orgId, "people", student.personId);
    const personSnap = await getDoc(personRef);

    if (personSnap.exists()) {
      person = {
        id: personSnap.id,
        ...(personSnap.data() as Omit<StaffStudentPerson, "id">),
      };
    }
  }

  const classId = enrollment.classId || classInfo.id;
  const schoolId = enrollment.schoolId || classInfo.schoolId || "";
  const academicYearId =
    enrollment.academicYearId || classInfo.academicYearId || "";
  const gradeId = enrollment.gradeId || classInfo.gradeId || "";
  const streamId = enrollment.streamId || classInfo.streamId || "";

  return {
    orgId,
    studentId: enrollment.studentId,

    displayName: getDisplayName({
      person,
      student,
      enrollment,
    }),
    nationalId: person?.nationalId ?? "",
    phone: person?.phone ?? "",
    email: person?.email ?? "",

    enrollment,
    student,
    person,
    classInfo,

    classId,
    classTitle: getClassTitle(classInfo),
    schoolId,
    schoolName: classInfo.schoolName || schoolId,
    academicYearId,
    academicYearTitle: classInfo.academicYearTitle || academicYearId,
    gradeId,
    gradeTitle: classInfo.gradeTitle || gradeId,
    streamId,

    studentExists: student !== null,
    personExists: person !== null,
  };
}

export function useStaffStudentProfile({
  orgId,
  studentId,
  visibleClasses,
  enabled = true,
}: UseStaffStudentProfileOptions) {
  const visibleClassSignature = useMemo(() => {
    return visibleClasses
      .map((item) =>
        makeExactClassKey({
          schoolId: item.schoolId,
          academicYearId: item.academicYearId,
          classId: item.id,
        })
      )
      .sort()
      .join("|");
  }, [visibleClasses]);

  const classLookups = useMemo(() => {
    return createClassLookups(visibleClasses);
  }, [visibleClasses]);

  const canLoad =
    enabled && !!orgId && !!studentId && visibleClasses.length > 0;

  const loadStudentProfile =
    useCallback(async (): Promise<StaffStudentProfileData | null> => {
      if (!canLoad) return null;

      const enrollmentsRef = collection(
        db,
        "orgs",
        orgId,
        "studentEnrollments"
      );

      const enrollmentsSnap = await getDocs(
        query(enrollmentsRef, where("studentId", "==", studentId))
      );

      const activeEnrollments = enrollmentsSnap.docs
        .map((item) => {
          const data = item.data() as Omit<StaffStudentEnrollmentRow, "id">;

          return {
            id: item.id,
            ...data,
          };
        })
        .filter((item) => item.studentId === studentId)
        .filter((item) => item.status === "ACTIVE");

      if (activeEnrollments.length === 0) {
        return null;
      }

      const selected = chooseBestVisibleEnrollment({
        enrollments: activeEnrollments,
        classByExactKey: classLookups.classByExactKey,
        classById: classLookups.classById,
        classIdCounts: classLookups.classIdCounts,
      });

      if (!selected) {
        return null;
      }

      return buildStudentProfile({
        orgId,
        enrollment: selected.enrollment,
        classInfo: selected.classInfo,
      });
    }, [canLoad, orgId, studentId, classLookups]);

  return useDocumentLoader<StaffStudentProfileData>({
    enabled: canLoad,
    loader: loadStudentProfile,
    deps: [orgId, studentId, visibleClassSignature],
  });
}