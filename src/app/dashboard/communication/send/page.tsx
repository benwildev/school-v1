'use client';

import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Mail, 
  Smartphone, 
  MessageCircle, 
  Bell, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Layers 
} from 'lucide-react';
import { CommunicationNav } from '@/components/communication/CommunicationNav';

export default function SendMessagePage() {
  const [mode, setMode] = useState<'DIRECT' | 'BULK'>('DIRECT');
  const [channel, setChannel] = useState<'SMS' | 'EMAIL' | 'WHATSAPP' | 'IN_APP'>('SMS');

  // Direct form
  const [recipient, setRecipient] = useState('');
  const [directSubject, setDirectSubject] = useState('');
  const [directBody, setDirectBody] = useState('');

  // Bulk form
  const [campaignTitle, setCampaignTitle] = useState('');
  const [targetAudience, setTargetAudience] = useState('ALL_GUARDIANS');
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [bulkBody, setBulkBody] = useState('');

  // Templates
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function loadMeta() {
      try {
        const [clsRes, tplRes] = await Promise.all([
          fetch('/api/school/classes'),
          fetch('/api/school/communication/templates'),
        ]);

        if (clsRes.ok) {
          const cData = await clsRes.json();
          setClasses(cData.data || []);
        }
        if (tplRes.ok) {
          const tData = await tplRes.json();
          setTemplates(tData.data || []);
        }
      } catch (err) {
        console.error('Failed to load classes and templates', err);
      }
    }
    loadMeta();
  }, []);

  function handleTemplateSelect(id: string) {
    setSelectedTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl) {
      if (mode === 'DIRECT') {
        setDirectBody(tpl.bodyBn || tpl.bodyEn || '');
        if (tpl.subject) setDirectSubject(tpl.subject);
      } else {
        setBulkBody(tpl.bodyBn || tpl.bodyEn || '');
      }
      setChannel(tpl.channel);
    }
  }

  async function handleSendDirect(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/school/communication/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          type: 'ANNOUNCEMENT',
          recipient,
          subject: channel === 'EMAIL' ? directSubject : undefined,
          body: directBody,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: 'success',
          text: `বার্তা সফলভাবে পাঠানো হয়েছে (Status: ${data.data?.status || 'SENT'})`,
        });
        setRecipient('');
        setDirectBody('');
        setDirectSubject('');
      } else {
        setMessage({ type: 'error', text: data.error || 'বার্তা পাঠানো ব্যর্থ হয়েছে।' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'রিকোয়েস্ট ব্যর্থ।' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendBulk(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/school/communication/bulk-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: campaignTitle || 'সাধারণ বিজ্ঞপ্তি',
          channel,
          type: 'ANNOUNCEMENT',
          targetAudience,
          classId: selectedClass || undefined,
          body: bulkBody,
          templateId: selectedTemplateId || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: 'success',
          text: `বাল্ক ক্যাম্পেইন সফলভাবে তৈরি হয়েছে! প্রাপক সংখ্যা: ${data.data?.totalRecipients || 0}`,
        });
        setCampaignTitle('');
        setBulkBody('');
      } else {
        setMessage({ type: 'error', text: data.error || 'ক্যাম্পেইন প্রক্রিয়া ব্যর্থ।' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'রিকোয়েস্ট ব্যর্থ।' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <CommunicationNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Send className="size-6 text-indigo-600" />
            বার্তা ও বাল্ক ক্যাম্পেইন প্রেরণ (Send Hub)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            অভিভাবক, শিক্ষার্থী ও কর্মীদের একক বা দলভিত্তিক এসএমএস, ইমেইল ও নোটিফিকেশন পাঠান
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="p-1 bg-slate-100 rounded-xl flex gap-1 border border-slate-200/80">
          <button
            type="button"
            onClick={() => setMode('DIRECT')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              mode === 'DIRECT'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            একক বার্তা (Direct)
          </button>
          <button
            type="button"
            onClick={() => setMode('BULK')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              mode === 'BULK'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            বাল্ক ক্যাম্পেইন (Bulk)
          </button>
        </div>
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

      {/* Main Form */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs max-w-2xl mx-auto space-y-6">
        {/* Channel Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            প্রেরণের মাধ্যম (Channel) <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: 'SMS', label: 'SMS', icon: Smartphone },
              { id: 'EMAIL', label: 'Email', icon: Mail },
              { id: 'WHATSAPP', label: 'WhatsApp', icon: MessageCircle },
              { id: 'IN_APP', label: 'In-App', icon: Bell },
            ].map((ch) => {
              const Icon = ch.icon;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setChannel(ch.id as any)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition gap-1.5 ${
                    channel === ch.id
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="size-4" />
                  <span>{ch.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Template Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            টেমপ্লেট নির্বাচন করুন (ঐচ্ছিক)
          </label>
          <select
            value={selectedTemplateId}
            onChange={(e) => handleTemplateSelect(e.target.value)}
            className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white"
          >
            <option value="">কাস্টম বার্তা লিখুন (কোনো টেমপ্লেট নয়)</option>
            {templates
              .filter((t) => t.channel === channel)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
          </select>
        </div>

        {mode === 'DIRECT' ? (
          <form onSubmit={handleSendDirect} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                প্রাপকের তথ্য ({channel === 'EMAIL' ? 'ইমেইল এড্রেস' : 'মোবাইল নম্বর'}) <span className="text-red-500">*</span>
              </label>
              <input
                type={channel === 'EMAIL' ? 'email' : 'text'}
                required
                placeholder={channel === 'EMAIL' ? 'guardian@example.com' : '017XXXXXXXX'}
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white font-mono"
              />
              <div className="text-[10px] text-slate-400 mt-0.5">
                বাংলাদেশি ফোন নম্বর স্বয়ংক্রিয়ভাবে +8801XXXXXXXXX ফরম্যাটে রূপান্তরিত হবে।
              </div>
            </div>

            {channel === 'EMAIL' && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ইমেইলের বিষয় (Subject) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="বিদ্যালয় সম্পর্কিত জরুরি নোটিশ"
                  value={directSubject}
                  onChange={(e) => setDirectSubject(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white"
                />
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-semibold text-slate-700">
                  বার্তার বিবরণ (Message Body) <span className="text-red-500">*</span>
                </label>
                {channel === 'SMS' && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    {directBody.length} অক্ষর (অংশ: {Math.ceil(directBody.length / 160) || 1})
                  </span>
                )}
              </div>
              <textarea
                required
                rows={4}
                value={directBody}
                onChange={(e) => setDirectBody(e.target.value)}
                placeholder="আপনার বার্তা এখানে লিখুন..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white font-sans"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm disabled:opacity-50"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                একক বার্তা পাঠান (Send Message)
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSendBulk} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                ক্যাম্পেইন শিরোনাম <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. আগামীকাল বিদ্যালয় বন্ধের নোটিশ"
                value={campaignTitle}
                onChange={(e) => setCampaignTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  প্রাপক গ্রুপ (Target Audience) <span className="text-red-500">*</span>
                </label>
                <select
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white font-semibold"
                >
                  <option value="ALL_GUARDIANS">সকল অভিভাবক (All Guardians)</option>
                  <option value="ALL_STUDENTS">সকল শিক্ষার্থী (All Students)</option>
                  <option value="CLASS_GUARDIANS">নির্দিষ্ট শ্রেণির অভিভাবক</option>
                  <option value="CLASS_STUDENTS">নির্দিষ্ট শ্রেণির শিক্ষার্থী</option>
                  <option value="ALL_STAFF">সকল কর্মী ও শিক্ষক (All Staff)</option>
                  <option value="TEACHERS_ONLY">শুধুমাত্র শিক্ষকবৃন্দ (Teachers Only)</option>
                </select>
              </div>

              {(targetAudience === 'CLASS_GUARDIANS' || targetAudience === 'CLASS_STUDENTS') && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    শ্রেণি নির্বাচন <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white"
                  >
                    <option value="">শ্রেণি নির্বাচন করুন</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameBn || c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-semibold text-slate-700">
                  বার্তার বিবরণ (Message Body) <span className="text-red-500">*</span>
                </label>
                {channel === 'SMS' && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    {bulkBody.length} অক্ষর
                  </span>
                )}
              </div>
              <textarea
                required
                rows={4}
                value={bulkBody}
                onChange={(e) => setBulkBody(e.target.value)}
                placeholder="বাল্ক ক্যাম্পেইন বার্তা এখানে লিখুন..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white font-sans"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm disabled:opacity-50"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <Layers className="size-4" />}
                বাল্ক ক্যাম্পেইন শুরু করুন (Execute Bulk Send)
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
