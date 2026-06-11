import { FileText } from "lucide-react";
import { StaffPlaceholderPage } from "@/components/staff/placeholder-page";

export default function StaffCasesPage() {
  return (
    <StaffPlaceholderPage
      badge="القضايا"
      title="القضايا والإحالات"
      description="ستعرض هذه الصفحة القضايا المحالة للمستخدم وإمكانية إنشاء إحالات جديدة حسب الصلاحية."
      icon={<FileText className="size-7" />}
      items={[
        "القضايا المحالة لي",
        "إنشاء إحالة طالب",
        "إضافة إجراء",
        "تحويل أو إغلاق القضية",
      ]}
    />
  );
}