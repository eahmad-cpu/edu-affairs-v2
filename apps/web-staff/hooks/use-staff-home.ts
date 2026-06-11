"use client";

import { useMemo } from "react";
import { buildStaffHome } from "@takween/domain";

import { useStaffActor } from "@/components/staff/staff-actor-provider";

export function useStaffHome() {
  const { actor } = useStaffActor();

  const home = useMemo(() => {
    return buildStaffHome({
      context: {
        actorPersonId: actor.personId || actor.uid,
        orgId: actor.orgId,
        memberships: actor.memberships,
        operationalAssignments: actor.operationalAssignments,
        teacherAssignments: actor.teacherAssignments,
        teacherAssignmentClassLinks: actor.teacherAssignmentClassLinks,
      },
      classes: actor.visibleClasses,
      existingTasks: [],
      visibleModulesOverride: actor.visibleModules,
    });
  }, [actor]);

  return {
    actor,
    home,
  };
}