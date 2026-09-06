'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  GraduationCap,
  ClipboardCheck,
  CreditCard,
  Briefcase,
  Bus,
  BookOpen,
  Package,
  BarChart3,
  FileText,
  Settings,
  UserCheck,
  Loader2,
  CalendarCheck,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  Bell,
} from 'lucide-react';

interface AuthUser {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  isSuperAdmin: boolean;
}

interface SchoolItem {
  id: string;
  slug: string;
  nameEn: string;
  nameBn: string;
  roleCodes: string[];
}

interface UserRole {
  id: string;
  code: string;
  name: string;
}

export default function MainDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [activeSchool, setActiveSchool] = useState<SchoolItem | null>(null);

  useEffect(() => {
    async function loadUserData() {
      try {
        setLoading(true);
        const res = await fetch('/api/auth/me');
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        if (data.success) {
          setUser(data.user);
          setRoles(data.roles || []);
          setPermissions(data.permissions || []);
          const current = data.availableSchools?.find(
            (s: SchoolItem) => s.id === data.activeSchoolId
          );
          setActiveSchool(current || data.availableSchools?.[0] || null);
        }
      } catch (err) {
        console.error('Failed to load user in main dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadUserData();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-emerald-600" />
        <p className="text-sm font-medium text-slate-500">ড্যাশবোর্ড লোড হচ্ছে... (Loading dashboard)</p>
      </div>
    );
  }

  const roleCodes = roles.map((r) => r.code);
  const isStudent = roleCodes.includes('STUDENT');
  const isParent = roleCodes.includes('PARENT');
  const isTeacher = roleCodes.includes('TEACHER') && !roleCodes.includes('ADMIN') && !roleCodes.includes('PRINCIPAL') && !roleCodes.includes('SCHOOL_OWNER');
  const isAccountant = roleCodes.includes('ACCOUNTANT') && !roleCodes.includes('ADMIN') && !roleCodes.includes('PRINCIPAL') && !roleCodes.includes('SCHOOL_OWNER');

  return (
    <div className="space-y-6 pb-12">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1">
            {activeSchool ? activeSchool.nameBn : 'এডুস্মার্ট বিডি'} • {roles.map((r) => r.name).join(', ') || 'ব্যবহারকারী'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            স্বাগতম, {user?.fullName || 'ব্যবহারকারী'}!
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {activeSchool ? `${activeSchool.nameEn} — প্রাতিষ্ঠানিক ব্যবস্থাপনা ও মনিটরিং পোর্টাল` : 'স্কুল ম্যানেজমেন্ট সিস্টেম'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          {permissions.includes('REPORTS_VIEW') && (
            <Link
              href="/dashboard/reports"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
            >
              <FileText className="size-4" />
              <span>রিপোর্টস হাব</span>
            </Link>
          )}
          {permissions.includes('SETTINGS_VIEW') && (
            <Link
              href="/dashboard/settings/school"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition"
            >
              <Settings className="size-4" />
              <span>সেটিংস</span>
            </Link>
          )}
        </div>
      </div>

      {/* STUDENT SPECIFIC DASHBOARD */}
      {isStudent && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/dashboard/student"
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 hover:shadow-md transition group"
            >
              <div className="size-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:bg-emerald-600 group-hover:text-white transition">
                <GraduationCap className="size-5" />
              </div>
              <h2 className="font-bold text-slate-900 text-base">আমার প্রোফাইল ও ভর্তি</h2>
              <p className="text-xs text-slate-500 mt-1">শ্রেণি, শাখা ও রোল নম্বর সংক্রান্ত তথ্য</p>
            </Link>

            <Link
              href="/dashboard/student"
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 hover:shadow-md transition group"
            >
              <div className="size-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:bg-blue-600 group-hover:text-white transition">
                <ClipboardCheck className="size-5" />
              </div>
              <h2 className="font-bold text-slate-900 text-base">উপস্থিতির রেকর্ড</h2>
              <p className="text-xs text-slate-500 mt-1">দৈনিক ও মাসিক উপস্থিতির বিবরণী</p>
            </Link>

            <Link
              href="/dashboard/student/library"
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 hover:shadow-md transition group"
            >
              <div className="size-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3 group-hover:bg-purple-600 group-hover:text-white transition">
                <BookOpen className="size-5" />
              </div>
              <h2 className="font-bold text-slate-900 text-base">লাইব্রেরি বই</h2>
              <p className="text-xs text-slate-500 mt-1">ধারকৃত বই ও ফেরত দেয়ার সময়সীমা</p>
            </Link>

            <Link
              href="/dashboard/student/transport"
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 hover:shadow-md transition group"
            >
              <div className="size-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3 group-hover:bg-amber-600 group-hover:text-white transition">
                <Bus className="size-5" />
              </div>
              <h2 className="font-bold text-slate-900 text-base">স্কুল পরিবহন</h2>
              <p className="text-xs text-slate-500 mt-1">বাস রুট ও বোর্ডিং স্টপ তথ্য</p>
            </Link>
          </div>
        </div>
      )}

      {/* PARENT SPECIFIC DASHBOARD */}
      {isParent && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/dashboard/parent"
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 hover:shadow-md transition group"
            >
              <div className="size-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:bg-emerald-600 group-hover:text-white transition">
                <Users className="size-5" />
              </div>
              <h2 className="font-bold text-slate-900 text-base">আমার সন্তানগণ</h2>
              <p className="text-xs text-slate-500 mt-1">সন্তানদের শ্রেণি, শাখা ও রোল সংক্রান্ত তথ্য</p>
            </Link>

            <Link
              href="/dashboard/parent"
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 hover:shadow-md transition group"
            >
              <div className="size-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:bg-blue-600 group-hover:text-white transition">
                <ClipboardCheck className="size-5" />
              </div>
              <h2 className="font-bold text-slate-900 text-base">হাজিরা ও ফলাফল</h2>
              <p className="text-xs text-slate-500 mt-1">সন্তানের উপস্থিতি এবং পরীক্ষার গ্রেড শিট</p>
            </Link>

            <Link
              href="/dashboard/parent/transport"
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 hover:shadow-md transition group"
            >
              <div className="size-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3 group-hover:bg-amber-600 group-hover:text-white transition">
                <Bus className="size-5" />
              </div>
              <h2 className="font-bold text-slate-900 text-base">পরিবহন ও বাস</h2>
              <p className="text-xs text-slate-500 mt-1">সন্তানের স্কুল বাস রুট ও স্টপ তথ্য</p>
            </Link>

            <Link
              href="/dashboard/parent/notifications"
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 hover:shadow-md transition group"
            >
              <div className="size-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3 group-hover:bg-purple-600 group-hover:text-white transition">
                <Bell className="size-5" />
              </div>
              <h2 className="font-bold text-slate-900 text-base">বিদ্যালয় নোটিশ</h2>
              <p className="text-xs text-slate-500 mt-1">জরুরি বিজ্ঞপ্তি ও এসএমএস বার্তা</p>
            </Link>
          </div>
        </div>
      )}

      {/* TEACHER SPECIFIC DASHBOARD */}
      {isTeacher && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/dashboard/attendance/students"
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 hover:shadow-md transition group"
            >
              <div className="size-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:bg-emerald-600 group-hover:text-white transition">
                <ClipboardCheck className="size-5" />
              </div>
              <h2 className="font-bold text-slate-900 text-base">হাজিরা গ্রহণ</h2>
              <p className="text-xs text-slate-500 mt-1">শ্রেণি ও শাখার দৈনিক উপস্থিতি গ্রহণ করুন</p>
            </Link>

            <Link
              href="/dashboard/marks"
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 hover:shadow-md transition group"
            >
              <div className="size-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:bg-blue-600 group-hover:text-white transition">
                <BookOpen className="size-5" />
              </div>
              <h2 className="font-bold text-slate-900 text-base">নম্বর এন্ট্রি</h2>
              <p className="text-xs text-slate-500 mt-1">নির্ধারিত বিষয়ের পরীক্ষার প্রাপ্ত নম্বর দিন</p>
            </Link>

            <Link
              href="/dashboard/employee"
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 hover:shadow-md transition group"
            >
              <div className="size-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3 group-hover:bg-purple-600 group-hover:text-white transition">
                <UserCheck className="size-5" />
              </div>
              <h2 className="font-bold text-slate-900 text-base">আমার শিক্ষক পোর্টাল</h2>
              <p className="text-xs text-slate-500 mt-1">ছুটির আবেদন ও ব্যক্তিগত প্রোফাইল</p>
            </Link>

            <Link
              href="/dashboard/library"
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 hover:shadow-md transition group"
            >
              <div className="size-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3 group-hover:bg-amber-600 group-hover:text-white transition">
                <BookOpen className="size-5" />
              </div>
              <h2 className="font-bold text-slate-900 text-base">লাইব্রেরি</h2>
              <p className="text-xs text-slate-500 mt-1">বই তালিকা ও ব্যক্তিগত রিজার্ভেশন</p>
            </Link>
          </div>
        </div>
      )}

      {/* ACCOUNTANT SPECIFIC DASHBOARD */}
      {isAccountant && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/dashboard/finance"
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 hover:shadow-md transition group"
            >
              <div className="size-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:bg-emerald-600 group-hover:text-white transition">
                <DollarSign className="size-5" />
              </div>
              <h2 className="font-bold text-slate-900 text-base">ফি আদায় ও পেমেন্ট</h2>
              <p className="text-xs text-slate-500 mt-1">ক্যাশ, বিকাশ ও ব্যাংক ফি গ্রহণ করুন</p>
            </Link>

            <Link
              href="/dashboard/finance"
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 hover:shadow-md transition group"
            >
              <div className="size-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:bg-blue-600 group-hover:text-white transition">
                <FileSpreadsheet className="size-5" />
              </div>
              <h2 className="font-bold text-slate-900 text-base">ইনভয়েস ও বকেয়া</h2>
              <p className="text-xs text-slate-500 mt-1">শিক্ষার্থী ফি ইনভয়েস ও মানি রিসিট</p>
            </Link>

            <Link
              href="/dashboard/payroll"
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 hover:shadow-md transition group"
            >
              <div className="size-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3 group-hover:bg-purple-600 group-hover:text-white transition">
                <CreditCard className="size-5" />
              </div>
              <h2 className="font-bold text-slate-900 text-base">বেতন ও পেরোল</h2>
              <p className="text-xs text-slate-500 mt-1">মাসিক স্যালারি শিট ও পে-স্লিপ</p>
            </Link>

            <Link
              href="/dashboard/reports"
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 hover:shadow-md transition group"
            >
              <div className="size-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3 group-hover:bg-amber-600 group-hover:text-white transition">
                <FileText className="size-5" />
              </div>
              <h2 className="font-bold text-slate-900 text-base">আর্থিক রিপোর্ট</h2>
              <p className="text-xs text-slate-500 mt-1">আদায়, লেজার ও বকেয়া সংক্রান্ত রিপোর্ট</p>
            </Link>
          </div>
        </div>
      )}

      {/* INSTITUTIONAL ADMIN / PRINCIPAL / OWNER DASHBOARD */}
      {(!isStudent && !isParent && !isTeacher && !isAccountant) && (
        <div className="space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="text-xs font-semibold text-slate-500">শিক্ষার্থী</div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">ভর্তি ও সক্রিয়</div>
              <div className="text-[11px] text-emerald-600 font-medium mt-0.5">রোল ও সেকশন বিন্যাস</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="text-xs font-semibold text-slate-500">উপস্থিতি</div>
              <div className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1">বায়োমেট্রিক</div>
              <div className="text-[11px] text-slate-500 mt-0.5">লাইভ ডিভাইস সিঙ্ক</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="text-xs font-semibold text-slate-500">পরীক্ষা</div>
              <div className="text-xl sm:text-2xl font-bold text-blue-700 mt-1">টার্ম ও ফলাফল</div>
              <div className="text-[11px] text-slate-500 mt-0.5">NCTB জিপিএ স্কেল</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="text-xs font-semibold text-slate-500">ফি ও একাউন্টস</div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">আদায় ও বকেয়া</div>
              <div className="text-[11px] text-emerald-600 font-medium mt-0.5">ক্যাশ / এমএফএস / ব্যাংক</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="text-xs font-semibold text-slate-500">কর্মী ও পেরোল</div>
              <div className="text-xl sm:text-2xl font-bold text-purple-700 mt-1">এইচআর</div>
              <div className="text-[11px] text-slate-500 mt-0.5">মাসিক বেতন ব্যবস্থাপনা</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="text-xs font-semibold text-slate-500">লজিস্টিকস</div>
              <div className="text-xl sm:text-2xl font-bold text-amber-700 mt-1">পরিবহন ও স্টক</div>
              <div className="text-[11px] text-slate-500 mt-0.5">যানবাহন ও ইনভেন্টরি</div>
            </div>
          </div>

          {/* Operational Module Grid */}
          <div>
            <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span>প্রাতিষ্ঠানিক মডিউল ও ব্যবস্থাপনা</span>
              <span className="text-xs font-normal text-slate-500">(Core Modules)</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Students */}
              <Link
                href="/dashboard/students"
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-emerald-400 hover:shadow-md transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition">
                    <GraduationCap className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">শিক্ষার্থী ব্যবস্থাপনা</h3>
                    <p className="text-xs text-slate-500">Student Directory & Profiles</p>
                  </div>
                </div>
              </Link>

              {/* Guardians */}
              <Link
                href="/dashboard/guardians"
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-emerald-400 hover:shadow-md transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition">
                    <Users className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">অভিভাবক ও রিলেশন</h3>
                    <p className="text-xs text-slate-500">Guardians & Relationships</p>
                  </div>
                </div>
              </Link>

              {/* Enrollments */}
              <Link
                href="/dashboard/enrollments"
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-emerald-400 hover:shadow-md transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition">
                    <CalendarCheck className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">ভর্তি ও প্রমোশন</h3>
                    <p className="text-xs text-slate-500">Enrollment & Promotions</p>
                  </div>
                </div>
              </Link>

              {/* Admissions */}
              <Link
                href="/dashboard/admissions"
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-emerald-400 hover:shadow-md transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition">
                    <UserCheck className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">ভর্তি আবেদন ও ফানেল</h3>
                    <p className="text-xs text-slate-500">Admission Applications</p>
                  </div>
                </div>
              </Link>

              {/* Attendance */}
              <Link
                href="/dashboard/attendance"
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-emerald-400 hover:shadow-md transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition">
                    <ClipboardCheck className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">হাজিরা ও বায়োমেট্রিক</h3>
                    <p className="text-xs text-slate-500">Student & Staff Attendance</p>
                  </div>
                </div>
              </Link>

              {/* Exams */}
              <Link
                href="/dashboard/exams"
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-emerald-400 hover:shadow-md transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                    <CalendarCheck className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">পরীক্ষা ও রুটিন</h3>
                    <p className="text-xs text-slate-500">Exams & Schedules</p>
                  </div>
                </div>
              </Link>

              {/* Marks */}
              <Link
                href="/dashboard/marks"
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-emerald-400 hover:shadow-md transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                    <BookOpen className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">নম্বর এন্ট্রি ও অনুমোদন</h3>
                    <p className="text-xs text-slate-500">Marks Entry & Approval</p>
                  </div>
                </div>
              </Link>

              {/* Results */}
              <Link
                href="/dashboard/results"
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-emerald-400 hover:shadow-md transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                    <BarChart3 className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">ফলাফল ও মার্কশিট</h3>
                    <p className="text-xs text-slate-500">GPA Results & Transcripts</p>
                  </div>
                </div>
              </Link>

              {/* Finance */}
              <Link
                href="/dashboard/finance"
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-emerald-400 hover:shadow-md transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition">
                    <DollarSign className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">অর্থায়ন ও ফি আদায়</h3>
                    <p className="text-xs text-slate-500">Invoices, Fees & Ledger</p>
                  </div>
                </div>
              </Link>

              {/* HR & Staff */}
              <Link
                href="/dashboard/hr"
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-emerald-400 hover:shadow-md transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition">
                    <Briefcase className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">এইচআর ও কর্মী</h3>
                    <p className="text-xs text-slate-500">Staff, Teachers & Leaves</p>
                  </div>
                </div>
              </Link>

              {/* Payroll */}
              <Link
                href="/dashboard/payroll"
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-emerald-400 hover:shadow-md transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition">
                    <CreditCard className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">বেতন ও পেরোল</h3>
                    <p className="text-xs text-slate-500">Payroll Cycles & Payslips</p>
                  </div>
                </div>
              </Link>

              {/* Transport */}
              <Link
                href="/dashboard/transport"
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-emerald-400 hover:shadow-md transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition">
                    <Bus className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">যানবাহন ও পরিবহন</h3>
                    <p className="text-xs text-slate-500">Fleet, Routes & Boarding</p>
                  </div>
                </div>
              </Link>

              {/* Library */}
              <Link
                href="/dashboard/library"
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-emerald-400 hover:shadow-md transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center group-hover:bg-cyan-600 group-hover:text-white transition">
                    <BookOpen className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">গ্রন্থাগার / লাইব্রেরি</h3>
                    <p className="text-xs text-slate-500">Catalog, Loans & Fines</p>
                  </div>
                </div>
              </Link>

              {/* Inventory */}
              <Link
                href="/dashboard/inventory"
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-emerald-400 hover:shadow-md transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition">
                    <Package className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">ইনভেন্টরি ও সম্পদ</h3>
                    <p className="text-xs text-slate-500">Stock & Fixed Assets</p>
                  </div>
                </div>
              </Link>

              {/* Reports */}
              <Link
                href="/dashboard/reports"
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-emerald-400 hover:shadow-md transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition">
                    <FileText className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">রিপোর্টস হাব</h3>
                    <p className="text-xs text-slate-500">25+ Standardized Reports</p>
                  </div>
                </div>
              </Link>

              {/* Analytics */}
              <Link
                href="/dashboard/analytics"
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-emerald-400 hover:shadow-md transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition">
                    <TrendingUp className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">ম্যানেজমেন্ট অ্যানালিটিক্স</h3>
                    <p className="text-xs text-slate-500">Executive KPI Dashboards</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
