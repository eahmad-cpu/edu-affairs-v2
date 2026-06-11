فهمت أن التطبيق يعمل، لكن قراءة الفصول فشلت بسبب صلاحيات Firestore:

Failed to load org classes
FirebaseError: Missing or insufficient permissions

السبب الأقرب: استخدمنا:

collectionGroup(db, "classes")

وهذا النوع من الاستعلام يحتاج Rule خاصة لـ collectionGroup، حتى لو المستخدم platform_owner.

هل المشكلة خطيرة؟

لا.
web-staff يعمل، والصفحة فتحت. فقط جزء قراءة الفصول رجع فارغًا بسبب الصلاحيات.

الأفضل الآن

لا نعدّل الواجهة. نعدّل طريقة قراءة الفصول لتكون من المسار الطبيعي بدل collectionGroup:

orgs/{orgId}/schools/{schoolId}/academicYears/{academicYearId}/classes

وهذا أفضل معماريًا لأنه مطابق لشجرة البيانات عندك، وأسهل مع Firestore Rules.

الخطوة القادمة: أرسل لك تعديل دالة getOrgClasses فقط داخل:

apps/web-staff/lib/staff-actor.ts

بدل collectionGroup.