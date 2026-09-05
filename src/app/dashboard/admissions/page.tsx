'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  UserPlus,
  Search,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Phone,
  X,
} from 'lucide-react';
import { AdmissionStatus, ApplicationSource, Gender, AcademicShift, CurriculumVersion } from '@prisma/client';

interface AdmissionApplicationItem {
  id: string;
  applicationNumber: string;
  trackingCode: string;
  applicantNameEn: string;
  applicantNameBn: string;
  dateOfBirth: string;
  gender: Gender;
  fatherNameEn: string;
  fatherPhone: string;
  applicationSource: ApplicationSource;
  status: AdmissionStatus;
  createdAt: string;
  academicSession: { id: string; name: string };
  appliedClass: { id: string; nameEn: string; nameBn: string };
  appliedCampus?: { id: string; nameEn: string; nameBn: string } | null;
  convertedStudent?: { id: string; studentCode: string; fullNameBn: string } | null;
}

interface MetaPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface AcademicOption {
  id: string;
  name?: string;
  nameEn?: string;
  nameBn?: string;
}

export default function AdmissionsDashboardPage() {
  const [applications, setApplications] = useState<AdmissionApplicationItem[]>([]);
  const [meta, setMeta] = useState<MetaPagination>({ page: 1, pageSize: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sessionFilter, setSessionFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');

  // Dropdown options
  const [sessions, setSessions] = useState<AcademicOption[]>([]);
  const [classes, setClasses] = useState<AcademicOption[]>([]);

  // Manual Application Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [manualFormError, setManualFormError] = useState<string | null>(null);
  const [manualFormData, setManualFormData] = useState({
    academicSessionId: '',
    appliedClassId: '',
    applicantNameEn: '',
    applicantNameBn: '',
    dateOfBirth: '2016-01-01',
    gender: 'MALE',
    religion: 'ISLAM',
    fatherNameEn: '',
    fatherNameBn: '',
    fatherPhone: '',
    motherNameEn: '',
    motherNameBn: '',
    presentAddress: '',
    permanentAddress: '',
  });

  // Load dropdown references
  useEffect(() => {
    async function loadOptions() {
      try {
        const [sessRes, clsRes] = await Promise.all([
          fetch('/api/school/academic-sessions'),
          fetch('/api/school/classes'),
        ]);
        if (sessRes.ok) {
          const sData = await sessRes.json();
          if (sData.success) setSessions(sData.data || []);
        }
        if (clsRes.ok) {
          const cData = await clsRes.json();
          if (cData.success) setClasses(cData.data || []);
        }
      } catch (e) {
        console.error('Failed to load filter options:', e);
      }
    }
    loadOptions();
  }, []);

  // Fetch applications
  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', meta.page.toString());
      params.set('pageSize', meta.pageSize.toString());
      if (search) params.set('search', search);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (sessionFilter) params.set('academicSessionId', sessionFilter);
      if (classFilter) params.set('appliedClassId', classFilter);

      const res = await fetch(`/api/school/admissions?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'আবেদন তালিকা লোড করা যায়নি।');
      }

      setApplications(data.data || []);
      setMeta(data.pagination || { page: 1, pageSize: 15, total: 0, totalPages: 1 });
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'নেটওয়ার্ক ত্রুটি ঘটেছে।');
    } finally {
      setLoading(false);
    }
  }, [meta.page, meta.pageSize, search, statusFilter, sessionFilter, classFilter]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingManual(true);
    setManualFormError(null);

    try {
      const res = await fetch('/api/school/admissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...manualFormData,
          applicationSource: ApplicationSource.ADMIN_MANUAL,
          status: AdmissionStatus.SUBMITTED,
          curriculumVersion: CurriculumVersion.BANGLA_VERSION,
          appliedShift: AcademicShift.DAY,
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'আবেদন নিবন্ধন ব্যর্থ হয়েছে।');
      }

      setShowManualModal(false);
      setManualFormData({
        academicSessionId: '',
        appliedClassId: '',
        applicantNameEn: '',
        applicantNameBn: '',
        dateOfBirth: '2016-01-01',
        gender: 'MALE',
        religion: 'ISLAM',
        fatherNameEn: '',
        fatherNameBn: '',
        fatherPhone: '',
        motherNameEn: '',
        motherNameBn: '',
        presentAddress: '',
        permanentAddress: '',
      });
      fetchApplications();
    } catch (err: unknown) {
      const e = err as Error;
      setManualFormError(e.message);
    } finally {
      setSubmittingManual(false);
    }
  };

  const getStatusBadge = (status: AdmissionStatus) => {
    switch (status) {
      case AdmissionStatus.SUBMITTED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3.5 h-3.5" /> দাখিলকৃত (SUBMITTED)
          </span>
        );
      case AdmissionStatus.UNDER_REVIEW:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" /> পর্যালোচনাধীন (UNDER REVIEW)
          </span>
        );
      case AdmissionStatus.SHORTLISTED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> শর্টলিস্টেড (SHORTLISTED)
          </span>
        );
      case AdmissionStatus.APPROVED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> অনুমোদিত (APPROVED)
          </span>
        );
      case AdmissionStatus.ENROLLED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> ভর্তি সম্পন্ন (ENROLLED)
          </span>
        );
      case AdmissionStatus.REJECTED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" /> প্রত্যাখ্যাত (REJECTED)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200">
            {status}
          </span>
        );
    }
  };

  const statusTabs = [
    { label: 'সকল আবেদন', value: 'ALL' },
    { label: 'দাখিলকৃত', value: AdmissionStatus.SUBMITTED },
    { label: 'পর্যালোচনাধীন', value: AdmissionStatus.UNDER_REVIEW },
    { label: 'শর্টলিস্টেড', value: AdmissionStatus.SHORTLISTED },
    { label: 'অনুমোদিত', value: AdmissionStatus.APPROVED },
    { label: 'ভর্তি সম্পন্ন', value: AdmissionStatus.ENROLLED },
    { label: 'প্রত্যাখ্যাত', value: AdmissionStatus.REJECTED },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 font-bengali">ভর্তি আবেদন ব্যবস্থাপনা</h1>
              <p className="text-sm text-gray-500">Admission Applications & Candidate Conversion</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowManualModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition shadow-sm"
          >
            <Plus className="w-4 h-4" /> নতুন আবেদন নিবন্ধন
          </button>
        </div>
      </div>

      {/* State Machine Guard Banner */}
      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-sm flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold">নিরাপত্তা ও এনরোলমেন্ট বিধিমালা (Phase 4.4 Invariant)</p>
          <p className="text-xs text-blue-800 mt-0.5">
            অনলাইন বা ম্যানুয়াল কোনো ফরম দাখিলের সাথে সাথেই শিক্ষার্থী সরাসরি ডাটাবেজে সক্রিয় হবে না। 
            আবেদনটি পর্যালোচনার পর অনুমোদন পেলে তবেই ক্লাস, শাখা ও রোল বরাদ্দের মাধ্যমে শিক্ষার্থী ও এনরোলমেন্টে রূপান্তরিত হবে।
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-gray-200 text-sm font-medium">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatusFilter(tab.value);
              setMeta((prev) => ({ ...prev, page: 1 }));
            }}
            className={`px-3 py-2 rounded-lg whitespace-nowrap transition-colors ${
              statusFilter === tab.value
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="নাম, আবেদন নম্বর বা মোবাইল..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setMeta((prev) => ({ ...prev, page: 1 }));
            }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <select
            value={sessionFilter}
            onChange={(e) => {
              setSessionFilter(e.target.value);
              setMeta((prev) => ({ ...prev, page: 1 }));
            }}
            className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">সকল শিক্ষাবর্ষ</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              setMeta((prev) => ({ ...prev, page: 1 }));
            }}
            className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">সকল শ্রেণী</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameBn || c.nameEn}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-end">
          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('ALL');
              setSessionFilter('');
              setClassFilter('');
              setMeta((prev) => ({ ...prev, page: 1 }));
            }}
            className="text-xs text-gray-500 hover:text-indigo-600 font-medium underline"
          >
            ফিল্টার রিসেট করুন
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Applications Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-600 border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">আবেদন নম্বর ও ট্র্যাকিং</th>
                <th className="py-3 px-4">শিক্ষার্থীর নাম</th>
                <th className="py-3 px-4">শ্রেণী ও সেশন</th>
                <th className="py-3 px-4">অভিভাবক ও যোগাযোগ</th>
                <th className="py-3 px-4">আবেদনের মাধ্যম</th>
                <th className="py-3 px-4">স্ট্যাটাস</th>
                <th className="py-3 px-4 text-right">পদক্ষেপ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                    তথ্য লোড করা হচ্ছে...
                  </td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    কোনো আবেদন পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{app.applicationNumber}</div>
                      <div className="text-xs text-gray-500 font-mono tracking-wider">
                        TRK: {app.trackingCode}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{app.applicantNameBn}</div>
                      <div className="text-xs text-gray-500">{app.applicantNameEn}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-800">
                        {app.appliedClass?.nameBn || app.appliedClass?.nameEn}
                      </div>
                      <div className="text-xs text-gray-500">{app.academicSession?.name}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-gray-800">{app.fatherNameEn}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {app.fatherPhone}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                        {app.applicationSource === ApplicationSource.PUBLIC_ONLINE ? 'অনলাইন' : 'ম্যানুয়াল'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div>{getStatusBadge(app.status)}</div>
                      {app.convertedStudent && (
                        <div className="mt-1 text-xs text-purple-700 font-medium">
                          ID: {app.convertedStudent.studentCode}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/dashboard/admissions/${app.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-medium transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> পর্যালোচনা
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
          <div>
            মোট <span className="font-semibold">{meta.total}</span> টি আবেদনের মধ্যে{' '}
            <span className="font-semibold">
              {meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1}
            </span>{' '}
            থেকে{' '}
            <span className="font-semibold">
              {Math.min(meta.page * meta.pageSize, meta.total)}
            </span>{' '}
            দেখাচ্ছে
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={meta.page <= 1}
              onClick={() => setMeta((prev) => ({ ...prev, page: prev.page - 1 }))}
              className="p-1.5 border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>
              পৃষ্ঠা {meta.page} / {meta.totalPages || 1}
            </span>
            <button
              disabled={meta.page >= meta.totalPages}
              onClick={() => setMeta((prev) => ({ ...prev, page: prev.page + 1 }))}
              className="p-1.5 border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Manual Admission Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900">ম্যানুয়াল ভর্তি আবেদন গ্রহণ</h2>
                <p className="text-xs text-gray-500">অফিসিয়ালভাবে শিক্ষার্থীর আবেদন পত্র এন্ট্রি করুন</p>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {manualFormError && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                {manualFormError}
              </div>
            )}

            <form onSubmit={handleManualSubmit} className="mt-4 space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    শিক্ষাবর্ষ <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={manualFormData.academicSessionId}
                    onChange={(e) =>
                      setManualFormData({ ...manualFormData, academicSessionId: e.target.value })
                    }
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">শিক্ষাবর্ষ নির্বাচন করুন</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    আবেদনকৃত শ্রেণী <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={manualFormData.appliedClassId}
                    onChange={(e) =>
                      setManualFormData({ ...manualFormData, appliedClassId: e.target.value })
                    }
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">শ্রেণী নির্বাচন করুন</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameBn || c.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    শিক্ষার্থীর ইংরেজি নাম <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={manualFormData.applicantNameEn}
                    onChange={(e) =>
                      setManualFormData({ ...manualFormData, applicantNameEn: e.target.value })
                    }
                    placeholder="e.g. Shakib Al Hasan"
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    শিক্ষার্থীর বাংলা নাম <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={manualFormData.applicantNameBn}
                    onChange={(e) =>
                      setManualFormData({ ...manualFormData, applicantNameBn: e.target.value })
                    }
                    placeholder="যেমন: সাকিব আল হাসান"
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    জন্ম তারিখ <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="date"
                    value={manualFormData.dateOfBirth}
                    onChange={(e) =>
                      setManualFormData({ ...manualFormData, dateOfBirth: e.target.value })
                    }
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">লিঙ্গ</label>
                  <select
                    value={manualFormData.gender}
                    onChange={(e) =>
                      setManualFormData({ ...manualFormData, gender: e.target.value })
                    }
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="MALE">ছাত্র (MALE)</option>
                    <option value="FEMALE">ছাত্রী (FEMALE)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ধর্ম</label>
                  <select
                    value={manualFormData.religion}
                    onChange={(e) =>
                      setManualFormData({ ...manualFormData, religion: e.target.value })
                    }
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ISLAM">ইসলাম</option>
                    <option value="HINDUISM">হিন্দু</option>
                    <option value="BUDDHISM">বৌদ্ধ</option>
                    <option value="CHRISTIANITY">খ্রিষ্টান</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    পিতার ইংরেজি নাম <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={manualFormData.fatherNameEn}
                    onChange={(e) =>
                      setManualFormData({ ...manualFormData, fatherNameEn: e.target.value })
                    }
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    পিতার বাংলা নাম <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={manualFormData.fatherNameBn}
                    onChange={(e) =>
                      setManualFormData({ ...manualFormData, fatherNameBn: e.target.value })
                    }
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    পিতার মোবাইল <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={manualFormData.fatherPhone}
                    onChange={(e) =>
                      setManualFormData({ ...manualFormData, fatherPhone: e.target.value })
                    }
                    placeholder="01XXXXXXXXX"
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    মাতার ইংরেজি নাম <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={manualFormData.motherNameEn}
                    onChange={(e) =>
                      setManualFormData({ ...manualFormData, motherNameEn: e.target.value })
                    }
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    মাতার বাংলা নাম <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={manualFormData.motherNameBn}
                    onChange={(e) =>
                      setManualFormData({ ...manualFormData, motherNameBn: e.target.value })
                    }
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    বর্তমান ঠিকানা <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={manualFormData.presentAddress}
                    onChange={(e) =>
                      setManualFormData({ ...manualFormData, presentAddress: e.target.value })
                    }
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    স্থায়ী ঠিকানা <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={manualFormData.permanentAddress}
                    onChange={(e) =>
                      setManualFormData({ ...manualFormData, permanentAddress: e.target.value })
                    }
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-xs font-medium"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submittingManual}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
                >
                  {submittingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  সংরক্ষণ ও আবেদন জমা দিন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
