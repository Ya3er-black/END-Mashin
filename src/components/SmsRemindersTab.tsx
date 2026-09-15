/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, Bell, Settings, Clock, CheckCircle2, AlertTriangle, 
  RefreshCw, Check, MessageSquare, Smartphone, History, 
  Search, Filter, Trash2, Calendar, User, Car, ShieldAlert,
  ChevronDown, HelpCircle, Layers, ArrowUpRight, Copy, CheckCheck, Zap,
  Eye, List, X, FileSpreadsheet
} from 'lucide-react';
import { 
  Vehicle, PeriodicService, OdometerLog, SmsReminderSettings, 
  SmsOutboundLog, OverdueDriverItem 
} from '../types';
import { toPersianDigits, formatNumber } from '../utils/numberUtils';
import { TableColumnHeader, ColumnFilterMenu, FilterMenuState } from './TableFilterSort';
import { sortData, SortDirection } from '../utils/sortUtils';

interface SmsRemindersTabProps {
  vehicles: Vehicle[];
  services: PeriodicService[];
  odometerLogs: OdometerLog[];
  initialDaysThreshold?: number;
  onThresholdChange?: (days: number) => void;
}

const STORAGE_KEY_THRESHOLD = 'odometer_sms_reminder_days_threshold';

const getInitialThreshold = (fallbackProp?: number): number => {
  if (fallbackProp && fallbackProp > 0) return fallbackProp;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_THRESHOLD);
    if (saved) {
      const num = parseInt(saved, 10);
      if (!isNaN(num) && num > 0) return num;
    }
  } catch {}
  return 7;
};

export default function SmsRemindersTab({
  vehicles,
  services,
  odometerLogs,
  initialDaysThreshold,
  onThresholdChange
}: SmsRemindersTabProps) {
  // State
  const [settings, setSettings] = useState<SmsReminderSettings>(() => {
    const initialDays = getInitialThreshold(initialDaysThreshold);
    return {
      daysThreshold: initialDays,
      autoSendEnabled: false,
      checkBasedOn: 'last_service',
      smsTemplate: 'راننده محترم {driverName}، با سلام؛ با توجه به گذشت {daysPassed} روز از آخرین سرویس دوره‌ای، لطفاً جهت بررسی وضعیت خودرو {vehicleName} ({plaque}) و اعلام کارکرد فعلی اقدام فرمایید. واحد ترابری {company}',
      preventDuplicateHours: 24,
      provider: 'sms.ir',
      lineNumber: '30002108035760',
      apiKey: 'Xcpq5IEcfWypqDce4tHB612pCor0OsnwkdEdPrAgldxozVWp'
    };
  });

  const [overdueDrivers, setOverdueDrivers] = useState<OverdueDriverItem[]>([]);
  const [outboundLogs, setOutboundLogs] = useState<SmsOutboundLog[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [triggeringAuto, setTriggeringAuto] = useState(false);

  // Filters, Search & Sorting (مشابه تب پایش / OdometerTrackingView)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilterVehicleId, setSelectedFilterVehicleId] = useState<number | 'all'>('all');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [subTab, setSubTab] = useState<'overdue_list' | 'sent_history' | 'settings'>('overdue_list');
  const [sortKey, setSortKey] = useState<string>('daysPassed');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [filterMenu, setFilterMenu] = useState<FilterMenuState | null>(null);

  // ریست صفحه و بستن دراپ‌دان جستجو با کلیک خارج یا فشردن دکمه Escape (مشابه تب پایش)
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

  // پیدا کردن خودروی انتخاب‌شده در فیلتر
  const activeSelectedDriver = useMemo(() => {
    if (!selectedFilterVehicleId || selectedFilterVehicleId === 'all') return null;
    return overdueDrivers.find(d => d.vehicleId === selectedFilterVehicleId) || null;
  }, [overdueDrivers, selectedFilterVehicleId]);

  // لیست پیشنهادات جستجوی خودروها (مشابه تب پایش)
  const matchedDrivers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return overdueDrivers;
    return overdueDrivers.filter(d => 
      d.vehicleName.toLowerCase().includes(query) ||
      (d.vehiclePlaque && d.vehiclePlaque.toLowerCase().includes(query)) ||
      (d.driverName && d.driverName.toLowerCase().includes(query)) ||
      (d.company && d.company.toLowerCase().includes(query)) ||
      (d.driverPhone && d.driverPhone.includes(query))
    );
  }, [overdueDrivers, searchTerm]);

  const handleSelectDriverFromDropdown = (d: OverdueDriverItem) => {
    setSelectedFilterVehicleId(d.vehicleId);
    setSearchTerm('');
    setIsSearchOpen(false);
  };

  // Preview Modal State
  const [previewItem, setPreviewItem] = useState<OverdueDriverItem | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  // Modal / Template Editor
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState<SmsReminderSettings>(settings);
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string | null>(null);

  // Load Settings, Overdue Drivers, and Outbound Logs
  const fetchAllSmsData = async () => {
    try {
      setLoading(true);
      const activeThreshold = getInitialThreshold(initialDaysThreshold || settings.daysThreshold);
      const [resSettings, resOverdue, resLogs] = await Promise.all([
        fetch('/api/sms/reminder-settings'),
        fetch(`/api/sms/overdue-drivers?daysThreshold=${activeThreshold}`),
        fetch('/api/sms/outbound-logs')
      ]);

      if (resSettings.ok && (resSettings.headers.get('content-type') || '').includes('application/json')) {
        const sData = await resSettings.json();
        // سقف روزهای انتخابی کاربر را حفظ می‌کنیم تا از تغییر و پرش دکمه جلوگیری شود
        setSettings({ ...sData, daysThreshold: activeThreshold });
        setTempSettings({ ...sData, daysThreshold: activeThreshold });
      }
      if (resOverdue.ok && (resOverdue.headers.get('content-type') || '').includes('application/json')) {
        const oData = await resOverdue.json();
        setOverdueDrivers(oData);
      }
      if (resLogs.ok && (resLogs.headers.get('content-type') || '').includes('application/json')) {
        const lData = await resLogs.json();
        setOutboundLogs(lData);
      }
    } catch (e) {
      console.error('Error loading SMS reminders data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllSmsData();
  }, []);

  // Save Settings
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const res = await fetch('/api/sms/reminder-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tempSettings)
      });
      if (res.ok) {
        const updated = await res.json();
        try {
          localStorage.setItem(STORAGE_KEY_THRESHOLD, updated.daysThreshold.toString());
        } catch {}
        if (onThresholdChange) {
          onThresholdChange(updated.daysThreshold);
        }
        setSettings(updated);
        setIsSettingsOpen(false);
        // Refresh overdue list with new settings
        const resOverdue = await fetch(`/api/sms/overdue-drivers?daysThreshold=${updated.daysThreshold}`);
        if (resOverdue.ok) {
          const oData = await resOverdue.json();
          setOverdueDrivers(oData);
        }
      }
    } catch (e) {
      console.error('Error saving SMS settings:', e);
    }
  };

  // Toggle Auto Send
  const handleToggleAutoSend = async () => {
    const updated = { ...settings, autoSendEnabled: !settings.autoSendEnabled };
    setSettings(updated);
    setTempSettings(updated);
    try {
      await fetch('/api/sms/reminder-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (e) {
      console.error('Error updating auto send toggle:', e);
    }
  };

  // Quick Threshold Change
  const handleQuickThresholdChange = async (days: number) => {
    try {
      localStorage.setItem(STORAGE_KEY_THRESHOLD, days.toString());
    } catch {}
    if (onThresholdChange) {
      onThresholdChange(days);
    }
    const updated = { ...settings, daysThreshold: days };
    setSettings(updated);
    setTempSettings(updated);
    try {
      await fetch('/api/sms/reminder-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      const resOverdue = await fetch(`/api/sms/overdue-drivers?daysThreshold=${days}`);
      if (resOverdue.ok) {
        const oData = await resOverdue.json();
        setOverdueDrivers(oData);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Send Single SMS
  const handleSendSingleSms = async (vehicleId: number) => {
    try {
      setSendingSms(true);
      const res = await fetch('/api/sms/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleIds: [vehicleId] })
      });
      if (res.ok) {
        const data = await res.json();
        setSendSuccessMessage(`پیامک یادآوری کارکرد با موفقیت برای راننده ارسال گردید.`);
        setTimeout(() => setSendSuccessMessage(null), 4000);
        fetchAllSmsData();
      }
    } catch (e) {
      console.error('Error sending single SMS:', e);
    } finally {
      setSendingSms(false);
    }
  };

  // Send Bulk SMS to Selected Vehicles
  const handleSendBulkSms = async () => {
    if (selectedVehicleIds.length === 0) return;
    try {
      setSendingSms(true);
      const res = await fetch('/api/sms/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleIds: selectedVehicleIds })
      });
      if (res.ok) {
        const data = await res.json();
        setSendSuccessMessage(`پیامک یادآوری کارکرد با موفقیت به ${toPersianDigits(data.sentCount)} راننده ارسال شد.`);
        setSelectedVehicleIds([]);
        setTimeout(() => setSendSuccessMessage(null), 5000);
        fetchAllSmsData();
      }
    } catch (e) {
      console.error('Error sending bulk SMS:', e);
    } finally {
      setSendingSms(false);
    }
  };

  // Trigger Auto Reminders Immediately
  const handleTriggerAutoNow = async () => {
    try {
      setTriggeringAuto(true);
      const res = await fetch('/api/sms/trigger-auto-reminders', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.sentCount > 0) {
          setSendSuccessMessage(`فرآیند ارسال خودکار اجرا شد و به ${toPersianDigits(data.sentCount)} راننده واجد شرایط پیامک ارسال گردید.`);
        } else {
          setSendSuccessMessage(`تمام رانندگان دارای تاخیر، اخیراً پیامک دریافت کرده‌اند و مورد واجد شرایط جدیدی یافت نشد.`);
        }
        setTimeout(() => setSendSuccessMessage(null), 5000);
        fetchAllSmsData();
      }
    } catch (e) {
      console.error('Error triggering auto SMS:', e);
    } finally {
      setTriggeringAuto(false);
    }
  };

  // Delete Outbound Log
  const handleDeleteOutboundLog = async (id: number) => {
    if (confirm('آیا از حذف این لاگ پیامک ارسالی اطمینان دارید؟')) {
      try {
        const res = await fetch(`/api/sms/outbound-logs/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setOutboundLogs(prev => prev.filter(l => l.id !== id));
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  // تبدیل وضعیت راننده به برچسب کوتاه و شفاف
  const getDriverStatusText = (item: OverdueDriverItem): string => {
    if (item.smsAlreadySentRecently) return 'ارسال‌شده';
    if (!item.driverPhone || item.driverPhone.trim().length < 7) return 'عدم امکان ارسال';
    return 'آماده ارسال';
  };

  // استخراج مقدار ستون برای فیلتر و مرتب‌سازی
  const getDriverColValue = (item: OverdueDriverItem, colKey: string): string => {
    if (colKey === 'vehicleName') return item.vehicleName;
    if (colKey === 'company') return item.company || 'ثبت‌نشده';
    if (colKey === 'driverName') return item.driverName || 'ثبت‌نشده';
    if (colKey === 'driverPhone') return item.driverPhone || 'بدون شماره';
    if (colKey === 'lastVisitDate') return item.lastVisitDate || '-';
    if (colKey === 'daysPassed') return `${item.daysPassed} روز`;
    if (colKey === 'status') return getDriverStatusText(item);
    return String((item as any)[colKey] ?? '-');
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

  const currentMenuUniqueValues = useMemo(() => {
    if (!filterMenu) return [];
    const valMap = new Map<string, number>();
    overdueDrivers.forEach(d => {
      const val = getDriverColValue(d, filterMenu.colKey);
      valMap.set(val, (valMap.get(val) || 0) + 1);
    });
    return Array.from(valMap.entries()).map(([value, count]) => ({ value, count }));
  }, [filterMenu, overdueDrivers]);

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

  // فیلتر کردن رانندگان بر اساس عبارت جستجو، خودروی انتخابی و فیلترهای سبک اکسل ستون‌ها
  const filteredOverdueDrivers = useMemo(() => {
    return overdueDrivers.filter(item => {
      // فیلتر خودروی انتخابی
      if (selectedFilterVehicleId !== 'all' && item.vehicleId !== selectedFilterVehicleId) {
        return false;
      }

      // جستجو
      const searchLower = searchTerm.trim().toLowerCase();
      if (searchLower) {
        const matchSearch = 
          item.driverName.toLowerCase().includes(searchLower) ||
          item.vehicleName.toLowerCase().includes(searchLower) ||
          item.vehiclePlaque.toLowerCase().includes(searchLower) ||
          (item.company && item.company.toLowerCase().includes(searchLower)) ||
          (item.driverPhone && item.driverPhone.includes(searchLower));
        if (!matchSearch) return false;
      }

      // فیلترهای ستونی سبک اکسل
      for (const [key, selectedVals] of Object.entries(columnFilters)) {
        if (!selectedVals || !Array.isArray(selectedVals)) continue;
        const val = getDriverColValue(item, key);
        if (!selectedVals.includes(val)) return false;
      }

      return true;
    });
  }, [overdueDrivers, selectedFilterVehicleId, searchTerm, columnFilters]);

  // مرتب‌سازی رانندگان نیازمند یادآوری
  const sortedOverdueDrivers = useMemo(() => {
    return sortData<OverdueDriverItem>(filteredOverdueDrivers, sortKey, sortDirection, {
      vehicleName: (d: OverdueDriverItem) => d.vehicleName,
      company: (d: OverdueDriverItem) => d.company || '',
      driverName: (d: OverdueDriverItem) => d.driverName,
      driverPhone: (d: OverdueDriverItem) => d.driverPhone || '',
      lastVisitDate: (d: OverdueDriverItem) => d.lastVisitDate || '',
      daysPassed: (d: OverdueDriverItem) => d.daysPassed,
      status: (d: OverdueDriverItem) => getDriverStatusText(d)
    });
  }, [filteredOverdueDrivers, sortKey, sortDirection]);

  // خروجی فایل اکسل با فرمت استاندارد CSV و پشتیبانی کامل کاراکترهای فارسی UTF-8 BOM
  const handleExportExcel = () => {
    try {
      const sanitize = (val: any) => {
        if (val === undefined || val === null) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const headers = [
        'ردیف',
        'نام خودرو',
        'پلاک خودرو',
        'شرکت',
        'نام راننده',
        'شماره تماس پیامک',
        'کارکرد فعلی (کیلومتر)',
        'آخرین تاریخ سرویس دوره‌ای',
        'نوع آخرین ثبت',
        'روزهای سپری‌شده',
        'وضعیت پیامک',
        'متن پیشنهادی پیامک'
      ];

      const rows = sortedOverdueDrivers.map((item, idx) => {
        return [
          idx + 1,
          item.vehicleName,
          item.vehiclePlaque,
          item.company || 'ثبت‌نشده',
          item.driverName,
          item.driverPhone || 'بدون شماره',
          item.currentKm || 0,
          item.lastVisitDate || '---',
          item.lastVisitType === 'service' ? 'سرویس دوره‌ای' : item.lastVisitType === 'inquiry' ? 'استعلام قبلی' : 'اولیه',
          item.daysPassed,
          getDriverStatusText(item),
          item.recommendedText
        ];
      });

      const csvContent = '\uFEFF' + [
        headers.map(sanitize).join(','),
        ...rows.map(row => row.map(sanitize).join(','))
      ].join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `لیست_رانندگان_نیازمند_یادآوری_کارکرد_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export Excel error:', err);
    }
  };

  // Select all helper
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const ids = sortedOverdueDrivers
        .filter(d => !d.smsAlreadySentRecently && d.driverPhone && d.driverPhone.trim().length >= 7)
        .map(d => d.vehicleId);
      setSelectedVehicleIds(ids);
    } else {
      setSelectedVehicleIds([]);
    }
  };

  const handleSelectVehicle = (vId: number) => {
    setSelectedVehicleIds(prev => 
      prev.includes(vId) ? prev.filter(id => id !== vId) : [...prev, vId]
    );
  };

  return (
    <div className="space-y-4">
      {/* اعلان موفقیت‌آمیز عملیات */}
      {sendSuccessMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 p-3 rounded-lg flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{sendSuccessMessage}</span>
        </div>
      )}

      {/* ۱. پنل تنظیمات و نوار کنترل سررسید روزها (مطابق با استایل کارت‌های پذیرش) */}
      <div className="bg-white dark:bg-[#111113] p-4 rounded-xl border border-slate-200 dark:border-[#2d2d30] shadow-2xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/20">
                <Bell className="w-4 h-4" />
              </div>
              <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                سامانه هوشمند یادآوری پیامکی استعلام کارکرد به رانندگان
              </h2>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                settings.autoSendEnabled 
                  ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30' 
                  : 'bg-slate-100 dark:bg-[#1e1e24] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#2d2d30]'
              }`}>
                {settings.autoSendEnabled ? 'ارسال خودکار: فعال' : 'ارسال خودکار: غیرفعال'}
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs">
              رانندگانی که بیش از <strong className="text-indigo-600 dark:text-indigo-400 font-bold font-mono">{toPersianDigits(settings.daysThreshold)} روز</strong> از تاریخ آخرین سرویس دوره‌ای خودرویشان گذشته است در لیست زیر قرار می‌گیرند.
            </p>
          </div>

          {/* ابزارهای کنترل بالا با استایل دکمه‌های پذیرش */}
          <div className="flex flex-wrap items-center gap-2">
            {/* سوییچ ارسال خودکار */}
            <button
              type="button"
              onClick={handleToggleAutoSend}
              className={`h-[34px] px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                settings.autoSendEnabled
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/50 hover:bg-emerald-100'
                  : 'bg-white dark:bg-[#161619] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-[#2d2d30] hover:bg-slate-50 dark:hover:bg-[#202026]'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${settings.autoSendEnabled ? 'text-emerald-600 dark:text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
              <span>ارسال خودکار: {settings.autoSendEnabled ? 'روشن' : 'خاموش'}</span>
            </button>

            {/* دکمه تنظیمات پیامک */}
            <button
              type="button"
              onClick={() => {
                setTempSettings(settings);
                setIsSettingsOpen(true);
              }}
              className="h-[34px] px-3 bg-white dark:bg-[#161619] hover:bg-slate-50 dark:hover:bg-[#202026] text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-[#2d2d30] rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Settings className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>تنظیمات پیامک</span>
            </button>

            {/* بررسی و ارسال فوری */}
            <button
              type="button"
              onClick={handleTriggerAutoNow}
              disabled={triggeringAuto}
              className="h-[34px] px-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {triggeringAuto ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>بررسی و ارسال فوری</span>
            </button>
          </div>
        </div>

        {/* نوار انتخاب سریع روزهای گذشته از مراجعه */}
        <div className="pt-3 border-t border-slate-200 dark:border-[#2d2d30] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-600 dark:text-slate-400 font-bold flex items-center gap-1 text-[11px] shrink-0">
              <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              سقف روزهای تاخیر مراجعه:
            </span>
            <div className="flex items-center gap-1">
              {[3, 5, 7, 10, 15, 30].map(days => {
                const isSelected = settings.daysThreshold === days;
                return (
                  <button
                    key={days}
                    type="button"
                    onClick={() => handleQuickThresholdChange(days)}
                    className={`h-7 px-2.5 min-w-[50px] text-center rounded-md font-mono text-xs font-bold transition-colors duration-150 cursor-pointer border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-white dark:bg-[#161619] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-[#2d2d30]'
                    }`}
                  >
                    {toPersianDigits(days)} روز
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-400">
            <span>
              کل خودروهای نیازمند استعلام: <strong className="text-indigo-600 dark:text-indigo-400 font-mono text-xs font-bold">{toPersianDigits(overdueDrivers.length)}</strong>
            </span>
            <span>
              آماده ارسال: <strong className="text-emerald-600 dark:text-emerald-400 font-mono text-xs font-bold">
                {toPersianDigits(overdueDrivers.filter(d => !d.smsAlreadySentRecently && d.driverPhone && d.driverPhone.trim().length >= 7).length)}
              </strong>
            </span>
            <span>
              ارسال‌شده اخیر: <strong className="text-amber-600 dark:text-amber-400 font-mono text-xs font-bold">
                {toPersianDigits(overdueDrivers.filter(d => d.smsAlreadySentRecently).length)}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* ۲. ناوبری تب‌های داخلی با انیمیشن خط زیرین دقیقاً شبیه تب‌های بالای صفحه */}
      <div className="flex border-b border-slate-200 dark:border-[#2d2d30] gap-2 overflow-x-auto relative">
        <button
          type="button"
          onClick={() => setSubTab('overdue_list')}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            subTab === 'overdue_list'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>رانندگان نیازمند یادآوری</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 font-mono font-bold">
            {toPersianDigits(overdueDrivers.length)}
          </span>
          {subTab === 'overdue_list' && (
            <motion.div
              layoutId="activeSmsSubTabIndicator"
              className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => setSubTab('sent_history')}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            subTab === 'sent_history'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          <span>تاریخچه پیامک‌های ارسالی یادآوری</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 font-mono font-bold">
            {toPersianDigits(outboundLogs.length)}
          </span>
          {subTab === 'sent_history' && (
            <motion.div
              layoutId="activeSmsSubTabIndicator"
              className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>
      </div>

      {/* ۳. محتوای تب اول: جدول رانندگان نیازمند یادآوری با استایل لیست قسمت پذیرش */}
      {subTab === 'overdue_list' && (
        <div className="space-y-3">
          {/* نوار جستجو و انتخاب خودرو (دقیقاً مشابه تب پایش)، خروجی اکسل و عملیات ارسال گروهی */}
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center relative z-30">
            
            {/* فیلد تکی جستجو و انتخاب خودرو بر اساس نام خودرو (طراحی کاملاً مشابه تب پایش) */}
            <div ref={searchContainerRef} className="relative flex-1">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
                <input 
                  type="text" 
                  placeholder={
                    activeSelectedDriver 
                      ? `خودروی انتخاب‌شده: ${activeSelectedDriver.vehicleName} (${activeSelectedDriver.driverName})` 
                      : "جستجو و انتخاب نام خودرو (تایپ نام خودرو، راننده، پلاک)..."
                  } 
                  value={activeSelectedDriver && !searchTerm ? activeSelectedDriver.vehicleName : searchTerm}
                  onFocus={() => {
                    setIsSearchOpen(true);
                  }}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    if (activeSelectedDriver) {
                      setSelectedFilterVehicleId('all');
                    }
                    setIsSearchOpen(true);
                  }}
                  className={`w-full h-[34px] bg-white dark:bg-[#111113] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg pr-9 pl-8 text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs ${
                    activeSelectedDriver ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20' : 'border-slate-300 dark:border-[#2d2d30]'
                  }`}
                />
                {(searchTerm || activeSelectedDriver) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedFilterVehicleId('all');
                      setIsSearchOpen(false);
                    }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    title="پاک کردن انتخاب"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* لیست پیشنهادات جستجوی نام خودروها (مشابه تب پایش) */}
              {isSearchOpen && (
                <div className="absolute top-full right-0 left-0 mt-1.5 bg-white dark:bg-[#151518] rounded-xl border border-slate-200 dark:border-[#2d2d30] shadow-2xl overflow-hidden max-h-72 overflow-y-auto z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 bg-slate-50 dark:bg-[#1a1a1e] border-b border-slate-200 dark:border-[#2d2d30] flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    <span>{searchTerm.trim() ? `خودروهای منطبق با «${searchTerm}»` : 'لیست خودروها (جهت انتخاب کلیک کنید)'}</span>
                    <span>{toPersianDigits(matchedDrivers.length)} خودرو</span>
                  </div>

                  {matchedDrivers.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-xs font-bold space-y-1">
                      <p>هیچ خودرو یا راننده‌ای با عبارت «{searchTerm}» یافت نشد.</p>
                      <p className="text-[10px] text-slate-400 font-normal">لطفاً املای نام خودرو، پلاک یا راننده را بررسی کنید.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-[#242428]">
                      {matchedDrivers.map(d => {
                        const isSelected = selectedFilterVehicleId === d.vehicleId;

                        return (
                          <div
                            key={d.vehicleId}
                            onClick={() => handleSelectDriverFromDropdown(d)}
                            className={`px-3 py-1.5 transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                              isSelected 
                                ? 'bg-indigo-50 dark:bg-indigo-950/40' 
                                : 'hover:bg-slate-50 dark:hover:bg-[#1c1c20]'
                            }`}
                          >
                            <div className="min-w-0 flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                {d.vehicleName}
                              </span>
                              <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-mono font-bold">
                                راننده: {d.driverName}
                              </span>
                              {d.company && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                  ({d.company})
                                </span>
                              )}
                            </div>

                            <div className="shrink-0 text-left">
                              <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#1a1a1e] px-2 py-0.5 rounded border border-slate-200 dark:border-[#2d2d30]">
                                پلاک: {toPersianDigits(d.vehiclePlaque)}
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

            <div className="flex items-center gap-2">
              {/* دکمه ارسال دسته‌جمعی به موارد تیک‌خورده */}
              {selectedVehicleIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleSendBulkSms}
                  disabled={sendingSms}
                  className="h-[34px] px-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                >
                  {sendingSms ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>ارسال به {toPersianDigits(selectedVehicleIds.length)} راننده انتخاب‌شده</span>
                </button>
              )}

              {/* دکمه خروجی اکسل */}
              <button
                type="button"
                onClick={handleExportExcel}
                className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-2xs shrink-0 group self-center"
                title="دریافت خروجی اکسل (CSV) رانندگان نیازمند یادآوری"
              >
                <FileSpreadsheet className="w-4 h-4 transition-transform group-hover:scale-110" />
              </button>

              <button
                type="button"
                onClick={fetchAllSmsData}
                className="h-[34px] px-2.5 bg-white dark:bg-[#161619] hover:bg-slate-50 dark:hover:bg-[#202026] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 rounded-lg border border-slate-300 dark:border-[#2d2d30] transition-colors cursor-pointer flex items-center justify-center"
                title="به‌روزرسانی لیست"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600 dark:text-indigo-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* کارت جدول لیست مطابق دقیق با لیست قسمت پذیرش */}
          <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden shadow-2xs">
            {/* هدر لیست مشابه لیست پذیرش با قابلیت حذف فیلترها و شمارنده */}
            <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex justify-between items-center">
              <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
                <List className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>لیست رانندگان نیازمند یادآوری کارکرد</span>
              </div>

              <div className="flex items-center gap-2">
                {Object.keys(columnFilters).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setColumnFilters({})}
                    className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    title="حذف تمامی فیلترهای اعمال‌شده روی ستون‌ها"
                  >
                    <X className="w-3 h-3" />
                    <span>حذف فیلترها ({toPersianDigits(Object.keys(columnFilters).length)})</span>
                  </button>
                )}
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  {toPersianDigits(sortedOverdueDrivers.length)} مورد
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] text-slate-600 dark:text-slate-400 font-medium text-xs">
                    <th className="py-2 px-2.5 text-center w-10">
                      <input
                        type="checkbox"
                        onChange={handleSelectAll}
                        checked={
                          sortedOverdueDrivers.length > 0 &&
                          selectedVehicleIds.length === sortedOverdueDrivers.filter(d => !d.smsAlreadySentRecently && d.driverPhone && d.driverPhone.trim().length >= 7).length &&
                          selectedVehicleIds.length > 0
                        }
                        className="rounded bg-white dark:bg-[#1a1a1c] border-slate-300 dark:border-[#2d2d30] text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                    </th>
                    <th className="py-2 px-2.5 text-center w-12 text-xs font-medium">ردیف</th>
                    <TableColumnHeader
                      title="خودرو"
                      colKey="vehicleName"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      isFiltered={!!columnFilters['vehicleName']}
                      onOpenFilter={handleOpenFilterMenu}
                      className="font-medium text-xs text-slate-600 dark:text-slate-400"
                      width="190px"
                    />
                    <TableColumnHeader
                      title="شرکت"
                      colKey="company"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      isFiltered={!!columnFilters['company']}
                      onOpenFilter={handleOpenFilterMenu}
                      className="font-medium text-xs text-slate-600 dark:text-slate-400"
                      width="140px"
                    />
                    <TableColumnHeader
                      title="راننده تحویل‌گیرنده"
                      colKey="driverName"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      isFiltered={!!columnFilters['driverName']}
                      onOpenFilter={handleOpenFilterMenu}
                      className="font-medium text-xs text-slate-600 dark:text-slate-400"
                      width="160px"
                    />
                    <TableColumnHeader
                      title="شماره تماس پیامک"
                      colKey="driverPhone"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      isFiltered={!!columnFilters['driverPhone']}
                      onOpenFilter={handleOpenFilterMenu}
                      className="font-medium text-xs text-slate-600 dark:text-slate-400"
                      width="130px"
                    />
                    <TableColumnHeader
                      title="آخرین تاریخ سرویس دوره‌ای"
                      colKey="lastVisitDate"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      isFiltered={!!columnFilters['lastVisitDate']}
                      onOpenFilter={handleOpenFilterMenu}
                      align="center"
                      className="font-medium text-xs text-slate-600 dark:text-slate-400"
                      width="130px"
                    />
                    <TableColumnHeader
                      title="روزهای تاخیر"
                      colKey="daysPassed"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      isFiltered={!!columnFilters['daysPassed']}
                      onOpenFilter={handleOpenFilterMenu}
                      align="center"
                      className="font-medium text-xs text-slate-600 dark:text-slate-400"
                      width="120px"
                    />
                    <TableColumnHeader
                      title="وضعیت یادآوری"
                      colKey="status"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      isFiltered={!!columnFilters['status']}
                      onOpenFilter={handleOpenFilterMenu}
                      align="center"
                      className="font-medium text-xs text-slate-600 dark:text-slate-400"
                      width="140px"
                    />
                    <th className="py-2 px-3 text-center w-28 text-xs font-medium">پیش‌نمایش پیامک</th>
                    <th className="py-2 px-3 text-center w-28 text-xs font-medium">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#242428]">
                  {sortedOverdueDrivers.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-500 dark:text-slate-400 text-[11px]">
                        {overdueDrivers.length === 0 
                          ? `عالی است! هیچ خودرویی بیش از ${toPersianDigits(settings.daysThreshold)} روز تاخیر در ثبت کارکرد ندارد.`
                          : 'هیچ راننده‌ای با فیلتر جستجو یا فیلترهای انتخابی ستون‌ها یافت نشد.'}
                      </td>
                    </tr>
                  ) : (
                    sortedOverdueDrivers.map((item, idx) => {
                      const isSelected = selectedVehicleIds.includes(item.vehicleId);
                      const hasValidPhone = !!item.driverPhone && item.driverPhone.trim().length >= 7;

                      return (
                        <tr 
                          key={item.vehicleId} 
                          className={`hover:bg-slate-50 dark:hover:bg-[#161618] transition-colors text-[11px] ${
                            isSelected ? 'bg-indigo-50/60 dark:bg-indigo-950/20' : ''
                          }`}
                        >
                          <td className="py-2 px-2.5 text-center">
                            <input
                              type="checkbox"
                              disabled={!hasValidPhone || item.smsAlreadySentRecently}
                              checked={isSelected}
                              onChange={() => handleSelectVehicle(item.vehicleId)}
                              className="rounded bg-white dark:bg-[#1a1a1c] border-slate-300 dark:border-[#2d2d30] text-indigo-600 focus:ring-0 cursor-pointer disabled:opacity-30"
                            />
                          </td>
                          <td className="py-2 px-2.5 text-center text-slate-500 dark:text-slate-400 text-[11px]">
                            {toPersianDigits(idx + 1)}
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-medium text-slate-900 dark:text-white block">{item.vehicleName}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">پلاک: {toPersianDigits(item.vehiclePlaque)}</span>
                          </td>
                          <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                            {item.company || '-'}
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-medium text-slate-800 dark:text-slate-200 block">{item.driverName}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">کارکرد: {toPersianDigits(formatNumber(item.currentKm))} کیلومتر</span>
                          </td>
                          <td className="py-2 px-3">
                            {hasValidPhone ? (
                              <span className="text-slate-700 dark:text-slate-300 dir-ltr text-right inline-block">
                                {toPersianDigits(item.driverPhone)}
                              </span>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400 text-[10px] font-medium inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                فاقد شماره معتبر
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="text-slate-800 dark:text-slate-200 block text-[11px]">{toPersianDigits(item.lastVisitDate)}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-[#1e1e24] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#2d2d30] inline-block mt-0.5">
                              {item.lastVisitType === 'service' ? 'سرویس دوره‌ای' : item.lastVisitType === 'inquiry' ? 'استعلام قبلی' : 'اولیه'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium inline-block ${
                              item.daysPassed >= 20 
                                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40' 
                                : item.daysPassed >= 10 
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40' 
                                : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40'
                            }`}>
                              {toPersianDigits(item.daysPassed)} روز گذشته
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            {item.smsAlreadySentRecently ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 inline-flex items-center gap-1" title="طی ۲۴ ساعت گذشته پیامک ارسال شده است">
                                <Check className="w-3 h-3" />
                                ارسال‌شده
                              </span>
                            ) : !hasValidPhone ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40">
                                عدم امکان ارسال
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                                آماده ارسال
                              </span>
                            )}
                          </td>
                          {/* پیش‌نمایش به صورت دکمه */}
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => setPreviewItem(item)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 dark:bg-[#18181b] dark:hover:bg-indigo-950/40 text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 rounded-md border border-slate-200 dark:border-[#2d2d30] text-[11px] font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs group"
                              title="مشاهده پیش‌نمایش کامل پیامک و مشخصات راننده"
                            >
                              <Eye className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 transition-transform group-hover:scale-110" />
                              <span>پیش‌نمایش</span>
                            </button>
                          </td>
                          {/* دکمه عملیات */}
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleSendSingleSms(item.vehicleId)}
                              disabled={sendingSms || !hasValidPhone}
                              className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all flex items-center justify-center gap-1 mx-auto cursor-pointer shadow-2xs ${
                                item.smsAlreadySentRecently
                                  ? 'bg-amber-50 dark:bg-[#1e1e24] hover:bg-amber-100 dark:hover:bg-[#282830] text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30'
                                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                              } disabled:opacity-40 disabled:cursor-not-allowed`}
                            >
                              <Send className="w-3 h-3" />
                              <span>{item.smsAlreadySentRecently ? 'ارسال مجدد' : 'ارسال پیامک'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ۴. محتوای تب دوم: تاریخچه پیامک‌های ارسالی یادآوری با استایل لیست پذیرش */}
      {subTab === 'sent_history' && (
        <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden shadow-2xs">
          <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex justify-between items-center">
            <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
              <History className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>لاگ پیامک‌های ارسالی یادآوری به رانندگان</span>
            </div>

            <button
              type="button"
              onClick={fetchAllSmsData}
              className="px-2.5 py-1 bg-white dark:bg-[#1a1a1c] hover:bg-slate-100 dark:hover:bg-[#25252a] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md border border-slate-200 dark:border-[#2d2d30] transition-colors text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <RefreshCw className="w-3 h-3" />
              <span>به‌روزرسانی لاگ</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] text-slate-600 dark:text-slate-400 font-medium text-xs">
                  <th className="py-2 px-2.5 text-center w-12 text-xs font-medium">ردیف</th>
                  <th className="py-2 px-3 text-xs font-medium">زمان ارسال</th>
                  <th className="py-2 px-3 text-xs font-medium">خودرو و پلاک</th>
                  <th className="py-2 px-3 text-xs font-medium">راننده</th>
                  <th className="py-2 px-3 text-xs font-medium">شماره گیرنده</th>
                  <th className="py-2 px-3 text-center text-xs font-medium">روزهای تاخیر</th>
                  <th className="py-2 px-3 text-xs font-medium">متن ارسالی پیامک</th>
                  <th className="py-2 px-3 text-center text-xs font-medium">حالت ارسال</th>
                  <th className="py-2 px-3 text-center text-xs font-medium">وضعیت تحویل</th>
                  <th className="py-2 px-3 text-center w-16 text-xs font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#242428]">
                {outboundLogs.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500 dark:text-slate-400 text-[11px]">
                      تاکنون هیچ پیامک یادآوری ارسال نشده است.
                    </td>
                  </tr>
                ) : (
                  outboundLogs.map((log, idx) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-[#161618] transition-colors text-[11px]">
                      <td className="py-2 px-2.5 text-center text-slate-500 dark:text-slate-400 text-[11px]">
                        {toPersianDigits(idx + 1)}
                      </td>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {toPersianDigits(new Date(log.sentAt).toLocaleDateString('fa-IR'))}
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                          {toPersianDigits(new Date(log.sentAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }))}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-medium text-slate-900 dark:text-white block">{log.vehicleName}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">پلاک: {toPersianDigits(log.vehiclePlaque)}</span>
                      </td>
                      <td className="py-2 px-3 text-slate-800 dark:text-slate-200 font-medium">
                        {log.driverName}
                      </td>
                      <td className="py-2 px-3 text-emerald-600 dark:text-emerald-400 dir-ltr text-right font-medium">
                        {toPersianDigits(log.driverPhone)}
                      </td>
                      <td className="py-2 px-3 text-center text-indigo-600 dark:text-indigo-400 font-medium">
                        {toPersianDigits(log.daysSinceLastVisit)} روز
                      </td>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300 max-w-xs">
                        <span className="bg-slate-50 dark:bg-[#18181c] px-2 py-1 rounded text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#2d2d30] block truncate" title={log.messageText}>
                          "{log.messageText}"
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        {log.sentMode === 'automatic' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40">
                            ارسال خودکار
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-[#1e1e24] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#2d2d30]">
                            ارسال دستی
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                          موفق
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteOutboundLog(log.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                          title="حذف لاگ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ۵. مودال پیش‌نمایش تعاملی پیامک (با کلیک روی دکمه پیش‌نمایش) */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141417] border border-slate-200 dark:border-[#2d2d30] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* هدر مودال */}
            <div className="p-3.5 border-b border-slate-200 dark:border-[#2d2d30] flex items-center justify-between bg-slate-50 dark:bg-[#161619]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/20">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">پیش‌نمایش پیامک یادآوری استعلام</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    گیرنده: <strong className="text-slate-800 dark:text-slate-200">{previewItem.driverName}</strong> ({previewItem.vehicleName})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-md hover:bg-slate-200 dark:hover:bg-[#25252a] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* بدنه مودال */}
            <div className="p-4 space-y-3.5">
              {/* خلاصه اطلاعات گیرنده */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-[#18181b] p-3 rounded-lg border border-slate-200 dark:border-[#2d2d30] text-[11px]">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px]">شماره تماس راننده:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 dir-ltr text-right inline-block mt-0.5">
                    {previewItem.driverPhone || 'فاقد شماره تماس'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px]">شماره پلاک خودرو:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 inline-block mt-0.5">
                    {toPersianDigits(previewItem.vehiclePlaque)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px]">مدت تاخیر ثبت:</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400 inline-block mt-0.5">
                    {toPersianDigits(previewItem.daysPassed)} روز سپری‌شده
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px]">آخرین کارکرد کیلومتر:</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 inline-block mt-0.5">
                    {toPersianDigits(formatNumber(previewItem.currentKm))} کیلومتر
                  </span>
                </div>
              </div>

              {/* کادر پیامک نهایی */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                  متن پیامک ارسالی به تلفن همراه راننده:
                </span>
                <div className="p-3.5 bg-slate-50 dark:bg-[#18181c] rounded-lg border border-slate-200 dark:border-[#2d2d30] text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans select-all relative">
                  {previewItem.recommendedText}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 px-1 font-mono">
                  <span>تعداد کاراکتر: {toPersianDigits(previewItem.recommendedText.length)}</span>
                  <span>طول پیامک: {toPersianDigits(Math.ceil(previewItem.recommendedText.length / 70))} صفحه فارسی</span>
                </div>
              </div>
            </div>

            {/* فوتر مودال پیش‌نمایش */}
            <div className="p-3 border-t border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161619] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(previewItem.recommendedText);
                  setCopiedText(true);
                  setTimeout(() => setCopiedText(false), 2000);
                }}
                className="px-3 py-1.5 bg-white dark:bg-[#1a1a1c] hover:bg-slate-100 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-[#2d2d30] text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                {copiedText ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedText ? 'متن کپی شد' : 'کپی متن'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-400 rounded-md border border-slate-200 dark:border-[#2d2d30] text-[11px] font-bold cursor-pointer transition-colors"
                >
                  بستن
                </button>
                <button
                  type="button"
                  disabled={sendingSms || !previewItem.driverPhone || previewItem.driverPhone.trim().length < 7}
                  onClick={async () => {
                    await handleSendSingleSms(previewItem.vehicleId);
                    setPreviewItem(null);
                  }}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>ارسال پیامک</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ۶. مودال تنظیمات پیامک یادآوری و الگوی متن (بدون دو فیلد پایینی طبق درخواست کاربر) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141417] border border-slate-200 dark:border-[#2d2d30] rounded-xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-3.5 border-b border-slate-200 dark:border-[#2d2d30] flex items-center justify-between bg-slate-50 dark:bg-[#161619]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/20">
                  <Settings className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">تنظیمات یادآوری پیامکی و متن الگو</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-md hover:bg-slate-200 dark:hover:bg-[#25252a] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="p-4 space-y-3.5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* سقف روزهای تاخیر */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                    تعداد روز گذشته برای ارسال پیامک:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={tempSettings.daysThreshold}
                    onChange={(e) => setTempSettings({ ...tempSettings, daysThreshold: Number(e.target.value) || 7 })}
                    className="w-full h-[36px] bg-white dark:bg-[#161619] border border-slate-300 dark:border-[#2d2d30] rounded-md px-3 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">خودروهایی که پس از این تعداد روز مراجعه نکرده‌اند پیامک دریافت می‌کنند.</span>
                </div>

                {/* مبنای محاسبه روزها */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                    مبنای محاسبه روزهای تاخیر:
                  </label>
                  <select
                    value={tempSettings.checkBasedOn}
                    onChange={(e: any) => setTempSettings({ ...tempSettings, checkBasedOn: e.target.value })}
                    className="w-full h-[36px] bg-white dark:bg-[#161619] border border-slate-300 dark:border-[#2d2d30] rounded-md px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="last_service">فقط تاریخ آخرین سرویس دوره‌ای (پیش‌فرض)</option>
                    <option value="last_inquiry_or_service">جدیدترین تاریخ (سرویس یا استعلام)</option>
                    <option value="last_inquiry">فقط تاریخ آخرین استعلام</option>
                  </select>
                </div>
              </div>

              {/* فعال‌سازی ارسال خودکار */}
              <div className="p-3 bg-slate-50 dark:bg-[#161619] rounded-lg border border-slate-200 dark:border-[#2d2d30] flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">فعال‌سازی ارسال خودکار پیامک</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">پایش خودکار و ارسال دوره‌ای پیامک به رانندگان دارای تاخیر</span>
                </div>
                <input
                  type="checkbox"
                  checked={tempSettings.autoSendEnabled}
                  onChange={(e) => setTempSettings({ ...tempSettings, autoSendEnabled: e.target.checked })}
                  className="w-4 h-4 rounded bg-white dark:bg-[#1b1b1f] border-slate-300 dark:border-[#2d2d30] text-indigo-600 focus:ring-0 cursor-pointer"
                />
              </div>

              {/* جلوگیری از ارسال مکرر */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                  جلوگیری از ارسال مجدد پیامک تکراری (ساعت):
                </label>
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={tempSettings.preventDuplicateHours}
                  onChange={(e) => setTempSettings({ ...tempSettings, preventDuplicateHours: Number(e.target.value) || 24 })}
                  className="w-full h-[36px] bg-white dark:bg-[#161619] border border-slate-300 dark:border-[#2d2d30] rounded-md px-3 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">فاصله زمانی عدم ارسال مجدد پیامک برای خودرو پس از ارسال قبلی.</span>
              </div>

              {/* الگوی متن پیامک */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    الگوی متن پیامک یادآوری ارسالی به راننده:
                  </label>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400">امکان درج متغیرها</span>
                </div>
                <textarea
                  rows={3}
                  value={tempSettings.smsTemplate}
                  onChange={(e) => setTempSettings({ ...tempSettings, smsTemplate: e.target.value })}
                  className="w-full bg-white dark:bg-[#161619] border border-slate-300 dark:border-[#2d2d30] rounded-md p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed font-sans"
                />
                
                {/* برچسب‌های متغیرها با معادل فارسی و انگلیسی جهت درج آسان */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600 dark:text-slate-400 font-bold flex items-center gap-1">
                      متغیرهای مجاز (جهت درج در متن کلیک کنید):
                    </span>
                    <span className="text-[10px] text-slate-400">با کلیک روی هر متغیر، به انتهای متن اضافه می‌شود</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {[
                      { tag: '{driverName}', label: 'نام راننده' },
                      { tag: '{vehicleName}', label: 'نام خودرو' },
                      { tag: '{plaque}', label: 'شماره پلاک' },
                      { tag: '{company}', label: 'نام شرکت' },
                      { tag: '{daysPassed}', label: 'تعداد روز تاخیر' },
                      { tag: '{currentKm}', label: 'آخرین کیلومتر' },
                    ].map(v => (
                      <button
                        key={v.tag}
                        type="button"
                        onClick={() => setTempSettings({ ...tempSettings, smsTemplate: (tempSettings.smsTemplate ? tempSettings.smsTemplate + ' ' : '') + v.tag })}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-indigo-50 dark:bg-[#1e1e24] dark:hover:bg-indigo-950/40 text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-[#2d2d30] hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors cursor-pointer text-xs"
                        title={`افزودن ${v.label} (${v.tag}) به متن پیامک`}
                      >
                        <span className="font-bold text-[11px]">{v.label}:</span>
                        <code className="font-mono text-indigo-600 dark:text-indigo-400 font-bold dir-ltr text-[10.5px] bg-white dark:bg-[#141416] px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#2d2d30]">
                          {v.tag}
                        </code>
                      </button>
                    ))}
                  </div>

                  {/* پیش‌نمایش زنده الگو با داده‌های نمونه */}
                  <div className="mt-2 p-2.5 rounded-lg bg-slate-50 dark:bg-[#161619] border border-slate-200 dark:border-[#2d2d30] text-[11px] space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                      پیش‌نمایش پیامک با جایگذاری مقادیر واقعی نمونه:
                    </span>
                    <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-sans bg-white dark:bg-[#111113] p-2 rounded border border-slate-200 dark:border-[#25252a]">
                      {(tempSettings.smsTemplate || '')
                        .replace(/{driverName}/g, 'علی رضایی')
                        .replace(/{vehicleName}/g, 'پژو ۴۰۵')
                        .replace(/{plaque}/g, '۱۲ع۳۴۵ ایران ۷۸')
                        .replace(/{company}/g, 'ترابری مرکزی')
                        .replace(/{daysPassed}/g, '۷')
                        .replace(/{currentKm}/g, '۱۴۸,۵۰۰')}
                    </p>
                  </div>
                </div>
              </div>

              {/* دکمه‌های تایید و انصراف مودال */}
              <div className="pt-3 border-t border-slate-200 dark:border-[#2d2d30] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-[#1a1a1c] dark:hover:bg-[#252528] text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer border border-slate-200 dark:border-[#2d2d30]"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>ذخیره تنظیمات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* منوی فیلتر ستونی سبک اکسل مشابه قسمت پذیرش */}
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
