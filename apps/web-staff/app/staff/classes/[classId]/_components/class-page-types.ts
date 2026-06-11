import type { ComponentType } from "react";

import { buildClassSubjectWorkspaces } from "@takween/domain";
import type {
  ClassSubjectOffering,
  MembershipRole,
  TeacherAssignment,
  TeacherAssignmentClassLink,
} from "@takween/contracts";

export type StaffVisibleClass = {
  id: string;
  schoolType?: string;
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

export type StaffActorCurrentTerm = {
  id: string;
  orgId?: string;
  academicYearId: string;
  title: string;
  shortTitle?: string;
  order?: number;
  status?: string;
  isCurrent?: boolean;
  startsAt?: number;
  endsAt?: number;
};

export type StaffActorLike = {
  uid?: string;
  personId?: string;
  orgId?: string;
  roles?: MembershipRole[];
  visibleClasses?: StaffVisibleClass[];
  classSubjectOfferings?: ClassSubjectOffering[];
  teacherAssignments?: TeacherAssignment[];
  teacherAssignmentClassLinks?: TeacherAssignmentClassLink[];
  currentTerm?: StaffActorCurrentTerm | null;
  currentTermsByAcademicYear?: Record<string, StaffActorCurrentTerm>;
};

export type OperationCard = {
  title: string;
  description: string;
  status: "ACTIVE" | "READY_SOON" | "FUTURE";
  icon: ComponentType<{ className?: string }>;
  href?: string;
  actionLabel?: string;
};

export type ClassSubjectWorkspace = ReturnType<
  typeof buildClassSubjectWorkspaces
>[number];

export type WorkspaceGroupKey =
  | "CLASS_TEACHER_DOMAINS"
  | "VALUES_DOMAINS"
  | "CORNERS_DOMAINS"
  | "HOMEROOM_ASSIGNMENT"
  | "OTHER_DOMAINS";