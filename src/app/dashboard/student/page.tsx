'use client';

import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  BookOpen,
  Award,
  AlertCircle,
  Loader2,
  UserCheck,
  History,
} from 'lucide-react';

interface StudentProfile {
  id: string;
  studentCode: string;
  fullNameEn: string;
  fullNameBn: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup?: string | null;
  religion: string;
  phone?: string | null;
  email?: string | null;
  status: string;
  currentPlacement: {
    sessionName: string;
    classNameEn: string;
    classNameBn: string;
    sectionNameEn: string;
    sectionNameBn: string;
    rollNo: number;
    enrollmentDate: string;
    enrollmentType: string;
  } | null;
}

interface EnrollmentHistoryItem {
  id: string;
  sessionName: string;
  classNameEn: string;
  classNameBn: string;
  sectionNameEn: string;
  sectionNameBn: string;
  rollNo: number;
  enrollmentType: string;
  status: string;
  enrollmentDate: string;
}

export default function StudentDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentHistoryItem[]>([]);

  useEffect(() => {
    async function fetchStudentData() {
      try {
        setLoading(true);
        const [meRes, enrollRes] = await Promise.all([
          fetch('/api/student/me'),
          fetch('/api/student/enrollment'),
        ]);

        const meJson = await meRes.json();
        if (!meRes.ok || !meJson.success) {
          throw new Error(meJson.error || 'শিক্ষার্থী প্রোফাইল লোড করতে ব্যর্থ হয়েছে।');
        }
        setStudent(meJson.data.student);

        const enrollJson = await enrollRes.json();
        if (enrollRes.ok && enrollJson.success) {
          setEnrollments(enrollJson.data || []);
        }
      } catch (err: any) {
        setError(err.message || 'একটি ত্রুটি ঘটেছে।');
      } finally {
        setLoading(false);
      }
    }

    fetchStudentData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-gray-600 font-medium">শিক্ষার্থী পোর্টাল লোড হচ্ছে...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto my-8 bg-red-50 border border-red-200 rounded-xl text-red-700">
        <div className="flex items-center space-x-3">
          <AlertCircle className="w-6 h-6 flex-shrink-0" />
          <p className="font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  const placement = student?.currentPlacement;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Student Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-800/70 text-blue-200 border border-blue-600/40 mb-2">
              শিক্ষার্থী পোর্টাল
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {student?.fullNameBn}
            </h1>
            <p className="text-blue-200 text-sm font-mono mt-0.5">{student?.fullNameEn}</p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-1 bg-black/20 backdrop-blur-sm rounded-xl px-4 py-2.5">
            <span className="text-xs text-blue-300 font-medium">স্টুডেন্ট কোড</span>
            <span className="text-base font-bold font-mono tracking-wide text-white">
              {student?.studentCode}
            </span>
          </div>
        </div>
      </div>

      {/* Current Academic Placement Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold">
            <BookOpen className="w-4 h-4 text-blue-600" />
            বর্তমান শ্রেণি ও শাখা
          </div>
          <p className="text-xl font-bold text-gray-900 mt-2">
            {placement ? `${placement.classNameBn} (${placement.sectionNameBn})` : 'অনির্ধারিত'}
          </p>
          <p className="text-xs text-gray-500 mt-1 font-mono">
            {placement?.classNameEn} - Section {placement?.sectionNameEn}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            শ্রেণি রোল নম্বর
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2 font-mono">
            {placement ? String(placement.rollNo).padStart(2, '0') : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-1">শাখার ক্রমিক নম্বর</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold">
            <Calendar className="w-4 h-4 text-indigo-600" />
            চলতি শিক্ষাবর্ষ
          </div>
          <p className="text-lg font-bold text-gray-900 mt-2">
            {placement?.sessionName || 'অনির্ধারিত'}
          </p>
          <p className="text-xs text-blue-600 mt-1 font-medium">নিয়মিত একাডেমিক সেশন</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold">
            <Clock className="w-4 h-4 text-purple-600" />
            জন্ম তারিখ ও ব্লাড গ্রুপ
          </div>
          <p className="text-sm font-bold text-gray-900 mt-2">
            {student?.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('bn-BD') : '—'}
          </p>
          <p className="text-xs text-gray-600 mt-1 font-mono">
            গ্রুপ: {student?.bloodGroup || 'অনুল্লেখিত'} • {student?.gender}
          </p>
        </div>
      </div>

      {/* Enrollment History */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <History className="w-5 h-5 text-blue-700" />
          এনরোলমেন্ট ও ভর্তি ইতিহাস
        </h2>

        {enrollments.length === 0 ? (
          <p className="text-sm text-gray-500">কোনো পূর্ববর্তী এনরোলমেন্ট পাওয়া যায়নি।</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold border-b">
                <tr>
                  <th className="py-3 px-4">শিক্ষাবর্ষ</th>
                  <th className="py-3 px-4">শ্রেণি</th>
                  <th className="py-3 px-4">শাখা</th>
                  <th className="py-3 px-4">রোল নম্বর</th>
                  <th className="py-3 px-4">ভর্তির ধরন</th>
                  <th className="py-3 px-4">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {enrollments.map((enr) => (
                  <tr key={enr.id} className="hover:bg-gray-50/60">
                    <td className="py-3.5 px-4 font-semibold text-gray-900">{enr.sessionName}</td>
                    <td className="py-3.5 px-4">{enr.classNameBn}</td>
                    <td className="py-3.5 px-4">{enr.sectionNameBn}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-gray-700">{enr.rollNo}</td>
                    <td className="py-3.5 px-4 text-xs font-mono text-gray-600">{enr.enrollmentType}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          enr.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {enr.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Informational Academic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3 shadow-sm">
          <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
            <Award className="w-4 h-4 text-blue-600" />
            ফলাফল ও মূল্যায়ন
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            পরীক্ষার মূল্যায়ন ও গ্রেড শিট প্রকাশিত হলে এখানে দেখতে পারবেন।
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3 shadow-sm">
          <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-indigo-600" />
            দৈনিক উপস্থিতি
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            ক্লাস শিক্ষকের দৈনিক হাজিরা রেকর্ডের সারসংক্ষেপ দেখতে পারবেন।
          </p>
        </div>
      </div>
    </div>
  );
}
