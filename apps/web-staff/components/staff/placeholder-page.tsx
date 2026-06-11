import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function StaffPlaceholderPage({
  badge,
  title,
  description,
  icon,
  items = [],
}: {
  badge: string;
  title: string;
  description: string;
  icon?: ReactNode;
  items?: string[];
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Badge variant="secondary" className="w-fit">
                {badge}
              </Badge>

              <CardTitle className="text-2xl">{title}</CardTitle>

              <CardDescription className="max-w-2xl">
                {description}
              </CardDescription>
            </div>

            {icon ? (
              <div className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                {icon}
              </div>
            ) : null}
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4">
            <p className="text-sm font-semibold text-foreground">
              هذه صفحة هيكلية مؤقتة
            </p>

            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              سيتم ربطها لاحقًا ببيانات المستخدم الفعلية من العضويات
              والإسنادات ونتائج domain.
            </p>
          </div>
        </CardContent>
      </Card>

      {items.length ? (
        <Card>
          <CardHeader>
            <CardTitle>ما سيتم بناؤه هنا</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid gap-2 md:grid-cols-2">
              {items.map((item) => (
                <div
                  key={item}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground"
                >
                  {item}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}