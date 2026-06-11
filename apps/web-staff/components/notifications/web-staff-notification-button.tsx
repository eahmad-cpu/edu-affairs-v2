"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useWebStaffNotifications } from "@/hooks/use-web-staff-notifications";

export function WebStaffNotificationButton() {
  const router = useRouter();
  const { unreadCount } = useWebStaffNotifications();

  const visibleCount = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="relative"
      onClick={() => router.push("/staff/notifications")}
      aria-label="الإشعارات"
      title={unreadCount > 0 ? `الإشعارات (${unreadCount})` : "الإشعارات"}
    >
      <Bell className="size-4" />

      {unreadCount > 0 ? (
        <span className="absolute -left-2 -top-2 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold leading-5 text-destructive-foreground">
          {visibleCount}
        </span>
      ) : null}
    </Button>
  );
}