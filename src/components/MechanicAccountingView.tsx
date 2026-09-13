/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Wrench, Search, Printer, Plus, X, ArrowUpDown, ArrowUp, ArrowDown, Eye, Edit3,
  RotateCcw, FileSpreadsheet, ChevronRight, CheckSquare, Square,
  Building, Phone, CreditCard, Coins, CheckCircle2, AlertCircle, Clock,
  Calendar, Layers, Truck, FileText, Package, List, Receipt, CheckCircle, Check, Scale
} from 'lucide-react';
import { Mechanic, RepairWorkflow, VehicleFailure, PeriodicService, Vehicle, Expense, ExpenseType } from '../types';
import { formatPrice, toPersianDigits, parsePersianNumber } from '../utils/numberUtils';
import { getCurrentJalaliDate, toJalaliDate, persianToEnglishDigits } from '../utils/date';
import { sortData, SortDirection } from '../utils/sortUtils';
import { CustomSelect } from './CustomSelect';
import { JalaliDatePicker } from './JalaliDatePicker';
import { Pagination } from './Pagination';
import { TableColumnHeader, ColumnFilterMenu, FilterMenuState } from './TableFilterSort';

export type MechanicCategoryFilter = 'all' | 'repair' | 'service' | 'shop_parts' | 'payment';

export interface MechanicStatementItem {
  id: string;
  sourceId: number | string;
  mechanicId?: number;
  mechanicName: string;
  repairShopName: string;
  date: string;
  categoryType: 'repair' | 'service' | 'shop_parts' | 'payment';
  categoryLabel: string;
  title: string;
  description: string;
  vehicleId?: number;
  vehicleName?: string;
  vehiclePlaque?: string;
  wages: number;
  shopPartsCost: number;
  creditAmount: number; // بستانکاری (طلب تعمیرکار بابت خدمات/قطعات)
  debitAmount: number;  // بدهکاری (مبالغ پرداخت‌شده به تعمیرکار)
  runningBalance?: number; // مانده تجمعی کاردکس
  status: 'completed' | 'in_repair' | 'settled';
  reference?: string;
  rawItem: any;
}

interface MechanicAccountingViewProps {
  mechanics: Mechanic[];
  workflows?: RepairWorkflow[];
  failures?: VehicleFailure[];
  services?: PeriodicService[];
  vehicles?: Vehicle[];
  expenses?: Expense[];
  onAddExpense?: (exp: Omit<Expense, 'id' | 'createdAt'>) => Promise<void> | void;
  isExternalPaymentModalOpen?: boolean;
  onClosePaymentModal?: () => void;
  selectedMechanicKey?: string;
  onSelectMechanicKey?: (key: string) => void;
}

function normalizeToComparableJalali(dateStr?: string | null): string {
  if (!dateStr || dateStr === '-' || dateStr === '---') return '';
  const eng = persianToEnglishDigits(String(dateStr)).trim();

  const jalaliMatch = eng.match(/^(13\d{2}|14\d{2})[-/](\d{1,2})[-/](\d{1,2})/);
  if (jalaliMatch) {
    const y = jalaliMatch[1];
    const m = jalaliMatch[2].padStart(2, '0');
    const d = jalaliMatch[3].padStart(2, '0');
    return `${y}/${m}/${d}`;
  }

  try {
    const parsed = new Date(eng);
    if (!isNaN(parsed.getTime())) {
      const jalaliFormatted = parsed.toLocaleDateString('fa-IR-u-nu-latn', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = jalaliFormatted.split('/').map(p => p.trim());
      if (parts.length === 3) {
        return `${parts[0]}/${parts[1].padStart(2, '0')}/${parts[2].padStart(2, '0')}`;
      }
    }
  } catch (e) {}

  return eng.replace(/-/g, '/');
}

export const MechanicAccountingView: React.FC<MechanicAccountingViewProps> = ({
  mechanics = [],
  workflows = [],
  failures = [],
  services = [],
  vehicles = [],
  expenses = [],
  onAddExpense,
  isExternalPaymentModalOpen,
  onClosePaymentModal,
  selectedMechanicKey: externalSelectedMechanicKey,
  onSelectMechanicKey
}) => {
  // شناسه یا نام تعمیرکار انتخاب‌شده
  const [internalSelectedMechanicKey, setInternalSelectedMechanicKey] = useState<string>('');
  const selectedMechanicKey = externalSelectedMechanicKey !== undefined ? externalSelectedMechanicKey : internalSelectedMechanicKey;
  const setSelectedMechanicKey = (key: string) => {
    setInternalSelectedMechanicKey(key);
    onSelectMechanicKey?.(key);
  };
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // فیلترهای تاریخ و دسته‌بندی
  const [selectedCategory, setSelectedCategory] = useState<MechanicCategoryFilter>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // مرتب‌سازی و صفحه‌بندی
  const [sortKey, setSortKey] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // ویرایش اقلام و ذخیره محلی
  const [editingItem, setEditingItem] = useState<MechanicStatementItem | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editWages, setEditWages] = useState<string>('');
  const [editShopPartsCost, setEditShopPartsCost] = useState<string>('');
  const [editDebitAmount, setEditDebitAmount] = useState<string>('');
  const [editCreditAmount, setEditCreditAmount] = useState<string>('');
  const [editReference, setEditReference] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const [overrides, setOverrides] = useState<Record<string, Partial<MechanicStatementItem>>>(() => {
    try {
      const saved = localStorage.getItem('mechanic_statement_overrides');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleOpenEditModal = (item: MechanicStatementItem) => {
    setEditingItem(item);
    setEditTitle(item.title || '');
    setEditDate(item.date || getCurrentJalaliDate());
    setEditWages(item.wages ? String(item.wages) : '');
    setEditShopPartsCost(item.shopPartsCost ? String(item.shopPartsCost) : '');
    setEditDebitAmount(item.debitAmount ? String(item.debitAmount) : '');
    setEditCreditAmount(item.creditAmount ? String(item.creditAmount) : '');
    setEditReference(item.reference || '');
    setEditDescription(item.description || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setIsSavingEdit(true);
    try {
      const parsedDebit = parsePersianNumber(editDebitAmount) || 0;
      const parsedCredit = parsePersianNumber(editCreditAmount) || 0;
      const parsedWages = parsePersianNumber(editWages) || 0;
      const parsedShopParts = parsePersianNumber(editShopPartsCost) || 0;

      const newOverrides = {
        ...overrides,
        [editingItem.id]: {
          title: editTitle,
          date: editDate,
          wages: parsedWages,
          shopPartsCost: parsedShopParts,
          debitAmount: parsedDebit,
          creditAmount: parsedCredit,
          reference: editReference,
          description: editDescription
        }
      };

      setOverrides(newOverrides);
      localStorage.setItem('mechanic_statement_overrides', JSON.stringify(newOverrides));

      // اگر از نوع هزینه بود به بک‌اند نیز بفرستیم
      if (editingItem.id.startsWith('exp_')) {
        const expenseId = editingItem.sourceId;
        await fetch(`/api/expenses/${expenseId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: editTitle,
            amount: parsedDebit > 0 ? parsedDebit : parsedCredit,
            date: editDate,
            reference: editReference,
            description: editDescription
          })
        }).catch(err => console.error('Failed to sync expense update to server', err));
      }

      setEditingItem(null);
    } catch (err) {
      console.error('Error saving edit', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // فیلترهای سبک اکسل
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [filterMenu, setFilterMenu] = useState<{ x: number; y: number; colKey: string; colTitle: string } | null>(null);
  const [filterSearch, setFilterSearch] = useState<string>('');

  // مودال جزئیات سند
  const [detailModalItem, setDetailModalItem] = useState<MechanicStatementItem | null>(null);

  // مودال ثبت پرداخت / تسویه حساب
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(getCurrentJalaliDate());
  const [paymentMethod, setPaymentMethod] = useState<string>('bank_transfer');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paymentDescription, setPaymentDescription] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);

  // همگام‌سازی باز شدن مودال از دکمه هدر بالای صفحه اصلی
  useEffect(() => {
    if (isExternalPaymentModalOpen) {
      if (!selectedMechanicKey && mechanics.length > 0) {
        setSelectedMechanicKey(`mech_${mechanics[0].id}`);
      }
      setIsPaymentModalOpen(true);
    }
  }, [isExternalPaymentModalOpen, mechanics, selectedMechanicKey]);

  const handleClosePaymentModal = () => {
    setIsPaymentModalOpen(false);
    onClosePaymentModal?.();
  };

  // بستن منوهای شناور با کلیک خارج از کادر
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
      if (filterMenu && !(e.target as HTMLElement).closest('.filter-popup-menu')) {
        setFilterMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [filterMenu]);

  // لیست یکپارچه تمامی تعمیرکاران و تعمیرگاه‌های فعال در سیستم
  const allMechanicsList = useMemo(() => {
    const list: Array<{ id: number; key: string; name: string; shopName: string; phone: string; specialty: string }> = [];
    const seenKeys = new Set<string>();

    mechanics.forEach(m => {
      const key = `mech_${m.id}`;
      seenKeys.add(key);
      list.push({
        id: m.id,
        key,
        name: m.name,
        shopName: m.shopName || 'تعمیرگاه مجاز',
        phone: m.phone || 'ثبت نشده',
        specialty: m.specialty || 'مکانیک و تعمیرات'
      });
    });

    // استخراج تعمیرگاه‌ها و سرویس‌کارانی که در گردش‌کارها یا سرویس‌ها ثبت شده‌اند اما در لیست اولیه نبودند
    workflows.forEach(w => {
      if (w.repairShopName && !w.technicianId) {
        const key = `shop_${w.repairShopName.trim()}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          list.push({
            id: 9000 + list.length,
            key,
            name: w.repairShopName.trim(),
            shopName: w.repairShopName.trim(),
            phone: 'مستقر در محل',
            specialty: 'خدمات تعمیرگاهی ناوگان'
          });
        }
      }
    });

    services.forEach(s => {
      const name = (s.mechanicName || s.repairShopName)?.trim();
      if (name && !s.mechanicId) {
        const key = `shop_${name}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          list.push({
            id: 9000 + list.length,
            key,
            name,
            shopName: s.repairShopName?.trim() || name,
            phone: 'مستقر در محل',
            specialty: 'سرویس‌کار و تعویض روغنی'
          });
        }
      }
    });

    expenses.forEach(e => {
      const name = e.repairShopName?.trim();
      if (name) {
        const key = `shop_${name}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          list.push({
            id: 9000 + list.length,
            key,
            name,
            shopName: name,
            phone: 'ثبت در اسناد',
            specialty: 'خدمات تعمیرات و نگهداری'
          });
        }
      }
    });

    return list;
  }, [mechanics, workflows, services, expenses]);

  // استخراج تمام اقلام کاردکس و صورتحساب برای تمامی تعمیرکاران
  const allMechanicStatementItems = useMemo(() => {
    const items: MechanicStatementItem[] = [];

    // ۱. سوابق تعمیرات و رفع خرابی (Workflows & Failures)
    workflows.forEach(wf => {
      const failure = failures.find(f => f.id === wf.failureId);
      const vehicle = failure ? vehicles.find(v => v.id === failure.vehicleId) : undefined;
      const mechanic = wf.technicianId ? mechanics.find(m => m.id === wf.technicianId) : undefined;

      const mechName = mechanic ? mechanic.name : (wf.repairShopName || 'تعمیرگاه مجاز');
      const shopName = wf.repairShopName || (mechanic ? mechanic.shopName : 'تعمیرگاه مجاز');
      const dateStr = wf.endDate || wf.startDate || (failure ? failure.failureDate : '') || '1405/01/01';

      // محاسبه قطعات تأمین‌شده توسط تعمیرگاه
      let shopPartsTotal = 0;
      if (wf.shopPartsUsed && Array.isArray(wf.shopPartsUsed)) {
        shopPartsTotal = wf.shopPartsUsed.reduce((sum, p) => sum + (Number(p.totalPrice) || (Number(p.quantity) * Number(p.unitPrice)) || 0), 0);
      }

      const wages = Number(wf.wages) || 0;
      const creditTotal = (wages + shopPartsTotal) > 0 ? (wages + shopPartsTotal) : (Number(wf.totalCost) || 0);

      // اگر قطعات جداگانه توسط تعمیرگاه تأمین شده، آن را مستقلاً در شرح بیاوریم
      items.push({
        id: `wf_${wf.id}`,
        sourceId: wf.id,
        mechanicId: wf.technicianId,
        mechanicName: mechName,
        repairShopName: shopName,
        date: toJalaliDate(dateStr),
        categoryType: shopPartsTotal > 0 && wages === 0 ? 'shop_parts' : 'repair',
        categoryLabel: 'تعمیر و رفع خرابی',
        title: failure?.description ? `تعمیر: ${failure.description.slice(0, 40)}...` : `دستور کار تعمیرات کد ${wf.id}`,
        description: `انجام تعمیرات بر روی خودرو ${vehicle?.name || ''} - اجرت: ${formatPrice(wages)} ریال ${shopPartsTotal > 0 ? `| ارزش قطعات تعمیرگاه: ${formatPrice(shopPartsTotal)} ریال` : ''}`,
        vehicleId: vehicle?.id,
        vehicleName: vehicle?.name,
        vehiclePlaque: vehicle?.plaque,
        wages,
        shopPartsCost: shopPartsTotal,
        creditAmount: creditTotal,
        debitAmount: 0,
        status: wf.isDelivered ? 'completed' : 'in_repair',
        reference: `فاکتور پرونده #${wf.failureId}`,
        rawItem: { workflow: wf, failure, vehicle }
      });
    });

    // ۲. سوابق سرویس‌های دوره‌ای (Periodic Services)
    services.forEach(srv => {
      const wageVal = Number(srv.wages) || 0;
      const costVal = Number(srv.cost) || 0;
      const hasMechanic = Boolean(srv.mechanicId || srv.mechanicName || srv.repairShopName || wageVal > 0);

      if (hasMechanic) {
        const vehicle = vehicles.find(v => v.id === srv.vehicleId);
        const mechanic = srv.mechanicId ? mechanics.find(m => m.id === srv.mechanicId) : undefined;
        const mechName = srv.mechanicName || (mechanic ? mechanic.name : (srv.repairShopName || 'تعمیرکار / سرویس‌کار'));
        const shopName = srv.repairShopName || (mechanic ? mechanic.shopName : 'تعمیرگاه');

        let wageAmount = wageVal;
        let shopPartsAmount = 0;

        if (wageAmount === 0) {
          if (srv.partSource === 'warehouse' || srv.supplierName || srv.supplierId) {
            wageAmount = 0;
          } else {
            wageAmount = costVal;
          }
        }

        if (srv.partSource !== 'warehouse' && !srv.supplierName && !srv.supplierId && costVal > 0 && wageVal > 0) {
          shopPartsAmount = costVal;
        }

        const creditAmount = wageAmount + shopPartsAmount;

        if (creditAmount > 0) {
          items.push({
            id: `srv_${srv.id}`,
            sourceId: srv.id,
            mechanicId: srv.mechanicId,
            mechanicName: mechName,
            repairShopName: shopName,
            date: toJalaliDate(srv.serviceDate),
            categoryType: 'service',
            categoryLabel: 'سرویس دوره‌ای',
            title: `سرویس: ${srv.serviceType}`,
            description: `اجرت و دستمزد انجام سرویس دوره‌ای برای خودرو ${vehicle?.name || srv.plaque || ''} (کیلومتر: ${formatPrice(srv.currentKm || 0)}) ${shopPartsAmount > 0 ? `| ارزش قطعه: ${formatPrice(shopPartsAmount)} ریال` : ''}`,
            vehicleId: vehicle?.id,
            vehicleName: vehicle?.name || srv.plaque,
            vehiclePlaque: vehicle?.plaque || srv.plaque,
            wages: wageAmount,
            shopPartsCost: shopPartsAmount,
            creditAmount: creditAmount,
            debitAmount: 0,
            status: 'completed',
            reference: `سرویس کد ${srv.id}`,
            rawItem: { service: srv, vehicle }
          });
        }
      }
    });

    // ۳. سوابق پرداخت وجه و تسویه حساب (Expenses)
    expenses.forEach(exp => {
      const isMechanicDebit = exp.debitPartyType === 'mechanic' || exp.partyType === 'mechanic' || exp.mechanicId || (exp.expenseType === 'payment' && exp.description?.includes('تعمیر'));
      const isMechanicCredit = exp.creditPartyType === 'mechanic';
      const isMechanicPayment = isMechanicDebit || isMechanicCredit ||
        (exp.expenseType === 'repair' && (exp.description?.includes('تسویه') || exp.description?.includes('پرداخت') || exp.description?.includes('واریز')));

      if (isMechanicPayment) {
        const mechIdFromExp = exp.mechanicId || (exp.debitPartyType === 'mechanic' ? Number(exp.debitPartyId) : (exp.creditPartyType === 'mechanic' ? Number(exp.creditPartyId) : undefined));
        const mechanic = mechIdFromExp ? mechanics.find(m => m.id === mechIdFromExp) : undefined;
        const mechName = mechanic ? mechanic.name : (exp.repairShopName || 'تعمیرکار / تعمیرگاه');
        const shopName = exp.repairShopName || (mechanic ? mechanic.shopName : 'تعمیرگاه');
        const vehicle = exp.vehicleId ? vehicles.find(v => v.id === exp.vehicleId) : undefined;
        const costNum = Number(exp.cost) || 0;

        const isCreditEntry = exp.creditPartyType === 'mechanic' || (exp.entryType === 'credit' && !isMechanicDebit);
        const debitVal = isCreditEntry ? 0 : costNum;
        const creditVal = isCreditEntry ? costNum : 0;

        items.push({
          id: `exp_${exp.id}`,
          sourceId: exp.id,
          mechanicId: mechIdFromExp,
          mechanicName: mechName,
          repairShopName: shopName,
          date: toJalaliDate(exp.expenseDate),
          categoryType: isCreditEntry ? 'repair' : 'payment',
          categoryLabel: isCreditEntry ? 'فاکتور خدمات تعمیرگاه' : 'پرداخت / تسویه حساب',
          title: exp.description || (isCreditEntry ? 'فاکتور خدمات تعمیرگاه' : 'پرداخت وجه فاکتور به تعمیرکار'),
          description: `سند ${isCreditEntry ? 'بستانکاری' : 'پرداخت'} وجه بابت دستمزد و تعمیرات ${exp.paymentMethod ? `(روش: ${exp.paymentMethod})` : ''} ${exp.referenceNumber ? `[کد رهگیری: ${exp.referenceNumber}]` : ''}`,
          vehicleId: vehicle?.id,
          vehicleName: vehicle?.name,
          vehiclePlaque: vehicle?.plaque,
          wages: isCreditEntry ? costNum : 0,
          shopPartsCost: 0,
          creditAmount: creditVal,
          debitAmount: debitVal,
          status: 'settled',
          reference: exp.documentNumber || exp.referenceNumber || `سند مالی #${exp.id}`,
          rawItem: { expense: exp, vehicle }
        });
      }
    });

    return items.map(item => {
      if (overrides[item.id]) {
        return {
          ...item,
          ...overrides[item.id]
        };
      }
      return item;
    });
  }, [workflows, failures, services, expenses, mechanics, vehicles, overrides]);

  // تجمیع آمار کلی تمام تعمیرکاران جهت جستجوی پیش‌بینانه و نمایش بدهی/طلب
  const mechanicsWithStats = useMemo(() => {
    return allMechanicsList.map(mech => {
      // تطابق آیتم‌ها با شناسه یا نام تعمیرکار/تعمیرگاه
      const mechItems = allMechanicStatementItems.filter(item => {
        if (item.mechanicId && item.mechanicId === mech.id) return true;
        if (mech.name && item.mechanicName && item.mechanicName.toLowerCase().includes(mech.name.toLowerCase())) return true;
        if (mech.shopName && item.repairShopName && item.repairShopName.toLowerCase().includes(mech.shopName.toLowerCase())) return true;
        return false;
      });

      const totalCredit = mechItems.reduce((sum, it) => sum + it.creditAmount, 0);
      const totalDebit = mechItems.reduce((sum, it) => sum + it.debitAmount, 0);
      const balance = totalCredit - totalDebit; // طلبکار از ما

      return {
        mechanic: mech,
        itemsCount: mechItems.length,
        totalCredit,
        totalDebit,
        balance
      };
    });
  }, [allMechanicsList, allMechanicStatementItems]);

  // تعمیرکار فعال انتخاب‌شده
  const activeMechanic = useMemo(() => {
    if (!selectedMechanicKey) return null;
    return allMechanicsList.find(m => m.key === selectedMechanicKey) || null;
  }, [selectedMechanicKey, allMechanicsList]);

  // نتایج فیلتر جستجوی تعمیرکار
  const matchedMechanicsWithStats = useMemo(() => {
    if (!searchTerm.trim()) return mechanicsWithStats;
    const q = searchTerm.trim().toLowerCase();
    return mechanicsWithStats.filter(({ mechanic: m }) =>
      m.name.toLowerCase().includes(q) ||
      m.shopName.toLowerCase().includes(q) ||
      m.phone.includes(q) ||
      m.specialty.toLowerCase().includes(q)
    );
  }, [mechanicsWithStats, searchTerm]);

  // استخراج ارزش سلول برای فیلتر ستونی اکسل
  const getColumnItemValue = (item: MechanicStatementItem, colKey: string): string => {
    switch (colKey) {
      case 'date':
        return item.date;
      case 'categoryLabel':
        return item.categoryLabel;
      case 'description':
        return item.description || (item.categoryType === 'payment' ? 'بابت تسویه حساب و پرداخت دستمزد' : `خدمات و قطعات خودرو ${item.vehicleName || ''}`);
      case 'vehicle':
        return item.vehicleName ? `${item.vehicleName} (${item.vehiclePlaque || ''})` : 'نامشخص';
      case 'title':
        return item.title;
      case 'quantity':
        return item.categoryType === 'payment' ? '۰' : '۱';
      case 'unitPrice':
        return `${formatPrice(item.categoryType === 'payment' ? 0 : item.creditAmount)} ریال`;
      case 'wages':
        return `${formatPrice(item.wages)} ریال`;
      case 'creditAmount':
        return `${formatPrice(item.creditAmount)} ریال`;
      case 'debitAmount':
        return `${formatPrice(item.debitAmount)} ریال`;
      case 'runningBalance':
        return `${formatPrice(item.runningBalance ?? 0)} ریال`;
      case 'status':
        return item.status === 'completed' ? 'تکمیل شده' : (item.status === 'in_repair' ? 'در حال تعمیر' : 'تسویه شده');
      default:
        return (item as any)[colKey] || '';
    }
  };

  const handleHeaderContextMenu = (e: React.MouseEvent, colKey: string, colTitle: string) => {
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

  // فیلتر اقلام تعمیرکار انتخاب‌شده
  const filteredStatementItems = useMemo(() => {
    if (!activeMechanic) return [];

    const startComp = normalizeToComparableJalali(startDate);
    const endComp = normalizeToComparableJalali(endDate);

    return allMechanicStatementItems.filter(item => {
      // تطابق با تعمیرکار
      const matchesMech = (item.mechanicId && item.mechanicId === activeMechanic.id) ||
        (activeMechanic.name && item.mechanicName && item.mechanicName.toLowerCase().includes(activeMechanic.name.toLowerCase())) ||
        (activeMechanic.shopName && item.repairShopName && item.repairShopName.toLowerCase().includes(activeMechanic.shopName.toLowerCase()));

      if (!matchesMech) return false;

      // فیلتر دسته‌بندی
      if (selectedCategory !== 'all' && item.categoryType !== selectedCategory) {
        return false;
      }

      // فیلتر تاریخ
      const itemComp = normalizeToComparableJalali(item.date);
      if (startComp && itemComp && itemComp < startComp) return false;
      if (endComp && itemComp && itemComp > endComp) return false;

      // اعمال فیلتر ستون‌ها
      for (const [colKey, allowedValues] of Object.entries(columnFilters)) {
        if (allowedValues && Array.isArray(allowedValues)) {
          const itemVal = getColumnItemValue(item, colKey);
          if (!allowedValues.includes(itemVal)) return false;
        }
      }

      return true;
    });
  }, [allMechanicStatementItems, activeMechanic, selectedCategory, startDate, endDate, columnFilters]);

  const currentMenuUniqueValues = useMemo(() => {
    if (!filterMenu) return [];
    const valMap = new Map<string, number>();
    filteredStatementItems.forEach(item => {
      const val = getColumnItemValue(item, filterMenu.colKey);
      valMap.set(val, (valMap.get(val) || 0) + 1);
    });
    return Array.from(valMap.entries()).map(([value, count]) => ({ value, count }));
  }, [filterMenu, filteredStatementItems]);

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

  // محاسبه مانده تجمعی کاردکس به ترتیب زمانی (مانده = مانده قبلی + بدهکار - بستانکار)
  const itemsWithRunningBalance = useMemo(() => {
    const chrono = [...filteredStatementItems].sort((a, b) => {
      const compA = normalizeToComparableJalali(a.date);
      const compB = normalizeToComparableJalali(b.date);
      return compA.localeCompare(compB);
    });

    let running = 0;
    const balanceMap = new Map<string, number>();
    for (const item of chrono) {
      const debit = item.creditAmount || 0;  // بدهکار (طلب تعمیرکار / خدمات)
      const credit = item.debitAmount || 0; // بستانکار (پرداختی / تسویه)
      running += (debit - credit);
      balanceMap.set(item.id, running);
    }

    return filteredStatementItems.map(item => ({
      ...item,
      runningBalance: balanceMap.get(item.id) ?? 0
    }));
  }, [filteredStatementItems]);

  // مرتب‌سازی
  const sortedStatementItems = useMemo(() => {
    return sortData(itemsWithRunningBalance, sortKey, sortDirection);
  }, [itemsWithRunningBalance, sortKey, sortDirection]);

  // صفحه‌بندی
  const totalPages = Math.ceil(sortedStatementItems.length / pageSize) || 1;
  const paginatedStatementItems = useMemo(() => {
    return sortedStatementItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [sortedStatementItems, currentPage, pageSize]);

  // ارقام شاخص‌های مالی تعمیرکار
  const totals = useMemo(() => {
    if (!activeMechanic) {
      return { totalCredit: 0, totalWages: 0, totalShopParts: 0, totalDebit: 0, balance: 0, count: 0 };
    }

    const startComp = normalizeToComparableJalali(startDate);
    const endComp = normalizeToComparableJalali(endDate);

    const mechItems = allMechanicStatementItems.filter(item => {
      const matches = (item.mechanicId && item.mechanicId === activeMechanic.id) ||
        (activeMechanic.name && item.mechanicName && item.mechanicName.toLowerCase().includes(activeMechanic.name.toLowerCase())) ||
        (activeMechanic.shopName && item.repairShopName && item.repairShopName.toLowerCase().includes(activeMechanic.shopName.toLowerCase()));
      if (!matches) return false;

      if (startComp || endComp) {
        const itemComp = normalizeToComparableJalali(item.date);
        if (startComp && itemComp && itemComp < startComp) return false;
        if (endComp && itemComp && itemComp > endComp) return false;
      }
      return true;
    });

    const totalCredit = mechItems.reduce((acc, it) => acc + it.creditAmount, 0);
    const totalWages = mechItems.reduce((acc, it) => acc + it.wages, 0);
    const totalShopParts = mechItems.reduce((acc, it) => acc + it.shopPartsCost, 0);
    const totalDebit = mechItems.reduce((acc, it) => acc + it.debitAmount, 0);
    const balance = totalCredit - totalDebit;

    return {
      totalCredit,
      totalWages,
      totalShopParts,
      totalDebit,
      balance,
      count: mechItems.length
    };
  }, [allMechanicStatementItems, activeMechanic, startDate, endDate]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const handleSelectMechanic = (key: string) => {
    setSelectedMechanicKey(key);
    setColumnFilters({});
    setFilterMenu(null);
    setIsSearchOpen(false);
    setSearchTerm('');
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSelectedMechanicKey('');
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setSelectedCategory('all');
    setColumnFilters({});
    setFilterMenu(null);
    setCurrentPage(1);
  };

  // ثبت پرداخت به تعمیرکار
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMechanic) return;
    const amount = parsePersianNumber(paymentAmount);
    if (!amount || amount <= 0) {
      alert('لطفاً مبلغ پرداختی معتبر وارد فرمایید.');
      return;
    }

    try {
      setIsSubmittingPayment(true);
      if (onAddExpense) {
        await onAddExpense({
          vehicleId: vehicles[0]?.id || 1,
          partyType: 'mechanic',
          mechanicId: activeMechanic.id < 9000 ? activeMechanic.id : undefined,
          repairShopName: activeMechanic.shopName,
          expenseType: 'repair',
          cost: amount,
          expenseDate: paymentDate || getCurrentJalaliDate(),
          description: `پرداخت وجه به تعمیرکار ${activeMechanic.name} (${activeMechanic.shopName}) ${paymentDescription ? `- ${paymentDescription}` : ''}`,
          paymentMethod,
          referenceNumber: paymentReference.trim()
        });
      }
      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentDescription('');
      setPaymentReference('');
      alert('سند پرداخت و تسویه حساب با موفقیت ثبت گردید.');
    } catch (err) {
      console.error('Payment save error:', err);
      alert('خطا در ثبت سند پرداخت.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleExportExcel = () => {
    if (!sortedStatementItems.length) {
      alert('هیچ رکوردی برای خروجی اکسل یافت نشد.');
      return;
    }

    const sanitize = (val: any) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      'ردیف',
      'تاریخ',
      'ملاحظات',
      'نام خدمت',
      'مقدار',
      'قیمت واحد (ریال)',
      'بدهکار (ریال)',
      'بستانکار (ریال)',
      'مانده (ریال)'
    ];

    const rows = sortedStatementItems.map((item, idx) => [
      idx + 1,
      item.date,
      item.description || (item.categoryType === 'payment' ? 'بابت تسویه حساب و پرداخت دستمزد' : `خدمات خودرو ${item.vehicleName || ''} [پلاک: ${item.vehiclePlaque || ''}]`),
      item.categoryType === 'payment' ? '۰' : (item.title || 'خدمات تعمیرگاه'),
      item.categoryType === 'payment' ? 0 : 1,
      item.categoryType === 'payment' ? 0 : (item.creditAmount || 0),
      item.creditAmount || 0,
      item.debitAmount || 0,
      item.runningBalance || 0
    ]);

    const csvContent = '\uFEFF' + [
      headers.map(sanitize).join(','),
      ...rows.map(row => row.map(sanitize).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const mechName = activeMechanic ? `_${activeMechanic.name.replace(/\s+/g, '_')}` : '';
    const todayDate = getCurrentJalaliDate().replace(/\//g, '-');
    link.setAttribute('download', `صورتحساب_مالی_تعمیرکار${mechName}_${todayDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!activeMechanic) {
      alert('لطفاً ابتدا یک تعمیرکار یا تعمیرگاه را انتخاب فرمایید.');
      return;
    }
    window.print();
  };

  return (
    <div className="space-y-4">
      
      {/* نوار جستجو و انتخاب تعمیرکار و فیلترهای تاریخ */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center relative z-30">
        <div ref={searchContainerRef} className="relative flex-1">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input 
              type="text" 
              placeholder={activeMechanic ? `تعمیرکار انتخاب‌شده: ${activeMechanic.name} (${activeMechanic.shopName})` : "جستجو و انتخاب نام تعمیرکار یا تعمیرگاه..."} 
              value={activeMechanic && !searchTerm ? activeMechanic.name : searchTerm}
              onFocus={() => setIsSearchOpen(true)}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (activeMechanic) setSelectedMechanicKey('');
                setIsSearchOpen(true);
              }}
              className={`w-full h-[34px] bg-white dark:bg-[#111113] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg pr-9 pl-8 py-0 text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs ${
                activeMechanic ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20' : 'border-slate-300 dark:border-[#2d2d30]'
              }`}
            />
            {(searchTerm || activeMechanic) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="پاک کردن انتخاب"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* لیست پیشنهادات جستجوی تعمیرکاران (ساده، خلوت و سریع مشابه بخش پذیرش) */}
          {isSearchOpen && (
            <div className="absolute top-full right-0 left-0 mt-1.5 bg-white dark:bg-[#151518] rounded-xl border border-slate-200 dark:border-[#2d2d30] shadow-2xl overflow-hidden max-h-72 overflow-y-auto z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 bg-slate-50 dark:bg-[#1a1a1e] border-b border-slate-200 dark:border-[#2d2d30] flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                <span>{searchTerm.trim() ? `تعمیرکاران منطبق با «${searchTerm}»` : 'لیست تعمیرکاران (جهت انتخاب کلیک کنید)'}</span>
                <span>{toPersianDigits(matchedMechanicsWithStats.length)} مورد</span>
              </div>

              {matchedMechanicsWithStats.length === 0 ? (
                <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-xs font-bold space-y-1">
                  <p>هیچ تعمیرکاری با مشخصات «{searchTerm}» یافت نشد.</p>
                  <p className="text-[10px] text-slate-400 font-normal">لطفاً املای نام تعمیرکار را بررسی کنید یا حروف دیگری را وارد نمایید.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-[#242428]">
                  {matchedMechanicsWithStats.map(({ mechanic: m }) => {
                    const isSelected = selectedMechanicKey === m.key;

                    return (
                      <div
                        key={m.key}
                        onClick={() => handleSelectMechanic(m.key)}
                        className={`px-3 py-1.5 transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected 
                            ? 'bg-indigo-50 dark:bg-indigo-950/40' 
                            : 'hover:bg-slate-50 dark:hover:bg-[#1c1c20]'
                        }`}
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {m.name}
                          </span>
                          {m.shopName && (
                            <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-bold truncate max-w-[130px]">
                              {m.shopName}
                            </span>
                          )}
                        </div>

                        <div className="shrink-0 text-left flex items-center gap-1.5">
                          {m.specialty && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                              {m.specialty}
                            </span>
                          )}
                          {m.phone && (
                            <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#1a1a1e] px-2 py-0.5 rounded border border-slate-200 dark:border-[#2d2d30]">
                              {toPersianDigits(m.phone)}
                            </span>
                          )}
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
            inputClassName="h-[34px] text-[11px]"
          />
        </div>

        {/* فیلتر تا تاریخ */}
        <div className="w-full sm:w-36">
          <JalaliDatePicker
            value={endDate}
            onChange={setEndDate}
            placeholder="تا تاریخ"
            inputClassName="h-[34px] text-[11px]"
          />
        </div>

        {/* دکمه‌های خروجی اکسل و چاپ صورتحساب (آیکونی، مشابه بخش پایش و استعلام) */}
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
            disabled={!activeMechanic}
            className={`h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg border transition-all cursor-pointer shadow-2xs shrink-0 group ${
              activeMechanic
                ? 'bg-white dark:bg-[#111113] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border-slate-300 dark:border-[#2d2d30] hover:border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'bg-slate-50 dark:bg-[#151518] text-slate-400 dark:text-slate-600 border-slate-200 dark:border-[#2d2d30] opacity-60 cursor-not-allowed'
            }`}
            title={activeMechanic ? 'چاپ صورتحساب رسمی این تعمیرکار' : 'ابتدا یک تعمیرکار را انتخاب کنید'}
          >
            <Printer className="w-4 h-4 transition-transform group-hover:scale-110" />
          </button>
        </div>
      </div>

      {/* ۳. در صورت عدم انتخاب تعمیرکار: راهنمای جستجو */}
      {!activeMechanic ? (
        <div className="bg-white dark:bg-[#111113] rounded-2xl border border-slate-200 dark:border-[#2d2d30] p-8 sm:p-12 text-center shadow-xs animate-in fade-in duration-300">
          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              جستجو و مشاهده حساب مالی و کارکرد تعمیرکاران
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              برای مشاهده کاردکس مالی، ریز اجرت‌ها، قطعات تأمین‌شده توسط تعمیرگاه، تسویه‌حساب‌ها و مانده مطالبات هر تعمیرکار پیش ما، نام او را در کادر بالا انتخاب فرمایید.
            </p>
          </div>
        </div>
      ) : (
        /* ۴. اگر تعمیرکار انتخاب شده باشد: نمایش مستقیم صورتحساب و کاردکس مالی دقیقاً مطابق ساختار خودروها */
        <div className="space-y-4 animate-in fade-in duration-300">

          {/* جدول ریز فاکتورها و کاردکس اسناد مالی تعمیرکار با استایل پذیرش خودرو */}
          <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex justify-between items-center">
              <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
                <List className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>ریز اسناد و صورتحساب مالی: {activeMechanic.name}</span>
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
                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                  <Receipt className="w-3 h-3" />
                  بدهکار کل: {formatPrice(totals.totalDebit)}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  بستانکار کل: {formatPrice(totals.totalCredit)}
                </span>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
                  <Scale className="w-3 h-3" />
                  {totals.balance >= 0 ? `مانده طلب: ${formatPrice(totals.balance)}` : `بستانکار ما: ${formatPrice(Math.abs(totals.balance))}`}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  {toPersianDigits(sortedStatementItems.length)} مورد
                </span>
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[580px]">
              <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-[#161618]">
                  <tr className="border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-medium text-xs">
                    <th className="py-2 px-3 text-center w-12 text-xs font-medium">ردیف</th>
                    
                    {/* ۱. تاریخ */}
                    <TableColumnHeader
                      title="تاریخ"
                      colKey="date"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      isFiltered={!!columnFilters['date']}
                      onOpenFilter={handleHeaderContextMenu}
                      align="center"
                      className="font-medium text-xs text-slate-600 dark:text-slate-400"
                      width="115px"
                    />

                    {/* ۲. ملاحظات */}
                    <TableColumnHeader
                      title="ملاحظات"
                      colKey="description"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      isFiltered={!!columnFilters['description']}
                      onOpenFilter={handleHeaderContextMenu}
                      align="right"
                      className="font-medium text-xs text-slate-600 dark:text-slate-400"
                    />

                    {/* ۳. نام خدمت */}
                    <TableColumnHeader
                      title="نام خدمت"
                      colKey="title"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      isFiltered={!!columnFilters['title']}
                      onOpenFilter={handleHeaderContextMenu}
                      align="right"
                      className="font-medium text-xs text-slate-600 dark:text-slate-400"
                      width="170px"
                    />

                    {/* ۴. مقدار */}
                    <TableColumnHeader
                      title="مقدار"
                      colKey="quantity"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      isFiltered={!!columnFilters['quantity']}
                      onOpenFilter={handleHeaderContextMenu}
                      align="center"
                      className="font-medium text-xs text-slate-600 dark:text-slate-400"
                      width="75px"
                    />

                    {/* ۵. قیمت واحد */}
                    <TableColumnHeader
                      title="قیمت واحد"
                      colKey="unitPrice"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      isFiltered={!!columnFilters['unitPrice']}
                      onOpenFilter={handleHeaderContextMenu}
                      align="center"
                      className="font-medium text-xs text-slate-600 dark:text-slate-400"
                      width="120px"
                    />

                    {/* ۶. بدهکار */}
                    <TableColumnHeader
                      title="بدهکار"
                      colKey="creditAmount"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      isFiltered={!!columnFilters['creditAmount']}
                      onOpenFilter={handleHeaderContextMenu}
                      align="center"
                      className="font-medium text-xs text-slate-600 dark:text-slate-400"
                      width="120px"
                    />

                    {/* ۷. بستانکار */}
                    <TableColumnHeader
                      title="بستانکار"
                      colKey="debitAmount"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      isFiltered={!!columnFilters['debitAmount']}
                      onOpenFilter={handleHeaderContextMenu}
                      align="center"
                      className="font-medium text-xs text-slate-600 dark:text-slate-400"
                      width="110px"
                    />

                    {/* ۸. مانده */}
                    <TableColumnHeader
                      title="مانده"
                      colKey="runningBalance"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      isFiltered={!!columnFilters['runningBalance']}
                      onOpenFilter={handleHeaderContextMenu}
                      align="center"
                      className="font-medium text-xs text-slate-600 dark:text-slate-400"
                      width="130px"
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-[#2d2d30]/60">
                  {sortedStatementItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500 text-[11px]">
                        هیچ سند یا سابقه مالی در این بازه برای این تعمیرکار یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    sortedStatementItems.map((item, idx) => {
                      const balanceVal = item.runningBalance ?? 0;
                      return (
                        <tr 
                          key={item.id} 
                          className="h-9 hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/60 transition-colors text-[11px]"
                        >
                          {/* ردیف */}
                          <td className="py-1 px-3 text-center text-slate-500 dark:text-slate-400 text-[11px] align-middle">
                            {toPersianDigits(idx + 1)}
                          </td>

                          {/* ۱. تاریخ */}
                          <td className="py-1 px-3 text-center text-slate-600 dark:text-slate-300 text-[11px] whitespace-nowrap align-middle">
                            {toPersianDigits(item.date)}
                          </td>

                          {/* ۲. ملاحظات */}
                          <td className="py-1 px-3 text-right text-slate-800 dark:text-slate-200 text-[11px] align-middle">
                            <div className="truncate max-w-xs md:max-w-md">
                              {item.description || (item.categoryType === 'payment' ? 'بابت تسویه حساب و پرداخت دستمزد' : `خدمات و قطعات خودرو ${item.vehicleName || ''}`)}
                              {item.vehiclePlaque ? ` [پلاک: ${toPersianDigits(item.vehiclePlaque)}]` : ''}
                              {item.reference ? ` (رسید: ${toPersianDigits(item.reference)})` : ''}
                            </div>
                          </td>

                          {/* ۳. نام خدمت */}
                          <td className="py-1 px-3 text-right text-slate-800 dark:text-slate-200 text-[11px] whitespace-nowrap align-middle">
                            {item.categoryType === 'payment' ? 'سند تسویه حساب' : (item.title || 'خدمات و اجرت تعمیرات')}
                          </td>

                          {/* ۴. مقدار */}
                          <td className="py-1 px-3 text-center text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap align-middle">
                            {item.categoryType === 'payment' ? (
                              <span>-</span>
                            ) : (
                              <span>{toPersianDigits(1)}</span>
                            )}
                          </td>

                          {/* ۵. قیمت واحد */}
                          <td className="py-1 px-3 text-center text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap align-middle">
                            {item.categoryType === 'payment' ? '-' : (item.creditAmount ? formatPrice(item.creditAmount) : '۰')}
                          </td>

                          {/* ۶. بدهکار */}
                          <td className="py-1 px-3 text-center text-slate-800 dark:text-slate-200 text-[11px] whitespace-nowrap align-middle">
                            {item.creditAmount > 0 ? formatPrice(item.creditAmount) : '۰'}
                          </td>

                          {/* ۷. بستانکار */}
                          <td className="py-1 px-3 text-center text-slate-800 dark:text-slate-200 text-[11px] whitespace-nowrap align-middle">
                            {item.debitAmount > 0 ? formatPrice(item.debitAmount) : '۰'}
                          </td>

                          {/* ۸. مانده */}
                          <td className="py-1 px-3 text-center text-slate-800 dark:text-slate-200 text-[11px] whitespace-nowrap align-middle">
                            <span dir="ltr">
                              {balanceVal < 0 
                                ? `- ${formatPrice(Math.abs(balanceVal))}` 
                                : formatPrice(balanceVal)}
                            </span>
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

      {/* مودال ثبت پرداخت / تسویه حساب به تعمیرکار (سبک استاندارد و ست با مودال پذیرش) */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* هدر مدال هماهنگ با پذیرش */}
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <span>ثبت سند پرداخت و تسویه حساب تعمیرکار</span>
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                    ثبت خروجی وجه نقد، حواله یا چک جهت تسویه اجرت و فاکتورهای تعمیرگاه
                  </p>
                </div>
              </div>
              <button
                onClick={handleClosePaymentModal}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                title="بستن"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="flex-1 flex flex-col justify-between overflow-hidden">
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
                {activeMechanic && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/50 dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-200 dark:border-amber-500/20">
                    <div>
                      <span className="text-slate-500 text-[11px] block mb-0.5">تعمیرکار طرف حساب:</span>
                      <strong className="text-slate-900 dark:text-white font-bold text-xs">{activeMechanic.name} ({activeMechanic.shopName})</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[11px] block mb-0.5">مانده طلب فعلی:</span>
                      <strong className="font-mono text-amber-600 dark:text-amber-400 font-extrabold text-xs">{formatPrice(totals.balance)} ریال</strong>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      تعمیرکار / تعمیرگاه طرف حساب <span className="text-rose-500">*</span>
                    </label>
                    <CustomSelect
                      value={selectedMechanicKey}
                      onChange={(val) => setSelectedMechanicKey(String(val))}
                      searchable={true}
                      quickAddType="mechanic"
                      placeholder="انتخاب یا جستجوی تعمیرکار..."
                      options={allMechanicsList.map(m => ({
                        value: m.key,
                        label: `${m.name} (${m.shopName}) - ${m.specialty}`
                      }))}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      مبلغ پرداختی (ریال) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: ۵,۰۰۰,۰۰۰"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full h-[38px] px-3 border border-slate-300 dark:border-[#2d2d30] rounded-lg bg-white dark:bg-[#1a1a1c] font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      تاریخ پرداخت <span className="text-rose-500">*</span>
                    </label>
                    <JalaliDatePicker
                      value={paymentDate}
                      onChange={setPaymentDate}
                      placeholder="انتخاب تاریخ"
                      inputClassName="h-[38px] text-xs font-bold rounded-lg"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      روش پرداخت <span className="text-rose-500">*</span>
                    </label>
                    <CustomSelect
                      value={paymentMethod}
                      onChange={setPaymentMethod}
                      options={[
                        { value: 'bank_transfer', label: 'حواله بانکی / پایا / ساتنا' },
                        { value: 'cheque', label: 'چک بانکی صیادی' },
                        { value: 'cash', label: 'نقدی' },
                        { value: 'card_to_card', label: 'کارت به کارت' }
                      ]}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    شماره پیگیری / شماره چک / مرجع پرداخت
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: کد رهگیری بانکی یا شماره صیادی چک"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="w-full h-[38px] px-3 border border-slate-300 dark:border-[#2d2d30] rounded-lg bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    توضیحات و بابت پرداخت
                  </label>
                  <textarea
                    rows={3}
                    placeholder="مثلاً: تسویه اجرت فاکتور شماره ۱۲ بابت تعمیر گیربکس"
                    value={paymentDescription}
                    onChange={(e) => setPaymentDescription(e.target.value)}
                    className="w-full p-3 border border-slate-300 dark:border-[#2d2d30] rounded-xl bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* فوتر مدال هماهنگ با پذیرش */}
              <div className="p-4 border-t border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] flex justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleClosePaymentModal}
                  className="px-4 py-2 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-300 font-bold rounded-lg transition-colors border border-slate-200 dark:border-[#2d2d30] text-xs cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50 text-xs shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmittingPayment ? 'در حال ثبت...' : 'ثبت پرداخت'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* مودال ویرایش سند مالی تعمیرکار (سبک استاندارد و ست با مودال پذیرش) */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* هدر مدال هماهنگ با پذیرش */}
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <span>ویرایش سند مالی تعمیرکار</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded border bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30">
                      {editingItem.categoryLabel}
                    </span>
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-mono">
                    تعمیرکار: {editingItem.mechanicName} ({editingItem.repairShopName}) | شناسه: {editingItem.reference || editingItem.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                title="بستن"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex-1 flex flex-col justify-between overflow-hidden">
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      تاریخ سند / فاکتور <span className="text-rose-500">*</span>
                    </label>
                    <JalaliDatePicker
                      value={editDate}
                      onChange={setEditDate}
                      placeholder="انتخاب تاریخ"
                      inputClassName="h-[38px] text-xs font-bold rounded-lg"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      شرح سند / عنوان خدمت <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full h-[38px] px-3 border border-slate-300 dark:border-[#2d2d30] rounded-lg bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white font-bold text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                      required
                    />
                  </div>
                </div>

                {editingItem.categoryType !== 'payment' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        اجرت دستمزد (ریال)
                      </label>
                      <input
                        type="text"
                        value={editWages}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditWages(val);
                          const w = parsePersianNumber(val) || 0;
                          const p = parsePersianNumber(editShopPartsCost) || 0;
                          setEditCreditAmount(String(w + p));
                        }}
                        className="w-full h-[38px] px-3 border border-slate-300 dark:border-[#2d2d30] rounded-lg bg-white dark:bg-[#1a1a1c] font-mono font-bold text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        هزینه قطعات تعمیرگاه (ریال)
                      </label>
                      <input
                        type="text"
                        value={editShopPartsCost}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditShopPartsCost(val);
                          const p = parsePersianNumber(val) || 0;
                          const w = parsePersianNumber(editWages) || 0;
                          setEditCreditAmount(String(w + p));
                        }}
                        className="w-full h-[38px] px-3 border border-slate-300 dark:border-[#2d2d30] rounded-lg bg-white dark:bg-[#1a1a1c] font-mono font-bold text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        کل طلب - بستانکاری (ریال)
                      </label>
                      <input
                        type="text"
                        value={editCreditAmount}
                        onChange={(e) => setEditCreditAmount(e.target.value)}
                        className="w-full h-[38px] px-3 border border-slate-300 dark:border-[#2d2d30] rounded-lg bg-white dark:bg-[#1a1a1c] font-mono font-black text-amber-600 dark:text-amber-400 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        مبلغ پرداختی - بدهکاری (ریال) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editDebitAmount}
                        onChange={(e) => setEditDebitAmount(e.target.value)}
                        className="w-full h-[38px] px-3 border border-slate-300 dark:border-[#2d2d30] rounded-lg bg-white dark:bg-[#1a1a1c] font-mono font-black text-emerald-600 dark:text-emerald-400 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    شماره مرجع / فاکتور / رسید
                  </label>
                  <input
                    type="text"
                    value={editReference}
                    onChange={(e) => setEditReference(e.target.value)}
                    className="w-full h-[38px] px-3 border border-slate-300 dark:border-[#2d2d30] rounded-lg bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    شرح و ملاحظات
                  </label>
                  <textarea
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full p-3 border border-slate-300 dark:border-[#2d2d30] rounded-xl bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* فوتر مدال هماهنگ با پذیرش */}
              <div className="p-4 border-t border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] flex justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-300 font-bold rounded-lg transition-colors border border-slate-200 dark:border-[#2d2d30] text-xs cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50 text-xs shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingEdit ? 'در حال ذخیره...' : 'ذخیره تغییرات'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* منوی شناور فیلتر ستونی هماهنگ با اکسل */}
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
    </div>
  );
};
