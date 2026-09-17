import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  Car, 
  Users, 
  Building2, 
  Settings, 
  Wrench, 
  Store, 
  FileCheck, 
  RefreshCw, 
  ArrowRight,
  Info,
  Check,
  ChevronLeft
} from 'lucide-react';
import { 
  DefinitionEntityType, 
  DEFINITION_COLUMNS_CONFIG, 
  parseExcelFile, 
  detectEntityTypeFromColumns, 
  mapExcelRowsToEntities, 
  downloadExcelTemplate 
} from '../utils/excelImportUtils';
import { toPersianDigits } from '../utils/numberUtils';

interface DefinitionsExcelImportViewProps {
  initialType?: DefinitionEntityType;
  isModal?: boolean;
  onClose?: () => void;
  onSuccess?: (summary: any, data: any) => void;
  onNavigate?: (view: string) => void;
}

export default function DefinitionsExcelImportView({
  initialType = 'vehicles',
  isModal = false,
  onClose,
  onSuccess,
  onNavigate
}: DefinitionsExcelImportViewProps) {
  const [selectedType, setSelectedType] = useState<DefinitionEntityType | 'multi'>(initialType);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updateDuplicates, setUpdateDuplicates] = useState(true);

  // وضعیت فایل بارگذاری شده
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);
  const [parsedSheets, setParsedSheets] = useState<{ sheetName: string; rows: any[]; headers: string[] }[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);

  // داده‌های تجزیه شده برای پیش‌نمایش
  const [previewData, setPreviewData] = useState<{
    detectedType: DefinitionEntityType;
    items: any[];
    mappedColumns: Record<string, string>;
    unmappedColumns: string[];
  } | null>(null);

  // نتیجه نهایی عملیات
  const [importResult, setImportResult] = useState<{
    summary: Record<string, { imported: number; updated: number; skipped: number; total: number }>;
    totalImported: number;
    totalUpdated: number;
  } | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const entityTabs: { id: DefinitionEntityType; label: string; icon: any }[] = [
    { id: 'vehicles', label: 'خودروها', icon: Car },
    { id: 'service_definitions', label: 'سرویس‌ها', icon: Settings },
    { id: 'companies', label: 'شرکت‌ها', icon: Building2 },
    { id: 'persons', label: 'رانندگان', icon: Users },
    { id: 'mechanics', label: 'تعمیرکاران', icon: Wrench },
    { id: 'suppliers', label: 'تامین‌کنندگان', icon: Store },
  ];

  // پردازش فایل انتخاب‌شده
  const handleFileProcess = async (file: File) => {
    if (!file) return;
    const validExts = ['.xlsx', '.xls', '.csv'];
    const hasValidExt = validExts.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      setErrorMessage('لطفاً یک فایل معتبر اکسل (.xlsx, .xls) یا CSV انتخاب فرمایید.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setImportResult(null);

    try {
      const { sheets, fileName } = await parseExcelFile(file);
      if (!sheets || sheets.length === 0 || sheets.every(s => s.rows.length === 0)) {
        throw new Error('فایل اکسل انتخاب‌شده خالی است و داده‌ای برای تعریف یافت نشد.');
      }

      setFileInfo({ name: fileName, size: file.size });
      setParsedSheets(sheets);
      setActiveSheetIndex(0);

      // تجزیه شیت اول
      processSheet(sheets[0], selectedType !== 'multi' ? selectedType : undefined);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'خطا در خواندن فایل اکسل.');
      setPreviewData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // تجزیه یک شیت مشخص
  const processSheet = (
    sheet: { sheetName: string; rows: any[]; headers: string[] },
    forcedType?: DefinitionEntityType
  ) => {
    const detected = forcedType || detectEntityTypeFromColumns(sheet.headers, sheet.sheetName) || 'vehicles';
    const { items, mappedColumns, unmappedColumns } = mapExcelRowsToEntities(sheet.rows, detected);

    setPreviewData({
      detectedType: detected,
      items,
      mappedColumns,
      unmappedColumns
    });

    if (selectedType !== 'multi') {
      setSelectedType(detected);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  // ارسال داده‌ها به سرور و تعریف خودکار
  const handleSubmitImport = async () => {
    if (!previewData || previewData.items.length === 0) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let payload: any = {};

      if (selectedType === 'multi' && parsedSheets.length > 1) {
        // فایل چند شیته
        const multiData: Record<string, any[]> = {};
        parsedSheets.forEach(sheet => {
          const type = detectEntityTypeFromColumns(sheet.headers, sheet.sheetName);
          if (type && sheet.rows.length > 0) {
            const { items } = mapExcelRowsToEntities(sheet.rows, type);
            multiData[type] = items;
          }
        });

        payload = {
          multiData,
          options: { updateDuplicates }
        };
      } else {
        // شیت تکی
        payload = {
          entityType: previewData.detectedType,
          items: previewData.items,
          options: { updateDuplicates }
        };
      }

      const res = await fetch('/api/definitions/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'خطا در ثبت اطلاعات در سرور.');
      }

      const result = await res.json();
      setImportResult({
        summary: result.summary,
        totalImported: result.totalImported,
        totalUpdated: result.totalUpdated
      });

      if (onSuccess) {
        onSuccess(result.summary, result.data);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'خطا در برقراری ارتباط با سرور.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFileInfo(null);
    setParsedSheets([]);
    setPreviewData(null);
    setImportResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={`space-y-3 ${isModal ? 'p-1' : 'animate-in fade-in duration-300'}`} dir="rtl">
      {/* هدر بخش - هماهنگ با سبک دقیق سایر بخش‌های تعاریف سامانه */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-[#111113] p-3.5 sm:p-4 rounded-lg border border-slate-200 dark:border-[#2d2d30]">
        <div>
          <h1 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            بارگذاری و ورود تعاریف از فایل اکسل
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            ثبت و به‌روزرسانی سریع ناوگان، رانندگان، شرکت‌ها، سرویس‌ها، تعمیرکاران و تامین‌کنندگان با فایل Excel یا CSV
          </p>
        </div>

        {/* دکمه دانلود قالب نمونه */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => downloadExcelTemplate(selectedType !== 'multi' ? selectedType : undefined)}
            className="h-[32px] px-3 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            title="دانلود قالب اکسل استاندارد"
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              دانلود قالب اکسل
            </span>
          </button>
        </div>
      </div>

      {/* تب‌های انتخاب موضوع (در صورت عدم ثبت نهایی) */}
      {!importResult && (
        <div className="bg-white dark:bg-[#111113] p-2.5 rounded-lg border border-slate-200 dark:border-[#2d2d30] flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 ml-1.5">
            موضوع:
          </span>
          {entityTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = selectedType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setSelectedType(tab.id);
                  if (parsedSheets.length > 0 && parsedSheets[activeSheetIndex]) {
                    processSheet(parsedSheets[activeSheetIndex], tab.id);
                  }
                }}
                className={`h-7 px-2.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                  isActive
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#252528] border-slate-200 dark:border-[#2d2d30]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setSelectedType('multi');
            }}
            className={`h-7 px-2.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
              selectedType === 'multi'
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#252528] border-slate-200 dark:border-[#2d2d30]'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>چند شیته (ترکیبی)</span>
          </button>
        </div>
      )}

      {/* نمایش پیام خطا در صورت وجود */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ناحیه آپلود و انتخاب فایل (در صورتی که هنوز فایلی آپلود نشده یا نتیجه نهایی نیامده) */}
      {!importResult && !previewData && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border border-dashed rounded-lg p-6 sm:p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[190px] ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
              : 'border-slate-300 dark:border-[#2d2d30] hover:border-indigo-400 dark:hover:border-indigo-500/70 bg-white dark:bg-[#111113]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileProcess(e.target.files[0]);
              }
            }}
          />

          <div className="w-11 h-11 rounded-lg bg-indigo-50 dark:bg-[#1a1a1c] text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center mb-2.5">
            <Upload className="w-5 h-5" />
          </div>

          <h3 className="text-xs font-bold text-slate-800 dark:text-white mb-1">
            فایل اکسل یا CSV خود را اینجا رها کنید یا کلیک نمایید
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mb-3 leading-relaxed">
            فرمت‌های مورد پشتیبانی: <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">.xlsx</span>، <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">.xls</span> یا <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">.csv</span>
            <br />
            سرستون‌های فارسی مطابق با فرم تعاریف به طور هوشمند شناسایی و تطبیق داده می‌شوند.
          </p>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#2d2d30] transition-colors">
            انتخاب فایل از کامپیوتر
          </span>
        </div>
      )}

      {/* وضعیت در حال پردازش فایل */}
      {isLoading && (
        <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] p-8 text-center">
          <RefreshCw className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
            در حال خواندن و تجزیه فایل اکسل...
          </p>
        </div>
      )}

      {/* پیش‌نمایش داده‌های خوانده شده از اکسل قبل از تایید نهایی */}
      {previewData && !importResult && (
        <div className="space-y-3">
          {/* نوار اطلاعات فایل و کنترل شیت‌ها */}
          <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-[10px]">
                XLS
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {fileInfo?.name}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#1a1a1c] text-slate-600 dark:text-slate-400 font-mono">
                    {toPersianDigits(previewData.items.length)} ردیف
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  <span>نوع تشخیص داده شده:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {DEFINITION_COLUMNS_CONFIG[previewData.detectedType]?.title || previewData.detectedType}
                  </span>
                </div>
              </div>
            </div>

            {/* کنترل شیت‌ها در صورت وجود چند شیت */}
            {parsedSheets.length > 1 && (
              <div className="flex items-center gap-1 bg-slate-50 dark:bg-[#16161a] p-1 rounded-md border border-slate-200 dark:border-[#2d2d30]">
                <span className="text-[10px] text-slate-500 px-1">شیت‌ها:</span>
                {parsedSheets.map((s, idx) => (
                  <button
                    key={s.sheetName}
                    type="button"
                    onClick={() => {
                      setActiveSheetIndex(idx);
                      processSheet(s);
                    }}
                    className={`h-6 px-2 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      activeSheetIndex === idx
                        ? 'bg-white dark:bg-[#25252e] text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    {s.sheetName} ({toPersianDigits(s.rows.length)})
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="h-7.5 px-2.5 rounded-md border border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1a1a1c] text-[11px] font-bold transition-all cursor-pointer"
              >
                تغییر فایل
              </button>
            </div>
          </div>

          {/* نوار تطبیق ستون‌ها */}
          <div className="bg-slate-50 dark:bg-[#141417] rounded-lg border border-slate-200 dark:border-[#2d2d30] p-3 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                ستون‌های تطبیق‌یافته اکسل ({toPersianDigits(Object.keys(previewData.mappedColumns).length)} ستون):
              </span>
              <span className="text-[10px] text-slate-400">
                بر اساس سرستون‌های استاندارد ناوگان
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(previewData.mappedColumns).map(([fileCol, targetKey]) => {
                const colDef = DEFINITION_COLUMNS_CONFIG[previewData.detectedType]?.columns.find(c => c.key === targetKey);
                return (
                  <span
                    key={fileCol}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-[#1a1a20] border border-slate-200 dark:border-[#2f2f38] text-[10.5px]"
                  >
                    <span className="text-slate-500 dark:text-slate-400">{fileCol}</span>
                    <ArrowRight className="w-2.5 h-2.5 text-indigo-500 rotate-180" />
                    <span className="font-bold text-slate-800 dark:text-white">{colDef?.label || targetKey}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* جدول پیش‌نمایش رکوردها */}
          <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden shadow-2xs">
            <div className="p-3 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50/50 dark:bg-[#161618] flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                پیش‌نمایش داده‌ها (۵ ردیف اول):
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                کل رکوردهای قابل ثبت: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{toPersianDigits(previewData.items.length)}</strong>
              </span>
            </div>

            <div className="overflow-x-auto max-h-[300px]">
              <table className="w-full text-right text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-[#161619] text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-[#2d2d30] sticky top-0">
                  <tr>
                    <th className="p-2.5 w-12 text-center text-[11px]">ردیف</th>
                    {DEFINITION_COLUMNS_CONFIG[previewData.detectedType]?.columns.map(col => (
                      <th key={col.key} className="p-2.5 whitespace-nowrap text-[11px]">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#222228] text-slate-800 dark:text-slate-200 font-medium">
                  {previewData.items.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-[#17171c]">
                      <td className="p-2.5 text-center text-slate-400 font-mono text-[11px]">
                        {toPersianDigits(idx + 1)}
                      </td>
                      {DEFINITION_COLUMNS_CONFIG[previewData.detectedType]?.columns.map(col => (
                        <td key={col.key} className="p-2.5 whitespace-nowrap text-[11px]">
                          {row[col.key] !== undefined && row[col.key] !== '' ? (
                            toPersianDigits(String(row[col.key]))
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">-</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {previewData.items.length > 5 && (
              <div className="p-2 bg-slate-50/50 dark:bg-[#141418] text-center text-[10.5px] text-slate-500 border-t border-slate-100 dark:border-[#222228]">
                و {toPersianDigits(previewData.items.length - 5)} ردیف دیگر که در سیستم ثبت خواهند شد...
              </div>
            )}
          </div>

          {/* گزینه‌های تکمیلی و دکمه نهایی تعریف خودکار */}
          <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={updateDuplicates}
                onChange={(e) => setUpdateDuplicates(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                در صورت وجود رکورد تکراری، اطلاعات آن به‌روزرسانی شود.
              </span>
            </label>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 sm:flex-initial h-8.5 px-3 rounded-md border border-slate-200 dark:border-[#2d2d30] text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1a1a1c] text-xs font-bold transition-all cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSubmitImport}
                disabled={isSubmitting}
                className="flex-1 sm:flex-initial h-8.5 px-4 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>در حال ثبت...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>تایید و تعریف در سیستم</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* کارت نتیجه نهایی پس از ثبت موفقیت‌آمیز */}
      {importResult && (
        <div className="bg-white dark:bg-[#111113] rounded-lg border border-emerald-200 dark:border-emerald-900/60 p-5 text-center shadow-2xs space-y-3.5">
          <div className="w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mx-auto">
            <FileCheck className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">
              اطلاعات فایل اکسل با موفقیت در سیستم ثبت گردید!
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              ردیف‌های فایل در پایگاه‌داده ذخیره شدند و اکنون در کلیه جداول و لیست‌های انتساب در دسترس هستند.
            </p>
          </div>

          {/* کارت‌های آمار ثبت */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-xl mx-auto pt-1">
            <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/20 rounded-md border border-emerald-100 dark:border-emerald-900/40 text-center">
              <span className="text-[10px] text-emerald-800 dark:text-emerald-300 block">رکوردهای جدید</span>
              <strong className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                {toPersianDigits(importResult.totalImported)}
              </strong>
            </div>
            <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/20 rounded-md border border-blue-100 dark:border-blue-900/40 text-center">
              <span className="text-[10px] text-blue-800 dark:text-blue-300 block">به‌روزرسانی‌شده</span>
              <strong className="text-base font-black font-mono text-blue-600 dark:text-blue-400 mt-0.5 block">
                {toPersianDigits(importResult.totalUpdated)}
              </strong>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-[#17171c] rounded-md border border-slate-200 dark:border-[#2d2d30] text-center col-span-2">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">کل رکوردهای پردازش‌شده</span>
              <strong className="text-base font-black font-mono text-slate-800 dark:text-white mt-0.5 block">
                {toPersianDigits(importResult.totalImported + importResult.totalUpdated)}
              </strong>
            </div>
          </div>

          {/* دکمه‌های ناوبری سریع به جداول */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="h-8 px-3 rounded-md bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#2d2d30] text-[11px] font-bold transition-all cursor-pointer"
            >
              بارگذاری فایل دیگر
            </button>

            {onNavigate && (
              <button
                type="button"
                onClick={() => {
                  const targetView = previewData?.detectedType === 'vehicles' ? 'vehicles' :
                                    previewData?.detectedType === 'persons' ? 'persons' :
                                    previewData?.detectedType === 'companies' ? 'companies' :
                                    previewData?.detectedType === 'service_definitions' ? 'service_definitions' :
                                    previewData?.detectedType === 'mechanics' ? 'mechanics' : 'suppliers';
                  onNavigate(targetView);
                  if (onClose) onClose();
                }}
                className="h-8 px-3.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <span>مشاهده در جدول تعاریف</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}

            {isModal && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="h-8 px-3.5 rounded-md bg-slate-200 dark:bg-[#252528] hover:bg-slate-300 text-slate-800 dark:text-white text-[11px] font-bold transition-all cursor-pointer"
              >
                بستن پنجره
              </button>
            )}
          </div>
        </div>
      )}

      {/* راهنمای کوتاه ساختار فایل */}
      <div className="bg-slate-50 dark:bg-[#141418] rounded-lg border border-slate-200 dark:border-[#282830] p-3 text-xs text-slate-600 dark:text-slate-400 space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-[11px]">
          <Info className="w-3.5 h-3.5 text-indigo-500" />
          <span>نکات کلیدی جهت بارگذاری بدون نقص فایل اکسل:</span>
        </div>
        <ul className="list-disc list-inside space-y-0.5 text-[10.5px] text-slate-500 dark:text-slate-400 pr-1">
          <li>سطر اول فایل اکسل باید حاوی عناوین ستون‌ها (مانند پلاک، نام خودرو، راننده، شماره تماس و...) باشد.</li>
          <li>برای تسریع کار، می‌توانید ابتدا دکمه «دانلود قالب اکسل» را زده و اطلاعات خود را در آن وارد کنید.</li>
          <li>اعداد به دو صورت ارقام فارسی و انگلیسی به درستی پشتیبانی می‌شوند.</li>
        </ul>
      </div>
    </div>
  );
}
