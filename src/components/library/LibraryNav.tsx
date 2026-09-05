'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  Library,
  Copy,
  ArrowLeftRight,
  BookmarkCheck,
  Receipt,
  FileSpreadsheet,
  Settings,
} from 'lucide-react';

export function LibraryNav() {
  const pathname = usePathname();

  const links = [
    { href: '/dashboard/library', labelBn: 'সারসংক্ষেপ', labelEn: 'Overview', icon: Library },
    { href: '/dashboard/library/books', labelBn: 'বইয়ের তালিকা', labelEn: 'Books Catalog', icon: BookOpen },
    { href: '/dashboard/library/copies', labelBn: 'কপি ট্র্যাকিং', labelEn: 'Book Copies', icon: Copy },
    { href: '/dashboard/library/loans', labelBn: 'বই প্রদান ও ফেরত', labelEn: 'Circulation', icon: ArrowLeftRight },
    { href: '/dashboard/library/reservations', labelBn: 'সংরক্ষণ', labelEn: 'Reservations', icon: BookmarkCheck },
    { href: '/dashboard/library/fines', labelBn: 'জরিমানা ও মওকুফ', labelEn: 'Fines & Waivers', icon: Receipt },
    { href: '/dashboard/library/reports', labelBn: 'প্রতিবেদন', labelEn: 'Reports', icon: FileSpreadsheet },
    { href: '/dashboard/library/settings', labelBn: 'সেটিংস', labelEn: 'Settings', icon: Settings },
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
                  ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
              <span>{link.labelBn}</span>
              <span className="text-xs text-gray-400 font-normal">({link.labelEn})</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
