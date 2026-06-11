import { initializeApp } from "firebase-admin/app";
import { onRequest } from "firebase-functions/v2/https";

initializeApp();

export { onNotificationEventCreated } from "./notifications/on-notification-event-created";

export const functionsHealth = onRequest(
  {
    region: "me-central2",
    cors: true,
  },
  (_request, response) => {
    response.json({
      ok: true,
      service: "edu-affairs-functions",
      region: "me-central2",
      timestamp: Date.now(),
    });
  },
);