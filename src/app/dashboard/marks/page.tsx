'use client';

import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Save, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Filter 
} from 'lucide-react';

interface StudentMarkRow {
  enrollmentId: string;
  studentId: string;
  studentCode: string;
  rollNo: number;
  fullNameBn: string;
  fullNameEn: string;
  theoryObtained: number;
  mcqObtained: number;
  practicalObtained: number;
  vivaObtained: number;
  caObtained: number;
  isAbsent: boolean;
  totalObtained: number;
  letterGrade: string;
  gradePoint: number;
}

export default function MarksPage() {
  const [exams, setExams] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  const [selectedExam, setSelectedExam] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  const [rows, setRows] = useState<StudentMarkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function loadMeta() {
      try {
        const [exRes, clRes] = await Promise.all([
          fetch('/api/school/exams'),
          fetch('/api/school/classes'),
        ]);
        if (exRes.ok) {
          const d = await exRes.json();
          setExams(d.data || []);
        }
        if (clRes.ok) {
          const c = await clRes.json();
          setClasses(c.data || []);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadMeta();
  }, []);

  // Update sections & subjects on class change
  useEffect(() => {
    if (!selectedClass) {
      setSections([]);
      setSubjects([]);
      setSelectedSection('');
      setSelectedSubject('');
      return;
    }

    const currentClass = classes.find((c) => c.id === selectedClass);
    if (currentClass?.sections) {
      setSections(currentClass.sections);
      if (currentClass.sections.length > 0) setSelectedSection(currentClass.sections[0].id);
    }

    // Load subjects for this class
    async function loadSubjects() {
      try {
        const res = await fetch(`/api/school/subjects?classId=${selectedClass}`);
        if (res.ok) {
          const d = await res.json();
          setSubjects(d.data || []);
          if (d.data?.length > 0) setSelectedSubject(d.data[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadSubjects();
  }, [selectedClass, classes]);

  async function loadRosterAndMarks() {
    if (!selectedExam || !selectedClass || !selectedSection || !selectedSubject) {
      setMessage({ type: 'error', text: 'অনুগ্রহ করে পরীক্ষা, শ্রেণি, শাখা ও বিষয় নির্বাচন করুন।' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const examObj = exams.find((e) => e.id === selectedExam);
      const sessionId = examObj?.academicSessionId;

      const [marksRes, enrollRes] = await Promise.all([
        fetch(`/api/school/marks?examId=${selectedExam}&subjectId=${selectedSubject}&classId=${selectedClass}&sectionId=${selectedSection}`),
        fetch(`/api/school/enrollments?academicSessionId=${sessionId}&classId=${selectedClass}&sectionId=${selectedSection}&status=ACTIVE`),
      ]);

      const marksData = await marksRes.json();
      const enrollData = await enrollRes.json();

      const existingMarksMap = new Map<string, any>();
      for (const m of marksData.data || []) {
        existingMarksMap.set(m.enrollmentId, m);
      }

      const markRows: StudentMarkRow[] = (enrollData.data || []).map((en: any) => {
        const m = existingMarksMap.get(en.id);
        return {
          enrollmentId: en.id,
          studentId: en.studentId,
          studentCode: en.student?.studentCode || '',
          rollNo: en.rollNo,
          fullNameBn: en.student?.fullNameBn || en.student?.fullNameEn || 'শিক্ষার্থী',
          fullNameEn: en.student?.fullNameEn || '',
          theoryObtained: m ? Number(m.theoryObtained) : 0,
          mcqObtained: m ? Number(m.mcqObtained) : 0,
          practicalObtained: m ? Number(m.practicalObtained) : 0,
          vivaObtained: m ? Number(m.vivaObtained) : 0,
          caObtained: m ? Number(m.caObtained) : 0,
          isAbsent: m ? m.isAbsent : false,
          totalObtained: m ? Number(m.totalObtained) : 0,
          letterGrade: m ? m.letterGrade : 'F',
          gradePoint: m ? Number(m.gradePoint) : 0.00,
        };
      });

      setRows(markRows);
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: 'শিক্ষার্থীদের নম্বর তালিকা লোড করতে সমস্যা হয়েছে।' });
    } finally {
      setLoading(false);
    }
  }

  function handleScoreChange(index: number, field: keyof StudentMarkRow, value: any) {
    setRows((prev) => {
      const updated = [...prev];
      const target = { ...updated[index], [field]: value };
      if (!target.isAbsent) {
        target.totalObtained = Number((
          (target.theoryObtained || 0) +
          (target.mcqObtained || 0) +
          (target.practicalObtained || 0) +
          (target.vivaObtained || 0) +
          (target.caObtained || 0)
        ).toFixed(2));
      } else {
        target.totalObtained = 0;
      }
      updated[index] = target;
      return updated;
    });
  }

  async function handleSave(isSubmission: boolean) {
    if (rows.length === 0) return;
    setSaving(true);
    setMessage(null);

    const examObj = exams.find((e) => e.id === selectedExam);

    try {
      const res = await fetch('/api/school/marks/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId: selectedExam,
          classId: selectedClass,
          sectionId: selectedSection,
          subjectId: selectedSubject,
          academicSessionId: examObj?.academicSessionId,
          isSubmission,
          marks: rows.map((r) => ({
            enrollmentId: r.enrollmentId,
            studentId: r.studentId,
            theoryObtained: r.theoryObtained,
            mcqObtained: r.mcqObtained,
            practicalObtained: r.practicalObtained,
            vivaObtained: r.vivaObtained,
            caObtained: r.caObtained,
            isAbsent: r.isAbsent,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'নম্বর সংরক্ষণ করতে সমস্যা হয়েছে।');
      }

      setMessage({
        type: 'success',
        text: isSubmission
          ? 'নম্বরসমূহ প্রধান শিক্ষকের অনুমোদনের জন্য সফলভাবে জমা দেওয়া হয়েছে!'
          : 'খসড়া নম্বর সফলভাবে সংরক্ষিত হয়েছে!',
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-7 h-7 text-teal-600" />
          নম্বর এন্ট্রি ও মূল্যায়ন (Marks Entry Grid)
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          অনুমোদিত বিষয়ে শিক্ষার্থীদের প্রাপ্ত নম্বর এন্ট্রি, খসড়া সংরক্ষণ ও দাখিল করুন।
        </p>

        {/* Filter Controls */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">পরীক্ষা</label>
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="w-full text-sm border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white"
            >
              <option value="">পরীক্ষা নির্বাচন করুন</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>{e.nameBn} ({e.nameEn})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">শ্রেণি</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full text-sm border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white"
            >
              <option value="">শ্রেণি নির্বাচন করুন</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.nameBn} ({c.nameEn})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">শাখা</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full text-sm border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white"
            >
              <option value="">শাখা নির্বাচন করুন</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.nameBn || s.nameEn}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">বিষয়</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full text-sm border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white"
            >
              <option value="">বিষয় নির্বাচন করুন</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.nameBn || sub.nameEn}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={loadRosterAndMarks}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-xs"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
              তালিকা আনুন
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* Grid */}
      {rows.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-100 text-xs uppercase font-semibold text-slate-700">
                <tr>
                  <th className="px-4 py-3">রোল</th>
                  <th className="px-4 py-3">শিক্ষার্থীর নাম</th>
                  <th className="px-3 py-3 text-center">অনুপস্থিত</th>
                  <th className="px-3 py-3">তত্ত্বীয় (Theory)</th>
                  <th className="px-3 py-3">নৈর্ব্যক্তিক (MCQ)</th>
                  <th className="px-3 py-3">ব্যবহারিক (Prac)</th>
                  <th className="px-4 py-3 font-bold text-slate-900">মোট প্রাপ্ত নম্বর</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((row, idx) => (
                  <tr key={row.enrollmentId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.rollNo}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{row.fullNameBn}</div>
                      <div className="text-xs text-slate-400">{row.fullNameEn}</div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={row.isAbsent}
                        onChange={(e) => handleScoreChange(idx, 'isAbsent', e.target.checked)}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        disabled={row.isAbsent}
                        min="0"
                        max="100"
                        value={row.theoryObtained}
                        onChange={(e) => handleScoreChange(idx, 'theoryObtained', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 border border-slate-200 rounded text-sm disabled:bg-slate-100"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        disabled={row.isAbsent}
                        min="0"
                        max="100"
                        value={row.mcqObtained}
                        onChange={(e) => handleScoreChange(idx, 'mcqObtained', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 border border-slate-200 rounded text-sm disabled:bg-slate-100"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        disabled={row.isAbsent}
                        min="0"
                        max="100"
                        value={row.practicalObtained}
                        onChange={(e) => handleScoreChange(idx, 'practicalObtained', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 border border-slate-200 rounded text-sm disabled:bg-slate-100"
                      />
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {row.isAbsent ? <span className="text-rose-600">অনুপস্থিত (F)</span> : row.totalObtained}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-800 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            >
              <Save className="w-4 h-4" />
              খসড়া সংরক্ষণ (Save Draft)
            </button>

            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-xs"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              দাখিল করুন (Submit to Head)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
