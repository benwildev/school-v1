import { PermissionCode } from '../authorization/permissions';
import { PermissionScope } from '@prisma/client';
import { AuthContext } from '../authorization/engine';

export type ReportModule =
  | 'STUDENTS'
  | 'ACADEMICS'
  | 'ATTENDANCE'
  | 'FINANCE'
  | 'HR'
  | 'ADMISSIONS'
  | 'TRANSPORT'
  | 'LIBRARY'
  | 'INVENTORY';

export type ReportFilterType =
  | 'academicSessionId'
  | 'campusId'
  | 'classId'
  | 'sectionId'
  | 'academicGroupId'
  | 'subjectId'
  | 'shift'
  | 'studentId'
  | 'employeeId'
  | 'gender'
  | 'startDate'
  | 'endDate'
  | 'status'
  | 'paymentStatus'
  | 'attendanceStatus'
  | 'examId'
  | 'departmentId'
  | 'routeId'
  | 'libraryCategoryId'
  | 'inventoryCategoryId';

export type ExportFormat = 'CSV' | 'XLSX' | 'PDF' | 'PRINT';

export interface ReportColumn {
  key: string;
  labelEn: string;
  labelBn: string;
  type: 'string' | 'number' | 'currency' | 'date' | 'badge' | 'percentage';
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  format?: string;
}

export interface ReportFilterParams {
  academicSessionId?: string;
  campusId?: string;
  classId?: string;
  sectionId?: string;
  academicGroupId?: string;
  subjectId?: string;
  shift?: string;
  studentId?: string;
  employeeId?: string;
  gender?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  paymentStatus?: string;
  attendanceStatus?: string;
  examId?: string;
  departmentId?: string;
  routeId?: string;
  libraryCategoryId?: string;
  inventoryCategoryId?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
  [key: string]: any;
}

export interface ReportSummaryItem {
  key: string;
  labelEn: string;
  labelBn: string;
  value: string | number;
  type?: 'string' | 'number' | 'currency' | 'percentage';
}

export interface ReportChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
}

export interface ReportChartData {
  id: string;
  type: 'bar' | 'line' | 'pie' | 'donut';
  titleEn: string;
  titleBn: string;
  labels: string[];
  datasets: ReportChartDataset[];
}

export interface ReportExecutionContext {
  schoolId: string;
  userId: string;
  userRole?: string;
  scope: PermissionScope;
  userCampusId?: string | null;
  teacherId?: string | null;
  filters: ReportFilterParams;
}

export interface ReportExecutionResult {
  data: Record<string, any>[];
  totalCount: number;
  columns: ReportColumn[];
  summary?: ReportSummaryItem[];
  charts?: ReportChartData[];
  metadata?: Record<string, any>;
}

export interface ReportDefinition {
  reportId: string;
  name: string;
  nameBn: string;
  module: ReportModule;
  description: string;
  descriptionBn: string;
  requiredPermission: PermissionCode;
  supportedFilters: ReportFilterType[];
  supportedExports: ExportFormat[];
  defaultSort: { field: string; order: 'ASC' | 'DESC' };
  execute: (ctx: ReportExecutionContext) => Promise<ReportExecutionResult>;
}

export interface SavedReportPreset {
  id: string;
  schoolId: string;
  userId: string;
  reportId: string;
  name: string;
  nameBn?: string | null;
  description?: string | null;
  filters: Record<string, any>;
  columns?: string[] | null;
  sortBy?: string | null;
  sortOrder?: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OverviewKpiCard {
  id: string;
  module: ReportModule;
  titleEn: string;
  titleBn: string;
  value: string | number;
  subtextEn?: string;
  subtextBn?: string;
  trend?: {
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
    percentage?: number;
    labelEn?: string;
    labelBn?: string;
  };
  type?: 'number' | 'currency' | 'percentage';
  icon?: string;
  badge?: string;
}

export interface ExportReportOptions {
  context: AuthContext;
  schoolId: string;
  reportId: string;
  format: ExportFormat;
  rawFilters?: Record<string, any> | URLSearchParams;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface ExportReportResult {
  content: string;
  contentType: string;
  filename: string;
  resultCount: number;
}

