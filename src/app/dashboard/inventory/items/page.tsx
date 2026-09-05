'use client';

import React, { useEffect, useState } from 'react';
import { Package, Plus, Search, AlertCircle } from 'lucide-react';
import { InventoryNav } from '@/components/inventory/InventoryNav';

interface InventoryItem {
  id: string;
  itemCode: string;
  nameEn: string;
  nameBn: string | null;
  itemType: 'CONSUMABLE' | 'ASSET';
  stockUnit: string;
  currentStock: number;
  minStockLevel: number;
  reorderLevel: number;
  isLowStock: boolean;
  isCriticallyLow: boolean;
  isOutOfStock: boolean;
  category?: { nameEn: string; nameBn: string };
}

interface CategoryOption {
  id: string;
  code: string;
  nameEn: string;
}

export default function InventoryItemsPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    categoryId: '',
    itemCode: '',
    nameEn: '',
    nameBn: '',
    itemType: 'CONSUMABLE',
    stockUnit: 'PCS',
    minStockLevel: '5',
    reorderLevel: '10',
    description: '',
  });

  async function fetchData() {
    try {
      setLoading(true);
      let url = '/api/school/inventory/items?';
      if (searchTerm) url += `q=${encodeURIComponent(searchTerm)}&`;
      if (typeFilter) url += `itemType=${typeFilter}&`;

      const [itemsRes, catRes] = await Promise.all([
        fetch(url),
        fetch('/api/school/inventory/categories'),
      ]);

      if (itemsRes.ok) {
        const json = await itemsRes.json();
        if (json.success) setItems(json.data);
      }
      if (catRes.ok) {
        const json = await catRes.json();
        if (json.success) setCategories(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch inventory items:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [searchTerm, typeFilter]);

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        categoryId: formData.categoryId,
        itemCode: formData.itemCode.trim(),
        nameEn: formData.nameEn.trim(),
        nameBn: formData.nameBn.trim() || undefined,
        itemType: formData.itemType as any,
        stockUnit: formData.stockUnit as any,
        minStockLevel: parseInt(formData.minStockLevel, 10) || 0,
        reorderLevel: parseInt(formData.reorderLevel, 10) || 0,
        description: formData.description.trim() || undefined,
      };

      const res = await fetch('/api/school/inventory/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to create item');
      }

      setShowAddModal(false);
      setFormData({
        categoryId: '',
        itemCode: '',
        nameEn: '',
        nameBn: '',
        itemType: 'CONSUMABLE',
        stockUnit: 'PCS',
        minStockLevel: '5',
        reorderLevel: '10',
        description: '',
      });
      fetchData();
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
            <Package className="w-7 h-7 text-amber-600" />
            ইনভেন্টরি আইটেম ক্যাটালগ
            <span className="text-sm font-normal text-gray-500">(Inventory Items Registry)</span>
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            ভোগ্যপণ্য এবং স্থায়ী সম্পদের পূর্ণাঙ্গ তালিকা ও রিয়েলটাইম স্টক মাত্রা।
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          নতুন পণ্য যুক্ত করুন
        </button>
      </div>

      <InventoryNav />

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="পণ্য কোড বা নাম লিখুন..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
          >
            <option value="">সকল ধরন (All Types)</option>
            <option value="CONSUMABLE">ভোগ্যপণ্য (Consumable)</option>
            <option value="ASSET">স্থায়ী সম্পদ (Asset)</option>
          </select>
        </div>

        <div className="text-xs text-gray-500">
          মোট পণ্য: <span className="font-bold text-gray-900">{items.length}</span> টি
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-600 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3">আইটেম কোড ও নাম</th>
                <th className="px-4 py-3">ক্যাটাগরি</th>
                <th className="px-4 py-3">ধরন</th>
                <th className="px-4 py-3">পরিমাপক একক</th>
                <th className="px-4 py-3 text-center">বর্তমান মজুদ</th>
                <th className="px-4 py-3 text-center">পুনঃঅর্ডার স্তর</th>
                <th className="px-4 py-3 text-center">স্টক অবস্থা</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    লোড হচ্ছে...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    কোনো আইটেম পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-gray-900">{item.nameEn}</div>
                      <div className="text-xs text-gray-500">
                        Code: {item.itemCode} {item.nameBn ? `| ${item.nameBn}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-medium text-gray-700">
                        {item.category?.nameEn || 'General'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.itemType === 'CONSUMABLE'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {item.itemType === 'CONSUMABLE' ? 'ভোগ্যপণ্য' : 'স্থায়ী সম্পদ'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 font-medium">
                      {item.stockUnit}
                    </td>
                    <td className="px-4 py-3.5 text-center font-bold text-gray-900">
                      {item.currentStock} {item.stockUnit}
                    </td>
                    <td className="px-4 py-3.5 text-center text-xs text-gray-500">
                      মিনিমাম: {item.minStockLevel} | রিঅর্ডার: {item.reorderLevel}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          item.isOutOfStock
                            ? 'bg-rose-100 text-rose-800'
                            : item.isLowStock
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {item.isOutOfStock ? 'স্টক শূন্য' : item.isLowStock ? 'স্বল্প স্টক' : 'পর্যাপ্ত'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">নতুন ইনভেন্টরি পণ্য যুক্ত করুন</h3>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  ক্যাটাগরি নির্বাচন করুন *
                </label>
                <select
                  required
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">নির্বাচন করুন...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameEn} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    আইটেম কোড *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ITM-PAP-01"
                    value={formData.itemCode}
                    onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    পণ্যের ধরন *
                  </label>
                  <select
                    value={formData.itemType}
                    onChange={(e) => setFormData({ ...formData, itemType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="CONSUMABLE">ভোগ্যপণ্য (Consumable)</option>
                    <option value="ASSET">স্থায়ী সম্পদ (Asset)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  পণ্যের নাম (English) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nameEn}
                  onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    পরিমাপক একক
                  </label>
                  <select
                    value={formData.stockUnit}
                    onChange={(e) => setFormData({ ...formData, stockUnit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="PCS">PCS (টি)</option>
                    <option value="BOX">BOX (বাক্স)</option>
                    <option value="KG">KG (কেজি)</option>
                    <option value="LITER">LITER (লিটার)</option>
                    <option value="PACKET">PACKET (প্যাকেট)</option>
                    <option value="SET">SET (সেট)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    মিনিমাম স্টক
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minStockLevel}
                    onChange={(e) => setFormData({ ...formData, minStockLevel: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    রিঅর্ডার স্তর
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.reorderLevel}
                    onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
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
                  className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg shadow-sm"
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
