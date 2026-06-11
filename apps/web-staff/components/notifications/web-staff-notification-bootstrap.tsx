"use client";

import { useEffect, useRef } from "react";
import { doc, setDoc, deleteField } from "firebase/firestore";
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
} from "firebase/messaging";
import { toast } from "sonner";

import { useStaffActor } from "@/components/staff/staff-actor-provider";
import { auth, db, firebaseApp } from "@/lib/firebase";

const WEB_VAPID_KEY =
  "BJU1plPF3C-I7uBjJvezVIMXPC2HC1669RunhOaIr8Ddu-LWGiAGBsSNe00TllBnHQgN2nD5L-a7lR5XOZuJZq0";

const INSTALL_ID_KEY = "takween_web_staff_install_id";

function getOrCreateInstallId() {
  if (typeof window === "undefined") return "";

  const existing = window.localStorage.getItem(INSTALL_ID_KEY);

  if (existing) return existing;

  const next =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  window.localStorage.setItem(INSTALL_ID_KEY, next);

  return next;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveNotificationPath(data: Record<string, string>) {
  const targetRoute = data.targetRoute ?? "";

  switch (targetRoute) {
    case "CHAT_CONVERSATION":
      return "/staff/notifications";

    case "VIRTUAL_CLASS_SESSION":
      return "/staff/notifications";

    case "HOMEWORK_ASSIGNMENT":
      return "/staff/notifications";

    case "ANNOUNCEMENT":
      return "/staff/notifications";

    case "FINANCE":
      return "/staff/notifications";

    case "NOTIFICATION_DETAILS":
    default:
      return "/staff/notifications";
  }
}

export function WebStaffNotificationBootstrap() {
  const { actor } = useStaffActor();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;

    const uid = auth.currentUser?.uid ?? "";
    const orgId = readString(actor.orgId) || "takween";
    const personId = readString(actor.personId);

    if (!uid || !orgId) return;

    startedRef.current = true;

    let unsubscribeOnMessage: (() => void) | undefined;

    async function run() {
      const supported = await isSupported();

      if (!supported) {
        console.info("Firebase Messaging is not supported in this browser.");
        return;
      }

      if (!("Notification" in window)) {
        console.info("Notifications API is not available.");
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        console.info("Notification permission was not granted.");
        return;
      }

      const registration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
      );

      const messaging = getMessaging(firebaseApp);

      const token = await getToken(messaging, {
        vapidKey: WEB_VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (!token) {
        console.info("FCM token is empty.");
        return;
      }

      const installId = getOrCreateInstallId();
      const tokenDocId = `${uid}_web-staff_${installId}`;
      const now = Date.now();

      await setDoc(
        doc(db, `orgs/${orgId}/deviceTokens/${tokenDocId}`),
        {
          id: tokenDocId,
          orgId,

          uid,
          personId,
          guardianId: "",
          staffPersonId: personId,

          platform: "WEB",
          app: "web-staff",

          fcmToken: token,
          deviceId: installId,

          isActive: true,

          lastSeenAt: now,
          updatedAt: now,

          lastErrorCode: "",
          lastErrorMessage: "",
          disabledAt: deleteField(),
        },
        { merge: true },
      );

      console.info("Web-staff FCM token saved:", tokenDocId);

      unsubscribeOnMessage = onMessage(messaging, (message) => {
        const title = message.notification?.title ?? "إشعار جديد";
        const body =
          message.notification?.body ?? "لديك تحديث جديد من المنصة.";

        toast(title, {
          description: body,
          action: {
            label: "فتح",
            onClick: () => {
              const path = resolveNotificationPath(message.data ?? {});
              window.location.href = path;
            },
          },
        });
      });
    }

    void run().catch((error) => {
      startedRef.current = false;
      console.error("Failed to initialize web-staff notifications:", error);
    });

    return () => {
      unsubscribeOnMessage?.();
    };
  }, [actor.orgId, actor.personId]);

  return null;
}