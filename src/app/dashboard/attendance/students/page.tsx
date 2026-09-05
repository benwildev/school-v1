'use client';

import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Save,
  Loader2,
  Filter
} from 'lucide-react';
import { AttendanceNav } from '@/components/attendance/AttendanceNav';

interface StudentRosterItem {
  enrollmentId: string;
  studentId: string;
  studentCode: string;
  fullNameBn: string;
  fullNameEn: string;
  rollNo: number;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'EXCUSED';
  lateMinutes?: number;
  leaveReason?: string;
}

export default function StudentAttendancePage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);

  const [selectedSession, setSelectedSession] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const [roster, setRoster] = useState<StudentRosterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load basic session and class metadata
  useEffect(() => {
    async function loadMetadata() {
      try {
        const [sessRes, classRes] = await Promise.all([
          fetch('/api/school/academic-sessions'),
          fetch('/api/school/classes'),
        ]);

        if (sessRes.ok) {
          const sData = await sessRes.json();
          setSessions(sData.data || []);
          const activeSess = (sData.data || []).find((s: any) => s.isCurrent);
          if (activeSess) setSelectedSession(activeSess.id);
        }

        if (classRes.ok) {
          const cData = await classRes.json();
          setClasses(cData.data || []);
        }
      } catch (err) {
        console.error('Failed to load academic metadata', err);
      }
    }
    loadMetadata();
  }, []);

  // Update sections when class changes
  useEffect(() => {
    if (!selectedClass) {
      setSections([]);
      setSelectedSection('');
      return;
    }
    const currentClass = classes.find((c) => c.id === selectedClass);
    if (currentClass && currentClass.sections) {
      setSections(currentClass.sections);
      if (currentClass.sections.length > 0) {
        setSelectedSection(currentClass.sections[0].id);
      }
    }
  }, [selectedClass, classes]);

  // Fetch roster / attendance
  async function loadRoster() {
    if (!selectedSession || !selectedClass || !selectedSection || !selectedDate) {
      setMessage({ type: 'error', text: 'অনুগ্রহ করে শিক্ষাবর্ষ, শ্রেণি, শাখা ও তারিখ নির্বাচন করুন।' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const attRes = await fetch(
        `/api/school/attendance?academicSessionId=${selectedSession}&classId=${selectedClass}&sectionId=${selectedSection}&date=${selectedDate}`
      );
      const attData = await attRes.json();

      const enrRes = await fetch(
        `/api/school/enrollments?sessionId=${selectedSession}&classId=${selectedClass}&sectionId=${selectedSection}`
      );
      const enrData = await enrRes.json();

      if (!enrRes.ok) {
        throw new Error(enrData.message || 'শিক্ষার্থীদের তালিকা লোড করতে ব্যর্থ হয়েছে।');
      }

      const existingMap = new Map<string, any>();
      if (attRes.ok && attData.data) {
        attData.data.forEach((att: any) => {
          existingMap.set(att.enrollmentId, att);
        });
      }

      const newRoster: StudentRosterItem[] = (enrData.data || []).map((enr: any) => {
        const exist = existingMap.get(enr.id);
        return {
          enrollmentId: enr.id,
          studentId: enr.student?.id,
          studentCode: enr.student?.studentCode || 'N/A',
          fullNameBn: enr.student?.fullNameBn || '',
          fullNameEn: enr.student?.fullNameEn || '',
          rollNo: enr.rollNo || 0,
          status: exist ? exist.status : 'PRESENT',
          lateMinutes: exist?.lateMinutes || 0,
          leaveReason: exist?.leaveReason || '',
        };
      });

      // Sort by roll number
      newRoster.sort((a, b) => a.rollNo - b.rollNo);
      setRoster(newRoster);

      if (newRoster.length === 0) {
        setMessage({ type: 'error', text: 'এই শাখা বা শ্রেণিতে কোনো শিক্ষার্থী নথিভুক্ত নেই।' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'ডাটা লোড করতে সমস্যা হয়েছে।' });
    } finally {
      setLoading(false);
    }
  }

  // Quick mark all
  function handleMarkAll(status: 'PRESENT' | 'ABSENT') {
    setRoster((prev) =>
      prev.map((item) => ({
        ...item,
        status: status,
      }))
    );
  }

  // Update item status
  function updateItem(enrollmentId: string, updates: Partial<StudentRosterItem>) {
    setRoster((prev) =>
      prev.map((item) => (item.enrollmentId === enrollmentId ? { ...item, ...updates } : item))
    );
  }

  // Submit attendance records
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (roster.length === 0) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const records = roster.map((item) => ({
        enrollmentId: item.enrollmentId,
        status: item.status,
        lateMinutes: item.status === 'LATE' ? Number(item.lateMinutes || 0) : undefined,
        leaveReason: item.status === 'EXCUSED' ? item.leaveReason : undefined,
      }));

      const res = await fetch('/api/school/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academicSessionId: selectedSession,
          classId: selectedClass,
          sectionId: selectedSection,
          date: selectedDate,
          source: 'MANUAL',
          records,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.message || 'হাজিরা সংরক্ষণ ব্যর্থ হয়েছে।');
      }

      setMessage({ type: 'success', text: 'হাজিরা সফলভাবে সংরক্ষণ করা হয়েছে।' });
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
            <ClipboardCheck className="size-6 text-emerald-600" />
            শিক্ষার্থী দৈনিক হাজিরা (Student Daily Attendance)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            শ্রেণি ও শাখা ভিত্তিক শিক্ষার্থীদের দৈনিক উপস্থিতি গ্রহণ ও সংরক্ষণ করুন
          </p>
        </div>
      </div>

      {/* Filter Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              শিক্ষাবর্ষ (Academic Session) <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="">নির্বাচন করুন</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.isCurrent ? '(বর্তমান)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              শ্রেণি (Class) <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="">শ্রেণি নির্বাচন করুন</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameBn || c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              শাখা (Section) <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              disabled={!selectedClass}
              className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-slate-50"
            >
              <option value="">শাখা নির্বাচন করুন</option>
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.nameBn || sec.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              তারিখ (Date - Asia/Dhaka) <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={loadRoster}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Filter className="size-4" />}
            শিক্ষার্থীদের তালিকা আনুন (Load Roster)
          </button>
        </div>
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

      {/* Roster & Attendance Form */}
      {roster.length > 0 && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Action Header */}
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-700">
              <span>মোট শিক্ষার্থী: {roster.length}</span>
              <span className="text-emerald-700">উপস্থিত: {roster.filter((r) => r.status === 'PRESENT').length}</span>
              <span className="text-red-700">অনুপস্থিত: {roster.filter((r) => r.status === 'ABSENT').length}</span>
              <span className="text-amber-700">দেরি: {roster.filter((r) => r.status === 'LATE').length}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleMarkAll('PRESENT')}
                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium hover:bg-emerald-100 transition"
              >
                সবাই উপস্থিত (Mark All Present)
              </button>
              <button
                type="button"
                onClick={() => handleMarkAll('ABSENT')}
                className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100 transition"
              >
                সবাই অনুপস্থিত (Mark All Absent)
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-center w-16">রোল</th>
                  <th className="px-4 py-3">শিক্ষার্থী আইডি ও নাম</th>
                  <th className="px-4 py-3 text-center">উপস্থিতির স্ট্যাটাস</th>
                  <th className="px-4 py-3">মন্তব্য / অতিরিক্ত তথ্য</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roster.map((item) => (
                  <tr key={item.enrollmentId} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3 text-center font-bold text-slate-800">
                      {item.rollNo}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{item.fullNameBn || item.fullNameEn}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {item.studentCode} {item.fullNameEn && item.fullNameBn ? `(${item.fullNameEn})` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200/60 gap-1">
                        <button
                          type="button"
                          onClick={() => updateItem(item.enrollmentId, { status: 'PRESENT' })}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                            item.status === 'PRESENT'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          উপস্থিত
                        </button>
                        <button
                          type="button"
                          onClick={() => updateItem(item.enrollmentId, { status: 'ABSENT' })}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                            item.status === 'ABSENT'
                              ? 'bg-red-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          অনুপস্থিত
                        </button>
                        <button
                          type="button"
                          onClick={() => updateItem(item.enrollmentId, { status: 'LATE' })}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                            item.status === 'LATE'
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          দেরি (Late)
                        </button>
                        <button
                          type="button"
                          onClick={() => updateItem(item.enrollmentId, { status: 'HALF_DAY' })}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                            item.status === 'HALF_DAY'
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          অর্ধবেলা
                        </button>
                        <button
                          type="button"
                          onClick={() => updateItem(item.enrollmentId, { status: 'EXCUSED' })}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                            item.status === 'EXCUSED'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          ছুটি (Leave)
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {item.status === 'LATE' && (
                        <div className="flex items-center gap-2">
                          <Clock className="size-3.5 text-amber-600" />
                          <input
                            type="number"
                            min="0"
                            placeholder="দেরির মিনিট"
                            value={item.lateMinutes || ''}
                            onChange={(e) =>
                              updateItem(item.enrollmentId, { lateMinutes: Number(e.target.value) })
                            }
                            className="w-24 text-xs rounded-lg border border-slate-300 px-2 py-1 bg-white"
                          />
                          <span className="text-[11px] text-slate-500">মিনিট</span>
                        </div>
                      )}
                      {item.status === 'EXCUSED' && (
                        <input
                          type="text"
                          placeholder="ছুটির কারণ"
                          value={item.leaveReason || ''}
                          onChange={(e) =>
                            updateItem(item.enrollmentId, { leaveReason: e.target.value })
                          }
                          className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1 bg-white"
                        />
                      )}
                      {item.status !== 'LATE' && item.status !== 'EXCUSED' && (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Submit Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm disabled:opacity-50"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              হাজিরা সংরক্ষণ করুন (Save Attendance)
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
