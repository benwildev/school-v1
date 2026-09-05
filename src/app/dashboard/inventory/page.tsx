'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Boxes,
  Package,
  Layers,
  MonitorCheck,
  AlertTriangle,
  ShoppingCart,
  PlusCircle,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { InventoryNav } from '@/components/inventory/InventoryNav';

interface InventoryReportData {
  catalog: {
    totalItems: number;
    consumableItems: number;
    assetItems: number;
    lowStockCount: number;
  };
  assets: {
    totalAssets: number;
    availableAssets: number;
    assignedAssets: number;
    maintenanceAssets: number;
    disposedAssets: number;
    totalValuation: number;
  };
  procurement: {
    totalPurchases: number;
    totalPurchaseCost: number;
    totalTransfers: number;
  };
}

export default function InventoryDashboardPage() {
  const [report, setReport] = useState<InventoryReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch('/api/school/inventory/reports');
        if (res.ok) {
          const json = await res.json();
          if (json.success) setReport(json.data);
        }
      } catch (err) {
        console.error('Failed to load inventory dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Boxes className="w-7 h-7 text-amber-600" />
            ইনভেন্টরি ও সম্পদ ব্যবস্থাপনা
            <span className="text-sm font-normal text-gray-500">(Inventory & Asset Engine)</span>
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            কনজিউমেবল স্টক লেজার, ক্যাম্পাসে মাল স্থানান্তর, প্রাতিষ্ঠানিক সম্পদ ট্র্যাকিং ও ক্রয় আদেশ।
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/inventory/stock"
            className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors"
          >
            <Layers className="w-4 h-4" />
            স্টক মুভমেন্ট / ইস্যু
          </Link>
          <Link
            href="/dashboard/inventory/items"
            className="inline-flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4 text-amber-600" />
            নতুন আইটেম যুক্ত করুন
          </Link>
        </div>
      </div>

      {/* Navigation */}
      <InventoryNav />

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">মোট তালিকাভুক্ত পণ্য</span>
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">
              {loading ? '...' : report?.catalog.totalItems ?? 0}
            </span>
            <span className="text-sm text-gray-500">টি আইটেম</span>
          </div>
          <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
            <span>ভোগ্যপণ্য: {report?.catalog.consumableItems ?? 0}</span>
            <span>স্থায়ী সম্পদ: {report?.catalog.assetItems ?? 0}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">স্বল্প স্টক সতর্কতা</span>
            <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-rose-600">
              {loading ? '...' : report?.catalog.lowStockCount ?? 0}
            </span>
            <span className="text-sm text-gray-500">টি আইটেম রিরিডার স্তরে</span>
          </div>
          <div className="mt-2 text-xs text-rose-500 font-medium">
            জরুরি পুনঃঅর্ডারের প্রয়োজন
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">স্থায়ী সম্পদ ও মূল্যায়ন</span>
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <MonitorCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">
              {loading ? '...' : report?.assets.totalAssets ?? 0}
            </span>
            <span className="text-sm text-gray-500">টি সম্পদ</span>
          </div>
          <div className="mt-2 text-xs text-emerald-600 font-semibold">
            মূল্যায়ন: ৳{(report?.assets.totalValuation ?? 0).toLocaleString()}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">মোট ক্রয় অর্ডার (YTD)</span>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">
              ৳{loading ? '...' : (report?.procurement.totalPurchaseCost ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            মোট অর্ডার: {report?.procurement.totalPurchases ?? 0} টি
          </div>
        </div>
      </div>

      {/* Quick Modules */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-amber-600" />
          ইনভেন্টরি পরিচালন মডিউলসমূহ
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/dashboard/inventory/stock"
            className="p-4 rounded-lg border border-gray-200 hover:border-amber-400 hover:bg-amber-50/40 transition-all flex flex-col justify-between"
          >
            <div>
              <h3 className="font-semibold text-gray-900 text-base">স্টক মুভমেন্ট ও বিতরণ</h3>
              <p className="text-xs text-gray-500 mt-1">
                ভোগ্যপণ্য স্টক-ইন, বিতরণ, ক্ষতি ও সমন্বয় নিরীক্ষণ। নেগেটিভ স্টক প্রতিরোধ নিশ্চিত।
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-semibold text-amber-700">
              লেজার খুলুন <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Link>

          <Link
            href="/dashboard/inventory/assets"
            className="p-4 rounded-lg border border-gray-200 hover:border-amber-400 hover:bg-amber-50/40 transition-all flex flex-col justify-between"
          >
            <div>
              <h3 className="font-semibold text-gray-900 text-base">সম্পদ রেজিস্ট্রি ও এসাইনমেন্ট</h3>
              <p className="text-xs text-gray-500 mt-1">
                কম্পিউটার, ল্যাব যন্ত্রপাতি, আসবাবপত্র শিক্ষক ও শ্রেণিকক্ষে বরাদ্দ দিন এবং রক্ষণাবেক্ষণ ট্র্যাক করুন।
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-semibold text-amber-700">
              সম্পদ পরিচালনা করুন <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Link>

          <Link
            href="/dashboard/inventory/purchases"
            className="p-4 rounded-lg border border-gray-200 hover:border-amber-400 hover:bg-amber-50/40 transition-all flex flex-col justify-between"
          >
            <div>
              <h3 className="font-semibold text-gray-900 text-base">ক্রয় অর্ডার ও সরবরাহকারী</h3>
              <p className="text-xs text-gray-500 mt-1">
                ভেন্ডর কোটেশন, ইনভয়েস এবং সরবরাহ প্রাপ্তির সাথে স্বয়ংক্রিয় স্টক-ইন সম্পন্ন করুন।
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-semibold text-amber-700">
              ক্রয় রেজিস্টার দেখুন <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
