'use client';

import React, { useState, useEffect } from 'react';
import { 
  Award, 
  Play, 
  Globe, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Filter
} from 'lucide-react';

export default function ResultsPage() {
  const [exams, setExams] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  const [selectedExam, setSelectedExam] = useState('');
  const [selectedClass, setSelectedClass] = useState('');

  const [results, setResults] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
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

  async function loadResults() {
    if (!selectedExam || !selectedClass) {
      setMessage({ type: 'error', text: 'অনুগ্রহ করে পরীক্ষা ও শ্রেণি নির্বাচন করুন।' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/school/results?examId=${selectedExam}&classId=${selectedClass}`);
      const d = await res.json();
      if (res.ok) {
        setResults(d.data || []);
        setStats(d.meta || null);
      } else {
        throw new Error(d.error || 'ফলাফল লোড করা সম্ভব হয়নি।');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!selectedExam || !selectedClass) return;
    setGenerating(true);
    setMessage(null);

    try {
      const res = await fetch('/api/school/results/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId: selectedExam,
          classId: selectedClass,
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        throw new Error(d.error || 'ফলাফল প্রস্তুত করা সম্ভব হয়নি।');
      }

      setMessage({ type: 'success', text: d.message });
      loadResults();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setGenerating(false);
    }
  }

  async function handlePublish() {
    if (!selectedExam) return;
    if (!confirm('আপনি কি নিশ্চিত যে এই পরীক্ষার ফলাফল আনুষ্ঠানিকভাবে প্রকাশ করতে চান? প্রকাশের পর শিক্ষার্থী ও অভিভাবকগণ ফলাফল দেখতে পাবেন।')) {
      return;
    }

    setPublishing(true);
    setMessage(null);

    try {
      const res = await fetch('/api/school/results/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId: selectedExam,
          classId: selectedClass || undefined,
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        throw new Error(d.error || 'ফলাফল প্রকাশ করা সম্ভব হয়নি।');
      }

      setMessage({ type: 'success', text: d.message });
      loadResults();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Award className="w-7 h-7 text-amber-500" />
          ফলাফল ও গ্রেডিং ইঞ্জিন (Results & GPA Management)
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          বাংলাদেশ জাতীয় শিক্ষাক্রম অনুসারে জিপিএ নির্ধারণ, মেধা তালিকা প্রস্তুত ও ফলাফল প্রকাশ করুন।
        </p>

        {/* Filter Controls */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

          <div className="flex items-end">
            <button
              onClick={loadResults}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
              ফলাফল শিট দেখুন
            </button>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex-1 flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors shadow-xs"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              ফলাফল হিসাব করুন
            </button>

            <button
              onClick={handlePublish}
              disabled={publishing || results.length === 0}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors shadow-xs disabled:opacity-50"
            >
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              প্রকাশ করুন
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

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs text-slate-500 font-semibold">মোট পরীক্ষার্থী</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{stats.totalStudents} জন</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs text-emerald-600 font-semibold">উত্তীর্ণ (Passed)</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{stats.passedCount} জন</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs text-rose-600 font-semibold">অনুত্তীর্ণ (Failed)</div>
            <div className="text-2xl font-bold text-rose-700 mt-1">{stats.failedCount} জন</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs text-indigo-600 font-semibold">পাসের হার (Pass Rate)</div>
            <div className="text-2xl font-bold text-indigo-700 mt-1">{stats.passPercentage}%</div>
          </div>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-100 text-xs uppercase font-semibold text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-center">মেধা স্থান (Rank)</th>
                  <th className="px-4 py-3">রোল</th>
                  <th className="px-4 py-3">শিক্ষার্থীর নাম</th>
                  <th className="px-4 py-3">মোট নম্বর</th>
                  <th className="px-4 py-3">জিপিএ (GPA)</th>
                  <th className="px-4 py-3">গ্রেড</th>
                  <th className="px-4 py-3 text-center">ফলাফল</th>
                  <th className="px-4 py-3 text-center">প্রকাশের স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {results.map((res) => (
                  <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-center font-bold text-slate-900">
                      {res.classPosition ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 font-semibold text-xs text-slate-800">
                          {res.classPosition}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{res.enrollment?.rollNo}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{res.student?.fullNameBn}</div>
                      <div className="text-xs text-slate-400">{res.student?.fullNameEn}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {Number(res.totalMarksObtained)} / {Number(res.totalFullMarks)}
                    </td>
                    <td className="px-4 py-3 font-bold text-indigo-700">
                      {Number(res.calculatedGpa).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 font-bold">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        res.finalGrade === 'A+' ? 'bg-emerald-100 text-emerald-800' :
                        res.finalGrade === 'F' ? 'bg-rose-100 text-rose-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {res.finalGrade}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        res.isPassed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {res.isPassed ? 'উত্তীর্ণ' : 'অনুত্তীর্ণ'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs">
                      {res.publishedAt ? (
                        <span className="text-emerald-600 font-semibold">প্রকাশিত (Live)</span>
                      ) : (
                        <span className="text-amber-600 font-semibold">অপ্রকাশিত (Draft)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
