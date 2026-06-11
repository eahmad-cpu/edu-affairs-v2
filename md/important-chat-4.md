ممتاز. نبدأ بتصميم `packages/domain` على الورق فقط.

## الهدف من `packages/domain`

`packages/domain` يكون المكان المركزي لكل منطق التشغيل، بدل أن نكرره داخل صفحات `web-admin` أو `web-staff`.

الفكرة:

```txt
contracts = شكل البيانات
domain = منطق استخدام البيانات
apps = واجهات فقط
```

يعني الواجهة تسأل `domain`:

```txt
ما الفصول التي يراها هذا المستخدم؟
هل هذا المستخدم يستطيع تسجيل حضور هذا الفصل؟
هل هذا القياس يحتاج خطة فاقد؟
من المعلمون المطلوب تقييمهم لهذا المشرف؟
كيف نحسب مؤشر التحسن؟
```

ولا تعيد كتابة هذه القواعد داخل كل صفحة.

---

## لماذا نحتاجه من البداية؟

لأن عندنا بالفعل منطق بدأ يظهر في ملفات متفرقة مثل:

```txt
assignment-people.ts
evaluation-distribution.ts
evaluation-assignment-bootstrap.ts
evaluation-read-model.ts
```

وهذه كلها ليست UI، بل منطق نطاقات وتوزيع وتلخيص. إذًا مكانها الطبيعي لاحقًا يكون داخل `packages/domain` بدل بقائها داخل `apps/web-admin/lib`.    

---

# التصميم المقترح لـ `packages/domain`

## 1. `access`

مسؤول عن الصلاحيات والنطاقات.

وظائفه:

```txt
- تحديد المدارس التي يراها المستخدم
- تحديد الفصول التي يراها المستخدم
- تحديد خطوط الباص التي يراها المستخدم
- تحديد الطلاب أو الموظفين الذين يدخلون ضمن نطاقه
- فحص هل يستطيع تنفيذ عملية معينة
```

أمثلة دوال مستقبلية:

```txt
getVisibleSchoolsForActor
getVisibleClassesForActor
getVisibleRoutesForActor
canRunOperation
canViewStudent
canEvaluateStaffMember
```

هذا سيخدم `web-staff` جدًا.

---

## 2. `assignments`

مسؤول عن الإسنادات.

عنده نوعان:

```txt
TeacherAssignment
OperationalAssignment
```

### TeacherAssignment

يبقى للإسناد التعليمي:

```txt
معلم فصل
معلم مادة
معلمة قيم
معلمة أركان
معلمة قرآن
```

### OperationalAssignment

يكون أوسع للتشغيل اليومي:

```txt
وكيل مسؤول عن حضور مدرسة
مشرف باص مسؤول عن خط
مشرف مسؤول عن معلمين
موجه مسؤول عن قضايا
معلم مسؤول عن تحفيز فصل
```

وظائفه:

```txt
resolveActorAssignments
getAssignmentsByOperationKind
getAssignmentScopes
buildOperationalAccessProfile
```

---

## 3. `operations`

هذا هو القلب العام.

يعرف النمط:

```txt
Template → Assignment → Batch → Record
```

وظائفه:

```txt
- إنشاء تصور دفعة تشغيل
- التحقق من أن المستخدم يملك صلاحية الدفعة
- تحديد المستهدفين داخل الدفعة
- حساب حالة الدفعة
- حساب عدد المكتمل وغير المكتمل
```

أمثلة:

```txt
buildOperationBatchDraft
validateBatchScope
resolveBatchTargets
calculateBatchCompletion
```

وهذا عام، ثم تستخدمه القياسات والحضور والنقل والتقييمات.

---

## 4. `student-measurements`

خاص بقياسات ومتابعات الطلاب.

وظائفه:

```txt
- تحديد القوالب المناسبة للطالب أو الفصل
- حساب هل القياس يحتاج فاقد
- بناء سجلات الطلاب من دفعة قياس
- حساب ملخص قياسات الطالب
- حساب ملخص قياسات الفصل
```

أمثلة دوال:

```txt
filterAssessmentTemplatesForClass
filterTrackerTemplatesForClass
calculateLearningLossDecision
buildStudentAssessmentRecordsFromBatch
buildStudentTrackerEntriesFromBatch
```

---

## 5. `learning-loss`

خاص بالفاقد التعليمي.

وظائفه:

```txt
- إنشاء خطة فاقد من قياس
- حساب فرق التحسن
- حساب نسبة التحسن
- تحديد مؤشر التحسن
- تحديد حالة الخطة بعد القياس الأول أو الثاني
```

أمثلة:

```txt
buildLearningLossPlanFromAssessment
calculateImprovement
resolveLearningLossIndicator
resolveLearningLossStatus
```

وهذا مهم لأننا لا نريد تكرار منطق التحسن داخل صفحات مختلفة.

---

## 6. `student-attendance`

خاص بالحضور الدراسي.

وظائفه:

```txt
- بناء دفعة حضور لفصل في يوم دراسي
- تحديد طلاب الفصل
- إنشاء سجلات حضور لكل طالب
- حساب ملخص الحضور
- حساب الغياب والتأخر
```

أمثلة:

```txt
buildAttendanceBatch
buildAttendanceRecordsFromBatch
calculateClassAttendanceSummary
calculateStudentAttendanceSummary
```

---

## 7. `student-transport`

خاص بالباص والنقل.

وظائفه:

```txt
- تحديد خطوط الباص التي يراها مشرف الباص
- تحديد طلاب الخط
- بناء دفعة حضور صعود / نزول
- إنشاء سجلات حضور النقل
- حساب ملخصات النقل
```

أمثلة:

```txt
getVisibleRoutesForTransportSupervisor
buildTransportAttendanceBatch
buildTransportAttendanceRecords
```

---

## 8. `student-cases`

خاص بالقضايا والإحالات.

وظائفه:

```txt
- هل يستطيع المستخدم إحالة طالب؟
- إلى من تُحال القضية؟
- ما المسار التالي للقضية؟
- هل يستطيع المستخدم إغلاق القضية؟
- هل تظهر لولي الأمر؟
```

أمثلة:

```txt
canReferStudentCase
resolveCaseRouting
resolveCaseNextAssignees
canCloseCase
```

---

## 9. `student-notes`

خاص بالملاحظات.

وظائفه:

```txt
- من يستطيع إضافة ملاحظة؟
- ما مستوى ظهور الملاحظة؟
- هل الملاحظة داخلية فقط أم قابلة للظهور لولي الأمر؟
- فلترة الملاحظات حسب الدور
```

أمثلة:

```txt
canCreateStudentNote
resolveNoteVisibility
filterNotesForActor
```

---

## 10. `staff-evaluations`

خاص بتقييم المعلمين والإداريين.

عندنا نواة قوية بالفعل في ملفات التوزيع والتلخيص، والفكرة أن ننقل هذا المنطق إلى `packages/domain`.  

وظائفه:

```txt
- تحديد من يقيم من
- بناء مهام التقييم للمستخدم
- توزيع المستهدفين على المقيمين
- بناء submissions
- حساب ملخصات التقييم
```

أمثلة:

```txt
buildEvaluationAssignments
buildCycleDistributionPreview
buildEvaluationTasksForActor
buildEvaluationSummaryReadModels
```

---

## 11. `staff-workspace`

هذا يخدم الصفحة الرئيسية في `web-staff`.

وظيفته تجميع ما يراه المستخدم بعد تسجيل الدخول:

```txt
- فصولي
- طلابي
- مهام الحضور
- مهام القياسات
- مهام التقييم
- قضايا محالة
- خطوط النقل
```

أمثلة:

```txt
buildStaffHome
buildMyClasses
buildMyTasks
buildMyPendingEvaluations
```

---

# شكل المجلد المقترح

```txt
packages/domain
│
├── src
│   ├── index.ts
│   │
│   ├── access
│   │   └── index.ts
│   │
│   ├── assignments
│   │   └── index.ts
│   │
│   ├── operations
│   │   └── index.ts
│   │
│   ├── student-measurements
│   │   └── index.ts
│   │
│   ├── learning-loss
│   │   └── index.ts
│   │
│   ├── student-attendance
│   │   └── index.ts
│   │
│   ├── student-transport
│   │   └── index.ts
│   │
│   ├── student-cases
│   │   └── index.ts
│   │
│   ├── student-notes
│   │   └── index.ts
│   │
│   ├── staff-evaluations
│   │   └── index.ts
│   │
│   └── staff-workspace
│       └── index.ts
│
├── package.json
└── tsconfig.json
```

---

# قاعدة مهمة في `domain`

`packages/domain` لا يتصل مباشرة بـ Firebase.

يعني لا نضع فيه:

```txt
getDoc
getDocs
collection
query
```

بل يأخذ بيانات جاهزة من التطبيق، ويرجع نتيجة.

مثال:

```txt
input:
- memberships
- people
- classes
- assignments

output:
- الفصول المسموحة لهذا المستخدم
```

هذا يجعله:

```txt
قابل للاختبار
قابل للاستخدام في web-admin و web-staff و functions
لا يعتمد على واجهة معينة
```

---

## العلاقة بين التطبيقات

```txt
web-admin
  يستخدم contracts + domain

web-staff
  يستخدم contracts + domain

functions
  تستخدم contracts + domain

contracts
  يعرف البيانات

domain
  يطبق القواعد
```

---

## ما الذي نثبته الآن؟

أقترح اعتماد هذه القرارات:

```txt
1. packages/domain جزء أساسي من البداية.
2. لا يحتوي على Firebase calls.
3. ينقل إليه منطق:
   - assignment-people
   - evaluation-distribution
   - evaluation-read-model
   - evaluation-assignment-bootstrap
   تدريجيًا.
4. نبدأ فيه بالوحدات الأكثر أهمية:
   access
   assignments
   operations
   student-measurements
   learning-loss
   staff-evaluations
   staff-workspace
```

بعد تثبيت هذا، الخطوة التالية تكون تصميم `OperationalAssignment` في `contracts`.
