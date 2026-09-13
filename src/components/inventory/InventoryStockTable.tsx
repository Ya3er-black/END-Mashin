import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, Package, ArrowDownLeft, ArrowUpRight, Edit2, RotateCcw, 
  MapPin, X, Layers, Warehouse, Check, FileSpreadsheet, Printer 
} from 'lucide-react';
import { PartInventory } from '../../types';
import { toPersianDigits, formatPrice, formatNumber, parsePersianNumber } from '../../utils/numberUtils';
import { toJalaliDate, toJalaliStandardString, getCurrentJalaliDate } from '../../utils/date';
import { JalaliDatePicker } from '../JalaliDatePicker';
import { TableColumnHeader } from '../TableFilterSort';
import { Pagination } from '../Pagination';
import { SortDirection } from '../../utils/sortUtils';

interface InventoryStockTableProps {
  parts: PartInventory[];
  sortedParts: PartInventory[];
  paginatedParts: PartInventory[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  sortKey: string;
  sortDirection: SortDirection;
  onSort: (key: string) => void;
  columnFilters: Record<string, string[]>;
  onOpenFilterMenu: (e: React.MouseEvent, colKey: string, colTitle: string) => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
  totalSellValue: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onOpenStockIn: (part?: PartInventory) => void;
  onOpenStockOut: (part?: PartInventory) => void;
  onOpenEditForm: (part: PartInventory) => void;
  onEditPart?: (id: number, part: Partial<PartInventory>) => Promise<void>;
}

// مدل آیتم موقعیت استقرار کالا به همراه تعداد کالا در هر محل
export interface LocationStockItem {
  location: string;
  quantity: number;
  isExplicit: boolean;
}

// تابع کمکی برای استخراج موقعیت‌ها به صورت متنی ساده
const parseLocations = (locString?: string): string[] => {
  if (!locString || !locString.trim()) return [];
  return locString.split(/[,،|/]/).map(s => s.trim()).filter(Boolean);
};

// تابع پیشرفته برای استخراج محل و تعداد کالا در هر محل
export const parseLocationStockItems = (locString?: string, totalQuantity: number = 0): LocationStockItem[] => {
  if (!locString || !locString.trim()) return [];

  const rawParts = locString.split(/[,،|/]/).map(s => s.trim()).filter(Boolean);
  if (rawParts.length === 0) return [];

  const convertDigits = (str: string) => {
    return str
      .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  };

  const parsedItems: { location: string; quantity: number; isExplicit: boolean }[] = [];

  for (const raw of rawParts) {
    const normalized = convertDigits(raw);
    let location = raw;
    let qty = 0;
    let isExplicit = false;

    // حالت ۱: قفسه A-3 (۱۰ عدد) یا (۱۰)
    const parenMatch = normalized.match(/^(.+?)\s*[({\[]\s*(?:تعداد\s*[:\-]?\s*)?(\d+)\s*(?:عدد|قلم|بسته|مورد)?\s*[)}\]]\s*$/i);
    // حالت ۲: قفسه A-3 : ۱۰ عدد یا قفسه A-3 - ۱۰ عدد
    const colonMatch = normalized.match(/^(.+?)\s*[:\-—]\s*(\d+)\s*(?:عدد|قلم|بسته|مورد)?\s*$/i);
    // حالت ۳: ۱۰ عدد در قفسه A-3
    const leadMatch = normalized.match(/^\s*(\d+)\s*(?:عدد|قلم|بسته|مورد)?\s*(?:در|از)\s*(.+)$/i);

    if (parenMatch) {
      location = parenMatch[1].trim();
      qty = parseInt(parenMatch[2], 10);
      isExplicit = true;
    } else if (colonMatch) {
      location = colonMatch[1].trim();
      qty = parseInt(colonMatch[2], 10);
      isExplicit = true;
    } else if (leadMatch) {
      qty = parseInt(leadMatch[1], 10);
      location = leadMatch[2].trim();
      isExplicit = true;
    }

    parsedItems.push({
      location: location || raw,
      quantity: isNaN(qty) ? 0 : qty,
      isExplicit
    });
  }

  // اگر تنها یک محل ثبت شده و عددی صریح قید نشده، کل موجودی متعلق به همین محل است
  if (parsedItems.length === 1 && !parsedItems[0].isExplicit) {
    parsedItems[0].quantity = totalQuantity;
  } else {
    // اگر چند محل داریم، مقادیر بدون عدد را از باقیمانده موجودی پر می‌کنیم
    const explicitSum = parsedItems.filter(it => it.isExplicit).reduce((sum, it) => sum + it.quantity, 0);
    const nonExplicitItems = parsedItems.filter(it => !it.isExplicit);

    if (nonExplicitItems.length > 0) {
      const remaining = Math.max(0, totalQuantity - explicitSum);
      const perItem = Math.floor(remaining / nonExplicitItems.length);
      const rem = remaining % nonExplicitItems.length;

      let idx = 0;
      for (const it of nonExplicitItems) {
        it.quantity = perItem + (idx < rem ? 1 : 0);
        idx++;
      }
    }
  }

  return parsedItems;
};

export const InventoryStockTable: React.FC<InventoryStockTableProps> = ({
  parts,
  sortedParts,
  paginatedParts,
  searchTerm,
  setSearchTerm,
  sortKey,
  sortDirection,
  onSort,
  columnFilters,
  onOpenFilterMenu,
  onResetFilters,
  hasActiveFilters,
  totalSellValue,
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onOpenStockIn,
  onOpenStockOut,
  onOpenEditForm,
  onEditPart
}) => {
  // مدیریت قطعه در حال مشاهده موقعیت مکانی
  const [selectedLocationPart, setSelectedLocationPart] = useState<PartInventory | null>(null);
  const [isEditingLocationQuantities, setIsEditingLocationQuantities] = useState<boolean>(false);
  const [customLocationQuantities, setCustomLocationQuantities] = useState<number[]>([]);
  const [isSavingQuantities, setIsSavingQuantities] = useState<boolean>(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // فیلتر کردن اقلام بر اساس بازه تاریخ ثبت
  const dateFilteredParts = useMemo(() => {
    if (!startDate && !endDate) return sortedParts;
    const startComp = startDate ? toJalaliStandardString(startDate) : '';
    const endComp = endDate ? toJalaliStandardString(endDate) : '';

    return sortedParts.filter(p => {
      if (!p.createdAt) return true;
      const itemComp = toJalaliStandardString(p.createdAt);
      if (startComp && itemComp < startComp) return false;
      if (endComp && itemComp > endComp) return false;
      return true;
    });
  }, [sortedParts, startDate, endDate]);

  const tablePaginatedParts = useMemo(() => {
    if (!startDate && !endDate) return paginatedParts;
    const startIdx = (currentPage - 1) * pageSize;
    return dateFilteredParts.slice(startIdx, startIdx + pageSize);
  }, [dateFilteredParts, paginatedParts, startDate, endDate, currentPage, pageSize]);

  const effectiveTotalPages = (startDate || endDate) 
    ? Math.ceil(dateFilteredParts.length / pageSize) || 1 
    : totalPages;

  const effectiveTotalItems = (startDate || endDate)
    ? dateFilteredParts.length
    : sortedParts.length;

  const locationItems = useMemo(() => {
    if (!selectedLocationPart) return [];
    return parseLocationStockItems(selectedLocationPart.warehouseLocation, selectedLocationPart.quantity);
  }, [selectedLocationPart]);

  // هماهنگی مقادیر هنگام تغییر قطعه انتخابی
  useEffect(() => {
    if (selectedLocationPart) {
      const items = parseLocationStockItems(selectedLocationPart.warehouseLocation, selectedLocationPart.quantity);
      setCustomLocationQuantities(items.map(it => it.quantity));
      setIsEditingLocationQuantities(false);
    }
  }, [selectedLocationPart]);

  const handleSaveLocationQuantities = async () => {
    if (!selectedLocationPart) return;
    setIsSavingQuantities(true);
    try {
      const formatted = locationItems.map((it, idx) => {
        const q = customLocationQuantities[idx] ?? it.quantity;
        return `${it.location} (${formatNumber(q)} عدد)`;
      }).join('، ');

      if (onEditPart) {
        await onEditPart(selectedLocationPart.id, { warehouseLocation: formatted });
      }
      setSelectedLocationPart(prev => prev ? { ...prev, warehouseLocation: formatted } : null);
      setIsEditingLocationQuantities(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingQuantities(false);
    }
  };

  const handleResetAll = () => {
    setStartDate('');
    setEndDate('');
    onResetFilters();
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    try {
      const sanitize = (val: any) => {
        if (val === undefined || val === null) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const fileName = `موجودی_اقلام_انبار_${startDate || 'ابتدا'}_تا_${endDate || 'انتها'}`;

      const headers = [
        'ردیف',
        'نام قطعه / کالا',
        'کد فنی / شناسه',
        'دسته‌بندی',
        'آخرین نرخ خرید (ریال)',
        'آخرین نرخ فروش (ریال)',
        'موجودی فعلی (عدد)',
        'حداقل موجودی (نقطه سفارش)',
        'وضعیت انبار',
        'محل استقرار در قفسه‌ها',
        'تاریخ ثبت'
      ];

      const partsToExport = dateFilteredParts;
      const rows = partsToExport.map((p, idx) => {
        let status = 'عادی';
        if (p.quantity === 0) status = 'ناموجود';
        else if (p.quantity <= (p.minQuantity || 5)) status = 'کسری / سفارش مجدد';

        return [
          idx + 1,
          p.partName,
          p.sku || '-',
          p.category || '-',
          p.buyPrice ?? p.unitPrice ?? 0,
          p.sellPrice ?? Math.round((p.buyPrice ?? p.unitPrice ?? 0) * 1.25),
          p.quantity,
          p.minQuantity || 5,
          status,
          p.location || p.warehouseLocation || '-',
          p.createdAt ? toJalaliDate(p.createdAt) : '-'
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

  const isAnyFilterActive = hasActiveFilters || Boolean(startDate) || Boolean(endDate);

  return (
    <div className="space-y-3">
      {/* ۲. نوار ابزار جستجوی قطعات، فیلترهای تاریخ و خروجی‌های اکسل و چاپ (دقیقاً مشابه بخش حسابداری) */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center relative z-30">
        {/* فیلد جستجو قطعات */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="جستجوی قطعه بر اساس نام، کد فنی یا محل جاگذاری در انبار..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              onPageChange(1);
            }}
            className="w-full h-[34px] bg-white dark:bg-[#111113] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg pr-9 pl-8 py-0 text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                onPageChange(1);
              }}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              title="پاک کردن جستجو"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* فیلتر از تاریخ با تقویم شمسی */}
        <div className="w-full sm:w-36">
          <JalaliDatePicker
            value={startDate}
            onChange={(d) => {
              setStartDate(d);
              onPageChange(1);
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
              onPageChange(1);
            }}
            placeholder="تا تاریخ"
            inputClassName="h-[34px] text-[11px]"
          />
        </div>

        {/* دکمه‌های خروجی اکسل و چاپ (آیکونی، دقیقاً مشابه بخش حسابداری) */}
        <div className="flex items-center gap-1.5 self-center">
          {isAnyFilterActive && (
            <button
              type="button"
              onClick={handleResetAll}
              className="h-[34px] px-2.5 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-300 dark:border-[#2d2d30] rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
              title="حذف فیلترها"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">حذف فیلترها</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportExcel}
            className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-2xs shrink-0 group"
            title="دریافت خروجی اکسل موجودی انبار"
          >
            <FileSpreadsheet className="w-4 h-4 transition-transform group-hover:scale-110" />
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-indigo-500 text-indigo-600 dark:text-indigo-400 transition-all cursor-pointer shadow-2xs shrink-0 group"
            title="چاپ گزارش موجودی انبار"
          >
            <Printer className="w-4 h-4 transition-transform group-hover:scale-110" />
          </button>
        </div>
      </div>

      {/* لیست و جدول انبار */}
      <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
            <Package className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>موجودی اقلام انبار قطعات یدکی با تفکیک آخرین نرخ خرید و فروش</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
              ارزش کل فروش: {formatPrice(totalSellValue)} ریال
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              {toPersianDigits(sortedParts.length)} قلم کالا
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
            <thead className="bg-slate-50 dark:bg-[#161618]">
              <tr className="border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-medium text-xs">
                <th className="py-2 px-3 text-center w-12 text-xs font-medium">ردیف</th>

                <TableColumnHeader
                  title="نام قطعه / کالا"
                  colKey="partName"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                  isFiltered={!!columnFilters['partName']}
                  onOpenFilter={onOpenFilterMenu}
                  align="right"
                />

                <TableColumnHeader
                  title="آخرین نرخ خرید"
                  colKey="buyPrice"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                  isFiltered={!!columnFilters['buyPrice']}
                  onOpenFilter={onOpenFilterMenu}
                  align="center"
                  width="120px"
                />

                <TableColumnHeader
                  title="آخرین نرخ فروش"
                  colKey="sellPrice"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                  isFiltered={!!columnFilters['sellPrice']}
                  onOpenFilter={onOpenFilterMenu}
                  align="center"
                  width="120px"
                />

                <TableColumnHeader
                  title="موجودی"
                  colKey="quantity"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                  isFiltered={!!columnFilters['quantity']}
                  onOpenFilter={onOpenFilterMenu}
                  align="center"
                  width="85px"
                />

                <TableColumnHeader
                  title="ارزش فروش کل"
                  colKey="totalSellPrice"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                  isFiltered={!!columnFilters['totalSellPrice']}
                  onOpenFilter={onOpenFilterMenu}
                  align="center"
                  width="130px"
                />

                <TableColumnHeader
                  title="وضعیت"
                  colKey="status"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                  isFiltered={!!columnFilters['status']}
                  onOpenFilter={onOpenFilterMenu}
                  align="center"
                  width="100px"
                />

                <TableColumnHeader
                  title="محل کالا"
                  colKey="warehouseLocation"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                  isFiltered={!!columnFilters['warehouseLocation']}
                  onOpenFilter={onOpenFilterMenu}
                  align="center"
                  width="70px"
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-[#2d2d30]/60">
              {tablePaginatedParts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500 dark:text-slate-400 text-xs">
                    هیچ کالا یا قطعه‌ای در انبار با این مشخصات یافت نشد.
                  </td>
                </tr>
              ) : (
                tablePaginatedParts.map((p, index) => {
                  const isLowStock = p.quantity <= p.minQuantity && p.quantity > 0;
                  const isCritical = p.quantity === 0;
                  const currentBuyPrice = p.buyPrice ?? p.unitPrice ?? 0;
                  const currentSellPrice = p.sellPrice ?? Math.round(currentBuyPrice * 1.25);
                  const totalPartSellValue = p.quantity * currentSellPrice;
                  const locs = parseLocations(p.warehouseLocation);

                  return (
                    <tr 
                      key={p.id} 
                      onClick={() => onOpenEditForm(p)}
                      className="h-9 hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/60 transition-colors cursor-pointer text-[11px]"
                      title="برای ویرایش مشخصات و قیمت‌های کالا کلیک کنید"
                    >
                      {/* ردیف */}
                      <td className="py-1 px-3 text-center text-slate-500 dark:text-slate-400 text-[11px] align-middle font-mono">
                        {toPersianDigits((currentPage - 1) * pageSize + index + 1)}
                      </td>

                      {/* نام قطعه */}
                      <td className="py-1 px-3 text-slate-800 dark:text-slate-200 text-[11px] align-middle font-medium">
                        <span className="truncate max-w-[260px] block">{p.partName}</span>
                      </td>

                      {/* فی خرید */}
                      <td className="py-1 px-3 text-center text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap align-middle font-mono">
                        {currentBuyPrice ? formatPrice(currentBuyPrice) : '۰'}
                      </td>

                      {/* فی فروش */}
                      <td className="py-1 px-3 text-center text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap align-middle font-mono">
                        {currentSellPrice ? formatPrice(currentSellPrice) : '۰'}
                      </td>

                      {/* موجودی */}
                      <td className="py-1 px-3 text-center text-slate-800 dark:text-slate-200 text-[11px] whitespace-nowrap align-middle font-mono font-medium">
                        {formatNumber(p.quantity)}
                      </td>

                      {/* ارزش فروش کل */}
                      <td className="py-1 px-3 text-center text-slate-800 dark:text-slate-200 text-[11px] whitespace-nowrap align-middle font-mono font-medium">
                        {formatPrice(totalPartSellValue)}
                      </td>

                      {/* وضعیت */}
                      <td className="py-1 px-3 text-center align-middle whitespace-nowrap">
                        {isCritical ? (
                          <span className="px-1.5 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded font-bold text-[10px]">
                            اتمام
                          </span>
                        ) : isLowStock ? (
                          <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded font-bold text-[10px]">
                            کسری
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded font-bold text-[10px]">
                            موجود
                          </span>
                        )}
                      </td>

                      {/* آیکون محل کالا در انتهای جدول */}
                      <td className="py-1 px-2 text-center text-[11px] align-middle whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLocationPart(p);
                          }}
                          title={locs.length > 0 ? `مشاهده مکان استقرار در انبار (${p.warehouseLocation})` : 'مشاهده و تنظیم محل جاگذاری کالا'}
                          className={`inline-flex items-center justify-center w-[22px] h-[22px] rounded transition-all cursor-pointer ${
                            locs.length > 0
                              ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 hover:border-indigo-500/30'
                              : 'bg-slate-100 dark:bg-[#1a1a1d] text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-[#2d2d30] hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700'
                          }`}
                        >
                          <MapPin className="w-3 h-3 shrink-0" />
                        </button>
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
          totalPages={effectiveTotalPages}
          pageSize={pageSize}
          totalItems={effectiveTotalItems}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </div>

      {/* مدال مشاهده جزئیات کامل محل استقرار کالا در انبار - هماهنگ و یکپارچه با مدال جزئیات پذیرش */}
      {selectedLocationPart && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div 
            className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* هدر مدال */}
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <span>تفکیک و موجودی کالا در محل‌های استقرار انبار</span>
                    <span className="text-xs font-mono font-normal text-slate-500 dark:text-slate-400">
                      ({toPersianDigits(locationItems.length)} موقعیت استقرار)
                    </span>
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                    نام کالا: <strong className="text-slate-900 dark:text-white font-bold">{selectedLocationPart.partName}</strong> | موجودی کل: <strong className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">{formatNumber(selectedLocationPart.quantity)} عدد</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedLocationPart(null);
                  setIsEditingLocationQuantities(false);
                }}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* بدنه اسکرول‌خور جزئیات */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* کارت مشخصات کلی کالا - بدون کد فنی و با فوکوس بر موجودی و موقعیت‌ها */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/80 dark:bg-[#161618]/80 p-4 rounded-xl border border-slate-200 dark:border-[#2d2d30]">
                <div>
                  <span className="text-slate-500 text-[11px] block mb-0.5">نام قطعه / کالا:</span>
                  <strong className="text-slate-900 dark:text-white font-extrabold text-sm truncate block" title={selectedLocationPart.partName}>
                    {selectedLocationPart.partName}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block mb-0.5">موجودی کل در انبار:</span>
                  <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400 text-sm block">
                    {formatNumber(selectedLocationPart.quantity)} عدد
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block mb-0.5">تعداد نقاط استقرار کالا:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm block">
                    {locationItems.length > 0 ? `${toPersianDigits(locationItems.length)} مکان` : 'ثبت‌نشده'}
                  </span>
                </div>
              </div>

              {/* جدول قفسه‌ها و نمایش مقدار کالا در هر قسمت */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <span className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 border-r-2 border-indigo-500 pr-2">
                    <Warehouse className="w-3.5 h-3.5 text-indigo-500" />
                    <span>مقدار و موجودی کالا در هر محل استقرار ({toPersianDigits(locationItems.length)} بخش)</span>
                  </span>

                  {locationItems.length > 0 && !isEditingLocationQuantities && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomLocationQuantities(locationItems.map(it => it.quantity));
                        setIsEditingLocationQuantities(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>تخصیص / ویرایش تعداد هر بخش</span>
                    </button>
                  )}
                </div>

                {/* راهنمای حالت ویرایش مقادیر */}
                {isEditingLocationQuantities && (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg flex items-center justify-between text-xs flex-wrap gap-2">
                    <span className="text-amber-800 dark:text-amber-300 font-medium">
                      می‌توانید موجودی موجود در هر قفسه یا انبار را مستقیماً وارد و ذخیره کنید:
                    </span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-xs">
                      مجموع وارد شده: <strong className="text-indigo-600 dark:text-indigo-400 font-extrabold">{formatNumber(customLocationQuantities.reduce((a, b) => a + (Number(b) || 0), 0))}</strong> از <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold">{formatNumber(selectedLocationPart.quantity)}</strong> عدد
                    </span>
                  </div>
                )}

                {locationItems.length === 0 ? (
                  <div className="p-8 text-center rounded-xl border border-dashed border-slate-300 dark:border-[#2e2e33] bg-slate-50/50 dark:bg-[#161618]/50 text-slate-500 dark:text-slate-400 text-xs space-y-1.5">
                    <p className="font-bold text-slate-700 dark:text-slate-300">هیچ محل جاگذاری برای این قطعه ثبت نشده است.</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      می‌توانید با کلیک روی دکمه «ویرایش کامل اطلاعات کالا» یا هنگام ورود کالا، قفسه‌ها و مقادیر را ثبت نمایید.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#2d2d30]">
                    <table className="w-full text-right text-xs text-slate-700 dark:text-slate-300 border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-[#1a1a1c] border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-bold">
                          <th className="py-2.5 px-3 w-12 text-center">#</th>
                          <th className="py-2.5 px-3">عنوان قفسه / انبار / محل استقرار</th>
                          <th className="py-2.5 px-3 text-center w-56">مقدار / تعداد کالا در این محل</th>
                          <th className="py-2.5 px-3 text-left w-36">سهم از کل موجودی</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                        {locationItems.map((item, idx) => {
                          const currentQty = isEditingLocationQuantities
                            ? (customLocationQuantities[idx] ?? item.quantity)
                            : item.quantity;
                          const totalQty = selectedLocationPart.quantity || 1;
                          const percent = Math.round(((Number(currentQty) || 0) / totalQty) * 100);

                          return (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/40 transition-colors">
                              <td className="py-2.5 px-3 text-center font-mono text-slate-400 dark:text-slate-500 font-bold text-[11px]">
                                {toPersianDigits(idx + 1)}
                              </td>
                              <td className="py-2.5 px-3 font-extrabold text-slate-900 dark:text-white">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                                  <span className="text-xs">{item.location}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {isEditingLocationQuantities ? (
                                  <div className="inline-flex items-center gap-1.5 justify-center">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={customLocationQuantities[idx] !== undefined && customLocationQuantities[idx] !== null ? (customLocationQuantities[idx] === 0 ? '۰' : formatNumber(customLocationQuantities[idx])) : ''}
                                      onChange={e => {
                                        const val = parsePersianNumber(e.target.value);
                                        setCustomLocationQuantities(prev => {
                                          const next = [...prev];
                                          next[idx] = val;
                                          return next;
                                        });
                                      }}
                                      placeholder="۰"
                                      className="w-24 h-8 px-2 text-center rounded border border-indigo-300 dark:border-indigo-500/40 bg-white dark:bg-[#1a1a1c] font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                                    />
                                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">عدد</span>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-500/20 shadow-2xs">
                                    <span className="font-mono font-extrabold text-sm">{formatNumber(item.quantity)}</span>
                                    <span className="text-[10.5px]">عدد</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-left">
                                <div className="flex flex-col items-end gap-1">
                                  <span className="font-mono font-bold text-xs text-slate-700 dark:text-slate-300">
                                    {toPersianDigits(percent)}٪
                                  </span>
                                  <div className="w-24 h-1.5 bg-slate-200 dark:bg-[#252528] rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-indigo-600 dark:bg-indigo-400 rounded-full transition-all duration-300"
                                      style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* فوتر دکمه‌های عملیاتی جزئیات */}
            <div className="flex justify-between items-center p-4 border-t border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const p = selectedLocationPart;
                    setSelectedLocationPart(null);
                    setIsEditingLocationQuantities(false);
                    if (p) onOpenEditForm(p);
                  }}
                  className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg border border-indigo-200 dark:border-indigo-500/30 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>ویرایش کامل اطلاعات کالا</span>
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                {isEditingLocationQuantities ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsEditingLocationQuantities(false)}
                      className="px-4 py-2 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg border border-slate-200 dark:border-[#2d2d30] transition-colors cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveLocationQuantities}
                      disabled={isSavingQuantities}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isSavingQuantities ? 'در حال ذخیره...' : 'ذخیره مقادیر هر محل'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLocationPart(null);
                      setIsEditingLocationQuantities(false);
                    }}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    بستن
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* بخش چاپ رسمی موجودی انبار */}
      <div id="printable-inventory-stock" className="hidden print:block text-black bg-white p-6 rounded-2xl w-full dir-rtl font-sans">
        <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-black text-white rounded-xl flex items-center justify-center font-black text-xl">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-black tracking-tight">
                گزارش رسمی موجودی انبار قطعات یدکی و لوازم مصرفی
              </h1>
              <p className="text-xs text-black mt-1">سامانه جامع مدیریت هوشمند ناوگان و انبارداری</p>
            </div>
          </div>
          <div className="text-left font-mono text-xs space-y-1 p-2.5 rounded-xl border border-black min-w-[170px]">
            <div><span className="font-bold">تاریخ چاپ:</span> {toPersianDigits(getCurrentJalaliDate())}</div>
            <div><span className="font-bold">محدوده زمانی:</span> {startDate ? toPersianDigits(startDate) : 'ابتدا'} تا {endDate ? toPersianDigits(endDate) : 'انتها'}</div>
            <div><span className="font-bold">تعداد اقلام:</span> {toPersianDigits(dateFilteredParts.length)} قلم</div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-black mb-4">
          <table className="w-full text-right border-collapse text-xs font-mono font-bold">
            <thead>
              <tr className="border-b border-black font-mono font-bold text-xs bg-slate-100">
                <th className="py-2 px-2 w-10 text-center border-l border-black">#</th>
                <th className="py-2 px-2 border-l border-black">نام قطعه / کالا</th>
                <th className="py-2 px-2 w-20 text-center border-l border-black">کد قطعه</th>
                <th className="py-2 px-2 w-24 text-center border-l border-black">نرخ خرید (ریال)</th>
                <th className="py-2 px-2 w-24 text-center border-l border-black">نرخ فروش (ریال)</th>
                <th className="py-2 px-2 w-16 text-center border-l border-black">موجودی</th>
                <th className="py-2 px-2 w-16 text-center border-l border-black">حد سفارش</th>
                <th className="py-2 px-2 border-l border-black">محل استقرار</th>
                <th className="py-2 px-2 w-20 text-center">تاریخ ثبت</th>
              </tr>
            </thead>
            <tbody>
              {dateFilteredParts.map((p, idx) => (
                <tr key={p.id} className="border-b border-black">
                  <td className="py-1.5 px-2 text-center border-l border-black">{toPersianDigits(idx + 1)}</td>
                  <td className="py-1.5 px-2 border-l border-black">{p.partName}</td>
                  <td className="py-1.5 px-2 text-center border-l border-black">{p.sku ? toPersianDigits(p.sku) : '-'}</td>
                  <td className="py-1.5 px-2 text-center border-l border-black">{formatPrice(p.buyPrice ?? p.unitPrice ?? 0)}</td>
                  <td className="py-1.5 px-2 text-center border-l border-black">{formatPrice(p.sellPrice ?? Math.round((p.buyPrice ?? p.unitPrice ?? 0) * 1.25))}</td>
                  <td className="py-1.5 px-2 text-center border-l border-black">{formatNumber(p.quantity)}</td>
                  <td className="py-1.5 px-2 text-center border-l border-black">{formatNumber(p.minQuantity || 5)}</td>
                  <td className="py-1.5 px-2 border-l border-black">{p.location || p.warehouseLocation || '-'}</td>
                  <td className="py-1.5 px-2 text-center">{p.createdAt ? toJalaliDate(p.createdAt) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
