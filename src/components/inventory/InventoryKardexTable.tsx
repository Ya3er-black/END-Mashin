import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  History, Search, FileSpreadsheet, ArrowDownLeft, ArrowUpRight, 
  RotateCcw, Printer, X
} from 'lucide-react';
import { InventoryTransaction, PartInventory, Vehicle } from '../../types';
import { toPersianDigits, formatPrice, formatNumber } from '../../utils/numberUtils';
import { toJalaliDate, toJalaliStandardString, getCurrentJalaliDate } from '../../utils/date';
import { sortData, SortDirection } from '../../utils/sortUtils';
import { TableColumnHeader, ColumnFilterMenu, FilterMenuState } from '../TableFilterSort';
import { JalaliDatePicker } from '../JalaliDatePicker';
import { Pagination } from '../Pagination';

interface InventoryKardexTableProps {
  transactions: InventoryTransaction[];
  parts: PartInventory[];
  vehicles?: Vehicle[];
  onOpenEditPart?: (part: PartInventory) => void;
  onOpenEditTransaction?: (transaction: InventoryTransaction) => void;
}

export const InventoryKardexTable: React.FC<InventoryKardexTableProps> = ({
  transactions,
  parts,
  vehicles = [],
  onOpenEditPart,
  onOpenEditTransaction
}) => {
  const [selectedPartId, setSelectedPartId] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'in' | 'out'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // مرتب‌سازی و فیلترهای سبک اکسل ستون‌ها
  const [sortKey, setSortKey] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [filterMenu, setFilterMenu] = useState<FilterMenuState | null>(null);

  // بستن منوی پیشنهادات جستجو با کلیک بیرون از کادر
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // کالای انتخاب شده در صورت فیلتر تک کالا
  const selectedPart = useMemo(() => {
    if (selectedPartId === 'all') return null;
    return parts.find(p => p.id === Number(selectedPartId)) || null;
  }, [selectedPartId, parts]);

  // لیست قطعات منطبق با عبارت جستجو
  const matchedParts = useMemo(() => {
    if (!searchTerm.trim()) return parts;
    const query = searchTerm.toLowerCase().trim();
    return parts.filter(p => 
      p.partName.toLowerCase().includes(query) ||
      (p.sku && p.sku.toLowerCase().includes(query)) ||
      (p.category && p.category.toLowerCase().includes(query))
    );
  }, [parts, searchTerm]);

  // استخراج ارزش سلول برای فیلتر ستونی اکسل
  const getColumnItemValue = (t: InventoryTransaction, colKey: string): string => {
    const rowBuyPrice = t.buyPrice ?? t.unitPrice ?? 0;
    const rowSellPrice = t.sellPrice ?? Math.round(rowBuyPrice * 1.25);
    switch (colKey) {
      case 'createdAt':
        return toJalaliDate(t.createdAt);
      case 'partName':
        return t.partName || '-';
      case 'quantity':
        return `${t.type === 'in' ? '+' : '-'}${formatNumber(t.quantity)}`;
      case 'buyPrice':
        return rowBuyPrice ? `${formatPrice(rowBuyPrice)} ریال` : '-';
      case 'sellPrice':
        return rowSellPrice ? `${formatPrice(rowSellPrice)} ریال` : '-';
      case 'totalPrice':
        return `${formatPrice(t.totalPrice || (t.quantity * rowBuyPrice))} ریال`;
      case 'newQuantity':
        return t.newQuantity !== undefined ? `${formatNumber(t.newQuantity)} عدد` : '-';
      case 'reference':
        return t.reference || t.notes || '-';
      case 'type':
        return t.type === 'in' ? 'ورود' : 'خروج';
      default:
        return String((t as any)[colKey] ?? '-');
    }
  };

  // فیلتر اولیه بر اساس فرم فیلترهای بالای صفحه
  const baseFilteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // فیلتر کالا
      if (selectedPartId !== 'all') {
        if (t.partId !== Number(selectedPartId) && t.partName !== selectedPart?.partName) {
          return false;
        }
      }

      // فیلتر نوع ورود / خروج
      if (typeFilter !== 'all' && t.type !== typeFilter) {
        return false;
      }

      // فیلتر بازه تاریخی
      const startComp = startDate ? toJalaliStandardString(startDate) : '';
      const endComp = endDate ? toJalaliStandardString(endDate) : '';
      const itemComp = t.createdAt ? toJalaliStandardString(t.createdAt) : '';

      if (startComp && itemComp && itemComp < startComp) return false;
      if (endComp && itemComp && itemComp > endComp) return false;

      // فیلتر جستجوی متنی آزاد در صورت عدم انتخاب قطعه خاص
      if (selectedPartId === 'all' && searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesName = t.partName.toLowerCase().includes(query);
        const matchesRef = t.reference ? t.reference.toLowerCase().includes(query) : false;
        const matchesRecipient = t.recipientOrSupplier ? t.recipientOrSupplier.toLowerCase().includes(query) : false;
        const matchesNotes = t.notes ? t.notes.toLowerCase().includes(query) : false;
        if (!matchesName && !matchesRef && !matchesRecipient && !matchesNotes) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, selectedPartId, selectedPart, typeFilter, startDate, endDate, searchTerm]);

  // اعمال فیلترهای ستونی سبک اکسل
  const filteredTransactions = useMemo(() => {
    return baseFilteredTransactions.filter(t => {
      for (const [colKey, allowedValues] of Object.entries(columnFilters)) {
        if (allowedValues && Array.isArray(allowedValues)) {
          const itemVal = getColumnItemValue(t, colKey);
          if (!allowedValues.includes(itemVal)) return false;
        }
      }
      return true;
    });
  }, [baseFilteredTransactions, columnFilters]);

  // مرتب‌سازی هوشمند کاردکس
  const sortedTransactions = useMemo(() => {
    return sortData(filteredTransactions, sortKey, sortDirection, {
      createdAt: (t: InventoryTransaction) => t.createdAt ? toJalaliStandardString(t.createdAt) : '',
      partName: (t: InventoryTransaction) => t.partName || '',
      quantity: (t: InventoryTransaction) => t.type === 'in' ? t.quantity : -t.quantity,
      buyPrice: (t: InventoryTransaction) => t.buyPrice ?? t.unitPrice ?? 0,
      sellPrice: (t: InventoryTransaction) => t.sellPrice ?? Math.round((t.buyPrice ?? t.unitPrice ?? 0) * 1.25),
      totalPrice: (t: InventoryTransaction) => t.totalPrice || (t.quantity * (t.buyPrice ?? t.unitPrice ?? 0)),
      newQuantity: (t: InventoryTransaction) => t.newQuantity ?? 0,
      reference: (t: InventoryTransaction) => t.reference || t.notes || '',
      type: (t: InventoryTransaction) => t.type === 'in' ? 'ورود' : 'خروج'
    });
  }, [filteredTransactions, sortKey, sortDirection]);

  // مدیریت منوی فیلتر ستون‌ها
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
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
    baseFilteredTransactions.forEach(t => {
      const val = getColumnItemValue(t, filterMenu.colKey);
      valMap.set(val, (valMap.get(val) || 0) + 1);
    });
    return Array.from(valMap.entries()).map(([value, count]) => ({ value, count }));
  }, [filterMenu, baseFilteredTransactions]);

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

  // آمارهای کاردکس برای اقلام فیلتر شده
  const stats = useMemo(() => {
    let totalInQty = 0;
    let totalOutQty = 0;
    let totalInValue = 0;
    let totalOutValue = 0;

    filteredTransactions.forEach(t => {
      if (t.type === 'in') {
        totalInQty += t.quantity;
        totalInValue += t.totalPrice || (t.quantity * (t.buyPrice ?? t.unitPrice ?? 0));
      } else {
        totalOutQty += t.quantity;
        totalOutValue += t.totalPrice || (t.quantity * (t.sellPrice ?? t.unitPrice ?? 0));
      }
    });

    return {
      totalInQty,
      totalOutQty,
      totalInValue,
      totalOutValue,
      count: filteredTransactions.length
    };
  }, [filteredTransactions]);

  const totalPages = Math.ceil(sortedTransactions.length / pageSize) || 1;
  const paginatedTransactions = useMemo(() => {
    return sortedTransactions.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [sortedTransactions, currentPage, pageSize]);

  // بازنشانی صفحه در تغییر فیلترها و مرتب‌سازی
  useEffect(() => {
    setCurrentPage(1);
  }, [columnFilters, sortKey, sortDirection, selectedPartId, typeFilter, startDate, endDate, searchTerm]);

  const handleResetFilters = () => {
    setSelectedPartId('all');
    setTypeFilter('all');
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
    setColumnFilters({});
    setIsSearchOpen(false);
    setCurrentPage(1);
  };

  const handleRowClick = (t: InventoryTransaction) => {
    if (onOpenEditTransaction) {
      onOpenEditTransaction(t);
      return;
    }
    if (onOpenEditPart) {
      const targetPart = parts.find(p => (t.partId && p.id === t.partId) || p.partName === t.partName);
      if (targetPart) {
        onOpenEditPart(targetPart);
      } else {
        onOpenEditPart({
          id: t.partId || 0,
          partName: t.partName,
          quantity: t.newQuantity ?? 0,
          minQuantity: 5,
          buyPrice: t.buyPrice || t.unitPrice || 0,
          sellPrice: t.sellPrice || (t.buyPrice ? Math.round(t.buyPrice * 1.25) : 0),
          createdAt: t.createdAt
        });
      }
    }
  };

  const hasActiveFilters = selectedPartId !== 'all' || typeFilter !== 'all' || startDate !== '' || endDate !== '' || searchTerm !== '' || Object.keys(columnFilters).length > 0;

  const handlePrint = () => {
    window.print();
  };

  // خروجی اکسل کاردکس
  const handleExportExcel = () => {
    try {
      const sanitize = (val: any) => {
        if (val === undefined || val === null) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const fileName = selectedPart
        ? `کاردکس_${selectedPart.partName.replace(/\s+/g, '_')}_${startDate || 'ابتدا'}_تا_${endDate || 'انتها'}`
        : `دفتر_کاردکس_انبار_${startDate || 'ابتدا'}_تا_${endDate || 'انتها'}`;

      const headers = [
        'ردیف',
        'تاریخ ثبت',
        'نام قطعه',
        'تعداد',
        'فی خرید (ریال)',
        'فی فروش (ریال)',
        'ارزش کل (ریال)',
        'موجودی پس از عملیات',
        'شماره سند / مرجع',
        'نوع عملیات'
      ];

      const rows = sortedTransactions.map((t, idx) => {
        const rowBuyPrice = t.buyPrice ?? t.unitPrice ?? 0;
        const rowSellPrice = t.sellPrice ?? Math.round(rowBuyPrice * 1.25);

        return [
          idx + 1,
          toJalaliDate(t.createdAt),
          t.partName,
          t.type === 'in' ? `+${t.quantity}` : `-${t.quantity}`,
          rowBuyPrice,
          rowSellPrice,
          t.totalPrice,
          t.newQuantity !== undefined ? t.newQuantity : '-',
          t.reference || t.notes || '-',
          t.type === 'in' ? 'ورود' : 'خروج'
        ].map(sanitize).join(',');
      });

      const csvContent = '\uFEFF' + [headers.map(sanitize).join(','), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${fileName}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error exporting CSV:', e);
    }
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      {/* ۲. نوار جستجوی قطعات، فیلترهای تاریخ و خروجی‌های اکسل و چاپ (دقیقاً مشابه بخش حسابداری) */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center relative z-30">
        
        {/* فیلد جستجو و انتخاب قطعه بر اساس نام قطعه */}
        <div ref={searchContainerRef} className="relative flex-1">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input 
              type="text" 
              placeholder={selectedPart ? `قطعه انتخاب‌شده: ${selectedPart.partName}` : "جستجو و انتخاب نام یا کد قطعه (تایپ نام قطعه)..."} 
              value={selectedPart && !searchTerm ? selectedPart.partName : searchTerm}
              onFocus={() => {
                setIsSearchOpen(true);
              }}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (selectedPartId !== 'all') {
                  setSelectedPartId('all');
                }
                setIsSearchOpen(true);
                setCurrentPage(1);
              }}
              className={`w-full h-[34px] bg-white dark:bg-[#111113] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg pr-9 pl-8 py-0 text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs ${
                selectedPart ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20' : 'border-slate-300 dark:border-[#2d2d30]'
              }`}
            />
            {(searchTerm || selectedPart) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedPartId('all');
                  setIsSearchOpen(false);
                  setCurrentPage(1);
                }}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="پاک کردن انتخاب"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* لیست پیشنهادات جستجوی قطعات (دقیقاً مشابه بخش حسابداری) */}
          {isSearchOpen && (
            <div className="absolute top-full right-0 left-0 mt-1.5 bg-white dark:bg-[#151518] rounded-xl border border-slate-200 dark:border-[#2d2d30] shadow-2xl overflow-hidden max-h-72 overflow-y-auto z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 bg-slate-50 dark:bg-[#1a1a1e] border-b border-slate-200 dark:border-[#2d2d30] flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                <span>{searchTerm.trim() ? `قطعات منطبق با «${searchTerm}»` : 'لیست قطعات و کالاها (جهت انتخاب کلیک کنید)'}</span>
                <span>{toPersianDigits(matchedParts.length)} قطعه</span>
              </div>

              {matchedParts.length === 0 ? (
                <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-xs font-bold space-y-1">
                  <p>هیچ قطعه‌ای با نام «{searchTerm}» یافت نشد.</p>
                  <p className="text-[10px] text-slate-400 font-normal">لطفاً املای نام قطعه را بررسی کنید یا حروف دیگری را وارد نمایید.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-[#242428]">
                  {/* گزینه همه کالاهای انبار */}
                  <div
                    onClick={() => {
                      setSelectedPartId('all');
                      setSearchTerm('');
                      setIsSearchOpen(false);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                      selectedPartId === 'all'
                        ? 'bg-indigo-50 dark:bg-indigo-950/40'
                        : 'hover:bg-slate-50 dark:hover:bg-[#1c1c20]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        همه کالاهای انبار (دفتر کل کاردکس)
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      نمایش کل گردش
                    </span>
                  </div>

                  {matchedParts.map(p => {
                    const isSelected = selectedPartId === String(p.id);

                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedPartId(String(p.id));
                          setSearchTerm('');
                          setIsSearchOpen(false);
                          setCurrentPage(1);
                        }}
                        className={`px-3 py-1.5 transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected 
                            ? 'bg-indigo-50 dark:bg-indigo-950/40' 
                            : 'hover:bg-slate-50 dark:hover:bg-[#1c1c20]'
                        }`}
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {p.partName}
                          </span>
                          {p.sku && (
                            <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-mono font-bold">
                              کد: {toPersianDigits(p.sku)}
                            </span>
                          )}
                          {p.category && (
                            <span className="text-[10px] text-slate-400">
                              ({p.category})
                            </span>
                          )}
                        </div>

                        <div className="shrink-0 text-left">
                          <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#1a1a1e] px-2 py-0.5 rounded border border-slate-200 dark:border-[#2d2d30]">
                            موجودی: {formatNumber(p.quantity)} عدد
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* فیلتر از تاریخ با تقویم شمسی */}
        <div className="w-full sm:w-36">
          <JalaliDatePicker
            value={startDate}
            onChange={(d) => {
              setStartDate(d);
              setCurrentPage(1);
            }}
            placeholder="از تاریخ"
            inputClassName="h-[34px] text-[11px]"
          />
        </div>

        {/* فیلتر تا تاریخ با تقویم شمسی */}
        <div className="w-full sm:w-36">
          <JalaliDatePicker
            value={endDate}
            onChange={(d) => {
              setEndDate(d);
              setCurrentPage(1);
            }}
            placeholder="تا تاریخ"
            inputClassName="h-[34px] text-[11px]"
          />
        </div>

        {/* دکمه‌های خروجی اکسل و چاپ صورتحساب (آیکونی، مشابه بخش حسابداری) */}
        <div className="flex items-center gap-1.5 self-center">
          <button
            type="button"
            onClick={handleExportExcel}
            className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-2xs shrink-0 group"
            title="دریافت خروجی اکسل"
          >
            <FileSpreadsheet className="w-4 h-4 transition-transform group-hover:scale-110" />
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-indigo-500 text-indigo-600 dark:text-indigo-400 transition-all cursor-pointer shadow-2xs shrink-0 group"
            title="چاپ کاردکس انبار"
          >
            <Printer className="w-4 h-4 transition-transform group-hover:scale-110" />
          </button>
        </div>
      </div>

      {/* کارت خلاصه مشخصات کالای فیلتر شده */}
      {selectedPart && (
        <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-lg grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-[11px]">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">کالای انتخاب‌شده:</span>
            <strong className="text-slate-900 dark:text-white font-bold">{selectedPart.partName}</strong>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">موجودی فعلی فیزیکی:</span>
            <strong className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">{formatNumber(selectedPart.quantity)} عدد</strong>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">مجموع ورود در بازه:</span>
            <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">+{formatNumber(stats.totalInQty)} عدد</strong>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">مجموع خروج در بازه:</span>
            <strong className="text-amber-600 dark:text-amber-400 font-mono font-bold">-{formatNumber(stats.totalOutQty)} عدد</strong>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">آخرین نرخ خرید / فروش:</span>
            <strong className="text-slate-800 dark:text-slate-200 font-mono text-[10.5px]">
              {formatPrice(selectedPart.buyPrice ?? selectedPart.unitPrice ?? 0)} / {formatPrice(selectedPart.sellPrice ?? Math.round((selectedPart.buyPrice ?? selectedPart.unitPrice ?? 0) * 1.25))}
            </strong>
          </div>
        </div>
      )}

      {/* جدول نمایش کاردکس */}
      <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
            <History className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>
              {selectedPart ? `کاردکس تفصیلی قطعه: ${selectedPart.partName}` : 'دفتر ثبت و گردش کاردکس کلی انبار'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {Object.keys(columnFilters).length > 0 && (
              <button
                type="button"
                onClick={() => setColumnFilters({})}
                className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                title="حذف فیلتر ستون‌ها"
              >
                <X className="w-3 h-3" />
                <span>حذف فیلتر ستون‌ها ({toPersianDigits(Object.keys(columnFilters).length)})</span>
              </button>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-[10px] text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 font-bold flex items-center gap-1 cursor-pointer"
                title="حذف همه فیلترها"
              >
                <span>حذف همه فیلترها</span>
              </button>
            )}
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
              گردش کل: {formatPrice(stats.totalInValue + stats.totalOutValue)} ریال
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              {toPersianDigits(sortedTransactions.length)} تراکنش
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
            <thead className="bg-slate-50 dark:bg-[#161618]">
              <tr className="border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-medium text-xs">
                <th className="py-2 px-3 text-center w-12 text-xs font-medium">ردیف</th>

                {/* ۱. تاریخ ثبت */}
                <TableColumnHeader
                  title="تاریخ ثبت"
                  colKey="createdAt"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['createdAt']}
                  onOpenFilter={handleOpenFilterMenu}
                  align="center"
                  width="105px"
                />

                {/* ۲. نام قطعه / کالا */}
                <TableColumnHeader
                  title="نام قطعه / کالا"
                  colKey="partName"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['partName']}
                  onOpenFilter={handleOpenFilterMenu}
                  align="right"
                />

                {/* ۳. تعداد */}
                <TableColumnHeader
                  title="تعداد"
                  colKey="quantity"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['quantity']}
                  onOpenFilter={handleOpenFilterMenu}
                  align="center"
                  width="85px"
                />

                {/* ۴. فی خرید */}
                <TableColumnHeader
                  title="فی خرید"
                  colKey="buyPrice"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['buyPrice']}
                  onOpenFilter={handleOpenFilterMenu}
                  align="center"
                  width="115px"
                />

                {/* ۵. فی فروش */}
                <TableColumnHeader
                  title="فی فروش"
                  colKey="sellPrice"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['sellPrice']}
                  onOpenFilter={handleOpenFilterMenu}
                  align="center"
                  width="115px"
                />

                {/* ۶. ارزش کل */}
                <TableColumnHeader
                  title="ارزش کل"
                  colKey="totalPrice"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['totalPrice']}
                  onOpenFilter={handleOpenFilterMenu}
                  align="center"
                  width="120px"
                />

                {/* ۷. مانده انبار */}
                <TableColumnHeader
                  title="مانده انبار"
                  colKey="newQuantity"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['newQuantity']}
                  onOpenFilter={handleOpenFilterMenu}
                  align="center"
                  width="95px"
                />

                {/* ۸. مرجع / شرح سند */}
                <TableColumnHeader
                  title="مرجع / شرح سند"
                  colKey="reference"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['reference']}
                  onOpenFilter={handleOpenFilterMenu}
                  align="right"
                />

                {/* ۹. نوع عملیات */}
                <TableColumnHeader
                  title="نوع عملیات"
                  colKey="type"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['type']}
                  onOpenFilter={handleOpenFilterMenu}
                  align="center"
                  width="95px"
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-[#2d2d30]/60">
              {paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-slate-500 dark:text-slate-400 text-xs">
                    هیچ تراکنش کاردکسی در این بازه یا با این شرایط فیلتر یافت نشد.
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((t, idx) => {
                  const rowBuyPrice = t.buyPrice ?? t.unitPrice ?? 0;
                  const rowSellPrice = t.sellPrice ?? Math.round(rowBuyPrice * 1.25);

                  return (
                    <tr 
                      key={t.id} 
                      onClick={() => handleRowClick(t)}
                      className="h-9 hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/60 transition-colors cursor-pointer text-[11px]"
                      title={t.type === 'in' ? 'برای ویرایش رسید ورود کالا به انبار کلیک کنید' : 'برای ویرایش حواله خروج از انبار کلیک کنید'}
                    >
                      {/* ردیف */}
                      <td className="py-1 px-3 text-center text-slate-500 dark:text-slate-400 text-[11px] align-middle font-mono">
                        {toPersianDigits((currentPage - 1) * pageSize + idx + 1)}
                      </td>

                      {/* تاریخ ثبت */}
                      <td className="py-1 px-3 text-center text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap align-middle">
                        {toJalaliDate(t.createdAt)}
                      </td>

                      {/* نام قطعه */}
                      <td className="py-1 px-3 text-slate-800 dark:text-slate-200 text-[11px] align-middle font-medium">
                        <span className="truncate max-w-[180px] block">{t.partName}</span>
                      </td>

                      {/* تعداد */}
                      <td className="py-1 px-3 text-center font-mono font-bold whitespace-nowrap align-middle text-[11px]">
                        <span className={t.type === 'in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                          {t.type === 'in' ? '+' : '-'}{formatNumber(t.quantity)}
                        </span>
                      </td>

                      {/* فی خرید */}
                      <td className="py-1 px-3 text-center text-slate-700 dark:text-slate-300 font-mono text-[11px] whitespace-nowrap align-middle">
                        {rowBuyPrice ? formatPrice(rowBuyPrice) : '-'}
                      </td>

                      {/* فی فروش */}
                      <td className="py-1 px-3 text-center text-slate-700 dark:text-slate-300 font-mono text-[11px] whitespace-nowrap align-middle">
                        {rowSellPrice ? formatPrice(rowSellPrice) : '-'}
                      </td>

                      {/* ارزش کل */}
                      <td className="py-1 px-3 text-center text-slate-800 dark:text-slate-200 font-mono font-medium text-[11px] whitespace-nowrap align-middle">
                        {formatPrice(t.totalPrice)}
                      </td>

                      {/* مانده انبار */}
                      <td className="py-1 px-3 text-center text-slate-800 dark:text-slate-200 font-mono font-medium text-[11px] whitespace-nowrap align-middle">
                        {t.newQuantity !== undefined ? formatNumber(t.newQuantity) : '-'}
                      </td>

                      {/* مرجع / شرح سند */}
                      <td className="py-1 px-3 text-slate-700 dark:text-slate-300 text-[11px] align-middle">
                        <div className="truncate max-w-[160px]" title={t.reference || t.notes || ''}>
                          {t.reference || t.notes || '-'}
                        </div>
                      </td>

                      {/* نوع عملیات */}
                      <td className="py-1 px-3 text-center whitespace-nowrap align-middle">
                        {t.type === 'in' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold text-[10px]">
                            <ArrowDownLeft className="w-2.5 h-2.5" />
                            ورود
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold text-[10px]">
                            <ArrowUpRight className="w-2.5 h-2.5" />
                            خروج
                          </span>
                        )}
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
          totalItems={sortedTransactions.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* بخش چاپ رسمی کاردکس انبار */}
      <div id="printable-kardex-area" className="hidden print:block text-black bg-white p-6 rounded-2xl w-full dir-rtl font-sans">
        <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-black text-white rounded-xl flex items-center justify-center font-black text-xl">
              <History className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-black tracking-tight">
                {selectedPart ? `کاردکس تفصیلی کالا: ${selectedPart.partName}` : 'دفتر کل گردش کاردکس انبار'}
              </h1>
              <p className="text-xs text-black mt-1">سامانه جامع انبارداری و مدیریت گردش موجودی قطعات</p>
            </div>
          </div>
          <div className="text-left font-mono text-xs space-y-1 p-2.5 rounded-xl border border-black min-w-[170px]">
            <div><span className="font-bold">تاریخ چاپ:</span> {toPersianDigits(getCurrentJalaliDate())}</div>
            <div><span className="font-bold">محدوده زمانی:</span> {startDate ? toPersianDigits(startDate) : 'ابتدا'} تا {endDate ? toPersianDigits(endDate) : 'انتها'}</div>
            <div><span className="font-bold">تعداد رکوردها:</span> {toPersianDigits(sortedTransactions.length)} ردیف</div>
          </div>
        </div>

        {selectedPart && (
          <div className="grid grid-cols-4 gap-3 p-3.5 rounded-xl border border-black mb-4 font-sans text-xs">
            <div>
              <span className="text-[10px] text-black block">نام قطعه</span>
              <span className="font-bold text-black text-sm">{selectedPart.partName}</span>
            </div>
            <div>
              <span className="text-[10px] text-black block">موجودی فعلی</span>
              <span className="font-mono font-bold text-black text-sm">{formatNumber(selectedPart.quantity)} عدد</span>
            </div>
            <div>
              <span className="text-[10px] text-black block">مجموع ورود در بازه</span>
              <span className="font-mono font-bold text-black text-sm">+{formatNumber(stats.totalInQty)} عدد</span>
            </div>
            <div>
              <span className="text-[10px] text-black block">مجموع خروج در بازه</span>
              <span className="font-mono font-bold text-black text-sm">-{formatNumber(stats.totalOutQty)} عدد</span>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-black mb-4">
          <table className="w-full text-right border-collapse text-xs font-mono font-bold">
            <thead>
              <tr className="border-b border-black font-mono font-bold text-xs bg-slate-100">
                <th className="py-2 px-2 w-10 text-center border-l border-black">#</th>
                <th className="py-2 px-2 w-24 text-center border-l border-black">تاریخ</th>
                <th className="py-2 px-2 border-l border-black">نام کالا / قطعه</th>
                <th className="py-2 px-2 w-16 text-center border-l border-black">تعداد</th>
                <th className="py-2 px-2 w-24 text-center border-l border-black">فی (ریال)</th>
                <th className="py-2 px-2 w-28 text-center border-l border-black">ارزش کل (ریال)</th>
                <th className="py-2 px-2 w-16 text-center border-l border-black">مانده</th>
                <th className="py-2 px-2 border-l border-black">مرجع / شرح</th>
                <th className="py-2 px-2 w-20 text-center">نوع عملیات</th>
              </tr>
            </thead>
            <tbody>
              {sortedTransactions.map((t, idx) => (
                <tr key={t.id} className="border-b border-black">
                  <td className="py-1.5 px-2 text-center border-l border-black">{toPersianDigits(idx + 1)}</td>
                  <td className="py-1.5 px-2 text-center border-l border-black">{toJalaliDate(t.createdAt)}</td>
                  <td className="py-1.5 px-2 border-l border-black">{t.partName}</td>
                  <td className="py-1.5 px-2 text-center border-l border-black">
                    {t.type === 'in' ? `+${formatNumber(t.quantity)}` : `-${formatNumber(t.quantity)}`}
                  </td>
                  <td className="py-1.5 px-2 text-center border-l border-black">
                    {formatPrice(t.type === 'in' ? (t.buyPrice ?? t.unitPrice ?? 0) : (t.sellPrice ?? t.unitPrice ?? 0))}
                  </td>
                  <td className="py-1.5 px-2 text-center border-l border-black">
                    {formatPrice(t.totalPrice || (t.quantity * (t.type === 'in' ? (t.buyPrice ?? t.unitPrice ?? 0) : (t.sellPrice ?? t.unitPrice ?? 0))))}
                  </td>
                  <td className="py-1.5 px-2 text-center border-l border-black">
                    {t.newQuantity !== undefined ? formatNumber(t.newQuantity) : '-'}
                  </td>
                  <td className="py-1.5 px-2 border-l border-black">{t.reference || t.notes || '-'}</td>
                  <td className="py-1.5 px-2 text-center">
                    {t.type === 'in' ? 'ورود' : 'خروج'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* منوی شناور فیلتر ستون سبک اکسل */}
      <ColumnFilterMenu
        filterMenu={filterMenu}
        onClose={() => setFilterMenu(null)}
        uniqueValues={currentMenuUniqueValues}
        selectedValues={currentSelectedValues}
        onToggleValue={handleToggleColumnValue}
        onSelectAll={handleSelectAllInColumn}
        onDeselectAll={handleDeselectAllInColumn}
        onSelectOnly={handleSelectOnlyValue}
      />
    </div>
  );
};
