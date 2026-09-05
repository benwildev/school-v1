'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Filter, 
  Loader2, 
  Users, 
  Briefcase
} from 'lucide-react';
import { AttendanceNav } from '@/components/attendance/AttendanceNav';

export default function AttendanceReportsPage() {
  const [reportType, setReportType] = useState<'STUDENT' | 'EMPLOYEE'>('STUDENT');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => {
    async function loadMeta() {
      try {
        const res = await fetch('/api/school/classes');
        if (res.ok) {
          const data = await res.json();
          setClasses(data.data || []);
        }
      } catch (err) {
        console.error('Failed to load classes', err);
      }
    }
    loadMeta();
  }, []);

  async function generateReport() {
    setLoading(true);
    try {
      let url = `/api/school/attendance/reports?type=${reportType}&startDate=${startDate}&endDate=${endDate}`;
      if (reportType === 'STUDENT' && selectedClass) {
        url += `&classId=${selectedClass}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setReportData(data);
      }
    } catch (err) {
      console.error('Failed to generate report', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <AttendanceNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="size-6 text-indigo-600" />
            উপস্থিতি রিপোর্ট ও অ্যানালিটিক্স (Attendance Reports)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            দৈনিক, সাপ্তাহিক ও মাসিক উপস্থিতি হার, শতকরা অনুপাত এবং অনুপস্থিতির বিস্তারিত রিপোর্ট
          </p>
        </div>
      </div>

      {/* Filter Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              রিপোর্টের ধরন
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setReportType('STUDENT')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                  reportType === 'STUDENT'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Users className="size-3.5" />
                শিক্ষার্থী
              </button>
              <button
                type="button"
                onClick={() => setReportType('EMPLOYEE')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                  reportType === 'EMPLOYEE'
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Briefcase className="size-3.5" />
                কর্মী
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              শুরুর তারিখ
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              শেষের তারিখ
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white"
            />
          </div>

          {reportType === 'STUDENT' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                শ্রেণি (ঐচ্ছিক)
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white"
              >
                <option value="">সকল শ্রেণি (All Classes)</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameBn || c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={generateReport}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Filter className="size-4" />}
            রিপোর্ট তৈরি করুন (Generate Report)
          </button>
        </div>
      </div>

      {/* Report Results */}
      {reportData && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500">মোট রেকর্ড</span>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {reportData.summary?.totalRecords || 0}
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-semibold text-emerald-600">উপস্থিতি (Present)</span>
              <div className="text-xl font-bold text-emerald-700 mt-1">
                {reportData.summary?.present || 0}
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-semibold text-red-600">অনুপস্থিত (Absent)</span>
              <div className="text-xl font-bold text-red-700 mt-1">
                {reportData.summary?.absent || 0}
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-semibold text-indigo-600">গড় উপস্থিতির হার</span>
              <div className="text-xl font-bold text-indigo-700 mt-1">
                {reportData.summary?.attendanceRate || '0%'}
              </div>
            </div>
          </div>

          {/* Records Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-700">
                বিস্তারিত রিপোর্ট রেকর্ড ({reportData.data?.length || 0})
              </span>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="px-4 py-3">তারিখ</th>
                    <th className="px-4 py-3">আইডি ও নাম</th>
                    <th className="px-4 py-3 text-center">স্ট্যাটাস</th>
                    <th className="px-4 py-3">সোর্স / ডিভাইস</th>
                    <th className="px-4 py-3">ভেরিফিকেশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(reportData.data || []).map((row: any) => {
                    const isStudent = reportType === 'STUDENT';
                    const name = isStudent
                      ? row.enrollment?.student?.fullNameBn || row.enrollment?.student?.fullNameEn
                      : row.employee?.fullNameEn;
                    const code = isStudent
                      ? row.enrollment?.student?.studentCode
                      : row.employee?.employeeCode;

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-4 py-3 font-mono text-slate-700">
                          {new Date(row.date).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{name || 'N/A'}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{code}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              row.status === 'PRESENT'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : row.status === 'ABSENT'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {row.source || 'MANUAL'}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                            {row.verificationStatus || 'UNVERIFIED'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
