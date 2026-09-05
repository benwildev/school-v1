'use client';

import React, { useEffect, useState } from 'react';
import { UserCheck, Plus, Bus, Phone, AlertCircle } from 'lucide-react';
import { TransportNav } from '@/components/transport/TransportNav';

interface DriverAssignment {
  id: string;
  vehicle: {
    id: string;
    vehicleCode: string;
    registrationNumber: string;
    seatingCapacity: number;
  };
  driver: {
    id: string;
    employeeCode: string;
    fullNameEn: string;
    fullNameBn: string;
    phone: string;
  };
  conductor: {
    id: string;
    employeeCode: string;
    fullNameEn: string;
    fullNameBn: string;
    phone: string;
  } | null;
  route: {
    id: string;
    routeCode: string;
    routeName: string;
  } | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
}

interface Vehicle {
  id: string;
  vehicleCode: string;
  registrationNumber: string;
}

interface Employee {
  id: string;
  employeeCode: string;
  fullNameEn: string;
  fullNameBn: string;
  phone: string;
}

interface Route {
  id: string;
  routeCode: string;
  routeName: string;
}

export default function DriversPage() {
  const [assignments, setAssignments] = useState<DriverAssignment[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    vehicleId: '',
    driverEmployeeId: '',
    conductorEmployeeId: '',
    routeId: '',
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: '',
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function loadData() {
    try {
      setLoading(true);
      const [assignRes, vehRes, empRes, routeRes] = await Promise.all([
        fetch('/api/school/transport/driver-assignments'),
        fetch('/api/school/transport/vehicles?status=ACTIVE'),
        fetch('/api/school/employees?status=ACTIVE'),
        fetch('/api/school/transport/routes?status=ACTIVE'),
      ]);

      const [assignJson, vehJson, empJson, routeJson] = await Promise.all([
        assignRes.json(),
        vehRes.json(),
        empRes.json(),
        routeRes.json(),
      ]);

      if (assignJson.success) setAssignments(assignJson.data);
      if (vehJson.success) setVehicles(vehJson.data);
      if (empJson.success) setEmployees(empJson.data);
      if (routeJson.success) setRoutes(routeJson.data);
    } catch (err) {
      console.error('Failed to load driver assignments:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/school/transport/driver-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          conductorEmployeeId: formData.conductorEmployeeId || null,
          routeId: formData.routeId || null,
          effectiveTo: formData.effectiveTo || null,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setErrorMsg(data.error || 'Failed to assign driver');
      } else {
        setIsModalOpen(false);
        setFormData({
          vehicleId: '',
          driverEmployeeId: '',
          conductorEmployeeId: '',
          routeId: '',
          effectiveFrom: new Date().toISOString().split('T')[0],
          effectiveTo: '',
          notes: '',
        });
        loadData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserCheck className="w-7 h-7 text-emerald-600" />
            ড্রাইভার ও হেলপার দায়িত্ব বণ্টন
            <span className="text-sm font-normal text-gray-500">(Driver Assignments)</span>
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            এইচআর (Employee) থেকে চালক ও সহকারী নির্বাচন করে নির্দিষ্ট যানবাহনে কার্যকরী সময়সীমা অনুযায়ী দায়িত্ব নির্ধারণ করুন।
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          দায়িত্ব নির্ধারণ করুন
        </button>
      </div>

      <TransportNav />

      {/* Driver Assignments Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold">
              <tr>
                <th className="py-3 px-4">যানবাহন (Vehicle)</th>
                <th className="py-3 px-4">চালক (Driver - Employee)</th>
                <th className="py-3 px-4">সহকারী / হেলপার (Conductor)</th>
                <th className="py-3 px-4">রুট (Assigned Route)</th>
                <th className="py-3 px-4">কার্যকর সময়কাল (Effective Period)</th>
                <th className="py-3 px-4">স্ট্যাটাস (Status)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    লোড হচ্ছে...
                  </td>
                </tr>
              ) : assignments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    কোনো ড্রাইভার নিয়োগের তথ্য পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                assignments.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900 flex items-center gap-2">
                        <Bus className="w-4 h-4 text-emerald-600" />
                        {item.vehicle.vehicleCode}
                      </div>
                      <div className="text-xs text-gray-500">{item.vehicle.registrationNumber}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{item.driver.fullNameEn}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-gray-400" />
                        {item.driver.phone || 'মোবাইল নেই'} ({item.driver.employeeCode})
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {item.conductor ? (
                        <>
                          <div className="font-semibold text-gray-900">{item.conductor.fullNameEn}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-gray-400" />
                            {item.conductor.phone || 'মোবাইল নেই'}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">নিযুক্ত নেই</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {item.route ? (
                        <div>
                          <div className="font-medium text-gray-900">{item.route.routeName}</div>
                          <div className="text-xs text-emerald-600 font-semibold">{item.route.routeCode}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">সার্বক্ষণিক বহর</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600">
                      <div>শুরু: {new Date(item.effectiveFrom).toLocaleDateString()}</div>
                      <div>
                        সমাপ্তি:{' '}
                        {item.effectiveTo
                          ? new Date(item.effectiveTo).toLocaleDateString()
                          : 'অব্যাহত (Ongoing)'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          item.isActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {item.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Driver Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900">গাড়িতে ড্রাইভার দায়িত্ব প্রদান</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400">
                &times;
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 text-xs bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  যানবাহন নির্বাচন করুন *
                </label>
                <select
                  required
                  value={formData.vehicleId}
                  onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 bg-white"
                >
                  <option value="">যানবাহন পছন্দ করুন</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicleCode} - {v.registrationNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  চালক (Driver - Employee) *
                </label>
                <select
                  required
                  value={formData.driverEmployeeId}
                  onChange={(e) => setFormData({ ...formData, driverEmployeeId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 bg-white"
                >
                  <option value="">কর্মচারী তালিকা থেকে চালক পছন্দ করুন</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullNameEn} ({emp.employeeCode}) - {emp.phone}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  সহকারী / হেলপার (Conductor - Employee)
                </label>
                <select
                  value={formData.conductorEmployeeId}
                  onChange={(e) => setFormData({ ...formData, conductorEmployeeId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 bg-white"
                >
                  <option value="">ঐচ্ছিক: সহকারী নির্বাচন করুন</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullNameEn} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  প্রাথমিক রুট (Assigned Route)
                </label>
                <select
                  value={formData.routeId}
                  onChange={(e) => setFormData({ ...formData, routeId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 bg-white"
                >
                  <option value="">ঐচ্ছিক: নিয়মিত রুট পছন্দ করুন</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.routeCode} - {r.routeName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    শুরুর তারিখ (Effective From) *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.effectiveFrom}
                    onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    সমাপ্তির তারিখ (ঐচ্ছিক)
                  </label>
                  <input
                    type="date"
                    value={formData.effectiveTo}
                    onChange={(e) => setFormData({ ...formData, effectiveTo: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-gray-700"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? 'নির্ধারণ হচ্ছে...' : 'দায়িত্ব নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
