فهمت أنك تريد **قائمة عملية بالأمور التي يجب أن ننتبه لها في المراحل القادمة** بناءً على المشاكل التي ظهرت معنا أثناء الروضة والابتدائي، حتى لا نكرر نفس الأخطاء.

## قائمة الانتباه للمراحل القادمة

### 1. لا نعتمد على `classId` وحده أبدًا

هذه من أهم النقاط التي ظهرت معنا.

لأن نفس `classId` موجود في أكثر من مدرسة، مثل:

```txt
g3-general-2
```

لذلك أي قراءة أو فلترة يجب أن تكون بالسياق المركب:

```txt
schoolId
academicYearId
classId
```

وليس `classId` فقط.

هذا ينطبق على:

```txt
classSubjectOfferings
students
batches
learningLossPlans
attendance
notes
reports
```

---

### 2. القالب شيء، والدفعة Batch شيء آخر

لا نضع داخل القالب:

```txt
schoolId
classId
termId
classSubjectOfferingId
```

إلا لو القالب فعلًا خاص بمدرسة أو فصل، وهذا نادر.

القالب يجب أن يعرف:

```txt
schoolType
subjectKey
kind
assessmentSlot
maxScore
templateItems
applicableTermIds
```

أما الدفعة تحفظ السياق الفعلي:

```txt
schoolId
classId
academicYearId
termId
subjectKey
classSubjectOfferingId
templateId
```

هذا مهم جدًا للتقارير ولعدم تكرار آلاف القوالب.

---

### 3. الفصل الدراسي `termId` يجب أن يدخل في كل سجل تشغيلي

بما أننا اعتمدنا:

```txt
term-1
term-2
```

فأي عملية تعليمية جديدة يجب أن تحفظ:

```txt
termId
termTitle
termShortTitle
```

خصوصًا في:

```txt
StudentMeasurementBatch
StudentAssessmentRecord
StudentTrackerEntry
StudentLearningLossPlan
StudentAttendanceBatch
StudentAttendanceRecord
StaffTask
```

ولا يكفي أن يظهر في الواجهة فقط.

---

### 4. لا نستخدم `currentTerm` فقط دائمًا

الأفضل الاستمرار في استخدام:

```txt
currentTermsByAcademicYear
```

لأن المستخدم لاحقًا قد يرى أكثر من سنة دراسية.

وفي صفحة الفصل نأخذ الفصل الدراسي من:

```txt
actor.currentTermsByAcademicYear[classInfo.academicYearId]
```

وليس من `actor.currentTerm` فقط إلا كـ fallback.

---

### 5. لا نخلط واجهة الروضة مع الابتدائي

هذا ظهر بوضوح عندما ظهرت في الابتدائي عناوين مثل:

```txt
مجالات معلمة الصف
مواد أخرى
```

لذلك القاعدة:

```txt
KG → مكونات خاصة بالروضة
PRIMARY → مكونات خاصة بالابتدائي
```

ولا نضع كل المنطق داخل صفحة واحدة ضخمة.

الأفضل دائمًا:

```txt
PrimaryClassSubjectsSection
KgClassDomainsSection
```

بدل مكون واحد يحاول خدمة كل المراحل.

---

### 6. `schoolType` مهم لكن لا يكفي وحده

عملنا backfill لـ:

```txt
schoolType: PRIMARY
```

وهذا ممتاز لتقليل التخمين من `gradeId`.

لكن حتى مع وجود `schoolType`، لا يزال يجب استخدام:

```txt
schoolId + academicYearId + classId
```

لمنع خلط بيانات المدارس.

---

### 7. أي seed يجب أن يكون idempotent

أي سكريبت seed قادم يجب أن يدعم:

```txt
--dry-run
```

ويكون آمنًا عند تشغيله أكثر من مرة.

يعني:

```txt
إن كان المستند موجودًا → update
إن لم يكن موجودًا → create
```

ولا ينتج تكرارات.

---

### 8. IDs يجب أن تكون فريدة عبر المدارس

في `classSubjectOfferings` مثلًا، لا نستخدم:

```txt
g3-general-2-math
```

لأنها ستتكرر بين المدارس.

الصحيح:

```txt
mrb-girls-g3-general-2-math
mrb-boys-sayh-g3-general-2-math
mrb-boys-faleh-g3-general-2-math
```

هذه قاعدة مهمة لأي entity مرتبطة بفصل مكرر بين المدارس.

---

### 9. أي تعديل في `contracts` غالبًا سيكسر `domain`

عندما أضفنا `termId` ظهرت أخطاء في `domain`.

لذلك عند تعديل العقود يجب أن نتوقع تعديل:

```txt
packages/domain
apps/web-staff
scripts
```

خصوصًا إذا كانت الحقول لها default في Zod؛ لأن النوع الناتج قد يصبح مطلوبًا في المخرجات.

---

### 10. القوالب يجب أن تحمل `subjectKey` بوضوح

حتى تظهر داخل المادة الصحيحة فقط.

مثال صحيح:

```txt
primary-math-periodic-1
subjectKey: MATH
```

بدل قالب عام بلا مادة.

هذا يمنع ظهور قوالب الرياضيات داخل لغتي أو العلوم.

---

### 11. فلترة القوالب يجب أن تراعي الفصل الدراسي

عند عرض القوالب في صفحة الإدخال، يجب أن تكون الفلترة حسب:

```txt
schoolType
subjectKey
gradeId / applicableGradeIds
termId / applicableTermIds
isActive
```

والقاعدة:

```txt
applicableTermIds = [] → صالح لكل الفصول
applicableTermIds includes currentTermId → صالح لهذا الفصل الدراسي
```

---

### 12. التحقق من الدرجة يجب أن يعتمد على `item.maxScore`

في الروضة ظهرت مشكلة إدخال درجة أكبر من 3، وفي الابتدائي الدرجة من 20.

لذلك لا نعتمد على رقم ثابت في الواجهة.

الصحيح:

```txt
كل input يأخذ الحد الأعلى من item.maxScore
```

وبذلك:

```txt
روضة → 3
ابتدائي → 20
أركان → 3
قيم → 3
```

---

### 13. الفاقد يجب أن يحمل السياق كاملًا

أي خطة فاقد يجب أن تحفظ:

```txt
schoolId
classId
academicYearId
termId
subjectKey
classSubjectOfferingId
sourceBatchId
sourceTemplateId
sourceRecordId
```

حتى لا تظهر خطط فاقد غير مفهومة أو غير قابلة للتصفية لاحقًا.

---

### 14. لا نبدأ القوالب الخاصة قبل تثبيت العامة

قرار تأجيل القوالب الخاصة الآن جيد.

الأفضل في المراحل القادمة:

```txt
القوالب العامة → اختبار كامل → الفاقد → التقارير
ثم القوالب الخاصة
```

وليس إدخال كل شيء مرة واحدة.

---

### 15. يجب اختبار كل مرحلة من رابط واقعي

مثلما استخدمنا:

```txt
/staff/classes/g3-general-2?schoolId=mrb-girls&academicYearId=ay-1448
```

هذا أفضل من الاختبار العام، لأنه يكشف مشاكل السياق.

أي مرحلة قادمة نختبرها دائمًا برابط فيه:

```txt
classId
schoolId
academicYearId
```

---

### 16. منصة Platform Owner ليست مثل المعلم الحقيقي

حاليًا أنت داخل بإيميل platform owner، وقد تظهر الإسنادات `0`.

هذا طبيعي في بيئة التطوير.

لكن عند اختبار تجربة المعلم لاحقًا، يجب الدخول بحساب معلم حقيقي له:

```txt
teacherAssignments
teacherAssignmentClassLinks
```

حتى نختبر الصلاحيات الواقعية.

---

### 17. لا نعتمد على الواجهة فقط للتأكد

بعد كل عملية مهمة، نحتاج فحص Firestore أو سكريبت inspect.

مثال:

```txt
بعد seed المواد → inspect
بعد seed القوالب → inspect
بعد حفظ batch → فحص batch في Firestore
بعد فتح فاقد → فحص learningLossPlan
```

الواجهة قد تعرض بشكل صحيح، لكن الحفظ قد يكون ناقصًا.

---

### 18. التقارير تحتاج حقول واضحة من الآن

أي سجل جديد يجب أن يخدم التقارير لاحقًا.

لذلك يجب الاهتمام بحقول مثل:

```txt
schoolType
schoolId
academicYearId
termId
gradeId
classId
streamId
subjectKey
templateId
batchId
score
maxScore
percentage
```

لو غابت هذه الحقول، ستتعقد التقارير والداشبورد لاحقًا.

---

## الخلاصة العملية

في المراحل القادمة ننتبه خصوصًا إلى 5 قواعد:

```txt
1. لا فلترة بـ classId فقط.
2. القالب يعرف المادة، والدفعة تعرف السياق الكامل.
3. termId يدخل في كل عملية تشغيلية. لاحظ بالأسفل تفاصيلها
4. الروضة والابتدائي لهما مكونات منفصلة.
5. كل seed أو تعديل كبير بعده inspect واختبار من رابط واقعي.
```

هذه القواعد ستمنع أغلب المشاكل التي واجهتنا في الروضة والابتدائي.


فهمت أنك تقارن بين حلين:

```txt
1. ترقيع بسيط الآن للحضور والملاحظات
2. تثبيت القاعدة الصحيحة من البداية في الكود والفايرستور
```

رأيي واضح: **بما أننا ما زلنا في بداية المشروع، لا نرقّع. نثبت الأساس الصحيح الآن.**

لكن بدون مبالغة.

## القرار الأفضل

نعتمد `termId` كجزء أساسي من السياق التشغيلي في الكود والفايرستور، مثل:

```txt
orgId
schoolId
academicYearId
termId
gradeId
classId
```

ولا نتركه مجرد قيمة داخل الكود.

## لماذا؟

لأن تركه الآن سيجعلنا لاحقًا نرجع نعدل:

```txt
الحضور
الملاحظات
القياسات
الفاقد
التقارير
الواجبات
بنك الأسئلة
```

وهذا أصعب بعد ما تكبر البيانات.

## لكن لا نبني نظام terms كامل

لا نحتاج الآن:

```txt
إدارة الفصول الدراسية
صفحة Terms
سياسات فتح وإغلاق الترم
تقويم أكاديمي كامل
```

يكفي الآن:

```txt
termId محفوظ في السجلات
termTitle محفوظ للعرض
termShortTitle محفوظ للعرض
والكود يحدد الترم تلقائيًا
```

## ما نفعله عمليًا الآن

نثبت القاعدة في 3 أماكن:

```txt
1. contracts
2. domain
3. Firestore writes
```

بمعنى:

```txt
StudentAttendanceBatch
StudentAttendanceRecord
StudentNote
StudentMeasurementBatch
StudentAssessmentRecord
StudentTrackerEntry
StudentLearningLossPlan
```

كلها تحمل:

```txt
termId
termTitle
termShortTitle
```

## ماذا عن البيانات القديمة؟

بما أننا في البداية:

```txt
لا نخاف من تعديلها
إما نعمل backfill بسيط
أو نمسح بيانات التجربة ونعيد seed
```

هذا أفضل من حمل legacy مبكرًا.

## الخلاصة

لا أختار العلاج المهترئ.

أختار:

```txt
تثبيت termId في المعمارية والفايرستور الآن
مع تأجيل إدارة terms كنظام مستقل
```

هذا هو التوازن الصحيح: **أساس قوي بدون تعقيد زائد**.

