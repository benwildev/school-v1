'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Phone,
  Briefcase,
  MapPin,
  GraduationCap,
  ShieldAlert,
  ShieldCheck,
  CreditCard,
  UserCheck,
} from 'lucide-react';
import { GuardianRelation } from '@prisma/client';

interface LinkedStudent {
  id: string; // relationshipId
  isPrimary: boolean;
  isFinancialPayer: boolean;
  canPickUp: boolean;
  createdAt: string;
  student: {
    id: string;
    studentCode: string;
    fullNameEn: string;
    fullNameBn: string;
    gender: string;
    status: string;
    phone: string | null;
  };
}

interface GuardianDetail {
  id: string;
  schoolId: string;
  fullNameEn: string;
  fullNameBn: string;
  relationType: GuardianRelation;
  nationalId: string | null;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  occupation: string | null;
  monthlyIncome: number | string | null;
  educationLevel: string | null;
  address: string | null;
  createdAt: string;
  students: LinkedStudent[];
}

interface SchoolStudentOption {
  id: string;
  studentCode: string;
  fullNameEn: string;
  fullNameBn: string;
}

const RELATION_LABELS_BN: Record<GuardianRelation, string> = {
  FATHER: 'বাবা / পিতা',
  MOTHER: 'মা / মাতা',
  PATERNAL_UNCLE: 'চাচা',
  MATERNAL_UNCLE: 'মামা',
  BROTHER: 'ভাই',
  SISTER: 'বোন',
  GRANDFATHER: 'দাদা / নানা',
  GRANDMOTHER: 'দাদি / নানি',
  LEGAL_GUARDIAN: 'আইনগত অভিভাবক',
};

export default function GuardianDetailPage() {
  const params = useParams();
  const router = useRouter();
  const guardianId = params.guardianId as string;

  const [guardian, setGuardian] = useState<GuardianDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Link Student Modal State
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [studentOptions, setStudentOptions] = useState<SchoolStudentOption[]>([]);
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [linkIsPrimary, setLinkIsPrimary] = useState(false);
  const [linkIsFinancialPayer, setLinkIsFinancialPayer] = useState(false);
  const [linkCanPickUp, setLinkCanPickUp] = useState(true);
  const [isLinking, setIsLinking] = useState(false);

  // Edit Relationship Modal State
  const [editingRelationship, setEditingRelationship] = useState<LinkedStudent | null>(null);
  const [editIsPrimary, setEditIsPrimary] = useState(false);
  const [editIsFinancialPayer, setEditIsFinancialPayer] = useState(false);
  const [editCanPickUp, setEditCanPickUp] = useState(true);
  const [isUpdatingRel, setIsUpdatingRel] = useState(false);

  const loadGuardianDetail = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const res = await fetch(`/api/school/guardians/${guardianId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'অভিভাবকের তথ্য লোড করতে ব্যর্থ হয়েছে।');
      }

      setGuardian(data.data);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [guardianId]);

  useEffect(() => {
    if (guardianId) {
      loadGuardianDetail();
    }
  }, [guardianId, loadGuardianDetail]);

  // Search available students within active school for linking
  const searchStudents = async (query: string) => {
    try {
      setIsSearchingStudents(true);
      const res = await fetch(`/api/school/students?pageSize=20&search=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (res.ok && data.data) {
        setStudentOptions(data.data);
      }
    } catch (err) {
      console.error('Failed to search students:', err);
    } finally {
      setIsSearchingStudents(false);
    }
  };

  const handleOpenLinkModal = () => {
    setSelectedStudentId('');
    setStudentSearchQuery('');
    setLinkIsPrimary(false);
    setLinkIsFinancialPayer(false);
    setLinkCanPickUp(true);
    setIsLinkModalOpen(true);
    searchStudents('');
  };

  const handleLinkStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      setError('অনুগ্রহ করে একজন শিক্ষার্থী নির্বাচন করুন।');
      return;
    }

    try {
      setIsLinking(true);
      setError('');

      const res = await fetch('/api/school/student-guardians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudentId,
          guardianId,
          isPrimary: linkIsPrimary,
          isFinancialPayer: linkIsFinancialPayer,
          canPickUp: linkCanPickUp,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'শিক্ষার্থী সংযোগ ব্যর্থ হয়েছে।');
      }

      setSuccessMessage('শিক্ষার্থী সফলভাবে সংযুক্ত করা হয়েছে।');
      setIsLinkModalOpen(false);
      loadGuardianDetail();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsLinking(false);
    }
  };

  const handleOpenEditRelationship = (rel: LinkedStudent) => {
    setEditingRelationship(rel);
    setEditIsPrimary(rel.isPrimary);
    setEditIsFinancialPayer(rel.isFinancialPayer);
    setEditCanPickUp(rel.canPickUp);
  };

  const handleUpdateRelationshipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRelationship) return;

    try {
      setIsUpdatingRel(true);
      setError('');

      const res = await fetch(`/api/school/student-guardians/${editingRelationship.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPrimary: editIsPrimary,
          isFinancialPayer: editIsFinancialPayer,
          canPickUp: editCanPickUp,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'সম্পর্ক হালনাগাদ করতে ব্যর্থ হয়েছে।');
      }

      setSuccessMessage('সম্পর্ক সফলভাবে হালনাগাদ করা হয়েছে।');
      setEditingRelationship(null);
      loadGuardianDetail();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsUpdatingRel(false);
    }
  };

  const handleRemoveRelationship = async (rel: LinkedStudent) => {
    if (!confirm(`আপনি কি শিক্ষার্থী ${rel.student.fullNameBn} এর সাথে এই অভিভাবকের সংযোগটি বিচ্ছিন্ন করতে চান? (শিক্ষার্থী বা অভিভাবক মুছে যাবে না)`)) {
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      const res = await fetch(`/api/school/student-guardians/${rel.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'সংযোগ অপসারণ ব্যর্থ হয়েছে।');
      }

      setSuccessMessage('শিক্ষার্থীর সংযোগ সফলভাবে অপসারণ করা হয়েছে।');
      loadGuardianDetail();
    } catch (err: unknown) {
      setError((err as Error).message);
      setIsLoading(false);
    }
  };

  const handleDeleteGuardian = async () => {
    if (!guardian) return;
    if (!confirm(`আপনি কি নিশ্চিত যে অভিভাবক ${guardian.fullNameBn} এর তথ্য মুছে ফেলতে চান?`)) {
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      const res = await fetch(`/api/school/guardians/${guardian.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'অভিভাবক মুছতে ব্যর্থ হয়েছে।');
      }

      router.push('/dashboard/guardians');
    } catch (err: unknown) {
      setError((err as Error).message);
      setIsLoading(false);
    }
  };

  if (isLoading && !guardian) {
    return (
      <div className="py-24 text-center text-slate-500">
        <Loader2 className="size-8 animate-spin mx-auto text-blue-600 mb-3" />
        <p className="text-sm">অভিভাবকের তথ্য লোড হচ্ছে...</p>
      </div>
    );
  }

  if (!guardian) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <AlertCircle className="size-10 mx-auto text-rose-500 mb-3" />
        <h2 className="text-lg font-bold text-slate-900">অভিভাবক পাওয়া যায়নি</h2>
        <p className="text-sm text-slate-500 mt-1">প্রদত্ত আইডিযুক্ত অভিভাবক অনুপস্থিত বা অপসারিত হয়েছে।</p>
        <Link
          href="/dashboard/guardians"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl"
        >
          <ArrowLeft className="size-4" />
          <span>তালিকায় ফিরে যান</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/guardians"
            className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900">{guardian.fullNameBn}</h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                {RELATION_LABELS_BN[guardian.relationType] || guardian.relationType}
              </span>
            </div>
            <p className="text-sm text-slate-500">{guardian.fullNameEn}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDeleteGuardian}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition border border-rose-200 cursor-pointer"
          >
            <Trash2 className="size-3.5" />
            <span>অভিভাবক মুছুন</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3 shadow-xs">
          <AlertCircle className="size-5 shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 cursor-pointer">
            <X className="size-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-3 shadow-xs">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600 mt-0.5" />
          <div className="flex-1">{successMessage}</div>
          <button onClick={() => setSuccessMessage('')} className="text-emerald-500 hover:text-emerald-700 cursor-pointer">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Guardian Profile Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Contact Info */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <Phone className="size-4 text-blue-600" />
            <span>যোগাযোগের তথ্য</span>
          </h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-xs text-slate-400 block">প্রধান ফোন</span>
              <span className="font-mono font-medium text-slate-800">{guardian.phone}</span>
            </div>
            {guardian.alternatePhone && (
              <div>
                <span className="text-xs text-slate-400 block">বিকল্প ফোন</span>
                <span className="font-mono text-slate-700">{guardian.alternatePhone}</span>
              </div>
            )}
            <div>
              <span className="text-xs text-slate-400 block">ইমেইল</span>
              <span className="text-slate-700">{guardian.email || 'প্রযোজ্য নয়'}</span>
            </div>
          </div>
        </div>

        {/* Identity & Career */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <Briefcase className="size-4 text-blue-600" />
            <span>পেশা ও পরিচয়</span>
          </h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-xs text-slate-400 block">পেশা</span>
              <span className="text-slate-800 font-medium">{guardian.occupation || 'প্রযোজ্য নয়'}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">মাসিক আয়</span>
              <span className="text-slate-800 font-medium">
                {guardian.monthlyIncome ? `৳ ${Number(guardian.monthlyIncome).toLocaleString('bn-BD')}` : 'প্রযোজ্য নয়'}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">জাতীয় পরিচয়পত্র (NID)</span>
              <span className="font-mono text-slate-800">{guardian.nationalId || 'প্রযোজ্য নয়'}</span>
            </div>
            {guardian.educationLevel && (
              <div>
                <span className="text-xs text-slate-400 block">শিক্ষাগত যোগ্যতা</span>
                <span className="text-slate-800">{guardian.educationLevel}</span>
              </div>
            )}
          </div>
        </div>

        {/* Address */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <MapPin className="size-4 text-blue-600" />
            <span>ঠিকানা</span>
          </h3>
          <div className="text-sm text-slate-700">
            <p>{guardian.address || 'কোনো ঠিকানা লিপিবদ্ধ নেই।'}</p>
          </div>
        </div>
      </div>

      {/* Linked Students Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <GraduationCap className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">সংযুক্ত শিক্ষার্থী</h2>
              <p className="text-xs text-slate-500">এই অভিভাবকের সাথে সম্পর্কিত শিক্ষার্থীর তালিকা</p>
            </div>
          </div>
          <button
            onClick={handleOpenLinkModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition cursor-pointer"
          >
            <Plus className="size-4" />
            <span>শিক্ষার্থী সংযুক্ত করুন</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">স্টুডেন্ট আইডি</th>
                <th className="py-3 px-4">নাম</th>
                <th className="py-3 px-4 text-center">প্রধান অভিভাবক</th>
                <th className="py-3 px-4 text-center">আর্থিক দায়িত্ব</th>
                <th className="py-3 px-4 text-center">পিকআপ অনুমতি</th>
                <th className="py-3 px-4 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {guardian.students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    <GraduationCap className="size-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-slate-700">কোনো শিক্ষার্থী সংযুক্ত নেই</p>
                    <p className="text-xs text-slate-400 mt-1">
                      শিক্ষার্থী সংযুক্ত করতে উপরের বোতামে ক্লিক করুন।
                    </p>
                  </td>
                </tr>
              ) : (
                guardian.students.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4 font-mono font-semibold text-blue-700">
                      <Link href={`/dashboard/students/${item.student.id}`} className="hover:underline">
                        {item.student.studentCode}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{item.student.fullNameBn}</div>
                      <div className="text-xs text-slate-500">{item.student.fullNameEn}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.isPrimary ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <ShieldCheck className="size-3" />
                          <span>হ্যাঁ</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                          না
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.isFinancialPayer ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                          <CreditCard className="size-3" />
                          <span>হ্যাঁ</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                          না
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.canPickUp ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          <UserCheck className="size-3" />
                          <span>অনুমোদিত</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                          <ShieldAlert className="size-3" />
                          <span>অনুমোদিত নয়</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditRelationship(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                        >
                          <Pencil className="size-3" />
                          <span>সম্পাদনা</span>
                        </button>
                        <button
                          onClick={() => handleRemoveRelationship(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition border border-rose-100 cursor-pointer"
                        >
                          <Trash2 className="size-3" />
                          <span>সংযোগ সরান</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Link Student Modal */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">শিক্ষার্থী সংযুক্ত করুন</h2>
              <button
                onClick={() => setIsLinkModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleLinkStudentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  শিক্ষার্থী খুঁজুন বা নির্বাচন করুন <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="নাম বা আইডি দিয়ে খুঁজুন..."
                      value={studentSearchQuery}
                      onChange={(e) => {
                        setStudentSearchQuery(e.target.value);
                        searchStudents(e.target.value);
                      }}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                    {isSearchingStudents && (
                      <Loader2 className="size-4 animate-spin text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    )}
                  </div>

                  <select
                    required
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                    <option value="">-- শিক্ষার্থী নির্বাচন করুন --</option>
                    {studentOptions.map((stu) => (
                      <option key={stu.id} value={stu.id}>
                        {stu.studentCode} — {stu.fullNameBn} ({stu.fullNameEn})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={linkIsPrimary}
                    onChange={(e) => setLinkIsPrimary(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 size-4"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">প্রধান অভিভাবক (Primary Guardian)</span>
                    <span className="text-xs text-slate-500">স্কুলের প্রাতিষ্ঠানিক যোগাযোগ ও নোটিশ গ্রহণের প্রধান দায়িত্ব</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={linkIsFinancialPayer}
                    onChange={(e) => setLinkIsFinancialPayer(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 size-4"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">আর্থিক দায়িত্ব (Financial Payer)</span>
                    <span className="text-xs text-slate-500">টিউশন ফি ও অন্যান্য আর্থিক দায়ভার পরিশোধকারী</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={linkCanPickUp}
                    onChange={(e) => setLinkCanPickUp(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 size-4"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">পিকআপ অনুমতি (Can Pick Up)</span>
                    <span className="text-xs text-slate-500">বিদ্যালয় ছুটির পর শিক্ষার্থীকে গ্রহণ করার বৈধ অনুমতি</span>
                  </div>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isLinking || !selectedStudentId}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50 cursor-pointer"
                >
                  {isLinking && <Loader2 className="size-3.5 animate-spin" />}
                  <span>সংযুক্ত করুন</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Relationship Modal */}
      {editingRelationship && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">সম্পর্ক সম্পাদনা</h2>
                <p className="text-xs text-slate-500">{editingRelationship.student.fullNameBn} ({editingRelationship.student.studentCode})</p>
              </div>
              <button
                onClick={() => setEditingRelationship(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateRelationshipSubmit} className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsPrimary}
                    onChange={(e) => setEditIsPrimary(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 size-4"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">প্রধান অভিভাবক (Primary Guardian)</span>
                    <span className="text-xs text-slate-500">অন্যান্য প্রধান অভিভাবক থাকলে স্বয়ংক্রিয়ভাবে পরিবর্তন হবে</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsFinancialPayer}
                    onChange={(e) => setEditIsFinancialPayer(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 size-4"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">আর্থিক দায়িত্ব (Financial Payer)</span>
                    <span className="text-xs text-slate-500">টিউশন ফি ও অন্যান্য আর্থিক দায়ভার</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editCanPickUp}
                    onChange={(e) => setEditCanPickUp(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 size-4"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">পিকআপ অনুমতি (Can Pick Up)</span>
                    <span className="text-xs text-slate-500">ছুটির পর শিক্ষার্থীকে নেওয়ার অনুমতি</span>
                  </div>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRelationship(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingRel}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50 cursor-pointer"
                >
                  {isUpdatingRel && <Loader2 className="size-3.5 animate-spin" />}
                  <span>হালনাগাদ করুন</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
