/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Wrench, Phone, X, Store, Trash2, List, Star, MapPin, FileSpreadsheet, Printer, Upload } from 'lucide-react';
import { Mechanic, VehicleFailure, RepairWorkflow, SatisfactionLevel } from '../types';
import { toPersianDigits, normalizePhone } from '../utils/numberUtils';
import { sortData, SortDirection } from '../utils/sortUtils';
import { Pagination } from './Pagination';
import { CustomSelect } from './CustomSelect';
import { TableColumnHeader, ColumnFilterMenu, FilterMenuState } from './TableFilterSort';
import { returnToOriginView, peekNavigationOrigin } from '../utils/navigation';
import { AddMechanicSpecialtyModal } from './AddMechanicSpecialtyModal';
import { getStoredMechanicSpecialties, subscribeMechanicSpecialties } from '../utils/mechanicSpecialties';
import { exportToCsv, printTableReport } from '../utils/exportPrintUtils';
import DefinitionsExcelImportModal from './DefinitionsExcelImportModal';

interface MechanicsViewProps {
  mechanics: Mechanic[];
  failures?: VehicleFailure[];
  workflows?: RepairWorkflow[];
  onAddMechanic: (mechanic: Omit<Mechanic, 'id' | 'createdAt'>) => Promise<void>;
  onEditMechanic: (id: number, mechanic: Partial<Mechanic>) => Promise<void>;
  onDeleteMechanic: (id: number) => Promise<void>;
  onBulkImportSuccess?: (summary: any, data: any) => void;
}

// محاسبه سطح رضایت و میانگین نمره عملکرد تعمیرکار از بخش تعمیرات
export function getMechanicPerformance(
  mechanic: Mechanic,
  failures: VehicleFailure[] = [],
  workflows: RepairWorkflow[] = []
) {
  const matchingFailures = failures.filter(
    f => f.assignedMechanicId === mechanic.id || (f.repairShopName && f.repairShopName.trim() === mechanic.shopName?.trim())
  );
  
  const matchingWorkflows = workflows.filter(
    wf => wf.technicianId === mechanic.id || (wf.repairShopName && wf.repairShopName.trim() === mechanic.shopName?.trim())
  );

  const allAssociatedFailureIds = new Set<number>();
  matchingFailures.forEach(f => allAssociatedFailureIds.add(f.id));
  matchingWorkflows.forEach(wf => allAssociatedFailureIds.add(wf.failureId));

  const satisfactionList: SatisfactionLevel[] = [];

  allAssociatedFailureIds.forEach(failId => {
    const wf = workflows.find(w => w.failureId === failId);
    const f = failures.find(fail => fail.id === failId);
    const sat = wf?.satisfactionLevel || f?.satisfactionLevel;
    if (sat) {
      satisfactionList.push(sat);
    }
  });

  const totalAssigned = allAssociatedFailureIds.size;
  const evaluatedCount = satisfactionList.length;

  if (evaluatedCount === 0) {
    return {
      totalAssigned,
      evaluatedCount: 0,
      avgScore: 0,
      label: 'بدون ارزیابی',
      color: 'slate' as const,
      tooltip: totalAssigned > 0 
        ? `${toPersianDigits(totalAssigned)} تعمیر ارجاع شده (هنوز امتیازی ثبت نشده)`
        : 'هنوز تعمیر یا ارزیابی برای این تعمیرکار ثبت نشده است'
    };
  }

  const scoreMap: Record<SatisfactionLevel, number> = {
    excellent: 5,
    good: 4,
    medium: 3,
    weak: 1.5,
  };

  const totalScore = satisfactionList.reduce((acc, curr) => acc + (scoreMap[curr] || 3), 0);
  const avgScore = Number((totalScore / evaluatedCount).toFixed(1));

  let label = 'عالی';
  let color: 'emerald' | 'indigo' | 'amber' | 'rose' = 'emerald';

  if (avgScore >= 4.5) {
    label = 'عالی';
    color = 'emerald';
  } else if (avgScore >= 3.5) {
    label = 'خوب';
    color = 'indigo';
  } else if (avgScore >= 2.3) {
    label = 'متوسط';
    color = 'amber';
  } else {
    label = 'ضعیف';
    color = 'rose';
  }

  return {
    totalAssigned,
    evaluatedCount,
    avgScore,
    label,
    color,
    tooltip: `میانگین رضایت: ${toPersianDigits(avgScore)} از ۵ (بر اساس ${toPersianDigits(evaluatedCount)} نمره ثبت‌شده در بخش تعمیرات)`
  };
}

export default function MechanicsView({
  mechanics,
  failures = [],
  workflows = [],
  onAddMechanic,
  onEditMechanic,
  onDeleteMechanic,
  onBulkImportSuccess
}: MechanicsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [sortKey, setSortKey] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMechanicId, setEditingMechanicId] = useState<number | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // فیلترهای سبک اکسل ستون‌ها
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [filterMenu, setFilterMenu] = useState<FilterMenuState | null>(null);

  const getMechanicColValue = (m: Mechanic, colKey: string): string => {
    if (colKey === 'name') return m.name || 'ثبت نشده';
    if (colKey === 'shopName') return m.shopName || 'ثبت نشده';
    if (colKey === 'specialty') return m.specialty || 'ثبت نشده';
    if (colKey === 'phone') return m.phone ? toPersianDigits(m.phone) : 'ثبت نشده';
    if (colKey === 'satisfaction') {
      const perf = getMechanicPerformance(m, failures, workflows);
      return perf.label;
    }
    return String((m as any)[colKey] ?? 'ثبت نشده');
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
    mechanics.forEach(m => {
      const val = getMechanicColValue(m, filterMenu.colKey);
      valMap.set(val, (valMap.get(val) || 0) + 1);
    });
    return Array.from(valMap.entries()).map(([value, count]) => ({ value, count }));
  }, [filterMenu, mechanics, failures, workflows]);

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
  const [specialty, setSpecialty] = useState('مکانیک موتور و گیربکس');
  const [shopName, setShopName] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  // بررسی بلادرنگ تکراری بودن شماره تماس تعمیرکار (منحصراً در بخش تعمیرکاران)
  const duplicateMechanic = useMemo(() => {
    const normCurrent = normalizePhone(phone);
    if (!normCurrent || normCurrent.length < 7) return null;
    return mechanics.find(m => {
      if (editingMechanicId && m.id === editingMechanicId) return false;
      const normM = normalizePhone(m.phone);
      return normM && normM === normCurrent;
    }) || null;
  }, [phone, mechanics, editingMechanicId]);

  const [specialtiesList, setSpecialtiesList] = useState<string[]>(() => getStoredMechanicSpecialties());
  const [isAddSpecialtyModalOpen, setIsAddSpecialtyModalOpen] = useState(false);

  useEffect(() => {
    return subscribeMechanicSpecialties((updated) => {
      setSpecialtiesList(updated);
    });
  }, []);

  const [isNavigatedFromOrigin, setIsNavigatedFromOrigin] = useState(false);

  const handleOpenCreateForm = () => {
    setEditingMechanicId(null);
    setName('');
    setPhone('');
    setSpecialty('مکانیک موتور و گیربکس');
    setShopName('');
    setStatus('active');
    setIsFormOpen(true);
  };

  useEffect(() => {
    const handleOpenEvent = (e: any) => {
      if (e.detail?.entityType === 'mechanic') {
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

  const handleOpenEditForm = (m: Mechanic) => {
    setIsNavigatedFromOrigin(false);
    setEditingMechanicId(m.id);
    setName(m.name);
    setPhone(m.phone);
    setSpecialty(m.specialty);
    setShopName(m.shopName);
    setStatus(m.status || 'active');
    setIsFormOpen(true);
  };

  const handleDelete = async (id: number, mechanicName: string) => {
    if (confirm(`آیا از حذف تعمیرکار [${mechanicName}] اطمینان دارید؟`)) {
      try {
        await onDeleteMechanic(id);
      } catch (err) {
        console.error(err);
        alert('خطا در حذف تعمیرکار');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !shopName.trim()) {
      alert('لطفاً فیلدهای الزامی (نام، شماره تماس و محل استقرار) را پر کنید.');
      return;
    }

    if (duplicateMechanic) {
      alert(`این شماره تماس قبلاً برای تعمیرکار «${duplicateMechanic.name}» در بخش تعمیرکاران ثبت شده است.`);
      return;
    }

    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      specialty,
      shopName: shopName.trim(),
      status: status || 'active'
    };

    try {
      if (editingMechanicId) {
        await onEditMechanic(editingMechanicId, payload);
      } else {
        await onAddMechanic(payload);
      }
      handleCloseOrReturn();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'خطا در ذخیره اطلاعات تعمیرکار');
    }
  };

  const filteredMechanics = useMemo(() => {
    return mechanics.filter(m => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch = !q ||
        (m.name || '').toLowerCase().includes(q) ||
        (m.specialty || '').toLowerCase().includes(q) ||
        (m.shopName || '').toLowerCase().includes(q) ||
        (m.phone || '').includes(searchTerm.trim());

      const matchesSpecialty = specialtyFilter === 'all' || m.specialty === specialtyFilter;

      if (!matchesSearch || !matchesSpecialty) return false;

      for (const [key, selectedVals] of Object.entries(columnFilters)) {
        if (!selectedVals || !Array.isArray(selectedVals)) continue;
        const val = getMechanicColValue(m, key);
        if (!selectedVals.includes(val)) return false;
      }

      return true;
    });
  }, [mechanics, searchTerm, specialtyFilter, columnFilters, failures, workflows]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, specialtyFilter, columnFilters]);

  const sortedMechanics = useMemo(() => {
    if (sortKey === 'satisfaction') {
      return [...filteredMechanics].sort((a, b) => {
        const perfA = getMechanicPerformance(a, failures, workflows);
        const perfB = getMechanicPerformance(b, failures, workflows);
        const scoreDiff = perfA.avgScore - perfB.avgScore;
        return sortDirection === 'asc' ? scoreDiff : -scoreDiff;
      });
    }
    return sortData(filteredMechanics, sortKey, sortDirection);
  }, [filteredMechanics, sortKey, sortDirection, failures, workflows]);

  const totalPages = Math.ceil(sortedMechanics.length / pageSize) || 1;
  const paginatedMechanics = useMemo(() => {
    return sortedMechanics.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [sortedMechanics, currentPage, pageSize]);

  // خروجی اکسل تعمیرکاران
  const handleExportExcel = () => {
    const headers = [
      'ردیف',
      'نام تعمیرکار / تکنسین',
      'تخصص اصلی',
      'نام تعمیرگاه / مرکز خدمات',
      'شماره تماس',
      'امتیاز رضایت'
    ];

    const rows = sortedMechanics.map((m, idx) => {
      const perf = getMechanicPerformance(m, failures, workflows);
      return [
        idx + 1,
        m.name,
        m.specialty,
        m.shopName,
        m.phone,
        perf.evaluatedCount > 0 ? `${perf.avgScore} از 5` : 'بدون ارزیابی'
      ];
    });

    exportToCsv('لیست_تعمیرکاران_و_مراکز_خدمات', headers, rows);
  };

  // چاپ گزارش رسمی تعمیرکاران
  const handlePrint = () => {
    const headers = [
      'ردیف',
      'نام تعمیرکار',
      'رسته و تخصص',
      'تعمیرگاه / واحد خدمات',
      'تلفن تماس',
      'کیفیت خدمات'
    ];

    const rows = sortedMechanics.map((m, idx) => {
      const perf = getMechanicPerformance(m, failures, workflows);
      return [
        toPersianDigits(idx + 1),
        m.name,
        m.specialty,
        m.shopName,
        toPersianDigits(m.phone),
        perf.evaluatedCount > 0 ? `${toPersianDigits(perf.avgScore)} ستاره (${toPersianDigits(perf.evaluatedCount)} نظر)` : 'بدون سابقه ارزیابی'
      ];
    });

    printTableReport({
      title: 'گزارش رسمی تعمیرکاران و مراکز مجاز خدمات فنی',
      subtitle: 'مدیریت ناوگان خودرویی یاس - بانک اطلاعات تعمیرکاران و تکنسین‌ها',
      filterInfo: [
        { label: 'تعداد کل تعمیرکاران', value: `${toPersianDigits(sortedMechanics.length)} نفر/مرکز` },
        { label: 'فیلتر تخصص', value: specialtyFilter === 'all' ? 'همه تخصص‌ها' : specialtyFilter },
        ...(searchTerm ? [{ label: 'عبارت جستجوشده', value: searchTerm }] : [])
      ],
      headers,
      rows,
      columnAligns: ['center', 'right', 'center', 'right', 'center', 'center'],
      summaryItems: [
        { label: 'کل متخصصین ثبت‌شده', value: `${toPersianDigits(sortedMechanics.length)} ردیف`, isHighlight: true }
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
                <Wrench className="w-5 h-5 text-indigo-600 dark:text-indigo-500" />
                <span>{editingMechanicId ? 'ویرایش اطلاعات تعمیرکار' : 'ثبت تعمیرکار و مرکز خدمات جدید'}</span>
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">ثبت مشخصات تعمیرکار، آدرس، تخصص اصلی و شماره تماس</p>
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
              
              {/* نام تعمیرکار */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">نام و نام خانوادگی تعمیرکار <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: رضا کریمی"
                  className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* شماره تلفن */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">شماره تماس تعمیرکار <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="مثال: 09123456789"
                  className={`w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white border ${
                    duplicateMechanic ? 'border-rose-500 dark:border-rose-500 focus:ring-rose-500' : 'border-slate-300 dark:border-[#2d2d30] focus:border-indigo-500'
                  } rounded-lg px-3 py-2.5 text-xs font-bold text-right focus:outline-none font-mono`}
                />
                {duplicateMechanic ? (
                  <p className="text-[10px] text-rose-500 dark:text-rose-400 font-medium">
                    این شماره تماس قبلاً برای «{duplicateMechanic.name}» در بخش تعمیرکاران ثبت شده است.
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">شماره تماس در بخش تعمیرکاران نباید تکراری باشد.</p>
                )}
              </div>

              {/* تخصص تعمیرکار */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">تخصص اصلی</label>
                <CustomSelect
                  value={specialty}
                  onChange={(val) => setSpecialty(val)}
                  searchable={true}
                  options={specialtiesList.map(spec => ({ value: spec, label: spec }))}
                  onAddNew={() => setIsAddSpecialtyModalOpen(true)}
                  addNewLabel="افزودن تخصص جدید..."
                />
              </div>

              {/* آدرس */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">آدرس <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="مثال: تعمیرگاه مرکزی شماره ۱، خیابان آزادی..."
                  className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

            </div>

            {/* دکمه‌های فرم */}
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
                {editingMechanicId ? 'ذخیره تغییرات' : ((isNavigatedFromOrigin || peekNavigationOrigin()) ? 'ثبت تعمیرکار و بازگشت' : 'ذخیره اطلاعات تعمیرکار')}
              </button>
            </div>

          </form>

        </div>

        <AddMechanicSpecialtyModal
          isOpen={isAddSpecialtyModalOpen}
          onClose={() => setIsAddSpecialtyModalOpen(false)}
          onSpecialtyAdded={(newSpec) => {
            setSpecialty(newSpec);
          }}
          existingSpecialties={specialtiesList}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      
      {/* هدر صفحه */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-[#111113] p-4 rounded-lg border border-slate-200 dark:border-[#2d2d30]">
        <div>
          <h1 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Wrench className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            تعریف و مدیریت تعمیرکاران و مراکز خدمات
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            ثبت، ویرایش و پایش سطح عملکرد و رضایت تعمیرکاران و مراکز خدمات
          </p>
        </div>
        <button
          onClick={handleOpenCreateForm}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          ثبت تعمیرکار جدید
        </button>
      </div>

      {/* بخش فیلتر، جستجو، خروجی اکسل و چاپ */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="جستجو بر اساس نام تعمیرکار، تخصص، شماره تماس یا محل استقرار..."
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
          title="بارگذاری فایل اکسل و ورود اطلاعات تعمیرکاران"
        >
          <Upload className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>

        {/* دکمه خروجی اکسل */}
        <button
          type="button"
          onClick={handleExportExcel}
          className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-2xs shrink-0 group self-center"
          title="دریافت خروجی اکسل لیست تعمیرکاران"
        >
          <FileSpreadsheet className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>

        {/* دکمه چاپ */}
        <button
          type="button"
          onClick={handlePrint}
          className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-indigo-500 text-indigo-600 dark:text-indigo-400 transition-all cursor-pointer shadow-2xs shrink-0 group self-center"
          title="چاپ گزارش رسمی تعمیرکاران (نسخه چاپی / PDF)"
        >
          <Printer className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>
      </div>

      {/* جدول نمایش تعمیرکاران */}
      <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex justify-between items-center">
          <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
            <List className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>لیست تعمیرکاران و مراکز خدمات</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              {toPersianDigits(sortedMechanics.length)} نفر
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161619] text-slate-600 dark:text-slate-400 font-medium text-xs">
                <th className="py-2 px-3 text-center w-12 text-xs font-medium">ردیف</th>
                <TableColumnHeader
                  title="تعمیرکار"
                  colKey="name"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['name']}
                  onOpenFilter={handleOpenFilterMenu}
                />
                <TableColumnHeader
                  title="آدرس"
                  colKey="shopName"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['shopName']}
                  onOpenFilter={handleOpenFilterMenu}
                />
                <TableColumnHeader
                  title="تخصص"
                  colKey="specialty"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['specialty']}
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
                <TableColumnHeader
                  title="عملکرد و سطح رضایت"
                  colKey="satisfaction"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['satisfaction']}
                  onOpenFilter={handleOpenFilterMenu}
                />
                <th className="py-2 px-3 text-center text-xs font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
              {paginatedMechanics.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 text-[11px]">
                    هیچ تعمیرکاری با شرایط مورد نظر یافت نشد.
                  </td>
                </tr>
              ) : (
                paginatedMechanics.map((m, index) => {
                  const perf = getMechanicPerformance(m, failures, workflows);

                  return (
                    <tr 
                      key={m.id} 
                      onClick={() => handleOpenEditForm(m)}
                      title="برای ویرایش مشخصات تعمیرکار کلیک کنید"
                      className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/60 transition-colors cursor-pointer text-[11px]"
                    >
                      <td className="py-1.5 px-3 text-center text-slate-500 text-[11px]">
                        {toPersianDigits((currentPage - 1) * pageSize + index + 1)}
                      </td>
                      <td className="py-1.5 px-3">
                        <span className="text-slate-900 dark:text-white text-[11px]">{m.name}</span>
                      </td>
                      <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300 text-[11px]">
                        <span>{m.shopName}</span>
                      </td>
                      <td className="py-1.5 px-3">
                        <span className="text-slate-600 dark:text-slate-300 text-[11px]">
                          {m.specialty}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300 text-[11px]">
                        {toPersianDigits(m.phone)}
                      </td>
                      <td className="py-1.5 px-3">
                        {perf.evaluatedCount > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <span 
                              className={`inline-block text-[11px] px-2 py-0.5 rounded border ${
                                perf.color === 'emerald'
                                  ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
                                  : perf.color === 'indigo'
                                  ? 'text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20'
                                  : perf.color === 'amber'
                                  ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20'
                                  : 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20'
                              }`}
                              title={perf.tooltip}
                            >
                              <span>{perf.label}</span>
                              <span className="text-[10px] opacity-80 mr-1">({toPersianDigits(perf.avgScore)})</span>
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500" title={perf.tooltip}>
                              {toPersianDigits(perf.evaluatedCount)} نظر
                            </span>
                          </div>
                        ) : (
                          <span 
                            className="inline-block text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#1a1a1c] px-2 py-0.5 rounded border border-slate-200 dark:border-[#2d2d30]"
                            title={perf.tooltip}
                          >
                            بدون ارزیابی
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(m.id, m.name);
                            }}
                            className="p-1 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-rose-100 dark:hover:bg-rose-600/20 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded border border-slate-200 dark:border-[#2d2d30] transition-colors cursor-pointer"
                            title="حذف"
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
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredMechanics.length}
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

      <AddMechanicSpecialtyModal
        isOpen={isAddSpecialtyModalOpen}
        onClose={() => setIsAddSpecialtyModalOpen(false)}
        onSpecialtyAdded={(newSpec) => {
          setSpecialty(newSpec);
        }}
        existingSpecialties={specialtiesList}
      />

      {/* پنجره پاپ‌آپ ورود تعاریف تعمیرکاران از اکسل */}
      <DefinitionsExcelImportModal
        isOpen={isImportModalOpen}
        initialType="mechanics"
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={onBulkImportSuccess}
      />
    </div>
  );
}
