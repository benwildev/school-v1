'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MessageSquare,
  FileText,
  Send,
  History,
  Bell
} from 'lucide-react';

export function CommunicationNav() {
  const pathname = usePathname();

  const tabs = [
    {
      nameBn: 'সারসংক্ষেপ',
      nameEn: 'Overview',
      href: '/dashboard/communication',
      icon: MessageSquare,
      exact: true,
    },
    {
      nameBn: 'বার্তা টেমপ্লেট',
      nameEn: 'Templates',
      href: '/dashboard/communication/templates',
      icon: FileText,
    },
    {
      nameBn: 'বার্তা পাঠান',
      nameEn: 'Send Message',
      href: '/dashboard/communication/send',
      icon: Send,
    },
    {
      nameBn: 'ডেলিভারি হিস্ট্রি ও অডিট',
      nameEn: 'Delivery History',
      href: '/dashboard/communication/history',
      icon: History,
    },
    {
      nameBn: 'বিজ্ঞপ্তি কেন্দ্র',
      nameEn: 'Notifications',
      href: '/dashboard/notifications',
      icon: Bell,
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
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-white border border-slate-200'
            }`}
          >
            <Icon className="size-4" />
            <span>{tab.nameBn}</span>
            <span className={`text-[10px] hidden sm:inline ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>
              ({tab.nameEn})
            </span>
          </Link>
        );
      })}
    </div>
  );
}
