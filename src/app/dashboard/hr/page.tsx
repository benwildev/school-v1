'use client';

import React, { useState, useEffect } from 'react';
import { Users, Building2, Calendar, Search, Plus, CheckCircle } from 'lucide-react';

interface Employee {
  id: string;
  employeeCode: string;
  fullNameEn: string;
  fullNameBn: string;
  phone: string;
  email: string | null;
  employmentType: string;
  status: string;
  department: { nameEn: string; nameBn: string } | null;
  designation: { titleEn: string; titleBn: string } | null;
  campus: { nameEn: string; nameBn: string } | null;
}

export default function HRDashboardPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    async function loadEmployees() {
      try {
        setLoading(true);
        let url = '/api/school/employees?limit=50';
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;

        const res = await fetch(url);
        const json = await res.json();
        if (json.success) {
          setEmployees(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch employees:', err);
      } finally {
        setLoading(false);
      }
    }
    loadEmployees();
  }, [search, statusFilter]);

  const activeCount = employees.filter((e) => e.status === 'ACTIVE').length;
  const leaveCount = employees.filter((e) => e.status === 'ON_LEAVE').length;

  return (
    <div className="space-y-6">
      {/* Page Title & Intro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Users className="size-6 text-emerald-600" />
            <span>মানবসম্পদ ও কর্মী ব্যবস্থাপনা (HR & Staff)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            শিক্ষক ও কর্মকর্তা-কর্মচারীদের বিস্তারিত তথ্য, পদবী, বিভাগ ও ছুটির হিসাব
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition shadow-xs">
            <Plus className="size-4" />
            <span>নতুন কর্মী যুক্ত করুন</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">মোট কর্মী (Total Staff)</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{employees.length}</div>
          </div>
          <div className="size-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Users className="size-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">সক্রিয় কর্মী (Active Staff)</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</div>
          </div>
          <div className="size-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle className="size-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">ছুটিতে আছেন (On Leave)</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">{leaveCount}</div>
          </div>
          <div className="size-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Calendar className="size-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">বিভাগসমূহ (Departments)</div>
            <div className="text-2xl font-bold text-indigo-600 mt-1">
              {new Set(employees.map((e) => e.department?.nameEn).filter(Boolean)).size}
            </div>
          </div>
          <div className="size-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Building2 className="size-5" />
          </div>
        </div>
      </div>

      {/* Directory Filter & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="নাম, কোড অথবা মোবাইল নম্বর দিয়ে খুঁজুন..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">সব স্ট্যাটাস (All Status)</option>
            <option value="ACTIVE">সক্রিয় (Active)</option>
            <option value="ON_LEAVE">ছুটি (On Leave)</option>
            <option value="INACTIVE">নিষ্ক্রিয় (Inactive)</option>
            <option value="TERMINATED">অব্যাহতিপ্রাপ্ত (Terminated)</option>
          </select>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">কর্মী কোড</th>
                <th className="px-6 py-3.5">নাম (Name)</th>
                <th className="px-6 py-3.5">বিভাগ ও পদবী</th>
                <th className="px-6 py-3.5">যোগাযোগ</th>
                <th className="px-6 py-3.5">চাকরির ধরণ</th>
                <th className="px-6 py-3.5">স্ট্যাটাস</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    তথ্য লোড হচ্ছে...
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    কোন কর্মীর তথ্য পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4 font-mono font-bold text-emerald-700">
                      {emp.employeeCode}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{emp.fullNameBn || emp.fullNameEn}</div>
                      <div className="text-xs text-slate-400">{emp.fullNameEn}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-800 font-medium">{emp.designation?.titleBn || emp.designation?.titleEn || '—'}</div>
                      <div className="text-xs text-slate-400">{emp.department?.nameBn || emp.department?.nameEn || '—'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-800 font-mono text-xs">{emp.phone}</div>
                      {emp.email && <div className="text-slate-400 text-xs">{emp.email}</div>}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-700">
                      {emp.employmentType}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          emp.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : emp.status === 'ON_LEAVE'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {emp.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
