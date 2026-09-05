'use client';

import React, { useEffect, useState } from 'react';
import {
  Users,
  GraduationCap,
  Calendar,
  Phone,
  Clock,
  BookOpen,
  Award,
  AlertCircle,
  Loader2,
  CheckCircle2,
  BadgeAlert,
} from 'lucide-react';

interface ChildSummary {
  studentId: string;
  studentCode: string;
  fullNameEn: string;
  fullNameBn: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup?: string | null;
  photoUrl?: string | null;
  relationType: string;
  isPrimary: boolean;
  canPickUp: boolean;
  isFinancialPayer: boolean;
  activeEnrollment: {
    classNameEn: string;
    classNameBn: string;
    sectionNameEn: string;
    sectionNameBn: string;
    rollNo: number;
    sessionName: string;
  } | null;
}

interface GuardianProfile {
  id: string;
  fullNameEn: string;
  fullNameBn: string;
  phone: string;
  email?: string | null;
  relationType: string;
}

export default function ParentDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardian, setGuardian] = useState<GuardianProfile | null>(null);
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchParentData() {
      try {
        setLoading(true);
        const res = await fetch('/api/parent/me');
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error || 'অভিভাবক ড্যাশবোর্ড লোড করতে ব্যর্থ হয়েছে।');
        }

        setGuardian(json.data.guardian);
        setChildren(json.data.children || []);
        if (json.data.children?.length > 0) {
          setSelectedChildId(json.data.children[0].studentId);
        }
      } catch (err: any) {
        setError(err.message || 'একটি ত্রুটি ঘটেছে।');
      } finally {
        setLoading(false);
      }
    }

    fetchParentData();
  }, []);

  const selectedChild = children.find((c) => c.studentId === selectedChildId);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-gray-600 font-medium">অভিভাবক পোর্টাল লোড হচ্ছে...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto my-8 bg-red-50 border border-red-200 rounded-xl text-red-700">
        <div className="flex items-center space-x-3">
          <AlertCircle className="w-6 h-6 flex-shrink-0" />
          <p className="font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-700/60 text-emerald-100 border border-emerald-500/30 mb-2">
              অভিভাবক পোর্টাল
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              স্বাগতম, {guardian?.fullNameBn || guardian?.fullNameEn}
            </h1>
            <p className="text-emerald-100/90 text-sm mt-1">
              আপনার সন্তানের প্রাতিষ্ঠানিক ও একাডেমিক তথ্য সরাসরি পর্যবেক্ষণ করুন
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs bg-black/20 backdrop-blur-sm rounded-xl px-4 py-2 self-start sm:self-auto">
            <Phone className="w-4 h-4 text-emerald-300" />
            <span>{guardian?.phone}</span>
          </div>
        </div>
      </div>

      {/* Children Switcher / Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-700" />
            আমার সন্তানগণ ({children.length})
          </h2>
        </div>

        {children.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-800 text-center">
            <BadgeAlert className="w-8 h-8 mx-auto mb-2 text-amber-600" />
            <p className="font-semibold">কোনো শিক্ষার্থীর প্রোফাইল সংযুক্ত নেই।</p>
            <p className="text-sm text-amber-700 mt-1">
              বিদ্যালয় প্রশাসনের সাথে যোগাযোগ করে অভিভাবক-শিক্ষার্থী সম্পর্ক যাচাই করুন।
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {children.map((child) => {
              const isSelected = child.studentId === selectedChildId;
              return (
                <button
                  key={child.studentId}
                  onClick={() => setSelectedChildId(child.studentId)}
                  className={`text-left p-5 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                    isSelected
                      ? 'bg-emerald-50/70 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                      : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between w-full">
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">{child.fullNameBn}</h3>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">{child.fullNameEn}</p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600 w-full">
                    <span className="font-mono font-medium text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                      আইডি: {child.studentCode}
                    </span>
                    {child.activeEnrollment ? (
                      <span className="font-semibold text-gray-700">
                        {child.activeEnrollment.classNameBn || child.activeEnrollment.classNameEn} • শাখা {child.activeEnrollment.sectionNameBn || child.activeEnrollment.sectionNameEn}
                      </span>
                    ) : (
                      <span className="text-gray-400">এনরোলমেন্ট নেই</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Child Detail Dossier */}
      {selectedChild && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="border-b border-gray-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                নির্বাচিত শিক্ষার্থী
              </span>
              <h2 className="text-xl font-bold text-gray-900 mt-0.5">
                {selectedChild.fullNameBn} ({selectedChild.fullNameEn})
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">
                স্টুডেন্ট আইডি: {selectedChild.studentCode}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-500 text-xs font-medium">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                শ্রেণি ও শাখা
              </div>
              <p className="text-base font-bold text-gray-900 mt-1">
                {selectedChild.activeEnrollment
                  ? `${selectedChild.activeEnrollment.classNameBn} (${selectedChild.activeEnrollment.sectionNameBn})`
                  : 'নির্ধারিত নেই'}
              </p>
              {selectedChild.activeEnrollment && (
                <p className="text-xs text-gray-500 mt-0.5">
                  রোল: {selectedChild.activeEnrollment.rollNo}
                </p>
              )}
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-500 text-xs font-medium">
                <Calendar className="w-4 h-4 text-teal-600" />
                শিক্ষাবর্ষ
              </div>
              <p className="text-base font-bold text-gray-900 mt-1">
                {selectedChild.activeEnrollment?.sessionName || 'চলতি সেশন'}
              </p>
              <p className="text-xs text-emerald-600 mt-0.5 font-medium">নিয়মিত শিক্ষার্থী</p>
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-500 text-xs font-medium">
                <Clock className="w-4 h-4 text-blue-600" />
                জন্ম তারিখ
              </div>
              <p className="text-base font-bold text-gray-900 mt-1">
                {new Date(selectedChild.dateOfBirth).toLocaleDateString('bn-BD', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 font-mono">
                রক্তের গ্রুপ: {selectedChild.bloodGroup || 'অনুল্লেখিত'}
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-500 text-xs font-medium">
                <GraduationCap className="w-4 h-4 text-indigo-600" />
                অভিভাবক সম্পর্ক
              </div>
              <p className="text-base font-bold text-gray-900 mt-1">
                {selectedChild.relationType}
              </p>
              <p className="text-xs text-emerald-600 mt-0.5 font-medium">
                {selectedChild.isPrimary ? 'প্রধান অভিভাবক' : 'অনুমোদিত অভিভাবক'}
              </p>
            </div>
          </div>

          {/* Quick Informational Modules */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="border border-gray-200 rounded-xl p-5 space-y-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
                <Award className="w-4 h-4 text-emerald-600" />
                একাডেমিক মূল্যায়ন ও ফলাফল
              </h3>
              <div className="p-4 bg-gray-50 rounded-lg text-center text-xs text-gray-500">
                চলতি শিক্ষাবর্ষের চূড়ান্ত ফলাফল প্রকাশিত হলে এখানে প্রদর্শিত হবে।
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl p-5 space-y-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-teal-600" />
                উপস্থিতির সারসংক্ষেপ
              </h3>
              <div className="p-4 bg-gray-50 rounded-lg text-center text-xs text-gray-500">
                শিক্ষার্থীর দৈনিক উপস্থিতি রেকর্ড সরাসরি বিদ্যালয় থেকে হালনাগাদ করা হয়।
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
