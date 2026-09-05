'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Boxes,
  Package,
  Layers,
  ArrowLeftRight,
  MonitorCheck,
  Building2,
  ShoppingCart,
  Wrench,
  FileSpreadsheet,
} from 'lucide-react';

export function InventoryNav() {
  const pathname = usePathname();

  const links = [
    { href: '/dashboard/inventory', labelBn: 'সারসংক্ষেপ', labelEn: 'Overview', icon: Boxes },
    { href: '/dashboard/inventory/items', labelBn: 'আইটেম তালিকা', labelEn: 'Items Catalog', icon: Package },
    { href: '/dashboard/inventory/stock', labelBn: 'স্টক চলাচল', labelEn: 'Stock Movements', icon: Layers },
    { href: '/dashboard/inventory/transfers', labelBn: 'ক্যাম্পাস স্থানান্তর', labelEn: 'Transfers', icon: ArrowLeftRight },
    { href: '/dashboard/inventory/assets', labelBn: 'সম্পদ ট্র্যাকিং', labelEn: 'Assets Registry', icon: MonitorCheck },
    { href: '/dashboard/inventory/suppliers', labelBn: 'সরবরাহকারী', labelEn: 'Suppliers', icon: Building2 },
    { href: '/dashboard/inventory/purchases', labelBn: 'ক্রয় অর্ডার', labelEn: 'Purchases', icon: ShoppingCart },
    { href: '/dashboard/inventory/maintenance', labelBn: 'রক্ষণাবেক্ষণ', labelEn: 'Maintenance', icon: Wrench },
    { href: '/dashboard/inventory/reports', labelBn: 'প্রতিবেদন', labelEn: 'Reports', icon: FileSpreadsheet },
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
                  ? 'bg-amber-50 text-amber-700 font-semibold shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-600' : 'text-gray-500'}`} />
              <span>{link.labelBn}</span>
              <span className="text-xs text-gray-400 font-normal">({link.labelEn})</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
