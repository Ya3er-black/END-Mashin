/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Store, Search, Printer, Plus, X, ArrowUpDown, ArrowUp, ArrowDown, Eye,
  RotateCcw, FileSpreadsheet, ChevronRight, CheckSquare, Square,
  Building, Phone, CreditCard, Coins, CheckCircle2, AlertCircle, Clock,
  Calendar, Layers, Truck, FileText, Package, ShoppingCart, List, Receipt, CheckCircle, Edit3, Check, Scale
} from 'lucide-react';
import { Supplier, InventoryTransaction, PeriodicService, Vehicle, Expense, PartInventory } from '../types';
import { formatPrice, toPersianDigits, parsePersianNumber } from '../utils/numberUtils';
import { getCurrentJalaliDate, toJalaliDate, persianToEnglishDigits } from '../utils/date';
import { sortData, SortDirection } from '../utils/sortUtils';
import { CustomSelect } from './CustomSelect';
import { JalaliDatePicker } from './JalaliDatePicker';
import { Pagination } from './Pagination';
import { TableColumnHeader, ColumnFilterMenu, FilterMenuState } from './TableFilterSort';

export type SupplierCategoryFilter = 'all' | 'stock_in' | 'direct_purchase' | 'payment';

export interface SupplierStatementItem {
  id: string;
  sourceId: number | string;
  supplierId?: number;
  supplierName: string;
  contactPerson?: string;
  categoryName?: string;
  date: string;
  categoryType: 'stock_in' | 'direct_purchase' | 'payment';
  categoryLabel: string;
  title: string;
  description: string;
  partName?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  creditAmount: number; // بستانکاری (طلب تامین‌کننده بابت فاکتور خرید)
  debitAmount: number;  // بدهکاری (پرداخت‌های انجام‌شده به تامین‌کننده)
  runningBalance?: number; // مانده تجمعی کاردکس
  reference?: string;   // شماره فاکتور یا کد پیگیری
  destination?: string; // انبار یا خودروی مقصد
  status: 'settled' | 'unpaid' | 'delivered';
  rawItem: any;
}

interface SupplierAccountingViewProps {
  suppliers: Supplier[];
  inventoryTransactions?: InventoryTransaction[];
  services?: PeriodicService[];
  vehicles?: Vehicle[];
  expenses?: Expense[];
  parts?: PartInventory[];
  onAddExpense?: (exp: Omit<Expense, 'id' | 'createdAt'>) => Promise<void> | void;
  isExternalPaymentModalOpen?: boolean;
  onClosePaymentModal?: () => void;
  selectedSupplierKey?: string;
  onSelectSupplierKey?: (key: string) => void;
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

export const SupplierAccountingView: React.FC<SupplierAccountingViewProps> = ({
  suppliers = [],
  inventoryTransactions = [],
  services = [],
  vehicles = [],
  expenses = [],
  parts = [],
  onAddExpense,
  isExternalPaymentModalOpen,
  onClosePaymentModal,
  selectedSupplierKey: propSelectedSupplierKey,
  onSelectSupplierKey
}) => {
  // انتخاب تامین‌کننده (همگام با والد و ماندگار در تغییر تب)
  const [internalSelectedSupplierKey, setInternalSelectedSupplierKey] = useState<string>('');
  const selectedSupplierKey = propSelectedSupplierKey !== undefined ? propSelectedSupplierKey : internalSelectedSupplierKey;
  const setSelectedSupplierKey = (key: string) => {
    setInternalSelectedSupplierKey(key);
    onSelectSupplierKey?.(key);
  };

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // فیلترهای تاریخ و دسته‌بندی
  const [selectedCategory, setSelectedCategory] = useState<SupplierCategoryFilter>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // مرتب‌سازی و صفحه‌بندی (پیش‌فرض از قدیمی‌ترین به جدیدترین برای نمایش توالی مانده)
  const [sortKey, setSortKey] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // فیلترهای سبک اکسل
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [filterMenu, setFilterMenu] = useState<{ x: number; y: number; colKey: string; colTitle: string } | null>(null);

  // مودال ویرایش سند تامین‌کننده (تمام‌صفحه)
  const [editingItem, setEditingItem] = useState<SupplierStatementItem | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editTitle, setEditTitle] = useState<string>('');
  const [editQuantity, setEditQuantity] = useState<string>('');
  const [editUnitPrice, setEditUnitPrice] = useState<string>('');
  const [editCreditAmount, setEditCreditAmount] = useState<string>('');
  const [editDebitAmount, setEditDebitAmount] = useState<string>('');
  const [editReference, setEditReference] = useState<string>('');
  const [editDestination, setEditDestination] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [overrides, setOverrides] = useState<Record<string, Partial<SupplierStatementItem>>>({});

  // باز کردن مودال ویرایش
  const handleOpenEditModal = (item: SupplierStatementItem) => {
    const merged = { ...item, ...(overrides[item.id] || {}) };
    setEditingItem(merged);
    setEditDate(merged.date || getCurrentJalaliDate());
    setEditTitle(merged.partName || merged.title || '');
    setEditQuantity(merged.quantity ? String(merged.quantity) : '1');
    setEditUnitPrice(merged.unitPrice ? formatPrice(Number(merged.unitPrice)) : '0');
    setEditCreditAmount(merged.creditAmount ? formatPrice(Number(merged.creditAmount)) : '0');
    setEditDebitAmount(merged.debitAmount ? formatPrice(Number(merged.debitAmount)) : '0');
    setEditReference(merged.reference || '');
    setEditDestination(merged.destination || 'انبار مرکزی قطعات');
    setEditDescription(merged.description || '');
  };

  // ذخیره فرم ویرایش سند
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsSavingEdit(true);
    try {
      const qty = parsePersianNumber(editQuantity) || 1;
      const unitP = parsePersianNumber(editUnitPrice) || 0;
      const credit = editingItem.categoryType === 'payment' 
        ? 0 
        : (parsePersianNumber(editCreditAmount) || (qty * unitP));
      const debit = editingItem.categoryType === 'payment' 
        ? (parsePersianNumber(editDebitAmount) || parsePersianNumber(editCreditAmount) || 0)
        : 0;

      const updatedPartial: Partial<SupplierStatementItem> = {
        date: editDate,
        title: editTitle,
        partName: editTitle,
        quantity: qty,
        unitPrice: unitP,
        creditAmount: credit,
        debitAmount: debit,
        reference: editReference,
        destination: editDestination,
        description: editDescription
      };

      setOverrides(prev => ({
        ...prev,
        [editingItem.id]: updatedPartial
      }));

      // ارسال درخواست به‌روزرسانی به سرور
      if (editingItem.categoryType === 'payment' && editingItem.sourceId) {
        await fetch(`/api/expenses/${editingItem.sourceId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cost: debit,
            description: editDescription || editTitle,
            referenceNumber: editReference
          })
        });
      } else if (editingItem.categoryType === 'stock_in' && editingItem.sourceId) {
        await fetch(`/api/inventory-transactions/${editingItem.sourceId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partName: editTitle,
            quantity: qty,
            unitPrice: unitP,
            totalPrice: credit,
            reference: editReference,
            notes: editDescription
          })
        });
      }

      setEditingItem(null);
    } catch (err) {
      console.error('Error saving edited supplier item:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // مودال مشاهده جزئیات سند
  const [detailModalItem, setDetailModalItem] = useState<SupplierStatementItem | null>(null);

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
      if (!selectedSupplierKey && suppliers.length > 0) {
        setSelectedSupplierKey(`sup_${suppliers[0].id}`);
      }
      setIsPaymentModalOpen(true);
    }
  }, [isExternalPaymentModalOpen, suppliers, selectedSupplierKey]);

  const handleClosePaymentModal = () => {
    setIsPaymentModalOpen(false);
    onClosePaymentModal?.();
  };

  // بستن منو با کلیک خارج از کادر
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

  // لیست یکپارچه تمامی تامین‌کنندگان کالا و قطعات
  const allSuppliersList = useMemo(() => {
    const list: Array<{ id: number; key: string; name: string; contactPerson: string; phone: string; category: string; address: string }> = [];
    const seenKeys = new Set<string>();

    suppliers.forEach(s => {
      const key = `sup_${s.id}`;
      seenKeys.add(key);
      list.push({
        id: s.id,
        key,
        name: s.name,
        contactPerson: s.contactPerson || 'مسئول فروش',
        phone: s.phone || 'ثبت نشده',
        category: s.category || 'قطعات و اقلام یدکی',
        address: s.address || 'تهران'
      });
    });

    // استخراج تامین‌کنندگانی که در تراکنش‌های انبار یا سرویس‌ها بودند ولی در لیست اولیه نبودند
    inventoryTransactions.forEach(tx => {
      if (tx.recipientOrSupplier && tx.type === 'in') {
        const name = tx.recipientOrSupplier.trim();
        const key = `dyn_${name}`;
        if (!seenKeys.has(key) && !suppliers.some(s => s.name === name)) {
          seenKeys.add(key);
          list.push({
            id: 8000 + list.length,
            key,
            name,
            contactPerson: 'واحد بازرگانی',
            phone: 'ثبت نشده',
            category: 'تامین اقلام و قطعات',
            address: 'ثبت در سامانه'
          });
        }
      }
    });

    services.forEach(srv => {
      const name = srv.supplierName?.trim();
      if (name && !srv.supplierId) {
        const key = `dyn_${name}`;
        if (!seenKeys.has(key) && !suppliers.some(s => s.name === name)) {
          seenKeys.add(key);
          list.push({
            id: 8000 + list.length,
            key,
            name,
            contactPerson: 'تامین‌کننده مستقیم قطعات',
            phone: 'ثبت در سرویس',
            category: 'قطعات و روانکارها',
            address: 'ثبت در فاکتور سرویس'
          });
        }
      }
    });

    expenses.forEach(exp => {
      const name = exp.supplierName?.trim();
      if (name && !exp.supplierId) {
        const key = `dyn_${name}`;
        if (!seenKeys.has(key) && !suppliers.some(s => s.name === name)) {
          seenKeys.add(key);
          list.push({
            id: 8000 + list.length,
            key,
            name,
            contactPerson: 'تامین‌کننده طرف قرارداد',
            phone: 'ثبت در اسناد',
            category: 'تامین و بازرگانی',
            address: 'ثبت در سند مالی'
          });
        }
      }
    });

    return list;
  }, [suppliers, inventoryTransactions, services, expenses]);

  // استخراج تمام اقلام کاردکس و صورتحساب برای تمامی تامین‌کنندگان
  const allSupplierStatementItems = useMemo(() => {
    const items: SupplierStatementItem[] = [];

    // ۱. رسیدهای ورود کالا به انبار (InventoryTransactions type === 'in')
    inventoryTransactions.forEach(tx => {
      if (tx.type === 'in' && tx.recipientOrSupplier) {
        const supplierName = tx.recipientOrSupplier.trim();
        const matchingSupplier = suppliers.find(s => s.name.trim() === supplierName);
        const total = Number(tx.totalPrice) || (Number(tx.quantity) * Number(tx.unitPrice)) || 0;
        const dateStr = tx.createdAt ? toJalaliDate(tx.createdAt) : '1405/01/01';

        items.push({
          id: `tx_${tx.id}`,
          sourceId: tx.id,
          supplierId: matchingSupplier?.id,
          supplierName,
          contactPerson: matchingSupplier?.contactPerson,
          categoryName: matchingSupplier?.category,
          date: dateStr,
          categoryType: 'stock_in',
          categoryLabel: 'رسید ورود به انبار',
          title: `خرید: ${tx.partName}`,
          description: `ورود ${formatPrice(tx.quantity)} عدد به نرخ واحد ${formatPrice(tx.unitPrice || 0)} ریال ${tx.notes ? `[${tx.notes}]` : ''}`,
          partName: tx.partName,
          quantity: tx.quantity,
          unitPrice: tx.unitPrice,
          totalPrice: total,
          creditAmount: total, // طلب تامین‌کننده بابت فاکتور
          debitAmount: 0,
          reference: tx.reference || `رسید انبار #${tx.id}`,
          destination: 'انبار مرکزی قطعات',
          status: 'delivered',
          rawItem: { transaction: tx, supplier: matchingSupplier }
        });
      }
    });

    // ۲. خریدهای مستقیم در سرویس‌های دوره‌ای (PeriodicServices با تامین‌کننده مستقیم)
    services.forEach(srv => {
      if (srv.supplierName || srv.supplierId || srv.partSource === 'supplier') {
        const matchingSupplier = srv.supplierId ? suppliers.find(s => s.id === srv.supplierId) : undefined;
        const supName = srv.supplierName || matchingSupplier?.name || 'تامین‌کننده قطعات';
        const vehicle = vehicles.find(v => v.id === srv.vehicleId);
        const costAmount = Number(srv.cost) || (Number(srv.quantity || 1) * Number(srv.unitPrice || 0)) || 0;

        if (costAmount > 0) {
          items.push({
            id: `srv_sup_${srv.id}`,
            sourceId: srv.id,
            supplierId: srv.supplierId,
            supplierName: supName,
            contactPerson: matchingSupplier?.contactPerson,
            categoryName: matchingSupplier?.category,
            date: toJalaliDate(srv.serviceDate),
            categoryType: 'direct_purchase',
            categoryLabel: 'خرید مستقیم سرویس ناوگان',
            title: `اقلام سرویس: ${srv.partName || srv.serviceType}`,
            description: `خرید مستقیم قطعه/روغن (${srv.partName || srv.serviceType}) برای خودروی ${vehicle?.name || srv.plaque || ''}`,
            partName: srv.partName || srv.serviceType,
            quantity: srv.quantity || 1,
            unitPrice: srv.unitPrice || costAmount,
            totalPrice: costAmount,
            creditAmount: costAmount,
            debitAmount: 0,
            reference: `فاکتور سرویس #${srv.id}`,
            destination: vehicle?.name || srv.plaque || 'ناوگان',
            status: 'delivered',
            rawItem: { service: srv, vehicle, supplier: matchingSupplier }
          });
        }
      }
    });

    // ۳. اسناد پرداخت وجه و تسویه حساب فاکتورها / اسناد دوبل تامین‌کننده (Expenses)
    expenses.forEach(exp => {
      const isSupplierDebit = exp.debitPartyType === 'supplier' || exp.partyType === 'supplier' || exp.supplierId || (exp.expenseType === 'payment' && exp.description?.includes('تامین'));
      const isSupplierCredit = exp.creditPartyType === 'supplier';
      const isSupplierPayment = isSupplierDebit || isSupplierCredit ||
        ((exp.expenseType === 'parts' || exp.expenseType === 'oil') && (exp.description?.includes('تسویه') || exp.description?.includes('پرداخت') || exp.description?.includes('فاکتور')));

      if (isSupplierPayment) {
        const supIdFromExp = exp.supplierId || (exp.debitPartyType === 'supplier' ? Number(exp.debitPartyId) : (exp.creditPartyType === 'supplier' ? Number(exp.creditPartyId) : undefined));
        const matchingSupplier = supIdFromExp ? suppliers.find(s => s.id === supIdFromExp) : undefined;
        const supName = exp.supplierName || matchingSupplier?.name || 'تامین‌کننده کالا و قطعات';
        const costNum = Number(exp.cost) || 0;

        const isCreditEntry = exp.creditPartyType === 'supplier' || (exp.entryType === 'credit' && !isSupplierDebit);
        const debitVal = isCreditEntry ? 0 : costNum;
        const creditVal = isCreditEntry ? costNum : 0;

        items.push({
          id: `exp_sup_${exp.id}`,
          sourceId: exp.id,
          supplierId: supIdFromExp,
          supplierName: supName,
          contactPerson: matchingSupplier?.contactPerson,
          categoryName: matchingSupplier?.category,
          date: toJalaliDate(exp.expenseDate),
          categoryType: isCreditEntry ? 'stock_in' : 'payment',
          categoryLabel: isCreditEntry ? 'فاکتور خرید کالا' : 'پرداخت / تسویه حساب',
          title: exp.description || (isCreditEntry ? 'فاکتور خرید از تامین‌کننده' : 'پرداخت وجه فاکتور تامین‌کننده'),
          description: `سند ${isCreditEntry ? 'بستانکاری' : 'پرداخت'} وجه بابت خرید قطعات و کالا ${exp.paymentMethod ? `(روش: ${exp.paymentMethod})` : ''} ${exp.referenceNumber ? `[کد پیگیری: ${exp.referenceNumber}]` : ''}`,
          creditAmount: creditVal,
          debitAmount: debitVal,
          reference: exp.documentNumber || exp.referenceNumber || `سند #${exp.id}`,
          destination: isCreditEntry ? 'انبار مرکزی' : 'امور مالی / خزانه',
          status: 'settled',
          rawItem: { expense: exp, supplier: matchingSupplier }
        });
      }
    });

    return items.map(item => overrides[item.id] ? { ...item, ...overrides[item.id] } : item);
  }, [inventoryTransactions, services, expenses, suppliers, vehicles, overrides]);

  // تجمیع آمار کلی تامین‌کنندگان
  const suppliersWithStats = useMemo(() => {
    return allSuppliersList.map(sup => {
      const supItems = allSupplierStatementItems.filter(item => {
        if (item.supplierId && item.supplierId === sup.id) return true;
        if (sup.name && item.supplierName && item.supplierName.toLowerCase().includes(sup.name.toLowerCase())) return true;
        return false;
      });

      const totalCredit = supItems.reduce((sum, it) => sum + it.creditAmount, 0);
      const totalDebit = supItems.reduce((sum, it) => sum + it.debitAmount, 0);
      const balance = totalCredit - totalDebit; // مانده طلب تامین‌کننده

      return {
        supplier: sup,
        itemsCount: supItems.length,
        totalCredit,
        totalDebit,
        balance
      };
    });
  }, [allSuppliersList, allSupplierStatementItems]);

  // تامین‌کننده فعال انتخاب‌شده
  const activeSupplier = useMemo(() => {
    if (!selectedSupplierKey) return null;
    return allSuppliersList.find(s => s.key === selectedSupplierKey) || null;
  }, [selectedSupplierKey, allSuppliersList]);

  // نتایج فیلتر جستجوی تامین‌کننده
  const matchedSuppliersWithStats = useMemo(() => {
    if (!searchTerm.trim()) return suppliersWithStats;
    const q = searchTerm.trim().toLowerCase();
    return suppliersWithStats.filter(({ supplier: s }) =>
      s.name.toLowerCase().includes(q) ||
      s.contactPerson.toLowerCase().includes(q) ||
      s.phone.includes(q) ||
      s.category.toLowerCase().includes(q)
    );
  }, [suppliersWithStats, searchTerm]);

  // استخراج ارزش سلول برای فیلتر ستونی اکسل
  const getColumnItemValue = (item: SupplierStatementItem, colKey: string): string => {
    switch (colKey) {
      case 'date':
        return item.date;
      case 'categoryLabel':
        return item.categoryLabel;
      case 'description':
        return item.description || (item.categoryType === 'payment' ? 'بابت تسویه و واریز به حساب تامین‌کننده' : `خرید کالا جهت تحویل به ${item.destination || 'انبار مرکزی'}`);
      case 'title':
        return item.title;
      case 'partName':
        return item.partName || '---';
      case 'quantity':
        return item.categoryType === 'payment' ? '۰' : toPersianDigits(item.quantity || 1);
      case 'unitPrice':
        return `${formatPrice(item.categoryType === 'payment' ? 0 : (item.unitPrice || item.totalPrice || item.creditAmount))} ریال`;
      case 'creditAmount':
        return `${formatPrice(item.creditAmount)} ریال`;
      case 'debitAmount':
        return `${formatPrice(item.debitAmount)} ریال`;
      case 'runningBalance':
        return `${formatPrice(item.runningBalance ?? 0)} ریال`;
      case 'destination':
        return item.destination || '---';
      case 'status':
        return item.status === 'settled' ? 'تسویه شده' : (item.status === 'delivered' ? 'تحویل‌شده' : 'معوقه');
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

  // فیلتر اقلام کاردکس تامین‌کننده
  const filteredStatementItems = useMemo(() => {
    if (!activeSupplier) return [];

    const startComp = normalizeToComparableJalali(startDate);
    const endComp = normalizeToComparableJalali(endDate);

    return allSupplierStatementItems.filter(item => {
      // تطابق با تامین‌کننده
      const matchesSup = (item.supplierId && item.supplierId === activeSupplier.id) ||
        (activeSupplier.name && item.supplierName && item.supplierName.toLowerCase().includes(activeSupplier.name.toLowerCase()));

      if (!matchesSup) return false;

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
  }, [allSupplierStatementItems, activeSupplier, selectedCategory, startDate, endDate, columnFilters]);

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
      const debit = item.creditAmount || 0;  // بدهکار (خرید / فاکتور)
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

  // ارقام شاخص‌های مالی تامین‌کننده
  const totals = useMemo(() => {
    if (!activeSupplier) {
      return { totalCredit: 0, totalDebit: 0, balance: 0, count: 0, lastDate: '---' };
    }

    const startComp = normalizeToComparableJalali(startDate);
    const endComp = normalizeToComparableJalali(endDate);

    const supItems = allSupplierStatementItems.filter(item => {
      const matches = (item.supplierId && item.supplierId === activeSupplier.id) ||
        (activeSupplier.name && item.supplierName && item.supplierName.toLowerCase().includes(activeSupplier.name.toLowerCase()));
      if (!matches) return false;

      if (startComp || endComp) {
        const itemComp = normalizeToComparableJalali(item.date);
        if (startComp && itemComp && itemComp < startComp) return false;
        if (endComp && itemComp && itemComp > endComp) return false;
      }
      return true;
    });

    const totalCredit = supItems.reduce((acc, it) => acc + it.creditAmount, 0);
    const totalDebit = supItems.reduce((acc, it) => acc + it.debitAmount, 0);
    const balance = totalCredit - totalDebit;

    // آخرین تاریخ خرید
    let lastDate = '---';
    if (supItems.length > 0) {
      const dates = supItems.map(i => i.date).filter(Boolean).sort();
      if (dates.length) lastDate = dates[dates.length - 1];
    }

    return {
      totalCredit,
      totalDebit,
      balance,
      count: supItems.length,
      lastDate
    };
  }, [allSupplierStatementItems, activeSupplier, startDate, endDate]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const handleSelectSupplier = (key: string) => {
    setSelectedSupplierKey(key);
    setColumnFilters({});
    setFilterMenu(null);
    setIsSearchOpen(false);
    setSearchTerm('');
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSelectedSupplierKey('');
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setSelectedCategory('all');
    setColumnFilters({});
    setFilterMenu(null);
    setCurrentPage(1);
  };

  // ثبت پرداخت به تامین‌کننده
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSupplier) return;
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
          partyType: 'supplier',
          supplierId: activeSupplier.id < 8000 ? activeSupplier.id : undefined,
          supplierName: activeSupplier.name,
          expenseType: 'parts',
          cost: amount,
          expenseDate: paymentDate || getCurrentJalaliDate(),
          description: `پرداخت وجه به تامین‌کننده ${activeSupplier.name} ${paymentDescription ? `- ${paymentDescription}` : ''}`,
          paymentMethod,
          referenceNumber: paymentReference.trim()
        });
      }
      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentDescription('');
      setPaymentReference('');
      alert('سند پرداخت و تسویه حساب فاکتور با موفقیت ثبت گردید.');
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
      'نام کالا',
      'مقدار',
      'قیمت واحد (ریال)',
      'بدهکار (ریال)',
      'بستانکار (ریال)',
      'مانده (ریال)'
    ];

    const rows = sortedStatementItems.map((item, idx) => [
      idx + 1,
      item.date,
      item.description || (item.categoryType === 'payment' ? 'بابت تسویه و واریز به حساب تامین‌کننده' : `خرید کالا جهت ${item.destination || 'انبار مرکزی'}`),
      item.categoryType === 'payment' ? '۰' : (item.partName || item.title || '۰'),
      item.categoryType === 'payment' ? 0 : (item.quantity || 0),
      item.categoryType === 'payment' ? 0 : (item.unitPrice || 0),
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
    const supName = activeSupplier ? `_${activeSupplier.name.replace(/\s+/g, '_')}` : '';
    const todayDate = getCurrentJalaliDate().replace(/\//g, '-');
    link.setAttribute('download', `صورتحساب_مالی_تامین‌کننده${supName}_${todayDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!activeSupplier) {
      alert('لطفاً ابتدا یک تامین‌کننده را انتخاب فرمایید.');
      return;
    }
    window.print();
  };

  return (
    <div className="space-y-4">
      
      {/* نوار جستجو و انتخاب تامین‌کننده و فیلترهای تاریخ */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center relative z-30">
        <div ref={searchContainerRef} className="relative flex-1">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input 
              type="text" 
              placeholder={activeSupplier ? `تامین‌کننده انتخاب‌شده: ${activeSupplier.name}` : "جستجو و انتخاب تامین‌کننده کالا و قطعات..."} 
              value={activeSupplier && !searchTerm ? activeSupplier.name : searchTerm}
              onFocus={() => setIsSearchOpen(true)}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (activeSupplier) setSelectedSupplierKey('');
                setIsSearchOpen(true);
              }}
              className={`w-full h-[34px] bg-white dark:bg-[#111113] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg pr-9 pl-8 py-0 text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs ${
                activeSupplier ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20' : 'border-slate-300 dark:border-[#2d2d30]'
              }`}
            />
            {(searchTerm || activeSupplier) && (
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

          {/* لیست پیشنهادات جستجوی تامین‌کنندگان (ساده، خلوت و سریع مشابه بخش پذیرش) */}
          {isSearchOpen && (
            <div className="absolute top-full right-0 left-0 mt-1.5 bg-white dark:bg-[#151518] rounded-xl border border-slate-200 dark:border-[#2d2d30] shadow-2xl overflow-hidden max-h-72 overflow-y-auto z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 bg-slate-50 dark:bg-[#1a1a1e] border-b border-slate-200 dark:border-[#2d2d30] flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                <span>{searchTerm.trim() ? `تامین‌کنندگان منطبق با «${searchTerm}»` : 'لیست تامین‌کنندگان (جهت انتخاب کلیک کنید)'}</span>
                <span>{toPersianDigits(matchedSuppliersWithStats.length)} مورد</span>
              </div>

              {matchedSuppliersWithStats.length === 0 ? (
                <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-xs font-bold space-y-1">
                  <p>هیچ تامین‌کننده‌ای با مشخصات «{searchTerm}» یافت نشد.</p>
                  <p className="text-[10px] text-slate-400 font-normal">لطفاً املای نام تامین‌کننده را بررسی کنید یا حروف دیگری را وارد نمایید.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-[#242428]">
                  {matchedSuppliersWithStats.map(({ supplier: s }) => {
                    const isSelected = selectedSupplierKey === s.key;

                    return (
                      <div
                        key={s.key}
                        onClick={() => handleSelectSupplier(s.key)}
                        className={`px-3 py-1.5 transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected 
                            ? 'bg-indigo-50 dark:bg-indigo-950/40' 
                            : 'hover:bg-slate-50 dark:hover:bg-[#1c1c20]'
                        }`}
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {s.name}
                          </span>
                          {s.category && (
                            <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-bold truncate max-w-[130px]">
                              {s.category}
                            </span>
                          )}
                        </div>

                        <div className="shrink-0 text-left flex items-center gap-1.5">
                          {s.contactPerson && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                              {s.contactPerson}
                            </span>
                          )}
                          {s.phone && (
                            <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#1a1a1e] px-2 py-0.5 rounded border border-slate-200 dark:border-[#2d2d30]">
                              {toPersianDigits(s.phone)}
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
            disabled={!activeSupplier}
            className={`h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg border transition-all cursor-pointer shadow-2xs shrink-0 group ${
              activeSupplier
                ? 'bg-white dark:bg-[#111113] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border-slate-300 dark:border-[#2d2d30] hover:border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'bg-slate-50 dark:bg-[#151518] text-slate-400 dark:text-slate-600 border-slate-200 dark:border-[#2d2d30] opacity-60 cursor-not-allowed'
            }`}
            title={activeSupplier ? 'چاپ صورتحساب رسمی این تامین‌کننده' : 'ابتدا یک تامین‌کننده را انتخاب کنید'}
          >
            <Printer className="w-4 h-4 transition-transform group-hover:scale-110" />
          </button>
        </div>
      </div>

      {/* ۳. در صورت عدم انتخاب تامین‌کننده: راهنمای جستجو */}
      {!activeSupplier ? (
        <div className="bg-white dark:bg-[#111113] rounded-2xl border border-slate-200 dark:border-[#2d2d30] p-8 sm:p-12 text-center shadow-xs animate-in fade-in duration-300">
          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              جستجو و مشاهده حساب مالی تامین‌کنندگان کالا و قطعات
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              برای مشاهده کاردکس خریدهای انبار، فاکتورهای قطعات یدکی، روانکارها، پرداختی‌ها و مانده بدهی/طلب تامین‌کنندگان، نام تامین‌کننده مورد نظر را انتخاب نمایید.
            </p>
          </div>
        </div>
      ) : (
        /* ۴. اگر تامین‌کننده انتخاب شده باشد: نمایش مستقیم صورتحساب و کاردکس مالی دقیقاً مطابق ساختار صورتحساب خودروها */
        <div className="space-y-4 animate-in fade-in duration-300">

          {/* جدول ریز فاکتورها و کاردکس اسناد مالی تامین‌کننده با استایل پذیرش خودرو */}
          <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex justify-between items-center">
              <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
                <List className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>ریز اسناد و صورتحساب مالی: {activeSupplier.name}</span>
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

                    {/* ۳. نام کالا */}
                    <TableColumnHeader
                      title="نام کالا"
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
                        هیچ فاکتور یا سند مالی در این بازه برای این تامین‌کننده یافت نشد.
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
                              {item.description || (item.categoryType === 'payment' ? 'بابت تسویه و واریز به حساب تامین‌کننده' : `خرید کالا جهت تحویل به ${item.destination || 'انبار مرکزی'}`)}
                              {item.reference ? ` (رسید/سند: ${toPersianDigits(item.reference)})` : ''}
                            </div>
                          </td>

                          {/* ۳. نام کالا */}
                          <td className="py-1 px-3 text-right text-slate-800 dark:text-slate-200 text-[11px] whitespace-nowrap align-middle">
                            {item.categoryType === 'payment' ? 'سند تسویه حساب' : (item.partName || item.title || '-')}
                          </td>

                          {/* ۴. مقدار */}
                          <td className="py-1 px-3 text-center text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap align-middle">
                            {item.categoryType === 'payment' ? (
                              <span>-</span>
                            ) : item.quantity ? (
                              <span>{toPersianDigits(item.quantity)}</span>
                            ) : (
                              <span>-</span>
                            )}
                          </td>

                          {/* ۵. قیمت واحد */}
                          <td className="py-1 px-3 text-center text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap align-middle">
                            {item.categoryType === 'payment' ? '-' : (item.unitPrice ? formatPrice(item.unitPrice) : '۰')}
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

      {/* مودال ثبت پرداخت / تسویه حساب به تامین‌کننده (سبک استاندارد و ست با مودال پذیرش) */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* هدر مدال هماهنگ با پذیرش */}
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <span>ثبت سند پرداخت و تسویه حساب تامین‌کننده</span>
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                    ثبت خروجی وجه نقد، حواله یا چک جهت تسویه حساب فاکتورهای تامین‌کننده
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
                {activeSupplier && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                    <div>
                      <span className="text-slate-500 text-[11px] block mb-0.5">تامین‌کننده طرف حساب:</span>
                      <strong className="text-slate-900 dark:text-white font-bold text-xs">{activeSupplier.name} ({activeSupplier.category})</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[11px] block mb-0.5">مانده طلب فعلی:</span>
                      <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold text-xs">{formatPrice(totals.balance)} ریال</strong>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      انتخاب تامین‌کننده <span className="text-rose-500">*</span>
                    </label>
                    <CustomSelect
                      value={selectedSupplierKey}
                      onChange={(val) => setSelectedSupplierKey(String(val))}
                      searchable={true}
                      quickAddType="supplier"
                      placeholder="انتخاب یا جستجوی تامین‌کننده..."
                      options={allSuppliersList.map(s => ({
                        value: s.key,
                        label: `${s.name} - ${s.category} (${s.contactPerson})`
                      }))}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      مبلغ پرداختی (ریال) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: ۱۰,۰۰۰,۰۰۰"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full h-[38px] px-3 border border-slate-300 dark:border-[#2d2d30] rounded-lg bg-white dark:bg-[#1a1a1c] font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
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
                    placeholder="مثال: شماره فاکتور، رسید بانکی، کد رهگیری ساتنا یا شماره صیادی چک"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="w-full h-[38px] px-3 border border-slate-300 dark:border-[#2d2d30] rounded-lg bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    توضیحات و بابت پرداخت
                  </label>
                  <textarea
                    rows={3}
                    placeholder="مثلاً: بابت تسویه فاکتور خرید فیلترجات انبار مرکزی دوره خرداد ماه"
                    value={paymentDescription}
                    onChange={(e) => setPaymentDescription(e.target.value)}
                    className="w-full p-3 border border-slate-300 dark:border-[#2d2d30] rounded-xl bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50 text-xs shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmittingPayment ? 'در حال ثبت...' : 'ثبت پرداخت'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* مودال ویرایش سند مالی تامین‌کننده (سبک استاندارد و ست با مودال پذیرش) */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* هدر مدال هماهنگ با پذیرش */}
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <span>ویرایش سند مالی تامین‌کننده</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded border bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30">
                      {editingItem.categoryLabel}
                    </span>
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-mono">
                    تامین‌کننده: {editingItem.supplierName} | شناسه: {editingItem.reference || editingItem.id}
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
                      نام کالا / شرح سند <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full h-[38px] px-3 border border-slate-300 dark:border-[#2d2d30] rounded-lg bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white font-bold text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      required
                    />
                  </div>
                </div>

                {editingItem.categoryType !== 'payment' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        تعداد / مقدار
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editQuantity}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditQuantity(val);
                          const q = parsePersianNumber(val) || 0;
                          const p = parsePersianNumber(editUnitPrice) || 0;
                          const total = Number(q) * Number(p);
                          if (p > 0) setEditCreditAmount(total > 0 ? formatPrice(total) : '0');
                        }}
                        className="w-full h-[38px] px-3 border border-slate-300 dark:border-[#2d2d30] rounded-lg bg-white dark:bg-[#1a1a1c] font-mono font-bold text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        قیمت واحد (ریال)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editUnitPrice}
                        onChange={(e) => {
                          const val = e.target.value;
                          const p = parsePersianNumber(val) || 0;
                          setEditUnitPrice(val ? formatPrice(p) : '');
                          const q = parsePersianNumber(editQuantity) || 0;
                          const total = Number(q) * Number(p);
                          if (q > 0) setEditCreditAmount(total > 0 ? formatPrice(total) : '0');
                        }}
                        className="w-full h-[38px] px-3 border border-slate-300 dark:border-[#2d2d30] rounded-lg bg-white dark:bg-[#1a1a1c] font-mono font-bold text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        مبلغ کل فاکتور - بدهکار (ریال)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editCreditAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          const c = parsePersianNumber(val) || 0;
                          setEditCreditAmount(val ? formatPrice(c) : '');
                        }}
                        className="w-full h-[38px] px-3 border border-slate-300 dark:border-[#2d2d30] rounded-lg bg-white dark:bg-[#1a1a1c] font-mono font-black text-emerald-600 dark:text-emerald-400 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        مبلغ پرداختی - بستانکار (ریال) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editDebitAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          const d = parsePersianNumber(val) || 0;
                          setEditDebitAmount(val ? formatPrice(d) : '');
                        }}
                        className="w-full h-[38px] px-3 border border-slate-300 dark:border-[#2d2d30] rounded-lg bg-white dark:bg-[#1a1a1c] font-mono font-black text-emerald-600 dark:text-emerald-400 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      شماره مرجع / فاکتور / رسید
                    </label>
                    <input
                      type="text"
                      value={editReference}
                      onChange={(e) => setEditReference(e.target.value)}
                      className="w-full h-[38px] px-3 border border-slate-300 dark:border-[#2d2d30] rounded-lg bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      مقصد تحویل کالا
                    </label>
                    <input
                      type="text"
                      value={editDestination}
                      onChange={(e) => setEditDestination(e.target.value)}
                      className="w-full h-[38px] px-3 border border-slate-300 dark:border-[#2d2d30] rounded-lg bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    شرح و ملاحظات
                  </label>
                  <textarea
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full p-3 border border-slate-300 dark:border-[#2d2d30] rounded-xl bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50 text-xs shadow-xs flex items-center gap-1.5"
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
