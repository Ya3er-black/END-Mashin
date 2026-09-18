/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Car, AlertTriangle, ArrowLeft, ArrowUpRight, Calendar, Clock, CheckCircle2, 
  TrendingUp, PhoneCall, Gauge, Wrench, Package, ShieldCheck, 
  FileText, Sparkles, ChevronRight, X, BarChart3, Users,
  Layers, ShieldAlert, Check, Filter, SlidersHorizontal, Eye,
  Building, Activity, Zap, Info, ChevronDown, ChevronUp,
  RotateCcw, History, ArrowDownRight, AlertCircle, FileSpreadsheet,
  Wallet, CalendarClock, Search
} from 'lucide-react';
import { 
  Vehicle, PeriodicService, Insurance, TechnicalInspection, 
  VehicleFailure, Expense, Company, ServiceDefinition, RepairWorkflow,
  PartInventory, OdometerLog
} from '../types';
import { toPersianDigits, formatPrice, formatNumber } from '../utils/numberUtils';
import { getCurrentJalaliDate, jalaliDayDifference, toJalaliDate, formatRelativeDays } from '../utils/date';
import { calculateComprehensiveServiceHealth } from '../utils/serviceMatching';
import DashboardQuickTasksSection from './DashboardQuickTasksSection';

interface DashboardViewProps {
  vehicles: Vehicle[];
  services: PeriodicService[];
  insurances: Insurance[];
  inspections: TechnicalInspection[];
  failures: VehicleFailure[];
  expenses: Expense[];
  companies: Company[];
  serviceDefinitions?: ServiceDefinition[];
  workflows?: RepairWorkflow[];
  parts?: PartInventory[];
  odometerLogs?: OdometerLog[];
  onNavigate: (view: string) => void;
  selectedCompany?: string;
  onSelectCompany?: (company: string) => void;
}

type DashboardTab = 'alerts' | 'activities' | 'watchlist' | 'analytics';

export default function DashboardView({
  vehicles = [],
  services = [],
  insurances = [],
  inspections = [],
  failures = [],
  expenses = [],
  companies = [],
  serviceDefinitions = [],
  workflows = [],
  parts = [],
  odometerLogs = [],
  onNavigate,
  selectedCompany,
  onSelectCompany
}: DashboardViewProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('alerts');
  const [internalCompanyFilter, setInternalCompanyFilter] = useState<string>('all');
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const companyDropdownRef = useRef<HTMLDivElement>(null);

  const selectedCompanyFilter = selectedCompany !== undefined ? selectedCompany : internalCompanyFilter;

  const handleSelectCompany = (companyName: string) => {
    if (onSelectCompany) {
      onSelectCompany(companyName);
    } else {
      setInternalCompanyFilter(companyName);
    }
    setIsCompanyDropdownOpen(false);
    setCompanySearchQuery('');
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(event.target as Node)) {
        setIsCompanyDropdownOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsCompanyDropdownOpen(false);
      }
    }
    if (isCompanyDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCompanyDropdownOpen]);

  const [showCustomShortcuts, setShowCustomShortcuts] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const todayJalali = getCurrentJalaliDate();
  const now = new Date();

  // ۱. فیلتر ناوگان بر اساس شرکت انتخابی (در صورت انتخاب کاربر)
  const filteredVehicles = useMemo(() => {
    if (selectedCompanyFilter === 'all') return vehicles;
    return vehicles.filter(v => v.company === selectedCompanyFilter);
  }, [vehicles, selectedCompanyFilter]);

  const vehicleIdSet = useMemo(() => {
    return new Set(filteredVehicles.map(v => v.id));
  }, [filteredVehicles]);

  const filteredServices = useMemo(() => {
    if (selectedCompanyFilter === 'all') return services;
    return services.filter(s => vehicleIdSet.has(s.vehicleId) || s.company === selectedCompanyFilter);
  }, [services, selectedCompanyFilter, vehicleIdSet]);

  const filteredInsurances = useMemo(() => {
    if (selectedCompanyFilter === 'all') return insurances;
    return insurances.filter(i => vehicleIdSet.has(i.vehicleId) || i.company === selectedCompanyFilter);
  }, [insurances, selectedCompanyFilter, vehicleIdSet]);

  const filteredInspections = useMemo(() => {
    if (selectedCompanyFilter === 'all') return inspections;
    return inspections.filter(i => vehicleIdSet.has(i.vehicleId) || i.company === selectedCompanyFilter);
  }, [inspections, selectedCompanyFilter, vehicleIdSet]);

  const filteredFailures = useMemo(() => {
    if (selectedCompanyFilter === 'all') return failures;
    return failures.filter(f => vehicleIdSet.has(f.vehicleId) || f.company === selectedCompanyFilter);
  }, [failures, selectedCompanyFilter, vehicleIdSet]);

  const filteredExpenses = useMemo(() => {
    if (selectedCompanyFilter === 'all') return expenses;
    return expenses.filter(e => vehicleIdSet.has(e.vehicleId) || e.company === selectedCompanyFilter);
  }, [expenses, selectedCompanyFilter, vehicleIdSet]);

  // ۲. محاسبات آماری شاخص‌های کلیدی (KPIs)
  const totalVehicles = filteredVehicles.length;
  const activeVehicles = filteredVehicles.filter(v => v.status === 'active').length;
  const inRepairVehicles = filteredVehicles.filter(v => v.status === 'in_repair').length;
  const brokenVehicles = filteredVehicles.filter(v => v.status === 'broken').length;
  const unavailableVehicles = inRepairVehicles + brokenVehicles;

  const activePercent = totalVehicles > 0 ? Math.round((activeVehicles / totalVehicles) * 100) : 0;
  const inRepairPercent = totalVehicles > 0 ? Math.round((inRepairVehicles / totalVehicles) * 100) : 0;
  const brokenPercent = totalVehicles > 0 ? Math.round((brokenVehicles / totalVehicles) * 100) : 0;

  // هزینه‌های ماه جاری ناوگان
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  let monthlyCost = 0;
  let monthlyExpensesCount = 0;

  filteredExpenses.forEach(exp => {
    const expDate = new Date(exp.expenseDate);
    if (!isNaN(expDate.getTime())) {
      if (expDate.getFullYear() === currentYear && expDate.getMonth() === currentMonth) {
        monthlyCost += (exp.cost || 0);
        monthlyExpensesCount += 1;
      }
    } else {
      // پشتیبانی از تاریخ شمسی در صورتی که به فرمت جلالی ذخیره شده باشد
      monthlyCost += (exp.cost || 0);
      monthlyExpensesCount += 1;
    }
  });

  const persianMonthNames = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  const currentPersianMonth = persianMonthNames[currentMonth] || 'جاری';

  // محاسبات تکمیلی وضعیت کلی هزینه‌ها و مخارج تجمیعی
  const overallExpensesData = useMemo(() => {
    let totalCost = 0;
    filteredExpenses.forEach(exp => {
      totalCost += (exp.cost || 0);
    });
    const avgPerVehicle = totalVehicles > 0 ? Math.round(totalCost / totalVehicles) : 0;
    return {
      totalCost,
      totalCount: filteredExpenses.length,
      avgPerVehicle
    };
  }, [filteredExpenses, totalVehicles]);

  // محاسبه خدمات نیازمند اقدام فوری بر اساس سلامت واقعی ناوگان و پرونده‌های در جریان
  const { pendingServicesData, urgentServicesList } = useMemo(() => {
    let overdueCount = 0;
    let upcomingCount = 0;
    const inProgressCount = filteredServices.filter(s => s.status === 'in_progress').length;
    const urgentList: Array<{
      id: string;
      type: 'service';
      title: string;
      vehicleName: string;
      plaque: string;
      driverName: string;
      date: string;
      diffDays: number;
      isOverdue: boolean;
      urgency: 'critical' | 'high' | 'medium';
      detail: string;
      targetView: string;
    }> = [];

    // الف) پرونده‌های در حال انجام در تعمیرگاه
    filteredServices.filter(s => s.status === 'in_progress').forEach(s => {
      const v = filteredVehicles.find(veh => veh.id === s.vehicleId);
      urgentList.push({
        id: `srv-prog-${s.id}`,
        type: 'service',
        title: `سرویس در حال انجام: ${s.serviceType}`,
        vehicleName: v?.name || s.plaque || 'خودرو',
        plaque: v?.plaque || s.plaque || '—',
        driverName: v?.driverName || s.driverName || 'بدون راننده',
        date: s.serviceDate || todayJalali,
        diffDays: 0,
        isOverdue: false,
        urgency: 'medium',
        detail: `پذیرش شده در کیلومتر ${formatNumber(s.currentKm || 0)} (در حال انجام)`,
        targetView: 'services'
      });
    });

    // ب) سرویس‌های دارای سررسید گذشته یا در آستانه تعویض بر اساس پایش جامع کارکرد
    if (serviceDefinitions && serviceDefinitions.length > 0) {
      filteredVehicles.forEach(vehicle => {
        serviceDefinitions.forEach(def => {
          const health = calculateComprehensiveServiceHealth(
            vehicle,
            def,
            filteredServices,
            filteredFailures,
            workflows,
            parts,
            75,
            odometerLogs
          );

          if (health.hasHistory && (health.status === 'overdue' || health.status === 'warning')) {
            const isOverdue = health.status === 'overdue';
            if (isOverdue) {
              overdueCount++;
            } else {
              upcomingCount++;
            }

            const diff = health.daysRemaining !== undefined ? (isOverdue ? -Math.abs(health.daysRemaining || 1) : health.daysRemaining) : 0;
            urgentList.push({
              id: `due-${vehicle.id}-${def.id}`,
              type: 'service',
              title: `سررسید ${def.serviceType}`,
              vehicleName: vehicle.name || 'خودرو',
              plaque: vehicle.plaque || '—',
              driverName: vehicle.driverName || 'بدون راننده',
              date: health.estimatedDate && health.estimatedDate !== '-' ? health.estimatedDate : todayJalali,
              diffDays: diff,
              isOverdue,
              urgency: isOverdue ? 'critical' : 'high',
              detail: isOverdue 
                ? `گذشت ${formatNumber(Math.abs(health.remainingKm))} کیلومتر از حد مجاز (${formatNumber(health.targetDueKm)})`
                : `مانده ${formatNumber(health.remainingKm)} کیلومتر تا سررسید (${formatNumber(health.targetDueKm)})`,
              targetView: 'odometer'
            });
          }
        });
      });
    }

    const totalPending = inProgressCount + overdueCount + upcomingCount;
    return {
      pendingServicesData: { totalPending, overdueCount, upcomingCount, inProgressCount },
      urgentServicesList: urgentList
    };
  }, [filteredServices, filteredVehicles, filteredFailures, serviceDefinitions, workflows, parts, odometerLogs, todayJalali]);

  // ب) بیمه‌نامه‌های در آستانه انقضا (تا ۱۵ روز آینده)
  const urgentInsurancesList = useMemo(() => {
    return filteredInsurances.filter(i => {
      if (!i.endDate) return false;
      const diff = jalaliDayDifference(todayJalali, i.endDate);
      return diff <= 15;
    }).map(i => {
      const v = filteredVehicles.find(veh => veh.id === i.vehicleId);
      const diff = jalaliDayDifference(todayJalali, i.endDate);
      const insTypeLabel = i.insuranceType === 'third_party' ? 'بیمه شخص ثالث' : i.insuranceType === 'collision' ? 'بیمه بدنه' : 'بیمه‌نامه';
      return {
        id: `ins-${i.id}`,
        type: 'insurance' as const,
        title: `${insTypeLabel} (${i.insuranceCompany || 'نامشخص'})`,
        vehicleName: v?.name || i.plaque || 'خودرو',
        plaque: v?.plaque || i.plaque || '—',
        driverName: v?.driverName || i.driverName || 'بدون راننده',
        date: i.endDate,
        diffDays: diff,
        isOverdue: diff < 0,
        urgency: diff < 0 ? 'critical' : diff <= 5 ? 'high' : 'medium',
        detail: `شماره بیمه: ${i.policyNumber || '—'}`,
        targetView: 'insurance'
      };
    });
  }, [filteredInsurances, filteredVehicles, todayJalali]);

  // ج) معاینه فنی‌های در آستانه انقضا
  const urgentInspectionsList = useMemo(() => {
    return filteredInspections.filter(i => {
      if (!i.expiryDate) return false;
      const diff = jalaliDayDifference(todayJalali, i.expiryDate);
      return diff <= 15;
    }).map(i => {
      const v = filteredVehicles.find(veh => veh.id === i.vehicleId);
      const diff = jalaliDayDifference(todayJalali, i.expiryDate);
      return {
        id: `insp-${i.id}`,
        type: 'inspection' as const,
        title: 'معاینه فنی دوره معتبر',
        vehicleName: v?.name || i.plaque || 'خودرو',
        plaque: v?.plaque || i.plaque || '—',
        driverName: v?.driverName || i.driverName || 'بدون راننده',
        date: i.expiryDate,
        diffDays: diff,
        isOverdue: diff < 0,
        urgency: diff < 0 ? 'critical' : diff <= 5 ? 'high' : 'medium',
        detail: `مرکز صدور: ${i.inspectionCenter || '—'}`,
        targetView: 'insurance'
      };
    });
  }, [filteredInspections, filteredVehicles, todayJalali]);

  // تعداد خرابی‌های فعال با اولویت بالا
  const highPriorityFailuresCount = useMemo(() => {
    return filteredFailures.filter(f => f.status !== 'completed' && f.status !== 'approved' && f.priority === 'high').length;
  }, [filteredFailures]);

  // د) خرابی‌های فعال نیازمند ترخیص یا اقدام فوری در تعمیرگاه
  const activeFailuresList = useMemo(() => {
    return filteredFailures.filter(f => f.status !== 'completed' && f.status !== 'approved').map(f => {
      const v = filteredVehicles.find(veh => veh.id === f.vehicleId);
      return {
        id: `fail-${f.id}`,
        type: 'failure' as const,
        title: `خرابی ${f.failureType || 'فنی'}: ${f.description || 'گزارش پذیرش'}`,
        vehicleName: v?.name || f.plaque || 'خودرو',
        plaque: v?.plaque || f.plaque || '—',
        driverName: v?.driverName || f.driverName || 'بدون راننده',
        date: f.failureDate || todayJalali,
        diffDays: 0,
        isOverdue: f.priority === 'high',
        urgency: f.priority === 'high' ? 'critical' : 'medium',
        detail: `تعمیرگاه: ${f.repairShopName || 'در انتظار ارجاع'} | وضعیت: ${
          f.status === 'in_repair' ? 'در حال تعمیر' : f.status === 'assigned' ? 'ارجاع شده' : 'پذیرش اولیه'
        }`,
        targetView: 'failures'
      };
    });
  }, [filteredFailures, filteredVehicles, todayJalali]);

  // تجمیع کل هشدارهای اولویت‌دار
  const allUrgentAlerts = useMemo(() => {
    return [
      ...urgentServicesList,
      ...urgentInsurancesList,
      ...urgentInspectionsList,
      ...activeFailuresList
    ].sort((a, b) => {
      // اول موارد منقضی/بحرانی
      if (a.urgency === 'critical' && b.urgency !== 'critical') return -1;
      if (b.urgency === 'critical' && a.urgency !== 'critical') return 1;
      return a.diffDays - b.diffDays;
    });
  }, [urgentServicesList, urgentInsurancesList, urgentInspectionsList, activeFailuresList]);

  // ۴. جریان فعالیت‌های اخیر (Unified Activity Timeline)
  const recentActivities = useMemo(() => {
    const list: Array<{
      id: string;
      category: 'service' | 'failure' | 'expense';
      title: string;
      vehicleName: string;
      plaque: string;
      date: string;
      amount?: number;
      statusText: string;
      statusColor: string;
    }> = [];

    // خدمات اخیر
    filteredServices.slice(-8).forEach(s => {
      const v = filteredVehicles.find(veh => veh.id === s.vehicleId);
      list.push({
        id: `act-srv-${s.id}`,
        category: 'service',
        title: `سرویس دوره‌ای (${s.serviceType})`,
        vehicleName: v?.name || s.plaque || 'خودرو',
        plaque: v?.plaque || s.plaque || '—',
        date: s.serviceDate || toJalaliDate(s.createdAt) || todayJalali,
        amount: s.cost,
        statusText: s.status === 'completed' ? 'تکمیل شده' : 'در جریان',
        statusColor: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20'
      });
    });

    // خرابی‌های ثبت شده اخیر
    filteredFailures.slice(-8).forEach(f => {
      const v = filteredVehicles.find(veh => veh.id === f.vehicleId);
      list.push({
        id: `act-fail-${f.id}`,
        category: 'failure',
        title: `گزارش خرابی (${f.description || f.failureType})`,
        vehicleName: v?.name || f.plaque || 'خودرو',
        plaque: v?.plaque || f.plaque || '—',
        date: f.failureDate || toJalaliDate(f.createdAt) || todayJalali,
        amount: f.totalCost,
        statusText: f.status === 'completed' ? 'تعمیر شد' : f.status === 'in_repair' ? 'در تعمیرگاه' : 'پذیرش شده',
        statusColor: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20'
      });
    });

    // فاکتورهای اخیر
    filteredExpenses.slice(-8).forEach(e => {
      const v = filteredVehicles.find(veh => veh.id === e.vehicleId);
      list.push({
        id: `act-exp-${e.id}`,
        category: 'expense',
        title: `ثبت هزینه (${e.description || e.expenseType || 'فاکتور عملیاتی'})`,
        vehicleName: v?.name || e.plaque || 'خودرو',
        plaque: v?.plaque || e.plaque || '—',
        date: e.expenseDate || toJalaliDate(e.createdAt) || todayJalali,
        amount: e.cost,
        statusText: 'سند مالی',
        statusColor: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
      });
    });

    return list.slice(0, 12);
  }, [filteredServices, filteredFailures, filteredExpenses, filteredVehicles, todayJalali]);

  // ۵. خودروهای حساس و نیازمند پایش (Watchlist)
  const watchlistVehicles = useMemo(() => {
    return filteredVehicles.filter(v => {
      const hasUrgentService = urgentServicesList.some(s => s.plaque === v.plaque || s.vehicleName === v.name);
      const isUnavailable = v.status === 'in_repair' || v.status === 'broken';
      const hasOpenFailure = activeFailuresList.some(f => f.plaque === v.plaque || f.vehicleName === v.name);
      return isUnavailable || hasUrgentService || hasOpenFailure;
    }).slice(0, 10);
  }, [filteredVehicles, urgentServicesList, activeFailuresList]);

  // ۶. پنج خودروی با بیشترین هزینه (Top Expensive Vehicles)
  const topCostVehicles = useMemo(() => {
    const expenseByVehicle: Record<number, { vehicle: Vehicle; total: number; count: number }> = {};
    
    filteredExpenses.forEach(exp => {
      if (!exp.vehicleId) return;
      const v = filteredVehicles.find(veh => veh.id === exp.vehicleId);
      if (!v) return;
      if (!expenseByVehicle[exp.vehicleId]) {
        expenseByVehicle[exp.vehicleId] = { vehicle: v, total: 0, count: 0 };
      }
      expenseByVehicle[exp.vehicleId].total += (exp.cost || 0);
      expenseByVehicle[exp.vehicleId].count += 1;
    });

    return Object.values(expenseByVehicle)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [filteredExpenses, filteredVehicles]);

  // ۷. میانبرهای عملیاتی جامع و استاندارد
  const COMMAND_SHORTCUTS = [
    {
      id: 'odometer',
      title: 'استعلام کارکرد تلفنی',
      subtitle: 'ثبت کیلومتر روزانه و پیش‌بینی موعد تعویض',
      icon: PhoneCall,
      color: 'indigo',
      badge: 'روزانه'
    },
    {
      id: 'services',
      title: 'سرویس‌های دوره‌ای',
      subtitle: 'ثبت روغن، فیلترها، لنت و پایش هشدارهای کیلومتری',
      icon: Wrench,
      color: 'amber',
      badge: urgentServicesList.length > 0 ? `${toPersianDigits(urgentServicesList.length)} هشدار` : undefined,
      badgeColor: 'bg-amber-500 text-white'
    },
    {
      id: 'failures',
      title: 'تعمیرگاه و پذیرش خرابی',
      subtitle: 'مدیریت عیب‌یابی، تخصیص مکانیک و حواله ترخیص',
      icon: AlertTriangle,
      color: 'rose',
      badge: activeFailuresList.length > 0 ? `${toPersianDigits(activeFailuresList.length)} پذیرش فعال` : undefined,
      badgeColor: 'bg-rose-500 text-white'
    },
    {
      id: 'parts',
      title: 'انبار قطعات یدکی',
      subtitle: 'مدیریت کاردکس کالا، رسید خرید و حواله مصرف',
      icon: Package,
      color: 'emerald'
    },
    {
      id: 'accounting',
      title: 'حسابداری و ثبت هزینه‌ها',
      subtitle: 'فاکتورهای مالی، مخارج سوخت و تراز هزینه‌ها',
      icon: TrendingUp,
      color: 'cyan'
    },
    {
      id: 'vehicles',
      title: 'بانک پرونده ناوگان',
      subtitle: 'مشخصات فنی، راننده، VIN، پلاک و محل استقرار',
      icon: Car,
      color: 'violet',
      badge: `${toPersianDigits(totalVehicles)} دستگاه`
    },
    {
      id: 'insurance',
      title: 'بیمه‌نامه‌ها و معاینه فنی',
      subtitle: 'پایش موعد انقضای ثالث، بدنه و کارت معاینه',
      icon: ShieldCheck,
      color: 'blue',
      badge: (urgentInsurancesList.length + urgentInspectionsList.length) > 0 
        ? `${toPersianDigits(urgentInsurancesList.length + urgentInspectionsList.length)} انقضا` 
        : undefined,
      badgeColor: 'bg-rose-500 text-white'
    },
    {
      id: 'reports',
      title: 'شناسنامه و گزارش‌های تحلیلی',
      subtitle: 'پرونده جامع، گزارشات مدیریتی و خروجی اکسل/PDF',
      icon: FileText,
      color: 'slate'
    },
    {
      id: 'service_definitions',
      title: 'استاندارد خدمات و دوره‌ها',
      subtitle: 'تعریف استانداردهای کیلومتری و آستانه هشدارها',
      icon: SlidersHorizontal,
      color: 'teal'
    },
    {
      id: 'persons',
      title: 'رانندگان و پرسنل ناوگان',
      subtitle: 'اطلاعات پرسنلی، شماره تماس و سوابق رانندگی',
      icon: Users,
      color: 'orange'
    }
  ];

  return (
    <div className="space-y-4 w-full animate-in fade-in duration-300 pb-12">
      
      {/* ۱. نوار وضعیت ارشد (Executive Top Banner) */}
      <div className="bg-white dark:bg-[#111114] rounded-xl border border-slate-200 dark:border-[#27272a] p-4 shadow-xs transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* عنوان */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-2xs">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                داشبورد جامع مدیریت ناوگان خودرویی یاس
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                پایش لحظه‌ای آمادگی خودروها، سررسیدهای فنی، هزینه‌های جاری و گردش کار تعمیرگاه
              </p>
            </div>
          </div>

          {/* فیلتر مرتب و خلوت شرکت */}
          <div className="flex items-center gap-2 flex-wrap self-start md:self-auto shrink-0">
            {companies.length > 0 && (
              <div ref={companyDropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
                  aria-expanded={isCompanyDropdownOpen}
                  aria-label="انتخاب فیلتر شرکت"
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer select-none max-w-full ${
                    selectedCompanyFilter !== 'all'
                      ? 'bg-indigo-50/80 dark:bg-indigo-500/15 border-indigo-300 dark:border-indigo-500/40 text-indigo-900 dark:text-indigo-200 shadow-2xs'
                      : 'bg-white dark:bg-[#18181b] border-slate-200 dark:border-[#27272a] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-[#35353c]'
                  }`}
                >
                  <Building className={`w-3.5 h-3.5 shrink-0 ${selectedCompanyFilter !== 'all' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                  <span className="text-[11px] text-slate-400 font-normal hidden sm:inline">شرکت:</span>
                  <span className="text-[11px] font-bold truncate max-w-[130px] sm:max-w-[160px]">
                    {selectedCompanyFilter === 'all' ? 'همه شرکت‌ها' : selectedCompanyFilter}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono font-normal">
                    ({toPersianDigits(filteredVehicles.length)})
                  </span>

                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 mr-0.5 shrink-0 ${
                    isCompanyDropdownOpen ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''
                  }`} />
                </button>

                {/* منوی بازشونده مرتب، مینیمال و تراز شده با لبه‌ها در موبایل و دسکتاپ */}
                {isCompanyDropdownOpen && (
                  <div className="absolute right-0 md:right-auto md:left-0 mt-1 w-56 sm:w-60 max-w-[calc(100vw-2.5rem)] bg-white dark:bg-[#151518] border border-slate-200 dark:border-[#28282d] rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    
                    {/* فیلد جستجوی ساده و جمع‌وجور (در صورت تعداد بالای شرکت‌ها) */}
                    {companies.length > 5 && (
                      <div className="p-1.5 border-b border-slate-100 dark:border-[#222227]">
                        <div className="relative">
                          <Search className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={companySearchQuery}
                            onChange={(e) => setCompanySearchQuery(e.target.value)}
                            placeholder="جستجو..."
                            className="w-full bg-slate-50 dark:bg-[#1a1a1e] border border-slate-200 dark:border-[#28282d] rounded-md pr-7 pl-2 py-1 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                            autoFocus
                          />
                        </div>
                      </div>
                    )}

                    {/* لیست گزینه‌ها با ساختار ساده، ترازبندی یکدست و خوانا */}
                    <div className="p-1 max-h-56 overflow-y-auto space-y-0.5 no-scrollbar">
                      
                      {/* گزینه همه شرکت‌ها */}
                      <button
                        type="button"
                        onClick={() => handleSelectCompany('all')}
                        className={`w-full text-right px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                          selectedCompanyFilter === 'all'
                            ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1e1e23]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div className="w-4 flex items-center justify-center shrink-0">
                            {selectedCompanyFilter === 'all' && (
                              <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            )}
                          </div>
                          <span className="truncate">همه شرکت‌ها</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0 mr-2">
                          {toPersianDigits(vehicles.length)}
                        </span>
                      </button>

                      <div className="my-1 border-t border-slate-100 dark:border-[#202025]"></div>

                      {/* گزینه‌های شرکت‌ها */}
                      {companies
                        .filter(c => !companySearchQuery.trim() || c.name.toLowerCase().includes(companySearchQuery.trim().toLowerCase()))
                        .map(c => {
                          const isSelected = selectedCompanyFilter === c.name;
                          const companyVehiclesCount = vehicles.filter(v => v.company === c.name).length;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => handleSelectCompany(c.name)}
                              className={`w-full text-right px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1e1e23]'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-4 flex items-center justify-center shrink-0">
                                  {isSelected && (
                                    <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                  )}
                                </div>
                                <span className="truncate">{c.name}</span>
                              </div>
                              <span className="text-[10px] font-mono text-slate-400 shrink-0 mr-2">
                                {toPersianDigits(companyVehiclesCount)}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* نوار توزیع و سلامت ناوگان (Fleet Health & Readiness Track) */}
        {totalVehicles > 0 && (
          <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-[#202024] space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
              <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-[11px]">
                <span>ضریب آمادگی عملیاتی ناوگان:</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-black font-mono">
                  {toPersianDigits(activePercent)}٪
                </span>
              </span>

              <div className="flex items-center gap-3 sm:gap-4 text-[11px] font-bold flex-wrap">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>آماده به‌کار ({formatNumber(activeVehicles)})</span>
                </span>
                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>در تعمیرگاه ({formatNumber(inRepairVehicles)})</span>
                </span>
                <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>متوقف ({formatNumber(brokenVehicles)})</span>
                </span>
              </div>
            </div>

            {/* نوار پیشرفت افقی چندبخشی */}
            <div className="w-full h-2.5 bg-slate-100 dark:bg-[#1d1d21] rounded-full overflow-hidden flex gap-0.5 p-0.5 shadow-inner">
              <div 
                className="bg-emerald-500 rounded-full h-full transition-all duration-500" 
                style={{ width: `${activePercent}%` }} 
                title={`آماده به‌کار: ${activePercent}٪`}
              />
              <div 
                className="bg-amber-500 rounded-full h-full transition-all duration-500" 
                style={{ width: `${inRepairPercent}%` }} 
                title={`در تعمیرگاه: ${inRepairPercent}٪`}
              />
              <div 
                className="bg-rose-500 rounded-full h-full transition-all duration-500" 
                style={{ width: `${brokenPercent}%` }} 
                title={`متوقف: ${brokenPercent}٪`}
              />
            </div>
          </div>
        )}
      </div>

      {/* ۲. کارت‌های آماری خلاصه عملکرد ناوگان (Executive Summary Statistics Grid - 6 کارت شاخص) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        
        {/* ۱. تعداد کل خودروها */}
        <div 
          onClick={() => onNavigate('vehicles')}
          className="group bg-white dark:bg-[#111114] p-3.5 rounded-xl border border-slate-200 dark:border-[#27272a] hover:border-indigo-400 dark:hover:border-indigo-500/50 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold">تعداد کل خودروها</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Car className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {formatNumber(totalVehicles)}
              <span className="text-xs font-normal text-slate-400 mr-1">خودرو</span>
            </span>
            <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-bold bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded">
              {toPersianDigits(activePercent)}٪ فعال
            </span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400 truncate">
            {formatNumber(activeVehicles)} آماده / {formatNumber(unavailableVehicles)} متوقف
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#1d1d21] flex items-center justify-between text-[10px] text-indigo-600 dark:text-indigo-400 font-bold group-hover:underline">
            <span>بانک خودروها</span>
            <ArrowLeft className="w-2.5 h-2.5" />
          </div>
        </div>

        {/* ۲. سرویس‌های در انتظار */}
        <div 
          onClick={() => onNavigate('services')}
          className="group bg-white dark:bg-[#111114] p-3.5 rounded-xl border border-slate-200 dark:border-[#27272a] hover:border-amber-400 dark:hover:border-amber-500/50 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold">سرویس‌های در انتظار</span>
            <div className={`p-1.5 rounded-lg transition-colors ${
              pendingServicesData.overdueCount > 0 
                ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:bg-rose-600 group-hover:text-white' 
                : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white'
            }`}>
              <CalendarClock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {formatNumber(pendingServicesData.totalPending)}
              <span className="text-xs font-normal text-slate-400 mr-1">مورد</span>
            </span>
            {pendingServicesData.overdueCount > 0 ? (
              <span className="text-[10px] text-rose-700 dark:text-rose-300 font-bold bg-rose-50 dark:bg-rose-500/10 px-1.5 py-0.5 rounded">
                {toPersianDigits(pendingServicesData.overdueCount)} منقضی
              </span>
            ) : (
              <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded">
                عادی
              </span>
            )}
          </div>
          <div className="mt-1 text-[10px] text-slate-400 truncate">
            {toPersianDigits(pendingServicesData.overdueCount)} منقضی / {toPersianDigits(pendingServicesData.upcomingCount)} موعد در ۱۵ روز
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#1d1d21] flex items-center justify-between text-[10px] text-amber-600 dark:text-amber-400 font-bold group-hover:underline">
            <span>مدیریت سرویس‌ها</span>
            <ArrowLeft className="w-2.5 h-2.5" />
          </div>
        </div>

        {/* ۳. وضعیت کلی هزینه‌ها */}
        <div 
          onClick={() => onNavigate('accounting')}
          className="group bg-white dark:bg-[#111114] p-3.5 rounded-xl border border-slate-200 dark:border-[#27272a] hover:border-emerald-400 dark:hover:border-emerald-500/50 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold">وضعیت کلی هزینه‌ها</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate">
              {formatPrice(overallExpensesData.totalCost)}
            </span>
            <span className="text-[10px] text-slate-400 font-bold mr-1">ریال</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400 truncate">
            ماه جاری: {formatPrice(monthlyCost)} ریال ({toPersianDigits(monthlyExpensesCount)} فاکتور)
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#1d1d21] flex items-center justify-between text-[10px] text-emerald-600 dark:text-emerald-400 font-bold group-hover:underline">
            <span>حسابداری و مخارج</span>
            <ArrowLeft className="w-2.5 h-2.5" />
          </div>
        </div>

        {/* ۴. پذیرش‌های فعال تعمیرگاه */}
        <div 
          onClick={() => onNavigate('failures')}
          className="group bg-white dark:bg-[#111114] p-3.5 rounded-xl border border-slate-200 dark:border-[#27272a] hover:border-rose-400 dark:hover:border-rose-500/50 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold">پذیرش‌های تعمیرگاه</span>
            <div className={`p-1.5 rounded-lg transition-colors ${
              activeFailuresList.length > 0 
                ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:bg-rose-600 group-hover:text-white' 
                : 'bg-slate-50 dark:bg-slate-800 text-slate-500'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {formatNumber(activeFailuresList.length)}
              <span className="text-xs font-normal text-slate-400 mr-1">پذیرش</span>
            </span>
            {highPriorityFailuresCount > 0 ? (
              <span className="text-[10px] text-rose-700 dark:text-rose-300 font-bold bg-rose-50 dark:bg-rose-500/10 px-1.5 py-0.5 rounded">
                {toPersianDigits(highPriorityFailuresCount)} اضطراری
              </span>
            ) : (
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold bg-slate-100 dark:bg-[#1e1e24] px-1.5 py-0.5 rounded">
                در جریان
              </span>
            )}
          </div>
          <div className="mt-1 text-[10px] text-slate-400 truncate">
            {formatNumber(inRepairVehicles)} در تعمیر / {formatNumber(brokenVehicles)} متوقف
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#1d1d21] flex items-center justify-between text-[10px] text-rose-600 dark:text-rose-400 font-bold group-hover:underline">
            <span>گردش کار تعمیرگاه</span>
            <ArrowLeft className="w-2.5 h-2.5" />
          </div>
        </div>

        {/* ۵. بیمه‌نامه‌ها و معاینه فنی */}
        <div 
          onClick={() => onNavigate('insurance')}
          className="group bg-white dark:bg-[#111114] p-3.5 rounded-xl border border-slate-200 dark:border-[#27272a] hover:border-blue-400 dark:hover:border-blue-500/50 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold">بیمه‌نامه و معاینه فنی</span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {formatNumber(urgentInsurancesList.length + urgentInspectionsList.length)}
              <span className="text-xs font-normal text-slate-400 mr-1">سررسید</span>
            </span>
            {(urgentInsurancesList.length + urgentInspectionsList.length) > 0 ? (
              <span className="text-[10px] text-blue-700 dark:text-blue-300 font-bold bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded">
                نیازمند اقدام
              </span>
            ) : (
              <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded">
                معتبر
              </span>
            )}
          </div>
          <div className="mt-1 text-[10px] text-slate-400 truncate">
            {toPersianDigits(urgentInsurancesList.length)} بیمه‌نامه / {toPersianDigits(urgentInspectionsList.length)} معاینه فنی
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#1d1d21] flex items-center justify-between text-[10px] text-blue-600 dark:text-blue-400 font-bold group-hover:underline">
            <span>پایش بیمه و معاینه</span>
            <ArrowLeft className="w-2.5 h-2.5" />
          </div>
        </div>

        {/* ۶. ضریب آمادگی عملیاتی ناوگان */}
        <div 
          onClick={() => setActiveTab('watchlist')}
          className="group bg-white dark:bg-[#111114] p-3.5 rounded-xl border border-slate-200 dark:border-[#27272a] hover:border-violet-400 dark:hover:border-violet-500/50 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold">ضریب آمادگی ناوگان</span>
            <div className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:bg-violet-600 group-hover:text-white transition-colors">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {toPersianDigits(activePercent)}٪
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              activePercent >= 80 
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' 
                : activePercent >= 60 
                ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300' 
                : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300'
            }`}>
              {activePercent >= 80 ? 'مطلوب' : activePercent >= 60 ? 'متوسط' : 'نیاز به توجه'}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400 truncate">
            {formatNumber(activeVehicles)} خودروی فعال از {formatNumber(totalVehicles)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#1d1d21] flex items-center justify-between text-[10px] text-violet-600 dark:text-violet-400 font-bold group-hover:underline">
            <span>دیده‌بان ناوگان</span>
            <ArrowLeft className="w-2.5 h-2.5" />
          </div>
        </div>

      </div>

      {/* ۳. بخش تب‌بندی تعاملی پایش ناوگان (Operational Matrix & Action Center) */}
      <div className="bg-white dark:bg-[#111114] rounded-xl border border-slate-200 dark:border-[#27272a] shadow-xs overflow-hidden">
        
        {/* نوار سربرگ تب‌ها */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#202024] px-4 py-2.5 bg-slate-50/50 dark:bg-[#141417]/50 flex-wrap gap-2">
          
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('alerts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-colors duration-150 cursor-pointer whitespace-nowrap border ${
                activeTab === 'alerts'
                  ? 'bg-white dark:bg-[#1d1d21] text-indigo-600 dark:text-indigo-400 shadow-2xs border-slate-200 dark:border-[#2d2d32]'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-[#1c1c20]'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>هشدارهای فوری سررسید</span>
              {allUrgentAlerts.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-rose-500 text-white font-bold font-mono shrink-0">
                  {toPersianDigits(allUrgentAlerts.length)}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('activities')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-colors duration-150 cursor-pointer whitespace-nowrap border ${
                activeTab === 'activities'
                  ? 'bg-white dark:bg-[#1d1d21] text-indigo-600 dark:text-indigo-400 shadow-2xs border-slate-200 dark:border-[#2d2d32]'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-[#1c1c20]'
              }`}
            >
              <History className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>رویدادها و فعالیت‌های اخیر</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('watchlist')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-colors duration-150 cursor-pointer whitespace-nowrap border ${
                activeTab === 'watchlist'
                  ? 'bg-white dark:bg-[#1d1d21] text-indigo-600 dark:text-indigo-400 shadow-2xs border-slate-200 dark:border-[#2d2d32]'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-[#1c1c20]'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>خودروهای نیازمند توجه ({toPersianDigits(watchlistVehicles.length)})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-colors duration-150 cursor-pointer whitespace-nowrap border ${
                activeTab === 'analytics'
                  ? 'bg-white dark:bg-[#1d1d21] text-indigo-600 dark:text-indigo-400 shadow-2xs border-slate-200 dark:border-[#2d2d32]'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-[#1c1c20]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>تحلیل آماری و مخارج</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 font-medium hidden sm:block">
            پایش هوشمند خودکار
          </div>

        </div>

        {/* محتوای تب فعال */}
        <div className="p-4">
          
          {/* تب ۱: هشدارهای فوری */}
          {activeTab === 'alerts' && (
            <div className="space-y-3">
              {allUrgentAlerts.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center justify-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                    وضعیت ناوگان کاملاً مطلوب است
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                    هیچ سرویس دوره‌ای منقضی، بیمه‌نامه در آستانه پایان یا خرابی فوری ثبت نشده است.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
                  {allUrgentAlerts.map(alert => (
                    <div 
                      key={alert.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                        alert.urgency === 'critical'
                          ? 'bg-rose-50/40 dark:bg-rose-950/15 border-rose-200 dark:border-rose-900/30'
                          : alert.urgency === 'high'
                          ? 'bg-amber-50/40 dark:bg-amber-950/15 border-amber-200 dark:border-amber-900/30'
                          : 'bg-slate-50 dark:bg-[#161619] border-slate-200 dark:border-[#27272a]'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-black text-xs text-slate-900 dark:text-white truncate">
                            {alert.type === 'service' && <Wrench className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                            {alert.type === 'insurance' && <ShieldCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                            {alert.type === 'inspection' && <ShieldAlert className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                            {alert.type === 'failure' && <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                            <span className="truncate">{alert.title}</span>
                          </div>

                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 font-mono ${
                            alert.isOverdue
                              ? 'bg-rose-600 text-white'
                              : alert.diffDays === 0
                              ? 'bg-amber-600 text-white'
                              : 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300'
                          }`}>
                            {alert.isOverdue
                              ? `منقضی (${toPersianDigits(Math.abs(alert.diffDays))} روز)`
                              : alert.diffDays === 0
                              ? 'امروز'
                              : `${toPersianDigits(alert.diffDays)} روز دیگر`
                            }
                          </span>
                        </div>

                        <div className="mt-2 text-xs space-y-1 text-slate-600 dark:text-slate-300">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">خودرو:</span>
                            <span className="font-extrabold text-slate-800 dark:text-slate-200">{alert.vehicleName}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">پلاک / راننده:</span>
                            <span>{alert.plaque} | {alert.driverName}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">جزئیات:</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">{alert.detail}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => onNavigate(alert.targetView)}
                        className="w-full py-1.5 px-2.5 rounded-lg text-xs font-bold bg-white dark:bg-[#202024] hover:bg-slate-100 dark:hover:bg-[#28282d] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-[#323238] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>اقدام و ثبت در سامانه</span>
                        <ArrowLeft className="w-3.5 h-3.5 text-indigo-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* تب ۲: جریان فعالیت‌های اخیر */}
          {activeTab === 'activities' && (
            <div className="space-y-2">
              {recentActivities.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  هنوز فعالیتی در سامانه ثبت نشده است.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-[#202024]">
                  {recentActivities.map(act => (
                    <div key={act.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-lg bg-slate-100 dark:bg-[#18181b] text-slate-600 dark:text-slate-400 shrink-0">
                          {act.category === 'service' && <Wrench className="w-3.5 h-3.5 text-indigo-500" />}
                          {act.category === 'failure' && <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />}
                          {act.category === 'expense' && <TrendingUp className="w-3.5 h-3.5 text-amber-500" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-900 dark:text-white truncate">
                            {act.title}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {act.vehicleName} ({act.plaque})
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {act.amount !== undefined && act.amount > 0 && (
                          <div className="text-left font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                            {formatPrice(act.amount)} <span className="text-[10px] text-slate-400 font-sans">ریال</span>
                          </div>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${act.statusColor}`}>
                          {act.statusText}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                          {act.date}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* تب ۳: خودروهای نیازمند توجه (Watchlist) */}
          {activeTab === 'watchlist' && (
            <div className="overflow-x-auto">
              {watchlistVehicles.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  تمامی خودروهای ناوگان در وضعیت مطلوب قرار دارند.
                </div>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="text-[11px] font-bold text-slate-400 border-b border-slate-200 dark:border-[#202024] pb-2">
                      <th className="pb-2 font-bold">نام و مدل خودرو</th>
                      <th className="pb-2 font-bold">پلاک</th>
                      <th className="pb-2 font-bold">راننده</th>
                      <th className="pb-2 font-bold">وضعیت ناوگان</th>
                      <th className="pb-2 font-bold">کارکرد کیلومتر</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#202024]">
                    {watchlistVehicles.map(veh => (
                      <tr key={veh.id} className="group relative hover:bg-slate-50 dark:hover:bg-[#161619] transition-colors">
                        <td className="py-2.5 font-extrabold text-slate-900 dark:text-white">
                          {veh.name}
                        </td>
                        <td className="py-2.5 font-mono text-slate-700 dark:text-slate-300">
                          {veh.plaque}
                        </td>
                        <td className="py-2.5 text-slate-600 dark:text-slate-300">
                          {veh.driverName || '—'}
                        </td>
                        <td className="py-2.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                            veh.status === 'active'
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : veh.status === 'in_repair'
                              ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}>
                            {veh.status === 'active' ? 'آماده به‌کار' : veh.status === 'in_repair' ? 'در تعمیرگاه' : 'متوقف'}
                          </span>
                        </td>
                        <td className="py-2.5 font-mono text-slate-700 dark:text-slate-300 relative">
                          {veh.currentKm ? `${formatNumber(veh.currentKm)} km` : '—'}

                          {/* دکمه شناور در هاور ردیف */}
                          <div className="absolute inset-y-0 left-0 pl-2.5 pr-12 flex items-center bg-gradient-to-r from-slate-50 via-slate-50 via-70% to-transparent dark:from-[#161619] dark:via-[#161619] dark:via-70% dark:to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 z-20 pointer-events-none group-hover:pointer-events-auto">
                            <button
                              onClick={() => onNavigate('vehicles')}
                              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer whitespace-nowrap bg-white dark:bg-[#202024] px-2 py-0.5 rounded border border-slate-200 dark:border-[#2d2d30] shadow-2xs"
                            >
                              مشاهده پرونده
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* تب ۴: تحلیل آماری و مخارج ناوگان */}
          {activeTab === 'analytics' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* ۵ خودرو با بیشترین مخارج */}
              <div className="bg-slate-50 dark:bg-[#161619] p-3.5 rounded-xl border border-slate-200 dark:border-[#27272a] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#202024]">
                  <span className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                    خودروهای دارای بیشترین هزینه ثبت‌شده
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">۵ مورد برتر</span>
                </div>

                {topCostVehicles.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400">
                    هزینه‌ای برای نمایش ثبت نشده است.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {topCostVehicles.map(({ vehicle, total, count }) => (
                      <div key={vehicle.id} className="flex items-center justify-between text-xs py-1">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                            {vehicle.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            پلاک: {vehicle.plaque} | {toPersianDigits(count)} فاکتور
                          </div>
                        </div>
                        <div className="text-left font-mono font-black text-slate-900 dark:text-white text-xs">
                          {formatPrice(total)} <span className="text-[9px] font-sans text-slate-400">ریال</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* تفکیک خودروها بر اساس شرکت */}
              <div className="bg-slate-50 dark:bg-[#161619] p-3.5 rounded-xl border border-slate-200 dark:border-[#27272a] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#202024]">
                  <span className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-indigo-500" />
                    سهم شرکت‌ها از ناوگان خودرویی
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">توزیع سازمانی</span>
                </div>

                {companies.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400">
                    شرکتی تعریف نشده است.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {companies.map(c => {
                      const count = vehicles.filter(v => v.company === c.name).length;
                      const percent = totalVehicles > 0 ? Math.round((count / totalVehicles) * 100) : 0;
                      return (
                        <div key={c.id} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{c.name}</span>
                            <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                              {formatNumber(count)} خودرو ({toPersianDigits(percent)}٪)
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200 dark:bg-[#25252a] rounded-full overflow-hidden">
                            <div 
                              className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

      </div>

      {/* ۴. مرکز عملیات و دسترسی سریع به بخش‌های اصلی سامانه (Quick Command Center) */}
      <div className="bg-white dark:bg-[#111114] p-4 rounded-xl border border-slate-200 dark:border-[#27272a] shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-[#202024]">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-500" />
            <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
              دسترسی سریع به بخش‌های عملیاتی سامانه
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">انتقال مستقیم با یک کلیک</span>
        </div>

        {/* گرید دسترسی سریع متناسب با دستگاه‌های مختلف */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {COMMAND_SHORTCUTS.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className="group text-right p-3 rounded-xl border border-slate-200 dark:border-[#252529] hover:border-indigo-400 dark:hover:border-indigo-500/50 bg-slate-50/50 dark:bg-[#151518] hover:bg-white dark:hover:bg-[#1a1a1e] transition-all duration-150 flex items-center justify-between cursor-pointer hover:shadow-xs hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-white dark:bg-[#1d1d21] border border-slate-200 dark:border-[#2a2a30] text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      {item.title}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {item.subtitle}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 mr-2">
                  {item.badge && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-extrabold ${item.badgeColor || 'bg-slate-200 dark:bg-[#28282d] text-slate-700 dark:text-slate-300'}`}>
                      {item.badge}
                    </span>
                  )}
                  <ArrowLeft className="w-3.5 h-3.5 text-slate-400 opacity-60 group-hover:opacity-100 group-hover:-translate-x-1 transition-all" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ۵. بخش سفارشی‌سازی میانبرها (قابلیت جمع‌شونده برای سادگی و زیبایی) */}
      <div className="bg-white dark:bg-[#111114] rounded-xl border border-slate-200 dark:border-[#27272a] shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => setShowCustomShortcuts(!showCustomShortcuts)}
          className="w-full px-4 py-3 flex items-center justify-between text-xs font-extrabold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#161619] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
            <span>سفارشی‌سازی و مدیریت میانبرهای اختصاصی داشبورد</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">
            <span>{showCustomShortcuts ? 'بستن تنظیمات' : 'تنظیم و چیدمان دلخواه'}</span>
            {showCustomShortcuts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showCustomShortcuts && (
          <div className="p-4 border-t border-slate-100 dark:border-[#202024] bg-slate-50/50 dark:bg-[#141417]/40">
            <DashboardQuickTasksSection onNavigate={onNavigate} />
          </div>
        )}
      </div>

    </div>
  );
}

