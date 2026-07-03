"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { Eye, EyeOff } from "lucide-react";

import { auth } from "@/lib/firebase";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "حدث خطأ غير متوقع";
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );

      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/select-org");
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center justify-center">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 space-y-2 text-center">
            <p className="text-sm font-medium text-teal-700">بوابة الموظفين</p>
            <h1 className="text-2xl font-bold text-slate-950">
              تسجيل الدخول
            </h1>
            <p className="text-sm leading-6 text-slate-500">
              سجّل الدخول للوصول إلى مهامك اليومية وفصولك وتقييماتك.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">
                البريد الإلكتروني
              </span>
              <input
                dir="ltr"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">
                كلمة المرور
              </span>

              <div className="relative">
                <input
                  dir="ltr"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 text-left text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                  aria-label={
                    showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </label>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              />
              <span>تذكرني</span>
            </label>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "جاري الدخول..." : "دخول"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}