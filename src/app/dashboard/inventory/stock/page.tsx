'use client';

import React, { useEffect, useState } from 'react';
import { Layers, Plus, ArrowDownLeft, ArrowUpRight, AlertCircle } from 'lucide-react';
import { InventoryNav } from '@/components/inventory/InventoryNav';

interface StockMovement {
  id: string;
  movementType: string;
  quantity: number;
  unitCost: number;
  movementDate: string;
  notes: string | null;
  item: { itemCode: string; nameEn: string; stockUnit: string };
  campus: { name: string };
  createdBy: { name: string };
}

export default function StockMovementsPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [items, setItems] = useState<Array<{ id: string; nameEn: string; itemCode: string }>>([]);
  const [formData, setFormData] = useState({
    itemId: '',
    campusId: '',
    movementType: 'ISSUE_OUT',
    quantity: '1',
    unitCost: '0',
    notes: '',
  });

  async function fetchMovements() {
    try {
      setLoading(true);
      const url = typeFilter
        ? `/api/school/inventory/stock-movements?movementType=${typeFilter}`
        : '/api/school/inventory/stock-movements';
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success) setMovements(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch stock movements:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMovements();
  }, [typeFilter]);

  useEffect(() => {
    async function fetchItems() {
      try {
        const res = await fetch('/api/school/inventory/items?itemType=CONSUMABLE');
        if (res.ok) {
          const json = await res.json();
          if (json.success) setItems(json.data);
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchItems();
  }, []);

  async function handleAddMovement(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      // Find default campus if not set
      let campusId = formData.campusId;
      if (!campusId) {
        const campusRes = await fetch('/api/school/campuses');
        if (campusRes.ok) {
          const cJson = await campusRes.json();
          if (cJson.success && cJson.data?.length > 0) {
            campusId = cJson.data[0].id;
          }
        }
      }

      const res = await fetch('/api/school/inventory/stock-movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: formData.itemId,
          campusId,
          movementType: formData.movementType,
          quantity: parseInt(formData.quantity, 10),
          unitCost: parseFloat(formData.unitCost) || 0,
          notes: formData.notes.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to record stock movement');
      }

      setShowAddModal(false);
      setFormData({
        itemId: '',
        campusId: '',
        movementType: 'ISSUE_OUT',
        quantity: '1',
        unitCost: '0',
        notes: '',
      });
      fetchMovements();
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
            <Layers className="w-7 h-7 text-amber-600" />
            স্টক মুভমেন্ট ও বিতরণ লেজার
            <span className="text-sm font-normal text-gray-500">(Stock Ledger & Movements)</span>
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            ভোগ্যপণ্য ইন-আউট রেকর্ড, বিতরণ ইতিহাস এবং অখণ্ড স্টক নিরীক্ষা খতিয়ান।
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          স্টক মুভমেন্ট লিপিবদ্ধ করুন
        </button>
      </div>

      <InventoryNav />

      {/* Filter */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
        >
          <option value="">সকল মুভমেন্ট (All Movements)</option>
          <option value="PURCHASE_IN">ক্রয় প্রাপ্তি (Purchase In)</option>
          <option value="ISSUE_OUT">বিতরণ (Issue Out)</option>
          <option value="TRANSFER_IN">স্থানান্তর প্রাপ্তি (Transfer In)</option>
          <option value="TRANSFER_OUT">স্থানান্তর প্রেরণ (Transfer Out)</option>
          <option value="DAMAGE">ক্ষতিগ্রস্ত (Damage)</option>
          <option value="ADJUSTMENT_IN">সমন্বয় বৃদ্ধি (Adjustment In)</option>
        </select>

        <div className="text-xs text-gray-500">
          মোট রেকর্ড: <span className="font-bold text-gray-900">{movements.length}</span> টি
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-600 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3">তারিখ ও সময়</th>
                <th className="px-4 py-3">পণ্য বিবরণ</th>
                <th className="px-4 py-3">ক্যাম্পাস</th>
                <th className="px-4 py-3">মুভমেন্টের ধরন</th>
                <th className="px-4 py-3 text-center">পরিমাণ</th>
                <th className="px-4 py-3">নথিভুক্তকারী</th>
                <th className="px-4 py-3">মন্তব্য</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    লোড হচ্ছে...
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    কোনো স্টক মুভমেন্ট রেকর্ড পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                movements.map((m) => {
                  const isInbound = ['PURCHASE_IN', 'TRANSFER_IN', 'RETURN_IN', 'ADJUSTMENT_IN'].includes(
                    m.movementType
                  );

                  return (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3.5 text-xs text-gray-600">
                        {new Date(m.movementDate).toLocaleDateString('bn-BD')}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-gray-900">{m.item.nameEn}</div>
                        <div className="text-xs text-gray-500">Code: {m.item.itemCode}</div>
                      </td>
                      <td className="px-4 py-3.5 text-gray-700">
                        {m.campus?.name || 'Main Campus'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isInbound
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isInbound ? (
                            <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3 text-rose-600" />
                          )}
                          {m.movementType}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-gray-900">
                        {isInbound ? `+${m.quantity}` : `-${m.quantity}`} {m.item.stockUnit}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-600">
                        {m.createdBy?.name || 'Admin'}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-500">
                        {m.notes || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Movement Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">স্টক মুভমেন্ট এন্ট্রি</h3>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddMovement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  পণ্য নির্বাচন করুন *
                </label>
                <select
                  required
                  value={formData.itemId}
                  onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">আইটেম পছন্দ করুন...</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.nameEn} ({it.itemCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  মুভমেন্টের ধরন *
                </label>
                <select
                  value={formData.movementType}
                  onChange={(e) => setFormData({ ...formData, movementType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                >
                  <option value="ISSUE_OUT">বিতরণ (Issue Out)</option>
                  <option value="PURCHASE_IN">ক্রয় প্রাপ্তি (Purchase In)</option>
                  <option value="RETURN_IN">ফেরত গ্রহণ (Return In)</option>
                  <option value="ADJUSTMENT_IN">সমন্বয় ইন (Adjustment In)</option>
                  <option value="DAMAGE">ক্ষতিগ্রস্ত বাদ (Damage Write-off)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    পরিমাণ *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    একক মূল্য (৳)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.unitCost}
                    onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  মন্তব্য / বিবরণ
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="যেমন: বিজ্ঞানাগারে ব্যবহারের জন্য বিতরণ..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                />
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
                  {submitting ? 'লিপিবদ্ধ হচ্ছে...' : 'লিপিবদ্ধ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
