'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, 
  Briefcase, 
  Cpu, 
  Radio, 
  FileEdit, 
  BarChart3, 
  ArrowRight,
  Clock,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import { AttendanceNav } from '@/components/attendance/AttendanceNav';

export default function AttendanceOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDevices: 0,
    onlineDevices: 0,
    recentEvents: 0,
    pendingCorrections: 0,
    todayDateDhaka: new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' }),
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const [devRes, corrRes] = await Promise.all([
          fetch('/api/school/attendance-devices'),
          fetch('/api/school/attendance/corrections'),
        ]);

        let devCount = 0;
        let onlineCount = 0;
        if (devRes.ok) {
          const devData = await devRes.json();
          const devices = devData.data || [];
          devCount = devices.length;
          onlineCount = devices.filter((d: any) => d.status === 'ONLINE').length;
        }

        let pendingCount = 0;
        if (corrRes.ok) {
          const corrData = await corrRes.json();
          pendingCount = (corrData.data || []).length;
        }

        setStats((prev) => ({
          ...prev,
          totalDevices: devCount,
          onlineDevices: onlineCount,
          pendingCorrections: pendingCount,
        }));
      } catch (err) {
        console.error('Failed to load attendance dashboard stats', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const modules = [
    {
      titleBn: 'শিক্ষার্থী হাজিরা',
      titleEn: 'Student Attendance',
      descBn: 'শ্রেণি ও শাখা ভিত্তিক শিক্ষার্থীদের দৈনিক হাজিরা গ্রহণ ও পরিবর্তন',
      href: '/dashboard/attendance/students',
      icon: Users,
      color: 'emerald',
    },
    {
      titleBn: 'কর্মী ও শিক্ষক হাজিরা',
      titleEn: 'Staff Attendance',
      descBn: 'শিক্ষক ও কর্মচারীদের দৈনিক ইন-আউট সময়, শিফট এবং উপস্থিতি নিরীক্ষণ',
      href: '/dashboard/attendance/employees',
      icon: Briefcase,
      color: 'blue',
    },
    {
      titleBn: 'বায়োমেট্রিক ও RFID ডিভাইস',
      titleEn: 'Biometric & RFID Devices',
      descBn: 'ZKTeco, Suprema ও RFID হার্ডওয়্যার ডিভাইস পরিচালনা ও সিঙ্ক',
      href: '/dashboard/attendance/devices',
      icon: Cpu,
      color: 'purple',
    },
    {
      titleBn: 'ডিভাইস ইভেন্ট লগ',
      titleEn: 'Raw Event Ingestion',
      descBn: 'হার্ডওয়্যার থেকে আসা অপরিবর্তিত লাইভ পাঞ্চ ইভেন্ট ও ডিডুপ্লিকেশন লগ',
      href: '/dashboard/attendance/events',
      icon: Radio,
      color: 'amber',
    },
    {
      titleBn: 'হাজিরা সংশোধন ও অডিট',
      titleEn: 'Attendance Corrections',
      descBn: 'কারণসহ ম্যানুয়াল সংশোধন ও নিরাপত্তা অডিট ট্রেইল সংরক্ষণ',
      href: '/dashboard/attendance/corrections',
      icon: FileEdit,
      color: 'rose',
    },
    {
      titleBn: 'উপস্থিতি রিপোর্ট ও অ্যানালিটিক্স',
      titleEn: 'Reports & Analytics',
      descBn: 'দৈনিক, মাসিক, অনুপস্থিতি ও দেরির পরিসংখ্যান এবং এক্সেল/পিডিএফ এক্সপোর্ট',
      href: '/dashboard/attendance/reports',
      icon: BarChart3,
      color: 'indigo',
    },
  ];

  return (
    <div className="space-y-6">
      <AttendanceNav />

      {/* Header Banner */}
      <div className="bg-linear-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-emerald-200 text-xs font-semibold mb-3 border border-white/10">
            <Clock className="size-3.5" />
            <span>টাইমজোন: Asia/Dhaka (+06:00)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <span>উপস্থিতি ও বায়োমেট্রিক ইঞ্জিন</span>
            {loading && <Loader2 className="size-5 animate-spin text-emerald-300" />}
          </h1>
          <p className="text-emerald-100/90 text-xs sm:text-sm mt-2 leading-relaxed">
            EduSmart BD এর স্বয়ংক্রিয় ক্লাউড হাজিরা সিস্টেম। শিক্ষার্থী ও কর্মীদের বায়োমেট্রিক, RFID এবং ম্যানুয়াল হাজিরার একক প্ল্যাটফর্ম।
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">বায়োমেট্রিক ডিভাইস</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Cpu className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{stats.totalDevices}</span>
            <span className="text-xs text-emerald-600 font-medium">({stats.onlineDevices} অনলাইন)</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">সক্রিয় হার্ডওয়্যার টার্মিনাল</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">হাজিরা সংশোধন লগ</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <FileEdit className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{stats.pendingCorrections}</span>
            <span className="text-xs text-slate-500 font-medium">মোট রেকর্ড</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">অডিট-ট্রেইল্ড পরিবর্তন</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">নিরাপত্তা ও RLS</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-sm font-bold text-emerald-700">সক্রিয় ও সুরক্ষিত</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">টেন্যান্ট আইসোলেশন ও ডেটা সুরক্ষা</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">আজকের তারিখ</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-lg font-bold text-slate-900">{stats.todayDateDhaka}</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">ঢাকা লোকাল স্ট্যান্ডার্ড টাইম</div>
        </div>
      </div>

      {/* Module Navigation Grid */}
      <div>
        <h2 className="text-sm font-bold text-slate-800 mb-4">হাজিরা ও বায়োমেট্রিক মডিউলসমূহ</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className="group bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="size-10 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-emerald-50 group-hover:text-emerald-700 transition flex items-center justify-center mb-4">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 group-hover:text-emerald-700 transition text-sm">
                    {mod.titleBn}
                  </h3>
                  <div className="text-[11px] font-medium text-slate-400 mb-2">
                    {mod.titleEn}
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">
                    {mod.descBn}
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-600 group-hover:text-emerald-700">
                  <span>প্রবেশ করুন</span>
                  <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
