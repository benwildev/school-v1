'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Printer,
  Search,
  RefreshCw,

  Users,
  GraduationCap,
  CalendarCheck,
  CreditCard,
  Briefcase,
  UserCheck,
  Bus,
  BookOpen,
  Package,
  Layers,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Table as TableIcon,
} from 'lucide-react';

interface ReportMeta {
  reportId: string;
  name: string;
  nameBn: string;
  module: string;
  description: string;
  descriptionBn: string;
  supportedFilters: string[];
  supportedExports: string[];
}

interface ColumnDef {
  key: string;
  labelEn: string;
  labelBn: string;
  type: string;
}

export default function ReportsHubPage() {
  const [lang, setLang] = useState<'bn' | 'en'>('bn');
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingList, setLoadingList] = useState(true);

  // Active Running Report
  const [activeReport, setActiveReport] = useState<ReportMeta | null>(null);
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any[]>([]);
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);


  const modules = [
    { id: 'ALL', labelEn: 'All Modules', labelBn: 'সকল মডিউল', icon: Layers },
    { id: 'STUDENTS', labelEn: 'Students', labelBn: 'শিক্ষার্থী', icon: Users },
    { id: 'ACADEMICS', labelEn: 'Academics', labelBn: 'একাডেমিক', icon: GraduationCap },
    { id: 'ATTENDANCE', labelEn: 'Attendance', labelBn: 'উপস্থিতি', icon: CalendarCheck },
    { id: 'FINANCE', labelEn: 'Finance', labelBn: 'হিসাব ও ফি', icon: CreditCard },
    { id: 'HR', labelEn: 'HR & Payroll', labelBn: 'এইচআর ও বেতন', icon: Briefcase },
    { id: 'ADMISSIONS', labelEn: 'Admissions', labelBn: 'ভর্তি', icon: UserCheck },
    { id: 'TRANSPORT', labelEn: 'Transport', labelBn: 'পরিবহন', icon: Bus },
    { id: 'LIBRARY', labelEn: 'Library', labelBn: 'গ্রন্থাগার', icon: BookOpen },
    { id: 'INVENTORY', labelEn: 'Inventory & Assets', labelBn: 'মজুদ ও সম্পদ', icon: Package },
  ];

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    setLoadingList(true);
    try {
      const res = await fetch('/api/school/reports');
      const data = await res.json();
      if (data.success) {
        setReports(data.data);
      }
    } catch (err) {
      console.error('Failed to load reports catalog:', err);
    } finally {
      setLoadingList(false);
    }
  }

  async function runReport(report: ReportMeta, targetPage = 1) {
    setActiveReport(report);
    setRunning(true);
    setErrorMsg(null);
    setPage(targetPage);

    try {
      const params = new URLSearchParams();
      params.set('page', targetPage.toString());
      params.set('limit', '50');
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/school/reports/${report.reportId}?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setReportData(json.result.data || []);
        setColumns(json.result.columns || []);
        setSummary(json.result.summary || []);
        setTotalCount(json.result.totalCount || 0);
      } else {
        setErrorMsg(json.error || 'Failed to generate report.');
        setReportData([]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error executing report query.');
      setReportData([]);
    } finally {
      setRunning(false);
    }
  }

  function handleExport(format: 'CSV' | 'XLSX' | 'PDF') {
    if (!activeReport) return;
    setExporting(format);

    const params = new URLSearchParams();
    params.set('format', format);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (statusFilter) params.set('status', statusFilter);

    // Open export stream in new tab or trigger browser download
    const exportUrl = `/api/school/reports/${activeReport.reportId}/export?${params.toString()}`;
    window.open(exportUrl, '_blank');
    setTimeout(() => setExporting(null), 1000);
  }

  const filteredReports = reports.filter((r) => {
    const matchesModule = selectedModule === 'ALL' || r.module === selectedModule;
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.nameBn.includes(searchQuery) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.descriptionBn.includes(searchQuery);
    return matchesModule && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-800">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <TableIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {lang === 'bn' ? 'রিপোর্টিং ও ম্যানেজমেন্ট ইন্টেলিজেন্স' : 'Reporting & Analytics Hub'}
              </h1>
              <p className="text-sm text-slate-500">
                {lang === 'bn'
                  ? 'সকল মডিউলের তথ্যভিত্তিক প্রাতিষ্ঠানিক প্রতিবেদন ও রফতানি কেন্দ্র'
                  : 'Institutional filterable reports, analytics & verified exports'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          {/* Language Toggle */}
          <button
            onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 hover:bg-slate-100 transition-colors shadow-sm"
          >
            {lang === 'bn' ? 'English' : 'বাংলা'}
          </button>
        </div>
      </div>

      {/* Module Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-thin">
        {modules.map((m) => {
          const Icon = m.icon;
          const isSelected = selectedModule === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setSelectedModule(m.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{lang === 'bn' ? m.labelBn : m.labelEn}</span>
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            lang === 'bn'
              ? 'প্রতিবেদনের নাম বা বিষয়বস্তু লিখে খুঁজুন...'
              : 'Search reports by title or description...'
          }
          className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>

      {/* Grid of Reports or Active Report Viewer */}
      {!activeReport ? (
        <div>
          {loadingList ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
              <p className="text-slate-500 text-sm">
                {lang === 'bn' ? 'রিপোর্ট তালিকা প্রস্তুত করা হচ্ছে...' : 'Loading available reports...'}
              </p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center p-12 bg-white rounded-2xl border border-slate-200">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-slate-600 font-medium">
                {lang === 'bn' ? 'কোনো প্রতিবেদন পাওয়া যায়নি' : 'No matching reports found.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredReports.map((report) => (
                <div
                  key={report.reportId}
                  className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-50 text-blue-700">
                        {report.module}
                      </span>
                      <div className="flex gap-1">
                        {report.supportedExports.includes('CSV') && (
                          <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            CSV
                          </span>
                        )}
                        {report.supportedExports.includes('XLSX') && (
                          <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
                            XLSX
                          </span>
                        )}
                        {report.supportedExports.includes('PRINT') && (
                          <span className="text-[10px] font-mono bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">
                            PDF
                          </span>
                        )}
                      </div>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mb-1">
                      {lang === 'bn' ? report.nameBn : report.name}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {lang === 'bn' ? report.descriptionBn : report.description}
                    </p>
                  </div>

                  <button
                    onClick={() => runReport(report, 1)}
                    className="mt-6 w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-blue-600 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
                  >
                    <span>{lang === 'bn' ? 'প্রতিবেদন দেখুন' : 'Generate Report'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Active Report Runner & Table View */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Report Toolbar Header */}
          <div className="p-6 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <button
                onClick={() => setActiveReport(null)}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1 mb-2"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'সকল রিপোর্টে ফিরে যান' : 'Back to Reports Roster'}</span>
              </button>
              <h2 className="text-xl font-bold text-slate-900">
                {lang === 'bn' ? activeReport.nameBn : activeReport.name}
              </h2>
              <p className="text-xs text-slate-500">
                {lang === 'bn' ? activeReport.descriptionBn : activeReport.description}
              </p>
            </div>

            {/* Export Actions */}
            <div className="flex items-center gap-2">
              <button
                disabled={running || !!exporting}
                onClick={() => handleExport('CSV')}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
              <button
                disabled={running || !!exporting}
                onClick={() => handleExport('XLSX')}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-emerald-700 hover:bg-emerald-50 shadow-sm disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
              <button
                disabled={running || !!exporting}
                onClick={() => handleExport('PDF')}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-purple-700 hover:bg-purple-50 shadow-sm disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'প্রিন্ট / পিডিএফ' : 'Print / PDF'}</span>
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="p-4 bg-white border-b border-slate-100 flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">
                {lang === 'bn' ? 'তারিখ থেকে:' : 'From:'}
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">
                {lang === 'bn' ? 'তারিখ পর্যন্ত:' : 'To:'}
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {activeReport.supportedFilters.includes('status') && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600">
                  {lang === 'bn' ? 'স্ট্যাটাস:' : 'Status:'}
                </span>
                <input
                  type="text"
                  value={statusFilter}
                  placeholder="e.g. ACTIVE"
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
            <button
              onClick={() => runReport(activeReport, 1)}
              disabled={running}
              className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm disabled:opacity-50"
            >
              {running ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>{lang === 'bn' ? 'ফিল্টার প্রয়োগ করুন' : 'Apply Filters'}</span>
            </button>
          </div>

          {/* Summary Metric Cards if any */}
          {summary.length > 0 && (
            <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4">
              {summary.map((s) => (
                <div key={s.key} className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] text-slate-500 font-medium">
                    {lang === 'bn' ? s.labelBn : s.labelEn}
                  </span>
                  <p className="text-base font-bold text-slate-900 mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-4 bg-rose-50 border-b border-rose-200 flex items-center gap-3 text-rose-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Data Table */}
          <div className="overflow-x-auto">
            {running ? (
              <div className="flex flex-col items-center justify-center p-16">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
                <p className="text-sm text-slate-500">
                  {lang === 'bn' ? 'তথ্য লোড করা হচ্ছে...' : 'Fetching report records...'}
                </p>
              </div>
            ) : reportData.length === 0 ? (
              <div className="text-center p-16">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500 font-medium">
                  {lang === 'bn' ? 'কোনো তথ্য পাওয়া যায়নি' : 'No records match the selected filters.'}
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-600">
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        className={`p-3 font-semibold ${
                          col.type === 'currency' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {lang === 'bn' ? col.labelBn : col.labelEn}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {reportData.map((row, idx) => (
                    <tr
                      key={row.id || idx}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {columns.map((col) => {
                        const val = row[col.key];
                        return (
                          <td
                            key={col.key}
                            className={`p-3 text-slate-700 ${
                              col.type === 'currency'
                                ? 'text-right font-mono font-medium'
                                : 'text-left'
                            }`}
                          >
                            {col.type === 'badge' ? (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  val === 'ACTIVE' || val === 'PASSED' || val === 'SUCCESS' || val === 'ADEQUATE'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : val === 'FAILED' || val === 'OVERDUE' || val === 'LOW_STOCK'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}
                              >
                                {val}
                              </span>
                            ) : (
                              val ?? '-'
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Table Footer with Record Count and Pagination */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
            <span>
              {lang === 'bn'
                ? `মোট রেকর্ড: ${totalCount}`
                : `Total records: ${totalCount}`}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1 || running}
                onClick={() => runReport(activeReport, page - 1)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-slate-700">
                {lang === 'bn' ? `পৃষ্ঠা ${page}` : `Page ${page}`}
              </span>
              <button
                disabled={reportData.length < 50 || running}
                onClick={() => runReport(activeReport, page + 1)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
