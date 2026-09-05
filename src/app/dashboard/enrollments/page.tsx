'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ClipboardCheck,
  Search,
  Plus,
  ArrowRightLeft,
  UserX,
  Eye,
  Loader2,
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  X,
} from 'lucide-react';

interface AcademicSession {
  id: string;
  name: string;
  isCurrent: boolean;
}

interface ClassItem {
  id: string;
  nameEn: string;
  nameBn: string;
}

interface SectionItem {
  id: string;
  nameEn: string;
  nameBn: string;
  classId: string;
}

interface CampusItem {
  id: string;
  nameEn: string;
  nameBn: string;
}

interface EnrollmentRecord {
  id: string;
  rollNo: number;
  curriculumVersion: string;
  enrollmentType: string;
  status: string;
  remarks: string | null;
  createdAt: string;
  student: {
    id: string;
    studentCode: string;
    fullNameEn: string;
    fullNameBn: string;
    phone: string | null;
  };
  academicSession: {
    id: string;
    name: string;
    isCurrent: boolean;
  };
  class: {
    id: string;
    nameEn: string;
    nameBn: string;
  };
  section: {
    id: string;
    nameEn: string;
    nameBn: string;
  };
  campus?: {
    id: string;
    nameEn: string;
    nameBn: string;
  } | null;
}

export default function EnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Metadata dropdowns
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [campuses, setCampuses] = useState<CampusItem[]>([]);

  // Modals
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [activeEnrollment, setActiveEnrollment] = useState<EnrollmentRecord | null>(null);

  // New Enrollment Form State
  const [enrollForm, setEnrollForm] = useState({
    studentId: '',
    academicSessionId: '',
    classId: '',
    sectionId: '',
    campusId: '',
    rollNo: '',
    enrollmentType: 'REGULAR',
    remarks: '',
  });

  // Transfer Form State
  const [transferForm, setTransferForm] = useState({
    type: 'SECTION' as 'SECTION' | 'CAMPUS',
    targetSectionId: '',
    targetRollNo: '',
    targetCampusId: '',
    reason: '',
  });

  // Withdraw Form State
  const [withdrawForm, setWithdrawForm] = useState({
    status: 'DROPPED' as 'DROPPED' | 'TRANSFERRED_OUT',
    reason: '',
  });

  const [actionLoading, setActionLoading] = useState(false);

  // Fetch Metadata Dropdowns
  useEffect(() => {
    async function fetchMetadata() {
      try {
        const [sessRes, clsRes, secRes, campRes] = await Promise.all([
          fetch('/api/school/academic-sessions'),
          fetch('/api/school/academic-structure?type=classes'),
          fetch('/api/school/academic-structure?type=sections'),
          fetch('/api/school/campuses'),
        ]);

        if (sessRes.ok) {
          const data = await sessRes.json();
          const sessList = data.data || [];
          setSessions(sessList);
          const current = sessList.find((s: AcademicSession) => s.isCurrent);
          if (current) setSelectedSession(current.id);
        }
        if (clsRes.ok) {
          const data = await clsRes.json();
          setClasses(data.data || []);
        }
        if (secRes.ok) {
          const data = await secRes.json();
          setSections(data.data || []);
        }
        if (campRes.ok) {
          const data = await campRes.json();
          setCampuses(data.data || []);
        }
      } catch (err) {
        console.error('Failed to load filter metadata:', err);
      }
    }
    fetchMetadata();
  }, []);

  // Fetch Enrollments
  const loadEnrollments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('pageSize', pageSize.toString());
      if (search.trim()) params.set('search', search.trim());
      if (selectedSession) params.set('academicSessionId', selectedSession);
      if (selectedClass) params.set('classId', selectedClass);
      if (selectedSection) params.set('sectionId', selectedSection);
      if (selectedStatus && selectedStatus !== 'ALL') params.set('status', selectedStatus);

      const res = await fetch(`/api/school/enrollments?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'এনরোলমেন্ট তালিকা লোড করা যায়নি।');
      }

      setEnrollments(data.data || []);
      setTotalCount(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'ত্রুটি ঘটেছে।';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, selectedSession, selectedClass, selectedSection, selectedStatus]);

  useEffect(() => {
    loadEnrollments();
  }, [loadEnrollments]);

  // Handle New Enrollment Submit
  async function handleCreateEnrollment(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/school/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: enrollForm.studentId,
          academicSessionId: enrollForm.academicSessionId || selectedSession,
          classId: enrollForm.classId,
          sectionId: enrollForm.sectionId,
          campusId: enrollForm.campusId || null,
          rollNo: parseInt(enrollForm.rollNo, 10),
          enrollmentType: enrollForm.enrollmentType,
          remarks: enrollForm.remarks || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'এনরোলমেন্ট তৈরি করতে ব্যর্থ হয়েছে।');
      }

      setSuccessMsg('নতুন এনরোলমেন্ট সফলভাবে তৈরি হয়েছে।');
      setIsEnrollModalOpen(false);
      setEnrollForm({
        studentId: '',
        academicSessionId: '',
        classId: '',
        sectionId: '',
        campusId: '',
        rollNo: '',
        enrollmentType: 'REGULAR',
        remarks: '',
      });
      loadEnrollments();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'ত্রুটি ঘটেছে।';
      setError(message);
    } finally {
      setActionLoading(false);
    }
  }

  // Handle Transfer Submit
  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!activeEnrollment) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/school/enrollments/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentId: activeEnrollment.id,
          type: transferForm.type,
          targetSectionId: transferForm.targetSectionId,
          targetRollNo: parseInt(transferForm.targetRollNo, 10),
          targetCampusId: transferForm.targetCampusId || null,
          reason: transferForm.reason || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'স্থানান্তর ব্যর্থ হয়েছে।');
      }

      setSuccessMsg('শিক্ষার্থী সফলভাবে স্থানান্তরিত হয়েছে।');
      setIsTransferModalOpen(false);
      loadEnrollments();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'ত্রুটি ঘটেছে।';
      setError(message);
    } finally {
      setActionLoading(false);
    }
  }

  // Handle Withdraw Submit
  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    if (!activeEnrollment) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/school/enrollments/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentId: activeEnrollment.id,
          status: withdrawForm.status,
          reason: withdrawForm.reason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'প্রত্যাহার ব্যর্থ হয়েছে।');
      }

      setSuccessMsg(data.message || 'স্ট্যাটাস সফলভাবে আপডেট হয়েছে।');
      setIsWithdrawModalOpen(false);
      loadEnrollments();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'ত্রুটি ঘটেছে।';
      setError(message);
    } finally {
      setActionLoading(false);
    }
  }

  // Helper translations
  const statusLabels: Record<string, { label: string; color: string }> = {
    ACTIVE: { label: 'সক্রিয় (Active)', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    PROMOTED: { label: 'উত্তীর্ণ (Promoted)', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    REPEATED: { label: 'পুনরাবৃত্তি (Repeated)', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    TRANSFERRED_OUT: { label: 'ছাড়পত্রপ্রাপ্ত (Transferred Out)', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    PASSED_OUT: { label: 'সমাপ্ত (Passed Out)', color: 'bg-teal-50 text-teal-700 border-teal-200' },
    DROPPED: { label: 'প্রত্যাহার / ড্রপড (Dropped)', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  };

  const typeLabels: Record<string, string> = {
    REGULAR: 'নিয়মিত (Regular)',
    PROMOTED: 'প্রমোটেড (Promoted)',
    NEW_ADMISSION: 'নতুন ভর্তি (New)',
    REPEATER: 'রিপিটার (Repeater)',
    LATERAL_ENTRY: 'পুনঃভর্তি / পার্শ্বীয় (Lateral)',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
              <ClipboardCheck className="size-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">এনরোলমেন্ট ও শিক্ষাগত প্লেসমেন্ট</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                শিক্ষার্থীদের শিক্ষাবর্ষভিত্তিক শ্রেণী, শাখা, রোল নম্বর ও স্থানান্তর পরিচালনা
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/enrollments/promotion"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-2xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
          >
            <GraduationCap className="size-4" />
            শ্রেণী প্রমোশন (Promotion)
          </Link>
          <button
            onClick={() => {
              setEnrollForm((prev) => ({
                ...prev,
                academicSessionId: selectedSession || sessions[0]?.id || '',
              }));
              setIsEnrollModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-colors"
          >
            <Plus className="size-4" />
            নতুন এনরোলমেন্ট
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-3">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
          <AlertCircle className="size-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="শিক্ষার্থী কোড বা নাম..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          {/* Academic Session */}
          <select
            value={selectedSession}
            onChange={(e) => {
              setSelectedSession(e.target.value);
              setPage(1);
            }}
            className="py-2 px-3 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden focus:border-emerald-500"
          >
            <option value="">সকল শিক্ষাবর্ষ</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.isCurrent ? '(বর্তমান)' : ''}
              </option>
            ))}
          </select>

          {/* Class */}
          <select
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value);
              setSelectedSection('');
              setPage(1);
            }}
            className="py-2 px-3 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden focus:border-emerald-500"
          >
            <option value="">সকল শ্রেণী</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameBn} ({c.nameEn})
              </option>
            ))}
          </select>

          {/* Section */}
          <select
            value={selectedSection}
            onChange={(e) => {
              setSelectedSection(e.target.value);
              setPage(1);
            }}
            className="py-2 px-3 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden focus:border-emerald-500"
            disabled={!selectedClass}
          >
            <option value="">সকল শাখা</option>
            {sections
              .filter((s) => !selectedClass || s.classId === selectedClass)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameBn} ({s.nameEn})
                </option>
              ))}
          </select>

          {/* Status */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="py-2 px-3 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden focus:border-emerald-500"
          >
            <option value="">সকল স্ট্যাটাস</option>
            <option value="ACTIVE">সক্রিয় (Active)</option>
            <option value="PROMOTED">উত্তীর্ণ (Promoted)</option>
            <option value="REPEATED">পুনরাবৃত্তি (Repeated)</option>
            <option value="TRANSFERRED_OUT">স্থানান্তরিত (Transferred Out)</option>
            <option value="DROPPED">ড্রপড / প্রত্যাহার (Dropped)</option>
          </select>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <div>
            মোট এনরোলমেন্ট: <span className="font-bold text-slate-900">{totalCount}</span> টি
          </div>
          {(search || selectedClass || selectedSection || selectedStatus) && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedClass('');
                setSelectedSection('');
                setSelectedStatus('');
                setPage(1);
              }}
              className="text-xs text-rose-600 hover:underline font-medium"
            >
              ফিল্টার রিসেট করুন
            </button>
          )}
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="size-7 animate-spin text-emerald-600" />
            <span className="text-xs">এনরোলমেন্ট ডাটা লোড হচ্ছে...</span>
          </div>
        ) : enrollments.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <ClipboardCheck className="size-10 mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">কোন এনরোলমেন্ট পাওয়া যায়নি।</p>
            <p className="text-xs">উপরে ফিল্টার পরিবর্তন করুন অথবা নতুন শিক্ষার্থী এনরোল করুন।</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600 uppercase">
                  <th className="py-3 px-4">রোল</th>
                  <th className="py-3 px-4">শিক্ষার্থী</th>
                  <th className="py-3 px-4">শিক্ষাবর্ষ</th>
                  <th className="py-3 px-4">শ্রেণী ও শাখা</th>
                  <th className="py-3 px-4">ক্যাম্পাস</th>
                  <th className="py-3 px-4">ধরণ</th>
                  <th className="py-3 px-4">স্ট্যাটাস</th>
                  <th className="py-3 px-4 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {enrollments.map((item) => {
                  const statusInfo = statusLabels[item.status] || {
                    label: item.status,
                    color: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        #{item.rollNo}
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          href={`/dashboard/students/${item.student.id}`}
                          className="group block"
                        >
                          <div className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                            {item.student.fullNameBn}
                          </div>
                          <div className="text-xs font-mono text-slate-400">
                            {item.student.studentCode} • {item.student.fullNameEn}
                          </div>
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-slate-800">
                        {item.academicSession.name}
                        {item.academicSession.isCurrent && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            বর্তমান
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="font-semibold text-slate-900">{item.class.nameBn}</div>
                        <div className="text-slate-500">শাখা: {item.section.nameBn}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {item.campus?.nameBn || 'মূল ক্যাম্পাস'}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <span className="text-slate-600">
                          {typeLabels[item.enrollmentType] || item.enrollmentType}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        {item.status === 'ACTIVE' && (
                          <>
                            <button
                              onClick={() => {
                                setActiveEnrollment(item);
                                setTransferForm({
                                  type: 'SECTION',
                                  targetSectionId: item.section.id,
                                  targetRollNo: item.rollNo.toString(),
                                  targetCampusId: item.campus?.id || '',
                                  reason: '',
                                });
                                setIsTransferModalOpen(true);
                              }}
                              title="শাখা বা ক্যাম্পাস স্থানান্তর"
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                            >
                              <ArrowRightLeft className="size-4" />
                            </button>
                            <button
                              onClick={() => {
                                setActiveEnrollment(item);
                                setWithdrawForm({
                                  status: 'DROPPED',
                                  reason: '',
                                });
                                setIsWithdrawModalOpen(true);
                              }}
                              title="প্রত্যাহার বা ছাড়পত্র"
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                            >
                              <UserX className="size-4" />
                            </button>
                          </>
                        )}
                        <Link
                          href={`/dashboard/students/${item.student.id}`}
                          title="শিক্ষার্থী প্রোফাইল"
                          className="p-1.5 inline-block text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                        >
                          <Eye className="size-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 text-xs">
            <span className="text-slate-500">
              পৃষ্ঠা {page} / {totalPages} (মোট {totalCount} টি রেকর্ড)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                পূর্ববর্তী
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                পরবর্তী
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: New Enrollment */}
      {isEnrollModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">নতুন শিক্ষার্থী এনরোলমেন্ট</h2>
              <button
                onClick={() => setIsEnrollModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEnrollment} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">শিক্ষার্থী আইডি (UUID) *</label>
                <input
                  type="text"
                  required
                  placeholder="শিক্ষার্থীর UUID লিখুন"
                  value={enrollForm.studentId}
                  onChange={(e) => setEnrollForm({ ...enrollForm, studentId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">শিক্ষাবর্ষ *</label>
                  <select
                    required
                    value={enrollForm.academicSessionId}
                    onChange={(e) =>
                      setEnrollForm({ ...enrollForm, academicSessionId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                  >
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ক্যাম্পাস</label>
                  <select
                    value={enrollForm.campusId}
                    onChange={(e) => setEnrollForm({ ...enrollForm, campusId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="">মূল ক্যাম্পাস</option>
                    {campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameBn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">শ্রেণী *</label>
                  <select
                    required
                    value={enrollForm.classId}
                    onChange={(e) =>
                      setEnrollForm({ ...enrollForm, classId: e.target.value, sectionId: '' })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="">শ্রেণী নির্বাচন করুন</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameBn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">শাখা *</label>
                  <select
                    required
                    value={enrollForm.sectionId}
                    onChange={(e) => setEnrollForm({ ...enrollForm, sectionId: e.target.value })}
                    disabled={!enrollForm.classId}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="">শাখা নির্বাচন করুন</option>
                    {sections
                      .filter((s) => s.classId === enrollForm.classId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nameBn}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">রোল নম্বর *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="যেমন: 1"
                    value={enrollForm.rollNo}
                    onChange={(e) => setEnrollForm({ ...enrollForm, rollNo: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">এনরোলমেন্টের ধরণ *</label>
                  <select
                    value={enrollForm.enrollmentType}
                    onChange={(e) =>
                      setEnrollForm({ ...enrollForm, enrollmentType: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="REGULAR">নিয়মিত (Regular)</option>
                    <option value="NEW_ADMISSION">নতুন ভর্তি (New Admission)</option>
                    <option value="LATERAL_ENTRY">পার্শ্বীয় / পুনঃভর্তি (Lateral Entry)</option>
                    <option value="REPEATER">পুনরাবৃত্তি (Repeater)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">মন্তব্য (ঐচ্ছিক)</label>
                <textarea
                  rows={2}
                  placeholder="এনরোলমেন্ট সম্পর্কিত তথ্য..."
                  value={enrollForm.remarks}
                  onChange={(e) => setEnrollForm({ ...enrollForm, remarks: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEnrollModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-semibold inline-flex items-center gap-2"
                >
                  {actionLoading && <Loader2 className="size-4 animate-spin" />}
                  এনরোল নিশ্চিত করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Transfer Student */}
      {isTransferModalOpen && activeEnrollment && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">শিক্ষার্থী শাখা/ক্যাম্পাস স্থানান্তর</h2>
                <p className="text-xs text-slate-500">
                  {activeEnrollment.student.fullNameBn} (রোল: {activeEnrollment.rollNo})
                </p>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleTransfer} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">স্থানান্তরের ধরণ *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTransferForm({ ...transferForm, type: 'SECTION' })}
                    className={`py-2 rounded-xl font-semibold border ${
                      transferForm.type === 'SECTION'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    শাখা স্থানান্তর
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransferForm({ ...transferForm, type: 'CAMPUS' })}
                    className={`py-2 rounded-xl font-semibold border ${
                      transferForm.type === 'CAMPUS'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    ক্যাম্পাস স্থানান্তর
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">লক্ষ্য শাখা *</label>
                <select
                  required
                  value={transferForm.targetSectionId}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, targetSectionId: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                >
                  <option value="">শাখা নির্বাচন করুন</option>
                  {sections
                    .filter((s) => s.classId === activeEnrollment.class.id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nameBn} ({s.nameEn})
                      </option>
                    ))}
                </select>
              </div>

              {transferForm.type === 'CAMPUS' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">লক্ষ্য ক্যাম্পাস</label>
                  <select
                    value={transferForm.targetCampusId}
                    onChange={(e) =>
                      setTransferForm({ ...transferForm, targetCampusId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="">মূল ক্যাম্পাস</option>
                    {campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameBn}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">নতুন রোল নম্বর *</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="যেমন: 5"
                  value={transferForm.targetRollNo}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, targetRollNo: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">স্থানান্তরের কারণ</label>
                <input
                  type="text"
                  placeholder="যেমন: অভিভাবকের আবেদনক্রমে"
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] leading-relaxed">
                স্থানান্তরের ফলে শিক্ষার্থীর পূর্ববর্তী হাজিরা ও পরীক্ষার নম্বর অক্ষুণ্ণ থাকবে এবং নতুন শাখায়
                নির্ধারিত রোল প্রযুক্ত হবে।
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 font-semibold inline-flex items-center gap-2"
                >
                  {actionLoading && <Loader2 className="size-4 animate-spin" />}
                  স্থানান্তর নিশ্চিত করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Withdraw / Transfer-Out */}
      {isWithdrawModalOpen && activeEnrollment && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">শিক্ষার্থী প্রত্যাহার বা ছাড়পত্র</h2>
                <p className="text-xs text-slate-500">
                  {activeEnrollment.student.fullNameBn} (রোল: {activeEnrollment.rollNo})
                </p>
              </div>
              <button
                onClick={() => setIsWithdrawModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleWithdraw} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">পদক্ষেপ নির্বাচন করুন *</label>
                <select
                  value={withdrawForm.status}
                  onChange={(e) =>
                    setWithdrawForm({
                      ...withdrawForm,
                      status: e.target.value as 'DROPPED' | 'TRANSFERRED_OUT',
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                >
                  <option value="DROPPED">শিক্ষার্থী প্রত্যাহার / ড্রপড (Dropped / Withdrawn)</option>
                  <option value="TRANSFERRED_OUT">অন্য প্রতিষ্ঠানে ছাড়পত্র (Transferred Out)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">কারণ উল্লেখ করুন *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="প্রত্যাহার বা ছাড়পত্রের সুনির্দিষ্ট কারণ লিখুন..."
                  value={withdrawForm.reason}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-[11px] leading-relaxed">
                এই পদক্ষেপে শিক্ষার্থীর কোনো পূর্ববর্তী তথ্য বা ফলাফল মুছে যাবে না। শিক্ষার্থীকে ভবিষ্যতে প্রয়োজন হলে পুনরায় ভর্তি (Readmission) করা যাবে।
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 font-semibold inline-flex items-center gap-2"
                >
                  {actionLoading && <Loader2 className="size-4 animate-spin" />}
                  নিশ্চিত করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
