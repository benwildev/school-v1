'use client';

import React, { useEffect, useState } from 'react';
import {
  Bus,
  Plus,
  AlertCircle,
  Search,
} from 'lucide-react';
import { TransportNav } from '@/components/transport/TransportNav';

interface Vehicle {
  id: string;
  vehicleCode: string;
  registrationNumber: string;
  vehicleType: string;
  makeModel: string | null;
  year: number | null;
  seatingCapacity: number;
  status: string;
  insuranceExpiry: string | null;
  fitnessExpiry: string | null;
  registrationExpiry: string | null;
  _count: {
    studentAssignments: number;
    trips: number;
  };
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    vehicleCode: '',
    registrationNumber: '',
    vehicleType: 'BUS',
    makeModel: '',
    year: new Date().getFullYear(),
    seatingCapacity: 40,
    status: 'ACTIVE',
    insuranceExpiry: '',
    fitnessExpiry: '',
    registrationExpiry: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function loadVehicles() {
    try {
      setLoading(true);
      const url = new URL('/api/school/transport/vehicles', window.location.origin);
      if (statusFilter) url.searchParams.set('status', statusFilter);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setVehicles(data.data);
      }
    } catch (err) {
      console.error('Error fetching vehicles:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVehicles();
  }, [statusFilter]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/school/transport/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          year: Number(formData.year) || null,
          seatingCapacity: Number(formData.seatingCapacity),
          insuranceExpiry: formData.insuranceExpiry || null,
          fitnessExpiry: formData.fitnessExpiry || null,
          registrationExpiry: formData.registrationExpiry || null,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setErrorMsg(json.error || 'Failed to create vehicle');
      } else {
        setIsModalOpen(false);
        setFormData({
          vehicleCode: '',
          registrationNumber: '',
          vehicleType: 'BUS',
          makeModel: '',
          year: new Date().getFullYear(),
          seatingCapacity: 40,
          status: 'ACTIVE',
          insuranceExpiry: '',
          fitnessExpiry: '',
          registrationExpiry: '',
          notes: '',
        });
        loadVehicles();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  const filteredVehicles = vehicles.filter((v) => {
    const q = searchTerm.toLowerCase();
    return (
      v.vehicleCode.toLowerCase().includes(q) ||
      v.registrationNumber.toLowerCase().includes(q) ||
      (v.makeModel && v.makeModel.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bus className="w-7 h-7 text-emerald-600" />
            যানবাহন বহর ব্যবস্থাপনা
            <span className="text-sm font-normal text-gray-500">(Fleet & Vehicles)</span>
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            বিদ্যালয়ের সকল বাস, মিনিবাস ও ভ্যানের তালিকা, আসন ধারণক্ষমতা এবং ফিটনেস ট্র্যাক করুন।
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          নতুন গাড়ি নিবন্ধন
        </button>
      </div>

      <TransportNav />

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="গাড়ির কোড বা রেজিস্ট্রেশন নম্বর খুঁজুন..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">সকল স্ট্যাটাস (All Status)</option>
            <option value="ACTIVE">সক্রিয় (ACTIVE)</option>
            <option value="IN_SERVICE">চলমান (IN_SERVICE)</option>
            <option value="MAINTENANCE">মেরামতধীন (MAINTENANCE)</option>
            <option value="OUT_OF_SERVICE">স্থগিত (OUT_OF_SERVICE)</option>
            <option value="RETIRED">অবসরপ্রাপ্ত (RETIRED)</option>
          </select>
        </div>
      </div>

      {/* Vehicle Grid / Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold">
              <tr>
                <th className="py-3 px-4">কোড ও নিবন্ধন (Code & Reg)</th>
                <th className="py-3 px-4">ধরন ও মডেল (Type & Model)</th>
                <th className="py-3 px-4">ধারণক্ষমতা (Capacity)</th>
                <th className="py-3 px-4">বরাদ্দ শিক্ষার্থী (Assigned)</th>
                <th className="py-3 px-4">স্ট্যাটাস (Status)</th>
                <th className="py-3 px-4">নথির মেয়াদ (Document Expiry)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    লোড হচ্ছে...
                  </td>
                </tr>
              ) : filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    কোনো যানবাহন পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                filteredVehicles.map((v) => {
                  const assigned = v._count?.studentAssignments || 0;
                  const capacity = v.seatingCapacity;
                  const isFull = assigned >= capacity;

                  return (
                    <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">{v.vehicleCode}</div>
                        <div className="text-xs text-gray-500">{v.registrationNumber}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-gray-900">{v.vehicleType}</div>
                        <div className="text-xs text-gray-500">{v.makeModel || '—'} {v.year ? `(${v.year})` : ''}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          {capacity} টি আসন
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${isFull ? 'text-amber-600' : 'text-gray-900'}`}>
                            {assigned} / {capacity}
                          </span>
                          {isFull && (
                            <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                              পূর্ণ
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            v.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : v.status === 'MAINTENANCE'
                              ? 'bg-amber-100 text-amber-800'
                              : v.status === 'RETIRED'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {v.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500 space-y-0.5">
                        <div>
                          ফিটনেস:{' '}
                          <span className={v.fitnessExpiry ? 'text-gray-700 font-medium' : 'text-gray-400'}>
                            {v.fitnessExpiry ? new Date(v.fitnessExpiry).toLocaleDateString() : 'উপাধ্য নয়'}
                          </span>
                        </div>
                        <div>
                          বীমা:{' '}
                          <span className={v.insuranceExpiry ? 'text-gray-700 font-medium' : 'text-gray-400'}>
                            {v.insuranceExpiry ? new Date(v.insuranceExpiry).toLocaleDateString() : 'উপাধ্য নয়'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Vehicle Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Bus className="w-5 h-5 text-emerald-600" />
                নতুন যানবাহন নিবন্ধন করুন
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 text-xs bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    যানবাহনের কোড * (যেমন BUS-01)
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.vehicleCode}
                    onChange={(e) => setFormData({ ...formData, vehicleCode: e.target.value.toUpperCase() })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    রেজিস্ট্রেশন নম্বর * (ঢাকা মেট্রো-...)
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.registrationNumber}
                    onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    যানবাহনের ধরন
                  </label>
                  <select
                    value={formData.vehicleType}
                    onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="BUS">বাস (BUS)</option>
                    <option value="MINIBUS">মিনিবাস (MINIBUS)</option>
                    <option value="MICROBUS">মাইক্রোবাস (MICROBUS)</option>
                    <option value="VAN">ভ্যান (VAN)</option>
                    <option value="OTHER">অন্যান্য (OTHER)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    আসন সংখ্যা (Seating Capacity) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    required
                    value={formData.seatingCapacity}
                    onChange={(e) => setFormData({ ...formData, seatingCapacity: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    মেক / মডেল (Make & Model)
                  </label>
                  <input
                    type="text"
                    placeholder="যেমনঃ Hino / Toyota"
                    value={formData.makeModel}
                    onChange={(e) => setFormData({ ...formData, makeModel: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    তৈরির বছর (Year)
                  </label>
                  <input
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    ফিটনেস সনদের মেয়াদ
                  </label>
                  <input
                    type="date"
                    value={formData.fitnessExpiry}
                    onChange={(e) => setFormData({ ...formData, fitnessExpiry: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    বীমার মেয়াদ (Insurance Expiry)
                  </label>
                  <input
                    type="date"
                    value={formData.insuranceExpiry}
                    onChange={(e) => setFormData({ ...formData, insuranceExpiry: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-100"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
