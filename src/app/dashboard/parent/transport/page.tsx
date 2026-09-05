'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bus,
  MapPin,
  Clock,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';

interface ChildTransport {
  id: string;
  student: {
    id: string;
    studentCode: string;
    firstNameEn: string;
    lastNameEn: string;
    fullNameEn: string;
    fullNameBn: string | null;
  };
  route: {
    id: string;
    routeCode: string;
    routeName: string;
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
    id: string;
    vehicleCode: string;
    registrationNumber: string;
    status: string;
  } | null;
  boardingEvents: {
    id: string;
    timestamp: string;
    boardingStatus: string;
    stop: { stopName: string };
    trip: { tripType: string; tripDate: string; status: string };
  }[];
}

export default function ParentTransportPage() {
  const [data, setData] = useState<ChildTransport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTransport() {
      try {
        setLoading(true);
        const res = await fetch('/api/parent/transport');
        const json = await res.json();
        if (json.success) {
          setData(json.data || []);
        }
      } catch (err) {
        console.error('Failed to load parent transport info:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchTransport();
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/parent"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            অভিভাবক ড্যাশবোর্ডে ফিরে যান
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bus className="w-6 h-6 text-emerald-600" />
            সন্তানের পরিবহন সেবা ও ট্র্যাকিং
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            সন্তানের বাসের রুট, পিকআপ/ড্রপ পয়েন্ট এবং সাম্প্রতিক বোর্ডিং স্ট্যাটাস দেখুন।
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
          পরিবহন তথ্য লোড হচ্ছে...
        </div>
      ) : data.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-gray-200 space-y-2">
          <Bus className="w-12 h-12 text-gray-300 mx-auto" />
          <h2 className="font-semibold text-gray-800">কোনো সক্রিয় পরিবহন সেবা নেই</h2>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            আপনার সন্তানের জন্য এখনো কোনো স্কুল বাস বা পরিবহন রুট বরাদ্দ করা হয়নি। বিস্তারিত তথ্যের জন্য বিদ্যালয় কর্তৃপক্ষের সাথে যোগাযোগ করুন।
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {data.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs"
            >
              {/* Child & Vehicle Header */}
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg">
                    <Bus className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900">
                      {item.student.fullNameBn || item.student.fullNameEn || `${item.student.firstNameEn} ${item.student.lastNameEn}`}
                    </h2>
                    <div className="text-xs text-gray-500">আইডি: {item.student.studentCode}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white border border-gray-300 text-gray-800">
                    বাস কোড: {item.vehicle?.vehicleCode || 'অনির্ধারিত'}
                  </span>
                  {item.vehicle?.registrationNumber && (
                    <span className="text-xs text-gray-500">
                      ({item.vehicle.registrationNumber})
                    </span>
                  )}
                </div>
              </div>

              {/* Route & Stop Details */}
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase">বরাদ্দকৃত রুট</div>
                    <div className="text-base font-bold text-gray-900 mt-0.5">
                      {item.route.routeName}
                    </div>
                    <div className="text-xs text-emerald-600 font-semibold">{item.route.routeCode}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                      <div className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                        পিকআপ স্টপ
                      </div>
                      <div className="font-semibold text-sm text-gray-900 mt-1">
                        {item.pickupStop.stopName}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-600" />
                        সময়: {item.pickupStop.pickupTime || 'নির্ধারিত নয়'}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                      <div className="text-xs font-semibold text-blue-800 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        ড্রপঅফ স্টপ
                      </div>
                      <div className="font-semibold text-sm text-gray-900 mt-1">
                        {item.dropoffStop.stopName}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-blue-600" />
                        সময়: {item.dropoffStop.dropoffTime || 'নির্ধারিত নয়'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Boarding Attendance Timeline */}
                <div className="border-t md:border-t-0 md:border-l md:pl-6 pt-4 md:pt-0">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    সাম্প্রতিক বোর্ডিং ও উপস্থিতি লগ
                  </h3>

                  {(!item.boardingEvents || item.boardingEvents.length === 0) ? (
                    <div className="text-xs text-gray-400 py-6 text-center bg-gray-50 rounded-lg">
                      এখনো কোনো বোর্ডিং ইভেন্ট রেকর্ড হয়নি।
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {item.boardingEvents.slice(0, 4).map((ev) => (
                        <div
                          key={ev.id}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100 text-xs"
                        >
                          <div>
                            <div className="font-semibold text-gray-800">
                              {ev.boardingStatus === 'BOARDED' || ev.boardingStatus === 'PICKED_UP'
                                ? 'বাসে উঠেছে'
                                : ev.boardingStatus === 'DROPPED_OFF'
                                ? 'নামানো হয়েছে'
                                : ev.boardingStatus}
                            </div>
                            <div className="text-gray-500 text-3xs">
                              {ev.stop.stopName} &bull; {new Date(ev.timestamp).toLocaleDateString()}
                            </div>
                          </div>
                          <span className="font-mono text-gray-600">
                            {new Date(ev.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
