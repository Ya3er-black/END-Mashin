/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Users, Truck, Wrench, Store, Search, Printer, X, Eye, 
  FileSpreadsheet, Scale, ExternalLink, List, Receipt, CheckCircle
} from 'lucide-react';
import { 
  Vehicle, Mechanic, Supplier, Expense, PeriodicService, Insurance, 
  VehicleFailure, RepairWorkflow, PartInventory, InventoryTransaction 
} from '../types';
import { formatPrice, toPersianDigits, formatKm } from '../utils/numberUtils';
import { getCurrentJalaliDate, toJalaliDate, toJalaliStandardString, persianToEnglishDigits } from '../utils/date';
import { sortData, SortDirection } from '../utils/sortUtils';
import { JalaliDatePicker } from './JalaliDatePicker';
import { TableColumnHeader, ColumnFilterMenu, FilterMenuState } from './TableFilterSort';

export interface EntityTransactionItem {
  id: string;
  sourceId: string | number;
  date: string;
  documentNumber?: string;
  categoryLabel: string;
  categoryType: 'service' | 'repair' | 'expense' | 'insurance' | 'stock_in' | 'payment';
  title: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance?: number;
  reference?: string;
}

export interface EntityAccountSummary {
  id: string; // Unique key e.g. "vehicle-1", "mechanic-2", "supplier-3"
  rawId: number | string;
  entityType: 'vehicle' | 'mechanic' | 'supplier';
  entityTypeLabel: string;
  name: string;
  subInfo: string;
  codeOrPlaque: string;
  phone?: string;
  company?: string;
  totalDebit: number; // مجموع بدهکاری (مصارف یا پرداختی‌ها)
  totalCredit: number; // مجموع بستانکاری (فاکتورها یا مطالبات)
  netBalance: number; // مانده حساب
  balanceStatus: 'debtor' | 'creditor' | 'settled';
  transactionCount: number;
  lastTransactionDate: string;
  transactions: EntityTransactionItem[];
}

interface ComprehensiveAccountingViewProps {
  vehicles: Vehicle[];
  mechanics?: Mechanic[];
  suppliers?: Supplier[];
  expenses?: Expense[];
  services?: PeriodicService[];
  insurances?: Insurance[];
  failures?: VehicleFailure[];
  workflows?: RepairWorkflow[];
  parts?: PartInventory[];
  inventoryTransactions?: InventoryTransaction[];
  onAddExpense?: (exp: Omit<Expense, 'id' | 'createdAt'>) => Promise<void> | void;
  onNavigateToTab?: (tab: 'vehicle' | 'mechanic' | 'supplier', entityKey?: string) => void;
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

/**
 * تابع استخراج مقدار ستون جهت فیلتر ستونی
 */
function getEntityColValue(item: EntityAccountSummary, colKey: string): string {
  switch (colKey) {
    case 'entityTypeLabel':
      return item.entityTypeLabel;
    case 'name':
      return item.name;
    case 'codeOrPlaque':
      return item.codeOrPlaque || '---';
    case 'transactionCount':
      return String(item.transactionCount);
    case 'lastTransactionDate':
      return item.lastTransactionDate ? toJalaliDate(item.lastTransactionDate) : '---';
    case 'totalDebit':
      return item.totalDebit > 0 ? formatPrice(item.totalDebit) : '۰';
    case 'totalCredit':
      return item.totalCredit > 0 ? formatPrice(item.totalCredit) : '۰';
    case 'netBalance':
      return formatPrice(Math.abs(item.netBalance));
    case 'balanceStatus':
      return item.balanceStatus === 'creditor' ? 'بستانکار (طلبکار)' : item.balanceStatus === 'debtor' ? 'بدهکار' : 'تسویه / بی‌حساب';
    default:
      return '';
  }
}

function renderIranianPlate(
  plaqueInput: string | { p1: string; lettr: string; p2: string; p3: string },
  size: 'sm' | 'md' = 'sm'
) {
  let p1 = '', lettr = 'ب', p2 = '', p3 = '';
  if (typeof plaqueInput === 'object' && plaqueInput !== null) {
    p1 = plaqueInput.p1 !== undefined ? plaqueInput.p1 : '';
    lettr = plaqueInput.lettr || 'ب';
    p2 = plaqueInput.p2 !== undefined ? plaqueInput.p2 : '';
    p3 = plaqueInput.p3 !== undefined ? plaqueInput.p3 : '';
  } else {
    const str = typeof plaqueInput === 'string' ? plaqueInput : '';
    const parts = str.trim().split(/\s+/);
    if (parts.length >= 4) {
      p1 = parts[0] || '';
      lettr = parts[1] || 'ب';
      p2 = parts[2] || '';
      p3 = parts[parts.length - 1] || '';
      if (parts.length >= 5 && parts[3] === 'ایران') {
        p3 = parts[4] || '';
      }
    }
  }

  const displayP1 = p1 !== '' ? toPersianDigits(p1) : '۱۲';
  const displayP2 = p2 !== '' ? toPersianDigits(p2) : '۳۶۵';
  const displayP3 = p3 !== '' ? toPersianDigits(p3) : '۱۱';

  const isMd = size === 'md';

  return (
    <div className={`${isMd ? 'w-[165px] min-w-[165px] max-w-[165px] h-8' : 'w-[142px] min-w-[142px] max-w-[142px] h-6'} flex items-center justify-center shrink-0`}>
      <div className={`flex items-center bg-white text-black border border-slate-700 rounded overflow-hidden shadow-xs ${isMd ? 'h-8' : 'h-6'} font-bold select-none w-full`} style={{ direction: 'ltr' }}>
        {/* Blue Banner on Left (Iranian National Plate Flag & IR text) */}
        <div 
          className={`flex flex-col items-center justify-between ${isMd ? 'w-5' : 'w-4'} h-full border-r border-slate-700 shrink-0 select-none overflow-hidden`}
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
              fontSize: isMd ? '9px' : '6.5px', 
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
        <div className={`flex items-center justify-around flex-1 px-1 ${isMd ? 'text-[12px]' : 'text-[10px]'} font-extrabold text-black bg-white font-mono`} style={{ direction: 'ltr' }}>
          <span className={`w-4 text-center ${p1 === '' ? 'text-slate-400' : ''}`}>{displayP1}</span>
          <span className={`text-emerald-800 font-bold px-0.5 font-sans ${isMd ? 'text-[11px]' : 'text-[9px]'} w-3.5 text-center`}>{lettr || 'ب'}</span>
          <span className={`w-8 text-center ${p2 === '' ? 'text-slate-400' : ''}`}>{displayP2}</span>
        </div>

        {/* Vertical Divider */}
        <div className="w-[1px] bg-slate-700 h-full shrink-0"></div>

        {/* Right Iran Region Code Box */}
        <div className={`flex flex-col items-center justify-center bg-white ${isMd ? 'w-7' : 'w-6'} h-full shrink-0`}>
          <span className={`${isMd ? 'text-[6px]' : 'text-[5px]'} text-slate-800 font-extrabold leading-none mb-0.5 font-sans`}>ایران</span>
          <span className={`${isMd ? 'text-[11px]' : 'text-[9px]'} font-mono font-bold leading-none ${p3 === '' ? 'text-slate-400' : 'text-slate-900'}`}>{displayP3}</span>
        </div>
      </div>
    </div>
  );
}

export const ComprehensiveAccountingView: React.FC<ComprehensiveAccountingViewProps> = ({
  vehicles = [],
  mechanics = [],
  suppliers = [],
  expenses = [],
  services = [],
  insurances = [],
  failures = [],
  workflows = [],
  inventoryTransactions = [],
  onNavigateToTab
}) => {
  // فیلترهای نوار ابزار جستجو و تاریخ
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // مرتب‌سازی
  const [sortKey, setSortKey] = useState<string>('netBalance');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // مودال مشاهده ریز کاردکس تفصیلی
  const [selectedEntityForModal, setSelectedEntityForModal] = useState<EntityAccountSummary | null>(null);

  // فیلترهای ستونی
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [filterMenu, setFilterMenu] = useState<FilterMenuState | null>(null);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // محاسبات و ایجاد کاردکس جامع تمام طرف‌حساب‌ها (خودروها، تعمیرکاران، تامین‌کنندگان)
  const allEntitySummaries = useMemo<EntityAccountSummary[]>(() => {
    const list: EntityAccountSummary[] = [];

    const normStart = startDate ? normalizeToComparableJalali(startDate) : '';
    const normEnd = endDate ? normalizeToComparableJalali(endDate) : '';

    const isDateInRange = (dStr?: string | null) => {
      if (!normStart && !normEnd) return true;
      const compDate = normalizeToComparableJalali(dStr);
      if (!compDate) return true;
      if (normStart && compDate < normStart) return false;
      if (normEnd && compDate > normEnd) return false;
      return true;
    };

    // ==========================================
    // ۱. پردازش خودروها (Vehicles)
    // ==========================================
    vehicles.forEach(v => {
      const vTx: EntityTransactionItem[] = [];

      // سرویس‌های دوره‌ای
      services.filter(s => s.vehicleId === v.id).forEach(s => {
        const sDate = s.serviceDate ? toJalaliStandardString(s.serviceDate) : getCurrentJalaliDate();
        if (!isDateInRange(sDate)) return;
        const total = (Number(s.cost) || 0) + (Number(s.wages) || 0);
        vTx.push({
          id: `srv-${s.id}`,
          sourceId: s.id,
          date: sDate,
          documentNumber: `سرویس-${toPersianDigits(s.id)}`,
          categoryLabel: 'سرویس دوره‌ای',
          categoryType: 'service',
          title: s.serviceType || 'سرویس دوره‌ای روغن و مصرفی',
          description: s.notes || (s.currentKm ? `کارکرد: ${formatKm(s.currentKm)}` : 'سرویس دوره‌ای'),
          debit: total,
          credit: 0
        });
      });

      // خرابی‌ها و تعمیرات
      failures.filter(f => f.vehicleId === v.id).forEach(f => {
        const fDate = f.failureDate ? toJalaliStandardString(f.failureDate) : getCurrentJalaliDate();
        if (!isDateInRange(fDate)) return;
        const wf = workflows.find(w => w.failureId === f.id);
        const cost = wf?.totalCost || f.totalCost || 0;
        vTx.push({
          id: `fail-${f.id}`,
          sourceId: f.id,
          date: fDate,
          documentNumber: `تعمیر-${toPersianDigits(f.id)}`,
          categoryLabel: 'تعمیرات و رفع نقص',
          categoryType: 'repair',
          title: f.description?.substring(0, 40) || 'تعمیرات تخصصی خودرو',
          description: f.description || `تعمیرگاه: ${wf?.repairShopName || f.repairShopName || 'طرف قرارداد'}`,
          debit: cost,
          credit: 0
        });
      });

      // بیمه‌نامه‌ها
      insurances.filter(i => i.vehicleId === v.id).forEach(i => {
        const iDate = i.startDate ? toJalaliStandardString(i.startDate) : getCurrentJalaliDate();
        if (!isDateInRange(iDate)) return;
        const cost = Number(i.cost) || 0;
        vTx.push({
          id: `ins-${i.id}`,
          sourceId: i.id,
          date: iDate,
          documentNumber: `بیمه-${toPersianDigits(i.id)}`,
          categoryLabel: 'بیمه‌نامه',
          categoryType: 'insurance',
          title: `${i.insuranceType === 'third_party' ? 'بیمه شخص ثالث' : 'بیمه بدنه'} (${i.company || 'بیمه'})`,
          description: `شماره بیمه‌نامه: ${i.policyNumber || 'ثبت نشده'}`,
          debit: cost,
          credit: 0
        });
      });

      // هزینه‌های جانبی و عمومی خودرو
      expenses.filter(e => e.vehicleId === v.id || (e.debitPartyType === 'vehicle' && e.debitPartyId === v.id.toString())).forEach(e => {
        const eDate = e.expenseDate ? toJalaliStandardString(e.expenseDate) : getCurrentJalaliDate();
        if (!isDateInRange(eDate)) return;
        const cost = Number(e.cost) || 0;
        vTx.push({
          id: `exp-${e.id}`,
          sourceId: e.id,
          date: eDate,
          documentNumber: e.documentNumber || `سند-${toPersianDigits(e.id)}`,
          categoryLabel: 'هزینه و تنخواه',
          categoryType: 'expense',
          title: e.title || e.category || 'هزینه متفرقه خودرو',
          description: e.description || `پرداخت‌کننده: ${e.paidBy || 'امور مالی'}`,
          debit: cost,
          credit: 0
        });
      });

      // مرتب‌سازی تراکنش‌ها بر اساس تاریخ
      vTx.sort((a, b) => (normalizeToComparableJalali(a.date) > normalizeToComparableJalali(b.date) ? 1 : -1));

      // محاسبه مانده تجمعی کاردکس
      let runBal = 0;
      vTx.forEach(tx => {
        runBal += (tx.debit - tx.credit);
        tx.runningBalance = runBal;
      });

      const totalDebit = vTx.reduce((acc, t) => acc + t.debit, 0);
      const totalCredit = vTx.reduce((acc, t) => acc + t.credit, 0);
      const netBalance = totalDebit - totalCredit;
      const lastDate = vTx.length > 0 ? vTx[vTx.length - 1].date : '---';

      list.push({
        id: `vehicle-${v.id}`,
        rawId: v.id,
        entityType: 'vehicle',
        entityTypeLabel: 'خودرو ناوگان',
        name: v.name,
        subInfo: v.driverName ? `راننده: ${v.driverName}` : (v.company ? `شرکت: ${v.company}` : 'خودرو سازمانی'),
        codeOrPlaque: v.plaque || v.code || `کد ${v.id}`,
        company: v.company,
        totalDebit,
        totalCredit,
        netBalance,
        balanceStatus: netBalance > 0 ? 'debtor' : (netBalance < 0 ? 'creditor' : 'settled'),
        transactionCount: vTx.length,
        lastTransactionDate: lastDate,
        transactions: vTx
      });
    });

    // ==========================================
    // ۲. پردازش تعمیرکاران (Mechanics)
    // ==========================================
    mechanics.forEach(m => {
      const mTx: EntityTransactionItem[] = [];

      // دستمزدها در سرویس‌های دوره‌ای
      services.forEach(srv => {
        const srvDate = srv.serviceDate ? toJalaliStandardString(srv.serviceDate) : getCurrentJalaliDate();
        if (!isDateInRange(srvDate)) return;

        let wageForThisMechanic = 0;
        const matchesId = srv.mechanicId === m.id || srv.mechanicId === m.id.toString();
        const matchesName = srv.mechanicName && srv.mechanicName.includes(m.name);

        if (matchesId || matchesName) {
          const totalWage = Number(srv.wages) || 0;
          if (totalWage > 0) {
            if (srv.mechanicName && srv.mechanicName.includes('،')) {
              const names = srv.mechanicName.split('،').map(n => n.trim());
              wageForThisMechanic = names.includes(m.name) ? Math.round(totalWage / names.length) : (matchesId ? totalWage : 0);
            } else {
              wageForThisMechanic = totalWage;
            }
          }
        }

        if (wageForThisMechanic > 0) {
          const veh = vehicles.find(v => v.id === srv.vehicleId);
          mTx.push({
            id: `mech-srv-${srv.id}`,
            sourceId: srv.id,
            date: srvDate,
            documentNumber: `سرویس-${toPersianDigits(srv.id)}`,
            categoryLabel: 'اجرت سرویس دوره‌ای',
            categoryType: 'service',
            title: `اجرت سرویس ${veh?.name || 'خودرو'}`,
            description: srv.serviceType || 'سرویس و تعویض مصرفی',
            debit: 0,
            credit: wageForThisMechanic
          });
        }
      });

      // دستمزدها در تعمیرات و خرابی‌ها
      workflows.filter(w => w.mechanicId === m.id || w.mechanicName === m.name || (w.repairShopName && m.shopName && w.repairShopName.includes(m.shopName))).forEach(wf => {
        const wfDate = wf.startDate ? toJalaliStandardString(wf.startDate) : getCurrentJalaliDate();
        if (!isDateInRange(wfDate)) return;

        const wage = Number(wf.wages) || 0;
        const fail = failures.find(f => f.id === wf.failureId);
        const veh = fail ? vehicles.find(v => v.id === fail.vehicleId) : undefined;

        if (wage > 0) {
          mTx.push({
            id: `mech-wf-${wf.id}`,
            sourceId: wf.id,
            date: wfDate,
            documentNumber: `تعمیر-${toPersianDigits(wf.failureId)}`,
            categoryLabel: 'اجرت تعمیرات',
            categoryType: 'repair',
            title: `تعمیرات ${veh?.name || 'خودرو'}`,
            description: wf.actionTaken || fail?.description || 'تعمیرات تخصصی فنی',
            debit: 0,
            credit: wage
          });
        }
      });

      // هزینه‌های ثبت‌شده و پرداخت وجه به تعمیرکار
      expenses.filter(e => e.mechanicId === m.id || (e.debitPartyType === 'mechanic' && e.debitPartyId === m.id.toString()) || (e.creditPartyType === 'mechanic' && e.creditPartyId === m.id.toString())).forEach(e => {
        const eDate = e.expenseDate ? toJalaliStandardString(e.expenseDate) : getCurrentJalaliDate();
        if (!isDateInRange(eDate)) return;
        const cost = Number(e.cost) || 0;

        const isPaymentToMechanic = e.mechanicId === m.id || (e.debitPartyType === 'mechanic' && e.debitPartyId === m.id.toString());

        mTx.push({
          id: `mech-exp-${e.id}`,
          sourceId: e.id,
          date: eDate,
          documentNumber: e.documentNumber || `سند-${toPersianDigits(e.id)}`,
          categoryLabel: isPaymentToMechanic ? 'پرداخت دستمزد / تسویه' : 'سند بدهی',
          categoryType: 'payment',
          title: e.description || (isPaymentToMechanic ? 'تسویه حساب دستمزد' : 'سند مالی'),
          description: `${e.paymentMethod || 'پرداخت نقدی/بانکی'} ${e.referenceNumber ? `- پیگیری: ${e.referenceNumber}` : ''}`,
          debit: isPaymentToMechanic ? cost : 0,
          credit: isPaymentToMechanic ? 0 : cost,
          reference: e.referenceNumber
        });
      });

      // مرتب‌سازی و محاسبه مانده کاردکس
      mTx.sort((a, b) => (normalizeToComparableJalali(a.date) > normalizeToComparableJalali(b.date) ? 1 : -1));
      let runBal = 0;
      mTx.forEach(tx => {
        runBal += (tx.credit - tx.debit);
        tx.runningBalance = runBal;
      });

      const totalDebit = mTx.reduce((acc, t) => acc + t.debit, 0);
      const totalCredit = mTx.reduce((acc, t) => acc + t.credit, 0);
      const netBalance = totalCredit - totalDebit;
      const lastDate = mTx.length > 0 ? mTx[mTx.length - 1].date : '---';

      list.push({
        id: `mechanic-${m.id}`,
        rawId: m.id,
        entityType: 'mechanic',
        entityTypeLabel: 'تعمیرکار / تعمیرگاه',
        name: m.name,
        subInfo: m.shopName ? `تعمیرگاه: ${m.shopName}` : (m.specialty ? `تخصص: ${m.specialty}` : 'تعمیرکار طرف قرارداد'),
        codeOrPlaque: m.specialty || 'تکنسین فنی',
        phone: m.phone,
        company: m.shopName,
        totalDebit,
        totalCredit,
        netBalance,
        balanceStatus: netBalance > 0 ? 'creditor' : (netBalance < 0 ? 'debtor' : 'settled'),
        transactionCount: mTx.length,
        lastTransactionDate: lastDate,
        transactions: mTx
      });
    });

    // ==========================================
    // ۳. پردازش تامین‌کنندگان کالا و قطعات (Suppliers)
    // ==========================================
    suppliers.forEach(s => {
      const sTx: EntityTransactionItem[] = [];

      // خریدهای ورود به انبار از این تامین‌کننده
      inventoryTransactions.filter(t => t.type === 'in' && (t.supplierId === s.id || t.supplierName === s.name)).forEach(t => {
        const tDate = t.date ? toJalaliStandardString(t.date) : getCurrentJalaliDate();
        if (!isDateInRange(tDate)) return;

        const q = Number(t.quantity) || 1;
        const up = Number(t.unitPrice) || Number(t.buyPrice) || 0;
        const total = q * up;

        if (total > 0) {
          sTx.push({
            id: `sup-tx-${t.id}`,
            sourceId: t.id,
            date: tDate,
            documentNumber: `رسید-${toPersianDigits(t.id)}`,
            categoryLabel: 'ورود به انبار (خرید)',
            categoryType: 'stock_in',
            title: `خرید ${t.partName} (${toPersianDigits(q)} عدد)`,
            description: `قیمت واحد: ${formatPrice(up)} ریال - تحویل انبار مرکزی`,
            debit: 0,
            credit: total
          });
        }
      });

      // خریدهای مستقیم قطعه از تامین‌کننده در سرویس‌ها یا تعمیرات
      services.filter(srv => srv.supplierName === s.name || srv.supplierId === s.id).forEach(srv => {
        const srvDate = srv.serviceDate ? toJalaliStandardString(srv.serviceDate) : getCurrentJalaliDate();
        if (!isDateInRange(srvDate)) return;
        const cost = Number(srv.cost) || 0;
        const veh = vehicles.find(v => v.id === srv.vehicleId);

        if (cost > 0) {
          sTx.push({
            id: `sup-srv-${srv.id}`,
            sourceId: srv.id,
            date: srvDate,
            documentNumber: `سرویس-${toPersianDigits(srv.id)}`,
            categoryLabel: 'خرید مستقیم قطعه',
            categoryType: 'stock_in',
            title: `قطعه مصرفی برای ${veh?.name || 'خودرو'}`,
            description: srv.partName ? `قطعه: ${srv.partName}` : (srv.serviceType || 'قطعه سرویس'),
            debit: 0,
            credit: cost
          });
        }
      });

      // پرداختی‌ها و اسناد تسویه با تامین‌کننده
      expenses.filter(e => e.supplierId === s.id || (e.debitPartyType === 'supplier' && e.debitPartyId === s.id.toString()) || (e.creditPartyType === 'supplier' && e.creditPartyId === s.id.toString())).forEach(e => {
        const eDate = e.expenseDate ? toJalaliStandardString(e.expenseDate) : getCurrentJalaliDate();
        if (!isDateInRange(eDate)) return;
        const cost = Number(e.cost) || 0;

        const isPaymentToSupplier = e.supplierId === s.id || (e.debitPartyType === 'supplier' && e.debitPartyId === s.id.toString());

        sTx.push({
          id: `sup-exp-${e.id}`,
          sourceId: e.id,
          date: eDate,
          documentNumber: e.documentNumber || `سند-${toPersianDigits(e.id)}`,
          categoryLabel: isPaymentToSupplier ? 'پرداخت وجه / تسویه' : 'سند خرید کالا',
          categoryType: 'payment',
          title: e.description || (isPaymentToSupplier ? 'واریز وجه به تامین‌کننده' : 'سند حسابداری'),
          description: `${e.paymentMethod || 'واریز بانکی'} ${e.referenceNumber ? `- پیگیری: ${e.referenceNumber}` : ''}`,
          debit: isPaymentToSupplier ? cost : 0,
          credit: isPaymentToSupplier ? 0 : cost,
          reference: e.referenceNumber
        });
      });

      // مرتب‌سازی و محاسبه مانده کاردکس
      sTx.sort((a, b) => (normalizeToComparableJalali(a.date) > normalizeToComparableJalali(b.date) ? 1 : -1));
      let runBal = 0;
      sTx.forEach(tx => {
        runBal += (tx.credit - tx.debit);
        tx.runningBalance = runBal;
      });

      const totalDebit = sTx.reduce((acc, t) => acc + t.debit, 0);
      const totalCredit = sTx.reduce((acc, t) => acc + t.credit, 0);
      const netBalance = totalCredit - totalDebit;
      const lastDate = sTx.length > 0 ? sTx[sTx.length - 1].date : '---';

      list.push({
        id: `supplier-${s.id}`,
        rawId: s.id,
        entityType: 'supplier',
        entityTypeLabel: 'تامین‌کننده کالا',
        name: s.name,
        subInfo: s.category ? `دسته: ${s.category}` : (s.contactPerson ? `مسئول: ${s.contactPerson}` : 'تامین‌کننده قطعات'),
        codeOrPlaque: s.category || 'فروشگاه قطعات',
        phone: s.phone,
        company: s.name,
        totalDebit,
        totalCredit,
        netBalance,
        balanceStatus: netBalance > 0 ? 'creditor' : (netBalance < 0 ? 'debtor' : 'settled'),
        transactionCount: sTx.length,
        lastTransactionDate: lastDate,
        transactions: sTx
      });
    });

    return list;
  }, [vehicles, mechanics, suppliers, expenses, services, insurances, failures, workflows, inventoryTransactions, startDate, endDate]);

  // فیلتر نهایی بر اساس جستجو و فیلترهای ستونی
  const filteredSummaries = useMemo(() => {
    let result = allEntitySummaries;

    // فیلتر جستجوی متنی
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(q) ||
        item.subInfo.toLowerCase().includes(q) ||
        item.codeOrPlaque.toLowerCase().includes(q) ||
        (item.phone && item.phone.toLowerCase().includes(q))
      );
    }

    // فیلترهای ستونی
    for (const [key, selectedVals] of Object.entries(columnFilters)) {
      if (!selectedVals || !Array.isArray(selectedVals)) continue;
      result = result.filter(item => {
        const val = getEntityColValue(item, key);
        return selectedVals.includes(val);
      });
    }

    return result;
  }, [allEntitySummaries, searchTerm, columnFilters]);

  // مرتب‌سازی داده‌ها
  const sortedSummaries = useMemo(() => {
    return sortData<EntityAccountSummary>(filteredSummaries, sortKey as any, sortDirection, {
      entityTypeLabel: (it) => it.entityTypeLabel,
      name: (it) => it.name,
      codeOrPlaque: (it) => it.codeOrPlaque,
      transactionCount: (it) => it.transactionCount,
      lastTransactionDate: (it) => it.lastTransactionDate,
      totalDebit: (it) => it.totalDebit,
      totalCredit: (it) => it.totalCredit,
      netBalance: (it) => it.netBalance,
      balanceStatus: (it) => it.balanceStatus,
    });
  }, [filteredSummaries, sortKey, sortDirection]);

  // محاسبات مقادیر فوتر
  const footerTotals = useMemo(() => {
    const filteredTotalDebit = filteredSummaries.reduce((acc, e) => acc + e.totalDebit, 0);
    const filteredTotalCredit = filteredSummaries.reduce((acc, e) => acc + e.totalCredit, 0);
    const filteredTotalBalance = filteredSummaries.reduce((acc, e) => acc + e.netBalance, 0);

    return {
      filteredTotalDebit,
      filteredTotalCredit,
      filteredTotalBalance
    };
  }, [filteredSummaries]);

  // کنترل منوی فیلتر ستونی (با کلیک راست روی سرستون یا کلیک روی آیکون فیلتر)
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

  // مقادیر یکتا برای منوی فیلتر ستون باز
  const currentMenuUniqueValues = useMemo(() => {
    if (!filterMenu) return [];
    const valMap = new Map<string, number>();
    allEntitySummaries.forEach(item => {
      const val = getEntityColValue(item, filterMenu.colKey);
      valMap.set(val, (valMap.get(val) || 0) + 1);
    });
    return Array.from(valMap.entries()).map(([value, count]) => ({ value, count }));
  }, [filterMenu, allEntitySummaries]);

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

  // خروجی اکسل کامل
  const handleExportExcel = () => {
    try {
      if (filteredSummaries.length === 0) {
        return;
      }

      const sanitize = (val: any) => {
        if (val === undefined || val === null) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const headers = [
        'ردیف',
        'نوع طرف‌حساب',
        'نام طرف‌حساب / مشتری',
        'مشخصات / راننده / تخصص',
        'کد یا پلاک',
        'شماره تماس',
        'تعداد اسناد و تراکنش‌ها',
        'آخرین تاریخ تراکنش',
        'مجموع بدهکار (ریال)',
        'مجموع بستانکار (ریال)',
        'مانده خالص حساب (ریال)',
        'وضعیت تسویه'
      ];

      const rows = filteredSummaries.map((item, idx) => [
        idx + 1,
        item.entityTypeLabel,
        item.name,
        item.subInfo,
        item.codeOrPlaque,
        item.phone || '---',
        item.transactionCount,
        toJalaliDate(item.lastTransactionDate),
        item.totalDebit,
        item.totalCredit,
        item.netBalance,
        item.balanceStatus === 'creditor' ? 'بستانکار' : (item.balanceStatus === 'debtor' ? 'بدهکار' : 'تسویه / بی‌حساب')
      ]);

      const csvContent = '\uFEFF' + [
        headers.map(sanitize).join(','),
        ...rows.map(row => row.map(sanitize).join(','))
      ].join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const todayDate = getCurrentJalaliDate().replace(/\//g, '-');
      link.setAttribute('download', `صورتحساب_کلی_طرف_حسابها_${todayDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  // چاپ ریز صورتحساب رسمی یک طرف‌حساب
  const handlePrintEntityStatement = (item: EntityAccountSummary) => {
    const printDate = getCurrentJalaliDate();
    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
        <head>
          <meta charset="utf-8">
          <title>صورتحساب مالی و کاردکس - ${item.name}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            * { box-sizing: border-box; font-family: Tahoma, 'Vazirmatn', sans-serif; }
            body { background: #fff; color: #111; margin: 0; padding: 20px; font-size: 12px; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 14px; }
            .title { font-size: 17px; font-weight: 900; margin: 0 0 4px 0; }
            .subtitle { font-size: 11px; color: #444; margin: 0; }
            .meta-box { border: 1px solid #333; border-radius: 8px; padding: 8px 12px; font-size: 11px; min-width: 180px; line-height: 1.8; }
            .card-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; border: 1px solid #333; border-radius: 8px; padding: 10px; margin-bottom: 14px; background: #fafafa; }
            .card-label { font-size: 10px; color: #666; display: block; }
            .card-value { font-weight: bold; font-size: 12.5px; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 14px; border: 1px solid #333; border-radius: 8px; overflow: hidden; }
            th, td { border: 1px solid #ddd; padding: 7px 8px; text-align: right; font-size: 11px; }
            th { background: #f0f0f0; font-weight: bold; }
            .text-left { text-align: left; }
            .text-center { text-align: center; }
            .total-box { display: flex; justify-content: space-between; align-items: center; border: 1px solid #000; border-radius: 8px; padding: 10px 14px; font-weight: bold; font-size: 13px; margin-bottom: 14px; background: #fdfdfd; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 30px; }
            .sign-card { border: 1px solid #444; border-radius: 8px; padding: 10px; text-align: center; height: 90px; display: flex; flex-direction: column; justify-content: space-between; font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">صورتحساب و کاردکس مالی طرف‌حساب</h1>
              <p class="subtitle">سامانه یکپارچه مدیریت مالی، حسابداری ناوگان، تعمیرگاه‌ها و تامین‌کنندگان</p>
            </div>
            <div class="meta-box">
              <div><strong>تاریخ صدور گزارش:</strong> ${toPersianDigits(printDate)}</div>
              <div><strong>نوع حساب:</strong> ${item.entityTypeLabel}</div>
              <div><strong>تعداد تراکنش‌ها:</strong> ${toPersianDigits(item.transactionCount)} ردیف</div>
            </div>
          </div>

          <div class="card-grid">
            <div>
              <span class="card-label">نام طرف‌حساب</span>
              <div class="card-value">${item.name}</div>
            </div>
            <div>
              <span class="card-label">مشخصات / تخصص</span>
              <div class="card-value">${item.subInfo || '---'}</div>
            </div>
            <div>
              <span class="card-label">شناسه / پلاک / کد</span>
              <div class="card-value">${toPersianDigits(item.codeOrPlaque || '---')}</div>
            </div>
            <div>
              <span class="card-label">شماره تماس</span>
              <div class="card-value">${toPersianDigits(item.phone || '---')}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th class="text-center" style="width: 35px;">#</th>
                <th style="width: 75px;">تاریخ</th>
                <th style="width: 85px;">شماره سند</th>
                <th style="width: 100px;">سرفصل</th>
                <th>شرح و عنوان تراکنش</th>
                <th class="text-left" style="width: 95px;">بدهکار (ریال)</th>
                <th class="text-left" style="width: 95px;">بستانکار (ریال)</th>
                <th class="text-left" style="width: 105px;">مانده (ریال)</th>
              </tr>
            </thead>
            <tbody>
              ${item.transactions.map((tx, idx) => `
                <tr>
                  <td class="text-center" style="font-family: monospace;">${toPersianDigits(idx + 1)}</td>
                  <td style="font-family: monospace;">${toPersianDigits(toJalaliDate(tx.date))}</td>
                  <td style="font-family: monospace;">${tx.documentNumber || '---'}</td>
                  <td><strong>${tx.categoryLabel}</strong></td>
                  <td>${tx.title} - ${tx.description}</td>
                  <td class="text-left" style="font-family: monospace;">${tx.debit > 0 ? formatPrice(tx.debit) : '۰'}</td>
                  <td class="text-left" style="font-family: monospace;">${tx.credit > 0 ? formatPrice(tx.credit) : '۰'}</td>
                  <td class="text-left" style="font-family: monospace; font-weight: bold;">${formatPrice(tx.runningBalance || 0)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="total-box">
            <div>
              <span>جمع کل بدهکار: ${formatPrice(item.totalDebit)} ریال</span>
              <span style="margin: 0 10px;">|</span>
              <span>جمع کل بستانکار: ${formatPrice(item.totalCredit)} ریال</span>
            </div>
            <span>مانده نهایی حساب: <strong style="font-size: 15px;">${formatPrice(Math.abs(item.netBalance))} ریال</strong> (${item.balanceStatus === 'creditor' ? 'بستانکار' : (item.balanceStatus === 'debtor' ? 'بدهکار' : 'تسویه شده')})</span>
          </div>

          <div class="signatures">
            <div class="sign-card">
              <span>امضاء و تأیید امور مالی و حسابداری</span>
              <span style="border-bottom: 1px dashed #666; width: 70%; margin: 0 auto;"></span>
            </div>
            <div class="sign-card">
              <span>امضاء طرف‌حساب / مشتری</span>
              <span style="border-bottom: 1px dashed #666; width: 70%; margin: 0 auto;"></span>
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
      }, 350);
    } else {
      window.print();
    }
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      
      {/* ۱. نوار ابزار جستجو و فیلترهای تاریخ و خروجی اکسل (دقیقاً با استایل سرویس دوره‌ای) */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center relative z-30">
        
        {/* فیلد جستجوی سریع طرف‌حساب */}
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجو در نام طرف‌حساب، راننده، شماره پلاک، کد، فروشگاه یا شماره تماس..."
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

        {/* دکمه خروجی اکسل */}
        <button
          type="button"
          onClick={handleExportExcel}
          className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-2xs shrink-0 group self-center"
          title={startDate || endDate ? `دریافت خروجی اکسل در بازه تاریخی (${startDate || 'ابتدا'} تا ${endDate || 'انتها'})` : 'دریافت خروجی اکسل صورتحساب کلی'}
        >
          <FileSpreadsheet className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>
      </div>

      {/* ۲. جدول نمایش سوابق و صورتحساب کلی طرف‌حساب‌ها (ساختار و استایل دقیق بخش خودروها با اسکرول) */}
      <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
        
        {/* سربرگ جدول */}
        <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex justify-between items-center">
          <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
            <Scale className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>صورتحساب کلی طرف‌حساب‌ها</span>
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
              بدهکار کل: {formatPrice(footerTotals.filteredTotalDebit)}
            </span>

            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              بستانکار کل: {formatPrice(footerTotals.filteredTotalCredit)}
            </span>

            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
              <Scale className="w-3 h-3" />
              مانده کل: {formatPrice(Math.abs(footerTotals.filteredTotalBalance))}
            </span>

            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              {toPersianDigits(sortedSummaries.length)} طرف‌حساب
            </span>
          </div>
        </div>

        {/* بدنه جدول با اسکرول عمودی و افقی مشابه قسمت خودروها */}
        <div className="overflow-x-auto overflow-y-auto max-h-[580px] custom-scrollbar">
          <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-[#161618]">
              <tr className="border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-medium text-xs">
                <th className="py-2 px-3 text-center w-12 text-xs font-medium">ردیف</th>

                <TableColumnHeader
                  title="نوع طرف‌حساب"
                  colKey="entityTypeLabel"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['entityTypeLabel']}
                  onOpenFilter={handleOpenFilterMenu}
                  width="120px"
                />

                <TableColumnHeader
                  title="نام طرف‌حساب / مشتری"
                  colKey="name"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['name']}
                  onOpenFilter={handleOpenFilterMenu}
                  width="220px"
                />

                <TableColumnHeader
                  title="تعداد اسناد"
                  colKey="transactionCount"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['transactionCount']}
                  onOpenFilter={handleOpenFilterMenu}
                  align="center"
                  width="95px"
                />

                <TableColumnHeader
                  title="آخرین تراکنش"
                  colKey="lastTransactionDate"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['lastTransactionDate']}
                  onOpenFilter={handleOpenFilterMenu}
                  align="center"
                  width="115px"
                />

                <TableColumnHeader
                  title="مجموع بدهکار"
                  colKey="totalDebit"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['totalDebit']}
                  onOpenFilter={handleOpenFilterMenu}
                  align="left"
                  width="135px"
                />

                <TableColumnHeader
                  title="مجموع بستانکار"
                  colKey="totalCredit"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['totalCredit']}
                  onOpenFilter={handleOpenFilterMenu}
                  align="left"
                  width="135px"
                />

                <TableColumnHeader
                  title="مانده حساب"
                  colKey="netBalance"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['netBalance']}
                  onOpenFilter={handleOpenFilterMenu}
                  align="left"
                  width="140px"
                />
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200/60 dark:divide-[#2d2d30]/60">
              {sortedSummaries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500 text-[11px]">
                    هیچ رکورد یا طرف‌حسابی منطبق با فیلتر یافت نشد.
                  </td>
                </tr>
              ) : (
                sortedSummaries.map((item, index) => {
                  const globalIdx = index + 1;

                  return (
                    <tr 
                      key={item.id} 
                      onClick={() => setSelectedEntityForModal(item)}
                      title="برای مشاهده ریز کاردکس و صورتحساب کلیک کنید"
                      className="group relative h-9 hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/70 transition-colors cursor-pointer select-none text-[11px]"
                    >
                      {/* ردیف */}
                      <td className="py-1 px-3 text-center text-slate-500 dark:text-slate-400 text-[11px] align-middle">
                        {toPersianDigits(globalIdx)}
                      </td>

                      {/* نوع طرف‌حساب */}
                      <td className="py-1 px-3 whitespace-nowrap align-middle text-slate-600 dark:text-slate-300 text-[11px]">
                        <span>{item.entityTypeLabel}</span>
                      </td>

                      {/* نام طرف‌حساب / مشتری */}
                      <td className="py-1 px-3 whitespace-nowrap align-middle">
                        <div className="text-slate-900 dark:text-slate-100 text-[11px] flex items-center truncate max-w-[240px]">
                          <span>{item.name}</span>
                        </div>
                      </td>

                      {/* تعداد اسناد */}
                      <td className="py-1 px-3 text-center whitespace-nowrap align-middle text-slate-700 dark:text-slate-300 text-[11px]">
                        {toPersianDigits(item.transactionCount)}
                      </td>

                      {/* آخرین تراکنش */}
                      <td className="py-1 px-3 text-center whitespace-nowrap align-middle text-slate-600 dark:text-slate-400 text-[11px]">
                        {toPersianDigits(toJalaliDate(item.lastTransactionDate))}
                      </td>

                      {/* مجموع بدهکار */}
                      <td className="py-1 px-3 text-left align-middle text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap">
                        {item.totalDebit > 0 ? formatPrice(item.totalDebit) : '۰'}
                      </td>

                      {/* مجموع بستانکار */}
                      <td className="py-1 px-3 text-left align-middle text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap">
                        {item.totalCredit > 0 ? formatPrice(item.totalCredit) : '۰'}
                      </td>

                      {/* مانده حساب (طلبکار با علامت منفی، بدهکار بدون علامت) */}
                      <td className="py-1 px-3 text-left align-middle text-slate-800 dark:text-slate-200 text-[11px] whitespace-nowrap relative">
                        <span dir="ltr" className="inline-block">
                          {item.balanceStatus === 'creditor' && item.netBalance !== 0
                            ? `- ${formatPrice(Math.abs(item.netBalance))}`
                            : formatPrice(Math.abs(item.netBalance))}
                        </span>

                        {/* دکمه‌های عملیات شناور - فقط هنگام بردن موس روی ردیف */}
                        <div className="absolute inset-y-0 left-0 pl-2.5 pr-14 flex items-center gap-1 bg-gradient-to-r from-slate-50 via-slate-50 via-70% to-transparent dark:from-[#1a1a1c] dark:via-[#1a1a1c] dark:via-70% dark:to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 z-20 pointer-events-none group-hover:pointer-events-auto">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEntityForModal(item);
                            }}
                            title="مشاهده ریز صورتحساب و کاردکس"
                            className="w-[22px] h-[22px] flex items-center justify-center bg-slate-100 dark:bg-[#1a1a1c] hover:bg-indigo-100 dark:hover:bg-indigo-600/20 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 rounded border border-slate-200 dark:border-[#2d2d30] transition-colors cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrintEntityStatement(item);
                            }}
                            title="چاپ صورتحساب تفصیلی"
                            className="w-[22px] h-[22px] flex items-center justify-center bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-400 rounded border border-slate-200 dark:border-[#2d2d30] transition-colors cursor-pointer"
                          >
                            <Printer className="w-3 h-3" />
                          </button>

                          {onNavigateToTab && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigateToTab(item.entityType, item.rawId.toString());
                              }}
                              title={`انتقال به تب اختصاصی ${item.entityTypeLabel}`}
                              className="w-[22px] h-[22px] flex items-center justify-center bg-slate-100 dark:bg-[#1a1a1c] hover:bg-indigo-100 dark:hover:bg-indigo-600/20 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 rounded border border-slate-200 dark:border-[#2d2d30] transition-colors cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* سطر جمع کل جدول */}
            {sortedSummaries.length > 0 && (
              <tfoot className="sticky bottom-0 z-20 bg-slate-100 dark:bg-[#1a1a1d] border-t-2 border-slate-300 dark:border-[#38383e] font-mono font-bold text-xs select-none shadow-xs text-slate-400 dark:text-slate-500">
                <tr>
                  <td colSpan={5} className="py-2.5 px-3 text-right font-mono font-bold text-slate-400 dark:text-slate-500 text-xs">
                    جمع کل ({toPersianDigits(sortedSummaries.length)} طرف‌حساب):
                  </td>
                  <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-400 dark:text-slate-500 text-xs whitespace-nowrap">
                    {formatPrice(footerTotals.filteredTotalDebit)}
                  </td>
                  <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-400 dark:text-slate-500 text-xs whitespace-nowrap">
                    {formatPrice(footerTotals.filteredTotalCredit)}
                  </td>
                  <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-400 dark:text-slate-500 text-xs whitespace-nowrap">
                    <span dir="ltr" className="inline-block font-mono">
                      {footerTotals.filteredTotalBalance < 0
                        ? `- ${formatPrice(Math.abs(footerTotals.filteredTotalBalance))}`
                        : formatPrice(Math.abs(footerTotals.filteredTotalBalance))}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ۳. مودال نمایش ریز کاردکس و صورتحساب تفصیلی طرف‌حساب */}
      {selectedEntityForModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* هدر مدال */}
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <span>صورتحساب و کاردکس تفصیلی {selectedEntityForModal.name}</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded border bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/40">
                      {selectedEntityForModal.entityTypeLabel}
                    </span>
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                    شناسه: {toPersianDigits(selectedEntityForModal.codeOrPlaque)} | تعداد تراکنش‌ها: {toPersianDigits(selectedEntityForModal.transactionCount)} ردیف
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setSelectedEntityForModal(null)} 
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* بدنه مدال */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              
              {/* کارت مشخصات و مانده نهایی طرف‌حساب */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/80 dark:bg-[#161618]/80 p-4 rounded-xl border border-slate-200 dark:border-[#2d2d30]">
                <div>
                  <span className="text-slate-500 text-[11px] block mb-0.5">نام و عنوان:</span>
                  <strong className="text-slate-900 dark:text-white font-extrabold text-xs">
                    {selectedEntityForModal.name}
                  </strong>
                </div>

                <div>
                  <span className="text-slate-500 text-[11px] block mb-0.5">مشخصات / راننده / تخصص:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    {selectedEntityForModal.subInfo || '---'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 text-[11px] block mb-0.5">مجموع گردش بدهکار / بستانکار:</span>
                  <div className="font-mono text-xs font-bold space-x-1 space-x-reverse">
                    <span className="text-rose-600">{formatPrice(selectedEntityForModal.totalDebit)}</span>
                    <span className="text-slate-400">/</span>
                    <span className="text-emerald-600">{formatPrice(selectedEntityForModal.totalCredit)}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 text-[11px] block mb-0.5">مانده خالص حساب:</span>
                  <div className="flex items-center gap-1.5">
                    <strong className={`font-mono text-sm font-black ${
                      selectedEntityForModal.balanceStatus === 'creditor' 
                        ? 'text-emerald-600 dark:text-emerald-400' 
                        : selectedEntityForModal.balanceStatus === 'debtor' 
                        ? 'text-rose-600 dark:text-rose-400' 
                        : 'text-slate-600 dark:text-slate-300'
                    }`}>
                      {formatPrice(Math.abs(selectedEntityForModal.netBalance))} ریال
                    </strong>
                    <span className="text-[10px] font-bold text-slate-500">
                      ({selectedEntityForModal.balanceStatus === 'creditor' ? 'بستانکار' : (selectedEntityForModal.balanceStatus === 'debtor' ? 'بدهکار' : 'تسویه')})
                    </span>
                  </div>
                </div>
              </div>

              {/* جدول ریز تراکنش‌ها و اسناد دوبل */}
              <div className="border border-slate-200 dark:border-[#2d2d30] rounded-xl overflow-hidden bg-white dark:bg-[#111113]">
                <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-[#161618] border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-medium text-xs">
                      <th className="py-2 px-3 text-center w-10 text-xs font-medium">ردیف</th>
                      <th className="py-2 px-3 w-24 text-xs font-medium">تاریخ</th>
                      <th className="py-2 px-3 w-28 text-xs font-medium">شماره سند</th>
                      <th className="py-2 px-3 w-32 text-xs font-medium">سرفصل مالی</th>
                      <th className="py-2 px-3 text-xs font-medium">عنوان و شرح تراکنش</th>
                      <th className="py-2 px-3 text-left w-32 text-xs font-medium">بدهکار</th>
                      <th className="py-2 px-3 text-left w-32 text-xs font-medium">بستانکار</th>
                      <th className="py-2 px-3 text-left w-36 text-xs font-medium">مانده کاردکس</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                    {selectedEntityForModal.transactions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-6 text-slate-500 text-[11px]">
                          هیچ تراکنش ثبت‌شده‌ای برای این طرف‌حساب در بازه زمانی انتخابی وجود ندارد.
                        </td>
                      </tr>
                    ) : (
                      selectedEntityForModal.transactions.map((tx, idx) => (
                        <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-[#18181c] transition-colors text-[11px]">
                          <td className="py-1.5 px-3 text-center text-slate-500 text-[11px]">
                            {toPersianDigits(idx + 1)}
                          </td>
                          <td className="py-1.5 px-3 text-slate-600 dark:text-slate-400 text-[11px]">
                            {toPersianDigits(toJalaliDate(tx.date))}
                          </td>
                          <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300 text-[11px]">
                            {tx.documentNumber || '---'}
                          </td>
                          <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300 text-[11px]">
                            {tx.categoryLabel}
                          </td>
                          <td className="py-1.5 px-3 text-slate-800 dark:text-slate-200 text-[11px]">
                            <div>{tx.title}</div>
                            {tx.description && <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{tx.description}</div>}
                          </td>
                          <td className="py-1.5 px-3 text-left text-slate-700 dark:text-slate-300 text-[11px]">
                            {tx.debit > 0 ? formatPrice(tx.debit) : '۰'}
                          </td>
                          <td className="py-1.5 px-3 text-left text-slate-700 dark:text-slate-300 text-[11px]">
                            {tx.credit > 0 ? formatPrice(tx.credit) : '۰'}
                          </td>
                          <td className="py-1.5 px-3 text-left text-slate-800 dark:text-slate-200 text-[11px]">
                            {formatPrice(tx.runningBalance || 0)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>

            {/* فوتر مدال */}
            <div className="flex justify-between items-center p-4 border-t border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintEntityStatement(selectedEntityForModal)}
                  className="px-4 py-2 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-300 font-bold rounded-lg transition-colors border border-slate-200 dark:border-[#2d2d30] text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>چاپ صورتحساب</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEntityForModal(null)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
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
    </div>
  );
};
