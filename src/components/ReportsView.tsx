/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileSpreadsheet, Printer, Search, Calendar, Filter, 
  BarChart4, ArrowDownToLine, Check, BookOpen, Clock, Truck, ShieldAlert, Wrench, DollarSign, History, User, Building, ArrowLeftRight, X, List, ArrowUpDown, ArrowUp, ArrowDown, Eye
} from 'lucide-react';
import { Vehicle, PeriodicService, Insurance, VehicleFailure, Expense, TechnicalInspection, VehicleHistoryEntry, RepairWorkflow, PartInventory } from '../types';
import { toJalaliDate, toPersianDigits, formatPrice, formatNumber } from '../utils/numberUtils';
import { JalaliDatePicker } from './JalaliDatePicker';
import { Pagination } from './Pagination';
import { CustomSelect } from './CustomSelect';
import { TableColumnHeader, ColumnFilterMenu, FilterMenuState } from './TableFilterSort';
import { SortDirection } from '../utils/sortUtils';
import { getVehicleDisplayName, matchesVehicleSearch } from '../utils/vehicleUtils';

interface ReportsViewProps {
  activeView?: string;
  vehicles: Vehicle[];
  services: PeriodicService[];
  insurances: Insurance[];
  inspections?: TechnicalInspection[];
  failures: VehicleFailure[];
  workflows?: RepairWorkflow[];
  expenses: Expense[];
  parts?: PartInventory[];
  vehicleHistory?: VehicleHistoryEntry[];
}

type ReportModule = 'vehicle_comprehensive' | 'expenses' | 'services' | 'failures' | 'insurance' | 'vehicles' | 'analytics' | 'drivers' | 'companies';

/**
 * نرمال‌سازی متون فارسی جهت جستجوی استاندارد (حذف اعراب، یکدست‌سازی ی و ک، تبدیل اعداد فارسی به انگلیسی)
 */
function normalizePersianText(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/۰/g, '0')
    .replace(/۱/g, '1')
    .replace(/۲/g, '2')
    .replace(/۳/g, '3')
    .replace(/۴/g, '4')
    .replace(/۵/g, '5')
    .replace(/۶/g, '6')
    .replace(/۷/g, '7')
    .replace(/۸/g, '8')
    .replace(/۹/g, '9')
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

export default function ReportsView({
  activeView,
  vehicles,
  services,
  insurances,
  inspections = [],
  failures,
  workflows = [],
  expenses,
  parts = [],
  vehicleHistory = []
}: ReportsViewProps) {
  const [selectedModule, setSelectedModule] = useState<ReportModule>('vehicle_comprehensive');

  // دریافت اطلاعات راننده و شرکت در زمان رویداد
  const getItemDriverAndCompany = (item: any, vehicleId: number) => {
    const v = vehicles.find(veh => veh.id === vehicleId);
    const driver = item.driverName || v?.driverName || 'ثبت نشده';
    const company = item.company || v?.company || 'ثبت نشده';
    return { driver, company, vehicle: v };
  };

  // تابع دریافت هزینه فاکتور خرابی از جدول گردش کار
  const getFailureCost = (f: VehicleFailure) => {
    const wf = (workflows || []).find(w => w.failureId === f.id);
    return wf ? Number(wf.totalCost) || 0 : 0;
  };

  // تابع دریافت هزینه کل فاکتور سرویس دوره‌ای (شامل قطعات و اجرت)
  const getServiceCost = (s: PeriodicService) => {
    return (Number(s.cost) || 0) + (Number(s.wages) || 0);
  };

  React.useEffect(() => {
    if (activeView === 'reports_analytics') setSelectedModule('analytics');
    else if (activeView === 'reports_drivers') setSelectedModule('drivers');
    else if (activeView === 'reports_failures') setSelectedModule('failures');
    else if (activeView === 'reports_companies') setSelectedModule('companies');
    else if (activeView === 'reports_services') setSelectedModule('services');
    else if (activeView === 'reports_expenses') setSelectedModule('expenses');
    else if (activeView === 'reports_insurance') setSelectedModule('insurance');
    else setSelectedModule('vehicle_comprehensive');
  }, [activeView]);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  
  // ریست و بستن دراپ‌دان در کلیک بیرون و فشردن Escape
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

  // لیست خودروها منطبق با عبارت جستجوی نام خودرو، راننده و کد خودرو
  const matchedVehicles = useMemo(() => {
    const query = searchTerm.trim();
    return query
      ? vehicles.filter(v => matchesVehicleSearch(v, query))
      : vehicles;
  }, [vehicles, searchTerm]);

  // حالات تفکیک و رتبه‌بندی تعاملی تحلیلی (Interactive Analytics & Ranking Controls)
  const [analyticsViewMode, setAnalyticsViewMode] = useState<'all' | 'vehicles' | 'companies' | 'drivers' | 'services'>('all');
  const [analyticsSortOrder, setAnalyticsSortOrder] = useState<'desc' | 'asc'>('desc');
  const [analyticsTopLimit, setAnalyticsTopLimit] = useState<string>('all');
  const [analyticsQuery, setAnalyticsQuery] = useState<string>('');
  
  // مرتب‌سازی و فیلترهای سبک اکسل
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [filterMenu, setFilterMenu] = useState<FilterMenuState | null>(null);

  const [isExporting, setIsExporting] = useState<string | null>(null);

  const handleExportExcel = () => {
    setIsExporting('excel');
    try {
      let headers: string[] = [];
      let rows: (string | number)[][] = [];
      let fileName = 'گزارش';

      const sanitize = (val: any) => {
        if (val === undefined || val === null) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      if (selectedModule === 'failures') {
        fileName = 'گزارش_سوابق_و_هزینه_خرابی';
        headers = ['ردیف', 'پلاک خودرو', 'نام خودرو', 'راننده در زمان وقوع', 'شرکت / پروژه', 'بخش آسیب‌دیده', 'تاریخ وقوع', 'شرح عیب', 'وضعیت گردش کار', 'هزینه فاکتور (ریال)'];
        rows = (rawReportData as VehicleFailure[]).map((f, idx) => {
          const { driver, company, vehicle: v } = getItemDriverAndCompany(f, f.vehicleId);
          return [
            idx + 1,
            v ? v.plaque : '---',
            v ? v.name : '---',
            driver,
            company,
            f.failureType || '---',
            toJalaliDate(f.failureDate),
            f.description || '---',
            f.status || '---',
            getFailureCost(f)
          ];
        });
      } else if (selectedModule === 'services') {
        fileName = 'گزارش_سوابق_خدمات_دوره_ای';
        headers = ['ردیف', 'پلاک خودرو', 'نام خودرو', 'راننده در زمان انجام', 'شرکت / پروژه', 'نوع خدمات', 'تاریخ انجام', 'کیلومتر فعلی', 'هزینه فاکتور (ریال)', 'توضیحات'];
        rows = (rawReportData as PeriodicService[]).map((s, idx) => {
          const { driver, company, vehicle: v } = getItemDriverAndCompany(s, s.vehicleId);
          return [
            idx + 1,
            v ? v.plaque : '---',
            v ? v.name : '---',
            driver,
            company,
            s.serviceType || '---',
            toJalaliDate(s.serviceDate),
            s.currentKm || 0,
            getServiceCost(s),
            s.notes || '---'
          ];
        });
      } else if (selectedModule === 'expenses') {
        fileName = 'گزارش_مخارج_و_اسناد_مالی';
        headers = ['ردیف', 'پلاک خودرو', 'نام خودرو', 'راننده', 'شرکت / پروژه', 'نوع هزینه', 'تاریخ سند', 'شرح تراکنش', 'مبلغ (ریال)'];
        rows = (rawReportData as Expense[]).map((e, idx) => {
          const { driver, company, vehicle: v } = getItemDriverAndCompany(e, e.vehicleId);
          return [
            idx + 1,
            v ? v.plaque : '---',
            v ? v.name : '---',
            driver,
            company,
            e.expenseType || '---',
            toJalaliDate(e.expenseDate),
            e.description || '---',
            e.cost || 0
          ];
        });
      } else if (selectedModule === 'insurance') {
        fileName = 'گزارش_بیمه_نامه_ها';
        headers = ['ردیف', 'پلاک خودرو', 'نام خودرو', 'راننده فعلی', 'شرکت / پروژه', 'نوع بیمه', 'شرکت بیمه‌گر', 'شماره بیمه‌نامه', 'تاریخ شروع', 'تاریخ پایان اعتبار', 'مبلغ کل (ریال)'];
        rows = (rawReportData as Insurance[]).map((i, idx) => {
          const { driver, company, vehicle: v } = getItemDriverAndCompany(i, i.vehicleId);
          return [
            idx + 1,
            v ? v.plaque : '---',
            v ? v.name : '---',
            driver,
            company,
            i.insuranceType === 'third_party' ? 'شخص ثالث' : 'بدنه',
            i.insuranceCompany || '---',
            i.policyNumber || '---',
            toJalaliDate(i.startDate),
            toJalaliDate(i.endDate),
            i.cost || 0
          ];
        });
      } else if (selectedModule === 'vehicles') {
        fileName = 'فهرست_جامع_ناوگان_خودرویی';
        headers = ['ردیف', 'پلاک ملی', 'نام خودرو', 'برند و مدل', 'کد سازمانی', 'راننده منتسب', 'شرکت / پروژه', 'وضعیت'];
        rows = (rawReportData as Vehicle[]).map((v, idx) => [
          idx + 1,
          v.plaque,
          v.name,
          `${v.brand || ''} ${v.model || ''}`,
          v.code || '---',
          v.driverName || 'بدون راننده',
          v.company || 'ثبت نشده',
          v.status === 'active' ? 'آماده خدمت' : v.status === 'in_repair' ? 'در حال تعمیر' : v.status === 'broken' ? 'دارای نقص فنی' : 'آماده سرویس'
        ]);
      } else if (selectedModule === 'drivers') {
        fileName = 'گزارش_تفکیک_عملکرد_رانندگان';
        headers = ['ردیف', 'نام راننده / پرسنل', 'خودروهای منتسب', 'تعداد خرابی‌ها', 'تعداد سرویس‌ها', 'مجموع فعالیت‌ها'];
        rows = (rawReportData as [string, any][]).map(([drv, stats], idx) => [
          idx + 1,
          drv,
          stats.vehicles.join(' | ') || '---',
          stats.failures,
          stats.services,
          stats.failures + stats.services
        ]);
      } else if (selectedModule === 'companies') {
        fileName = 'گزارش_تفکیک_پروژه_ها_و_شرکت_ها';
        headers = ['ردیف', 'نام شرکت / پروژه', 'خودروهای منتسب', 'تعداد خرابی‌ها', 'تعداد سرویس‌ها', 'مجموع فعالیت‌ها'];
        rows = (rawReportData as [string, any][]).map(([comp, stats], idx) => [
          idx + 1,
          comp,
          stats.vehicles.join(' | ') || '---',
          stats.failures,
          stats.services,
          stats.failures + stats.services
        ]);
      } else if (selectedModule === 'analytics') {
        fileName = 'گزارش_تحلیلی_و_رتبه_بندی_ناوگان';
        headers = ['ردیف', 'عنوان / نام', 'تعداد رویدادها'];
        if (analyticsViewMode === 'vehicles') {
          rows = sortedVehicleFailures.map(([name, count], idx) => [idx + 1, name, count]);
        } else if (analyticsViewMode === 'companies') {
          headers = ['ردیف', 'نام شرکت / پروژه', 'تعداد خرابی‌ها', 'تعداد سرویس‌ها', 'مجموع'];
          rows = sortedCompanies.map(([name, s], idx) => [idx + 1, name, s.failures, s.services, s.failures + s.services]);
        } else if (analyticsViewMode === 'drivers') {
          headers = ['ردیف', 'نام راننده / پرسنل', 'تعداد خرابی‌ها', 'تعداد سرویس‌ها', 'مجموع'];
          rows = sortedDrivers.map(([name, s], idx) => [idx + 1, name, s.failures, s.services, s.failures + s.services]);
        } else {
          rows = sortedServiceTypes.map(([name, count], idx) => [idx + 1, name, count]);
        }
      } else {
        fileName = 'پرونده_جامع_۳۶۰_درجه_خودرو';
        headers = ['بخش', 'ردیف', 'عنوان خودرو / پلاک', 'شرح رویداد', 'تاریخ', 'راننده', 'شرکت', 'مبلغ فاکتور (ریال)'];
        (rawReportData as Vehicle[]).forEach(v => {
          const vFailures = failures.filter(f => f.vehicleId === v.id);
          const vServices = services.filter(s => s.vehicleId === v.id);
          const vExpenses = expenses.filter(e => e.vehicleId === v.id);
          vFailures.forEach((f, i) => {
            const { driver, company } = getItemDriverAndCompany(f, v.id);
            rows.push(['خرابی و تعمیرات', i + 1, `${v.name} (${v.plaque})`, f.failureType, toJalaliDate(f.failureDate), driver, company, getFailureCost(f)]);
          });
          vServices.forEach((s, i) => {
            const { driver, company } = getItemDriverAndCompany(s, v.id);
            rows.push(['سرویس دوره‌ای', i + 1, `${v.name} (${v.plaque})`, s.serviceType, toJalaliDate(s.serviceDate), driver, company, s.cost || 0]);
          });
          vExpenses.forEach((e, i) => {
            const { driver, company } = getItemDriverAndCompany(e, v.id);
            rows.push(['مخارج مالی', i + 1, `${v.name} (${v.plaque})`, e.expenseType, toJalaliDate(e.expenseDate), driver, company, e.cost || 0]);
          });
        });
      }

      const csvContent = '\uFEFF' + [
        headers.map(sanitize).join(','),
        ...rows.map(row => row.map(sanitize).join(','))
      ].join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${fileName}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('خطا در صدور فایل اکسل.');
    } finally {
      setIsExporting(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // محاسبات تحلیلی (Analytics Aggregations)
  const filteredFailuresForAnalytics = failures.filter(f => {
    const vId = (!vehicleFilter || vehicleFilter === 'all') ? null : Number(vehicleFilter);
    if (vId && f.vehicleId !== vId) return false;
    const fDateComp = normalizeToComparableJalali(f.failureDate);
    const startComp = normalizeToComparableJalali(startDate);
    const endComp = normalizeToComparableJalali(endDate);
    if (startComp && fDateComp < startComp) return false;
    if (endComp && fDateComp > endComp) return false;
    return true;
  });

  const filteredServicesForAnalytics = services.filter(s => {
    const vId = (!vehicleFilter || vehicleFilter === 'all') ? null : Number(vehicleFilter);
    if (vId && s.vehicleId !== vId) return false;
    const sDateComp = normalizeToComparableJalali(s.serviceDate);
    const startComp = normalizeToComparableJalali(startDate);
    const endComp = normalizeToComparableJalali(endDate);
    if (startComp && sDateComp < startComp) return false;
    if (endComp && sDateComp > endComp) return false;
    return true;
  });

  // ۱. خودروهای دارای بیشترین خرابی
  const vehicleFailureCounts: { [vehicleName: string]: number } = {};
  filteredFailuresForAnalytics.forEach(f => {
    const v = vehicles.find(veh => veh.id === f.vehicleId);
    const vName = v ? `${v.name} (${v.plaque})` : `خودرو #${f.vehicleId}`;
    vehicleFailureCounts[vName] = (vehicleFailureCounts[vName] || 0) + 1;
  });
  const sortMultiplier = analyticsSortOrder === 'desc' ? -1 : 1;

  const effectiveAnalyticsQuery = analyticsQuery || searchTerm;

  const rawVehicleFailures = Object.entries(vehicleFailureCounts).sort((a, b) => (b[1] - a[1]) * sortMultiplier);
  const filteredVehicleFailures = rawVehicleFailures.filter(([name]) => name.toLowerCase().includes(effectiveAnalyticsQuery.toLowerCase()));
  const sortedVehicleFailures = analyticsTopLimit === 'all' ? filteredVehicleFailures : filteredVehicleFailures.slice(0, Number(analyticsTopLimit));

  // ۲. تفکیک شرکت‌ها
  const companyStats: { [companyName: string]: { failures: number; services: number; vehicles: string[] } } = {};
  vehicles.forEach(v => {
    const comp = v.company || 'نامشخص';
    if (!companyStats[comp]) companyStats[comp] = { failures: 0, services: 0, vehicles: [] };
    companyStats[comp].vehicles.push(`${v.name} (${v.plaque})`);
  });
  filteredFailuresForAnalytics.forEach(f => {
    const v = vehicles.find(veh => veh.id === f.vehicleId);
    const comp = f.company || v?.company || 'نامشخص';
    if (!companyStats[comp]) companyStats[comp] = { failures: 0, services: 0, vehicles: [] };
    companyStats[comp].failures += 1;
  });
  filteredServicesForAnalytics.forEach(s => {
    const v = vehicles.find(veh => veh.id === s.vehicleId);
    const comp = s.company || v?.company || 'نامشخص';
    if (!companyStats[comp]) companyStats[comp] = { failures: 0, services: 0, vehicles: [] };
    companyStats[comp].services += 1;
  });
  const rawCompanies = Object.entries(companyStats).sort((a, b) => ((b[1].failures + b[1].services) - (a[1].failures + a[1].services)) * sortMultiplier);
  const filteredCompanies = rawCompanies.filter(([comp]) => comp.toLowerCase().includes(effectiveAnalyticsQuery.toLowerCase()));
  const sortedCompanies = analyticsTopLimit === 'all' ? filteredCompanies : filteredCompanies.slice(0, Number(analyticsTopLimit));

  // ۳. تفکیک رانندگان
  const driverStats: { [driverName: string]: { failures: number; services: number; vehicles: string[] } } = {};
  vehicles.forEach(v => {
    const drv = v.driverName || 'بدون راننده';
    if (!driverStats[drv]) driverStats[drv] = { failures: 0, services: 0, vehicles: [] };
    driverStats[drv].vehicles.push(`${v.name} (${v.plaque})`);
  });
  filteredFailuresForAnalytics.forEach(f => {
    const v = vehicles.find(veh => veh.id === f.vehicleId);
    const drv = f.driverName || v?.driverName || 'بدون راننده';
    if (!driverStats[drv]) driverStats[drv] = { failures: 0, services: 0, vehicles: [] };
    driverStats[drv].failures += 1;
  });
  filteredServicesForAnalytics.forEach(s => {
    const v = vehicles.find(veh => veh.id === s.vehicleId);
    const drv = s.driverName || v?.driverName || 'بدون راننده';
    if (!driverStats[drv]) driverStats[drv] = { failures: 0, services: 0, vehicles: [] };
    driverStats[drv].services += 1;
  });
  const rawDrivers = Object.entries(driverStats).sort((a, b) => ((b[1].failures + b[1].services) - (a[1].failures + a[1].services)) * sortMultiplier);
  const filteredDrivers = rawDrivers.filter(([drv]) => drv.toLowerCase().includes(effectiveAnalyticsQuery.toLowerCase()));
  const sortedDrivers = analyticsTopLimit === 'all' ? filteredDrivers : filteredDrivers.slice(0, Number(analyticsTopLimit));

  // ۴. خدمات دوره‌ای پرتکرار
  const serviceTypeCounts: { [serviceType: string]: number } = {};
  filteredServicesForAnalytics.forEach(s => {
    const sType = s.serviceType || 'سرویس عمومی';
    serviceTypeCounts[sType] = (serviceTypeCounts[sType] || 0) + 1;
  });
  const rawServiceTypes = Object.entries(serviceTypeCounts).sort((a, b) => (b[1] - a[1]) * sortMultiplier);
  const filteredServiceTypes = rawServiceTypes.filter(([sType]) => sType.toLowerCase().includes(effectiveAnalyticsQuery.toLowerCase()));
  const sortedServiceTypes = analyticsTopLimit === 'all' ? filteredServiceTypes : filteredServiceTypes.slice(0, Number(analyticsTopLimit));

  // فیلتر کردن هوشمند بر اساس پارامترها
  const getFilteredData = () => {
    const vId = (!vehicleFilter || vehicleFilter === 'all') ? null : Number(vehicleFilter);
    const term = searchTerm.trim().toLowerCase();
    const startComp = normalizeToComparableJalali(startDate);
    const endComp = normalizeToComparableJalali(endDate);

    switch (selectedModule) {
      case 'drivers':
        return sortedDrivers;
      case 'companies':
        return sortedCompanies;
      case 'analytics':
        if (analyticsViewMode === 'vehicles') return sortedVehicleFailures;
        if (analyticsViewMode === 'companies') return sortedCompanies;
        if (analyticsViewMode === 'drivers') return sortedDrivers;
        if (analyticsViewMode === 'services') return sortedServiceTypes;
        return sortedCompanies;
      case 'vehicles':
        return vehicles.filter(v => {
          if (vId && v.id !== vId) return false;
          if (term) {
            const match = startsWithPrefix(v.name, term) ||
              startsWithPrefix(v.code, term) ||
              v.name.toLowerCase().includes(term) ||
              v.plaque.toLowerCase().includes(term) ||
              v.code.toLowerCase().includes(term) ||
              (v.driverName && v.driverName.toLowerCase().includes(term)) ||
              (v.company && v.company.toLowerCase().includes(term));
            if (!match) return false;
          }
          return true;
        });
      case 'vehicle_comprehensive':
        if (vId) {
          return vehicles.filter(v => v.id === vId);
        }
        if (term) {
          return vehicles.filter(v => 
            startsWithPrefix(v.name, term) ||
            startsWithPrefix(v.code, term) ||
            v.name.toLowerCase().includes(term) ||
            v.plaque.toLowerCase().includes(term) ||
            v.code.toLowerCase().includes(term) ||
            (v.driverName && v.driverName.toLowerCase().includes(term)) ||
            (v.company && v.company.toLowerCase().includes(term))
          );
        }
        return vehicles;
      case 'services':
        return services.filter(s => {
          if (vId && s.vehicleId !== vId) return false;
          const sDateComp = normalizeToComparableJalali(s.serviceDate);
          if (startComp && sDateComp < startComp) return false;
          if (endComp && sDateComp > endComp) return false;
          if (term) {
            const v = vehicles.find(veh => veh.id === s.vehicleId);
            const match = (s.serviceType && s.serviceType.toLowerCase().includes(term)) ||
              (s.notes && s.notes.toLowerCase().includes(term)) ||
              (s.driverName && s.driverName.toLowerCase().includes(term)) ||
              (s.company && s.company.toLowerCase().includes(term)) ||
              (v && matchesVehicleSearch(v, term));
            if (!match) return false;
          }
          return true;
        });
      case 'insurance':
        return insurances.filter(i => {
          if (vId && i.vehicleId !== vId) return false;
          const iStartComp = normalizeToComparableJalali(i.startDate);
          const iEndComp = normalizeToComparableJalali(i.endDate);
          if (startComp && iStartComp < startComp && iEndComp < startComp) return false;
          if (endComp && iStartComp > endComp) return false;
          if (term) {
            const v = vehicles.find(veh => veh.id === i.vehicleId);
            const match = (i.insuranceCompany && i.insuranceCompany.toLowerCase().includes(term)) ||
              (i.policyNumber && i.policyNumber.toLowerCase().includes(term)) ||
              (v && matchesVehicleSearch(v, term));
            if (!match) return false;
          }
          return true;
        });
      case 'failures':
        return failures.filter(f => {
          if (vId && f.vehicleId !== vId) return false;
          const fDateComp = normalizeToComparableJalali(f.failureDate);
          if (startComp && fDateComp < startComp) return false;
          if (endComp && fDateComp > endComp) return false;
          if (term) {
            const v = vehicles.find(veh => veh.id === f.vehicleId);
            const match = (f.failureType && f.failureType.toLowerCase().includes(term)) ||
              (f.description && f.description.toLowerCase().includes(term)) ||
              (f.driverName && f.driverName.toLowerCase().includes(term)) ||
              (f.company && f.company.toLowerCase().includes(term)) ||
              (v && matchesVehicleSearch(v, term));
            if (!match) return false;
          }
          return true;
        });
      case 'expenses':
        return expenses.filter(e => {
          if (vId && e.vehicleId !== vId) return false;
          const eDateComp = normalizeToComparableJalali(e.expenseDate);
          if (startComp && eDateComp < startComp) return false;
          if (endComp && eDateComp > endComp) return false;
          if (term) {
            const v = vehicles.find(veh => veh.id === e.vehicleId);
            const match = (e.expenseType && e.expenseType.toLowerCase().includes(term)) ||
              (e.description && e.description.toLowerCase().includes(term)) ||
              (e.driverName && e.driverName.toLowerCase().includes(term)) ||
              (e.company && e.company.toLowerCase().includes(term)) ||
              (v && matchesVehicleSearch(v, term));
            if (!match) return false;
          }
          return true;
        });
      default:
        return [];
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // استخراج مقدار ستون برای فیلتر و مرتب‌سازی در تمامی ماژول‌های گزارش
  const getReportItemColValue = (item: any, colKey: string, module: ReportModule): string => {
    if (!item) return '-';
    if (module === 'failures') {
      const { driver, company, vehicle: v } = getItemDriverAndCompany(item, item.vehicleId);
      switch (colKey) {
        case 'vehicle': return v ? `${v.name} (${v.plaque})` : 'نامشخص';
        case 'driverName': return driver;
        case 'company': return company;
        case 'failureType': return item.failureType || 'نامشخص';
        case 'failureDate': return toJalaliDate(item.failureDate);
        case 'description': return item.description || '---';
        case 'status': return item.status || 'ثبت شده';
        case 'cost': return item.cost ? Number(item.cost).toLocaleString() : '۰';
        default: return String(item[colKey] || '-');
      }
    } else if (module === 'services') {
      const { driver, company, vehicle: v } = getItemDriverAndCompany(item, item.vehicleId);
      switch (colKey) {
        case 'vehicle': return v ? `${v.name} (${v.plaque})` : 'نامشخص';
        case 'driverName': return driver;
        case 'company': return company;
        case 'serviceType': return item.serviceType || 'نامشخص';
        case 'serviceDate': return toJalaliDate(item.serviceDate);
        case 'currentKm': return item.currentKm ? Number(item.currentKm).toLocaleString() : '۰';
        case 'cost': return item.cost ? Number(item.cost).toLocaleString() : '۰';
        default: return String(item[colKey] || '-');
      }
    } else if (module === 'expenses') {
      const { driver, company, vehicle: v } = getItemDriverAndCompany(item, item.vehicleId);
      switch (colKey) {
        case 'vehicle': return v ? `${v.name} (${v.plaque})` : 'نامشخص';
        case 'driverName': return driver;
        case 'company': return company;
        case 'expenseType': return item.expenseType || 'نامشخص';
        case 'expenseDate': return toJalaliDate(item.expenseDate);
        case 'description': return item.description || '---';
        case 'cost': return item.cost ? Number(item.cost).toLocaleString() : '۰';
        default: return String(item[colKey] || '-');
      }
    } else if (module === 'insurance') {
      const { driver, company, vehicle: v } = getItemDriverAndCompany(item, item.vehicleId);
      switch (colKey) {
        case 'vehicle': return v ? `${v.name} (${v.plaque})` : 'نامشخص';
        case 'driverName': return driver;
        case 'company': return company;
        case 'insuranceType': return item.insuranceType === 'third_party' ? 'شخص ثالث' : 'بدنه';
        case 'insuranceCompany': return item.insuranceCompany || 'نامشخص';
        case 'endDate': return toJalaliDate(item.endDate);
        case 'cost': return item.cost ? Number(item.cost).toLocaleString() : '۰';
        default: return String(item[colKey] || '-');
      }
    } else if (module === 'vehicles') {
      switch (colKey) {
        case 'plaque': return item.plaque || 'نامشخص';
        case 'name': return `${item.name || ''} ${item.brand || ''} ${item.model || ''}`.trim();
        case 'driverName': return item.driverName || 'ثبت نشده';
        case 'company': return item.company || 'ثبت نشده';
        case 'type': return item.type === 'light' ? 'سواری سبک' : 'سنگین ترابری';
        case 'status': return item.status === 'active' ? 'آماده جاده' : item.status === 'repair' ? 'متوقف تعمیرگاه' : 'غیرفعال';
        default: return String(item[colKey] || '-');
      }
    } else if (module === 'drivers') {
      const [drv, stats] = item;
      switch (colKey) {
        case 'name': return drv || 'ثبت نشده';
        case 'vehicles': return stats?.vehicles?.join(', ') || '---';
        case 'failures': return stats?.failures !== undefined ? String(stats.failures) : '0';
        case 'services': return stats?.services !== undefined ? String(stats.services) : '0';
        default: return '-';
      }
    } else if (module === 'companies') {
      const [comp, stats] = item;
      switch (colKey) {
        case 'name': return comp || 'ثبت نشده';
        case 'vehicles': return stats?.vehicles?.join(', ') || '---';
        case 'failures': return stats?.failures !== undefined ? String(stats.failures) : '0';
        case 'services': return stats?.services !== undefined ? String(stats.services) : '0';
        case 'total': return String((stats?.failures || 0) + (stats?.services || 0));
        default: return '-';
      }
    }
    return '-';
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

  useEffect(() => {
    setCurrentPage(1);
    setColumnFilters({});
    setSortKey('');
    setSortDirection('desc');
    setFilterMenu(null);
  }, [selectedModule, vehicleFilter, startDate, endDate, analyticsViewMode, searchTerm]);

  const rawReportData = useMemo(() => getFilteredData(), [
    selectedModule,
    vehicleFilter,
    searchTerm,
    startDate,
    endDate,
    analyticsViewMode,
    analyticsSortOrder,
    analyticsTopLimit,
    effectiveAnalyticsQuery,
    sortedDrivers,
    sortedCompanies,
    sortedVehicleFailures,
    sortedServiceTypes,
    vehicles,
    services,
    insurances,
    failures,
    expenses
  ]);

  // مقادیر یکتا و تعداد برای ستون فعال منوی فیلتر
  const currentMenuUniqueValues = useMemo(() => {
    if (!filterMenu) return [];
    const valMap = new Map<string, number>();
    rawReportData.forEach(item => {
      const val = getReportItemColValue(item, filterMenu.colKey, selectedModule);
      valMap.set(val, (valMap.get(val) || 0) + 1);
    });
    return Array.from(valMap.entries()).map(([value, count]) => ({ value, count }));
  }, [filterMenu, rawReportData, selectedModule]);

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

  const columnFilteredReportData = useMemo(() => {
    if (selectedModule === 'analytics' || selectedModule === 'vehicle_comprehensive') {
      return rawReportData;
    }
    return rawReportData.filter(item => {
      for (const [key, selectedVals] of Object.entries(columnFilters)) {
        if (!selectedVals || !Array.isArray(selectedVals)) continue;
        const val = getReportItemColValue(item, key, selectedModule);
        if (!selectedVals.includes(val)) return false;
      }
      return true;
    });
  }, [rawReportData, columnFilters, selectedModule]);

  const sortedReportData = useMemo(() => {
    if (selectedModule === 'analytics' || selectedModule === 'vehicle_comprehensive') {
      return columnFilteredReportData;
    }
    if (!sortKey) return columnFilteredReportData;
    return [...columnFilteredReportData].sort((a, b) => {
      let valA: any = getReportItemColValue(a, sortKey, selectedModule);
      let valB: any = getReportItemColValue(b, sortKey, selectedModule);

      if (sortKey === 'cost') {
        valA = Number(a.cost) || (selectedModule === 'failures' ? getFailureCost(a) : 0);
        valB = Number(b.cost) || (selectedModule === 'failures' ? getFailureCost(b) : 0);
      } else if (sortKey === 'currentKm') {
        valA = Number(a.currentKm) || 0;
        valB = Number(b.currentKm) || 0;
      } else if (sortKey === 'failures') {
        valA = (selectedModule === 'drivers' || selectedModule === 'companies') ? (a[1]?.failures || 0) : 0;
        valB = (selectedModule === 'drivers' || selectedModule === 'companies') ? (b[1]?.failures || 0) : 0;
      } else if (sortKey === 'services') {
        valA = (selectedModule === 'drivers' || selectedModule === 'companies') ? (a[1]?.services || 0) : 0;
        valB = (selectedModule === 'drivers' || selectedModule === 'companies') ? (b[1]?.services || 0) : 0;
      } else if (sortKey === 'total') {
        valA = selectedModule === 'companies' ? ((a[1]?.failures || 0) + (a[1]?.services || 0)) : 0;
        valB = selectedModule === 'companies' ? ((b[1]?.failures || 0) + (b[1]?.services || 0)) : 0;
      } else if (sortKey === 'failureDate' || sortKey === 'serviceDate' || sortKey === 'expenseDate' || sortKey === 'endDate') {
        valA = a[sortKey] || '';
        valB = b[sortKey] || '';
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA || '');
      const strB = String(valB || '');
      return sortDirection === 'asc'
        ? strA.localeCompare(strB, 'fa', { numeric: true })
        : strB.localeCompare(strA, 'fa', { numeric: true });
    });
  }, [columnFilteredReportData, sortKey, sortDirection, selectedModule, workflows]);

  const totalPages = Math.ceil(sortedReportData.length / pageSize) || 1;
  const reportData = useMemo(() => {
    return sortedReportData.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [sortedReportData, currentPage, pageSize]);

  // تعاریف عناوین و توضیحات هر گزارش
  const reportDetails: Record<ReportModule, { title: string; subtitle: string; icon: any }> = {
    vehicle_comprehensive: {
      title: 'پرونده جامع ۳۶۰ درجه خودرو',
      subtitle: 'شناسنامه کامل خودرو، تاریخچه تحویل، سوابق کلیه خرابی‌ها، خدمات دوره‌ای و مخارج مالی',
      icon: Truck
    },
    analytics: {
      title: 'گزارش تحلیلی و رتبه‌بندی ناوگان',
      subtitle: 'تحلیل آماری خرابی‌ها، عملکرد رانندگان، پروژه‌ها و پرهزینه‌ترین خدمات دوره‌ای',
      icon: BarChart4
    },
    drivers: {
      title: 'گزارش تفکیک عملکرد رانندگان و پرسنل',
      subtitle: 'سوابق خودروهای منتسب، تعداد خرابی‌های ثبت‌شده و خدمات دوره‌ای به تفکیک راننده',
      icon: User
    },
    companies: {
      title: 'گزارش تفکیک شرکت‌ها و پروژه‌ها',
      subtitle: 'سوابق فعالیت، خرابی‌ها و سرویس‌های ثبت‌شده به تفکیک شرکت یا پروژه تحویل‌گیرنده',
      icon: Building
    },
    services: {
      title: 'گزارش سوابق خدمات دوره‌ای و سرویس‌ها',
      subtitle: 'فهرست کامل سرویس‌های انجام‌شده، تعویض روغن و فیلترها به همراه کیلومتر و هزینه فاکتورها',
      icon: Wrench
    },
    failures: {
      title: 'گزارش سوابق و هزینه خرابی خودروها',
      subtitle: 'فهرست عیب‌یابی، قطعات آسیب‌دیده، وضعیت گردش کار تعمیرات و مبالغ فاکتورهای مربوطه',
      icon: ShieldAlert
    },
    expenses: {
      title: 'گزارش مخارج و اسناد مالی',
      subtitle: 'ریز کلیه هزینه‌های ثبت‌شده، قطعات مصرفی، سوخت، فاکتورها و مبالغ پرداختی',
      icon: DollarSign
    },
    insurance: {
      title: 'گزارش وضعیت بیمه‌نامه‌ها',
      subtitle: 'فهرست بیمه‌های شخص ثالث، بدنه، تاریخ انقضا و مبالغ حق‌بیمه پرداخت‌شده',
      icon: Check
    },
    vehicles: {
      title: 'گزارش جامع فهرست ناوگان خودرویی',
      subtitle: 'مشخصات کامل خودروها، پلاک ملی، رانندگان منتسب، شرکت و وضعیت عملیاتی',
      icon: Truck
    }
  };

  const currentReportMeta = reportDetails[selectedModule] || reportDetails.vehicle_comprehensive;
  const ReportIcon = currentReportMeta.icon;

  // محاسبه مجموع مبالغ برای گزارش‌های مالی/هزینه‌ای
  const totalCalculatedCost = React.useMemo(() => {
    if (selectedModule === 'failures') {
      return (rawReportData as VehicleFailure[]).reduce((sum, f) => sum + getFailureCost(f), 0);
    }
    if (selectedModule === 'services') {
      return (rawReportData as PeriodicService[]).reduce((sum, s) => sum + (Number(s.cost) || 0), 0);
    }
    if (selectedModule === 'expenses') {
      return (rawReportData as Expense[]).reduce((sum, e) => sum + (Number(e.cost) || 0), 0);
    }
    if (selectedModule === 'insurance') {
      return (rawReportData as Insurance[]).reduce((sum, i) => sum + (Number(i.cost) || 0), 0);
    }
    return 0;
  }, [selectedModule, rawReportData]);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* هدر بخش گزارش با عنوان پویا */}
      <div className="bg-white dark:bg-[#111113] p-4 rounded-lg border border-slate-200 dark:border-[#2d2d30] print:hidden">
        <div>
          <h1 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <ReportIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            {currentReportMeta.title}
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            {currentReportMeta.subtitle}
          </p>
        </div>
      </div>

      {/* کارت‌های خلاصه آماری و مالی گزارش */}
      {selectedModule !== 'analytics' && selectedModule !== 'vehicle_comprehensive' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 print:hidden">
          <div className="bg-white dark:bg-[#111113] p-3 rounded-lg border border-slate-200 dark:border-[#2d2d30] flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold">تعداد کل رکوردهای فیلترشده</span>
              <span className="text-xs font-black text-slate-900 dark:text-white font-mono mt-0.5 block">
                {toPersianDigits(rawReportData.length)} مورد
              </span>
            </div>
            <div className="p-2 rounded-md bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
              <List className="w-4 h-4" />
            </div>
          </div>

          {(selectedModule === 'failures' || selectedModule === 'services' || selectedModule === 'expenses' || selectedModule === 'insurance') && (
            <div className="bg-white dark:bg-[#111113] p-3 rounded-lg border border-slate-200 dark:border-[#2d2d30] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold">مجموع کل مبالغ و هزینه‌ها</span>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
                  {totalCalculatedCost.toLocaleString()} ریال
                </span>
              </div>
              <div className="p-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-[#111113] p-3 rounded-lg border border-slate-200 dark:border-[#2d2d30] flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold">خودروی تحت پوشش</span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 block truncate max-w-[180px]">
                {vehicleFilter === 'all' ? 'همه خودروهای ناوگان' : vehicles.find(v => v.id.toString() === vehicleFilter)?.name || 'خودروی انتخابی'}
              </span>
            </div>
            <div className="p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
              <Truck className="w-4 h-4" />
            </div>
          </div>
        </div>
      )}

      {/* ابزار جستجو و فیلترهای تاریخ و خروجی اکسل */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center relative z-30 print:hidden">
        
        {/* فیلد تکی جستجو و انتخاب خودرو بر اساس نام خودرو */}
        <div ref={searchContainerRef} className="relative flex-1">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input 
              type="text" 
              placeholder={activeVehicle ? `خودروی انتخاب‌شده: ${activeVehicle.name}` : "جستجو و انتخاب نام خودرو (تایپ نام خودرو)..."} 
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
            value={startDate}
            onChange={setStartDate}
            placeholder="از تاریخ"
            inputClassName="h-[34px] text-[11px] rounded-lg px-2.5 pr-2.5 pl-7"
          />
        </div>

        {/* فیلتر تا تاریخ */}
        <div className="w-full sm:w-36">
          <JalaliDatePicker
            value={endDate}
            onChange={setEndDate}
            placeholder="تا تاریخ"
            inputClassName="h-[34px] text-[11px] rounded-lg px-2.5 pr-2.5 pl-7"
          />
        </div>

        {/* دکمه‌های خروجی اکسل و چاپ گزارش */}
        <div className="flex items-center gap-1.5 self-center">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={!!isExporting}
            className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-2xs shrink-0 group disabled:opacity-50"
            title={startDate || endDate ? `دریافت خروجی اکسل در بازه تاریخی (${startDate || 'ابتدا'} تا ${endDate || 'انتها'})` : 'دریافت خروجی اکسل کل اطلاعات'}
          >
            <FileSpreadsheet className="w-4 h-4 transition-transform group-hover:scale-110" />
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-indigo-500 text-indigo-600 dark:text-indigo-400 transition-all cursor-pointer shadow-2xs shrink-0 group"
            title="چاپ گزارش یا دریافت نسخه PDF"
          >
            <Printer className="w-4 h-4 transition-transform group-hover:scale-110" />
          </button>
        </div>
      </div>

      {/* جدول داده‌ها و پرونده جامع */}
      <div className="space-y-6">
        
        {/* حالت داشبورد تحلیلی و آمار مقایسه‌ای */}
        {selectedModule === 'analytics' && (
            <div className="space-y-6">
              {/* نوار ابزار تنظیمات و فیلترهای تعاملی تحلیلی به صورت کاملاً مرتب و سازمان‌یافته */}
              <div className="bg-white dark:bg-[#161618] border border-slate-200 dark:border-[#2d2d30] p-4 rounded-xl space-y-3.5 print:hidden shadow-xs">
                {/* بخش اول: تب‌های انتخاب بخش تحلیلی به همراه نشانگر تعداد نتایج */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#2d2d30]/80">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                    <span className="text-slate-600 dark:text-slate-400 font-bold text-xs shrink-0 flex items-center gap-1.5">
                      <BarChart4 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      بخش تحلیلی:
                    </span>
                    <div className="inline-flex p-1 bg-slate-100 dark:bg-[#1a1a1c] rounded-xl border border-slate-200 dark:border-[#2d2d30] gap-1 shrink-0">
                      {[
                        { id: 'all', label: 'همه تحلیل‌ها' },
                        { id: 'vehicles', label: 'خودروها (خرابی‌ها)' },
                        { id: 'companies', label: 'شرکت‌ها / پروژه‌ها' },
                        { id: 'drivers', label: 'رانندگان و پرسنل' },
                        { id: 'services', label: 'خدمات دوره‌ای' },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setAnalyticsViewMode(tab.id as any)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                            analyticsViewMode === tab.id
                              ? 'bg-white dark:bg-[#252528] text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/80 dark:border-indigo-500/30'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-[#202024]'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* وضعیت و آمار ردیف‌ها جهت توازن و تقارن دو سمت */}
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0 self-end sm:self-center">
                    <span>موارد منطبق:</span>
                    <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800/60 text-xs">
                      {toPersianDigits(
                        analyticsViewMode === 'vehicles' ? sortedVehicleFailures.length :
                        analyticsViewMode === 'companies' ? sortedCompanies.length :
                        analyticsViewMode === 'drivers' ? sortedDrivers.length :
                        analyticsViewMode === 'services' ? sortedServiceTypes.length :
                        (sortedVehicleFailures.length + sortedCompanies.length + sortedDrivers.length + sortedServiceTypes.length)
                      )} مورد
                    </span>
                  </div>
                </div>

                {/* بخش دوم: ابزارهای جستجو، رتبه‌بندی و تعداد نمایش با چیدمان گرید منظم و ارتفاع یکپارچه */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  {/* جستجوی متنی */}
                  <div className="sm:col-span-6 relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="جستجو در نتایج تحلیلی (نام خودرو، شرکت، راننده یا خدمت)..."
                      value={analyticsQuery}
                      onChange={e => setAnalyticsQuery(e.target.value)}
                      className="w-full h-[38px] bg-slate-50 dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 border border-slate-300 dark:border-[#2d2d30] rounded-lg pr-9 pl-8 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors shadow-2xs"
                    />
                    {analyticsQuery && (
                      <button
                        type="button"
                        onClick={() => setAnalyticsQuery('')}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* مرتب‌سازی و رتبه‌بندی بدون کادر دوبل */}
                  <div className="sm:col-span-3">
                    <CustomSelect
                      value={analyticsSortOrder}
                      onChange={(val) => setAnalyticsSortOrder(val as 'desc' | 'asc')}
                      options={[
                        { value: 'desc', label: 'رتبه‌بندی: بیشترین به کمترین (نزولی)' },
                        { value: 'asc', label: 'رتبه‌بندی: کمترین به بیشترین (صعودی)' }
                      ]}
                    />
                  </div>

                  {/* محدودسازی تعداد نمایش بدون کادر دوبل */}
                  <div className="sm:col-span-3">
                    <CustomSelect
                      value={analyticsTopLimit}
                      onChange={(val) => setAnalyticsTopLimit(val)}
                      options={[
                        { value: 'all', label: 'تعداد نمایش: همه موارد' },
                        { value: '5', label: 'تعداد نمایش: ۵ مورد برتر' },
                        { value: '10', label: 'تعداد نمایش: ۱۰ مورد برتر' }
                      ]}
                    />
                  </div>
                </div>
              </div>

              {/* کارت‌های خلاصه آماری */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white dark:bg-[#161618] border border-slate-200 dark:border-[#2d2d30] p-4 rounded-xl shadow-xs">
                  <span className="text-slate-500 dark:text-slate-400 text-xs block font-bold">مجموع رویدادهای خرابی</span>
                  <span className="text-rose-600 dark:text-rose-400 font-black text-lg font-mono mt-1 block">{toPersianDigits(filteredFailuresForAnalytics.length)} مورد</span>
                </div>
                <div className="bg-white dark:bg-[#161618] border border-slate-200 dark:border-[#2d2d30] p-4 rounded-xl shadow-xs">
                  <span className="text-slate-500 dark:text-slate-400 text-xs block font-bold">مجموع سرویس‌های دوره‌ای</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-black text-lg font-mono mt-1 block">{toPersianDigits(filteredServicesForAnalytics.length)} مورد</span>
                </div>
                <div className="bg-white dark:bg-[#161618] border border-slate-200 dark:border-[#2d2d30] p-4 rounded-xl shadow-xs">
                  <span className="text-slate-500 dark:text-slate-400 text-xs block font-bold">تعداد شرکت‌ها و پروژه‌های فعال</span>
                  <span className="text-amber-600 dark:text-amber-400 font-black text-lg font-mono mt-1 block">{toPersianDigits(sortedCompanies.length)} شرکت</span>
                </div>
              </div>

              {/* تحلیل ۱: خودروهای دارای بیشترین خرابی */}
              {/* تحلیل ۱: خودروهای با بیشترین خرابی به صورت جدول/لیست یکپارچه */}
              {(analyticsViewMode === 'all' || analyticsViewMode === 'vehicles') && (
                <div className="bg-white dark:bg-[#161618] border border-slate-200 dark:border-[#2d2d30] rounded-xl p-4 sm:p-5 space-y-3.5 shadow-xs">
                  <h4 className="font-extrabold text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    خودروهای دارای بیشترین گزارش خرابی و عیب‌یابی (رتبه‌بندی {analyticsSortOrder === 'desc' ? 'نزولی' : 'صعودی'})
                  </h4>
                  {sortedVehicleFailures.length === 0 ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">هیچ داده خرابی در بازه یا فیلتر انتخابی وجود ندارد.</div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#2d2d30]">
                      <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] text-slate-600 dark:text-slate-400 font-bold">
                            <th className="py-2.5 px-3 text-center w-12">ردیف</th>
                            <th className="py-2.5 px-3">نام و مشخصات خودرو</th>
                            <th className="py-2.5 px-3 text-center text-rose-600 dark:text-rose-400">تعداد خرابی‌های ثبت‌شده</th>
                            <th className="py-2.5 px-3 text-center">سهم از کل خرابی‌ها</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#2d2d30]/60">
                          {sortedVehicleFailures.map(([vName, count], idx) => {
                            const totalF = sortedVehicleFailures.reduce((acc, [, c]) => acc + c, 0);
                            const percent = totalF > 0 ? Math.round((count / totalF) * 100) : 0;
                            return (
                              <tr key={vName} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/40 transition-colors">
                                <td className="py-2.5 px-3 text-slate-400 text-center font-bold font-mono text-[10px]">
                                  {toPersianDigits(idx + 1)}
                                </td>
                                <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                                  {vName}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-center text-rose-600 dark:text-rose-400 font-bold">
                                  {toPersianDigits(count)} مورد خرابی
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 font-mono">
                                    {toPersianDigits(percent)}٪
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* تحلیل ۲: تفکیک شرکت‌ها و پروژه‌ها */}
              {(analyticsViewMode === 'all' || analyticsViewMode === 'companies') && (
                <div className="bg-white dark:bg-[#161618] border border-slate-200 dark:border-[#2d2d30] rounded-xl p-4 sm:p-5 space-y-3.5 shadow-xs">
                  <h4 className="font-extrabold text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    تحلیل فعالیت و رویدادها بر اساس شرکت / پروژه تحویل‌گیرنده
                  </h4>
                  {sortedCompanies.length === 0 ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">هیچ داده‌ای ثبت نشده است.</div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#2d2d30]">
                      <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] text-slate-600 dark:text-slate-400 font-bold">
                            <th className="py-2.5 px-3 text-center w-12">ردیف</th>
                            <th className="py-2.5 px-3">نام شرکت / پروژه</th>
                            <th className="py-2.5 px-3 text-rose-600 dark:text-rose-400">تعداد خرابی‌ها</th>
                            <th className="py-2.5 px-3 text-indigo-600 dark:text-indigo-400">تعداد سرویس‌ها</th>
                            <th className="py-2.5 px-3">مجموع فعالیت‌ها</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#2d2d30]/60">
                          {sortedCompanies.map(([comp, stats], idx) => (
                            <tr key={comp} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/40 transition-colors">
                              <td className="py-2.5 px-3 text-slate-400 text-center font-bold font-mono text-[10px]">
                                {toPersianDigits(idx + 1)}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{comp}</td>
                              <td className="py-2.5 px-3 font-mono text-rose-600 dark:text-rose-400 font-bold">{toPersianDigits(stats.failures)}</td>
                              <td className="py-2.5 px-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold">{toPersianDigits(stats.services)}</td>
                              <td className="py-2.5 px-3 font-mono font-bold text-amber-600 dark:text-amber-400">{toPersianDigits(stats.failures + stats.services)} مورد</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* تحلیل ۳: تفکیک رانندگان و پرسنل */}
              {(analyticsViewMode === 'all' || analyticsViewMode === 'drivers') && (
                <div className="bg-white dark:bg-[#161618] border border-slate-200 dark:border-[#2d2d30] rounded-xl p-4 sm:p-5 space-y-3.5 shadow-xs">
                  <h4 className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    تحلیل رویدادها بر اساس راننده / تحویل‌گیرنده خودرو
                  </h4>
                  {sortedDrivers.length === 0 ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">هیچ داده‌ای ثبت نشده است.</div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#2d2d30]">
                      <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] text-slate-600 dark:text-slate-400 font-bold">
                            <th className="py-2.5 px-3 text-center w-12">ردیف</th>
                            <th className="py-2.5 px-3">نام راننده / پرسنل</th>
                            <th className="py-2.5 px-3 text-rose-600 dark:text-rose-400">تعداد خرابی‌های ثبت شده</th>
                            <th className="py-2.5 px-3 text-indigo-600 dark:text-indigo-400">تعداد سرویس‌های انجام شده</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#2d2d30]/60">
                          {sortedDrivers.map(([drv, stats], idx) => (
                            <tr key={drv} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/40 transition-colors">
                              <td className="py-2.5 px-3 text-slate-400 text-center font-bold font-mono text-[10px]">
                                {toPersianDigits(idx + 1)}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{drv}</td>
                              <td className="py-2.5 px-3 font-mono text-rose-600 dark:text-rose-400 font-bold">{toPersianDigits(stats.failures)}</td>
                              <td className="py-2.5 px-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold">{toPersianDigits(stats.services)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* تحلیل ۴: خدمات دوره‌ای پرتکرار به صورت جدول/لیست */}
              {(analyticsViewMode === 'all' || analyticsViewMode === 'services') && (
                <div className="bg-white dark:bg-[#161618] border border-slate-200 dark:border-[#2d2d30] rounded-xl p-4 sm:p-5 space-y-3.5 shadow-xs">
                  <h4 className="font-extrabold text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                    <Wrench className="w-4 h-4" />
                    خدمات دوره‌ای و تعمیرگاهی پرتکرار (بیشترین خدمات انجام شده)
                  </h4>
                  {sortedServiceTypes.length === 0 ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">هیچ سرویسی در بازه انتخابی ثبت نشده است.</div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#2d2d30]">
                      <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] text-slate-600 dark:text-slate-400 font-bold">
                            <th className="py-2.5 px-3 text-center w-12">ردیف</th>
                            <th className="py-2.5 px-3">عنوان نوع خدمت / سرویس دوره‌ای</th>
                            <th className="py-2.5 px-3 text-center text-indigo-600 dark:text-indigo-400">تعداد نوبت انجام شده</th>
                            <th className="py-2.5 px-3 text-center">سهم از کل سرویس‌ها</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#2d2d30]/60">
                          {sortedServiceTypes.map(([sType, count], idx) => {
                            const totalS = sortedServiceTypes.reduce((acc, [, c]) => acc + c, 0);
                            const percent = totalS > 0 ? Math.round((count / totalS) * 100) : 0;
                            return (
                              <tr key={sType} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/40 transition-colors">
                                <td className="py-2.5 px-3 text-slate-400 text-center font-bold font-mono text-[10px]">
                                  {toPersianDigits(idx + 1)}
                                </td>
                                <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                                  {sType}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-center text-indigo-600 dark:text-indigo-400 font-bold">
                                  {toPersianDigits(count)} نوبت
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40 font-mono">
                                    {toPersianDigits(percent)}٪
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* حالت پرونده جامع ۳۶۰ درجه خودرو */}
          {selectedModule === 'vehicle_comprehensive' && (
            <div className="space-y-10">
              {reportData.length === 0 ? (
                <div className="text-center py-16 text-slate-400 space-y-3">
                  <Truck className="w-12 h-12 mx-auto text-slate-600" />
                  <p className="font-bold text-sm">
                    {vehicleFilter === 'all' 
                      ? 'لطفاً برای مشاهده پرونده جامع ۳۶۰ درجه، خودروی مورد نظر خود را از فیلتر بالا انتخاب کنید.' 
                      : 'هیچ خودرویی با فیلتر انتخاب‌شده یافت نشد.'}
                  </p>
                </div>
              ) : (
                (reportData as Vehicle[]).map((v: Vehicle) => {
                  // دریافت تمامی سوابق این خودرو
                  const vServices = services.filter(s => {
                    if (s.vehicleId !== v.id) return false;
                    if (startDate && s.serviceDate < startDate) return false;
                    if (endDate && s.serviceDate > endDate) return false;
                    return true;
                  });

                  const vFailures = failures.filter(f => {
                    if (f.vehicleId !== v.id) return false;
                    if (startDate && f.failureDate < startDate) return false;
                    if (endDate && f.failureDate > endDate) return false;
                    return true;
                  });

                  const vExpenses = expenses.filter(e => {
                    if (e.vehicleId !== v.id) return false;
                    if (startDate && e.expenseDate < startDate) return false;
                    if (endDate && e.expenseDate > endDate) return false;
                    return true;
                  });

                  const vHistory = vehicleHistory.filter(h => h.vehicleId === v.id);

                  const totalVehicleExpense = vExpenses.reduce((sum, e) => sum + (Number(e.cost) || 0), 0);

                  return (
                    <div key={v.id} className="bg-white dark:bg-[#161618] border border-slate-200 dark:border-[#2d2d30] rounded-2xl p-6 space-y-6 print:bg-white print:border-slate-300 print:p-0 shadow-xs">
                      
                      {/* هدر شناسنامه خودرو */}
                      <div className="flex flex-wrap justify-between items-center gap-4 bg-slate-50 dark:bg-[#1a1a1c] p-4 rounded-xl border border-slate-200 dark:border-[#2d2d30] print:bg-slate-100 print:border-slate-300">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-indigo-600/10 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 rounded-xl print:border-slate-400 print:text-black">
                            <Truck className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white print:text-black">{v.name} ({v.code})</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 print:text-slate-700 mt-0.5">برند/مدل: {v.brand} {v.model} ({toPersianDigits(v.productionYear || '')})</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-bold text-slate-700 dark:text-slate-300 print:text-black">
                          <div className="bg-white dark:bg-[#111113] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#2d2d30] print:bg-white print:border-slate-300">
                            پلاک: <span className="text-indigo-600 dark:text-indigo-400 print:text-black font-mono">{v.plaque}</span>
                          </div>
                          <div className="bg-white dark:bg-[#111113] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#2d2d30] print:bg-white print:border-slate-300">
                            راننده فعلی: <span className="text-emerald-600 dark:text-emerald-400 print:text-black">{v.driverName || 'ثبت نشده'}</span>
                          </div>
                          <div className="bg-white dark:bg-[#111113] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#2d2d30] print:bg-white print:border-slate-300">
                            شرکت: <span className="text-amber-600 dark:text-amber-400 print:text-black">{v.company || 'ثبت نشده'}</span>
                          </div>
                        </div>
                      </div>

                      {/* خلاصه آماری خودرو */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div className="bg-slate-50 dark:bg-[#111113] p-3 rounded-xl border border-slate-200 dark:border-[#2d2d30] print:border-slate-300">
                          <span className="text-slate-500 dark:text-slate-400 print:text-slate-700 block text-[10px]">تعداد کل خرابی‌ها</span>
                          <span className="text-rose-600 dark:text-rose-400 print:text-rose-700 font-extrabold text-sm">{toPersianDigits(vFailures.length)} مورد</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-[#111113] p-3 rounded-xl border border-slate-200 dark:border-[#2d2d30] print:border-slate-300">
                          <span className="text-slate-500 dark:text-slate-400 print:text-slate-700 block text-[10px]">تعداد سرویس‌ها</span>
                          <span className="text-indigo-600 dark:text-indigo-400 print:text-indigo-800 font-extrabold text-sm">{toPersianDigits(vServices.length)} مورد</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-[#111113] p-3 rounded-xl border border-slate-200 dark:border-[#2d2d30] print:border-slate-300">
                          <span className="text-slate-500 dark:text-slate-400 print:text-slate-700 block text-[10px]">مجموع هزینه‌ها (ریال)</span>
                          <span className="text-emerald-600 dark:text-emerald-400 print:text-emerald-800 font-extrabold text-sm font-mono">{totalVehicleExpense.toLocaleString()}</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-[#111113] p-3 rounded-xl border border-slate-200 dark:border-[#2d2d30] print:border-slate-300">
                          <span className="text-slate-500 dark:text-slate-400 print:text-slate-700 block text-[10px]">سوابق تغییر تحویل</span>
                          <span className="text-amber-600 dark:text-amber-400 print:text-amber-800 font-extrabold text-sm">{toPersianDigits(vHistory.length)} نوبت</span>
                        </div>
                      </div>

                      {/* ۱. سوابق خرابی‌ها و تعمیرگاه */}
                      <div className="space-y-2">
                        <h4 className="font-bold text-xs text-rose-400 print:text-black flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4" />
                          ۱. سوابق خرابی‌ها و تعمیرات (همراه با تحویل‌گیرنده و شرکت زمان وقوع)
                        </h4>
                        {vFailures.length === 0 ? (
                          <div className="text-xs text-slate-500 py-2">هیچ سابقه خرابی برای این خودرو ثبت نشده است.</div>
                        ) : (
                          <div className="overflow-hidden rounded-lg border border-[#2d2d30]">
                            <table className="w-full text-right text-[11px] text-slate-300 border-collapse">
                              <thead>
                                <tr className="border-b border-[#2d2d30] bg-[#161618] text-slate-400 font-bold">
                                  <th className="py-2 px-3 text-center w-12">ردیف</th>
                                  <th className="py-2 px-3">تاریخ وقوع</th>
                                  <th className="py-2 px-3">بخش آسیب‌دیده</th>
                                  <th className="py-2 px-3">شرح عیب</th>
                                  <th className="py-2 px-3 text-emerald-400">راننده زمان وقوع</th>
                                  <th className="py-2 px-3 text-amber-400">شرکت / پروژه</th>
                                  <th className="py-2 px-3">وضعیت</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#2d2d30]/60">
                                {vFailures.map((f, idx) => {
                                  const { driver, company } = getItemDriverAndCompany(f, v.id);
                                  return (
                                    <tr key={f.id} className="hover:bg-[#1a1a1c]/40 transition-colors">
                                      <td className="py-2 px-3 text-slate-500 text-center font-bold font-mono text-[10px]">{toPersianDigits(idx + 1)}</td>
                                      <td className="py-2 px-3 text-slate-400 font-sans">{toJalaliDate(f.failureDate)}</td>
                                      <td className="py-2 px-3 font-bold text-white">{f.failureType}</td>
                                      <td className="py-2 px-3 text-slate-400">{f.description}</td>
                                      <td className="py-2 px-3 font-bold text-emerald-300">{driver}</td>
                                      <td className="py-2 px-3 font-bold text-amber-300">{company}</td>
                                      <td className="py-2 px-3 font-bold text-indigo-400">{f.status}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* ۲. سوابق سرویس‌های دوره‌ای */}
                      <div className="space-y-2">
                        <h4 className="font-bold text-xs text-indigo-400 print:text-black flex items-center gap-1.5">
                          <Wrench className="w-4 h-4" />
                          ۲. سوابق سرویس‌های دوره‌ای و نگهداری (تعویض روغن و فیلترها)
                        </h4>
                        {vServices.length === 0 ? (
                          <div className="text-xs text-slate-500 py-2">هیچ سابقه سرویسی برای این خودرو ثبت نشده است.</div>
                        ) : (
                          <div className="overflow-hidden rounded-lg border border-[#2d2d30]">
                            <table className="w-full text-right text-[11px] text-slate-300 border-collapse">
                              <thead>
                                <tr className="border-b border-[#2d2d30] bg-[#161618] text-slate-400 font-bold">
                                  <th className="py-2 px-3 text-center w-12">ردیف</th>
                                  <th className="py-2 px-3">تاریخ انجام</th>
                                  <th className="py-2 px-3">نوع سرویس</th>
                                  <th className="py-2 px-3">کیلومتر فعلی</th>
                                  <th className="py-2 px-3 text-emerald-400">راننده زمان انجام</th>
                                  <th className="py-2 px-3 text-amber-400">شرکت / پروژه</th>
                                  <th className="py-2 px-3">مبلغ فاکتور (ریال)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#2d2d30]/60">
                                {vServices.map((s, idx) => {
                                  const { driver, company } = getItemDriverAndCompany(s, v.id);
                                  return (
                                    <tr key={s.id} className="hover:bg-[#1a1a1c]/40 transition-colors">
                                      <td className="py-2 px-3 text-slate-500 text-center font-bold font-mono text-[10px]">{toPersianDigits(idx + 1)}</td>
                                      <td className="py-2 px-3 text-slate-400 font-sans">{toJalaliDate(s.serviceDate)}</td>
                                      <td className="py-2 px-3 font-bold text-white">{s.serviceType}</td>
                                      <td className="py-2 px-3 text-slate-300 font-mono">{s.currentKm?.toLocaleString()}</td>
                                      <td className="py-2 px-3 font-bold text-emerald-300">{driver}</td>
                                      <td className="py-2 px-3 font-bold text-amber-300">{company}</td>
                                      <td className="py-2 px-3 font-mono text-emerald-400 font-bold">{getServiceCost(s).toLocaleString()}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* ۳. سوابق مخارج و فاکتورها */}
                      <div className="space-y-2">
                        <h4 className="font-bold text-xs text-emerald-400 print:text-black flex items-center gap-1.5">
                          <DollarSign className="w-4 h-4" />
                          ۳. سوابق کلیه فاکتورها و هزینه‌های مالی ثبت شده
                        </h4>
                        {vExpenses.length === 0 ? (
                          <div className="text-xs text-slate-500 py-2">هیچ فاکتور هزینه‌ای برای این خودرو ثبت نشده است.</div>
                        ) : (
                          <div className="overflow-hidden rounded-lg border border-[#2d2d30]">
                            <table className="w-full text-right text-[11px] text-slate-300 border-collapse">
                              <thead>
                                <tr className="border-b border-[#2d2d30] bg-[#161618] text-slate-400 font-bold">
                                  <th className="py-2 px-3 text-center w-12">ردیف</th>
                                  <th className="py-2 px-3">تاریخ سند</th>
                                  <th className="py-2 px-3">نوع هزینه</th>
                                  <th className="py-2 px-3">شرح تراکنش</th>
                                  <th className="py-2 px-3 text-emerald-400">راننده در آن زمان</th>
                                  <th className="py-2 px-3 text-amber-400">شرکت / پروژه</th>
                                  <th className="py-2 px-3">مبلغ (ریال)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#2d2d30]/60">
                                {vExpenses.map((e, idx) => {
                                  const { driver, company } = getItemDriverAndCompany(e, v.id);
                                  return (
                                    <tr key={e.id} className="hover:bg-[#1a1a1c]/40 transition-colors">
                                      <td className="py-2 px-3 text-slate-500 text-center font-bold font-mono text-[10px]">{toPersianDigits(idx + 1)}</td>
                                      <td className="py-2 px-3 text-slate-400 font-sans">{toJalaliDate(e.expenseDate)}</td>
                                      <td className="py-2 px-3 font-bold text-white capitalize">{e.expenseType}</td>
                                      <td className="py-2 px-3 text-slate-400">{e.description || '---'}</td>
                                      <td className="py-2 px-3 font-bold text-emerald-300">{driver}</td>
                                      <td className="py-2 px-3 font-bold text-amber-300">{company}</td>
                                      <td className="py-2 px-3 font-mono text-emerald-400 font-bold">{e.cost?.toLocaleString()}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* ۴. تاریخچه انتساب‌ها و تغییرات تحویل خودرو */}
                      <div className="space-y-2">
                        <h4 className="font-bold text-xs text-amber-400 print:text-black flex items-center gap-1.5">
                          <History className="w-4 h-4" />
                          ۴. تاریخچه انتساب‌ها و جابه‌جایی تحویل خودرو (راننده، شرکت، پلاک)
                        </h4>
                        {vHistory.length === 0 ? (
                          <div className="text-xs text-slate-500 py-2">هیچ سابقه تغییر تحویلی برای این خودرو ثبت نشده است.</div>
                        ) : (
                          <div className="overflow-hidden rounded-lg border border-[#2d2d30]">
                            <table className="w-full text-right text-[11px] text-slate-300 border-collapse">
                              <thead>
                                <tr className="border-b border-[#2d2d30] bg-[#161618] text-slate-400 font-bold">
                                  <th className="py-2 px-3 text-center w-12">ردیف</th>
                                  <th className="py-2 px-3">تاریخ تغییر</th>
                                  <th className="py-2 px-3">موضوع تغییر</th>
                                  <th className="py-2 px-3 text-rose-400">مقدار قبلی</th>
                                  <th className="py-2 px-3 text-emerald-400">مقدار جدید</th>
                                  <th className="py-2 px-3">ثبت‌کننده</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#2d2d30]/60">
                                {vHistory.map((h, idx) => (
                                  <tr key={h.id || idx} className="hover:bg-[#1a1a1c]/40 transition-colors">
                                    <td className="py-2 px-3 text-slate-500 text-center font-bold font-mono text-[10px]">{toPersianDigits(idx + 1)}</td>
                                    <td className="py-2 px-3 text-slate-400 font-sans">{toJalaliDate(h.changeDate)}</td>
                                    <td className="py-2 px-3 font-bold text-amber-300">{h.fieldLabel || h.field}</td>
                                    <td className="py-2 px-3 text-slate-400 line-through">{h.oldValue || 'ثبت نشده'}</td>
                                    <td className="py-2 px-3 font-bold text-emerald-300">{h.newValue || 'ثبت نشده'}</td>
                                    <td className="py-2 px-3 text-slate-400">{h.changedBy || 'مدیر سیستم'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* حالت کلیه جدول‌های گزارش (خرابی‌ها، سرویس‌ها، مخارج، بیمه‌نامه‌ها، خودروها، رانندگان، شرکت‌ها) */}
          {selectedModule !== 'analytics' && selectedModule !== 'vehicle_comprehensive' && (
            <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-900 dark:text-white font-extrabold text-[11px]">
                  <List className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>{reportDetails[selectedModule]?.title || 'جدول سوابق و گزارش ناوگان'}</span>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{toPersianDigits(rawReportData.length)} مورد</span>
              </div>

              <div className="overflow-x-auto">
                {/* ۱. گزارش خرابی‌ها */}
                {selectedModule === 'failures' && (
                  <table className="w-full text-right text-xs font-mono font-bold text-slate-700 dark:text-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-[#161618] border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-mono font-bold text-xs">
                        <th className="py-2 px-3 text-center w-12 text-xs font-mono font-bold">ردیف</th>
                        <TableColumnHeader colKey="vehicle" title="خودرو" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['vehicle']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="driverName" title="راننده زمان وقوع" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['driverName']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="company" title="شرکت / پروژه" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['company']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="failureType" title="بخش آسیب‌دیده / قطعه" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['failureType']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="failureDate" title="تاریخ وقوع" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['failureDate']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="description" title="شرح عیب" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['description']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="status" title="وضعیت گردش کار" align="center" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['status']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="cost" title="هزینه فاکتور (ریال)" align="left" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['cost']} onOpenFilter={handleOpenFilterMenu} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                      {reportData.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center py-8 text-slate-500 font-bold">
                            هیچ رکوردی برای نمایش یافت نشد.
                          </td>
                        </tr>
                      ) : (
                        reportData.map((f: any, index: number) => {
                          const { driver, company, vehicle: v } = getItemDriverAndCompany(f, f.vehicleId);
                          return (
                            <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/40 transition-colors">
                              <td className="py-1.5 px-3 text-slate-500 text-center font-bold font-mono text-[10px]">{toPersianDigits((currentPage - 1) * pageSize + index + 1)}</td>
                              <td className="py-1.5 px-3 text-slate-900 dark:text-white font-bold">
                                <div>{v ? v.name : 'N/A'}</div>
                                {v && <div className="text-[10px] text-slate-400 font-mono">{v.plaque}</div>}
                              </td>
                              <td className="py-1.5 px-3 text-emerald-600 dark:text-emerald-300 font-bold">{driver}</td>
                              <td className="py-1.5 px-3 text-amber-600 dark:text-amber-300 font-bold">{company}</td>
                              <td className="py-1.5 px-3 text-slate-800 dark:text-slate-200 font-medium">
                                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
                                  {f.failureType || 'نامشخص'}
                                </span>
                              </td>
                              <td className="py-1.5 px-3 text-slate-500 dark:text-slate-400 font-sans">{toJalaliDate(f.failureDate)}</td>
                              <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">{f.description || '---'}</td>
                              <td className="py-1.5 px-3 text-center">
                                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40">
                                  {f.status || 'ثبت شده'}
                                </span>
                              </td>
                              <td className="py-1.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-left">
                                {f.cost ? Number(f.cost).toLocaleString() : '۰'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}

                {/* ۲. گزارش خدمات دوره‌ای */}
                {selectedModule === 'services' && (
                  <table className="w-full text-right text-xs font-mono font-bold text-slate-700 dark:text-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-[#161618] border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-mono font-bold text-xs">
                        <th className="py-2 px-3 text-center w-12 text-xs font-mono font-bold">ردیف</th>
                        <TableColumnHeader colKey="vehicle" title="خودرو" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['vehicle']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="driverName" title="راننده زمان انجام" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['driverName']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="company" title="شرکت / پروژه" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['company']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="serviceType" title="نوع خدمات دوره‌ای" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['serviceType']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="serviceDate" title="تاریخ انجام" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['serviceDate']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="currentKm" title="کیلومتر فعلی" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['currentKm']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="cost" title="هزینه فاکتور (ریال)" align="left" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['cost']} onOpenFilter={handleOpenFilterMenu} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                      {reportData.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-slate-500 font-bold">
                            هیچ رکوردی برای نمایش یافت نشد.
                          </td>
                        </tr>
                      ) : (
                        reportData.map((s: any, index: number) => {
                          const { driver, company, vehicle: v } = getItemDriverAndCompany(s, s.vehicleId);
                          return (
                            <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/40 transition-colors">
                              <td className="py-1.5 px-3 text-slate-500 text-center font-bold font-mono text-[10px]">{toPersianDigits((currentPage - 1) * pageSize + index + 1)}</td>
                              <td className="py-1.5 px-3 text-slate-900 dark:text-white font-bold">
                                <div>{v ? v.name : 'N/A'}</div>
                                {v && <div className="text-[10px] text-slate-400 font-mono">{v.plaque}</div>}
                              </td>
                              <td className="py-1.5 px-3 text-emerald-600 dark:text-emerald-300 font-bold">{driver}</td>
                              <td className="py-1.5 px-3 text-amber-600 dark:text-amber-300 font-bold">{company}</td>
                              <td className="py-1.5 px-3 text-slate-800 dark:text-slate-200 font-bold">
                                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                                  {s.serviceType}
                                </span>
                              </td>
                              <td className="py-1.5 px-3 text-slate-500 dark:text-slate-400 font-sans">{toJalaliDate(s.serviceDate)}</td>
                              <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300 font-mono">{s.currentKm ? Number(s.currentKm).toLocaleString() : '---'}</td>
                              <td className="py-1.5 px-3 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-left">{s.cost ? Number(s.cost).toLocaleString() : '۰'}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}

                {/* ۳. گزارش هزینه‌ها و مخارج */}
                {selectedModule === 'expenses' && (
                  <table className="w-full text-right text-xs font-mono font-bold text-slate-700 dark:text-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-[#161618] border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-mono font-bold text-xs">
                        <th className="py-2 px-3 text-center w-12 text-xs font-mono font-bold">ردیف</th>
                        <TableColumnHeader colKey="vehicle" title="خودرو" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['vehicle']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="driverName" title="راننده زمان سند" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['driverName']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="company" title="شرکت / پروژه" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['company']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="expenseType" title="نوع هزینه" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['expenseType']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="expenseDate" title="تاریخ سند" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['expenseDate']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="description" title="شرح تراکنش مالی" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['description']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="cost" title="مبلغ (ریال)" align="left" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['cost']} onOpenFilter={handleOpenFilterMenu} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                      {reportData.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-slate-500 font-bold">
                            هیچ رکوردی برای نمایش یافت نشد.
                          </td>
                        </tr>
                      ) : (
                        reportData.map((e: any, index: number) => {
                          const { driver, company, vehicle: v } = getItemDriverAndCompany(e, e.vehicleId);
                          return (
                            <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/40 transition-colors">
                              <td className="py-1.5 px-3 text-slate-500 text-center font-bold font-mono text-[10px]">{toPersianDigits((currentPage - 1) * pageSize + index + 1)}</td>
                              <td className="py-1.5 px-3 text-slate-900 dark:text-white font-bold">
                                <div>{v ? v.name : 'N/A'}</div>
                                {v && <div className="text-[10px] text-slate-400 font-mono">{v.plaque}</div>}
                              </td>
                              <td className="py-1.5 px-3 text-emerald-600 dark:text-emerald-300 font-bold">{driver}</td>
                              <td className="py-1.5 px-3 text-amber-600 dark:text-amber-300 font-bold">{company}</td>
                              <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300">
                                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {e.expenseType}
                                </span>
                              </td>
                              <td className="py-1.5 px-3 text-slate-500 dark:text-slate-400 font-sans">{toJalaliDate(e.expenseDate)}</td>
                              <td className="py-1.5 px-3 text-slate-500 dark:text-slate-400">{e.description || '---'}</td>
                              <td className="py-1.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-left">{Number(e.cost).toLocaleString()}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}

                {/* ۴. گزارش بیمه‌نامه‌ها */}
                {selectedModule === 'insurance' && (
                  <table className="w-full text-right text-xs font-mono font-bold text-slate-700 dark:text-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-[#161618] border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-mono font-bold text-xs">
                        <th className="py-2 px-3 text-center w-12 text-xs font-mono font-bold">ردیف</th>
                        <TableColumnHeader colKey="vehicle" title="خودرو" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['vehicle']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="driverName" title="راننده فعلی" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['driverName']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="company" title="شرکت / پروژه" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['company']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="insuranceType" title="نوع بیمه" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['insuranceType']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="insuranceCompany" title="بیمه‌گر" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['insuranceCompany']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="endDate" title="پایان اعتبار" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['endDate']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="cost" title="مبلغ حق‌بیمه (ریال)" align="left" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['cost']} onOpenFilter={handleOpenFilterMenu} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                      {reportData.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-slate-500 font-bold">
                            هیچ رکوردی برای نمایش یافت نشد.
                          </td>
                        </tr>
                      ) : (
                        reportData.map((i: any, index: number) => {
                          const { driver, company, vehicle: v } = getItemDriverAndCompany(i, i.vehicleId);
                          return (
                            <tr key={i.id} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/40 transition-colors">
                              <td className="py-1.5 px-3 text-slate-500 text-center font-bold font-mono text-[10px]">{toPersianDigits((currentPage - 1) * pageSize + index + 1)}</td>
                              <td className="py-1.5 px-3 text-slate-900 dark:text-white font-bold">
                                <div>{v ? v.name : 'N/A'}</div>
                                {v && <div className="text-[10px] text-slate-400 font-mono">{v.plaque}</div>}
                              </td>
                              <td className="py-1.5 px-3 text-emerald-600 dark:text-emerald-300 font-bold">{driver}</td>
                              <td className="py-1.5 px-3 text-amber-600 dark:text-amber-300 font-bold">{company}</td>
                              <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300 font-bold">
                                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                                  {i.insuranceType === 'third_party' ? 'شخص ثالث' : 'بدنه'}
                                </span>
                              </td>
                              <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300">{i.insuranceCompany}</td>
                              <td className="py-1.5 px-3 text-rose-600 dark:text-rose-400 font-sans font-bold">{toJalaliDate(i.endDate)}</td>
                              <td className="py-1.5 px-3 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-left">{Number(i.cost).toLocaleString()}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}

                {/* ۵. گزارش ناوگان خودرویی */}
                {selectedModule === 'vehicles' && (
                  <table className="w-full text-right text-xs font-mono font-bold text-slate-700 dark:text-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-[#161618] border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-mono font-bold text-xs">
                        <th className="py-2 px-3 text-center w-12 text-xs font-mono font-bold">ردیف</th>
                        <TableColumnHeader colKey="plaque" title="پلاک ملی خودرو" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['plaque']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="name" title="نام تجاری و مدل" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['name']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="driverName" title="راننده منتسب فعلی" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['driverName']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="company" title="شرکت / پروژه" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['company']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="type" title="نوع کاربری" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['type']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="status" title="وضعیت جاری" align="center" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['status']} onOpenFilter={handleOpenFilterMenu} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                      {reportData.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-500 font-bold">
                            هیچ رکوردی برای نمایش یافت نشد.
                          </td>
                        </tr>
                      ) : (
                        reportData.map((v: any, index: number) => {
                          return (
                            <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/40 transition-colors">
                              <td className="py-1.5 px-3 text-slate-500 text-center font-bold font-mono text-[10px]">{toPersianDigits((currentPage - 1) * pageSize + index + 1)}</td>
                              <td className="py-1.5 px-3 text-slate-800 dark:text-slate-200 font-mono text-center font-bold text-[12px]">{v.plaque}</td>
                              <td className="py-1.5 px-3 text-slate-900 dark:text-white font-bold">{v.name} {v.brand && `(${v.brand} ${v.model || ''})`}</td>
                              <td className="py-1.5 px-3 text-emerald-600 dark:text-emerald-300 font-bold">{v.driverName || 'ثبت نشده'}</td>
                              <td className="py-1.5 px-3 text-amber-600 dark:text-amber-300 font-bold">{v.company || 'ثبت نشده'}</td>
                              <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300">
                                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {v.type === 'light' ? 'سواری سبک' : 'سنگین ترابری'}
                                </span>
                              </td>
                              <td className="py-1.5 px-3 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                  v.status === 'active'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40'
                                    : v.status === 'repair'
                                    ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/40'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                }`}>
                                  {v.status === 'active' ? 'آماده جاده' : v.status === 'repair' ? 'متوقف تعمیرگاه' : 'غیرفعال'}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}

                {/* ۶. گزارش رانندگان */}
                {selectedModule === 'drivers' && (
                  <table className="w-full text-right text-xs font-mono font-bold text-slate-700 dark:text-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-[#161618] border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-mono font-bold text-xs">
                        <th className="py-2 px-3 text-center w-12 text-xs font-mono font-bold">ردیف</th>
                        <TableColumnHeader colKey="name" title="نام راننده / پرسنل" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['name']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="vehicles" title="خودروهای منتسب" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['vehicles']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="failures" title="تعداد خرابی‌های ثبت شده" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['failures']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="services" title="تعداد سرویس‌های انجام شده" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['services']} onOpenFilter={handleOpenFilterMenu} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                      {reportData.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-slate-500 font-bold">
                            هیچ رکوردی برای نمایش یافت نشد.
                          </td>
                        </tr>
                      ) : (
                        (reportData as any[]).map(([drv, stats]: [string, any], idx: number) => (
                          <tr key={drv} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/40 transition-colors">
                            <td className="py-1.5 px-3 text-slate-500 text-center font-bold font-mono text-[10px]">
                              {toPersianDigits((currentPage - 1) * pageSize + idx + 1)}
                            </td>
                            <td className="py-1.5 px-3 font-bold text-slate-900 dark:text-white">{drv}</td>
                            <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300">{stats.vehicles.join(', ') || '---'}</td>
                            <td className="py-1.5 px-3 font-mono text-rose-600 dark:text-rose-400 font-bold">{toPersianDigits(stats.failures)}</td>
                            <td className="py-1.5 px-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold">{toPersianDigits(stats.services)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

                {/* ۷. گزارش شرکت‌ها و پروژه‌ها */}
                {selectedModule === 'companies' && (
                  <table className="w-full text-right text-xs font-mono font-bold text-slate-700 dark:text-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-[#161618] border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-mono font-bold text-xs">
                        <th className="py-2 px-3 text-center w-12 text-xs font-mono font-bold">ردیف</th>
                        <TableColumnHeader colKey="name" title="نام شرکت / پروژه" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['name']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="vehicles" title="خودروهای منتسب" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['vehicles']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="failures" title="تعداد خرابی‌ها" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['failures']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="services" title="تعداد سرویس‌ها" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['services']} onOpenFilter={handleOpenFilterMenu} />
                        <TableColumnHeader colKey="total" title="مجموع فعالیت‌ها" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} isFiltered={!!columnFilters['total']} onOpenFilter={handleOpenFilterMenu} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                      {reportData.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-slate-500 font-bold">
                            هیچ رکوردی برای نمایش یافت نشد.
                          </td>
                        </tr>
                      ) : (
                        (reportData as any[]).map(([comp, stats]: [string, any], idx: number) => (
                          <tr key={comp} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/40 transition-colors">
                            <td className="py-1.5 px-3 text-slate-500 text-center font-bold font-mono text-[10px]">
                              {toPersianDigits((currentPage - 1) * pageSize + idx + 1)}
                            </td>
                            <td className="py-1.5 px-3 font-bold text-slate-900 dark:text-white">{comp}</td>
                            <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300">{stats.vehicles.join(', ') || '---'}</td>
                            <td className="py-1.5 px-3 font-mono text-rose-600 dark:text-rose-400 font-bold">{toPersianDigits(stats.failures)}</td>
                            <td className="py-1.5 px-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold">{toPersianDigits(stats.services)}</td>
                            <td className="py-1.5 px-3 font-mono font-bold text-amber-600 dark:text-amber-400">{toPersianDigits(stats.failures + stats.services)} مورد</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={sortedReportData.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          )}
        </div>

        {/* امضاهای مجاز در گزارش پرینت */}
        <div className="hidden print:grid grid-cols-3 gap-8 pt-12 text-center text-[10px] font-bold text-slate-700">
          <div className="space-y-12">
            <div>تنظیم‌کننده (کارپرداز ترابری)</div>
            <div className="text-slate-400">محل امضا و اثر انگشت</div>
          </div>
          <div className="space-y-12">
            <div>حسابرس ارشد ناوگان</div>
            <div className="text-slate-400">محل امضا و مهر امور مالی</div>
          </div>
          <div className="space-y-12">
            <div>مدیریت عامل ترابری صباصنعت</div>
            <div className="text-slate-400">محل امضا و مهر مجاز</div>
          </div>
        </div>

        {/* منوی شناور فیلتر ستون‌ها */}
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
    </div>
  );
}
