'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Bell, 
  ArrowLeft, 
  Clock, 
  GraduationCap, 
  AlertCircle 
} from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function StudentNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadNotifications() {
      try {
        setLoading(true);
        const res = await fetch('/api/student/notifications');
        const data = await res.json();
        if (res.ok) {
          setNotifications(data.data || []);
        } else {
          setError(data.error || 'বিজ্ঞপ্তি লোড করতে সমস্যা হয়েছে।');
        }
      } catch (err: any) {
        setError(err.message || 'রিকোয়েস্ট ব্যর্থ হয়েছে।');
      } finally {
        setLoading(false);
      }
    }
    loadNotifications();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/student"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 transition"
        >
          <ArrowLeft className="size-3.5" />
          শিক্ষার্থী পোর্টালে ফিরে যান
        </Link>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <GraduationCap className="size-6 text-indigo-600" />
            শিক্ষার্থী বিজ্ঞপ্তি কেন্দ্র (Student Notifications)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            আপনার পরীক্ষা, পরীক্ষার ফলাফল, ক্লাসের সময়সূচী ও স্কুলের সাধারণ নোটিশ
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl text-xs flex items-center gap-3 bg-red-50 text-red-800 border border-red-200">
          <AlertCircle className="size-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-3">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`p-5 rounded-2xl border transition flex items-start gap-4 ${
              n.isRead
                ? 'bg-white border-slate-200/80'
                : 'bg-indigo-50/40 border-indigo-200 shadow-xs'
            }`}
          >
            <div
              className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                n.isRead ? 'bg-slate-100 text-slate-500' : 'bg-indigo-600 text-white'
              }`}
            >
              <Bell className="size-4" />
            </div>

            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900">{n.title}</h3>
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Clock className="size-3" />
                  {new Date(n.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
            </div>
          </div>
        ))}

        {notifications.length === 0 && !loading && !error && (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
            কোনো নোটিফিকেশন পাওয়া যায়নি।
          </div>
        )}
      </div>
    </div>
  );
}
