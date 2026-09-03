'use client';

import React, { useEffect, useState } from 'react';
import {
  CalendarRange,
  Plus,
  CalendarDays,
  Pencil,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  Star,
  Archive,
  X,
  PlayCircle,
} from 'lucide-react';

type SessionStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

interface AcademicSessionData {
  id: string;
  schoolId: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isLocked: boolean;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}

interface SessionFormState {
  name: string;
  startDate: string;
  endDate: string;
}

const EMPTY_FORM: SessionFormState = { name: '', startDate: '', endDate: '' };

const STATUS_LABELS: Record<SessionStatus, { labelBn: string; className: string }> = {
  ACTIVE: { labelBn: 'সক্রিয়', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  UPCOMING: { labelBn: 'আসন্ন', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  COMPLETED: { labelBn: 'সম্পন্ন', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  ARCHIVED: { labelBn: 'আর্কাইভ', className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

function formatDateBn(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function AcademicSessionsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  const [canView, setCanView] = useState(true);
  const [canCreate, setCanCreate] = useState(false);
  const [canUpdate, setCanUpdate] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [permissionDenied, setPermissionDenied] = useState(false);

  const [sessions, setSessions] = useState<AcademicSessionData[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SessionFormState>(EMPTY_FORM);

  const currentSession = sessions.find((s) => s.status === 'ACTIVE') || null;

  async function fetchSessions() {
    setLoading(true);
    setErrorMessage(null);
    setPermissionDenied(false);
    try {
      const res = await fetch('/api/school/academic-sessions');
      if (res.status === 401 || res.status === 403) {
        setPermissionDenied(true);
        setCanView(false);
        return;
      }
      if (!res.ok) {
        throw new Error('শিক্ষাবর্ষের তালিকা লোড করতে ব্যর্থ হয়েছে।');
      }
      const json = await res.json();
      if (json.success) {
        setSessions(json.data || []);
        setCanCreate(json.canCreate === true);
        setCanUpdate(json.canUpdate === true);
      }
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMessage(e.message || 'নেটওয়ার্ক ত্রুটি বা তথ্য লোড ব্যর্থ হয়েছে।');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSessions();
  }, []);

  function openAddModal() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setModalOpen(true);
  }

  function openEditModal(session: AcademicSessionData) {
    setEditingId(session.id);
    setForm({
      name: session.name,
      startDate: session.startDate.slice(0, 10),
      endDate: session.endDate.slice(0, 10),
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
      name: form.name,
      startDate: form.startDate,
      endDate: form.endDate,
    };

    try {
      const url = editingId ? `/api/school/academic-sessions/${editingId}` : '/api/school/academic-sessions';
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
        throw new Error(data.error || 'শিক্ষাবর্ষের তথ্য সংরক্ষণ করা সম্ভব হয়নি।');
      }

      setSuccessMessage(editingId ? 'শিক্ষাবর্ষের তথ্য সফলভাবে হালনাগাদ করা হয়েছে।' : 'নতুন শিক্ষাবর্ষ সফলভাবে যোগ করা হয়েছে।');
      setModalOpen(false);
      await fetchSessions();
      window.setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMessage(e.message || 'সংরক্ষণ ব্যর্থ হয়েছে।');
    } finally {
      setSaving(false);
    }
  }

  async function transitionStatus(session: AcademicSessionData, status: 'ACTIVE' | 'ARCHIVED') {
    setErrorMessage(null);
    setTransitioningId(session.id);
    try {
      const res = await fetch(`/api/school/academic-sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'শিক্ষাবর্ষের অবস্থা পরিবর্তন করা সম্ভব হয়নি।');
      }
      setSuccessMessage(
        status === 'ACTIVE' ? `"${session.name}" শিক্ষাবর্ষটি বর্তমান শিক্ষাবর্ষ হিসেবে সক্রিয় করা হয়েছে।` : `"${session.name}" শিক্ষাবর্ষটি আর্কাইভ করা হয়েছে।`
      );
      await fetchSessions();
      window.setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMessage(e.message || 'অবস্থা পরিবর্তন ব্যর্থ হয়েছে।');
    } finally {
      setTransitioningId(null);
    }
  }

  // ---- Loading State ----
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 shadow-xs flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="size-10 text-emerald-600 animate-spin mb-4" />
        <p className="text-slate-600 font-medium text-sm">শিক্ষাবর্ষের তথ্য লোড করা হচ্ছে...</p>
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
          শিক্ষাবর্ষের তথ্য দেখার জন্য আপনার &ldquo;ACADEMICS_VIEW&rdquo; অনুমতি প্রয়োজন। বিস্তারিত জানতে আপনার প্রতিষ্ঠানের এডমিনের সাথে যোগাযোগ করুন।
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
              <CalendarRange className="size-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 leading-snug">শিক্ষাবর্ষ</h1>
              <p className="text-sm text-slate-500 mt-1">
                আপনার বিদ্যালয়ের শিক্ষাবর্ষ পরিচালনা করুন — নতুন যোগ করুন, তথ্য সম্পাদনা করুন অথবা বর্তমান শিক্ষাবর্ষ নির্ধারণ করুন।
              </p>
            </div>
          </div>

          {canCreate ? (
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] shadow-md shadow-emerald-600/20 transition cursor-pointer shrink-0"
            >
              <Plus className="size-4" />
              <span>নতুন শিক্ষাবর্ষ</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 text-xs font-medium border border-amber-200 shrink-0">
              <Lock className="size-3.5" />
              <span>শুধুমাত্র দেখার অনুমতি (Read Only)</span>
            </div>
          )}
        </div>

        {/* Current Session Highlight */}
        {currentSession && (
          <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Star className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-700">বর্তমান শিক্ষাবর্ষ</p>
              <p className="text-sm font-bold text-slate-900">
                {currentSession.name}
                <span className="font-normal text-slate-500 ml-1.5">
                  ({formatDateBn(currentSession.startDate)} – {formatDateBn(currentSession.endDate)})
                </span>
              </p>
            </div>
          </div>
        )}
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
      {sessions.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 shadow-xs flex flex-col items-center justify-center text-center">
          <div className="size-14 rounded-2xl bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center mb-4">
            <CalendarDays className="size-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">কোনো শিক্ষাবর্ষ যোগ করা হয়নি</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-sm">
            আপনার বিদ্যালয়ের প্রথম শিক্ষাবর্ষ যোগ করে শুরু করুন।
          </p>
          {canCreate && (
            <button
              type="button"
              onClick={openAddModal}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] shadow-md shadow-emerald-600/20 transition cursor-pointer"
            >
              <Plus className="size-4" />
              <span>নতুন শিক্ষাবর্ষ</span>
            </button>
          )}
        </div>
      )}

      {/* Session List */}
      {sessions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sessions.map((session) => {
            const statusInfo = STATUS_LABELS[session.status];
            const isBusy = transitioningId === session.id;
            return (
              <div
                key={session.id}
                className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col gap-3 ${
                  session.status === 'ACTIVE' ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-slate-900 text-sm truncate">{session.name}</h3>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusInfo.className}`}
                  >
                    {statusInfo.labelBn}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <CalendarDays className="size-3.5 text-slate-400 shrink-0" />
                  <span>
                    {formatDateBn(session.startDate)} – {formatDateBn(session.endDate)}
                  </span>
                </div>

                {canUpdate && (
                  <div className="flex items-center gap-2 pt-2 mt-1 border-t border-slate-100 flex-wrap">
                    <button
                      type="button"
                      onClick={() => openEditModal(session)}
                      disabled={isBusy}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer disabled:opacity-50"
                    >
                      <Pencil className="size-3.5" />
                      <span>সম্পাদনা</span>
                    </button>

                    {session.status !== 'ACTIVE' && session.status !== 'ARCHIVED' && (
                      <button
                        type="button"
                        onClick={() => transitionStatus(session, 'ACTIVE')}
                        disabled={isBusy}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <PlayCircle className="size-3.5" />}
                        <span>সক্রিয় করুন</span>
                      </button>
                    )}

                    {session.status !== 'ARCHIVED' && (
                      <button
                        type="button"
                        onClick={() => transitionStatus(session, 'ARCHIVED')}
                        disabled={isBusy}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition cursor-pointer disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Archive className="size-3.5" />}
                        <span>আর্কাইভ করুন</span>
                      </button>
                    )}
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
                <CalendarRange className="size-5 text-emerald-600" />
                {editingId ? 'শিক্ষাবর্ষ সম্পাদনা' : 'নতুন শিক্ষাবর্ষ'}
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
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  শিক্ষাবর্ষের নাম <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="যেমন: ২০২৬ অথবা ২০২৬-২০২৭ শিক্ষাবর্ষ"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition"
                />
                {fieldErrors.name && <p className="text-xs text-red-600">{fieldErrors.name}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    শুরুর তারিখ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition"
                  />
                  {fieldErrors.startDate && <p className="text-xs text-red-600">{fieldErrors.startDate}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    শেষের তারিখ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition"
                  />
                  {fieldErrors.endDate && <p className="text-xs text-red-600">{fieldErrors.endDate}</p>}
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
                    <span>{editingId ? 'পরিবর্তন সংরক্ষণ করুন' : 'শিক্ষাবর্ষ যোগ করুন'}</span>
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
