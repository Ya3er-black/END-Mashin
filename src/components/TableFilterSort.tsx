import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Filter, Search, X, ArrowUp, ArrowDown, ArrowUpDown, Check } from 'lucide-react';
import { toPersianDigits } from '../utils/numberUtils';
import { SortDirection } from '../utils/sortUtils';

export interface FilterMenuState {
  x: number;
  y: number;
  colKey: string;
  colTitle: string;
}

export interface ColumnFilterMenuProps {
  filterMenu: FilterMenuState | null;
  onClose: () => void;
  uniqueValues: { value: string; count: number }[];
  selectedValues: string[];
  onToggleValue: (value: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSelectOnly: (value: string) => void;
}

export function ColumnFilterMenu({
  filterMenu,
  onClose,
  uniqueValues,
  selectedValues,
  onToggleValue,
  onSelectAll,
  onDeselectAll,
  onSelectOnly
}: ColumnFilterMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setSearch('');
  }, [filterMenu?.colKey]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!filterMenu) return null;

  const filteredItems = uniqueValues.filter(item =>
    item.value.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: `${filterMenu.x}px`,
        top: `${filterMenu.y}px`,
        zIndex: 99999
      }}
      className="w-68 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-[#2d2d30] rounded-xl shadow-2xl p-2.5 text-right font-sans text-xs animate-in zoom-in-95 duration-150 select-none text-slate-800 dark:text-slate-200"
    >
      {/* سربرگ منوی فیلتر ستون */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#2d2d30] mb-2">
        <div className="flex items-center gap-1.5 font-extrabold text-xs text-slate-900 dark:text-white truncate">
          <Filter className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span className="truncate">فیلتر ستون: {filterMenu.colTitle}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-colors cursor-pointer"
          title="بستن"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* کادر جستجو سریع میان مقادیر ستون */}
      <div className="relative mb-2">
        <Search className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جستجو در گزینه‌ها..."
          autoFocus
          className="w-full pl-2 pr-7 py-1 text-[11px] bg-slate-50 dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-lg focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
        />
      </div>

      {/* دکمه‌های انتخاب همه / لغو همه و نمایش وضعیت */}
      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pb-1.5 border-b border-slate-100 dark:border-[#232328]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer"
          >
            انتخاب همه
          </button>
          <span>|</span>
          <button
            type="button"
            onClick={onDeselectAll}
            className="text-slate-500 hover:text-rose-500 font-bold cursor-pointer"
          >
            لغو همه
          </button>
        </div>
        <span className="font-mono text-[9px]">
          {toPersianDigits(selectedValues.length)} از {toPersianDigits(uniqueValues.length)} مورد
        </span>
      </div>

      {/* لیست مقادیر با چک‌باکس و دکمه انتخاب فقط این مورد */}
      <div className="max-h-52 overflow-y-auto space-y-1 py-1.5 my-1 custom-scrollbar">
        {filteredItems.length === 0 ? (
          <div className="text-center py-4 text-slate-400 text-[10px]">
            گزینه‌ای یافت نشد
          </div>
        ) : (
          filteredItems.map((itemVal) => {
            const isChecked = selectedValues.includes(itemVal.value);

            return (
              <div
                key={itemVal.value}
                onClick={() => onToggleValue(itemVal.value)}
                className={`group flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer ${
                  isChecked
                    ? 'bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200'
                    : 'hover:bg-slate-100 dark:hover:bg-[#202024] text-slate-600 dark:text-slate-400 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className={`w-3.5 h-3.5 check-indicator rounded flex items-center justify-center border transition-all shrink-0 ${
                    isChecked ? 'bg-indigo-600 border-indigo-600 shadow-2xs' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1a1a1e]'
                  }`}>
                    {isChecked && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                  </div>
                  <span className="truncate font-medium" title={itemVal.value}>
                    {itemVal.value || '(خالی)'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectOnly(itemVal.value);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-[9px] bg-slate-200 dark:bg-[#2a2a30] hover:bg-indigo-600 hover:text-white px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-bold transition-all cursor-pointer"
                    title="فقط این آیتم را نمایش بده"
                  >
                    فقط این
                  </button>
                  <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-[#111113] text-slate-500 dark:text-slate-400 px-1.5 py-0.2 rounded border border-slate-200 dark:border-[#2d2d30]">
                    {toPersianDigits(itemVal.count)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export interface TableColumnHeaderProps {
  title: string;
  colKey: string;
  sortKey?: string;
  sortDirection?: SortDirection;
  onSort?: (key: string) => void;
  isFiltered?: boolean;
  onOpenFilter?: (e: React.MouseEvent, colKey: string, colTitle: string) => void;
  align?: 'right' | 'center' | 'left';
  className?: string;
  width?: string;
}

export function TableColumnHeader({
  title,
  colKey,
  sortKey,
  sortDirection,
  onSort,
  isFiltered,
  onOpenFilter,
  align = 'right',
  className = '',
  width
}: TableColumnHeaderProps) {
  const isSortable = !!onSort;
  const isFilterable = !!onOpenFilter;
  const isSorted = sortKey === colKey;

  const handleContextMenu = (e: React.MouseEvent) => {
    if (onOpenFilter) {
      e.preventDefault();
      e.stopPropagation();
      onOpenFilter(e, colKey, title);
    }
  };

  const handleClick = () => {
    if (onSort) {
      onSort(colKey);
    }
  };

  const alignClass = align === 'center' ? 'justify-center text-center' : align === 'left' ? 'justify-end text-left' : 'justify-start text-right';
  const thTextClass = align === 'center' ? 'text-center' : align === 'left' ? 'text-left' : 'text-right';

  return (
    <th
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      style={{ width }}
      className={`py-2 px-3 select-none text-xs font-medium transition-colors group whitespace-nowrap ${thTextClass} ${
        className.includes('text-slate') ? '' : 'text-slate-600 dark:text-slate-400'
      } ${
        isSortable ? 'cursor-pointer hover:text-indigo-600 dark:hover:text-white' : ''
      } ${
        isFiltered ? 'bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300' : ''
      } ${className}`}
      title={
        isFilterable && isSortable
          ? 'کلیک چپ: مرتب‌سازی | کلیک راست: فیلتر ستون'
          : isSortable
          ? 'کلیک برای مرتب‌سازی'
          : isFilterable
          ? 'کلیک راست برای فیلتر ستون'
          : undefined
      }
    >
      <div className={`flex items-center gap-1.5 ${alignClass} whitespace-nowrap`}>
        <span className="whitespace-nowrap font-medium text-xs">{title}</span>

        {/* نشانگر مرتب‌سازی */}
        {isSortable && (
          <span className="shrink-0">
            {isSorted ? (
              sortDirection === 'asc' ? (
                <ArrowUp className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
              ) : (
                <ArrowDown className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
              )
            ) : (
              <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500 opacity-40 group-hover:opacity-100" />
            )}
          </span>
        )}

        {/* دکمه / نشانگر فیلتر فعال یا قابل کلیک */}
        {isFilterable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenFilter(e, colKey, title);
            }}
            className={`p-0.5 rounded transition-all cursor-pointer ${
              isFiltered
                ? 'text-indigo-600 dark:text-indigo-400 opacity-100 hover:scale-110'
                : 'text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-80 hover:!opacity-100 hover:text-indigo-500'
            }`}
            title="فیلتر ستون"
          >
            <Filter className={`w-2.5 h-2.5 ${isFiltered ? 'fill-indigo-600/30' : ''}`} />
          </button>
        )}
      </div>
    </th>
  );
}

/**
 * هوک یکپارچه برای مدیریت کامل مرتب‌سازی و فیلترهای سبک اکسل
 */
export function useTableFilterSort<T extends Record<string, any>>({
  items,
  initialSortKey = 'id',
  initialSortDirection = 'desc',
  initialPageSize = 10,
  getValue
}: {
  items: T[];
  initialSortKey?: string;
  initialSortDirection?: SortDirection;
  initialPageSize?: number;
  getValue?: (item: T, key: string) => string;
}) {
  const [sortKey, setSortKey] = useState<string>(initialSortKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialSortDirection);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [filterMenu, setFilterMenu] = useState<FilterMenuState | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // استخراج مقدار فیلد
  const extractValue = (item: T, key: string): string => {
    if (getValue) {
      const customVal = getValue(item, key);
      if (customVal !== undefined && customVal !== null) return String(customVal);
    }
    const val = item[key];
    if (val === undefined || val === null || val === '') return '-';
    if (typeof val === 'boolean') return val ? 'بله' : 'خیر';
    return String(val);
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const openFilterMenu = (e: React.MouseEvent, colKey: string, colTitle: string) => {
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

  const closeFilterMenu = () => {
    setFilterMenu(null);
  };

  // ریست شماره صفحه هنگام تغییر فیلترها
  useEffect(() => {
    setCurrentPage(1);
  }, [columnFilters, sortKey, sortDirection]);

  // فیلتر کردن اقلام بر اساس فیلترهای فعال ستون‌ها
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      for (const [key, selectedVals] of Object.entries(columnFilters)) {
        if (!selectedVals || !Array.isArray(selectedVals)) continue;
        const val = extractValue(item, key);
        if (!selectedVals.includes(val)) {
          return false;
        }
      }
      return true;
    });
  }, [items, columnFilters]);

  // مرتب‌سازی اقلام
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];

      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      // مقایسه عددی
      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }

      // مقایسه متنی فارسی/انگلیسی
      const strA = String(valA);
      const strB = String(valB);
      return sortDirection === 'asc'
        ? strA.localeCompare(strB, 'fa', { numeric: true })
        : strB.localeCompare(strA, 'fa', { numeric: true });
    });
  }, [filteredItems, sortKey, sortDirection]);

  // صفحه‌بندی
  const totalPages = Math.ceil(sortedItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    return sortedItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [sortedItems, currentPage, pageSize]);

  // استخراج مقادیر یکتای ستون انتخاب‌شده در منوی فیلتر
  const currentMenuUniqueValues = useMemo(() => {
    if (!filterMenu) return [];
    
    // استخراج بر اساس اقلام پایه
    const valMap = new Map<string, number>();
    items.forEach(item => {
      const val = extractValue(item, filterMenu.colKey);
      valMap.set(val, (valMap.get(val) || 0) + 1);
    });

    return Array.from(valMap.entries()).map(([value, count]) => ({
      value,
      count
    }));
  }, [filterMenu, items]);

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

  const handleSelectAll = () => {
    if (!filterMenu) return;
    const next = { ...columnFilters };
    delete next[filterMenu.colKey];
    setColumnFilters(next);
  };

  const handleDeselectAll = () => {
    if (!filterMenu) return;
    setColumnFilters({ ...columnFilters, [filterMenu.colKey]: [] });
  };

  const handleSelectOnly = (val: string) => {
    if (!filterMenu) return;
    setColumnFilters({ ...columnFilters, [filterMenu.colKey]: [val] });
  };

  const resetAllFilters = () => {
    setColumnFilters({});
    setFilterMenu(null);
  };

  return {
    sortKey,
    setSortKey,
    sortDirection,
    setSortDirection,
    handleSort,
    columnFilters,
    setColumnFilters,
    filterMenu,
    openFilterMenu,
    closeFilterMenu,
    filteredItems,
    sortedItems,
    paginatedItems,
    totalPages,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    currentMenuUniqueValues,
    currentSelectedValues,
    handleToggleColumnValue,
    handleSelectAll,
    handleDeselectAll,
    handleSelectOnly,
    resetAllFilters
  };
}
