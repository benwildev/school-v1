'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Tag
} from 'lucide-react';
import { CommunicationNav } from '@/components/communication/CommunicationNav';

interface TemplateItem {
  id: string;
  name: string;
  code: string;
  type: string;
  channel: string;
  subject?: string;
  bodyBn: string;
  bodyEn?: string;
  variables: string[];
  isActive: boolean;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'ATTENDANCE_ABSENT',
    channel: 'SMS',
    subject: '',
    bodyBn: 'প্রিয় অভিভাবক, আপনার সন্তান {{studentName}} আজ বিদ্যালয়ে অনুপস্থিত।',
    bodyEn: 'Dear Guardian, your child {{studentName}} is absent today.',
    variables: ['studentName', 'className', 'sectionName', 'date', 'schoolName'],
    isActive: true,
  });

  async function loadTemplates() {
    setLoading(true);
    try {
      const res = await fetch('/api/school/communication/templates');
      const data = await res.json();
      if (res.ok) {
        setTemplates(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load templates', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setMessage(null);

    try {
      const res = await fetch('/api/school/communication/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'টেমপ্লেট সফলভাবে তৈরি করা হয়েছে।' });
        setShowModal(false);
        loadTemplates();
      } else {
        setMessage({ type: 'error', text: data.error || 'টেমপ্লেট সংরক্ষণ ব্যর্থ।' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'রিকোয়েস্ট ব্যর্থ।' });
    } finally {
      setCreating(false);
    }
  }

  function insertVariable(varName: string) {
    const token = `{{${varName}}}`;
    setFormData((prev) => ({
      ...prev,
      bodyBn: prev.bodyBn + ' ' + token,
    }));
  }

  return (
    <div className="space-y-6">
      <CommunicationNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="size-6 text-indigo-600" />
            বার্তা টেমপ্লেট ব্যবস্থাপনা (Notification Templates)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            উপস্থিতি, ফলাফল ও ফি নোটিশের জন্য নিরাপদ ভেরিয়েবল সমৃদ্ধ দ্বিভাষিক টেমপ্লেট
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm"
        >
          <Plus className="size-4" />
          নতুন টেমপ্লেট (Create Template)
        </button>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-3 border ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="size-4 shrink-0 text-red-600" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Templates List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((tpl) => (
          <div
            key={tpl.id}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{tpl.name}</h3>
                  <div className="text-[11px] font-mono text-indigo-600">{tpl.code}</div>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {tpl.channel}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-800 font-sans">
                  <span className="font-semibold text-slate-400 block text-[10px] mb-0.5">বাংলা:</span>
                  {tpl.bodyBn}
                </div>

                {tpl.bodyEn && (
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-800 font-sans">
                    <span className="font-semibold text-slate-400 block text-[10px] mb-0.5">ইংরেজি:</span>
                    {tpl.bodyEn}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap gap-1">
                {(tpl.variables || []).map((v) => (
                  <span
                    key={v}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-mono"
                  >
                    {`{{${v}}}`}
                  </span>
                ))}
              </div>

              <span className="text-[10px] font-semibold text-emerald-600">সক্রিয়</span>
            </div>
          </div>
        ))}

        {templates.length === 0 && !loading && (
          <div className="col-span-2 text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
            এখনও কোনো কাস্টম টেমপ্লেট নেই। &ldquo;নতুন টেমপ্লেট&rdquo; এ ক্লিক করুন।
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileText className="size-5 text-indigo-600" />
                নতুন নোটিফিকেশন টেমপ্লেট
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  টেমপ্লেটের নাম <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. অনুপস্থিতির নোটিশ"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    ইউনিক কোড <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ABSENT_ALERT"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">চ্যানেল</label>
                  <select
                    value={formData.channel}
                    onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white"
                  >
                    <option value="SMS">SMS</option>
                    <option value="EMAIL">Email</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="IN_APP">In-App</option>
                  </select>
                </div>
              </div>

              {formData.channel === 'EMAIL' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ইমেইল বিষয় (Subject)</label>
                  <input
                    type="text"
                    placeholder="e.g. Attendance Notice - {{studentName}}"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white"
                  />
                </div>
              )}

              {/* Variable Pills */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ক্লিক করে ভেরিয়েবল যোগ করুন:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {['studentName', 'className', 'sectionName', 'date', 'schoolName'].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v)}
                      className="px-2 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-mono text-[11px] transition flex items-center gap-1"
                    >
                      <Tag className="size-3" />
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  বার্তা বডি (বাংলা) <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={formData.bodyBn}
                  onChange={(e) => setFormData({ ...formData, bodyBn: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white font-sans"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">বার্তা বডি (English)</label>
                <textarea
                  rows={2}
                  value={formData.bodyEn}
                  onChange={(e) => setFormData({ ...formData, bodyEn: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white font-sans"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-sm disabled:opacity-50"
                >
                  {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                  টেমপ্লেট তৈরি করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
