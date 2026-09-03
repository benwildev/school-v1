'use client';

import React, { useEffect, useState } from 'react';
import { 
  Building2, 
  Phone, 
  MapPin, 
  Palette, 
  Save, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Lock, 
  Image as ImageIcon,
  Sparkles
} from 'lucide-react';

interface SchoolData {
  id: string;
  slug: string;
  nameEn: string;
  nameBn: string;
  eiin: string | null;
  boardCode: string | null;
  registrationNo: string | null;
  establishedYear: number | null;
  email: string;
  phone: string;
  alternatePhone: string | null;
  website: string | null;
  status: string;
}

interface AddressData {
  id?: string;
  addressLine1: string;
  addressLine2: string | null;
  postOffice: string;
  postCode: string;
  thana: string;
  district: string;
  division: 'DHAKA' | 'CHITTAGONG' | 'RAJSHAHI' | 'KHULNA' | 'BARISAL' | 'SYLHET' | 'RANGPUR' | 'MYMENSINGH';
  country: string;
}

interface BrandingData {
  id?: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  monogramUrl: string | null;
  officialSealUrl: string | null;
  principalSignatureUrl: string | null;
  headmasterSignatureUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  idCardTemplate: string;
  reportCardTemplate: string;
}

const DIVISIONS = [
  { value: 'DHAKA', labelBn: 'ঢাকা', labelEn: 'Dhaka' },
  { value: 'CHITTAGONG', labelBn: 'চট্টগ্রাম', labelEn: 'Chittagong' },
  { value: 'RAJSHAHI', labelBn: 'রাজশাহী', labelEn: 'Rajshahi' },
  { value: 'KHULNA', labelBn: 'খুলনা', labelEn: 'Khulna' },
  { value: 'BARISAL', labelBn: 'বরিশাল', labelEn: 'Barisal' },
  { value: 'SYLHET', labelBn: 'সিলেট', labelEn: 'Sylhet' },
  { value: 'RANGPUR', labelBn: 'রংপুর', labelEn: 'Rangpur' },
  { value: 'MYMENSINGH', labelBn: 'ময়মনসিংহ', labelEn: 'Mymensingh' },
];

export default function SchoolSettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'contact' | 'address' | 'branding'>('profile');
  
  // Loading & State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Form State
  const [profile, setProfile] = useState<SchoolData>({
    id: '',
    slug: '',
    nameEn: '',
    nameBn: '',
    eiin: '',
    boardCode: '',
    registrationNo: '',
    establishedYear: null,
    email: '',
    phone: '',
    alternatePhone: '',
    website: '',
    status: 'ACTIVE',
  });

  const [address, setAddress] = useState<AddressData>({
    addressLine1: '',
    addressLine2: '',
    postOffice: '',
    postCode: '',
    thana: '',
    district: '',
    division: 'DHAKA',
    country: 'Bangladesh',
  });

  const [branding, setBranding] = useState<BrandingData>({
    logoUrl: '',
    faviconUrl: '',
    monogramUrl: '',
    officialSealUrl: '',
    principalSignatureUrl: '',
    headmasterSignatureUrl: '',
    primaryColor: '#166534',
    secondaryColor: '#0f172a',
    accentColor: '#eab308',
    idCardTemplate: 'CLASSIC_CLEAN',
    reportCardTemplate: 'BANGLADESH_STANDARD',
  });

  // Fetch Settings on Mount
  useEffect(() => {
    async function fetchSettings() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const res = await fetch('/api/school/settings');
        if (res.status === 403) {
          setErrorMessage('অননুমোদিত: আপনার এই বিদ্যালয়ের তথ্য দেখার অনুমতি (SETTINGS_VIEW) নেই।');
          setCanEdit(false);
          return;
        }
        if (!res.ok) {
          throw new Error('বিদ্যালয়ের সেটিংস লোড করতে ব্যর্থ হয়েছে।');
        }
        const json = await res.json();
        if (json.success && json.data) {
          setProfile(json.data.school);
          setCanEdit(json.data.canEdit !== false);
          if (json.data.address) {
            setAddress(json.data.address);
          }
          if (json.data.branding) {
            setBranding(json.data.branding);
          }
        }
      } catch (err: unknown) {
        const e = err as Error;
        setErrorMessage(e.message || 'নেটওয়ার্ক ত্রুটি বা তথ্য লোড ব্যর্থ হয়েছে।');
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  // Handle Form Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setFieldErrors({});

    try {
      const payload = {
        profile: {
          nameBn: profile.nameBn,
          nameEn: profile.nameEn,
          eiin: profile.eiin || null,
          boardCode: profile.boardCode || null,
          registrationNo: profile.registrationNo || null,
          establishedYear: profile.establishedYear ? Number(profile.establishedYear) : null,
          phone: profile.phone,
          alternatePhone: profile.alternatePhone || null,
          email: profile.email,
          website: profile.website || null,
        },
        address: {
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2 || null,
          postOffice: address.postOffice,
          postCode: address.postCode,
          thana: address.thana,
          district: address.district,
          division: address.division,
          country: address.country || 'Bangladesh',
        },
        branding: {
          logoUrl: branding.logoUrl || null,
          faviconUrl: branding.faviconUrl || null,
          monogramUrl: branding.monogramUrl || null,
          officialSealUrl: branding.officialSealUrl || null,
          principalSignatureUrl: branding.principalSignatureUrl || null,
          headmasterSignatureUrl: branding.headmasterSignatureUrl || null,
          primaryColor: branding.primaryColor,
          secondaryColor: branding.secondaryColor,
          accentColor: branding.accentColor,
          idCardTemplate: branding.idCardTemplate,
          reportCardTemplate: branding.reportCardTemplate,
        },
      };

      const res = await fetch('/api/school/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.details?.fieldErrors) {
          const errors: Record<string, string> = {};
          for (const [key, msgs] of Object.entries(data.details.fieldErrors)) {
            errors[key] = (msgs as string[]).join(', ');
          }
          setFieldErrors(errors);
        }
        throw new Error(data.error || 'পরিবর্তন সংরক্ষণ করা সম্ভব হয়নি।');
      }

      setSuccessMessage('বিদ্যালয়ের সকল তথ্য সফলভাবে সংরক্ষিত হয়েছে!');
      if (data.data?.school) setProfile(data.data.school);
      if (data.data?.address) setAddress(data.data.address);
      if (data.data?.branding) setBranding(data.data.branding);

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMessage(e.message || 'সংরক্ষণ ব্যর্থ হয়েছে।');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 shadow-xs flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="size-10 text-emerald-600 animate-spin mb-4" />
        <p className="text-slate-600 font-medium text-sm">বিদ্যালয়ের তথ্য লোড করা হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="size-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
              {branding.logoUrl ? (
                <img 
                  src={branding.logoUrl} 
                  alt="School Logo" 
                  className="size-12 object-contain rounded-xl"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <Building2 className="size-7" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 leading-snug">
                {profile.nameBn || 'বিদ্যালয়ের পরিচিতি ও সেটিংস'}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {profile.nameEn || 'School Institutional Profile & Branding Setup'}
              </p>
              {profile.eiin && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                  <span>EIIN:</span>
                  <span className="font-mono text-emerald-700">{profile.eiin}</span>
                </div>
              )}
            </div>
          </div>

          {!canEdit && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 text-xs font-medium border border-amber-200">
              <Lock className="size-3.5" />
              <span>শুধুমাত্র দেখার অনুমতি (Read Only)</span>
            </div>
          )}
        </div>
      </div>

      {/* Notifications / Alerts */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-800">
          <AlertCircle className="size-5 shrink-0 mt-0.5 text-red-600" />
          <div className="text-sm">
            <p className="font-semibold">ত্রুটি ঘটেছে</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 text-emerald-800">
          <CheckCircle2 className="size-5 shrink-0 mt-0.5 text-emerald-600" />
          <div className="text-sm">
            <p className="font-semibold">সফল হয়েছে!</p>
            <p className="mt-0.5">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
            activeTab === 'profile'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building2 className="size-4" />
          <span>১. বিদ্যালয়ের তথ্য</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('contact')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
            activeTab === 'contact'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Phone className="size-4" />
          <span>২. যোগাযোগের তথ্য</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('address')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
            activeTab === 'address'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <MapPin className="size-4" />
          <span>৩. ঠিকানা</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('branding')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
            activeTab === 'branding'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Palette className="size-4" />
          <span>৪. ব্র্যান্ডিং ও লোগো</span>
        </button>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: SCHOOL PROFILE */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="size-5 text-emerald-600" />
                বিদ্যালয়ের প্রাতিষ্ঠানিক তথ্য (School Profile)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                শিক্ষা বোর্ড ও প্রাতিষ্ঠানিক রেকর্ডের সাথে সামঞ্জস্য রেখে সঠিক নাম ও তথ্য দিন।
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Bangla Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  বিদ্যালয়ের বাংলা নাম <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={!canEdit}
                  value={profile.nameBn}
                  onChange={(e) => setProfile({ ...profile, nameBn: e.target.value })}
                  placeholder="যেমন: ঢাকা রেসিডেনসিয়াল মডেল কলেজ"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition disabled:opacity-60"
                />
                {fieldErrors.nameBn && <p className="text-xs text-red-600">{fieldErrors.nameBn}</p>}
                <p className="text-[11px] text-slate-400">অফিসিয়াল বাংলা নাম যা রিপোর্ট কার্ড ও প্রত্যয়নপত্রে ব্যবহৃত হবে।</p>
              </div>

              {/* English Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  বিদ্যালয়ের ইংরেজি নাম <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={!canEdit}
                  value={profile.nameEn}
                  onChange={(e) => setProfile({ ...profile, nameEn: e.target.value })}
                  placeholder="e.g. Dhaka Residential Model College"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition disabled:opacity-60"
                />
                {fieldErrors.nameEn && <p className="text-xs text-red-600">{fieldErrors.nameEn}</p>}
                <p className="text-[11px] text-slate-400">English name for official certificates and receipts.</p>
              </div>

              {/* EIIN */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  EIIN নম্বর (শিক্ষা বোর্ড প্রদত্ত)
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={profile.eiin || ''}
                  onChange={(e) => setProfile({ ...profile, eiin: e.target.value })}
                  placeholder="যেমন: ১৩০৮৭২"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none font-mono transition disabled:opacity-60"
                />
                {fieldErrors.eiin && <p className="text-xs text-red-600">{fieldErrors.eiin}</p>}
                <p className="text-[11px] text-slate-400">Educational Institute Identification Number (৫-৮ অঙ্ক)।</p>
              </div>

              {/* Board Code */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  শিক্ষা বোর্ড কোড (Board Code)
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={profile.boardCode || ''}
                  onChange={(e) => setProfile({ ...profile, boardCode: e.target.value })}
                  placeholder="যেমন: DHA-1045"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition disabled:opacity-60"
                />
              </div>

              {/* Registration Number */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  রেজিস্ট্রেশন নম্বর (Govt. Registration No)
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={profile.registrationNo || ''}
                  onChange={(e) => setProfile({ ...profile, registrationNo: e.target.value })}
                  placeholder="যেমন: REG-2023-9821"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition disabled:opacity-60"
                />
              </div>

              {/* Established Year */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  প্রতিষ্ঠার সাল (Established Year)
                </label>
                <input
                  type="number"
                  disabled={!canEdit}
                  value={profile.establishedYear || ''}
                  onChange={(e) => setProfile({ ...profile, establishedYear: e.target.value ? parseInt(e.target.value, 10) : null })}
                  placeholder="যেমন: ১৯৬০"
                  min={1800}
                  max={new Date().getFullYear()}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none font-mono transition disabled:opacity-60"
                />
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: CONTACT INFORMATION */}
        {activeTab === 'contact' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Phone className="size-5 text-emerald-600" />
                যোগাযোগের তথ্য (Contact Information)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                অভিভাবক ও শিক্ষার্থীদের সাথে যোগাযোগের জন্য প্রাতিষ্ঠানিক ফোন নম্বর ও ই-মেইল।
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Primary Phone */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  প্রধান মোবাইল / ফোন নম্বর <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={!canEdit}
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="যেমন: 01712345678"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none font-mono transition disabled:opacity-60"
                />
                {fieldErrors.phone && <p className="text-xs text-red-600">{fieldErrors.phone}</p>}
                <p className="text-[11px] text-slate-400">এসএমএস প্রেরক ও জরুরি যোগাযোগের মূল নম্বর।</p>
              </div>

              {/* Alternate Phone */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  বিকল্প ফোন নম্বর (Alternate Phone)
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={profile.alternatePhone || ''}
                  onChange={(e) => setProfile({ ...profile, alternatePhone: e.target.value })}
                  placeholder="যেমন: 02-9876543 বা 01812345678"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none font-mono transition disabled:opacity-60"
                />
              </div>

              {/* Official Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  অফিসিয়াল ই-মেইল <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  disabled={!canEdit}
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="যেমন: principal@school.edu.bd"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition disabled:opacity-60"
                />
                {fieldErrors.email && <p className="text-xs text-red-600">{fieldErrors.email}</p>}
                <p className="text-[11px] text-slate-400">সিস্টেম নোটিফিকেশন ও প্রশাসনিক ইমেইলের জন্য।</p>
              </div>

              {/* Website */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  অফিসিয়াল ওয়েবসাইট (Website URL)
                </label>
                <input
                  type="url"
                  disabled={!canEdit}
                  value={profile.website || ''}
                  onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                  placeholder="যেমন: https://school.edu.bd"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition disabled:opacity-60"
                />
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: INSTITUTIONAL ADDRESS */}
        {activeTab === 'address' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="size-5 text-emerald-600" />
                প্রাতিষ্ঠানিক ভৌগোলিক ঠিকানা (Institutional Address)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                বাংলাদেশের প্রশাসনিক কাঠামো অনুযায়ী বিভাগ, জেলা, থানা ও পোস্টাল কোড নির্ধারণ করুন।
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Division */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  বিভাগ (Division) <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  disabled={!canEdit}
                  value={address.division}
                  onChange={(e) => setAddress({ ...address, division: e.target.value as AddressData['division'] })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition disabled:opacity-60 font-medium"
                >
                  {DIVISIONS.map((div) => (
                    <option key={div.value} value={div.value}>
                      {div.labelBn} ({div.labelEn})
                    </option>
                  ))}
                </select>
              </div>

              {/* District */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  জেলা (District) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={!canEdit}
                  value={address.district}
                  onChange={(e) => setAddress({ ...address, district: e.target.value })}
                  placeholder="যেমন: ঢাকা"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition disabled:opacity-60"
                />
              </div>

              {/* Thana / Upazila */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  থানা / উপজেলা (Upazila / Thana) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={!canEdit}
                  value={address.thana}
                  onChange={(e) => setAddress({ ...address, thana: e.target.value })}
                  placeholder="যেমন: মোহাম্মদপুর"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition disabled:opacity-60"
                />
              </div>

              {/* Post Office & Post Code */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    ডাকঘর (Post Office) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!canEdit}
                    value={address.postOffice}
                    onChange={(e) => setAddress({ ...address, postOffice: e.target.value })}
                    placeholder="যেমন: মোহাম্মদপুর"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition disabled:opacity-60"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    পোস্ট কোড <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!canEdit}
                    value={address.postCode}
                    onChange={(e) => setAddress({ ...address, postCode: e.target.value })}
                    placeholder="যেমন: ১২০৭"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none font-mono transition disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Address Line 1 */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  বিস্তারিত ঠিকানা (হোল্ডিং, রোড, এলাকা) <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  disabled={!canEdit}
                  value={address.addressLine1}
                  onChange={(e) => setAddress({ ...address, addressLine1: e.target.value })}
                  placeholder="যেমন: বাড়ি নং ১২, রোড নং ৫, ধানমন্ডি আ/এ"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition disabled:opacity-60"
                />
              </div>

              {/* Address Line 2 */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  অতিরিক্ত ঠিকানা বা ল্যান্ডমার্ক (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={address.addressLine2 || ''}
                  onChange={(e) => setAddress({ ...address, addressLine2: e.target.value })}
                  placeholder="যেমন: শহীদ মিনার সংলগ্ন"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition disabled:opacity-60"
                />
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4: BRANDING & LOGO */}
        {activeTab === 'branding' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-8">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Palette className="size-5 text-emerald-600" />
                ব্র্যান্ডিং ও পরিচয় (Branding & Identity)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                বিদ্যালয়ের অফিসিয়াল লোগো, সিল, স্বাক্ষর ও প্রাতিষ্ঠানিক ব্র্যান্ড কালার কোড নির্ধারণ করুন।
              </p>
            </div>

            {/* Asset Previews & URLs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Logo URL */}
              <div className="space-y-3 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    বিদ্যালয় লোগো URL (School Logo)
                  </label>
                  {branding.logoUrl && (
                    <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                      প্রিভিউ উপলব্ধ
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="size-16 rounded-xl border border-slate-200 bg-white flex items-center justify-center shrink-0 overflow-hidden">
                    {branding.logoUrl ? (
                      <img 
                        src={branding.logoUrl} 
                        alt="Logo Preview" 
                        className="size-14 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                        }}
                      />
                    ) : (
                      <ImageIcon className="size-6 text-slate-300" />
                    )}
                  </div>
                  <input
                    type="url"
                    disabled={!canEdit}
                    value={branding.logoUrl || ''}
                    onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition disabled:opacity-60"
                  />
                </div>
                <p className="text-[10px] text-slate-400">ড্যাশবোর্ড, আইডিকার্ড, রেজাল্ট ও সার্টিফিকেটে ব্যবহৃত হবে।</p>
              </div>

              {/* Favicon URL */}
              <div className="space-y-3 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    ফেভিকন URL (Favicon)
                  </label>
                  {branding.faviconUrl && (
                    <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                      প্রিভিউ উপলব্ধ
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="size-16 rounded-xl border border-slate-200 bg-white flex items-center justify-center shrink-0 overflow-hidden">
                    {branding.faviconUrl ? (
                      <img 
                        src={branding.faviconUrl} 
                        alt="Favicon Preview" 
                        className="size-8 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
                        }}
                      />
                    ) : (
                      <ImageIcon className="size-6 text-slate-300" />
                    )}
                  </div>
                  <input
                    type="url"
                    disabled={!canEdit}
                    value={branding.faviconUrl || ''}
                    onChange={(e) => setBranding({ ...branding, faviconUrl: e.target.value })}
                    placeholder="https://example.com/favicon.ico"
                    className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition disabled:opacity-60"
                  />
                </div>
                <p className="text-[10px] text-slate-400">ব্রাউজার ট্যাবে প্রদর্শিত ছোট আইকন (16x16 / 32x32 px)।</p>
              </div>

              {/* Official Seal */}
              <div className="space-y-3 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                <label className="block text-xs font-bold text-slate-700">
                  অফিসিয়াল সিল / স্ট্যাম্প URL (Official Seal)
                </label>
                <div className="flex items-center gap-3">
                  <div className="size-16 rounded-xl border border-slate-200 bg-white flex items-center justify-center shrink-0 overflow-hidden">
                    {branding.officialSealUrl ? (
                      <img 
                        src={branding.officialSealUrl} 
                        alt="Seal Preview" 
                        className="size-14 object-contain"
                      />
                    ) : (
                      <ImageIcon className="size-6 text-slate-300" />
                    )}
                  </div>
                  <input
                    type="url"
                    disabled={!canEdit}
                    value={branding.officialSealUrl || ''}
                    onChange={(e) => setBranding({ ...branding, officialSealUrl: e.target.value })}
                    placeholder="https://example.com/seal.png"
                    className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Principal / Head Signature */}
              <div className="space-y-3 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                <label className="block text-xs font-bold text-slate-700">
                  অধ্যক্ষ / প্রধান শিক্ষকের ডিজিটাল স্বাক্ষর URL
                </label>
                <div className="flex items-center gap-3">
                  <div className="size-16 rounded-xl border border-slate-200 bg-white flex items-center justify-center shrink-0 overflow-hidden">
                    {branding.principalSignatureUrl || branding.headmasterSignatureUrl ? (
                      <img 
                        src={branding.principalSignatureUrl || branding.headmasterSignatureUrl || ''} 
                        alt="Signature Preview" 
                        className="size-14 object-contain"
                      />
                    ) : (
                      <ImageIcon className="size-6 text-slate-300" />
                    )}
                  </div>
                  <input
                    type="url"
                    disabled={!canEdit}
                    value={branding.principalSignatureUrl || branding.headmasterSignatureUrl || ''}
                    onChange={(e) => setBranding({ 
                      ...branding, 
                      principalSignatureUrl: e.target.value,
                      headmasterSignatureUrl: e.target.value 
                    })}
                    placeholder="https://example.com/signature.png"
                    className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition disabled:opacity-60"
                  />
                </div>
              </div>
            </div>

            {/* Brand Colors */}
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="size-4 text-emerald-600" />
                ব্র্যান্ড রঙ নির্বাচন (Institutional Color Palette)
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {/* Primary Color */}
                <div className="space-y-2 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                  <label className="block text-xs font-bold text-slate-700">
                    প্রাথমিক রঙ (Primary Color)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      disabled={!canEdit}
                      value={branding.primaryColor}
                      onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                      className="size-10 rounded-xl border border-slate-300 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={branding.primaryColor}
                      onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                      className="w-28 px-3 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg outline-none uppercase"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">হেডার, বাটন ও প্রাথমিক হাইলাইট।</p>
                </div>

                {/* Secondary Color */}
                <div className="space-y-2 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                  <label className="block text-xs font-bold text-slate-700">
                    সেকেন্ডারি রঙ (Secondary Color)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      disabled={!canEdit}
                      value={branding.secondaryColor}
                      onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                      className="size-10 rounded-xl border border-slate-300 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={branding.secondaryColor}
                      onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                      className="w-28 px-3 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg outline-none uppercase"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">ব্যাকগ্রাউন্ড ও ডার্ক অ্যাকসেন্ট।</p>
                </div>

                {/* Accent Color */}
                <div className="space-y-2 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                  <label className="block text-xs font-bold text-slate-700">
                    অ্যাকসেন্ট রঙ (Accent Color)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      disabled={!canEdit}
                      value={branding.accentColor}
                      onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })}
                      className="size-10 rounded-xl border border-slate-300 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={branding.accentColor}
                      onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })}
                      className="w-28 px-3 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg outline-none uppercase"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">ব্যাজ, স্টার ও বিশেষ সতর্কতা।</p>
                </div>
              </div>

              {/* Live Card Preview Box */}
              <div className="mt-4 p-4 rounded-2xl border border-slate-200 bg-slate-50">
                <div className="text-xs font-semibold text-slate-600 mb-2">লাইভ রঙ প্রিভিউ (Live Card Preview):</div>
                <div 
                  className="p-4 rounded-xl text-white flex items-center justify-between shadow-xs transition"
                  style={{ backgroundColor: branding.primaryColor }}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="size-10 rounded-lg flex items-center justify-center font-bold text-white shadow-xs"
                      style={{ backgroundColor: branding.secondaryColor }}
                    >
                      {profile.nameBn ? profile.nameBn.charAt(0) : 'বি'}
                    </div>
                    <div>
                      <div className="font-bold text-sm">{profile.nameBn || 'বিদ্যালয়ের নাম'}</div>
                      <div className="text-xs opacity-80">{address.district || 'ঢাকা'}, বাংলাদেশ</div>
                    </div>
                  </div>
                  <div 
                    className="px-3 py-1 rounded-full text-xs font-bold text-slate-900 shadow-xs"
                    style={{ backgroundColor: branding.accentColor }}
                  >
                    ভর্তি চলছে
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form Action Buttons Bar */}
        <div className="sticky bottom-4 z-30 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-lg flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {canEdit ? (
              <span>* চিহ্নিত ঘরগুলো পূরণ করা বাধ্যতামূলক।</span>
            ) : (
              <span className="text-amber-700 font-medium">তথ্য পরিবর্তনের জন্য SETTINGS_UPDATE অনুমতি প্রয়োজন।</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!canEdit || saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-600/20 transition cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>সংরক্ষণ করা হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  <span>পরিবর্তন সংরক্ষণ করুন</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
