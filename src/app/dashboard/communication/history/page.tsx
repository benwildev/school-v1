'use client';

import React, { useState, useEffect } from 'react';
import { 
  History, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Smartphone, 
  Mail, 
  MessageCircle, 
  Bell 
} from 'lucide-react';
import { CommunicationNav } from '@/components/communication/CommunicationNav';

interface DeliveryItem {
  id: string;
  channel: string;
  recipient: string;
  status: 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
  providerMessageId?: string;
  failureReason?: string;
  createdAt: string;
  template?: {
    name: string;
    code: string;
  };
  campaign?: {
    title: string;
  };
}

export default function DeliveryHistoryPage() {
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  async function loadHistory() {
    setLoading(true);
    try {
      let url = '/api/school/communication/deliveries?limit=100';
      if (channelFilter) url += `&channel=${channelFilter}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setDeliveries(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load delivery logs', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, [channelFilter, statusFilter]);

  const filtered = deliveries.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.recipient.toLowerCase().includes(q) ||
      (d.providerMessageId || '').toLowerCase().includes(q) ||
      (d.campaign?.title || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <CommunicationNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <History className="size-6 text-indigo-600" />
            ডেলিভারি ট্র্যাকিং ও অডিট হিস্ট্রি (Delivery Logs)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            প্রেরিত বার্তা সমূহের রিয়েলটাইম ডেলিভারি স্ট্যাটাস ও প্রোভাইডার কনফার্মেশন ট্র্যাকিং
          </p>
        </div>

        <button
          onClick={loadHistory}
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
              placeholder="প্রাপক বা মেসেজ আইডি দিয়ে খুঁজুন..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 pl-8 pr-3 py-2 bg-white"
            />
            <Search className="size-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white"
          >
            <option value="">সকল চ্যানেল (All Channels)</option>
            <option value="SMS">SMS</option>
            <option value="EMAIL">Email</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="IN_APP">In-App</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white"
          >
            <option value="">সকল স্ট্যাটাস (All Status)</option>
            <option value="DELIVERED">DELIVERED (ডেলিভার্ড)</option>
            <option value="SENT">SENT (প্রেরিত)</option>
            <option value="SENDING">SENDING (প্রক্রিয়াধীন)</option>
            <option value="QUEUED">QUEUED (অপেক্ষমাণ)</option>
            <option value="FAILED">FAILED (ব্যর্থ)</option>
          </select>
        </div>

        <div className="text-xs text-slate-500">
          প্রদর্শিত লগ: <span className="font-bold text-slate-800">{filtered.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">চ্যানেল ও প্রাপক</th>
                <th className="px-4 py-3">ক্যাম্পেইন / টেমপ্লেট</th>
                <th className="px-4 py-3">প্রোভাইডার ট্র্যাকিং আইডি</th>
                <th className="px-4 py-3 text-center">স্ট্যাটাস</th>
                <th className="px-4 py-3">প্রেরণের সময় (Asia/Dhaka)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
                        {d.channel === 'SMS' && <Smartphone className="size-3.5" />}
                        {d.channel === 'EMAIL' && <Mail className="size-3.5" />}
                        {d.channel === 'WHATSAPP' && <MessageCircle className="size-3.5" />}
                        {d.channel === 'IN_APP' && <Bell className="size-3.5" />}
                      </span>
                      <div>
                        <div className="font-mono text-slate-900 font-semibold">{d.recipient}</div>
                        <div className="text-[10px] text-slate-400">{d.channel}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {d.campaign?.title ? (
                      <div className="font-medium text-slate-800">{d.campaign.title}</div>
                    ) : d.template?.name ? (
                      <div className="font-medium text-slate-800">{d.template.name}</div>
                    ) : (
                      <span className="text-slate-400">Direct Message</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                    {d.providerMessageId || '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        d.status === 'DELIVERED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : d.status === 'SENT'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : d.status === 'FAILED'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {d.status === 'DELIVERED' && <CheckCircle2 className="size-3" />}
                      {d.status === 'FAILED' && <AlertTriangle className="size-3" />}
                      {d.status === 'SENT' && <Clock className="size-3" />}
                      {d.status}
                    </span>
                    {d.failureReason && (
                      <div className="text-[10px] text-red-500 mt-0.5 max-w-xs truncate">
                        {d.failureReason}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-[11px]">
                    {new Date(d.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })}
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400 text-xs">
                    কোনো মেসেজ ডেলিভারি হিস্ট্রি পাওয়া যায়নি।
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
