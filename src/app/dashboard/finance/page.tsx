'use client';

import React, { useState, useEffect } from 'react';
import {
  Banknote,
  Receipt,
  FileText,
  Percent,
  CreditCard,
  PlusCircle,
  TrendingUp,
  AlertCircle,
  Search,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Printer,
  XCircle,
  Filter,
  DollarSign
} from 'lucide-react';

export default function FinanceDashboardPage() {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'structures' | 'invoices' | 'collect' | 'discounts' | 'receipts'
  >('overview');

  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [feeStructures, setFeeStructures] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [feeTypes, setFeeTypes] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  // Collect Payment Form State
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [trxId, setTrxId] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState<any>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);
    try {
      const [dashRes, structRes, typeRes, sessRes, classRes] = await Promise.all([
        fetch('/api/school/finance/reports/dashboard').then((r) => r.json()),
        fetch('/api/school/finance/fee-structures').then((r) => r.json()),
        fetch('/api/school/finance/fee-types').then((r) => r.json()),
        fetch('/api/school/academic-sessions').then((r) => r.json()),
        fetch('/api/school/academic-structure/classes').then((r) => r.json()),
      ]);

      if (dashRes.success) setDashboardData(dashRes.data);
      if (structRes.success) setFeeStructures(structRes.data);
      if (typeRes.success) setFeeTypes(typeRes.data);
      if (sessRes.success) setSessions(sessRes.data);
      if (classRes.success) setClasses(classRes.data);
    } catch (err) {
      console.error('Failed to load initial finance data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadInvoices() {
    try {
      const res = await fetch('/api/school/finance/invoices?limit=50').then((r) => r.json());
      if (res.success) setInvoices(res.data);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadReceipts() {
    try {
      const res = await fetch('/api/school/finance/receipts?limit=50').then((r) => r.json());
      if (res.success) setReceipts(res.data);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadDiscounts() {
    try {
      const res = await fetch('/api/school/finance/discounts').then((r) => r.json());
      if (res.success) setDiscounts(res.data);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    if (activeTab === 'invoices') loadInvoices();
    if (activeTab === 'receipts') loadReceipts();
    if (activeTab === 'discounts') loadDiscounts();
  }, [activeTab]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Banknote className="h-7 w-7 text-emerald-600" />
            ফি ও অর্থ ব্যবস্থাপনা (Finance & Billing)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            শিক্ষার্থীদের ফি নির্ধারণ, স্বয়ংক্রিয় ইনভয়েস, পেমেন্ট আদায় ও রসিদ ব্যবস্থাপনা।
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('collect')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition shadow-xs"
          >
            <CreditCard className="h-4 w-4" />
            ফি গ্রহণ করুন
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-3.5 px-4 font-medium text-sm border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          সংক্ষিপ্ত বিবরণ (Overview)
        </button>
        <button
          onClick={() => setActiveTab('collect')}
          className={`py-3.5 px-4 font-medium text-sm border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'collect'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <CreditCard className="h-4 w-4" />
          ফি গ্রহণ (Collect Payment)
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`py-3.5 px-4 font-medium text-sm border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'invoices'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="h-4 w-4" />
          ইনভয়েস ও বিলিং (Invoices)
        </button>
        <button
          onClick={() => setActiveTab('structures')}
          className={`py-3.5 px-4 font-medium text-sm border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'structures'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Layers className="h-4 w-4" />
          ফি কাঠামো (Fee Structures)
        </button>
        <button
          onClick={() => setActiveTab('discounts')}
          className={`py-3.5 px-4 font-medium text-sm border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'discounts'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Percent className="h-4 w-4" />
          মওকুফ ও বৃত্তি (Discounts)
        </button>
        <button
          onClick={() => setActiveTab('receipts')}
          className={`py-3.5 px-4 font-medium text-sm border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'receipts'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Receipt className="h-4 w-4" />
          রসিদসমূহ (Receipts)
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && dashboardData && (
        <div className="space-y-6">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
                <span>আজকের আদায়</span>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">
                ৳ {dashboardData.todayCollection.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {dashboardData.todayTransactionsCount} টি লেনদেন সম্পন্ন
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
                <span>চলতি মাসের আদায়</span>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">
                ৳ {dashboardData.thisMonthCollection.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {dashboardData.thisMonthTransactionsCount} টি লেনদেন
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
                <span>মোট বকেয়া (Total Due)</span>
                <AlertCircle className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-amber-600 mt-2">
                ৳ {dashboardData.totalOutstandingDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {dashboardData.unpaidInvoicesCount} টি বকেয়া ইনভয়েস
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
                <span>মেয়াদোত্তীর্ণ বকেয়া (Overdue)</span>
                <XCircle className="h-4 w-4 text-rose-500" />
              </div>
              <div className="text-2xl font-bold text-rose-600 mt-2">
                ৳ {dashboardData.overdueAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {dashboardData.overdueInvoicesCount} টি ইনভয়েস ওভারডিউ
              </div>
            </div>
          </div>

          {/* Recent Payments Table */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
            <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              সাম্প্রতিক পেমেন্টসমূহ (Recent Transactions)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500 bg-slate-50">
                    <th className="py-3 px-4">পেমেন্ট নম্বর</th>
                    <th className="py-3 px-4">শিক্ষার্থী</th>
                    <th className="py-3 px-4">মাধ্যম</th>
                    <th className="py-3 px-4">তারিখ</th>
                    <th className="py-3 px-4 text-right">পরিমাণ (BDT)</th>
                    <th className="py-3 px-4 text-center">স্ট্যাটাস</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dashboardData.recentPayments?.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">{p.paymentNumber}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{p.student?.fullNameBn || p.student?.fullNameEn}</div>
                        <div className="text-xs text-slate-500">{p.student?.studentCode}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                          {p.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(p.paymentDate).toLocaleDateString('bn-BD')}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900">
                        ৳ {Number(p.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Collect Payment Tab */}
      {activeTab === 'collect' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs max-w-2xl mx-auto space-y-5">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-600" />
              ফি আদায় ও রসিদ তৈরি (Collect Fee Payment)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              শিক্ষার্থী নির্বাচন করে নগদ, ব্যাংক বা মোবাইল ব্যাংকিংয়ের মাধ্যমে ফি গ্রহণ করুন।
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                শিক্ষার্থী খুঁজুন (Student Code / ID)
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="যেমন: STU-2026-00001"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full px-3.5 py-2 pl-10 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                পেমেন্টের পরিমাণ (Amount in BDT)
              </label>
              <input
                type="number"
                placeholder="যেমন: 2500"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                পেমেন্ট মাধ্যম (Payment Method)
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              >
                <option value="CASH">নগদ (CASH)</option>
                <option value="BKASH">বিকাশ (bKash)</option>
                <option value="NAGAD">নগদ (Nagad)</option>
                <option value="ROCKET">রকেট (Rocket)</option>
                <option value="BANK_DEPOSIT">ব্যাংক ডিপোজিট (Bank Deposit)</option>
                <option value="CHEQUE">চেক (Cheque)</option>
              </select>
            </div>

            {paymentMethod !== 'CASH' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  ট্রানজেকশন আইডি / রেফারেন্স (Trx ID)
                </label>
                <input
                  type="text"
                  placeholder="যেমন: 9B7X24K0"
                  value={trxId}
                  onChange={(e) => setTrxId(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            )}

            <button
              disabled={!studentSearch || !paymentAmount}
              className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition shadow-xs flex items-center justify-center gap-2"
            >
              <Receipt className="h-4 w-4" />
              পেমেন্ট নিশ্চিত ও রসিদ তৈরি করুন
            </button>
          </div>
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-900">ইনভয়েস তালিকা (Student Fee Invoices)</h2>
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition">
              <PlusCircle className="h-3.5 w-3.5" />
              বাল্ক ইনভয়েস তৈরি
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500 bg-slate-50">
                  <th className="py-3 px-4">ইনভয়েস নং</th>
                  <th className="py-3 px-4">শিক্ষার্থী</th>
                  <th className="py-3 px-4">ফি এর ধরন</th>
                  <th className="py-3 px-4">পিরিয়ড</th>
                  <th className="py-3 px-4 text-right">মূল ফি</th>
                  <th className="py-3 px-4 text-right">মওকুফ</th>
                  <th className="py-3 px-4 text-right">মোট প্রদেয়</th>
                  <th className="py-3 px-4 text-right">পরিশোধ</th>
                  <th className="py-3 px-4 text-right">বকেয়া</th>
                  <th className="py-3 px-4 text-center">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 font-mono font-medium text-slate-800">{inv.invoiceNumber}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{inv.student?.fullNameBn || inv.student?.fullNameEn}</div>
                      <div className="text-xs text-slate-500">{inv.student?.studentCode}</div>
                    </td>
                    <td className="py-3 px-4">{inv.feeType?.nameBn || inv.feeType?.nameEn}</td>
                    <td className="py-3 px-4 font-mono text-xs">{inv.billingPeriodKey}</td>
                    <td className="py-3 px-4 text-right font-medium">৳ {Number(inv.baseAmount).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right text-emerald-600 font-medium">৳ {Number(inv.discountAmount).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-semibold">৳ {Number(inv.netAmount).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right text-emerald-600 font-medium">৳ {Number(inv.paidAmount).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right text-rose-600 font-semibold">৳ {Number(inv.dueAmount).toFixed(2)}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          inv.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inv.status === 'PARTIALLY_PAID'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fee Structures Tab */}
      {activeTab === 'structures' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-900">ফি কাঠামো তালিকা (Configured Fee Structures)</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {feeStructures.map((s) => (
              <div key={s.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-slate-900">{s.feeType?.nameBn || s.feeType?.nameEn}</h3>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded">
                    {s.frequency}
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  শ্রেণী: <span className="font-medium text-slate-700">{s.class?.nameBn || s.class?.nameEn}</span>
                </div>
                <div className="text-xl font-bold text-slate-900 mt-2">
                  ৳ {Number(s.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-slate-400">প্রতি মাসের {s.dueDayOfMonth} তারিখের মধ্যে প্রদেয়</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Receipts Tab */}
      {activeTab === 'receipts' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900">মানি রসিদ তালিকা (Money Receipts)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500 bg-slate-50">
                  <th className="py-3 px-4">রসিদ নম্বর</th>
                  <th className="py-3 px-4">পেমেন্ট নম্বর</th>
                  <th className="py-3 px-4">শিক্ষার্থী</th>
                  <th className="py-3 px-4">ইস্যুর তারিখ</th>
                  <th className="py-3 px-4 text-center">প্রিন্ট সংখ্যা</th>
                  <th className="py-3 px-4 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receipts.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 font-mono font-medium text-slate-800">{r.receiptNumber}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500">{r.payment?.paymentNumber}</td>
                    <td className="py-3 px-4">
                      {r.payment?.student?.fullNameBn || r.payment?.student?.fullNameEn}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(r.issuedAt).toLocaleDateString('bn-BD')}
                    </td>
                    <td className="py-3 px-4 text-center text-xs font-mono">{r.printedCount}</td>
                    <td className="py-3 px-4 text-right">
                      <button className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 text-xs font-medium">
                        <Printer className="h-3.5 w-3.5" />
                        প্রিন্ট রসিদ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Discounts Tab */}
      {activeTab === 'discounts' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900">অনুমোদিত মওকুফ ও বৃত্তি (Discounts & Waivers)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500 bg-slate-50">
                  <th className="py-3 px-4">শিক্ষার্থী</th>
                  <th className="py-3 px-4">ধরন</th>
                  <th className="py-3 px-4">পরিমাণ</th>
                  <th className="py-3 px-4">কারণ</th>
                  <th className="py-3 px-4">অনুমোদনকারী</th>
                  <th className="py-3 px-4 text-center">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {discounts.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{d.student?.fullNameBn || d.student?.fullNameEn}</div>
                      <div className="text-xs text-slate-500">{d.student?.studentCode}</div>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium">{d.discountCategory}</td>
                    <td className="py-3 px-4 font-semibold text-emerald-600">
                      {d.discountType === 'PERCENTAGE'
                        ? `${Number(d.discountValue)}%`
                        : `৳ ${Number(d.discountValue).toFixed(2)}`}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">{d.reason}</td>
                    <td className="py-3 px-4 text-xs text-slate-500">{d.authorizedBy?.fullName || 'Admin'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
