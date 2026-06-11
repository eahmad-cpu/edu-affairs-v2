import type { ClassroomDisplayView } from "@takween/domain";

type ClassroomStudentScreenProps = {
  view: ClassroomDisplayView;
};

export function ClassroomStudentScreen({ view }: ClassroomStudentScreenProps) {
  return (
    <main dir="rtl" className="min-h-screen bg-slate-950 p-6 text-white">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <p className="text-sm text-teal-200">
                {view.header.schoolName}
              </p>

              <h1 className="mt-2 text-5xl font-black">
                {view.header.classTitle}
              </h1>

              <p className="mt-3 text-2xl text-slate-200">
                {view.header.subjectTitle}
              </p>
            </div>

            <div className="rounded-[2rem] bg-teal-400/20 px-6 py-4 text-center">
              <p className="text-sm text-teal-100">حالة الجلسة</p>
              <p className="mt-1 text-3xl font-black">{view.status}</p>
            </div>
          </div>

          {view.settings.showLessonGoal ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {view.header.lessonGoal ? (
                <div className="rounded-[2rem] bg-white/10 p-5">
                  <p className="text-sm text-slate-300">هدف الحصة</p>
                  <p className="mt-2 text-2xl font-bold">
                    {view.header.lessonGoal}
                  </p>
                </div>
              ) : null}

              {view.header.encouragementMessage ? (
                <div className="rounded-[2rem] bg-white/10 p-5">
                  <p className="text-sm text-slate-300">رسالة تشجيعية</p>
                  <p className="mt-2 text-2xl font-bold">
                    {view.header.encouragementMessage}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          {view.settings.showLeaderboard ? (
            <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="text-3xl font-black">لوحة الترتيب</h2>

                <span className="rounded-full bg-amber-300 px-4 py-1 text-sm font-black text-slate-950">
                  أفضل 5
                </span>
              </div>

              {view.leaderboard.length > 0 ? (
                <div className="space-y-3">
                  {view.leaderboard.map((student, index) => (
                    <div
                      key={student.studentId}
                      className="flex items-center gap-4 rounded-[1.5rem] bg-white/10 p-4"
                    >
                      <div className="flex size-14 items-center justify-center rounded-full bg-white text-2xl font-black text-slate-950">
                        {index + 1}
                      </div>

                      <div className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-teal-300/30 text-2xl font-black">
                        {student.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={student.photoUrl}
                            alt={student.displayName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          student.displayName.slice(0, 1)
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-2xl font-black">
                          {student.displayName}
                        </p>
                        <p className="mt-1 text-sm text-slate-300">
                          {student.points.toLocaleString("ar-SA")} نقطة
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="لا توجد نقاط كافية لبناء ترتيب حتى الآن." />
              )}
            </section>
          ) : null}

          {view.settings.showGamificationFeed ? (
            <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6">
              <h2 className="mb-5 text-3xl font-black">التحفيز الحي</h2>

              {view.feedItems.length > 0 ? (
                <div className="space-y-3">
                  {view.feedItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[1.5rem] bg-white/10 p-5"
                    >
                      <p className="text-sm text-teal-200">
                        {item.studentDisplayName}
                      </p>

                      <p className="mt-2 text-2xl font-black">{item.title}</p>

                      {item.description ? (
                        <p className="mt-2 text-lg text-slate-300">
                          {item.description}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="لا توجد أحداث تحفيز مناسبة للعرض." />
              )}
            </section>
          ) : null}
        </div>

        {view.settings.showChallenge ? (
          <section className="rounded-[2rem] border border-white/10 bg-gradient-to-l from-teal-500/20 to-amber-400/20 p-6">
            <h2 className="text-3xl font-black">تحدي الحصة</h2>
            <p className="mt-3 text-2xl text-slate-100">
              تحديات الحصة ستُربط في خطوة لاحقة.
            </p>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-white/15 p-8 text-center text-slate-300">
      {text}
    </div>
  );
}