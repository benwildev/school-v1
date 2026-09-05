'use client';

import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Plus,
  Pencil,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Filter,
} from 'lucide-react';
import { SubjectType, RecordStatus } from '@prisma/client';

// ============================================================================
// DATA TYPES
// ============================================================================

interface SubjectItem {
  id: string;
  classId: string;
  groupId: string | null;
  code: string;
  nameEn: string;
  nameBn: string;
  subjectType: SubjectType;
  theoryMarks: number;
  practicalMarks: number;
  mcqMarks: number;
  vivaMarks: number;
  totalFullMarks: number;
  passMarks: number;
  isCombinedSubject: boolean;
  combinedWithSubjectId: string | null;
  status: RecordStatus;
  class: {
    id: string;
    nameEn: string;
    nameBn: string;
    numericLevel: number;
  };
  group: {
    id: string;
    nameEn: string;
    nameBn: string;
  } | null;
}

interface ClassItem {
  id: string;
  nameEn: string;
  nameBn: string;
  numericLevel: number;
}

interface GroupItem {
  id: string;
  nameEn: string;
  nameBn: string;
}

// ============================================================================
// LABELS & HELPERS
// ============================================================================

const SUBJECT_TYPE_LABELS: Record<SubjectType, string> = {
  COMPULSORY: 'আবশ্যিক',
  ELECTIVE: 'ঐচ্ছিক (Elective)',
  OPTIONAL_FOURTH: '৪র্থ বিষয়',
  ADDITIONAL: 'অতিরিক্ত',
};

export default function SubjectsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Permissions state
  const [canCreate, setCanCreate] = useState(false);
  const [canUpdate, setCanUpdate] = useState(false);

  // Core Data
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);

  // Filters
  const [classFilter, setClassFilter] = useState<string>('ALL');

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectItem | null>(null);
  
  const initialFormState = {
    classId: '',
    groupId: '',
    code: '',
    nameEn: '',
    nameBn: '',
    subjectType: 'COMPULSORY' as SubjectType,
    theoryMarks: 70,
    practicalMarks: 0,
    mcqMarks: 30,
    vivaMarks: 0,
    totalFullMarks: 100,
    passMarks: 33,
    isCombinedSubject: false,
    combinedWithSubjectId: '',
    status: 'ACTIVE' as RecordStatus,
  };
  const [form, setForm] = useState(initialFormState);

  // Load all data
  async function loadAllData() {
    setLoading(true);
    setErrorMessage(null);
    setPermissionDenied(false);

    try {
      const [subjRes, classRes, groupRes] = await Promise.all([
        fetch('/api/school/subjects'),
        fetch('/api/school/academic-structure/classes'),
        fetch('/api/school/academic-structure/groups'),
      ]);

      if (subjRes.status === 401 || subjRes.status === 403) {
        setPermissionDenied(true);
        setLoading(false);
        return;
      }

      const [subjData, classData, groupData] = await Promise.all([
        subjRes.json(),
        classRes.json(),
        groupRes.json(),
      ]);

      if (subjData.success) {
        setSubjects(subjData.data || []);
        setCanCreate(subjData.canCreate || false);
        setCanUpdate(subjData.canUpdate || false);
      }
      if (classData.success) {
        setClasses(classData.data || []);
        if (classData.data?.length > 0 && form.classId === '') {
           setForm(prev => ({ ...prev, classId: classData.data[0].id }));
        }
      }
      if (groupData.success) setGroups(groupData.data || []);
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMessage(e.message || 'ডাটা লোড করতে সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllData();
  }, []);

  function flashSuccess(msg: string) {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  }

  function openAddModal() {
    setEditingSubject(null);
    setForm({
      ...initialFormState,
      classId: classes[0]?.id || '',
    });
    setModalOpen(true);
  }

  function openEditModal(s: SubjectItem) {
    setEditingSubject(s);
    setForm({
      classId: s.classId,
      groupId: s.groupId || '',
      code: s.code,
      nameEn: s.nameEn,
      nameBn: s.nameBn,
      subjectType: s.subjectType,
      theoryMarks: Number(s.theoryMarks),
      practicalMarks: Number(s.practicalMarks),
      mcqMarks: Number(s.mcqMarks),
      vivaMarks: Number(s.vivaMarks),
      totalFullMarks: Number(s.totalFullMarks),
      passMarks: Number(s.passMarks),
      isCombinedSubject: s.isCombinedSubject,
      combinedWithSubjectId: s.combinedWithSubjectId || '',
      status: s.status,
    });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);

    try {
      const url = editingSubject
        ? `/api/school/subjects/${editingSubject.id}`
        : '/api/school/subjects';
      const method = editingSubject ? 'PATCH' : 'POST';

      const payload = {
        ...form,
        groupId: form.groupId || null,
        combinedWithSubjectId: form.combinedWithSubjectId || null,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'বিষয় সংরক্ষণ করতে ব্যর্থ হয়েছে।');
      }

      flashSuccess(editingSubject ? 'বিষয়ের তথ্য সফলভাবে আপডেট হয়েছে।' : 'নতুন বিষয় যোগ করা হয়েছে।');
      setModalOpen(false);
      loadAllData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMessage(e.message);
    } finally {
      setSaving(false);
    }
  }

  const filteredSubjects = classFilter === 'ALL'
    ? subjects
    : subjects.filter((s) => s.classId === classFilter);

  if (permissionDenied) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-800">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-600" />
          <h2 className="text-xl font-bold">অনুমতি নেই (Permission Denied)</h2>
          <p className="mt-2 text-sm text-red-700">
            বিষয়সমূহ দেখার বা পরিচালনা করার অনুমতি আপনার একাউন্টে নেই। বিদ্যালয় প্রশাসকের সাথে যোগাযোগ করুন।
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">বিষয়সমূহ (Subjects)</h1>
          <p className="mt-1 text-sm text-slate-600">
            বিদ্যালয়ের সকল শ্রেণির বিষয়সমূহ পরিচালনা করুন
          </p>
        </div>

        {canCreate && (
          <div className="flex gap-2">
            <button
              onClick={openAddModal}
              disabled={classes.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              নতুন বিষয় যোগ করুন
            </button>
          </div>
        )}
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="ml-auto text-red-600 hover:text-red-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="mt-3 text-sm text-slate-500">তথ্য লোড হচ্ছে...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Filter by class */}
          {classes.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Filter className="h-4 w-4 text-slate-500" />
                <span>শ্রেণি অনুসারে ফিল্টার:</span>
              </div>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="rounded-md border border-slate-300 bg-white py-1.5 px-3 text-sm text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">সকল শ্রেণি ({subjects.length} টি বিষয়)</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.nameBn} ({cls.nameEn})
                  </option>
                ))}
              </select>
            </div>
          )}

          {filteredSubjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="mt-3 text-base font-semibold text-slate-800">কোনো বিষয় পাওয়া যায়নি</h3>
              <p className="mt-1 text-sm text-slate-500">
                {classes.length === 0
                  ? 'বিষয় তৈরি করার পূর্বে কমপক্ষে একটি শ্রেণি যোগ করুন।'
                  : 'নির্বাচিত শ্রেণির অধীনে বিষয় যোগ করতে উপরের বাটনে ক্লিক করুন।'}
              </p>
              {canCreate && classes.length > 0 && (
                <button
                  onClick={openAddModal}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4" />
                  প্রথম বিষয় যোগ করুন
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 font-medium text-slate-600">
                    <tr>
                      <th className="px-6 py-3.5">কোড</th>
                      <th className="px-6 py-3.5">বিষয়ের নাম (বাংলা)</th>
                      <th className="px-6 py-3.5">Subject Name (En)</th>
                      <th className="px-6 py-3.5">শ্রেণি ও গ্রুপ</th>
                      <th className="px-6 py-3.5">ধরন</th>
                      <th className="px-6 py-3.5">পূর্ণ নম্বর</th>
                      <th className="px-6 py-3.5">অবস্থা</th>
                      {canUpdate && <th className="px-6 py-3.5 text-right">পদক্ষেপ</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSubjects.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4 font-mono text-sm font-semibold text-slate-700">{s.code}</td>
                        <td className="px-6 py-4 font-semibold text-slate-900">{s.nameBn}</td>
                        <td className="px-6 py-4 text-slate-700">{s.nameEn}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-slate-800">{s.class.nameBn}</span>
                            {s.group && (
                              <span className="inline-flex w-fit items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-100">
                                {s.group.nameBn}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-700">
                          <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 border border-amber-200">
                            {SUBJECT_TYPE_LABELS[s.subjectType] || s.subjectType}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-700 font-medium">
                          {Number(s.totalFullMarks)}
                        </td>
                        <td className="px-6 py-4">
                          {s.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                              সক্রিয়
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                              নিষ্ক্রিয়
                            </span>
                          )}
                        </td>
                        {canUpdate && (
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => openEditModal(s)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              সম্পাদনা
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-800">
                {editingSubject ? 'বিষয় সম্পাদনা করুন' : 'নতুন বিষয় যোগ করুন'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Basic Info */}
                <div className="space-y-4 md:col-span-2">
                  <h3 className="font-semibold text-slate-700 border-b pb-2">সাধারণ তথ্য</h3>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        শ্রেণি (Class) <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={form.classId}
                        onChange={(e) => setForm({ ...form, classId: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      >
                        <option value="">শ্রেণি নির্বাচন করুন</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nameBn} ({c.nameEn})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        গ্রুপ / বিভাগ (Group) (ঐচ্ছিক)
                      </label>
                      <select
                        value={form.groupId}
                        onChange={(e) => setForm({ ...form, groupId: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      >
                        <option value="">গ্রুপ নির্বাচন করুন</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.nameBn} ({g.nameEn})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        বিষয় কোড (Subject Code) <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        value={form.code}
                        onChange={(e) => setForm({ ...form, code: e.target.value })}
                        placeholder="যেমন: 101, BAN-1"
                        className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        বিষয়ের ধরন (Subject Type)
                      </label>
                      <select
                        required
                        value={form.subjectType}
                        onChange={(e) => setForm({ ...form, subjectType: e.target.value as SubjectType })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      >
                        {Object.entries(SUBJECT_TYPE_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        বিষয়ের নাম (বাংলা) <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        value={form.nameBn}
                        onChange={(e) => setForm({ ...form, nameBn: e.target.value })}
                        placeholder="যেমন: বাংলা ১ম পত্র"
                        className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Subject Name (English) <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        value={form.nameEn}
                        onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                        placeholder="e.g. Bangla 1st Paper"
                        className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>
                </div>

                {/* Marks Distribution */}
                <div className="space-y-4 md:col-span-2">
                  <h3 className="font-semibold text-slate-700 border-b pb-2">নম্বর বন্টন (Marks Distribution)</h3>
                  
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">তত্ত্বীয় (Theory)</label>
                      <input
                        type="number"
                        min="0"
                        value={form.theoryMarks}
                        onChange={(e) => setForm({ ...form, theoryMarks: Number(e.target.value) })}
                        className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">এমসিকিউ (MCQ)</label>
                      <input
                        type="number"
                        min="0"
                        value={form.mcqMarks}
                        onChange={(e) => setForm({ ...form, mcqMarks: Number(e.target.value) })}
                        className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">ব্যবহারিক (Practical)</label>
                      <input
                        type="number"
                        min="0"
                        value={form.practicalMarks}
                        onChange={(e) => setForm({ ...form, practicalMarks: Number(e.target.value) })}
                        className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">মৌখিক (Viva)</label>
                      <input
                        type="number"
                        min="0"
                        value={form.vivaMarks}
                        onChange={(e) => setForm({ ...form, vivaMarks: Number(e.target.value) })}
                        className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">পূর্ণ নম্বর (Total)</label>
                      <input
                        required
                        type="number"
                        min="0"
                        value={form.totalFullMarks}
                        onChange={(e) => setForm({ ...form, totalFullMarks: Number(e.target.value) })}
                        className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm bg-slate-50 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">পাস নম্বর (Pass)</label>
                      <input
                        required
                        type="number"
                        min="0"
                        value={form.passMarks}
                        onChange={(e) => setForm({ ...form, passMarks: Number(e.target.value) })}
                        className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">অবস্থা (Status)</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as RecordStatus })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="ACTIVE">সক্রিয় (Active)</option>
                    <option value="INACTIVE">নিষ্ক্রিয় (Inactive)</option>
                  </select>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  বাতিল করুন
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> সংরক্ষণ হচ্ছে...
                    </>
                  ) : (
                    'সংরক্ষণ করুন'
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
