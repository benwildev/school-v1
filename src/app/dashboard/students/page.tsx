'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
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
  PowerOff,
  Power,
  Calendar,
  Phone,
  UserCheck,
} from 'lucide-react';
import { Gender, BloodGroup, Religion, Division, StudentStatus } from '@prisma/client';
import { format } from 'date-fns';

interface Student {
  id: string;
  studentCode: string;
  permanentAdmissionNo: string | null;
  admissionDate: string;
  firstNameEn: string;
  lastNameEn: string;
  fullNameEn: string;
  fullNameBn: string;
  dateOfBirth: string;
  gender: Gender;
  bloodGroup: BloodGroup | null;
  religion: Religion;
  nationality: string;
  birthRegistrationNo: string | null;
  nationalId: string | null;
  phone: string | null;
  email: string | null;
  presentAddressLine: string;
  presentThana: string;
  presentDistrict: string;
  presentDivision: Division;
  permanentAddressLine: string;
  permanentPostOffice: string;
  permanentPostCode: string;
  permanentThana: string;
  permanentDistrict: string;
  permanentDivision: Division;
  isPhysicallyChallenged: boolean;
  disabilityDetails: string | null;
  status: StudentStatus;
  createdAt: string;
  emergencyContacts?: {
    id: string;
    name: string;
    relation: string;
    phone: string;
  }[];
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface StudentFormData {
  studentCode: string;
  permanentAdmissionNo: string;
  admissionDate: string;
  firstNameEn: string;
  lastNameEn: string;
  fullNameBn: string;
  dateOfBirth: string;
  gender: Gender;
  bloodGroup: BloodGroup | '';
  religion: Religion;
  nationality: string;
  birthRegistrationNo: string;
  nationalId: string;
  phone: string;
  email: string;
  presentAddressLine: string;
  presentThana: string;
  presentDistrict: string;
  presentDivision: Division;
  permanentAddressLine: string;
  permanentPostOffice: string;
  permanentPostCode: string;
  permanentThana: string;
  permanentDistrict: string;
  permanentDivision: Division;
  isPhysicallyChallenged: boolean;
  disabilityDetails: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [genderFilter, setGenderFilter] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<StudentFormData>({
    studentCode: '',
    permanentAdmissionNo: '',
    admissionDate: new Date().toISOString().split('T')[0],
    firstNameEn: '',
    lastNameEn: '',
    fullNameBn: '',
    dateOfBirth: '2015-01-01',
    gender: Gender.MALE,
    bloodGroup: '' as BloodGroup | '',
    religion: Religion.ISLAM,
    nationality: 'Bangladeshi',
    birthRegistrationNo: '',
    nationalId: '',
    phone: '',
    email: '',
    presentAddressLine: 'ঢাকা',
    presentThana: 'ধানমন্ডি',
    presentDistrict: 'ঢাকা',
    presentDivision: Division.DHAKA,
    permanentAddressLine: 'ঢাকা',
    permanentPostOffice: 'ধানমন্ডি',
    permanentPostCode: '১২০৯',
    permanentThana: 'ধানমন্ডি',
    permanentDistrict: 'ঢাকা',
    permanentDivision: Division.DHAKA,
    isPhysicallyChallenged: false,
    disabilityDetails: '',
    emergencyName: '',
    emergencyRelation: '',
    emergencyPhone: '',
  });

  const loadStudents = useCallback(async (pageToLoad = pagination.page) => {
    try {
      setIsLoading(true);
      setError('');
      const params = new URLSearchParams({
        page: pageToLoad.toString(),
        pageSize: '20',
      });

      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (genderFilter !== 'ALL') params.set('gender', genderFilter);

      const res = await fetch(`/api/school/students?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'শিক্ষার্থীদের তথ্য লোড করতে সমস্যা হয়েছে।');
      }

      setStudents(data.data || []);
      setPagination(data.pagination);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, searchTerm, statusFilter, genderFilter]);

  useEffect(() => {
    loadStudents(1);
  }, [statusFilter, genderFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadStudents(1);
  };

  const openCreateModal = () => {
    setEditingStudent(null);
    setFormData({
      studentCode: `STU-${Math.floor(100000 + Math.random() * 900000)}`,
      permanentAdmissionNo: '',
      admissionDate: new Date().toISOString().split('T')[0],
      firstNameEn: '',
      lastNameEn: '',
      fullNameBn: '',
      dateOfBirth: '2015-01-01',
      gender: Gender.MALE,
      bloodGroup: '',
      religion: Religion.ISLAM,
      nationality: 'Bangladeshi',
      birthRegistrationNo: '',
      nationalId: '',
      phone: '',
      email: '',
      presentAddressLine: 'ঢাকা',
      presentThana: 'ধানমন্ডি',
      presentDistrict: 'ঢাকা',
      presentDivision: Division.DHAKA,
      permanentAddressLine: 'ঢাকা',
      permanentPostOffice: 'ধানমন্ডি',
      permanentPostCode: '১২০৯',
      permanentThana: 'ধানমন্ডি',
      permanentDistrict: 'ঢাকা',
      permanentDivision: Division.DHAKA,
      isPhysicallyChallenged: false,
      disabilityDetails: '',
      emergencyName: '',
      emergencyRelation: '',
      emergencyPhone: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    const emContact = student.emergencyContacts?.[0];
    setFormData({
      studentCode: student.studentCode,
      permanentAdmissionNo: student.permanentAdmissionNo || '',
      admissionDate: student.admissionDate.split('T')[0],
      firstNameEn: student.firstNameEn,
      lastNameEn: student.lastNameEn,
      fullNameBn: student.fullNameBn,
      dateOfBirth: student.dateOfBirth.split('T')[0],
      gender: student.gender,
      bloodGroup: student.bloodGroup || '',
      religion: student.religion,
      nationality: student.nationality,
      birthRegistrationNo: student.birthRegistrationNo || '',
      nationalId: student.nationalId || '',
      phone: student.phone || '',
      email: student.email || '',
      presentAddressLine: student.presentAddressLine,
      presentThana: student.presentThana,
      presentDistrict: student.presentDistrict,
      presentDivision: student.presentDivision,
      permanentAddressLine: student.permanentAddressLine,
      permanentPostOffice: student.permanentPostOffice,
      permanentPostCode: student.permanentPostCode,
      permanentThana: student.permanentThana,
      permanentDistrict: student.permanentDistrict,
      permanentDivision: student.permanentDivision,
      isPhysicallyChallenged: student.isPhysicallyChallenged,
      disabilityDetails: student.disabilityDetails || '',
      emergencyName: emContact?.name || '',
      emergencyRelation: emContact?.relation || '',
      emergencyPhone: emContact?.phone || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      const payload: Record<string, unknown> = {
        firstNameEn: formData.firstNameEn.trim(),
        lastNameEn: formData.lastNameEn.trim(),
        fullNameBn: formData.fullNameBn.trim(),
        admissionDate: formData.admissionDate,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        bloodGroup: formData.bloodGroup || null,
        religion: formData.religion,
        nationality: formData.nationality.trim(),
        birthRegistrationNo: formData.birthRegistrationNo.trim() || null,
        nationalId: formData.nationalId.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        presentAddressLine: formData.presentAddressLine.trim() || 'N/A',
        presentThana: formData.presentThana.trim() || 'N/A',
        presentDistrict: formData.presentDistrict.trim() || 'Dhaka',
        presentDivision: formData.presentDivision,
        permanentAddressLine: formData.permanentAddressLine.trim() || 'N/A',
        permanentPostOffice: formData.permanentPostOffice.trim() || 'N/A',
        permanentPostCode: formData.permanentPostCode.trim() || 'N/A',
        permanentThana: formData.permanentThana.trim() || 'N/A',
        permanentDistrict: formData.permanentDistrict.trim() || 'Dhaka',
        permanentDivision: formData.permanentDivision,
        isPhysicallyChallenged: formData.isPhysicallyChallenged,
        disabilityDetails: formData.disabilityDetails.trim() || null,
      };

      if (!editingStudent) {
        payload.studentCode = formData.studentCode.trim();
        if (formData.emergencyName && formData.emergencyPhone) {
          payload.emergencyContact = {
            name: formData.emergencyName.trim(),
            relation: formData.emergencyRelation.trim() || 'অভিভাবক',
            phone: formData.emergencyPhone.trim(),
          };
        }
      }

      const url = editingStudent
        ? `/api/school/students/${editingStudent.id}`
        : '/api/school/students';
      const method = editingStudent ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'শিক্ষার্থীর তথ্য সংরক্ষণে ত্রুটি দেখা দিয়েছে।');
      }

      setSuccessMessage(
        editingStudent
          ? 'শিক্ষার্থীর তথ্য সফলভাবে আপডেট করা হয়েছে।'
          : 'শিক্ষার্থী সফলভাবে নিবন্ধিত হয়েছে।'
      );
      setIsModalOpen(false);
      loadStudents(editingStudent ? pagination.page : 1);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (student: Student) => {
    const newStatus = student.status === StudentStatus.ACTIVE ? StudentStatus.INACTIVE : StudentStatus.ACTIVE;
    const actionText = newStatus === StudentStatus.ACTIVE ? 'সক্রিয়' : 'নিষ্ক্রিয়';

    if (!confirm(`আপনি কি শিক্ষার্থী ${student.fullNameBn} কে ${actionText} করতে চান?`)) {
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch(`/api/school/students/${student.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে।');
      }

      setSuccessMessage(`শিক্ষার্থী সফলভাবে ${actionText} করা হয়েছে।`);
      loadStudents(pagination.page);
    } catch (err: unknown) {
      setError((err as Error).message);
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <GraduationCap className="size-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">শিক্ষার্থী</h1>
              <p className="text-sm text-slate-500">
                স্থায়ী শিক্ষার্থী প্রোফাইল ও পরিচিতি ব্যবস্থাপনা
              </p>
            </div>
          </div>
        </div>
        <div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs"
          >
            <Plus className="size-4" />
            <span>নতুন শিক্ষার্থী নিবন্ধন</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3 shadow-xs">
          <AlertCircle className="size-5 shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            <X className="size-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-3 shadow-xs">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600 mt-0.5" />
          <div className="flex-1">{successMessage}</div>
          <button onClick={() => setSuccessMessage('')} className="text-emerald-500 hover:text-emerald-700">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="নাম, স্টুডেন্ট আইডি, জন্ম নিবন্ধন দিয়ে খুঁজুন..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition"
          >
            অনুসন্ধান
          </button>
        </form>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-700"
          >
            <option value="ALL">সকল স্ট্যাটাস</option>
            <option value="ACTIVE">সক্রিয় (Active)</option>
            <option value="INACTIVE">নিষ্ক্রিয় (Inactive)</option>
            <option value="TRANSFERRED">স্থানান্তরিত (Transferred)</option>
            <option value="GRADUATED">উত্তীর্ণ (Graduated)</option>
          </select>

          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-700"
          >
            <option value="ALL">সকল লিঙ্গ</option>
            <option value="MALE">ছাত্র (Male)</option>
            <option value="FEMALE">ছাত্রী (Female)</option>
            <option value="OTHER">অন্যান্য (Other)</option>
          </select>
        </div>
      </div>

      {/* Students Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                <th className="py-3.5 px-4">স্টুডেন্ট আইডি</th>
                <th className="py-3.5 px-4">নাম</th>
                <th className="py-3.5 px-4">জন্মতারিখ ও লিঙ্গ</th>
                <th className="py-3.5 px-4">যোগাযোগ</th>
                <th className="py-3.5 px-4">স্ট্যাটাস</th>
                <th className="py-3.5 px-4 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="size-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    শিক্ষার্থীদের তথ্য লোড হচ্ছে...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    কোন শিক্ষার্থী পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                students.map((student) => {
                  const emContact = student.emergencyContacts?.[0];
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {student.studentCode}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{student.fullNameBn}</div>
                        <div className="text-xs text-slate-500">{student.fullNameEn}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Calendar className="size-3.5 text-slate-400" />
                          {format(new Date(student.dateOfBirth), 'dd MMM yyyy')}
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          {student.gender === 'MALE' ? 'ছাত্র' : student.gender === 'FEMALE' ? 'ছাত্রী' : 'অন্যান্য'}
                          {student.bloodGroup && ` • ${student.bloodGroup.replace('_', '+').replace('POSITIVE', '+').replace('NEGATIVE', '-')}`}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {student.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="size-3.5 text-slate-400" />
                            {student.phone}
                          </div>
                        ) : emContact ? (
                          <div className="text-slate-500">
                            জরুরি: {emContact.phone} ({emContact.name})
                          </div>
                        ) : (
                          <span className="text-slate-400">প্রযোজ্য নয়</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            student.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              student.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                          {student.status === 'ACTIVE'
                            ? 'সক্রিয়'
                            : student.status === 'INACTIVE'
                            ? 'নিষ্ক্রিয়'
                            : student.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/dashboard/students/${student.id}`}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition"
                            title="বিস্তারিত দেখুন"
                          >
                            <Eye className="size-4" />
                          </Link>
                          <button
                            onClick={() => openEditModal(student)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                            title="সম্পাদনা করুন"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(student)}
                            className={`p-1.5 rounded-lg transition ${
                              student.status === 'ACTIVE'
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={student.status === 'ACTIVE' ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}
                          >
                            {student.status === 'ACTIVE' ? (
                              <PowerOff className="size-4" />
                            ) : (
                              <Power className="size-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            মোট <span className="font-semibold text-slate-700">{pagination.total}</span> জন শিক্ষার্থী
            {pagination.totalPages > 1 && (
              <> (পৃষ্ঠা {pagination.page} এর {pagination.totalPages})</>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadStudents(pagination.page - 1)}
              disabled={pagination.page <= 1 || isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
            >
              <ChevronLeft className="size-3.5" />
              পূর্ববর্তী
            </button>
            <button
              onClick={() => loadStudents(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
            >
              পরবর্তী
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Create / Edit Student Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <UserCheck className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    {editingStudent ? 'শিক্ষার্থীর তথ্য সম্পাদনা' : 'নতুন শিক্ষার্থী নিবন্ধন'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    শিক্ষার্থীর স্থায়ী পরিচিতি ও যোগাযোগ বিবরণী
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 pt-5">
              {/* Section 1: Basic Identity */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  ব্যক্তিগত তথ্য
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      স্টুডেন্ট আইডি / কোড <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      disabled={!!editingStudent}
                      value={formData.studentCode}
                      onChange={(e) => setFormData({ ...formData, studentCode: e.target.value })}
                      placeholder="e.g. STU-00123"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ভর্তির তারিখ
                    </label>
                    <input
                      type="date"
                      value={formData.admissionDate}
                      onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      নাম (বাংলায়) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.fullNameBn}
                      onChange={(e) => setFormData({ ...formData, fullNameBn: e.target.value })}
                      placeholder="যেমন: আব্দুর রহিম"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      First Name (English) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.firstNameEn}
                      onChange={(e) => setFormData({ ...formData, firstNameEn: e.target.value })}
                      placeholder="Abdur"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Last Name (English) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.lastNameEn}
                      onChange={(e) => setFormData({ ...formData, lastNameEn: e.target.value })}
                      placeholder="Rahim"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      জন্মতারিখ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      লিঙ্গ <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as Gender })}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="MALE">ছাত্র (Male)</option>
                      <option value="FEMALE">ছাত্রী (Female)</option>
                      <option value="OTHER">অন্যান্য (Other)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      রক্তের গ্রুপ
                    </label>
                    <select
                      value={formData.bloodGroup}
                      onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value as BloodGroup })}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">নির্বাচন করুন</option>
                      <option value="A_POSITIVE">A+ (A Positive)</option>
                      <option value="A_NEGATIVE">A- (A Negative)</option>
                      <option value="B_POSITIVE">B+ (B Positive)</option>
                      <option value="B_NEGATIVE">B- (B Negative)</option>
                      <option value="AB_POSITIVE">AB+ (AB Positive)</option>
                      <option value="AB_NEGATIVE">AB- (AB Negative)</option>
                      <option value="O_POSITIVE">O+ (O Positive)</option>
                      <option value="O_NEGATIVE">O- (O Negative)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ধর্ম
                    </label>
                    <select
                      value={formData.religion}
                      onChange={(e) => setFormData({ ...formData, religion: e.target.value as Religion })}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="ISLAM">ইসলাম</option>
                      <option value="HINDUISM">হিন্দু</option>
                      <option value="BUDDHISM">বৌদ্ধ</option>
                      <option value="CHRISTIANITY">খ্রিস্টান</option>
                      <option value="OTHER">অন্যান্য</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Identification & Contact */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  পরিচয় ও যোগাযোগ
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      জন্ম নিবন্ধন নম্বর (১৭ ডিজিট)
                    </label>
                    <input
                      type="text"
                      value={formData.birthRegistrationNo}
                      onChange={(e) => setFormData({ ...formData, birthRegistrationNo: e.target.value })}
                      placeholder="2015..."
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      মোবাইল নম্বর
                    </label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="017xxxxxxxx"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Emergency Contact (for new registration) */}
              {!editingStudent && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    জরুরি যোগাযোগ (ঐচ্ছিক)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        নাম
                      </label>
                      <input
                        type="text"
                        value={formData.emergencyName}
                        onChange={(e) => setFormData({ ...formData, emergencyName: e.target.value })}
                        placeholder="অভিভাবকের নাম"
                        className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        সম্পর্ক
                      </label>
                      <input
                        type="text"
                        value={formData.emergencyRelation}
                        onChange={(e) => setFormData({ ...formData, emergencyRelation: e.target.value })}
                        placeholder="পিতা / মাতা / অভিভাবক"
                        className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        ফোন নম্বর
                      </label>
                      <input
                        type="text"
                        value={formData.emergencyPhone}
                        onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                        placeholder="017xxxxxxxx"
                        className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50 transition shadow-xs"
                >
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  <span>{editingStudent ? 'আপডেট করুন' : 'নিবন্ধন সম্পন্ন করুন'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
