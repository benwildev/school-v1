'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, MonitorCheck, Clock, ArrowLeft } from 'lucide-react';

interface EmployeePortalData {
  library?: {
    activeLoans: Array<{
      id: string;
      dueDate: string;
      isOverdue: boolean;
      overdueDays: number;
      copy: {
        book: { titleEn: string; titleBn: string | null };
      };
    }>;
  };
  assets?: {
    activeAssets: Array<{
      id: string;
      assetCode: string;
      serialNumber: string | null;
      currentCondition: string;
      item: { nameEn: string };
      roomLocation: string | null;
    }>;
  };
}

export default function EmployeeLibraryAndAssetsPage() {
  const [data, setData] = useState<EmployeePortalData>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [libRes, astRes] = await Promise.all([
          fetch('/api/employee/me/library'),
          fetch('/api/employee/me/assets'),
        ]);

        const nextData: EmployeePortalData = {};
        if (libRes.ok) {
          const json = await libRes.json();
          if (json.success) nextData.library = json.data;
        }
        if (astRes.ok) {
          const json = await astRes.json();
          if (json.success) nextData.assets = json.data;
        }
        setData(nextData);
      } catch (err) {
        console.error('Failed to load employee library & assets:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center py-12 text-gray-500">
        তথ্য লোড হচ্ছে...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          ড্যাশবোর্ডে ফিরুন
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="w-7 h-7 text-indigo-600" />
          আমার লাইব্রেরি বই ও প্রাতিষ্ঠানিক সম্পদ
          <span className="text-sm font-normal text-gray-500">(My Borrowed Books & Assets)</span>
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          লাইব্রেরি থেকে প্রাপ্ত বই এবং বিদ্যালয় থেকে আপনার দায়িত্বে অর্পিত সম্পদসমূহের তালিকা।
        </p>
      </div>

      {/* Borrowed Books */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          লাইব্রেরি থেকে ধারকৃত বইসমূহ
        </h2>

        {!data.library?.activeLoans || data.library.activeLoans.length === 0 ? (
          <div className="text-center py-6 text-sm text-gray-500">
            বর্তমানে কোনো বই ধার নেওয়া নেই।
          </div>
        ) : (
          <div className="space-y-3">
            {data.library.activeLoans.map((loan) => (
              <div
                key={loan.id}
                className="p-4 rounded-lg border border-gray-200 flex items-center justify-between"
              >
                <div>
                  <h3 className="font-semibold text-gray-900">{loan.copy.book.titleEn}</h3>
                  <div className="text-xs text-gray-500">
                    ফেরত দেওয়ার তারিখ: {new Date(loan.dueDate).toLocaleDateString('bn-BD')}
                  </div>
                </div>
                <div>
                  {loan.isOverdue ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                      {loan.overdueDays} দিন বিলম্বিত
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                      সক্রিয় ঋণ
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assigned Assets */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <MonitorCheck className="w-5 h-5 text-amber-600" />
          দায়িত্বে অর্পিত প্রাতিষ্ঠানিক সম্পদ (Institutional Assets)
        </h2>

        {!data.assets?.activeAssets || data.assets.activeAssets.length === 0 ? (
          <div className="text-center py-6 text-sm text-gray-500">
            বর্তমানে আপনার দায়িত্বে কোনো সম্পদ অর্পিত নেই।
          </div>
        ) : (
          <div className="space-y-3">
            {data.assets.activeAssets.map((asset) => (
              <div
                key={asset.id}
                className="p-4 rounded-lg border border-gray-200 flex items-center justify-between"
              >
                <div>
                  <h3 className="font-semibold text-gray-900">{asset.item.nameEn}</h3>
                  <div className="text-xs text-gray-500 font-mono">
                    Code: {asset.assetCode} {asset.serialNumber ? `| SN: ${asset.serialNumber}` : ''}
                  </div>
                  {asset.roomLocation && (
                    <div className="text-xs text-gray-600 mt-1">অবস্থান: {asset.roomLocation}</div>
                  )}
                </div>
                <div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    {asset.currentCondition}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
