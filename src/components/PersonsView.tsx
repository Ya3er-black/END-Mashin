/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, User, Phone, CheckCircle, XCircle, X, Trash2, Edit2, ArrowUpDown, ArrowUp, ArrowDown, AlertCircle, List, FileSpreadsheet, Printer, Upload } from 'lucide-react';
import { Person } from '../types';
import { toPersianDigits } from '../utils/numberUtils';
import { sortData, SortDirection } from '../utils/sortUtils';
import { Pagination } from './Pagination';
import { TableColumnHeader, ColumnFilterMenu, FilterMenuState } from './TableFilterSort';
import { returnToOriginView, peekNavigationOrigin } from '../utils/navigation';
import { exportToCsv, printTableReport } from '../utils/exportPrintUtils';
import DefinitionsExcelImportModal from './DefinitionsExcelImportModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';

function normalizePhone(phone: any): string {
  if (!phone) return '';
  let p = phone.toString().trim()
    .replace(/[۰-۹]/g, (d: string) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/[٠-٩]/g, (d: string) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[^0-9+]/g, '');

  if (p.startsWith('+98')) p = '0' + p.substring(3);
  else if (p.startsWith('0098')) p = '0' + p.substring(4);
  else if (p.startsWith('98')) p = '0' + p.substring(2);
  else if (!p.startsWith('0') && p.length === 10) p = '0' + p;

  return p;
}

interface PersonsViewProps {
  persons: Person[];
  onAddPerson: (person: Omit<Person, 'id' | 'createdAt'>) => Promise<void>;
  onEditPerson: (id: number, person: Partial<Person>) => Promise<void>;
  onDeletePerson?: (id: number) => Promise<void>;
  onBulkImportSuccess?: (summary: any, data: any) => void;
}

export default function PersonsView({
  persons,
  onAddPerson,
  onEditPerson,
  onDeletePerson,
  onBulkImportSuccess
}: PersonsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string>('fullName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPersonId, setEditingPersonId] = useState<number | null>(null);
  const [deleteConfirmPerson, setDeleteConfirmPerson] = useState<Person | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // فیلترهای سبک اکسل ستون‌ها
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [filterMenu, setFilterMenu] = useState<FilterMenuState | null>(null);

  const getPersonColValue = (p: Person, colKey: string): string => {
    if (colKey === 'fullName') return p.fullName || 'ثبت نشده';
    if (colKey === 'phone') return p.phone ? toPersianDigits(p.phone) : 'ثبت نشده';
    return String((p as any)[colKey] ?? 'ثبت نشده');
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
    persons.forEach(p => {
      const val = getPersonColValue(p, filterMenu.colKey);
      valMap.set(val, (valMap.get(val) || 0) + 1);
    });
    return Array.from(valMap.entries()).map(([value, count]) => ({ value, count }));
  }, [filterMenu, persons]);

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

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Form state (فقط نام و شماره تماس)
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  // بررسی بلادرنگ تکراری بودن شماره تماس و شناسایی صاحب شماره
  const duplicatePerson = useMemo(() => {
    const normCurrent = normalizePhone(phone);
    if (!normCurrent || normCurrent.length < 7) return null;
    return persons.find(p => {
      if (editingPersonId && p.id === editingPersonId) return false;
      const normP = normalizePhone(p.phone);
      return normP && normP === normCurrent;
    }) || null;
  }, [phone, persons, editingPersonId]);

  const [isNavigatedFromOrigin, setIsNavigatedFromOrigin] = useState(false);

  const handleOpenCreateForm = () => {
    setEditingPersonId(null);
    setFullName('');
    setPhone('');
    setIsFormOpen(true);
  };

  useEffect(() => {
    const handleOpenEvent = (e: any) => {
      if (e.detail?.entityType === 'driver') {
        setIsNavigatedFromOrigin(Boolean(e.detail?.fromView || peekNavigationOrigin()));
        handleOpenCreateForm();
      }
    };
    window.addEventListener('app:open-create-form', handleOpenEvent);
    return () => window.removeEventListener('app:open-create-form', handleOpenEvent);
  }, []);

  const handleCloseOrReturn = () => {
    setIsFormOpen(false);
    if (isNavigatedFromOrigin || peekNavigationOrigin()) {
      setIsNavigatedFromOrigin(false);
      returnToOriginView();
    }
  };

  const handleOpenEditForm = (p: Person) => {
    setIsNavigatedFromOrigin(false);
    setEditingPersonId(p.id);
    setFullName(p.fullName);
    setPhone(p.phone || '');
    setIsFormOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmPerson) return;
    setIsDeleting(true);
    try {
      if (onDeletePerson) {
        await onDeletePerson(deleteConfirmPerson.id);
      }
      setDeleteConfirmPerson(null);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'خطا در حذف راننده');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      alert('لطفاً نام راننده را وارد کنید.');
      return;
    }

    if (duplicatePerson) {
      alert(`این شماره تماس قبلاً برای "${duplicatePerson.fullName}" ثبت شده است و امکان ثبت تکراری وجود ندارد.`);
      return;
    }

    const trimmedPhone = phone.trim();

    const payload = {
      fullName: fullName.trim(),
      position: 'راننده ناوگان',
      phone: trimmedPhone,
      nationalCode: '',
      status: 'active' as const
    };

    try {
      if (editingPersonId) {
        await onEditPerson(editingPersonId, payload);
      } else {
        await onAddPerson(payload);
      }
      handleCloseOrReturn();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'خطا در ذخیره اطلاعات راننده');
    }
  };

  const filteredPersons = useMemo(() => {
    return persons.filter(p => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch = !q ||
        (p.fullName || '').toLowerCase().includes(q) ||
        (p.position && p.position.toLowerCase().includes(q)) ||
        (p.nationalCode && p.nationalCode.includes(searchTerm.trim())) ||
        (p.phone && p.phone.includes(searchTerm.trim()));
      
      if (!matchesSearch) return false;

      for (const [key, selectedVals] of Object.entries(columnFilters)) {
        if (!selectedVals || !Array.isArray(selectedVals)) continue;
        const val = getPersonColValue(p, key);
        if (!selectedVals.includes(val)) return false;
      }

      return true;
    });
  }, [persons, searchTerm, columnFilters]);

  const sortedPersons = useMemo(() => {
    return sortData(filteredPersons, sortKey, sortDirection);
  }, [filteredPersons, sortKey, sortDirection]);

  const totalPages = Math.ceil(sortedPersons.length / pageSize) || 1;
  const paginatedPersons = useMemo(() => {
    return sortedPersons.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [sortedPersons, currentPage, pageSize]);

  // خروجی اکسل رانندگان و پرسنل
  const handleExportExcel = () => {
    const headers = [
      'ردیف',
      'نام و نام خانوادگی',
      'سمت / جایگاه شغلی',
      'شماره تماس',
      'کد ملی',
      'وضعیت'
    ];

    const rows = sortedPersons.map((p, idx) => [
      idx + 1,
      p.fullName,
      p.position || 'راننده',
      p.phone || '---',
      p.nationalCode || '---',
      p.status === 'active' ? 'فعال' : 'غیرفعال'
    ]);

    exportToCsv('لیست_رانندگان_و_پرسنل', headers, rows);
  };

  // چاپ گزارش رسمی رانندگان و پرسنل
  const handlePrint = () => {
    const headers = [
      'ردیف',
      'نام و نام خانوادگی',
      'سمت / نقش',
      'شماره تماس',
      'کد ملی',
      'وضعیت'
    ];

    const rows = sortedPersons.map((p, idx) => [
      toPersianDigits(idx + 1),
      p.fullName,
      p.position || 'راننده',
      p.phone ? toPersianDigits(p.phone) : '---',
      p.nationalCode ? toPersianDigits(p.nationalCode) : '---',
      p.status === 'active' ? 'فعال' : 'غیرفعال'
    ]);

    const activeCount = sortedPersons.filter(p => p.status === 'active').length;
    const inactiveCount = sortedPersons.filter(p => p.status === 'inactive').length;

    printTableReport({
      title: 'گزارش رسمی مشخصات رانندگان و پرسنل ترابری',
      subtitle: 'مدیریت ناوگان خودرویی یاس - تعاریف پایه اشخاص و رانندگان',
      filterInfo: [
        { label: 'تعداد کل اشخاص', value: `${toPersianDigits(sortedPersons.length)} نفر` },
        ...(searchTerm ? [{ label: 'عبارت جستجوشده', value: searchTerm }] : [])
      ],
      headers,
      rows,
      columnAligns: ['center', 'right', 'right', 'center', 'center', 'center'],
      summaryItems: [
        { label: 'تعداد پرسنل فعال', value: `${toPersianDigits(activeCount)} نفر` },
        { label: 'تعداد پرسنل غیرفعال', value: `${toPersianDigits(inactiveCount)} نفر` },
        { label: 'کل افراد ثبت‌شده', value: `${toPersianDigits(sortedPersons.length)} نفر`, isHighlight: true }
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
                <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>{editingPersonId ? 'ویرایش مشخصات راننده' : 'تعریف راننده جدید'}</span>
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">مدیریت مشخصات رانندگان با نام و شماره تماس معتبر</p>
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
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">نام و نام خانوادگی <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="مثال: علی رضایی"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">شماره تماس (موبایل)</label>
                <input
                  type="text"
                  placeholder="09123456789"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className={`w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border ${
                    duplicatePerson ? 'border-rose-500 dark:border-rose-500 focus:ring-rose-500' : 'border-slate-300 dark:border-[#2d2d30] focus:ring-indigo-500'
                  } rounded-lg px-3 py-2.5 text-xs font-bold focus:outline-none focus:ring-1 font-mono`}
                />
                {duplicatePerson ? (
                  <p className="text-[10px] text-rose-500 dark:text-rose-400 font-medium">
                    شماره تکراری است و متعلق به «{duplicatePerson.fullName}» می‌باشد.
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">شماره تماس باید یکتا باشد و تکراری ثبت نمی‌شود.</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-[#2d2d30]">
              {editingPersonId ? (
                <button
                  type="button"
                  onClick={() => {
                    const currentP = persons.find(p => p.id === editingPersonId);
                    if (currentP) {
                      setIsFormOpen(false);
                      setDeleteConfirmPerson(currentP);
                    }
                  }}
                  className="px-3 py-2 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-bold rounded-md transition-colors border border-rose-200 dark:border-rose-900/50 text-xs cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف این راننده</span>
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
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md transition-colors active:scale-95 text-xs cursor-pointer"
                >
                  {editingPersonId ? 'ذخیره تغییرات' : ((isNavigatedFromOrigin || peekNavigationOrigin()) ? 'ثبت راننده و بازگشت' : 'ثبت راننده')}
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
      {/* هدر بخش */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-[#111113] p-4 rounded-lg border border-slate-200 dark:border-[#2d2d30]">
        <div>
          <h1 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            تعریف و مدیریت رانندگان
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            مدیریت لیست رانندگان با نام و شماره تماس منحصر به فرد
          </p>
        </div>
        <button
          onClick={handleOpenCreateForm}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          ثبت راننده جدید
        </button>
      </div>

      {/* ابزار جستجو، خروجی اکسل و چاپ */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="جستجوی نام راننده، سمت، کد ملی یا شماره تماس..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
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
          title="بارگذاری فایل اکسل و ورود اطلاعات رانندگان و پرسنل"
        >
          <Upload className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>

        {/* دکمه خروجی اکسل */}
        <button
          type="button"
          onClick={handleExportExcel}
          className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-2xs shrink-0 group self-center"
          title="دریافت خروجی اکسل لیست رانندگان و پرسنل"
        >
          <FileSpreadsheet className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>

        {/* دکمه چاپ */}
        <button
          type="button"
          onClick={handlePrint}
          className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-indigo-500 text-indigo-600 dark:text-indigo-400 transition-all cursor-pointer shadow-2xs shrink-0 group self-center"
          title="چاپ گزارش رسمی مشخصات رانندگان و پرسنل (نسخه چاپی / PDF)"
        >
          <Printer className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>
      </div>

      {/* جدول یا لیست رانندگان (مینیمال و فشرده) */}
      <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex justify-between items-center">
          <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
            <List className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>لیست رانندگان</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              {toPersianDigits(sortedPersons.length)} نفر
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] text-slate-600 dark:text-slate-400 font-medium text-xs">
                <th className="py-2 px-3 text-center w-12 text-xs font-medium">ردیف</th>
                <TableColumnHeader
                  title="نام و نام خانوادگی"
                  colKey="fullName"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['fullName']}
                  onOpenFilter={handleOpenFilterMenu}
                />
                <TableColumnHeader
                  title="شماره تماس"
                  colKey="phone"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['phone']}
                  onOpenFilter={handleOpenFilterMenu}
                  className="w-44"
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
              {paginatedPersons.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-slate-500 text-[11px]">
                    هیچ راننده‌ای یافت نشد.
                  </td>
                </tr>
              ) : (
                paginatedPersons.map((p, idx) => (
                  <tr 
                    key={p.id} 
                    onClick={() => handleOpenEditForm(p)}
                    title="برای ویرایش اطلاعات راننده کلیک کنید"
                    className="group relative hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/60 transition-colors cursor-pointer text-[11px]"
                  >
                    <td className="py-1.5 px-3 text-center text-slate-500 text-[11px]">
                      {toPersianDigits((currentPage - 1) * pageSize + idx + 1)}
                    </td>
                    <td className="py-1.5 px-3 text-slate-900 dark:text-white">
                      {p.fullName}
                    </td>
                    <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300 text-[11px] relative">
                      <span>{p.phone ? toPersianDigits(p.phone) : 'ثبت نشده'}</span>

                      {/* دکمه‌های عملیات شناور - فقط هنگام بردن موس روی ردیف */}
                      <div className="absolute inset-y-0 left-0 pl-2.5 pr-14 flex items-center gap-1 bg-gradient-to-r from-slate-50 via-slate-50 via-70% to-transparent dark:from-[#1a1a1c] dark:via-[#1a1a1c] dark:via-70% dark:to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 z-20 pointer-events-none group-hover:pointer-events-auto">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmPerson(p);
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
          totalItems={filteredPersons.length}
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

      {/* پنجره پاپ‌آپ ورود اشخاص و رانندگان از اکسل */}
      <DefinitionsExcelImportModal
        isOpen={isImportModalOpen}
        initialType="persons"
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={onBulkImportSuccess}
      />

      {/* مدال تایید حذف راننده */}
      <DeleteConfirmModal
        isOpen={deleteConfirmPerson !== null}
        title="حذف راننده"
        subtitle={deleteConfirmPerson ? deleteConfirmPerson.fullName : ''}
        message={deleteConfirmPerson ? `آیا از حذف راننده «${deleteConfirmPerson.fullName}» اطمینان دارید؟` : ''}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          if (!isDeleting) setDeleteConfirmPerson(null);
        }}
      />
    </div>
  );
}
