

نعم، المشكلة مفهومة.

أنت تستخدم:

```tsx
<option key={item.id} value={item.id}>
```

لكن `item.id` ليس فريدًا عالميًا.

مثال:

```txt
kg1
g4-quran-1
g5-general-1
```

هذه IDs ممكن تتكرر بين أكثر من مدرسة أو أكثر من سنة دراسية، لأن `GradeSchema` نفسه يحتوي على `id` ومعه `schoolId` و `academicYearId`، وهذا معناه أن هوية الصف الحقيقية ليست `id` وحده، بل معه سياقه. 
ونفس الفكرة موجودة في `ClassSchema`: الفصل له `id` ومعه `schoolId` و `academicYearId` و `gradeId`، لذلك `classId` وحده قد يتكرر بين سنوات أو مدارس مختلفة. 

## الحل السريع للـ React warning

بدّل:

```tsx
{gradeOptions.map((item) => (
  <option key={item.id} value={item.id}>
    {item.title}
  </option>
))}
```

إلى:

```tsx
{gradeOptions.map((item) => (
  <option
    key={`${item.schoolId}:${item.academicYearId}:${item.id}`}
    value={item.id}
  >
    {item.title}
  </option>
))}
```

لكن هذا يحل تحذير React فقط، وقد يبقى عندك غموض في الاختيار لو فيه أكثر من `kg1`.

## الحل الأفضل

الأفضل أن `gradeOptions` نفسها تكون مفلترة حسب المدرسة والسنة المختارة، وليس كل الصفوف من كل المدارس والسنوات.

يعني لو عندك state مثل:

```tsx
const [schoolId, setSchoolId] = useState("");
const [academicYearId, setAcademicYearId] = useState("");
```

اجعل `gradeOptions` هكذا:

```tsx
const gradeOptions = useMemo(() => {
  return grades
    .filter((item) => item.schoolId === schoolId)
    .filter((item) => item.academicYearId === academicYearId)
    .filter((item) => item.isArchived !== true)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}, [grades, schoolId, academicYearId]);
```

ثم:

```tsx
{gradeOptions.map((item) => (
  <option
    key={`${item.schoolId}:${item.academicYearId}:${item.id}`}
    value={item.id}
  >
    {item.title}
  </option>
))}
```

## طبّق نفس الفكرة على كل القوائم

### streams

```tsx
{streamOptions.map((item) => (
  <option
    key={`${item.schoolId}:${item.academicYearId}:${item.id}`}
    value={item.id}
  >
    {item.title}
  </option>
))}
```

### classes

```tsx
{classOptions.map((item) => (
  <option
    key={`${item.schoolId}:${item.academicYearId}:${item.id}`}
    value={item.id}
  >
    {item.title}
  </option>
))}
```

ومهم جدًا أن `classOptions` تكون مفلترة حسب المدرسة والسنة والصف والمسار:

```tsx
const classOptions = useMemo(() => {
  return classes
    .filter((item) => item.schoolId === schoolId)
    .filter((item) => item.academicYearId === academicYearId)
    .filter((item) => !gradeId || item.gradeId === gradeId)
    .filter((item) => !streamId || item.streamId === streamId)
    .filter((item) => item.isArchived !== true)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}, [classes, schoolId, academicYearId, gradeId, streamId]);
```

## مهم عند تغيير المدرسة أو السنة

لازم تصفّر القيم التابعة، حتى لا يبقى `gradeId` من سنة قديمة أو مدرسة أخرى:

```tsx
function handleSchoolChange(nextSchoolId: string) {
  setSchoolId(nextSchoolId);
  setAcademicYearId("");
  setGradeId("");
  setStreamId("");
  setClassId("");
}

function handleAcademicYearChange(nextYearId: string) {
  setAcademicYearId(nextYearId);
  setGradeId("");
  setStreamId("");
  setClassId("");
}

function handleGradeChange(nextGradeId: string) {
  setGradeId(nextGradeId);
  setClassId("");
}

function handleStreamChange(nextStreamId: string) {
  setStreamId(nextStreamId);
  setClassId("");
}
```

## الخلاصة

لا تغيّر IDs في Firestore الآن.

الحل الصحيح في الواجهة:

```tsx
key={`${item.schoolId}:${item.academicYearId}:${item.id}`}
```

مع فلترة الخيارات حسب `schoolId` و `academicYearId`.

لأن `kg1` ليس خطأ في ذاته؛ الخطأ أنك تعرض أكثر من `kg1` في نفس القائمة مرة واحدة.





نعم، سبب ظهور الخطأ **عند اختيار السنة الدراسية تحديدًا** واضح من الملف.

أنت تجمع الصفوف/المسارات/الفصول من **كل السنوات في كل المدارس**، لكن داخل `LabelRow` تحفظ فقط:

```ts
id
yearId
title
```

ولا تحفظ `schoolId`.

ثم تعمل فلترة الصفوف هكذا:

```ts
const gradeOptions = useMemo(
  () => (data?.grades ?? []).filter((item) => item.yearId === academicYearId),
  [data?.grades, academicYearId]
);
```

المشكلة: لو عندك أكثر من مدرسة فيها نفس `academicYearId`، مثلًا:

```txt
2025-2026
```

فالفلتر سيجلب صفوف كل المدارس التي عندها نفس السنة، فتظهر قيم مكررة مثل:

```txt
kg1
g4-quran-1
g5-general-1
```

ثم React يجد:

```tsx
<option key={item.id}>
```

مكررًا. وهذا مطابق للكود الحالي: `LabelRow` لا يحتوي `schoolId`، والـ options تستخدم `key={item.id}` فقط. 

## التعديل المطلوب

### 1. عدّل `LabelRow`

استبدل:

```ts
type LabelRow = {
  id: string;
  yearId: string;
  title: string;
  gradeId?: string;
  streamId?: string;
};
```

بهذا:

```ts
type LabelRow = {
  id: string;
  schoolId: string;
  yearId: string;
  title: string;
  gradeId?: string;
  streamId?: string;
};
```

---

### 2. عدّل بناء `grades / streams / classes`

استبدل جزء:

```ts
grades: gradesSnap.docs.map((item) => ({
  id: item.id,
  yearId: year.id,
  title: (item.data() as { title?: string }).title ?? item.id,
})),
streams: streamsSnap.docs.map((item) => ({
  id: item.id,
  yearId: year.id,
  title: (item.data() as { title?: string }).title ?? item.id,
})),
classes: classesSnap.docs.map((item) => {
  const classRow = item.data() as {
    title?: string;
    gradeId?: string;
    streamId?: string;
  };

  return {
    id: item.id,
    yearId: year.id,
    title: classRow.title ?? item.id,
    gradeId: classRow.gradeId ?? "",
    streamId: classRow.streamId ?? "",
  };
}),
```

بهذا:

```ts
grades: gradesSnap.docs.map((item) => ({
  id: item.id,
  schoolId: year.schoolId,
  yearId: year.id,
  title: (item.data() as { title?: string }).title ?? item.id,
})),
streams: streamsSnap.docs.map((item) => ({
  id: item.id,
  schoolId: year.schoolId,
  yearId: year.id,
  title: (item.data() as { title?: string }).title ?? item.id,
})),
classes: classesSnap.docs.map((item) => {
  const classRow = item.data() as {
    title?: string;
    gradeId?: string;
    streamId?: string;
  };

  return {
    id: item.id,
    schoolId: year.schoolId,
    yearId: year.id,
    title: classRow.title ?? item.id,
    gradeId: classRow.gradeId ?? "",
    streamId: classRow.streamId ?? "",
  };
}),
```

---

### 3. عدّل الفلاتر

استبدل:

```ts
const gradeOptions = useMemo(
  () => (data?.grades ?? []).filter((item) => item.yearId === academicYearId),
  [data?.grades, academicYearId]
);

const streamOptions = useMemo(
  () => (data?.streams ?? []).filter((item) => item.yearId === academicYearId),
  [data?.streams, academicYearId]
);
```

بهذا:

```ts
const gradeOptions = useMemo(
  () =>
    (data?.grades ?? []).filter(
      (item) => item.schoolId === schoolId && item.yearId === academicYearId
    ),
  [data?.grades, schoolId, academicYearId]
);

const streamOptions = useMemo(
  () =>
    (data?.streams ?? []).filter(
      (item) => item.schoolId === schoolId && item.yearId === academicYearId
    ),
  [data?.streams, schoolId, academicYearId]
);
```

واستبدل `classOptions` بهذا:

```ts
const classOptions = useMemo(() => {
  return (data?.classes ?? []).filter((item) => {
    if (item.schoolId !== schoolId) return false;
    if (item.yearId !== academicYearId) return false;
    if (gradeId && item.gradeId !== gradeId) return false;
    if (selectedSchoolType === "PRIMARY" && streamId && item.streamId !== streamId) {
      return false;
    }
    return true;
  });
}, [data?.classes, schoolId, academicYearId, gradeId, streamId, selectedSchoolType]);
```

---

### 4. عدّل مفاتيح `<option>`

استبدل في السنة الدراسية:

```tsx
<option key={item.id} value={item.id}>
```

بهذا:

```tsx
<option key={`${item.schoolId}:${item.id}`} value={item.id}>
```

واستبدل في الصف:

```tsx
<option key={item.id} value={item.id}>
```

بهذا:

```tsx
<option key={`${item.schoolId}:${item.yearId}:grade:${item.id}`} value={item.id}>
```

واستبدل في المسار:

```tsx
<option key={item.id} value={item.id}>
```

بهذا:

```tsx
<option key={`${item.schoolId}:${item.yearId}:stream:${item.id}`} value={item.id}>
```

واستبدل في الفصل:

```tsx
<option key={item.id} value={item.id}>
```

بهذا:

```tsx
<option key={`${item.schoolId}:${item.yearId}:class:${item.id}`} value={item.id}>
```

## الخلاصة

المشكلة ليست من `kg1` نفسه.
المشكلة أن الصفحة كانت تعتبر `yearId` كافيًا للفلترة، مع أن `yearId` قد يتكرر بين المدارس.

الصحيح أن كل فلترة هنا تكون بـ:

```txt
schoolId + academicYearId
```

وليس:

```txt
academicYearId فقط
```



فهمت منك أن المشكلة ظهرت في صفحة:

```txt
/staff/learning-loss/manual
```

وسببها نفس المشكلة القديمة: عندنا فصول IDs مثل `kg1-a` قد تتكرر بين أكثر من مدرسة أو سنة، ونحن في صفحة الفتح اليدوي استخدمنا:

```tsx
<option key={item.id} value={item.id}>
```

وهذا غير آمن؛ لأن `item.id` وحده ليس هوية فريدة. الحل الصحيح هنا ليس فقط تغيير `key`، بل أيضًا تغيير `value`، لأن اختيار الفصل نفسه سيصبح غامضًا لو أكثر من فصل له نفس `id`.

إذن التعديل المطلوب في صفحة **manual** هو:

```txt
1. إنشاء key مركب للفصل:
   orgId/schoolId/academicYearId/classId

2. استخدام هذا المفتاح في:
   key
   value

3. عند الاختيار نرجع للفصل الحقيقي من هذا المفتاح.

4. عند تحميل الطلاب لا نفلتر بـ classId فقط،
   بل نفلتر بعد القراءة أيضًا بـ:
   classId + schoolId + academicYearId
```

هذا سيحل تحذير React، وسيمنع اختيار فصل خاطئ أو جلب طلاب من مدرسة/سنة أخرى لها نفس `classId`.

هل أرسل لك الآن **التعديلات فقط** على ملف:

```txt
apps/web-staff/app/staff/learning-loss/manual/page.tsx
```

بدون إرسال الصفحة كاملة؟
