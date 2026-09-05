'use client';

import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Plus,
  Bus,
  CheckCircle,
  Play,
  XCircle,
  AlertCircle,
  User,
} from 'lucide-react';
import { TransportNav } from '@/components/transport/TransportNav';

interface Trip {
  id: string;
  tripDate: string;
  tripType: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  actualStartTime: string | null;
  actualEndTime: string | null;
  route: {
    id: string;
    routeCode: string;
    routeName: string;
  };
  vehicle: {
    id: string;
    vehicleCode: string;
    registrationNumber: string;
  };
  driver: {
    id: string;
    fullNameEn: string;
    phone: string;
  };
  conductor: {
    id: string;
    fullNameEn: string;
  } | null;
  _count: {
    boardingEvents: number;
  };
}

interface Vehicle {
  id: string;
  vehicleCode: string;
}

interface Route {
  id: string;
  routeCode: string;
  routeName: string;
}

interface Employee {
  id: string;
  fullNameEn: string;
  employeeCode: string;
}

export default function DailyTripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    routeId: '',
    vehicleId: '',
    driverEmployeeId: '',
    conductorEmployeeId: '',
    tripDate: new Date().toISOString().split('T')[0],
    tripType: 'MORNING_PICKUP',
    scheduledStartTime: '07:00',
    scheduledEndTime: '08:30',
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function loadData() {
    try {
      setLoading(true);
      const url = new URL('/api/school/transport/trips', window.location.origin);
      if (selectedDate) url.searchParams.set('tripDate', selectedDate);

      const [tripRes, vehRes, routeRes, empRes] = await Promise.all([
        fetch(url.toString()),
        fetch('/api/school/transport/vehicles?status=ACTIVE'),
        fetch('/api/school/transport/routes?status=ACTIVE'),
        fetch('/api/school/employees?status=ACTIVE'),
      ]);

      const [tripJson, vehJson, routeJson, empJson] = await Promise.all([
        tripRes.json(),
        vehRes.json(),
        routeRes.json(),
        empRes.json(),
      ]);

      if (tripJson.success) setTrips(tripJson.data);
      if (vehJson.success) setVehicles(vehJson.data);
      if (routeJson.success) setRoutes(routeJson.data);
      if (empJson.success) setEmployees(empJson.data);
    } catch (err) {
      console.error('Failed to load trips:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  async function handleStatusTransition(tripId: string, nextStatus: string) {
    try {
      const res = await fetch(`/api/school/transport/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || 'Status change failed');
      } else {
        loadData();
      }
    } catch (err) {
      console.error('Failed to update trip status:', err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/school/transport/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          conductorEmployeeId: formData.conductorEmployeeId || null,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setErrorMsg(json.error || 'Failed to dispatch trip');
      } else {
        setIsModalOpen(false);
        loadData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Dispatch failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-emerald-600" />
            দৈনিক ট্রিপ ও যাত্রা পর্যবেক্ষণ
            <span className="text-sm font-normal text-gray-500">(Daily Trips)</span>
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            সকাল ও বিকালের নির্ধারিত ট্রিপ শিডিউল, রিয়েল-টাইম শুরু/সমাপ্তি ট্র্যাকিং এবং উপস্থিতি রেকর্ড।
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          নতুন ট্রিপ নির্ধারণ
        </button>
      </div>

      <TransportNav />

      {/* Date Filter Bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-semibold text-gray-700">তারিখ নির্বাচন করুন:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="text-xs text-gray-500 font-medium">
          মোট ট্রিপ: <span className="text-gray-900 font-bold">{trips.length}</span> টি
        </div>
      </div>

      {/* Trips Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold">
              <tr>
                <th className="py-3 px-4">ট্রিপ ও রুট (Trip & Route)</th>
                <th className="py-3 px-4">যানবাহন ও চালক (Bus & Driver)</th>
                <th className="py-3 px-4">সময়সূচী (Schedule)</th>
                <th className="py-3 px-4">বোর্ডিং সংখ্যা (Boarded)</th>
                <th className="py-3 px-4">স্ট্যাটাস (Status)</th>
                <th className="py-3 px-4 text-right">কার্যক্রম (Action)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    লোড হচ্ছে...
                  </td>
                </tr>
              ) : trips.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    এই তারিখে কোনো ট্রিপ পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                trips.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{t.route.routeName}</div>
                      <div className="text-xs text-emerald-600 font-medium">
                        {t.tripType === 'MORNING_PICKUP'
                          ? 'সকাল (পিকআপ)'
                          : t.tripType === 'AFTERNOON_DROPOFF'
                          ? 'বিকাল (ড্রপ)'
                          : 'বিশেষ ট্রিপ'}{' '}
                        ({t.route.routeCode})
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900 flex items-center gap-1.5">
                        <Bus className="w-3.5 h-3.5 text-gray-400" />
                        {t.vehicle.vehicleCode}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <User className="w-3 h-3 text-gray-400" />
                        {t.driver.fullNameEn}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600">
                      <div>
                        নির্ধারিত: {t.scheduledStartTime || '—'} - {t.scheduledEndTime || '—'}
                      </div>
                      {(t.actualStartTime || t.actualEndTime) && (
                        <div className="text-emerald-700 font-medium">
                          বাস্তব: {t.actualStartTime || '—'} - {t.actualEndTime || '—'}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800">
                        {t._count.boardingEvents} জন
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          t.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : t.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-800'
                            : t.status === 'CANCELLED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      {t.status === 'PLANNED' && (
                        <button
                          onClick={() => handleStatusTransition(t.id, 'IN_PROGRESS')}
                          className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded hover:bg-blue-100 font-semibold"
                        >
                          <Play className="w-3 h-3" /> যাত্রা শুরু
                        </button>
                      )}
                      {t.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => handleStatusTransition(t.id, 'COMPLETED')}
                          className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded hover:bg-emerald-100 font-semibold"
                        >
                          <CheckCircle className="w-3 h-3" /> সমাপ্ত
                        </button>
                      )}
                      {(t.status === 'PLANNED' || t.status === 'IN_PROGRESS') && (
                        <button
                          onClick={() => handleStatusTransition(t.id, 'CANCELLED')}
                          className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded hover:bg-red-100 font-semibold"
                        >
                          <XCircle className="w-3 h-3" /> বাতিল
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Trip Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900">নতুন দৈনিক ট্রিপ শিডিউল</h2>
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
                    তারিখ *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.tripDate}
                    onChange={(e) => setFormData({ ...formData, tripDate: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    ট্রিপের ধরন *
                  </label>
                  <select
                    value={formData.tripType}
                    onChange={(e) => setFormData({ ...formData, tripType: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="MORNING_PICKUP">সকাল (পিকআপ)</option>
                    <option value="AFTERNOON_DROPOFF">বিকাল (ড্রপ)</option>
                    <option value="SPECIAL_TRIP">বিশেষ ট্রিপ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  রুট নির্বাচন করুন *
                </label>
                <select
                  required
                  value={formData.routeId}
                  onChange={(e) => setFormData({ ...formData, routeId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 bg-white"
                >
                  <option value="">রুট পছন্দ করুন</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.routeCode} - {r.routeName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    যানবাহন *
                  </label>
                  <select
                    required
                    value={formData.vehicleId}
                    onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="">গাড়ি নির্বাচন করুন</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vehicleCode}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    চালক (Driver) *
                  </label>
                  <select
                    required
                    value={formData.driverEmployeeId}
                    onChange={(e) => setFormData({ ...formData, driverEmployeeId: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="">চালক নির্বাচন করুন</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullNameEn} ({emp.employeeCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    নির্ধারিত শুরু
                  </label>
                  <input
                    type="time"
                    value={formData.scheduledStartTime}
                    onChange={(e) => setFormData({ ...formData, scheduledStartTime: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    নির্ধারিত শেষ
                  </label>
                  <input
                    type="time"
                    value={formData.scheduledEndTime}
                    onChange={(e) => setFormData({ ...formData, scheduledEndTime: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
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
                  {submitting ? 'নির্ধারণ হচ্ছে...' : 'ট্রিপ সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
