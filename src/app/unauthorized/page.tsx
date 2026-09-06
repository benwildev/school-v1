import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';

export const metadata: Metadata = {
  title: 'অনুমোদন সীমাবদ্ধ (Access Restricted) — EduSmart BD',
  description: 'Access restricted to this section or resource.',
};

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8 text-center">
        <div className="size-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4 shadow-xs">
          <ShieldAlert className="size-9" />
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
          অনুমোদন সীমাবদ্ধ (Access Restricted)
        </h1>

        <p className="text-sm text-slate-600 mb-4 leading-relaxed">
          আপনার বর্তমান ভূমিকা বা অ্যাকাউন্টে এই বিভাগ বা পৃষ্ঠাটি দেখার অনুমতি নেই।
          যদি আপনি মনে করেন এটি একটি ভুল, অনুগ্রহ করে আপনার বিদ্যালয়ের প্রশাসকের সাথে যোগাযোগ করুন।
        </p>

        <p className="text-xs text-slate-400 mb-6">
          Your current account role does not have permission to access this resource or school section.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition shadow-xs"
          >
            <ArrowLeft className="size-4" />
            <span>মূল ড্যাশবোর্ডে ফিরুন</span>
          </Link>

          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition"
          >
            <LogOut className="size-4" />
            <span>অন্য একাউন্টে লগইন করুন</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
