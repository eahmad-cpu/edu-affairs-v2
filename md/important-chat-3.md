## 1. ما معنى `itemScores` الموحد؟

المقصود به: شكل موحد لتخزين درجات البنود داخل أي تقييم أو قياس.

بدل أن يكون عندنا لكل نوع تقييم شكل مختلف للبنود، نستخدم بنية واحدة مثل:

```txt
itemScores:
- itemKey
- itemTitle
- score
- maxScore
- level
- valueText
- passed
- note
```

### مثال في قياس طالب

```txt
اختبار فتري أول

البنود:
- القراءة: 8 من 10
- الإملاء: 7 من 10
- الفهم: 9 من 10
```

### مثال في تقييم معلم

```txt
تقييم أسبوعي

البنود:
- التخطيط: 4 من 5
- إدارة الصف: 5 من 5
- التفاعل مع الطلاب: 4 من 5
```

### مثال في القيم أو الأركان

```txt
تقييم قيم

البنود:
- التعاون: 5 من 5
- احترام الآخرين: 4 من 5
- الالتزام: 5 من 5
```

إذن `itemScores` لا تعني نوع تقييم جديد، بل هي **طريقة موحدة لحفظ تفاصيل البنود**.

## لماذا نحتاجه؟

لأن كثيرًا من العمليات ليست درجة واحدة فقط.

عندنا:

```txt
قياسات الطلاب
تقييمات القيم
تقييمات الأركان
تقييمات المعلمين
زيارات المشرفين
تقييم الإداريين
```

كلها غالبًا فيها بنود.

فبدل أن نكرر:

```txt
studentAssessmentItems
teacherEvaluationItems
kgValuesItems
kgCornersItems
```

نستخدم نفس الشكل العام للبند، مع اختلاف القالب.

## أين يوضع؟

يوضع اختياريًا داخل السجلات الفردية، مثل:

```txt
StudentAssessmentRecord.itemScores
StudentTrackerEntry.itemScores
EvaluationSubmissionItemScore أو EvaluationSubmission.itemScores
```

لكن بما أن تقييم الموظفين عنده حاليًا `EvaluationSubmissionItemScore` مستقل، لا نكسره. يمكن نتركه كما هو، أو لاحقًا نستخدم نفس بنية `OperationItemScore` في بناء تلك السجلات.

الخلاصة:

```txt
itemScores = درجات البنود التفصيلية داخل سجل فردي.
```

---

## 2. كيف يكون `OperationalAssignment`؟

المقصود به: إسناد عام لأي تشغيل يومي، وليس للمعلمين فقط.

حاليًا عندنا `TeacherAssignment`، وهذا ممتاز للمعلمين والفصول والمواد. لكن التشغيل اليومي أوسع من التدريس.

نحتاج إسنادًا عامًا يقول:

```txt
هذا الشخص مسؤول عن هذا النطاق لهذا النوع من التشغيل.
```

### أمثلة

#### معلم فصل

```txt
personId: أحمد
operationKind: STUDENT_MEASUREMENT
scopeType: CLASS
scopeId: class-a
roleKey: BOYS_TEACHER
```

#### وكيل شؤون الطلاب

```txt
personId: خالد
operationKind: STUDENT_ATTENDANCE
scopeType: SCHOOL
scopeId: school-1
roleKey: BOYS_STUDENTS_VP
```

#### معلمة قيم

```txt
personId: فاطمة
operationKind: KG_VALUES
scopeType: SCHOOL
scopeId: kg-school
roleKey: KG_VALUES_TEACHER
coverageMode: ALL_CLASSES_IN_SCOPE
```

#### مشرف باص

```txt
personId: سعيد
operationKind: TRANSPORT_ATTENDANCE
scopeType: ROUTE
scopeId: route-1
roleKey: BUS_SUPERVISOR
```

#### مشرف تربوي

```txt
personId: ناصر
operationKind: STAFF_EVALUATION
scopeType: PERSON_GROUP
targetPersonIds: [teacher-1, teacher-2, teacher-3]
roleKey: BOYS_EDU_SUPERVISOR
```

## ما الفرق بينه وبين `TeacherAssignment`؟

`TeacherAssignment` متخصص في التدريس:

```txt
معلم ← فصل / مادة / صف / مسار
```

أما `OperationalAssignment` أوسع:

```txt
شخص ← عملية تشغيل ← نطاق
```

لذلك يمكن أن يغطي:

```txt
الحضور
القياسات
القيم والأركان
الباص
القضايا
التقييمات
التحفيز
```

## هل نلغي `TeacherAssignment`؟

لا.

الأفضل:

```txt
TeacherAssignment يبقى للإسناد الأكاديمي/التعليمي.
OperationalAssignment يستخدم للتشغيل العام.
```

وقد نستطيع لاحقًا توليد بعض `OperationalAssignment` من `TeacherAssignment`.

مثال:

```txt
إذا كان عند المعلم TeacherAssignment على فصل
ينتج له صلاحية تشغيل قياسات هذا الفصل.
```

---

## 3. كيف نربط تقييم الموظفين بنفس فلسفة التشغيل؟

تقييم الموظفين عندنا قريب بالفعل من النمط المطلوب.

عنده:

```txt
EvaluationFramework = قالب عام
EvaluationPlan = خطة التقييم
EvaluationCycle = الدورة / الأسبوع / الزيارة
EvaluationSubmission = سجل تقييم شخص معين
EvaluationSubmissionItemScore = درجات البنود
```

وهذا يشبه:

```txt
Template → Plan → Cycle → Record → ItemScores
```

الذي ينقصه فقط ربطه بوضوح مع:

```txt
OperationalAssignment
Staff Portal
Batch عند الحاجة
```

## مثال عملي

### تقييم مدير للمعلمين أسبوعيًا

```txt
Actor:
مدير المدرسة

Targets:
المعلمون داخل المدرسة

Template:
تقييم أسبوعي للمعلم

Cycle:
الأسبوع الثالث

Records:
EvaluationSubmission لكل معلم
```

### تقييم مشرف لمجموعة معلمين

```txt
Actor:
مشرف تربوي

Targets:
المعلمون المسندون له

Template:
زيارة إشرافية

Cycle:
الزيارة الأولى

Records:
EvaluationSubmission لكل معلم تمت زيارته
```

### تقييم وكيل المعلمين

```txt
Actor:
وكيل شؤون المعلمين

Targets:
المعلمون داخل نطاقه

Template:
تقييم أسبوعي / تقييم فتري / زيارة

Cycle:
الأسبوع / الزيارة / الفترة

Records:
EvaluationSubmission لكل معلم
```

## هل نحتاج Batch هنا؟

أحيانًا نعم، وأحيانًا لا.

لو المدير يفتح “الأسبوع الثالث” ويرى قائمة المعلمين ويقيّمهم واحدًا واحدًا ضمن نفس الجلسة، يمكن أن يكون عندنا:

```txt
EvaluationBatch
```

لكن السكيما الحالية فيها `EvaluationCycle` و `EvaluationSubmission` وقد تكفي كبداية.

أقترح:

```txt
لا نضيف EvaluationBatch الآن إلا إذا احتجناه.
نستخدم EvaluationCycle كالحاوية الزمنية.
ونستخدم EvaluationSubmission كسجل فردي.
```

لكن في Staff Portal نعرضها كأنها “دفعة عمل”:

```txt
الأسبوع الثالث:
- المعلم أحمد: لم يبدأ
- المعلم خالد: مكتمل
- المعلم يوسف: مسودة
```

## الربط مع OperationalAssignment

`OperationalAssignment` يحدد:

```txt
من يقيّم من؟
```

ثم نظام التقييم ينشئ أو يعرض:

```txt
EvaluationSubmission
```

حسب الخطة والدورة.

مثال:

```txt
OperationalAssignment:
المشرف ناصر مسؤول عن تقييم المعلمين أحمد وخالد.

EvaluationCycle:
زيارة 1.

Staff Portal:
يعرض للمشرف ناصر:
- تقييم أحمد
- تقييم خالد
```

---

## تحديث الوثيقة بالقرارات الجديدة

نضيف لهذه الوثيقة 3 قرارات:

### القرار 1: `itemScores`

```txt
نعتمد itemScores كبنية موحدة لدرجات البنود داخل السجلات الفردية، خاصة في قياسات الطلاب، القيم، الأركان، والمتابعات ذات البنود.
```

### القرار 2: `OperationalAssignment`

```txt
ننشيء OperationalAssignment كإسناد عام للتشغيل اليومي، مع إبقاء TeacherAssignment للإسناد الأكاديمي.
```

### القرار 3: تقييم الموظفين

```txt
نربط تقييم الموظفين بفلسفة التشغيل نفسها:
Evaluator → Targets → Plan/Cycle → Submission → ItemScores.
ولا نضيف EvaluationBatch الآن إلا إذا ظهر احتياج واضح.
```

## الترتيب بعد هذا النقاش

أرى أن ترتيب العمل القادم يكون:

```txt
1. تصميم packages/domain.
2. تصميم OperationalAssignment في contracts.
3. تصميم itemScores الموحد.
4. تصميم StudentMeasurementBatch.
5. تصميم web-staff على الورق:
   - الرئيسية
   - فصولي
   - مهامي
   - تقييماتي

 الخطوة التالية

بعد تصميم “تقييماتي”، نحتاج تصميم:

صفحة "طلابي" أو "الطلاب"

لأنها ستخدم البحث السريع والوصول للطالب داخل web-staff بدون الدخول إلى web-admin.



الخطوة التالية

بعد “طلابي”، نقترح تصميم مساحة:

الحضور في web-staff

لأنها من أهم مساحات التشغيل اليومي، ومرتبطة بالوكيل والفصول والتقارير.



الخطوة التالية

بعد الحضور، نكمل بتصميم:

القياسات والمتابعات في web-staff

لأنها ستستخدم نفس فكرة الدفعات، لكنها أكثر تعقيدًا بسبب القوالب والبنود والفاقد التعليمي.



6. بعد ذلك فقط نقرر التنفيذ.
```

بهذا نكون لم نبدأ كود بعد، لكن بدأنا نثبت الأساس الصحيح.
