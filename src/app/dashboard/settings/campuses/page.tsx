'use client';

import React, { useEffect, useState } from 'react';
import {
  Building2,
  Plus,
  Phone,
  Mail,
  User,
  Pencil,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  MapPinned,
  X,
  Star,
} from 'lucide-react';

interface CampusData {
  id: string;
  schoolId: string;
  code: string;
  nameEn: string;
  nameBn: string;
  phone: string | null;
  email: string | null;
  principalName: string | null;
  isMainBranch: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

interface CampusFormState {
  code: string;
  nameEn: string;
  nameBn: string;
  phone: string;
  email: string;
  principalName: string;
  isMainBranch: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
}

const EMPTY_FORM: CampusFormState = {
  code: '',
  nameEn: '',
  nameBn: '',
  phone: '',
  email: '',
  principalName: '',
  isMainBranch: false,
  status: 'ACTIVE',
};

const STATUS_LABELS: Record<CampusData['status'], { labelBn: string; className: string }> = {
  ACTIVE: { labelBn: 'সক্রিয়', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  INACTIVE: { labelBn: 'নিষ্ক্রিয়', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  ARCHIVED: { labelBn: 'আর্কাইভড', className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export default function CampusesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canView, setCanView] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [permissionDenied, setPermissionDenied] = useState(false);

  const [campuses, setCampuses] = useState<CampusData[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CampusFormState>(EMPTY_FORM);

  async function fetchCampuses() {
    setLoading(true);
    setErrorMessage(null);
    setPermissionDenied(false);
    try {
      const res = await fetch('/api/school/campuses');
      if (res.status === 401 || res.status === 403) {
        setPermissionDenied(true);
        setCanView(false);
        return;
      }
      if (!res.ok) {
        throw new Error('ক্যাম্পাসের তালিকা লোড করতে ব্যর্থ হয়েছে।');
      }
      const json = await res.json();
      if (json.success) {
        setCampuses(json.data || []);
        setCanEdit(json.canEdit === true);
      }
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMessage(e.message || 'নেটওয়ার্ক ত্রুটি বা তথ্য লোড ব্যর্থ হয়েছে।');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCampuses();
  }, []);

  function openAddModal() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setModalOpen(true);
  }

  function openEditModal(campus: CampusData) {
    setEditingId(campus.id);
    setForm({
      code: campus.code,
      nameEn: campus.nameEn,
      nameBn: campus.nameBn,
      phone: campus.phone || '',
      email: campus.email || '',
      principalName: campus.principalName || '',
      isMainBranch: campus.isMainBranch,
      status: campus.status,
    });
    setFieldErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    setFieldErrors({});

    const payload = {
      code: form.code,
      nameEn: form.nameEn,
      nameBn: form.nameBn,
      phone: form.phone || null,
      email: form.email || null,
      principalName: form.principalName || null,
      isMainBranch: form.isMainBranch,
      status: form.status,
    };

    try {
      const url = editingId ? `/api/school/campuses/${editingId}` : '/api/school/campuses';
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
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
        throw new Error(data.error || 'ক্যাম্পাসের তথ্য সংরক্ষণ করা সম্ভব হয়নি।');
      }

      setSuccessMessage(
        editingId ? 'ক্যাম্পাসের তথ্য সফলভাবে হালনাগাদ করা হয়েছে।' : 'নতুন ক্যাম্পাস সফলভাবে যোগ করা হয়েছে।'
      );
      setModalOpen(false);
      await fetchCampuses();
      window.setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMessage(e.message || 'সংরক্ষণ ব্যর্থ হয়েছে।');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(campus: CampusData) {
    const nextStatus = campus.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/school/campuses/${campus.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'স্ট্যাটাস পরিবর্তন করা সম্ভব হয়নি।');
      }
      await fetchCampuses();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMessage(e.message || 'স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে।');
    }
  }

  // ---- Loading State ----
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 shadow-xs flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="size-10 text-emerald-600 animate-spin mb-4" />
        <p className="text-slate-600 font-medium text-sm">ক্যাম্পাসের তথ্য লোড করা হচ্ছে...</p>
      </div>
    );
  }

  // ---- Permission Denied State ----
  if (permissionDenied || !canView) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 shadow-xs flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="size-14 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mb-4">
          <Lock className="size-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">অনুমতি নেই</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">
          ক্যাম্পাস / শাখার তথ্য দেখার জন্য আপনার &ldquo;SETTINGS_VIEW&rdquo; অনুমতি প্রয়োজন। বিস্তারিত জানতে আপনার প্রতিষ্ঠানের এডমিনের সাথে যোগাযোগ করুন।
        </p>
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
              <Building2 className="size-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 leading-snug">ক্যাম্পাস / শাখা</h1>
              <p className="text-sm text-slate-500 mt-1">
                আপনার বিদ্যালয়ের সকল ক্যাম্পাস বা শাখা এখান থেকে পরিচালনা করুন — নতুন যোগ করুন বা তথ্য সম্পাদনা করুন।
              </p>
            </div>
          </div>

          {canEdit ? (
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] shadow-md shadow-emerald-600/20 transition cursor-pointer shrink-0"
            >
              <Plus className="size-4" />
              <span>নতুন ক্যাম্পাস যোগ করুন</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 text-xs font-medium border border-amber-200 shrink-0">
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

      {/* Empty State */}
      {campuses.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 shadow-xs flex flex-col items-center justify-center text-center">
          <div className="size-14 rounded-2xl bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center mb-4">
            <MapPinned className="size-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">কোনো ক্যাম্পাস যোগ করা হয়নি</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-sm">
            আপনার বিদ্যালয়ের প্রথম ক্যাম্পাস বা শাখা যোগ করে শুরু করুন।
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={openAddModal}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] shadow-md shadow-emerald-600/20 transition cursor-pointer"
            >
              <Plus className="size-4" />
              <span>নতুন ক্যাম্পাস যোগ করুন</span>
            </button>
          )}
        </div>
      )}

      {/* Campus Cards Grid */}
      {campuses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {campuses.map((campus) => {
            const statusInfo = STATUS_LABELS[campus.status];
            return (
              <div
                key={campus.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-slate-900 text-sm truncate">{campus.nameBn}</h3>
                      {campus.isMainBranch && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 shrink-0">
                          <Star className="size-2.5" /> প্রধান শাখা
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{campus.nameEn}</p>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusInfo.className}`}
                  >
                    {statusInfo.labelBn}
                  </span>
                </div>

                <div className="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-mono font-semibold">
                  {campus.code}
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  {campus.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="size-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{campus.phone}</span>
                    </div>
                  )}
                  {campus.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="size-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{campus.email}</span>
                    </div>
                  )}
                  {campus.principalName && (
                    <div className="flex items-center gap-1.5">
                      <User className="size-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{campus.principalName}</span>
                    </div>
                  )}
                  {!campus.phone && !campus.email && !campus.principalName && (
                    <p className="text-slate-400 italic">অতিরিক্ত তথ্য যোগ করা হয়নি।</p>
                  )}
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2 pt-2 mt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => openEditModal(campus)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
                    >
                      <Pencil className="size-3.5" />
                      <span>সম্পাদনা</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleStatus(campus)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                    >
                      <span>{campus.status === 'ACTIVE' ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="size-5 text-emerald-600" />
                {editingId ? 'ক্যাম্পাস সম্পাদনা' : 'নতুন ক্যাম্পাস যোগ করুন'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="size-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    ক্যাম্পাসের বাংলা নাম <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.nameBn}
                    onChange={(e) => setForm({ ...form, nameBn: e.target.value })}
                    placeholder="যেমন: প্রধান ক্যাম্পাস"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition"
                  />
                  {fieldErrors.nameBn && <p className="text-xs text-red-600">{fieldErrors.nameBn}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    ক্যাম্পাসের ইংরেজি নাম <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.nameEn}
                    onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                    placeholder="e.g. Main Campus"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition"
                  />
                  {fieldErrors.nameEn && <p className="text-xs text-red-600">{fieldErrors.nameEn}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    ক্যাম্পাস কোড <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="যেমন: MAIN বা BR-02"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none font-mono uppercase transition"
                  />
                  {fieldErrors.code && <p className="text-xs text-red-600">{fieldErrors.code}</p>}
                  <p className="text-[11px] text-slate-400">শুধুমাত্র বড় হাতের অক্ষর, সংখ্যা ও হাইফেন।</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">স্ট্যাটাস</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as CampusFormState['status'] })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none font-medium transition"
                  >
                    <option value="ACTIVE">সক্রিয়</option>
                    <option value="INACTIVE">নিষ্ক্রিয়</option>
                    <option value="ARCHIVED">আর্কাইভড</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">ফোন</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="যেমন: 01712345678"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none font-mono transition"
                  />
                  {fieldErrors.phone && <p className="text-xs text-red-600">{fieldErrors.phone}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">ই-মেইল</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="campus@school.edu.bd"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition"
                  />
                  {fieldErrors.email && <p className="text-xs text-red-600">{fieldErrors.email}</p>}
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">ক্যাম্পাস প্রধানের নাম</label>
                  <input
                    type="text"
                    value={form.principalName}
                    onChange={(e) => setForm({ ...form, principalName: e.target.value })}
                    placeholder="যেমন: জনাব রহিম উদ্দিন"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                    <input
                      type="checkbox"
                      checked={form.isMainBranch}
                      onChange={(e) => setForm({ ...form, isMainBranch: e.target.checked })}
                      className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600/30"
                    />
                    <span className="text-xs font-semibold text-slate-700">এটি প্রধান শাখা হিসেবে চিহ্নিত করুন</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="px-4 py-2.5 rounded-xl font-semibold text-sm text-slate-600 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-600/20 transition cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>সংরক্ষণ করা হচ্ছে...</span>
                    </>
                  ) : (
                    <span>{editingId ? 'পরিবর্তন সংরক্ষণ করুন' : 'ক্যাম্পাস যোগ করুন'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
