'use client';

import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Plus,
  AlertCircle,
  Loader2,
  X,
  Trash2,
} from 'lucide-react';
import { TeacherAssignmentRole, RecordStatus } from '@prisma/client';

export default function TeacherAssignmentsPage() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    teacherId: string;
    academicSessionId: string;
    classId: string;
    sectionId: string;
    subjectId: string;
    role: TeacherAssignmentRole;
    canEnterMarks: boolean;
    canTakeAttendance: boolean;
    status: RecordStatus;
  }>({
    teacherId: '',
    academicSessionId: '',
    classId: '',
    sectionId: '',
    subjectId: '',
    role: TeacherAssignmentRole.SUBJECT_TEACHER,
    canEnterMarks: true,
    canTakeAttendance: true,
    status: RecordStatus.ACTIVE,
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (formData.classId) {
        fetchSectionsAndSubjects(formData.classId);
    } else {
        setSections([]);
        setSubjects([]);
        setFormData(prev => ({ ...prev, sectionId: '', subjectId: '' }));
    }
  }, [formData.classId]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [assignmentsRes, teachersRes, sessionsRes, classesRes] = await Promise.all([
        fetch('/api/school/teacher-assignments'),
        fetch('/api/school/teachers'),
        fetch('/api/school/academic-sessions'),
        fetch('/api/school/academic-structure/classes')
      ]);

      if (assignmentsRes.ok) setAssignments((await assignmentsRes.json()).data);
      if (teachersRes.ok) setTeachers((await teachersRes.json()).data);
      
      if (sessionsRes.ok) {
          const s = (await sessionsRes.json()).data;
          setSessions(s);
          // Set default session to ACTIVE one if available
          const active = s.find((x: any) => x.status === 'ACTIVE');
          if (active) setFormData(prev => ({ ...prev, academicSessionId: active.id }));
      }
      
      if (classesRes.ok) setClasses((await classesRes.json()).data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSectionsAndSubjects = async (classId: string) => {
      try {
          const [secRes, subRes] = await Promise.all([
              fetch(`/api/school/academic-structure/sections?classId=${classId}`),
              fetch(`/api/school/subjects?classId=${classId}`)
          ]);
          if (secRes.ok) setSections((await secRes.json()).data);
          if (subRes.ok) setSubjects((await subRes.json()).data);
      } catch (err) {
          console.error(err);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const payload = { ...formData, subjectId: formData.subjectId || null };
      const res = await fetch('/api/school/teacher-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'অ্যাসাইনমেন্ট তৈরি করতে সমস্যা হয়েছে');

      setIsModalOpen(false);
      resetForm();
      fetchInitialData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deactivateAssignment = async (id: string, currentStatus: string) => {
      try {
          const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
          const res = await fetch(`/api/school/teacher-assignments/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: newStatus })
          });
          if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error || 'স্ট্যাটাস আপডেট ব্যর্থ হয়েছে');
          }
          fetchInitialData();
      } catch (err: any) {
          alert(err.message);
      }
  };

  const deleteAssignment = async (id: string) => {
      if (!confirm('আপনি কি নিশ্চিত যে এটি ডিলিট করতে চান?')) return;
      try {
          const res = await fetch(`/api/school/teacher-assignments/${id}`, {
              method: 'DELETE'
          });
          if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error || 'ডিলিট ব্যর্থ হয়েছে');
          }
          fetchInitialData();
      } catch (err: any) {
          alert(err.message);
      }
  };

  const resetForm = () => {
    setFormData({
      teacherId: '',
      academicSessionId: sessions.find(s => s.status === 'ACTIVE')?.id || '',
      classId: '',
      sectionId: '',
      subjectId: '',
      role: TeacherAssignmentRole.SUBJECT_TEACHER,
      canEnterMarks: true,
      canTakeAttendance: true,
      status: RecordStatus.ACTIVE,
    });
    setError('');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            শিক্ষক অ্যাসাইনমেন্ট
          </h1>
          <p className="text-gray-500 mt-1">শিক্ষকদের ক্লাস ও বিষয়ের দায়িত্ব প্রদান করুন</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          নতুন অ্যাসাইনমেন্ট
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">কোনো অ্যাসাইনমেন্ট পাওয়া যায়নি</h3>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">শিক্ষক</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">সেশন</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ক্লাস ও সেকশন</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">বিষয় ও দায়িত্ব</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {assignments.map((assignment) => (
                <tr key={assignment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{assignment.teacher.fullNameBn}</div>
                    <div className="text-sm text-gray-500">{assignment.teacher.teacherCode}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {assignment.academicSession.sessionName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{assignment.class.nameBn}</div>
                    <div className="text-sm text-gray-500">{assignment.section.nameBn}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                        {assignment.subject ? assignment.subject.nameBn : '-'}
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {assignment.role.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => deactivateAssignment(assignment.id, assignment.status)}
                      className={`mr-3 ${assignment.status === 'ACTIVE' ? 'text-amber-600 hover:text-amber-900' : 'text-emerald-600 hover:text-emerald-900'}`}
                      title={assignment.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                    >
                      {assignment.status === 'ACTIVE' ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}
                    </button>
                    <button
                      onClick={() => deleteAssignment(assignment.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-semibold text-gray-900">
                নতুন অ্যাসাইনমেন্ট
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">শিক্ষক *</label>
                  <select
                    required
                    value={formData.teacherId}
                    onChange={e => setFormData({ ...formData, teacherId: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="">-- শিক্ষক নির্বাচন করুন --</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.fullNameBn} ({t.teacherCode})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">সেশন *</label>
                  <select
                    required
                    value={formData.academicSessionId}
                    onChange={e => setFormData({ ...formData, academicSessionId: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="">-- সেশন নির্বাচন করুন --</option>
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>{s.sessionName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ক্লাস *</label>
                  <select
                    required
                    value={formData.classId}
                    onChange={e => setFormData({ ...formData, classId: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="">-- ক্লাস নির্বাচন করুন --</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.nameBn}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">সেকশন *</label>
                  <select
                    required
                    value={formData.sectionId}
                    onChange={e => setFormData({ ...formData, sectionId: e.target.value })}
                    disabled={!formData.classId}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-100"
                  >
                    <option value="">-- সেকশন নির্বাচন করুন --</option>
                    {sections.map(s => (
                      <option key={s.id} value={s.id}>{s.nameBn}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">দায়িত্ব (Role) *</label>
                  <select
                    required
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as TeacherAssignmentRole })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    {Object.values(TeacherAssignmentRole).map(r => (
                      <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">বিষয় (Subject)</label>
                  <select
                    value={formData.subjectId}
                    onChange={e => setFormData({ ...formData, subjectId: e.target.value })}
                    disabled={!formData.classId || formData.role === ("CLASS_TEACHER" as string)}
                    required={formData.role === ("SUBJECT_TEACHER" as string)}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-100"
                  >
                    <option value="">-- বিষয় নির্বাচন করুন --</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.nameBn}</option>
                    ))}
                  </select>
                  {formData.role === ("CLASS_TEACHER" as string) && (
                      <p className="text-xs text-gray-500 mt-1">ক্লাস টিচারদের জন্য বিষয় বাধ্যতামূলক নয়।</p>
                  )}
                </div>
              </div>

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
