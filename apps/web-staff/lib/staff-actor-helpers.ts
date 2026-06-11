import type { StaffHomeVisibleModule } from "@takween/domain";

import type { StaffActorData } from "@/lib/staff-actor";

export function hasVisibleModule(
  actor: StaffActorData,
  moduleKey: StaffHomeVisibleModule,
) {
  return actor.visibleModules.includes(moduleKey);
}

export function getStaffOrgDisplayName(actor: StaffActorData) {
  return (
    actor.org?.nameAr ??
    actor.org?.shortName ??
    actor.org?.nameEn ??
    actor.orgId
  );
}

export function getStaffActorStats(actor: StaffActorData) {
  return {
    membershipsCount: actor.memberships.length,
    rolesCount: actor.roles.length,
    schoolsCount: actor.schools.length,
    classesCount: actor.classes.length,
    visibleClassesCount: actor.visibleClasses.length,
    classSubjectOfferingsCount: actor.classSubjectOfferings.length,
    operationalAssignmentsCount: actor.operationalAssignments.length,
    teacherAssignmentsCount: actor.teacherAssignments.length,
    visibleModulesCount: actor.visibleModules.length,
  };
}