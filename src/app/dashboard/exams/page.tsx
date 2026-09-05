'use client';

import React, { useState, useEffect } from 'react';
import { 
  CalendarRange, 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Calendar
} from 'lucide-react';

export default function ExamsPage() {
  const [exams, setExams] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    academicSessionId: '',
    nameEn: '',
    nameBn: '',
    examType: 'TERM_EXAM',
    term: 'FIRST_TERM',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    weightagePercentage: 100,
  });

  async function loadData() {
    setLoading(true);
    try {
      const [exRes, sessRes] = await Promise.all([
        fetch('/api/school/exams'),
        fetch('/api/school/academic-sessions'),
      ]);

      if (exRes.ok) {
        const d = await exRes.json();
        setExams(d.data || []);
      }
      if (sessRes.ok) {
        const s = await sessRes.json();
        setSessions(s.data || []);
        const active = (s.data || []).find((x: any) => x.isCurrent);
        if (active) setFormData((prev) => ({ ...prev, academicSessionId: active.id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/school/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'পরীক্ষা তৈরি করা সম্ভব হয়নি।');
      }

      setShowModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarRange className="w-7 h-7 text-indigo-600" />
            পরীক্ষা ব্যবস্থাপনা (Exams & Schedules)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            টার্ম পরীক্ষা, মডেল টেস্ট, সময়সূচি ও ফলাফল প্রকাশের ধাপ নির্ধারণ করুন।
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          নতুন পরীক্ষা তৈরি করুন
        </button>
      </div>

      {/* Exam List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 flex justify-center items-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : exams.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-500">
            কোনো পরীক্ষা তৈরি করা হয়নি। &quot;নতুন পরীক্ষা তৈরি করুন&quot; বোতামে ক্লিক করুন।
          </div>
        ) : (
          exams.map((exam) => (
            <div key={exam.id} className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {exam.examType}
                  </span>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                    exam.status === 'RESULTS_PUBLISHED'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : exam.status === 'ONGOING'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {exam.status}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900">{exam.nameBn}</h3>
                <p className="text-xs text-slate-500">{exam.nameEn}</p>

                <div className="mt-4 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {new Date(exam.startDate).toLocaleDateString()} — {new Date(exam.endDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>শিক্ষাবর্ষ: {exam.academicSession?.name}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>সময়সূচি: {exam._count?.schedules || 0} টি বিষয়</span>
                <span>ফলাফল: {exam._count?.results || 0} জন</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-4">নতুন পরীক্ষা তৈরি</h2>

            {error && (
              <div className="p-3 mb-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">শিক্ষাবর্ষ</label>
                <select
                  required
                  value={formData.academicSessionId}
                  onChange={(e) => setFormData({ ...formData, academicSessionId: e.target.value })}
                  className="w-full text-sm border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white"
                >
                  <option value="">নির্বাচন করুন</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">পরীক্ষার নাম (বাংলা)</label>
                  <input
                    required
                    type="text"
                    placeholder="বার্ষিক পরীক্ষা"
                    value={formData.nameBn}
                    onChange={(e) => setFormData({ ...formData, nameBn: e.target.value })}
                    className="w-full text-sm border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">পরীক্ষার নাম (English)</label>
                  <input
                    required
                    type="text"
                    placeholder="Annual Examination"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    className="w-full text-sm border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">শুরুর তারিখ</label>
                  <input
                    required
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full text-sm border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">শেষের তারিখ</label>
                  <input
                    required
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full text-sm border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-semibold"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
