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
  CalendarRange,
  Users,
  CreditCard,
  UserCheck,
  ClipboardCheck,
  MessageSquare,
  Bell,
  Bus,
  BookOpen,
  Package,
  TrendingUp,
  FileText,
  Menu,
  X,
  GraduationCap,
  CalendarCheck,
  DollarSign,
  Layers,
  ChevronDown,
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

interface NavItem {
  nameBn: string;
  nameEn: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  roles?: string[];
}

interface NavCategory {
  titleBn: string;
  titleEn: string;
  items: NavItem[];
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [activeSchool, setActiveSchool] = useState<SchoolItem | null>(null);
  const [availableSchools, setAvailableSchools] = useState<SchoolItem[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [schoolDropdownOpen, setSchoolDropdownOpen] = useState(false);

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
          setRoles(data.roles || []);
          setPermissions(data.permissions || []);
          setAvailableSchools(data.availableSchools || []);
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

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Accessibility: Close drawer or dropdown on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setSchoolDropdownOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch {
      router.push('/login');
    }
  }

  const roleCodes = roles.map((r) => r.code);
  const isSuperAdmin = Boolean(user?.isSuperAdmin);
  const isOwnerOrAdmin = roleCodes.some((code) =>
    ['SCHOOL_OWNER', 'PRINCIPAL', 'ADMIN'].includes(code)
  );

  // Navigation structure
  const categories: NavCategory[] = [
    {
      titleBn: 'কোর ব্যবস্থাপনা',
      titleEn: 'Core Operations',
      items: [
        {
          nameBn: 'ড্যাশবোর্ড',
          nameEn: 'Dashboard',
          href: '/dashboard',
          icon: Layers,
        },
        {
          nameBn: 'শিক্ষার্থী',
          nameEn: 'Students',
          href: '/dashboard/students',
          icon: GraduationCap,
          permission: 'STUDENTS_VIEW',
        },
        {
          nameBn: 'অভিভাবক',
          nameEn: 'Guardians',
          href: '/dashboard/guardians',
          icon: Users,
          permission: 'GUARDIANS_VIEW',
        },
        {
          nameBn: 'ভর্তি ও প্রমোশন',
          nameEn: 'Enrollments',
          href: '/dashboard/enrollments',
          icon: CalendarCheck,
          permission: 'ENROLLMENTS_VIEW',
        },
        {
          nameBn: 'ভর্তি আবেদন',
          nameEn: 'Admissions',
          href: '/dashboard/admissions',
          icon: UserCheck,
          permission: 'ADMISSIONS_VIEW',
        },
      ],
    },
    {
      titleBn: 'একাডেমিক ও পরীক্ষা',
      titleEn: 'Academics & Exams',
      items: [
        {
          nameBn: 'পরীক্ষা ও রুটিন',
          nameEn: 'Exams & Schedules',
          href: '/dashboard/exams',
          icon: CalendarRange,
          permission: 'ACADEMICS_VIEW',
        },
        {
          nameBn: 'নম্বর এন্ট্রি',
          nameEn: 'Marks Entry',
          href: '/dashboard/marks',
          icon: BookOpen,
          permission: 'MARKS_VIEW',
        },
        {
          nameBn: 'ফলাফল ও জিপিএ',
          nameEn: 'Results & GPA',
          href: '/dashboard/results',
          icon: TrendingUp,
          permission: 'ACADEMICS_VIEW',
        },
        {
          nameBn: 'শিক্ষক ব্যবস্থাপনা',
          nameEn: 'Teachers',
          href: '/dashboard/teachers',
          icon: Users,
          permission: 'STAFF_VIEW',
        },
      ],
    },
    {
      titleBn: 'উপস্থিতি ও যোগাযোগ',
      titleEn: 'Attendance & Comm',
      items: [
        {
          nameBn: 'হাজিরা ও বায়োমেট্রিক',
          nameEn: 'Attendance & Bio',
          href: '/dashboard/attendance',
          icon: ClipboardCheck,
          permission: 'ATTENDANCE_VIEW',
        },
        {
          nameBn: 'যোগাযোগ ও SMS',
          nameEn: 'Communication',
          href: '/dashboard/communication',
          icon: MessageSquare,
          permission: 'COMMUNICATION_VIEW',
        },
        {
          nameBn: 'বিজ্ঞপ্তি',
          nameEn: 'Notifications',
          href: '/dashboard/notifications',
          icon: Bell,
        },
      ],
    },
    {
      titleBn: 'অর্থায়ন ও পেরোল',
      titleEn: 'Finance & Payroll',
      items: [
        {
          nameBn: 'ফি ও অর্থায়ন',
          nameEn: 'Finance & Fees',
          href: '/dashboard/finance',
          icon: DollarSign,
          permission: 'FEES_VIEW',
        },
        {
          nameBn: 'এইচআর ও কর্মী',
          nameEn: 'HR & Staff',
          href: '/dashboard/hr',
          icon: Users,
          permission: 'STAFF_VIEW',
        },
        {
          nameBn: 'বেতন ও পেরোল',
          nameEn: 'Payroll',
          href: '/dashboard/payroll',
          icon: CreditCard,
          roles: ['SCHOOL_OWNER', 'PRINCIPAL', 'ADMIN', 'ACCOUNTANT'],
        },
      ],
    },
    {
      titleBn: 'লজিস্টিকস ও অপারেশনস',
      titleEn: 'Operations & Fleet',
      items: [
        {
          nameBn: 'যানবাহন ও পরিবহন',
          nameEn: 'Transport',
          href: '/dashboard/transport',
          icon: Bus,
          permission: 'TRANSPORT_VIEW',
        },
        {
          nameBn: 'লাইব্রেরি',
          nameEn: 'Library',
          href: '/dashboard/library',
          icon: BookOpen,
          permission: 'LIBRARY_VIEW',
        },
        {
          nameBn: 'ইনভেন্টরি ও সম্পদ',
          nameEn: 'Inventory & Assets',
          href: '/dashboard/inventory',
          icon: Package,
          permission: 'INVENTORY_VIEW',
        },
      ],
    },
    {
      titleBn: 'ইন্টেলিজেন্স ও রিপোর্ট',
      titleEn: 'Intelligence & Reports',
      items: [
        {
          nameBn: 'রিপোর্টস হাব',
          nameEn: 'Reports Hub',
          href: '/dashboard/reports',
          icon: FileText,
          permission: 'REPORTS_VIEW',
        },
        {
          nameBn: 'অ্যানালিটিক্স',
          nameEn: 'Analytics',
          href: '/dashboard/analytics',
          icon: TrendingUp,
          permission: 'REPORTS_VIEW',
        },
      ],
    },
    {
      titleBn: 'প্রাতিষ্ঠানিক সেটিংস',
      titleEn: 'Institution Settings',
      items: [
        {
          nameBn: 'বিদ্যালয় সেটিংস',
          nameEn: 'School Settings',
          href: '/dashboard/settings/school',
          icon: Building2,
          permission: 'SETTINGS_VIEW',
        },
        {
          nameBn: 'ক্যাম্পাস / শাখা',
          nameEn: 'Campuses',
          href: '/dashboard/settings/campuses',
          icon: MapPinned,
          permission: 'SETTINGS_VIEW',
        },
        {
          nameBn: 'শিক্ষাবর্ষ',
          nameEn: 'Academic Sessions',
          href: '/dashboard/settings/academic-sessions',
          icon: CalendarRange,
          permission: 'SETTINGS_VIEW',
        },
        {
          nameBn: 'শ্রেণি ও কাঠামো',
          nameEn: 'Academic Structure',
          href: '/dashboard/settings/academic-structure',
          icon: Layers,
          permission: 'SETTINGS_VIEW',
        },
      ],
    },
    {
      titleBn: 'আমার পোর্টাল',
      titleEn: 'Self-Service Portals',
      items: [
        {
          nameBn: 'শিক্ষক / কর্মী পোর্টাল',
          nameEn: 'Employee Portal',
          href: '/dashboard/employee',
          icon: UserCheck,
          roles: ['TEACHER', 'HR', 'ACCOUNTANT', 'LIBRARIAN', 'TRANSPORT_MANAGER'],
        },
        {
          nameBn: 'অভিভাবক পোর্টাল',
          nameEn: 'Parent Portal',
          href: '/dashboard/parent',
          icon: Users,
          roles: ['PARENT', 'SCHOOL_OWNER', 'ADMIN'],
        },
        {
          nameBn: 'শিক্ষার্থী পোর্টাল',
          nameEn: 'Student Portal',
          href: '/dashboard/student',
          icon: GraduationCap,
          roles: ['STUDENT', 'SCHOOL_OWNER', 'ADMIN'],
        },
      ],
    },
  ];

  // Filter items based on permissions and roles
  function isItemAllowed(item: NavItem): boolean {
    if (isSuperAdmin || isOwnerOrAdmin) {
      return true;
    }
    if (item.permission && permissions.includes(item.permission)) {
      return true;
    }
    if (item.roles && item.roles.some((r) => roleCodes.includes(r))) {
      return true;
    }
    if (!item.permission && !item.roles) {
      return true;
    }
    return false;
  }

  const allowedCategories = categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(isItemAllowed),
    }))
    .filter((cat) => cat.items.length > 0);

  // Determine current active page label
  let currentSectionLabel = 'ড্যাশবোর্ড';
  for (const cat of categories) {
    for (const it of cat.items) {
      if (it.href === pathname || (it.href !== '/dashboard' && pathname.startsWith(it.href))) {
        currentSectionLabel = it.nameBn;
        break;
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center gap-4">
            {/* Left: Mobile Hamburger & School Brand */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? 'মেনু বন্ধ করুন (Close menu)' : 'মেনু খুলুন (Open menu)'}
                className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
              </button>

              <Link href="/dashboard" className="flex items-center gap-2.5 group">
                <div className="size-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-xs group-hover:bg-emerald-700 transition">
                  <SchoolIcon className="size-5" />
                </div>
                <div className="hidden xs:block sm:block">
                  <div className="font-bold text-slate-900 leading-tight text-sm sm:text-base">
                    {activeSchool ? activeSchool.nameBn : 'এডুস্মার্ট বিডি'}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate max-w-[180px] sm:max-w-[280px]">
                    {activeSchool ? activeSchool.nameEn : 'School Management System'}
                  </div>
                </div>
              </Link>
            </div>

            {/* Right: School Switcher, User Details, Logout */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Multi-School Switcher Dropdown (if user has > 1 school) */}
              {availableSchools.length > 1 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setSchoolDropdownOpen(!schoolDropdownOpen)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    <Building2 className="size-3.5 text-slate-400" />
                    <span className="hidden md:inline">শাখা পরিবর্তন</span>
                    <ChevronDown className="size-3 text-slate-400" />
                  </button>
                  {schoolDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50">
                      {availableSchools.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setActiveSchool(s);
                            setSchoolDropdownOpen(false);
                            router.refresh();
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs transition ${
                            s.id === activeSchool?.id
                              ? 'bg-emerald-50 text-emerald-700 font-semibold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div>{s.nameBn}</div>
                          <div className="text-[10px] text-slate-400">{s.nameEn}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* User Profile Badge */}
              {user && (
                <div className="hidden sm:flex flex-col items-end text-right">
                  <div className="text-xs sm:text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                    <span>{user.fullName}</span>
                    {user.isSuperAdmin && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
                        <ShieldCheck className="size-3" /> সুপার এডমিন
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {roles.map((r) => r.name).join(', ') || user.phone}
                  </div>
                </div>
              )}

              {/* Logout Button */}
              <button
                type="button"
                id="header-logout-button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 transition cursor-pointer"
              >
                <LogOut className="size-3.5" />
                <span className="hidden sm:inline">লগআউট</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main App Body with Sidebar & Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col lg:flex-row gap-6">
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden lg:block w-64 shrink-0">
          <nav
            aria-label="প্রধান নেভিগেশন (Main Navigation)"
            className="sticky top-22 bg-white rounded-2xl border border-slate-200 p-4 shadow-xs max-h-[calc(100vh-6.5rem)] overflow-y-auto space-y-5"
          >
            {allowedCategories.map((cat, cIdx) => (
              <div key={cIdx} className="space-y-1">
                <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {cat.titleBn}
                </div>
                {cat.items.map((item) => {
                  const isActive =
                    item.href === pathname ||
                    (item.href !== '/dashboard' && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon className={`size-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span>{item.nameBn}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        {/* Mobile Slide-Over Drawer Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex">
            <div className="w-4/5 max-w-xs bg-white h-full shadow-2xl p-5 overflow-y-auto flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                    <SchoolIcon className="size-5 text-emerald-600" />
                    <span>এডুস্মার্ট বিডি মেনু</span>
                  </div>
                  <button
                    type="button"
                    id="mobile-drawer-close-btn"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label="মেনু বন্ধ করুন (Close menu)"
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                <nav aria-label="মোবাইল নেভিগেশন (Mobile Navigation)" className="space-y-4">
                  {allowedCategories.map((cat, cIdx) => (
                    <div key={cIdx} className="space-y-1">
                      <div className="px-2 py-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {cat.titleBn}
                      </div>
                      {cat.items.map((item) => {
                        const isActive =
                          item.href === pathname ||
                          (item.href !== '/dashboard' && pathname.startsWith(item.href));
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <Icon className={`size-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                            <span>{item.nameBn}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </nav>
              </div>

              {/* Mobile Drawer User & Logout Footer */}
              <div className="pt-4 mt-6 border-t border-slate-200 space-y-2">
                {user && (
                  <div className="px-2 py-1">
                    <div className="text-xs font-semibold text-slate-800">{user.fullName}</div>
                    <div className="text-[11px] text-slate-500">{roles.map((r) => r.name).join(', ')}</div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 transition"
                >
                  <LogOut className="size-4" />
                  <span>লগআউট করুন</span>
                </button>
              </div>
            </div>

            {/* Click outside to close */}
            <div
              className="flex-1"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          {/* Breadcrumb Bar */}
          <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
            <Link href="/dashboard" className="hover:text-emerald-700 transition">
              ড্যাশবোর্ড
            </Link>
            <ChevronRight className="size-3 text-slate-400" />
            <span className="font-semibold text-emerald-700">{currentSectionLabel}</span>
          </div>

          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}
