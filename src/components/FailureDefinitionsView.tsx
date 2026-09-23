/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Search, AlertOctagon, Edit2, Trash2, X, AlertTriangle, List,
  FileSpreadsheet, Printer, FolderPlus, Tag, Check, ChevronDown, Layers, Upload
} from 'lucide-react';
import { FailureDefinition, FailureCategory } from '../types';
import { toPersianDigits } from '../utils/numberUtils';
import { sortData, SortDirection } from '../utils/sortUtils';
import { Pagination } from './Pagination';
import { CustomSelect } from './CustomSelect';
import { TableColumnHeader, ColumnFilterMenu, FilterMenuState } from './TableFilterSort';
import { exportToCsv, printTableReport } from '../utils/exportPrintUtils';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import DefinitionsExcelImportModal from './DefinitionsExcelImportModal';
import { returnToOriginView, peekNavigationOrigin } from '../utils/navigation';

interface FailureDefinitionsViewProps {
  failureDefinitions: FailureDefinition[];
  failureCategories: FailureCategory[];
  onAddDefinition: (definition: Omit<FailureDefinition, 'id' | 'createdAt'>) => Promise<void>;
  onEditDefinition: (id: number, definition: Partial<FailureDefinition>) => Promise<void>;
  onDeleteDefinition: (id: number) => Promise<void>;
  onAddCategory: (category: { name: string; description?: string }) => Promise<void>;
  onDeleteCategory: (id: number) => Promise<void>;
  onBulkImportSuccess?: (summary: any, data: any) => void;
}

export default function FailureDefinitionsView({
  failureDefinitions = [],
  failureCategories = [],
  onAddDefinition,
  onEditDefinition,
  onDeleteDefinition,
  onAddCategory,
  onDeleteCategory,
  onBulkImportSuccess
}: FailureDefinitionsViewProps) {
  const [activeTab, setActiveTab] = useState<'definitions' | 'categories'>('definitions');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string>('failureType');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // حذف مورد
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<FailureDefinition | null>(null);
  const [deleteCategoryItem, setDeleteCategoryItem] = useState<FailureCategory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // مدیریت بازگشت سریع به نمای مبدا و ایمپورت اکسل
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isNavigatedFromOrigin, setIsNavigatedFromOrigin] = useState(false);

  // فیلترهای ستونی
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [filterMenu, setFilterMenu] = useState<FilterMenuState | null>(null);

  // صفحه فرم ثبت / ویرایش تعریف خرابی (هماهنگ با فرم‌های سیستم)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDefId, setEditingDefId] = useState<number | null>(null);
  const [failureType, setFailureType] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmittingDef, setIsSubmittingDef] = useState(false);

  // مودال افزودن دسته خرابی جدید
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [isSubmittingCat, setIsSubmittingCat] = useState(false);

  // باز کردن فرم هنگام فراخوانی سریع از فرم‌های دیگر سیستم
  useEffect(() => {
    const handleOpenEvent = (e: any) => {
      if (e.detail?.entityType === 'failure') {
        setIsNavigatedFromOrigin(Boolean(e.detail?.fromView || peekNavigationOrigin()));
        setEditingDefId(null);
        setFailureType('');
        setCategory(failureCategories[0]?.name || 'مکانیکی');
        setDescription('');
        setIsFormOpen(true);
      }
    };
    window.addEventListener('app:open-create-form', handleOpenEvent);
    return () => window.removeEventListener('app:open-create-form', handleOpenEvent);
  }, [failureCategories]);

  const handleCloseOrReturn = () => {
    setIsFormOpen(false);
    if (isNavigatedFromOrigin || peekNavigationOrigin()) {
      setIsNavigatedFromOrigin(false);
      returnToOriginView();
    }
  };

  // تضمین مقدار پیش‌فرض دسته هنگام باز شدن مدال
  useEffect(() => {
    if (failureCategories.length > 0 && !category) {
      setCategory(failureCategories[0].name);
    }
  }, [failureCategories, category]);

  const getDefColValue = (def: FailureDefinition, colKey: string): string => {
    if (colKey === 'failureType') return def.failureType || 'ثبت نشده';
    if (colKey === 'category') return def.category || 'عمومی';
    if (colKey === 'description') return def.description || 'ندارد';
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
    failureDefinitions.forEach(def => {
      const val = getDefColValue(def, filterMenu.colKey);
      valMap.set(val, (valMap.get(val) || 0) + 1);
    });
    return Array.from(valMap.entries()).map(([value, count]) => ({ value, count }));
  }, [filterMenu, failureDefinitions]);

  const currentSelectedValues = useMemo(() => {
    if (!filterMenu) return [];
    if (columnFilters[filterMenu.colKey]) {
      return columnFilters[filterMenu.colKey];
    }
    return currentMenuUniqueValues.map(item => item.value);
  }, [filterMenu, columnFilters, currentMenuUniqueValues]);

  const handleToggleColumnValue = (val: string) => {
    if (!filterMenu) return;
    const current = columnFilters[filterMenu.colKey] || currentMenuUniqueValues.map(item => item.value);
    const next = current.includes(val) ? current.filter(x => x !== val) : [...current, val];
    setColumnFilters({ ...columnFilters, [filterMenu.colKey]: next });
  };

  const handleSort = (colKey: string) => {
    if (sortKey === colKey) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') {
        setSortKey('failureType');
        setSortDirection('asc');
      }
    } else {
      setSortKey(colKey);
      setSortDirection('asc');
    }
  };

  // محاسبه تعداد خرابی‌های هر دسته
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    failureDefinitions.forEach(d => {
      const cat = d.category || 'عمومی';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [failureDefinitions]);

  // فیلتر کردن تعاریف خرابی
  const filteredDefinitions = useMemo(() => {
    return failureDefinitions.filter(def => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchTitle = def.failureType?.toLowerCase().includes(term);
        const matchCat = def.category?.toLowerCase().includes(term);
        const matchDesc = def.description?.toLowerCase().includes(term);
        if (!matchTitle && !matchCat && !matchDesc) return false;
      }

      for (const [col, rawValues] of Object.entries(columnFilters)) {
        const values = rawValues as string[] | undefined;
        if (!values || values.length === 0) continue;
        const val = getDefColValue(def, col);
        if (!values.includes(val)) return false;
      }

      return true;
    });
  }, [failureDefinitions, searchTerm, columnFilters]);

  // دسته‌های فیلتر شده بر اساس جستجو
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return failureCategories;
    const term = searchTerm.trim().toLowerCase();
    return failureCategories.filter(c => 
      c.name.toLowerCase().includes(term) || (c.description && c.description.toLowerCase().includes(term))
    );
  }, [failureCategories, searchTerm]);

  // مرتب‌سازی
  const sortedDefinitions = useMemo(() => {
    return sortData(filteredDefinitions, sortKey, sortDirection);
  }, [filteredDefinitions, sortKey, sortDirection]);

  // صفحه‌بندی
  const totalPages = Math.max(1, Math.ceil(sortedDefinitions.length / pageSize));
  const paginatedDefinitions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedDefinitions.slice(start, start + pageSize);
  }, [sortedDefinitions, currentPage, pageSize]);

  // باز کردن فرم ایجاد
  const handleOpenCreateForm = () => {
    setEditingDefId(null);
    setFailureType('');
    setCategory(failureCategories[0]?.name || 'مکانیکی');
    setDescription('');
    setIsFormOpen(true);
  };

  // باز کردن فرم ویرایش
  const handleOpenEditForm = (def: FailureDefinition) => {
    setEditingDefId(def.id);
    setFailureType(def.failureType);
    setCategory(def.category);
    setDescription(def.description || '');
    setIsFormOpen(true);
  };

  // ذخیره فرم تعریف خرابی
  const handleSaveDefinition = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedType = failureType.trim();
    if (!trimmedType) {
      alert('لطفاً نوع خرابی را وارد کنید.');
      return;
    }
    const chosenCat = category.trim() || failureCategories[0]?.name || 'عمومی';

    setIsSubmittingDef(true);
    try {
      if (editingDefId) {
        await onEditDefinition(editingDefId, {
          failureType: trimmedType,
          category: chosenCat,
          description: description.trim()
        });
      } else {
        await onAddDefinition({
          failureType: trimmedType,
          category: chosenCat,
          description: description.trim()
        });
      }
      handleCloseOrReturn();
    } catch (err: any) {
      alert(err.message || 'خطا در ثبت تعریف خرابی');
    } finally {
      setIsSubmittingDef(false);
    }
  };

  // حذف قطعی تعریف خرابی
  const handleConfirmDeleteDefinition = async () => {
    if (!deleteConfirmItem) return;
    setIsDeleting(true);
    try {
      await onDeleteDefinition(deleteConfirmItem.id);
      setDeleteConfirmItem(null);
    } catch (err: any) {
      alert(err.message || 'خطا در حذف تعریف خرابی');
    } finally {
      setIsDeleting(false);
    }
  };

  // افزودن دسته خرابی جدید
  const handleSaveNewCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      alert('لطفاً عنوان دسته خرابی را وارد کنید.');
      return;
    }
    if (failureCategories.some(c => c.name.trim().toLowerCase() === trimmedName.toLowerCase())) {
      alert('این دسته خرابی قبلاً ثبت شده است.');
      return;
    }

    setIsSubmittingCat(true);
    try {
      await onAddCategory({
        name: trimmedName,
        description: newCategoryDesc.trim()
      });
      setCategory(trimmedName);
      setNewCategoryName('');
      setNewCategoryDesc('');
      setIsAddCategoryModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'خطا در افزودن دسته خرابی');
    } finally {
      setIsSubmittingCat(false);
    }
  };

  // حذف دسته خرابی
  const handleConfirmDeleteCategory = async () => {
    if (!deleteCategoryItem) return;
    setIsDeleting(true);
    try {
      await onDeleteCategory(deleteCategoryItem.id);
      setDeleteCategoryItem(null);
    } catch (err: any) {
      alert(err.message || 'خطا در حذف دسته خرابی');
    } finally {
      setIsDeleting(false);
    }
  };

  // خروجی اکسل
  const handleExportExcel = () => {
    if (activeTab === 'definitions') {
      const headers = ['ردیف', 'نوع خرابی', 'دسته خرابی', 'توضیحات', 'تاریخ ثبت'];
      const rows = sortedDefinitions.map((d, index) => [
        toPersianDigits(index + 1),
        d.failureType,
        d.category,
        d.description || '-',
        d.createdAt ? new Date(d.createdAt).toLocaleDateString('fa-IR') : '-'
      ]);
      exportToCsv('تعاریف_انواع_خرابی', headers, rows);
    } else {
      const headers = ['ردیف', 'عنوان دسته خرابی', 'تعداد خرابی‌های مرتبط', 'توضیحات دسته'];
      const rows = failureCategories.map((c, index) => [
        toPersianDigits(index + 1),
        c.name,
        toPersianDigits(categoryCounts[c.name] || 0),
        c.description || '-'
      ]);
      exportToCsv('دسته‌بندی‌های_خرابی', headers, rows);
    }
  };

  // چاپ گزارش
  const handlePrint = () => {
    if (activeTab === 'definitions') {
      const headers = ['ردیف', 'نوع خرابی (عنوان عیب)', 'دسته خرابی', 'توضیحات و عیب‌یابی'];
      const rows = sortedDefinitions.map((d, index) => [
        toPersianDigits(index + 1),
        d.failureType,
        d.category,
        d.description || '-'
      ]);

      printTableReport({
        title: 'گزارش رسمی استاندارد و تعاریف انواع خرابی ناوگان',
        subtitle: 'مدیریت ناوگان خودرویی یاس - بانک اطلاعات انواع عیوب فنی',
        filterInfo: [
          { label: 'تعداد کل انواع خرابی', value: `${toPersianDigits(sortedDefinitions.length)} مورد` },
          ...(searchTerm ? [{ label: 'عبارت جستجوشده', value: searchTerm }] : [])
        ],
        headers,
        rows,
        columnAligns: ['center', 'right', 'center', 'right'],
        summaryItems: [
          { label: 'مجموع انواع خرابی تعریف‌شده', value: `${toPersianDigits(sortedDefinitions.length)} ردیف`, isHighlight: true }
        ]
      });
    } else {
      const headers = ['ردیف', 'عنوان دسته خرابی', 'تعداد خرابی‌های مرتبط', 'توضیحات دسته'];
      const rows = failureCategories.map((c, index) => [
        toPersianDigits(index + 1),
        c.name,
        `${toPersianDigits(categoryCounts[c.name] || 0)} مورد`,
        c.description || '-'
      ]);

      printTableReport({
        title: 'گزارش رسمی دسته‌بندی‌های خرابی و سیستم‌های فنی',
        subtitle: 'مدیریت ناوگان خودرویی یاس - دسته‌بندی عیوب',
        filterInfo: [
          { label: 'تعداد کل دسته‌بندی‌ها', value: `${toPersianDigits(failureCategories.length)} دسته` },
          ...(searchTerm ? [{ label: 'عبارت جستجوشده', value: searchTerm }] : [])
        ],
        headers,
        rows,
        columnAligns: ['center', 'right', 'center', 'right'],
        summaryItems: [
          { label: 'مجموع دسته‌های ثبت‌شده', value: `${toPersianDigits(failureCategories.length)} دسته`, isHighlight: true }
        ]
      });
    }
  };

  // اگر فرم افزودن دسته باز است، نمایش ساختار یکپارچه فرم تمام‌صفحه دقیقاً مثل فرم افزودن نوع خرابی
  if (isAddCategoryModalOpen) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="bg-white dark:bg-[#111113] rounded-lg w-full border border-slate-200 dark:border-[#2d2d30] flex flex-col overflow-hidden space-y-0">
          
          {/* هدر صفحه فرم دسته خرابی */}
          <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
            <div>
              <h3 className="text-slate-900 dark:text-white text-base font-bold flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>تعریف دسته خرابی جدید</span>
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                تعریف عنوان و حوزه فنی جدید جهت گروه‌بندی، فیلتر و گزارش‌گیری انواع عیوب فنی خودرو
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsAddCategoryModalOpen(false);
                setNewCategoryName('');
                setNewCategoryDesc('');
              }}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors border border-transparent hover:border-slate-300 dark:hover:border-[#2d2d30] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* فرم اصلی دسته خرابی */}
          <form onSubmit={handleSaveNewCategory} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs bg-white dark:bg-[#111113]">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">
                عنوان دسته خرابی <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                placeholder="مانند: برقی و الکترونیک، گیربکس، سیستم تعلیق، سیستم خنک‌کننده، ترمز..."
                className="w-full bg-white dark:bg-[#1a1a1c] border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">
                توضیحات و دامنه فعالیت دسته (اختیاری)
              </label>
              <textarea
                rows={3}
                value={newCategoryDesc}
                onChange={e => setNewCategoryDesc(e.target.value)}
                placeholder="توضیح کوتاه درباره این حوزه فنی یا خدمات مرتبط..."
                className="w-full bg-white dark:bg-[#1a1a1c] border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-[#2d2d30]">
              <button
                type="button"
                onClick={() => {
                  setIsAddCategoryModalOpen(false);
                  setNewCategoryName('');
                  setNewCategoryDesc('');
                }}
                className="px-3 py-2 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-400 font-bold rounded-md transition-colors border border-slate-200 dark:border-[#2d2d30] text-xs cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={isSubmittingCat}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md transition-colors active:scale-95 text-xs cursor-pointer disabled:opacity-50"
              >
                {isSubmittingCat ? 'در حال ثبت...' : 'ثبت دسته'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // اگر صفحه فرم باز است، نمایش ساختار یکپارچه فرم تمام‌صفحه دقیقاً مانند ServiceDefinitionsView و CompaniesView
  if (isFormOpen) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="bg-white dark:bg-[#111113] rounded-lg w-full border border-slate-200 dark:border-[#2d2d30] flex flex-col overflow-hidden space-y-0">
          
          {/* هدر صفحه فرم */}
          <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
            <div>
              <h3 className="text-slate-900 dark:text-white text-base font-bold flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-amber-500" />
                <span>{editingDefId ? 'ویرایش تعریف خرابی' : 'تعریف نوع خرابی جدید'}</span>
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                ثبت عنوان نقص فنی، انتخاب یا افزودن دسته‌بندی مرتبط و ثبت نکات عیب‌یابی اولیه
              </p>
            </div>
            <button
              type="button"
              onClick={handleCloseOrReturn}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors border border-transparent hover:border-slate-300 dark:hover:border-[#2d2d30] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* فرم اصلی */}
          <form onSubmit={handleSaveDefinition} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs bg-white dark:bg-[#111113]">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">
                نوع خرابی (عنوان نقص فنی) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={failureType}
                onChange={(e) => setFailureType(e.target.value)}
                placeholder="مانند روغن‌ریزی گیربکس، سوختن واشر سرسیلندر، لرزش فرمان، خرابی دینام..."
                className="w-full bg-white dark:bg-[#1a1a1c] border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">
                دسته خرابی <span className="text-rose-500">*</span>
              </label>
              <CustomSelect
                value={category}
                onChange={(val) => setCategory(String(val))}
                placeholder="انتخاب دسته خرابی..."
                searchable={true}
                matchTriggerWidth={true}
                options={failureCategories.map((c) => ({
                  value: c.name,
                  label: c.name
                }))}
                onAddNew={() => setIsAddCategoryModalOpen(true)}
                addNewLabel="افزودن دسته خرابی جدید..."
              />
              <span className="text-[10px] text-slate-500 block">انتخاب رسته فنی جهت دسته‌بندی و گزارش‌گیری</span>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">
                توضیحات و علائم عیب‌یابی (اختیاری)
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="علائم خرابی، نحوه تشخیص اولیه یا نکات تعمیراتی برای تعمیرگاه..."
                className="w-full bg-white dark:bg-[#1a1a1c] border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold resize-none"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-[#2d2d30]">
              {editingDefId ? (
                <button
                  type="button"
                  onClick={() => {
                    const currentItem = failureDefinitions.find(d => d.id === editingDefId);
                    if (currentItem) {
                      setIsFormOpen(false);
                      setDeleteConfirmItem(currentItem);
                    }
                  }}
                  className="px-3 py-2 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-bold rounded-md transition-colors border border-rose-200 dark:border-rose-900/50 text-xs cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف این خرابی</span>
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
                  disabled={isSubmittingDef}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md transition-colors active:scale-95 text-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingDef ? 'در حال ذخیره...' : (editingDefId ? 'ذخیره تغییرات' : ((isNavigatedFromOrigin || peekNavigationOrigin()) ? 'ثبت خرابی و بازگشت' : 'ذخیره تعریف خرابی'))}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // نمای اصلی جدول و فهرست تعاریف خرابی
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      
      {/* هدر اصلی مطابق هدرهای رسمی سیستم */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-[#111113] p-4 rounded-lg border border-slate-200 dark:border-[#2d2d30]">
        <div>
          <h1 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-amber-500" />
            تعریف انواع خرابی و دسته‌بندی عیوب فنی
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            تعریف انواع خرابی‌ها و عیوب فنی با قابلیت دسته‌بندی و مدیریت پویا جهت ثبت در پذیرش و تعمیرگاه
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {activeTab === 'definitions' ? (
            <button
              type="button"
              onClick={handleOpenCreateForm}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>افزودن نوع خرابی جدید</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddCategoryModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>افزودن دسته خرابی جدید</span>
            </button>
          )}
        </div>
      </div>

      {/* تب‌های بالای جدول هماهنگ با پذیرش خودرو */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-[#2d2d30] pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('definitions')}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'definitions'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <List className="w-4 h-4" />
          <span>لیست انواع خرابی</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 font-mono font-bold">
            {toPersianDigits(failureDefinitions.length)}
          </span>
          {activeTab === 'definitions' && (
            <motion.div
              layoutId="activeFailureDefTabIndicator"
              className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'categories'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>مدیریت دسته‌های خرابی</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 font-mono font-bold">
            {toPersianDigits(failureCategories.length)}
          </span>
          {activeTab === 'categories' && (
            <motion.div
              layoutId="activeFailureDefTabIndicator"
              className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>
      </div>

      {/* ابزار جستجو، خروجی اکسل و چاپ (دقیقاً با ابعاد و استایل مشترک سیستم) */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder={activeTab === 'definitions' ? "جستجوی نوع خرابی، دسته یا توضیحات..." : "جستجوی نام یا توضیحات دسته خرابی..."}
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

        {Object.keys(columnFilters).length > 0 && activeTab === 'definitions' && (
          <button
            type="button"
            onClick={() => setColumnFilters({})}
            className="h-[34px] px-2.5 rounded-lg text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 border border-rose-200 dark:border-rose-900/40 cursor-pointer flex items-center gap-1 self-center"
          >
            <X className="w-3.5 h-3.5" />
            <span>پاکسازی فیلترها</span>
          </button>
        )}

        {/* دکمه ورود از اکسل */}
        <button
          type="button"
          onClick={() => setIsImportModalOpen(true)}
          className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-2xs shrink-0 group self-center"
          title="بارگذاری فایل اکسل و ورود تعاریف خرابی"
        >
          <Upload className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>

        {/* دکمه خروجی اکسل */}
        <button
          type="button"
          onClick={handleExportExcel}
          className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-2xs shrink-0 group self-center"
          title="دریافت خروجی اکسل"
        >
          <FileSpreadsheet className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>

        {/* دکمه چاپ */}
        <button
          type="button"
          onClick={handlePrint}
          className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-indigo-500 text-indigo-600 dark:text-indigo-400 transition-all cursor-pointer shadow-2xs shrink-0 group self-center"
          title="چاپ گزارش رسمی (نسخه چاپی / PDF)"
        >
          <Printer className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>
      </div>

      {/* محتوای تب با ترنزیشن نرم و آرام دقیقاً مشابه پذیرش خودرو */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: "easeInOut" }}
          className="space-y-3"
        >
          {activeTab === 'definitions' ? (
            /* جدول اصلی تعاریف خرابی با استایل دقیق بخش پذیرش خودرو */
            <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex justify-between items-center">
                <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
                  <List className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>عناوین و انواع نقص فنی ثبت‌شده</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    {toPersianDigits(sortedDefinitions.length)} مورد
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] text-slate-600 dark:text-slate-400 font-medium text-xs">
                      <th className="py-2 px-3 text-center w-12 text-xs font-medium">ردیف</th>

                      <TableColumnHeader
                        title="نوع خرابی (عنوان نقص فنی)"
                        colKey="failureType"
                        sortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        isFiltered={!!columnFilters['failureType']}
                        onOpenFilter={(e) => handleOpenFilterMenu(e, 'failureType', 'نوع خرابی')}
                        width="260px"
                      />

                      <TableColumnHeader
                        title="دسته خرابی"
                        colKey="category"
                        sortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        isFiltered={!!columnFilters['category']}
                        onOpenFilter={(e) => handleOpenFilterMenu(e, 'category', 'دسته خرابی')}
                        width="180px"
                      />

                      <th className="py-2 px-3 text-right">توضیحات و عیب‌یابی</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                    {paginatedDefinitions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-slate-500 text-[11px]">
                          هیچ تعریف خرابی منطبق با فیلتر یافت نشد.
                        </td>
                      </tr>
                    ) : (
                      paginatedDefinitions.map((def, index) => (
                        <tr
                          key={def.id}
                          onClick={() => handleOpenEditForm(def)}
                          title="برای مشاهده و ویرایش این تعریف خرابی کلیک کنید"
                          className="group relative h-9 hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/60 transition-colors cursor-pointer text-[11px]"
                        >
                          <td className="py-1 px-3 text-center text-slate-500 text-[11px] align-middle font-mono">
                            {toPersianDigits((currentPage - 1) * pageSize + index + 1)}
                          </td>

                          <td className="py-1 px-3 whitespace-nowrap align-middle">
                            <span className="text-slate-900 dark:text-white text-[11px] font-bold">
                              {def.failureType}
                            </span>
                          </td>

                          <td className="py-1 px-3 whitespace-nowrap align-middle">
                            <span className="h-[20px] px-2 inline-flex items-center justify-center rounded text-[10px] bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20 whitespace-nowrap shrink-0 font-bold">
                              {def.category || 'عمومی'}
                            </span>
                          </td>

                          <td className="py-1 px-3 align-middle relative">
                            <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-md block">
                              {def.description || '—'}
                            </span>

                            {/* دکمه عملیات شناور (فقط حذف؛ ویرایش با کلیک روی سطر انجام می‌شود) */}
                            <div className="absolute inset-y-0 left-0 pl-2.5 pr-14 flex items-center gap-1 bg-gradient-to-r from-slate-50 via-slate-50 via-70% to-transparent dark:from-[#1a1a1c] dark:via-[#1a1a1c] dark:via-70% dark:to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 z-20 pointer-events-none group-hover:pointer-events-auto">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmItem(def);
                                }}
                                title="حذف تعریف خرابی"
                                className="w-[22px] h-[22px] flex items-center justify-center bg-slate-100 dark:bg-[#1a1a1c] hover:bg-rose-100 dark:hover:bg-rose-600/20 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded border border-slate-200 dark:border-[#2d2d30] transition-colors cursor-pointer"
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
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setCurrentPage(1);
                }}
              />
            </div>
          ) : (
            /* جدول دسته‌بندی‌های خرابی با استایل یکپارچه پذیرش خودرو */
            <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-900 dark:text-white font-extrabold text-[11px]">
                  <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>دسته‌بندی‌های فعال سیستم عیوب فنی</span>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  {toPersianDigits(failureCategories.length)} دسته
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] text-slate-600 dark:text-slate-400 font-medium text-xs">
                      <th className="py-2 px-3 text-center w-12 text-xs font-medium">ردیف</th>
                      <th className="py-2 px-3 text-right font-medium">عنوان دسته خرابی</th>
                      <th className="py-2 px-3 text-center font-medium w-40">تعداد خرابی‌های مرتبط</th>
                      <th className="py-2 px-3 text-right font-medium">توضیحات دسته</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                    {filteredCategories.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-slate-500 text-[11px]">
                          هیچ دسته خرابی یافت نشد.
                        </td>
                      </tr>
                    ) : (
                      filteredCategories.map((cat, idx) => {
                        const count = categoryCounts[cat.name] || 0;
                        return (
                          <tr
                            key={cat.id}
                            className="group relative h-9 hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/60 transition-colors text-[11px]"
                          >
                            <td className="py-1 px-3 text-center text-slate-500 font-mono align-middle text-[11px]">
                              {toPersianDigits(idx + 1)}
                            </td>
                            <td className="py-1 px-3 whitespace-nowrap align-middle">
                              <span className="text-slate-900 dark:text-white text-[11px] font-bold">
                                {cat.name}
                              </span>
                            </td>
                            <td className="py-1 px-3 text-center align-middle">
                              <span className="h-[20px] px-2 inline-flex items-center justify-center rounded text-[10px] bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20 whitespace-nowrap font-mono font-bold">
                                {toPersianDigits(count)} خرابی
                              </span>
                            </td>
                            <td className="py-1 px-3 align-middle relative">
                              <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-md block">
                                {cat.description || '—'}
                              </span>

                              {/* دکمه عملیات شناور روی ردیف */}
                              <div className="absolute inset-y-0 left-0 pl-2.5 pr-14 flex items-center gap-1 bg-gradient-to-r from-slate-50 via-slate-50 via-70% to-transparent dark:from-[#1a1a1c] dark:via-[#1a1a1c] dark:via-70% dark:to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 z-20 pointer-events-none group-hover:pointer-events-auto">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteCategoryItem(cat);
                                  }}
                                  className="w-[22px] h-[22px] flex items-center justify-center bg-slate-100 dark:bg-[#1a1a1c] hover:bg-rose-100 dark:hover:bg-rose-600/20 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded border border-slate-200 dark:border-[#2d2d30] transition-colors cursor-pointer"
                                  title="حذف این دسته"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>



      {/* مدال حذف تعریف خرابی */}
      {deleteConfirmItem && (
        <DeleteConfirmModal
          isOpen={true}
          onClose={() => setDeleteConfirmItem(null)}
          onConfirm={handleConfirmDeleteDefinition}
          title="حذف تعریف خرابی"
          message={`آیا از حذف تعریف نوع خرابی «${deleteConfirmItem.failureType}» از دسته «${deleteConfirmItem.category}» اطمینان دارید؟`}
          isLoading={isDeleting}
        />
      )}

      {/* مدال حذف دسته خرابی */}
      {deleteCategoryItem && (
        <DeleteConfirmModal
          isOpen={true}
          onClose={() => setDeleteCategoryItem(null)}
          onConfirm={handleConfirmDeleteCategory}
          title="حذف دسته خرابی"
          message={`آیا از حذف دسته خرابی «${deleteCategoryItem.name}» اطمینان دارید؟ ${
            (categoryCounts[deleteCategoryItem.name] || 0) > 0
              ? `توجه: تعداد ${toPersianDigits(categoryCounts[deleteCategoryItem.name])} تعریف خرابی زیرمجموعه این دسته هستند.`
              : ''
          }`}
          isLoading={isDeleting}
        />
      )}

      {/* منوی فیلتر ستونی شناور */}
      {filterMenu && (
        <ColumnFilterMenu
          filterMenu={filterMenu}
          uniqueValues={currentMenuUniqueValues}
          selectedValues={currentSelectedValues}
          onToggleValue={handleToggleColumnValue}
          onSelectAll={() => {
            const next = { ...columnFilters };
            delete next[filterMenu.colKey];
            setColumnFilters(next);
          }}
          onDeselectAll={() => {
            setColumnFilters({ ...columnFilters, [filterMenu.colKey]: [] });
          }}
          onSelectOnly={val => {
            setColumnFilters({ ...columnFilters, [filterMenu.colKey]: [val] });
          }}
          onClose={() => setFilterMenu(null)}
        />
      )}

      {/* مدال ایمپورت دسته‌جمعی از اکسل */}
      <DefinitionsExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        initialType="failure_definitions"
        onSuccess={onBulkImportSuccess}
      />
    </div>
  );
}
