import { getCurrentJalaliDate } from './date';
import { toPersianDigits } from './numberUtils';

export interface FilterInfoItem {
  label: string;
  value: string;
}

export interface SummaryItem {
  label: string;
  value: string;
  isHighlight?: boolean;
}

export interface SignatureItem {
  role: string;
  name?: string;
}

export interface PrintReportOptions {
  title: string;
  subtitle?: string;
  filterInfo?: FilterInfoItem[];
  headers: string[];
  rows: (string | number)[][];
  columnAligns?: ('right' | 'center' | 'left')[];
  summaryItems?: SummaryItem[];
  signatures?: SignatureItem[];
}

export function exportToCsv(fileName: string, headers: string[], rows: (string | number)[][]): void {
  try {
    const sanitize = (val: any) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvContent = '\uFEFF' + [
      headers.map(sanitize).join(','),
      ...rows.map(row => row.map(sanitize).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const safeDate = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `${fileName}_${safeDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Export Excel error:', err);
    alert('خطا در صدور خروجی اکسل');
  }
}

export function printTableReport(options: PrintReportOptions): void {
  const {
    title,
    subtitle = 'مدیریت ناوگان خودرویی یاس - گزارش رسمی ترابری',
    filterInfo = [],
    headers,
    rows,
    columnAligns = [],
    summaryItems = [],
    signatures = [
      { role: 'مسئول واحد ترابری و لجستیک' },
      { role: 'مدیر امور پشتیبانی و اداری' },
      { role: 'تاییدکننده نهایی' }
    ]
  } = options;

  const today = getCurrentJalaliDate();
  const docNum = Math.floor(100000 + Math.random() * 900000);

  const aligns = headers.map((_, i) => columnAligns[i] || (i === 0 ? 'center' : 'right'));

  const tableHtml = `
    <table>
      <thead>
        <tr>
          ${headers.map((h, i) => `<th style="text-align: ${aligns[i]};">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            ${row.map((cell, i) => `<td style="text-align: ${aligns[i]};">${cell !== undefined && cell !== null && cell !== '' ? cell : '---'}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const filterHtml = filterInfo.length > 0 ? `
    <div class="filter-info">
      ${filterInfo.map(f => `<div><span>${f.label}: </span><strong>${f.value}</strong></div>`).join('')}
    </div>
  ` : '';

  const summaryHtml = summaryItems.length > 0 ? `
    <div class="total-box">
      ${summaryItems.map(item => `
        <div class="${item.isHighlight ? 'total-final' : 'total-row'}">
          <span>${item.label}:</span>
          <span style="font-family: monospace; font-weight: bold;">${item.value}</span>
        </div>
      `).join('')}
    </div>
  ` : '';

  const signaturesHtml = signatures.length > 0 ? `
    <div class="signatures" style="grid-template-columns: repeat(${Math.min(signatures.length, 4)}, 1fr);">
      ${signatures.map(s => `
        <div class="sign-card">
          <span style="font-weight: bold;">${s.role}</span>
          ${s.name ? `<span style="font-size: 9.5px; color: #444;">${s.name}</span>` : ''}
          <span style="border-bottom: 1px dashed #777; width: 80%; margin: 0 auto;"></span>
        </div>
      `).join('')}
    </div>
  ` : '';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm 12mm; }
          * { box-sizing: border-box; font-family: "IRANYekanX", "Yekan Bakh", "Vazirmatn", Tahoma, sans-serif; }
          body { background: #fff; color: #111; margin: 0; padding: 15px; font-size: 11px; line-height: 1.5; direction: rtl; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 12px; }
          .title { font-size: 15px; font-weight: 900; margin: 0 0 4px 0; }
          .subtitle { font-size: 10px; color: #555; margin: 0; }
          .meta-box { border: 1px solid #333; border-radius: 6px; padding: 6px 12px; font-size: 10.5px; min-width: 180px; line-height: 1.8; }
          .filter-info { display: flex; flex-wrap: wrap; gap: 16px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 12px; margin-bottom: 12px; font-size: 10.5px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 12px; border: 1px solid #333; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10px; }
          th { background: #f1f5f9; font-weight: bold; color: #0f172a; border-bottom: 2px solid #475569; }
          tr:nth-child(even) { background-color: #fcfcfd; }
          .total-box { display: flex; flex-direction: column; gap: 4px; border: 1.5px solid #000; border-radius: 6px; padding: 8px 14px; margin-bottom: 16px; background: #fafafa; }
          .total-row { display: flex; justify-content: space-between; align-items: center; font-size: 11px; }
          .total-final { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #000; padding-top: 5px; margin-top: 3px; font-weight: bold; font-size: 12px; }
          .signatures { display: grid; gap: 20px; margin-top: 24px; page-break-inside: avoid; }
          .sign-card { border: 1px solid #666; border-radius: 6px; padding: 8px; text-align: center; height: 75px; display: flex; flex-direction: column; justify-content: space-between; font-size: 10.5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">${title}</h1>
            <p class="subtitle">${subtitle}</p>
          </div>
          <div class="meta-box">
            <div><strong>تاریخ گزارش:</strong> ${toPersianDigits(today)}</div>
            <div><strong>شماره سند:</strong> #${toPersianDigits(docNum)}</div>
            <div><strong>وضعیت:</strong> رسمی و معتبر</div>
          </div>
        </div>

        ${filterHtml}
        ${tableHtml}
        ${summaryHtml}
        ${signaturesHtml}
      </body>
    </html>
  `;

  const printFrame = document.createElement('iframe');
  printFrame.style.position = 'fixed';
  printFrame.style.right = '0';
  printFrame.style.bottom = '0';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = '0';
  document.body.appendChild(printFrame);

  const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
  if (frameDoc) {
    frameDoc.open();
    frameDoc.write(htmlContent);
    frameDoc.close();
    setTimeout(() => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch (e) {
        console.error('Print frame error:', e);
      } finally {
        setTimeout(() => {
          if (document.body.contains(printFrame)) {
            document.body.removeChild(printFrame);
          }
        }, 1500);
      }
    }, 350);
  }
}
