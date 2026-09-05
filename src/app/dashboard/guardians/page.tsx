'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  Plus,
  Pencil,
  Eye,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  Briefcase,
  MapPin,
  IdCard,
} from 'lucide-react';
import { GuardianRelation } from '@prisma/client';

interface Guardian {
  id: string;
  fullNameEn: string;
  fullNameBn: string;
  relationType: GuardianRelation;
  nationalId: string | null;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  occupation: string | null;
  monthlyIncome: number | string | null;
  educationLevel: string | null;
  photoUrl: string | null;
  address: string | null;
  createdAt: string;
  _count?: {
    students: number;
  };
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const RELATION_LABELS_BN: Record<GuardianRelation, string> = {
  FATHER: 'বাবা / পিতা',
  MOTHER: 'মা / মাতা',
  PATERNAL_UNCLE: 'চাচা',
  MATERNAL_UNCLE: 'মামা',
  BROTHER: 'ভাই',
  SISTER: 'বোন',
  GRANDFATHER: 'দাদা / নানা',
  GRANDMOTHER: 'দাদি / নানি',
  LEGAL_GUARDIAN: 'আইনগত অভিভাবক',
};

export default function GuardiansPage() {
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuardian, setEditingGuardian] = useState<Guardian | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    fullNameEn: '',
    fullNameBn: '',
    relationType: 'FATHER' as GuardianRelation,
    nationalId: '',
    phone: '',
    alternatePhone: '',
    email: '',
    occupation: '',
    monthlyIncome: '',
    educationLevel: '',
    address: '',
  });

  const loadGuardians = useCallback(async (pageToLoad = 1, query = activeSearch) => {
    try {
      setIsLoading(true);
      setError('');
      const params = new URLSearchParams({
        page: pageToLoad.toString(),
        pageSize: '20',
      });
      if (query.trim()) {
        params.set('search', query.trim());
      }

      const res = await fetch(`/api/school/guardians?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'অভিভাবক লোড করতে ব্যর্থ হয়েছে।');
      }

      setGuardians(data.data || []);
      setPagination(data.pagination);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [activeSearch]);

  useEffect(() => {
    loadGuardians(1, activeSearch);
  }, [loadGuardians, activeSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchTerm);
  };

  const openCreateModal = () => {
    setEditingGuardian(null);
    setFormData({
      fullNameEn: '',
      fullNameBn: '',
      relationType: 'FATHER',
      nationalId: '',
      phone: '',
      alternatePhone: '',
      email: '',
      occupation: '',
      monthlyIncome: '',
      educationLevel: '',
      address: '',
    });
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (guardian: Guardian) => {
    setEditingGuardian(guardian);
    setFormData({
      fullNameEn: guardian.fullNameEn || '',
      fullNameBn: guardian.fullNameBn || '',
      relationType: guardian.relationType || 'FATHER',
      nationalId: guardian.nationalId || '',
      phone: guardian.phone || '',
      alternatePhone: guardian.alternatePhone || '',
      email: guardian.email || '',
      occupation: guardian.occupation || '',
      monthlyIncome: guardian.monthlyIncome !== null && guardian.monthlyIncome !== undefined ? guardian.monthlyIncome.toString() : '',
      educationLevel: guardian.educationLevel || '',
      address: guardian.address || '',
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const payload: Record<string, unknown> = {
        fullNameEn: formData.fullNameEn.trim(),
        fullNameBn: formData.fullNameBn.trim(),
        relationType: formData.relationType,
        phone: formData.phone.trim(),
        alternatePhone: formData.alternatePhone.trim() || null,
        email: formData.email.trim() || null,
        nationalId: formData.nationalId.trim() || null,
        occupation: formData.occupation.trim() || null,
        monthlyIncome: formData.monthlyIncome.trim() ? parseFloat(formData.monthlyIncome) : null,
        educationLevel: formData.educationLevel.trim() || null,
        address: formData.address.trim() || null,
      };

      const url = editingGuardian
        ? `/api/school/guardians/${editingGuardian.id}`
        : '/api/school/guardians';
      const method = editingGuardian ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'সংরক্ষণ ব্যর্থ হয়েছে।');
      }

      setSuccessMessage(
        editingGuardian
          ? 'অভিভাবকের তথ্য সফলভাবে হালনাগাদ করা হয়েছে।'
          : 'অভিভাবক সফলভাবে নিবন্ধিত হয়েছে।'
      );
      setIsModalOpen(false);
      loadGuardians(editingGuardian ? pagination.page : 1);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Users className="size-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">অভিভাবক</h1>
              <p className="text-sm text-slate-500">
                শিক্ষার্থীদের অভিভাবক ও পারিবারিক যোগাযোগ ব্যবস্থাপনা
              </p>
            </div>
          </div>
        </div>
        <div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs cursor-pointer"
          >
            <Plus className="size-4" />
            <span>+ নতুন অভিভাবক</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3 shadow-xs">
          <AlertCircle className="size-5 shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 cursor-pointer">
            <X className="size-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-3 shadow-xs">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600 mt-0.5" />
          <div className="flex-1">{successMessage}</div>
          <button onClick={() => setSuccessMessage('')} className="text-emerald-500 hover:text-emerald-700 cursor-pointer">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="নাম, ফোন বা ইমেইল দিয়ে খুঁজুন..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition cursor-pointer"
          >
            অনুসন্ধান
          </button>
        </form>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3.5 px-4">নাম</th>
                <th className="py-3.5 px-4">সম্পর্ক</th>
                <th className="py-3.5 px-4">ফোন</th>
                <th className="py-3.5 px-4">ইমেইল</th>
                <th className="py-3.5 px-4 text-center">সন্তানের সংখ্যা</th>
                <th className="py-3.5 px-4 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Loader2 className="size-6 animate-spin mx-auto text-blue-600 mb-2" />
                    <span>তথ্য লোড হচ্ছে...</span>
                  </td>
                </tr>
              ) : guardians.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Users className="size-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-slate-700">কোনো অভিভাবক পাওয়া যায়নি</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {activeSearch ? 'অনুসন্ধানের সাথে কোনো মিল পাওয়া যায়নি।' : 'নতুন অভিভাবক যোগ করতে উপরের বোতামে ক্লিক করুন।'}
                    </p>
                  </td>
                </tr>
              ) : (
                guardians.map((guardian) => (
                  <tr key={guardian.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{guardian.fullNameBn}</div>
                      <div className="text-xs text-slate-500">{guardian.fullNameEn}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {RELATION_LABELS_BN[guardian.relationType] || guardian.relationType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-mono text-slate-800">
                        <Phone className="size-3.5 text-slate-400" />
                        <span>{guardian.phone}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {guardian.email ? (
                        <div className="flex items-center gap-1.5">
                          <Mail className="size-3.5 text-slate-400" />
                          <span>{guardian.email}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">প্রযোজ্য নয়</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                        {guardian._count?.students ?? 0}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/dashboard/guardians/${guardian.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                        >
                          <Eye className="size-3.5" />
                          <span>দেখুন</span>
                        </Link>
                        <button
                          onClick={() => openEditModal(guardian)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                        >
                          <Pencil className="size-3.5" />
                          <span>সম্পাদনা</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {!isLoading && pagination.totalPages > 1 && (
          <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-200 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              মোট <span className="font-semibold text-slate-700">{pagination.total}</span> জনের মধ্যে{' '}
              <span className="font-semibold text-slate-700">
                {(pagination.page - 1) * pagination.pageSize + 1}-
                {Math.min(pagination.page * pagination.pageSize, pagination.total)}
              </span>{' '}
              দেখানো হচ্ছে
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadGuardians(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronLeft className="size-4 text-slate-600" />
              </button>
              <span className="text-xs font-medium text-slate-700">
                পৃষ্ঠা {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => loadGuardians(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronRight className="size-4 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-xl border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {editingGuardian ? 'অভিভাবকের তথ্য সম্পাদনা' : 'নতুন অভিভাবক নিবন্ধন'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Section 1: ব্যক্তিগত তথ্য */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <IdCard className="size-4 text-blue-600" />
                  <span>ব্যক্তিগত তথ্য</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      বাংলা নাম <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="উদা: মোঃ রফিকুল ইসলাম"
                      value={formData.fullNameBn}
                      onChange={(e) => setFormData({ ...formData, fullNameBn: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ইংরেজি নাম <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Md. Rafiqul Islam"
                      value={formData.fullNameEn}
                      onChange={(e) => setFormData({ ...formData, fullNameEn: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      সম্পর্ক <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.relationType}
                      onChange={(e) => setFormData({ ...formData, relationType: e.target.value as GuardianRelation })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    >
                      {Object.entries(RELATION_LABELS_BN).map(([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ফোন নম্বর <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="017xxxxxxxx"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      বিকল্প ফোন
                    </label>
                    <input
                      type="text"
                      placeholder="018xxxxxxxx (ঐচ্ছিক)"
                      value={formData.alternatePhone}
                      onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ইমেইল
                    </label>
                    <input
                      type="email"
                      placeholder="guardian@example.com (ঐচ্ছিক)"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      জাতীয় পরিচয়পত্র (NID) নম্বর
                    </label>
                    <input
                      type="text"
                      placeholder="NID নম্বর (ঐচ্ছিক)"
                      value={formData.nationalId}
                      onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: পেশাগত তথ্য */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Briefcase className="size-4 text-blue-600" />
                  <span>পেশাগত তথ্য</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      পেশা
                    </label>
                    <input
                      type="text"
                      placeholder="উদা: ব্যবসায়ী / শিক্ষক"
                      value={formData.occupation}
                      onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      মাসিক আয় (টাকা)
                    </label>
                    <input
                      type="number"
                      placeholder="উদা: 50000"
                      value={formData.monthlyIncome}
                      onChange={(e) => setFormData({ ...formData, monthlyIncome: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      শিক্ষাগত যোগ্যতা
                    </label>
                    <input
                      type="text"
                      placeholder="উদা: স্নাতক / স্নাতকোত্তর"
                      value={formData.educationLevel}
                      onChange={(e) => setFormData({ ...formData, educationLevel: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: ঠিকানা */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <MapPin className="size-4 text-blue-600" />
                  <span>ঠিকানা</span>
                </h3>
                <div>
                  <textarea
                    rows={2}
                    placeholder="বর্তমান ও স্থায়ী যোগাযোগের ঠিকানা..."
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  <span>{editingGuardian ? 'সংরক্ষণ করুন' : 'নিবন্ধন সম্পন্ন করুন'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
