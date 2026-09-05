'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bus,
  MapPin,
  Clock,
  CheckCircle,
  Phone,
  ArrowLeft,
} from 'lucide-react';

interface StudentTransportData {
  hasTransport: boolean;
  message?: string;
  assignment?: {
    id: string;
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
    };
    pickupStop: {
      stopName: string;
      pickupTime: string | null;
    };
    dropoffStop: {
      stopName: string;
      dropoffTime: string | null;
    };
    vehicle: {
      vehicleCode: string;
      registrationNumber: string;
    } | null;
    boardingEvents: {
      id: string;
      timestamp: string;
      boardingStatus: string;
      stop: { stopName: string };
    }[];
  };
  driverInfo?: {
    driverName: string;
    driverPhone: string;
    conductorName: string | null;
    conductorPhone: string | null;
  } | null;
}

export default function StudentTransportPage() {
  const [data, setData] = useState<StudentTransportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTransport() {
      try {
        setLoading(true);
        const res = await fetch('/api/student/transport');
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error('Failed to load student transport info:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchTransport();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/student"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            শিক্ষার্থী ড্যাশবোর্ডে ফিরে যান
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bus className="w-6 h-6 text-emerald-600" />
            আমার পরিবহন ও বাস সেবা
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            আপনার নির্ধারিত স্কুল বাস, স্টপ সময়সূচী এবং চালকের যোগাযোগের নম্বর।
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
          পরিবহন তথ্য লোড হচ্ছে...
        </div>
      ) : !data?.hasTransport || !data.assignment ? (
        <div className="p-12 text-center bg-white rounded-xl border border-gray-200 space-y-2">
          <Bus className="w-12 h-12 text-gray-300 mx-auto" />
          <h2 className="font-semibold text-gray-800">কোনো পরিবহন সেবা বরাদ্দ নেই</h2>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            আপনার এই শিক্ষাবর্ষের জন্য কোনো স্কুল বাস সেবা নির্ধারণ করা হয়নি।
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Card: Assigned Bus & Route */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {data.assignment.route.routeCode}
                </span>
                <h2 className="text-lg font-bold text-gray-900 mt-1">
                  {data.assignment.route.routeName}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-3 py-1 bg-gray-100 rounded-lg text-gray-800 flex items-center gap-1.5">
                  <Bus className="w-4 h-4 text-emerald-600" />
                  বাস নং: {data.assignment.vehicle?.vehicleCode || 'অনির্ধারিত'}
                </span>
              </div>
            </div>

            {/* Stops Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  আমার পিকআপ স্টপ (সকাল)
                </div>
                <div className="font-bold text-base text-gray-900 mt-1">
                  {data.assignment.pickupStop.stopName}
                </div>
                <div className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  পিকআপ সময়: {data.assignment.pickupStop.pickupTime || '৭:৩০ AM'}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-100">
                <div className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  আমার ড্রপঅফ স্টপ (বিকাল)
                </div>
                <div className="font-bold text-base text-gray-900 mt-1">
                  {data.assignment.dropoffStop.stopName}
                </div>
                <div className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  ড্রপঅফ সময়: {data.assignment.dropoffStop.dropoffTime || '২:৩০ PM'}
                </div>
              </div>
            </div>

            {/* Driver Contact Info */}
            {data.driverInfo && (
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-semibold text-gray-800">
                    চালক (Driver): {data.driverInfo.driverName}
                  </div>
                  {data.driverInfo.conductorName && (
                    <div className="text-gray-500">
                      সহকারী (Conductor): {data.driverInfo.conductorName}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${data.driverInfo.driverPhone}`}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-700"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {data.driverInfo.driverPhone}
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Boarding History */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-3">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              আমার সাম্প্রতিক বোর্ডিং লগ
            </h3>

            {(!data.assignment.boardingEvents || data.assignment.boardingEvents.length === 0) ? (
              <div className="text-xs text-gray-400 py-6 text-center bg-gray-50 rounded-lg">
                এখনো কোনো বোর্ডিং রেকর্ড হয়নি।
              </div>
            ) : (
              <div className="divide-y divide-gray-100 text-xs">
                {data.assignment.boardingEvents.slice(0, 5).map((ev) => (
                  <div key={ev.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-gray-800">
                        {ev.boardingStatus === 'BOARDED' || ev.boardingStatus === 'PICKED_UP'
                          ? 'বাসে উঠেছে'
                          : ev.boardingStatus === 'DROPPED_OFF'
                          ? 'নামানো হয়েছে'
                          : ev.boardingStatus}
                      </span>
                      <span className="text-gray-400 text-3xs ml-2">({ev.stop.stopName})</span>
                    </div>
                    <span className="font-mono text-gray-500">
                      {new Date(ev.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
