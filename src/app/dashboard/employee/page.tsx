'use client';

import React, { useState, useEffect } from 'react';
import { User, Calendar, Plus } from 'lucide-react';

interface EmployeeProfile {
  id: string;
  employeeCode: string;
  fullNameEn: string;
  fullNameBn: string;
  phone: string;
  email: string | null;
  joiningDate: string;
  department: { nameEn: string; nameBn: string } | null;
  designation: { titleEn: string; titleBn: string } | null;
  leaveBalances: Array<{
    id: string;
    year: number;
    allocatedDays: string;
    usedDays: string;
    remainingDays: string;
    leaveType: { nameEn: string; nameBn: string };
  }>;
}

export default function EmployeeSelfServicePage() {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        const res = await fetch('/api/employee/me/profile');
        const json = await res.json();
        if (json.success) {
          setProfile(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch employee profile:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-slate-400">তথ্য লোড হচ্ছে...</div>;
  }

  if (!profile) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <User className="size-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-700">কোন কর্মী প্রোফাইল পাওয়া যায়নি</h2>
        <p className="text-sm text-slate-400 mt-1">আপনার অ্যাকাউন্টের সাথে কোন কর্মী রেকর্ড যুক্ত নেই।</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Overview Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-2xl shadow-xs">
            {profile.fullNameBn?.[0] || profile.fullNameEn?.[0] || 'E'}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {profile.fullNameBn || profile.fullNameEn}
            </h1>
            <div className="text-sm text-slate-500 font-medium mt-0.5">
              {profile.designation?.titleBn || profile.designation?.titleEn} • {profile.department?.nameBn || profile.department?.nameEn}
            </div>
            <div className="text-xs font-mono text-emerald-700 font-bold mt-1">
              আইডি: {profile.employeeCode}
            </div>
          </div>
        </div>

        <div className="text-right text-xs text-slate-500">
          <div>যোগদানের তারিখ: {profile.joiningDate?.slice(0, 10)}</div>
          <div>মোবাইল: {profile.phone}</div>
        </div>
      </div>

      {/* Leave Balances Grid */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="size-4 text-emerald-600" />
            <span>আমার ছুটির হিসাব (My Leave Balances)</span>
          </h2>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition">
            <Plus className="size-3.5" />
            <span>ছুটির আবেদন করুন</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {profile.leaveBalances?.map((bal) => (
            <div key={bal.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-xs font-semibold text-slate-700">
                {bal.leaveType.nameBn || bal.leaveType.nameEn}
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-bold text-emerald-700">
                  {Number(bal.remainingDays)}
                </span>
                <span className="text-xs text-slate-500">
                  অবশিষ্ট (বরাদ্দ: {Number(bal.allocatedDays)} দিন)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
