'use client';

import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Clock 
} from 'lucide-react';
import { CommunicationNav } from '@/components/communication/CommunicationNav';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type?: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [marking, setMarking] = useState(false);

  async function loadNotifications() {
    setLoading(true);
    try {
      const res = await fetch('/api/school/notifications');
      const data = await res.json();
      if (res.ok) {
        setNotifications(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function markAsRead(id: string) {
    try {
      const res = await fetch('/api/school/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
      }
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  }

  async function markAllAsRead() {
    setMarking(true);
    try {
      const res = await fetch('/api/school/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    } catch (err) {
      console.error('Failed to mark all as read', err);
    } finally {
      setMarking(false);
    }
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const filtered = filter === 'UNREAD' ? notifications.filter((n) => !n.isRead) : notifications;

  return (
    <div className="space-y-6">
      <CommunicationNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="size-6 text-indigo-600" />
            বিজ্ঞপ্তি কেন্দ্র (Notification Center)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            আপনার অ্যাকাউন্টের জরুরি সতর্কতা, নোটিশ এবং সিস্টেম আপডেট
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            disabled={marking}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold transition disabled:opacity-50"
          >
            <CheckCheck className="size-3.5" />
            সব পঠিত হিসেবে চিহ্নিত করুন (Mark All Read)
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              filter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            সকল বিজ্ঞপ্তি ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('UNREAD')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              filter === 'UNREAD'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            অপঠিত ({unreadCount})
          </button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.map((item) => (
          <div
            key={item.id}
            className={`p-5 rounded-2xl border transition-all flex items-start justify-between gap-4 ${
              item.isRead
                ? 'bg-white border-slate-200/80 text-slate-700'
                : 'bg-indigo-50/40 border-indigo-200 text-slate-900 shadow-xs'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                  item.isRead
                    ? 'bg-slate-100 text-slate-500'
                    : 'bg-indigo-600 text-white shadow-xs'
                }`}
              >
                <Bell className="size-4" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-slate-900">{item.title}</h4>
                  {!item.isRead && (
                    <span className="size-2 rounded-full bg-indigo-600 inline-block" />
                  )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{item.message}</p>
                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-2">
                  <Clock className="size-3" />
                  <span>
                    {new Date(item.createdAt).toLocaleString('en-GB', {
                      timeZone: 'Asia/Dhaka',
                    })}
                  </span>
                </div>
              </div>
            </div>

            {!item.isRead && (
              <button
                onClick={() => markAsRead(item.id)}
                title="পঠিত হিসেবে চিহ্নিত করুন"
                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition shrink-0"
              >
                <Check className="size-4" />
              </button>
            )}
          </div>
        ))}

        {filtered.length === 0 && !loading && (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
            কোনো বিজ্ঞপ্তি পাওয়া যায়নি।
          </div>
        )}
      </div>
    </div>
  );
}
