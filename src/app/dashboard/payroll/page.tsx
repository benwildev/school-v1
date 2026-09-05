'use client';

import React, { useState, useEffect } from 'react';
import { DollarSign, Calendar, Lock, Plus } from 'lucide-react';

interface PayrollPeriod {
  id: string;
  periodKey: string;
  nameEn: string;
  nameBn: string;
  startDate: string;
  endDate: string;
  status: string;
  totalGross: string;
  totalDeductions: string;
  totalNet: string;
  totalPaid: string;
  employeeCount: number;
}

export default function PayrollDashboardPage() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPeriods() {
      try {
        setLoading(true);
        const res = await fetch('/api/school/payroll/periods');
        const json = await res.json();
        if (json.success) {
          setPeriods(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch payroll periods:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPeriods();
  }, []);

  const totalDisbursed = periods.reduce((acc, p) => acc + Number(p.totalPaid || 0), 0);
  const totalNetLiability = periods.reduce((acc, p) => acc + Number(p.totalNet || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <DollarSign className="size-6 text-emerald-600" />
            <span>বেতন ও পেরোল ইঞ্জিন (Payroll & Salary Engine)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            কর্মীদের মাসিক বেতন হিসাব, পে-স্লিপ তৈরি, অগ্রিম সমন্বয় এবং বেতন প্রদান ব্যবস্থাপনা
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition shadow-xs">
            <Plus className="size-4" />
            <span>নতুন পেরোল মাস শুরু করুন</span>
          </button>
        </div>
      </div>

      {/* Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs font-medium text-slate-500">মোট পেরোল দায় (Net Liability)</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            ৳ {totalNetLiability.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs font-medium text-slate-500">মোট পরিশোধিত (Total Disbursed)</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            ৳ {totalDisbursed.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs font-medium text-slate-500">বকেয়া বেতন (Outstanding Due)</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            ৳ {Math.max(0, totalNetLiability - totalDisbursed).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs font-medium text-slate-500">মোট পেরোল সময়কাল (Periods)</div>
          <div className="text-2xl font-bold text-indigo-600 mt-1">{periods.length}</div>
        </div>
      </div>

      {/* Payroll Periods Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <Calendar className="size-4 text-emerald-600" />
            <span>মাসিক পেরোল রেকর্ডসমূহ (Monthly Payroll Periods)</span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">পেরোল মাস</th>
                <th className="px-6 py-3.5">সময়সীমা</th>
                <th className="px-6 py-3.5">কর্মী সংখ্যা</th>
                <th className="px-6 py-3.5">মোট উপার্জন (Gross)</th>
                <th className="px-6 py-3.5">মোট কর্তন (Deductions)</th>
                <th className="px-6 py-3.5">প্রদেয় বেতন (Net Salary)</th>
                <th className="px-6 py-3.5">স্ট্যাটাস</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    লোড হচ্ছে...
                  </td>
                </tr>
              ) : periods.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    এখনও কোন পেরোল তৈরি করা হয়নি।
                  </td>
                </tr>
              ) : (
                periods.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {p.nameBn || p.nameEn}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-500">
                      {p.startDate?.slice(0, 10)} হতে {p.endDate?.slice(0, 10)}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {p.employeeCount} জন
                    </td>
                    <td className="px-6 py-4 font-mono font-medium text-slate-900">
                      ৳ {Number(p.totalGross || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 font-mono font-medium text-red-600">
                      ৳ {Number(p.totalDeductions || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-emerald-700">
                      ৳ {Number(p.totalNet || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          p.status === 'FINALIZED' || p.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.status === 'REVIEW'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {p.status === 'FINALIZED' && <Lock className="size-3" />}
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
