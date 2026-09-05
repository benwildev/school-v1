'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  UserCheck,
  Phone,
  MapPin,
  Building,
  GraduationCap,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { AdmissionStatus, ApplicationSource, Gender, Religion } from '@prisma/client';
import { format } from 'date-fns';

interface ApplicationDossier {
  id: string;
  applicationNumber: string;
  trackingCode: string;
  academicSessionId: string;
  appliedClassId: string;
  appliedGroupId?: string | null;
  appliedCampusId?: string | null;
  curriculumVersion: string;
  appliedShift: string;
  applicantNameEn: string;
  applicantNameBn: string;
  dateOfBirth: string;
  gender: Gender;
  bloodGroup?: string | null;
  religion: Religion;
  birthRegistrationNo?: string | null;
  fatherNameEn: string;
  fatherNameBn: string;
  fatherNid?: string | null;
  fatherPhone: string;
  fatherOccupation?: string | null;
  motherNameEn: string;
  motherNameBn: string;
  motherPhone?: string | null;
  presentAddress: string;
  permanentAddress: string;
  previousSchoolName?: string | null;
  previousClass?: string | null;
  previousGpa?: number | null;
  applicationFeePaid: boolean;
  applicationFeeTrxId?: string | null;
  applicationSource: ApplicationSource;
  status: AdmissionStatus;
  convertedStudentId?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  academicSession: { id: string; name: string };
  appliedClass: { id: string; nameEn: string; nameBn: string };
  appliedCampus?: { id: string; nameEn: string; nameBn: string } | null;
  appliedGroup?: { id: string; nameEn: string; nameBn: string } | null;
  convertedStudent?: { id: string; studentCode: string; fullNameBn: string; fullNameEn: string } | null;
  reviewedBy?: { id: string; fullName: string } | null;
  documents: { id: string; title: string; fileUrl: string }[];
}

interface SectionOption {
  id: string;
  nameEn: string;
  nameBn: string;
  classId: string;
}

export default function AdmissionDetailPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const resolvedParams = use(params);
  const applicationId = resolvedParams.applicationId;

  const [application, setApplication] = useState<ApplicationDossier | null>(null);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Status transition modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Conversion Modal
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [conversionData, setConversionData] = useState({
    sectionId: '',
    rollNo: 1,
    admissionDate: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });

  const loadApplication = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/school/admissions/${applicationId}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'আবেদনের তথ্য লোড করা যায়নি।');
      }
      setApplication(data.data);

      // Load sections for this class
      if (data.data?.appliedClassId) {
        const secRes = await fetch(`/api/school/classes/${data.data.appliedClassId}/sections`);
        if (secRes.ok) {
          const sData = await secRes.json();
          if (sData.success) {
            setSections(sData.data || []);
            if (sData.data?.length > 0) {
              setConversionData((prev) => ({ ...prev, sectionId: sData.data[0].id }));
            }
          }
        }
      }
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    loadApplication();
  }, [loadApplication]);

  const handleStatusUpdate = async (targetStatus: AdmissionStatus, reason?: string) => {
    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/school/admissions/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: targetStatus,
          rejectionReason: reason || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে।');
      }

      setSuccessMessage('আবেদনের স্ট্যাটাস সফলভাবে আপডেট করা হয়েছে।');
      setShowRejectModal(false);
      loadApplication();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConversionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/school/admissions/${applicationId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: conversionData.sectionId,
          rollNo: Number(conversionData.rollNo),
          admissionDate: conversionData.admissionDate,
          notes: conversionData.notes || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'ভর্তি সম্পন্ন করা যায়নি।');
      }

      setShowConversionModal(false);
      setSuccessMessage(
        `অভিনন্দন! শিক্ষার্থী ও এনরোলমেন্ট সফলভাবে সম্পন্ন হয়েছে। স্টুডেন্ট কোড: ${data.data.studentCode}`
      );
      loadApplication();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-3" />
        <p className="text-gray-500 text-sm">আবেদনের পূর্ণাঙ্গ তথ্য লোড হচ্ছে...</p>
      </div>
    );
  }

  if (error && !application) {
    return (
      <div className="p-6 bg-red-50 text-red-700 rounded-xl border border-red-200">
        <AlertCircle className="w-6 h-6 mb-2" />
        <h2 className="text-lg font-semibold">ত্রুটি ঘটেছে</h2>
        <p className="text-sm mt-1">{error}</p>
        <Link
          href="/dashboard/admissions"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> তালিকায় ফিরে যান
        </Link>
      </div>
    );
  }

  if (!application) return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/admissions"
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">
                আবেদন নম্বর: {application.applicationNumber}
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded font-mono bg-gray-100 text-gray-600">
                TRK: {application.trackingCode}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              দাখিলের তারিখ: {format(new Date(application.createdAt), 'dd MMMM yyyy, hh:mm a')}
            </p>
          </div>
        </div>

        {/* Action Controls based on Status */}
        <div className="flex items-center gap-2 flex-wrap">
          {application.status === AdmissionStatus.SUBMITTED && (
            <>
              <button
                disabled={actionLoading}
                onClick={() => handleStatusUpdate(AdmissionStatus.UNDER_REVIEW)}
                className="px-3.5 py-2 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition flex items-center gap-1.5"
              >
                <Clock className="w-4 h-4" /> পর্যালোচনা শুরু করুন
              </button>
              <button
                disabled={actionLoading}
                onClick={() => setShowRejectModal(true)}
                className="px-3.5 py-2 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 transition flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4" /> প্রত্যাখ্যান
              </button>
            </>
          )}

          {application.status === AdmissionStatus.UNDER_REVIEW && (
            <>
              <button
                disabled={actionLoading}
                onClick={() => handleStatusUpdate(AdmissionStatus.SHORTLISTED)}
                className="px-3.5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> শর্টলিস্ট করুন
              </button>
              <button
                disabled={actionLoading}
                onClick={() => handleStatusUpdate(AdmissionStatus.APPROVED)}
                className="px-3.5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> প্রাথমিক অনুমোদন
              </button>
              <button
                disabled={actionLoading}
                onClick={() => setShowRejectModal(true)}
                className="px-3.5 py-2 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 transition flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4" /> প্রত্যাখ্যান
              </button>
            </>
          )}

          {application.status === AdmissionStatus.SHORTLISTED && (
            <>
              <button
                disabled={actionLoading}
                onClick={() => handleStatusUpdate(AdmissionStatus.APPROVED)}
                className="px-3.5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> চূড়ান্ত অনুমোদন দিন
              </button>
              <button
                disabled={actionLoading}
                onClick={() => setShowRejectModal(true)}
                className="px-3.5 py-2 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 transition flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4" /> প্রত্যাখ্যান
              </button>
            </>
          )}

          {application.status === AdmissionStatus.APPROVED && (
            <button
              onClick={() => setShowConversionModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition shadow flex items-center gap-2"
            >
              <UserCheck className="w-4 h-4" /> ভর্তি চূড়ান্ত ও শিক্ষার্থী তৈরি করুন
            </button>
          )}

          {application.status === AdmissionStatus.REJECTED && (
            <button
              disabled={actionLoading}
              onClick={() => handleStatusUpdate(AdmissionStatus.UNDER_REVIEW)}
              className="px-3.5 py-2 bg-gray-700 text-white rounded-lg text-xs font-medium hover:bg-gray-800 transition flex items-center gap-1.5"
            >
              <Clock className="w-4 h-4" /> পুনরায় পর্যালোচনা করুন
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <p className="text-sm font-medium">{successMessage}</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-800 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Rejection Alert if Rejected */}
      {application.status === AdmissionStatus.REJECTED && application.rejectionReason && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <XCircle className="w-4 h-4 text-rose-600" /> আবেদনটি প্রত্যাখ্যাত হয়েছে
          </div>
          <p className="mt-1 text-xs text-rose-800 pl-6">কারণ: {application.rejectionReason}</p>
        </div>
      )}

      {/* Enrollment Completed Banner */}
      {application.status === AdmissionStatus.ENROLLED && application.convertedStudent && (
        <div className="p-5 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-600 text-white rounded-xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">ভর্তি সফলভাবে সম্পন্ন হয়েছে</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                শিক্ষার্থী হিসেবে নিবন্ধিত কোড:{' '}
                <span className="font-mono font-bold text-purple-700">
                  {application.convertedStudent.studentCode}
                </span>
              </p>
            </div>
          </div>
          <Link
            href={`/dashboard/students/${application.convertedStudent.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-purple-700 border border-purple-300 rounded-lg text-xs font-semibold hover:bg-purple-50 transition shadow-sm"
          >
            শিক্ষার্থী প্রোফাইল দেখুন <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Grid: Details Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Main Dossier */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section: Student Information */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <GraduationCap className="w-4 h-4 text-indigo-600" /> শিক্ষার্থীর তথ্য
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-500">বাংলা নাম:</span>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">
                  {application.applicantNameBn}
                </p>
              </div>
              <div>
                <span className="text-gray-500">ইংরেজি নাম:</span>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">
                  {application.applicantNameEn}
                </p>
              </div>
              <div>
                <span className="text-gray-500">জন্ম তারিখ:</span>
                <p className="text-gray-900 mt-0.5 font-medium">
                  {format(new Date(application.dateOfBirth), 'dd/MM/yyyy')}
                </p>
              </div>
              <div>
                <span className="text-gray-500">লিঙ্গ:</span>
                <p className="text-gray-900 mt-0.5 font-medium">
                  {application.gender === 'MALE' ? 'ছাত্র (MALE)' : 'ছাত্রী (FEMALE)'}
                </p>
              </div>
              <div>
                <span className="text-gray-500">ধর্ম:</span>
                <p className="text-gray-900 mt-0.5 font-medium">{application.religion}</p>
              </div>
              <div>
                <span className="text-gray-500">রক্তের গ্রুপ:</span>
                <p className="text-gray-900 mt-0.5 font-medium">
                  {application.bloodGroup || 'উল্লেখ নেই'}
                </p>
              </div>
              <div>
                <span className="text-gray-500">জন্ম নিবন্ধন নম্বর (BRN):</span>
                <p className="text-gray-900 mt-0.5 font-medium">
                  {application.birthRegistrationNo || 'প্রদান করা হয়নি'}
                </p>
              </div>
            </div>
          </div>

          {/* Section: Guardian Information */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <Phone className="w-4 h-4 text-indigo-600" /> পিতা ও মাতার তথ্য
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-500">পিতার নাম (বাংলা ও ইংরেজি):</span>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">
                  {application.fatherNameBn} / {application.fatherNameEn}
                </p>
              </div>
              <div>
                <span className="text-gray-500">পিতার মোবাইল:</span>
                <p className="text-sm font-semibold text-indigo-600 mt-0.5 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> {application.fatherPhone}
                </p>
              </div>
              <div>
                <span className="text-gray-500">পিতার জাতীয় পরিচয়পত্র (NID):</span>
                <p className="text-gray-900 mt-0.5 font-medium">
                  {application.fatherNid || 'প্রদান করা হয়নি'}
                </p>
              </div>
              <div>
                <span className="text-gray-500">পিতার পেশা:</span>
                <p className="text-gray-900 mt-0.5 font-medium">
                  {application.fatherOccupation || 'উল্লেখ নেই'}
                </p>
              </div>
              <div>
                <span className="text-gray-500">মাতার নাম (বাংলা ও ইংরেজি):</span>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">
                  {application.motherNameBn} / {application.motherNameEn}
                </p>
              </div>
              <div>
                <span className="text-gray-500">মাতার মোবাইল:</span>
                <p className="text-gray-900 mt-0.5 font-medium">
                  {application.motherPhone || 'প্রদান করা হয়নি'}
                </p>
              </div>
            </div>
          </div>

          {/* Section: Addresses */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <MapPin className="w-4 h-4 text-indigo-600" /> ঠিকানার তথ্য
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-500">বর্তমান ঠিকানা:</span>
                <p className="text-gray-900 mt-0.5 font-medium">{application.presentAddress}</p>
              </div>
              <div>
                <span className="text-gray-500">স্থায়ী ঠিকানা:</span>
                <p className="text-gray-900 mt-0.5 font-medium">{application.permanentAddress}</p>
              </div>
            </div>
          </div>

          {/* Section: Documents */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <FileText className="w-4 h-4 text-indigo-600" /> সংযুক্ত নথিপত্র ({application.documents.length})
            </h2>
            {application.documents.length === 0 ? (
              <p className="text-xs text-gray-500">কোনো ফাইল সংযুক্ত করা হয়নি।</p>
            ) : (
              <div className="space-y-2">
                {application.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-xs"
                  >
                    <span className="font-medium text-gray-800">{doc.title}</span>
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
                    >
                      ডকুমেন্ট দেখুন <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Academic Application Summary */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <Building className="w-4 h-4 text-indigo-600" /> একাডেমিক আবেদন বিবরণ
            </h2>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-gray-500">শিক্ষাবর্ষ:</span>
                <p className="font-semibold text-gray-900 mt-0.5">
                  {application.academicSession?.name}
                </p>
              </div>
              <div>
                <span className="text-gray-500">আবেদনকৃত শ্রেণী:</span>
                <p className="font-semibold text-gray-900 mt-0.5">
                  {application.appliedClass?.nameBn || application.appliedClass?.nameEn}
                </p>
              </div>
              <div>
                <span className="text-gray-500">ক্যাম্পাস:</span>
                <p className="font-medium text-gray-800 mt-0.5">
                  {application.appliedCampus?.nameBn || application.appliedCampus?.nameEn || 'মূল ক্যাম্পাস'}
                </p>
              </div>
              <div>
                <span className="text-gray-500">গ্রুপ:</span>
                <p className="font-medium text-gray-800 mt-0.5">
                  {application.appliedGroup?.nameBn || application.appliedGroup?.nameEn || 'সাধারণ'}
                </p>
              </div>
              <div>
                <span className="text-gray-500">কারিকুলাম ও শিফট:</span>
                <p className="font-medium text-gray-800 mt-0.5">
                  {application.curriculumVersion} | {application.appliedShift}
                </p>
              </div>
              <div>
                <span className="text-gray-500">আবেদনের উৎস:</span>
                <p className="font-medium text-gray-800 mt-0.5">
                  {application.applicationSource === ApplicationSource.PUBLIC_ONLINE
                    ? 'অনলাইন পোর্টাল'
                    : 'বিদ্যালয় অফিস (ম্যানুয়াল)'}
                </p>
              </div>
              <div>
                <span className="text-gray-500">ফি প্রদান:</span>
                <p className="mt-0.5">
                  {application.applicationFeePaid ? (
                    <span className="text-emerald-700 font-semibold">পরিশোধিত</span>
                  ) : (
                    <span className="text-gray-500">প্রযোজ্য নয় / অপরিশোধিত</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 text-rose-600">
              <XCircle className="w-5 h-5" /> আবেদন প্রত্যাখ্যান করুন
            </h3>
            <p className="text-xs text-gray-600">
              আবেদন প্রত্যাখ্যানের কারণ উল্লেখ করা আবশ্যক। এই কারণটি অফিসিয়াল ট্র্যাকিং রেকর্ডে সংরক্ষিত হবে।
            </p>
            <textarea
              rows={3}
              required
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="প্রত্যাখ্যানের সুস্পষ্ট কারণ লিখুন..."
              className="w-full text-xs p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50"
              >
                বাতিল
              </button>
              <button
                disabled={!rejectionReason.trim() || actionLoading}
                onClick={() => handleStatusUpdate(AdmissionStatus.REJECTED, rejectionReason)}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 disabled:opacity-50"
              >
                প্রত্যাখ্যান নিশ্চিত করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Conversion Modal */}
      {showConversionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">ভর্তি চূড়ান্ত ও রূপান্তর</h3>
                <p className="text-xs text-gray-500">স্থায়ী শিক্ষার্থী ও শাখা এনরোলমেন্ট তৈরি করুন</p>
              </div>
            </div>

            <form onSubmit={handleConversionSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  শাখা নির্বাচন করুন <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={conversionData.sectionId}
                  onChange={(e) =>
                    setConversionData({ ...conversionData, sectionId: e.target.value })
                  }
                  className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">শাখা নির্ধারণ করুন</option>
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.nameBn || sec.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  রোল নম্বর <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  value={conversionData.rollNo}
                  onChange={(e) =>
                    setConversionData({ ...conversionData, rollNo: parseInt(e.target.value) || 1 })
                  }
                  className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">ভর্তির তারিখ</label>
                <input
                  type="date"
                  value={conversionData.admissionDate}
                  onChange={(e) =>
                    setConversionData({ ...conversionData, admissionDate: e.target.value })
                  }
                  className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">মন্তব্য (ঐচ্ছিক)</label>
                <input
                  type="text"
                  value={conversionData.notes}
                  onChange={(e) => setConversionData({ ...conversionData, notes: e.target.value })}
                  placeholder="ভর্তি সংক্রান্ত কোনো মন্তব্য থাকলে..."
                  className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowConversionModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !conversionData.sectionId}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  অনুমোদন ও ভর্তি সম্পন্ন করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
