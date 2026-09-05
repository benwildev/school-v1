'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  GraduationCap,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Users,
  Sparkles,
  Info,
  CheckSquare,
  Square,
} from 'lucide-react';

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

interface SectionItem {
  id: string;
  nameEn: string;
  nameBn: string;
  classId: string;
}

interface EnrolledStudentRow {
  enrollmentId: string;
  studentId: string;
  studentCode: string;
  fullNameBn: string;
  fullNameEn: string;
  currentRoll: number;
  selected: boolean;
  action: 'PROMOTED' | 'RETAINED_REPEATER' | 'PASSED_OUT' | 'DROPPED';
  targetSectionId: string;
  targetRollNo: string;
}

export default function PromotionWizardPage() {
  const router = useRouter();

  // Dropdown options
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);

  // Selection state
  const [sourceSessionId, setSourceSessionId] = useState('');
  const [targetSessionId, setTargetSessionId] = useState('');
  const [sourceClassId, setSourceClassId] = useState('');
  const [targetClassId, setTargetClassId] = useState('');
  const [sourceSectionId, setSourceSectionId] = useState('');
  const [defaultTargetSectionId, setDefaultTargetSectionId] = useState('');

  // Table rows
  const [rows, setRows] = useState<EnrolledStudentRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load Metadata
  useEffect(() => {
    async function loadMetadata() {
      try {
        const [sessRes, clsRes, secRes] = await Promise.all([
          fetch('/api/school/academic-sessions'),
          fetch('/api/school/academic-structure?type=classes'),
          fetch('/api/school/academic-structure?type=sections'),
        ]);

        if (sessRes.ok) {
          const data = await sessRes.json();
          const sessList: AcademicSession[] = data.data || [];
          setSessions(sessList);
          const current = sessList.find((s) => s.isCurrent);
          if (current) {
            setSourceSessionId(current.id);
            // Auto select next session if exists
            const other = sessList.find((s) => s.id !== current.id);
            if (other) setTargetSessionId(other.id);
          }
        }

        if (clsRes.ok) {
          const data = await clsRes.json();
          setClasses(data.data || []);
        }

        if (secRes.ok) {
          const data = await secRes.json();
          setSections(data.data || []);
        }
      } catch (err) {
        console.error('Failed to load promotion metadata:', err);
      }
    }
    loadMetadata();
  }, []);

  // When source class changes, suggest next class for target
  useEffect(() => {
    if (sourceClassId && classes.length > 0) {
      const src = classes.find((c) => c.id === sourceClassId);
      if (src) {
        const nextClass = classes.find((c) => c.numericLevel === src.numericLevel + 1);
        if (nextClass) {
          setTargetClassId(nextClass.id);
        }
      }
    }
  }, [sourceClassId, classes]);

  // Load Students for Selected Source
  async function handleLoadStudents() {
    if (!sourceSessionId || !sourceClassId) {
      setError('দয়া করে উৎস শিক্ষাবর্ষ ও শ্রেণী নির্বাচন করুন।');
      return;
    }
    setError(null);
    setLoadingStudents(true);
    setRows([]);
    try {
      const params = new URLSearchParams({
        academicSessionId: sourceSessionId,
        classId: sourceClassId,
        status: 'ACTIVE',
        pageSize: '100',
      });
      if (sourceSectionId) params.set('sectionId', sourceSectionId);

      const res = await fetch(`/api/school/enrollments?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'শিক্ষার্থীদের তথ্য লোড করা যায়নি।');
      }

      const list = data.data || [];
      const targetSecs = sections.filter((s) => s.classId === targetClassId);
      const defSec = defaultTargetSectionId || targetSecs[0]?.id || '';

      const mapped: EnrolledStudentRow[] = list.map(
        (item: {
          id: string;
          studentId: string;
          rollNo: number;
          student: {
            studentCode: string;
            fullNameBn: string;
            fullNameEn: string;
          };
        }, idx: number) => ({
          enrollmentId: item.id,
          studentId: item.studentId,
          studentCode: item.student.studentCode,
          fullNameBn: item.student.fullNameBn,
          fullNameEn: item.student.fullNameEn,
          currentRoll: item.rollNo,
          selected: true,
          action: 'PROMOTED',
          targetSectionId: defSec,
          targetRollNo: (idx + 1).toString(),
        })
      );

      setRows(mapped);
      if (mapped.length === 0) {
        setError('নির্বাচিত শ্রেণী ও শাখায় কোনো সক্রিয় শিক্ষার্থী পাওয়া যায়নি।');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'ত্রুটি ঘটেছে।';
      setError(message);
    } finally {
      setLoadingStudents(false);
    }
  }

  // Toggle selection
  function toggleAll(selectAll: boolean) {
    setRows((prev) => prev.map((r) => ({ ...r, selected: selectAll })));
  }

  function updateRow(enrollmentId: string, updates: Partial<EnrolledStudentRow>) {
    setRows((prev) =>
      prev.map((r) => (r.enrollmentId === enrollmentId ? { ...r, ...updates } : r))
    );
  }

  // Submit Promotion Batch
  async function handleExecutePromotion() {
    const selectedRows = rows.filter((r) => r.selected);
    if (selectedRows.length === 0) {
      setError('কমপক্ষে একজন শিক্ষার্থী নির্বাচন করুন।');
      return;
    }

    // Validation
    const targetRolls = new Set<string>();
    for (const r of selectedRows) {
      if (['PROMOTED', 'RETAINED_REPEATER'].includes(r.action)) {
        if (!r.targetSectionId) {
          setError(`শিক্ষার্থী ${r.fullNameBn}-এর লক্ষ্য শাখা নির্ধারিত নেই।`);
          return;
        }
        if (!r.targetRollNo || parseInt(r.targetRollNo, 10) <= 0) {
          setError(`শিক্ষার্থী ${r.fullNameBn}-এর লক্ষ্য রোল নম্বর প্রদান করুন।`);
          return;
        }
        const key = `${r.targetSectionId}_${r.targetRollNo}`;
        if (targetRolls.has(key)) {
          setError(`লক্ষ্য শাখায় ডুপ্লিকেট রোল (${r.targetRollNo}) শনাক্ত হয়েছে।`);
          return;
        }
        targetRolls.add(key);
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        sourceSessionId,
        targetSessionId,
        notes: `Promotion from ${classes.find((c) => c.id === sourceClassId)?.nameEn} to ${classes.find((c) => c.id === targetClassId)?.nameEn}`,
        items: selectedRows.map((r) => ({
          sourceEnrollmentId: r.enrollmentId,
          targetClassId: r.action === 'RETAINED_REPEATER' ? sourceClassId : targetClassId,
          targetSectionId: r.targetSectionId,
          targetRollNo:
            r.action === 'PASSED_OUT' || r.action === 'DROPPED'
              ? null
              : parseInt(r.targetRollNo, 10),
          action: r.action,
        })),
      };

      const res = await fetch('/api/school/enrollments/promotion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'প্রমোশন প্রক্রিয়া সম্পন্ন হতে ব্যর্থ হয়েছে।');
      }

      setSuccessMsg(data.message || 'প্রমোশন সফলভাবে সম্পন্ন হয়েছে!');
      setRows([]);
      setTimeout(() => {
        router.push('/dashboard/enrollments');
      }, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'ত্রুটি ঘটেছে।';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedCount = rows.filter((r) => r.selected).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/enrollments"
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
            <GraduationCap className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">শ্রেণীভিত্তিক শিক্ষার্থী প্রমোশন</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              পরবর্তী শিক্ষাবর্ষে শিক্ষার্থীদের পদোন্নতি, শাখা নির্ধারণ ও রোল বণ্টন
            </p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-3">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
          <AlertCircle className="size-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Configuration Panel */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex items-center gap-2 font-bold text-slate-900 text-sm border-b border-slate-100 pb-3">
          <Sparkles className="size-4 text-indigo-600" />
          ১. উৎস ও লক্ষ্য শিক্ষাবর্ষ ও শ্রেণী নির্বাচন
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Source Info */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <h3 className="font-semibold text-xs text-slate-700 uppercase tracking-wider">
              উৎস শিক্ষাগত তথ্য (From)
            </h3>
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-slate-500 mb-1 font-medium">উৎস শিক্ষাবর্ষ *</label>
                <select
                  value={sourceSessionId}
                  onChange={(e) => setSourceSessionId(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl bg-white border border-slate-200 focus:outline-hidden focus:border-indigo-500"
                >
                  <option value="">শিক্ষাবর্ষ নির্বাচন করুন</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.isCurrent ? '(বর্তমান)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 mb-1 font-medium">উৎস শ্রেণী *</label>
                  <select
                    value={sourceClassId}
                    onChange={(e) => {
                      setSourceClassId(e.target.value);
                      setSourceSectionId('');
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-white border border-slate-200 focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="">শ্রেণী নির্বাচন করুন</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameBn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1 font-medium">উৎস শাখা (ঐচ্ছিক)</label>
                  <select
                    value={sourceSectionId}
                    onChange={(e) => setSourceSectionId(e.target.value)}
                    disabled={!sourceClassId}
                    className="w-full py-2 px-3 rounded-xl bg-white border border-slate-200 focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="">সকল শাখা</option>
                    {sections
                      .filter((s) => s.classId === sourceClassId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nameBn}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Target Info */}
          <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3">
            <h3 className="font-semibold text-xs text-indigo-900 uppercase tracking-wider">
              লক্ষ্য শিক্ষাগত তথ্য (To)
            </h3>
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-slate-500 mb-1 font-medium">লক্ষ্য শিক্ষাবর্ষ *</label>
                <select
                  value={targetSessionId}
                  onChange={(e) => setTargetSessionId(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl bg-white border border-slate-200 focus:outline-hidden focus:border-indigo-500"
                >
                  <option value="">লক্ষ্য শিক্ষাবর্ষ নির্বাচন করুন</option>
                  {sessions
                    .filter((s) => s.id !== sourceSessionId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 mb-1 font-medium">লক্ষ্য শ্রেণী *</label>
                  <select
                    value={targetClassId}
                    onChange={(e) => {
                      setTargetClassId(e.target.value);
                      setDefaultTargetSectionId('');
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-white border border-slate-200 focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="">লক্ষ্য শ্রেণী নির্বাচন</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameBn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1 font-medium">ডিফল্ট লক্ষ্য শাখা</label>
                  <select
                    value={defaultTargetSectionId}
                    onChange={(e) => {
                      setDefaultTargetSectionId(e.target.value);
                      // Update all rows with this default section
                      setRows((prev) =>
                        prev.map((r) => ({ ...r, targetSectionId: e.target.value }))
                      );
                    }}
                    disabled={!targetClassId}
                    className="w-full py-2 px-3 rounded-xl bg-white border border-slate-200 focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="">শাখা নির্বাচন</option>
                    {sections
                      .filter((s) => s.classId === targetClassId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nameBn}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleLoadStudents}
            disabled={loadingStudents || !sourceSessionId || !sourceClassId}
            className="px-5 py-2.5 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 font-semibold text-xs inline-flex items-center gap-2 shadow-xs transition-colors disabled:opacity-40"
          >
            {loadingStudents ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Users className="size-4" />
            )}
            শিক্ষার্থীদের তালিকা লোড করুন
          </button>
        </div>
      </div>

      {/* Step 2: Students Table */}
      {rows.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                ২. শিক্ষার্থীদের পদোন্নতি ও রোল বণ্টন ({rows.length} জন)
              </h2>
              <p className="text-xs text-slate-500">
                নির্বাচিত {selectedCount} জনের নতুন শিক্ষাবর্ষে এনরোলমেন্ট তৈরি হবে
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => toggleAll(true)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 font-medium text-slate-700"
              >
                সবাইকে নির্বাচন
              </button>
              <button
                onClick={() => toggleAll(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 font-medium text-slate-700"
              >
                সবাইকে বাতিল
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase">
                  <th className="py-2.5 px-3 w-10 text-center">বাছাই</th>
                  <th className="py-2.5 px-3">বর্তমান রোল</th>
                  <th className="py-2.5 px-3">শিক্ষার্থী</th>
                  <th className="py-2.5 px-3">প্রমোশন পদক্ষেপ</th>
                  <th className="py-2.5 px-3">লক্ষ্য শাখা</th>
                  <th className="py-2.5 px-3">নতুন রোল</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {rows.map((r) => (
                  <tr
                    key={r.enrollmentId}
                    className={`hover:bg-slate-50/50 ${!r.selected ? 'opacity-40 bg-slate-50/30' : ''}`}
                  >
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => updateRow(r.enrollmentId, { selected: !r.selected })}
                        className="text-slate-400 hover:text-indigo-600"
                      >
                        {r.selected ? (
                          <CheckSquare className="size-4 text-indigo-600" />
                        ) : (
                          <Square className="size-4" />
                        )}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      #{r.currentRoll}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{r.fullNameBn}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {r.studentCode} • {r.fullNameEn}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={r.action}
                        disabled={!r.selected}
                        onChange={(e) =>
                          updateRow(r.enrollmentId, {
                            action: e.target.value as EnrolledStudentRow['action'],
                          })
                        }
                        className="py-1 px-2.5 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-indigo-500 text-xs"
                      >
                        <option value="PROMOTED">উত্তীর্ণ (Promoted)</option>
                        <option value="RETAINED_REPEATER">পুনরাবৃত্তি (Repeater)</option>
                        <option value="PASSED_OUT">সমাপ্ত (Passed Out)</option>
                        <option value="DROPPED">ড্রপড (Dropped)</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={r.targetSectionId}
                        disabled={
                          !r.selected || r.action === 'PASSED_OUT' || r.action === 'DROPPED'
                        }
                        onChange={(e) =>
                          updateRow(r.enrollmentId, { targetSectionId: e.target.value })
                        }
                        className="py-1 px-2.5 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-indigo-500 text-xs"
                      >
                        <option value="">শাখা নির্বাচন</option>
                        {sections
                          .filter(
                            (s) =>
                              s.classId ===
                              (r.action === 'RETAINED_REPEATER' ? sourceClassId : targetClassId)
                          )
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.nameBn}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min="1"
                        disabled={
                          !r.selected || r.action === 'PASSED_OUT' || r.action === 'DROPPED'
                        }
                        value={r.targetRollNo}
                        onChange={(e) =>
                          updateRow(r.enrollmentId, { targetRollNo: e.target.value })
                        }
                        className="w-20 py-1 px-2 rounded-lg border border-slate-200 font-mono text-xs focus:outline-hidden focus:border-indigo-500"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Warning Banner */}
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
            <Info className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">গুরুত্বপূর্ণ সতর্কতা:</span>
              <p>
                প্রমোশন প্রক্রিয়া সম্পন্ন হলে নির্বাচিত শিক্ষার্থীদের জন্য নতুন শিক্ষাবর্ষে নতুন এনরোলমেন্ট
                তৈরি হবে এবং তাদের পূর্ববর্তী শিক্ষাবর্ষের সকল উপস্থিতি, মার্কস ও পরীক্ষার তথ্য সম্পূর্ণ
                অক্ষুণ্ণ থাকবে।
              </p>
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Link
              href="/dashboard/enrollments"
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs"
            >
              বাতিল
            </Link>
            <button
              onClick={handleExecutePromotion}
              disabled={submitting || selectedCount === 0}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 font-semibold text-xs inline-flex items-center gap-2 shadow-xs transition-colors disabled:opacity-40"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {selectedCount} জনের প্রমোশন কার্যকর করুন
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
