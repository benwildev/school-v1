'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Clock, ArrowLeft, User, Receipt } from 'lucide-react';

interface ParentLibraryData {
  children: Array<{
    id: string;
    studentCode: string;
    fullNameEn: string;
  }>;
  loans: Array<{
    id: string;
    dueDate: string;
    isOverdue: boolean;
    overdueDays: number;
    student?: { studentCode: string; fullNameEn: string; firstNameEn: string; lastNameEn: string };
    copy: {
      book: { titleEn: string; titleBn: string | null };
    };
  }>;
  fines: Array<{
    id: string;
    fineAmount: number;
    student?: { studentCode: string; firstNameEn: string; lastNameEn: string };
    loan?: {
      copy?: {
        book?: { titleEn: string };
      };
    };
  }>;
}

export default function ParentLibraryPage() {
  const [data, setData] = useState<ParentLibraryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchParentLibrary() {
      try {
        setLoading(true);
        const res = await fetch('/api/parent/library');
        if (res.ok) {
          const json = await res.json();
          if (json.success) setData(json.data);
        }
      } catch (err) {
        console.error('Failed to load parent library info:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchParentLibrary();
  }, []);

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center py-12 text-gray-500">
        লাইব্রেরি তথ্য লোড হচ্ছে...
      </div>
    );
  }

  const totalUnpaid = data?.fines?.reduce((sum, f) => sum + Number(f.fineAmount), 0) || 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <Link
          href="/dashboard/parent"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          অভিভাবক পোর্টালে ফিরুন
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="w-7 h-7 text-blue-600" />
          সন্তানদের লাইব্রেরি কার্যক্রম
          <span className="text-sm font-normal text-gray-500">(Children Library Books & Fines)</span>
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          আপনার সন্তানদের বিদ্যালয় লাইব্রেরি থেকে ধারকৃত বই, জমার তারিখ ও বকেয়া জরিমানা নিরীক্ষা।
        </p>
      </div>

      {totalUnpaid > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <span>সন্তানদের সর্বমোট বকেয়া লাইব্রেরি জরিমানা:</span>
          </div>
          <span className="text-lg font-bold text-rose-600">৳{totalUnpaid.toFixed(2)}</span>
        </div>
      )}

      {/* Children Borrowed Books */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          ধারকৃত বইয়ের তালিকা (Active Loans)
        </h2>

        {!data?.loans || data.loans.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            বর্তমানে আপনার সন্তানদের কোনো বই ধার নেওয়া নেই।
          </div>
        ) : (
          <div className="space-y-3">
            {data.loans.map((loan) => (
              <div
                key={loan.id}
                className="p-4 rounded-lg border border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded w-fit mb-1">
                    <User className="w-3 h-3" />
                    {loan.student?.firstNameEn} {loan.student?.lastNameEn} ({loan.student?.studentCode})
                  </div>
                  <h3 className="font-semibold text-gray-900 text-base">
                    {loan.copy.book.titleEn}
                  </h3>
                </div>

                <div className="sm:text-right">
                  <div className="text-xs text-gray-500">ফেরতের শেষ তারিখ:</div>
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
    </div>
  );
}
