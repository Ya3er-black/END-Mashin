/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Wallet, Truck, FileText, Search, Printer, Plus,
  Wrench, Shield, X, ArrowUpDown, ArrowUp, ArrowDown, Eye, Edit3,
  Layers, Fuel, Package, User, ChevronRight,
  Sparkles, RotateCcw, Calendar, Filter, Check, CheckSquare, Square,
  FileSpreadsheet, Receipt, Store, List, CheckCircle, ArrowRightLeft, Scale
} from 'lucide-react';
import { Vehicle, Expense, ExpenseType, PeriodicService, Insurance, VehicleFailure, RepairWorkflow, PartInventory, Mechanic, Supplier, InventoryTransaction } from '../types';
import { formatPrice, toPersianDigits, formatKm, parsePersianNumber, numberToPersianWords } from '../utils/numberUtils';
import { getCurrentJalaliDate, toJalaliDate, toJalaliStandardString, persianToEnglishDigits } from '../utils/date';
import { sortData, SortDirection } from '../utils/sortUtils';
import { CustomSelect } from './CustomSelect';
import { JalaliDatePicker } from './JalaliDatePicker';
import { Pagination } from './Pagination';
import { MechanicAccountingView } from './MechanicAccountingView';
import { SupplierAccountingView } from './SupplierAccountingView';
import { ComprehensiveAccountingView } from './ComprehensiveAccountingView';
import { TableColumnHeader } from './TableFilterSort';
import { getVehicleDisplayName, matchesVehicleSearch } from '../utils/vehicleUtils';

export type StatementCategory = 'all' | 'service' | 'repair' | 'expense' | 'insurance';

export interface StatementItem {
  id: string;
  sourceId: number | string;
  documentNumber?: string;
  vehicleId: number;
  vehicleName: string;
  vehicleCode: string;
  vehiclePlaque: string;
  driverName?: string;
  company?: string;
  date: string;
  categoryLabel: string;
  categoryType: 'service' | 'repair' | 'expense' | 'insurance';
  title: string;
  description: string;
  quantity?: number;
  unitPrice?: number;
  debitAccount?: string;
  creditAccount?: string;
  debit: number;
  credit: number;
  cost: number;
  runningBalance?: number; // مانده تجمعی کاردکس (بدهکار - بستانکار)
  details?: {
    serviceKm?: number;
    nextKm?: number;
    nextDate?: string;
    repairShopName?: string;
    mechanicName?: string;
    supplierName?: string;
    partName?: string;
    partSource?: string;
    partCost?: number;
    wages?: number;
    warehouseParts?: Array<{ name: string; qty: number; unitPrice: number; total: number }>;
    shopParts?: Array<{ name: string; qty: number; unitPrice: number; total: number }>;
    policyNumber?: string;
    insuranceCompany?: string;
    insuranceType?: string;
    failureType?: string;
    status?: string;
    notes?: string;
    paymentMethod?: string;
    referenceNumber?: string;
  };
}

interface AccountingViewProps {
  vehicles: Vehicle[];
  expenses: Expense[];
  services: PeriodicService[];
  insurances: Insurance[];
  failures: VehicleFailure[];
  workflows?: RepairWorkflow[];
  parts?: PartInventory[];
  mechanics?: Mechanic[];
  suppliers?: Supplier[];
  inventoryTransactions?: InventoryTransaction[];
  onAddExpense?: (exp: Omit<Expense, 'id' | 'createdAt'>) => Promise<void> | void;
}

/**
 * تابع کمکی تبدیل هر نوع فرمت تاریخ به رشته استاندارد جلالی قابل مقایسه (YYYY/MM/DD با اعداد انگلیسی)
 */
function normalizeToComparableJalali(dateStr?: string | null): string {
  if (!dateStr || dateStr === '-' || dateStr === '---') return '';
  const eng = persianToEnglishDigits(String(dateStr)).trim();

  // اگر فرمت شمسی باشد مثل 1403/05/12 یا 1403-5-2
  const jalaliMatch = eng.match(/^(13\d{2}|14\d{2})[-/](\d{1,2})[-/](\d{1,2})/);
  if (jalaliMatch) {
    const y = jalaliMatch[1];
    const m = jalaliMatch[2].padStart(2, '0');
    const d = jalaliMatch[3].padStart(2, '0');
    return `${y}/${m}/${d}`;
  }

  // اگر فرمت میلادی/ایزو باشد
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

  // شروع کل عبارت با پیشوند
  if (t.startsWith(p)) return true;

  // شروع یکی از کلمات عبارت با پیشوند
  const words = t.split(/[\s\-_\/()\[\]،,]+/);
  return words.some(w => w.startsWith(p));
}

export default function AccountingView({
  vehicles,
  expenses,
  services,
  insurances,
  failures,
  workflows = [],
  parts = [],
  mechanics = [],
  suppliers = [],
  inventoryTransactions = [],
  onAddExpense
}: AccountingViewProps) {
  // تب انتخاب حساب: خودروها | تعمیرکاران | تامین‌کنندگان | صورتحساب کلی
  const [accountingTab, setAccountingTab] = useState<'vehicle' | 'mechanic' | 'supplier' | 'all_entities'>('vehicle');

  // به صورت پیش‌فرض هیچ خودرویی انتخاب نشده است تا صفحه در حالت جستجوی اولیه و تمیز باشد
  const [vehicleFilter, setVehicleFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<StatementCategory>('all');
  
  const [viewDetailItem, setViewDetailItem] = useState<StatementItem | null>(null);
  
  // مودال و فرم ثبت سند حسابداری دوطرفه (هزینه / پرداخت / دریافت)
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isMechanicPaymentModalOpen, setIsMechanicPaymentModalOpen] = useState(false);
  const [isSupplierPaymentModalOpen, setIsSupplierPaymentModalOpen] = useState(false);
  const [selectedMechanicKey, setSelectedMechanicKey] = useState<string>('');
  const [selectedSupplierKey, setSelectedSupplierKey] = useState<string>('');
  const [newExpenseVehicleId, setNewExpenseVehicleId] = useState('');
  const [isExpenseVehicleDropdownOpen, setIsExpenseVehicleDropdownOpen] = useState(false);
  const [expenseVehicleSearch, setExpenseVehicleSearch] = useState('');
  const [newExpenseType, setNewExpenseType] = useState<ExpenseType>('fuel');
  const [newExpenseDate, setNewExpenseDate] = useState(getCurrentJalaliDate());
  const [newExpenseCost, setNewExpenseCost] = useState('');
  const [newExpenseDescription, setNewExpenseDescription] = useState('');
  const [newDocumentNumber, setNewDocumentNumber] = useState('');

  // متغیرهای وضعیت حساب‌های دوطرفه و پویا (Debit & Credit Parties)
  const [debitPartyType, setDebitPartyType] = useState<'vehicle' | 'warehouse' | 'mechanic' | 'supplier' | 'treasury' | 'expense' | 'other'>('vehicle');
  const [debitPartyId, setDebitPartyId] = useState<string>('');
  const [debitPartySearch, setDebitPartySearch] = useState<string>('');
  const [isDebitPartyDropdownOpen, setIsDebitPartyDropdownOpen] = useState<boolean>(false);
  const [newDebitAccount, setNewDebitAccount] = useState('هزینه سوخت و بنزین خودرو');

  const [creditPartyType, setCreditPartyType] = useState<'vehicle' | 'warehouse' | 'mechanic' | 'supplier' | 'treasury' | 'expense' | 'other'>('treasury');
  const [creditPartyId, setCreditPartyId] = useState<string>('cash');
  const [creditPartySearch, setCreditPartySearch] = useState<string>('');
  const [isCreditPartyDropdownOpen, setIsCreditPartyDropdownOpen] = useState<boolean>(false);
  const [newCreditAccount, setNewCreditAccount] = useState('صندوق و تنخواه گردان شرکت');

  const [newPaymentMethod, setNewPaymentMethod] = useState('صندوق تنخواه شرکت');
  const [newReferenceNumber, setNewReferenceNumber] = useState('');
  const [newEntryType, setNewEntryType] = useState<'debit' | 'credit' | 'both'>('debit');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  
  const [sortKey, setSortKey] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // مدیریت ویرایش سطر صورتحساب
  const [editingItem, setEditingItem] = useState<StatementItem | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // لود overrides ذخیره شده در لوکال استوریج
  const [overrides, setOverrides] = useState<Record<string, Partial<StatementItem>>>(() => {
    try {
      const saved = localStorage.getItem('vehicle_accounting_overrides');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleOpenEditModal = (item: StatementItem) => {
    setEditingItem(item);
    setEditDate(item.date);
    setEditTitle(item.title || '');
    setEditCost(String(item.cost || 0));
    setEditDescription(item.description || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsSavingEdit(true);

    try {
      const parsedCost = parsePersianNumber(editCost) || 0;
      const updatedOverrides = {
        ...overrides,
        [editingItem.id]: {
          date: editDate,
          title: editTitle,
          cost: parsedCost,
          description: editDescription
        }
      };

      setOverrides(updatedOverrides);
      try {
        localStorage.setItem('vehicle_accounting_overrides', JSON.stringify(updatedOverrides));
      } catch (err) {
        console.error('Failed to save vehicle accounting overrides to localStorage', err);
      }

      // اگر از نوع expense باشد به سرور هم بفرستد
      if (editingItem.categoryType === 'expense' && typeof editingItem.sourceId === 'number') {
        try {
          await fetch(`/api/expenses/${editingItem.sourceId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              expenseDate: editDate,
              description: editDescription || editTitle,
              cost: parsedCost
            })
          });
        } catch (err) {
          console.error('Failed to sync expense update with server', err);
        }
      }

      setEditingItem(null);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // شماره صفحه و تعداد نمایش در هر صفحه (صفحه‌بندی)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // فیلترهای اختصاصی ستون‌ها با کلیک راست (Column Context Menu Filtering)
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [filterMenu, setFilterMenu] = useState<{
    x: number;
    y: number;
    colKey: string;
    colTitle: string;
  } | null>(null);
  const [filterSearch, setFilterSearch] = useState('');

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  // ریست شماره صفحه در صورت تغییر هر یک از فیلترها
  useEffect(() => {
    setCurrentPage(1);
  }, [vehicleFilter, selectedCategory, startDate, endDate, columnFilters, searchTerm]);

  // بستن لیست پیشنهادات جستجو و منوی فیلتر ستون هنگام کلیک در خارج
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setFilterMenu(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setFilterMenu(null);
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

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // خودروی فعال در صورتی که خودرویی خاص انتخاب شده باشد
  const activeVehicle = useMemo(() => {
    if (!vehicleFilter || vehicleFilter === 'all') return null;
    return vehicles.find(v => v.id.toString() === vehicleFilter) || null;
  }, [vehicles, vehicleFilter]);

  // جمع‌آوری تمامی تراکنش‌های مالی یکپارچه مربوط به تمام خودروها (سرویس‌های دوره‌ای، تعمیرات و فاکتورها، بیمه و هزینه‌ها با منطق حسابداری دوطرفه)
  const allStatementItems = useMemo<StatementItem[]>(() => {
    const items: StatementItem[] = [];

    // ۱. سوابق سرویس‌های دوره‌ای (Periodic Services)
    services.forEach((s, idx) => {
      const v = vehicles.find(veh => veh.id === s.vehicleId);
      const rawCost = Number(s.cost) || 0;
      const rawWages = Number(s.wages) || 0;
      const serviceCost = rawCost + rawWages;
      const docNum = `سرویس-${toPersianDigits(s.id || idx + 1)}`;
      const sDate = s.serviceDate ? toJalaliStandardString(s.serviceDate) : getCurrentJalaliDate();

      // ساخت حساب‌های طرف بستانکار
      const creditors: string[] = [];
      if (rawWages > 0 || s.mechanicName || s.repairShopName) {
        const mechLabel = s.mechanicName || s.repairShopName || 'تعمیرکار / سرویس‌کار';
        creditors.push(`اجرت: ${mechLabel} (${formatPrice(rawWages > 0 ? rawWages : serviceCost)} ریال)`);
      }
      if (s.partSource === 'supplier' || s.supplierName) {
        const supLabel = s.supplierName || 'تامین‌کننده';
        creditors.push(`قطعه: ${supLabel} (${formatPrice(rawCost)} ریال)`);
      } else if (s.partSource === 'warehouse' || s.partId) {
        creditors.push(`قطعه: انبار مرکزی شرکت ${s.partName ? `(${s.partName})` : ''}`);
      } else if (rawCost > 0 && !s.supplierName && !s.mechanicName) {
        creditors.push('صندوق و تنخواه گردان شرکت');
      }

      const creditAccountStr = creditors.length > 0 ? creditors.join(' | ') : 'صندوق و تنخواه گردان شرکت';

      const descElements = [
        s.notes,
        s.currentKm ? `کیلومتر: ${formatKm(s.currentKm)}` : '',
        s.mechanicName || s.repairShopName ? `سرویس‌کار: ${s.mechanicName || s.repairShopName}` : '',
        s.supplierName ? `تامین‌کننده: ${s.supplierName}` : (s.partSource === 'warehouse' ? 'تامین از انبار مرکزی' : '')
      ].filter(Boolean).join(' - ');

      items.push({
        id: `service-${s.id}`,
        sourceId: s.id,
        documentNumber: docNum,
        vehicleId: s.vehicleId,
        vehicleName: v?.name || s.driverName || 'خودرو متفرقه',
        vehicleCode: v?.code || '',
        vehiclePlaque: v?.plaque || s.plaque || '',
        driverName: v?.driverName || s.driverName || '',
        company: v?.company || s.company || '',
        date: sDate,
        categoryLabel: 'سرویس دوره‌ای',
        categoryType: 'service',
        title: s.serviceType || 'سرویس دوره‌ای روغن و فیلتر',
        description: descElements || `کیلومتر سرویس: ${formatKm(s.currentKm)}`,
        quantity: s.quantity || 1,
        unitPrice: s.unitPrice || serviceCost,
        debitAccount: `خودرو: ${v?.name || 'ناوگان'} (هزینه سرویس و نگهداری)`,
        creditAccount: creditAccountStr,
        debit: serviceCost,
        credit: 0,
        cost: serviceCost,
        details: {
          serviceKm: s.currentKm,
          nextKm: s.nextKm,
          nextDate: s.nextDate,
          wages: rawWages,
          partCost: rawCost,
          partSource: s.partSource,
          partName: s.partName,
          supplierName: s.supplierName,
          mechanicName: s.mechanicName,
          repairShopName: s.repairShopName,
          notes: s.notes
        }
      });
    });

    // ۲. سوابق تعمیرات و رفع خرابی‌ها (Vehicle Failures & Repair Workflows)
    failures.forEach((f, idx) => {
      const v = vehicles.find(veh => veh.id === f.vehicleId);
      const wf = workflows.find(w => w.failureId === f.id);
      
      // محاسبه هزینه‌های قطعات انبار
      const warehousePartsList: Array<{ name: string; qty: number; unitPrice: number; total: number }> = [];
      let calculatedWarehouseCost = 0;
      if (wf?.partsUsed && Object.keys(wf.partsUsed).length > 0) {
        Object.entries(wf.partsUsed).forEach(([pName, qty]) => {
          const partObj = parts.find(p => p.partName === pName);
          const qCount = Number(qty) || 1;
          const uPrice = partObj?.unitPrice || 0;
          const total = qCount * uPrice;
          calculatedWarehouseCost += total;
          warehousePartsList.push({
            name: pName,
            qty: qCount,
            unitPrice: uPrice,
            total
          });
        });
      }

      // محاسبه هزینه‌های قطعات تأمین‌شده توسط تعمیرگاه
      const shopPartsList: Array<{ name: string; qty: number; unitPrice: number; total: number }> = [];
      let calculatedShopPartsCost = 0;
      if (wf?.shopPartsUsed && Array.isArray(wf.shopPartsUsed) && wf.shopPartsUsed.length > 0) {
        wf.shopPartsUsed.forEach(sp => {
          const qCount = Number(sp.quantity) || 1;
          const uPrice = Number(sp.unitPrice) || 0;
          const total = Number(sp.totalPrice) || (qCount * uPrice);
          calculatedShopPartsCost += total;
          shopPartsList.push({
            name: sp.name,
            qty: qCount,
            unitPrice: uPrice,
            total
          });
        });
      }

      // هزینه کل تعمیرات
      let repairCost = Number(wf?.totalCost) || 0;
      if (repairCost === 0 && wf) {
        repairCost = (Number(wf.wages) || 0) + calculatedWarehouseCost + calculatedShopPartsCost;
      }

      // تاریخ انجام یا ترخیص تعمیر (به فرمت شمسی استاندارد)
      const rawRepairDate = wf?.endDate || wf?.startDate || f.failureDate;
      const repairDate = rawRepairDate ? toJalaliStandardString(rawRepairDate) : getCurrentJalaliDate();

      const shopNameStr = wf?.repairShopName ? `تعمیرگاه: ${wf.repairShopName}` : '';
      const notesStr = wf?.notes || f.description || '';
      const descParts = [shopNameStr, notesStr].filter(Boolean).join(' - ');
      const docNum = `تعمیر-${toPersianDigits(f.id || idx + 1)}`;

      items.push({
        id: `repair-${f.id}`,
        sourceId: f.id,
        documentNumber: docNum,
        vehicleId: f.vehicleId,
        vehicleName: v?.name || 'خودرو متفرقه',
        vehicleCode: v?.code || '',
        vehiclePlaque: v?.plaque || '',
        driverName: v?.driverName || '',
        company: v?.company || '',
        date: repairDate,
        categoryLabel: 'تعمیرات و رفع خرابی',
        categoryType: 'repair',
        title: `تعمیر: ${f.description?.substring(0, 40) || 'تعمیرات کارگاهی'}${f.description && f.description.length > 40 ? '...' : ''}`,
        description: descParts || 'ثبت گزارش تعمیرات و فاکتور ترخیص',
        quantity: 1,
        unitPrice: repairCost,
        debitAccount: 'هزینه تعمیرات و قطعات یدکی خودرو',
        creditAccount: wf?.repairShopName ? `بستانکاران تجاری (${wf.repairShopName})` : 'صندوق و تنخواه گردان شرکت',
        debit: repairCost,
        credit: 0,
        cost: repairCost,
        details: {
          repairShopName: wf?.repairShopName || 'تعمیرگاه متفرقه',
          wages: wf?.wages || 0,
          warehouseParts: warehousePartsList,
          shopParts: shopPartsList,
          failureType: f.failureType,
          status: f.status,
          notes: wf?.notes || f.description
        }
      });
    });

    // ۳. بیمه‌نامه‌ها (Insurances)
    insurances.forEach((i, idx) => {
      const v = vehicles.find(veh => veh.id === i.vehicleId);
      const insTypeStr = i.insuranceType === 'third_party' ? 'بیمه شخص ثالث' : 'بیمه بدنه';
      const insCost = Number(i.cost) || 0;
      const docNum = `بیمه-${toPersianDigits(i.id || idx + 1)}`;
      const insDate = i.startDate ? toJalaliStandardString(i.startDate) : getCurrentJalaliDate();
      items.push({
        id: `ins-${i.id}`,
        sourceId: i.id,
        documentNumber: docNum,
        vehicleId: i.vehicleId,
        vehicleName: v?.name || 'خودرو متفرقه',
        vehicleCode: v?.code || '',
        vehiclePlaque: v?.plaque || '',
        driverName: v?.driverName || '',
        company: v?.company || '',
        date: insDate,
        categoryLabel: 'بیمه‌نامه',
        categoryType: 'insurance',
        title: insTypeStr,
        description: `شرکت بیمه: ${i.insuranceCompany || 'نامشخص'} | شماره بیمه‌نامه: ${toPersianDigits(i.policyNumber || '-')}`,
        quantity: 1,
        unitPrice: insCost,
        debitAccount: 'هزینه بیمه و عوارض خودرو',
        creditAccount: i.insuranceCompany ? `بستانکاران (${i.insuranceCompany})` : 'بانک و تنخواه شرکت',
        debit: insCost,
        credit: 0,
        cost: insCost,
        details: {
          insuranceType: insTypeStr,
          insuranceCompany: i.insuranceCompany,
          policyNumber: i.policyNumber,
          nextDate: i.endDate
        }
      });
    });

    // ۴. هزینه‌های جاری متفرقه، سوخت و اسناد دوطرفه (Expenses)
    expenses.forEach((e, idx) => {
      // جلوگیری از ثبت تکراری اگر این هزینه قبلاً به عنوان سرویس دوره‌ای، بیمه یا تعمیرات فاکتور شده باشد
      const dDesc = e.description || '';
      if (
        dDesc.startsWith('سرویس دوره‌ای:') ||
        dDesc.startsWith('خرید بیمه‌نامه') ||
        dDesc.startsWith('تعمیرات خرابی کد')
      ) {
        return;
      }

      const v = vehicles.find(veh => veh.id === e.vehicleId);
      const expTypeMap: Record<string, string> = {
        fuel: 'سوخت (بنزین/گازوئیل)',
        repair: 'تعمیرات مستقیم',
        oil: 'روغن و فیلتر',
        parts: 'خرید قطعه یدکی',
        insurance: 'بیمه',
        tax: 'مالیات و عوارض',
        toll: 'عوارض بزرگراهی',
        carwash: 'کارواش و نظافت',
        payment: 'پرداخت وجه / تسویه',
        receipt: 'دریافت وجه / درآمد',
        other: 'سایر مخارج متفرقه'
      };

      const defaultDebitAccount = e.debitAccount || (
        e.expenseType === 'fuel' ? 'هزینه سوخت و بنزین خودرو' :
        e.expenseType === 'oil' ? 'هزینه روغن و سرویس خودرو' :
        e.expenseType === 'repair' || e.expenseType === 'parts' ? 'هزینه تعمیرات و نگهداری خودرو' :
        e.expenseType === 'insurance' ? 'هزینه بیمه خودرو' :
        'هزینه‌های جاری و متفرقه ناوگان'
      );

      const defaultCreditAccount = e.creditAccount || 'صندوق و تنخواه گردان شرکت';
      const numCost = Number(e.cost) || 0;

      // محاسبه دقیق بدهکار و بستانکار متناسب با طرف حساب
      let debitVal = 0;
      let creditVal = 0;

      if (e.entryType === 'credit' || e.creditPartyType === 'vehicle') {
        creditVal = numCost;
        debitVal = 0;
      } else if (e.entryType === 'both') {
        debitVal = numCost;
        creditVal = numCost;
      } else {
        debitVal = numCost;
        creditVal = 0;
      }

      const docNum = e.documentNumber || `سند-${toPersianDigits(e.id || idx + 1)}`;
      const expDate = e.expenseDate ? toJalaliStandardString(e.expenseDate) : getCurrentJalaliDate();

      items.push({
        id: `exp-${e.id}`,
        sourceId: e.id,
        documentNumber: docNum,
        vehicleId: e.vehicleId,
        vehicleName: v?.name || 'خودرو متفرقه',
        vehicleCode: v?.code || '',
        vehiclePlaque: v?.plaque || '',
        driverName: v?.driverName || '',
        company: v?.company || '',
        date: expDate,
        categoryLabel: e.expenseType === 'payment' ? 'پرداخت و تسویه' : 'سایر هزینه‌ها و سوخت',
        categoryType: 'expense',
        title: expTypeMap[e.expenseType] || e.expenseType || 'هزینه متفرقه',
        description: e.description || 'ثبت سند حسابداری در سیستم',
        quantity: 1,
        unitPrice: numCost,
        debitAccount: defaultDebitAccount,
        creditAccount: defaultCreditAccount,
        debit: debitVal,
        credit: creditVal,
        cost: numCost,
        details: {
          notes: e.description,
          paymentMethod: e.paymentMethod,
          referenceNumber: e.referenceNumber
        }
      });
    });

    // ۵. حواله‌های مصرف و خروج قطعات از انبار روی خودروها (Inventory Transactions)
    inventoryTransactions.forEach((tx, idx) => {
      if (tx.type === 'out') {
        const v = tx.vehicleId ? vehicles.find(veh => veh.id === tx.vehicleId) : undefined;
        const totalAmount = Number(tx.totalPrice) || ((Number(tx.quantity) || 0) * (Number(tx.unitPrice) || 0)) || 0;
        const docNum = tx.reference || `حواله-${toPersianDigits(tx.id || idx + 1)}`;
        const rawTxDate = tx.createdAt ? (tx.createdAt.includes('T') ? tx.createdAt.split('T')[0] : tx.createdAt) : getCurrentJalaliDate();
        const txDate = toJalaliStandardString(rawTxDate);
        const txQty = Number(tx.quantity) || 1;
        const txUnitPrice = Number(tx.unitPrice) || (txQty > 0 ? totalAmount / txQty : totalAmount);

        items.push({
          id: `inv-tx-${tx.id}`,
          sourceId: tx.id,
          documentNumber: docNum,
          vehicleId: tx.vehicleId || v?.id || 0,
          vehicleName: v?.name || tx.recipientOrSupplier || 'خودرو / ناوگان',
          vehicleCode: v?.code || '',
          vehiclePlaque: v?.plaque || '',
          driverName: v?.driverName || '',
          company: v?.company || '',
          date: txDate,
          categoryLabel: 'قطعات و انبار',
          categoryType: 'repair',
          title: `خروج از انبار: ${tx.partName || 'قطعه یدکی'} (${toPersianDigits(tx.quantity || 1)} عدد)`,
          description: tx.notes || `تخصیص و مصرف قطعه از انبار مرکزی روی خودرو ${v?.name || ''}`,
          quantity: txQty,
          unitPrice: txUnitPrice,
          debitAccount: v ? `خودرو: ${v.name} (مصرف قطعه از انبار)` : 'هزینه قطعات و لوازم یدکی خودرو',
          creditAccount: 'انبار مرکزی قطعات و لوازم یدکی',
          debit: totalAmount,
          credit: 0,
          cost: totalAmount,
          details: {
            notes: tx.notes,
            warehouseParts: [{
              name: tx.partName || 'قطعه یدکی',
              qty: tx.quantity || 1,
              unitPrice: tx.unitPrice || 0,
              total: totalAmount
            }]
          }
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
  }, [services, failures, workflows, parts, insurances, expenses, inventoryTransactions, vehicles, overrides]);

  // لیست خودروها منطبق با عبارت جستجوی نام خودرو، راننده و کد خودرو
  const matchedVehiclesWithStats = useMemo(() => {
    const query = searchTerm.trim();
    const list = query
      ? vehicles.filter(v => matchesVehicleSearch(v, query))
      : vehicles;

    const startComp = normalizeToComparableJalali(startDate);
    const endComp = normalizeToComparableJalali(endDate);

    return list.map(v => {
      let vehicleItems = allStatementItems.filter(item => item.vehicleId === v.id);
      if (startComp || endComp) {
        vehicleItems = vehicleItems.filter(item => {
          const itemComp = normalizeToComparableJalali(item.date);
          if (startComp && itemComp && itemComp < startComp) return false;
          if (endComp && itemComp && itemComp > endComp) return false;
          return true;
        });
      }
      const totalDebit = vehicleItems.reduce((acc, curr) => acc + (curr.debit || 0), 0);
      const totalCredit = vehicleItems.reduce((acc, curr) => acc + (curr.credit || 0), 0);
      const totalCost = totalDebit - totalCredit;
      const itemsCount = vehicleItems.length;

      return {
        vehicle: v,
        totalCost,
        itemsCount
      };
    });
  }, [vehicles, searchTerm, allStatementItems, startDate, endDate]);

  // تابع استخراج مقدار متنی فیلد جهت مقایسه و فیلتر ستونی
  const getColumnItemValue = (item: StatementItem, colKey: string): string => {
    switch (colKey) {
      case 'date':
        return toJalaliDate(item.date);
      case 'documentNumber':
        return item.documentNumber || '-';
      case 'categoryLabel':
        return item.categoryLabel || 'سایر';
      case 'title':
        return item.title || '-';
      case 'description':
        return item.description || '-';
      case 'quantity':
        return String(item.quantity ?? 1);
      case 'unitPrice':
        return `${formatPrice(item.unitPrice ?? item.cost)} ریال`;
      case 'debitAccount':
        return item.debitAccount || '-';
      case 'creditAccount':
        return item.creditAccount || '-';
      case 'debit':
      case 'debitAmount':
        return `${formatPrice(item.debit || 0)} ریال`;
      case 'credit':
      case 'creditAmount':
        return `${formatPrice(item.credit || 0)} ریال`;
      case 'cost':
        return `${formatPrice(item.cost)} ریال`;
      case 'runningBalance':
        return `${formatPrice(item.runningBalance ?? 0)} ریال`;
      default:
        return (item as any)[colKey] || '';
    }
  };

  // فیلتر کردن اقلام جدول برای خودروی فعال، دسته‌بندی، بازه تاریخ و فیلترهای ستونی
  const filteredStatementItems = useMemo(() => {
    if (!activeVehicle) return [];

    const startComp = normalizeToComparableJalali(startDate);
    const endComp = normalizeToComparableJalali(endDate);

    return allStatementItems.filter(item => {
      // فقط اقلام مربوط به همین خودرو
      if (item.vehicleId !== activeVehicle.id) {
        return false;
      }

      // فیلتر دسته‌بندی
      if (selectedCategory !== 'all' && item.categoryType !== selectedCategory) {
        return false;
      }

      // فیلتر بازه تاریخ
      const itemComp = normalizeToComparableJalali(item.date);
      if (startComp && itemComp && itemComp < startComp) {
        return false;
      }
      if (endComp && itemComp && itemComp > endComp) {
        return false;
      }

      // اعمال فیلترهای انتخابی ستون‌ها (Column Filters)
      for (const [colKey, allowedValues] of Object.entries(columnFilters)) {
        if (allowedValues && Array.isArray(allowedValues)) {
          const itemVal = getColumnItemValue(item, colKey);
          if (!allowedValues.includes(itemVal)) {
            return false;
          }
        }
      }

      return true;
    });
  }, [allStatementItems, activeVehicle, selectedCategory, startDate, endDate, columnFilters]);

  // محاسبه مانده تجمعی کاردکس دوطرفه خودرو به ترتیب زمانی (بدهکار - بستانکار)
  const itemsWithRunningBalance = useMemo(() => {
    const chrono = [...filteredStatementItems].sort((a, b) => {
      const compA = normalizeToComparableJalali(a.date);
      const compB = normalizeToComparableJalali(b.date);
      return compA.localeCompare(compB);
    });

    let running = 0;
    const balanceMap = new Map<string, number>();
    for (const item of chrono) {
      const debitVal = item.debit !== undefined ? item.debit : item.cost;
      const creditVal = item.credit !== undefined ? item.credit : 0;
      running += (debitVal - creditVal);
      balanceMap.set(item.id, running);
    }

    return filteredStatementItems.map(item => ({
      ...item,
      runningBalance: balanceMap.get(item.id) ?? 0
    }));
  }, [filteredStatementItems]);

  // مرتب‌سازی اقلام صورتحساب
  const sortedStatementItems = useMemo(() => {
    return sortData(itemsWithRunningBalance, sortKey, sortDirection);
  }, [itemsWithRunningBalance, sortKey, sortDirection]);

  // محاسبه تعداد کل صفحات و اقلام صفحه جاری
  const totalPages = Math.ceil(sortedStatementItems.length / pageSize) || 1;
  const paginatedStatementItems = useMemo(() => {
    return sortedStatementItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [sortedStatementItems, currentPage, pageSize]);

  // محاسبات تجمیعی دوطرفه (بدهکار، بستانکار و مانده نهایی)
  const totals = useMemo(() => {
    let grandTotal = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    let servicesTotal = 0;
    let servicesCount = 0;
    let repairsTotal = 0;
    let repairsCount = 0;
    let insuranceTotal = 0;
    let insuranceCount = 0;
    let expensesTotal = 0;
    let expensesCount = 0;

    if (!activeVehicle) {
      return {
        grandTotal: 0,
        totalDebit: 0,
        totalCredit: 0,
        servicesTotal: 0,
        servicesCount: 0,
        repairsTotal: 0,
        repairsCount: 0,
        insuranceTotal: 0,
        insuranceCount: 0,
        expensesTotal: 0,
        expensesCount: 0
      };
    }

    const startComp = normalizeToComparableJalali(startDate);
    const endComp = normalizeToComparableJalali(endDate);

    const vehicleAllItems = allStatementItems.filter(item => {
      if (item.vehicleId !== activeVehicle.id) return false;
      if (startComp || endComp) {
        const itemComp = normalizeToComparableJalali(item.date);
        if (startComp && itemComp && itemComp < startComp) return false;
        if (endComp && itemComp && itemComp > endComp) return false;
      }
      return true;
    });

    vehicleAllItems.forEach(item => {
      const d = item.debit !== undefined ? item.debit : item.cost;
      const c = item.credit !== undefined ? item.credit : 0;
      totalDebit += d;
      totalCredit += c;
      grandTotal += (d - c);

      if (item.categoryType === 'service') {
        servicesTotal += item.cost;
        servicesCount++;
      } else if (item.categoryType === 'repair') {
        repairsTotal += item.cost;
        repairsCount++;
      } else if (item.categoryType === 'insurance') {
        insuranceTotal += item.cost;
        insuranceCount++;
      } else if (item.categoryType === 'expense') {
        expensesTotal += item.cost;
        expensesCount++;
      }
    });

    return {
      grandTotal,
      totalDebit,
      totalCredit,
      servicesTotal,
      servicesCount,
      repairsTotal,
      repairsCount,
      insuranceTotal,
      insuranceCount,
      expensesTotal,
      expensesCount
    };
  }, [allStatementItems, activeVehicle, startDate, endDate]);

  // انتخاب یک خودرو از لیست پیشنهادات جستجو و نمایش تمام‌صفحه صورتحساب آن
  const handleSelectVehicle = (v: Vehicle) => {
    setVehicleFilter(v.id.toString());
    setColumnFilters({});
    setFilterMenu(null);
    setIsSearchOpen(false);
    setSearchTerm('');
  };

  const handleResetToDefault = () => {
    setVehicleFilter('');
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setSelectedCategory('all');
    setColumnFilters({});
    setFilterMenu(null);
    setIsSearchOpen(false);
  };

  // باز کردن منوی فیلتر ستون با کلیک راست روی سرفصل
  const handleHeaderContextMenu = (e: React.MouseEvent, colKey: string, colTitle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setFilterSearch('');
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

  // استخراج تمام مقادیر یکتا و تعداد تکرار برای ستون مورد نظر
  const currentMenuValues = useMemo(() => {
    if (!filterMenu || !activeVehicle) return [];
    
    const startComp = normalizeToComparableJalali(startDate);
    const endComp = normalizeToComparableJalali(endDate);
    
    const baseItems = allStatementItems.filter(item => {
      if (item.vehicleId !== activeVehicle.id) return false;
      if (selectedCategory !== 'all' && item.categoryType !== selectedCategory) return false;
      const itemComp = normalizeToComparableJalali(item.date);
      if (startComp && itemComp && itemComp < startComp) return false;
      if (endComp && itemComp && itemComp > endComp) return false;
      return true;
    });

    const valMap = new Map<string, number>();
    baseItems.forEach(item => {
      const val = getColumnItemValue(item, filterMenu.colKey);
      valMap.set(val, (valMap.get(val) || 0) + 1);
    });

    return Array.from(valMap.entries()).map(([value, count]) => ({
      value,
      count
    }));
  }, [filterMenu, activeVehicle, allStatementItems, startDate, endDate, selectedCategory]);

  // فیلتر جستجو داخل منوی مقادیر ستون
  const displayedMenuValues = useMemo(() => {
    if (!filterSearch.trim()) return currentMenuValues;
    const q = filterSearch.trim().toLowerCase();
    return currentMenuValues.filter(item => item.value.toLowerCase().includes(q));
  }, [currentMenuValues, filterSearch]);

  const handleToggleColumnValue = (colKey: string, val: string, allVals: string[]) => {
    setColumnFilters(prev => {
      const current = prev[colKey] ?? allVals;
      const exists = current.includes(val);
      let nextVals: string[];
      if (exists) {
        nextVals = current.filter(v => v !== val);
      } else {
        nextVals = [...current, val];
      }
      if (nextVals.length === allVals.length) {
        const next = { ...prev };
        delete next[colKey];
        return next;
      }
      return {
        ...prev,
        [colKey]: nextVals
      };
    });
  };

  const handleSelectOnlyValue = (colKey: string, val: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [colKey]: [val]
    }));
  };

  const handleSelectAllInColumn = (colKey: string) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      delete next[colKey];
      return next;
    });
  };

  const handleDeselectAllInColumn = (colKey: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [colKey]: []
    }));
  };

  const handleClearColumnFilter = (colKey: string) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      delete next[colKey];
      return next;
    });
  };

  // الگوهای سریع حسابداری دوطرفه
  const applyPreset = (presetKey: string) => {
    const v = vehicles.find(veh => veh.id.toString() === newExpenseVehicleId) || vehicles[0];
    const m = mechanics[0];
    const s = suppliers[0];

    if (presetKey === 'inventory_to_vehicle') {
      // ۱. مصرف قطعه از انبار روی خودرو (انبار بستانکار، ماشین بدهکار)
      setDebitPartyType('vehicle');
      if (v) {
        setDebitPartyId(v.id.toString());
        setNewExpenseVehicleId(v.id.toString());
        setNewDebitAccount(`خودرو: ${v.name} [${toPersianDigits(v.plaque)}] (مصرف قطعه یدکی)`);
      }
      setCreditPartyType('warehouse');
      setCreditPartyId('main_warehouse');
      setNewCreditAccount('انبار مرکزی قطعات و لوازم یدکی (کاهش موجودی)');
      setNewExpenseType('parts');
      setNewExpenseDescription('بابت تخصیص و مصرف قطعه یدکی از انبار روی خودرو');
    } else if (presetKey === 'payment_to_mechanic') {
      // ۲. پرداخت وجه به تعمیرکار (تعمیرکار بدهکار، صندوق/بانک بستانکار)
      setDebitPartyType('mechanic');
      if (m) {
        setDebitPartyId(m.id.toString());
        setNewDebitAccount(`حساب تعمیرکار: ${m.name} (${m.shopName || m.specialty || 'تعمیرگاه'})`);
      } else {
        setNewDebitAccount('حساب بدهکار: تعمیرگاه طرف قرارداد');
      }
      setCreditPartyType('treasury');
      setCreditPartyId('cash');
      setNewCreditAccount('صندوق و تنخواه گردان شرکت (خروج نقد)');
      setNewExpenseType('payment');
      setNewExpenseDescription('بابت پرداخت وجه و تسویه حساب دستمزد تعمیرگاه');
    } else if (presetKey === 'payment_to_supplier') {
      // ۳. پرداخت وجه به تامین‌کننده (تامین‌کننده بدهکار، صندوق/بانک بستانکار)
      setDebitPartyType('supplier');
      if (s) {
        setDebitPartyId(s.id.toString());
        setNewDebitAccount(`حساب تامین‌کننده: ${s.name} (${s.category || 'فروشگاه قطعات'})`);
      } else {
        setNewDebitAccount('حساب بدهکار: تامین‌کننده قطعات');
      }
      setCreditPartyType('treasury');
      setCreditPartyId('bank');
      setNewCreditAccount('حساب بانکی اصلی شرکت (واریز حواله)');
      setNewExpenseType('payment');
      setNewExpenseDescription('بابت واریز وجه و تسویه فاکتور خرید قطعات');
    } else if (presetKey === 'mechanic_invoice') {
      // ۴. ثبت فاکتور خدمات تعمیرگاه (خودرو بدهکار، تعمیرکار بستانکار)
      setDebitPartyType('vehicle');
      if (v) {
        setDebitPartyId(v.id.toString());
        setNewExpenseVehicleId(v.id.toString());
        setNewDebitAccount(`خودرو: ${v.name} (هزینه خدمات و اجرت تعمیرگاه)`);
      }
      setCreditPartyType('mechanic');
      if (m) {
        setCreditPartyId(m.id.toString());
        setNewCreditAccount(`حساب بستانکاران: ${m.name} (${m.shopName || 'تعمیرگاه'})`);
      }
      setNewExpenseType('repair');
      setNewExpenseDescription('بابت انجام خدمات تعمیراتی و سرویس خودرو توسط تعمیرگاه');
    } else if (presetKey === 'supplier_to_warehouse') {
      // ۵. خرید قطعه از تامین‌کننده به انبار (انبار بدهکار، تامین‌کننده بستانکار)
      setDebitPartyType('warehouse');
      setDebitPartyId('main_warehouse');
      setNewDebitAccount('انبار مرکزی قطعات و لوازم یدکی (افزایش موجودی)');
      setCreditPartyType('supplier');
      if (s) {
        setCreditPartyId(s.id.toString());
        setNewCreditAccount(`حساب بستانکاران: تامین‌کننده ${s.name}`);
      }
      setNewExpenseType('parts');
      setNewExpenseDescription('بابت خرید قطعات یدکی و تحویل به انبار مرکزی');
    } else if (presetKey === 'fuel_expense') {
      // ۶. خرید سوخت بنزین (هزینه سوخت خودرو بدهکار، تنخواه بستانکار)
      setDebitPartyType('vehicle');
      if (v) {
        setDebitPartyId(v.id.toString());
        setNewExpenseVehicleId(v.id.toString());
        setNewDebitAccount(`خودرو: ${v.name} (هزینه سوخت و بنزین)`);
      } else {
        setNewDebitAccount('هزینه سوخت و بنزین خودرو');
      }
      setCreditPartyType('treasury');
      setCreditPartyId('driver_cash');
      setNewCreditAccount('کارت تنخواه راننده / صندوق نقدی');
      setNewExpenseType('fuel');
      setNewExpenseDescription('بابت سوخت‌گیری خودرو');
    }
  };

  // جابجایی دو طرف حساب (Swap)
  const handleSwapDebitCredit = () => {
    const prevDebitType = debitPartyType;
    const prevDebitId = debitPartyId;
    const prevDebitAcc = newDebitAccount;

    setDebitPartyType(creditPartyType);
    setDebitPartyId(creditPartyId);
    setNewDebitAccount(newCreditAccount);

    setCreditPartyType(prevDebitType);
    setCreditPartyId(prevDebitId);
    setNewCreditAccount(prevDebitAcc);
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedCost = parsePersianNumber(newExpenseCost);

    if (!parsedCost || parsedCost <= 0) {
      alert('لطفاً مبلغ معتبر وارد نمایید.');
      return;
    }

    const vId = Number(newExpenseVehicleId) || (debitPartyType === 'vehicle' ? Number(debitPartyId) : (creditPartyType === 'vehicle' ? Number(creditPartyId) : (vehicles[0]?.id || 0)));
    const mId = debitPartyType === 'mechanic' ? Number(debitPartyId) : (creditPartyType === 'mechanic' ? Number(creditPartyId) : undefined);
    const sId = debitPartyType === 'supplier' ? Number(debitPartyId) : (creditPartyType === 'supplier' ? Number(creditPartyId) : undefined);

    const selectedV = vehicles.find(v => v.id === vId);
    const finalDocNum = newDocumentNumber.trim() || `سند-${toPersianDigits(Date.now().toString().slice(-6))}`;
    const finalDebitAcc = newDebitAccount.trim() || 'طرف بدهکار سند';
    const finalCreditAcc = newCreditAccount.trim() || 'طرف بستانکار سند';

    try {
      setIsSubmittingExpense(true);
      if (onAddExpense) {
        await onAddExpense({
          vehicleId: vId,
          driverName: selectedV?.driverName || '',
          company: selectedV?.company || '',
          plaque: selectedV?.plaque || '',
          expenseType: newExpenseType,
          expenseDate: newExpenseDate || getCurrentJalaliDate(),
          cost: parsedCost,
          description: newExpenseDescription.trim(),
          documentNumber: finalDocNum,
          debitAccount: finalDebitAcc,
          creditAccount: finalCreditAcc,
          debitPartyType,
          debitPartyId: debitPartyId || undefined,
          creditPartyType,
          creditPartyId: creditPartyId || undefined,
          mechanicId: mId,
          supplierId: sId,
          entryType: newEntryType,
          paymentMethod: newPaymentMethod,
          referenceNumber: newReferenceNumber.trim() || undefined
        });
      }
      setIsAddExpenseModalOpen(false);
      setNewExpenseCost('');
      setNewExpenseDescription('');
      setNewDocumentNumber('');
      setNewReferenceNumber('');
    } catch (err) {
      console.error(err);
      alert('خطا در ثبت سند دوطرفه حسابداری');
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  const handleExportExcel = () => {
    try {
      const itemsToExport = sortedStatementItems;
      if (!itemsToExport || itemsToExport.length === 0) {
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
        'ملاحظات و شرح',
        'نام خدمت / سرفصل',
        'مقدار',
        'قیمت واحد (ریال)',
        'بدهکار (ریال)',
        'مانده کاردکس (ریال)'
      ];

      const rows = itemsToExport.map((item, idx) => [
        idx + 1,
        toJalaliDate(item.date),
        item.description || (item.details?.notes ? `${item.details.notes}` : `سند ${item.categoryLabel} خودرو ${item.vehicleName || ''}`),
        item.title || item.categoryLabel,
        item.quantity || 1,
        item.unitPrice || item.cost || 0,
        item.debit !== undefined ? item.debit : item.cost || 0,
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
      const vehiclePart = activeVehicle ? `_${activeVehicle.name.replace(/\s+/g, '_')}` : '';
      const todayDate = getCurrentJalaliDate().replace(/\//g, '-');
      link.setAttribute('download', `کاردکس_دوطرفه_حسابداری_خودرو${vehiclePart}_${todayDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export Excel error:', err);
      alert('خطا در صدور خروجی اکسل.');
    }
  };

  const handlePrint = () => {
    if (!activeVehicle) {
      alert('لطفاً ابتدا یک خودرو یا راننده را برای چاپ صورتحساب انتخاب نمایید.');
      return;
    }
    window.print();
  };

  // اگر کاربر روی «ثبت سند / هزینه» کلیک کرده، فرم حرفه‌ای ثبت سند دوطرفه حسابداری نمایش یابد
  if (isAddExpenseModalOpen) {
    const currentSelectedVehicle = vehicles.find(v => v.id.toString() === newExpenseVehicleId);
    const parsedCostNum = parsePersianNumber(newExpenseCost) || 0;
    const isDebitType = newEntryType === 'debit';

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="bg-white dark:bg-[#111113] rounded-lg w-full border border-slate-200 dark:border-[#2d2d30] flex flex-col overflow-hidden space-y-0 shadow-xs">
          
          {/* هدر صفحه ثبت سند حسابداری */}
          <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <span>ثبت سند حسابداری دوطرفه خودرو (بدهکار / بستانکار)</span>
                  <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded font-mono font-bold">
                    Double-Entry Voucher
                  </span>
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                  ثبت رسمی سند حسابداری با تفکیک سرفصل‌های معین بدهکار، بستانکار و تخصیص مستقیم به خودرو
                </p>
              </div>
            </div>
            <button 
              type="button"
              onClick={() => setIsAddExpenseModalOpen(false)} 
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors border border-transparent hover:border-slate-300 dark:hover:border-[#2d2d30] cursor-pointer"
              title="بستن"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* فرم ثبت سند دوطرفه */}
          <form onSubmit={handleCreateExpense} className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs bg-white dark:bg-[#111113]">
            
            {/* بخش الگوهای سریع حسابداری (Quick Presets) */}
            <div className="p-3.5 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-lg border border-indigo-100 dark:border-indigo-900/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>الگوهای پیش‌فرض و سریع ثبت سند (انتخاب خودکار طرفین حساب):</span>
                </span>
                <span className="text-[10px] text-slate-400 font-bold hidden sm:inline">کلیک روی هر مورد طرف بدهکار و بستانکار را تنظیم می‌کند</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => applyPreset('inventory_to_vehicle')}
                  className="p-2 text-right bg-white dark:bg-[#1a1a1e] hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-[#2d2d30] hover:border-indigo-400 rounded-md transition-all cursor-pointer group shadow-2xs"
                >
                  <span className="font-bold text-[11px] text-indigo-700 dark:text-indigo-300 block group-hover:text-indigo-600">
                    📦 قطعه انبار روی ماشین
                  </span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">
                    بدهکار: خودرو | بستانکار: انبار
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('payment_to_mechanic')}
                  className="p-2 text-right bg-white dark:bg-[#1a1a1e] hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-slate-200 dark:border-[#2d2d30] hover:border-emerald-400 rounded-md transition-all cursor-pointer group shadow-2xs"
                >
                  <span className="font-bold text-[11px] text-emerald-700 dark:text-emerald-300 block group-hover:text-emerald-600">
                    💳 پرداخت به تعمیرکار
                  </span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">
                    بدهکار: تعمیرکار | بستانکار: تنخواه
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('payment_to_supplier')}
                  className="p-2 text-right bg-white dark:bg-[#1a1a1e] hover:bg-blue-50 dark:hover:bg-blue-950/60 border border-slate-200 dark:border-[#2d2d30] hover:border-blue-400 rounded-md transition-all cursor-pointer group shadow-2xs"
                >
                  <span className="font-bold text-[11px] text-blue-700 dark:text-blue-300 block group-hover:text-blue-600">
                    🛍️ پرداخت به تامین‌کننده
                  </span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">
                    بدهکار: تامین‌کننده | بستانکار: بانک
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('mechanic_invoice')}
                  className="p-2 text-right bg-white dark:bg-[#1a1a1e] hover:bg-amber-50 dark:hover:bg-amber-950/60 border border-slate-200 dark:border-[#2d2d30] hover:border-amber-400 rounded-md transition-all cursor-pointer group shadow-2xs"
                >
                  <span className="font-bold text-[11px] text-amber-700 dark:text-amber-300 block group-hover:text-amber-600">
                    🛠️ فاکتور تعمیرگاه
                  </span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">
                    بدهکار: خودرو | بستانکار: تعمیرکار
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('supplier_to_warehouse')}
                  className="p-2 text-right bg-white dark:bg-[#1a1a1e] hover:bg-purple-50 dark:hover:bg-purple-950/60 border border-slate-200 dark:border-[#2d2d30] hover:border-purple-400 rounded-md transition-all cursor-pointer group shadow-2xs"
                >
                  <span className="font-bold text-[11px] text-purple-700 dark:text-purple-300 block group-hover:text-purple-600">
                    🏢 خرید قطعه برای انبار
                  </span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">
                    بدهکار: انبار | بستانکار: تامین‌کننده
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('fuel_expense')}
                  className="p-2 text-right bg-white dark:bg-[#1a1a1e] hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-slate-200 dark:border-[#2d2d30] hover:border-rose-400 rounded-md transition-all cursor-pointer group shadow-2xs"
                >
                  <span className="font-bold text-[11px] text-rose-700 dark:text-rose-400 block group-hover:text-rose-600">
                    ⛽ خرید سوخت بنزین
                  </span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">
                    بدهکار: خودرو | بستانکار: تنخواه
                  </span>
                </button>
              </div>
            </div>

            {/* بخش ۱: اطلاعات پایه سند (شماره سند و تاریخ) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  شماره سند حسابداری
                </label>
                <input
                  type="text"
                  value={newDocumentNumber}
                  onChange={(e) => setNewDocumentNumber(e.target.value)}
                  placeholder="مثال: سند-۱۰۲۴ (یا خودکار)"
                  className="w-full p-2 bg-white dark:bg-[#1a1a1c] border border-slate-300 dark:border-[#2d2d30] rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  تاریخ سند <span className="text-rose-500">*</span>
                </label>
                <JalaliDatePicker
                  value={newExpenseDate}
                  onChange={setNewExpenseDate}
                  placeholder="انتخاب تاریخ"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  مبلغ سند (ریال) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newExpenseCost ? formatPrice(parsePersianNumber(newExpenseCost)) : ''}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/,/g, '');
                    setNewExpenseCost(clean);
                  }}
                  placeholder="مثال: ۲,۵۰۰,۰۰۰"
                  className="w-full p-2 bg-white dark:bg-[#1a1a1c] border border-slate-300 dark:border-[#2d2d30] rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-left text-slate-900 dark:text-white text-xs font-black"
                  required
                />
              </div>
            </div>

            {/* بخش ۲: طرفین حساب دوطرفه (بدهکار در برابر بستانکار) با امکان تعویض و انتخاب منعطف حساب‌ها */}
            <div className="relative">
              
              {/* دکمه تعویض طرفین در وسط (Swap Button) */}
              <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                <button
                  type="button"
                  onClick={handleSwapDebitCredit}
                  className="w-8 h-8 rounded-full bg-white dark:bg-[#1e1e22] border-2 border-indigo-500 shadow-md text-indigo-600 dark:text-indigo-400 hover:scale-110 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                  title="جابجایی طرف بدهکار و بستانکار"
                >
                  <ArrowUpDown className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* کادر طرف بدهکار (Debit Side) */}
                <div className="p-3.5 bg-rose-50/30 dark:bg-rose-950/10 rounded-lg border border-rose-200 dark:border-rose-900/30 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-rose-200/80 dark:border-rose-900/30">
                    <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-400 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                      <span>طرف بدهکار سند (بدهکار شونده)</span>
                    </div>
                    <span className="text-[10px] bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 px-2 py-0.5 rounded font-mono font-bold">
                      بدهکار (Debit)
                    </span>
                  </div>

                  {/* انتخاب نوع ماهیت بدهکار */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                      نوع طرف حساب بدهکار:
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { id: 'vehicle', label: '🚗 خودرو', desc: 'تخصیص به ماشین' },
                        { id: 'warehouse', label: '🏢 انبار قطعات', desc: 'موجودی انبار' },
                        { id: 'mechanic', label: '🔧 تعمیرکار', desc: 'طلب تعمیرگاه' },
                        { id: 'supplier', label: '🛍️ تامین‌کننده', desc: 'طلب فروشنده' },
                        { id: 'treasury', label: '💳 صندوق / بانک', desc: 'نقدینگی' },
                        { id: 'expense', label: '📑 سرفصل هزینه', desc: 'هزینه عمومی' },
                        { id: 'other', label: '✍️ سایر', desc: 'دلخواه' },
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            const newType = t.id as any;
                            setDebitPartyType(newType);
                            if (newType === 'vehicle') {
                              const v = vehicles[0];
                              if (v) {
                                setDebitPartyId(v.id.toString());
                                setNewExpenseVehicleId(v.id.toString());
                                setNewDebitAccount(`خودرو: ${v.name} [${toPersianDigits(v.plaque)}]`);
                              }
                            } else if (newType === 'warehouse') {
                              setDebitPartyId('main_warehouse');
                              setNewDebitAccount('انبار مرکزی قطعات و لوازم یدکی');
                            } else if (newType === 'mechanic') {
                              const m = mechanics[0];
                              if (m) {
                                setDebitPartyId(m.id.toString());
                                setNewDebitAccount(`حساب تعمیرکار: ${m.name} (${m.shopName || m.specialty || ''})`);
                              } else {
                                setNewDebitAccount('حساب بدهکار: تعمیرکار');
                              }
                            } else if (newType === 'supplier') {
                              const s = suppliers[0];
                              if (s) {
                                setDebitPartyId(s.id.toString());
                                setNewDebitAccount(`حساب تامین‌کننده: ${s.name}`);
                              } else {
                                setNewDebitAccount('حساب بدهکار: تامین‌کننده');
                              }
                            } else if (newType === 'treasury') {
                              setDebitPartyId('cash');
                              setNewDebitAccount('صندوق و تنخواه گردان شرکت');
                            } else if (newType === 'expense') {
                              setDebitPartyId('fuel');
                              setNewDebitAccount('هزینه سوخت و بنزین خودرو');
                            }
                          }}
                          className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer border ${
                            debitPartyType === t.id
                              ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                              : 'bg-white dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2d2d30] hover:bg-rose-50 dark:hover:bg-rose-950/30'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* انتخاب حساب متناسب با نوع انتخابی (با جستجوی خلوت و سبک مشابه پذیرش) */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                      انتخاب عنوان {debitPartyType === 'vehicle' ? 'خودرو' : debitPartyType === 'mechanic' ? 'تعمیرکار' : debitPartyType === 'supplier' ? 'تامین‌کننده' : debitPartyType === 'warehouse' ? 'انبار' : 'حساب بدهکار'}:
                    </label>

                    {debitPartyType === 'vehicle' && (
                      <div className="relative">
                        <div
                          onClick={() => setIsDebitPartyDropdownOpen(!isDebitPartyDropdownOpen)}
                          className="w-full p-2 bg-white dark:bg-[#1a1a1c] border border-slate-300 dark:border-[#2d2d30] rounded-md text-xs font-bold flex justify-between items-center cursor-pointer hover:border-rose-400"
                        >
                          <span className="truncate">
                            {(() => {
                              const v = vehicles.find(veh => veh.id.toString() === debitPartyId);
                              return v ? getVehicleDisplayName(v) : 'انتخاب خودرو از لیست ناوگان...';
                            })()}
                          </span>
                          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        </div>

                        {isDebitPartyDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#161618] border border-slate-200 dark:border-[#2d2d30] rounded-md z-50 max-h-48 overflow-y-auto p-1.5 space-y-1 shadow-xl">
                            <input
                              type="text"
                              placeholder="جستجوی نام، راننده یا کد خودرو..."
                              value={debitPartySearch}
                              onChange={e => setDebitPartySearch(e.target.value)}
                              className="w-full p-1.5 bg-slate-50 dark:bg-[#1a1a1c] border border-slate-200 dark:border-[#2d2d30] rounded text-xs font-bold mb-1 focus:outline-none focus:ring-1 focus:ring-rose-500"
                              autoFocus
                            />
                            {vehicles.filter(v => matchesVehicleSearch(v, debitPartySearch)).map(v => (
                              <div
                                key={v.id}
                                onClick={() => {
                                  setDebitPartyId(v.id.toString());
                                  setNewExpenseVehicleId(v.id.toString());
                                  setNewDebitAccount(`خودرو: ${v.name} (${v.driverName || 'بدون راننده'})`);
                                  setIsDebitPartyDropdownOpen(false);
                                  setDebitPartySearch('');
                                }}
                                className="px-2.5 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded cursor-pointer flex justify-between items-center text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 dark:text-white">{v.name}</span>
                                  <span className="text-[10px] text-slate-500">[{v.driverName || 'بدون راننده'}]</span>
                                </div>
                                <span className="text-[10px] bg-slate-100 dark:bg-[#252528] px-1.5 py-0.5 rounded font-mono font-bold text-slate-600 dark:text-slate-300">
                                  کد: {toPersianDigits(v.code)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {debitPartyType === 'mechanic' && (
                      <CustomSelect
                        value={debitPartyId}
                        onChange={(val) => {
                          setDebitPartyId(val);
                          const m = mechanics.find(mech => mech.id.toString() === val);
                          if (m) setNewDebitAccount(`حساب تعمیرکار: ${m.name} (${m.shopName || m.specialty || ''})`);
                        }}
                        options={mechanics.map(m => ({
                          value: m.id.toString(),
                          label: m.shopName ? `${m.name} (${m.shopName})` : m.name
                        }))}
                        searchable={true}
                        quickAddType="mechanic"
                        placeholder="انتخاب تعمیرکار از لیست..."
                      />
                    )}

                    {debitPartyType === 'supplier' && (
                      <CustomSelect
                        value={debitPartyId}
                        onChange={(val) => {
                          setDebitPartyId(val);
                          const s = suppliers.find(sup => sup.id.toString() === val);
                          if (s) setNewDebitAccount(`حساب تامین‌کننده: ${s.name} (${s.category || 'قطعات'})`);
                        }}
                        options={suppliers.map(s => ({
                          value: s.id.toString(),
                          label: `${s.name} - ${s.category || 'تامین‌کننده قطعات'}`
                        }))}
                        searchable={true}
                        quickAddType="supplier"
                        placeholder="انتخاب تامین‌کننده از لیست..."
                      />
                    )}

                    {debitPartyType === 'warehouse' && (
                      <CustomSelect
                        value={debitPartyId || 'main_warehouse'}
                        onChange={(val) => {
                          setDebitPartyId(val);
                          if (val === 'main_warehouse') setNewDebitAccount('انبار مرکزی قطعات و لوازم یدکی');
                          else if (val === 'oil_warehouse') setNewDebitAccount('انبار روغن، فیلتر و روانکارها');
                          else if (val === 'scrap_warehouse') setNewDebitAccount('انبار قطعات داغی و ضایعات');
                        }}
                        options={[
                          { value: 'main_warehouse', label: 'انبار مرکزی قطعات و لوازم یدکی ناوگان' },
                          { value: 'oil_warehouse', label: 'انبار روغن، فیلتر و روانکارهای مصرفی' },
                          { value: 'scrap_warehouse', label: 'انبار قطعات فرسوده و داغی' }
                        ]}
                      />
                    )}

                    {debitPartyType === 'treasury' && (
                      <CustomSelect
                        value={debitPartyId || 'cash'}
                        onChange={(val) => {
                          setDebitPartyId(val);
                          if (val === 'cash') setNewDebitAccount('صندوق و تنخواه گردان شرکت');
                          else if (val === 'bank') setNewDebitAccount('حساب بانکی اصلی شرکت');
                          else if (val === 'driver_cash') setNewDebitAccount('کارت تنخواه راننده');
                          else if (val === 'pos') setNewDebitAccount('دستگاه کارتخوان شرکت');
                        }}
                        options={[
                          { value: 'cash', label: 'صندوق و تنخواه گردان شرکت' },
                          { value: 'bank', label: 'حساب بانکی اصلی شرکت' },
                          { value: 'driver_cash', label: 'کارت تنخواه در اختیار راننده' },
                          { value: 'pos', label: 'دستگاه کارت‌خوان و پوز بانکی' }
                        ]}
                      />
                    )}

                    {debitPartyType === 'expense' && (
                      <CustomSelect
                        value={debitPartyId || 'fuel'}
                        onChange={(val) => {
                          setDebitPartyId(val);
                          if (val === 'fuel') setNewDebitAccount('هزینه سوخت و بنزین خودرو');
                          else if (val === 'oil') setNewDebitAccount('هزینه روغن و سرویس خودرو');
                          else if (val === 'parts') setNewDebitAccount('هزینه قطعات و لوازم یدکی');
                          else if (val === 'insurance') setNewDebitAccount('هزینه بیمه خودرو');
                          else if (val === 'toll') setNewDebitAccount('هزینه عوارض و جریمه');
                          else if (val === 'carwash') setNewDebitAccount('هزینه کارواش و نظافت');
                          else setNewDebitAccount('سایر هزینه‌های ناوگان');
                        }}
                        options={[
                          { value: 'fuel', label: 'هزینه سوخت (بنزین/گازوئیل)' },
                          { value: 'oil', label: 'هزینه روغن و سرویس‌های دوره‌ای' },
                          { value: 'parts', label: 'هزینه قطعات و لوازم یدکی' },
                          { value: 'insurance', label: 'هزینه بیمه و عوارض سالیانه' },
                          { value: 'toll', label: 'هزینه عوارض بزرگراهی و جریمه' },
                          { value: 'carwash', label: 'هزینه کارواش و نظافت' },
                          { value: 'other', label: 'سایر هزینه‌های متفرقه ناوگان' }
                        ]}
                      />
                    )}
                  </div>

                  {/* عنوان معین نهایی بدهکار (قابل ویرایش) */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300 block text-[10px]">
                      عنوان نهایی حساب معین بدهکار در سند: <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newDebitAccount}
                      onChange={(e) => setNewDebitAccount(e.target.value)}
                      placeholder="عنوان حساب معین بدهکار..."
                      className="w-full p-2 bg-white dark:bg-[#1a1a1c] border border-slate-300 dark:border-[#2d2d30] rounded-md focus:outline-none focus:ring-1 focus:ring-rose-500 text-slate-900 dark:text-white text-xs font-bold"
                      required
                    />
                  </div>
                </div>

                {/* کادر طرف بستانکار (Credit Side) */}
                <div className="p-3.5 bg-emerald-50/30 dark:bg-emerald-950/10 rounded-lg border border-emerald-200 dark:border-emerald-900/30 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-200/80 dark:border-emerald-900/30">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                      <span>طرف بستانکار سند (بستانکار شونده / محل پرداخت)</span>
                    </div>
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-mono font-bold">
                      بستانکار (Credit)
                    </span>
                  </div>

                  {/* انتخاب نوع ماهیت بستانکار */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                      نوع طرف حساب بستانکار:
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { id: 'treasury', label: '💳 صندوق / بانک', desc: 'نقدینگی' },
                        { id: 'warehouse', label: '🏢 انبار قطعات', desc: 'کاهش موجودی' },
                        { id: 'mechanic', label: '🔧 تعمیرکار', desc: 'بستانکاران' },
                        { id: 'supplier', label: '🛍️ تامین‌کننده', desc: 'بستانکاران' },
                        { id: 'vehicle', label: '🚗 خودرو', desc: 'طرف بستانکار' },
                        { id: 'expense', label: '📑 سرفصل درآمد/برگشتی', desc: 'تعدیل' },
                        { id: 'other', label: '✍️ سایر', desc: 'دلخواه' },
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            const newType = t.id as any;
                            setCreditPartyType(newType);
                            if (newType === 'treasury') {
                              setCreditPartyId('cash');
                              setNewCreditAccount('صندوق و تنخواه گردان شرکت');
                            } else if (newType === 'warehouse') {
                              setCreditPartyId('main_warehouse');
                              setNewCreditAccount('انبار مرکزی قطعات و لوازم یدکی');
                            } else if (newType === 'mechanic') {
                              const m = mechanics[0];
                              if (m) {
                                setCreditPartyId(m.id.toString());
                                setNewCreditAccount(`حساب بستانکاران: ${m.name} (${m.shopName || 'تعمیرگاه'})`);
                              } else {
                                setNewCreditAccount('حساب بستانکاران: تعمیرگاه');
                              }
                            } else if (newType === 'supplier') {
                              const s = suppliers[0];
                              if (s) {
                                setCreditPartyId(s.id.toString());
                                setNewCreditAccount(`حساب بستانکاران: تامین‌کننده ${s.name}`);
                              } else {
                                setNewCreditAccount('حساب بستانکاران: تامین‌کننده');
                              }
                            } else if (newType === 'vehicle') {
                              const v = vehicles[0];
                              if (v) {
                                setCreditPartyId(v.id.toString());
                                setNewCreditAccount(`خودرو: ${v.name} (${v.driverName || 'بدون راننده'})`);
                              }
                            }
                          }}
                          className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer border ${
                            creditPartyType === t.id
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : 'bg-white dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2d2d30] hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* انتخاب حساب متناسب با نوع بستانکار */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                      انتخاب عنوان {creditPartyType === 'treasury' ? 'صندوق / بانک' : creditPartyType === 'warehouse' ? 'انبار' : creditPartyType === 'mechanic' ? 'تعمیرکار' : creditPartyType === 'supplier' ? 'تامین‌کننده' : 'حساب بستانکار'}:
                    </label>

                    {creditPartyType === 'treasury' && (
                      <CustomSelect
                        value={creditPartyId || 'cash'}
                        onChange={(val) => {
                          setCreditPartyId(val);
                          if (val === 'cash') setNewCreditAccount('صندوق و تنخواه گردان شرکت');
                          else if (val === 'bank') setNewCreditAccount('حساب بانکی اصلی شرکت');
                          else if (val === 'driver_cash') setNewCreditAccount('کارت تنخواه راننده');
                          else if (val === 'pos') setNewCreditAccount('دستگاه کارتخوان شرکت');
                        }}
                        options={[
                          { value: 'cash', label: 'صندوق و تنخواه گردان شرکت' },
                          { value: 'bank', label: 'حساب بانکی اصلی شرکت' },
                          { value: 'driver_cash', label: 'کارت تنخواه در اختیار راننده' },
                          { value: 'pos', label: 'دستگاه کارت‌خوان و پوز بانکی' }
                        ]}
                      />
                    )}

                    {creditPartyType === 'warehouse' && (
                      <CustomSelect
                        value={creditPartyId || 'main_warehouse'}
                        onChange={(val) => {
                          setCreditPartyId(val);
                          if (val === 'main_warehouse') setNewCreditAccount('انبار مرکزی قطعات و لوازم یدکی (کاهش موجودی)');
                          else if (val === 'oil_warehouse') setNewCreditAccount('انبار روغن و روانکارها (کاهش موجودی)');
                          else if (val === 'scrap_warehouse') setNewCreditAccount('انبار ضایعات و داغی');
                        }}
                        options={[
                          { value: 'main_warehouse', label: 'انبار مرکزی قطعات و لوازم یدکی ناوگان' },
                          { value: 'oil_warehouse', label: 'انبار روغن، فیلتر و روانکارهای مصرفی' },
                          { value: 'scrap_warehouse', label: 'انبار قطعات فرسوده و داغی' }
                        ]}
                      />
                    )}

                    {creditPartyType === 'mechanic' && (
                      <CustomSelect
                        value={creditPartyId}
                        onChange={(val) => {
                          setCreditPartyId(val);
                          const m = mechanics.find(mech => mech.id.toString() === val);
                          if (m) setNewCreditAccount(`حساب بستانکاران: ${m.name} (${m.shopName || 'تعمیرگاه'})`);
                        }}
                        options={mechanics.map(m => ({
                          value: m.id.toString(),
                          label: m.shopName ? `${m.name} (${m.shopName})` : m.name
                        }))}
                        searchable={true}
                        quickAddType="mechanic"
                        placeholder="انتخاب تعمیرکار از لیست..."
                      />
                    )}

                    {creditPartyType === 'supplier' && (
                      <CustomSelect
                        value={creditPartyId}
                        onChange={(val) => {
                          setCreditPartyId(val);
                          const s = suppliers.find(sup => sup.id.toString() === val);
                          if (s) setNewCreditAccount(`حساب بستانکاران: تامین‌کننده ${s.name} (${s.category || 'قطعات'})`);
                        }}
                        options={suppliers.map(s => ({
                          value: s.id.toString(),
                          label: `${s.name} - ${s.category || 'تامین‌کننده قطعات'}`
                        }))}
                        searchable={true}
                        quickAddType="supplier"
                        placeholder="انتخاب تامین‌کننده از لیست..."
                      />
                    )}

                    {creditPartyType === 'vehicle' && (
                      <div className="relative">
                        <div
                          onClick={() => setIsCreditPartyDropdownOpen(!isCreditPartyDropdownOpen)}
                          className="w-full p-2 bg-white dark:bg-[#1a1a1c] border border-slate-300 dark:border-[#2d2d30] rounded-md text-xs font-bold flex justify-between items-center cursor-pointer hover:border-emerald-400"
                        >
                          <span className="truncate">
                            {(() => {
                              const v = vehicles.find(veh => veh.id.toString() === creditPartyId);
                              return v ? getVehicleDisplayName(v) : 'انتخاب خودرو از لیست ناوگان...';
                            })()}
                          </span>
                          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        </div>

                        {isCreditPartyDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#161618] border border-slate-200 dark:border-[#2d2d30] rounded-md z-50 max-h-48 overflow-y-auto p-1.5 space-y-1 shadow-xl">
                            <input
                              type="text"
                              placeholder="جستجوی نام، راننده یا کد خودرو..."
                              value={creditPartySearch}
                              onChange={e => setCreditPartySearch(e.target.value)}
                              className="w-full p-1.5 bg-slate-50 dark:bg-[#1a1a1c] border border-slate-200 dark:border-[#2d2d30] rounded text-xs font-bold mb-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              autoFocus
                            />
                            {vehicles.filter(v => matchesVehicleSearch(v, creditPartySearch)).map(v => (
                              <div
                                key={v.id}
                                onClick={() => {
                                  setCreditPartyId(v.id.toString());
                                  setNewCreditAccount(`خودرو: ${v.name} (${v.driverName || 'بدون راننده'})`);
                                  setIsCreditPartyDropdownOpen(false);
                                  setCreditPartySearch('');
                                }}
                                className="px-2.5 py-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded cursor-pointer flex justify-between items-center text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 dark:text-white">{v.name}</span>
                                  <span className="text-[10px] text-slate-500">[{v.driverName || 'بدون راننده'}]</span>
                                </div>
                                <span className="text-[10px] bg-slate-100 dark:bg-[#252528] px-1.5 py-0.5 rounded font-mono font-bold text-slate-600 dark:text-slate-300">
                                  کد: {toPersianDigits(v.code)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* عنوان معین نهایی بستانکار (قابل ویرایش) */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300 block text-[10px]">
                      عنوان نهایی حساب معین بستانکار در سند: <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newCreditAccount}
                      onChange={(e) => setNewCreditAccount(e.target.value)}
                      placeholder="عنوان حساب معین بستانکار..."
                      className="w-full p-2 bg-white dark:bg-[#1a1a1c] border border-slate-300 dark:border-[#2d2d30] rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 dark:text-white text-xs font-bold"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* بخش ۳: اطلاعات تکمیلی (روش پرداخت، شماره پیگیری و شرح سند) */}
            <div className="p-3.5 bg-slate-50 dark:bg-[#151518] rounded-lg border border-slate-200 dark:border-[#2d2d30] space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* روش پرداخت و تسویه */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                    نحوه تسویه و پرداخت
                  </label>
                  <CustomSelect
                    value={newPaymentMethod}
                    onChange={(val) => setNewPaymentMethod(val)}
                    options={[
                      { value: 'cash', label: 'پرداخت نقدی / تنخواه گردان' },
                      { value: 'card', label: 'کارت‌خوان / پوز بانکی' },
                      { value: 'transfer', label: 'حواله پایا / ساتنا / کارت به کارت' },
                      { value: 'credit', label: 'اعتباری / دفتری / چک' }
                    ]}
                  />
                </div>

                {/* شماره پیگیری یا فاکتور */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                    شماره پیگیری تراکنش / فاکتور پیوست
                  </label>
                  <input
                    type="text"
                    value={newReferenceNumber}
                    onChange={(e) => setNewReferenceNumber(e.target.value)}
                    placeholder="مثال: پیگیری ۱۲۳۴۵۶ یا فاکتور ۸۸۹"
                    className="w-full p-2 bg-white dark:bg-[#1a1a1c] border border-slate-300 dark:border-[#2d2d30] rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* شرح سند */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  شرح کامل سند حسابداری (بابت) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newExpenseDescription}
                  onChange={(e) => setNewExpenseDescription(e.target.value)}
                  placeholder="بابت خرید بنزین / تعویض قطعه از انبار / دستمزد تعمیرگاه و..."
                  className="w-full p-2 bg-white dark:bg-[#1a1a1c] border border-slate-300 dark:border-[#2d2d30] rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white text-xs font-bold"
                  required
                />
              </div>

              {/* نوار نمایش تراز حسابداری و مبلغ حروفی */}
              {parsedCostNum > 0 && (
                <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-lg border border-indigo-200 dark:border-indigo-900/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="font-bold text-slate-900 dark:text-white">
                        تراز حسابداری: <strong className="text-rose-600 dark:text-rose-400">بدهکار ({formatPrice(parsedCostNum)})</strong> = <strong className="text-emerald-600 dark:text-emerald-400">بستانکار ({formatPrice(parsedCostNum)} ریال)</strong>
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      مبلغ حروفی: <strong className="text-slate-800 dark:text-slate-200">{numberToPersianWords(parsedCostNum)} ریال</strong>
                    </div>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-[10px] text-slate-400 block font-bold">معادل به تومان:</span>
                    <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                      {formatPrice(Math.round(parsedCostNum / 10))} تومان
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* فوتر و دکمه‌های تایید و انصراف */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-[#2d2d30]">
              <button 
                type="button" 
                onClick={() => setIsAddExpenseModalOpen(false)} 
                className="px-3.5 py-2 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-400 font-bold rounded-md transition-colors border border-slate-200 dark:border-[#2d2d30] text-xs cursor-pointer"
              >
                انصراف
              </button>
              <button 
                type="submit" 
                disabled={isSubmittingExpense}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md transition-colors active:scale-95 text-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSubmittingExpense ? 'در حال ثبت سند...' : 'تایید و ثبت سند حسابداری'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      
      {/* ۱. هدر بالای صفحه حسابداری و کاردکس مالی ناوگان */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-[#111113] p-4 rounded-lg border border-slate-200 dark:border-[#2d2d30]">
        <div>
          <h1 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Wallet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            حسابداری و کاردکس مالی ناوگان
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            صورت‌وضعیت مالی خودروها، تسویه‌حساب و کاردکس تعمیرکاران و مطالبات تامین‌کنندگان قطعات
          </p>
        </div>

        {/* دکمه ثبت پرداخت/تسویه برای تب‌های تعمیرکاران و تامین‌کنندگان در بالای صفحه */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {accountingTab === 'mechanic' && (
            <button
              onClick={() => setIsMechanicPaymentModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="ثبت سند پرداخت وجه یا تسویه به تعمیرکار"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ثبت پرداخت / تسویه</span>
            </button>
          )}

          {accountingTab === 'supplier' && (
            <button
              onClick={() => setIsSupplierPaymentModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="ثبت سند پرداخت وجه یا تسویه به تامین‌کننده"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ثبت پرداخت / تسویه</span>
            </button>
          )}
        </div>
      </div>

      {/* تب‌های جابجایی بین بخش‌های حسابداری با ترنزیشن نرم و متحرک (دقیقاً مشابه بخش استعلام) */}
      <div className="flex border-b border-slate-200 dark:border-[#2d2d30] gap-2 overflow-x-auto relative">
        <button
          type="button"
          onClick={() => setAccountingTab('vehicle')}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            accountingTab === 'vehicle'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>حساب مالی خودروها</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 font-mono font-bold">
            {toPersianDigits(vehicles.length)}
          </span>
          {accountingTab === 'vehicle' && (
            <motion.div
              layoutId="activeAccountingTabIndicator"
              className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => setAccountingTab('mechanic')}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            accountingTab === 'mechanic'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>حساب تعمیرکاران و تعمیرگاه‌ها</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 font-mono font-bold">
            {toPersianDigits(mechanics?.length || 0)}
          </span>
          {accountingTab === 'mechanic' && (
            <motion.div
              layoutId="activeAccountingTabIndicator"
              className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => setAccountingTab('supplier')}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            accountingTab === 'supplier'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>حساب تامین‌کنندگان کالا و قطعات</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 font-mono font-bold">
            {toPersianDigits(suppliers?.length || 0)}
          </span>
          {accountingTab === 'supplier' && (
            <motion.div
              layoutId="activeAccountingTabIndicator"
              className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => setAccountingTab('all_entities')}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            accountingTab === 'all_entities'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>صورتحساب کلی</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 font-mono font-bold">
            {toPersianDigits(vehicles.length + (mechanics?.length || 0) + (suppliers?.length || 0))}
          </span>
          {accountingTab === 'all_entities' && (
            <motion.div
              layoutId="activeAccountingTabIndicator"
              className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>
      </div>

      {/* تب حساب مالی خودروها */}
      <div className={accountingTab === 'vehicle' ? 'space-y-4' : 'hidden'}>
        {/* ۲. نوار جستجو (فقط نام خودرو) و فیلترهای تاریخ */}
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
                  setVehicleFilter('');
                }
                setIsSearchOpen(true);
              }}
              className={`w-full h-[34px] bg-white dark:bg-[#111113] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg pr-9 pl-8 py-0 text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs ${
                activeVehicle ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20' : 'border-slate-300 dark:border-[#2d2d30]'
              }`}
            />
            {(searchTerm || activeVehicle) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setVehicleFilter('');
                  setIsSearchOpen(false);
                }}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="پاک کردن انتخاب"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* لیست پیشنهادات جستجوی نام خودروها (ساده، خلوت و سریع مشابه بخش پذیرش) */}
          {isSearchOpen && (
            <div className="absolute top-full right-0 left-0 mt-1.5 bg-white dark:bg-[#151518] rounded-xl border border-slate-200 dark:border-[#2d2d30] shadow-2xl overflow-hidden max-h-72 overflow-y-auto z-50 animate-in fade-in zoom-in-95 duration-150">
              
              <div className="px-3 py-1.5 bg-slate-50 dark:bg-[#1a1a1e] border-b border-slate-200 dark:border-[#2d2d30] flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                <span>{searchTerm.trim() ? `خودروهای منطبق با «${searchTerm}»` : 'لیست خودروها (جهت انتخاب کلیک کنید)'}</span>
                <span>{toPersianDigits(matchedVehiclesWithStats.length)} خودرو</span>
              </div>

              {matchedVehiclesWithStats.length === 0 ? (
                <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-xs font-bold space-y-1">
                  <p>هیچ خودرویی با نام «{searchTerm}» یافت نشد.</p>
                  <p className="text-[10px] text-slate-400 font-normal">لطفاً املای نام خودرو را بررسی کنید یا حروف دیگری را وارد نمایید.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-[#242428]">
                  {matchedVehiclesWithStats.map(({ vehicle: v }) => {
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

        {/* فیلتر از تاریخ با تقویم شمسی */}
        <div className="w-full sm:w-36">
          <JalaliDatePicker
            value={startDate}
            onChange={setStartDate}
            placeholder="از تاریخ"
            inputClassName="h-[34px] text-[11px]"
          />
        </div>

        {/* فیلتر تا تاریخ با تقویم شمسی */}
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
            disabled={!activeVehicle}
            className={`h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg border transition-all cursor-pointer shadow-2xs shrink-0 group ${
              activeVehicle
                ? 'bg-white dark:bg-[#111113] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border-slate-300 dark:border-[#2d2d30] hover:border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'bg-slate-50 dark:bg-[#151518] text-slate-400 dark:text-slate-600 border-slate-200 dark:border-[#2d2d30] opacity-60 cursor-not-allowed'
            }`}
            title={activeVehicle ? 'چاپ صورتحساب رسمی این خودرو' : 'ابتدا یک خودرو را انتخاب کنید'}
          >
            <Printer className="w-4 h-4 transition-transform group-hover:scale-110" />
          </button>
        </div>
      </div>

      {/* ۳. بخش اصلی صفحه: اگر خودرویی انتخاب نشده باشد، صفحه راهنمای جستجو نمایش می‌یابد */}
      {!activeVehicle ? (
        <div className="bg-white dark:bg-[#111113] rounded-2xl border border-slate-200 dark:border-[#2d2d30] p-8 sm:p-12 text-center shadow-xs animate-in fade-in duration-300">
          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              جستجو و مشاهده صورتحساب مالی خودرو
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              برای مشاهده کاردکس مالی، ریز فاکتورها، هزینه‌های سرویس و تعمیرات، لطفاً نام خودرو را در کادر بالا تایپ و انتخاب فرمایید.
            </p>
          </div>
        </div>
      ) : (
        /* وقتی خودرویی انتخاب شده است: نمایش مستقیم و تمیز جدول صورتحساب و کاردکس مالی خودرو */
        <div className="space-y-4 animate-in fade-in duration-300">

          {/* جدول ریز فاکتورها و کاردکس اسناد مالی خودرو با استایل پذیرش خودرو */}
          <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex justify-between items-center">
              <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
                <List className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>ریز اسناد و صورتحساب مالی: {activeVehicle.name}</span>
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
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                  <Receipt className="w-3 h-3" />
                  هزینه کل: {formatPrice(totals.grandTotal)}
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
                      width="120px"
                    />

                    {/* ۶. بدهکار */}
                    <TableColumnHeader
                      title="بدهکار"
                      colKey="debit"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      isFiltered={!!columnFilters['debit']}
                      onOpenFilter={handleHeaderContextMenu}
                      align="center"
                      width="120px"
                    />

                    {/* ۷. مانده */}
                    <TableColumnHeader
                      title="مانده"
                      colKey="runningBalance"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      isFiltered={!!columnFilters['runningBalance']}
                      onOpenFilter={handleHeaderContextMenu}
                      align="center"
                      width="130px"
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-[#2d2d30]/60">
                  {sortedStatementItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-500 dark:text-slate-400 text-xs">
                        هیچ سند یا فاکتوری در این بازه تاریخی برای این خودرو یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    sortedStatementItems.map((item, idx) => {
                      const debitVal = item.debit !== undefined ? item.debit : item.cost;
                      const creditVal = item.credit !== undefined ? item.credit : 0;
                      const balanceVal = item.runningBalance ?? (debitVal - creditVal);

                      return (
                        <tr 
                          key={item.id} 
                          onClick={() => setViewDetailItem(item)}
                          className="h-9 hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/60 transition-colors cursor-pointer text-[11px]"
                          title="برای مشاهده جزئیات کامل سند کلیک کنید"
                        >
                          {/* ردیف */}
                          <td className="py-1 px-3 text-center text-slate-500 dark:text-slate-400 text-[11px] align-middle">
                            {toPersianDigits(idx + 1)}
                          </td>

                          {/* ۱. تاریخ به صورت شمسی و فارسی */}
                          <td className="py-1 px-3 text-center text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap align-middle">
                            {toJalaliDate(item.date)}
                          </td>

                          {/* ۲. ملاحظات */}
                          <td className="py-1 px-3 text-right text-slate-800 dark:text-slate-200 text-[11px] align-middle">
                            <div className="truncate max-w-xs md:max-w-md font-medium">
                              {item.description || (item.categoryType === 'expense' && item.title === 'پرداخت وجه / تسویه' ? 'بابت تسویه و واریز وجه' : `سند ${item.categoryLabel} خودرو ${item.vehicleName || ''}`)}
                              {item.documentNumber ? ` [سند: ${toPersianDigits(item.documentNumber)}]` : ''}
                              {item.details?.serviceKm ? ` (کیلومتر: ${toPersianDigits(item.details.serviceKm)})` : ''}
                              {item.details?.referenceNumber ? ` (رسید: ${toPersianDigits(item.details.referenceNumber)})` : ''}
                            </div>
                          </td>

                          {/* ۳. نام خدمت */}
                          <td className="py-1 px-3 text-right text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap align-middle">
                            <span className="truncate max-w-[160px] block" title={item.title || item.categoryLabel}>
                              {item.title || item.categoryLabel}
                            </span>
                          </td>

                          {/* ۴. مقدار */}
                          <td className="py-1 px-3 text-center text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap align-middle">
                            {item.quantity ? (
                              <span>{toPersianDigits(item.quantity)}</span>
                            ) : (
                              <span>{toPersianDigits(1)}</span>
                            )}
                          </td>

                          {/* ۵. قیمت واحد */}
                          <td className="py-1 px-3 text-center text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap align-middle font-mono">
                            {item.unitPrice ? formatPrice(item.unitPrice) : (item.cost ? formatPrice(item.cost) : '۰')}
                          </td>

                          {/* ۶. بدهکار */}
                          <td className="py-1 px-3 text-center text-slate-800 dark:text-slate-200 text-[11px] whitespace-nowrap align-middle font-mono font-medium">
                            {debitVal > 0 ? formatPrice(debitVal) : '۰'}
                          </td>

                          {/* ۷. مانده */}
                          <td className="py-1 px-3 text-center text-slate-800 dark:text-slate-200 text-[11px] whitespace-nowrap align-middle font-mono font-medium">
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
                {/* پاورقی جدول با جمع ستون‌های بدهکار و مانده دقیقاً زیر ستون‌های خودشان */}
                {sortedStatementItems.length > 0 && (
                  <tfoot className="sticky bottom-0 z-10 bg-slate-100 dark:bg-[#1a1a1d] border-t-2 border-slate-300 dark:border-[#38383e] font-mono font-bold text-xs text-slate-400 dark:text-slate-500">
                    <tr>
                      <td colSpan={6} className="py-2.5 px-3 text-left font-mono font-bold text-slate-400 dark:text-slate-500 text-xs">
                        جمع کل کاردکس مالی:
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400 dark:text-slate-500 text-xs whitespace-nowrap">
                        {formatPrice(totals.totalDebit)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400 dark:text-slate-500 text-xs whitespace-nowrap">
                        <span dir="ltr">
                          {totals.grandTotal < 0 ? `- ${formatPrice(Math.abs(totals.grandTotal))}` : formatPrice(totals.grandTotal)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* تب حساب تعمیرکاران */}
      <div className={accountingTab === 'mechanic' ? 'space-y-4' : 'hidden'}>
        <MechanicAccountingView
          mechanics={mechanics}
          workflows={workflows}
          failures={failures}
          services={services}
          vehicles={vehicles}
          expenses={expenses}
          onAddExpense={onAddExpense}
          isExternalPaymentModalOpen={isMechanicPaymentModalOpen}
          onClosePaymentModal={() => setIsMechanicPaymentModalOpen(false)}
          selectedMechanicKey={selectedMechanicKey}
          onSelectMechanicKey={setSelectedMechanicKey}
        />
      </div>

      {/* تب حساب تامین‌کنندگان */}
      <div className={accountingTab === 'supplier' ? 'space-y-4' : 'hidden'}>
        <SupplierAccountingView
          suppliers={suppliers}
          inventoryTransactions={inventoryTransactions}
          services={services}
          vehicles={vehicles}
          expenses={expenses}
          parts={parts}
          onAddExpense={onAddExpense}
          isExternalPaymentModalOpen={isSupplierPaymentModalOpen}
          onClosePaymentModal={() => setIsSupplierPaymentModalOpen(false)}
          selectedSupplierKey={selectedSupplierKey}
          onSelectSupplierKey={setSelectedSupplierKey}
        />
      </div>

      {/* تب صورتحساب کلی و جامع همه طرف‌حساب‌ها (مشتریان، خودروها، تعمیرکاران و تامین‌کنندگان) */}
      <div className={accountingTab === 'all_entities' ? 'space-y-4' : 'hidden'}>
        <ComprehensiveAccountingView
          vehicles={vehicles}
          mechanics={mechanics}
          suppliers={suppliers}
          expenses={expenses}
          services={services}
          insurances={insurances}
          failures={failures}
          workflows={workflows}
          parts={parts}
          inventoryTransactions={inventoryTransactions}
          onAddExpense={onAddExpense}
          onNavigateToTab={(tab, entityKey) => {
            if (tab === 'vehicle' && entityKey) {
              const foundVeh = vehicles.find(v => v.id.toString() === entityKey);
              if (foundVeh) {
                setVehicleFilter(foundVeh.name);
                setSearchTerm(foundVeh.name);
              }
              setAccountingTab('vehicle');
            } else if (tab === 'mechanic' && entityKey) {
              setSelectedMechanicKey(entityKey);
              setAccountingTab('mechanic');
            } else if (tab === 'supplier' && entityKey) {
              setSelectedSupplierKey(entityKey);
              setAccountingTab('supplier');
            } else {
              setAccountingTab(tab);
            }
          }}
        />
      </div>

      {/* مدال ویرایش سند مالی خودرو (سبک استاندارد و ست با مودال پذیرش) */}
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
                    <span>ویرایش سند مالی خودرو</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded border bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30">
                      {editingItem.categoryLabel}
                    </span>
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                    خودرو: {editingItem.vehicleName} | پلاک: {toPersianDigits(editingItem.vehiclePlaque)} | کد: {toPersianDigits(editingItem.vehicleCode)}
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
                {/* کارت مشخصات خودرو */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50/80 dark:bg-[#161618]/80 p-3.5 rounded-xl border border-slate-200 dark:border-[#2d2d30]">
                  <div>
                    <span className="text-slate-500 text-[11px] block mb-0.5">خودرو:</span>
                    <strong className="text-slate-900 dark:text-white font-bold text-xs">{editingItem.vehicleName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block mb-0.5">شماره پلاک:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">{toPersianDigits(editingItem.vehiclePlaque)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block mb-0.5">سرفصل مالی:</span>
                    <span className="text-slate-800 dark:text-slate-200 font-bold">{editingItem.categoryLabel}</span>
                  </div>
                </div>

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
                      عنوان خدمت یا کالا <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full h-[38px] px-3 border border-slate-300 dark:border-[#2d2d30] rounded-lg bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white font-bold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    مبلغ هزینه / سند (ریال) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editCost ? formatPrice(parsePersianNumber(editCost)) : ''}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/,/g, '');
                      setEditCost(clean);
                    }}
                    className="w-full h-[38px] px-3 border border-slate-300 dark:border-[#2d2d30] rounded-lg bg-white dark:bg-[#1a1a1c] font-mono font-black text-rose-600 dark:text-rose-400 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-left"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    شرح و ملاحظات فاکتور
                  </label>
                  <textarea
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full p-3 border border-slate-300 dark:border-[#2d2d30] rounded-xl bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="شرح جزئیات، نام فروشگاه/تعمیرگاه، شماره سند یا توضیحات اضافی..."
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
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50 text-xs shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingEdit ? 'در حال ذخیره...' : 'ذخیره تغییرات'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* مدال مشاهده جزئیات کامل فاکتور / سند مالی (سبک استاندارد و ست با مودال پذیرش) */}
      {viewDetailItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* هدر مدال هماهنگ با سرویس دوره‌ای و پذیرش */}
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg border ${
                  viewDetailItem.categoryType === 'service' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30' :
                  viewDetailItem.categoryType === 'repair' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30' :
                  viewDetailItem.categoryType === 'insurance' ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/30' :
                  'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                }`}>
                  {viewDetailItem.categoryType === 'service' && <Package className="w-5 h-5" />}
                  {viewDetailItem.categoryType === 'repair' && <Wrench className="w-5 h-5" />}
                  {viewDetailItem.categoryType === 'insurance' && <Shield className="w-5 h-5" />}
                  {viewDetailItem.categoryType === 'expense' && <Fuel className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <span>جزئیات کامل سند مالی و کاردکس</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded border bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30">
                      {viewDetailItem.categoryLabel}
                    </span>
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                    تاریخ سند: {toJalaliDate(viewDetailItem.date)} | شناسه پیگیری: #{toPersianDigits(viewDetailItem.sourceId || viewDetailItem.id)}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setViewDetailItem(null)} 
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* بدنه اسکرول‌پذیر با کارت‌های منظم و شیک */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* ۱. کارت اطلاعات کلی خودرو و راننده */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/80 dark:bg-[#161618]/80 p-4 rounded-xl border border-slate-200 dark:border-[#2d2d30]">
                <div>
                  <span className="text-slate-500 text-[11px] block mb-0.5">نام خودرو:</span>
                  <strong className="text-slate-900 dark:text-white font-extrabold text-sm">
                    {viewDetailItem.vehicleName}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block mb-0.5">شماره پلاک:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                    {toPersianDigits(viewDetailItem.vehiclePlaque)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block mb-0.5">نام راننده / تحویل‌گیرنده:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-medium">
                    {viewDetailItem.driverName || '---'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block mb-0.5">کد اختصاصی:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                    {toPersianDigits(viewDetailItem.vehicleCode)}
                  </span>
                </div>
              </div>

              {/* ۲. کارت سند دوبل حسابداری (طرف بدهکار و بستانکار) */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 border-r-2 border-indigo-500 pr-2">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                    ارتباط حسابداری و اسناد دوطرفه (بدهکار / بستانکار)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 bg-rose-50/40 dark:bg-rose-950/15 rounded-xl border border-rose-200 dark:border-rose-900/30">
                    <span className="text-rose-700 dark:text-rose-300 text-[11px] block mb-1 font-bold">
                      حساب بدهکار (افزایش هزینه / استهلاک خودرو):
                    </span>
                    <strong className="text-slate-900 dark:text-white block font-bold text-xs">
                      {viewDetailItem.debitAccount || `خودرو ${viewDetailItem.vehicleName}`}
                    </strong>
                    <div className="font-mono text-xs text-rose-600 dark:text-rose-400 font-black mt-1.5">
                      مبلغ بدهکار: {formatPrice(viewDetailItem.debit !== undefined ? viewDetailItem.debit : viewDetailItem.cost)} ریال
                    </div>
                  </div>
                  <div className="p-3.5 bg-emerald-50/40 dark:bg-emerald-950/15 rounded-xl border border-emerald-200 dark:border-emerald-900/30">
                    <span className="text-emerald-700 dark:text-emerald-300 text-[11px] block mb-1 font-bold">
                      حساب بستانکار (تعمیرکار / تامین‌کننده / انبار):
                    </span>
                    <strong className="text-slate-900 dark:text-white block font-bold text-xs">
                      {viewDetailItem.creditAccount || 'صندوق و تنخواه شرکت'}
                    </strong>
                    <div className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-black mt-1.5">
                      ارزش کل بستانکاری: {formatPrice(viewDetailItem.cost)} ریال
                    </div>
                  </div>
                </div>
              </div>

              {/* ۳. کارت اطلاعات خدمت و مرکز مجری */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-indigo-50/50 dark:bg-indigo-950/20 p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-500/20">
                <div>
                  <span className="text-slate-500 text-[11px] block mb-0.5">عنوان سند / فاکتور:</span>
                  <strong className="text-indigo-950 dark:text-indigo-200 font-bold text-xs">
                    {viewDetailItem.title}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block mb-0.5">تعمیرگاه / تامین‌کننده مجری:</span>
                  <strong className="text-indigo-950 dark:text-indigo-200 font-bold text-xs">
                    {viewDetailItem.details?.repairShopName || viewDetailItem.details?.mechanicName || viewDetailItem.details?.supplierName || 'تعمیرگاه مرکزی / تنخواه'}
                  </strong>
                </div>
              </div>

              {/* ۴. شرح کامل خدمات */}
              {viewDetailItem.description && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 border-r-2 border-indigo-500 pr-2">
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                      شرح کامل خدمات و توضیحات فاکتور:
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-[#161618] border border-slate-200 dark:border-[#2d2d30] rounded-xl p-3 text-slate-800 dark:text-slate-200 leading-relaxed text-xs">
                    {viewDetailItem.description}
                  </div>
                </div>
              )}

              {/* ۵. جزئیات اختصاصی تعمیرات (قطعات انبار، قطعات تعمیرگاه و اجرت) */}
              {viewDetailItem.categoryType === 'repair' && viewDetailItem.details && (
                <div className="space-y-3">
                  {viewDetailItem.details.warehouseParts && viewDetailItem.details.warehouseParts.length > 0 && (
                    <div className="border border-slate-200 dark:border-[#2d2d30] rounded-xl overflow-hidden">
                      <div className="bg-slate-100 dark:bg-[#1a1a1e] p-2.5 flex items-center justify-between border-b border-slate-200 dark:border-[#2d2d30]">
                        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-xs">
                          <Package className="w-4 h-4 text-indigo-500" />
                          <span>قطعات تأمین‌شده از انبار مرکزی شرکت</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 font-bold">
                          {toPersianDigits(viewDetailItem.details.warehouseParts.length)} قلم کالا
                        </span>
                      </div>
                      <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                        <thead className="bg-slate-50 dark:bg-[#161618] text-slate-600 dark:text-slate-400 font-medium text-xs border-b border-slate-200 dark:border-[#2d2d30]">
                          <tr>
                            <th className="py-2 px-3 text-xs font-medium">نام قطعه</th>
                            <th className="py-2 px-3 text-center w-24 text-xs font-medium">تعداد</th>
                            <th className="py-2 px-3 text-left w-36 text-xs font-medium">جمع ردیف (ریال)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                          {viewDetailItem.details.warehouseParts.map((wp, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-[#1a1a1c]/40 text-[11px]">
                              <td className="py-1.5 px-3 text-slate-900 dark:text-white">{wp.name}</td>
                              <td className="py-1.5 px-3 text-center text-slate-700 dark:text-slate-300">{toPersianDigits(wp.qty)}</td>
                              <td className="py-1.5 px-3 text-left text-slate-800 dark:text-slate-200">{formatPrice(wp.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {viewDetailItem.details.shopParts && viewDetailItem.details.shopParts.length > 0 && (
                    <div className="border border-slate-200 dark:border-[#2d2d30] rounded-xl overflow-hidden">
                      <div className="bg-slate-100 dark:bg-[#1a1a1e] p-2.5 flex items-center justify-between border-b border-slate-200 dark:border-[#2d2d30]">
                        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-medium text-xs">
                          <Wrench className="w-4 h-4 text-indigo-500" />
                          <span>قطعات خریداری شده توسط تعمیرگاه (خرید آزاد)</span>
                        </div>
                        <span className="text-[10px] text-slate-600 dark:text-slate-400">
                          {toPersianDigits(viewDetailItem.details.shopParts.length)} قلم کالا
                        </span>
                      </div>
                      <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                        <thead className="bg-slate-50 dark:bg-[#161618] text-slate-600 dark:text-slate-400 font-medium text-xs border-b border-slate-200 dark:border-[#2d2d30]">
                          <tr>
                            <th className="py-2 px-3 text-xs font-medium">نام قطعه</th>
                            <th className="py-2 px-3 text-center w-24 text-xs font-medium">تعداد</th>
                            <th className="py-2 px-3 text-left w-36 text-xs font-medium">جمع ردیف (ریال)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                          {viewDetailItem.details.shopParts.map((sp, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-[#1a1a1c]/40 text-[11px]">
                              <td className="py-1.5 px-3 text-slate-900 dark:text-white">{sp.name}</td>
                              <td className="py-1.5 px-3 text-center text-slate-700 dark:text-slate-300">{toPersianDigits(sp.qty)}</td>
                              <td className="py-1.5 px-3 text-left text-slate-800 dark:text-slate-200">{formatPrice(sp.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ۶. اطلاعات کارکرد و پیش‌بینی سرویس دوره‌ای */}
              {viewDetailItem.categoryType === 'service' && viewDetailItem.details && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {viewDetailItem.details.serviceKm !== undefined && (
                    <div className="p-3 bg-slate-50 dark:bg-[#161619] rounded-xl border border-slate-200 dark:border-[#2d2d30]">
                      <span className="text-slate-500 block text-[11px] mb-0.5">کیلومتر هنگام ثبت:</span>
                      <strong className="font-mono text-slate-900 dark:text-white text-xs">{formatKm(viewDetailItem.details.serviceKm)}</strong>
                    </div>
                  )}
                  {viewDetailItem.details.nextKm !== undefined && (
                    <div className="p-3 bg-slate-50 dark:bg-[#161619] rounded-xl border border-slate-200 dark:border-[#2d2d30]">
                      <span className="text-slate-500 block text-[11px] mb-0.5">کیلومتر پیش‌بینی سرویس بعدی:</span>
                      <strong className="font-mono text-slate-900 dark:text-white text-xs">{formatKm(viewDetailItem.details.nextKm)}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* ۷. کارت مالی جمع کل فاکتور هماهنگ با سرویس دوره‌ای و پذیرش */}
              <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/20 p-4 rounded-xl flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-slate-700 dark:text-slate-300 font-bold text-xs">مبلغ کل فاکتور و صورت‌حساب مالی:</span>
                  {viewDetailItem.details?.wages !== undefined && viewDetailItem.details.wages > 0 && (
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      (شامل {formatPrice(viewDetailItem.details.wages)} ریال اجرت و دستمزد تخصصی)
                    </span>
                  )}
                </div>
                <div className="text-emerald-700 dark:text-emerald-400 font-mono font-black text-base">
                  {formatPrice(viewDetailItem.cost)} <span className="text-xs font-normal text-slate-600 dark:text-slate-400">ریال</span>
                </div>
              </div>
            </div>

            {/* فوتر مدال هماهنگ با پذیرش */}
            <div className="flex justify-between items-center p-4 border-t border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] shrink-0">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                سرفصل: {viewDetailItem.categoryLabel}
              </span>
              <button
                type="button"
                onClick={() => setViewDetailItem(null)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ۷. بخش چاپ رسمی صورتحساب حسابداری */}
      {activeVehicle && (
        <div id="printable-accounting-statement" className="hidden print:block text-black bg-white p-6 rounded-2xl w-full dir-rtl font-sans">
          <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-black text-white rounded-xl flex items-center justify-center font-black text-xl">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-black tracking-tight">صورتحساب و کاردکس مالی خودرو</h1>
                <p className="text-xs text-black mt-1">مدیریت ناوگان خودرویی یاس - سند رسمی مالی و هزینه</p>
              </div>
            </div>
            <div className="text-left font-mono text-xs space-y-1 p-2.5 rounded-xl border border-black min-w-[170px]">
              <div><span className="font-bold">تاریخ چاپ:</span> {toPersianDigits(getCurrentJalaliDate())}</div>
              <div><span className="font-bold">محدوده حساب:</span> {activeVehicle.name}</div>
              <div><span className="font-bold">تعداد اسناد:</span> {toPersianDigits(sortedStatementItems.length)} ردیف</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl border border-black mb-4 font-sans text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] text-black block">نام خودرو</span>
              <span className="font-bold text-black text-sm">{activeVehicle.name}</span>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-black block">شماره پلاک</span>
              <span className="font-mono font-bold text-black text-sm">{toPersianDigits(activeVehicle.plaque)}</span>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-black block">کد اختصاصی</span>
              <span className="font-mono font-bold text-black text-sm">{toPersianDigits(activeVehicle.code)}</span>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <div className="overflow-hidden rounded-xl border border-black">
              <table className="w-full text-right border-collapse text-xs font-mono font-bold">
                <thead>
                  <tr className="border-b border-black font-mono font-bold text-xs bg-slate-100">
                    <th className="py-2 px-3 w-10 text-center border-l border-black text-xs font-mono font-bold">#</th>
                    <th className="py-2 px-3 border-l border-black w-24 text-xs font-mono font-bold">تاریخ</th>
                    <th className="py-2 px-3 border-l border-black w-28 text-xs font-mono font-bold">سرفصل</th>
                    <th className="py-2 px-3 border-l border-black text-xs font-mono font-bold">عنوان خدمت / فاکتور</th>
                    <th className="py-2 px-3 border-l border-black text-xs font-mono font-bold">شرح خدمات</th>
                    <th className="py-2 px-3 text-left w-32 text-xs font-mono font-bold">مبلغ (ریال)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black">
                  {sortedStatementItems.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="py-2 px-3 text-center font-mono font-bold border-l border-black">{toPersianDigits(idx + 1)}</td>
                      <td className="py-2 px-3 font-mono border-l border-black">{toJalaliDate(item.date)}</td>
                      <td className="py-2 px-3 font-bold border-l border-black">{item.categoryLabel}</td>
                      <td className="py-2 px-3 font-bold border-l border-black">{item.title}</td>
                      <td className="py-2 px-3 border-l border-black">{item.description}</td>
                      <td className="py-2 px-3 text-left font-mono font-black">{formatPrice(item.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between items-center p-3.5 rounded-xl border border-black mb-6">
            <span className="font-bold text-sm">مجموع کل صورتحساب:</span>
            <span className="font-mono text-base font-black">{formatPrice(sortedStatementItems.reduce((acc, i) => acc + i.cost, 0))} ریال</span>
          </div>

          <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs text-black">
            <div className="p-4 rounded-xl border border-black space-y-10">
              <div className="font-bold">امضاء و تأیید حسابداری و مالی</div>
              <div className="border-b border-dashed border-black w-3/4 mx-auto"></div>
            </div>
            <div className="p-4 rounded-xl border border-black space-y-10">
              <div className="font-bold">امضاء مدیر امور ناوگان و ترابری</div>
              <div className="border-b border-dashed border-black w-3/4 mx-auto"></div>
            </div>
          </div>
        </div>
      )}

      {/* منوی کلیک راست فیلتر سرفصل‌ها و ستون‌های جدول */}
      {filterMenu && (
        <div 
          ref={filterMenuRef}
          style={{ top: `${filterMenu.y}px`, left: `${filterMenu.x}px` }}
          className="fixed z-50 w-72 bg-white dark:bg-[#18181b] border border-slate-300 dark:border-[#38383e] rounded-xl shadow-2xl p-3 text-right animate-in fade-in zoom-in-95 duration-150 select-none"
        >
          {/* سربرگ منوی فیلتر ستون */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#2d2d30] mb-2">
            <div className="flex items-center gap-1.5 font-extrabold text-xs text-slate-900 dark:text-white">
              <Filter className="w-3.5 h-3.5 text-indigo-500" />
              <span>فیلتر ستون: {filterMenu.colTitle}</span>
            </div>
            <button 
              onClick={() => setFilterMenu(null)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-colors cursor-pointer"
              title="بستن"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* کادر جستجو سریع میان مقادیر ستون (همیشه فعال) */}
          <div className="relative mb-2">
            <Search className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="جستجو در گزینه‌ها..."
              className="w-full pl-2 pr-7 py-1 text-[11px] bg-slate-50 dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-lg focus:outline-hidden focus:border-indigo-500 text-slate-900 dark:text-white"
            />
          </div>

          {/* دکمه‌های انتخاب همه / لغو همه و نمایش وضعیت */}
          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pb-1.5 border-b border-slate-100 dark:border-[#232328]">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSelectAllInColumn(filterMenu.colKey)}
                className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer"
              >
                انتخاب همه
              </button>
              <span>|</span>
              <button
                onClick={() => handleDeselectAllInColumn(filterMenu.colKey)}
                className="text-slate-500 hover:text-rose-500 font-bold cursor-pointer"
              >
                لغو همه
              </button>
            </div>
            <span className="font-mono text-[9px]">
              {toPersianDigits(
                (columnFilters[filterMenu.colKey] ?? currentMenuValues.map(v => v.value)).length
              )} از {toPersianDigits(currentMenuValues.length)} مورد
            </span>
          </div>

          {/* لیست مقادیر با چک‌باکس و دکمه انتخاب فقط این مورد */}
          <div className="max-h-52 overflow-y-auto space-y-1 py-1.5 my-1">
            {displayedMenuValues.length === 0 ? (
              <div className="text-center py-4 text-slate-400 text-[10px]">
                گزینه‌ای یافت نشد
              </div>
            ) : (
              displayedMenuValues.map((itemVal) => {
                const allVals = currentMenuValues.map(v => v.value);
                const currentSelected = columnFilters[filterMenu.colKey] ?? allVals;
                const isChecked = currentSelected.includes(itemVal.value);

                return (
                  <div
                    key={itemVal.value}
                    onClick={() => handleToggleColumnValue(filterMenu.colKey, itemVal.value, allVals)}
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
                        {itemVal.value}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectOnlyValue(filterMenu.colKey, itemVal.value);
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
      )}

    </div>
  );
}
