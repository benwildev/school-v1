'use client';

import React, { useEffect, useState } from 'react';
import {
  Users,
  Plus,
  Bus,
  Search,
  AlertCircle,
} from 'lucide-react';
import { TransportNav } from '@/components/transport/TransportNav';

interface StudentAssignment {
  id: string;
  student: {
    id: string;
    studentId: string;
    firstNameEn: string;
    lastNameEn: string;
    emergencyContactPhone: string | null;
  };
  enrollment: {
    id: string;
    rollNumber: string | null;
    class: { nameEn: string };
    section: { nameEn: string };
  };
  route: {
    id: string;
    routeCode: string;
    routeName: string;
  };
  pickupStop: {
    id: string;
    stopName: string;
    pickupTime: string | null;
  };
  dropoffStop: {
    id: string;
    stopName: string;
    dropoffTime: string | null;
  };
  vehicle: {
    id: string;
    vehicleCode: string;
    seatingCapacity: number;
  } | null;
  status: string;
  effectiveFrom: string;
}

interface EnrollmentOption {
  id: string;
  rollNumber: string | null;
  student: {
    id: string;
    studentId: string;
    firstNameEn: string;
    lastNameEn: string;
  };
  class: { nameEn: string };
  section: { nameEn: string };
}

interface RouteOption {
  id: string;
  routeCode: string;
  routeName: string;
  stops: {
    id: string;
    stopName: string;
    sequenceNumber: number;
    fareAmount: number;
  }[];
}

interface VehicleOption {
  id: string;
  vehicleCode: string;
  seatingCapacity: number;
  _count?: {
    studentAssignments: number;
  };
}

export default function StudentsTransportPage() {
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    enrollmentId: '',
    routeId: '',
    pickupStopId: '',
    dropoffStopId: '',
    vehicleId: '',
    effectiveFrom: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function loadData() {
    try {
      setLoading(true);
      const [assignRes, routeRes, vehRes, enrollRes] = await Promise.all([
        fetch('/api/school/transport/student-assignments'),
        fetch('/api/school/transport/routes?status=ACTIVE'),
        fetch('/api/school/transport/vehicles?status=ACTIVE'),
        fetch('/api/school/enrollments?status=ACTIVE&limit=100'),
      ]);

      const [assignJson, routeJson, vehJson, enrollJson] = await Promise.all([
        assignRes.json(),
        routeRes.json(),
        vehRes.json(),
        enrollRes.json(),
      ]);

      if (assignJson.success) setAssignments(assignJson.data);
      if (routeJson.success) setRoutes(routeJson.data);
      if (vehJson.success) setVehicles(vehJson.data);
      if (enrollJson.success) setEnrollments(enrollJson.data?.enrollments || enrollJson.data || []);
    } catch (err) {
      console.error('Failed to load transport assignments:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedRoute = routes.find((r) => r.id === formData.routeId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/school/transport/student-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          vehicleId: formData.vehicleId || null,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setErrorMsg(json.error || 'Failed to assign transport');
      } else {
        setIsModalOpen(false);
        setFormData({
          enrollmentId: '',
          routeId: '',
          pickupStopId: '',
          dropoffStopId: '',
          vehicleId: '',
          effectiveFrom: new Date().toISOString().split('T')[0],
          notes: '',
        });
        loadData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  const filteredAssignments = assignments.filter((a) => {
    const q = searchTerm.toLowerCase();
    return (
      a.student.firstNameEn.toLowerCase().includes(q) ||
      a.student.lastNameEn.toLowerCase().includes(q) ||
      a.student.studentId.toLowerCase().includes(q) ||
      a.route.routeName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-emerald-600" />
            শিক্ষার্থী পরিবহন সেবা বরাদ্দ
            <span className="text-sm font-normal text-gray-500">(Student Roster)</span>
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            শিক্ষাবর্ষভিত্তিক ভর্তির অধীনে শিক্ষার্থীদের রুট, স্টপ ও বাস সিট বরাদ্দ নিশ্চিত করুন।
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          পরিবহন সেবা বরাদ্দ দিন
        </button>
      </div>

      <TransportNav />

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="শিক্ষার্থীর নাম, আইডি বা রুট দিয়ে খুঁজুন..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Assignments Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold">
              <tr>
                <th className="py-3 px-4">শিক্ষার্থী (Student)</th>
                <th className="py-3 px-4">শ্রেণি ও রোল (Class & Roll)</th>
                <th className="py-3 px-4">রুট (Route)</th>
                <th className="py-3 px-4">পিকআপ ও ড্রপ স্টপ (Stops)</th>
                <th className="py-3 px-4">যানবাহন (Vehicle)</th>
                <th className="py-3 px-4">স্ট্যাটাস (Status)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    লোড হচ্ছে...
                  </td>
                </tr>
              ) : filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    কোনো শিক্ষার্থী পরিবহন বরাদ্দ পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">
                        {a.student.firstNameEn} {a.student.lastNameEn}
                      </div>
                      <div className="text-xs text-gray-500">{a.student.studentId}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-gray-900">
                        {a.enrollment?.class?.nameEn || '—'} - {a.enrollment?.section?.nameEn || '—'}
                      </div>
                      <div className="text-xs text-gray-500">
                        রোল: {a.enrollment?.rollNumber || '—'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{a.route.routeName}</div>
                      <div className="text-xs text-emerald-600 font-semibold">{a.route.routeCode}</div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="text-gray-900 font-medium">পিক: {a.pickupStop.stopName}</div>
                      <div className="text-gray-500">ড্রপ: {a.dropoffStop.stopName}</div>
                    </td>
                    <td className="py-3 px-4">
                      {a.vehicle ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                          <Bus className="w-3.5 h-3.5" />
                          {a.vehicle.vehicleCode}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">নির্ধারিত নেই</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          a.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Transport Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900">শিক্ষার্থী পরিবহন সেবা বরাদ্দ</h2>
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
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  শিক্ষার্থী নির্বাচন করুন (ভর্তি তালিকা থেকে) *
                </label>
                <select
                  required
                  value={formData.enrollmentId}
                  onChange={(e) => setFormData({ ...formData, enrollmentId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 bg-white"
                >
                  <option value="">ভর্তি রেকর্ড পছন্দ করুন</option>
                  {enrollments.map((en) => (
                    <option key={en.id} value={en.id}>
                      {en.student?.firstNameEn} {en.student?.lastNameEn} ({en.student?.studentId}) - {en.class?.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  রুট নির্বাচন করুন *
                </label>
                <select
                  required
                  value={formData.routeId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      routeId: e.target.value,
                      pickupStopId: '',
                      dropoffStopId: '',
                    })
                  }
                  className="w-full border rounded-lg px-3 py-2 bg-white"
                >
                  <option value="">রুট পছন্দ করুন</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.routeCode} - {r.routeName} ({r.stops?.length || 0}টি স্টপ)
                    </option>
                  ))}
                </select>
              </div>

              {selectedRoute && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      পিকআপ স্টপ (Pickup Point) *
                    </label>
                    <select
                      required
                      value={formData.pickupStopId}
                      onChange={(e) => setFormData({ ...formData, pickupStopId: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 bg-white"
                    >
                      <option value="">পিকআপ স্টপ</option>
                      {selectedRoute.stops.map((s) => (
                        <option key={s.id} value={s.id}>
                          #{s.sequenceNumber} {s.stopName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      ড্রপঅফ স্টপ (Dropoff Point) *
                    </label>
                    <select
                      required
                      value={formData.dropoffStopId}
                      onChange={(e) => setFormData({ ...formData, dropoffStopId: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 bg-white"
                    >
                      <option value="">ড্রপঅফ স্টপ</option>
                      {selectedRoute.stops.map((s) => (
                        <option key={s.id} value={s.id}>
                          #{s.sequenceNumber} {s.stopName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  যানবাহন / বাস বরাদ্দ (আসন ধারণক্ষমতা প্রযোজ্য)
                </label>
                <select
                  value={formData.vehicleId}
                  onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 bg-white"
                >
                  <option value="">ঐচ্ছিক: বাস নির্বাচন করুন</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicleCode} (ধারণক্ষমতা: {v.seatingCapacity} আসন)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  কার্যকর শুরুর তারিখ *
                </label>
                <input
                  type="date"
                  required
                  value={formData.effectiveFrom}
                  onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
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
                  {submitting ? 'বরাদ্দ হচ্ছে...' : 'বরাদ্দ নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
