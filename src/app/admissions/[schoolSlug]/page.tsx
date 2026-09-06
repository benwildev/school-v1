'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Phone,
  User,
  MapPin,
  Search,
  ExternalLink,
  Printer,
} from 'lucide-react';

interface SchoolData {
  id: string;
  slug: string;
  nameEn: string;
  nameBn: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

interface AcademicSession {
  id: string;
  name: string;
  isCurrent: boolean;
}

interface ClassItem {
  id: string;
  nameEn: string;
  nameBn: string;
  numericLevel: number;
}

interface CampusItem {
  id: string;
  nameEn: string;
  nameBn: string;
}

export default function PublicAdmissionPage({
  params,
}: {
  params: Promise<{ schoolSlug: string }>;
}) {
  const resolvedParams = use(params);
  const schoolSlug = resolvedParams.schoolSlug;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [school, setSchool] = useState<SchoolData | null>(null);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [campuses, setCampuses] = useState<CampusItem[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    academicSessionId: '',
    appliedClassId: '',
    appliedCampusId: '',
    curriculumVersion: 'BANGLA_VERSION',
    appliedShift: 'DAY',
    applicantNameEn: '',
    applicantNameBn: '',
    dateOfBirth: '2016-01-01',
    gender: 'MALE',
    bloodGroup: '',
    religion: 'ISLAM',
    birthRegistrationNo: '',
    fatherNameEn: '',
    fatherNameBn: '',
    fatherNid: '',
    fatherPhone: '',
    fatherOccupation: '',
    motherNameEn: '',
    motherNameBn: '',
    motherPhone: '',
    presentAddress: '',
    permanentAddress: '',
    previousSchoolName: '',
    previousClass: '',
  });

  // Success state
  const [submittedData, setSubmittedData] = useState<{
    applicationNumber: string;
    trackingCode: string;
    applicantName: string;
    createdAt: string;
  } | null>(null);

  useEffect(() => {
    async function loadSchoolData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/public/schools/${schoolSlug}/admissions`);
        let json: any = null;
        try {
          json = await res.json();
        } catch {
          // Response was not JSON
        }

        if (!res.ok || !json?.success) {
          throw new Error(json?.error || 'বিদ্যালয়ের তথ্য লোড করা যায়নি। ডাটাবেজ বা সার্ভার সংযোগ পরীক্ষা করুন।');
        }

        setSchool(json.data.school);
        setSessions(json.data.sessions || []);
        setClasses(json.data.classes || []);
        setCampuses(json.data.campuses || []);

        const currentSess = json.data.sessions?.find((s: AcademicSession) => s.isCurrent);
        if (currentSess) {
          setFormData((prev) => ({ ...prev, academicSessionId: currentSess.id }));
        } else if (json.data.sessions?.length > 0) {
          setFormData((prev) => ({ ...prev, academicSessionId: json.data.sessions[0].id }));
        }

        if (json.data.classes?.length > 0) {
          setFormData((prev) => ({ ...prev, appliedClassId: json.data.classes[0].id }));
        }
      } catch (err: unknown) {
        const e = err as Error;
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    loadSchoolData();
  }, [schoolSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/public/schools/${schoolSlug}/admissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          bloodGroup: formData.bloodGroup || null,
          appliedCampusId: formData.appliedCampusId || null,
        }),
      });

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        // Non-JSON response
      }

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'আবেদন জমা দিতে ব্যর্থ হয়েছে।');
      }

      setSubmittedData(json.data);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-gray-600 text-sm">অনলাইন ভর্তি পোর্টাল লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  if (error && !school) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-md w-full text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-gray-900">ভর্তি পোর্টাল উপলভ্য নয়</h1>
          <p className="text-xs text-gray-600 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Branding */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md font-bold text-lg">
              {school?.nameEn?.charAt(0) || 'E'}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{school?.nameBn}</h1>
              <p className="text-xs text-gray-500 font-medium">{school?.nameEn}</p>
            </div>
          </div>
          <Link
            href={`/admissions/${schoolSlug}/track`}
            className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition"
          >
            <Search className="w-4 h-4" /> আবেদনের অবস্থা জানুন (Track Application)
          </Link>
        </div>

        {/* Confirmation Screen */}
        {submittedData ? (
          <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">ভর্তি আবেদন সফলভাবে গৃহীত হয়েছে!</h2>
              <p className="text-xs text-gray-600 mt-1 max-w-lg mx-auto">
                আপনার আবেদনটি পর্যালোচনার জন্য বিদ্যালয় কর্তৃপক্ষের নিকট প্রেরণ করা হয়েছে। নিচের আবেদন নম্বর ও ট্র্যাকিং কোডটি যত্নসহকারে সংরক্ষণ করুন।
              </p>
            </div>

            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 max-w-md mx-auto grid grid-cols-2 gap-4 text-left">
              <div>
                <span className="text-xs text-gray-500">আবেদন নম্বর:</span>
                <p className="text-base font-bold text-indigo-600 mt-0.5">
                  {submittedData.applicationNumber}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">ট্র্যাকিং কোড (PIN):</span>
                <p className="text-base font-bold text-gray-900 font-mono tracking-widest mt-0.5">
                  {submittedData.trackingCode}
                </p>
              </div>
              <div className="col-span-2 pt-2 border-t border-gray-200">
                <span className="text-xs text-gray-500">শিক্ষার্থীর নাম:</span>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">
                  {submittedData.applicantName}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-semibold hover:bg-gray-800 transition"
              >
                <Printer className="w-4 h-4" /> রশিদ প্রিন্ট করুন
              </button>
              <Link
                href={`/admissions/${schoolSlug}/track?trackingCode=${submittedData.trackingCode}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition"
              >
                আবেদনের ট্র্যাকিং পেজ <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          /* Application Form */
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Step 1: Academic Choice */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
                <GraduationCap className="w-5 h-5 text-indigo-600" /> ১. শিক্ষাগত তথ্যাবলী
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    শিক্ষাবর্ষ <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.academicSessionId}
                    onChange={(e) => setFormData({ ...formData, academicSessionId: e.target.value })}
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">শিক্ষাবর্ষ নির্বাচন করুন</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.isCurrent ? '(চলতি শিক্ষাবর্ষ)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    ভর্তির শ্রেণী <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.appliedClassId}
                    onChange={(e) => setFormData({ ...formData, appliedClassId: e.target.value })}
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

                {campuses.length > 0 && (
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">শাখা / ক্যাম্পাস</label>
                    <select
                      value={formData.appliedCampusId}
                      onChange={(e) => setFormData({ ...formData, appliedCampusId: e.target.value })}
                      className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">মূল ক্যাম্পাস</option>
                      {campuses.map((cp) => (
                        <option key={cp.id} value={cp.id}>
                          {cp.nameBn || cp.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">শিফট</label>
                  <select
                    value={formData.appliedShift}
                    onChange={(e) => setFormData({ ...formData, appliedShift: e.target.value })}
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="DAY">দিবা (DAY)</option>
                    <option value="MORNING">প্রভাতি (MORNING)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Step 2: Student Details */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
                <User className="w-5 h-5 text-indigo-600" /> ২. শিক্ষার্থীর ব্যক্তিগত তথ্যাবলী
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    শিক্ষার্থীর নাম (ইংরেজিতে) <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.applicantNameEn}
                    onChange={(e) => setFormData({ ...formData, applicantNameEn: e.target.value })}
                    placeholder="e.g. Shakib Al Hasan"
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    শিক্ষার্থীর নাম (বাংলায়) <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.applicantNameBn}
                    onChange={(e) => setFormData({ ...formData, applicantNameBn: e.target.value })}
                    placeholder="যেমন: সাকিব আল হাসান"
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    জন্ম তারিখ <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">লিঙ্গ</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="MALE">ছাত্র (MALE)</option>
                    <option value="FEMALE">ছাত্রী (FEMALE)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">ধর্ম</label>
                  <select
                    value={formData.religion}
                    onChange={(e) => setFormData({ ...formData, religion: e.target.value })}
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ISLAM">ইসলাম</option>
                    <option value="HINDUISM">হিন্দু</option>
                    <option value="BUDDHISM">বৌদ্ধ</option>
                    <option value="CHRISTIANITY">খ্রিষ্টান</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">রক্তের গ্রুপ</label>
                  <select
                    value={formData.bloodGroup}
                    onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">নির্বাচন করুন (ঐচ্ছিক)</option>
                    <option value="A_POSITIVE">A+</option>
                    <option value="A_NEGATIVE">A-</option>
                    <option value="B_POSITIVE">B+</option>
                    <option value="B_NEGATIVE">B-</option>
                    <option value="O_POSITIVE">O+</option>
                    <option value="O_NEGATIVE">O-</option>
                    <option value="AB_POSITIVE">AB+</option>
                    <option value="AB_NEGATIVE">AB-</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-gray-700 mb-1">
                    অনলাইন জন্ম নিবন্ধন নম্বর (১৭ ডিজিট)
                  </label>
                  <input
                    type="text"
                    value={formData.birthRegistrationNo}
                    onChange={(e) =>
                      setFormData({ ...formData, birthRegistrationNo: e.target.value })
                    }
                    placeholder="১৭ ডিজিটের ডিজিটাল জন্ম নিবন্ধন নম্বর"
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Guardian Details */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
                <Phone className="w-5 h-5 text-indigo-600" /> ৩. পিতা ও মাতার তথ্যাবলী
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    পিতার নাম (ইংরেজিতে) <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.fatherNameEn}
                    onChange={(e) => setFormData({ ...formData, fatherNameEn: e.target.value })}
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    পিতার নাম (বাংলায়) <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.fatherNameBn}
                    onChange={(e) => setFormData({ ...formData, fatherNameBn: e.target.value })}
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    পিতার সক্রিয় মোবাইল নম্বর (১১ ডিজিট) <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.fatherPhone}
                    onChange={(e) => setFormData({ ...formData, fatherPhone: e.target.value })}
                    placeholder="01XXXXXXXXX"
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">পিতার এনআইডি (NID)</label>
                  <input
                    type="text"
                    value={formData.fatherNid}
                    onChange={(e) => setFormData({ ...formData, fatherNid: e.target.value })}
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    মাতার নাম (ইংরেজিতে) <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.motherNameEn}
                    onChange={(e) => setFormData({ ...formData, motherNameEn: e.target.value })}
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    মাতার নাম (বাংলায়) <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.motherNameBn}
                    onChange={(e) => setFormData({ ...formData, motherNameBn: e.target.value })}
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Step 4: Addresses */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
                <MapPin className="w-5 h-5 text-indigo-600" /> ৪. ঠিকানার তথ্যাবলী
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    বর্তমান ঠিকানা <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={formData.presentAddress}
                    onChange={(e) => setFormData({ ...formData, presentAddress: e.target.value })}
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    স্থায়ী ঠিকানা <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={formData.permanentAddress}
                    onChange={(e) => setFormData({ ...formData, permanentAddress: e.target.value })}
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-4 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                আবেদন পত্র দাখিল করুন (Submit Application)
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
