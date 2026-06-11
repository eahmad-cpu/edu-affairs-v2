import { collection, doc, setDoc } from "firebase/firestore";

import type {
  ClassroomDisplayPhotoFallbackMode,
  ClassroomDisplayPrivacyMode,
  ClassroomDisplaySession,
  MembershipRole,
} from "@takween/contracts";

import { db } from "@/lib/firebase";

export type CreateClassroomDisplaySessionInput = {
  orgId: string;
  schoolId: string;
  academicYearId: string;

  termId: string;
  termTitle: string;
  termShortTitle: string;

  classId: string;
  gradeId: string;
  streamId?: string;

  subjectKey: string;
  classSubjectOfferingId: string;

  startedByPersonId: string;
  startedByRoleKey?: MembershipRole;

  privacyMode: ClassroomDisplayPrivacyMode;
  showStudentPhotos: boolean;
  photoFallbackMode: ClassroomDisplayPhotoFallbackMode;

  showLeaderboard: boolean;
  showGamificationFeed: boolean;
  showChallenge: boolean;
  showTimer: boolean;
  showLessonGoal: boolean;

  lessonGoal: string;
  encouragementMessage: string;
};

export async function createClassroomDisplaySession(
  input: CreateClassroomDisplaySessionInput,
) {
  const now = Date.now();

  const ref = doc(
    collection(db, `orgs/${input.orgId}/classroomDisplaySessions`),
  );

  const session: ClassroomDisplaySession = {
    id: ref.id,

    orgId: input.orgId,
    schoolId: input.schoolId,
    academicYearId: input.academicYearId,

    termId: input.termId,
    termTitle: input.termTitle,
    termShortTitle: input.termShortTitle,

    classId: input.classId,
    gradeId: input.gradeId,
    streamId: input.streamId ?? "",

    subjectKey: input.subjectKey,
    classSubjectOfferingId: input.classSubjectOfferingId,

    startedByPersonId: input.startedByPersonId,
    startedByRoleKey: input.startedByRoleKey,

    status: "ACTIVE",

    privacyMode: input.privacyMode,
    showStudentPhotos: input.showStudentPhotos,
    photoFallbackMode: input.photoFallbackMode,

    showLeaderboard: input.showLeaderboard,
    showGamificationFeed: input.showGamificationFeed,
    showChallenge: input.showChallenge,
    showTimer: input.showTimer,
    showLessonGoal: input.showLessonGoal,

    lessonGoal: input.lessonGoal,
    encouragementMessage: input.encouragementMessage,

    startedAt: now,
    lastHeartbeatAt: now,
    createdAt: now,
    updatedAt: now,

    isArchived: false,
  };

  await setDoc(ref, session);

  return session;
}