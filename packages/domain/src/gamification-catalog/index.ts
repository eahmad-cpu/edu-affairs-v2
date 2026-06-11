import type {
  GamificationBadge,
  GamificationReason,
  StudentGamificationEventSourceType,
  StudentGamificationEventType,
  StudentGamificationEventVisibility,
  StudentGamificationValueKind,
} from "@takween/contracts";

export type GamificationCatalogContext = {
  orgId: string;

  schoolId?: string;
  academicYearId?: string;
  termId?: string;

  gradeId?: string;
  classId?: string;

  subjectKey?: string;
  classSubjectOfferingId?: string;
};

function normalizeText(value: string | undefined | null) {
  return String(value ?? "").trim();
}

function hasValue(value: string | undefined | null) {
  return normalizeText(value).length > 0;
}

function matchesOptionalField(params: {
  itemValue?: string;
  contextValue?: string;
}) {
  const itemValue = normalizeText(params.itemValue);
  const contextValue = normalizeText(params.contextValue);

  if (!itemValue) return true;
  return itemValue === contextValue;
}

function matchesScopeId(params: {
  scopeId?: string;
  explicitValue?: string;
  contextValue?: string;
}) {
  const scopeId = normalizeText(params.scopeId);
  const explicitValue = normalizeText(params.explicitValue);
  const contextValue = normalizeText(params.contextValue);

  if (!contextValue) return false;

  if (scopeId) return scopeId === contextValue;
  if (explicitValue) return explicitValue === contextValue;

  return false;
}

type CatalogItemBase = {
  orgId: string;
  scopeType: string;
  scopeId?: string;

  schoolId?: string;
  academicYearId?: string;
  termId?: string;

  gradeId?: string;
  classId?: string;

  subjectKey?: string;
  classSubjectOfferingId?: string;

  order?: number;
  title?: string;
};

function matchesCatalogContext(
  item: CatalogItemBase,
  context: GamificationCatalogContext,
) {
  if (item.orgId !== context.orgId) return false;

  if (
    !matchesOptionalField({
      itemValue: item.schoolId,
      contextValue: context.schoolId,
    })
  ) {
    return false;
  }

  if (
    !matchesOptionalField({
      itemValue: item.academicYearId,
      contextValue: context.academicYearId,
    })
  ) {
    return false;
  }

  if (
    !matchesOptionalField({
      itemValue: item.termId,
      contextValue: context.termId,
    })
  ) {
    return false;
  }

  if (
    !matchesOptionalField({
      itemValue: item.gradeId,
      contextValue: context.gradeId,
    })
  ) {
    return false;
  }

  if (
    !matchesOptionalField({
      itemValue: item.classId,
      contextValue: context.classId,
    })
  ) {
    return false;
  }

  if (
    !matchesOptionalField({
      itemValue: item.subjectKey,
      contextValue: context.subjectKey,
    })
  ) {
    return false;
  }

  if (
    !matchesOptionalField({
      itemValue: item.classSubjectOfferingId,
      contextValue: context.classSubjectOfferingId,
    })
  ) {
    return false;
  }

  switch (item.scopeType) {
    case "ORG":
      return true;

    case "SCHOOL":
      return matchesScopeId({
        scopeId: item.scopeId,
        explicitValue: item.schoolId,
        contextValue: context.schoolId,
      });

    case "ACADEMIC_YEAR":
      return matchesScopeId({
        scopeId: item.scopeId,
        explicitValue: item.academicYearId,
        contextValue: context.academicYearId,
      });

    case "TERM":
      return matchesScopeId({
        scopeId: item.scopeId,
        explicitValue: item.termId,
        contextValue: context.termId,
      });

    case "GRADE":
      return matchesScopeId({
        scopeId: item.scopeId,
        explicitValue: item.gradeId,
        contextValue: context.gradeId,
      });

    case "CLASS":
      return matchesScopeId({
        scopeId: item.scopeId,
        explicitValue: item.classId,
        contextValue: context.classId,
      });

    case "SUBJECT":
      return matchesScopeId({
        scopeId: item.scopeId,
        explicitValue: item.subjectKey,
        contextValue: context.subjectKey,
      });

    case "CLASS_SUBJECT_OFFERING":
      return matchesScopeId({
        scopeId: item.scopeId,
        explicitValue: item.classSubjectOfferingId,
        contextValue: context.classSubjectOfferingId,
      });

    default:
      return false;
  }
}

function sortCatalogItems<T extends { order?: number; title?: string; key?: string }>(
  items: T[],
) {
  return items.slice().sort((a, b) => {
    const orderDiff = (a.order ?? 0) - (b.order ?? 0);
    if (orderDiff !== 0) return orderDiff;

    const aTitle = a.title || a.key || "";
    const bTitle = b.title || b.key || "";

    return aTitle.localeCompare(bTitle, "ar");
  });
}

export function filterActiveGamificationBadges(
  badges: GamificationBadge[],
): GamificationBadge[] {
  return sortCatalogItems(
    badges.filter((badge) => badge.status === "ACTIVE"),
  );
}

export function filterActiveGamificationReasons(
  reasons: GamificationReason[],
): GamificationReason[] {
  return sortCatalogItems(
    reasons.filter((reason) => reason.status === "ACTIVE"),
  );
}

export function filterGamificationBadgesForContext(
  badges: GamificationBadge[],
  context: GamificationCatalogContext,
): GamificationBadge[] {
  return sortCatalogItems(
    filterActiveGamificationBadges(badges).filter((badge) =>
      matchesCatalogContext(badge, context),
    ),
  );
}

export function filterGamificationReasonsForContext(
  reasons: GamificationReason[],
  context: GamificationCatalogContext,
): GamificationReason[] {
  return sortCatalogItems(
    filterActiveGamificationReasons(reasons).filter((reason) =>
      matchesCatalogContext(reason, context),
    ),
  );
}

export function filterManualGamificationReasonsForContext(
  reasons: GamificationReason[],
  context: GamificationCatalogContext,
): GamificationReason[] {
  return filterGamificationReasonsForContext(reasons, context).filter(
    (reason) => reason.isManual,
  );
}

export type ResolvedGamificationReasonDefaults = {
  reasonId: string;
  reasonKey: string;
  reasonTitle: string;

  eventType: StudentGamificationEventType;
  value: number;
  valueKind: StudentGamificationValueKind;
  visibility: StudentGamificationEventVisibility;

  badgeId: string;
  badgeKey: string;

  category: string;
  categoryTitle: string;

  sourceType: StudentGamificationEventSourceType;
};

export function resolveGamificationReasonDefaults(
  reason: GamificationReason,
): ResolvedGamificationReasonDefaults {
  return {
    reasonId: reason.id,
    reasonKey: reason.key,
    reasonTitle: reason.title,

    eventType: reason.defaultEventType,
    value: reason.defaultValue,
    valueKind: reason.defaultValueKind,
    visibility: reason.defaultVisibility,

    badgeId: reason.badgeId ?? "",
    badgeKey: reason.badgeKey ?? "",

    category: reason.category ?? "",
    categoryTitle: reason.categoryTitle ?? "",

    sourceType: reason.sourceType,
  };
}

export type ResolvedGamificationBadgeDefaults = {
  badgeId: string;
  badgeKey: string;
  badgeTitle: string;

  value: number;
  valueKind: StudentGamificationValueKind;
  visibility: StudentGamificationEventVisibility;

  category: string;
  categoryTitle: string;

  iconKey: string;
  emoji: string;
  imageUrl: string;

  color: string;
  backgroundColor: string;
};

export function resolveGamificationBadgeDefaults(
  badge: GamificationBadge,
): ResolvedGamificationBadgeDefaults {
  return {
    badgeId: badge.id,
    badgeKey: badge.key,
    badgeTitle: badge.title,

    value: badge.defaultValue,
    valueKind: badge.defaultValueKind,
    visibility: badge.defaultVisibility,

    category: badge.category ?? "",
    categoryTitle: badge.categoryTitle ?? "",

    iconKey: badge.iconKey ?? "",
    emoji: badge.emoji ?? "",
    imageUrl: badge.imageUrl ?? "",

    color: badge.color ?? "",
    backgroundColor: badge.backgroundColor ?? "",
  };
}

export type FindGamificationReasonInput = {
  reasons: GamificationReason[];
  context: GamificationCatalogContext;
  reasonId?: string;
  reasonKey?: string;
};

export function findGamificationReasonForContext({
  reasons,
  context,
  reasonId,
  reasonKey,
}: FindGamificationReasonInput): GamificationReason | null {
  const candidates = filterGamificationReasonsForContext(reasons, context);

  return (
    candidates.find((reason) => {
      if (hasValue(reasonId)) return reason.id === reasonId;
      if (hasValue(reasonKey)) return reason.key === reasonKey;
      return false;
    }) ?? null
  );
}

export type FindGamificationBadgeInput = {
  badges: GamificationBadge[];
  context: GamificationCatalogContext;
  badgeId?: string;
  badgeKey?: string;
};

export function findGamificationBadgeForContext({
  badges,
  context,
  badgeId,
  badgeKey,
}: FindGamificationBadgeInput): GamificationBadge | null {
  const candidates = filterGamificationBadgesForContext(badges, context);

  return (
    candidates.find((badge) => {
      if (hasValue(badgeId)) return badge.id === badgeId;
      if (hasValue(badgeKey)) return badge.key === badgeKey;
      return false;
    }) ?? null
  );
}

export function buildGamificationCatalogContextKey(
  context: GamificationCatalogContext,
) {
  return [
    context.orgId,
    context.schoolId ?? "",
    context.academicYearId ?? "",
    context.termId ?? "",
    context.gradeId ?? "",
    context.classId ?? "",
    context.subjectKey ?? "",
    context.classSubjectOfferingId ?? "",
  ].join(":");
}