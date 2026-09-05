'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  MessageSquare, 
  Send, 
  FileText, 
  History, 
  Bell, 
  ArrowRight,
  CheckCircle2,
  Clock,
  Smartphone,
  Mail,
  MessageCircle,
  Loader2
} from 'lucide-react';
import { CommunicationNav } from '@/components/communication/CommunicationNav';

export default function CommunicationOverviewPage() {
  const [stats, setStats] = useState({
    totalMessages: 0,
    delivered: 0,
    pending: 0,
    failed: 0,
    templatesCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        const [delivRes, tempRes] = await Promise.all([
          fetch('/api/school/communication/deliveries?limit=100'),
          fetch('/api/school/communication/templates'),
        ]);

        let total = 0;
        let deliv = 0;
        let pend = 0;
        let fail = 0;

        if (delivRes.ok) {
          const dData = await delivRes.json();
          const list = dData.data || [];
          total = list.length;
          deliv = list.filter((m: any) => m.status === 'DELIVERED').length;
          pend = list.filter((m: any) => ['QUEUED', 'SENDING', 'SENT'].includes(m.status)).length;
          fail = list.filter((m: any) => m.status === 'FAILED').length;
        }

        let tempCount = 0;
        if (tempRes.ok) {
          const tData = await tempRes.json();
          tempCount = (tData.data || []).length;
        }

        setStats({
          totalMessages: total,
          delivered: deliv,
          pending: pend,
          failed: fail,
          templatesCount: tempCount,
        });
      } catch (err) {
        console.error('Failed to load communication stats', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const modules = [
    {
      titleBn: 'বার্তা ও ক্যাম্পেইন পাঠান',
      titleEn: 'Send Message / Campaign',
      descBn: 'একক বা বাল্ক এসএমএস, ইমেইল ও নোটিফিকেশন প্রেরণ করুন',
      href: '/dashboard/communication/send',
      icon: Send,
    },
    {
      titleBn: 'বার্তা টেমপ্লেট',
      titleEn: 'Notification Templates',
      descBn: 'বাংলা ও ইংরেজি স্বয়ংক্রিয় ডায়নামিক ভেরিয়েবল সমৃদ্ধ টেমপ্লেট ব্যবস্থাপনা',
      href: '/dashboard/communication/templates',
      icon: FileText,
    },
    {
      titleBn: 'ডেলিভারি হিস্ট্রি ও অডিট',
      titleEn: 'Delivery Tracking & Audit',
      descBn: 'প্রোভাইডার ট্র্যাকিং আইডি ও ডেলিভারি স্ট্যাটাসের সম্পূর্ণ অডিট হিস্ট্রি',
      href: '/dashboard/communication/history',
      icon: History,
    },
    {
      titleBn: 'বিজ্ঞপ্তি কেন্দ্র',
      titleEn: 'In-App Notifications',
      descBn: 'অভিভাবক, শিক্ষক ও শিক্ষার্থীদের জন্য ইন-অ্যাপ বিজ্ঞপ্তি নিয়ন্ত্রণ কেন্দ্র',
      href: '/dashboard/notifications',
      icon: Bell,
    },
  ];

  return (
    <div className="space-y-6">
      <CommunicationNav />

      {/* Header Banner */}
      <div className="bg-linear-to-r from-indigo-800 to-purple-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-indigo-200 text-xs font-semibold mb-3 border border-white/10">
            <MessageSquare className="size-3.5" />
            <span>EduSmart Multi-Channel Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <span>যোগাযোগ ও নোটিফিকেশন প্ল্যাটফর্ম</span>
            {loading && <Loader2 className="size-5 animate-spin text-indigo-300" />}
          </h1>
          <p className="text-indigo-100/90 text-xs sm:text-sm mt-2 leading-relaxed">
            এসএমএস, ইমেইল, হোয়াটসঅ্যাপ ও ইন-অ্যাপ নোটিফিকেশন ইঞ্জিন। অভিভাবক, শিক্ষার্থী ও কর্মীদের সাথে তাৎক্ষণিক যোগাযোগ ব্যবস্থা।
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">মোট প্রেরিত বার্তা</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Send className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{stats.totalMessages}</span>
            <span className="text-xs text-slate-500">টি বার্তা</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">সকল চ্যানেল মিলিয়ে</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">সফলভাবে ডেলিভার্ড</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700">{stats.delivered}</span>
            <span className="text-xs text-emerald-600">নিশ্চিত রিসিট</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">প্রোভাইডার নিশ্চিতকরণ প্রাপ্ত</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">প্রক্রিয়াধীন / পাঠানো হয়েছে</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-700">{stats.pending}</span>
            <span className="text-xs text-amber-600">ইন-ট্রানজিট</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">ডেলিভারির অপেক্ষায়</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">সংরক্ষিত টেমপ্লেট</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <FileText className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{stats.templatesCount}</span>
            <span className="text-xs text-purple-600">টি টেমপ্লেট</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">বাংলা ও ইংরেজি ফরম্যাট</div>
        </div>
      </div>

      {/* Channel Badges */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <h2 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider">
          সক্রিয় চ্যানেল ও গেটওয়ে স্ট্যাটাস
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
            <div className="size-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Smartphone className="size-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">SMS Gateway</div>
              <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-600"></span> BD (+880) রেডি
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
            <div className="size-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Mail className="size-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Email Gateway</div>
              <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-600"></span> SMTP / API রেডি
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
            <div className="size-9 rounded-lg bg-green-100 text-green-700 flex items-center justify-center">
              <MessageCircle className="size-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">WhatsApp Business</div>
              <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-600"></span> ক্লাউড API ফ্রেমওয়ার্ক
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
            <div className="size-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <Bell className="size-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">In-App Notification</div>
              <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-600"></span> রিয়েলটাইম সক্রিয়
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Module Navigation Grid */}
      <div>
        <h2 className="text-sm font-bold text-slate-800 mb-4">যোগাযোগ ব্যবস্থাপনা মডিউলসমূহ</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className="group bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:border-indigo-500/50 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="size-10 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-indigo-50 group-hover:text-indigo-700 transition flex items-center justify-center mb-4">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 group-hover:text-indigo-700 transition text-sm">
                    {mod.titleBn}
                  </h3>
                  <div className="text-[11px] font-medium text-slate-400 mb-2">
                    {mod.titleEn}
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">
                    {mod.descBn}
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
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
