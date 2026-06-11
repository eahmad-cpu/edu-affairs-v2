"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { useStaffActor } from "@/components/staff/staff-actor-provider";
import { auth, db } from "@/lib/firebase";

export type WebStaffNotification = {
  id: string;
  title: string;
  body: string;
  status: string;
  type: string;
  targetRoute: string;
  targetParams: Record<string, unknown>;
  createdAt: number;
  readAt?: number;
};

function readString(data: Record<string, unknown>, key: string, fallback = "") {
  const value = data[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readNumber(data: Record<string, unknown>, key: string) {
  const value = data[key];
  return typeof value === "number" ? value : 0;
}

function readMap(data: Record<string, unknown>, key: string) {
  const value = data[key];

  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function notificationFromDoc(
  snapshot: QueryDocumentSnapshot,
): WebStaffNotification {
  const data = snapshot.data() as Record<string, unknown>;

  return {
    id: snapshot.id,
    title: readString(data, "title", "إشعار جديد"),
    body: readString(data, "body"),
    status: readString(data, "status", "PENDING"),
    type: readString(data, "type"),
    targetRoute: readString(data, "targetRoute"),
    targetParams: readMap(data, "targetParams"),
    createdAt: readNumber(data, "createdAt"),
    readAt: readNumber(data, "readAt") || undefined,
  };
}

export function useWebStaffNotifications() {
  const { actor } = useStaffActor();

  const uid = auth.currentUser?.uid ?? "";
  const orgId = actor.orgId || "takween";
  const personId = actor.personId || "";

  const [itemsByQuery, setItemsByQuery] = useState<
    Record<string, WebStaffNotification[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uid || !orgId) {
      setItemsByQuery({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const unsubscribers: Array<() => void> = [];

    const logsRef = collection(db, `orgs/${orgId}/notificationLogs`);

    const queries = [
      {
        key: "recipientUid",
        enabled: !!uid,
        q: query(logsRef, where("recipientUid", "==", uid)),
      },
      {
        key: "staffPersonId",
        enabled: !!personId,
        q: query(logsRef, where("staffPersonId", "==", personId)),
      },
      {
        key: "recipientPersonId",
        enabled: !!personId,
        q: query(logsRef, where("recipientPersonId", "==", personId)),
      },
    ].filter((item) => item.enabled);

    if (!queries.length) {
      setItemsByQuery({});
      setLoading(false);
      return;
    }

    for (const item of queries) {
      const unsubscribe = onSnapshot(
        item.q,
        (snapshot) => {
          setItemsByQuery((current) => ({
            ...current,
            [item.key]: snapshot.docs.map(notificationFromDoc),
          }));
          setLoading(false);
        },
        (err) => {
          console.error("Failed to load staff notifications", err);
          setError(err.message || "تعذر تحميل الإشعارات");
          setLoading(false);
        },
      );

      unsubscribers.push(unsubscribe);
    }

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }, [uid, orgId, personId]);

  const notifications = useMemo(() => {
    const byId = new Map<string, WebStaffNotification>();

    for (const list of Object.values(itemsByQuery)) {
      for (const item of list) {
        byId.set(item.id, item);
      }
    }

    return Array.from(byId.values()).sort(
      (a, b) => b.createdAt - a.createdAt,
    );
  }, [itemsByQuery]);

  const unreadCount = notifications.filter(
    (notification) => notification.status !== "READ",
  ).length;

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!orgId || !notificationId) return;

      const now = Date.now();

      await updateDoc(
        doc(db, `orgs/${orgId}/notificationLogs/${notificationId}`),
        {
          status: "READ",
          readAt: now,
          updatedAt: now,
        },
      );
    },
    [orgId],
  );

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
  };
}