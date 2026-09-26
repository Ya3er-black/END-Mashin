/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PhoneCall, Gauge, AlertTriangle, AlertCircle, CheckCircle2, Clock, Calendar, 
  Search, Plus, Wrench, ArrowUpRight, ShieldAlert, History, 
  Check, X, Edit2, Trash2, Phone, Truck, TrendingUp, Info, RefreshCw,
  Sparkles, Layers, ListFilter, MessageSquare, Radio, ExternalLink, Bell,
  FileSpreadsheet, List, Eye
} from 'lucide-react';
import { Vehicle, PeriodicService, ServiceDefinition, OdometerLog, User, VehicleFailure, RepairWorkflow, PartInventory, SmsInboundLog } from '../types';
import { toPersianDigits, formatNumber, parsePersianNumber } from '../utils/numberUtils';
import { getCurrentJalaliDate, addDaysToJalaliDate, jalaliDayDifference } from '../utils/date';
import { JalaliDatePicker } from './JalaliDatePicker';
import { Pagination } from './Pagination';
import { TableColumnHeader, ColumnFilterMenu, FilterMenuState } from './TableFilterSort';
import { sortData, SortDirection } from '../utils/sortUtils';
import { calculateComprehensiveServiceHealth, ComprehensiveServiceHealth, findLastServiceOrRepairEvent, getLatestVehicleKm } from '../utils/serviceMatching';
import { CustomSelect } from './CustomSelect';
import SmsRemindersTab from './SmsRemindersTab';
import { OdometerInquiryFormView } from './OdometerInquiryFormView';
import { getVehicleDisplayName, matchesVehicleSearch } from '../utils/vehicleUtils';

const startsWithPrefix = (text: string | undefined | null, prefix: string): boolean => {
  if (!text) return false;
  return text.toLowerCase().includes(prefix.toLowerCase());
};

interface OdometerTrackingViewProps {
  vehicles: Vehicle[];
  services: PeriodicService[];
  serviceDefinitions: ServiceDefinition[];
  odometerLogs: OdometerLog[];
  smsLogs?: SmsInboundLog[];
  failures?: VehicleFailure[];
  workflows?: RepairWorkflow[];
  parts?: PartInventory[];
  currentUser: User | null;
  onAddOdometerLog: (log: Omit<OdometerLog, 'id' | 'createdAt'>) => Promise<void>;
  onEditOdometerLog: (id: number, log: Partial<OdometerLog>) => Promise<void>;
  onDeleteOdometerLog: (id: number) => Promise<void>;
  onSimulateSms?: (senderPhone: string, message: string) => Promise<any>;
  onDeleteSmsLog?: (id: number) => Promise<void>;
  onSyncSms?: () => Promise<any>;
  onAssignSms?: (id: number, vehicleId: number, updateDriverPhone: boolean) => Promise<any>;
  onNavigateToServices?: (vehicleId?: number, serviceType?: string) => void;
}

export type ServiceHealthStatus = ComprehensiveServiceHealth;

export interface GlobalDueServiceItem {
  id: string;
  vehicleId: number;
  vehicleName: string;
  vehicleCode?: string;
  vehiclePlaque: string;
  driverName?: string;
  driverPhone?: string;
  company?: string;
  currentKm: number;
  serviceType: string;
  definitionId: number;
  lastServicedKm?: number;
  lastServicedDate?: string;
  targetDueKm: number;
  remainingKm: number;
  status: 'overdue' | 'warning';
  progressPercent: number;
  elapsedKm: number;
  estimatedDate: string;
  daysRemaining: number;
}

export default function OdometerTrackingView({
  vehicles,
  services,
  serviceDefinitions,
  odometerLogs,
  smsLogs = [],
  failures = [],
  workflows = [],
  parts = [],
  currentUser,
  onAddOdometerLog,
  onEditOdometerLog,
  onDeleteOdometerLog,
  onSimulateSms,
  onDeleteSmsLog,
  onSyncSms,
  onAssignSms,
  onNavigateToServices
}: OdometerTrackingViewProps) {
  // تب‌های اصلی بخش (پیش‌فرض: لیست پایش و پیش‌بینی)
  const [activeTab, setActiveTab] = useState<'matrix' | 'due_services' | 'fleet_call' | 'inquiry_logs' | 'sms_reminders' | 'sms_gateway'>('matrix');

  // استیت‌های تب سوابق استعلامات
  const [inquiryLogsSearchTerm, setInquiryLogsSearchTerm] = useState('');
  const [inquiryLogsSortKey, setInquiryLogsSortKey] = useState<string>('id');
  const [inquiryLogsSortDirection, setInquiryLogsSortDirection] = useState<SortDirection>('desc');
  const [inquiryLogsPage, setInquiryLogsPage] = useState(1);
  const [inquiryLogsPageSize, setInquiryLogsPageSize] = useState(25);
  const [inquiryLogsColumnFilters, setInquiryLogsColumnFilters] = useState<Record<string, string[]>>({});
  const [inquiryFilterMenu, setInquiryFilterMenu] = useState<FilterMenuState | null>(null);

  // استیت‌های استعلام و همگام‌سازی پیامک‌ها
  const [isSyncingSms, setIsSyncingSms] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // استیت‌های مدال تخصیص پیامک به خودرو
  const [assignModalLog, setAssignModalLog] = useState<SmsInboundLog | null>(null);
  const [assignVehicleId, setAssignVehicleId] = useState<number | ''>('');
  const [assignUpdatePhone, setAssignUpdatePhone] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);

  // متد استعلام زنده پیامک‌های دریافتی از درگاه
  const handleSyncIncomingSms = async () => {
    if (!onSyncSms) return;
    setIsSyncingSms(true);
    setSyncStatusMsg(null);
    try {
      const res = await onSyncSms();
      if (res && res.success) {
        if (res.newCount > 0) {
          setSyncStatusMsg({
            type: 'success',
            text: `تعداد ${toPersianDigits(res.newCount)} پیامک جدید با موفقیت از پنل پیامک دریافت و در سیستم ثبت گردید.`
          });
        } else {
          setSyncStatusMsg({
            type: 'info',
            text: `پیامک جدیدی در صندوق پنل یافت نشد. همه پیامک‌ها قبلاً همگام شده‌اند (مجموع: ${toPersianDigits(res.totalLogs || smsLogs.length)} پیامک).`
          });
        }
      } else {
        setSyncStatusMsg({
          type: 'error',
          text: res?.message || 'خطا در استعلام پیامک‌ها از درگاه.'
        });
      }
    } catch (e: any) {
      setSyncStatusMsg({
        type: 'error',
        text: e?.message || 'خطا در ارتباط با وب‌سرویس پیامک.'
      });
    } finally {
      setIsSyncingSms(false);
      setTimeout(() => setSyncStatusMsg(null), 8000);
    }
  };

  // متد تایید و تخصیص پیامک به یک خودرو
  const handleConfirmAssign = async () => {
    if (!assignModalLog || !assignVehicleId || !onAssignSms) return;
    setIsAssigning(true);
    try {
      await onAssignSms(assignModalLog.id, Number(assignVehicleId), assignUpdatePhone);
      setAssignModalLog(null);
      setAssignVehicleId('');
      setSyncStatusMsg({
        type: 'success',
        text: 'کارکرد خودرو با موفقیت به‌روزرسانی شد و پیامک به خودرو متصل گردید.'
      });
    } catch (err: any) {
      alert(err?.message || 'خطا در تخصیص پیامک به خودرو');
    } finally {
      setIsAssigning(false);
    }
  };

  // ذخیره‌سازی سقف روزهای انتخابی در تب یادآوری پیامک برای جلوگیری از لرزش و پرش هنگام جابجایی تب‌ها
  const [smsDaysThreshold, setSmsDaysThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('odometer_sms_reminder_days_threshold');
      if (saved) {
        const num = parseInt(saved, 10);
        if (!isNaN(num) && num > 0) return num;
      }
    } catch {}
    return 7;
  });

  // استیت مدال جزئیات سرویس و سلامت خودرو
  const [selectedFleetVehicleForDetails, setSelectedFleetVehicleForDetails] = useState<any | null>(null);

  // خودروی انتخابی برای ماتریس تحلیل قطعات
  // انتخاب اولیه شناسه خودرو - پیش‌فرض 0 تا زمانی که خودرویی انتخاب شود
  const [selectedVehicleId, setSelectedVehicleId] = useState<number>(0);

  // استیت‌های تب پیامک راننده
  const [smsSearchTerm, setSmsSearchTerm] = useState('');
  const [smsStatusFilter, setSmsStatusFilter] = useState<'all' | 'success' | 'error'>('all');

  // میانگین پیمایش روزانه سفارشی برای خودروی انتخابی
  const [customDailyRate, setCustomDailyRate] = useState<number>(75);

  // استیت‌های مدال ثبت / ویرایش استعلام
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<OdometerLog | null>(null);
  const [formVehicleId, setFormVehicleId] = useState<number>(0);
  const [formInquiryDate, setFormInquiryDate] = useState<string>(() => getCurrentJalaliDate());
  const [formInquiryTime, setFormInquiryTime] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [formOdometerKm, setFormOdometerKm] = useState<number | ''>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string>('');

  // استیت‌های مرتب‌سازی، فیلتر و صفحه‌بندی ماتریس پایش قطعات
  const [matrixSortKey, setMatrixSortKey] = useState<string>('progressPercent');
  const [matrixSortDirection, setMatrixSortDirection] = useState<SortDirection>('desc');
  const [matrixPage, setMatrixPage] = useState(1);
  const [matrixPageSize, setMatrixPageSize] = useState(10);
  const [matrixColumnFilters, setMatrixColumnFilters] = useState<Record<string, string[]>>({});
  const [matrixFilterMenu, setMatrixFilterMenu] = useState<FilterMenuState | null>(null);

  // استیت‌های تب خدمات سررسید شده و اخطار (کل ناوگان)
  const [dueSearchTerm, setDueSearchTerm] = useState('');
  const [dueStatusFilter, setDueStatusFilter] = useState<'all' | 'overdue' | 'warning'>('all');
  const [dueSortKey, setDueSortKey] = useState<string>('remainingKm');
  const [dueSortDirection, setDueSortDirection] = useState<SortDirection>('asc');
  const [duePage, setDuePage] = useState(1);
  const [duePageSize, setDuePageSize] = useState(10);
  const [dueColumnFilters, setDueColumnFilters] = useState<Record<string, string[]>>({});
  const [dueFilterMenu, setDueFilterMenu] = useState<FilterMenuState | null>(null);

  // استیت‌های جدول لیست سریع ناوگان
  const [fleetSearchTerm, setFleetSearchTerm] = useState('');
  const [fleetSortKey, setFleetSortKey] = useState<string>('name');
  const [fleetSortDirection, setFleetSortDirection] = useState<SortDirection>('asc');
  const [fleetPage, setFleetPage] = useState(1);
  const [fleetPageSize, setFleetPageSize] = useState(10);
  const [fleetColumnFilters, setFleetColumnFilters] = useState<Record<string, string[]>>({});
  const [fleetFilterMenu, setFleetFilterMenu] = useState<FilterMenuState | null>(null);

  // همگام‌سازی خودکار دوره‌ای پیامک‌ها از درگاه در پس‌زمینه با ارجاع پایدار
  const onSyncSmsRef = useRef(onSyncSms);
  useEffect(() => {
    onSyncSmsRef.current = onSyncSms;
  }, [onSyncSms]);

  useEffect(() => {
    // استعلام اولیه با تاخیر کوتاه برای اجازه به بارگذاری اولیه سامانه
    const initialTimer = setTimeout(() => {
      onSyncSmsRef.current?.().catch(() => {});
    }, 2500);

    // تکرار خودکار هر ۶۰ ثانیه
    const interval = setInterval(() => {
      onSyncSmsRef.current?.().catch(() => {});
    }, 60000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  // فیلتر تکی جستجو و انتخاب خودرو بر اساس نام خودرو (دقیقاً مشابه بخش پذیرش / FailuresView)
  const [searchTerm, setSearchTerm] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // ریست صفحه و بستن دراپ‌دان در کلیک بیرون
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
    const raw = vehicles.find(v => v.id.toString() === vehicleFilter);
    if (!raw) return null;
    const latestKm = getLatestVehicleKm(raw, odometerLogs, services, failures) || raw.currentKm || 0;
    return {
      ...raw,
      currentKm: latestKm
    };
  }, [vehicles, vehicleFilter, odometerLogs, services, failures]);

  const handleSelectVehicle = (v: Vehicle) => {
    setVehicleFilter(v.id.toString());
    setSelectedVehicleId(v.id);
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

  // پیدا کردن خودروی انتخابی بر اساس فیلتر فعال (در صورت عدم انتخاب هیچ خودرویی، null خواهد بود)
  const currentSelectedVehicle = useMemo(() => {
    if (activeVehicle) return activeVehicle;
    return null;
  }, [activeVehicle]);

  // آخرین استعلام‌های مرتبط با خودروی انتخابی جهت محاسبه نرخ روزانه هوشمند
  const selectedVehicleLogs = useMemo(() => {
    if (!currentSelectedVehicle) return [];
    return odometerLogs.filter(l => l.vehicleId === currentSelectedVehicle.id);
  }, [odometerLogs, currentSelectedVehicle]);

  // محاسبه متوسط کارکرد روزانه خودکار برای خودرو
  const calculatedDailyRate = useMemo(() => {
    if (selectedVehicleLogs.length >= 2) {
      const latest = selectedVehicleLogs[0];
      const prev = selectedVehicleLogs[1];
      const diffKm = latest.odometerKm - prev.odometerKm;
      const days = Math.max(1, jalaliDayDifference(prev.inquiryDate, latest.inquiryDate));
      if (diffKm > 0 && days > 0) {
        return Math.round(diffKm / days);
      }
    }
    return customDailyRate || 75;
  }, [selectedVehicleLogs, customDailyRate]);

  // محاسبه وضعیت سلامت و پیش‌بینی کلیه قطعات و خدمات برای خودروی انتخابی
  const serviceHealthMatrix: ServiceHealthStatus[] = useMemo(() => {
    if (!currentSelectedVehicle) return [];

    const rateToUse = customDailyRate > 0 ? customDailyRate : (calculatedDailyRate || 75);

    return serviceDefinitions.map(def => {
      return calculateComprehensiveServiceHealth(
        currentSelectedVehicle,
        def,
        services,
        failures,
        workflows,
        parts,
        rateToUse,
        odometerLogs
      );
    });
  }, [currentSelectedVehicle, serviceDefinitions, services, failures, workflows, parts, customDailyRate, calculatedDailyRate, odometerLogs]);

  // متدهای فیلتر و سورت ماتریس پایش قطعات
  const getMatrixColValue = (item: ServiceHealthStatus, colKey: string): string => {
    const isNoHistory = !item.hasHistory || item.status === 'no_history';
    if (colKey === 'serviceType') return item.serviceType || '-';
    if (colKey === 'lastServicedKm') {
      return !isNoHistory && item.lastServicedKm > 0 ? `${formatNumber(item.lastServicedKm)} کیلومتر` : 'فاقد سابقه قبلی';
    }
    if (colKey === 'targetDueKm') {
      return !isNoHistory && item.targetDueKm > 0 ? `${formatNumber(item.targetDueKm)} کیلومتر` : '-';
    }
    if (colKey === 'remainingKm') {
      if (isNoHistory) return 'فاقد سابقه قبلی';
      return item.status === 'overdue'
        ? `${formatNumber(Math.abs(item.remainingKm))} کیلومتر گذشته`
        : `${formatNumber(item.remainingKm)} کیلومتر مانده`;
    }
    if (colKey === 'status' || colKey === 'progressPercent') {
      if (isNoHistory) return 'بدون سابقه قبلی';
      return item.status === 'overdue' ? 'منقضی (سررسید گذشته)' : item.status === 'warning' ? 'در آستانه تعویض' : 'سالم';
    }
    if (colKey === 'estimatedDate') {
      if (isNoHistory || !item.estimatedDate || item.estimatedDate === '-') return '-';
      return item.estimatedDate;
    }
    if (colKey === 'daysRemaining') {
      if (isNoHistory || !item.estimatedDate || item.estimatedDate === '-') return '-';
      if (item.status === 'overdue') return 'منقضی (اقدام فوری)';
      return `${item.daysRemaining} روز مانده`;
    }
    return String((item as any)[colKey] ?? '-');
  };

  const handleSortMatrix = (key: string) => {
    if (matrixSortKey === key) {
      setMatrixSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setMatrixSortKey(key);
      setMatrixSortDirection('asc');
    }
  };

  const handleOpenMatrixFilterMenu = (e: React.MouseEvent, colKey: string, colTitle: string) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 270;
    const menuHeight = 360;
    const clampedX = Math.max(10, Math.min(e.clientX - 100, window.innerWidth - menuWidth - 10));
    const clampedY = Math.max(10, Math.min(e.clientY + 8, window.innerHeight - menuHeight - 10));
    setMatrixFilterMenu({
      x: clampedX,
      y: clampedY,
      colKey,
      colTitle
    });
  };

  const currentMatrixMenuUniqueValues = useMemo(() => {
    if (!matrixFilterMenu) return [];
    const valMap = new Map<string, number>();
    serviceHealthMatrix.forEach(item => {
      const val = getMatrixColValue(item, matrixFilterMenu.colKey);
      valMap.set(val, (valMap.get(val) || 0) + 1);
    });
    return Array.from(valMap.entries()).map(([value, count]) => ({ value, count }));
  }, [matrixFilterMenu, serviceHealthMatrix]);

  const currentMatrixSelectedValues = useMemo(() => {
    if (!matrixFilterMenu) return [];
    if (matrixColumnFilters[matrixFilterMenu.colKey]) {
      return matrixColumnFilters[matrixFilterMenu.colKey];
    }
    return currentMatrixMenuUniqueValues.map(v => v.value);
  }, [matrixFilterMenu, matrixColumnFilters, currentMatrixMenuUniqueValues]);

  const handleToggleMatrixColumnValue = (val: string) => {
    if (!matrixFilterMenu) return;
    const colKey = matrixFilterMenu.colKey;
    const allVals = currentMatrixMenuUniqueValues.map(v => v.value);
    const currSelected = matrixColumnFilters[colKey] ?? allVals;

    let updated: string[];
    if (currSelected.includes(val)) {
      updated = currSelected.filter(v => v !== val);
    } else {
      updated = [...currSelected, val];
    }

    if (updated.length === allVals.length) {
      const next = { ...matrixColumnFilters };
      delete next[colKey];
      setMatrixColumnFilters(next);
    } else {
      setMatrixColumnFilters({ ...matrixColumnFilters, [colKey]: updated });
    }
  };

  const filteredMatrixList = useMemo(() => {
    return serviceHealthMatrix.filter(item => {
      for (const [key, selectedVals] of Object.entries(matrixColumnFilters)) {
        const itemVal = getMatrixColValue(item, key);
        if (Array.isArray(selectedVals) && !selectedVals.includes(itemVal)) return false;
      }
      return true;
    });
  }, [serviceHealthMatrix, matrixColumnFilters]);

  useEffect(() => {
    setMatrixPage(1);
  }, [matrixColumnFilters, selectedVehicleId, vehicleFilter]);

  const sortedMatrixList = useMemo(() => {
    const customExtractors: Record<string, (item: ServiceHealthStatus) => any> = {
      status: (item) => (!item.hasHistory || item.status === 'no_history' ? 0 : item.status === 'overdue' ? 3 : item.status === 'warning' ? 2 : 1),
      daysRemaining: (item) => (!item.hasHistory || item.status === 'no_history' ? 999999 : item.status === 'overdue' ? -999999 + item.daysRemaining : item.daysRemaining),
      lastServicedKm: (item) => (!item.hasHistory || item.status === 'no_history' ? 0 : item.lastServicedKm || 0),
      targetDueKm: (item) => (!item.hasHistory || item.status === 'no_history' ? 0 : item.targetDueKm || 0),
      remainingKm: (item) => (!item.hasHistory || item.status === 'no_history' ? 999999 : item.remainingKm || 0),
      progressPercent: (item) => (!item.hasHistory || item.status === 'no_history' ? 0 : item.progressPercent || 0),
    };
    return sortData(filteredMatrixList, matrixSortKey, matrixSortDirection, customExtractors);
  }, [filteredMatrixList, matrixSortKey, matrixSortDirection]);

  const totalMatrixPages = Math.ceil(sortedMatrixList.length / matrixPageSize) || 1;
  const paginatedMatrixList = useMemo(() => {
    const start = (matrixPage - 1) * matrixPageSize;
    return sortedMatrixList.slice(start, start + matrixPageSize);
  }, [sortedMatrixList, matrixPage, matrixPageSize]);

  // باز کردن فرم استعلام جدید
  const handleOpenAddModal = (vehicleIdToPreselect?: number) => {
    const vId = vehicleIdToPreselect || (currentSelectedVehicle ? currentSelectedVehicle.id : (vehicles[0]?.id || 0));
    const targetV = vehicles.find(v => v.id === vId);
    const targetLatestKm = targetV ? getLatestVehicleKm(targetV, odometerLogs, services, failures) : '';

    setEditingLog(null);
    setFormVehicleId(vId);
    setFormInquiryDate(getCurrentJalaliDate());
    const now = new Date();
    setFormInquiryTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    setFormOdometerKm(targetLatestKm || (targetV?.currentKm ? targetV.currentKm : ''));
    setFormNotes('');
    setFormError('');
    setIsModalOpen(true);
  };

  // باز کردن فرم ویرایش استعلام
  const handleOpenEditModal = (log: OdometerLog) => {
    setEditingLog(log);
    setFormVehicleId(log.vehicleId);
    setFormInquiryDate(log.inquiryDate);
    setFormInquiryTime(log.inquiryTime || '10:00');
    setFormOdometerKm(log.odometerKm);
    setFormNotes(log.notes || '');
    setFormError('');
    setIsModalOpen(true);
  };

  // ثبت و ارسال فرم استعلام
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formVehicleId) {
      setFormError('لطفاً خودرو را انتخاب کنید.');
      return;
    }
    if (formOdometerKm === '' || Number(formOdometerKm) < 0) {
      setFormError('لطفاً کیلومتر معتبر کارکرد خودرو را وارد کنید.');
      return;
    }

    const selectedV = vehicles.find(v => v.id === formVehicleId);
    const enteredKm = Number(formOdometerKm);

    setIsSubmitting(true);
    setFormError('');

    try {
      const now = new Date();
      const currentFormattedTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const timeToSend = formInquiryTime || currentFormattedTime;

      if (editingLog) {
        await onEditOdometerLog(editingLog.id, {
          vehicleId: formVehicleId,
          inquiryDate: formInquiryDate,
          inquiryTime: timeToSend,
          odometerKm: enteredKm,
          notes: formNotes
        });
      } else {
        const prevRecordedKm = selectedV ? (getLatestVehicleKm(selectedV, odometerLogs, services, failures) || selectedV.currentKm || 0) : 0;
        await onAddOdometerLog({
          vehicleId: formVehicleId,
          inquiryDate: formInquiryDate,
          inquiryTime: timeToSend,
          odometerKm: enteredKm,
          previousKm: prevRecordedKm,
          driverName: selectedV?.driverName,
          driverPhone: selectedV?.driverPhone,
          company: selectedV?.company,
          plaque: selectedV?.plaque,
          vehicleName: selectedV?.name,
          recordedBy: currentUser?.fullName || 'مدیر سیستم',
          notes: formNotes
        });
      }

      // تنظیم خودرو انتخابی روی خودرویی که استعلام شد
      setSelectedVehicleId(formVehicleId);
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'خطا در ثبت اطلاعات استعلام.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // لیست پردازش‌شده ناوگان برای تب لیست سریع ناوگان همراه با آخرین استعلام و محاسبه وضعیت سرویس‌ها
  const augmentedFleetList = useMemo(() => {
    return vehicles.map(v => {
      const vLogs = odometerLogs.filter(l => l.vehicleId === v.id);
      const latestLog = vLogs[0];
      const vehicleLatestKm = getLatestVehicleKm(v, odometerLogs, services, failures) || v.currentKm || 0;
      const vWithLatestKm = {
        ...v,
        currentKm: vehicleLatestKm
      };

      // محاسبه وضعیت کلیه سرویس‌ها برای این خودرو
      const serviceItems = serviceDefinitions.map(def => {
        return calculateComprehensiveServiceHealth(
          vWithLatestKm,
          def,
          services,
          failures,
          workflows,
          parts,
          75,
          odometerLogs
        );
      });

      const overdueItems = serviceItems.filter(item => item.hasHistory && item.status === 'overdue');
      const warningItems = serviceItems.filter(item => item.hasHistory && item.status === 'warning');
      const overdueCount = overdueItems.length;
      const warningCount = warningItems.length;
      const needsService = overdueCount > 0 || warningCount > 0;

      // اولویت‌بندی جهت تعیین نزدیک‌ترین پیش‌بینی سرویس در لیست پایش
      const sortedByUrgency = [...serviceItems].sort((a, b) => {
        const getScore = (it: any) => {
          if (!it.hasHistory || it.status === 'no_history') return 0;
          if (it.status === 'overdue') return 3;
          if (it.status === 'warning') return 2;
          return 1;
        };
        const diff = getScore(b) - getScore(a);
        if (diff !== 0) return diff;
        return (a.remainingKm ?? 999999) - (b.remainingKm ?? 999999);
      });
      const nextPrediction = sortedByUrgency[0] || null;
      const urgentServiceText = (nextPrediction && nextPrediction.hasHistory && (nextPrediction.status === 'overdue' || nextPrediction.status === 'warning'))
        ? (nextPrediction.status === 'overdue'
            ? `منقضی: ${nextPrediction.serviceType} (${Math.abs(nextPrediction.remainingKm)} km گذشته)`
            : `${nextPrediction.serviceType} (موعد: ${nextPrediction.estimatedDate || 'نامشخص'} - ${nextPrediction.remainingKm} km مانده)`)
        : 'سالم / بدون سررسید فوری';

      // محاسبه آخرین سرویس دوره‌ای و تاخیر از آخرین مراجعه به سرویس
      const vServices = (services || [])
        .filter(s => Number(s.vehicleId) === Number(v.id) && s.status !== 'in_progress')
        .sort((a, b) => {
          const dDiff = String(b.serviceDate || '').localeCompare(String(a.serviceDate || ''));
          if (dDiff !== 0) return dDiff;
          return Number(b.id || 0) - Number(a.id || 0);
        });
      const lastService = vServices[0] || null;
      const lastServiceDate = lastService?.serviceDate || 'بدون سابقه';
      const daysSinceLastService = lastService?.serviceDate
        ? Math.max(0, jalaliDayDifference(lastService.serviceDate, getCurrentJalaliDate()))
        : null;
      const serviceDelayText = daysSinceLastService !== null
        ? `${daysSinceLastService} روز تاخیر`
        : 'بدون سابقه سرویس';

      return {
        ...v,
        latestLog,
        lastInquiryDate: latestLog ? latestLog.inquiryDate : 'بدون سابقه',
        lastService,
        lastServiceDate,
        daysSinceLastService,
        serviceDelayText,
        serviceItems,
        nextPrediction,
        urgentServiceText,
        overdueCount,
        warningCount,
        needsService
      };
    });
  }, [vehicles, odometerLogs, serviceDefinitions, services, failures, workflows, parts]);

  const getFleetColValue = (item: any, colKey: string): string => {
    if (colKey === 'name') return item.name || 'ثبت نشده';
    if (colKey === 'plaque') return item.plaque || 'ثبت نشده';
    if (colKey === 'company') return item.company || 'ثبت نشده';
    if (colKey === 'driverName') return item.driverName || 'ثبت نشده';
    if (colKey === 'driverPhone') return item.driverPhone ? toPersianDigits(item.driverPhone) : 'بدون تلفن';
    if (colKey === 'currentKm') return `${formatNumber(item.currentKm || 0)} km`;
    if (colKey === 'lastInquiryDate') return item.lastInquiryDate || 'بدون سابقه';
    if (colKey === 'lastService') return item.lastServiceDate || 'بدون سابقه';
    if (colKey === 'serviceDelay') return item.serviceDelayText || 'بدون سابقه';
    if (colKey === 'urgentService') return item.urgentServiceText || 'سالم';
    return String(item[colKey] ?? '');
  };

  const handleOpenFleetFilterMenu = (e: React.MouseEvent, colKey: string, colTitle: string) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 270;
    const menuHeight = 360;
    const clampedX = Math.max(10, Math.min(e.clientX - 100, window.innerWidth - menuWidth - 10));
    const clampedY = Math.max(10, Math.min(e.clientY + 8, window.innerHeight - menuHeight - 10));
    setFleetFilterMenu({
      x: clampedX,
      y: clampedY,
      colKey,
      colTitle
    });
  };

  const currentFleetMenuUniqueValues = useMemo(() => {
    if (!fleetFilterMenu) return [];
    const valMap = new Map<string, number>();
    augmentedFleetList.forEach(item => {
      const val = getFleetColValue(item, fleetFilterMenu.colKey);
      valMap.set(val, (valMap.get(val) || 0) + 1);
    });
    return Array.from(valMap.entries()).map(([value, count]) => ({ value, count }));
  }, [fleetFilterMenu, augmentedFleetList]);

  const currentFleetSelectedValues = useMemo(() => {
    if (!fleetFilterMenu) return [];
    if (fleetColumnFilters[fleetFilterMenu.colKey]) {
      return fleetColumnFilters[fleetFilterMenu.colKey];
    }
    return currentFleetMenuUniqueValues.map(v => v.value);
  }, [fleetFilterMenu, fleetColumnFilters, currentFleetMenuUniqueValues]);

  const handleToggleFleetColumnValue = (val: string) => {
    if (!fleetFilterMenu) return;
    const colKey = fleetFilterMenu.colKey;
    const allVals = currentFleetMenuUniqueValues.map(v => v.value);
    const currSelected = fleetColumnFilters[colKey] ?? allVals;

    let updated: string[];
    if (currSelected.includes(val)) {
      updated = currSelected.filter(v => v !== val);
    } else {
      updated = [...currSelected, val];
    }

    if (updated.length === allVals.length) {
      const next = { ...fleetColumnFilters };
      delete next[colKey];
      setFleetColumnFilters(next);
    } else {
      setFleetColumnFilters({ ...fleetColumnFilters, [colKey]: updated });
    }
  };

  const handleSortFleet = (key: string) => {
    if (fleetSortKey === key) {
      setFleetSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setFleetSortKey(key);
      setFleetSortDirection('asc');
    }
  };

  const filteredFleetList = useMemo(() => {
    return augmentedFleetList.filter(item => {
      // فیلتر بر اساس خودروی انتخابی از دراپ‌دان یا جستجو
      if (vehicleFilter && vehicleFilter !== 'all') {
        if (item.id.toString() !== vehicleFilter) return false;
      }

      // جستجوی متنی همزمان
      const q = (searchTerm || fleetSearchTerm).toLowerCase().trim();
      if (q) {
        const matches = (
          item.name.toLowerCase().includes(q) ||
          (item.code && item.code.toLowerCase().includes(q)) ||
          (item.plaque && item.plaque.toLowerCase().includes(q)) ||
          (item.driverName && item.driverName.toLowerCase().includes(q)) ||
          (item.driverPhone && item.driverPhone.includes(q)) ||
          (item.company && item.company.toLowerCase().includes(q))
        );
        if (!matches) return false;
      }

      for (const [key, selectedVals] of Object.entries(fleetColumnFilters)) {
        const itemVal = getFleetColValue(item, key);
        if (Array.isArray(selectedVals) && !selectedVals.includes(itemVal)) return false;
      }

      return true;
    });
  }, [augmentedFleetList, vehicleFilter, searchTerm, fleetSearchTerm, fleetColumnFilters]);

  useEffect(() => {
    setFleetPage(1);
  }, [vehicleFilter, searchTerm, fleetSearchTerm, fleetColumnFilters]);

  const sortedFleetList = useMemo(() => {
    return sortData(filteredFleetList, fleetSortKey, fleetSortDirection);
  }, [filteredFleetList, fleetSortKey, fleetSortDirection]);

  const totalFleetPages = Math.ceil(sortedFleetList.length / fleetPageSize) || 1;
  const paginatedFleetList = useMemo(() => {
    const start = (fleetPage - 1) * fleetPageSize;
    return sortedFleetList.slice(start, start + fleetPageSize);
  }, [sortedFleetList, fleetPage, fleetPageSize]);

  // خروجی اکسل برای لیست ناوگان (مشابه بخش سرویس دوره‌ای)
  const handleExportFleetExcel = () => {
    try {
      const sanitize = (val: any) => {
        if (val === undefined || val === null) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const headers = [
        'ردیف',
        'نام خودرو',
        'پلاک',
        'شرکت / مالک',
        'نام راننده',
        'شماره تماس راننده',
        'کارکرد فعلی (کیلومتر)',
        'تاریخ آخرین استعلام',
        'نزدیک‌ترین موعد تعویض'
      ];

      const rows = sortedFleetList.map((v, idx) => [
        idx + 1,
        v.name || '---',
        v.plaque || '---',
        v.company || '---',
        v.driverName || '---',
        v.driverPhone || '---',
        v.currentKm || 0,
        v.lastInquiryDate || 'بدون سابقه',
        v.urgentServiceText || '---'
      ]);

      const csvContent = '\uFEFF' + [
        headers.map(sanitize).join(','),
        ...rows.map(row => row.map(sanitize).join(','))
      ].join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `لیست_سریع_ناوگان_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export fleet excel error:', err);
      alert('خطا در صدور خروجی اکسل ناوگان');
    }
  };

  // خروجی اکسل ماتریس وضعیت قطعات خودروی انتخابی
  const handleExportMatrixExcel = () => {
    if (!currentSelectedVehicle) {
      alert('لطفاً ابتدا یک خودرو را از فیلد جستجوی بالا انتخاب نمایید.');
      return;
    }
    try {
      const sanitize = (val: any) => {
        if (val === undefined || val === null) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const headers = [
        'ردیف',
        'عنوان خدمت / قطعه',
        'آخرین تعویض (کیلومتر)',
        'موعد تعویض بعدی (کیلومتر)',
        'مانده کیلومتر',
        'درصد مصرف',
        'وضعیت',
        'پیش‌بینی تاریخ تعویض'
      ];

      const rows = serviceHealthMatrix.map((item, idx) => {
        const isNoHistory = !item.hasHistory || item.status === 'no_history';
        return [
          idx + 1,
          item.serviceType,
          !isNoHistory && item.lastServicedKm ? item.lastServicedKm : 'فاقد سابقه قبلی',
          !isNoHistory && item.targetDueKm ? item.targetDueKm : '-',
          !isNoHistory ? item.remainingKm : 'فاقد سابقه',
          !isNoHistory ? `${item.progressPercent}%` : '-',
          isNoHistory ? 'بدون سابقه قبلی' : item.status === 'overdue' ? 'منقضی' : item.status === 'warning' ? 'در آستانه تعویض' : 'سالم',
          !isNoHistory ? (item.estimatedDate || '---') : 'نامشخص (فاقد سابقه)'
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
      link.setAttribute('download', `پایش_قطعات_${currentSelectedVehicle?.name || 'خودرو'}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export matrix excel error:', err);
      alert('خطا در صدور خروجی اکسل پایش قطعات');
    }
  };

  // لیست کل خدمات سررسید شده و در آستانه تعویض در کل ناوگان
  const allDueAndWarningServices = useMemo<GlobalDueServiceItem[]>(() => {
    const result: GlobalDueServiceItem[] = [];
    vehicles.forEach(vehicle => {
      const vLatestKm = getLatestVehicleKm(vehicle, odometerLogs, services, failures) || vehicle.currentKm || 0;
      const vehicleWithLatest = { ...vehicle, currentKm: vLatestKm };
      serviceDefinitions.forEach(def => {
        const item = calculateComprehensiveServiceHealth(
          vehicleWithLatest,
          def,
          services,
          failures,
          workflows,
          parts,
          75,
          odometerLogs
        );
        if (item.hasHistory && (item.status === 'overdue' || item.status === 'warning')) {
          result.push({
            id: `${vehicle.id}-${item.definitionId}`,
            vehicleId: vehicle.id,
            vehicleName: vehicle.name,
            vehicleCode: vehicle.code,
            vehiclePlaque: vehicle.plaque,
            driverName: vehicle.driverName,
            driverPhone: vehicle.driverPhone,
            company: vehicle.company,
            currentKm: vLatestKm,
            serviceType: item.serviceType,
            definitionId: item.definitionId,
            lastServicedKm: item.lastServicedKm,
            lastServicedDate: item.lastServicedDate,
            targetDueKm: item.targetDueKm,
            remainingKm: item.remainingKm,
            status: item.status,
            progressPercent: item.progressPercent,
            elapsedKm: item.elapsedKm,
            estimatedDate: item.estimatedDate,
            daysRemaining: item.daysRemaining
          });
        }
      });
    });
    return result;
  }, [vehicles, serviceDefinitions, services, failures, workflows, parts, odometerLogs]);

  const totalDueOverdueCount = useMemo(() => {
    return allDueAndWarningServices.filter(item => item.status === 'overdue').length;
  }, [allDueAndWarningServices]);

  const totalDueWarningCount = useMemo(() => {
    return allDueAndWarningServices.filter(item => item.status === 'warning').length;
  }, [allDueAndWarningServices]);

  const getDueColValue = (item: GlobalDueServiceItem, colKey: string): string => {
    if (colKey === 'vehicleName') return item.vehicleName || 'ثبت نشده';
    if (colKey === 'vehiclePlaque') return item.vehiclePlaque || 'ثبت نشده';
    if (colKey === 'company') return item.company || 'ثبت نشده';
    if (colKey === 'driverName') return item.driverName || 'ثبت نشده';
    if (colKey === 'driverPhone') return item.driverPhone ? toPersianDigits(item.driverPhone) : 'بدون تلفن';
    if (colKey === 'serviceType') return item.serviceType || 'ثبت نشده';
    if (colKey === 'currentKm') return `${formatNumber(item.currentKm || 0)} کیلومتر`;
    if (colKey === 'targetDueKm') {
      return item.targetDueKm ? `${formatNumber(item.targetDueKm)} کیلومتر` : '۰ کیلومتر';
    }
    if (colKey === 'remainingKm') {
      return item.status === 'overdue'
        ? `${formatNumber(Math.abs(item.remainingKm))} کیلومتر گذشته`
        : `${formatNumber(item.remainingKm)} کیلومتر مانده`;
    }
    if (colKey === 'status' || colKey === 'progressPercent') {
      return item.status === 'overdue' ? 'منقضی (سررسید گذشته)' : 'در آستانه تعویض (اخطار)';
    }
    if (colKey === 'estimatedDate') {
      return (!item.estimatedDate || item.estimatedDate === '-' || item.estimatedDate === 'نامشخص') ? '-' : item.estimatedDate;
    }
    if (colKey === 'daysRemaining') {
      if (!item.estimatedDate || item.estimatedDate === '-' || item.estimatedDate === 'نامشخص') return '-';
      return item.status === 'overdue'
        ? (item.daysRemaining < 0 ? `${toPersianDigits(Math.abs(item.daysRemaining))} روز گذشته` : 'سررسید شده')
        : `${toPersianDigits(item.daysRemaining)} روز مانده`;
    }
    return String((item as any)[colKey] ?? '');
  };

  const handleOpenDueFilterMenu = (e: React.MouseEvent, colKey: string, colTitle: string) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 270;
    const menuHeight = 360;
    const clampedX = Math.max(10, Math.min(e.clientX - 100, window.innerWidth - menuWidth - 10));
    const clampedY = Math.max(10, Math.min(e.clientY + 8, window.innerHeight - menuHeight - 10));
    setDueFilterMenu({
      x: clampedX,
      y: clampedY,
      colKey,
      colTitle
    });
  };

  const currentDueMenuUniqueValues = useMemo(() => {
    if (!dueFilterMenu) return [];
    const valMap = new Map<string, number>();
    allDueAndWarningServices.forEach(item => {
      const val = getDueColValue(item, dueFilterMenu.colKey);
      valMap.set(val, (valMap.get(val) || 0) + 1);
    });
    return Array.from(valMap.entries()).map(([value, count]) => ({ value, count }));
  }, [dueFilterMenu, allDueAndWarningServices]);

  const currentDueSelectedValues = useMemo(() => {
    if (!dueFilterMenu) return [];
    if (dueColumnFilters[dueFilterMenu.colKey]) {
      return dueColumnFilters[dueFilterMenu.colKey];
    }
    return currentDueMenuUniqueValues.map(v => v.value);
  }, [dueFilterMenu, dueColumnFilters, currentDueMenuUniqueValues]);

  const handleToggleDueColumnValue = (val: string) => {
    if (!dueFilterMenu) return;
    const colKey = dueFilterMenu.colKey;
    const allVals = currentDueMenuUniqueValues.map(v => v.value);
    const currSelected = dueColumnFilters[colKey] ?? allVals;

    let updated: string[];
    if (currSelected.includes(val)) {
      updated = currSelected.filter(v => v !== val);
    } else {
      updated = [...currSelected, val];
    }

    if (updated.length === allVals.length) {
      const next = { ...dueColumnFilters };
      delete next[colKey];
      setDueColumnFilters(next);
    } else {
      setDueColumnFilters({ ...dueColumnFilters, [colKey]: updated });
    }
  };

  const handleSortDue = (key: string) => {
    if (dueSortKey === key) {
      setDueSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setDueSortKey(key);
      setDueSortDirection('asc');
    }
  };

  const filteredDueList = useMemo(() => {
    return allDueAndWarningServices.filter(item => {
      // فیلتر بر اساس خودروی انتخابی
      if (vehicleFilter && vehicleFilter !== 'all') {
        if (item.vehicleId.toString() !== vehicleFilter) return false;
      }

      // فیلتر وضعیت اخطار / منقضی
      if (dueStatusFilter === 'overdue' && item.status !== 'overdue') return false;
      if (dueStatusFilter === 'warning' && item.status !== 'warning') return false;

      // جستجوی متنی
      const q = (searchTerm || dueSearchTerm).toLowerCase().trim();
      if (q) {
        const matches = (
          item.vehicleName.toLowerCase().includes(q) ||
          (item.vehicleCode && item.vehicleCode.toLowerCase().includes(q)) ||
          (item.vehiclePlaque && item.vehiclePlaque.toLowerCase().includes(q)) ||
          (item.driverName && item.driverName.toLowerCase().includes(q)) ||
          (item.company && item.company.toLowerCase().includes(q)) ||
          item.serviceType.toLowerCase().includes(q)
        );
        if (!matches) return false;
      }

      // فیلتر ستونی
      for (const [key, selectedVals] of Object.entries(dueColumnFilters)) {
        const itemVal = getDueColValue(item, key);
        if (Array.isArray(selectedVals) && !selectedVals.includes(itemVal)) return false;
      }

      return true;
    });
  }, [allDueAndWarningServices, vehicleFilter, dueStatusFilter, searchTerm, dueSearchTerm, dueColumnFilters]);

  useEffect(() => {
    setDuePage(1);
  }, [vehicleFilter, dueStatusFilter, searchTerm, dueSearchTerm, dueColumnFilters]);

  const sortedDueList = useMemo(() => {
    const customExtractors: Record<string, (item: GlobalDueServiceItem) => any> = {
      status: (item) => (item.status === 'overdue' ? 2 : 1),
      remainingKm: (item) => item.remainingKm || 0,
      targetDueKm: (item) => item.targetDueKm || 0,
      currentKm: (item) => item.currentKm || 0,
      driverPhone: (item) => item.driverPhone || '',
      driverName: (item) => item.driverName || '',
      company: (item) => item.company || '',
      vehiclePlaque: (item) => item.vehiclePlaque || '',
      vehicleName: (item) => item.vehicleName || '',
      serviceType: (item) => item.serviceType || '',
    };
    return sortData(filteredDueList, dueSortKey, dueSortDirection, customExtractors);
  }, [filteredDueList, dueSortKey, dueSortDirection]);

  const totalDuePages = Math.ceil(sortedDueList.length / duePageSize) || 1;
  const paginatedDueList = useMemo(() => {
    const start = (duePage - 1) * duePageSize;
    return sortedDueList.slice(start, start + duePageSize);
  }, [sortedDueList, duePage, duePageSize]);

  const handleExportDueExcel = () => {
    try {
      const sanitize = (val: any) => {
        if (val === undefined || val === null) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const headers = [
        'ردیف',
        'نام خودرو',
        'پلاک',
        'نام راننده',
        'شماره تماس راننده',
        'عنوان خدمت / قطعه',
        'کارکرد فعلی (کیلومتر)',
        'موعد تعویض (کیلومتر)',
        'مانده کیلومتر',
        'وضعیت'
      ];

      const rows = sortedDueList.map((item, idx) => [
        idx + 1,
        item.vehicleName || '---',
        item.vehiclePlaque || '---',
        item.driverName || '---',
        item.driverPhone || '---',
        item.serviceType || '---',
        item.currentKm || 0,
        item.targetDueKm || 0,
        item.remainingKm,
        item.status === 'overdue' ? 'منقضی (سررسید گذشته)' : 'در آستانه تعویض (اخطار)'
      ]);

      const csvContent = '\uFEFF' + [
        headers.map(sanitize).join(','),
        ...rows.map(row => row.map(sanitize).join(','))
      ].join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('link');
      link.setAttribute('href', url);
      link.setAttribute('download', `سرویس‌های_سررسید_شده_و_اخطار_ناوگان_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export due excel error:', err);
      alert('خطا در صدور خروجی اکسل خدمات نیازمند رسیدگی');
    }
  };

  // فیلتر و مرتب‌سازی سوابق استعلامات
  const filteredInquiryLogs = useMemo(() => {
    return odometerLogs.filter(log => {
      // فیلتر جستجوی کلی یا درون-تبی
      const effectiveSearch = inquiryLogsSearchTerm || searchTerm;
      if (effectiveSearch && effectiveSearch.trim()) {
        const query = effectiveSearch.toLowerCase().trim();
        const matchesQuery = 
          String(log.vehicleName || '').toLowerCase().includes(query) ||
          String(log.plaque || '').toLowerCase().includes(query) ||
          String(log.driverName || '').toLowerCase().includes(query) ||
          String(log.driverPhone || '').toLowerCase().includes(query) ||
          String(log.company || '').toLowerCase().includes(query) ||
          String(log.inquiryDate || '').includes(query) ||
          String(log.odometerKm || '').includes(query) ||
          String(log.notes || '').toLowerCase().includes(query) ||
          String(log.recordedBy || '').toLowerCase().includes(query);
        if (!matchesQuery) return false;
      }
      // فیلتر خودرو انتخابی
      if (vehicleFilter && vehicleFilter !== 'all' && String(log.vehicleId) !== String(vehicleFilter)) {
        return false;
      }
      // فیلترهای ستونی
      for (const [col, rawValues] of Object.entries(inquiryLogsColumnFilters)) {
        const values = rawValues as string[] | undefined;
        if (!values || values.length === 0) continue;
        const val = String((log as any)[col] || '');
        if (!values.includes(val)) return false;
      }
      return true;
    });
  }, [odometerLogs, inquiryLogsSearchTerm, searchTerm, vehicleFilter, inquiryLogsColumnFilters]);

  useEffect(() => {
    setInquiryLogsPage(1);
  }, [inquiryLogsSearchTerm, searchTerm, vehicleFilter, inquiryLogsColumnFilters]);

  const sortedInquiryLogs = useMemo(() => {
    const customExtractors: Record<string, (item: OdometerLog) => any> = {
      odometerKm: (item) => Number(item.odometerKm || 0),
      previousKm: (item) => Number(item.previousKm || 0),
      differenceKm: (item) => Number(item.differenceKm || 0),
      inquiryDate: (item) => String(item.inquiryDate || ''),
      inquiryTime: (item) => String(item.inquiryTime || ''),
      vehicleName: (item) => String(item.vehicleName || ''),
      plaque: (item) => String(item.plaque || ''),
      driverName: (item) => String(item.driverName || ''),
      company: (item) => String(item.company || ''),
      recordedBy: (item) => String(item.recordedBy || item.source || ''),
      id: (item) => Number(item.id || 0)
    };
    return sortData(filteredInquiryLogs, inquiryLogsSortKey, inquiryLogsSortDirection, customExtractors);
  }, [filteredInquiryLogs, inquiryLogsSortKey, inquiryLogsSortDirection]);

  const totalInquiryPages = Math.ceil(sortedInquiryLogs.length / inquiryLogsPageSize) || 1;
  const paginatedInquiryLogs = useMemo(() => {
    const start = (inquiryLogsPage - 1) * inquiryLogsPageSize;
    return sortedInquiryLogs.slice(start, start + inquiryLogsPageSize);
  }, [sortedInquiryLogs, inquiryLogsPage, inquiryLogsPageSize]);

  const handleSortInquiry = (key: string) => {
    if (inquiryLogsSortKey === key) {
      setInquiryLogsSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setInquiryLogsSortKey(key);
      setInquiryLogsSortDirection('desc');
    }
  };

  const getInquiryColValue = (item: OdometerLog, colKey: string): string => {
    switch (colKey) {
      case 'vehicleName':
        return item.vehicleName || 'نامشخص';
      case 'plaque':
        return item.plaque || 'نامشخص';
      case 'driverName':
        return item.driverName || 'بدون راننده';
      case 'company':
        return item.company || 'نامشخص';
      case 'inquiryDate':
        return item.inquiryDate || 'نامشخص';
      case 'recordedBy':
        return item.recordedBy || item.source || 'نامشخص';
      default:
        return String((item as any)[colKey] || 'نامشخص');
    }
  };

  const handleOpenInquiryFilterMenu = (colKey: string, colTitle: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 270;
    const menuHeight = 360;
    const clampedX = Math.max(10, Math.min(e.clientX - 100, window.innerWidth - menuWidth - 10));
    const clampedY = Math.max(10, Math.min(e.clientY + 8, window.innerHeight - menuHeight - 10));
    setInquiryFilterMenu({
      x: clampedX,
      y: clampedY,
      colKey,
      colTitle
    });
  };

  const currentInquiryMenuUniqueValues = useMemo(() => {
    if (!inquiryFilterMenu) return [];
    const valMap = new Map<string, number>();
    odometerLogs.forEach(item => {
      const val = getInquiryColValue(item, inquiryFilterMenu.colKey);
      valMap.set(val, (valMap.get(val) || 0) + 1);
    });
    return Array.from(valMap.entries()).map(([value, count]) => ({ value, count }));
  }, [inquiryFilterMenu, odometerLogs]);

  const currentInquirySelectedValues = useMemo(() => {
    if (!inquiryFilterMenu) return [];
    if (inquiryLogsColumnFilters[inquiryFilterMenu.colKey]) {
      return inquiryLogsColumnFilters[inquiryFilterMenu.colKey];
    }
    return currentInquiryMenuUniqueValues.map(v => v.value);
  }, [inquiryFilterMenu, inquiryLogsColumnFilters, currentInquiryMenuUniqueValues]);

  const handleToggleInquiryColumnValue = (val: string) => {
    if (!inquiryFilterMenu) return;
    const colKey = inquiryFilterMenu.colKey;
    const allVals = currentInquiryMenuUniqueValues.map(v => v.value);
    const currSelected = inquiryLogsColumnFilters[colKey] ?? allVals;

    let updated: string[];
    if (currSelected.includes(val)) {
      updated = currSelected.filter(v => v !== val);
    } else {
      updated = [...currSelected, val];
    }

    if (updated.length === allVals.length) {
      const next = { ...inquiryLogsColumnFilters };
      delete next[colKey];
      setInquiryLogsColumnFilters(next);
    } else {
      setInquiryLogsColumnFilters({ ...inquiryLogsColumnFilters, [colKey]: updated });
    }
  };

  const handleExportInquiryLogsExcel = () => {
    try {
      const sanitize = (val: any) => {
        if (val === undefined || val === null) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const headers = [
        'ردیف',
        'شناسه',
        'نام خودرو',
        'پلاک',
        'نام راننده',
        'شماره تماس راننده',
        'شرکت / واحد',
        'تاریخ استعلام',
        'ساعت استعلام',
        'کیلومتر ثبت‌شده',
        'کیلومتر قبلی',
        'پیمایش / اختلاف (کیلومتر)',
        'ثبت‌کننده / منبع',
        'توضیحات و یادداشت'
      ];

      const rows = sortedInquiryLogs.map((item, idx) => [
        idx + 1,
        item.id,
        item.vehicleName || '---',
        item.plaque || '---',
        item.driverName || '---',
        item.driverPhone || '---',
        item.company || '---',
        item.inquiryDate || '---',
        item.inquiryTime || '---',
        item.odometerKm || 0,
        item.previousKm || 0,
        item.differenceKm !== undefined ? item.differenceKm : 0,
        item.recordedBy || item.source || '---',
        item.notes || '---'
      ]);

      const csvContent = '\uFEFF' + [
        headers.map(sanitize).join(','),
        ...rows.map(row => row.map(sanitize).join(','))
      ].join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('link');
      link.setAttribute('href', url);
      link.setAttribute('download', `سوابق_استعلام_کیلومتر_ناوگان_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export inquiry logs excel error:', err);
      alert('خطا در صدور خروجی اکسل سوابق استعلام');
    }
  };

  // خروجی اکسل هوشمند بر اساس تب فعال
  const handleExportCurrentTabExcel = () => {
    if (activeTab === 'matrix') {
      handleExportMatrixExcel();
    } else if (activeTab === 'due_services') {
      handleExportDueExcel();
    } else if (activeTab === 'inquiry_logs') {
      handleExportInquiryLogsExcel();
    } else {
      handleExportFleetExcel();
    }
  };

  const [isRematchingSms, setIsRematchingSms] = useState(false);

  const handleRematchUnknownSms = async () => {
    try {
      setIsRematchingSms(true);
      const res = await fetch('/api/sms/rematch-unknown', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncStatusMsg({
          type: 'success',
          text: data.message
        });
        if (onSyncSms) {
          await onSyncSms();
        }
      } else {
        setSyncStatusMsg({
          type: 'error',
          text: data.message || 'خطا در تطبیق مجدد پیامک‌ها'
        });
      }
    } catch (err: any) {
      setSyncStatusMsg({
        type: 'error',
        text: 'خطا در ارتباط با سرور هنگام شناسایی مجدد پیامک‌ها'
      });
    } finally {
      setIsRematchingSms(false);
    }
  };

  // فیلتر لاگ‌های پیامک دریافتی
  const filteredSmsLogs = useMemo(() => {
    return smsLogs.filter(s => {
      if (smsStatusFilter !== 'all') {
        if (smsStatusFilter === 'success' && s.status !== 'success') return false;
        if (smsStatusFilter === 'error' && s.status === 'success') return false;
      }
      if (!smsSearchTerm) return true;
      const q = smsSearchTerm.toLowerCase();
      return (
        (s.senderPhone && s.senderPhone.includes(q)) ||
        (s.rawText && s.rawText.toLowerCase().includes(q)) ||
        (s.vehicleName && s.vehicleName.toLowerCase().includes(q)) ||
        (s.driverName && s.driverName.toLowerCase().includes(q)) ||
        (s.statusMessage && s.statusMessage.toLowerCase().includes(q))
      );
    });
  }, [smsLogs, smsStatusFilter, smsSearchTerm]);

  if (isModalOpen) {
    return (
      <OdometerInquiryFormView
        editingLog={editingLog}
        vehicles={vehicles}
        services={services}
        failures={failures}
        odometerLogs={odometerLogs}
        serviceDefinitions={serviceDefinitions}
        currentUser={currentUser}
        initialVehicleId={formVehicleId || selectedVehicleId}
        onClose={() => setIsModalOpen(false)}
        onDelete={onDeleteOdometerLog}
        onSubmit={async (data) => {
          if (editingLog) {
            await onEditOdometerLog(editingLog.id, {
              vehicleId: data.vehicleId,
              inquiryDate: data.inquiryDate,
              inquiryTime: data.inquiryTime,
              odometerKm: data.odometerKm,
              notes: data.notes
            });
          } else {
            const selectedV = vehicles.find(v => v.id === data.vehicleId);
            const prevRecordedKm = selectedV ? (getLatestVehicleKm(selectedV, odometerLogs, services, failures) || selectedV.currentKm || 0) : 0;
            await onAddOdometerLog({
              vehicleId: data.vehicleId,
              inquiryDate: data.inquiryDate,
              inquiryTime: data.inquiryTime,
              odometerKm: data.odometerKm,
              previousKm: prevRecordedKm,
              driverName: selectedV?.driverName,
              driverPhone: selectedV?.driverPhone,
              company: selectedV?.company,
              plaque: selectedV?.plaque,
              vehicleName: selectedV?.name,
              recordedBy: currentUser?.fullName || 'مدیر سیستم',
              notes: data.notes
            });
          }
          setSelectedVehicleId(data.vehicleId);
          setIsModalOpen(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* هدر بخش استعلام کارکرد ناوگان (دقیقاً مشابه بخش پذیرش دوره‌ای) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-[#111113] p-4 rounded-lg border border-slate-200 dark:border-[#2d2d30]">
        <div>
          <h1 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Gauge className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            استعلام و پایش کارکرد ناوگان
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            پایش کارکرد روزانه، ثبت کیلومتر اعلامی رانندگان، دریافت خودکار پیامک و پیش‌بینی موعد تعویض قطعات
          </p>
        </div>
        <button 
          type="button"
          onClick={() => handleOpenAddModal()} 
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>ثبت استعلام کارکرد جدید</span>
        </button>
      </div>

      {/* تب‌های جابجایی بین بخش‌ها با ترنزیشن نرم و متحرک (دقیقاً مشابه بخش پذیرش دوره‌ای) */}
      <div className="flex border-b border-slate-200 dark:border-[#2d2d30] gap-2 overflow-x-auto relative">
        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'matrix'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Gauge className="w-4 h-4" />
          <span>لیست پایش و پیش‌بینی</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 font-mono font-bold">
            {toPersianDigits(vehicles.length)}
          </span>
          {activeTab === 'matrix' && (
            <motion.div
              layoutId="activeOdometerTabIndicator"
              className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('due_services')}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'due_services'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>خدمات سررسید شده و اخطار</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 font-mono font-bold">
            {toPersianDigits(allDueAndWarningServices.length)}
          </span>
          {activeTab === 'due_services' && (
            <motion.div
              layoutId="activeOdometerTabIndicator"
              className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('fleet_call')}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'fleet_call'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <List className="w-4 h-4" />
          <span>لیست سریع ناوگان</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 font-mono font-bold">
            {toPersianDigits(vehicles.length)}
          </span>
          {activeTab === 'fleet_call' && (
            <motion.div
              layoutId="activeOdometerTabIndicator"
              className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inquiry_logs')}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'inquiry_logs'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          <span>سوابق استعلامات کارکرد</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 font-mono font-bold">
            {toPersianDigits(odometerLogs.length)}
          </span>
          {activeTab === 'inquiry_logs' && (
            <motion.div
              layoutId="activeOdometerTabIndicator"
              className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sms_reminders')}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'sms_reminders'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>ارسال پیامک یادآوری کارکرد</span>
          {activeTab === 'sms_reminders' && (
            <motion.div
              layoutId="activeOdometerTabIndicator"
              className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sms_gateway')}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'sms_gateway'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>دریافت پیامکی کارکرد (SMS Sync)</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 font-mono font-bold">
            {toPersianDigits(smsLogs.length)}
          </span>
          {activeTab === 'sms_gateway' && (
            <motion.div
              layoutId="activeOdometerTabIndicator"
              className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>
      </div>

      {/* ابزار جستجو و خروجی اکسل - فقط در تب‌های پایش، خدمات سررسید شده و لیست سریع ناوگان */}
      {activeTab !== 'sms_reminders' && activeTab !== 'sms_gateway' && (
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center relative z-30">
        
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
                    const isSelected = vehicleFilter === v.id.toString() || selectedVehicleId === v.id;

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

        {/* دکمه خروجی اکسل */}
        <button
          type="button"
          onClick={handleExportCurrentTabExcel}
          className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-2xs shrink-0 group self-center"
          title="دریافت خروجی اکسل"
        >
          <FileSpreadsheet className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>
      </div>
      )}

      {/* محتوای تب با ترنزیشن نرم و متحرک (دقیقاً مشابه بخش پذیرش و تعمیرات) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: "easeInOut" }}
          className="space-y-4"
        >
          {/* محتوای تب اول: لیست پایش و پیش‌بینی وضعیت خودرو */}
          {activeTab === 'matrix' && (
        <div className="space-y-4">
          {/* ماتریس وضعیت قطعات و خدمات */}
          <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex justify-between items-center">
              <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
                <List className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>لیست پایش و پیش‌بینی وضعیت قطعات و خدمات دوره‌ای</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  {toPersianDigits(filteredMatrixList.length)} مورد
                </span>
              </div>
            </div>

            {!currentSelectedVehicle ? (
              <div className="p-10 text-center text-slate-500 dark:text-slate-400 text-xs font-bold space-y-1.5">
                <Search className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2 opacity-80" />
                <p className="text-slate-700 dark:text-slate-300">هیچ خودرویی انتخاب نشده است.</p>
                <p className="text-[11px] text-slate-400 font-normal">برای مشاهده وضعیت پایش و پیش‌بینی قطعات، نام خودرو را در فیلد جستجوی بالا انتخاب نمایید.</p>
              </div>
            ) : serviceHealthMatrix.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                هیچ تعریف خدمتی در سامانه ثبت نشده است. لطفاً ابتدا از بخش «تعریف خدمات» دوره‌های تعویض را مشخص کنید.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] text-slate-600 dark:text-slate-400 font-medium text-xs">
                        <th className="py-2 px-3 text-center w-12 text-xs font-medium">ردیف</th>

                        <TableColumnHeader
                          title="عنوان خدمت / قطعه"
                          colKey="serviceType"
                          sortKey={matrixSortKey}
                          sortDirection={matrixSortDirection}
                          onSort={handleSortMatrix}
                          isFiltered={!!matrixColumnFilters['serviceType']}
                          onOpenFilter={handleOpenMatrixFilterMenu}
                          className="min-w-[150px]"
                        />

                        <TableColumnHeader
                          title="آخرین تعویض"
                          colKey="lastServicedKm"
                          sortKey={matrixSortKey}
                          sortDirection={matrixSortDirection}
                          onSort={handleSortMatrix}
                          isFiltered={!!matrixColumnFilters['lastServicedKm']}
                          onOpenFilter={handleOpenMatrixFilterMenu}
                          className="min-w-[120px]"
                          align="center"
                        />

                        <TableColumnHeader
                          title="موعد بعدی"
                          colKey="targetDueKm"
                          sortKey={matrixSortKey}
                          sortDirection={matrixSortDirection}
                          onSort={handleSortMatrix}
                          isFiltered={!!matrixColumnFilters['targetDueKm']}
                          onOpenFilter={handleOpenMatrixFilterMenu}
                          className="min-w-[110px]"
                          align="center"
                        />

                        <TableColumnHeader
                          title="مانده کیلومتر"
                          colKey="remainingKm"
                          sortKey={matrixSortKey}
                          sortDirection={matrixSortDirection}
                          onSort={handleSortMatrix}
                          isFiltered={!!matrixColumnFilters['remainingKm']}
                          onOpenFilter={handleOpenMatrixFilterMenu}
                          className="min-w-[125px]"
                          align="center"
                        />

                        <TableColumnHeader
                          title="وضعیت و درصد مصرف"
                          colKey="progressPercent"
                          sortKey={matrixSortKey}
                          sortDirection={matrixSortDirection}
                          onSort={handleSortMatrix}
                          isFiltered={!!matrixColumnFilters['progressPercent']}
                          onOpenFilter={handleOpenMatrixFilterMenu}
                          className="min-w-[135px]"
                        />

                        <TableColumnHeader
                          title="پیش‌بینی تاریخ تعویض"
                          colKey="estimatedDate"
                          sortKey={matrixSortKey}
                          sortDirection={matrixSortDirection}
                          onSort={handleSortMatrix}
                          isFiltered={!!matrixColumnFilters['estimatedDate']}
                          onOpenFilter={handleOpenMatrixFilterMenu}
                          className="min-w-[125px]"
                          align="center"
                        />

                        <TableColumnHeader
                          title="چند روز مانده"
                          colKey="daysRemaining"
                          sortKey={matrixSortKey}
                          sortDirection={matrixSortDirection}
                          onSort={handleSortMatrix}
                          isFiltered={!!matrixColumnFilters['daysRemaining']}
                          onOpenFilter={handleOpenMatrixFilterMenu}
                          className="min-w-[110px]"
                          align="center"
                        />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                      {paginatedMatrixList.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-500 text-[11px]">
                            هیچ خدمتی مطابق فیلترهای انتخابی یافت نشد.
                          </td>
                        </tr>
                      ) : (
                        paginatedMatrixList.map((item, idx) => {
                          const isNoHistory = !item.hasHistory || item.status === 'no_history';
                          const isOverdue = !isNoHistory && item.status === 'overdue';
                          const isWarning = !isNoHistory && item.status === 'warning';
                          const rowNumber = (matrixPage - 1) * matrixPageSize + idx + 1;

                          return (
                            <tr 
                              key={item.definitionId} 
                              className={`group relative hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/60 transition-colors text-[11px] ${
                                isOverdue ? 'bg-rose-50/50 dark:bg-rose-500/5' : isWarning ? 'bg-amber-50/50 dark:bg-amber-500/5' : ''
                              }`}
                            >
                              <td className="py-2 px-3 text-center text-slate-500 text-[11px]">
                                {toPersianDigits(rowNumber)}
                              </td>
                              <td className="py-2 px-3 text-slate-900 dark:text-white">
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    isOverdue ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : isNoHistory ? 'bg-slate-300 dark:bg-slate-600' : 'bg-emerald-500'
                                  }`}></span>
                                  <span className={
                                    isOverdue
                                      ? 'text-rose-900 dark:text-rose-300'
                                      : isWarning
                                      ? 'text-amber-900 dark:text-amber-300'
                                      : isNoHistory
                                      ? 'text-slate-600 dark:text-slate-300'
                                      : 'text-slate-900 dark:text-white'
                                  }>
                                    {item.serviceType}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-center whitespace-nowrap text-[11px]">
                                {!isNoHistory && item.lastServicedKm > 0 ? (
                                  <div className="inline-flex items-center justify-center gap-1 text-slate-800 dark:text-slate-200">
                                    <span>{toPersianDigits(formatNumber(item.lastServicedKm))}</span>
                                    <span className="text-[10px] text-slate-500">کیلومتر</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-500 text-[11px]">فاقد سابقه قبلی</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center whitespace-nowrap">
                                {item.targetDueKm > 0 ? (
                                  <>
                                    <span className="text-slate-900 dark:text-white text-[11px]">
                                      {toPersianDigits(formatNumber(item.targetDueKm))}
                                    </span>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mr-1">
                                      کیلومتر
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-500 text-[11px]">—</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center whitespace-nowrap">
                                {isNoHistory ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 text-[11px]">
                                    {item.remainingKm > 0 ? `${toPersianDigits(formatNumber(item.remainingKm))} کیلومتر مانده` : '—'}
                                  </span>
                                ) : isOverdue ? (
                                  <span className="text-rose-600 dark:text-rose-400 text-[11px]">
                                    {toPersianDigits(formatNumber(Math.abs(item.remainingKm)))} کیلومتر گذشته
                                  </span>
                                ) : isWarning ? (
                                  <span className="text-amber-600 dark:text-amber-400 text-[11px]">
                                    {toPersianDigits(formatNumber(item.remainingKm))} کیلومتر مانده
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 dark:text-emerald-400 text-[11px]">
                                    {toPersianDigits(formatNumber(item.remainingKm))} کیلومتر مانده
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 min-w-[135px]">
                                {isNoHistory ? (
                                  <div className="space-y-1">
                                    <div className="flex justify-between text-[10px]">
                                      <span className="text-slate-500 dark:text-slate-400 font-medium">مبدا ورود</span>
                                      <span className="text-slate-500 dark:text-slate-400 text-[10px]">{toPersianDigits(item.progressPercent)}% دوره اول</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 dark:bg-[#1f1f23] rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full transition-all duration-300 bg-indigo-500"
                                        style={{ width: `${Math.min(100, Math.max(0, item.progressPercent))}%` }}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <div className="flex justify-between text-[10px]">
                                      <span className={isOverdue ? 'text-rose-600 dark:text-rose-400 font-medium' : isWarning ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-slate-500 dark:text-slate-400'}>
                                        {toPersianDigits(item.progressPercent)}% مصرف
                                      </span>
                                      <span className="text-slate-500 dark:text-slate-400 text-[10px]">
                                        {toPersianDigits(formatNumber(item.elapsedKm))} کیلومتر طی‌شده
                                      </span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 dark:bg-[#1f1f23] rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all duration-300 ${
                                          isOverdue ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                                        }`}
                                        style={{ width: `${Math.min(100, Math.max(0, item.progressPercent))}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center whitespace-nowrap">
                                {isNoHistory || !item.estimatedDate || item.estimatedDate === '-' ? (
                                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-bold block">—</span>
                                ) : isOverdue ? (
                                  <span className="text-[11px] text-rose-600 dark:text-rose-400 block font-medium">فوری - اقدام شود</span>
                                ) : (
                                  <span className="text-[11px] text-slate-800 dark:text-slate-200 block">
                                    {toPersianDigits(item.estimatedDate)}
                                  </span>
                                )}
                              </td>
                              {/* چند روز مانده */}
                              <td className="py-2 px-3 text-center whitespace-nowrap">
                                {isNoHistory || !item.estimatedDate || item.estimatedDate === '-' ? (
                                  <span className="text-slate-400 dark:text-slate-500 text-[11px] font-bold block">—</span>
                                ) : isOverdue ? (
                                  <span className="text-rose-600 dark:text-rose-400 text-[11px]">
                                    {item.daysRemaining < 0 ? `${toPersianDigits(Math.abs(item.daysRemaining))} روز گذشته` : 'سررسید شده'}
                                  </span>
                                ) : isWarning ? (
                                  <span className="text-amber-600 dark:text-amber-400 text-[11px]">
                                    {toPersianDigits(item.daysRemaining)} روز
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 dark:text-emerald-400 text-[11px]">
                                    {toPersianDigits(item.daysRemaining)} روز
                                  </span>
                                )}

                                {/* دکمه عملیات شناور در هاور ردیف */}
                                <div className="absolute inset-y-0 left-0 pl-2.5 pr-12 flex items-center bg-gradient-to-r from-slate-50 via-slate-50 via-70% to-transparent dark:from-[#1a1a1c] dark:via-[#1a1a1c] dark:via-70% dark:to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 z-20 pointer-events-none group-hover:pointer-events-auto">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onNavigateToServices) {
                                        onNavigateToServices(currentSelectedVehicle.id, item.serviceType);
                                      }
                                    }}
                                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-[10px] transition-all shadow-2xs cursor-pointer active:scale-95 whitespace-nowrap"
                                    title="ثبت پذیرش و سرویس برای این قطعه"
                                  >
                                    ثبت سرویس
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
                  currentPage={matrixPage}
                  totalPages={totalMatrixPages}
                  pageSize={matrixPageSize}
                  totalItems={filteredMatrixList.length}
                  onPageChange={setMatrixPage}
                  onPageSizeChange={(size) => {
                    setMatrixPageSize(size);
                    setMatrixPage(1);
                  }}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* محتوای تب خدمات سررسید شده و اخطار (کل ناوگان) */}
      {activeTab === 'due_services' && (
        <div className="space-y-3">
          {/* جدول نمایش لیست خدمات سررسید شده و اخطار */}
          <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex justify-between items-center">
              <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
                <List className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>لیست جامع خدمات و قطعات سررسید شده و نیازمند اقدام فوری (کل ناوگان)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  {toPersianDigits(sortedDueList.length)} مورد نیازمند تعویض
                </span>
              </div>
            </div>

            {allDueAndWarningServices.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                هیچ خدمت یا قطعه‌ای در وضعیت منقضی یا اخطار وجود ندارد. تمامی خودروهای ناوگان در وضعیت مطلوب قرار دارند.
              </div>
            ) : sortedDueList.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                موردی مطابق با فیلترها و جستجوی شما یافت نشد.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161619] text-slate-600 dark:text-slate-400 font-medium text-xs">
                        <th className="py-2 px-3 text-center w-12 text-xs font-medium">ردیف</th>

                        <TableColumnHeader
                          title="خودرو"
                          colKey="vehicleName"
                          sortKey={dueSortKey}
                          sortDirection={dueSortDirection}
                          onSort={handleSortDue}
                          isFiltered={!!dueColumnFilters['vehicleName']}
                          onOpenFilter={handleOpenDueFilterMenu}
                          className="min-w-[130px]"
                        />

                        <TableColumnHeader
                          title="پلاک"
                          colKey="vehiclePlaque"
                          sortKey={dueSortKey}
                          sortDirection={dueSortDirection}
                          onSort={handleSortDue}
                          isFiltered={!!dueColumnFilters['vehiclePlaque']}
                          onOpenFilter={handleOpenDueFilterMenu}
                          className="min-w-[110px]"
                          align="center"
                        />

                        <TableColumnHeader
                          title="نام راننده"
                          colKey="driverName"
                          sortKey={dueSortKey}
                          sortDirection={dueSortDirection}
                          onSort={handleSortDue}
                          isFiltered={!!dueColumnFilters['driverName']}
                          onOpenFilter={handleOpenDueFilterMenu}
                          className="min-w-[110px]"
                        />

                        <TableColumnHeader
                          title="شماره تماس راننده"
                          colKey="driverPhone"
                          sortKey={dueSortKey}
                          sortDirection={dueSortDirection}
                          onSort={handleSortDue}
                          isFiltered={!!dueColumnFilters['driverPhone']}
                          onOpenFilter={handleOpenDueFilterMenu}
                          className="min-w-[120px]"
                          align="center"
                        />

                        <TableColumnHeader
                          title="عنوان خدمت / قطعه"
                          colKey="serviceType"
                          sortKey={dueSortKey}
                          sortDirection={dueSortDirection}
                          onSort={handleSortDue}
                          isFiltered={!!dueColumnFilters['serviceType']}
                          onOpenFilter={handleOpenDueFilterMenu}
                          className="min-w-[140px]"
                        />

                        <TableColumnHeader
                          title="کارکرد فعلی"
                          colKey="currentKm"
                          sortKey={dueSortKey}
                          sortDirection={dueSortDirection}
                          onSort={handleSortDue}
                          isFiltered={!!dueColumnFilters['currentKm']}
                          onOpenFilter={handleOpenDueFilterMenu}
                          className="min-w-[115px]"
                          align="center"
                        />

                        <TableColumnHeader
                          title="موعد تعویض"
                          colKey="targetDueKm"
                          sortKey={dueSortKey}
                          sortDirection={dueSortDirection}
                          onSort={handleSortDue}
                          isFiltered={!!dueColumnFilters['targetDueKm']}
                          onOpenFilter={handleOpenDueFilterMenu}
                          className="min-w-[115px]"
                          align="center"
                        />

                        <TableColumnHeader
                          title="مانده کیلومتر"
                          colKey="remainingKm"
                          sortKey={dueSortKey}
                          sortDirection={dueSortDirection}
                          onSort={handleSortDue}
                          isFiltered={!!dueColumnFilters['remainingKm']}
                          onOpenFilter={handleOpenDueFilterMenu}
                          className="min-w-[125px]"
                          align="center"
                        />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#202024]">
                      {paginatedDueList.map((item, idx) => {
                        const globalIndex = (duePage - 1) * duePageSize + idx + 1;
                        const isOverdue = item.status === 'overdue';

                        return (
                          <tr
                            key={item.id}
                            className={`group relative transition-colors duration-150 text-[11px] ${
                              isOverdue
                                ? 'bg-rose-50/30 dark:bg-rose-950/15 hover:bg-rose-50/60 dark:hover:bg-rose-950/30'
                                : 'bg-amber-50/20 dark:bg-amber-950/10 hover:bg-amber-50/50 dark:hover:bg-amber-950/20'
                            }`}
                          >
                            <td className="py-2 px-3 text-center text-slate-500 text-[11px]">
                              {toPersianDigits(globalIndex)}
                            </td>

                            <td className="py-2 px-3">
                              <div className="text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span>{item.vehicleName}</span>
                                {item.vehicleCode && (
                                  <span className="text-[10px] text-indigo-700 dark:text-indigo-300">
                                    ({toPersianDigits(item.vehicleCode)})
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-2 px-3 text-center text-slate-700 dark:text-slate-300 whitespace-nowrap text-[11px]">
                              {toPersianDigits(item.vehiclePlaque)}
                            </td>

                            <td className="py-2 px-3 text-slate-800 dark:text-slate-200">
                              {item.driverName || 'ثبت نشده'}
                            </td>

                            <td className="py-2 px-3 text-center text-slate-700 dark:text-slate-300 whitespace-nowrap text-[11px]">
                              {item.driverPhone ? toPersianDigits(item.driverPhone) : <span className="text-slate-400 dark:text-slate-500 text-[10px]">ثبت نشده</span>}
                            </td>

                            <td className="py-2 px-3 text-slate-900 dark:text-white">
                              {item.serviceType}
                            </td>

                            <td className="py-2 px-3 text-center text-slate-800 dark:text-slate-200 whitespace-nowrap text-[11px]">
                              {formatNumber(item.currentKm)} کیلومتر
                            </td>

                            <td className="py-2 px-3 text-center text-slate-800 dark:text-slate-200 whitespace-nowrap text-[11px]">
                              {item.targetDueKm ? `${formatNumber(item.targetDueKm)} کیلومتر` : '---'}
                            </td>

                            <td className="py-2 px-3 text-center whitespace-nowrap text-[11px] relative">
                              {isOverdue ? (
                                <span className="text-rose-600 dark:text-rose-400">
                                  {formatNumber(Math.abs(item.remainingKm))} کیلومتر گذشته
                                </span>
                              ) : (
                                <span className="text-amber-600 dark:text-amber-400">
                                  {formatNumber(item.remainingKm)} کیلومتر مانده
                                </span>
                              )}

                              {/* دکمه‌های عملیات شناور - فقط هنگام بردن موس روی ردیف */}
                              <div className={`absolute inset-y-0 left-0 pl-2.5 pr-14 flex items-center gap-1.5 bg-gradient-to-r ${
                                isOverdue 
                                  ? 'from-rose-50 via-rose-50 dark:from-[#251518] dark:via-[#251518]' 
                                  : 'from-amber-50 via-amber-50 dark:from-[#251f15] dark:via-[#251f15]'
                              } via-70% to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 z-20 pointer-events-none group-hover:pointer-events-auto`}>
                                {onNavigateToServices && (
                                  <button
                                    type="button"
                                    onClick={() => onNavigateToServices(item.vehicleId, item.serviceType)}
                                    className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                                    title="ثبت سرویس دوره‌ای برای این قطعه"
                                  >
                                    <span>ثبت سرویس</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedVehicleId(item.vehicleId);
                                    setVehicleFilter(item.vehicleId.toString());
                                    setActiveTab('matrix');
                                  }}
                                  className="px-2 py-1 bg-white dark:bg-[#1e1e22] hover:bg-slate-100 dark:hover:bg-[#28282c] text-slate-700 dark:text-slate-300 rounded text-[10px] flex items-center gap-1 transition-colors cursor-pointer border border-slate-200 dark:border-[#2d2d30] shadow-2xs whitespace-nowrap"
                                  title="مشاهده در ماتریس پایش قطعات خودرو"
                                >
                                  <span>پایش</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={duePage}
                  totalPages={totalDuePages}
                  pageSize={duePageSize}
                  totalItems={filteredDueList.length}
                  onPageChange={setDuePage}
                  onPageSizeChange={(size) => {
                    setDuePageSize(size);
                    setDuePage(1);
                  }}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* محتوای تب دوم: لیست سریع ناوگان خودروها (مشابه بخش سرویس دوره‌ای) */}
      {activeTab === 'fleet_call' && (
        <div className="space-y-3">
          {/* جدول نمایش لیست سریع ناوگان */}
          <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex justify-between items-center">
              <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
                <List className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>لیست سریع ناوگان و پایش کارکرد خودروها</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  {toPersianDigits(sortedFleetList.length)} دستگاه خودرو
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161619] text-slate-600 dark:text-slate-400 font-medium text-xs">
                    <th className="py-2 px-3 text-center w-12 text-xs font-medium">ردیف</th>

                    <TableColumnHeader
                      title="خودرو"
                      colKey="name"
                      sortKey={fleetSortKey}
                      sortDirection={fleetSortDirection}
                      onSort={handleSortFleet}
                      isFiltered={!!fleetColumnFilters['name']}
                      onOpenFilter={handleOpenFleetFilterMenu}
                    />

                    <TableColumnHeader
                      title="پلاک"
                      colKey="plaque"
                      sortKey={fleetSortKey}
                      sortDirection={fleetSortDirection}
                      onSort={handleSortFleet}
                      isFiltered={!!fleetColumnFilters['plaque']}
                      onOpenFilter={handleOpenFleetFilterMenu}
                    />

                    <TableColumnHeader
                      title="شرکت"
                      colKey="company"
                      sortKey={fleetSortKey}
                      sortDirection={fleetSortDirection}
                      onSort={handleSortFleet}
                      isFiltered={!!fleetColumnFilters['company']}
                      onOpenFilter={handleOpenFleetFilterMenu}
                    />

                    <TableColumnHeader
                      title="راننده"
                      colKey="driverName"
                      sortKey={fleetSortKey}
                      sortDirection={fleetSortDirection}
                      onSort={handleSortFleet}
                      isFiltered={!!fleetColumnFilters['driverName']}
                      onOpenFilter={handleOpenFleetFilterMenu}
                    />

                    <TableColumnHeader
                      title="شماره تماس"
                      colKey="driverPhone"
                      sortKey={fleetSortKey}
                      sortDirection={fleetSortDirection}
                      onSort={handleSortFleet}
                      isFiltered={!!fleetColumnFilters['driverPhone']}
                      onOpenFilter={handleOpenFleetFilterMenu}
                    />

                    <TableColumnHeader
                      title="کارکرد کیلومتر"
                      colKey="currentKm"
                      sortKey={fleetSortKey}
                      sortDirection={fleetSortDirection}
                      onSort={handleSortFleet}
                      isFiltered={!!fleetColumnFilters['currentKm']}
                      onOpenFilter={handleOpenFleetFilterMenu}
                    />

                    <TableColumnHeader
                      title="آخرین استعلام"
                      colKey="lastInquiryDate"
                      sortKey={fleetSortKey}
                      sortDirection={fleetSortDirection}
                      onSort={handleSortFleet}
                      isFiltered={!!fleetColumnFilters['lastInquiryDate']}
                      onOpenFilter={handleOpenFleetFilterMenu}
                    />

                    <TableColumnHeader
                      title="آخرین سرویس و تاخیر"
                      colKey="serviceDelay"
                      sortKey={fleetSortKey}
                      sortDirection={fleetSortDirection}
                      onSort={handleSortFleet}
                      isFiltered={!!fleetColumnFilters['serviceDelay']}
                      onOpenFilter={handleOpenFleetFilterMenu}
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                  {paginatedFleetList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500 text-[11px]">
                        هیچ خودرویی با این مشخصات در ناوگان یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    paginatedFleetList.map((v, index) => {
                      return (
                        <tr
                          key={v.id}
                          className="group relative hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/60 transition-colors text-[11px]"
                        >
                          <td className="py-1.5 px-3 text-center text-slate-500 text-[11px]">
                            {toPersianDigits((fleetPage - 1) * fleetPageSize + index + 1)}
                          </td>
                          <td className="py-1.5 px-3">
                            <span className="text-slate-900 dark:text-white text-[11px]">
                              {v.name}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300 text-[11px]">
                            {toPersianDigits(v.plaque)}
                          </td>
                          <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300">
                            {v.company || 'شرکت ثبت نشده'}
                          </td>
                          <td className="py-1.5 px-3 text-slate-800 dark:text-slate-200">
                            {v.driverName || 'ثبت نشده'}
                          </td>
                          <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300 text-[11px]">
                            {v.driverPhone ? (
                              <a
                                href={`tel:${v.driverPhone}`}
                                className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                title="تماس تلفنی با راننده"
                              >
                                {toPersianDigits(v.driverPhone)}
                              </a>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500">بدون تلفن</span>
                            )}
                          </td>
                          <td className="py-1 px-3 whitespace-nowrap align-middle">
                            <div className="flex items-center gap-1 text-slate-800 dark:text-slate-200">
                              <span className="text-slate-900 dark:text-white text-[11px]">
                                {v.currentKm ? formatNumber(v.currentKm) : '۰'}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                                کیلومتر
                              </span>
                            </div>
                          </td>
                          <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300 text-[11px]">
                            {v.latestLog ? toPersianDigits(v.latestLog.inquiryDate) : 'بدون سابقه'}
                          </td>
                          <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300 text-[11px] relative">
                            {v.lastServiceDate !== 'بدون سابقه' ? (
                              <span className="font-mono text-slate-900 dark:text-slate-100 font-bold">
                                {toPersianDigits(v.lastServiceDate)}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">بدون سابقه سرویس</span>
                            )}

                            {/* دکمه‌های عملیات شناور - فقط هنگام بردن موس روی ردیف */}
                            <div className="absolute inset-y-0 left-0 pl-2.5 pr-14 flex items-center gap-1.5 bg-gradient-to-r from-slate-50 via-slate-50 via-70% to-transparent dark:from-[#1a1a1c] dark:via-[#1a1a1c] dark:via-70% dark:to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 z-20 pointer-events-none group-hover:pointer-events-auto">
                              <button
                                type="button"
                                onClick={() => handleOpenAddModal(v.id)}
                                className="h-6 px-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold transition-all shadow-2xs cursor-pointer active:scale-95 whitespace-nowrap pointer-events-auto flex items-center justify-center leading-none"
                                title="ثبت استعلام کارکرد جدید"
                              >
                                ثبت استعلام
                              </button>

                              {v.latestLog && onDeleteOdometerLog && (
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (confirm(`آیا از حذف آخرین استعلام کارکرد خودرو «${v.name}» (${toPersianDigits(formatNumber(v.latestLog.odometerKm))} کیلومتر در تاریخ ${toPersianDigits(v.latestLog.inquiryDate)}) اطمینان دارید؟`)) {
                                      try {
                                        await onDeleteOdometerLog(v.latestLog.id);
                                      } catch (err: any) {
                                        alert(err?.message || 'خطا در حذف استعلام');
                                      }
                                    }
                                  }}
                                  className="h-6 w-6 p-0 flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-white dark:bg-[#1e1e24] hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-[#2d2d30] rounded shadow-2xs transition-colors cursor-pointer pointer-events-auto"
                                  title="حذف آخرین استعلام کارکرد این خودرو"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setSelectedFleetVehicleForDetails(v)}
                                className={`h-6 w-6 rounded flex items-center justify-center text-white transition-all shadow-xs cursor-pointer active:scale-90 pointer-events-auto ${
                                  v.needsService
                                    ? 'bg-rose-500 hover:bg-rose-600 border border-rose-400 dark:border-rose-500/50 ring-2 ring-rose-300/60 dark:ring-rose-900/60'
                                    : 'bg-emerald-500 hover:bg-emerald-600 border border-emerald-400 dark:border-emerald-500/50 ring-2 ring-emerald-300/60 dark:ring-emerald-900/60'
                                }`}
                                title={
                                  v.needsService
                                    ? `نیازمند سرویس (${toPersianDigits(v.overdueCount)} سررسید گذشته، ${toPersianDigits(v.warningCount)} در آستانه) - کلیک برای مشاهده جزئیات`
                                    : 'سالم و بدون نیاز به سرویس - کلیک برای مشاهده جزئیات'
                                }
                              >
                                {v.needsService ? (
                                  <AlertTriangle className="w-3 h-3" />
                                ) : (
                                  <Check className="w-3 h-3" />
                                )}
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
              currentPage={fleetPage}
              totalPages={totalFleetPages}
              pageSize={fleetPageSize}
              totalItems={sortedFleetList.length}
              onPageChange={setFleetPage}
              onPageSizeChange={(size) => {
                setFleetPageSize(size);
                setFleetPage(1);
              }}
            />
          </div>
        </div>
      )}

      {/* محتوای تب سوابق استعلامات کارکرد ناوگان */}
      {activeTab === 'inquiry_logs' && (
        <div className="space-y-3">
          {/* جدول نمایش سوابق استعلامات کارکرد */}
          <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex justify-between items-center">
              <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
                <History className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>سوابق و تاریخچه استعلامات کارکرد ناوگان</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  {toPersianDigits(sortedInquiryLogs.length)} مورد استعلام
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenAddModal(selectedVehicleId || vehicles[0]?.id)}
                  className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-[10px] font-bold transition-all shadow-2xs cursor-pointer inline-flex items-center gap-1 active:scale-95"
                  title="ثبت استعلام کارکرد جدید"
                >
                  <Plus className="w-3 h-3" />
                  <span>ثبت استعلام جدید</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161619] text-slate-600 dark:text-slate-400 font-medium text-xs">
                    <th className="py-2 px-3 text-center w-12 text-xs font-medium">ردیف</th>

                    <TableColumnHeader
                      title="تاریخ و زمان استعلام"
                      colKey="inquiryDate"
                      sortKey={inquiryLogsSortKey}
                      sortDirection={inquiryLogsSortDirection}
                      onSort={handleSortInquiry}
                      isFiltered={!!inquiryLogsColumnFilters['inquiryDate']}
                      onOpenFilter={(e) => handleOpenInquiryFilterMenu('inquiryDate', 'تاریخ استعلام', e)}
                    />

                    <TableColumnHeader
                      title="خودرو"
                      colKey="vehicleName"
                      sortKey={inquiryLogsSortKey}
                      sortDirection={inquiryLogsSortDirection}
                      onSort={handleSortInquiry}
                      isFiltered={!!inquiryLogsColumnFilters['vehicleName']}
                      onOpenFilter={(e) => handleOpenInquiryFilterMenu('vehicleName', 'نام خودرو', e)}
                    />

                    <TableColumnHeader
                      title="پلاک"
                      colKey="plaque"
                      sortKey={inquiryLogsSortKey}
                      sortDirection={inquiryLogsSortDirection}
                      onSort={handleSortInquiry}
                      isFiltered={!!inquiryLogsColumnFilters['plaque']}
                      onOpenFilter={(e) => handleOpenInquiryFilterMenu('plaque', 'پلاک خودرو', e)}
                    />

                    <TableColumnHeader
                      title="شرکت"
                      colKey="company"
                      sortKey={inquiryLogsSortKey}
                      sortDirection={inquiryLogsSortDirection}
                      onSort={handleSortInquiry}
                      isFiltered={!!inquiryLogsColumnFilters['company']}
                      onOpenFilter={(e) => handleOpenInquiryFilterMenu('company', 'شرکت', e)}
                    />

                    <TableColumnHeader
                      title="راننده"
                      colKey="driverName"
                      sortKey={inquiryLogsSortKey}
                      sortDirection={inquiryLogsSortDirection}
                      onSort={handleSortInquiry}
                      isFiltered={!!inquiryLogsColumnFilters['driverName']}
                      onOpenFilter={(e) => handleOpenInquiryFilterMenu('driverName', 'نام راننده', e)}
                    />

                    <TableColumnHeader
                      title="کارکرد کیلومتر"
                      colKey="odometerKm"
                      sortKey={inquiryLogsSortKey}
                      sortDirection={inquiryLogsSortDirection}
                      onSort={handleSortInquiry}
                    />

                    <TableColumnHeader
                      title="کیلومتر قبلی"
                      colKey="previousKm"
                      sortKey={inquiryLogsSortKey}
                      sortDirection={inquiryLogsSortDirection}
                      onSort={handleSortInquiry}
                    />

                    <TableColumnHeader
                      title="پیمایش (اختلاف)"
                      colKey="differenceKm"
                      sortKey={inquiryLogsSortKey}
                      sortDirection={inquiryLogsSortDirection}
                      onSort={handleSortInquiry}
                    />

                    <TableColumnHeader
                      title="ثبت‌کننده / منبع"
                      colKey="recordedBy"
                      sortKey={inquiryLogsSortKey}
                      sortDirection={inquiryLogsSortDirection}
                      onSort={handleSortInquiry}
                      isFiltered={!!inquiryLogsColumnFilters['recordedBy']}
                      onOpenFilter={(e) => handleOpenInquiryFilterMenu('recordedBy', 'ثبت‌کننده / منبع', e)}
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                  {paginatedInquiryLogs.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500 text-[11px]">
                        هیچ استعلام کارکردی با این مشخصات در سوابق یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    paginatedInquiryLogs.map((logItem, idx) => {
                      const rowNum = (inquiryLogsPage - 1) * inquiryLogsPageSize + idx + 1;
                      const isSmsSource = logItem.source === 'sms';

                      return (
                        <tr
                          key={logItem.id}
                          className="group relative hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/60 transition-colors text-[11px]"
                        >
                          <td className="py-1.5 px-3 text-center text-slate-500 text-[11px]">
                            {toPersianDigits(rowNum)}
                          </td>

                          <td className="py-1.5 px-3 whitespace-nowrap text-[11px]">
                            <span className="text-slate-900 dark:text-white">
                              {toPersianDigits(logItem.inquiryDate)}
                            </span>
                            {logItem.inquiryTime && (
                              <span className="text-slate-400 text-[10px] mr-1.5 font-mono">
                                {toPersianDigits(logItem.inquiryTime)}
                              </span>
                            )}
                          </td>

                          <td className="py-1.5 px-3">
                            <span className="text-slate-900 dark:text-white text-[11px]">
                              {logItem.vehicleName || 'نامشخص'}
                            </span>
                          </td>

                          <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap">
                            {toPersianDigits(logItem.plaque || '-')}
                          </td>

                          <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300">
                            {logItem.company || 'شرکت ثبت نشده'}
                          </td>

                          <td className="py-1.5 px-3 text-slate-800 dark:text-slate-200">
                            <span className="block">{logItem.driverName || 'ثبت نشده'}</span>
                            {logItem.driverPhone && (
                              <span className="text-[10px] text-slate-400 block font-mono">
                                {toPersianDigits(logItem.driverPhone)}
                              </span>
                            )}
                          </td>

                          <td className="py-1 px-3 whitespace-nowrap align-middle">
                            <div className="flex items-center gap-1 text-slate-800 dark:text-slate-200">
                              <span className="text-slate-900 dark:text-white text-[11px]">
                                {toPersianDigits(formatNumber(logItem.odometerKm))}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                                کیلومتر
                              </span>
                            </div>
                          </td>

                          <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap font-mono">
                            {logItem.previousKm ? `${toPersianDigits(formatNumber(logItem.previousKm))} کیلومتر` : '-'}
                          </td>

                          <td className="py-1.5 px-3 whitespace-nowrap text-[11px] font-mono">
                            {logItem.differenceKm !== undefined ? (
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                logItem.differenceKm > 0
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                              }`}>
                                +{toPersianDigits(formatNumber(logItem.differenceKm))} km
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>

                          <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300 text-[11px] relative whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {isSmsSource ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800/40">
                                  <Radio className="w-3 h-3" />
                                  <span>پیامک</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-[#1f1f24] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#2d2d30]">
                                  <span>دستی</span>
                                </span>
                              )}
                              {logItem.recordedBy && (
                                <span className="text-[10px] text-slate-400 truncate max-w-[80px]" title={logItem.recordedBy}>
                                  ({logItem.recordedBy})
                                </span>
                              )}
                            </div>

                            {/* دکمه‌های عملیات شناور - دقیقاً مشابه لیست سریع ناوگان هنگام هاور موس */}
                            <div className="absolute inset-y-0 left-0 pl-2.5 pr-14 flex items-center gap-1.5 bg-gradient-to-r from-slate-50 via-slate-50 via-70% to-transparent dark:from-[#1a1a1c] dark:via-[#1a1a1c] dark:via-70% dark:to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 z-20 pointer-events-none group-hover:pointer-events-auto">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(logItem)}
                                className="p-1 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-[#1e1e24] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-[#2d2d30] rounded shadow-2xs transition-colors cursor-pointer pointer-events-auto"
                                title="ویرایش این استعلام"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {onDeleteOdometerLog && (
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (confirm(`آیا از حذف استعلام شماره #${toPersianDigits(logItem.id)} خودرو «${logItem.vehicleName || ''}» (${toPersianDigits(formatNumber(logItem.odometerKm))} کیلومتر در تاریخ ${toPersianDigits(logItem.inquiryDate)}) اطمینان دارید؟`)) {
                                      try {
                                        await onDeleteOdometerLog(logItem.id);
                                      } catch (err: any) {
                                        alert(err?.message || 'خطا در حذف استعلام');
                                      }
                                    }
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-white dark:bg-[#1e1e24] hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-[#2d2d30] rounded shadow-2xs transition-colors cursor-pointer pointer-events-auto"
                                  title="حذف این استعلام"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
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
              currentPage={inquiryLogsPage}
              totalPages={totalInquiryPages}
              pageSize={inquiryLogsPageSize}
              totalItems={sortedInquiryLogs.length}
              onPageChange={setInquiryLogsPage}
              onPageSizeChange={(size) => {
                setInquiryLogsPageSize(size);
                setInquiryLogsPage(1);
              }}
            />
          </div>
        </div>
      )}

      {/* محتوای تب سوم: دریافت خودکار پیامکی کارکرد رانندگان (SMS Gateway) */}
      {activeTab === 'sms_gateway' && (
        <div className="space-y-4">
          {/* جدول لاگ پیامک‌های دریافتی رانندگان */}
          <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden shadow-2xs">
            <div className="p-3 border-b border-slate-200 dark:border-[#2d2d30] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-[#161618]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-violet-100 dark:bg-violet-600/20 text-violet-700 dark:text-violet-400 flex items-center justify-center">
                  <History className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">تاریخچه و لاگ پیامک‌های دریافتی از رانندگان</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">تمام پیامک‌های واصله از خط اختصاصی پیامکی و نتایج تطبیق خودکار</p>
                </div>
              </div>

              {/* ابزارهای فیلتر و جستجو و همگام‌سازی */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isRematchingSms}
                  onClick={handleRematchUnknownSms}
                  className="flex items-center gap-1.5 px-3 py-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-md text-[11px] font-bold transition-all shadow-2xs cursor-pointer whitespace-nowrap"
                  title="تطبیق و شناسایی مجدد کلیه پیامک‌های ناشناس بر اساس آخرین اطلاعات ناوگان"
                >
                  <RefreshCw className={`w-3 h-3 ${isRematchingSms ? 'animate-spin' : ''}`} />
                  <span>{isRematchingSms ? 'در حال شناسایی...' : 'شناسایی مجدد ناشناس‌ها'}</span>
                </button>

                {onSyncSms && (
                  <button
                    type="button"
                    disabled={isSyncingSms}
                    onClick={handleSyncIncomingSms}
                    className="flex items-center gap-1.5 px-3 py-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-md text-[11px] font-bold transition-all shadow-2xs cursor-pointer whitespace-nowrap"
                    title="استعلام و دریافت پیامک‌های جدید از وب‌سرویس پیامک"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncingSms ? 'animate-spin' : ''}`} />
                    <span>{isSyncingSms ? 'در حال استعلام...' : 'استعلام پیامک‌های جدید از پنل'}</span>
                  </button>
                )}

                <select
                  value={smsStatusFilter}
                  onChange={(e: any) => setSmsStatusFilter(e.target.value)}
                  className="bg-white dark:bg-[#1a1a1c] border border-slate-200 dark:border-[#2d2d30] text-slate-800 dark:text-slate-200 text-[11px] rounded-md px-2 py-1 focus:outline-none"
                >
                  <option value="all">همه وضعیت‌ها</option>
                  <option value="success">فقط موفق</option>
                  <option value="error">خطا یا ناشناس</option>
                </select>

                <div className="relative">
                  <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="جستجو در پیامک‌ها..."
                    value={smsSearchTerm}
                    onChange={(e) => setSmsSearchTerm(e.target.value)}
                    className="bg-white dark:bg-[#1a1a1c] border border-slate-200 dark:border-[#2d2d30] text-slate-900 dark:text-white text-[11px] rounded-md pr-7 pl-2.5 py-1 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {syncStatusMsg && (
              <div className={`p-2.5 mx-3 mt-3 rounded-md text-xs font-medium flex items-center justify-between gap-2 ${
                syncStatusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800' :
                syncStatusMsg.type === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800' :
                'bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800'
              }`}>
                <span>{syncStatusMsg.text}</span>
                <button type="button" onClick={() => setSyncStatusMsg(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-[#141416] border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-medium text-xs">
                    <th className="py-2.5 px-3 text-center w-12 text-xs font-medium">ردیف</th>
                    <th className="py-2.5 px-3 text-xs font-medium">زمان دریافت</th>
                    <th className="py-2.5 px-3 text-xs font-medium">شماره فرستنده</th>
                    <th className="py-2.5 px-3 text-xs font-medium">متن خام پیامک</th>
                    <th className="py-2.5 px-3 text-xs font-medium">خودرو و پلاک شناسایی‌شده</th>
                    <th className="py-2.5 px-3 text-xs font-medium">راننده</th>
                    <th className="py-2.5 px-3 text-center text-xs font-medium">کیلومتر استخراجی</th>
                    <th className="py-2.5 px-3 text-center text-xs font-medium">وضعیت پردازش</th>
                    <th className="py-2.5 px-3 text-xs font-medium">پیام پاسخ سامانه</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2d2d30]/60">
                  {filteredSmsLogs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500 dark:text-slate-400 text-[11px]">
                        {smsLogs.length === 0 
                          ? 'تاکنون پیامکی از رانندگان دریافت نشده است. می‌توانید با شبیه‌ساز بالا یا ارسال پیامک واقعی، عملکرد سیستم را آزمایش کنید.'
                          : 'هیچ پیامکی با فیلتر انتخابی یافت نشد.'}
                      </td>
                    </tr>
                  ) : (
                    filteredSmsLogs.map((item, idx) => (
                      <tr key={item.id} className="group relative hover:bg-slate-50 dark:hover:bg-[#161618] transition-colors text-[11px]">
                        <td className="py-2.5 px-3 text-center text-slate-500 dark:text-slate-400 text-[11px]">
                          {toPersianDigits(idx + 1)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleDateString('fa-IR')}
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                            {new Date(item.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">
                          {item.senderPhone}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 max-w-xs">
                          <span className="bg-slate-100 dark:bg-[#1d1d22] px-2 py-0.5 rounded text-violet-700 dark:text-violet-300 border border-slate-200 dark:border-[#2d2d30] block truncate text-[11px]" title={item.rawText}>
                            "{item.rawText}"
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {item.vehicleName ? (
                            <div>
                              <span className="text-slate-800 dark:text-slate-200 font-medium">{item.vehicleName}</span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">{toPersianDigits(item.vehiclePlaque || '')}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-amber-600 dark:text-amber-400 text-[10px] bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-500/20 font-medium">
                                ناشناس
                              </span>
                              {onAssignSms && vehicles.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAssignModalLog(item);
                                    setAssignVehicleId(vehicles[0].id);
                                  }}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                                  title="تخصیص این پیامک به خودرو و ثبت کارکرد"
                                >
                                  <Truck className="w-3 h-3" />
                                  <span>تخصیص به خودرو</span>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                          {item.driverName || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center text-indigo-600 dark:text-indigo-400">
                          {item.extractedKm ? `${toPersianDigits(formatNumber(item.extractedKm))} کیلومتر` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {item.status === 'success' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                              ثبت موفق
                            </span>
                          ) : item.status === 'unknown_driver' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30" title={item.statusMessage}>
                              راننده ناشناس
                            </span>
                          ) : item.status === 'invalid_km' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30" title={item.statusMessage}>
                              عدد نامعتبر
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
                              خطا
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 text-[11px] max-w-xs truncate relative" title={item.replyMessage || item.statusMessage}>
                          {item.replyMessage || item.statusMessage || '-'}

                          {/* دکمه‌های عملیات شناور - فقط هنگام بردن موس روی ردیف */}
                          <div className="absolute inset-y-0 left-0 pl-2.5 pr-10 flex items-center gap-1 bg-gradient-to-r from-slate-50 via-slate-50 via-70% to-transparent dark:from-[#161618] dark:via-[#161618] dark:via-70% dark:to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 z-20 pointer-events-none group-hover:pointer-events-auto">
                            {!item.vehicleId && onAssignSms && vehicles.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAssignModalLog(item);
                                  setAssignVehicleId(vehicles[0].id);
                                }}
                                className="p-1 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-[#2d2d30] rounded shadow-2xs transition-colors cursor-pointer"
                                title="تخصیص به خودرو و ثبت کارکرد"
                              >
                                <Truck className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onDeleteSmsLog && (
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm('آیا از حذف این لاگ پیامک اطمینان دارید؟')) {
                                    try {
                                      await onDeleteSmsLog(item.id);
                                    } catch (err: any) {
                                      alert(err?.message || 'خطا در حذف لاگ پیامک');
                                    }
                                  }
                                }}
                                className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-[#2d2d30] rounded shadow-2xs transition-colors cursor-pointer pointer-events-auto"
                                title="حذف لاگ پیامک"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* مدال تخصیص پیامک ناشناس به خودرو */}
          {assignModalLog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
              <div className="bg-white dark:bg-[#151518] rounded-xl border border-slate-200 dark:border-[#2d2d30] shadow-xl w-full max-w-md p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2d2d30]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">تخصیص پیامک به خودرو و ثبت کارکرد</h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">اتصال پیامک شماره {assignModalLog.senderPhone} به ناوگان</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAssignModalLog(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-slate-50 dark:bg-[#1a1a1e] p-3 rounded-lg border border-slate-200 dark:border-[#2d2d30] space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">شماره فرستنده:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{assignModalLog.senderPhone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">متن پیامک:</span>
                    <span className="text-violet-600 dark:text-violet-400 font-medium">"{assignModalLog.rawText}"</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">کیلومتر استخراج‌شده:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {toPersianDigits(formatNumber(assignModalLog.extractedKm || 0))} کیلومتر
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    انتخاب خودروی ناوگان جهت ثبت این کارکرد:
                  </label>
                  <select
                    value={assignVehicleId}
                    onChange={(e) => setAssignVehicleId(Number(e.target.value))}
                    className="w-full bg-white dark:bg-[#1a1a1d] border border-slate-300 dark:border-[#35353a] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} - {v.driverName ? `راننده: ${v.driverName}` : 'بدون راننده'} (کد: {toPersianDigits(v.code)}) - کارکرد: {toPersianDigits(formatNumber(v.currentKm || 0))} km
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={assignUpdatePhone}
                    onChange={(e) => setAssignUpdatePhone(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>شماره {assignModalLog.senderPhone} به عنوان شماره راننده این خودرو ذخیره شود (پیامک‌های بعدی خودکار شناسایی شوند).</span>
                </label>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-[#2d2d30]">
                  <button
                    type="button"
                    onClick={() => setAssignModalLog(null)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#252528] cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    disabled={isAssigning || !assignVehicleId}
                    onClick={handleConfirmAssign}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    {isAssigning && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>ثبت کارکرد برای این خودرو</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* محتوای تب سوم: ارسال پیامک یادآوری کارکرد رانندگان (پیگیری مراجعات گذشته) */}
      {activeTab === 'sms_reminders' && (
        <SmsRemindersTab 
          vehicles={vehicles}
          services={services}
          odometerLogs={odometerLogs}
          initialDaysThreshold={smsDaysThreshold}
          onThresholdChange={setSmsDaysThreshold}
        />
      )}
        </motion.div>
      </AnimatePresence>

      {/* مدال نمایش جزئیات سرویس و سلامت قطعات خودرو انتخابی - هماهنگ با مدال سرویس‌های دوره‌ای */}
      {selectedFleetVehicleForDetails && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* هدر مدال */}
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <span>جزئیات استعلام وضعیت قطعات خودرو</span>
                    <span className="text-xs font-mono font-normal text-slate-500 dark:text-slate-400">
                      ({toPersianDigits(selectedFleetVehicleForDetails.serviceItems?.length || 0)} ردیف خدمت و قطعه)
                    </span>
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                    خودرو: {selectedFleetVehicleForDetails.name} | پلاک: {selectedFleetVehicleForDetails.plaque ? toPersianDigits(selectedFleetVehicleForDetails.plaque) : '---'} | کارکرد ثبت‌شده: {toPersianDigits(formatNumber(selectedFleetVehicleForDetails.currentKm || 0))} کیلومتر
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFleetVehicleForDetails(null)}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                title="بستن پنجره"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* بدنه اسکرول‌خور جزئیات */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* کارت مشخصات کلی خودرو */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/80 dark:bg-[#161618]/80 p-4 rounded-xl border border-slate-200 dark:border-[#2d2d30]">
                <div>
                  <span className="text-slate-500 text-[11px] block mb-0.5">نام خودرو:</span>
                  <strong className="text-slate-900 dark:text-white font-extrabold text-sm">
                    {selectedFleetVehicleForDetails.name}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block mb-0.5">شماره پلاک:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                    {selectedFleetVehicleForDetails.plaque ? toPersianDigits(selectedFleetVehicleForDetails.plaque) : '---'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block mb-0.5">نام راننده:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-medium">
                    {selectedFleetVehicleForDetails.driverName || '---'}
                    {selectedFleetVehicleForDetails.driverPhone && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono block mt-0.5">
                        {toPersianDigits(selectedFleetVehicleForDetails.driverPhone)}
                      </span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block mb-0.5">شرکت / مالک:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-medium">
                    {selectedFleetVehicleForDetails.company || '---'}
                  </span>
                </div>
              </div>

              {/* کارت وضعیت سلامت کلی، آخرین استعلام و تاخیر از آخرین مراجعه به سرویس */}
              <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border ${
                selectedFleetVehicleForDetails.needsService
                  ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-500/20'
                  : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-500/20'
              }`}>
                <div>
                  <span className="text-slate-500 text-[11px] block mb-0.5">وضعیت سلامت فنی ناوگان:</span>
                  {selectedFleetVehicleForDetails.needsService ? (
                    <strong className="text-rose-900 dark:text-rose-300 font-bold text-xs flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-rose-500" />
                      <span>{toPersianDigits(selectedFleetVehicleForDetails.overdueCount)} قطعه منقضی، {toPersianDigits(selectedFleetVehicleForDetails.warningCount)} در آستانه تعویض</span>
                    </strong>
                  ) : (
                    <strong className="text-emerald-900 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>کلیه قطعات و سرویس‌ها در وضعیت سالم</span>
                    </strong>
                  )}
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block mb-0.5">کارکرد و تاریخ آخرین استعلام:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                    {toPersianDigits(formatNumber(selectedFleetVehicleForDetails.currentKm || 0))} کیلومتر
                    {selectedFleetVehicleForDetails.latestLog?.inquiryDate && (
                      <span className="text-slate-500 font-sans font-normal mr-2 text-[11px]">
                        (استعلام: {toPersianDigits(selectedFleetVehicleForDetails.latestLog.inquiryDate)})
                      </span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block mb-0.5">آخرین مراجعه به سرویس و تاخیر:</span>
                  {selectedFleetVehicleForDetails.lastServiceDate !== 'بدون سابقه' ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                        {toPersianDigits(selectedFleetVehicleForDetails.lastServiceDate)}
                      </span>
                      <span className={`text-[11px] font-bold ${
                        (selectedFleetVehicleForDetails.daysSinceLastService || 0) > 30
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        ({toPersianDigits(selectedFleetVehicleForDetails.daysSinceLastService)} روز تاخیر)
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-xs">بدون سابقه سرویس</span>
                  )}
                </div>
              </div>

              {/* جدول قطعات و سرویس‌های خودرو */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 border-r-2 border-indigo-500 pr-2">
                    <Wrench className="w-3.5 h-3.5 text-indigo-500" />
                    <span>ریز وضعیت قطعات و خدمات دوره‌ای ({toPersianDigits(selectedFleetVehicleForDetails.serviceItems?.length || 0)} مورد)</span>
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#2d2d30]">
                  <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-[#1a1a1c] border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-medium text-xs">
                        <th className="py-2.5 px-3 w-10 text-center text-xs font-medium">#</th>
                        <th className="py-2.5 px-3 text-xs font-medium">عنوان سرویس / قطعه مصرفی</th>
                        <th className="py-2.5 px-3 text-center text-xs font-medium">کیلومتر آخرین تعویض</th>
                        <th className="py-2.5 px-3 text-center text-xs font-medium">کارکرد باقیمانده</th>
                        <th className="py-2.5 px-3 text-center w-28 text-xs font-medium">اقدام</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                      {(!selectedFleetVehicleForDetails.serviceItems || selectedFleetVehicleForDetails.serviceItems.length === 0) ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400 font-medium">
                            هیچ قطعه یا سرویسی برای این خودرو تعریف نشده است.
                          </td>
                        </tr>
                      ) : (
                        [...(selectedFleetVehicleForDetails.serviceItems || [])]
                          .sort((a: any, b: any) => {
                            const getScore = (it: any) => {
                              if (it.status === 'overdue' || it.isOverdue) return 3;
                              if (it.status === 'warning' || it.isWarning) return 2;
                              return 1;
                            };
                            const diff = getScore(b) - getScore(a);
                            if (diff !== 0) return diff;
                            return (a.remainingKm ?? 0) - (b.remainingKm ?? 0);
                          })
                          .map((item: any, idx: number) => {
                            const isOverdue = item.status === 'overdue' || Boolean(item.isOverdue);
                            const isWarning = item.status === 'warning' || Boolean(item.isWarning);
                            const serviceTitle = item.serviceType || item.title || 'سرویس دوره‌ای';

                            return (
                              <tr
                                key={idx}
                                className={`transition-colors ${
                                  isOverdue
                                    ? 'bg-rose-50/70 dark:bg-rose-950/25 hover:bg-rose-100/70 dark:hover:bg-rose-950/40'
                                    : isWarning
                                    ? 'bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-950/30'
                                    : 'hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/40'
                                }`}
                              >
                                <td className="py-2.5 px-3 text-center font-mono text-slate-400 dark:text-slate-500 font-bold text-[11px]">
                                  {toPersianDigits(idx + 1)}
                                </td>
                                <td className="py-2.5 px-3 font-extrabold text-slate-900 dark:text-white">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                      isOverdue ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-indigo-500'
                                    }`}></span>
                                    <span className={
                                      isOverdue
                                        ? 'text-rose-900 dark:text-rose-300'
                                        : isWarning
                                        ? 'text-amber-900 dark:text-amber-300'
                                        : 'text-slate-900 dark:text-white'
                                    }>
                                      {serviceTitle}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-center whitespace-nowrap text-xs">
                                  {item.lastServicedKm ? (
                                    <div className="inline-flex items-center gap-1 font-mono text-slate-800 dark:text-slate-200">
                                      <span className="font-bold">{toPersianDigits(formatNumber(item.lastServicedKm))}</span>
                                      <span className="text-[10px] text-slate-500 font-sans">کیلومتر</span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 dark:text-slate-500 text-[11px]">مبدا اولیه</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                  {isOverdue ? (
                                    <span className="inline-flex items-center justify-center gap-1 text-xs font-extrabold text-rose-600 dark:text-rose-400 font-mono">
                                      <span>{toPersianDigits(formatNumber(Math.abs(item.remainingKm)))}</span>
                                      <span className="font-sans text-[11px]">کیلومتر گذشته</span>
                                    </span>
                                  ) : isWarning ? (
                                    <span className="inline-flex items-center justify-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 font-mono">
                                      <span>{toPersianDigits(formatNumber(item.remainingKm))}</span>
                                      <span className="font-sans text-[11px]">کیلومتر باقیمانده</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center justify-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 font-mono">
                                      <span>{toPersianDigits(formatNumber(item.remainingKm))}</span>
                                      <span className="font-sans text-[11px]">کیلومتر باقیمانده</span>
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {onNavigateToServices ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onNavigateToServices(selectedFleetVehicleForDetails.id, serviceTitle);
                                        setSelectedFleetVehicleForDetails(null);
                                      }}
                                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-1 shadow-2xs ${
                                        isOverdue
                                          ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                          : isWarning
                                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                          : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800/50'
                                      }`}
                                      title="ثبت سرویس و تعویض این قطعه"
                                    >
                                      <Wrench className="w-3 h-3" />
                                      <span>ثبت سرویس</span>
                                    </button>
                                  ) : (
                                    <span className="text-slate-400 text-[11px]">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* سوابق و تاریخچه استعلام‌های کارکرد این خودرو */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-[#2d2d30]">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 border-r-2 border-indigo-500 pr-2">
                    <History className="w-3.5 h-3.5 text-indigo-500" />
                    <span>سوابق استعلام‌های کارکرد ثبت‌شده ({toPersianDigits(odometerLogs.filter(l => l.vehicleId === selectedFleetVehicleForDetails.id).length)} مورد)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const vId = selectedFleetVehicleForDetails.id;
                      setSelectedFleetVehicleForDetails(null);
                      handleOpenAddModal(vId);
                    }}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ثبت استعلام جدید برای این خودرو</span>
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#2d2d30] max-h-56">
                  <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-[#1a1a1c] border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-medium text-xs sticky top-0 z-10">
                        <th className="py-2 px-3 w-10 text-center text-xs font-medium">#</th>
                        <th className="py-2 px-3 text-xs font-medium">تاریخ و ساعت استعلام</th>
                        <th className="py-2 px-3 text-center text-xs font-medium">کیلومتر کارکرد</th>
                        <th className="py-2 px-3 text-center text-xs font-medium">پیمایش (اختلاف)</th>
                        <th className="py-2 px-3 text-xs font-medium">منبع / ثبت‌کننده</th>
                        <th className="py-2 px-3 text-center w-24 text-xs font-medium">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                      {odometerLogs.filter(l => l.vehicleId === selectedFleetVehicleForDetails.id).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400 font-medium">
                            هیچ استعلام کارکردی تاکنون برای این خودرو ثبت نشده است.
                          </td>
                        </tr>
                      ) : (
                        [...odometerLogs.filter(l => l.vehicleId === selectedFleetVehicleForDetails.id)]
                          .sort((a, b) => {
                            const dateDiff = String(b.inquiryDate || '').localeCompare(String(a.inquiryDate || ''));
                            if (dateDiff !== 0) return dateDiff;
                            return Number(b.id || 0) - Number(a.id || 0);
                          })
                          .map((logItem, idx) => (
                            <tr key={logItem.id} className="hover:bg-slate-50 dark:hover:bg-[#1f1f24] transition-colors">
                              <td className="py-2 px-3 text-center text-slate-400 text-xs font-mono">{toPersianDigits(idx + 1)}</td>
                              <td className="py-2 px-3 font-mono text-xs whitespace-nowrap">
                                <span>{toPersianDigits(logItem.inquiryDate)}</span>
                                {logItem.inquiryTime && (
                                  <span className="text-slate-400 text-[10px] mr-1.5 font-mono">({toPersianDigits(logItem.inquiryTime)})</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                                {toPersianDigits(formatNumber(logItem.odometerKm))} کیلومتر
                              </td>
                              <td className="py-2 px-3 text-center font-mono text-xs text-slate-500">
                                {logItem.differenceKm !== undefined ? `+${toPersianDigits(formatNumber(logItem.differenceKm))} km` : '-'}
                              </td>
                              <td className="py-2 px-3 text-xs text-slate-500 truncate max-w-[150px]">
                                {logItem.recordedBy || logItem.source || '-'}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleOpenEditModal(logItem);
                                      setSelectedFleetVehicleForDetails(null);
                                    }}
                                    className="p-1 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded transition-colors cursor-pointer"
                                    title="ویرایش این استعلام"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  {onDeleteOdometerLog && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (confirm(`آیا از حذف استعلام ${toPersianDigits(formatNumber(logItem.odometerKm))} کیلومتر تاریخ ${toPersianDigits(logItem.inquiryDate)} اطمینان دارید؟`)) {
                                          try {
                                            await onDeleteOdometerLog(logItem.id);
                                          } catch (err: any) {
                                            alert(err?.message || 'خطا در حذف استعلام');
                                          }
                                        }
                                      }}
                                      className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                                      title="حذف این استعلام"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* فوتر دکمه‌های عملیاتی جزئیات */}
            <div className="flex justify-between items-center p-4 border-t border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] shrink-0">
              <div className="flex items-center gap-2">
                {onNavigateToServices && (
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateToServices(selectedFleetVehicleForDetails.id);
                      setSelectedFleetVehicleForDetails(null);
                    }}
                    className="px-3.5 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-500/20"
                  >
                    <span>مشاهده تمام سوابق سرویس‌های این خودرو</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedFleetVehicleForDetails(null)}
                className="px-5 py-2 rounded-lg bg-slate-200 dark:bg-[#2c2c30] hover:bg-slate-300 dark:hover:bg-[#38383c] text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* منوی شناور فیلتر ستون‌ها برای ماتریس پایش قطعات */}
      {matrixFilterMenu && (
        <ColumnFilterMenu
          filterMenu={matrixFilterMenu}
          uniqueValues={currentMatrixMenuUniqueValues}
          selectedValues={currentMatrixSelectedValues}
          onToggleValue={handleToggleMatrixColumnValue}
          onSelectAll={() => {
            const next = { ...matrixColumnFilters };
            delete next[matrixFilterMenu.colKey];
            setMatrixColumnFilters(next);
          }}
          onDeselectAll={() => {
            setMatrixColumnFilters({ ...matrixColumnFilters, [matrixFilterMenu.colKey]: [] });
          }}
          onSelectOnly={(val) => {
            setMatrixColumnFilters({ ...matrixColumnFilters, [matrixFilterMenu.colKey]: [val] });
          }}
          onClose={() => setMatrixFilterMenu(null)}
        />
      )}

      {/* منوی شناور فیلتر ستون‌ها برای خدمات سررسید شده و اخطار */}
      {dueFilterMenu && (
        <ColumnFilterMenu
          filterMenu={dueFilterMenu}
          uniqueValues={currentDueMenuUniqueValues}
          selectedValues={currentDueSelectedValues}
          onToggleValue={handleToggleDueColumnValue}
          onSelectAll={() => {
            const next = { ...dueColumnFilters };
            delete next[dueFilterMenu.colKey];
            setDueColumnFilters(next);
          }}
          onDeselectAll={() => {
            setDueColumnFilters({ ...dueColumnFilters, [dueFilterMenu.colKey]: [] });
          }}
          onSelectOnly={(val) => {
            setDueColumnFilters({ ...dueColumnFilters, [dueFilterMenu.colKey]: [val] });
          }}
          onClose={() => setDueFilterMenu(null)}
        />
      )}

      {/* منوی شناور فیلتر ستون‌ها برای لیست سریع ناوگان */}
      {fleetFilterMenu && (
        <ColumnFilterMenu
          filterMenu={fleetFilterMenu}
          uniqueValues={currentFleetMenuUniqueValues}
          selectedValues={currentFleetSelectedValues}
          onToggleValue={handleToggleFleetColumnValue}
          onSelectAll={() => {
            const next = { ...fleetColumnFilters };
            delete next[fleetFilterMenu.colKey];
            setFleetColumnFilters(next);
          }}
          onDeselectAll={() => {
            setFleetColumnFilters({ ...fleetColumnFilters, [fleetFilterMenu.colKey]: [] });
          }}
          onSelectOnly={(val) => {
            setFleetColumnFilters({ ...fleetColumnFilters, [fleetFilterMenu.colKey]: [val] });
          }}
          onClose={() => setFleetFilterMenu(null)}
        />
      )}

      {/* منوی شناور فیلتر ستون‌ها برای سوابق استعلامات کارکرد */}
      {inquiryFilterMenu && (
        <ColumnFilterMenu
          filterMenu={inquiryFilterMenu}
          uniqueValues={currentInquiryMenuUniqueValues}
          selectedValues={currentInquirySelectedValues}
          onToggleValue={handleToggleInquiryColumnValue}
          onSelectAll={() => {
            const next = { ...inquiryLogsColumnFilters };
            delete next[inquiryFilterMenu.colKey];
            setInquiryLogsColumnFilters(next);
          }}
          onDeselectAll={() => {
            setInquiryLogsColumnFilters({ ...inquiryLogsColumnFilters, [inquiryFilterMenu.colKey]: [] });
          }}
          onSelectOnly={(val) => {
            setInquiryLogsColumnFilters({ ...inquiryLogsColumnFilters, [inquiryFilterMenu.colKey]: [val] });
          }}
          onClose={() => setInquiryFilterMenu(null)}
        />
      )}
    </div>
  );
}
