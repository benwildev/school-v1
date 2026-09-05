'use client';

import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Loader2,
  Lock
} from 'lucide-react';
import { AttendanceNav } from '@/components/attendance/AttendanceNav';

interface DeviceItem {
  id: string;
  name: string;
  deviceCode: string;
  deviceType: string;
  provider: string;
  ipAddress?: string;
  port?: number;
  location?: string;
  status: 'ONLINE' | 'OFFLINE' | 'DISABLED';
  syncMode: string;
  lastSyncAt?: string;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    deviceCode: '',
    deviceType: 'BIOMETRIC_FINGERPRINT',
    provider: 'ZKTECO',
    ipAddress: '',
    port: 4370,
    location: '',
    syncMode: 'REALTIME',
    apiKey: '',
  });

  async function loadDevices() {
    setLoading(true);
    try {
      const res = await fetch('/api/school/attendance-devices');
      const data = await res.json();
      if (res.ok) {
        setDevices(data.data || []);
      } else {
        setMessage({ type: 'error', text: data.error || 'ডিভাইস লোড করতে সমস্যা হয়েছে।' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'ডাটা লোড ব্যর্থ হয়েছে।' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDevices();
  }, []);

  async function handleSync(deviceId: string) {
    setSyncingId(deviceId);
    setMessage(null);
    try {
      const res = await fetch(`/api/school/attendance-devices/${deviceId}/sync`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `সিঙ্ক সম্পন্ন হয়েছে: ${data.message || 'সফল'}` });
        loadDevices();
      } else {
        setMessage({ type: 'error', text: data.error || 'সিঙ্ক ব্যর্থ হয়েছে।' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'সিঙ্ক রিকোয়েস্ট ব্যর্থ।' });
    } finally {
      setSyncingId(null);
    }
  }

  async function handleCreateDevice(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setMessage(null);

    try {
      const res = await fetch('/api/school/attendance-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          port: Number(formData.port),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'ডিভাইস সফলভাবে সংযুক্ত করা হয়েছে।' });
        setShowAddModal(false);
        setFormData({
          name: '',
          deviceCode: '',
          deviceType: 'BIOMETRIC_FINGERPRINT',
          provider: 'ZKTECO',
          ipAddress: '',
          port: 4370,
          location: '',
          syncMode: 'REALTIME',
          apiKey: '',
        });
        loadDevices();
      } else {
        setMessage({ type: 'error', text: data.error || 'ডিভাইস সংযোগ ব্যর্থ।' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'রিকোয়েস্ট ব্যর্থ।' });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <AttendanceNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Cpu className="size-6 text-purple-600" />
            বায়োমেট্রিক ও RFID ডিভাইস ব্যবস্থাপনা (Device Hub)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            ZKTeco, Suprema ও RFID গেটওয়ে টার্মিনাল কনফিগারেশন, স্ট্যাটাস মনিটরিং এবং সিঙ্ক
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition shadow-sm"
        >
          <Plus className="size-4" />
          নতুন ডিভাইস যোগ করুন (Add Device)
        </button>
      </div>

      {/* Status Messages */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-3 border ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="size-4 shrink-0 text-red-600" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Device List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
          <span className="text-xs font-semibold text-slate-700">
            মোট ডিভাইস: {devices.length}
          </span>
          <button
            onClick={loadDevices}
            disabled={loading}
            className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            রিফ্রেশ
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">ডিভাইসের নাম ও কোড</th>
                <th className="px-4 py-3">প্রোভাইডার ও ধরন</th>
                <th className="px-4 py-3">আইপি ও পোর্ট</th>
                <th className="px-4 py-3">লোকেশন</th>
                <th className="px-4 py-3 text-center">স্ট্যাটাস</th>
                <th className="px-4 py-3">সর্বশেষ সিঙ্ক</th>
                <th className="px-4 py-3 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {devices.map((dev) => (
                <tr key={dev.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{dev.name}</div>
                    <div className="text-[11px] font-mono text-slate-400">{dev.deviceCode}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                      {dev.provider}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-0.5">{dev.deviceType}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">
                    {dev.ipAddress ? `${dev.ipAddress}:${dev.port || 4370}` : 'Cloud / Webhook'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {dev.location || 'মূল ফটক (Main Gate)'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        dev.status === 'ONLINE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          dev.status === 'ONLINE' ? 'bg-emerald-600' : 'bg-slate-400'
                        }`}
                      />
                      {dev.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-[11px]">
                    {dev.lastSyncAt
                      ? new Date(dev.lastSyncAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })
                      : 'কখনো নয়'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleSync(dev.id)}
                      disabled={syncingId === dev.id}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`size-3 ${syncingId === dev.id ? 'animate-spin' : ''}`}
                      />
                      সিঙ্ক করুন
                    </button>
                  </td>
                </tr>
              ))}

              {devices.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400 text-xs">
                    কোনো বায়োমেট্রিক বা RFID ডিভাইস সংযুক্ত নেই। &ldquo;নতুন ডিভাইস যোগ করুন&rdquo; এ ক্লিক করুন।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Cpu className="size-5 text-purple-600" />
                নতুন বায়োমেট্রিক/RFID ডিভাইস যোগ করুন
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDevice} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ডিভাইসের নাম (Device Name) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Main Gate Biometric Terminal"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    ডিভাইস কোড <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DEV-GATE-01"
                    value={formData.deviceCode}
                    onChange={(e) => setFormData({ ...formData, deviceCode: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    প্রোভাইডার (Provider)
                  </label>
                  <select
                    value={formData.provider}
                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white"
                  >
                    <option value="ZKTECO">ZKTeco</option>
                    <option value="SUPREMA">Suprema</option>
                    <option value="RFID">RFID Reader</option>
                    <option value="CUSTOM">Custom Gateway</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    আইপি অ্যাড্রেস (IP Address)
                  </label>
                  <input
                    type="text"
                    placeholder="192.168.1.201"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">পোর্ট (Port)</label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  লোকেশন (Location)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Academic Building Gate 1"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ডিভাইস সিক্রেট / API Key (ঐচ্ছিক)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="এন্ড-টু-এন্ড এনক্রিপ্ট হয়ে সংরক্ষিত হবে"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white"
                  />
                  <Lock className="size-3.5 text-slate-400 absolute right-3 top-2.5" />
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                  <ShieldCheck className="size-3 text-emerald-600" />
                  সার্ভারে AES-256-GCM এনক্রিপশনে সুরক্ষিত থাকবে
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold shadow-sm disabled:opacity-50"
                >
                  {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                  ডিভাইস সংরক্ষণ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
