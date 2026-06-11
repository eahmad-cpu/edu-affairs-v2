import { Bus } from "lucide-react";
import { StaffPlaceholderPage } from "@/components/staff/placeholder-page";

export default function StaffTransportPage() {
  return (
    <StaffPlaceholderPage
      badge="النقل"
      title="النقل والباص"
      description="ستعرض هذه الصفحة خطوط النقل ودفعات الصعود والنزول حسب تكليف المستخدم."
      icon={<Bus className="size-7" />}
      items={[
        "خطوطي",
        "طلاب الخط",
        "تسجيل الصعود",
        "تسجيل النزول",
      ]}
    />
  );
}