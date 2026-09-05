'use client';

import React, { useEffect, useState } from 'react';
import { BookOpen, Plus, Search, AlertCircle } from 'lucide-react';
import { LibraryNav } from '@/components/library/LibraryNav';

interface BookItem {
  id: string;
  titleEn: string;
  titleBn: string | null;
  isbn10: string | null;
  isbn13: string | null;
  totalCopies: number;
  availableCopies: number;
  issuedCopies: number;
  category?: { nameEn: string; nameBn: string };
  author?: { nameEn: string; nameBn: string };
  publisher?: { nameEn: string };
}

export default function LibraryBooksPage() {
  const [books, setBooks] = useState<BookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    titleEn: '',
    titleBn: '',
    isbn10: '',
    isbn13: '',
    edition: '',
    publicationYear: '',
    language: 'English',
    description: '',
  });

  async function fetchBooks() {
    try {
      setLoading(true);
      const url = searchTerm
        ? `/api/school/library/books?q=${encodeURIComponent(searchTerm)}`
        : '/api/school/library/books';
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success) setBooks(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch books:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBooks();
  }, [searchTerm]);

  async function handleAddBook(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const payload = {
        titleEn: formData.titleEn.trim(),
        titleBn: formData.titleBn.trim() || undefined,
        isbn10: formData.isbn10.trim() || undefined,
        isbn13: formData.isbn13.trim() || undefined,
        edition: formData.edition.trim() || undefined,
        publicationYear: formData.publicationYear ? parseInt(formData.publicationYear, 10) : undefined,
        language: formData.language,
        description: formData.description.trim() || undefined,
      };

      const res = await fetch('/api/school/library/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to create book');
      }

      setShowAddModal(false);
      setFormData({
        titleEn: '',
        titleBn: '',
        isbn10: '',
        isbn13: '',
        edition: '',
        publicationYear: '',
        language: 'English',
        description: '',
      });
      fetchBooks();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-blue-600" />
            পুস্তক তালিকা ও গ্রন্থ বিবরণী
            <span className="text-sm font-normal text-gray-500">(Book Titles Catalog)</span>
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            লাইব্রেরির সমস্ত বই, আইএসবিএন বিবরণ এবং কপির প্রাপ্যতার সার্বিক অবস্থা।
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          নতুন বই অন্তর্ভুক্ত করুন
        </button>
      </div>

      <LibraryNav />

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="বইয়ের নাম বা ISBN অনুসন্ধান..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="text-xs text-gray-500">
          মোট রেকর্ড: <span className="font-bold text-gray-900">{books.length}</span> টি
        </div>
      </div>

      {/* Books Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-600 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3">বইয়ের নাম (English / বাংলা)</th>
                <th className="px-4 py-3">লেখক ও প্রকাশক</th>
                <th className="px-4 py-3">ক্যাটাগরি</th>
                <th className="px-4 py-3">ISBN</th>
                <th className="px-4 py-3 text-center">মোট কপি</th>
                <th className="px-4 py-3 text-center">উপলব্ধ কপি</th>
                <th className="px-4 py-3 text-center">ইস্যুকৃত</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    লোড হচ্ছে...
                  </td>
                </tr>
              ) : books.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    কোনো বই পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                books.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-gray-900">{b.titleEn}</div>
                      {b.titleBn && <div className="text-xs text-gray-500">{b.titleBn}</div>}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-gray-800">{b.author?.nameEn || 'N/A'}</div>
                      <div className="text-xs text-gray-400">{b.publisher?.nameEn || ''}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {b.category?.nameEn || 'General'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-600">
                      <div>{b.isbn13 || b.isbn10 || '—'}</div>
                    </td>
                    <td className="px-4 py-3.5 text-center font-bold text-gray-800">
                      {b.totalCopies}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        b.availableCopies > 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {b.availableCopies} টি
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center text-gray-600">
                      {b.issuedCopies}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Book Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">নতুন বই যুক্ত করুন</h3>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddBook} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  বইয়ের শিরোনাম (English) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.titleEn}
                  onChange={(e) => setFormData({ ...formData, titleEn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  বইয়ের শিরোনাম (বাংলা)
                </label>
                <input
                  type="text"
                  value={formData.titleBn}
                  onChange={(e) => setFormData({ ...formData, titleBn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    ISBN-13 (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="978-..."
                    value={formData.isbn13}
                    onChange={(e) => setFormData({ ...formData, isbn13: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    সংস্করণ (Edition)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2nd Edition"
                    value={formData.edition}
                    onChange={(e) => setFormData({ ...formData, edition: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm"
                >
                  {submitting ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
