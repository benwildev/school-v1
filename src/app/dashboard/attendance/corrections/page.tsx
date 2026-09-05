'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileEdit, 
  Plus, 
  History, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { AttendanceNav } from '@/components/attendance/AttendanceNav';

interface CorrectionItem {
  id: string;
  attendanceType: 'STUDENT' | 'EMPLOYEE';
  originalStatus: string;
  newStatus: string;
  reason: string;
  createdAt: string;
  actor?: {
    fullName: string;
    phone: string;
  };
  studentAttendance?: {
    date: string;
    enrollment?: {
      student?: {
        fullNameBn?: string;
        fullNameEn?: string;
        studentCode: string;
      };
    };
  };
  employeeAttendance?: {
    date: string;
    employee?: {
      fullNameEn: string;
      employeeCode: string;
      designation?: string;
    };
  };
}

export default function AttendanceCorrectionsPage() {
  const [corrections, setCorrections] = useState<CorrectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form
  const [formData, setFormData] = useState({
    attendanceType: 'STUDENT',
    studentAttendanceId: '',
    employeeAttendanceId: '',
    newStatus: 'PRESENT',
    reason: '',
  });

  async function loadCorrections() {
    setLoading(true);
    try {
      const res = await fetch('/api/school/attendance/corrections');
      const data = await res.json();
      if (res.ok) {
        setCorrections(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load corrections', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCorrections();
  }, []);

  async function handleCreateCorrection(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.reason || formData.reason.trim().length < 5) {
      setMessage({ type: 'error', text: 'হাজিরা সংশোধনের সুনির্দিষ্ট কারণ (কমপক্ষে ৫ অক্ষর) আবশ্যক।' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const body: any = {
        attendanceType: formData.attendanceType,
        newStatus: formData.newStatus,
        reason: formData.reason,
      };

      if (formData.attendanceType === 'STUDENT') {
        body.studentAttendanceId = formData.studentAttendanceId;
      } else {
        body.employeeAttendanceId = formData.employeeAttendanceId;
      }

      const res = await fetch('/api/school/attendance/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'হাজিরা সংশোধন সফলভাবে অডিট লগে সংরক্ষিত হয়েছে।' });
        setShowModal(false);
        setFormData({
          attendanceType: 'STUDENT',
          studentAttendanceId: '',
          employeeAttendanceId: '',
          newStatus: 'PRESENT',
          reason: '',
        });
        loadCorrections();
      } else {
        setMessage({ type: 'error', text: data.error || 'সংশোধন ব্যর্থ হয়েছে।' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'রিকোয়েস্ট ব্যর্থ।' });
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
            <FileEdit className="size-6 text-rose-600" />
            হাজিরা সংশোধন ও নিরাপত্তা অডিট (Correction Workflow)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            কোনো ভুল বা ব্যতিক্রমের ক্ষেত্রে কারণ উল্লেখপূর্বক সংরক্ষিত হাজিরার নিরাপদ পরিবর্তন ও অডিট ট্রেইল
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition shadow-sm"
        >
          <Plus className="size-4" />
          হাজিরা সংশোধন করুন (New Correction)
        </button>
      </div>

      {/* Messages */}
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

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <History className="size-4 text-slate-500" />
            সংশোধনের অডিট ইতিহাস ({corrections.length})
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">ধরন ও ব্যক্তি</th>
                <th className="px-4 py-3">তারিখ</th>
                <th className="px-4 py-3 text-center">পরিবর্তন (পূর্ব → বর্তমান)</th>
                <th className="px-4 py-3">বাধ্যতামূলক কারণ (Reason)</th>
                <th className="px-4 py-3">পরিবর্তনকারী কর্মকর্তা</th>
                <th className="px-4 py-3">সময় (Asia/Dhaka)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {corrections.map((item) => {
                const isStudent = item.attendanceType === 'STUDENT';
                const name = isStudent
                  ? item.studentAttendance?.enrollment?.student?.fullNameBn ||
                    item.studentAttendance?.enrollment?.student?.fullNameEn ||
                    'Student'
                  : item.employeeAttendance?.employee?.fullNameEn || 'Employee';
                const code = isStudent
                  ? item.studentAttendance?.enrollment?.student?.studentCode
                  : item.employeeAttendance?.employee?.employeeCode;
                const attDate = isStudent
                  ? item.studentAttendance?.date
                  : item.employeeAttendance?.date;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {item.attendanceType} • {code || 'N/A'}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {attDate
                        ? new Date(attDate).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' })
                        : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5 font-bold">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px]">
                          {item.originalStatus}
                        </span>
                        <ArrowRight className="size-3 text-slate-400" />
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px]">
                          {item.newStatus}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-xs">
                      <span className="bg-amber-50 text-amber-900 px-2 py-1 rounded-md border border-amber-200/60 inline-block">
                        &ldquo;{item.reason}&rdquo;
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {item.actor?.fullName || 'Authorized Admin'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {new Date(item.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })}
                    </td>
                  </tr>
                );
              })}

              {corrections.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 text-xs">
                    এখনও কোনো হাজিরা সংশোধনের রেকর্ড নেই।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Correction Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileEdit className="size-5 text-rose-600" />
                নতুন হাজিরা সংশোধন ও অডিট
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCorrection} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  হাজিরার ধরন (Attendance Type)
                </label>
                <select
                  value={formData.attendanceType}
                  onChange={(e) =>
                    setFormData({ ...formData, attendanceType: e.target.value as any })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white"
                >
                  <option value="STUDENT">শিক্ষার্থী (Student)</option>
                  <option value="EMPLOYEE">কর্মী / শিক্ষক (Employee)</option>
                </select>
              </div>

              {formData.attendanceType === 'STUDENT' ? (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    শিক্ষার্থী হাজিরা রেকর্ড আইডি (Student Attendance ID) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="UUID e.g. 550e8400-e29b-41d4-a716-446655440000"
                    value={formData.studentAttendanceId}
                    onChange={(e) => setFormData({ ...formData, studentAttendanceId: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white font-mono"
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    কর্মী হাজিরা রেকর্ড আইডি (Employee Attendance ID) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="UUID e.g. 550e8400-e29b-41d4-a716-446655440000"
                    value={formData.employeeAttendanceId}
                    onChange={(e) => setFormData({ ...formData, employeeAttendanceId: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  নতুন স্ট্যাটাস (New Status) <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.newStatus}
                  onChange={(e) => setFormData({ ...formData, newStatus: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white"
                >
                  <option value="PRESENT">PRESENT (উপস্থিত)</option>
                  <option value="ABSENT">ABSENT (অনুপস্থিত)</option>
                  <option value="LATE">LATE (দেরি)</option>
                  <option value="HALF_DAY">HALF_DAY (অর্ধবেলা)</option>
                  <option value="EXCUSED">EXCUSED (ছুটি - শিক্ষার্থী)</option>
                  <option value="LEAVE">LEAVE (ছুটি - কর্মী)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  সংশোধনের কারণ (Mandatory Reason) <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="পরিবর্তনের সুনির্দিষ্ট কারণ লিখুন (যেমন: বায়োমেট্রিক ডিভাইসে ফিঙ্গারপ্রিন্ট মিস হয়েছিল)"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white"
                />
                <div className="text-[10px] text-slate-400 mt-0.5">
                  নিরাপত্তা অডিটের জন্য কমপক্ষে ৫ অক্ষরের বিস্তারিত কারণ আবশ্যক।
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shadow-sm disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldAlert className="size-3.5" />}
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
