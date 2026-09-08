"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { StaffPdfFileCategoryWorkspace } from "@/components/staff-pdf-files/staff-pdf-file-category-workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getStaffPdfFileCategory } from "@/lib/staff-pdf-files";

export default function StaffPdfFileCategoryPage() {
  const params = useParams<{ categoryKey: string }>();
  const category = getStaffPdfFileCategory(params.categoryKey);

  if (!category) return <Card dir="rtl" className="border-destructive/40"><CardContent className="space-y-4 p-5"><p className="font-semibold">فئة ملفات PDF غير موجودة.</p><Button asChild variant="outline"><Link href="/staff/pdf-files"><ArrowRight className="size-4" /> العودة إلى مركز الملفات</Link></Button></CardContent></Card>;

  return <StaffPdfFileCategoryWorkspace category={category} />;
}
