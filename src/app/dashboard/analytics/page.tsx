'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  GraduationCap,
  CalendarCheck,
  CreditCard,
  Briefcase,
  UserCheck,
  Bus,
  BookOpen,
  Package,
  Activity,
  RefreshCw,
  Loader2,
} from 'lucide-react';

import { OverviewKpiCard } from '@/lib/reports/report-types';

export default function AnalyticsDashboardPage() {
  const [lang, setLang] = useState<'bn' | 'en'>('bn');
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<OverviewKpiCard[]>([]);
  const [trends, setTrends] = useState<{
    monthlyCollection: { month: string; amount: number }[];
    attendanceTrend: { date: string; rate: number }[];
    admissionFunnel: { stage: string; count: number }[];
    academicDistribution: { grade: string; count: number }[];
  }>({
    monthlyCollection: [],
    attendanceTrend: [],
    admissionFunnel: [],
    academicDistribution: [],
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    setLoading(true);
    try {
      const res = await fetch('/api/school/analytics/overview');
      const json = await res.json();
      if (json.success) {
        setKpis(json.data.kpis || []);
        setTrends(json.data.trends || {});
      }
    } catch (err) {
      console.error('Failed to load analytics overview:', err);
    } finally {
      setLoading(false);
    }
  }

  const moduleIcons: Record<string, any> = {
    STUDENTS: Users,
    ACADEMICS: GraduationCap,
    ATTENDANCE: CalendarCheck,
    FINANCE: CreditCard,
    HR: Briefcase,
    ADMISSIONS: UserCheck,
    TRANSPORT: Bus,
    LIBRARY: BookOpen,
    INVENTORY: Package,
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-800">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {lang === 'bn' ? 'ম্যানেজমেন্ট ইন্টেলিজেন্স ও অ্যানালিটিক্স' : 'Management Intelligence & Analytics'}
            </h1>
            <p className="text-sm text-slate-500">
              {lang === 'bn'
                ? 'রিয়েল-টাইম প্রাতিষ্ঠানিক পারফরম্যান্স ইন্ডিকেটর ও ট্রেন্ড অ্যানালাইসিস'
                : 'Real-time executive KPIs, financial metrics, and operational trends'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
          </button>
          <button
            onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 hover:bg-slate-100 transition-colors shadow-2xs"
          >
            {lang === 'bn' ? 'English' : 'বাংলা'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-24 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
          <p className="text-sm text-slate-500">
            {lang === 'bn' ? 'অ্যানালিটিক্স তথ্য সংকলিত হচ্ছে...' : 'Consolidating institutional analytics...'}
          </p>
        </div>
      ) : (
        <>
          {/* Executive KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {kpis.map((kpi) => {
              const Icon = moduleIcons[kpi.module] || Activity;
              return (
                <div
                  key={kpi.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-semibold text-slate-500">
                      {lang === 'bn' ? kpi.titleBn : kpi.titleEn}
                    </span>
                    <div className="p-2 rounded-lg bg-slate-50 text-slate-600">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900 tracking-tight mb-1">
                    {kpi.value}
                  </div>
                  {kpi.subtextEn && (
                    <div className="text-[11px] text-slate-400 font-medium">
                      {lang === 'bn' ? kpi.subtextBn : kpi.subtextEn}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Visual Trend Analytics Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* 1. Monthly Collection Trend Bar Chart */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {lang === 'bn' ? 'মাসিক ফি আদায়ের গতিধারা' : 'Monthly Collection Trend'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {lang === 'bn' ? 'বিগত ৬ মাসের আদায় চিত্র (টাকায়)' : 'Trailing 6-month collection curve (BDT ৳)'}
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md">
                  +12.4% MoM
                </span>
              </div>

              <div className="flex items-end gap-4 h-48 pt-6 border-b border-slate-100">
                {trends.monthlyCollection.map((item, idx) => {
                  const maxAmt = Math.max(...trends.monthlyCollection.map((i) => i.amount), 1);
                  const heightPct = Math.round((item.amount / maxAmt) * 100);
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                      <div className="w-full flex justify-center">
                        <div
                          style={{ height: `${heightPct}%` }}
                          className="w-full max-w-[36px] bg-blue-500 hover:bg-blue-600 rounded-t-lg transition-all relative"
                        >
                          {/* Tooltip */}
                          <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded pointer-events-none whitespace-nowrap transition-opacity">
                            ৳{(item.amount / 1000).toFixed(0)}k
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-slate-500">{item.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Weekly Attendance Rate Curve */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {lang === 'bn' ? 'সাপ্তাহিক উপস্থিতি হার' : 'Weekly Attendance Rate'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {lang === 'bn' ? 'চলতি সপ্তাহের প্রতিদিনের গড় উপস্থিতি' : 'Daily average student attendance rate this week'}
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md">
                  {lang === 'bn' ? 'লক্ষ্যমাত্রা: ৯০%' : 'Target: 90%'}
                </span>
              </div>

              <div className="flex items-end gap-4 h-48 pt-6 border-b border-slate-100">
                {trends.attendanceTrend.map((item, idx) => {
                  const heightPct = Math.round(item.rate);
                  const isHealthy = item.rate >= 90;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                      <div className="w-full flex justify-center">
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full max-w-[36px] rounded-t-lg transition-all relative ${
                            isHealthy ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-amber-500 hover:bg-amber-600'
                          }`}
                        >
                          <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded pointer-events-none whitespace-nowrap transition-opacity">
                            {item.rate}%
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-slate-500">{item.date}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Admission Funnel Progress Bar */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="mb-4">
                <h3 className="font-bold text-slate-900 text-base">
                  {lang === 'bn' ? 'ভর্তি ফানেল অগ্রগতি' : 'Admission Conversion Funnel'}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === 'bn' ? 'আবেদন থেকে চূড়ান্ত ভর্তির রূপান্তর চিত্র' : 'Stage progression from initial application to enrolled'}
                </p>
              </div>

              <div className="space-y-4 pt-2">
                {trends.admissionFunnel.map((stage, idx) => {
                  const maxCount = trends.admissionFunnel[0]?.count || 1;
                  const pct = Math.round((stage.count / maxCount) * 100);
                  const colors = ['bg-blue-500', 'bg-amber-500', 'bg-indigo-500', 'bg-emerald-500'];
                  return (
                    <div key={idx}>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-slate-700">{stage.stage}</span>
                        <span className="text-slate-500">
                          {stage.count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className={`h-full ${colors[idx % colors.length]} rounded-full transition-all`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. Academic GPA Grade Distribution */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="mb-4">
                <h3 className="font-bold text-slate-900 text-base">
                  {lang === 'bn' ? 'একাডেমিক গ্রেড বণ্টন' : 'Academic Grade Distribution'}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === 'bn' ? 'সর্বশেষ মূল্যায়নে প্রাপ্ত গ্রেডের পরিসংখ্যান' : 'Latest term evaluation grade distribution'}
                </p>
              </div>

              <div className="grid grid-cols-6 gap-2 pt-4">
                {trends.academicDistribution.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col items-center p-3 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    <span className="text-sm font-bold text-slate-800">{item.grade}</span>
                    <span className="text-lg font-bold text-blue-600 mt-1">{item.count}</span>
                    <span className="text-[10px] text-slate-400 font-medium">Students</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
