'use client';

import React, { useEffect, useState } from 'react';
import { Receipt, AlertCircle, ShieldCheck } from 'lucide-react';
import { LibraryNav } from '@/components/library/LibraryNav';

interface FineItem {
  id: string;
  fineType: string;
  fineAmount: number;
  paidAmount: number;
  waivedAmount: number;
  waivedReason: string | null;
  status: 'UNPAID' | 'PAID' | 'WAIVED';
  createdAt: string;
  student?: { studentId: string; firstNameEn: string; lastNameEn: string };
  employee?: { employeeId: string; firstName: string; lastName: string };
  loan?: {
    copy?: {
      book?: { titleEn: string };
    };
  };
}

export default function LibraryFinesPage() {
  const [fines, setFines] = useState<FineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  // Waive modal state
  const [selectedFine, setSelectedFine] = useState<FineItem | null>(null);
  const [waiveReason, setWaiveReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function fetchFines() {
    try {
      setLoading(true);
      const url = statusFilter
        ? `/api/school/library/fines?status=${statusFilter}`
        : '/api/school/library/fines';
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success) setFines(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch fines:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFines();
  }, [statusFilter]);

  async function handleWaiveFine(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFine) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/school/library/fines', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fineId: selectedFine.id,
          waivedReason: waiveReason.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to waive fine');
      }

      setSelectedFine(null);
      setWaiveReason('');
      fetchFines();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const totalUnpaid = fines
    .filter((f) => f.status === 'UNPAID')
    .reduce((sum, f) => sum + (Number(f.fineAmount) - Number(f.paidAmount) - Number(f.waivedAmount)), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="w-7 h-7 text-blue-600" />
            লাইব্রেরি জরিমানা ও মওকুফ রেজিস্টার
            <span className="text-sm font-normal text-gray-500">(Fines & Waivers Ledger)</span>
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            বিলম্বিত ফেরত ও ক্ষতির জন্য আরোপিত জরিমানার নিরীক্ষা ও অনুমোদিত মওকুফ প্রদান।
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg text-sm font-semibold text-amber-800">
          বর্তমান অনাদায়ী ব্যালেন্স: ৳{totalUnpaid.toLocaleString()}
        </div>
      </div>

      <LibraryNav />

      {/* Filter Tabs */}
      <div className="flex space-x-2 border-b border-gray-200">
        <button
          onClick={() => setStatusFilter('')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
            statusFilter === ''
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          সকল রেকর্ড (All)
        </button>
        <button
          onClick={() => setStatusFilter('UNPAID')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
            statusFilter === 'UNPAID'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          অনাদায়ী (Unpaid)
        </button>
        <button
          onClick={() => setStatusFilter('WAIVED')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
            statusFilter === 'WAIVED'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          মওকুফকৃত (Waived)
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-600 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3">গ্রহীতা ও বই</th>
                <th className="px-4 py-3">জরিমানার ধরন</th>
                <th className="px-4 py-3 text-right">মূল অঙ্ক</th>
                <th className="px-4 py-3 text-right">পরিশোধ</th>
                <th className="px-4 py-3 text-right">মওকুফ</th>
                <th className="px-4 py-3 text-center">অবস্থা</th>
                <th className="px-5 py-3 text-right">পদক্ষেপ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    লোড হচ্ছে...
                  </td>
                </tr>
              ) : fines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    কোনো জরিমানার রেকর্ড পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                fines.map((f) => {
                  const borrower = f.student
                    ? `${f.student.firstNameEn} ${f.student.lastNameEn}`
                    : f.employee
                    ? `${f.employee.firstName} ${f.employee.lastName}`
                    : 'Unknown';

                  const remaining = Math.max(
                    0,
                    Number(f.fineAmount) - Number(f.paidAmount) - Number(f.waivedAmount)
                  );

                  return (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-gray-900">{borrower}</div>
                        <div className="text-xs text-gray-500">
                          {f.loan?.copy?.book?.titleEn || 'Direct Assessment'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700">
                          {f.fineType === 'OVERDUE' ? 'বিলম্বিত জরিমানা' : f.fineType === 'DAMAGE' ? 'ক্ষতিপূরণ' : f.fineType}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-gray-900">
                        ৳{Number(f.fineAmount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-right text-emerald-600 font-medium">
                        ৳{Number(f.paidAmount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-right text-blue-600 font-medium">
                        ৳{Number(f.waivedAmount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            f.status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : f.status === 'WAIVED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {f.status === 'PAID' ? 'পরিশোধিত' : f.status === 'WAIVED' ? 'মওকুফকৃত' : 'বকেয়া'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {f.status === 'UNPAID' && remaining > 0 && (
                          <button
                            onClick={() => setSelectedFine(f)}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            মওকুফ করুন
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Waive Modal */}
      {selectedFine && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">জরিমানা মওকুফ অনুমোদন</h3>
            <p className="text-xs text-gray-500 mb-4">
              মওকুফযোগ্য বকেয়া অঙ্ক: ৳
              {(
                Number(selectedFine.fineAmount) -
                Number(selectedFine.paidAmount) -
                Number(selectedFine.waivedAmount)
              ).toFixed(2)}
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleWaiveFine} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  মওকুফের প্রাতিষ্ঠানিক কারণ (Waiver Reason) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={waiveReason}
                  onChange={(e) => setWaiveReason(e.target.value)}
                  placeholder="যেমন: অধ্যক্ষের বিশেষ অনুমতি বা যৌক্তিক কারণ..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedFine(null)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm"
                >
                  {submitting ? 'অনুমোদন হচ্ছে...' : 'মওকুফ নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
