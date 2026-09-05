'use client';

import React, { useEffect, useState } from 'react';
import {
  Users,
  Plus,
  Pencil,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Phone,
  Mail,
  Calendar,
} from 'lucide-react';
import { TeacherDesignation, TeacherStatus, Gender, BloodGroup } from '@prisma/client';
import { format } from 'date-fns';

interface Teacher {
  id: string;
  teacherCode: string;
  firstNameEn: string;
  lastNameEn: string;
  fullNameEn: string;
  fullNameBn: string;
  designation: TeacherDesignation;
  department: string | null;
  qualification: string;
  dateOfBirth: string;
  gender: Gender;
  bloodGroup: BloodGroup | null;
  nationalId: string;
  phone: string;
  email: string;
  joiningDate: string;
  status: TeacherStatus;
  campusId: string | null;
  campus?: { id: string; name: string } | null;
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [campuses, setCampuses] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    teacherCode: string;
    firstNameEn: string;
    lastNameEn: string;
    fullNameEn: string;
    fullNameBn: string;
    designation: TeacherDesignation;
    department: string;
    qualification: string;
    dateOfBirth: string;
    gender: Gender;
    bloodGroup: string;
    nationalId: string;
    phone: string;
    email: string;
    joiningDate: string;
    campusId: string;
    status: TeacherStatus;
  }>({
    teacherCode: '',
    firstNameEn: '',
    lastNameEn: '',
    fullNameEn: '',
    fullNameBn: '',
    designation: TeacherDesignation.ASSISTANT_TEACHER,
    department: '',
    qualification: '',
    dateOfBirth: '',
    gender: Gender.MALE,
    bloodGroup: '',
    nationalId: '',
    phone: '',
    email: '',
    joiningDate: '',
    campusId: '',
    status: TeacherStatus.ACTIVE,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [teachersRes, campusesRes] = await Promise.all([
        fetch('/api/school/teachers'),
        fetch('/api/school/campuses')
      ]);

      if (!teachersRes.ok) throw new Error('শিক্ষকদের তথ্য লোড করতে ব্যর্থ হয়েছে');
      
      const teachersData = await teachersRes.json();
      setTeachers(teachersData.data);

      if (campusesRes.ok) {
         const campusesData = await campusesRes.json();
         setCampuses(campusesData.data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const url = editingTeacher 
        ? `/api/school/teachers/${editingTeacher.id}`
        : '/api/school/teachers';
      
      const method = editingTeacher ? 'PATCH' : 'POST';

      const payload = {
        ...formData,
        dateOfBirth: new Date(formData.dateOfBirth).toISOString(),
        joiningDate: new Date(formData.joiningDate).toISOString(),
        bloodGroup: formData.bloodGroup || null,
        department: formData.department || null,
        campusId: formData.campusId || null,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'সংরক্ষণে সমস্যা হয়েছে');
      }

      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      teacherCode: '',
      firstNameEn: '',
      lastNameEn: '',
      fullNameEn: '',
      fullNameBn: '',
      designation: TeacherDesignation.ASSISTANT_TEACHER,
      department: '',
      qualification: '',
      dateOfBirth: '',
      gender: Gender.MALE,
      bloodGroup: '',
      nationalId: '',
      phone: '',
      email: '',
      joiningDate: '',
      campusId: '',
      status: TeacherStatus.ACTIVE,
    });
    setEditingTeacher(null);
    setError('');
  };

  const openEditModal = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      teacherCode: teacher.teacherCode,
      firstNameEn: teacher.firstNameEn,
      lastNameEn: teacher.lastNameEn,
      fullNameEn: teacher.fullNameEn,
      fullNameBn: teacher.fullNameBn,
      designation: teacher.designation,
      department: teacher.department || '',
      qualification: teacher.qualification,
      dateOfBirth: teacher.dateOfBirth ? teacher.dateOfBirth.split('T')[0] : '',
      gender: teacher.gender,
      bloodGroup: teacher.bloodGroup || '',
      nationalId: teacher.nationalId,
      phone: teacher.phone,
      email: teacher.email,
      joiningDate: teacher.joiningDate ? teacher.joiningDate.split('T')[0] : '',
      campusId: teacher.campusId || '',
      status: teacher.status,
    });
    setIsModalOpen(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            শিক্ষক ব্যবস্থাপনা (Teachers)
          </h1>
          <p className="text-gray-500 mt-1">স্কুলের সকল শিক্ষকদের তথ্য পরিচালনা করুন</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          নতুন শিক্ষক যোগ করুন
        </button>
      </div>

      {error && !isModalOpen && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : teachers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">কোনো শিক্ষক পাওয়া যায়নি</h3>
          <p className="text-gray-500">নতুন শিক্ষক যোগ করতে উপরের বাটনে ক্লিক করুন।</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teachers.map((teacher) => (
            <div key={teacher.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900">{teacher.fullNameBn}</h3>
                    <p className="text-sm text-gray-500">{teacher.fullNameEn}</p>
                    <span className="inline-flex items-center mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {teacher.designation.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <button
                    onClick={() => openEditModal(teacher)}
                    className="text-gray-400 hover:text-indigo-600"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">কোড:</span> {teacher.teacherCode}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {teacher.phone}
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {teacher.email}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    যোগদান: {teacher.joiningDate ? format(new Date(teacher.joiningDate), 'dd MMM, yyyy') : '-'}
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex justify-between items-center">
                <span className={`inline-flex items-center gap-1 text-sm ${
                  teacher.status === 'ACTIVE' ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  {teacher.status === 'ACTIVE' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {teacher.status === 'ACTIVE' ? 'সক্রিয়' : teacher.status}
                </span>
                {teacher.campus && (
                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                    {teacher.campus.name}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingTeacher ? 'শিক্ষক সম্পাদনা করুন' : 'নতুন শিক্ষক যোগ করুন'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">কর্মী কোড (Teacher Code) *</label>
                  <input
                    required
                    type="text"
                    value={formData.teacherCode}
                    onChange={e => setFormData({ ...formData, teacherCode: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                
                {campuses.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ক্যাম্পাস (Optional)</label>
                    <select
                      value={formData.campusId}
                      onChange={e => setFormData({ ...formData, campusId: e.target.value })}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    >
                      <option value="">-- নির্বাচন করুন --</option>
                      {campuses.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">নামের প্রথম অংশ (English) *</label>
                  <input
                    required
                    type="text"
                    value={formData.firstNameEn}
                    onChange={e => setFormData({ ...formData, firstNameEn: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">নামের শেষ অংশ (English) *</label>
                  <input
                    required
                    type="text"
                    value={formData.lastNameEn}
                    onChange={e => setFormData({ ...formData, lastNameEn: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">পুরো নাম (English) *</label>
                  <input
                    required
                    type="text"
                    value={formData.fullNameEn}
                    onChange={e => setFormData({ ...formData, fullNameEn: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">পুরো নাম (বাংলা) *</label>
                  <input
                    required
                    type="text"
                    value={formData.fullNameBn}
                    onChange={e => setFormData({ ...formData, fullNameBn: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">মোবাইল (01XXXXXXXXX) *</label>
                  <input
                    required
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ইমেইল *</label>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">জাতীয় পরিচয়পত্র নম্বর *</label>
                  <input
                    required
                    type="text"
                    value={formData.nationalId}
                    onChange={e => setFormData({ ...formData, nationalId: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">শিক্ষাগত যোগ্যতা *</label>
                  <input
                    required
                    type="text"
                    value={formData.qualification}
                    onChange={e => setFormData({ ...formData, qualification: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">পদবী (Designation) *</label>
                  <select
                    required
                    value={formData.designation}
                    onChange={e => setFormData({ ...formData, designation: e.target.value as TeacherDesignation })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    {Object.values(TeacherDesignation).map(d => (
                      <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">লিঙ্গ (Gender) *</label>
                  <select
                    required
                    value={formData.gender}
                    onChange={e => setFormData({ ...formData, gender: e.target.value as Gender })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    {Object.values(Gender).map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">রক্তের গ্রুপ (Optional)</label>
                  <select
                    value={formData.bloodGroup}
                    onChange={e => setFormData({ ...formData, bloodGroup: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="">-- নির্বাচন করুন --</option>
                    {Object.values(BloodGroup).map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">জন্ম তারিখ *</label>
                  <input
                    required
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">যোগদানের তারিখ *</label>
                  <input
                    required
                    type="date"
                    value={formData.joiningDate}
                    onChange={e => setFormData({ ...formData, joiningDate: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">স্ট্যাটাস *</label>
                  <select
                    required
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as TeacherStatus })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    {Object.values(TeacherStatus).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {!editingTeacher && (
                <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm">
                  <p><strong>নোট:</strong> শিক্ষকের প্রোফাইল তৈরি করার সাথে সাথে সিস্টেমে স্বয়ংক্রিয়ভাবে একটি ইউজার অ্যাকাউন্ট তৈরি হবে। ডিফল্ট পাসওয়ার্ড হিসেবে শিক্ষকের মোবাইল নম্বর ব্যবহার করা হবে।</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={isSubmitting}
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
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
