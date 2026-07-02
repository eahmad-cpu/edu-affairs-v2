import { collection, getDocs } from "firebase/firestore";

import type {
  StudentTransportEnrollment,
  TransportAttendanceBatch,
  TransportRoute,
  TransportTripKind,
} from "@takween/contracts";

import {
  buildTransportAttendanceBatchDraft,
  getRouteTransportEnrollments,
  getVisibleRoutesForTransportSupervisor,
  TRANSPORT_TRIP_KIND_LABEL_AR,
  type TransportOperationalAssignmentLike,
  type TransportTermContext,
} from "@takween/domain";

import { db } from "@/lib/firebase";

export type StaffTransportContext = {
  orgId: string;
  actorPersonId: string;

  schoolId?: string;
  academicYearId?: string;

  /**
   * يستخدم مؤقتًا مع الأدوار الواسعة مثل مدير/وكيل/مالك مؤسسة.
   * مشرف الباص العادي نخليها false.
   */
  canViewAllTransportRoutes?: boolean;

  assignments?: TransportOperationalAssignmentLike[];
};

export type StaffTransportRouteCard = {
  route: TransportRoute;
  studentsCount: number;
  activeBatchesCount: number;
  latestBatch?: TransportAttendanceBatch;
};

export type StaffTransportWorkspace = {
  routes: TransportRoute[];
  enrollments: StudentTransportEnrollment[];
  batches: TransportAttendanceBatch[];
  routeCards: StaffTransportRouteCard[];
};

export type StaffTransportRouteWorkspace = {
  route: TransportRoute;
  enrollments: StudentTransportEnrollment[];
  batches: TransportAttendanceBatch[];
  tripOptions: StaffTransportTripOption[];
};

export type StaffTransportTripOption = {
  tripKind: TransportTripKind;
  label: string;
};

export const STAFF_TRANSPORT_TRIP_OPTIONS: StaffTransportTripOption[] = [
  {
    tripKind: "MORNING_PICKUP",
    label: TRANSPORT_TRIP_KIND_LABEL_AR.MORNING_PICKUP,
  },
  {
    tripKind: "MORNING_ARRIVAL",
    label: TRANSPORT_TRIP_KIND_LABEL_AR.MORNING_ARRIVAL,
  },
  {
    tripKind: "AFTERNOON_BOARDING",
    label: TRANSPORT_TRIP_KIND_LABEL_AR.AFTERNOON_BOARDING,
  },
  {
    tripKind: "AFTERNOON_DROPOFF",
    label: TRANSPORT_TRIP_KIND_LABEL_AR.AFTERNOON_DROPOFF,
  },
];

function getTodayServiceDate() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

async function readOrgCollection<T extends { id: string }>(
  orgId: string,
  collectionName: string
): Promise<T[]> {
  const snap = await getDocs(collection(db, `orgs/${orgId}/${collectionName}`));

  return snap.docs.map((item) => ({
    id: item.id,
    ...(item.data() as Omit<T, "id">),
  })) as T[];
}

function filterRoutesByContext(
  routes: TransportRoute[],
  context: StaffTransportContext
) {
  return routes
    .filter((route) => route.orgId === context.orgId)
    .filter((route) => !context.schoolId || route.schoolId === context.schoolId)
    .filter(
      (route) =>
        !context.academicYearId ||
        route.academicYearId === context.academicYearId
    );
}

function filterEnrollmentsByContext(
  enrollments: StudentTransportEnrollment[],
  context: StaffTransportContext
) {
  return enrollments
    .filter((item) => item.orgId === context.orgId)
    .filter((item) => !context.schoolId || item.schoolId === context.schoolId)
    .filter(
      (item) =>
        !context.academicYearId ||
        item.academicYearId === context.academicYearId
    );
}

function filterBatchesByContext(
  batches: TransportAttendanceBatch[],
  context: StaffTransportContext
) {
  return batches
    .filter((item) => item.orgId === context.orgId)
    .filter((item) => !context.schoolId || item.schoolId === context.schoolId)
    .filter(
      (item) =>
        !context.academicYearId ||
        item.academicYearId === context.academicYearId
    );
}

function sortBatchesNewestFirst(batches: TransportAttendanceBatch[]) {
  return [...batches].sort((a, b) => {
    const byDate = b.serviceDate.localeCompare(a.serviceDate);
    if (byDate !== 0) return byDate;

    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
  });
}

export async function getStaffTransportRoutes(
  context: StaffTransportContext
): Promise<TransportRoute[]> {
  const allRoutes = await readOrgCollection<TransportRoute>(
    context.orgId,
    "transportRoutes"
  );

  const scopedRoutes = filterRoutesByContext(allRoutes, context);

  if (context.canViewAllTransportRoutes) {
    return scopedRoutes
      .filter((route) => route.status === "ACTIVE" && route.isArchived !== true)
      .sort((a, b) => {
        const byOrder = (a.order ?? 0) - (b.order ?? 0);
        if (byOrder !== 0) return byOrder;
        return a.title.localeCompare(b.title, "ar");
      });
  }

  return getVisibleRoutesForTransportSupervisor({
    orgId: context.orgId,
    actorPersonId: context.actorPersonId,
    routes: scopedRoutes,
    assignments: context.assignments,
  });
}

export async function getStaffTransportEnrollments(
  context: StaffTransportContext
): Promise<StudentTransportEnrollment[]> {
  const allEnrollments = await readOrgCollection<StudentTransportEnrollment>(
    context.orgId,
    "studentTransportEnrollments"
  );

  return filterEnrollmentsByContext(allEnrollments, context);
}

export async function getStaffTransportBatches(
  context: StaffTransportContext
): Promise<TransportAttendanceBatch[]> {
  const allBatches = await readOrgCollection<TransportAttendanceBatch>(
    context.orgId,
    "transportAttendanceBatches"
  );

  return sortBatchesNewestFirst(filterBatchesByContext(allBatches, context));
}

export async function buildStaffTransportWorkspace(
  context: StaffTransportContext
): Promise<StaffTransportWorkspace> {
  const [routes, enrollments, batches] = await Promise.all([
    getStaffTransportRoutes(context),
    getStaffTransportEnrollments(context),
    getStaffTransportBatches(context),
  ]);

  const routeCards = routes.map((route) => {
    const routeEnrollments = getRouteTransportEnrollments({
      orgId: context.orgId,
      schoolId: route.schoolId,
      academicYearId: route.academicYearId,
      routeId: route.id,
      enrollments,
    });

    const routeBatches = batches.filter((batch) => batch.routeId === route.id);

    return {
      route,
      studentsCount: routeEnrollments.length,
      activeBatchesCount: routeBatches.filter((batch) =>
        ["DRAFT", "IN_PROGRESS", "SUBMITTED"].includes(batch.status)
      ).length,
      latestBatch: routeBatches[0],
    };
  });

  return {
    routes,
    enrollments,
    batches,
    routeCards,
  };
}

export async function buildStaffTransportRouteWorkspace(
  context: StaffTransportContext,
  routeId: string
): Promise<StaffTransportRouteWorkspace | null> {
  const workspace = await buildStaffTransportWorkspace(context);

  const route = workspace.routes.find((item) => item.id === routeId);

  if (!route) {
    return null;
  }

  const enrollments = getRouteTransportEnrollments({
    orgId: context.orgId,
    schoolId: route.schoolId,
    academicYearId: route.academicYearId,
    routeId: route.id,
    enrollments: workspace.enrollments,
  });

  const batches = workspace.batches.filter((batch) => batch.routeId === routeId);

  return {
    route,
    enrollments,
    batches,
    tripOptions: STAFF_TRANSPORT_TRIP_OPTIONS,
  };
}

export async function buildStaffTransportBatchDraft(params: {
  context: StaffTransportContext;
  routeId: string;
  tripKind: TransportTripKind;
  serviceDate?: string;
  term?: TransportTermContext;
  createdByRoleKey?: string;
  operationalAssignmentId?: string;
}) {
  const routeWorkspace = await buildStaffTransportRouteWorkspace(
    params.context,
    params.routeId
  );

  if (!routeWorkspace) {
    return null;
  }

  return buildTransportAttendanceBatchDraft({
    orgId: params.context.orgId,
    schoolId: routeWorkspace.route.schoolId ?? params.context.schoolId ?? "",
    academicYearId:
      routeWorkspace.route.academicYearId ?? params.context.academicYearId ?? "",

    term: params.term,

    route: routeWorkspace.route,
    enrollments: routeWorkspace.enrollments,

    tripKind: params.tripKind,
    serviceDate: params.serviceDate ?? getTodayServiceDate(),

    createdByPersonId: params.context.actorPersonId,
    createdByRoleKey: params.createdByRoleKey,
    operationalAssignmentId: params.operationalAssignmentId,
  });
}