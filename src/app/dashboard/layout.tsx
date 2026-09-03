'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Building2, 
  LogOut, 
  ShieldCheck, 
  ChevronRight,
  School as SchoolIcon,
  MapPinned,
  CalendarRange
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeSchool, setActiveSchool] = useState<SchoolItem | null>(null);

  useEffect(() => {
    async function loadUserProfile() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        if (data.success) {
          setUser(data.user);
          const current = data.availableSchools?.find(
            (s: SchoolItem) => s.id === data.activeSchoolId
          );
          setActiveSchool(current || data.availableSchools?.[0] || null);
        }
      } catch (err) {
        console.error('Failed to load user in dashboard layout:', err);
      }
    }
    loadUserProfile();
  }, [router]);

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch {
      router.push('/login');
    }
  }

  const navItems = [
    {
      nameBn: 'বিদ্যালয় সেটিংস',
      nameEn: 'School Settings',
      href: '/dashboard/settings/school',
      icon: Building2,
      active: pathname.startsWith('/dashboard/settings/school'),
    },
    {
      nameBn: 'ক্যাম্পাস / শাখা',
      nameEn: 'Campuses / Branches',
      href: '/dashboard/settings/campuses',
      icon: MapPinned,
      active: pathname.startsWith('/dashboard/settings/campuses'),
    },
    {
      nameBn: 'শিক্ষাবর্ষ',
      nameEn: 'Academic Sessions',
      href: '/dashboard/settings/academic-sessions',
      icon: CalendarRange,
      active: pathname.startsWith('/dashboard/settings/academic-sessions'),
    },
  ];

  const currentSectionLabel =
    navItems.find((item) => item.active)?.nameBn || 'বিদ্যালয়ের পরিচিতি';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo & School Name */}
            <div className="flex items-center gap-3">
              <Link href="/dashboard/settings/school" className="flex items-center gap-2.5 group">
                <div className="size-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm group-hover:bg-emerald-700 transition">
                  <SchoolIcon className="size-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 leading-tight">
                    {activeSchool ? activeSchool.nameBn : 'এডুস্মার্ট বিডি (EduSmart BD)'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {activeSchool ? activeSchool.nameEn : 'School Management System'}
                  </div>
                </div>
              </Link>
            </div>

            {/* User Details & Logout */}
            <div className="flex items-center gap-4">
              {user && (
                <div className="hidden sm:flex flex-col items-end text-right">
                  <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                    {user.fullName}
                    {user.isSuperAdmin && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
                        <ShieldCheck className="size-3" /> সুপার এডমিন
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">{user.phone}</div>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition"
              >
                <LogOut className="size-3.5" />
                <span>লগআউট</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container with Breadcrumbs */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Navigation / Breadcrumb Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>ড্যাশবোর্ড</span>
            <ChevronRight className="size-3.5 text-slate-400" />
            <span>সেটিংস</span>
            <ChevronRight className="size-3.5 text-slate-400" />
            <span className="font-medium text-emerald-700">{currentSectionLabel}</span>
          </div>

          <div className="flex items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  item.active 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <item.icon className="size-3.5" />
                <span>{item.nameBn}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Content Body */}
        <main>{children}</main>
      </div>
    </div>
  );
}
