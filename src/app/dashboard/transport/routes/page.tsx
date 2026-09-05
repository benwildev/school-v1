'use client';

import React, { useEffect, useState } from 'react';
import {
  MapPin,
  Plus,
  ChevronDown,
  ChevronRight,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { TransportNav } from '@/components/transport/TransportNav';

interface RouteStop {
  id: string;
  stopName: string;
  address: string | null;
  sequenceNumber: number;
  pickupTime: string | null;
  dropoffTime: string | null;
  fareAmount: number;
  status: string;
}

interface TransportRoute {
  id: string;
  routeCode: string;
  routeName: string;
  description: string | null;
  status: string;
  stops: RouteStop[];
  _count: {
    studentAssignments: number;
    trips: number;
  };
}

export default function RoutesPage() {
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);

  // Route Modal
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [routeForm, setRouteForm] = useState({
    routeCode: '',
    routeName: '',
    description: '',
  });

  // Stop Modal
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [stopForm, setStopForm] = useState({
    stopName: '',
    address: '',
    sequenceNumber: 1,
    pickupTime: '07:30',
    dropoffTime: '14:30',
    fareAmount: 1500,
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function loadRoutes() {
    try {
      setLoading(true);
      const res = await fetch('/api/school/transport/routes');
      const data = await res.json();
      if (data.success) {
        setRoutes(data.data);
        if (data.data.length > 0 && !expandedRouteId) {
          setExpandedRouteId(data.data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching routes:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRoutes();
  }, []);

  async function handleCreateRoute(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/school/transport/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routeForm),
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMsg(data.error || 'Failed to create route');
      } else {
        setIsRouteModalOpen(false);
        setRouteForm({ routeCode: '', routeName: '', description: '' });
        loadRoutes();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Route creation failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateStop(e: React.FormEvent) {
    e.preventDefault();
    if (!activeRouteId) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/school/transport/routes/${activeRouteId}/stops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...stopForm,
          sequenceNumber: Number(stopForm.sequenceNumber),
          fareAmount: Number(stopForm.fareAmount),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMsg(data.error || 'Failed to add stop');
      } else {
        setIsStopModalOpen(false);
        setStopForm({
          stopName: '',
          address: '',
          sequenceNumber: 1,
          pickupTime: '07:30',
          dropoffTime: '14:30',
          fareAmount: 1500,
        });
        loadRoutes();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Stop creation failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="w-7 h-7 text-emerald-600" />
            রুট ও স্টপ ব্যবস্থাপনা
            <span className="text-sm font-normal text-gray-500">(Routes & Stops)</span>
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            বিদ্যালয়ের পরিবহন রুট এবং স্টপের ক্রম, পিকআপ/ড্রপ সময় এবং মাসিক ভাড়া নির্ধারণ করুন।
          </p>
        </div>

        <button
          onClick={() => setIsRouteModalOpen(true)}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          নতুন রুট তৈরি করুন
        </button>
      </div>

      <TransportNav />

      {/* Routes & Stops Accordion / Cards */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-10 text-gray-500 bg-white rounded-xl border border-gray-200">
            রুট তালিকা লোড হচ্ছে...
          </div>
        ) : routes.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-600 font-medium">কোনো রুট তৈরি করা হয়নি।</p>
            <p className="text-xs text-gray-400 mt-1">
              শিক্ষার্থী বরাদ্দের পূর্বে কমপক্ষে একটি সক্রিয় পরিবহন রুট যোগ করুন।
            </p>
          </div>
        ) : (
          routes.map((route) => {
            const isExpanded = expandedRouteId === route.id;

            return (
              <div
                key={route.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs"
              >
                <div
                  onClick={() => setExpandedRouteId(isExpanded ? null : route.id)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <button className="text-gray-400 hover:text-gray-600">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{route.routeName}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {route.routeCode}
                        </span>
                      </div>
                      {route.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{route.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-600 pl-8 sm:pl-0">
                    <div>
                      স্টপ:{' '}
                      <span className="font-semibold text-gray-900">
                        {route.stops?.length || 0}টি
                      </span>
                    </div>
                    <div>
                      বরাদ্দ শিক্ষার্থী:{' '}
                      <span className="font-semibold text-gray-900">
                        {route._count?.studentAssignments || 0} জন
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveRouteId(route.id);
                        setStopForm((prev) => ({
                          ...prev,
                          sequenceNumber: (route.stops?.length || 0) + 1,
                        }));
                        setIsStopModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      স্টপ যুক্ত করুন
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      রুটের স্টপসমূহ (Stops Sequence)
                    </h2>

                    {(!route.stops || route.stops.length === 0) ? (
                      <div className="text-xs text-gray-400 py-3 text-center bg-white rounded-lg border border-dashed">
                        এই রুটে এখনো কোনো স্টপ যোগ করা হয়নি।
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {route.stops.map((stop) => (
                          <div
                            key={stop.id}
                            className="bg-white p-3 rounded-lg border border-gray-200 shadow-2xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-500">
                                ক্রম #{stop.sequenceNumber}
                              </span>
                              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                ৳ {stop.fareAmount}
                              </span>
                            </div>
                            <div className="font-semibold text-sm text-gray-900">
                              {stop.stopName}
                            </div>
                            {stop.address && (
                              <div className="text-xs text-gray-500 truncate">{stop.address}</div>
                            )}
                            <div className="flex items-center gap-3 text-xs text-gray-500 pt-1 border-t border-gray-100">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-emerald-600" />
                                পিকআপ: {stop.pickupTime || '—'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600" />
                                ড্রপ: {stop.dropoffTime || '—'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create Route Modal */}
      {isRouteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900">নতুন পরিবহন রুট তৈরি</h2>
              <button onClick={() => setIsRouteModalOpen(false)} className="text-gray-400">
                &times;
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 text-xs bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateRoute} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  রুট কোড * (যেমন R-01, ROUTE-DHK)
                </label>
                <input
                  type="text"
                  required
                  value={routeForm.routeCode}
                  onChange={(e) =>
                    setRouteForm({ ...routeForm, routeCode: e.target.value.toUpperCase() })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  রুটের নাম * (যেমন মিরপুর ১০ ➔ স্কুল)
                </label>
                <input
                  type="text"
                  required
                  value={routeForm.routeName}
                  onChange={(e) => setRouteForm({ ...routeForm, routeName: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  বিবরণ / পথনির্দেশ
                </label>
                <textarea
                  rows={2}
                  value={routeForm.description}
                  onChange={(e) => setRouteForm({ ...routeForm, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsRouteModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-gray-700"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? 'তৈরি হচ্ছে...' : 'রুট তৈরি করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Stop Modal */}
      {isStopModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900">রুটে নতুন স্টপ যুক্ত করুন</h2>
              <button onClick={() => setIsStopModalOpen(false)} className="text-gray-400">
                &times;
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 text-xs bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateStop} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  স্টপের নাম * (যেমন কাজীপাড়া মেট্রো স্টেশন)
                </label>
                <input
                  type="text"
                  required
                  value={stopForm.stopName}
                  onChange={(e) => setStopForm({ ...stopForm, stopName: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    ক্রমিক নম্বর (Sequence) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={stopForm.sequenceNumber}
                    onChange={(e) =>
                      setStopForm({ ...stopForm, sequenceNumber: Number(e.target.value) })
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    মাসিক ভাড়া (BDT ৳) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={stopForm.fareAmount}
                    onChange={(e) =>
                      setStopForm({ ...stopForm, fareAmount: Number(e.target.value) })
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    পিকআপ সময় (Pickup Time)
                  </label>
                  <input
                    type="time"
                    value={stopForm.pickupTime}
                    onChange={(e) => setStopForm({ ...stopForm, pickupTime: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    ড্রপঅফ সময় (Dropoff Time)
                  </label>
                  <input
                    type="time"
                    value={stopForm.dropoffTime}
                    onChange={(e) => setStopForm({ ...stopForm, dropoffTime: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsStopModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-gray-700"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? 'যুক্ত হচ্ছে...' : 'স্টপ সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
