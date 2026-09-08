"use client";

import { FormEvent, useState } from "react";
import { FileUp, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { StaffPdfFileCategoryKey } from "@takween/contracts";

import { useStaffActor } from "@/components/staff/staff-actor-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getStaffPdfFileErrorMessage,
  uploadStaffPdfFile,
  validateStaffPdfFile,
} from "@/lib/staff-pdf-files";

export function StaffPdfFileUploadForm(props: {
  categoryKey: StaffPdfFileCategoryKey;
  onUploaded: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const { actor } = useStaffActor();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      toast.error("اختر ملف PDF أولاً.");
      return;
    }

    try {
      validateStaffPdfFile(file);
      setUploading(true);
      await uploadStaffPdfFile({
        actor,
        categoryKey: props.categoryKey,
        title,
        description,
        file,
      });
      toast.success("تم رفع ملف PDF وحفظ بياناته.");
      setFile(null);
      setTitle("");
      setDescription("");
      await props.onUploaded();
      props.onCancel();
    } catch (error) {
      toast.error(getStaffPdfFileErrorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  return <Card className="border-primary/30"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileUp className="size-4 text-primary" /> رفع ملف PDF</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={(event) => void submit(event)}><label className="block space-y-2 text-sm"><span className="font-medium">ملف PDF <span className="text-destructive">*</span></span><span className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-6 text-center transition hover:border-primary/60 hover:bg-primary/10"><span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground"><Plus className="size-7" /></span><span className="font-medium">{file ? file.name : "اضغط هنا لاختيار ملف PDF"}</span><span className="text-xs text-muted-foreground">PDF فقط، بحد أقصى 20 ميجابايت.</span></span><input type="file" accept="application/pdf,.pdf" required={!file} disabled={uploading} onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="sr-only" /></label><label className="block space-y-2 text-sm"><span className="font-medium">عنوان الملف <span className="text-destructive">*</span></span><input value={title} required disabled={uploading} onChange={(event) => setTitle(event.target.value)} className="h-11 w-full rounded-xl border bg-background px-3" /></label><label className="block space-y-2 text-sm"><span className="font-medium">الوصف <span className="font-normal text-muted-foreground">(اختياري)</span></span><textarea value={description} disabled={uploading} onChange={(event) => setDescription(event.target.value)} className="min-h-24 w-full rounded-xl border bg-background p-3" /></label><div className="flex flex-wrap gap-2"><Button type="submit" disabled={uploading}>{uploading ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />} {uploading ? "جارٍ رفع الملف..." : "رفع ملف PDF"}</Button><Button type="button" variant="outline" disabled={uploading} onClick={props.onCancel}>إلغاء</Button></div></form></CardContent></Card>;
}
