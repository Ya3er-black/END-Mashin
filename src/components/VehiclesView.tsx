/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Search, Edit2, Trash2, FileText, 
  Check, X, Truck, ChevronDown, History, Clock, ArrowLeftRight,
  ArrowUpDown, ArrowUp, ArrowDown, Filter, List, FileSpreadsheet, Printer, Upload
} from 'lucide-react';
import { Vehicle, VehicleStatus, User as SystemUser, Company, VehicleHistoryEntry, Person, OdometerLog, PeriodicService, VehicleFailure } from '../types';
import { toPersianDigits, toJalaliDate, parsePersianNumber, formatNumber } from '../utils/numberUtils';
import { sortData, SortDirection } from '../utils/sortUtils';
import { Pagination } from './Pagination';
import { CustomSelect } from './CustomSelect';
import { TableColumnHeader, ColumnFilterMenu, FilterMenuState } from './TableFilterSort';
import { returnToOriginView, peekNavigationOrigin, openQuickEntityModal, QuickEntityType } from '../utils/navigation';
import { exportToCsv, printTableReport } from '../utils/exportPrintUtils';
import DefinitionsExcelImportModal from './DefinitionsExcelImportModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { getLatestVehicleKm } from '../utils/serviceMatching';

interface VehiclesViewProps {
  vehicles: Vehicle[];
  vehicleHistory?: VehicleHistoryEntry[];
  companies?: Company[];
  persons?: Person[];
  users?: SystemUser[];
  currentUser?: SystemUser | null;
  odometerLogs?: OdometerLog[];
  services?: PeriodicService[];
  failures?: VehicleFailure[];
  onAddVehicle: (vehicle: Omit<Vehicle, 'id' | 'createdAt'>) => Promise<void>;
  onEditVehicle: (id: number, vehicle: Partial<Vehicle>) => Promise<void>;
  onDeleteVehicle: (id: number) => Promise<void>;
  onBulkImportSuccess?: (summary: any, data: any) => void;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; sublabel?: string }[];
  placeholder?: string;
  emptyOptionLabel?: string;
  className?: string;
  onAddNew?: () => void;
  addNewLabel?: string;
  quickAddType?: QuickEntityType;
}

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'جستجو...',
  emptyOptionLabel = 'انتخاب کنید...',
  className = '',
  onAddNew,
  addNewLabel,
  quickAddType
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; openUpward: boolean } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const openUpward = rect.bottom + 220 > window.innerHeight && rect.top > 220;
      setCoords({
        top: openUpward ? rect.top - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        openUpward
      });
    }
  };

  const handleToggle = () => {
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current && 
        !containerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    const handleScrollOrResize = () => {
      if (isOpen) {
        updatePosition();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen]);

  const selectedOption = options.find(o => o.value === value);
  const selectedLabel = selectedOption ? selectedOption.label : (value && value !== 'ثبت نشده' ? value : emptyOptionLabel);

  const filteredOptions = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    (o.sublabel && o.sublabel.toLowerCase().includes(search.toLowerCase()))
  );

  const handleAdd = () => {
    setIsOpen(false);
    if (onAddNew) {
      onAddNew();
    } else if (quickAddType) {
      openQuickEntityModal(quickAddType, (createdItem) => {
        if (createdItem) {
          if (quickAddType === 'company' && createdItem.name) {
            onChange(createdItem.name);
          } else if (quickAddType === 'driver' && createdItem.fullName) {
            onChange(createdItem.fullName);
          } else if (createdItem.name || createdItem.fullName) {
            onChange(createdItem.name || createdItem.fullName);
          }
        }
      });
    }
  };

  const resolvedAddLabel = addNewLabel || (quickAddType === 'company' ? 'افزودن شرکت جدید...' : quickAddType === 'driver' ? 'افزودن راننده جدید...' : 'افزودن جدید...');

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="h-6 bg-white dark:bg-[#1a1a1c] text-[10px] text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-[#2d2d30] rounded px-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none w-full font-bold flex items-center justify-between gap-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#222225] transition-colors shadow-2xs"
      >
        <span className="truncate leading-none">{selectedLabel}</span>
        <ChevronDown className={`w-2.5 h-2.5 text-slate-500 dark:text-slate-400 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
      </button>

      {isOpen && coords && typeof document !== 'undefined' && createPortal(
        <div 
          ref={menuRef}
          style={{
            position: 'fixed',
            top: coords.openUpward ? undefined : `${coords.top}px`,
            bottom: coords.openUpward ? `${Math.max(4, window.innerHeight - coords.top)}px` : undefined,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            zIndex: 999999
          }}
          className="searchable-select-menu bg-white dark:bg-[#1a1a1c] border border-slate-200 dark:border-[#2d2d30] rounded-lg shadow-2xl overflow-hidden p-1.5 space-y-1.5 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="relative">
            <Search className="w-3 h-3 text-slate-400 dark:text-slate-500 absolute right-2 top-2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              autoFocus
              className="w-full bg-white dark:bg-[#111113] border border-slate-300 dark:border-[#2d2d30] rounded pr-6 pl-2 py-1 text-[10px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
            />
          </div>

          <div className="max-h-40 overflow-y-auto space-y-0.5 pr-1 custom-scrollbar">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
                setSearch('');
              }}
              className={`w-full text-right px-2 py-1 text-[10px] rounded transition-colors flex items-center justify-between ${
                !value || value === 'ثبت نشده' 
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 font-bold' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252528] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{emptyOptionLabel}</span>
              {(!value || value === 'ثبت نشده') && <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />}
            </button>

            {filteredOptions.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full text-right px-2 py-1 text-[10px] rounded transition-colors flex items-center justify-between gap-1.5 ${
                    isSelected 
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 font-bold' 
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252528] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <div className="truncate">
                    <div>{opt.label}</div>
                    {opt.sublabel && opt.sublabel !== 'راننده ناوگان' && opt.sublabel !== 'راننده' && (
                      <div className={`text-[9px] ${isSelected ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-400 dark:text-slate-500'}`}>{opt.sublabel}</div>
                    )}
                  </div>
                  {isSelected && <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {(onAddNew || quickAddType) && (
            <div className="pt-1.5 mt-1 border-t border-slate-200 dark:border-[#2d2d30]">
              <button
                type="button"
                onClick={handleAdd}
                className="w-full flex items-center justify-center gap-1.5 py-1 px-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded transition-colors cursor-pointer border border-dashed border-indigo-200 dark:border-indigo-900/60"
              >
                <Plus className="w-3 h-3" />
                <span>{resolvedAddLabel}</span>
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

function formatTextPlate(plaqueStr: string) {
  if (!plaqueStr || !plaqueStr.trim() || plaqueStr === '-' || plaqueStr === '—') {
    return <span className="text-slate-400 font-normal">ثبت نشده</span>;
  }
  const parts = (plaqueStr || '').trim().split(/\s+/);
  let p1 = parts[0] || '';
  let lettr = parts[1] || '';
  let p2 = parts[2] || '';
  let p3 = parts[parts.length - 1] || '';
  if (parts.length >= 5 && parts[3] === 'ایران') {
    p3 = parts[4] || '';
  }
  return (
    <span dir="ltr" className="inline-block font-mono text-left tracking-wider" style={{ direction: 'ltr' }}>
      {p1 ? toPersianDigits(p1) : ''} {lettr} {p2 ? toPersianDigits(p2) : ''} {p3 ? `| ایران ${toPersianDigits(p3)}` : ''}
    </span>
  );
}

function renderIranianPlate(
  plaqueInput: string | { p1: string; lettr: string; p2: string; p3: string } | undefined | null,
  size: 'sm' | 'md' = 'sm'
) {
  let p1 = '', lettr = '', p2 = '', p3 = '';
  const isObject = typeof plaqueInput === 'object' && plaqueInput !== null;
  if (isObject) {
    p1 = plaqueInput.p1 !== undefined ? plaqueInput.p1 : '';
    lettr = plaqueInput.lettr || '';
    p2 = plaqueInput.p2 !== undefined ? plaqueInput.p2 : '';
    p3 = plaqueInput.p3 !== undefined ? plaqueInput.p3 : '';
  } else {
    const str = typeof plaqueInput === 'string' ? plaqueInput : '';
    const parts = str.trim().split(/\s+/);
    if (parts.length >= 4) {
      p1 = parts[0] || '';
      lettr = parts[1] || '';
      p2 = parts[2] || '';
      p3 = parts[parts.length - 1] || '';
      if (parts.length >= 5 && parts[3] === 'ایران') {
        p3 = parts[4] || '';
      }
    }
  }

  // اگر پلاک متنی است و کاملاً خالی یا خط تیره است
  if (!isObject && (!p1 && !p2 && !p3)) {
    return <span className="text-slate-400 dark:text-slate-500 font-mono text-xs">ثبت نشده</span>;
  }

  const displayP1 = p1 !== '' ? toPersianDigits(p1) : '';
  const displayP2 = p2 !== '' ? toPersianDigits(p2) : '';
  const displayP3 = p3 !== '' ? toPersianDigits(p3) : '';

  const isMd = size === 'md';

  return (
    <div className={`${isMd ? 'w-[165px] min-w-[165px] max-w-[165px] h-8' : 'w-[150px] min-w-[150px] max-w-[150px] h-6'} flex items-center justify-center shrink-0`}>
      <div className={`flex items-center bg-white text-black border border-slate-700 rounded overflow-hidden shadow-xs ${isMd ? 'h-8' : 'h-6'} font-bold select-none w-full`} style={{ direction: 'ltr' }}>
        {/* Blue Banner on Left (Iranian National Plate Flag & IR text) */}
        <div 
          className={`flex flex-col items-center justify-between ${isMd ? 'w-5' : 'w-4.5'} h-full border-r border-slate-700 shrink-0 select-none overflow-hidden`}
          style={{ 
            direction: 'ltr', 
            backgroundColor: '#0033cc',
            color: '#ffffff',
            borderRadius: '3px 0 0 3px',
            borderTopLeftRadius: '3px',
            borderBottomLeftRadius: '3px',
            borderTopRightRadius: '0px',
            borderBottomRightRadius: '0px',
          }}
        >
          {/* Flag of Iran: Green, White, Red sharp stripes spanning full width with larger thickness */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', borderRadius: 0 }}>
            <div style={{ width: '100%', height: isMd ? '3.3px' : '2.6px', backgroundColor: '#009933', borderRadius: 0 }}></div>
            <div style={{ width: '100%', height: isMd ? '3.3px' : '2.6px', backgroundColor: '#ffffff', borderRadius: 0 }}></div>
            <div style={{ width: '100%', height: isMd ? '3.3px' : '2.6px', backgroundColor: '#e50000', borderRadius: 0 }}></div>
          </div>
          <span 
            style={{ 
              color: '#ffffff', 
              fontSize: isMd ? '9px' : '7px', 
              fontWeight: 600, 
              fontFamily: 'sans-serif', 
              lineHeight: 1, 
              letterSpacing: '0.6px',
              paddingBottom: isMd ? '6px' : '4px',
            }}
          >
            IR
          </span>
        </div>

        {/* Main Number Section */}
        <div className={`flex items-center justify-around flex-1 px-1 ${isMd ? 'text-[12px]' : 'text-[11px]'} font-extrabold text-black bg-white font-mono`} style={{ direction: 'ltr' }}>
          <span className={`w-5 text-center ${p1 === '' ? 'text-slate-300' : ''}`}>{displayP1 || '- -'}</span>
          <span className={`text-emerald-800 font-bold px-0.5 font-sans ${isMd ? 'text-[11px]' : 'text-[10px]'} w-4 text-center`}>{lettr || '-'}</span>
          <span className={`w-9 text-center ${p2 === '' ? 'text-slate-300' : ''}`}>{displayP2 || '- - -'}</span>
        </div>

        {/* Vertical Divider */}
        <div className="w-[1px] bg-slate-700 h-full shrink-0"></div>

        {/* Right Iran Region Code Box */}
        <div className={`flex flex-col items-center justify-center bg-white ${isMd ? 'w-7' : 'w-7'} h-full shrink-0`}>
          <span className={`${isMd ? 'text-[6px]' : 'text-[5px]'} text-slate-800 font-extrabold leading-none mb-0.5 font-sans`}>ایران</span>
          <span className={`${isMd ? 'text-[11px]' : 'text-[10px]'} font-mono font-bold leading-none ${p3 === '' ? 'text-slate-300' : 'text-slate-900'}`}>{displayP3 || '- -'}</span>
        </div>
      </div>
    </div>
  );
}

export default function VehiclesView({
  vehicles,
  vehicleHistory = [],
  companies = [],
  persons = [],
  users = [],
  currentUser,
  odometerLogs = [],
  services = [],
  failures = [],
  onAddVehicle,
  onEditVehicle,
  onDeleteVehicle,
  onBulkImportSuccess
}: VehiclesViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<string>('code');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  // گزینه‌های رانندگان برگرفته مستقیم از لیست اشخاص و پرسنل تعریف شده (بدون شماره تماس و بدون زیرنویس طبق درخواست)
  const driverOptions = useMemo(() => {
    return persons.map(p => ({
      value: p.fullName,
      label: p.fullName
    }));
  }, [persons]);

  // فیلترهای سبک اکسل ستون‌ها
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [filterMenu, setFilterMenu] = useState<FilterMenuState | null>(null);

  // کادرهای فرم ایجاد و ویرایش
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null);
  const [deleteConfirmVehicle, setDeleteConfirmVehicle] = useState<Vehicle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // وضعیت فیلدهای فرم خودرو
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [productionYear, setProductionYear] = useState<number>(1402);
  const [currentKm, setCurrentKm] = useState<number>(0);
  const [formCompany, setFormCompany] = useState('');
  const [formDriverName, setFormDriverName] = useState('');
  const [platePart1, setPlatePart1] = useState('');
  const [plateLetter, setPlateLetter] = useState('ب');
  const [platePart2, setPlatePart2] = useState('');
  const [platePart3, setPlatePart3] = useState('');

  // مودال‌های جزئیات و تاریخچه
  const [infoModalVehicle, setInfoModalVehicle] = useState<Vehicle | null>(null);
  const [historyModalVehicle, setHistoryModalVehicle] = useState<Vehicle | null>(null);
  const [showAllHistoryModal, setShowAllHistoryModal] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, columnFilters]);

  const getVehicleColValue = (v: Vehicle, colKey: string): string => {
    if (colKey === 'code') return v.code || '-';
    if (colKey === 'name') return v.name || '-';
    if (colKey === 'plaque') return v.plaque || '-';
    if (colKey === 'currentKm') return v.currentKm ? `${formatNumber(v.currentKm)} کیلومتر` : '۰ کیلومتر';
    if (colKey === 'company') return v.company || 'بدون شرکت';
    if (colKey === 'driverName') return v.driverName || 'بدون راننده';
    if (colKey === 'status') {
      return v.status === 'active' ? 'فعال و آماده به کار' : v.status === 'in_repair' ? 'در حال تعمیرگاه' : 'خراب و متوقف';
    }
    return String((v as any)[colKey] ?? '-');
  };

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

  // مقادیر یکتا و تعداد برای ستون فعال منوی فیلتر
  const currentMenuUniqueValues = useMemo(() => {
    if (!filterMenu) return [];
    const valMap = new Map<string, number>();
    vehicles.forEach(v => {
      const val = getVehicleColValue(v, filterMenu.colKey);
      valMap.set(val, (valMap.get(val) || 0) + 1);
    });
    return Array.from(valMap.entries()).map(([value, count]) => ({ value, count }));
  }, [filterMenu, vehicles]);

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

  // فیلتر کردن هوشمند خودروها
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch = 
        !q ||
        (v.name || '').toLowerCase().includes(q) ||
        (v.code || '').toLowerCase().includes(q) ||
        (v.plaque || '').toLowerCase().includes(q) ||
        (v.driverName || '').toLowerCase().includes(q) ||
        (v.company && v.company.toLowerCase().includes(q)) ||
        String(v.productionYear ?? '').includes(searchTerm.trim()) ||
        String(v.currentKm ?? '').includes(searchTerm.trim());
      
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;

      if (!matchesSearch || !matchesStatus) return false;

      for (const [key, selectedVals] of Object.entries(columnFilters)) {
        if (!selectedVals || !Array.isArray(selectedVals)) continue;
        const val = getVehicleColValue(v, key);
        if (!selectedVals.includes(val)) return false;
      }

      return true;
    });
  }, [vehicles, searchTerm, statusFilter, columnFilters]);

  const sortedVehicles = useMemo(() => {
    return sortData(filteredVehicles, sortKey, sortDirection);
  }, [filteredVehicles, sortKey, sortDirection]);

  const totalPages = Math.ceil(sortedVehicles.length / pageSize) || 1;
  const paginatedVehicles = useMemo(() => {
    return sortedVehicles.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [sortedVehicles, currentPage, pageSize]);

  // خروجی اکسل
  const handleExportExcel = () => {
    const headers = [
      'ردیف',
      'کد خودرو',
      'نام و مدل خودرو',
      'شماره پلاک',
      'راننده منتسب',
      'شرکت منتسب',
      'کارکرد فعلی (کیلومتر)',
      'سال ساخت',
      'وضعیت'
    ];

    const rows = sortedVehicles.map((v, idx) => [
      idx + 1,
      v.code,
      v.name,
      v.plaque,
      v.driverName || '---',
      v.company || '---',
      formatNumber(v.currentKm),
      toPersianDigits(v.productionYear),
      v.status === 'active' ? 'فعال' : v.status === 'in_repair' ? 'در حال تعمیر' : 'خراب و متوقف'
    ]);

    exportToCsv('لیست_خودروهای_ناوگان', headers, rows);
  };

  // چاپ گزارش رسمی
  const handlePrint = () => {
    const headers = [
      'ردیف',
      'کد خودرو',
      'نام خودرو',
      'شماره پلاک',
      'راننده',
      'شرکت',
      'کارکرد (km)',
      'سال ساخت',
      'وضعیت'
    ];

    const rows = sortedVehicles.map((v, idx) => [
      toPersianDigits(idx + 1),
      v.code,
      v.name,
      v.plaque,
      v.driverName || 'بدون راننده',
      v.company || '---',
      toPersianDigits(formatNumber(v.currentKm)),
      toPersianDigits(v.productionYear),
      v.status === 'active' ? 'فعال' : v.status === 'in_repair' ? 'در حال تعمیر' : 'متوقف'
    ]);

    const activeCount = sortedVehicles.filter(v => v.status === 'active').length;
    const inRepairCount = sortedVehicles.filter(v => v.status === 'in_repair').length;
    const brokenCount = sortedVehicles.filter(v => v.status === 'broken').length;

    printTableReport({
      title: 'گزارش مشخصات و وضعیت ناوگان خودروها',
      subtitle: 'مدیریت ناوگان خودرویی یاس - تعاریف پایه خودروها',
      filterInfo: [
        { label: 'تعداد کل خودروهای فهرست', value: `${toPersianDigits(sortedVehicles.length)} دستگاه` },
        { label: 'فیلتر وضعیت', value: statusFilter === 'all' ? 'همه وضعیت‌ها' : statusFilter === 'active' ? 'فعال' : statusFilter === 'in_repair' ? 'در حال تعمیر' : 'خراب' },
        ...(searchTerm ? [{ label: 'عبارت جستجوشده', value: searchTerm }] : [])
      ],
      headers,
      rows,
      columnAligns: ['center', 'center', 'right', 'center', 'right', 'right', 'center', 'center', 'center'],
      summaryItems: [
        { label: 'مجموع دستگاه‌های فعال', value: `${toPersianDigits(activeCount)} دستگاه` },
        { label: 'مجموع در حال تعمیر', value: `${toPersianDigits(inRepairCount)} دستگاه` },
        { label: 'مجموع خراب و متوقف', value: `${toPersianDigits(brokenCount)} دستگاه` },
        { label: 'کل ناوگان ثبت‌شده', value: `${toPersianDigits(sortedVehicles.length)} دستگاه`, isHighlight: true }
      ]
    });
  };

  const handleOpenCreateForm = () => {
    setEditingVehicleId(null);
    setCode(`V-${Math.floor(100 + Math.random() * 900)}`);
    setName('');
    setProductionYear(1402);
    setCurrentKm(0);
    setFormCompany(currentUser?.company || (companies.length > 0 ? companies[0].name : ''));
    setFormDriverName('');
    setPlatePart1('');
    setPlateLetter('ب');
    setPlatePart2('');
    setPlatePart3('');
    setIsFormOpen(true);
  };

  const [isNavigatedFromOrigin, setIsNavigatedFromOrigin] = useState(false);

  useEffect(() => {
    const handleOpenEvent = (e: any) => {
      if (e.detail?.entityType === 'vehicle') {
        setIsNavigatedFromOrigin(Boolean(e.detail?.fromView || peekNavigationOrigin()));
        handleOpenCreateForm();
      }
    };
    window.addEventListener('app:open-create-form', handleOpenEvent);
    return () => window.removeEventListener('app:open-create-form', handleOpenEvent);
  }, [companies, currentUser]);

  const handleCloseOrReturn = () => {
    setIsFormOpen(false);
    if (isNavigatedFromOrigin || peekNavigationOrigin()) {
      setIsNavigatedFromOrigin(false);
      returnToOriginView();
    }
  };

  const handleOpenEditForm = (v: Vehicle) => {
    setIsNavigatedFromOrigin(false);
    setEditingVehicleId(v.id);
    setCode(v.code || '');
    setName(v.name);
    setProductionYear(v.productionYear || 1402);
    const latestKm = getLatestVehicleKm(v, odometerLogs, services, failures);
    setCurrentKm(latestKm > 0 ? latestKm : (v.currentKm || 0));
    setFormCompany(v.company || '');
    setFormDriverName(v.driverName || '');
    
    const parts = (v.plaque || '').trim().split(/\s+/);
    if (parts.length >= 4) {
      setPlatePart1(parts[0] || '');
      setPlateLetter(parts[1] || 'ب');
      setPlatePart2(parts[2] || '');
      setPlatePart3(parts[parts.length - 1] || '');
      if (parts.length >= 5 && parts[3] === 'ایران') {
        setPlatePart3(parts[4] || '');
      }
    } else {
      setPlatePart1('');
      setPlateLetter('ب');
      setPlatePart2('');
      setPlatePart3('');
    }

    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      alert('لطفاً فیلدهای الزامی (کد خودرو و نام خودرو) را وارد کنید.');
      return;
    }

    const hasAnyPlate = platePart1.trim() || platePart2.trim() || platePart3.trim();
    const plaque = hasAnyPlate
      ? `${platePart1.trim()} ${plateLetter} ${platePart2.trim()} ایران ${platePart3.trim()}`.trim()
      : '';

    const matchedPerson = persons.find(p => p.fullName === formDriverName);
    const resolvedPhone = matchedPerson?.phone || (editingVehicleId ? (vehicles.find(v => v.id === editingVehicleId)?.driverPhone || '-') : '-');

    const payload = {
      code: code.trim(),
      name: name.trim(),
      brand: '-',
      model: '-',
      productionYear: Number(productionYear) || 1402,
      currentKm: Number(currentKm) || 0,
      plaque,
      chassisNumber: '-',
      engineNumber: '-',
      vin: '-',
      company: formCompany || (currentUser?.company || '-'),
      project: '-',
      department: 'ترابری',
      location: '-',
      driverName: formDriverName || 'ثبت نشده',
      driverPhone: resolvedPhone,
      color: '-',
      status: 'active' as VehicleStatus,
      qrCode: `${code}_${name}_${plaque}`.replace(/\s+/g, '_')
    };

    try {
      if (editingVehicleId) {
        await onEditVehicle(editingVehicleId, payload);
      } else {
        await onAddVehicle(payload);
      }
      handleCloseOrReturn();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'خطا در ثبت اطلاعات خودرو');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmVehicle) return;
    setIsDeleting(true);
    try {
      await onDeleteVehicle(deleteConfirmVehicle.id);
      setDeleteConfirmVehicle(null);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'خطا در حذف خودرو');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isFormOpen) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-[#111113] rounded-lg w-full border border-slate-200 dark:border-[#2d2d30] flex flex-col overflow-hidden space-y-0">
          
          {/* هدر صفحه فرم */}
          <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
            <div>
              <h3 className="text-slate-900 dark:text-white text-base font-bold flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>{editingVehicleId ? 'ویرایش مشخصات خودرو' : 'ثبت خودروی جدید'}</span>
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">مشخصات اصلی خودرو، پلاک ملی و انتساب راننده و شرکت</p>
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
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs bg-white dark:bg-[#111113]">
            {/* مشخصات پایه */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* کد خودرو */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">کد خودرو <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  placeholder="مثال: V-101" 
                  value={code} 
                  onChange={e => setCode(e.target.value)} 
                  className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* نام کامل خودرو */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">نام خودرو <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  placeholder="مثال: پژو پارس TU5" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* سال ساخت */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-600 dark:text-slate-400 block">سال ساخت (شمسی)</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  value={productionYear ? toPersianDigits(productionYear) : ''} 
                  onChange={e => setProductionYear(parsePersianNumber(e.target.value))} 
                  placeholder="مثال: ۱۴۰۲"
                  className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* کیلومتر کارکرد فعلی */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">کیلومتر کارکرد فعلی (کیلومتر)</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  value={currentKm ? formatNumber(currentKm) : ''} 
                  onChange={e => setCurrentKm(parsePersianNumber(e.target.value))} 
                  placeholder="مثال: ۱۲۰,۰۰۰"
                  className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* شرکت منتسب */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">شرکت منتسب</label>
                  {!currentUser?.company && (
                    <button
                      type="button"
                      onClick={() => {
                        openQuickEntityModal('company', (c) => {
                          if (c?.name) setFormCompany(c.name);
                        });
                      }}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>افزودن شرکت جدید</span>
                    </button>
                  )}
                </div>
                {currentUser?.company ? (
                  <div className="w-full bg-slate-100 dark:bg-[#1a1a1c] text-amber-500 dark:text-amber-400 border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-bold">
                    {currentUser.company} (قفل شده)
                  </div>
                ) : (
                  <CustomSelect
                    value={formCompany}
                    onChange={(val) => setFormCompany(val)}
                    searchable={true}
                    quickAddType="company"
                    placeholder="انتخاب شرکت..."
                    options={[
                      { value: '', label: 'بدون شرکت' },
                      ...companies.map(c => ({ value: c.name, label: c.name }))
                    ]}
                  />
                )}
              </div>

              {/* راننده منتسب */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">راننده منتسب</label>
                  <button
                    type="button"
                    onClick={() => {
                      openQuickEntityModal('driver', (d) => {
                        if (d?.fullName) setFormDriverName(d.fullName);
                      });
                    }}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن راننده جدید</span>
                  </button>
                </div>
                <CustomSelect
                  value={formDriverName}
                  onChange={(val) => setFormDriverName(val)}
                  searchable={true}
                  quickAddType="driver"
                  placeholder="انتخاب راننده از لیست..."
                  options={[
                    { value: '', label: 'بدون راننده' },
                    ...driverOptions
                  ]}
                />
              </div>
            </div>

            {/* بخش شماره پلاک خودرو */}
            <div className="space-y-1.5 pt-1">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">شماره پلاک خودرو <span className="text-rose-500">*</span></label>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-[#1a1a1c] px-3 py-2 rounded-lg border border-slate-300 dark:border-[#2d2d30] min-h-[44px]">
                <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">۲ رقم:</span>
                    <input 
                      type="text" 
                      maxLength={2}
                      placeholder="۱۲" 
                      value={platePart1} 
                      onChange={e => {
                        const raw = e.target.value.replace(/[^\d۰-۹]/g, '').slice(0, 2);
                        setPlatePart1(toPersianDigits(raw));
                      }} 
                      className="w-11 h-8 px-1.5 rounded-md border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#111113] text-slate-900 dark:text-white text-center font-mono font-bold text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 w-28">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">حرف:</span>
                    <div className="flex-1">
                      <CustomSelect
                        value={plateLetter}
                        onChange={(val) => setPlateLetter(val)}
                        searchable={false}
                        matchTriggerWidth={true}
                        size="8"
                        options={['ب', 'الف', 'ج', 'د', 'ر', 'ز', 'س', 'ش', 'ص', 'ط', 'ع', 'ف', 'ق', 'ک', 'ل', 'م', 'ن', 'و', 'ه', 'ی', 'پ', 'ت', 'ژ', 'معلولین', 'تشریفات'].map(l => ({ value: l, label: l }))}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">۳ رقم:</span>
                    <input 
                      type="text" 
                      maxLength={3}
                      placeholder="۳۶۵" 
                      value={platePart2} 
                      onChange={e => {
                        const raw = e.target.value.replace(/[^\d۰-۹]/g, '').slice(0, 3);
                        setPlatePart2(toPersianDigits(raw));
                      }} 
                      className="w-14 h-8 px-1.5 rounded-md border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#111113] text-slate-900 dark:text-white text-center font-mono font-bold text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <span className="text-slate-500 font-bold text-xs shrink-0 px-0.5">ایران</span>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">کد:</span>
                    <input 
                      type="text" 
                      maxLength={2}
                      placeholder="۱۱" 
                      value={platePart3} 
                      onChange={e => {
                        const raw = e.target.value.replace(/[^\d۰-۹]/g, '').slice(0, 2);
                        setPlatePart3(toPersianDigits(raw));
                      }} 
                      className="w-11 h-8 px-1.5 rounded-md border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#111113] text-slate-900 dark:text-white text-center font-mono font-bold text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 border-t sm:border-t-0 sm:border-r border-slate-200 dark:border-[#2d2d30] pt-1.5 sm:pt-0 sm:pr-3">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">پیش‌نمایش:</span>
                  {renderIranianPlate({ p1: platePart1, lettr: plateLetter, p2: platePart2, p3: platePart3 }, 'md')}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-[#2d2d30]">
              {editingVehicleId ? (
                <button
                  type="button"
                  onClick={() => {
                    const currentV = vehicles.find(veh => veh.id === editingVehicleId);
                    if (currentV) {
                      setIsFormOpen(false);
                      setDeleteConfirmVehicle(currentV);
                    }
                  }}
                  className="px-3 py-2 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-bold rounded-md transition-colors border border-rose-200 dark:border-rose-900/50 text-xs cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف این خودرو</span>
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
                  {editingVehicleId ? 'ذخیره تغییرات' : ((isNavigatedFromOrigin || peekNavigationOrigin()) ? 'ثبت خودرو و بازگشت' : 'ثبت خودرو')}
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
      {/* هدر بخش خودروها */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-[#111113] p-4 rounded-lg border border-slate-200 dark:border-[#2d2d30]">
        <div>
          <h1 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            تعریف و مدیریت خودروها
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            مدیریت ناوگان، پلاک، تخصیص شرکت و راننده
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button 
            onClick={() => setShowAllHistoryModal(true)} 
            className="bg-amber-50 dark:bg-[#1a1a1c] hover:bg-amber-100 dark:hover:bg-[#252528] text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 hover:border-amber-300 dark:hover:border-amber-500/40 font-bold px-2.5 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <History className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            سوابق کل انتساب‌ها
          </button>
          <button 
            onClick={handleOpenCreateForm} 
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            ثبت خودروی جدید
          </button>
        </div>
      </div>

      {/* ابزار جستجو، فیلتر، خروجی اکسل و چاپ */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input 
            type="text" 
            placeholder="جستجوی نام خودرو، راننده، کد خودرو یا شرکت..." 
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
          title="بارگذاری فایل اکسل و ورود اطلاعات خودروها"
        >
          <Upload className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>

        {/* دکمه خروجی اکسل */}
        <button
          type="button"
          onClick={handleExportExcel}
          className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-2xs shrink-0 group self-center"
          title="دریافت خروجی اکسل لیست خودروها"
        >
          <FileSpreadsheet className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>

        {/* دکمه چاپ */}
        <button
          type="button"
          onClick={handlePrint}
          className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-indigo-500 text-indigo-600 dark:text-indigo-400 transition-all cursor-pointer shadow-2xs shrink-0 group self-center"
          title="چاپ گزارش رسمی خودروها (نسخه چاپی / PDF)"
        >
          <Printer className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>
      </div>

      {/* جدول یا لیست خودروها (مینیمال و فشرده) */}
      <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex justify-between items-center">
          <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
            <List className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>لیست خودروهای ناوگان</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              {toPersianDigits(filteredVehicles.length)} دستگاه
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] text-slate-600 dark:text-slate-400 font-medium text-xs">
                <th className="py-2 px-3 text-center w-12 text-xs font-medium">ردیف</th>
                
                <TableColumnHeader
                  title="کد خودرو"
                  colKey="code"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['code']}
                  onOpenFilter={handleOpenFilterMenu}
                  width="95px"
                />

                <TableColumnHeader
                  title="نام خودرو"
                  colKey="name"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['name']}
                  onOpenFilter={handleOpenFilterMenu}
                />

                <TableColumnHeader
                  title="پلاک خودرو"
                  colKey="plaque"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['plaque']}
                  onOpenFilter={handleOpenFilterMenu}
                  width="170px"
                />

                <TableColumnHeader
                  title="کارکرد فعلی"
                  colKey="currentKm"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['currentKm']}
                  onOpenFilter={handleOpenFilterMenu}
                  width="125px"
                />

                <TableColumnHeader
                  title="شرکت منتسب"
                  colKey="company"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['company']}
                  onOpenFilter={handleOpenFilterMenu}
                  width="200px"
                />

                <TableColumnHeader
                  title="راننده منتسب"
                  colKey="driverName"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['driverName']}
                  onOpenFilter={handleOpenFilterMenu}
                  width="220px"
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
              {paginatedVehicles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 text-[11px]">
                    هیچ خودرویی یافت نشد.
                  </td>
                </tr>
              ) : (
                paginatedVehicles.map((v, index) => (
                  <tr 
                    key={v.id} 
                    onClick={() => handleOpenEditForm(v)}
                    title="برای ویرایش مشخصات خودرو کلیک کنید"
                    className="group hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/60 transition-colors cursor-pointer select-none text-[11px]"
                  >
                    {/* ردیف */}
                    <td className="py-1.5 px-3 text-center text-slate-500 text-[11px]">
                      {toPersianDigits((currentPage - 1) * pageSize + index + 1)}
                    </td>

                    {/* کد خودرو */}
                    <td className="py-1.5 px-3 text-indigo-600 dark:text-indigo-300 whitespace-nowrap text-[11px]">
                      {v.code}
                    </td>

                    {/* نام خودرو */}
                    <td className="py-1.5 px-3 text-slate-900 dark:text-white text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span>{v.name}</span>
                        {v.brand && v.brand !== '-' && (
                          <span className="text-[10px] text-slate-500 font-normal">({v.brand})</span>
                        )}
                      </div>
                    </td>

                    {/* پلاک خودرو */}
                    <td className="py-1.5 px-3">
                      <div className="flex items-center justify-start">
                        {renderIranianPlate(v.plaque)}
                      </div>
                    </td>

                    {/* کارکرد فعلی */}
                    <td className="py-1.5 px-3 whitespace-nowrap text-[11px]">
                      <span className="text-slate-900 dark:text-white text-[11px]">
                        {v.currentKm ? formatNumber(v.currentKm) : '۰'}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal mr-1">
                        کیلومتر
                      </span>
                    </td>

                    {/* انتخاب شرکت */}
                    <td className="py-1.5 px-2.5 min-w-[200px]" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                      <SearchableSelect
                        value={v.company || ''}
                        placeholder="جستجوی شرکت..."
                        emptyOptionLabel="بدون شرکت"
                        options={companies.map(c => ({ value: c.name, label: c.name }))}
                        quickAddType="company"
                        addNewLabel="افزودن شرکت جدید..."
                        onAddNew={() => {
                          openQuickEntityModal('company', async (newComp) => {
                            if (newComp?.name) {
                              try {
                                await onEditVehicle(v.id, { company: newComp.name });
                              } catch (err) {
                                alert('خطا در ثبت شرکت');
                              }
                            }
                          });
                        }}
                        onChange={async (newCompany) => {
                          try {
                            await onEditVehicle(v.id, { company: newCompany });
                          } catch (err) {
                            alert('خطا در ثبت شرکت');
                          }
                        }}
                      />
                    </td>

                    {/* انتخاب راننده و دکمه‌های عملیات شناور */}
                    <td className="py-1.5 px-2.5 min-w-[220px] relative" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                      <div className="w-full">
                        <SearchableSelect
                          value={v.driverName || ''}
                          placeholder="جستجوی راننده..."
                          emptyOptionLabel="بدون راننده"
                          options={driverOptions}
                          quickAddType="driver"
                          addNewLabel="افزودن راننده جدید..."
                          onAddNew={() => {
                            openQuickEntityModal('driver', async (newDriver) => {
                              if (newDriver?.fullName) {
                                try {
                                  await onEditVehicle(v.id, { 
                                    driverName: newDriver.fullName, 
                                    driverPhone: newDriver.phone || '-' 
                                  });
                                } catch (err) {
                                  alert('خطا در ثبت راننده');
                                }
                              }
                            });
                          }}
                          onChange={async (selectedName) => {
                            const foundPerson = persons.find(p => p.fullName === selectedName);
                            const selectedPhone = foundPerson?.phone || '-';
                            try {
                              await onEditVehicle(v.id, { 
                                driverName: selectedName || 'ثبت نشده', 
                                driverPhone: selectedPhone 
                              });
                            } catch (err) {
                              alert('خطا در ثبت راننده');
                            }
                          }}
                        />
                      </div>

                      {/* طیف هم‌رنگ ردیف هاور - تمام ارتفاع ستون و چسبیده به انتهای سمت چپ ردیف */}
                      <div className="absolute inset-y-0 left-0 pl-2.5 pr-14 flex items-center gap-1 bg-gradient-to-r from-slate-50 via-slate-50 via-70% to-transparent dark:from-[#1a1a1c] dark:via-[#1a1a1c] dark:via-70% dark:to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 z-20 pointer-events-none group-hover:pointer-events-auto">
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHistoryModalVehicle(v);
                          }}
                          title="سوابق تغییرات"
                          className="p-1 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-amber-100 dark:hover:bg-amber-600/20 text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 rounded border border-slate-200 dark:border-[#2d2d30] transition-colors cursor-pointer"
                        >
                          <History className="w-3 h-3" />
                        </button>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmVehicle(v);
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
          totalItems={filteredVehicles.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* مدال جزئیات خودرو */}
      {infoModalVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3">
          <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-lg w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between p-3.5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518]">
              <div className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-extrabold text-slate-900 dark:text-white text-xs">اطلاعات شناسنامه‌ای خودرو</h3>
              </div>
              <button 
                onClick={() => setInfoModalVehicle(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-md hover:bg-slate-200 dark:hover:bg-[#1a1a1c]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-[11px]">
              <div className="grid grid-cols-2 gap-2.5 bg-slate-50 dark:bg-[#1a1a1c] p-3 rounded-md border border-slate-200 dark:border-[#2d2d30]">
                <div>
                  <span className="text-slate-500 block text-[10px] mb-0.5">نام خودرو:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{infoModalVehicle.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] mb-0.5">کد اختصاصی:</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-300">{infoModalVehicle.code}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] mb-0.5">سال ساخت:</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{infoModalVehicle.productionYear || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] mb-0.5">کارکرد فعلی:</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-300">
                    {infoModalVehicle.currentKm ? `${formatNumber(infoModalVehicle.currentKm)} کیلومتر` : '۰ کیلومتر'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 bg-slate-50 dark:bg-[#1a1a1c] p-3 rounded-md border border-slate-200 dark:border-[#2d2d30]">
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-[#2d2d30]/40">
                  <span className="text-slate-500 dark:text-slate-400">شماره پلاک:</span>
                  <span className="text-slate-900 dark:text-white font-bold">{formatTextPlate(infoModalVehicle.plaque)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-[#2d2d30]/40">
                  <span className="text-slate-500 dark:text-slate-400">شرکت منتسب:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-bold">{infoModalVehicle.company && infoModalVehicle.company !== '-' ? infoModalVehicle.company : 'بدون شرکت'}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 dark:text-slate-400">راننده منتسب:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-bold">{infoModalVehicle.driverName && infoModalVehicle.driverName !== 'ثبت نشده' ? infoModalVehicle.driverName : 'بدون راننده'}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end p-3 border-t border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518]">
              <button 
                onClick={() => setInfoModalVehicle(null)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-[11px] font-bold transition-all cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مدال سوابق انتساب یک خودرو */}
      {historyModalVehicle && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 z-50">
          <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-lg w-full max-w-xl overflow-hidden">
            <div className="flex justify-between items-center p-3.5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518]">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-amber-500" />
                <h3 className="font-extrabold text-slate-900 dark:text-white text-xs">سوابق انتساب ({historyModalVehicle.name})</h3>
              </div>
              <button 
                onClick={() => setHistoryModalVehicle(null)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-md hover:bg-slate-200 dark:hover:bg-[#1a1a1c] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-0 max-h-[60vh] overflow-y-auto custom-scrollbar text-[11px]">
              {(() => {
                const vehicleLogs = vehicleHistory.filter(h => h.vehicleId === historyModalVehicle.id);
                if (vehicleLogs.length === 0) {
                  return (
                    <div className="text-center py-8 text-slate-500">
                      <Clock className="w-8 h-8 mx-auto mb-1.5 text-slate-400 dark:text-slate-600" />
                      <p className="font-bold text-slate-500 dark:text-slate-400">هیچ سابقه تغییراتی برای این خودرو ثبت نشده است.</p>
                    </div>
                  );
                }
                return (
                  <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] text-slate-500 font-bold">
                        <th className="py-2 px-3 text-center w-12">ردیف</th>
                        <th className="py-2 px-3">نوع تغییر</th>
                        <th className="py-2 px-3">مقدار قبلی</th>
                        <th className="py-2 px-3">مقدار جدید</th>
                        <th className="py-2 px-3 text-center">تاریخ ثبت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                      {vehicleLogs.map((log, index) => (
                        <tr key={log.id || index} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/40 transition-colors">
                          <td className="py-2 px-3 text-center font-mono text-[10px] text-slate-400">{toPersianDigits(index + 1)}</td>
                          <td className="py-2 px-3 font-bold text-indigo-600 dark:text-indigo-400">
                            {log.fieldLabel || (log.field === 'driverName' ? 'راننده' : log.field === 'company' ? 'شرکت' : 'پلاک')}
                          </td>
                          <td className="py-2 px-3 text-slate-500 line-through">{log.oldValue || 'ثبت نشده'}</td>
                          <td className="py-2 px-3 font-bold text-emerald-600 dark:text-emerald-400">{log.newValue || 'ثبت نشده'}</td>
                          <td className="py-2 px-3 text-center font-mono text-[10px] text-slate-400">{toJalaliDate(log.changeDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>

            <div className="flex justify-end p-3 border-t border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518]">
              <button 
                onClick={() => setHistoryModalVehicle(null)}
                className="px-3.5 py-1.5 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-300 font-bold rounded-md border border-slate-300 dark:border-[#2d2d30] text-[11px] transition-colors cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مدال تاریخچه کل تغییرات ناوگان */}
      {showAllHistoryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 z-50">
          <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-lg w-full max-w-2xl overflow-hidden">
            <div className="flex justify-between items-center p-3.5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518]">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-amber-500" />
                <h3 className="font-extrabold text-slate-900 dark:text-white text-xs">سوابق کل انتساب‌ها و تغییرات ناوگان</h3>
              </div>
              <button 
                onClick={() => setShowAllHistoryModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-md hover:bg-slate-200 dark:hover:bg-[#1a1a1c] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-0 max-h-[65vh] overflow-y-auto custom-scrollbar text-[11px]">
              {vehicleHistory.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Clock className="w-8 h-8 mx-auto mb-1.5 text-slate-400 dark:text-slate-600" />
                  <p className="font-bold text-slate-500 dark:text-slate-400">هیچ سابقه تغییراتی در کل سامانه یافت نشد.</p>
                </div>
              ) : (
                <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] text-slate-500 font-bold">
                      <th className="py-2 px-3 text-center w-12">ردیف</th>
                      <th className="py-2 px-3">خودرو</th>
                      <th className="py-2 px-3">نوع تغییر</th>
                      <th className="py-2 px-3">مقدار قبلی</th>
                      <th className="py-2 px-3">مقدار جدید</th>
                      <th className="py-2 px-3 text-center">تاریخ ثبت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                    {vehicleHistory.map((log, index) => (
                      <tr key={log.id || index} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/40 transition-colors">
                        <td className="py-2 px-3 text-center font-mono text-[10px] text-slate-400">{toPersianDigits(index + 1)}</td>
                        <td className="py-2 px-3 font-bold text-indigo-600 dark:text-indigo-300">
                          {log.vehicleName} <span className="text-[10px] font-mono text-slate-400">({log.vehicleCode})</span>
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">
                          {log.fieldLabel || (log.field === 'driverName' ? 'راننده' : log.field === 'company' ? 'شرکت' : 'پلاک')}
                        </td>
                        <td className="py-2 px-3 text-slate-500 line-through">{log.oldValue || 'ثبت نشده'}</td>
                        <td className="py-2 px-3 font-bold text-emerald-600 dark:text-emerald-400">{log.newValue || 'ثبت نشده'}</td>
                        <td className="py-2 px-3 text-center font-mono text-[10px] text-slate-400">{toJalaliDate(log.changeDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end p-3 border-t border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518]">
              <button 
                onClick={() => setShowAllHistoryModal(false)}
                className="px-3.5 py-1.5 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-300 font-bold rounded-md border border-slate-300 dark:border-[#2d2d30] text-[11px] transition-colors cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* منوی فیلتر ستون سبک اکسل */}
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

      {/* پنجره پاپ‌آپ ورود تعاریف خودرو از اکسل */}
      <DefinitionsExcelImportModal
        isOpen={isImportModalOpen}
        initialType="vehicles"
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={onBulkImportSuccess}
      />

      {/* مدال تایید حذف خودرو */}
      <DeleteConfirmModal
        isOpen={deleteConfirmVehicle !== null}
        title="حذف خودرو از ناوگان"
        subtitle={deleteConfirmVehicle ? `${deleteConfirmVehicle.name} (${deleteConfirmVehicle.plaque})` : ''}
        message={deleteConfirmVehicle ? `آیا از حذف خودرو «${deleteConfirmVehicle.name}» با پلاک «${deleteConfirmVehicle.plaque}» و کد «${deleteConfirmVehicle.code}» به همراه تمام سوابق آن اطمینان دارید؟ این عملیات غیرقابل بازگشت است.` : ''}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          if (!isDeleting) setDeleteConfirmVehicle(null);
        }}
      />
    </div>
  );
}
