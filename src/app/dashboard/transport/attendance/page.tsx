'use client';

import React, { useEffect, useState } from 'react';
import {
  ClipboardList,
  Plus,
  MapPin,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { TransportNav } from '@/components/transport/TransportNav';

interface BoardingEvent {
  id: string;
  timestamp: string;
  boardingStatus: string;
  source: string;
  student: {
    id: string;
    studentId: string;
    firstNameEn: string;
    lastNameEn: string;
  };
  stop: {
    stopName: string;
    sequenceNumber: number;
  };
  trip: {
    id: string;
    tripDate: string;
    tripType: string;
    route: { routeCode: string; routeName: string };
    vehicle: { vehicleCode: string };
  };
  recordedBy: {
    name: string;
  };
}

interface TripOption {
  id: string;
  tripType: string;
  route: { id: string; routeCode: string; routeName: string };
  vehicle: { vehicleCode: string };
}

interface StudentAssignmentOption {
  id: string;
  student: {
    id: string;
    studentId: string;
    firstNameEn: string;
    lastNameEn: string;
  };
  enrollment: {
    id: string;
    class: { nameEn: string };
    section: { nameEn: string };
  };
  pickupStop: { id: string; stopName: string };
  dropoffStop: { id: string; stopName: string };
}

export default function TransportAttendancePage() {
  const [events, setEvents] = useState<BoardingEvent[]>([]);
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [passengers, setPassengers] = useState<StudentAssignmentOption[]>([]);
  const [formData, setFormData] = useState({
    studentId: '',
    enrollmentId: '',
    stopId: '',
    boardingStatus: 'BOARDED',
    source: 'MANUAL',
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function loadEvents() {
    try {
      setLoading(true);
      const url = new URL('/api/school/transport/events', window.location.origin);
      if (selectedDate) url.searchParams.set('date', selectedDate);

      const [evRes, tripRes] = await Promise.all([
        fetch(url.toString()),
        fetch('/api/school/transport/trips'),
      ]);

      const [evJson, tripJson] = await Promise.all([evRes.json(), tripRes.json()]);

      if (evJson.success) setEvents(evJson.data);
      if (tripJson.success) setTrips(tripJson.data);
    } catch (err) {
      console.error('Failed to load transport events:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, [selectedDate]);

  // When trip selected in modal, load assigned passengers
  async function handleTripChange(tripId: string) {
    setSelectedTripId(tripId);
    if (!tripId) return;

    try {
      const selected = trips.find((t) => t.id === tripId);
      if (!selected) return;

      const res = await fetch(
        `/api/school/transport/student-assignments?routeId=${selected.route.id}&status=ACTIVE`
      );
      const json = await res.json();
      if (json.success) {
        setPassengers(json.data);
      }
    } catch (err) {
      console.error('Failed to load route passengers:', err);
    }
  }

  function handlePassengerSelect(assignmentId: string) {
    const a = passengers.find((p) => p.id === assignmentId);
    if (!a) return;

    setFormData((prev) => ({
      ...prev,
      studentId: a.student.id,
      enrollmentId: a.enrollment.id,
      stopId: a.pickupStop.id,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/school/transport/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: selectedTripId,
          ...formData,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setErrorMsg(json.error || 'Failed to record event');
      } else {
        setIsModalOpen(false);
        setFormData({
          studentId: '',
          enrollmentId: '',
          stopId: '',
          boardingStatus: 'BOARDED',
          source: 'MANUAL',
          notes: '',
        });
        loadEvents();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-emerald-600" />
            পরিবহন বোর্ডিং উপস্থিতি
            <span className="text-sm font-normal text-gray-500">(Boarding Attendance)</span>
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            শিক্ষার্থী বাসে ওঠা (Boarded), নামা (Dropped-off) বা অনুপস্থিত থাকার পৃথক উপস্থিতি রেকর্ড।
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          উপস্থিতি এন্ট্রি করুন
        </button>
      </div>

      <TransportNav />

      {/* Date Filter Bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-semibold text-gray-700">তারিখ নির্বাচন করুন:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="text-xs text-gray-500 font-medium">
          মোট ইভেন্ট: <span className="text-gray-900 font-bold">{events.length}</span> টি
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold">
              <tr>
                <th className="py-3 px-4">সময় (Time)</th>
                <th className="py-3 px-4">শিক্ষার্থী (Student)</th>
                <th className="py-3 px-4">স্টপ (Stop Point)</th>
                <th className="py-3 px-4">ট্রিপ ও বাস (Trip & Bus)</th>
                <th className="py-3 px-4">উপস্থিতি স্ট্যাটাস (Status)</th>
                <th className="py-3 px-4">রেকর্ডকারী (Recorded By)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    লোড হচ্ছে...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    এই তারিখে কোনো বোর্ডিং উপস্থিতি পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                events.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-xs text-gray-600">
                      {new Date(e.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">
                        {e.student.firstNameEn} {e.student.lastNameEn}
                      </div>
                      <div className="text-xs text-gray-500">{e.student.studentId}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        {e.stop.stopName}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-gray-900 font-medium">
                        {e.trip.route.routeName} ({e.trip.vehicle.vehicleCode})
                      </div>
                      <div className="text-xs text-emerald-600 font-medium">{e.trip.tripType}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          e.boardingStatus === 'BOARDED' || e.boardingStatus === 'PICKED_UP'
                            ? 'bg-emerald-100 text-emerald-800'
                            : e.boardingStatus === 'DROPPED_OFF'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {e.boardingStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">
                      <div>{e.recordedBy?.name || 'সিস্টেম'}</div>
                      <div className="text-gray-400 text-3xs">{e.source}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Boarding Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900">বোর্ডিং উপস্থিতি এন্ট্রি</h2>
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
                  ট্রিপ নির্বাচন করুন *
                </label>
                <select
                  required
                  value={selectedTripId}
                  onChange={(e) => handleTripChange(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 bg-white"
                >
                  <option value="">ট্রিপ পছন্দ করুন</option>
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.route.routeName} - {t.vehicle.vehicleCode} ({t.tripType})
                    </option>
                  ))}
                </select>
              </div>

              {passengers.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    শিক্ষার্থী পছন্দ করুন (রুটের তালিকা থেকে) *
                  </label>
                  <select
                    required
                    onChange={(e) => handlePassengerSelect(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="">শিক্ষার্থী নির্বাচন করুন</option>
                    {passengers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.student.firstNameEn} {p.student.lastNameEn} ({p.student.studentId}) -{' '}
                        {p.pickupStop.stopName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    উপস্থিতি স্ট্যাটাস *
                  </label>
                  <select
                    value={formData.boardingStatus}
                    onChange={(e) => setFormData({ ...formData, boardingStatus: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="BOARDED">বাসে উঠেছে (BOARDED)</option>
                    <option value="PICKED_UP">পিকআপ সম্পন্ন (PICKED_UP)</option>
                    <option value="DROPPED_OFF">নামিয়ে দেওয়া হয়েছে (DROPPED_OFF)</option>
                    <option value="NOT_BOARDED">বাসে ওঠেনি (NOT_BOARDED)</option>
                    <option value="ABSENT">অনুপস্থিত (ABSENT)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    এন্ট্রি উৎস (Source)
                  </label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="MANUAL">ম্যানুয়াল (MANUAL)</option>
                    <option value="MOBILE">মোবাইল অ্যাপ (MOBILE)</option>
                    <option value="RFID">আরএফআইডি স্ক্যানার (RFID)</option>
                  </select>
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
                  {submitting ? 'সংরক্ষণ হচ্ছে...' : 'উপস্থিতি নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
