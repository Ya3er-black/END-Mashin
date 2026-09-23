/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, Search, ShieldCheck, Shield, Calendar, DollarSign, 
  FileText, X, AlertTriangle, AlertCircle, CheckCircle, Eye,
  ArrowUpDown, ArrowUp, ArrowDown, CheckSquare, FileSpreadsheet, List,
  Printer, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Vehicle, Insurance, TechnicalInspection, InsuranceType } from '../types';
import { toJalaliDate, getCurrentJalaliDate, jalaliDayDifference } from '../utils/date';
import { JalaliDatePicker } from './JalaliDatePicker';
import { toPersianDigits, formatPrice, formatNumber, parsePersianNumber, numberToPersianWords } from '../utils/numberUtils';
import { sortData, SortDirection } from '../utils/sortUtils';
import { Pagination } from './Pagination';
import { CustomSelect } from './CustomSelect';
import { TableColumnHeader, ColumnFilterMenu, FilterMenuState } from './TableFilterSort';
import { getVehicleDisplayName, matchesVehicleSearch } from '../utils/vehicleUtils';

/**
 * نرمال‌سازی متن فارسی برای یکسان‌سازی حروف (ی/ي، ک/ك و نیم‌فاصله‌ها)
 */
function normalizePersianText(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/[\u200C\u200B\uFEFF]/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * تابع تطبیق پیشوندی: بررسی می‌کند که آیا متن موردنظر با حروف وارد شده شروع می‌شود یا خیر.
 */
function startsWithPrefix(text: string | undefined | null, prefix: string): boolean {
  if (!prefix) return true;
  if (!text) return false;
  const p = normalizePersianText(prefix);
  if (!p) return true;
  const t = normalizePersianText(text);

  if (t.startsWith(p)) return true;

  const words = t.split(/[\s\-_\/()\[\]،,]+/);
  return words.some(w => w.startsWith(p));
}

/**
 * نرمال‌سازی رشته تاریخ شمسی برای مقایسه رشته‌ای
 */
function normalizeToComparableJalali(dateStr?: string | null): string {
  if (!dateStr) return '';
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length < 3) return dateStr;
  const y = parts[0].padStart(4, '0');
  const m = parts[1].padStart(2, '0');
  const d = parts[2].padStart(2, '0');
  return `${y}/${m}/${d}`;
}

interface InsuranceViewProps {
  vehicles: Vehicle[];
  insurances: Insurance[];
  inspections: TechnicalInspection[];
  onAddInsurance: (insurance: Omit<Insurance, 'id' | 'createdAt'>) => Promise<void>;
  onAddInspection: (inspection: Omit<TechnicalInspection, 'id' | 'createdAt'>) => Promise<void>;
}

export default function InsuranceView({
  vehicles,
  insurances,
  inspections,
  onAddInsurance,
  onAddInspection
}: InsuranceViewProps) {
  const [activeTab, setActiveTab] = useState<'insurance' | 'inspection'>('insurance');
  const [searchTerm, setSearchTerm] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<string>('endDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // فیلترهای بازه تاریخی
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // کنترل جستجوی هوشمند خودرو مشابه بخش سرویس دوره‌ای
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const activeVehicle = useMemo(() => {
    if (!vehicleFilter || vehicleFilter === 'all') return null;
    return vehicles.find(v => v.id.toString() === vehicleFilter) || null;
  }, [vehicles, vehicleFilter]);

  const handleSelectVehicle = (v: Vehicle) => {
    setVehicleFilter(v.id.toString());
    setSearchTerm('');
    setIsSearchOpen(false);
  };

  const matchedVehicles = useMemo(() => {
    if (!searchTerm.trim()) return vehicles;
    return vehicles.filter(v => matchesVehicleSearch(v, searchTerm));
  }, [vehicles, searchTerm]);

  const [isInsuranceFormOpen, setIsInsuranceFormOpen] = useState(false);
  const [isInspectionFormOpen, setIsInspectionFormOpen] = useState(false);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // فیلدهای فرم بیمه
  const [insVehicleId, setInsVehicleId] = useState('');
  const [insuranceType, setInsuranceType] = useState<InsuranceType>('third_party');
  const [policyNumber, setPolicyNumber] = useState('');
  const [startDate, setStartDate] = useState(() => getCurrentJalaliDate());
  const [endDate, setEndDate] = useState('');
  const [insuranceCompany, setInsuranceCompany] = useState('بیمه ایران');
  const [insCost, setInsCost] = useState<number>(0);

  // فیلدهای فرم معاینه فنی
  const [inspVehicleId, setInspVehicleId] = useState('');
  const [inspectionDate, setInspectionDate] = useState(() => getCurrentJalaliDate());
  const [expiryDate, setExpiryDate] = useState('');
  const [inspectionCenter, setInspectionCenter] = useState('');
  const [trackingCode, setTrackingCode] = useState('');

  // لیست شرکت‌های بیمه‌گر با پشتیبانی از localStorage و قابلیت افزودن
  const [insuranceCompanies, setInsuranceCompanies] = useState<string[]>(() => {
    const defaults = [
      'بیمه ایران', 'بیمه آسیا', 'بیمه البرز', 'بیمه دانا', 'بیمه پارسیان',
      'بیمه پاسارگاد', 'بیمه معلم', 'بیمه سامان', 'بیمه کارآفرین', 'بیمه رازی',
      'بیمه سینا', 'بیمه دی', 'بیمه نوین', 'بیمه کوثر', 'بیمه ما', 'بیمه سرمد',
      'بیمه ملت', 'بیمه حکمت صبا'
    ];
    try {
      const saved = localStorage.getItem('fleet_insurance_companies');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return defaults;
  });

  // لیست ثابت انواع استاندارد بیمه‌نامه
  const insuranceTypesList = [
    { value: 'third_party', label: 'بیمه شخص ثالث (اجباری)' },
    { value: 'collision', label: 'بیمه بدنه (اختیاری)' }
  ];

  // استیت‌های مودال افزودن شرکت بیمه جدید
  const [isAddCompanyModalOpen, setIsAddCompanyModalOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [companyErrorMsg, setCompanyErrorMsg] = useState('');

  const handleAddInsuranceCompany = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newCompanyName.trim();
    if (!trimmed) return;
    if (insuranceCompanies.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      setCompanyErrorMsg('این شرکت بیمه‌گر قبلاً در لیست ثبت شده است.');
      return;
    }
    const updated = [...insuranceCompanies, trimmed];
    setInsuranceCompanies(updated);
    try {
      localStorage.setItem('fleet_insurance_companies', JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }
    setInsuranceCompany(trimmed);
    setNewCompanyName('');
    setCompanyErrorMsg('');
    setIsAddCompanyModalOpen(false);
  };

  const handleOpenInsuranceForm = () => {
    setInsVehicleId(vehicles[0]?.id.toString() || '');
    setInsuranceType('third_party');
    setPolicyNumber(`PL-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(100000 + Math.random() * 900000)}`);
    const curr = getCurrentJalaliDate();
    setStartDate(curr);
    const parts = curr.split('/');
    if (parts.length === 3) {
      setEndDate(`${Number(parts[0]) + 1}/${parts[1]}/${parts[2]}`);
    } else {
      setEndDate('1406/04/29');
    }
    setInsuranceCompany('بیمه ایران');
    setInsCost(6500000);
    setIsInsuranceFormOpen(true);
  };

  const handleOpenInspectionForm = () => {
    setInspVehicleId(vehicles[0]?.id.toString() || '');
    const curr = getCurrentJalaliDate();
    setInspectionDate(curr);
    const parts = curr.split('/');
    if (parts.length === 3) {
      setExpiryDate(`${Number(parts[0]) + 1}/${parts[1]}/${parts[2]}`);
    } else {
      setExpiryDate('1406/04/29');
    }
    setInspectionCenter('مرکز معاینه فنی بیهقی تهران');
    setTrackingCode(`TRK-${Math.floor(10000000 + Math.random() * 90000000)}`);
    setIsInspectionFormOpen(true);
  };

  const handleInsuranceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!insVehicleId || !policyNumber || !startDate || !endDate || !insCost) {
      alert('لطفاً فیلدهای الزامی را پر کنید.');
      return;
    }
    try {
      await onAddInsurance({
        vehicleId: Number(insVehicleId),
        insuranceType,
        policyNumber,
        startDate,
        endDate,
        insuranceCompany,
        cost: Number(insCost)
      });
      setIsInsuranceFormOpen(false);
    } catch (err) {
      console.error(err);
      alert('خطا در ثبت بیمه‌نامه');
    }
  };

  const handleInspectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspVehicleId || !inspectionDate || !expiryDate || !inspectionCenter || !trackingCode) {
      alert('لطفاً فیلدهای الزامی را پر کنید.');
      return;
    }
    try {
      await onAddInspection({
        vehicleId: Number(inspVehicleId),
        inspectionDate,
        expiryDate,
        inspectionCenter,
        trackingCode
      });
      setIsInspectionFormOpen(false);
    } catch (err) {
      console.error(err);
      alert('خطا در ثبت معاینه فنی');
    }
  };

  // فیلترهای سبک اکسل ستون‌ها
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [filterMenu, setFilterMenu] = useState<FilterMenuState | null>(null);

  const getInsuranceColValue = (ins: Insurance, colKey: string): string => {
    const v = vehicles.find(veh => String(veh.id) === String(ins.vehicleId) || Number(veh.id) === Number(ins.vehicleId));
    if (colKey === 'vehicleName') return v ? `${v.name} ${v.code ? `(${v.code})` : ''}` : '—';
    if (colKey === 'insuranceType') return ins.insuranceType === 'third_party' ? 'شخص ثالث' : ins.insuranceType === 'collision' ? 'بیمه بدنه' : ins.insuranceType;
    if (colKey === 'insuranceCompany') return ins.insuranceCompany;
    if (colKey === 'policyNumber') return ins.policyNumber;
    if (colKey === 'endDate') return ins.endDate;
    if (colKey === 'cost') return formatPrice(ins.cost);
    return String((ins as any)[colKey] ?? '—');
  };

  const getInspectionColValue = (insp: TechnicalInspection, colKey: string): string => {
    const v = vehicles.find(veh => String(veh.id) === String(insp.vehicleId) || Number(veh.id) === Number(insp.vehicleId));
    if (colKey === 'vehicleName') return v ? `${v.name} ${v.code ? `(${v.code})` : ''}` : '—';
    if (colKey === 'inspectionCenter') return insp.inspectionCenter;
    if (colKey === 'trackingCode') return insp.trackingCode;
    if (colKey === 'inspectionDate') return insp.inspectionDate;
    if (colKey === 'expiryDate') return insp.expiryDate;
    return String((insp as any)[colKey] ?? '—');
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
  const currentMenuUniqueValues = React.useMemo(() => {
    if (!filterMenu) return [];
    const valMap = new Map<string, number>();
    if (activeTab === 'insurance') {
      insurances.forEach(ins => {
        const val = getInsuranceColValue(ins, filterMenu.colKey);
        valMap.set(val, (valMap.get(val) || 0) + 1);
      });
    } else {
      inspections.forEach(insp => {
        const val = getInspectionColValue(insp, filterMenu.colKey);
        valMap.set(val, (valMap.get(val) || 0) + 1);
      });
    }
    return Array.from(valMap.entries()).map(([value, count]) => ({ value, count }));
  }, [filterMenu, insurances, inspections, activeTab, vehicles]);

  const currentSelectedValues = React.useMemo(() => {
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

  // فیلتر کردن بیمه‌ها
  const filteredInsurances = insurances.filter(ins => {
    const v = vehicles.find(veh => veh.id === ins.vehicleId);
    const matchesVehicle = vehicleFilter === 'all' || ins.vehicleId === Number(vehicleFilter);
    if (!matchesVehicle) return false;

    if (searchTerm.trim() && vehicleFilter === 'all') {
      const cleanSearch = normalizePersianText(searchTerm);
      const vName = v ? normalizePersianText(`${v.name} ${v.code} ${v.plaque}`) : '';
      const insNum = normalizePersianText(ins.policyNumber);
      const insComp = normalizePersianText(ins.insuranceCompany);
      const matchesSearch = vName.includes(cleanSearch) || insNum.includes(cleanSearch) || insComp.includes(cleanSearch);
      if (!matchesSearch) return false;
    }

    const startComp = normalizeToComparableJalali(filterStartDate);
    const endComp = normalizeToComparableJalali(filterEndDate);
    const insStartComp = normalizeToComparableJalali(ins.startDate);
    const insEndComp = normalizeToComparableJalali(ins.endDate);

    if (startComp && insEndComp && insEndComp < startComp) return false;
    if (endComp && insStartComp && insStartComp > endComp) return false;

    if (activeTab === 'insurance') {
      for (const [key, selectedVals] of Object.entries(columnFilters)) {
        if (!selectedVals || !Array.isArray(selectedVals)) continue;
        const val = getInsuranceColValue(ins, key);
        if (!selectedVals.includes(val)) return false;
      }
    }

    return true;
  });

  // فیلتر کردن معاینه‌ها
  const filteredInspections = inspections.filter(insp => {
    const v = vehicles.find(veh => veh.id === insp.vehicleId);
    const matchesVehicle = vehicleFilter === 'all' || insp.vehicleId === Number(vehicleFilter);
    if (!matchesVehicle) return false;

    if (searchTerm.trim() && vehicleFilter === 'all') {
      const cleanSearch = normalizePersianText(searchTerm);
      const vName = v ? normalizePersianText(`${v.name} ${v.code} ${v.plaque}`) : '';
      const center = normalizePersianText(insp.inspectionCenter);
      const track = normalizePersianText(insp.trackingCode);
      const matchesSearch = vName.includes(cleanSearch) || center.includes(cleanSearch) || track.includes(cleanSearch);
      if (!matchesSearch) return false;
    }

    const startComp = normalizeToComparableJalali(filterStartDate);
    const endComp = normalizeToComparableJalali(filterEndDate);
    const inspDateComp = normalizeToComparableJalali(insp.inspectionDate);
    const inspExpiryComp = normalizeToComparableJalali(insp.expiryDate);

    if (startComp && inspExpiryComp && inspExpiryComp < startComp) return false;
    if (endComp && inspDateComp && inspDateComp > endComp) return false;

    if (activeTab === 'inspection') {
      for (const [key, selectedVals] of Object.entries(columnFilters)) {
        if (!selectedVals || !Array.isArray(selectedVals)) continue;
        const val = getInspectionColValue(insp, key);
        if (!selectedVals.includes(val)) return false;
      }
    }

    return true;
  });

  // دریافت خروجی اکسل در قالب فایل CSV استاندارد سازگار با اکسل (با رمزگذاری UTF-8 BOM)
  const handleExportExcel = () => {
    try {
      const sanitize = (val: any) => {
        if (val === undefined || val === null) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const vehName = activeVehicle ? `_${activeVehicle.name.replace(/\s+/g, '_')}` : '';

      if (activeTab === 'insurance') {
        const headers = [
          'ردیف',
          'نام خودرو',
          'کد خودرو',
          'پلاک خودرو',
          'نوع بیمه‌نامه',
          'شرکت بیمه‌گر',
          'شماره بیمه‌نامه',
          'تاریخ شروع',
          'تاریخ پایان',
          'روزهای باقی‌مانده / وضعیت',
          'هزینه (ریال)'
        ];

        const today = getCurrentJalaliDate();
        const rows = filteredInsurances.map((ins, index) => {
          const v = vehicles.find(veh => veh.id === ins.vehicleId);
          const diff = jalaliDayDifference(today, ins.endDate);
          const statusText = diff < 0 ? `منقضی شده (${Math.abs(diff)} روز قبل)` : diff <= 30 ? `${diff} روز مانده` : 'معتبر';

          return [
            index + 1,
            v ? v.name : 'نامشخص',
            v ? v.code : '-',
            v ? v.plaque : '-',
            ins.insuranceType === 'third_party' ? 'شخص ثالث (اجباری)' : ins.insuranceType === 'collision' ? 'بیمه بدنه (اختیاری)' : ins.insuranceType,
            ins.insuranceCompany,
            ins.policyNumber,
            ins.startDate,
            ins.endDate,
            statusText,
            ins.cost
          ].map(sanitize).join(',');
        });

        const fileName = (filterStartDate || filterEndDate)
          ? `گزارش_بیمه_نامه_ها${vehName}_از_${filterStartDate || 'ابتدا'}_تا_${filterEndDate || 'انتها'}`
          : `گزارش_جامع_بیمه_نامه_ها${vehName}`;

        const csvContent = '\uFEFF' + [headers.map(sanitize).join(','), ...rows].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${fileName}_${today.replace(/\//g, '-')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const headers = [
          'ردیف',
          'نام خودرو',
          'کد خودرو',
          'پلاک خودرو',
          'مرکز معاینه فنی',
          'کد رهگیری',
          'تاریخ صدور',
          'تاریخ انقضا',
          'وضعیت اعتبار'
        ];

        const today = getCurrentJalaliDate();
        const rows = filteredInspections.map((insp, index) => {
          const v = vehicles.find(veh => veh.id === insp.vehicleId);
          const diff = jalaliDayDifference(today, insp.expiryDate);
          const statusText = diff < 0 ? 'فاقد معاینه معتبر' : diff <= 30 ? `${diff} روز تا تمدید` : 'معتبر';

          return [
            index + 1,
            v ? v.name : 'نامشخص',
            v ? v.code : '-',
            v ? v.plaque : '-',
            insp.inspectionCenter,
            insp.trackingCode,
            insp.inspectionDate,
            insp.expiryDate,
            statusText
          ].map(sanitize).join(',');
        });

        const fileName = (filterStartDate || filterEndDate)
          ? `گزارش_معاینه_فنی${vehName}_از_${filterStartDate || 'ابتدا'}_تا_${filterEndDate || 'انتها'}`
          : `گزارش_جامع_معاینه_فنی${vehName}`;

        const csvContent = '\uFEFF' + [headers.map(sanitize).join(','), ...rows].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${fileName}_${today.replace(/\//g, '-')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Error exporting CSV:', e);
    }
  };

  // چاپ گزارش رسمی بیمه‌نامه و معاینه فنی با قالب استاندارد A4 افقی
  const handlePrint = () => {
    const today = getCurrentJalaliDate();
    const docNum = Math.floor(100000 + Math.random() * 900000);
    const veh = activeVehicle;
    const dateRangeStr = (filterStartDate || filterEndDate) 
      ? `از تاریخ: ${toPersianDigits(filterStartDate || 'ابتدا')} تا ${toPersianDigits(filterEndDate || 'انتها')}`
      : 'کل سوابق ثبت‌شده';

    let tableHtml = '';
    let reportTitle = '';
    let reportSubtitle = '';
    let summaryBox = '';

    if (activeTab === 'insurance') {
      reportTitle = 'گزارش جامع وضعیت بیمه‌نامه‌های ناوگان خودرویی';
      reportSubtitle = 'مدیریت ناوگان خودرویی یاس - پایش و مدیریت بیمه و معاینه فنی';
      const totalCost = filteredInsurances.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);

      tableHtml = `
        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">ردیف</th>
              <th>نام خودرو</th>
              <th style="width: 70px; text-align: center;">کد</th>
              <th style="width: 100px; text-align: center;">پلاک</th>
              <th>نوع بیمه</th>
              <th>شرکت بیمه‌گر</th>
              <th>شماره بیمه‌نامه</th>
              <th style="width: 85px; text-align: center;">تاریخ شروع</th>
              <th style="width: 85px; text-align: center;">تاریخ پایان</th>
              <th style="width: 110px; text-align: center;">وضعیت اعتبار</th>
              <th style="width: 110px; text-align: left;">مبلغ حق‌بیمه (ریال)</th>
            </tr>
          </thead>
          <tbody>
            ${filteredInsurances.map((ins, idx) => {
              const v = vehicles.find(veh => veh.id === ins.vehicleId);
              const diff = jalaliDayDifference(today, ins.endDate);
              const statusText = diff < 0 ? `منقضی (${Math.abs(diff)} روز قبل)` : diff <= 30 ? `${diff} روز مانده` : 'معتبر';
              const statusColor = diff < 0 ? '#dc2626' : diff <= 30 ? '#d97706' : '#16a34a';
              return `
                <tr>
                  <td style="text-align: center;">${toPersianDigits(idx + 1)}</td>
                  <td><strong>${v?.name || '---'}</strong></td>
                  <td style="text-align: center; font-family: monospace;">${toPersianDigits(v?.code || '---')}</td>
                  <td style="text-align: center; font-family: monospace;">${toPersianDigits(v?.plaque || '---')}</td>
                  <td>${ins.insuranceType === 'third_party' ? 'شخص ثالث (اجباری)' : ins.insuranceType === 'collision' ? 'بیمه بدنه (اختیاری)' : ins.insuranceType}</td>
                  <td>${ins.insuranceCompany}</td>
                  <td style="font-family: monospace;">${toPersianDigits(ins.policyNumber)}</td>
                  <td style="text-align: center; font-family: monospace;">${toPersianDigits(toJalaliDate(ins.startDate))}</td>
                  <td style="text-align: center; font-family: monospace;">${toPersianDigits(toJalaliDate(ins.endDate))}</td>
                  <td style="text-align: center; color: ${statusColor}; font-weight: bold;">${toPersianDigits(statusText)}</td>
                  <td style="text-align: left; font-family: monospace; font-weight: bold;">${formatPrice(ins.cost)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;

      summaryBox = `
        <div class="total-box">
          <div class="total-row">
            <span>تعداد کل بیمه‌نامه‌های مندرج در گزارش:</span>
            <span style="font-family: monospace; font-weight: bold;">${toPersianDigits(filteredInsurances.length)} فقره</span>
          </div>
          <div class="total-final">
            <span>مجموع هزینه حق‌بیمه پرداخت‌شده:</span>
            <span style="font-family: monospace; font-size: 14px;">${formatPrice(totalCost)} ریال</span>
          </div>
        </div>
      `;
    } else {
      reportTitle = 'گزارش وضعیت گواهی‌های معاینه فنی ناوگان خودرویی';
      reportSubtitle = 'مدیریت ناوگان خودرویی یاس - پایش و مدیریت بیمه و معاینه فنی';

      tableHtml = `
        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">ردیف</th>
              <th>نام خودرو</th>
              <th style="width: 70px; text-align: center;">کد</th>
              <th style="width: 100px; text-align: center;">پلاک</th>
              <th>مرکز معاینه فنی صادرکننده</th>
              <th>کد رهگیری / مرجع</th>
              <th style="width: 90px; text-align: center;">تاریخ صدور</th>
              <th style="width: 90px; text-align: center;">تاریخ انقضا</th>
              <th style="width: 120px; text-align: center;">وضعیت اعتبار</th>
            </tr>
          </thead>
          <tbody>
            ${filteredInspections.map((insp, idx) => {
              const v = vehicles.find(veh => veh.id === insp.vehicleId);
              const diff = jalaliDayDifference(today, insp.expiryDate);
              const statusText = diff < 0 ? 'فاقد معاینه معتبر' : diff <= 30 ? `${diff} روز تا تمدید` : 'معاینه فنی معتبر';
              const statusColor = diff < 0 ? '#dc2626' : diff <= 30 ? '#d97706' : '#16a34a';
              return `
                <tr>
                  <td style="text-align: center;">${toPersianDigits(idx + 1)}</td>
                  <td><strong>${v?.name || '---'}</strong></td>
                  <td style="text-align: center; font-family: monospace;">${toPersianDigits(v?.code || '---')}</td>
                  <td style="text-align: center; font-family: monospace;">${toPersianDigits(v?.plaque || '---')}</td>
                  <td>${insp.inspectionCenter}</td>
                  <td style="font-family: monospace;">${toPersianDigits(insp.trackingCode)}</td>
                  <td style="text-align: center; font-family: monospace;">${toPersianDigits(toJalaliDate(insp.inspectionDate))}</td>
                  <td style="text-align: center; font-family: monospace;">${toPersianDigits(toJalaliDate(insp.expiryDate))}</td>
                  <td style="text-align: center; color: ${statusColor}; font-weight: bold;">${toPersianDigits(statusText)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;

      summaryBox = `
        <div class="total-box">
          <div class="total-final">
            <span>تعداد کل سوابق معاینه فنی مندرج:</span>
            <span style="font-family: monospace; font-size: 14px;">${toPersianDigits(filteredInspections.length)} فقره</span>
          </div>
        </div>
      `;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fa" dir="rtl">
        <head>
          <meta charset="utf-8">
          <title>${reportTitle}</title>
          <style>
            @page { size: A4 landscape; margin: 10mm 12mm; }
            * { box-sizing: border-box; font-family: "IRANYekanX", "Yekan Bakh", "Vazirmatn", Tahoma, sans-serif; }
            body { background: #fff; color: #111; margin: 0; padding: 15px; font-size: 11px; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 12px; }
            .title { font-size: 15px; font-weight: 900; margin: 0 0 4px 0; }
            .subtitle { font-size: 10px; color: #444; margin: 0; }
            .meta-box { border: 1px solid #333; border-radius: 6px; padding: 6px 12px; font-size: 10.5px; min-width: 180px; line-height: 1.8; }
            .filter-info { display: flex; gap: 16px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 12px; margin-bottom: 12px; font-size: 10.5px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 12px; border: 1px solid #333; }
            th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: right; font-size: 10.5px; }
            th { background: #f1f5f9; font-weight: bold; color: #0f172a; }
            .total-box { display: flex; flex-direction: column; gap: 4px; border: 1.5px solid #000; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; background: #fafafa; }
            .total-row { display: flex; justify-content: space-between; align-items: center; font-size: 11px; }
            .total-final { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #000; padding-top: 6px; margin-top: 4px; font-weight: bold; font-size: 12.5px; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 24px; }
            .sign-card { border: 1px solid #666; border-radius: 6px; padding: 10px; text-align: center; height: 80px; display: flex; flex-direction: column; justify-content: space-between; font-size: 10.5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">${reportTitle}</h1>
              <p class="subtitle">${reportSubtitle}</p>
            </div>
            <div class="meta-box">
              <div><strong>تاریخ تهیه گزارش:</strong> ${toPersianDigits(today)}</div>
              <div><strong>شماره پیگیری:</strong> #${toPersianDigits(docNum)}</div>
              <div><strong>وضعیت:</strong> رسمی و معتبر</div>
            </div>
          </div>

          <div class="filter-info">
            <div><span>فیلتر خودرو: </span><span>${veh ? `${veh.name} (${veh.code} - ${veh.plaque})` : 'تمامی خودروهای ناوگان'}</span></div>
            <div><span>بازه زمانی فیلتر: </span><span>${dateRangeStr}</span></div>
          </div>

          ${tableHtml}
          ${summaryBox}

          <div class="signatures">
            <div class="sign-card">
              <span style="font-weight: bold;">کارشناس بیمه و معاینه فنی</span>
              <span style="border-bottom: 1px dashed #666; width: 80%; margin: 0 auto;"></span>
            </div>
            <div class="sign-card">
              <span style="font-weight: bold;">مسئول امور اداری و مالی</span>
              <span style="border-bottom: 1px dashed #666; width: 80%; margin: 0 auto;"></span>
            </div>
            <div class="sign-card">
              <span style="font-weight: bold;">مدیریت ترابری و لجستیک</span>
              <span style="border-bottom: 1px dashed #666; width: 80%; margin: 0 auto;"></span>
            </div>
          </div>
        </body>
      </html>
    `;

    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(htmlContent);
      frameDoc.close();
      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } catch (e) {
          window.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(printFrame)) {
              document.body.removeChild(printFrame);
            }
          }, 1000);
        }
      }, 300);
    }
  };

  const sortedInsurances = sortData(filteredInsurances, sortKey, sortDirection, {
    vehicleName: (ins) => {
      const v = vehicles.find(veh => veh.id === ins.vehicleId);
      return v ? v.name : '';
    }
  });

  const sortedInspections = sortData(filteredInspections, sortKey, sortDirection, {
    vehicleName: (insp) => {
      const v = vehicles.find(veh => veh.id === insp.vehicleId);
      return v ? v.name : '';
    }
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, vehicleFilter, activeTab, filterStartDate, filterEndDate]);

  const totalPagesIns = Math.ceil(sortedInsurances.length / pageSize) || 1;
  const paginatedInsurances = sortedInsurances.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalPagesInsp = Math.ceil(sortedInspections.length / pageSize) || 1;
  const paginatedInspections = sortedInspections.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (isInsuranceFormOpen) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-[#111113] rounded-lg w-full border border-slate-200 dark:border-[#2d2d30] flex flex-col overflow-hidden space-y-0">
          
          {/* هدر صفحه فرم */}
          <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>ثبت بیمه‌نامه جدید</span>
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">ثبت بیمه شخص ثالث یا بدنه، شماره بیمه‌نامه، تاریخ اعتبار و هزینه</p>
            </div>
            <button 
              type="button"
              onClick={() => setIsInsuranceFormOpen(false)}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors border border-transparent hover:border-slate-300 dark:hover:border-[#2d2d30] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* بدنه فرم */}
          <form onSubmit={handleInsuranceSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs bg-white dark:bg-[#111113]">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">انتخاب خودرو <span className="text-rose-500">*</span></label>
              <CustomSelect
                value={insVehicleId}
                onChange={(val) => setInsVehicleId(val)}
                placeholder="انتخاب کنید..."
                searchable={true}
                quickAddType="vehicle"
                options={vehicles.map(v => ({ value: v.id, label: getVehicleDisplayName(v) }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  نوع بیمه <span className="text-rose-500">*</span>
                </label>
                <CustomSelect
                  value={insuranceType}
                  onChange={(val) => setInsuranceType(val as InsuranceType)}
                  options={insuranceTypesList}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  شرکت بیمه‌گر <span className="text-slate-400 font-normal text-[10px]">(بیمه)</span>
                </label>
                <CustomSelect
                  value={insuranceCompany}
                  onChange={(val) => setInsuranceCompany(val)}
                  searchable={true}
                  options={insuranceCompanies.map(company => ({ value: company, label: company }))}
                  onAddNew={() => setIsAddCompanyModalOpen(true)}
                  addNewLabel="افزودن شرکت بیمه جدید..."
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">شماره بیمه‌نامه / بیمه نامه دیجیتال <span className="text-rose-500">*</span></label>
              <input 
                type="text" 
                value={policyNumber} 
                onChange={e => setPolicyNumber(e.target.value)} 
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <JalaliDatePicker
                  value={startDate}
                  onChange={setStartDate}
                  label="تاریخ شروع بیمه (شمسی)"
                  required
                />
              </div>

              <div className="space-y-1">
                <JalaliDatePicker
                  value={endDate}
                  onChange={setEndDate}
                  label="تاریخ پایان بیمه (شمسی)"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  هزینه کل پرداخت شده (ریال) <span className="text-rose-500">*</span>
                </label>
                {insCost > 0 && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    {numberToPersianWords(insCost)} ریال
                  </span>
                )}
              </div>
              <input 
                type="text" 
                inputMode="numeric"
                value={insCost > 0 ? formatPrice(insCost) : ''} 
                placeholder="۰"
                onChange={e => {
                  const val = parsePersianNumber(e.target.value);
                  setInsCost(val);
                }} 
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-emerald-600 dark:text-emerald-400 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold text-left tracking-wide"
                dir="ltr"
                required
              />
            </div>

            {/* فوتر */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-[#2d2d30]">
              <button 
                type="button" 
                onClick={() => setIsInsuranceFormOpen(false)}
                className="px-3 py-2 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-400 font-bold rounded-md transition-colors border border-slate-200 dark:border-[#2d2d30] text-xs cursor-pointer"
              >
                انصراف
              </button>
              <button 
                type="submit" 
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md transition-colors active:scale-95 text-xs cursor-pointer"
              >
                ثبت بیمه و فاکتور
              </button>
            </div>
          </form>

          {/* مودال ثبت و تعریف شرکت بیمه‌گر جدید (کاملاً هماهنگ با ساختار و استایل سایر مودال‌ها) */}
          {isAddCompanyModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 overflow-y-auto" dir="rtl">
              <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-auto">
                {/* هدر مدال */}
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white dark:bg-[#202024] rounded-lg border border-slate-200 dark:border-[#303035] shadow-xs">
                      <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-slate-900 dark:text-white text-sm font-bold">
                        ثبت و تعریف شرکت بیمه‌گر جدید
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        افزودن شرکت یا نمایندگی بیمه به لیست گزینه‌ها
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCompanyName('');
                      setCompanyErrorMsg('');
                      setIsAddCompanyModalOpen(false);
                    }}
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* بدنه فرم */}
                <form onSubmit={handleAddInsuranceCompany} className="p-4 sm:p-5 space-y-4 text-xs bg-white dark:bg-[#111113]">
                  {companyErrorMsg && (
                    <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-700 dark:text-rose-300 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{companyErrorMsg}</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300 block">
                      نام شرکت بیمه‌گر <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: بیمه سامان، بیمه رازی، بیمه کوثر، بیمه سرمد..."
                      value={newCompanyName}
                      onChange={(e) => {
                        setNewCompanyName(e.target.value);
                        if (companyErrorMsg) setCompanyErrorMsg('');
                      }}
                      className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      autoFocus
                      required
                    />
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      این نام به لیست شرکت‌های بیمه‌گر اضافه شده و بلافاصله برای این بیمه‌نامه انتخاب می‌شود.
                    </p>
                  </div>

                  {/* دکمه‌های ثبت و انصراف */}
                  <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-[#2d2d30]">
                    <button
                      type="button"
                      onClick={() => {
                        setNewCompanyName('');
                        setCompanyErrorMsg('');
                        setIsAddCompanyModalOpen(false);
                      }}
                      className="px-3.5 py-2 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-400 font-bold rounded-md transition-colors border border-slate-200 dark:border-[#2d2d30] text-xs cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      type="submit"
                      disabled={!newCompanyName.trim()}
                      className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md transition-colors active:scale-95 text-xs cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      <span>ثبت و ذخیره</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isInspectionFormOpen) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-[#111113] rounded-lg w-full border border-slate-200 dark:border-[#2d2d30] flex flex-col overflow-hidden space-y-0">
          
          {/* هدر صفحه فرم */}
          <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>ثبت معاینه فنی جدید</span>
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">ثبت مشخصات مرکز معاینه فنی، کد رهگیری و تاریخ اعتبار برچسب معاینه فنی</p>
            </div>
            <button 
              type="button"
              onClick={() => setIsInspectionFormOpen(false)}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors border border-transparent hover:border-slate-300 dark:hover:border-[#2d2d30] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* بدنه فرم */}
          <form onSubmit={handleInspectionSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs bg-white dark:bg-[#111113]">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">انتخاب خودرو <span className="text-rose-500">*</span></label>
              <CustomSelect
                value={inspVehicleId}
                onChange={(val) => setInspVehicleId(val)}
                placeholder="انتخاب کنید..."
                searchable={true}
                quickAddType="vehicle"
                options={vehicles.map(v => ({ value: v.id, label: getVehicleDisplayName(v) }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">مرکز صدور معاینه فنی <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  placeholder="مثال: مرکز معاینه فنی بیهقی"
                  value={inspectionCenter} 
                  onChange={e => setInspectionCenter(e.target.value)} 
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">کد رهگیری گواهی معاینه فنی <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  value={trackingCode} 
                  onChange={e => setTrackingCode(e.target.value)} 
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <JalaliDatePicker
                  value={inspectionDate}
                  onChange={setInspectionDate}
                  label="تاریخ معاینه فنی (شمسی)"
                  required
                />
              </div>

              <div className="space-y-1">
                <JalaliDatePicker
                  value={expiryDate}
                  onChange={setExpiryDate}
                  label="تاریخ انقضای گواهی (شمسی)"
                  required
                />
              </div>
            </div>

            {/* فوتر */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-[#2d2d30]">
              <button 
                type="button" 
                onClick={() => setIsInspectionFormOpen(false)}
                className="px-3 py-2 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-400 font-bold rounded-md transition-colors border border-slate-200 dark:border-[#2d2d30] text-xs cursor-pointer"
              >
                انصراف
              </button>
              <button 
                type="submit" 
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md transition-colors active:scale-95 text-xs cursor-pointer"
              >
                ثبت معاینه فنی
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* هدر بخش بیمه و معاینه فنی ناوگان */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-[#111113] p-4 rounded-lg border border-slate-200 dark:border-[#2d2d30]">
        <div>
          <h1 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            بیمه‌نامه‌ها و معاینه فنی خودروها
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            پایش و مدیریت سررسید بیمه‌نامه‌های شخص ثالث، بدنه و برچسب‌های معاینه فنی ناوگان
          </p>
        </div>
        <button 
          type="button"
          onClick={activeTab === 'insurance' ? handleOpenInsuranceForm : handleOpenInspectionForm} 
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{activeTab === 'insurance' ? 'ثبت بیمه‌نامه جدید' : 'ثبت معاینه فنی جدید'}</span>
        </button>
      </div>

      {/* تب‌های جابجایی بین بخش‌ها با ترنزیشن نرم و متحرک (مشابه سرویس‌های دوره‌ای) */}
      <div className="flex border-b border-slate-200 dark:border-[#2d2d30] gap-2 overflow-x-auto relative">
        <button
          type="button"
          onClick={() => { setActiveTab('insurance'); }}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'insurance'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>مدیریت بیمه‌نامه‌ها</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 font-mono font-bold">
            {toPersianDigits(insurances.length)}
          </span>
          {activeTab === 'insurance' && (
            <motion.div
              layoutId="activeInsuranceTabIndicator"
              className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('inspection'); }}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'inspection'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>مدیریت معاینه فنی</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 font-mono font-bold">
            {toPersianDigits(inspections.length)}
          </span>
          {activeTab === 'inspection' && (
            <motion.div
              layoutId="activeInsuranceTabIndicator"
              className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>
      </div>

      {/* ابزار جستجو (نام خودرو مشابه بخش حسابداری و سرویس‌های دوره‌ای)، فیلترهای تاریخ، خروجی اکسل و چاپ */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center relative z-30">
        
        {/* فیلد تکی جستجو و انتخاب خودرو بر اساس نام خودرو */}
        <div ref={searchContainerRef} className="relative flex-1">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input 
              type="text" 
              placeholder={activeVehicle ? `خودروی انتخاب‌شده: ${activeVehicle.name}` : (activeTab === 'insurance' ? "جستجو و انتخاب خودرو یا تایپ شماره بیمه / شرکت بیمه..." : "جستجو و انتخاب خودرو یا تایپ مرکز / کد رهگیری...")} 
              value={activeVehicle && !searchTerm ? activeVehicle.name : searchTerm}
              onFocus={() => {
                setIsSearchOpen(true);
              }}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (activeVehicle) {
                  setVehicleFilter('all');
                }
                setIsSearchOpen(true);
              }}
              className={`w-full h-[34px] bg-white dark:bg-[#111113] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg pr-9 pl-8 text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs ${
                activeVehicle ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20' : 'border-slate-300 dark:border-[#2d2d30]'
              }`}
            />
            {(searchTerm || activeVehicle) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setVehicleFilter('all');
                  setIsSearchOpen(false);
                }}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="پاک کردن انتخاب"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* لیست پیشنهادات جستجوی نام خودروها */}
          {isSearchOpen && (
            <div className="absolute top-full right-0 left-0 mt-1.5 bg-white dark:bg-[#151518] rounded-xl border border-slate-200 dark:border-[#2d2d30] shadow-2xl overflow-hidden max-h-72 overflow-y-auto z-50 animate-in fade-in zoom-in-95 duration-150">
              
              <div className="px-3 py-1.5 bg-slate-50 dark:bg-[#1a1a1e] border-b border-slate-200 dark:border-[#2d2d30] flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                <span>{searchTerm.trim() ? `خودروهای منطبق با «${searchTerm}»` : 'لیست خودروها (جهت انتخاب کلیک کنید)'}</span>
                <span>{toPersianDigits(matchedVehicles.length)} خودرو</span>
              </div>

              {matchedVehicles.length === 0 ? (
                <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-xs font-bold space-y-1">
                  <p>هیچ خودرویی با نام «{searchTerm}» یافت نشد.</p>
                  <p className="text-[10px] text-slate-400 font-normal">لطفاً املای نام خودرو را بررسی کنید یا حروف دیگری را وارد نمایید.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-[#242428]">
                  {matchedVehicles.map(v => {
                    const isSelected = vehicleFilter === v.id.toString();

                    return (
                      <div
                        key={v.id}
                        onClick={() => handleSelectVehicle(v)}
                        className={`px-3 py-1.5 transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected 
                            ? 'bg-indigo-50 dark:bg-indigo-950/40' 
                            : 'hover:bg-slate-50 dark:hover:bg-[#1c1c20]'
                        }`}
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {v.name}
                          </span>
                          <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-mono font-bold">
                            کد: {toPersianDigits(v.code)}
                          </span>
                        </div>

                        <div className="shrink-0 text-left">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#1a1a1e] px-2 py-0.5 rounded border border-slate-200 dark:border-[#2d2d30]">
                            {v.driverName ? `راننده: ${v.driverName}` : 'بدون راننده'}
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

        {/* فیلتر از تاریخ */}
        <div className="w-full sm:w-36">
          <JalaliDatePicker
            value={filterStartDate}
            onChange={setFilterStartDate}
            placeholder="از تاریخ"
            inputClassName="h-[34px] text-[11px] rounded-lg px-2.5 pr-2.5 pl-7"
          />
        </div>

        {/* فیلتر تا تاریخ */}
        <div className="w-full sm:w-36">
          <JalaliDatePicker
            value={filterEndDate}
            onChange={setFilterEndDate}
            placeholder="تا تاریخ"
            inputClassName="h-[34px] text-[11px] rounded-lg px-2.5 pr-2.5 pl-7"
          />
        </div>

        {/* دکمه خروجی اکسل */}
        <button
          type="button"
          onClick={handleExportExcel}
          className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-2xs shrink-0 group self-center"
          title={filterStartDate || filterEndDate ? `دریافت خروجی اکسل در بازه تاریخی (${filterStartDate || 'ابتدا'} تا ${filterEndDate || 'انتها'})` : 'دریافت خروجی اکسل کل اطلاعات'}
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

      {/* محتوای تب با ترنزیشن نرم و آرام */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: "easeInOut" }}
          className="space-y-3"
        >
          {activeTab === 'insurance' ? (
            <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] shadow-2xs overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex justify-between items-center">
                <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
                  <List className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>لیست بیمه‌نامه‌های ثبت‌شده ناوگان</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                    {toPersianDigits(sortedInsurances.length)} بیمه‌نامه
                  </span>
                </div>
              </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#161618] border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-medium text-xs">
                  <th className="py-2 px-3 text-center w-12 text-xs font-medium">ردیف</th>
                  
                  <TableColumnHeader
                    title="کد / خودرو"
                    colKey="vehicleName"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    isFiltered={!!columnFilters['vehicleName']}
                    onOpenFilter={handleOpenFilterMenu}
                    className="font-medium text-xs text-slate-600 dark:text-slate-400"
                  />

                  <TableColumnHeader
                    title="نوع بیمه‌نامه"
                    colKey="insuranceType"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    isFiltered={!!columnFilters['insuranceType']}
                    onOpenFilter={handleOpenFilterMenu}
                    className="font-medium text-xs text-slate-600 dark:text-slate-400"
                    width="140px"
                  />

                  <TableColumnHeader
                    title="شرکت بیمه‌گر"
                    colKey="insuranceCompany"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    isFiltered={!!columnFilters['insuranceCompany']}
                    onOpenFilter={handleOpenFilterMenu}
                    className="font-medium text-xs text-slate-600 dark:text-slate-400"
                    width="140px"
                  />

                  <TableColumnHeader
                    title="شماره بیمه‌نامه"
                    colKey="policyNumber"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    isFiltered={!!columnFilters['policyNumber']}
                    onOpenFilter={handleOpenFilterMenu}
                    className="font-medium text-xs text-slate-600 dark:text-slate-400"
                  />

                  <TableColumnHeader
                    title="بازه پوشش (شروع / پایان)"
                    colKey="endDate"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    isFiltered={!!columnFilters['endDate']}
                    onOpenFilter={handleOpenFilterMenu}
                    className="font-medium text-xs text-slate-600 dark:text-slate-400"
                  />

                  <th className="py-2 px-3 text-xs font-medium">روزهای باقی‌مانده</th>

                  <TableColumnHeader
                    title="هزینه کل"
                    colKey="cost"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    isFiltered={!!columnFilters['cost']}
                    onOpenFilter={handleOpenFilterMenu}
                    className="font-medium text-xs text-slate-600 dark:text-slate-400"
                    width="120px"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-[#2d2d30]/60">
                {paginatedInsurances.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-500 text-[11px]">
                      هیچ بیمه‌نامه‌ای یافت نشد.
                    </td>
                  </tr>
                ) : (
                  paginatedInsurances.map((ins, index) => {
                    const v = vehicles.find(veh => String(veh.id) === String(ins.vehicleId) || Number(veh.id) === Number(ins.vehicleId));
                    const today = getCurrentJalaliDate();
                    const diffDays = jalaliDayDifference(today, ins.endDate);
                    const isExpired = diffDays < 0;

                    return (
                      <tr key={ins.id} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/40 transition-colors text-[11px]">
                        <td className="py-1.5 px-3 text-center text-slate-500 dark:text-slate-400 text-[11px]">
                          {toPersianDigits((currentPage - 1) * pageSize + index + 1)}
                        </td>
                        <td className="py-1.5 px-3">
                          <div className="font-medium text-slate-900 dark:text-white">{v ? `${v.name} - پلاک [${toPersianDigits(v.plaque)}]` : '—'}</div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 inline-block">{v ? v.code : '—'}</span>
                        </td>
                        <td className="py-1.5 px-3">
                          {ins.insuranceType === 'third_party' ? (
                            <span className="text-indigo-600 dark:text-indigo-400 font-medium">شخص ثالث (اجباری)</span>
                          ) : ins.insuranceType === 'collision' ? (
                            <span className="text-teal-600 dark:text-teal-400 font-medium">بیمه بدنه (اختیاری)</span>
                          ) : (
                            <span className="text-purple-600 dark:text-purple-400 font-medium">{ins.insuranceType}</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300">{ins.insuranceCompany}</td>
                        <td className="py-1.5 px-3 text-slate-600 dark:text-slate-400">{toPersianDigits(ins.policyNumber)}</td>
                        <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">
                          {toJalaliDate(ins.startDate)} تا {toJalaliDate(ins.endDate)}
                        </td>
                        <td className="py-1.5 px-3">
                          {isExpired ? (
                            <span className="px-2 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded text-[10px]">
                              منقضی شده! ({formatNumber(Math.abs(diffDays))} روز قبل)
                            </span>
                          ) : diffDays <= 30 ? (
                            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded text-[10px]">
                              رو به اتمام ({formatNumber(diffDays)} روز مانده)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded text-[10px]">
                              معتبر ({formatNumber(diffDays)} روز مانده)
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-slate-800 dark:text-slate-200">
                          {formatPrice(ins.cost)} <span className="text-[10px] text-slate-500">ریال</span>
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
            totalPages={totalPagesIns}
            pageSize={pageSize}
            totalItems={sortedInsurances.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] shadow-2xs overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex justify-between items-center">
            <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
              <List className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>لیست گواهی‌های معاینه فنی خودروها</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                {toPersianDigits(sortedInspections.length)} گواهی ثبت‌شده
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#161618] border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-medium text-xs">
                  <th className="py-2 px-3 text-center w-12 text-xs font-medium">ردیف</th>
                  
                  <TableColumnHeader
                    title="کد / خودرو"
                    colKey="vehicleName"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    isFiltered={!!columnFilters['vehicleName']}
                    onOpenFilter={handleOpenFilterMenu}
                    className="font-medium text-xs text-slate-600 dark:text-slate-400"
                  />

                  <TableColumnHeader
                    title="مرکز معاینه فنی انجام‌شده"
                    colKey="inspectionCenter"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    isFiltered={!!columnFilters['inspectionCenter']}
                    onOpenFilter={handleOpenFilterMenu}
                    className="font-medium text-xs text-slate-600 dark:text-slate-400"
                  />

                  <TableColumnHeader
                    title="کد رهگیری / مرجع"
                    colKey="trackingCode"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    isFiltered={!!columnFilters['trackingCode']}
                    onOpenFilter={handleOpenFilterMenu}
                    className="font-medium text-xs text-slate-600 dark:text-slate-400"
                  />

                  <TableColumnHeader
                    title="تاریخ انجام"
                    colKey="inspectionDate"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    isFiltered={!!columnFilters['inspectionDate']}
                    onOpenFilter={handleOpenFilterMenu}
                    className="font-medium text-xs text-slate-600 dark:text-slate-400"
                    width="120px"
                  />

                  <TableColumnHeader
                    title="تاریخ انقضا"
                    colKey="expiryDate"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    isFiltered={!!columnFilters['expiryDate']}
                    onOpenFilter={handleOpenFilterMenu}
                    className="font-medium text-xs text-slate-600 dark:text-slate-400"
                    width="120px"
                  />

                  <th className="py-2 px-3 text-xs font-medium">وضعیت اعتبار نهایی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-[#2d2d30]/60">
                {paginatedInspections.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500 text-[11px]">
                      هیچ برچسب معاینه فنی یافت نشد.
                    </td>
                  </tr>
                ) : (
                  paginatedInspections.map((insp, index) => {
                    const v = vehicles.find(veh => String(veh.id) === String(insp.vehicleId) || Number(veh.id) === Number(insp.vehicleId));
                    const today = getCurrentJalaliDate();
                    const diffDays = jalaliDayDifference(today, insp.expiryDate);
                    const isExpired = diffDays < 0;

                    return (
                      <tr key={insp.id} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/40 transition-colors text-[11px]">
                        <td className="py-1.5 px-3 text-center text-slate-500 dark:text-slate-400 text-[11px]">
                          {toPersianDigits((currentPage - 1) * pageSize + index + 1)}
                        </td>
                        <td className="py-1.5 px-3">
                          <div className="font-medium text-slate-900 dark:text-white">{v ? `${v.name} - پلاک [${toPersianDigits(v.plaque)}]` : '—'}</div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 inline-block">{v ? v.code : '—'}</span>
                        </td>
                        <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300">{insp.inspectionCenter}</td>
                        <td className="py-1.5 px-3 text-slate-600 dark:text-slate-400">{toPersianDigits(insp.trackingCode)}</td>
                        <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">{toJalaliDate(insp.inspectionDate)}</td>
                        <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">{toJalaliDate(insp.expiryDate)}</td>
                        <td className="py-1.5 px-3">
                          {isExpired ? (
                            <span className="px-2 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded text-[10px]">
                              فاقد معاینه معتبر
                            </span>
                          ) : diffDays <= 30 ? (
                            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded text-[10px]">
                              {toPersianDigits(diffDays)} روز تا تمدید
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded text-[10px]">
                              معاینه فنی معتبر
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
            totalPages={totalPagesInsp}
            pageSize={pageSize}
            totalItems={sortedInspections.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}
        </motion.div>
      </AnimatePresence>

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
    </div>
  );
}
