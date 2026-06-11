## تصميم `StudentMeasurementBatch`

`StudentMeasurementBatch` هو سجل يمثل **دفعة إدخال جماعية لطلاب فصل أو نطاق معين**.

المهم: هو لا يعني درجة إجمالية للفصل.
هو يعني:

```txt
المستخدم أدخل نتائج قياس/متابعة لعدة طلاب دفعة واحدة،
والنظام أنشأ أو سيُنشئ سجلات فردية لكل طالب.
```

---

## 1. الهدف منه

نحتاجه حتى نعرف:

```txt
- من أدخل الدفعة؟
- لأي مدرسة وسنة وصف وفصل؟
- ما نوع العملية؟
- ما القالب المستخدم؟
- ما الطلاب المستهدفون؟
- كم طالبًا اكتمل إدخاله؟
- هل الدفعة مسودة أم منشورة؟
- هل تم اعتمادها أو قفلها؟
- ما السجلات الفردية الناتجة عنها؟
```

بدون `Batch` سنجد سجلات فردية كثيرة، لكن لن نعرف أنها دخلت ضمن نفس العملية.

---

## 2. أين يستخدم؟

يخدم كل إدخال جماعي للطلاب، مثل:

```txt
- قياس فتري لطلاب فصل كامل
- اختبار تشخيصي لطلاب فصل كامل
- قياس مركزي لطلاب فصل كامل
- متابعة قرآن لطلاب فصل كامل
- متابعة فاقد لطلاب فصل كامل
- تقييم قيم لطلاب فصل في وحدة وأسبوع
- تقييم أركان لطلاب فصل في وحدة وأسبوع
```

---

## 3. مكان التخزين المقترح

داخل المؤسسة:

```txt
orgs/{orgId}/studentMeasurementBatches/{batchId}
```

والسجلات الفردية تبقى في أماكنها:

```txt
orgs/{orgId}/studentAssessmentRecords/{recordId}
orgs/{orgId}/studentTrackerEntries/{entryId}
```

ونضيف فيها لاحقًا:

```txt
batchId
```

حتى نعرف أن هذا السجل الفردي خرج من هذه الدفعة.

---

## 4. الأنواع المقترحة

نحتاج `StudentMeasurementBatchKind`:

```txt
ASSESSMENT
TRACKER
KG_VALUES
KG_CORNERS
KG_QURAN
LEARNING_LOSS_TRACKER
CUSTOM
```

شرح سريع:

```txt
ASSESSMENT:
قياس رسمي مثل تشخيصي، فتري، مركزي، قياسات الروضة.

TRACKER:
متابعة مستمرة عامة.

KG_VALUES:
تقييم قيم لطلاب فصل.

KG_CORNERS:
تقييم أركان لطلاب فصل.

KG_QURAN:
متابعة قرآن جماعية.

LEARNING_LOSS_TRACKER:
متابعة فاقد جماعية.

CUSTOM:
أي نوع مخصص لاحقًا.
```

---

## 5. حالة الدفعة

نحتاج `StudentMeasurementBatchStatus`:

```txt
DRAFT
IN_PROGRESS
SUBMITTED
REVIEWED
LOCKED
CANCELLED
```

المعاني:

```txt
DRAFT:
تم إنشاء الدفعة ولم تكتمل.

IN_PROGRESS:
بدأ الإدخال.

SUBMITTED:
تم إرسال الدفعة.

REVIEWED:
تمت مراجعتها.

LOCKED:
مقفلة ولا تعدل إلا بصلاحية خاصة.

CANCELLED:
ملغاة.
```

---

## 6. الحقول الأساسية

### بيانات الربط

```txt
id
orgId
schoolId
academicYearId
gradeId
classId
```

لأن أغلب الدفعات ستكون على فصل.

ونترك مرونة لاحقًا بإضافة:

```txt
scopeType
scopeId
```

لكن كبداية قياسات الطلاب ترتبط غالبًا بفصل.

---

### بيانات العملية

```txt
batchKind
templateId
templateTitle
assessmentKind
trackerKind
assessmentSlot
subjectKey
```

هذه تساعدنا نعرف نوع ما تم إدخاله.

مثال:

```txt
batchKind = ASSESSMENT
assessmentKind = PRIMARY_PERIODIC_TEST_1
assessmentSlot = PRIMARY_PERIODIC_1
templateTitle = اختبار فتري أول
```

أو:

```txt
batchKind = KG_VALUES
templateTitle = تقييم القيم - الوحدة الأولى - الأسبوع الأول
```

---

### بيانات الوحدة والأسبوع

مهمة جدًا للروضة والقيم والأركان:

```txt
unitKey
unitTitle
weekNumber
weekLabel
```

مثال:

```txt
unitKey = unit-1
unitTitle = الوحدة الأولى
weekNumber = 1
weekLabel = الأسبوع الأول
```

---

### بيانات من أنشأ الدفعة

```txt
createdByPersonId
createdByRoleKey
operationalAssignmentId
teacherAssignmentId
```

الحقول الأخيرة اختيارية.

الفائدة:

```txt
operationalAssignmentId:
يربط الدفعة بتكليف تشغيلي واضح.

teacherAssignmentId:
لو الدفعة ناتجة من إسناد تعليمي مثل معلم فصل.
```

---

### بيانات الوقت

```txt
measuredAt
createdAt
updatedAt
submittedAt
reviewedAt
lockedAt
cancelledAt
```

`measuredAt` هو تاريخ القياس أو المتابعة نفسها.

---

## 7. الطلاب المستهدفون

نحتاج داخل الدفعة ملخصًا للطلاب المستهدفين:

```txt
targetStudentIds
```

وأيضًا إحصائيات:

```txt
targetCount
completedCount
missingCount
```

مثال:

```txt
targetCount = 25
completedCount = 23
missingCount = 2
```

---

## 8. السجلات الناتجة

نحتاج خريطة تربط الطالب بالسجل الفردي الناتج:

```txt
recordRefs
```

مثال:

```txt
recordRefs:
[
  {
    studentId: "student1",
    recordType: "ASSESSMENT_RECORD",
    recordId: "record1",
    status: "COMPLETED"
  },
  {
    studentId: "student2",
    recordType: "ASSESSMENT_RECORD",
    recordId: "record2",
    status: "MISSING"
  }
]
```

أو نستخدم Map لاحقًا، لكن Array أسهل في Firestore والقراءة.

---

## 9. درجات الطلاب داخل الدفعة

عندنا خياران:

### الخيار الأول

لا نخزن درجات الطلاب داخل `Batch`، بل نخزنها فقط في السجلات الفردية.

ميزة:

```txt
لا يوجد تكرار كبير.
```

عيب:

```txt
الدفعة لا تعرض التفاصيل بسرعة إلا بعد قراءة السجلات الفردية.
```

### الخيار الثاني

نخزن داخل `Batch` نسخة خفيفة من إدخال كل طالب.

مثال:

```txt
studentRows:
[
  {
    studentId,
    status,
    score,
    maxScore,
    level,
    valueText,
    itemScores,
    note,
    recordId
  }
]
```

ميزة:

```txt
مراجعة الدفعة سهلة وسريعة.
```

عيب:

```txt
فيه تكرار مع السجلات الفردية.
```

## رأيي

نستخدم الخيار الثاني، لكن بنسخة خفيفة.

لأن Staff Portal يحتاج يعرض الدفعة بسرعة:

```txt
من اكتمل؟
من ناقص؟
ما درجة كل طالب؟
```

ثم السجلات الفردية تبقى المصدر النهائي داخل ملف الطالب.

---

## 10. `StudentMeasurementBatchStudentRow`

نحتاج صف لكل طالب داخل الدفعة:

```txt
studentId
studentDisplayName
status
score
maxScore
level
valueText
passed
completed
itemScores
note
recordType
recordId
```

### status

```txt
PENDING
COMPLETED
ABSENT
EXCUSED
SKIPPED
```

مثال:

```txt
PENDING:
لم يتم إدخال نتيجة الطالب بعد.

COMPLETED:
تم الإدخال.

ABSENT:
الطالب غائب وقت القياس.

EXCUSED:
مستثنى أو له عذر.

SKIPPED:
تم تخطيه.
```

---

## 11. علاقة `itemScores`

كل طالب داخل الدفعة قد يكون له:

```txt
itemScores
```

مثال تقييم قيم:

```txt
الطالب أحمد:
- التعاون: 5 من 5
- النظافة: 4 من 5
- احترام الآخرين: 5 من 5
```

وهذه نفس البنية الموحدة `OperationItemScore`.

ثم عند نشر الدفعة، تنتقل هذه البنود إلى السجل الفردي للطالب.

---

## 12. علاقة القوالب

القالب يحدد البنود:

```txt
template.items
```

والدفعة تستخدم القالب.

ثم الطالب يحصل على نتائج البنود داخل:

```txt
studentRows.itemScores
```

والسجل النهائي للطالب يحصل على:

```txt
record.itemScores
```

---

## 13. طريقة العمل في `web-staff`

تدفق العمل يكون:

```txt
المستخدم يدخل
← يرى فصوله أو نطاقه
← يختار فصل
← يختار نوع القياس/المتابعة
← يختار القالب
← تظهر قائمة الطلاب
← يدخل الدرجات لكل طالب
← يحفظ كمسودة
← يراجع
← يرسل
← النظام ينشئ سجلات فردية
```

---

## 14. هل ننشئ السجلات الفردية فورًا أم عند الإرسال؟

أفضل خيار:

```txt
أثناء الحفظ كمسودة:
نحفظ Batch فقط.

عند الإرسال:
ننشئ StudentAssessmentRecord أو StudentTrackerEntry لكل طالب مكتمل.
```

السبب:

```txt
المسودة قد تتغير كثيرًا.
ولا نريد إنشاء سجلات طالب غير نهائية.
```

لكن يمكن لاحقًا دعم auto-save داخل Batch.

---

## 15. عند الإرسال ماذا يحدث؟

إذا `batchKind = ASSESSMENT`:

```txt
ينشئ StudentAssessmentRecord لكل طالب مكتمل
```

إذا `batchKind = TRACKER` أو `KG_QURAN` أو `LEARNING_LOSS_TRACKER`:

```txt
ينشئ StudentTrackerEntry لكل طالب مكتمل
```

إذا `batchKind = KG_VALUES` أو `KG_CORNERS`:

لدينا خياران:

```txt
1. نخزنها كـ StudentAssessmentRecord
2. أو ننشئ StudentSpecialistEvaluationRecord
```

رأيي الحالي:

نستخدم `StudentAssessmentRecord` مع `itemScores`، لأن هذه أيضًا تقييمات بنود للطالب، ولا نريد فتح كيان جديد إلا لو احتجنا لاحقًا.

---

## 16. هل الدفعة تحتاج اعتماد؟

نعم، لكن ليس دائمًا.

نضيف:

```txt
requiresReview
reviewedByPersonId
reviewedAt
```

أمثلة:

```txt
قياس مركزي:
قد يحتاج مراجعة.

متابعة عادية:
لا تحتاج.

تقييم قيم:
قد يحتاج فقط إرسال.

تقييم مشرف:
قد يحتاج اعتماد.
```

هذا يحدده القالب أو السياسة لاحقًا.

---

## 17. ملخص الحقول المقترحة

```txt
StudentMeasurementBatch

id
orgId
schoolId
academicYearId
gradeId
classId

batchKind
status

templateId
templateTitle
assessmentKind
trackerKind
assessmentSlot
subjectKey

unitKey
unitTitle
weekNumber
weekLabel

targetStudentIds
targetCount
completedCount
missingCount

studentRows

createdByPersonId
createdByRoleKey
operationalAssignmentId
teacherAssignmentId

measuredAt
submittedAt
reviewedAt
reviewedByPersonId
lockedAt
cancelledAt
cancelReason

requiresReview
note

createdAt
updatedAt
```

---

## 18. القرار المقترح

نعتمد `StudentMeasurementBatch` كالتالي:

```txt
دفعة إدخال جماعية لطلاب فصل/نطاق.
لا تمثل درجة للفصل.
تحتوي studentRows لسهولة الإدخال والمراجعة.
وعند الإرسال تنشئ سجلات فردية لكل طالب مكتمل.
```

## 19. ما الذي نحتاج إضافته لاحقًا في سجلات الطالب؟

نضيف اختياريًا إلى:

```txt
StudentAssessmentRecord
StudentTrackerEntry
```

هذه الحقول:

```txt
batchId
batchKind
itemScores
```

حتى نربط السجل الفردي بالدفعة ونحفظ تفاصيل البنود.

---

## الخطوة التالية بعد اعتماد هذا

بعد `StudentMeasurementBatch` ننتقل إلى:

```txt
تصميم web-staff على الورق:
- الرئيسية
- فصولي
- مهامي
- تقييماتي
```

ثم بعد ذلك نقرر التنفيذ.
