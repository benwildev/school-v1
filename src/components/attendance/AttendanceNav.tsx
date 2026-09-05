'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users,
  Briefcase,
  Cpu,
  Radio,
  FileEdit,
  BarChart3,
  LayoutDashboard
} from 'lucide-react';

export function AttendanceNav() {
  const pathname = usePathname();

  const tabs = [
    {
      nameBn: 'সারসংক্ষেপ',
      nameEn: 'Overview',
      href: '/dashboard/attendance',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      nameBn: 'শিক্ষার্থী হাজিরা',
      nameEn: 'Students',
      href: '/dashboard/attendance/students',
      icon: Users,
    },
    {
      nameBn: 'কর্মী হাজিরা',
      nameEn: 'Employees',
      href: '/dashboard/attendance/employees',
      icon: Briefcase,
    },
    {
      nameBn: 'বায়োমেট্রিক ও RFID ডিভাইস',
      nameEn: 'Devices',
      href: '/dashboard/attendance/devices',
      icon: Cpu,
    },
    {
      nameBn: 'ডিভাইস ইভেন্ট লগ',
      nameEn: 'Live Events',
      href: '/dashboard/attendance/events',
      icon: Radio,
    },
    {
      nameBn: 'হাজিরা সংশোধন',
      nameEn: 'Corrections',
      href: '/dashboard/attendance/corrections',
      icon: FileEdit,
    },
    {
      nameBn: 'হাজিরা রিপোর্ট',
      nameEn: 'Reports',
      href: '/dashboard/attendance/reports',
      icon: BarChart3,
    },
  ];

  return (
    <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 mb-6">
      {tabs.map((tab) => {
        const isActive = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              isActive
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-white border border-slate-200'
            }`}
          >
            <Icon className="size-4" />
            <span>{tab.nameBn}</span>
            <span className={`text-[10px] hidden sm:inline ${isActive ? 'text-emerald-100' : 'text-slate-400'}`}>
              ({tab.nameEn})
            </span>
          </Link>
        );
      })}
    </div>
  );
}
