'use client';

import React, { useEffect, useState } from 'react';
import {
  GraduationCap,
  Layers,
  Clock,
  BookmarkCheck,
  Plus,
  Pencil,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Building2,
  Filter,
} from 'lucide-react';

type TabKey = 'classes' | 'sections' | 'shifts' | 'groups';

// ============================================================================
// DATA TYPES
// ============================================================================

interface ClassItem {
  id: string;
  nameEn: string;
  nameBn: string;
  numericLevel: number;
  category: 'PRE_PRIMARY' | 'PRIMARY' | 'JUNIOR_SECONDARY' | 'SECONDARY' | 'HIGHER_SECONDARY';
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  _count?: {
    sections: number;
  };
}

interface SectionItem {
  id: string;
  schoolId: string;
  classId: string;
  campusId: string | null;
  groupId: string | null;
  nameEn: string;
  nameBn: string;
  shift: 'MORNING' | 'DAY' | 'EVENING';
  genderType: 'BOYS' | 'GIRLS' | 'CO_ED';
  maxCapacity: number;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  class: {
    id: string;
    nameEn: string;
    nameBn: string;
    numericLevel: number;
    category: string;
  };
  campus: {
    id: string;
    code: string;
    nameEn: string;
    nameBn: string;
  } | null;
  group: {
    id: string;
    code: string;
    nameEn: string;
    nameBn: string;
  } | null;
  _count?: {
    enrollments: number;
  };
}

interface ShiftItem {
  shift: 'MORNING' | 'DAY' | 'EVENING';
  nameEn: string;
  nameBn: string;
  isEnabled: boolean;
  startTime: string;
  endTime: string;
  sectionCount: number;
}

interface GroupItem {
  id: string;
  schoolId: string;
  code: string;
  nameEn: string;
  nameBn: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  _count?: {
    sections: number;
    subjects: number;
    enrollments: number;
  };
}

interface CampusSimple {
  id: string;
  code: string;
  nameEn: string;
  nameBn: string;
}

// ============================================================================
// LABELS & HELPERS
// ============================================================================

const CATEGORY_LABELS: Record<string, string> = {
  PRE_PRIMARY: 'প্রাক-প্রাথমিক',
  PRIMARY: 'প্রাথমিক',
  JUNIOR_SECONDARY: 'নিম্ন মাধ্যমিক',
  SECONDARY: 'মাধ্যমিক',
  HIGHER_SECONDARY: 'উচ্চ মাধ্যমিক',
};

const SHIFT_LABELS: Record<string, string> = {
  MORNING: 'প্রভাতী / মর্নিং',
  DAY: 'দিবা / ডে',
  EVENING: 'সান্ধ্য / ইভনিং',
};

const GENDER_LABELS: Record<string, string> = {
  CO_ED: 'সহশিক্ষা (ছেলে ও মেয়ে)',
  BOYS: 'শুধুমাত্র ছাত্র (ছেলে)',
  GIRLS: 'শুধুমাত্র ছাত্রী (মেয়ে)',
};

export default function AcademicStructurePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('classes');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Permissions state
  const [canCreate, setCanCreate] = useState(false);
  const [canUpdate, setCanUpdate] = useState(false);
  const [, setCanDelete] = useState(false);

  // Core Data
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [campuses, setCampuses] = useState<CampusSimple[]>([]);

  // Section Filters
  const [sectionClassFilter, setSectionClassFilter] = useState<string>('ALL');

  // Modals
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [classForm, setClassForm] = useState({
    nameEn: '',
    nameBn: '',
    numericLevel: 1,
    category: 'PRIMARY' as ClassItem['category'],
    status: 'ACTIVE' as ClassItem['status'],
  });

  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<SectionItem | null>(null);
  const [sectionForm, setSectionForm] = useState({
    classId: '',
    campusId: '',
    groupId: '',
    nameEn: '',
    nameBn: '',
    shift: 'DAY' as 'MORNING' | 'DAY' | 'EVENING',
    genderType: 'CO_ED' as 'BOYS' | 'GIRLS' | 'CO_ED',
    maxCapacity: 50,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'ARCHIVED',
  });

  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupItem | null>(null);
  const [groupForm, setGroupForm] = useState({
    code: '',
    nameEn: '',
    nameBn: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'ARCHIVED',
  });

  // Load all academic structure data
  async function loadAllData() {
    setLoading(true);
    setErrorMessage(null);
    setPermissionDenied(false);

    try {
      const [classRes, secRes, shiftRes, groupRes, campusRes] = await Promise.all([
        fetch('/api/school/academic-structure/classes'),
        fetch('/api/school/academic-structure/sections'),
        fetch('/api/school/academic-structure/shifts'),
        fetch('/api/school/academic-structure/groups'),
        fetch('/api/school/campuses'),
      ]);

      if (classRes.status === 401 || classRes.status === 403) {
        setPermissionDenied(true);
        setLoading(false);
        return;
      }

      const [classData, secData, shiftData, groupData, campusData] = await Promise.all([
        classRes.json(),
        secRes.json(),
        shiftRes.json(),
        groupRes.json(),
        campusRes.json(),
      ]);

      if (classData.success) {
        setClasses(classData.data || []);
        setCanCreate(classData.canCreate || false);
        setCanUpdate(classData.canUpdate || false);
        setCanDelete(classData.canDelete || false);
      }
      if (secData.success) setSections(secData.data || []);
      if (shiftData.success) setShifts(shiftData.data || []);
      if (groupData.success) setGroups(groupData.data || []);
      if (campusData.success) setCampuses(campusData.data || []);
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

  // Flash notification helper
  function flashSuccess(msg: string) {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  }

  // ============================================================================
  // CLASS HANDLERS
  // ============================================================================
  function openAddClass() {
    setEditingClass(null);
    setClassForm({
      nameEn: '',
      nameBn: '',
      numericLevel: classes.length > 0 ? Math.max(...classes.map((c) => c.numericLevel)) + 1 : 1,
      category: 'PRIMARY',
      status: 'ACTIVE',
    });
    setClassModalOpen(true);
  }

  function openEditClass(c: ClassItem) {
    setEditingClass(c);
    setClassForm({
      nameEn: c.nameEn,
      nameBn: c.nameBn,
      numericLevel: c.numericLevel,
      category: c.category,
      status: c.status,
    });
    setClassModalOpen(true);
  }

  async function handleSaveClass(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);

    try {
      const url = editingClass
        ? `/api/school/academic-structure/classes/${editingClass.id}`
        : '/api/school/academic-structure/classes';
      const method = editingClass ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(classForm),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'শ্রেণি সংরক্ষণ করতে ব্যর্থ হয়েছে।');
      }

      flashSuccess(editingClass ? 'শ্রেণির তথ্য সফলভাবে আপডেট হয়েছে।' : 'নতুন শ্রেণি যোগ করা হয়েছে।');
      setClassModalOpen(false);
      loadAllData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMessage(e.message);
    } finally {
      setSaving(false);
    }
  }

  // ============================================================================
  // SECTION HANDLERS
  // ============================================================================
  function openAddSection() {
    setEditingSection(null);
    setSectionForm({
      classId: classes[0]?.id || '',
      campusId: '',
      groupId: '',
      nameEn: '',
      nameBn: '',
      shift: 'DAY',
      genderType: 'CO_ED',
      maxCapacity: 50,
      status: 'ACTIVE',
    });
    setSectionModalOpen(true);
  }

  function openEditSection(s: SectionItem) {
    setEditingSection(s);
    setSectionForm({
      classId: s.classId,
      campusId: s.campusId || '',
      groupId: s.groupId || '',
      nameEn: s.nameEn,
      nameBn: s.nameBn,
      shift: s.shift,
      genderType: s.genderType,
      maxCapacity: s.maxCapacity,
      status: s.status,
    });
    setSectionModalOpen(true);
  }

  async function handleSaveSection(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);

    try {
      const url = editingSection
        ? `/api/school/academic-structure/sections/${editingSection.id}`
        : '/api/school/academic-structure/sections';
      const method = editingSection ? 'PATCH' : 'POST';

      const payload = {
        ...sectionForm,
        campusId: sectionForm.campusId || null,
        groupId: sectionForm.groupId || null,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'শাখা সংরক্ষণ করতে ব্যর্থ হয়েছে।');
      }

      flashSuccess(editingSection ? 'শাখার তথ্য সফলভাবে আপডেট হয়েছে।' : 'নতুন শাখা যোগ করা হয়েছে।');
      setSectionModalOpen(false);
      loadAllData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMessage(e.message);
    } finally {
      setSaving(false);
    }
  }

  // ============================================================================
  // GROUP HANDLERS
  // ============================================================================
  function openAddGroup() {
    setEditingGroup(null);
    setGroupForm({
      code: '',
      nameEn: '',
      nameBn: '',
      status: 'ACTIVE',
    });
    setGroupModalOpen(true);
  }

  function openEditGroup(g: GroupItem) {
    setEditingGroup(g);
    setGroupForm({
      code: g.code,
      nameEn: g.nameEn,
      nameBn: g.nameBn,
      status: g.status,
    });
    setGroupModalOpen(true);
  }

  async function handleSaveGroup(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);

    try {
      const url = editingGroup
        ? `/api/school/academic-structure/groups/${editingGroup.id}`
        : '/api/school/academic-structure/groups';
      const method = editingGroup ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupForm),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'গ্রুপ সংরক্ষণ করতে ব্যর্থ হয়েছে।');
      }

      flashSuccess(editingGroup ? 'গ্রুপের তথ্য সফলভাবে আপডেট হয়েছে।' : 'নতুন গ্রুপ যোগ করা হয়েছে।');
      setGroupModalOpen(false);
      loadAllData();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMessage(e.message);
    } finally {
      setSaving(false);
    }
  }

  // Filtered sections
  const filteredSections =
    sectionClassFilter === 'ALL'
      ? sections
      : sections.filter((s) => s.classId === sectionClassFilter);

  // If permission denied
  if (permissionDenied) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-800">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-600" />
          <h2 className="text-xl font-bold">অনুমতি নেই (Permission Denied)</h2>
          <p className="mt-2 text-sm text-red-700">
            শিক্ষাগত কাঠামো দেখার বা পরিচালনা করার অনুমতি আপনার একাউন্টে নেই। বিদ্যালয় প্রশাসকের সাথে যোগাযোগ করুন।
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
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">শিক্ষাগত কাঠামো (Academic Structure)</h1>
          <p className="mt-1 text-sm text-slate-600">
            শ্রেণি, শাখা, শিফট এবং বিভাগ (গ্রুপ) এর সার্বিক একাডেমিক ব্যবস্থাপনা
          </p>
        </div>

        {/* Global Action depending on Tab */}
        {canCreate && (
          <div className="flex gap-2">
            {activeTab === 'classes' && (
              <button
                onClick={openAddClass}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                <Plus className="h-4 w-4" />
                নতুন শ্রেণি যোগ করুন
              </button>
            )}
            {activeTab === 'sections' && (
              <button
                onClick={openAddSection}
                disabled={classes.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                নতুন শাখা যোগ করুন
              </button>
            )}
            {activeTab === 'groups' && (
              <button
                onClick={openAddGroup}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                <Plus className="h-4 w-4" />
                নতুন গ্রুপ যোগ করুন
              </button>
            )}
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

      {/* Tabs Bar */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('classes')}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors ${
              activeTab === 'classes'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            শ্রেণি (Classes)
            <span className="ml-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
              {classes.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('sections')}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors ${
              activeTab === 'sections'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <Layers className="h-4 w-4" />
            শাখা (Sections)
            <span className="ml-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
              {sections.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('shifts')}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors ${
              activeTab === 'shifts'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <Clock className="h-4 w-4" />
            শিফট (Shifts)
            <span className="ml-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
              {shifts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('groups')}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors ${
              activeTab === 'groups'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <BookmarkCheck className="h-4 w-4" />
            গ্রুপ / বিভাগ (Groups)
            <span className="ml-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
              {groups.length}
            </span>
          </button>
        </nav>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="mt-3 text-sm text-slate-500">তথ্য লোড হচ্ছে...</p>
        </div>
      ) : (
        <div>
          {/* TAB 1: CLASSES */}
          {activeTab === 'classes' && (
            <div className="space-y-4">
              {classes.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
                  <GraduationCap className="mx-auto h-12 w-12 text-slate-400" />
                  <h3 className="mt-3 text-base font-semibold text-slate-800">কোনো শ্রেণি যোগ করা হয়নি</h3>
                  <p className="mt-1 text-sm text-slate-500">আপনার বিদ্যালয়ের শ্রেণি বা স্ট্যান্ডার্ডগুলো যোগ করুন।</p>
                  {canCreate && (
                    <button
                      onClick={openAddClass}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                      <Plus className="h-4 w-4" />
                      প্রথম শ্রেণি যোগ করুন
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50 font-medium text-slate-600">
                        <tr>
                          <th className="px-6 py-3.5">শ্রেণির নাম (বাংলা)</th>
                          <th className="px-6 py-3.5">Name (English)</th>
                          <th className="px-6 py-3.5">ক্রমিক নম্বর</th>
                          <th className="px-6 py-3.5">বিভাগ / পর্যায়</th>
                          <th className="px-6 py-3.5">শাখা সংখ্যা</th>
                          <th className="px-6 py-3.5">অবস্থা</th>
                          {canUpdate && <th className="px-6 py-3.5 text-right">পদক্ষেপ</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {classes.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-6 py-4 font-semibold text-slate-900">{c.nameBn}</td>
                            <td className="px-6 py-4 text-slate-700">{c.nameEn}</td>
                            <td className="px-6 py-4">
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 font-mono text-xs font-semibold text-slate-800">
                                {c.numericLevel}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-600">
                              <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 border border-blue-100">
                                {CATEGORY_LABELS[c.category] || c.category}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-700 font-medium">
                              {c._count?.sections || 0} টি শাখা
                            </td>
                            <td className="px-6 py-4">
                              {c.status === 'ACTIVE' ? (
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
                                  onClick={() => openEditClass(c)}
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

          {/* TAB 2: SECTIONS */}
          {activeTab === 'sections' && (
            <div className="space-y-4">
              {/* Filter by class */}
              {classes.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Filter className="h-4 w-4 text-slate-500" />
                    <span>শ্রেণি অনুসারে ফিল্টার:</span>
                  </div>
                  <select
                    value={sectionClassFilter}
                    onChange={(e) => setSectionClassFilter(e.target.value)}
                    className="rounded-md border border-slate-300 bg-white py-1.5 px-3 text-sm text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="ALL">সকল শ্রেণি ({sections.length} টি শাখা)</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.nameBn} ({cls.nameEn})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {filteredSections.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
                  <Layers className="mx-auto h-12 w-12 text-slate-400" />
                  <h3 className="mt-3 text-base font-semibold text-slate-800">কোনো শাখা পাওয়া যায়নি</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {classes.length === 0
                      ? 'শাখা তৈরি করার পূর্বে কমপক্ষে একটি শ্রেণি যোগ করুন।'
                      : 'নির্বাচিত শ্রেণির অধীনে শাখা যোগ করতে উপরের বাটনে ক্লিক করুন।'}
                  </p>
                  {canCreate && classes.length > 0 && (
                    <button
                      onClick={openAddSection}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                      <Plus className="h-4 w-4" />
                      শাখা যোগ করুন
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50 font-medium text-slate-600">
                        <tr>
                          <th className="px-6 py-3.5">শাখার নাম (বাংলা)</th>
                          <th className="px-6 py-3.5">Section Name (En)</th>
                          <th className="px-6 py-3.5">শ্রেণি</th>
                          <th className="px-6 py-3.5">শিফট</th>
                          <th className="px-6 py-3.5">ক্যাম্পাস / শাখা</th>
                          <th className="px-6 py-3.5">বিভাগ (গ্রুপ)</th>
                          <th className="px-6 py-3.5">লিঙ্গ / ধরন</th>
                          <th className="px-6 py-3.5">ধারণক্ষমতা</th>
                          <th className="px-6 py-3.5">অবস্থা</th>
                          {canUpdate && <th className="px-6 py-3.5 text-right">পদক্ষেপ</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredSections.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-6 py-4 font-semibold text-slate-900">{s.nameBn}</td>
                            <td className="px-6 py-4 text-slate-700">{s.nameEn}</td>
                            <td className="px-6 py-4 text-slate-800 font-medium">
                              {s.class.nameBn} ({s.class.nameEn})
                            </td>
                            <td className="px-6 py-4 text-slate-700">
                              <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 border border-amber-200">
                                {SHIFT_LABELS[s.shift] || s.shift}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-600">
                              {s.campus ? (
                                <span className="inline-flex items-center gap-1 text-xs">
                                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                                  {s.campus.nameBn}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">সকল ক্যাম্পাস</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-slate-600">
                              {s.group ? (
                                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                                  {s.group.nameBn}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">প্রযোজ্য নয়</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-600">
                              {GENDER_LABELS[s.genderType] || s.genderType}
                            </td>
                            <td className="px-6 py-4 text-slate-700 font-mono text-xs">
                              {s.maxCapacity} জন
                            </td>
                            <td className="px-6 py-4">
                              {s.status === 'ACTIVE' ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                                  সক্রিয়
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
                                  নিষ্ক্রিয়
                                </span>
                              )}
                            </td>
                            {canUpdate && (
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => openEditSection(s)}
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

          {/* TAB 3: SHIFTS */}
          {activeTab === 'shifts' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-800">
                <p className="font-semibold">শিফট ব্যবস্থাপনা সংক্রান্ত নির্দেশিকা:</p>
                <p className="mt-1 text-xs text-blue-700">
                  বাংলাদেশের শিক্ষাব্যবস্থায় স্কুলগুলোতে সাধারণত প্রভাতী (Morning), দিবা (Day) অথবা সান্ধ্য (Evening) শিফট চালু থাকে। আপনার বিদ্যালয়ে যেসকল শিফটে শিক্ষা কার্যক্রম পরিচালিত হয়, শাখা তৈরির সময় তা নির্বাচন করা যাবে।
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {shifts.map((sh) => (
                  <div
                    key={sh.shift}
                    className={`rounded-xl border p-5 shadow-sm transition-all ${
                      sh.isEnabled
                        ? 'border-emerald-200 bg-white'
                        : 'border-slate-200 bg-slate-50 opacity-75'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="inline-flex rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                          {sh.shift}
                        </span>
                        <h3 className="mt-2 text-lg font-bold text-slate-900">{sh.nameBn}</h3>
                        <p className="text-xs text-slate-500">{sh.nameEn}</p>
                      </div>
                      <div className="rounded-full bg-slate-100 p-2 text-slate-600">
                        <Clock className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="mt-4 border-t border-slate-100 pt-4 space-y-2 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span>কার্যক্রমের সময়:</span>
                        <span className="font-mono font-medium text-slate-900">
                          {sh.startTime} - {sh.endTime}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>বর্তমানে পরিচালিত শাখা:</span>
                        <span className="font-semibold text-emerald-700">
                          {sh.sectionCount} টি
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>স্ট্যাটাস:</span>
                        <span className="font-medium text-emerald-600">অনুমোদিত (Enabled)</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: GROUPS */}
          {activeTab === 'groups' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-4 text-sm text-amber-900">
                <p className="font-semibold">গ্রুপ / বিভাগ সংক্রান্ত নির্দেশিকা:</p>
                <p className="mt-1 text-xs text-amber-800">
                  নবম-দশম বা একাদশ-দ্বাদশ শ্রেণির শিক্ষার্থীদের জন্য বিজ্ঞান (Science), ব্যবসায় শিক্ষা (Commerce / Business Studies) এবং মানবিক (Humanities) গ্রুপ প্রযোজ্য হয়। প্রাথমিক বা নিম্ন-মাধ্যমিক শ্রেণির ক্ষেত্রে এটি ঐচ্ছিক (প্রযোজ্য নয়)।
                </p>
              </div>

              {groups.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
                  <BookmarkCheck className="mx-auto h-12 w-12 text-slate-400" />
                  <h3 className="mt-3 text-base font-semibold text-slate-800">কোনো গ্রুপ তৈরি করা হয়নি</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    মাধ্যমিক ও উচ্চ মাধ্যমিক শ্রেণির জন্য বিজ্ঞান, ব্যবসায় শিক্ষা বা মানবিক গ্রুপ তৈরি করুন।
                  </p>
                  {canCreate && (
                    <button
                      onClick={openAddGroup}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                      <Plus className="h-4 w-4" />
                      গ্রুপ তৈরি করুন
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50 font-medium text-slate-600">
                        <tr>
                          <th className="px-6 py-3.5">গ্রুপ কোড</th>
                          <th className="px-6 py-3.5">গ্রুপের নাম (বাংলা)</th>
                          <th className="px-6 py-3.5">Group Name (En)</th>
                          <th className="px-6 py-3.5">সংযুক্ত শাখা</th>
                          <th className="px-6 py-3.5">অবস্থা</th>
                          {canUpdate && <th className="px-6 py-3.5 text-right">পদক্ষেপ</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {groups.map((g) => (
                          <tr key={g.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-6 py-4 font-mono font-bold text-slate-800">
                              <span className="rounded bg-slate-100 px-2 py-1 text-xs">
                                {g.code}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-semibold text-slate-900">{g.nameBn}</td>
                            <td className="px-6 py-4 text-slate-700">{g.nameEn}</td>
                            <td className="px-6 py-4 text-slate-700 font-medium">
                              {g._count?.sections || 0} টি শাখা
                            </td>
                            <td className="px-6 py-4">
                              {g.status === 'ACTIVE' ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
                                  সক্রিয়
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200">
                                  নিষ্ক্রিয়
                                </span>
                              )}
                            </td>
                            {canUpdate && (
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => openEditGroup(g)}
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
        </div>
      )}

      {/* ======================================================================= */}
      {/* MODAL: CLASS CREATE / EDIT */}
      {/* ======================================================================= */}
      {classModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900">
                {editingClass ? 'শ্রেণি সম্পাদনা করুন' : 'নতুন শ্রেণি যোগ করুন'}
              </h2>
              <button
                onClick={() => setClassModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClass} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  শ্রেণির নাম (বাংলা) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: ষষ্ঠ শ্রেণি"
                  value={classForm.nameBn}
                  onChange={(e) => setClassForm({ ...classForm, nameBn: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Class Name (English) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Class 6"
                  value={classForm.nameEn}
                  onChange={(e) => setClassForm({ ...classForm, nameEn: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    ক্রমিক নম্বর (Numeric Level) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={classForm.numericLevel}
                    onChange={(e) => setClassForm({ ...classForm, numericLevel: parseInt(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="text-[11px] text-slate-400">ধারাবাহিক ক্রম (যেমন: ১, ২, ৬)</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    পর্যায় / শ্রেণি বিভাগ <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={classForm.category}
                    onChange={(e) => setClassForm({ ...classForm, category: e.target.value as ClassItem['category'] })}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="PRE_PRIMARY">প্রাক-প্রাথমিক</option>
                    <option value="PRIMARY">প্রাথমিক</option>
                    <option value="JUNIOR_SECONDARY">নিম্ন মাধ্যমিক</option>
                    <option value="SECONDARY">মাধ্যমিক</option>
                    <option value="HIGHER_SECONDARY">উচ্চ মাধ্যমিক</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">অবস্থা (Status)</label>
                <select
                  value={classForm.status}
                  onChange={(e) => setClassForm({ ...classForm, status: e.target.value as ClassItem['status'] })}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="ACTIVE">সক্রিয় (Active)</option>
                  <option value="INACTIVE">নিষ্ক্রিয় (Inactive)</option>
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setClassModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingClass ? 'সংরক্ষণ করুন' : 'তৈরি করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* MODAL: SECTION CREATE / EDIT */}
      {/* ======================================================================= */}
      {sectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900">
                {editingSection ? 'শাখা সম্পাদনা করুন' : 'নতুন শাখা যোগ করুন'}
              </h2>
              <button
                onClick={() => setSectionModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSection} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  শ্রেণি নির্বাচন করুন <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={sectionForm.classId}
                  onChange={(e) => setSectionForm({ ...sectionForm, classId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameBn} ({c.nameEn})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    শাখার নাম (বাংলা) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: ক, পদ্মা, গোলাপ"
                    value={sectionForm.nameBn}
                    onChange={(e) => setSectionForm({ ...sectionForm, nameBn: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Section Name (English) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. A, Padma, Rose"
                    value={sectionForm.nameEn}
                    onChange={(e) => setSectionForm({ ...sectionForm, nameEn: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    শিফট <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={sectionForm.shift}
                    onChange={(e) => setSectionForm({ ...sectionForm, shift: e.target.value as 'MORNING' | 'DAY' | 'EVENING' })}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="MORNING">প্রভাতী / মর্নিং (Morning)</option>
                    <option value="DAY">দিবা / ডে (Day)</option>
                    <option value="EVENING">সান্ধ্য / ইভনিং (Evening)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    লিঙ্গ / শিক্ষার্থী ধরন
                  </label>
                  <select
                    value={sectionForm.genderType}
                    onChange={(e) => setSectionForm({ ...sectionForm, genderType: e.target.value as 'BOYS' | 'GIRLS' | 'CO_ED' })}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="CO_ED">সহশিক্ষা (ছেলে ও মেয়ে)</option>
                    <option value="BOYS">শুধুমাত্র ছাত্র (ছেলে)</option>
                    <option value="GIRLS">শুধুমাত্র ছাত্রী (মেয়ে)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    ক্যাম্পাস / শাখা (ঐচ্ছিক)
                  </label>
                  <select
                    value={sectionForm.campusId}
                    onChange={(e) => setSectionForm({ ...sectionForm, campusId: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">সকল ক্যাম্পাস (Campus Wide)</option>
                    {campuses.map((cmp) => (
                      <option key={cmp.id} value={cmp.id}>
                        {cmp.nameBn} ({cmp.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    গ্রুপ / বিভাগ (ঐচ্ছিক)
                  </label>
                  <select
                    value={sectionForm.groupId}
                    onChange={(e) => setSectionForm({ ...sectionForm, groupId: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">কোনো গ্রুপ নেই (সাধারণ)</option>
                    {groups.map((grp) => (
                      <option key={grp.id} value={grp.id}>
                        {grp.nameBn} ({grp.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    সর্বোচ্চ ধারণক্ষমতা (Max Capacity)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={sectionForm.maxCapacity}
                    onChange={(e) => setSectionForm({ ...sectionForm, maxCapacity: parseInt(e.target.value) || 50 })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">অবস্থা (Status)</label>
                  <select
                    value={sectionForm.status}
                    onChange={(e) => setSectionForm({ ...sectionForm, status: e.target.value as 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' })}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="ACTIVE">সক্রিয় (Active)</option>
                    <option value="INACTIVE">নিষ্ক্রিয় (Inactive)</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setSectionModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingSection ? 'সংরক্ষণ করুন' : 'তৈরি করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* MODAL: GROUP CREATE / EDIT */}
      {/* ======================================================================= */}
      {groupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900">
                {editingGroup ? 'গ্রুপ সম্পাদনা করুন' : 'নতুন গ্রুপ যোগ করুন'}
              </h2>
              <button
                onClick={() => setGroupModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  গ্রুপ কোড (যেমন: SCIENCE, COMMERCE) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="SCIENCE"
                  value={groupForm.code}
                  onChange={(e) => setGroupForm({ ...groupForm, code: e.target.value.toUpperCase() })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  গ্রুপের নাম (বাংলা) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: বিজ্ঞান"
                  value={groupForm.nameBn}
                  onChange={(e) => setGroupForm({ ...groupForm, nameBn: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Group Name (English) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Science"
                  value={groupForm.nameEn}
                  onChange={(e) => setGroupForm({ ...groupForm, nameEn: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">অবস্থা (Status)</label>
                <select
                  value={groupForm.status}
                  onChange={(e) => setGroupForm({ ...groupForm, status: e.target.value as 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' })}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="ACTIVE">সক্রিয় (Active)</option>
                  <option value="INACTIVE">নিষ্ক্রিয় (Inactive)</option>
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setGroupModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingGroup ? 'সংরক্ষণ করুন' : 'তৈরি করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
