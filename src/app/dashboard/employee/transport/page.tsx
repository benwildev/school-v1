'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bus,
  CheckCircle,
  Play,
  Users,
  Phone,
  ArrowLeft,
  Calendar,
} from 'lucide-react';

interface DriverAssignmentData {
  driverAssignments: {
    id: string;
    vehicle: {
      vehicleCode: string;
      registrationNumber: string;
      seatingCapacity: number;
    };
    route: {
      routeCode: string;
      routeName: string;
      stops: {
        id: string;
        stopName: string;
        sequenceNumber: number;
        pickupTime: string | null;
        dropoffTime: string | null;
      }[];
    } | null;
  }[];
  todayTrips: {
    id: string;
    tripType: string;
    status: string;
    scheduledStartTime: string | null;
    scheduledEndTime: string | null;
    actualStartTime: string | null;
    actualEndTime: string | null;
    route: { routeCode: string; routeName: string };
    vehicle: { vehicleCode: string };
    boardingEvents: any[];
  }[];
  assignedPassengers: {
    id: string;
    student: {
      id: string;
      studentId: string;
      firstNameEn: string;
      lastNameEn: string;
      emergencyContactPhone: string | null;
    };
    pickupStop: { stopName: string; pickupTime: string | null };
    dropoffStop: { stopName: string; dropoffTime: string | null };
  }[];
}

export default function EmployeeDriverTransportPage() {
  const [data, setData] = useState<DriverAssignmentData | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      setLoading(true);
      const res = await fetch('/api/employee/me/transport');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to load driver transport details:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleTripStatusChange(tripId: string, status: string) {
    try {
      const res = await fetch(`/api/school/transport/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || 'Status update failed');
      } else {
        loadData();
      }
    } catch (err) {
      console.error('Trip status update failed:', err);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/employee"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            কর্মী ড্যাশবোর্ডে ফিরে যান
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bus className="w-6 h-6 text-emerald-600" />
            আমার পরিবহন ও ড্রাইভার পোর্টাল
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            আপনার দায়িত্বপ্রাপ্ত যানবাহন, দৈনিক ট্রিপ তালিকা এবং শিক্ষার্থী যাত্রীদের তালিকা।
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
          পরিবহন দায়িত্ব লোড হচ্ছে...
        </div>
      ) : !data || data.driverAssignments.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-gray-200 space-y-2">
          <Bus className="w-12 h-12 text-gray-300 mx-auto" />
          <h2 className="font-semibold text-gray-800">কোনো সক্রিয় দায়িত্ব পাওয়া যায়নি</h2>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            বর্তমানে আপনার অ্যাকাউন্টে কোনো যানবাহন বা রুট পরিচালনার দায়িত্ব বরাদ্দ নেই।
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Assigned Bus Details */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Bus className="w-5 h-5 text-emerald-600" />
              দায়িত্বপ্রাপ্ত যানবাহন ও রুট
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.driverAssignments.map((da) => (
                <div key={da.id} className="p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900 text-base">
                      {da.vehicle.vehicleCode}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {da.vehicle.seatingCapacity} টি আসন
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    রেজিস্ট্রেশন: {da.vehicle.registrationNumber}
                  </div>
                  {da.route && (
                    <div className="pt-2 border-t border-gray-200 text-xs">
                      <div className="font-semibold text-gray-800">{da.route.routeName}</div>
                      <div className="text-emerald-700 font-mono font-medium">
                        কোড: {da.route.routeCode} ({da.route.stops?.length || 0}টি স্টপ)
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Today's Trips */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              আজকের নির্ধারিত ট্রিপ ({data.todayTrips.length}টি)
            </h2>

            {data.todayTrips.length === 0 ? (
              <div className="text-xs text-gray-400 py-4 text-center bg-gray-50 rounded-lg">
                আজকের জন্য কোনো ট্রিপ শিডিউল করা নেই।
              </div>
            ) : (
              <div className="space-y-3">
                {data.todayTrips.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 rounded-lg border border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-gray-900 text-sm">
                        {t.route.routeName} ({t.vehicle.vehicleCode})
                      </div>
                      <div className="text-gray-500 mt-0.5">
                        ধরন:{' '}
                        <span className="font-medium text-emerald-700">
                          {t.tripType === 'MORNING_PICKUP' ? 'সকাল (পিকআপ)' : 'বিকাল (ড্রপ)'}
                        </span>{' '}
                        &bull; সময়: {t.scheduledStartTime || '—'} - {t.scheduledEndTime || '—'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          t.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : t.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {t.status}
                      </span>

                      {t.status === 'PLANNED' && (
                        <button
                          onClick={() => handleTripStatusChange(t.id, 'IN_PROGRESS')}
                          className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-lg shadow-2xs"
                        >
                          <Play className="w-3 h-3" /> শুরু করুন
                        </button>
                      )}
                      {t.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => handleTripStatusChange(t.id, 'COMPLETED')}
                          className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-lg shadow-2xs"
                        >
                          <CheckCircle className="w-3 h-3" /> সমাপ্ত করুন
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Passenger Manifest */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              আমার বাসের শিক্ষার্থী যাত্রী তালিকা ({data.assignedPassengers.length} জন)
            </h2>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs text-left">
                <thead className="bg-gray-50 text-gray-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">শিক্ষার্থী (Student)</th>
                    <th className="py-2.5 px-3">পিকআপ স্টপ (Pickup)</th>
                    <th className="py-2.5 px-3">ড্রপ স্টপ (Dropoff)</th>
                    <th className="py-2.5 px-3">অভিভাবকের মোবাইল (Phone)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.assignedPassengers.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-semibold text-gray-900">
                        {p.student.firstNameEn} {p.student.lastNameEn}
                        <div className="text-3xs text-gray-400 font-normal">
                          {p.student.studentId}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-gray-700">
                        {p.pickupStop.stopName}
                        {p.pickupStop.pickupTime && (
                          <span className="text-gray-400 ml-1">({p.pickupStop.pickupTime})</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-gray-700">
                        {p.dropoffStop.stopName}
                        {p.dropoffStop.dropoffTime && (
                          <span className="text-gray-400 ml-1">({p.dropoffStop.dropoffTime})</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-700">
                        {p.student.emergencyContactPhone ? (
                          <a
                            href={`tel:${p.student.emergencyContactPhone}`}
                            className="flex items-center gap-1 hover:underline"
                          >
                            <Phone className="w-3 h-3" />
                            {p.student.emergencyContactPhone}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
