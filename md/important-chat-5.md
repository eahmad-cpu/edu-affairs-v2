تمام، نثبت الآن تصميم `OperationalAssignment` على الورق.

## ما هو `OperationalAssignment`؟

هو إسناد تشغيلي عام يجيب على سؤال:

```txt
من الشخص المسؤول؟
عن أي عملية؟
داخل أي نطاق؟
وعلى أي مستهدفين؟
```

مثال:

```txt
وكيل شؤون الطلاب مسؤول عن حضور طلاب المدرسة.
معلمة القيم مسؤولة عن تقييم طلاب فصول الروضة في القيم.
مشرف الباص مسؤول عن حضور طلاب خط معين.
مشرف تربوي مسؤول عن تقييم معلمين محددين.
```

---

## الفرق بينه وبين `Membership`

`Membership` يصف هوية الشخص داخل المؤسسة:

```txt
هذا الشخص عضو في المؤسسة
دوره كذا
نطاقه كذا
نشط أو غير نشط
```

أما `OperationalAssignment` فيصف مهمة تشغيلية محددة:

```txt
هذا الشخص مكلف بهذه العملية داخل هذا النطاق
```

مثال:

```txt
Membership:
محمد = وكيل شؤون طلاب في مدرسة ابتدائية

OperationalAssignment:
محمد مسؤول عن تسجيل حضور طلاب المدرسة يوميًا
```

---

## الفرق بينه وبين `TeacherAssignment`

`TeacherAssignment` يبقى للإسناد التعليمي الأكاديمي:

```txt
معلم فصل
معلم مادة
معلمة قرآن
معلمة قيم
معلمة أركان
```

أما `OperationalAssignment` أوسع، ويشمل:

```txt
الحضور
القياسات
القيم والأركان
الملاحظات
القضايا
الباص
التحفيز
تقييم الموظفين
```

مهم: لا نلغي `TeacherAssignment`.
لكن يمكن لاحقًا توليد صلاحيات تشغيل منه.

مثال:

```txt
TeacherAssignment:
المعلم أحمد مسند إلى فصل 3-أ

يستنتج منه:
أحمد يستطيع إدخال قياسات ومتابعات لطلاب فصل 3-أ
```

---

## مكان التخزين المقترح

داخل المؤسسة:

```txt
orgs/{orgId}/operationalAssignments/{assignmentId}
```

لأنه إسناد على مستوى المؤسسة، وقد يرتبط بمدرسة أو فصل أو خط أو مجموعة أشخاص.

---

## الحقول الأساسية المقترحة

### 1. الهوية العامة

```txt
id
orgId
title
description
isActive
startAt
endAt
createdAt
updatedAt
```

---

### 2. الشخص المسؤول

```txt
actorPersonId
actorMembershipId
actorRoleKey
```

المقصود:

```txt
actor = الشخص الذي سينفذ العملية
```

مثال:

```txt
المعلم
الوكيل
المشرف
مشرف الباص
معلمة القيم
```

---

### 3. نوع العملية

نحتاج `operationKind`.

أمثلة:

```txt
STUDENT_ATTENDANCE
STUDENT_MEASUREMENT
STUDENT_TRACKER
KG_VALUES_EVALUATION
KG_CORNERS_EVALUATION
STUDENT_NOTES
STUDENT_CASE_REFERRAL
STUDENT_CASE_HANDLING
TRANSPORT_ATTENDANCE
STUDENT_GAMIFICATION
STAFF_EVALUATION
STAFF_OBSERVATION
CUSTOM
```

هذا هو الحقل الذي يجعل النظام مرنًا.

---

### 4. نطاق التشغيل

نستخدم `scopeType` و `scopeId`.

أمثلة `scopeType`:

```txt
ORG
SCHOOL
ACADEMIC_YEAR
GRADE
CLASS
ROUTE
PERSON
PERSON_GROUP
CUSTOM
```

أمثلة:

```txt
وكيل مسؤول عن حضور مدرسة:
scopeType = SCHOOL
scopeId = schoolId

معلم مسؤول عن قياسات فصل:
scopeType = CLASS
scopeId = classId

مشرف باص مسؤول عن خط:
scopeType = ROUTE
scopeId = routeId

مشرف مسؤول عن معلمين محددين:
scopeType = PERSON_GROUP
```

---

### 5. تغطية النطاق

نحتاج `coverageMode`.

أمثلة:

```txt
SINGLE_SCOPE
ALL_CLASSES_IN_SCOPE
EXPLICIT_CLASSES
EXPLICIT_PEOPLE
EXPLICIT_ROUTES
```

مثال معلمة القيم:

```txt
scopeType = SCHOOL
coverageMode = ALL_CLASSES_IN_SCOPE
operationKind = KG_VALUES_EVALUATION
```

مثال مشرف تربوي:

```txt
scopeType = PERSON_GROUP
coverageMode = EXPLICIT_PEOPLE
operationKind = STAFF_EVALUATION
```

---

### 6. المستهدفون

لأن بعض العمليات تستهدف طلابًا، وبعضها موظفين، وبعضها خطوط نقل.

نحتاج:

```txt
targetKind
```

أمثلة:

```txt
STUDENT
STAFF
CLASS
ROUTE
CASE
CUSTOM
```

ثم حسب النوع:

```txt
targetPersonIds
targetStudentIds
targetClassIds
targetGradeIds
targetRouteIds
targetRoleKeys
```

لا نحتاج ملء كل الحقول دائمًا.
نستخدم ما يناسب العملية فقط.

مثال مشرف يقيم معلمين:

```txt
targetKind = STAFF
targetPersonIds = [teacher1, teacher2, teacher3]
```

مثال وكيل حضور المدرسة:

```txt
targetKind = STUDENT
scopeType = SCHOOL
coverageMode = ALL_CLASSES_IN_SCOPE
```

---

## أمثلة عملية

### 1. معلم يقيس طلاب فصل

```txt
actorPersonId = teacherPersonId
operationKind = STUDENT_MEASUREMENT
scopeType = CLASS
scopeId = classId
coverageMode = SINGLE_SCOPE
targetKind = STUDENT
```

المعنى:

```txt
هذا المعلم يستطيع إدخال قياسات لطلاب هذا الفصل.
```

---

### 2. وكيل يسجل حضور المدرسة

```txt
actorPersonId = vpPersonId
operationKind = STUDENT_ATTENDANCE
scopeType = SCHOOL
scopeId = schoolId
coverageMode = ALL_CLASSES_IN_SCOPE
targetKind = STUDENT
```

المعنى:

```txt
هذا الوكيل يستطيع تسجيل حضور طلاب كل فصول المدرسة.
```

---

### 3. معلمة القيم

```txt
actorPersonId = valuesTeacherPersonId
operationKind = KG_VALUES_EVALUATION
scopeType = SCHOOL
scopeId = kgSchoolId
coverageMode = ALL_CLASSES_IN_SCOPE
targetKind = STUDENT
```

المعنى:

```txt
معلمة القيم تستطيع تقييم طلاب كل فصول الروضة في القيم.
```

---

### 4. معلمة الأركان

```txt
actorPersonId = cornersTeacherPersonId
operationKind = KG_CORNERS_EVALUATION
scopeType = SCHOOL
scopeId = kgSchoolId
coverageMode = ALL_CLASSES_IN_SCOPE
targetKind = STUDENT
```

---

### 5. مشرف باص

```txt
actorPersonId = busSupervisorPersonId
operationKind = TRANSPORT_ATTENDANCE
scopeType = ROUTE
scopeId = routeId
coverageMode = SINGLE_SCOPE
targetKind = STUDENT
```

---

### 6. مشرف يقيم معلمين

```txt
actorPersonId = supervisorPersonId
operationKind = STAFF_EVALUATION
scopeType = PERSON_GROUP
coverageMode = EXPLICIT_PEOPLE
targetKind = STAFF
targetPersonIds = [teacher1, teacher2, teacher3]
```

---

## هل `OperationalAssignment` يحل محل روابط العضوية؟

لا.

روابط العضوية مثل:

```txt
directEvaluatorPersonId
supervisorPersonId
managerPersonId
principalPersonId
vicePrincipalPersonId
```

تبقى مفيدة جدًا.

لكن `OperationalAssignment` يعطي طبقة أوضح للتشغيل اليومي.

العلاقة المقترحة:

```txt
Membership links = علاقات تنظيمية
OperationalAssignment = تكليف تشغيلي صريح
```

وقد نبني `OperationalAssignment` تلقائيًا من العضويات لاحقًا.

---

## كيف يستخدمه `web-staff`؟

بعد دخول المستخدم:

```txt
1. نعرف personId الخاص به.
2. نجلب operationalAssignments النشطة له.
3. packages/domain يحللها.
4. web-staff يعرض له:
   - فصولي
   - مهامي
   - خطوطي
   - تقييماتي
   - القضايا المحالة لي
```

مثال:

```txt
إذا وجد operationKind = STUDENT_ATTENDANCE
يعرض له "حضور اليوم".

إذا وجد operationKind = STAFF_EVALUATION
يعرض له "تقييماتي المطلوبة".

إذا وجد operationKind = TRANSPORT_ATTENDANCE
يعرض له "النقل والباص".
```

---

## القرار المقترح

نعتمد `OperationalAssignment` ككيان مستقل، ولا نجعله بديلًا عن `Membership` أو `TeacherAssignment`.

التقسيم النهائي:

```txt
Membership:
من أنت وما دورك العام؟

TeacherAssignment:
ما إسنادك التعليمي؟

OperationalAssignment:
ما المهام التشغيلية المصرح لك بها؟

Batch:
ما الدفعة التي نفذتها؟

Record:
ما السجلات الفردية الناتجة؟
```

## الخطوة التالية بعد اعتماد هذا التصميم

نصمم `itemScores` الموحد بشكل نهائي، لأنه سيستخدم في:

```txt
قياسات الطلاب
القيم
الأركان
تقييم الموظفين
زيارات المشرفين
المتابعات ذات البنود
```
