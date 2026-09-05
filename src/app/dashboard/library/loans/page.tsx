'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  AlertCircle,
  User,
} from 'lucide-react';
import { LibraryNav } from '@/components/library/LibraryNav';

interface LoanItem {
  id: string;
  borrowerType: 'STUDENT' | 'EMPLOYEE';
  issueDate: string;
  dueDate: string;
  returnDate: string | null;
  status: string;
  renewalCount: number;
  copy: {
    accessionNumber: string;
    barcode: string;
    book: { titleEn: string; titleBn: string | null };
  };
  student?: { studentId: string; firstNameEn: string; lastNameEn: string };
  employee?: { employeeId: string; firstName: string; lastName: string };
}

export default function LibraryLoansPage() {
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ISSUED' | 'RETURNED' | 'OVERDUE'>('ISSUED');

  // Return modal state
  const [selectedLoanForReturn, setSelectedLoanForReturn] = useState<LoanItem | null>(null);
  const [returnCondition, setReturnCondition] = useState('GOOD');
  const [damageCharge, setDamageCharge] = useState(0);
  const [returnNotes, setReturnNotes] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function fetchLoans() {
    try {
      setLoading(true);
      const res = await fetch(`/api/school/library/loans?status=${statusFilter}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) setLoans(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch loans:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLoans();
  }, [statusFilter]);

  async function handleRenew(loanId: string) {
    try {
      const res = await fetch(`/api/school/library/loans/${loanId}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(`নবায়ন ব্যর্থ: ${json.error || 'Unknown error'}`);
        return;
      }
      alert('বই সফলভাবে নবায়ন করা হয়েছে!');
      fetchLoans();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  }

  async function handleConfirmReturn(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLoanForReturn) return;
    setSubmittingReturn(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/school/library/loans/${selectedLoanForReturn.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          condition: returnCondition,
          damageCharge: Number(damageCharge) || undefined,
          notes: returnNotes.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to process return');
      }

      setSelectedLoanForReturn(null);
      fetchLoans();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmittingReturn(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ArrowLeftRight className="w-7 h-7 text-blue-600" />
            বই সার্কুলেশন ও ঋণ হিসাব
            <span className="text-sm font-normal text-gray-500">(Circulation & Loan Register)</span>
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            বই ইস্যু, নির্ধারিত মেয়াদের মধ্যে ফেরত গ্রহণ, নবায়ন এবং জরিমানা ব্যবস্থাপনা।
          </p>
        </div>
      </div>

      <LibraryNav />

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-gray-200">
        <button
          onClick={() => setStatusFilter('ISSUED')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
            statusFilter === 'ISSUED'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          বর্তমান সক্রিয় ঋণ (Active Loans)
        </button>
        <button
          onClick={() => setStatusFilter('RETURNED')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
            statusFilter === 'RETURNED'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          ফেরত রেকর্ড (Returned History)
        </button>
      </div>

      {/* Loans Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-600 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3">বই ও এক্সেসন নং</th>
                <th className="px-4 py-3">গ্রহীতা (Borrower)</th>
                <th className="px-4 py-3">ইস্যু তারিখ</th>
                <th className="px-4 py-3">ফেরত শেষ তারিখ</th>
                <th className="px-4 py-3 text-center">নবায়ন</th>
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
              ) : loans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    কোনো ঋণ রেকর্ড পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                loans.map((loan) => {
                  const isOverdue = new Date(loan.dueDate) < new Date() && loan.status !== 'RETURNED';
                  const borrowerName =
                    loan.borrowerType === 'STUDENT'
                      ? `${loan.student?.firstNameEn} ${loan.student?.lastNameEn} (${loan.student?.studentId})`
                      : `${loan.employee?.firstName} ${loan.employee?.lastName} (${loan.employee?.employeeId})`;

                  return (
                    <tr key={loan.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-gray-900">{loan.copy.book.titleEn}</div>
                        <div className="text-xs text-gray-500">
                          Acc: {loan.copy.accessionNumber} | Barcode: {loan.copy.barcode}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 font-medium text-gray-800">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          {borrowerName}
                        </div>
                        <span className="text-xs text-gray-400 font-normal">
                          {loan.borrowerType === 'STUDENT' ? 'শিক্ষার্থী' : 'কর্মচারী/শিক্ষক'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-gray-700">
                        {new Date(loan.issueDate).toLocaleDateString('bn-BD')}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`font-semibold ${isOverdue ? 'text-rose-600' : 'text-gray-700'}`}>
                          {new Date(loan.dueDate).toLocaleDateString('bn-BD')}
                        </span>
                        {isOverdue && (
                          <div className="text-xs text-rose-500 font-medium">বিলম্বিত (Overdue)</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center text-gray-700 font-medium">
                        {loan.renewalCount} বার
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            loan.status === 'RETURNED'
                              ? 'bg-gray-100 text-gray-700'
                              : isOverdue
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {loan.status === 'RETURNED' ? 'ফেরত সম্পন্ন' : isOverdue ? 'মেয়াদোত্তীর্ণ' : 'ইস্যুকৃত'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-2">
                        {loan.status !== 'RETURNED' && (
                          <>
                            <button
                              onClick={() => handleRenew(loan.id)}
                              className="px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors"
                            >
                              নবায়ন
                            </button>
                            <button
                              onClick={() => setSelectedLoanForReturn(loan)}
                              className="px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors shadow-sm"
                            >
                              ফেরত নিন
                            </button>
                          </>
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

      {/* Return Book Modal */}
      {selectedLoanForReturn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">বই ফেরত প্রক্রিয়া ও নিরীক্ষা</h3>
            <p className="text-xs text-gray-500 mb-4">
              বই: <span className="font-semibold text-gray-800">{selectedLoanForReturn.copy.book.titleEn}</span>
            </p>

            {actionError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {actionError}
              </div>
            )}

            <form onSubmit={handleConfirmReturn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  ফেরতকালীন অবস্থা (Condition)
                </label>
                <select
                  value={returnCondition}
                  onChange={(e) => setReturnCondition(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="GOOD">ভালো (Good)</option>
                  <option value="FAIR">মোটামুটি (Fair)</option>
                  <option value="POOR">খারাপ (Poor)</option>
                  <option value="DAMAGED">ক্ষতিগ্রস্ত (Damaged)</option>
                </select>
              </div>

              {returnCondition === 'DAMAGED' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    ক্ষতিপূরণ জরিমানা (৳)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={damageCharge}
                    onChange={(e) => setDamageCharge(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  মন্তব্য (Notes)
                </label>
                <textarea
                  rows={2}
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="কোনো মন্তব্য থাকলে লিখুন..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedLoanForReturn(null)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submittingReturn}
                  className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm"
                >
                  {submittingReturn ? 'প্রক্রিয়াকরণ হচ্ছে...' : 'ফেরত নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
