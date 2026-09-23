/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Search, Store, X, Trash2, List, MapPin, FileSpreadsheet, Printer, Upload } from 'lucide-react';
import { Supplier } from '../types';
import { toPersianDigits, normalizePhone } from '../utils/numberUtils';
import { sortData, SortDirection } from '../utils/sortUtils';
import { Pagination } from './Pagination';
import { TableColumnHeader, ColumnFilterMenu, FilterMenuState } from './TableFilterSort';
import { returnToOriginView, peekNavigationOrigin } from '../utils/navigation';
import { exportToCsv, printTableReport } from '../utils/exportPrintUtils';
import DefinitionsExcelImportModal from './DefinitionsExcelImportModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface SuppliersViewProps {
  suppliers: Supplier[];
  onAddSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => Promise<void>;
  onEditSupplier: (id: number, supplier: Partial<Supplier>) => Promise<void>;
  onDeleteSupplier: (id: number) => Promise<void>;
  onBulkImportSuccess?: (summary: any, data: any) => void;
}

export default function SuppliersView({
  suppliers,
  onAddSupplier,
  onEditSupplier,
  onDeleteSupplier,
  onBulkImportSuccess
}: SuppliersViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);
  const [deleteConfirmSupplier, setDeleteConfirmSupplier] = useState<Supplier | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // فیلترهای سبک اکسل ستون‌ها
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [filterMenu, setFilterMenu] = useState<FilterMenuState | null>(null);

  const getSupplierColValue = (s: Supplier, colKey: string): string => {
    if (colKey === 'name') return s.name || 'ثبت نشده';
    if (colKey === 'address') return s.address || 'ثبت نشده';
    if (colKey === 'phone') return s.phone ? toPersianDigits(s.phone) : (s.mobile ? toPersianDigits(s.mobile) : 'ثبت نشده');
    return String((s as any)[colKey] ?? 'ثبت نشده');
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
    suppliers.forEach(s => {
      const val = getSupplierColValue(s, filterMenu.colKey);
      valMap.set(val, (valMap.get(val) || 0) + 1);
    });
    return Array.from(valMap.entries()).map(([value, count]) => ({ value, count }));
  }, [filterMenu, suppliers]);

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

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // فرم استیت
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittedPhoneRef = useRef<string | null>(null);

  // بررسی بلادرنگ تکراری بودن شماره تماس در تامین‌کنندگان (منحصراً در بخش تامین‌کنندگان)
  const duplicateSupplier = useMemo(() => {
    if (isSubmitting) return null;
    const normCurrent = normalizePhone(phone);
    if (!normCurrent || normCurrent.length < 7) return null;
    if (submittedPhoneRef.current && submittedPhoneRef.current === normCurrent) return null;
    return suppliers.find(s => {
      if (editingSupplierId && s.id === editingSupplierId) return false;
      const normS = normalizePhone(s.phone || s.mobile);
      return normS && normS === normCurrent;
    }) || null;
  }, [phone, suppliers, editingSupplierId, isSubmitting]);

  const [isNavigatedFromOrigin, setIsNavigatedFromOrigin] = useState(false);

  const handleOpenCreateForm = () => {
    submittedPhoneRef.current = null;
    setEditingSupplierId(null);
    setName('');
    setPhone('');
    setAddress('');
    setIsFormOpen(true);
  };

  useEffect(() => {
    const handleOpenEvent = (e: any) => {
      if (e.detail?.entityType === 'supplier') {
        setIsNavigatedFromOrigin(Boolean(e.detail?.fromView || peekNavigationOrigin()));
        handleOpenCreateForm();
      }
    };
    window.addEventListener('app:open-create-form', handleOpenEvent);
    return () => window.removeEventListener('app:open-create-form', handleOpenEvent);
  }, []);

  const handleCloseOrReturn = () => {
    setIsFormOpen(false);
    submittedPhoneRef.current = null;
    setEditingSupplierId(null);
    setName('');
    setPhone('');
    setAddress('');
    if (isNavigatedFromOrigin || peekNavigationOrigin()) {
      setIsNavigatedFromOrigin(false);
      returnToOriginView();
    }
  };

  const handleOpenEditForm = (s: Supplier) => {
    submittedPhoneRef.current = null;
    setIsNavigatedFromOrigin(false);
    setEditingSupplierId(s.id);
    setName(s.name || '');
    setPhone(s.phone || s.mobile || '');
    setAddress(s.address || '');
    setIsFormOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmSupplier) return;
    setIsDeleting(true);
    try {
      await onDeleteSupplier(deleteConfirmSupplier.id);
      setDeleteConfirmSupplier(null);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'خطا در حذف تامین‌کننده');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      alert('لطفاً فیلدهای الزامی (نام تامین‌کننده و شماره تماس) را پر کنید.');
      return;
    }

    if (duplicateSupplier) {
      alert(`این شماره تماس قبلاً برای تامین‌کننده «${duplicateSupplier.name}» در بخش تامین‌کنندگان ثبت شده است.`);
      return;
    }

    const normCurrent = normalizePhone(phone.trim());

    const existing = editingSupplierId ? suppliers.find(s => s.id === editingSupplierId) : null;

    const payload: any = {
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim() || undefined,
      status: 'active' as const
    };

    if (existing?.category) {
      payload.category = existing.category;
    }
    if (existing?.contactPerson) {
      payload.contactPerson = existing.contactPerson;
    }

    setIsSubmitting(true);
    submittedPhoneRef.current = normCurrent;
    try {
      if (editingSupplierId) {
        await onEditSupplier(editingSupplierId, payload);
      } else {
        await onAddSupplier(payload);
      }
      handleCloseOrReturn();
    } catch (err: any) {
      console.error(err);
      submittedPhoneRef.current = null;
      alert(err?.message || 'خطا در ذخیره اطلاعات تامین‌کننده');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch = !q ||
        (s.name || '').toLowerCase().includes(q) ||
        (s.address && s.address.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(searchTerm.trim())) ||
        (s.mobile && s.mobile.includes(searchTerm.trim()));

      if (!matchesSearch) return false;

      for (const [key, selectedVals] of Object.entries(columnFilters)) {
        if (!selectedVals || !Array.isArray(selectedVals)) continue;
        const val = getSupplierColValue(s, key);
        if (!selectedVals.includes(val)) return false;
      }

      return true;
    });
  }, [suppliers, searchTerm, columnFilters]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, columnFilters]);

  const sortedSuppliers = useMemo(() => {
    return sortData(filteredSuppliers, sortKey, sortDirection);
  }, [filteredSuppliers, sortKey, sortDirection]);

  const totalPages = Math.ceil(sortedSuppliers.length / pageSize) || 1;
  const paginatedSuppliers = useMemo(() => {
    return sortedSuppliers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [sortedSuppliers, currentPage, pageSize]);

  // خروجی اکسل تامین‌کنندگان
  const handleExportExcel = () => {
    const headers = [
      'ردیف',
      'نام تامین‌کننده / فروشگاه',
      'آدرس',
      'شماره تماس'
    ];

    const rows = sortedSuppliers.map((s, idx) => [
      idx + 1,
      s.name || '---',
      s.address || '---',
      s.phone || s.mobile || '---'
    ]);

    exportToCsv('لیست_تامین_کنندگان_و_فروشگاه_ها', headers, rows);
  };

  // چاپ گزارش رسمی تامین‌کنندگان
  const handlePrint = () => {
    const headers = [
      'ردیف',
      'نام فروشگاه / تامین‌کننده',
      'نشانی / آدرس',
      'شماره تماس / همراه'
    ];

    const rows = sortedSuppliers.map((s, idx) => [
      toPersianDigits(idx + 1),
      s.name || '---',
      s.address || '---',
      toPersianDigits(s.phone || s.mobile || '---')
    ]);

    printTableReport({
      title: 'گزارش رسمی فهرست تامین‌کنندگان و فروشگاه‌های قطعات',
      subtitle: 'مدیریت ناوگان خودرویی یاس - تعاریف پایه مراکز تامین قطعات و ملزومات',
      filterInfo: [
        { label: 'تعداد کل تامین‌کنندگان', value: `${toPersianDigits(sortedSuppliers.length)} مورد` },
        ...(searchTerm ? [{ label: 'عبارت جستجوشده', value: searchTerm }] : [])
      ],
      headers,
      rows,
      columnAligns: ['center', 'right', 'right', 'center'],
      summaryItems: [
        { label: 'مجموع مراکز و تامین‌کنندگان ثبت‌شده', value: `${toPersianDigits(sortedSuppliers.length)} مورد`, isHighlight: true }
      ]
    });
  };

  if (isFormOpen) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-[#111113] rounded-lg w-full border border-slate-200 dark:border-[#2d2d30] flex flex-col overflow-hidden space-y-0">
          
          {/* هدر صفحه فرم */}
          <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
            <div>
              <h3 className="text-slate-900 dark:text-white text-base font-bold flex items-center gap-2">
                <Store className="w-5 h-5 text-indigo-600 dark:text-indigo-500" />
                <span>{editingSupplierId ? 'ویرایش اطلاعات تامین‌کننده' : 'ثبت تامین‌کننده و فروشگاه جدید'}</span>
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                ثبت مشخصات تامین‌کننده، آدرس و شماره تماس
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors border border-transparent hover:border-slate-300 dark:hover:border-[#2d2d30] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* فرم */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs bg-white dark:bg-[#111113]">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* نام تامین‌کننده */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  نام تامین‌کننده / فروشگاه <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: بازرگانی پارت سنتر یا فروشگاه لنت البرز"
                  className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* شماره تلفن تماس */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  شماره تماس <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="مثال: 02133991122 یا 09121112233"
                  className={`w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white border ${
                    duplicateSupplier ? 'border-rose-500 dark:border-rose-500 focus:ring-rose-500' : 'border-slate-300 dark:border-[#2d2d30] focus:border-indigo-500'
                  } rounded-lg px-3 py-2.5 text-xs font-bold text-left focus:outline-none font-mono`}
                />
                {duplicateSupplier ? (
                  <p className="text-[10px] text-rose-500 dark:text-rose-400 font-medium">
                    این شماره تماس قبلاً برای تامین‌کننده «{duplicateSupplier.name}» در بخش تامین‌کنندگان ثبت شده است.
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">شماره در بخش تامین‌کنندگان نباید تکراری باشد.</p>
                )}
              </div>

              {/* آدرس */}
              <div className="space-y-1 sm:col-span-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300">آدرس</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="مثال: تهران، خیابان چراغ برق، پاساژ کاشانی، پلاک ۱۲"
                  className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

            </div>

            {/* دکمه‌های فرم */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-[#2d2d30]">
              {editingSupplierId ? (
                <button
                  type="button"
                  onClick={() => {
                    const currentS = suppliers.find(sup => sup.id === editingSupplierId);
                    if (currentS) {
                      setIsFormOpen(false);
                      setDeleteConfirmSupplier(currentS);
                    }
                  }}
                  className="px-3 py-2 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-bold rounded-md transition-colors border border-rose-200 dark:border-rose-900/50 text-xs cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف این تامین‌کننده</span>
                </button>
              ) : <div />}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseOrReturn}
                  className="px-3 py-2 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-400 font-bold rounded-md transition-colors border border-slate-200 dark:border-[#2d2d30] text-xs cursor-pointer"
                >
                  {(isNavigatedFromOrigin || peekNavigationOrigin()) ? 'انصراف و بازگشت' : 'انصراف'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-md transition-colors active:scale-95 text-xs cursor-pointer"
                >
                  {isSubmitting ? 'در حال ذخیره...' : (editingSupplierId ? 'ذخیره تغییرات' : ((isNavigatedFromOrigin || peekNavigationOrigin()) ? 'ثبت تامین‌کننده و بازگشت' : 'ذخیره اطلاعات تامین‌کننده'))}
                </button>
              </div>
            </div>

          </form>

        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      
      {/* هدر صفحه */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-[#111113] p-4 rounded-lg border border-slate-200 dark:border-[#2d2d30]">
        <div>
          <h1 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Store className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            تعریف و مدیریت تامین‌کنندگان و فروشگاه‌ها
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            ثبت، ویرایش و مدیریت فروشگاه‌ها، بازرگانی‌ها و مراکز تامین کالا و قطعات
          </p>
        </div>
        <button
          onClick={handleOpenCreateForm}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          ثبت تامین‌کننده جدید
        </button>
      </div>

      {/* بخش جستجو، خروجی اکسل و چاپ */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="جستجو بر اساس نام تامین‌کننده، آدرس یا شماره تماس..."
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

        {/* دکمه ورود از اکسل */}
        <button
          type="button"
          onClick={() => setIsImportModalOpen(true)}
          className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-2xs shrink-0 group self-center"
          title="بارگذاری فایل اکسل و ورود اطلاعات تامین‌کنندگان"
        >
          <Upload className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>

        {/* دکمه خروجی اکسل */}
        <button
          type="button"
          onClick={handleExportExcel}
          className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-2xs shrink-0 group self-center"
          title="دریافت خروجی اکسل لیست تامین‌کنندگان"
        >
          <FileSpreadsheet className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>

        {/* دکمه چاپ */}
        <button
          type="button"
          onClick={handlePrint}
          className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-indigo-500 text-indigo-600 dark:text-indigo-400 transition-all cursor-pointer shadow-2xs shrink-0 group self-center"
          title="چاپ گزارش رسمی تامین‌کنندگان (نسخه چاپی / PDF)"
        >
          <Printer className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>
      </div>

      {/* جدول نمایش تامین‌کنندگان */}
      <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex justify-between items-center">
          <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
            <List className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>لیست تامین‌کنندگان و فروشگاه‌ها</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              {toPersianDigits(sortedSuppliers.length)} مورد
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161619] text-slate-600 dark:text-slate-400 font-medium text-xs">
                <th className="py-2 px-3 text-center w-12 text-xs font-medium">ردیف</th>
                <TableColumnHeader
                  title="تامین‌کننده / فروشگاه"
                  colKey="name"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['name']}
                  onOpenFilter={handleOpenFilterMenu}
                />
                <TableColumnHeader
                  title="آدرس"
                  colKey="address"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['address']}
                  onOpenFilter={handleOpenFilterMenu}
                />
                <TableColumnHeader
                  title="تلفن تماس"
                  colKey="phone"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['phone']}
                  onOpenFilter={handleOpenFilterMenu}
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
              {paginatedSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500 text-[11px]">
                    هیچ تامین‌کننده‌ای با شرایط مورد نظر یافت نشد.
                  </td>
                </tr>
              ) : (
                paginatedSuppliers.map((s, index) => (
                  <tr 
                    key={s.id} 
                    onClick={() => handleOpenEditForm(s)}
                    title="برای ویرایش مشخصات تامین‌کننده کلیک کنید"
                    className="group relative hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/60 transition-colors cursor-pointer text-[11px]"
                  >
                    <td className="py-1.5 px-3 text-center text-slate-500 text-[11px]">
                      {toPersianDigits((currentPage - 1) * pageSize + index + 1)}
                    </td>
                    <td className="py-1.5 px-3">
                      <span className="text-slate-900 dark:text-white text-[11px]">{s.name}</span>
                    </td>
                    <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300 text-[11px]">
                      <span>{s.address || 'ثبت نشده'}</span>
                    </td>
                    <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300 text-[11px] relative">
                      <span>{toPersianDigits(s.phone || s.mobile || '-')}</span>

                      {/* دکمه‌های عملیات شناور - فقط هنگام بردن موس روی ردیف */}
                      <div className="absolute inset-y-0 left-0 pl-2.5 pr-14 flex items-center gap-1 bg-gradient-to-r from-slate-50 via-slate-50 via-70% to-transparent dark:from-[#1a1a1c] dark:via-[#1a1a1c] dark:via-70% dark:to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 z-20 pointer-events-none group-hover:pointer-events-auto">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmSupplier(s);
                          }}
                          className="p-1 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-rose-100 dark:hover:bg-rose-600/20 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded border border-slate-200 dark:border-[#2d2d30] transition-colors cursor-pointer"
                          title="حذف"
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
          totalItems={filteredSuppliers.length}
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

      {/* پنجره پاپ‌آپ ورود تعاریف تامین‌کنندگان از اکسل */}
      <DefinitionsExcelImportModal
        isOpen={isImportModalOpen}
        initialType="suppliers"
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={onBulkImportSuccess}
      />

      {/* مدال تایید حذف تامین‌کننده */}
      <DeleteConfirmModal
        isOpen={deleteConfirmSupplier !== null}
        title="حذف تامین‌کننده"
        subtitle={deleteConfirmSupplier ? deleteConfirmSupplier.name : ''}
        message={deleteConfirmSupplier ? `آیا از حذف تامین‌کننده «${deleteConfirmSupplier.name}» اطمینان دارید؟` : ''}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          if (!isDeleting) setDeleteConfirmSupplier(null);
        }}
      />
    </div>
  );
}
