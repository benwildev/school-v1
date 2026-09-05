'use client';

import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Loader2, 
  Filter
} from 'lucide-react';
import { AttendanceNav } from '@/components/attendance/AttendanceNav';

interface EmployeeItem {
  id: string;
  employeeCode: string;
  fullNameEn: string;
  fullNameBn?: string;
  department?: string;
  designation?: string;
  status: string;
}

interface AttendanceRow {
  employeeId: string;
  employeeCode: string;
  name: string;
  department: string;
  designation: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'LEAVE' | 'HOLIDAY' | 'WEEKEND' | 'OFF_DAY';
  checkInTime: string;
  checkOutTime: string;
  lateMinutes: number;
}

export default function EmployeeAttendancePage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function loadData() {
    setLoading(true);
    setMessage(null);
    try {
      const [empRes, attRes] = await Promise.all([
        fetch('/api/hr/employees?status=ACTIVE'),
        fetch(`/api/school/employee-attendance?startDate=${selectedDate}&endDate=${selectedDate}`),
      ]);

      const empData = await empRes.json();
      const attData = await attRes.json();

      const employees: EmployeeItem[] = empData.data || [];
      const attendances = attData.data || [];

      const attMap = new Map<string, any>();
      attendances.forEach((a: any) => {
        attMap.set(a.employeeId, a);
      });

      const newRows: AttendanceRow[] = employees.map((emp) => {
        const exist = attMap.get(emp.id);
        const inTimeStr = exist?.checkInTime
          ? new Date(exist.checkInTime).toLocaleTimeString('en-GB', {
              timeZone: 'Asia/Dhaka',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '';
        const outTimeStr = exist?.checkOutTime
          ? new Date(exist.checkOutTime).toLocaleTimeString('en-GB', {
              timeZone: 'Asia/Dhaka',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '';

        return {
          employeeId: emp.id,
          employeeCode: emp.employeeCode,
          name: emp.fullNameEn || 'N/A',
          department: emp.department || 'General',
          designation: emp.designation || 'Staff',
          status: exist ? exist.status : 'PRESENT',
          checkInTime: inTimeStr || '09:00',
          checkOutTime: outTimeStr || '',
          lateMinutes: exist?.lateMinutes || 0,
        };
      });

      setRows(newRows);
      if (newRows.length === 0) {
        setMessage({ type: 'error', text: 'কোনো সক্রিয় কর্মী পাওয়া যায়নি।' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'ডাটা লোড করতে সমস্যা হয়েছে।' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  function updateRow(employeeId: string, updates: Partial<AttendanceRow>) {
    setRows((prev) =>
      prev.map((r) => (r.employeeId === employeeId ? { ...r, ...updates } : r))
    );
  }

  function handleMarkAll(status: AttendanceRow['status']) {
    setRows((prev) => prev.map((r) => ({ ...r, status })));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rows.length === 0) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const records = rows.map((r) => {
        let inIso: string | undefined = undefined;
        let outIso: string | undefined = undefined;

        if (r.checkInTime) {
          inIso = `${selectedDate}T${r.checkInTime}:00+06:00`;
        }
        if (r.checkOutTime) {
          outIso = `${selectedDate}T${r.checkOutTime}:00+06:00`;
        }

        return {
          employeeId: r.employeeId,
          date: selectedDate,
          status: r.status,
          checkInTime: inIso,
          checkOutTime: outIso,
          lateMinutes: r.status === 'LATE' ? Number(r.lateMinutes || 0) : 0,
        };
      });

      const res = await fetch('/api/school/employee-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || resData.message || 'হাজিরা সংরক্ষণ ব্যর্থ হয়েছে।');
      }

      setMessage({ type: 'success', text: 'কর্মী হাজিরা সফলভাবে সংরক্ষণ করা হয়েছে।' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'সংরক্ষণ ব্যর্থ হয়েছে।' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <AttendanceNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="size-6 text-blue-600" />
            কর্মী ও শিক্ষক হাজিরা (Employee Attendance)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            শিক্ষক ও স্টাফদের প্রবেশ/প্রস্থান সময়, ইন-টাইম, আউট-টাইম ও উপস্থিতি নিরীক্ষণ
          </p>
        </div>
      </div>

      {/* Date Filter */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-700">
            তারিখ (Date - Asia/Dhaka):
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Filter className="size-3.5" />}
          লোড করুন
        </button>
      </div>

      {/* Status Messages */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-3 border ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="size-4 shrink-0 text-red-600" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Attendance Form */}
      {rows.length > 0 && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Quick Mark Toolbar */}
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap justify-between items-center gap-4">
            <div className="text-xs font-semibold text-slate-700">
              মোট কর্মী: {rows.length} | উপস্থিত: {rows.filter((r) => r.status === 'PRESENT').length} | অনুপস্থিত: {rows.filter((r) => r.status === 'ABSENT').length} | ছুটি: {rows.filter((r) => r.status === 'LEAVE').length}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleMarkAll('PRESENT')}
                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium hover:bg-emerald-100 transition"
              >
                সবাই উপস্থিত
              </button>
              <button
                type="button"
                onClick={() => handleMarkAll('WEEKEND')}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-200 transition"
              >
                সাপ্তাহিক ছুটি (Weekend)
              </button>
              <button
                type="button"
                onClick={() => handleMarkAll('HOLIDAY')}
                className="px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-medium hover:bg-purple-100 transition"
              >
                সরকারি ছুটি (Holiday)
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">কর্মী ও পদবী</th>
                  <th className="px-4 py-3 text-center">উপস্থিতি স্ট্যাটাস</th>
                  <th className="px-4 py-3">ইন-টাইম (In Time)</th>
                  <th className="px-4 py-3">আউট-টাইম (Out Time)</th>
                  <th className="px-4 py-3">দেরি (মিনিট)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.employeeId} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{row.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {row.employeeCode} • {row.designation} ({row.department})
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <select
                        value={row.status}
                        onChange={(e) =>
                          updateRow(row.employeeId, { status: e.target.value as any })
                        }
                        className="text-xs rounded-xl border border-slate-300 px-3 py-1.5 bg-white font-semibold"
                      >
                        <option value="PRESENT">উপস্থিত (Present)</option>
                        <option value="ABSENT">অনুপস্থিত (Absent)</option>
                        <option value="LATE">দেরি (Late)</option>
                        <option value="HALF_DAY">অর্ধবেলা (Half Day)</option>
                        <option value="LEAVE">অনুমোদিত ছুটি (Leave)</option>
                        <option value="HOLIDAY">সরকারি ছুটি (Holiday)</option>
                        <option value="WEEKEND">সাপ্তাহিক ছুটি (Weekend)</option>
                        <option value="OFF_DAY">অফ ডে (Off Day)</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="time"
                        value={row.checkInTime}
                        onChange={(e) =>
                          updateRow(row.employeeId, { checkInTime: e.target.value })
                        }
                        className="text-xs rounded-lg border border-slate-300 px-2.5 py-1 bg-white"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="time"
                        value={row.checkOutTime}
                        onChange={(e) =>
                          updateRow(row.employeeId, { checkOutTime: e.target.value })
                        }
                        className="text-xs rounded-lg border border-slate-300 px-2.5 py-1 bg-white"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {row.status === 'LATE' ? (
                        <input
                          type="number"
                          min="0"
                          value={row.lateMinutes}
                          onChange={(e) =>
                            updateRow(row.employeeId, { lateMinutes: Number(e.target.value) })
                          }
                          className="w-20 text-xs rounded-lg border border-slate-300 px-2 py-1 bg-white"
                        />
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm disabled:opacity-50"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              সংরক্ষণ করুন (Save Employee Attendance)
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
