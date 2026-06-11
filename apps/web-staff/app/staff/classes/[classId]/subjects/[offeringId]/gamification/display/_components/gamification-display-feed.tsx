"use client";

import { Loader2, Sparkles, Trophy } from "lucide-react";

import type { buildClassroomDisplayGamificationFeed } from "@takween/domain";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type GamificationDisplayFeed = ReturnType<
  typeof buildClassroomDisplayGamificationFeed
>;

type GamificationDisplayFeedProps = {
  loading: boolean;
  error: string;
  feed: GamificationDisplayFeed;
};

function formatEventTime(value: number | undefined | null) {
  if (!value) return "غير محدد";

  return new Intl.DateTimeFormat("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

export function GamificationDisplayFeed({
  loading,
  error,
  feed,
}: GamificationDisplayFeedProps) {
  const latestItems = feed.items.slice(0, 3);
  const restItems = feed.items.slice(3);

  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-[2rem] border border-dashed border-border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          جارٍ تجهيز شاشة التحفيز...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[2rem] border border-destructive/30 bg-destructive/5 p-6 text-sm leading-7 text-destructive">
        {error}
      </div>
    );
  }

  if (feed.items.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-border p-10 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-muted text-muted-foreground">
          <Trophy className="size-8" />
        </div>

        <h2 className="mt-5 text-xl font-bold">لا توجد أحداث مناسبة للعرض</h2>

        <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-muted-foreground">
          أنشئ تحفيزًا بظهور مناسب مثل: تظهر للطالب أو لوحة الترتيب، ثم حدّث
          هذه الصفحة.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {latestItems.length > 0 ? (
        <section className="grid gap-4 lg:grid-cols-3">
          {latestItems.map((item) => (
            <div
              key={item.id}
              className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-primary/5 p-6 shadow-sm"
            >
              <div className="absolute left-4 top-4 text-6xl opacity-20">
                {item.emoji}
              </div>

              <div className="relative space-y-4">
                <div className="flex size-16 items-center justify-center rounded-3xl bg-background text-4xl shadow-sm">
                  {item.emoji}
                </div>

                <div>
                  <h2 className="text-2xl font-black leading-10 text-foreground">
                    {item.studentDisplayName}
                  </h2>

                  <p className="mt-2 text-lg font-semibold leading-8 text-primary">
                    {item.message}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {item.value.toLocaleString("ar-SA")} {item.valueKind}
                  </Badge>

                  {item.badgeTitle ? (
                    <Badge variant="outline">{item.badgeTitle}</Badge>
                  ) : null}

                  <Badge variant="outline">
                    {formatEventTime(item.occurredAt)}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {restItems.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              أحداث أخرى
            </CardTitle>
            <CardDescription>
              بقية أحداث التحفيز المناسبة للعرض.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {restItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-3xl border border-border bg-background p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-2xl">
                      {item.emoji}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">
                        {item.studentDisplayName}
                      </p>

                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {item.message}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          {item.value.toLocaleString("ar-SA")} {item.valueKind}
                        </Badge>

                        <Badge variant="outline">
                          {formatEventTime(item.occurredAt)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}