import { GraduationCap } from "lucide-react";
import { StaffPlaceholderPage } from "@/components/staff/placeholder-page";

export default function StaffEvaluationsPage() {
  return (
    <StaffPlaceholderPage
      badge="تقييماتي"
      title="التقييمات المطلوبة مني"
      description="ستعرض هذه الصفحة التقييمات والزيارات المطلوبة من المستخدم، وتقييماته الشخصية لاحقًا."
      icon={<GraduationCap className="size-7" />}
      items={[
        "الدورات المفتوحة",
        "المعلمون أو الموظفون المطلوب تقييمهم",
        "المسودات",
        "التقييمات المكتملة",
      ]}
    />
  );
}