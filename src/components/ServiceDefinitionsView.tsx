/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Wrench, Edit2, Trash2, X, AlertTriangle, Clock, List,
  ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet, Printer
} from 'lucide-react';
import { ServiceDefinition } from '../types';
import { toPersianDigits, formatNumber, parsePersianNumber } from '../utils/numberUtils';
import { sortData, SortDirection } from '../utils/sortUtils';
import { Pagination } from './Pagination';
import { TableColumnHeader, ColumnFilterMenu, FilterMenuState } from './TableFilterSort';
import { returnToOriginView, peekNavigationOrigin } from '../utils/navigation';
import { exportToCsv, printTableReport } from '../utils/exportPrintUtils';

interface ServiceDefinitionsViewProps {
  serviceDefinitions: ServiceDefinition[];
  onAddDefinition: (definition: Omit<ServiceDefinition, 'id' | 'createdAt'>) => Promise<void>;
  onEditDefinition: (id: number, definition: Partial<ServiceDefinition>) => Promise<void>;
  onDeleteDefinition: (id: number) => Promise<void>;
}

export default function ServiceDefinitionsView({
  serviceDefinitions,
  onAddDefinition,
  onEditDefinition,
  onDeleteDefinition
}: ServiceDefinitionsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string>('serviceType');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // فیلترهای سبک اکسل ستون‌ها
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [filterMenu, setFilterMenu] = useState<FilterMenuState | null>(null);

  const getDefColValue = (def: ServiceDefinition, colKey: string): string => {
    if (colKey === 'serviceType') return def.serviceType || 'ثبت نشده';
    if (colKey === 'intervalKm') return `${formatNumber(def.intervalKm)} km`;
    if (colKey === 'warningKm') return `${formatNumber(def.warningKm)} km`;
    return String((def as any)[colKey] ?? 'ثبت نشده');
  };

  const handleOpenFilterMenu = (e: React.MouseEvent, colKey: string, colTitle: string) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 270;
    const menuHeight = 360;
    const clampedX = Math.max(10, Math.min(e.clientX - 100, window.innerWidth - menuWidth - 10));
    const clampedY = Math.max(10, Math.min(e.clientY + 8, window.innerHeight - menuHeight - 10));
    setFilterMenu({
      x: clampedX,
      y: clampedY,
      colKey,
      colTitle
    });
  };

  const currentMenuUniqueValues = useMemo(() => {
    if (!filterMenu) return [];
    const valMap = new Map<string, number>();
    serviceDefinitions.forEach(def => {
      const val = getDefColValue(def, filterMenu.colKey);
      valMap.set(val, (valMap.get(val) || 0) + 1);
    });
    return Array.from(valMap.entries()).map(([value, count]) => ({ value, count }));
  }, [filterMenu, serviceDefinitions]);

  const currentSelectedValues = useMemo(() => {
    if (!filterMenu) return [];
    if (columnFilters[filterMenu.colKey]) {
      return columnFilters[filterMenu.colKey];
    }
    return currentMenuUniqueValues.map(v => v.value);
  }, [filterMenu, columnFilters, currentMenuUniqueValues]);

  const handleToggleColumnValue = (val: string) => {
    if (!filterMenu) return;
    const colKey = filterMenu.colKey;
    const allVals = currentMenuUniqueValues.map(v => v.value);
    const currSelected = columnFilters[colKey] ?? allVals;

    let updated: string[];
    if (currSelected.includes(val)) {
      updated = currSelected.filter(v => v !== val);
    } else {
      updated = [...currSelected, val];
    }

    if (updated.length === allVals.length) {
      const next = { ...columnFilters };
      delete next[colKey];
      setColumnFilters(next);
    } else {
      setColumnFilters({ ...columnFilters, [colKey]: updated });
    }
  };

  const handleSelectAllInColumn = () => {
    if (!filterMenu) return;
    const next = { ...columnFilters };
    delete next[filterMenu.colKey];
    setColumnFilters(next);
  };

  const handleDeselectAllInColumn = () => {
    if (!filterMenu) return;
    setColumnFilters({ ...columnFilters, [filterMenu.colKey]: [] });
  };

  const handleSelectOnlyValue = (val: string) => {
    if (!filterMenu) return;
    setColumnFilters({ ...columnFilters, [filterMenu.colKey]: [val] });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, columnFilters]);

  // مدال افزودن/ویرایش
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // فیلدهای فرم (فقط عنوان، دوره تعویض و بازه اخطار)
  const [serviceType, setServiceType] = useState('');
  const [intervalKm, setIntervalKm] = useState<number>(5000);
  const [warningKm, setWarningKm] = useState<number>(200);
  const [isNavigatedFromOrigin, setIsNavigatedFromOrigin] = useState(false);

  const handleOpenAddModal = () => {
    setEditingId(null);
    setServiceType('');
    setIntervalKm(5000);
    setWarningKm(200);
    setIsModalOpen(true);
  };

  useEffect(() => {
    const handleOpenEvent = (e: any) => {
      if (e.detail?.entityType === 'service') {
        setIsNavigatedFromOrigin(Boolean(e.detail?.fromView || peekNavigationOrigin()));
        handleOpenAddModal();
      }
    };
    window.addEventListener('app:open-create-form', handleOpenEvent);
    return () => window.removeEventListener('app:open-create-form', handleOpenEvent);
  }, []);

  const handleCloseOrReturn = () => {
    setIsModalOpen(false);
    if (isNavigatedFromOrigin || peekNavigationOrigin()) {
      setIsNavigatedFromOrigin(false);
      returnToOriginView();
    }
  };

  const handleOpenEditModal = (item: ServiceDefinition) => {
    setIsNavigatedFromOrigin(false);
    setEditingId(item.id);
    setServiceType(item.serviceType);
    setIntervalKm(item.intervalKm);
    setWarningKm(item.warningKm);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceType || !intervalKm || !warningKm) {
      alert('لطفاً عنوان خدمت، زمان/دوره تعویض و بازه اخطار را تکمیل کنید.');
      return;
    }

    try {
      if (editingId) {
        await onEditDefinition(editingId, {
          serviceType,
          intervalKm: Number(intervalKm),
          warningKm: Number(warningKm)
        });
      } else {
        await onAddDefinition({
          serviceType,
          intervalKm: Number(intervalKm),
          warningKm: Number(warningKm)
        });
      }
      handleCloseOrReturn();
    } catch (err: any) {
      alert(err?.message || 'خطا در ذخیره تعریف خدمت.');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('آیا از حذف این عنوان خدمت اطمینان دارید؟')) {
      try {
        await onDeleteDefinition(id);
      } catch (err: any) {
        alert(err?.message || 'خطا در حذف تعریف خدمت.');
      }
    }
  };

  // فیلتر بر اساس عنوان خدمت و فیلترهای ستونی
  const filteredDefinitions = useMemo(() => {
    return serviceDefinitions.filter(def => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch = !q || 
        (def.serviceType || '').toLowerCase().includes(q) ||
        (def.notes && def.notes.toLowerCase().includes(q)) ||
        String(def.intervalKm ?? '').includes(searchTerm.trim()) ||
        String(def.warningKm ?? '').includes(searchTerm.trim());
      if (!matchesSearch) return false;

      for (const [key, selectedVals] of Object.entries(columnFilters)) {
        if (!selectedVals || !Array.isArray(selectedVals)) continue;
        const val = getDefColValue(def, key);
        if (!selectedVals.includes(val)) return false;
      }

      return true;
    });
  }, [serviceDefinitions, searchTerm, columnFilters]);

  const sortedDefinitions = useMemo(() => {
    return sortData(filteredDefinitions, sortKey, sortDirection);
  }, [filteredDefinitions, sortKey, sortDirection]);

  const totalPages = Math.ceil(sortedDefinitions.length / pageSize) || 1;
  const paginatedDefinitions = useMemo(() => {
    return sortedDefinitions.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [sortedDefinitions, currentPage, pageSize]);

  // خروجی اکسل عناوین خدمات
  const handleExportExcel = () => {
    const headers = [
      'ردیف',
      'عنوان خدمت',
      'دوره کیلومتر تعویض',
      'بازه اخطار پیش‌هشدار (km)',
      'توضیحات و نکات کاربردی'
    ];

    const rows = sortedDefinitions.map((def, idx) => [
      idx + 1,
      def.serviceType,
      formatNumber(def.intervalKm),
      formatNumber(def.warningKm),
      def.notes || '---'
    ]);

    exportToCsv('لیست_عناوین_خدمات_و_سرویس_ها', headers, rows);
  };

  // چاپ گزارش رسمی عناوین خدمات
  const handlePrint = () => {
    const headers = [
      'ردیف',
      'عنوان خدمت',
      'دوره تعویض (کیلومتر)',
      'بازه اخطار (km)',
      'توضیحات و یادداشت'
    ];

    const rows = sortedDefinitions.map((def, idx) => [
      toPersianDigits(idx + 1),
      def.serviceType,
      toPersianDigits(formatNumber(def.intervalKm)),
      toPersianDigits(formatNumber(def.warningKm)),
      def.notes || '---'
    ]);

    printTableReport({
      title: 'گزارش رسمی تعاریف عناوین و دوره‌های سرویس ناوگان',
      subtitle: 'مدیریت ناوگان خودرویی یاس - جدول دوره‌های سرویس دوره‌ای',
      filterInfo: [
        { label: 'تعداد کل عناوین خدمات', value: `${toPersianDigits(sortedDefinitions.length)} مورد` },
        ...(searchTerm ? [{ label: 'عبارت جستجوشده', value: searchTerm }] : [])
      ],
      headers,
      rows,
      columnAligns: ['center', 'right', 'center', 'center', 'right'],
      summaryItems: [
        { label: 'مجموع خدمات تعریف‌شده', value: `${toPersianDigits(sortedDefinitions.length)} ردیف خدمت`, isHighlight: true }
      ]
    });
  };

  if (isModalOpen) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-[#111113] rounded-lg w-full border border-slate-200 dark:border-[#2d2d30] flex flex-col overflow-hidden space-y-0">
          
          {/* هدر صفحه فرم */}
          <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
            <div>
              <h3 className="text-slate-900 dark:text-white text-base font-bold flex items-center gap-2">
                <Wrench className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>{editingId ? 'ویرایش عنوان خدمت و فواصل تعویض' : 'تعریف خدمت دوره‌ای جدید'}</span>
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">ثبت یا ویرایش عنوان خدمت، دوره تعویض بر حسب کیلومتر و بازه هشدار</p>
            </div>
            <button
              type="button"
              onClick={handleCloseOrReturn}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors border border-transparent hover:border-slate-300 dark:hover:border-[#2d2d30] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* فرم */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs bg-white dark:bg-[#111113]">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">عنوان خدمت <span className="text-rose-500">*</span></label>
              <input
                type="text"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                placeholder="مانند تعویض روغن موتور، تعویض تسمه تایم..."
                className="w-full bg-white dark:bg-[#1a1a1c] border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  زمان / دوره تعویض (کیلومتر) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={intervalKm ? formatNumber(intervalKm) : ''}
                  onChange={(e) => setIntervalKm(parsePersianNumber(e.target.value))}
                  placeholder="مثلاً: ۵۰۰۰"
                  className="w-full bg-white dark:bg-[#1a1a1c] border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs text-indigo-700 dark:text-indigo-300 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
                <span className="text-[10px] text-slate-500 block">هر چند کیلومتر یک‌بار</span>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-amber-700 dark:text-amber-300 block">
                  بازه اخطار (کیلومتر) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={warningKm ? formatNumber(warningKm) : ''}
                  onChange={(e) => setWarningKm(parsePersianNumber(e.target.value))}
                  placeholder="مثلاً: ۲۰۰"
                  className="w-full bg-white dark:bg-[#1a1a1c] border border-amber-300 dark:border-amber-500/30 rounded-lg px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  required
                />
                <span className="text-[10px] text-amber-600 dark:text-amber-400/80 block">چند کیلومتر قبل هشدار</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-[#2d2d30]">
              <button
                type="button"
                onClick={handleCloseOrReturn}
                className="px-3 py-2 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-400 font-bold rounded-md transition-colors border border-slate-200 dark:border-[#2d2d30] text-xs cursor-pointer"
              >
                {(isNavigatedFromOrigin || peekNavigationOrigin()) ? 'انصراف و بازگشت' : 'انصراف'}
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md transition-colors active:scale-95 text-xs cursor-pointer"
              >
                {editingId ? 'ذخیره تغییرات' : ((isNavigatedFromOrigin || peekNavigationOrigin()) ? 'ثبت خدمت و بازگشت' : 'ذخیره خدمت')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      
      {/* هدر اصلی */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-[#111113] p-4 rounded-lg border border-slate-200 dark:border-[#2d2d30]">
        <div>
          <h1 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Wrench className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            جدول خدمات و زمان تعویض دوره‌ای
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            لیست عناوین خدمات به صورت تک به تک همراه با دوره کیلومتر تعویض و بازه اخطار پیش‌هشدار
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          افزودن خدمت جدید
        </button>
      </div>

      {/* ابزار جستجو، خروجی اکسل و چاپ */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="جستجوی عنوان خدمت، دوره تعویض یا توضیحات..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-[34px] bg-white dark:bg-[#111113] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg pr-9 pl-8 text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              title="پاک کردن جستجو"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* دکمه خروجی اکسل */}
        <button
          type="button"
          onClick={handleExportExcel}
          className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-2xs shrink-0 group self-center"
          title="دریافت خروجی اکسل عناوین خدمات"
        >
          <FileSpreadsheet className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>

        {/* دکمه چاپ */}
        <button
          type="button"
          onClick={handlePrint}
          className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-indigo-500 text-indigo-600 dark:text-indigo-400 transition-all cursor-pointer shadow-2xs shrink-0 group self-center"
          title="چاپ گزارش رسمی عناوین خدمات (نسخه چاپی / PDF)"
        >
          <Printer className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>
      </div>

      {/* جدول تک‌به‌تک عناوین خدمات (مینیمال بدون خطوط عمودی) */}
      <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-900 dark:text-white font-extrabold text-[11px]">
            <List className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>عناوین خدمات، دوره تعویض و بازه اخطار</span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{toPersianDigits(sortedDefinitions.length)} مورد</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#161618] border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-medium text-xs">
                <th className="py-2 px-3 w-12 text-center text-xs font-medium">ردیف</th>
                <TableColumnHeader
                  title="عنوان خدمت / قطعه مصرفی"
                  colKey="serviceType"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['serviceType']}
                  onOpenFilter={handleOpenFilterMenu}
                />
                <TableColumnHeader
                  title="زمان / دوره تعویض (کیلومتر)"
                  colKey="intervalKm"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['intervalKm']}
                  onOpenFilter={handleOpenFilterMenu}
                />
                <TableColumnHeader
                  title="بازه اخطار (پیش‌هشدار)"
                  colKey="warningKm"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['warningKm']}
                  onOpenFilter={handleOpenFilterMenu}
                />
                <th className="py-2 px-3 w-24 text-center text-xs font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
              {paginatedDefinitions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500 text-[11px]">
                    هیچ آیتم خدمتی یافت نشد.
                  </td>
                </tr>
              ) : (
                paginatedDefinitions.map((def, index) => (
                  <tr 
                    key={def.id} 
                    onClick={() => handleOpenEditModal(def)}
                    title="برای ویرایش این خدمت کلیک کنید"
                    className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/60 transition-colors cursor-pointer text-[11px]"
                  >
                    
                    {/* ردیف */}
                    <td className="py-1.5 px-3 text-center text-slate-500 text-[11px]">
                      {toPersianDigits((currentPage - 1) * pageSize + index + 1)}
                    </td>

                    {/* عنوان خدمت */}
                    <td className="py-1.5 px-3">
                      <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                        <span>{def.serviceType}</span>
                      </div>
                    </td>

                    {/* دوره تعویض */}
                    <td className="py-1.5 px-3 text-[11px]">
                      <div className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
                        <span>هر {formatNumber(def.intervalKm)} کیلومتر</span>
                      </div>
                    </td>

                    {/* بازه اخطار */}
                    <td className="py-1.5 px-3 text-[11px]">
                      <div className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                        <span>{formatNumber(def.warningKm)} کیلومتر قبل</span>
                      </div>
                    </td>

                    {/* عملیات */}
                    <td className="py-1.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(def.id);
                          }}
                          title="حذف"
                          className="p-1 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-rose-100 dark:hover:bg-rose-600/20 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded border border-slate-200 dark:border-[#2d2d30] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredDefinitions.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {filterMenu && (
        <ColumnFilterMenu
          filterMenu={filterMenu}
          uniqueValues={currentMenuUniqueValues}
          selectedValues={currentSelectedValues}
          onToggleValue={handleToggleColumnValue}
          onSelectAll={handleSelectAllInColumn}
          onDeselectAll={handleDeselectAllInColumn}
          onSelectOnly={handleSelectOnlyValue}
          onClose={() => setFilterMenu(null)}
        />
      )}
    </div>
  );
}
