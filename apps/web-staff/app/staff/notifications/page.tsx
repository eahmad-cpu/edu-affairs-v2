"use client";

import { Bell, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  useWebStaffNotifications,
  type WebStaffNotification,
} from "@/hooks/use-web-staff-notifications";

function formatDate(timestamp: number) {
  if (!timestamp) return "غير محدد";

  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function getStatusLabel(status: string) {
  if (status === "READ") return "مقروء";
  if (status === "SENT") return "مرسل";
  if (status === "FAILED") return "فشل";
  return "جديد";
}

function NotificationCard({
  notification,
  onMarkAsRead,
}: {
  notification: WebStaffNotification;
  onMarkAsRead: () => void;
}) {
  const isRead = notification.status === "READ";

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Bell className="size-5" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-foreground">
                {notification.title}
              </h2>

              {!isRead ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                  جديد
                </span>
              ) : null}
            </div>

            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {notification.body}
            </p>

            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{formatDate(notification.createdAt)}</span>
              <span>•</span>
              <span>{getStatusLabel(notification.status)}</span>
              {notification.type ? (
                <>
                  <span>•</span>
                  <span>{notification.type}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {!isRead ? (
          <Button type="button" variant="outline" onClick={onMarkAsRead}>
            <CheckCircle2 className="size-4" />
            تعليم كمقروء
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export default function StaffNotificationsPage() {
  const { notifications, loading, error, markAsRead } =
    useWebStaffNotifications();

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Bell className="size-5" />
          </div>

          <div>
            <h1 className="text-xl font-bold">الإشعارات</h1>
            <p className="text-sm text-muted-foreground">
              آخر التحديثات والتنبيهات الخاصة بك داخل بوابة الموظفين.
            </p>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-8 text-muted-foreground">
          <Loader2 className="ml-2 size-5 animate-spin" />
          جاري تحميل الإشعارات...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!loading && !error && notifications.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
          لا توجد إشعارات حتى الآن.
        </div>
      ) : null}

      <div className="space-y-3">
        {notifications.map((notification) => (
          <NotificationCard
            key={notification.id}
            notification={notification}
            onMarkAsRead={() => markAsRead(notification.id)}
          />
        ))}
      </div>
    </div>
  );
}