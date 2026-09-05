'use client';

import React, { useEffect, useState } from 'react';
import {
  MonitorCheck,
  Search,
  AlertCircle,
} from 'lucide-react';
import { InventoryNav } from '@/components/inventory/InventoryNav';

interface AssetItem {
  id: string;
  assetCode: string;
  serialNumber: string | null;
  barcode: string | null;
  purchaseCost: number;
  currentCondition: string;
  status: 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE' | 'DISPOSED' | 'RETIRED';
  roomLocation: string | null;
  item: { nameEn: string; itemCode: string };
  assignedEmployee?: { firstName: string; lastName: string; designation: string | null };
  locationClassroom?: { name: string; roomNumber: string };
}

export default function InventoryAssetsPage() {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Assign modal state
  const [selectedAssetForAssign, setSelectedAssetForAssign] = useState<AssetItem | null>(null);
  const [assignLocation, setAssignLocation] = useState('');
  const [assignCondition, setAssignCondition] = useState('GOOD');
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // Dispose modal state
  const [selectedAssetForDispose, setSelectedAssetForDispose] = useState<AssetItem | null>(null);
  const [disposeReason, setDisposeReason] = useState('');
  const [disposeValue, setDisposeValue] = useState(0);
  const [submittingDispose, setSubmittingDispose] = useState(false);

  const [actionError, setActionError] = useState<string | null>(null);

  async function fetchAssets() {
    try {
      setLoading(true);
      let url = '/api/school/inventory/assets?';
      if (statusFilter) url += `status=${statusFilter}&`;
      if (searchTerm) url += `q=${encodeURIComponent(searchTerm)}&`;

      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success) setAssets(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch assets:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAssets();
  }, [statusFilter, searchTerm]);

  async function handleConfirmAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAssetForAssign) return;
    setSubmittingAssign(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/school/inventory/assets/${selectedAssetForAssign.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationName: assignLocation.trim() || undefined,
          condition: assignCondition,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to reassign asset');
      }

      setSelectedAssetForAssign(null);
      fetchAssets();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmittingAssign(false);
    }
  }

  async function handleConfirmDispose(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAssetForDispose) return;
    setSubmittingDispose(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/school/inventory/assets/${selectedAssetForDispose.id}/dispose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disposalReason: disposeReason.trim(),
          disposalValue: Number(disposeValue) || 0,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to dispose asset');
      }

      setSelectedAssetForDispose(null);
      fetchAssets();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmittingDispose(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MonitorCheck className="w-7 h-7 text-amber-600" />
            প্রাতিষ্ঠানিক সম্পদ রেজিস্ট্রি
            <span className="text-sm font-normal text-gray-500">(Institutional Assets Registry)</span>
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            আইটি সরঞ্জাম, ল্যাব ডিভাইস ও আসবাবপত্র ট্র্যাকিং, ব্যবহারকারী দায়িত্ব ও অবলোপন হিসাব।
          </p>
        </div>
      </div>

      <InventoryNav />

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="সম্পদ কোড বা সিরিয়াল নং..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
          >
            <option value="">সকল অবস্থা (All Status)</option>
            <option value="AVAILABLE">ব্যবহারযোগ্য (Available)</option>
            <option value="ASSIGNED">দায়িত্বে অর্পিত (Assigned)</option>
            <option value="MAINTENANCE">মেরামতাধীন (Maintenance)</option>
            <option value="DISPOSED">অবলোপিত (Disposed)</option>
          </select>
        </div>

        <div className="text-xs text-gray-500">
          মোট সম্পদ: <span className="font-bold text-gray-900">{assets.length}</span> টি
        </div>
      </div>

      {/* Assets Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-600 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3">সম্পদ কোড ও নাম</th>
                <th className="px-4 py-3">সিরিয়াল ও বারকোড</th>
                <th className="px-4 py-3">বরাদ্দকৃত ব্যক্তি / রুম</th>
                <th className="px-4 py-3">অবস্থা (Condition)</th>
                <th className="px-4 py-3 text-center">স্ট্যাটাস</th>
                <th className="px-5 py-3 text-right">পদক্ষেপ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    লোড হচ্ছে...
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    কোনো সম্পদ পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-gray-900">{asset.item.nameEn}</div>
                      <div className="text-xs text-amber-700 font-mono font-medium">
                        {asset.assetCode}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-600">
                      <div>SN: {asset.serialNumber || '—'}</div>
                      <div className="text-gray-400">BC: {asset.barcode || '—'}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      {asset.assignedEmployee ? (
                        <div>
                          <div className="font-medium text-gray-900">
                            {asset.assignedEmployee.firstName} {asset.assignedEmployee.lastName}
                          </div>
                          <div className="text-xs text-gray-400">{asset.assignedEmployee.designation}</div>
                        </div>
                      ) : asset.roomLocation ? (
                        <div className="text-gray-700 text-xs font-medium">{asset.roomLocation}</div>
                      ) : (
                        <span className="text-xs text-gray-400">অব্যবহৃত (Unassigned)</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-semibold text-gray-700">
                        {asset.currentCondition}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          asset.status === 'AVAILABLE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : asset.status === 'ASSIGNED'
                            ? 'bg-blue-100 text-blue-800'
                            : asset.status === 'MAINTENANCE'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {asset.status === 'AVAILABLE'
                          ? 'প্রাপ্য'
                          : asset.status === 'ASSIGNED'
                          ? 'বরাদ্দকৃত'
                          : asset.status === 'MAINTENANCE'
                          ? 'মেরামত'
                          : 'অবলোপিত'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      {asset.status !== 'DISPOSED' && (
                        <>
                          <button
                            onClick={() => setSelectedAssetForAssign(asset)}
                            className="px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 border border-amber-300 rounded-md transition-colors"
                          >
                            পুনর্বরাদ্দ
                          </button>
                          <button
                            onClick={() => setSelectedAssetForDispose(asset)}
                            className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-md transition-colors"
                          >
                            অবলোপন
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Modal */}
      {selectedAssetForAssign && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">সম্পদ বরাদ্দ / অবস্থান পরিবর্তন</h3>
            <p className="text-xs text-gray-500 mb-4">
              সম্পদ কোড: <span className="font-semibold text-gray-800">{selectedAssetForAssign.assetCode}</span>
            </p>

            {actionError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {actionError}
              </div>
            )}

            <form onSubmit={handleConfirmAssign} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  রুম বা নতুন অবস্থান (Room / Location)
                </label>
                <input
                  type="text"
                  placeholder="যেমন: কম্পিউটার ল্যাব-১, ডেস্ক-৪"
                  value={assignLocation}
                  onChange={(e) => setAssignLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  বর্তমান অবস্থা (Condition)
                </label>
                <select
                  value={assignCondition}
                  onChange={(e) => setAssignCondition(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                >
                  <option value="NEW">নতুন (New)</option>
                  <option value="GOOD">ভালো (Good)</option>
                  <option value="FAIR">মোটামুটি (Fair)</option>
                  <option value="POOR">খারাপ (Poor)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedAssetForAssign(null)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submittingAssign}
                  className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg shadow-sm"
                >
                  {submittingAssign ? 'সংরক্ষণ হচ্ছে...' : 'বরাদ্দ সম্পন্ন করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispose Modal */}
      {selectedAssetForDispose && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">সম্পদ অবলোপন (Asset Disposal)</h3>
            <p className="text-xs text-gray-500 mb-4">
              কোড: <span className="font-semibold text-gray-800">{selectedAssetForDispose.assetCode}</span>
            </p>

            {actionError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {actionError}
              </div>
            )}

            <form onSubmit={handleConfirmDispose} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  অবলোপনের কারণ (Disposal Reason) *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="যেমন: অপূরণীয় হার্ডওয়্যার ত্রুটি বা স্ক্র্যাপ বিক্রয়..."
                  value={disposeReason}
                  onChange={(e) => setDisposeReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  অবলোপন বা স্ক্র্যাপ মূল্য (৳)
                </label>
                <input
                  type="number"
                  min="0"
                  value={disposeValue}
                  onChange={(e) => setDisposeValue(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedAssetForDispose(null)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submittingDispose}
                  className="px-4 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg shadow-sm"
                >
                  {submittingDispose ? 'প্রক্রিয়াকরণ...' : 'অবলোপন নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
