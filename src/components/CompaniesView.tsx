/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Building2, Phone, CheckCircle, XCircle, X, Edit2, Trash2, MapPin, User, ArrowUpDown, ArrowUp, ArrowDown, List, FileSpreadsheet, Printer, Upload } from 'lucide-react';
import { Company } from '../types';
import { toPersianDigits } from '../utils/numberUtils';
import { sortData, SortDirection } from '../utils/sortUtils';
import { Pagination } from './Pagination';
import { CustomSelect } from './CustomSelect';
import { TableColumnHeader, ColumnFilterMenu, FilterMenuState } from './TableFilterSort';
import { returnToOriginView, peekNavigationOrigin } from '../utils/navigation';
import { exportToCsv, printTableReport } from '../utils/exportPrintUtils';
import DefinitionsExcelImportModal from './DefinitionsExcelImportModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface CompaniesViewProps {
  companies: Company[];
  onAddCompany: (company: Omit<Company, 'id' | 'createdAt'>) => Promise<void>;
  onEditCompany: (id: number, company: Partial<Company>) => Promise<void>;
  onDeleteCompany: (id: number) => Promise<void>;
  onBulkImportSuccess?: (summary: any, data: any) => void;
}

export default function CompaniesView({
  companies,
  onAddCompany,
  onEditCompany,
  onDeleteCompany,
  onBulkImportSuccess
}: CompaniesViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);
  const [deleteConfirmCompany, setDeleteConfirmCompany] = useState<Company | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // فیلترهای سبک اکسل ستون‌ها
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [filterMenu, setFilterMenu] = useState<FilterMenuState | null>(null);

  const getCompanyColValue = (c: Company, colKey: string): string => {
    if (colKey === 'name') return c.name || 'ثبت نشده';
    if (colKey === 'address') return c.address || 'ثبت نشده';
    if (colKey === 'status') return c.status === 'active' ? 'فعال' : 'غیرفعال';
    return String((c as any)[colKey] ?? 'ثبت نشده');
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
    companies.forEach(c => {
      const val = getCompanyColValue(c, filterMenu.colKey);
      valMap.set(val, (valMap.get(val) || 0) + 1);
    });
    return Array.from(valMap.entries()).map(([value, count]) => ({ value, count }));
  }, [filterMenu, companies]);

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
  }, [searchTerm, statusFilter, columnFilters]);

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
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [isNavigatedFromOrigin, setIsNavigatedFromOrigin] = useState(false);

  const handleOpenCreateForm = () => {
    setEditingCompanyId(null);
    setName('');
    setAddress('');
    setStatus('active');
    setIsFormOpen(true);
  };

  useEffect(() => {
    const handleOpenEvent = (e: any) => {
      if (e.detail?.entityType === 'company') {
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

  const handleOpenEditForm = (c: Company) => {
    setIsNavigatedFromOrigin(false);
    setEditingCompanyId(c.id);
    setName(c.name);
    setAddress(c.address || '');
    setStatus(c.status);
    setIsFormOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmCompany) return;
    setIsDeleting(true);
    try {
      await onDeleteCompany(deleteConfirmCompany.id);
      setDeleteConfirmCompany(null);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'خطا در حذف شرکت');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('لطفاً نام شرکت را وارد کنید.');
      return;
    }

    const existingCompany = editingCompanyId ? companies.find(c => c.id === editingCompanyId) : null;
    const generatedCode = existingCompany ? existingCompany.code : `COMP-${Math.floor(100 + Math.random() * 900)}`;

    const payload = {
      name: name.trim(),
      code: generatedCode,
      managerName: existingCompany?.managerName || '-',
      phone: existingCompany?.phone || '-',
      address: address.trim(),
      status
    };

    try {
      if (editingCompanyId) {
        await onEditCompany(editingCompanyId, payload);
      } else {
        await onAddCompany(payload);
      }
      handleCloseOrReturn();
    } catch (err) {
      console.error(err);
      alert('خطا در ذخیره اطلاعات شرکت');
    }
  };

  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch = !q ||
        (c.name || '').toLowerCase().includes(q) ||
        (c.code || '').toLowerCase().includes(q) ||
        (c.managerName || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(searchTerm.trim()) ||
        (c.address || '').toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;

      if (!matchesSearch || !matchesStatus) return false;

      for (const [key, selectedVals] of Object.entries(columnFilters)) {
        if (!selectedVals || !Array.isArray(selectedVals)) continue;
        const val = getCompanyColValue(c, key);
        if (!selectedVals.includes(val)) return false;
      }

      return true;
    });
  }, [companies, searchTerm, statusFilter, columnFilters]);

  const sortedCompanies = useMemo(() => {
    return sortData(filteredCompanies, sortKey, sortDirection);
  }, [filteredCompanies, sortKey, sortDirection]);

  const totalPages = Math.ceil(sortedCompanies.length / pageSize) || 1;
  const paginatedCompanies = useMemo(() => {
    return sortedCompanies.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [sortedCompanies, currentPage, pageSize]);

  // خروجی اکسل شرکت‌ها
  const handleExportExcel = () => {
    const headers = [
      'ردیف',
      'کد شرکت',
      'نام شرکت',
      'مدیر عامل / مسئول',
      'شماره تماس',
      'آدرس',
      'وضعیت'
    ];

    const rows = sortedCompanies.map((c, idx) => [
      idx + 1,
      c.code,
      c.name,
      c.managerName,
      c.phone,
      c.address,
      c.status === 'active' ? 'فعال' : 'غیرفعال'
    ]);

    exportToCsv('لیست_شرکت_های_طرف_قرارداد', headers, rows);
  };

  // چاپ گزارش رسمی شرکت‌ها
  const handlePrint = () => {
    const headers = [
      'ردیف',
      'کد شرکت',
      'نام شرکت',
      'مدیر عامل',
      'تلفن تماس',
      'نشانی / آدرس',
      'وضعیت'
    ];

    const rows = sortedCompanies.map((c, idx) => [
      toPersianDigits(idx + 1),
      c.code,
      c.name,
      c.managerName,
      toPersianDigits(c.phone),
      c.address,
      c.status === 'active' ? 'فعال' : 'غیرفعال'
    ]);

    const activeCount = sortedCompanies.filter(c => c.status === 'active').length;
    const inactiveCount = sortedCompanies.filter(c => c.status === 'inactive').length;

    printTableReport({
      title: 'گزارش رسمی مشخصات شرکت‌های طرف قرارداد و همکار',
      subtitle: 'مدیریت ناوگان خودرویی یاس - تعاریف پایه شرکت‌ها',
      filterInfo: [
        { label: 'تعداد کل شرکت‌ها', value: `${toPersianDigits(sortedCompanies.length)} شرکت` },
        { label: 'فیلتر وضعیت', value: statusFilter === 'all' ? 'همه وضعیت‌ها' : statusFilter === 'active' ? 'فعال' : 'غیرفعال' },
        ...(searchTerm ? [{ label: 'عبارت جستجوشده', value: searchTerm }] : [])
      ],
      headers,
      rows,
      columnAligns: ['center', 'center', 'right', 'right', 'center', 'right', 'center'],
      summaryItems: [
        { label: 'تعداد شرکت‌های فعال', value: `${toPersianDigits(activeCount)} شرکت` },
        { label: 'تعداد شرکت‌های غیرفعال', value: `${toPersianDigits(inactiveCount)} شرکت` },
        { label: 'کل شرکت‌های ثبت‌شده', value: `${toPersianDigits(sortedCompanies.length)} شرکت`, isHighlight: true }
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
                <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>{editingCompanyId ? 'ویرایش اطلاعات شرکت' : 'ثبت شرکت جدید'}</span>
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">ثبت، ویرایش و مدیریت شرکت‌ها و سازمان‌های همکار در سیستم</p>
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
                <label className="font-bold text-slate-700 dark:text-slate-300 block">نام شرکت / سازمان <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: شرکت نفت پاسارگاد"
                  className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">وضعیت شرکت</label>
                <CustomSelect
                  value={status}
                  onChange={(val) => setStatus(val as 'active' | 'inactive')}
                  options={[
                    { value: 'active', label: 'فعال' },
                    { value: 'inactive', label: 'غیرفعال' }
                  ]}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">آدرس کامل</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="مثال: تهران، خیابان فاطمی، پلاک ۱۱۰"
                rows={3}
                className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-[#2d2d30]">
              {editingCompanyId ? (
                <button
                  type="button"
                  onClick={() => {
                    const currentC = companies.find(comp => comp.id === editingCompanyId);
                    if (currentC) {
                      setIsFormOpen(false);
                      setDeleteConfirmCompany(currentC);
                    }
                  }}
                  className="px-3 py-2 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-bold rounded-md transition-colors border border-rose-200 dark:border-rose-900/50 text-xs cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف این شرکت</span>
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
                  {editingCompanyId ? 'ذخیره تغییرات' : ((isNavigatedFromOrigin || peekNavigationOrigin()) ? 'ثبت شرکت و بازگشت' : 'ثبت شرکت')}
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
      
      {/* هدر بخش شرکت‌ها */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-[#111113] p-4 rounded-lg border border-slate-200 dark:border-[#2d2d30]">
        <div>
          <h1 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            تعریف و مدیریت شرکت‌ها
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            ثبت، ویرایش و مدیریت شرکت‌ها و سازمان‌های همکار در سیستم
          </p>
        </div>
        <button
          onClick={handleOpenCreateForm}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          ثبت شرکت جدید
        </button>
      </div>

      {/* ابزار جستجو، فیلتر، خروجی اکسل و چاپ */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="جستجو بر اساس نام شرکت، کد شرکت، مدیر عامل یا شماره تماس..."
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
          title="بارگذاری فایل اکسل و ورود اطلاعات شرکت‌ها"
        >
          <Upload className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>

        {/* دکمه خروجی اکسل */}
        <button
          type="button"
          onClick={handleExportExcel}
          className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-2xs shrink-0 group self-center"
          title="دریافت خروجی اکسل لیست شرکت‌ها"
        >
          <FileSpreadsheet className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>

        {/* دکمه چاپ */}
        <button
          type="button"
          onClick={handlePrint}
          className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-indigo-500 text-indigo-600 dark:text-indigo-400 transition-all cursor-pointer shadow-2xs shrink-0 group self-center"
          title="چاپ گزارش رسمی مشخصات شرکت‌ها (نسخه چاپی / PDF)"
        >
          <Printer className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>
      </div>

      {/* جدول نمایش شرکت‌ها (مینیمال و فشرده بدون خطوط عمودی) */}
      <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex justify-between items-center">
          <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
            <List className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>لیست شرکت‌ها و سازمان‌های همکار</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              {toPersianDigits(sortedCompanies.length)} شرکت
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] text-slate-600 dark:text-slate-400 font-medium text-xs">
                <th className="py-2 px-3 text-center w-12 text-xs font-medium">ردیف</th>
                <TableColumnHeader
                  title="نام شرکت"
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
                  title="وضعیت"
                  colKey="status"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['status']}
                  onOpenFilter={handleOpenFilterMenu}
                  className="w-24 text-center"
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
              {paginatedCompanies.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-500 text-[11px]">
                    هیچ شرکتی با شرایط مورد نظر یافت نشد.
                  </td>
                </tr>
              ) : (
                paginatedCompanies.map((c, index) => (
                  <tr 
                    key={c.id} 
                    onClick={() => handleOpenEditForm(c)}
                    title="برای ویرایش اطلاعات شرکت کلیک کنید"
                    className="group relative hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/60 transition-colors cursor-pointer text-[11px]"
                  >
                    <td className="py-1.5 px-3 text-center text-slate-500 text-[11px]">
                      {toPersianDigits((currentPage - 1) * pageSize + index + 1)}
                    </td>
                    <td className="py-1.5 px-3">
                      <span className="text-slate-900 dark:text-white text-[11px]">{c.name}</span>
                    </td>
                    <td className="py-1.5 px-3 max-w-md truncate text-slate-500 dark:text-slate-400 text-[11px]" title={c.address}>
                      <span className="truncate">{c.address || 'ثبت نشده'}</span>
                    </td>
                    <td className="py-1.5 px-3 text-center relative">
                      {c.status === 'active' ? (
                        <span className="inline-block text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
                          فعال
                        </span>
                      ) : (
                        <span className="inline-block text-[11px] text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded border border-rose-500/20">
                          غیرفعال
                        </span>
                      )}

                      {/* دکمه‌های عملیات شناور - فقط هنگام بردن موس روی ردیف */}
                      <div className="absolute inset-y-0 left-0 pl-2.5 pr-14 flex items-center gap-1 bg-gradient-to-r from-slate-50 via-slate-50 via-70% to-transparent dark:from-[#1a1a1c] dark:via-[#1a1a1c] dark:via-70% dark:to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 z-20 pointer-events-none group-hover:pointer-events-auto">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmCompany(c);
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
          totalItems={filteredCompanies.length}
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

      {/* پنجره پاپ‌آپ ورود شرکت‌ها از اکسل */}
      <DefinitionsExcelImportModal
        isOpen={isImportModalOpen}
        initialType="companies"
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={onBulkImportSuccess}
      />

      {/* مدال تایید حذف شرکت */}
      <DeleteConfirmModal
        isOpen={deleteConfirmCompany !== null}
        title="حذف شرکت"
        subtitle={deleteConfirmCompany ? deleteConfirmCompany.name : ''}
        message={deleteConfirmCompany ? `آیا از حذف شرکت «${deleteConfirmCompany.name}» (کد: ${deleteConfirmCompany.code}) اطمینان دارید؟` : ''}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          if (!isDeleting) setDeleteConfirmCompany(null);
        }}
      />
    </div>
  );
}
