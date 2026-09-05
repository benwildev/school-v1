'use client';

import React, { useEffect, useState } from 'react';
import {
  Wrench,
  Plus,
  Bus,
  AlertCircle,
} from 'lucide-react';
import { TransportNav } from '@/components/transport/TransportNav';

interface MaintenanceLog {
  id: string;
  maintenanceType: string;
  serviceDate: string;
  odometerReading: number | null;
  cost: number;
  vendorName: string | null;
  invoiceRef: string | null;
  nextServiceDate: string | null;
  notes: string | null;
  vehicle: {
    id: string;
    vehicleCode: string;
    registrationNumber: string;
    makeModel: string | null;
  };
  recordedBy: {
    name: string;
  };
}

interface Vehicle {
  id: string;
  vehicleCode: string;
  registrationNumber: string;
}

export default function VehicleMaintenancePage() {
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    vehicleId: '',
    maintenanceType: 'ইঞ্জিন অয়েল ও ফিল্টার পরিবর্তন',
    serviceDate: new Date().toISOString().split('T')[0],
    odometerReading: 45000,
    cost: 5500,
    vendorName: 'ঢাকা অটো ওয়ার্কশপ',
    invoiceRef: 'INV-2026-001',
    nextServiceDate: '',
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function loadData() {
    try {
      setLoading(true);
      const [logRes, vehRes] = await Promise.all([
        fetch('/api/school/transport/maintenance'),
        fetch('/api/school/transport/vehicles'),
      ]);

      const [logJson, vehJson] = await Promise.all([logRes.json(), vehRes.json()]);

      if (logJson.success) setLogs(logJson.data);
      if (vehJson.success) setVehicles(vehJson.data);
    } catch (err) {
      console.error('Failed to load maintenance records:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/school/transport/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          odometerReading: Number(formData.odometerReading) || null,
          cost: Number(formData.cost),
          nextServiceDate: formData.nextServiceDate || null,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setErrorMsg(json.error || 'Failed to record maintenance');
      } else {
        setIsModalOpen(false);
        loadData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  const totalCost = logs.reduce((acc, curr) => acc + Number(curr.cost || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wrench className="w-7 h-7 text-emerald-600" />
            যানবাহন সার্ভিসিং ও রক্ষণাবেক্ষণ
            <span className="text-sm font-normal text-gray-500">(Maintenance)</span>
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            বহরের নিয়মিত মেরামত, তেল পরিবর্তন, পার্টস প্রতিস্থাপন ও ব্যয় লগ সংরক্ষণ করুন।
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          নতুন সার্ভিসিং রেকর্ড
        </button>
      </div>

      <TransportNav />

      {/* Summary KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-semibold text-gray-500 uppercase">মোট সার্ভিসিং এন্ট্রি</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{logs.length} টি</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-semibold text-gray-500 uppercase">সর্বমোট মেরামত ব্যয়</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">৳ {totalCost.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-semibold text-gray-500 uppercase">সার্ভিসিংকৃত গাড়ি</div>
          <div className="text-2xl font-bold text-blue-700 mt-1">
            {new Set(logs.map((l) => l.vehicle.id)).size} টি
          </div>
        </div>
      </div>

      {/* Maintenance Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold">
              <tr>
                <th className="py-3 px-4">তারিখ (Date)</th>
                <th className="py-3 px-4">যানবাহন (Vehicle)</th>
                <th className="py-3 px-4">কাজের বিবরণ (Service Type)</th>
                <th className="py-3 px-4">ওডোমিটার (Odometer)</th>
                <th className="py-3 px-4">ব্যয় (Cost BDT ৳)</th>
                <th className="py-3 px-4">ওয়ার্কশপ / মেমো (Vendor)</th>
                <th className="py-3 px-4">পরবর্তী সার্ভিস (Next Service)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    লোড হচ্ছে...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    কোনো সার্ভিসিং রেকর্ড পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-xs font-medium text-gray-700">
                      {new Date(log.serviceDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                        <Bus className="w-3.5 h-3.5 text-emerald-600" />
                        {log.vehicle.vehicleCode}
                      </div>
                      <div className="text-xs text-gray-500">{log.vehicle.registrationNumber}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{log.maintenanceType}</div>
                      {log.notes && <div className="text-xs text-gray-500">{log.notes}</div>}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600">
                      {log.odometerReading ? `${log.odometerReading.toLocaleString()} কিমি` : '—'}
                    </td>
                    <td className="py-3 px-4 font-semibold text-emerald-700">
                      ৳ {Number(log.cost).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600">
                      <div>{log.vendorName || '—'}</div>
                      {log.invoiceRef && <div className="text-gray-400">মেমো: {log.invoiceRef}</div>}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600">
                      {log.nextServiceDate ? new Date(log.nextServiceDate).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Maintenance Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900">গাড়ির সার্ভিসিং রেকর্ড এন্ট্রি</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400">
                &times;
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 text-xs bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    যানবাহন নির্বাচন করুন *
                  </label>
                  <select
                    required
                    value={formData.vehicleId}
                    onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="">গাড়ি পছন্দ করুন</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vehicleCode} - {v.registrationNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    সার্ভিসিং তারিখ *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.serviceDate}
                    onChange={(e) => setFormData({ ...formData, serviceDate: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  কাজের বিবরণ (Maintenance Type) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.maintenanceType}
                  onChange={(e) => setFormData({ ...formData, maintenanceType: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    ব্যয় (Cost BDT ৳) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    ওডোমিটার রিডিং (কিমি)
                  </label>
                  <input
                    type="number"
                    value={formData.odometerReading}
                    onChange={(e) =>
                      setFormData({ ...formData, odometerReading: Number(e.target.value) })
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    ওয়ার্কশপ / ভেন্ডরের নাম
                  </label>
                  <input
                    type="text"
                    value={formData.vendorName}
                    onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    চালান / ইনভয়েস নং
                  </label>
                  <input
                    type="text"
                    value={formData.invoiceRef}
                    onChange={(e) => setFormData({ ...formData, invoiceRef: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  পরবর্তী সার্ভিসের সম্ভাব্য তারিখ
                </label>
                <input
                  type="date"
                  value={formData.nextServiceDate}
                  onChange={(e) => setFormData({ ...formData, nextServiceDate: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-gray-700"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? 'সংরক্ষণ হচ্ছে...' : 'লগ সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
