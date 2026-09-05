'use client';

import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  RefreshCw, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Layers
} from 'lucide-react';
import { AttendanceNav } from '@/components/attendance/AttendanceNav';

interface RawEventItem {
  id: string;
  externalEventId: string;
  eventType: string;
  eventTimestamp: string;
  identifier: string;
  cardNo?: string;
  processingStatus: 'PENDING' | 'PROCESSED' | 'DUPLICATE' | 'ERROR' | 'NEEDS_REVIEW';
  errorMessage?: string;
  receivedAt: string;
  device?: {
    name: string;
    deviceCode: string;
    provider: string;
  };
}

export default function AttendanceEventsPage() {
  const [events, setEvents] = useState<RawEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  async function loadEvents() {
    setLoading(true);
    try {
      let url = '/api/school/attendance-events?limit=50';
      if (statusFilter) url += `&status=${statusFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setEvents(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load raw attendance events', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, [statusFilter]);

  const filtered = events.filter((ev) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      ev.externalEventId.toLowerCase().includes(q) ||
      ev.identifier.toLowerCase().includes(q) ||
      (ev.device?.name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <AttendanceNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Radio className="size-6 text-amber-600" />
            ডিভাইস ইভেন্ট লগ ও ফরেনসিক্স (Raw Event Ingestion)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            বায়োমেট্রিক ও RFID টার্মিনাল থেকে আসা অপরিবর্তিত লাইভ ডেটা স্ট্রিম ও ডিডুপ্লিকেশন ট্র্যাকিং
          </p>
        </div>

        <button
          onClick={loadEvents}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          রিফ্রেশ করুন
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-xs">
            <input
              type="text"
              placeholder="আইডি বা ইভেন্ট আইডি দিয়ে খুঁজুন..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 pl-8 pr-3 py-2 bg-white"
            />
            <Search className="size-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white"
          >
            <option value="">সব স্ট্যাটাস (All Status)</option>
            <option value="PROCESSED">PROCESSED (সফল)</option>
            <option value="DUPLICATE">DUPLICATE (প্রতিরোধিত)</option>
            <option value="NEEDS_REVIEW">NEEDS_REVIEW (পর্যালোচনা)</option>
            <option value="ERROR">ERROR (ত্রুটি)</option>
          </select>
        </div>

        <div className="text-xs text-slate-500">
          প্রদর্শিত ইভেন্ট: <span className="font-bold text-slate-800">{filtered.length}</span>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">ইভেন্ট আইডি ও ডিভাইস</th>
                <th className="px-4 py-3">পাঞ্চ সময় (Asia/Dhaka)</th>
                <th className="px-4 py-3">আইডেন্টিফায়ার / কার্ড</th>
                <th className="px-4 py-3">পাঞ্চের ধরন</th>
                <th className="px-4 py-3 text-center">প্রসেসিং ফলাফল</th>
                <th className="px-4 py-3">গ্রহণ করার সময়</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((ev) => (
                <tr key={ev.id} className="hover:bg-slate-50/50 transition font-sans">
                  <td className="px-4 py-3">
                    <div className="font-mono text-slate-900 font-semibold">{ev.externalEventId}</div>
                    <div className="text-[11px] text-slate-400">
                      {ev.device?.name || 'Unknown Device'} ({ev.device?.provider || 'GENERIC'})
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-800 font-medium">
                    {new Date(ev.eventTimestamp).toLocaleString('en-GB', {
                      timeZone: 'Asia/Dhaka',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-800">{ev.identifier}</div>
                    {ev.cardNo && <div className="text-[10px] text-slate-400">Card: {ev.cardNo}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                      {ev.eventType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        ev.processingStatus === 'PROCESSED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : ev.processingStatus === 'DUPLICATE'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : ev.processingStatus === 'NEEDS_REVIEW'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {ev.processingStatus === 'PROCESSED' && <CheckCircle2 className="size-3" />}
                      {ev.processingStatus === 'DUPLICATE' && <Layers className="size-3" />}
                      {ev.processingStatus === 'ERROR' && <AlertTriangle className="size-3" />}
                      {ev.processingStatus}
                    </span>
                    {ev.errorMessage && (
                      <div className="text-[10px] text-red-500 mt-0.5">{ev.errorMessage}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-[11px]">
                    {new Date(ev.receivedAt).toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka' })}
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 text-xs">
                    কোনো অপরিবর্তিত ইভেন্ট পাওয়া যায়নি।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
