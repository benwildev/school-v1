import { ReportColumn } from './report-types.ts';
import { formatCurrency, formatDateDhaka } from './report-formatters.ts';

/**
 * Escapes a field for RFC 4180 CSV compliance.
 */
export function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates an RFC 4180 compliant CSV string with UTF-8 BOM (\uFEFF)
 * for native Bengali text rendering in Excel for Windows.
 */
export function generateCsv(columns: ReportColumn[], data: Record<string, any>[]): string {
  const BOM = '\uFEFF';
  const headerRow = columns.map((c) => escapeCsv(`${c.labelEn} (${c.labelBn})`)).join(',');

  const rows = data.map((row) =>
    columns
      .map((c) => {
        let val = row[c.key];
        if (c.type === 'currency') val = formatCurrency(val);
        else if (c.type === 'date') val = formatDateDhaka(val);
        return escapeCsv(val);
      })
      .join(',')
  );

  return BOM + [headerRow, ...rows].join('\r\n');
}

/**
 * Generates a print-friendly HTML document with institutional formatting.
 */
export function generatePrintHtml(
  reportTitle: string,
  reportTitleBn: string,
  columns: ReportColumn[],
  data: Record<string, any>[],
  _metadata?: Record<string, any>
): string {

  const generatedAt = formatDateDhaka(new Date(), { includeTime: true });

  const headersHtml = columns
    .map(
      (c) =>
        `<th style="border: 1px solid #d1d5db; padding: 8px 12px; background-color: #f3f4f6; text-align: ${c.align || 'left'}; font-size: 12px;">
          ${c.labelEn}<br/><span style="color: #6b7280; font-size: 11px;">${c.labelBn}</span>
        </th>`
    )
    .join('');

  const rowsHtml = data
    .map(
      (row, idx) =>
        `<tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
          ${columns
            .map((c) => {
              let val = row[c.key];
              if (c.type === 'currency') val = formatCurrency(val);
              else if (c.type === 'date') val = formatDateDhaka(val);
              return `<td style="border: 1px solid #e5e7eb; padding: 6px 12px; text-align: ${c.align || 'left'}; font-size: 12px;">${val ?? '-'}</td>`;
            })
            .join('')}
        </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <title>${reportTitle} - EduSmart BD</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif, 'SolaimanLipi'; margin: 24px; color: #111827; }
    .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #3b82f6; padding-bottom: 16px; }
    .header h1 { margin: 0; font-size: 22px; color: #1e3a8a; }
    .header h2 { margin: 4px 0 0 0; font-size: 16px; color: #4b5563; font-weight: normal; }
    .meta { font-size: 12px; color: #6b7280; margin-bottom: 16px; display: flex; justify-content: space-between; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .footer { margin-top: 24px; font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 12px; }
    @media print {
      body { margin: 10mm; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>EduSmart BD — School Management System</h1>
    <h2>${reportTitle} / ${reportTitleBn}</h2>
  </div>
  <div class="meta">
    <span><strong>Generated:</strong> ${generatedAt}</span>
    <span><strong>Total Records:</strong> ${data.length}</span>
  </div>
  <table>
    <thead><tr>${headersHtml}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="footer">
    EduSmart BD Confidential Management Intelligence Document • Page 1 of 1
  </div>
</body>
</html>`;
}
