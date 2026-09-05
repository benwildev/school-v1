'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bus,
  MapPin,
  Users,
  AlertTriangle,
  Calendar,
  PlusCircle,
  ArrowRight,
} from 'lucide-react';
import { TransportNav } from '@/components/transport/TransportNav';

interface SummaryData {
  totalVehicles: number;
  activeVehicles: number;
  totalRoutes: number;
  assignedStudents: number;
  totalTripsToday: number;
  activeDrivers: number;
}

interface ExpiryAlert {
  id: string;
  vehicleCode: string;
  registrationNumber: string;
  documentCompliance: {
    insurance: { isExpired: boolean; isExpiringSoon: boolean; daysRemaining: number | null };
    fitness: { isExpired: boolean; isExpiringSoon: boolean; daysRemaining: number | null };
    registration: { isExpired: boolean; isExpiringSoon: boolean; daysRemaining: number | null };
  };
}

export default function TransportDashboardPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [alerts, setAlerts] = useState<ExpiryAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [sumRes, alertRes] = await Promise.all([
          fetch('/api/school/transport/reports?type=summary'),
          fetch('/api/school/transport/reports?type=expiry-alerts'),
        ]);

        if (sumRes.ok) {
          const sumJson = await sumRes.json();
          if (sumJson.success) setSummary(sumJson.data);
        }

        if (alertRes.ok) {
          const alertJson = await alertRes.json();
          if (alertJson.success) setAlerts(alertJson.data.alerts || []);
        }
      } catch (err) {
        console.error('Failed to load transport dashboard summary:', err);
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
            <Bus className="w-7 h-7 text-emerald-600" />
            বিদ্যালয় পরিবহন ব্যবস্থাপনা
            <span className="text-sm font-normal text-gray-500">(School Operations & Transport)</span>
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            যানবাহন বহর, রুট, স্টপ, ড্রাইভার দায়িত্ব এবং শিক্ষার্থী পরিবহন সেবা পর্যবেক্ষণ করুন।
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/transport/vehicles"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            নতুন যানবাহন যুক্ত করুন
          </Link>
          <Link
            href="/dashboard/transport/trips"
            className="inline-flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors"
          >
            <Calendar className="w-4 h-4 text-emerald-600" />
            আজকের ট্রিপ
          </Link>
        </div>
      </div>

      {/* Tab Navigation */}
      <TransportNav />

      {/* Document Expiry Alerts */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900">
                যানবাহনের নথিপত্র মেয়াদোত্তীর্ণ সতর্কতা ({alerts.length}টি যানবাহন)
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                নিম্নলিখিত যানবাহনের ফিটনেস, ট্যাক্স টোকেন বা বীমার মেয়াদ আসন্ন অথবা ইতিমধ্যে উত্তীর্ণ হয়েছে। দ্রুত নবায়ন নিশ্চিত করুন।
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {alerts.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1.5 bg-white border border-amber-300 text-amber-900 text-xs px-2.5 py-1 rounded-md font-medium"
                  >
                    <Bus className="w-3.5 h-3.5 text-amber-600" />
                    {a.vehicleCode} ({a.registrationNumber})
                  </span>
                ))}
              </div>
            </div>
            <Link
              href="/dashboard/transport/reports?type=expiry-alerts"
              className="text-xs font-medium text-amber-800 hover:text-amber-900 underline whitespace-nowrap"
            >
              বিস্তারিত দেখুন &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <Bus className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">সক্রিয় যানবাহন (Vehicles)</div>
            <div className="text-2xl font-bold text-gray-900 mt-0.5">
              {loading ? '...' : `${summary?.activeVehicles || 0} / ${summary?.totalVehicles || 0}`}
            </div>
            <div className="text-xs text-emerald-600 font-medium mt-0.5">
              মোট বহর প্রস্তুতি
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">চালু রুট (Active Routes)</div>
            <div className="text-2xl font-bold text-gray-900 mt-0.5">
              {loading ? '...' : summary?.totalRoutes || 0}
            </div>
            <div className="text-xs text-blue-600 font-medium mt-0.5">
              নিয়মিত পিকআপ ও ড্রপ
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">বরাদ্দ শিক্ষার্থী (Students)</div>
            <div className="text-2xl font-bold text-gray-900 mt-0.5">
              {loading ? '...' : summary?.assignedStudents || 0}
            </div>
            <div className="text-xs text-purple-600 font-medium mt-0.5">
              পরিবহন সেবা গ্রহণকারী
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">আজকের ট্রিপ (Today&apos;s Trips)</div>
            <div className="text-2xl font-bold text-gray-900 mt-0.5">
              {loading ? '...' : summary?.totalTripsToday || 0}
            </div>
            <div className="text-xs text-amber-600 font-medium mt-0.5">
              সকাল ও দুপুরের যাত্রা
            </div>
          </div>
        </div>
      </div>

      {/* Operations Quick Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Bus className="w-5 h-5 text-emerald-600" />
              বহর ও যানবাহন
            </h2>
            <Link href="/dashboard/transport/vehicles" className="text-xs text-emerald-600 hover:underline">
              তালিকা &rarr;
            </Link>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            বাস, মিনিবাস, মাইক্রোবাস নিবন্ধন নম্বর, ফিটনেস মেয়াদ এবং আসন ধারণক্ষমতা পর্যবেক্ষণ করুন।
          </p>
          <div className="space-y-2">
            <Link
              href="/dashboard/transport/vehicles"
              className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm text-gray-700 transition-colors"
            >
              <span>সকল যানবাহনের তালিকা</span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </Link>
            <Link
              href="/dashboard/transport/maintenance"
              className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm text-gray-700 transition-colors"
            >
              <span>সার্ভিসিং ও মেরামত লগ</span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </Link>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              রুট ও স্টপ
            </h2>
            <Link href="/dashboard/transport/routes" className="text-xs text-blue-600 hover:underline">
              ব্যবস্থাপনা &rarr;
            </Link>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            নির্দিষ্ট রুটের ক্রমানুসারে স্টপ নির্ধারণ, শিক্ষার্থীদের পিকআপ ও ড্রপ সময়সূচী তৈরি করুন।
          </p>
          <div className="space-y-2">
            <Link
              href="/dashboard/transport/routes"
              className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm text-gray-700 transition-colors"
            >
              <span>রুট ও স্টপ কনফিগারেশন</span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </Link>
            <Link
              href="/dashboard/transport/drivers"
              className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm text-gray-700 transition-colors"
            >
              <span>ড্রাইভার ও হেলপার দায়িত্ব</span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </Link>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              শিক্ষার্থী ও ট্রিপ
            </h2>
            <Link href="/dashboard/transport/students" className="text-xs text-purple-600 hover:underline">
              বরাদ্দ &rarr;
            </Link>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            ভর্তিভিত্তিক সেশন অনুসারী পরিবহন বরাদ্দ, আসন ধারণক্ষমতা চেক ও রিয়েল-টাইম বোর্ডিং লগ।
          </p>
          <div className="space-y-2">
            <Link
              href="/dashboard/transport/students"
              className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm text-gray-700 transition-colors"
            >
              <span>শিক্ষার্থী পরিবহন আসন বরাদ্দ</span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </Link>
            <Link
              href="/dashboard/transport/attendance"
              className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm text-gray-700 transition-colors"
            >
              <span>বাসে ওঠা ও নামার উপস্থিতি লগ</span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
