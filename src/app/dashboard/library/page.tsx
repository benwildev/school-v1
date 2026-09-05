'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Library,
  BookOpen,
  Copy,
  ArrowLeftRight,
  AlertCircle,
  Receipt,
  PlusCircle,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { LibraryNav } from '@/components/library/LibraryNav';

interface LibraryReportData {
  catalog: {
    totalBooks: number;
    totalCopies: number;
    availableCopies: number;
    issuedCopies: number;
    lostCopies: number;
    damagedCopies: number;
  };
  circulation: {
    totalLoans: number;
    activeLoans: number;
    overdueLoans: number;
    pendingReservations: number;
  };
  financials: {
    totalFineAssessed: number;
    totalFinePaid: number;
    totalFineWaived: number;
    totalFineUnpaid: number;
  };
}

export default function LibraryDashboardPage() {
  const [report, setReport] = useState<LibraryReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch('/api/school/library/reports');
        if (res.ok) {
          const json = await res.json();
          if (json.success) setReport(json.data);
        }
      } catch (err) {
        console.error('Failed to load library dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Library className="w-7 h-7 text-blue-600" />
            লাইব্রেরি ও বই ব্যবস্থাপনা
            <span className="text-sm font-normal text-gray-500">(Library Management Engine)</span>
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            পুস্তক ক্যাটালগ, কপি ট্র্যাকিং, বই প্রদান-ফেরত, মেয়াদোত্তীর্ণ জরিমানা ও সংরক্ষণ পর্যবেক্ষণ করুন।
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/library/loans"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" />
            বই প্রদান / সার্কুলেশন
          </Link>
          <Link
            href="/dashboard/library/books"
            className="inline-flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4 text-blue-600" />
            নতুন বই যুক্ত করুন
          </Link>
        </div>
      </div>

      {/* Navigation */}
      <LibraryNav />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">মোট বই ও কপি</span>
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">
              {loading ? '...' : report?.catalog.totalBooks ?? 0}
            </span>
            <span className="text-sm text-gray-500">
              ({report?.catalog.totalCopies ?? 0} টি কপি)
            </span>
          </div>
          <div className="mt-2 text-xs text-emerald-600 flex items-center gap-1 font-medium">
            <span>প্রাপ্য কপি: {report?.catalog.availableCopies ?? 0} টি</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">বর্তমান ইস্যুকৃত বই</span>
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Copy className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">
              {loading ? '...' : report?.circulation.activeLoans ?? 0}
            </span>
            <span className="text-sm text-gray-500">বই ঋণ</span>
          </div>
          <div className="mt-2 text-xs text-blue-600 flex items-center gap-1 font-medium">
            <span>মোট সার্কুলেশন: {report?.circulation.totalLoans ?? 0}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">মেয়াদোত্তীর্ণ সতর্কতা</span>
            <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-rose-600">
              {loading ? '...' : report?.circulation.overdueLoans ?? 0}
            </span>
            <span className="text-sm text-gray-500">বই বিলম্বিত</span>
          </div>
          <div className="mt-2 text-xs text-amber-600 font-medium">
            সংরক্ষণ অপেক্ষা: {report?.circulation.pendingReservations ?? 0} টি
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">অনাদায়ী জরিমানা</span>
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">
              ৳{loading ? '...' : (report?.financials.totalFineUnpaid ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
            <span>আদায়: ৳{report?.financials.totalFinePaid ?? 0}</span>
            <span>মওকুফ: ৳{report?.financials.totalFineWaived ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Quick Action Hub */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          দ্রুত পরিচালনা মডিউল (Quick Workflows)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/dashboard/library/loans"
            className="p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all flex flex-col justify-between"
          >
            <div>
              <h3 className="font-semibold text-gray-900 text-base">বই ইস্যু ও রিটার্ন</h3>
              <p className="text-xs text-gray-500 mt-1">
                শিক্ষার্থী ও শিক্ষকের মাঝে বই বিতরণ করুন, রিটার্নে জরিমানা ও ক্ষতি মূল্যায়ন করুন।
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-semibold text-blue-600">
              সার্কুলেশনে যান <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Link>

          <Link
            href="/dashboard/library/books"
            className="p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all flex flex-col justify-between"
          >
            <div>
              <h3 className="font-semibold text-gray-900 text-base">গ্রন্থ তালিকা ও কপি</h3>
              <p className="text-xs text-gray-500 mt-1">
                আইএসবিএন ভ্যালিডেশন, বারকোড এবং অ্যাক্সেশন নাম্বার সহ ফিজিক্যাল কপি পরিচালনা করুন।
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-semibold text-blue-600">
              ক্যাটালগ ব্রাউজ করুন <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Link>

          <Link
            href="/dashboard/library/fines"
            className="p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all flex flex-col justify-between"
          >
            <div>
              <h3 className="font-semibold text-gray-900 text-base">জরিমানা ও মওকুফ রেজিস্টার</h3>
              <p className="text-xs text-gray-500 mt-1">
                বিলম্বিত ফেরত ও ক্ষতির জন্য নির্ধারিত জরিমানা নিরীক্ষা এবং অনুমোদিত মওকুফ প্রদান।
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-semibold text-blue-600">
              জরিমানা লেজার দেখুন <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
