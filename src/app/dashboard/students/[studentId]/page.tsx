'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  GraduationCap,
  ArrowLeft,
  Calendar,
  Phone,
  Mail,
  MapPin,
  HeartPulse,
  AlertCircle,
  Loader2,
  ShieldAlert,
  History,
} from 'lucide-react';
import { format } from 'date-fns';

interface Enrollment {
  id: string;
  rollNo: number;
  status: string;
  enrollmentType: string;
  createdAt: string;
  academicSession: {
    id: string;
    name: string;
    isCurrent: boolean;
  };
  campus?: {
    id: string;
    nameEn: string;
    nameBn: string;
  } | null;
  class: {
    id: string;
    nameEn: string;
    nameBn: string;
    numericLevel: number;
  };
  section: {
    id: string;
    nameEn: string;
    nameBn: string;
  };
  group?: {
    id: string;
    nameEn: string;
    nameBn: string;
  } | null;
}

interface EmergencyContact {
  id: string;
  name: string;
  relation: string;
  phone: string;
  address?: string | null;
}

interface StudentDetail {
  id: string;
  studentCode: string;
  permanentAdmissionNo: string | null;
  admissionDate: string;
  firstNameEn: string;
  lastNameEn: string;
  fullNameEn: string;
  fullNameBn: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string | null;
  religion: string;
  nationality: string;
  birthRegistrationNo: string | null;
  nationalId: string | null;
  photoUrl: string | null;
  phone: string | null;
  email: string | null;
  permanentAddressLine: string;
  permanentVillage: string | null;
  permanentPostOffice: string;
  permanentPostCode: string;
  permanentThana: string;
  permanentDistrict: string;
  permanentDivision: string;
  presentAddressLine: string;
  presentThana: string;
  presentDistrict: string;
  presentDivision: string;
  isPhysicallyChallenged: boolean;
  disabilityDetails: string | null;
  status: string;
  createdAt: string;
  emergencyContacts: EmergencyContact[];
  enrollments: Enrollment[];
}

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params?.studentId as string;

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadStudent() {
      try {
        setIsLoading(true);
        setError('');

        const res = await fetch(`/api/school/students/${studentId}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'শিক্ষার্থীর তথ্য লোড করতে ব্যর্থ হয়েছে।');
        }

        setStudent(data.data);
      } catch (err: unknown) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    }

    if (studentId) {
      loadStudent();
    }
  }, [studentId]);

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="size-8 animate-spin mx-auto text-emerald-600 mb-3" />
        <p className="text-sm text-slate-500">শিক্ষার্থীর বিস্তারিত তথ্য লোড হচ্ছে...</p>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="space-y-4 max-w-xl mx-auto py-16 text-center">
        <div className="size-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="size-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">শিক্ষার্থী পাওয়া যায়নি</h2>
        <p className="text-sm text-slate-500">{error || 'অনুরোধকৃত শিক্ষার্থী ডাটাবেজে পাওয়া যায়নি।'}</p>
        <button
          onClick={() => router.push('/dashboard/students')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
        >
          <ArrowLeft className="size-4" />
          <span>শিক্ষার্থী তালিকায় ফিরে যান</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Bar with Back Button */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/students"
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
        >
          <ArrowLeft className="size-3.5" />
          <span>শিক্ষার্থী তালিকায় ফিরে যান</span>
        </Link>
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            student.status === 'ACTIVE'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <span
            className={`size-2 rounded-full ${
              student.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'
            }`}
          />
          {student.status === 'ACTIVE' ? 'সক্রিয় শিক্ষার্থী' : student.status}
        </span>
      </div>

      {/* Main Student Header Card */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="size-20 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-2xl border border-emerald-200 shrink-0">
            {student.fullNameBn ? student.fullNameBn.charAt(0) : <GraduationCap className="size-10" />}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-slate-900">{student.fullNameBn}</h1>
              <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-mono text-xs font-bold">
                {student.studentCode}
              </span>
            </div>
            <p className="text-sm text-slate-500 font-medium">{student.fullNameEn}</p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
              <span className="flex items-center gap-1.5">
                <Calendar className="size-3.5 text-slate-400" />
                জন্ম: {format(new Date(student.dateOfBirth), 'dd MMMM yyyy')}
              </span>
              <span>•</span>
              <span>লিঙ্গ: {student.gender === 'MALE' ? 'ছাত্র' : student.gender === 'FEMALE' ? 'ছাত্রী' : 'অন্যান্য'}</span>
              {student.bloodGroup && (
                <>
                  <span>•</span>
                  <span>গ্রুপ: {student.bloodGroup.replace('_', '+').replace('POSITIVE', '+').replace('NEGATIVE', '-')}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Official & Identification */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="size-4 text-emerald-600" />
            পরিচিতি ও অফিশিয়াল তথ্য
          </h2>
          <div className="divide-y divide-slate-100 text-sm">
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">স্টুডেন্ট আইডি:</span>
              <span className="font-mono font-bold text-slate-900">{student.studentCode}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">ভর্তির তারিখ:</span>
              <span className="font-medium text-slate-800">
                {format(new Date(student.admissionDate), 'dd MMMM yyyy')}
              </span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">জন্ম নিবন্ধন নম্বর (BRN):</span>
              <span className="font-mono text-slate-800">{student.birthRegistrationNo || 'প্রযোজ্য নয়'}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">জাতীয় পরিচয়পত্র (NID):</span>
              <span className="font-mono text-slate-800">{student.nationalId || 'প্রযোজ্য নয়'}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">ধর্ম ও জাতীয়তা:</span>
              <span className="font-medium text-slate-800">
                {student.religion}, {student.nationality}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Contact & Addresses */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <MapPin className="size-4 text-emerald-600" />
            যোগাযোগ ও ঠিকানা
          </h2>
          <div className="divide-y divide-slate-100 text-sm">
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">মোবাইল নম্বর:</span>
              <span className="font-medium text-slate-800 flex items-center gap-1.5">
                <Phone className="size-3.5 text-slate-400" />
                {student.phone || 'প্রযোজ্য নয়'}
              </span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">ইমেইল:</span>
              <span className="font-medium text-slate-800 flex items-center gap-1.5">
                <Mail className="size-3.5 text-slate-400" />
                {student.email || 'প্রযোজ্য নয়'}
              </span>
            </div>
            <div className="py-2.5 flex flex-col gap-0.5">
              <span className="text-slate-500 text-xs">বর্তমান ঠিকানা:</span>
              <span className="font-medium text-slate-800">
                {student.presentAddressLine}, {student.presentThana}, {student.presentDistrict}
              </span>
            </div>
            <div className="py-2.5 flex flex-col gap-0.5">
              <span className="text-slate-500 text-xs">স্থায়ী ঠিকানা:</span>
              <span className="font-medium text-slate-800">
                {student.permanentAddressLine}, {student.permanentPostOffice} ({student.permanentPostCode}), {student.permanentThana}, {student.permanentDistrict}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Contacts */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <HeartPulse className="size-4 text-rose-500" />
          জরুরি যোগাযোগ বিবরণী
        </h2>
        {student.emergencyContacts && student.emergencyContacts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {student.emergencyContacts.map((c) => (
              <div key={c.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1 text-sm">
                <div className="font-bold text-slate-900">{c.name}</div>
                <div className="text-xs text-slate-500">সম্পর্ক: {c.relation}</div>
                <div className="text-xs font-mono font-semibold text-emerald-600 flex items-center gap-1">
                  <Phone className="size-3" />
                  {c.phone}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">কোন জরুরি যোগাযোগের তথ্য যুক্ত নেই।</p>
        )}
      </div>

      {/* Academic History / Enrollments (Chronological Placement Snapshot) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <History className="size-4 text-emerald-600" />
            শিক্ষাবর্ষ ভিত্তিক এনরোলমেন্ট ইতিহাস (Academic History)
          </h2>
          <Link
            href="/dashboard/enrollments"
            className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 hover:bg-emerald-100 transition-colors font-medium"
          >
            <span>এনরোলমেন্ট ব্যবস্থাপনা</span>
          </Link>
        </div>

        {student.enrollments && student.enrollments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold uppercase">
                  <th className="py-3 px-3.5">শিক্ষাবর্ষ</th>
                  <th className="py-3 px-3.5">ক্যাম্পাস</th>
                  <th className="py-3 px-3.5">শ্রেণী</th>
                  <th className="py-3 px-3.5">শাখা</th>
                  <th className="py-3 px-3.5">গ্রুপ</th>
                  <th className="py-3 px-3.5">রোল</th>
                  <th className="py-3 px-3.5">ধরণ</th>
                  <th className="py-3 px-3.5">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {student.enrollments.map((e) => {
                  const statusBadgeColors: Record<string, string> = {
                    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    PROMOTED: 'bg-blue-50 text-blue-700 border-blue-200',
                    REPEATED: 'bg-amber-50 text-amber-700 border-amber-200',
                    TRANSFERRED_OUT: 'bg-purple-50 text-purple-700 border-purple-200',
                    PASSED_OUT: 'bg-teal-50 text-teal-700 border-teal-200',
                    DROPPED: 'bg-rose-50 text-rose-700 border-rose-200',
                  };
                  const badgeColor =
                    statusBadgeColors[e.status] || 'bg-slate-100 text-slate-700 border-slate-200';

                  const typeBangla: Record<string, string> = {
                    REGULAR: 'নিয়মিত',
                    PROMOTED: 'প্রমোটেড',
                    NEW_ADMISSION: 'নতুন ভর্তি',
                    REPEATER: 'রিপিটার',
                    LATERAL_ENTRY: 'পুনঃভর্তি',
                  };

                  return (
                    <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3.5 font-semibold text-slate-900">
                        {e.academicSession.name}
                        {e.academicSession.isCurrent && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            বর্তমান
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-slate-500">
                        {e.campus ? e.campus.nameBn : 'মূল ক্যাম্পাস'}
                      </td>
                      <td className="py-3 px-3.5 font-medium text-slate-900">
                        {e.class.nameBn} ({e.class.nameEn})
                      </td>
                      <td className="py-3 px-3.5 text-slate-700">{e.section.nameBn}</td>
                      <td className="py-3 px-3.5 text-slate-500">
                        {e.group ? e.group.nameBn : '—'}
                      </td>
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-900">
                        #{e.rollNo}
                      </td>
                      <td className="py-3 px-3.5 text-slate-600">
                        {typeBangla[e.enrollmentType] || e.enrollmentType}
                      </td>
                      <td className="py-3 px-3.5">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${badgeColor}`}
                        >
                          {e.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
            এই শিক্ষার্থীর কোন পূর্ববর্তী বা বর্তমান এনরোলমেন্ট রেকর্ড পাওয়া যায়নি।
          </div>
        )}
      </div>
    </div>
  );
}
