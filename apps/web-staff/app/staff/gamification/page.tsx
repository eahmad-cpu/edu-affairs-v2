import { Star } from "lucide-react";
import { StaffPlaceholderPage } from "@/components/staff/placeholder-page";

export default function StaffGamificationPage() {
  return (
    <StaffPlaceholderPage
      badge="التحفيز"
      title="تحفيز الطلاب"
      description="ستتيح هذه الصفحة إضافة نقاط أو شارات أو ملاحظات إيجابية للطلاب حسب الصلاحية."
      icon={<Star className="size-7" />}
      items={[
        "تحفيز طالب",
        "تحفيز مجموعة طلاب",
        "XP والنقاط",
        "الشارات والملاحظات الإيجابية",
      ]}
    />
  );
}