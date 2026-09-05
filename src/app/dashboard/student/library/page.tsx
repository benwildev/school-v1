'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Clock,
  BookmarkCheck,
  ArrowLeft,
} from 'lucide-react';

interface StudentLibraryData {
  student: {
    studentCode: string;
    fullNameEn: string;
    fullNameBn: string | null;
  };
  activeLoans: Array<{
    id: string;
    issueDate: string;
    dueDate: string;
    isOverdue: boolean;
    overdueDays: number;
    renewalCount: number;
    copy: {
      book: {
        titleEn: string;
        titleBn: string | null;
        author?: { nameEn: string };
      };
    };
  }>;
  loanHistory: Array<{
    id: string;
    issueDate: string;
    returnDate: string;
    copy: {
      book: {
        titleEn: string;
        titleBn: string | null;
      };
    };
  }>;
  reservations: Array<{
    id: string;
    status: string;
    priority: number;
    reservationDate: string;
    book: {
      titleEn: string;
      titleBn: string | null;
    };
  }>;
  fines: Array<{
    id: string;
    fineType: string;
    fineAmount: number;
    paidAmount: number;
    waivedAmount: number;
    status: string;
  }>;
  summary: {
    activeLoanCount: number;
    maxAllowedLoans: number;
    totalUnpaidFines: number;
  };
}

export default function StudentLibraryPage() {
  const [data, setData] = useState<StudentLibraryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLibraryData() {
      try {
        setLoading(true);
        const res = await fetch('/api/student/library');
        if (res.ok) {
          const json = await res.json();
          if (json.success) setData(json.data);
        }
      } catch (err) {
        console.error('Failed to load student library info:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchLibraryData();
  }, []);

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center py-12 text-gray-500">
        লাইব্রেরি তথ্য লোড হচ্ছে...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/student"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          শিক্ষার্থী পোর্টালে ফিরুন
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="w-7 h-7 text-blue-600" />
          আমার লাইব্রেরি কর্নার
          <span className="text-sm font-normal text-gray-500">(My Student Library Portal)</span>
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          আপনার বর্তমান ধার নেওয়া বই, ফেরত দেওয়ার শেষ তারিখ এবং সংরক্ষিত বইয়ের অবস্থা।
        </p>
      </div>

      {/* Quota & Fine Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500">বই ধার কোটা</span>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {data?.summary.activeLoanCount || 0} / {data?.summary.maxAllowedLoans || 3}
          </div>
          <span className="text-xs text-blue-600">ধার নেওয়া বইয়ের সংখ্যা</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500">সংরক্ষিত বই</span>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {data?.reservations.length || 0}
          </div>
          <span className="text-xs text-amber-600">অপেক্ষমাণ কিউ</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500">অনাদায়ী জরিমানা</span>
          <div className="mt-2 text-2xl font-bold text-rose-600">
            ৳{(data?.summary.totalUnpaidFines || 0).toFixed(2)}
          </div>
          <span className="text-xs text-rose-500">
            {data?.summary.totalUnpaidFines && data.summary.totalUnpaidFines > 0 ? 'লাইব্রেরিতে পরিশোধযোগ্য' : 'কোনো বকেয়া নেই'}
          </span>
        </div>
      </div>

      {/* Active Loans */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          বর্তমানে ধারকৃত বইসমূহ (Active Loans)
        </h2>

        {!data?.activeLoans || data.activeLoans.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            বর্তমানে আপনার কোনো বই ধার নেওয়া নেই।
          </div>
        ) : (
          <div className="space-y-3">
            {data.activeLoans.map((loan) => (
              <div
                key={loan.id}
                className="p-4 rounded-lg border border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div>
                  <h3 className="font-semibold text-gray-900 text-base">
                    {loan.copy.book.titleEn}
                  </h3>
                  {loan.copy.book.titleBn && (
                    <div className="text-xs text-gray-500">{loan.copy.book.titleBn}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    ইস্যুর তারিখ: {new Date(loan.issueDate).toLocaleDateString('bn-BD')}
                  </div>
                </div>

                <div className="sm:text-right">
                  <div className="text-xs text-gray-500">ফেরত দেওয়ার শেষ তারিখ:</div>
                  <div
                    className={`font-bold text-sm ${
                      loan.isOverdue ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    {new Date(loan.dueDate).toLocaleDateString('bn-BD')}
                  </div>
                  {loan.isOverdue && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800">
                      {loan.overdueDays} দিন বিলম্বিত
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reservations */}
      {data?.reservations && data.reservations.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BookmarkCheck className="w-5 h-5 text-amber-600" />
            বই সংরক্ষণ তালিকা (Reservations)
          </h2>
          <div className="space-y-3">
            {data.reservations.map((res) => (
              <div
                key={res.id}
                className="p-4 rounded-lg border border-gray-200 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-gray-900">{res.book.titleEn}</div>
                  <div className="text-xs text-gray-500">
                    আবেদনের তারিখ: {new Date(res.reservationDate).toLocaleDateString('bn-BD')}
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                    কিউ অবস্থান #{res.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
