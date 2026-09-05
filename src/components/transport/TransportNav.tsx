'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bus,
  MapPin,
  Users,
  Calendar,
  ClipboardList,
  Wrench,
  FileSpreadsheet,
  UserCheck,
  LayoutDashboard,
} from 'lucide-react';

export function TransportNav() {
  const pathname = usePathname();

  const links = [
    { href: '/dashboard/transport', labelBn: 'সারসংক্ষেপ', labelEn: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/transport/vehicles', labelBn: 'যানবাহন', labelEn: 'Vehicles', icon: Bus },
    { href: '/dashboard/transport/routes', labelBn: 'রুট ও স্টপ', labelEn: 'Routes & Stops', icon: MapPin },
    { href: '/dashboard/transport/drivers', labelBn: 'ড্রাইভার নিয়োগ', labelEn: 'Drivers', icon: UserCheck },
    { href: '/dashboard/transport/students', labelBn: 'শিক্ষার্থী বরাদ্দ', labelEn: 'Student Roster', icon: Users },
    { href: '/dashboard/transport/trips', labelBn: 'দৈনিক ট্রিপ', labelEn: 'Trips', icon: Calendar },
    { href: '/dashboard/transport/attendance', labelBn: 'বোর্ডিং উপস্থিতি', labelEn: 'Boarding Attendance', icon: ClipboardList },
    { href: '/dashboard/transport/maintenance', labelBn: 'রক্ষণাবেক্ষণ', labelEn: 'Maintenance', icon: Wrench },
    { href: '/dashboard/transport/reports', labelBn: 'প্রতিবেদন', labelEn: 'Reports', icon: FileSpreadsheet },
  ];

  return (
    <div className="border-b border-gray-200 bg-white mb-6">
      <nav className="flex space-x-2 overflow-x-auto py-2 px-4 text-sm font-medium">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-md whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 font-semibold shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600' : 'text-gray-500'}`} />
              <span>{link.labelBn}</span>
              <span className="text-xs text-gray-400 font-normal">({link.labelEn})</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
