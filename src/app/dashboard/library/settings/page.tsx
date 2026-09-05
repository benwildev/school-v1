'use client';

import React, { useEffect, useState } from 'react';
import { Settings, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { LibraryNav } from '@/components/library/LibraryNav';

export default function LibrarySettingsPage() {
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [settings, setSettings] = useState({
    studentMaxBooks: 3,
    studentLoanPeriodDays: 14,
    studentMaxRenewals: 2,
    employeeMaxBooks: 5,
    employeeLoanPeriodDays: 30,
    employeeMaxRenewals: 3,
    dailyFineRate: 5,
    lostBookChargeMultiplier: 1.5,
    damageFineFlat: 50,
    blockedThresholdFine: 200,
    allowStudentReservations: true,
    allowEmployeeReservations: true,
    reservationValidityDays: 3,
    autoBillToStudentAccount: true,
  });

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/school/library/settings');
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setSettings(json.data);
          }
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    }

    fetchSettings();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(false);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/school/library/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to update settings');
      }

      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 4000);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-7 h-7 text-blue-600" />
          লাইব্রেরি নীতিমালা ও কনফিগারেশন
          <span className="text-sm font-normal text-gray-500">(Library Circulation Policies)</span>
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          বই ধার নেওয়ার কোটা, মেয়াদের নিয়ম, দৈনিক বিলম্ব জরিমানা ও স্বয়ংক্রিয় অ্যাকাউন্টিং নীতিমালা।
        </p>
      </div>

      <LibraryNav />

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          লাইব্রেরি সেটিংস ও নীতিমালা সফলভাবে আপডেট করা হয়েছে।
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
        {/* Student Policy */}
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3 border-b pb-2">
            শিক্ষার্থীদের সার্কুলেশন নীতিমালা (Student Rules)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                একসাথে সর্বোচ্চ বই কোটা
              </label>
              <input
                type="number"
                min="1"
                value={settings.studentMaxBooks}
                onChange={(e) => setSettings({ ...settings, studentMaxBooks: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                ধার নেওয়ার মেয়াদ (দিন)
              </label>
              <input
                type="number"
                min="1"
                value={settings.studentLoanPeriodDays}
                onChange={(e) => setSettings({ ...settings, studentLoanPeriodDays: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                সর্বোচ্চ নবায়ন সংখ্যা
              </label>
              <input
                type="number"
                min="0"
                value={settings.studentMaxRenewals}
                onChange={(e) => setSettings({ ...settings, studentMaxRenewals: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        {/* Employee Policy */}
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3 border-b pb-2">
            শিক্ষক ও কর্মীদের নীতিমালা (Faculty/Staff Rules)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                একসাথে সর্বোচ্চ বই কোটা
              </label>
              <input
                type="number"
                min="1"
                value={settings.employeeMaxBooks}
                onChange={(e) => setSettings({ ...settings, employeeMaxBooks: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                ধার নেওয়ার মেয়াদ (দিন)
              </label>
              <input
                type="number"
                min="1"
                value={settings.employeeLoanPeriodDays}
                onChange={(e) => setSettings({ ...settings, employeeLoanPeriodDays: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                সর্বোচ্চ নবায়ন সংখ্যা
              </label>
              <input
                type="number"
                min="0"
                value={settings.employeeMaxRenewals}
                onChange={(e) => setSettings({ ...settings, employeeMaxRenewals: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        {/* Fines and Financial Rules */}
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3 border-b pb-2">
            জরিমানা ও চার্জ নির্ধারণ (Fines & Financial Controls)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                দৈনিক বিলম্ব জরিমানা (৳)
              </label>
              <input
                type="number"
                min="0"
                value={settings.dailyFineRate}
                onChange={(e) => setSettings({ ...settings, dailyFineRate: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                হারানো বই চার্জ মাল্টিপ্লায়ার
              </label>
              <input
                type="number"
                min="1"
                step="0.1"
                value={settings.lostBookChargeMultiplier}
                onChange={(e) => setSettings({ ...settings, lostBookChargeMultiplier: parseFloat(e.target.value) || 1 })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                ফ্ল্যাট ক্ষতিপূরণ ফি (৳)
              </label>
              <input
                type="number"
                min="0"
                value={settings.damageFineFlat}
                onChange={(e) => setSettings({ ...settings, damageFineFlat: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                অ্যাকাউন্ট ব্লক সীমা (৳)
              </label>
              <input
                type="number"
                min="0"
                value={settings.blockedThresholdFine}
                onChange={(e) => setSettings({ ...settings, blockedThresholdFine: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        {/* Automation & Integrations */}
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3 border-b pb-2">
            অটোমেশন ও আর্থিক ইন্টিগ্রেশন
          </h2>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoBillToStudentAccount}
                onChange={(e) => setSettings({ ...settings, autoBillToStudentAccount: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span>ফেরতকালীন বিলম্ব জরিমানা স্বয়ংক্রিয়ভাবে শিক্ষার্থীর বিলিং লেজারে যুক্ত হবে (Phase 6 Finance Integration)</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allowStudentReservations}
                onChange={(e) => setSettings({ ...settings, allowStudentReservations: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span>শিক্ষার্থীদের অনলাইন বুক রিজার্ভেশন সুবিধা সক্রিয় রাখুন</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-2.5 rounded-lg shadow-sm transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'সংরক্ষণ হচ্ছে...' : 'পরিবর্তন সংরক্ষণ করুন'}
          </button>
        </div>
      </form>
    </div>
  );
}
