'use client';

import React, { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  Bus,
  Users,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { TransportNav } from '@/components/transport/TransportNav';

export default function TransportReportsPage() {
  const [activeTab, setActiveTab] = useState<'utilization' | 'manifest' | 'compliance'>('utilization');
  const [loading, setLoading] = useState(true);

  // Data states
  const [utilizationData, setUtilizationData] = useState<any[]>([]);
  const [manifestData, setManifestData] = useState<any[]>([]);
  const [complianceData, setComplianceData] = useState<any[]>([]);

  async function loadReport(type: string) {
    try {
      setLoading(true);
      if (type === 'utilization') {
        const res = await fetch('/api/school/transport/reports?type=capacity-utilization');
        const json = await res.json();
        if (json.success) setUtilizationData(json.data.utilization || []);
      } else if (type === 'manifest') {
        const res = await fetch('/api/school/transport/reports?type=passenger-manifest');
        const json = await res.json();
        if (json.success) setManifestData(json.data.manifest || []);
      } else if (type === 'compliance') {
        const res = await fetch('/api/school/transport/reports?type=expiry-alerts');
        const json = await res.json();
        if (json.success) setComplianceData(json.data.alerts || []);
      }
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport(activeTab);
  }, [activeTab]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7 text-emerald-600" />
            পরিবহন প্রতিবেদন ও বিশ্লেষণ
            <span className="text-sm font-normal text-gray-500">(Reports & Analytics)</span>
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            যানবাহনের ধারণক্ষমতা ব্যবহার, শিক্ষার্থী তালিকা (Manifest) ও নথিপত্র কমপ্লায়েন্স রিপোর্ট।
          </p>
        </div>
      </div>

      <TransportNav />

      {/* Sub-report selector tabs */}
      <div className="flex border-b border-gray-200 gap-4 text-sm font-medium">
        <button
          onClick={() => setActiveTab('utilization')}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 ${
            activeTab === 'utilization'
              ? 'border-emerald-600 text-emerald-700 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Bus className="w-4 h-4" />
          আসন ধারণক্ষমতা ব্যবহার (Capacity Utilization)
        </button>

        <button
          onClick={() => setActiveTab('manifest')}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 ${
            activeTab === 'manifest'
              ? 'border-emerald-600 text-emerald-700 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4" />
          শিক্ষার্থী যাত্রী তালিকা (Passenger Manifest)
        </button>

        <button
          onClick={() => setActiveTab('compliance')}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 ${
            activeTab === 'compliance'
              ? 'border-emerald-600 text-emerald-700 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          নথিপত্র নবায়ন ও মেয়াদ (Document Compliance)
        </button>
      </div>

      {/* Report 1: Utilization */}
      {activeTab === 'utilization' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h2 className="font-semibold text-gray-900 text-sm">গাড়িভিত্তিক সিট ধারণক্ষমতা ও বরাদ্দ অনুপাত</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 font-semibold">
                <tr>
                  <th className="py-3 px-4">যানবাহন কোড (Code)</th>
                  <th className="py-3 px-4">নিবন্ধন নম্বর (Registration)</th>
                  <th className="py-3 px-4">মোট আসন (Capacity)</th>
                  <th className="py-3 px-4">বরাদ্দ শিক্ষার্থী (Assigned)</th>
                  <th className="py-3 px-4">ব্যবহারের হার (Utilization %)</th>
                  <th className="py-3 px-4">অবশিষ্ট ফাঁকা আসন (Available)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      লোড হচ্ছে...
                    </td>
                  </tr>
                ) : utilizationData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      কোনো তথ্য নেই।
                    </td>
                  </tr>
                ) : (
                  utilizationData.map((u) => (
                    <tr key={u.vehicleId} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-semibold text-gray-900">{u.vehicleCode}</td>
                      <td className="py-3 px-4 text-gray-600">{u.registrationNumber}</td>
                      <td className="py-3 px-4 font-medium text-gray-900">{u.seatingCapacity} টি</td>
                      <td className="py-3 px-4 font-bold text-gray-900">{u.activeAssignedStudents} জন</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full ${
                                u.utilizationPercentage > 90
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, u.utilizationPercentage)}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-gray-700">
                            {u.utilizationPercentage}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-emerald-700">
                        {u.availableSeats} টি আসন বাকি
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report 2: Passenger Manifest */}
      {activeTab === 'manifest' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h2 className="font-semibold text-gray-900 text-sm">
              সকল পরিবহন গ্রহণকারী শিক্ষার্থীর তালিকা ({manifestData.length} জন)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 font-semibold">
                <tr>
                  <th className="py-3 px-4">শিক্ষার্থী (Student)</th>
                  <th className="py-3 px-4">শ্রেণি ও রোল (Class & Roll)</th>
                  <th className="py-3 px-4">রুট (Route)</th>
                  <th className="py-3 px-4">স্টপ ও সময় (Stop & Pickup)</th>
                  <th className="py-3 px-4">বাস (Bus)</th>
                  <th className="py-3 px-4">জরুরি যোগাযোগ (Guardian Phone)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      লোড হচ্ছে...
                    </td>
                  </tr>
                ) : manifestData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      কোনো শিক্ষার্থী তালিকা পাওয়া যায়নি।
                    </td>
                  </tr>
                ) : (
                  manifestData.map((m, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">
                          {m.student.firstNameEn} {m.student.lastNameEn}
                        </div>
                        <div className="text-xs text-gray-500">{m.student.studentId}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-700">
                        <div>{m.enrollment?.class?.nameEn || '—'}</div>
                        <div className="text-gray-400">রোল: {m.enrollment?.rollNumber || '—'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">{m.route.routeName}</div>
                        <div className="text-xs text-emerald-600 font-medium">{m.route.routeCode}</div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="font-medium text-gray-900">{m.pickupStop.stopName}</div>
                        <div className="text-gray-500">পিকআপ: {m.pickupStop.pickupTime || '—'}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {m.vehicle?.vehicleCode || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-gray-700">
                        {m.student.emergencyContactPhone || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report 3: Document Compliance */}
      {activeTab === 'compliance' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h2 className="font-semibold text-gray-900 text-sm">
              মেয়াদোত্তীর্ণ বা আসন্ন মেয়াদোত্তীর্ণ নথির সতর্কবার্তা
            </h2>
          </div>
          <div className="p-4 space-y-3">
            {loading ? (
              <div className="text-center py-6 text-gray-500">লোড হচ্ছে...</div>
            ) : complianceData.length === 0 ? (
              <div className="text-center py-8 text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200">
                <CheckCircle className="w-8 h-8 mx-auto mb-1 text-emerald-600" />
                সকল সক্রিয় যানবাহনের নথিপত্র সম্পূর্ণ আপ-টু-ডেট এবং বৈধ রয়েছে।
              </div>
            ) : (
              complianceData.map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-xl border border-amber-200 bg-amber-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-bold text-amber-900 flex items-center gap-2">
                      <Bus className="w-4 h-4 text-amber-600" />
                      {c.vehicleCode} ({c.registrationNumber})
                    </div>
                    <div className="text-xs text-amber-700 mt-1 space-y-0.5">
                      {c.documentCompliance.fitness.isExpired && (
                        <div className="font-semibold text-red-700">
                          &bull; ফিটনেস সনদের মেয়াদ ইতিমধ্যে উত্তীর্ণ হয়েছে!
                        </div>
                      )}
                      {c.documentCompliance.fitness.isExpiringSoon && (
                        <div>
                          &bull; ফিটনেস সনদের মেয়াদ আর {c.documentCompliance.fitness.daysRemaining} দিন পর শেষ হবে।
                        </div>
                      )}
                      {c.documentCompliance.insurance.isExpired && (
                        <div className="font-semibold text-red-700">
                          &bull; বীমার মেয়াদ উত্তীর্ণ হয়েছে!
                        </div>
                      )}
                      {c.documentCompliance.insurance.isExpiringSoon && (
                        <div>
                          &bull; বীমার মেয়াদ আর {c.documentCompliance.insurance.daysRemaining} দিন পর শেষ হবে।
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-200 text-amber-900 self-start sm:self-auto">
                    নবায়ন প্রয়োজন
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
