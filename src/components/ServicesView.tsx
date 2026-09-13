/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Search, Wrench, Calendar, DollarSign, Clock, List,
  CheckCircle, CheckCircle2, FileText, X, AlertCircle, RefreshCw, AlertTriangle, ShieldAlert, Check, ChevronRight, CheckSquare, Square, Package, Printer,
  ArrowUpDown, ArrowUp, ArrowDown, Trash2, Edit2, Eye, Truck, FileSpreadsheet, Store, Receipt, Save, Info, Gauge, History, TrendingUp, Layers,
  ShieldCheck, ExternalLink, Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Vehicle, PeriodicService, ServiceDefinition, PartInventory, Mechanic, VehicleFailure, RepairWorkflow, Supplier, Person, Insurance, TechnicalInspection } from '../types';
import { toJalaliDate, getCurrentJalaliDate, addDaysToJalaliDate, calculateNextServiceDate, toJalaliStandardString, jalaliDayDifference } from '../utils/date';
import { calculateReceptionNextService } from '../utils/predictionEngine';
import { JalaliDatePicker } from './JalaliDatePicker';
import { toPersianDigits, formatPrice, formatNumber, parsePersianNumber, formatQuantity, toEnglishDigits } from '../utils/numberUtils';
import { sortData, SortDirection } from '../utils/sortUtils';
import { CustomSelect } from './CustomSelect';
import { Pagination } from './Pagination';
import { TableColumnHeader, ColumnFilterMenu, FilterMenuState } from './TableFilterSort';
import { findLastServiceOrRepairEvent, findMatchingServiceDef } from '../utils/serviceMatching';

interface ServicesViewProps {
  vehicles: Vehicle[];
  services: PeriodicService[];
  persons?: Person[];
  serviceDefinitions?: ServiceDefinition[];
  parts?: PartInventory[];
  mechanics?: Mechanic[];
  suppliers?: Supplier[];
  failures?: VehicleFailure[];
  workflows?: RepairWorkflow[];
  insurances?: Insurance[];
  inspections?: TechnicalInspection[];
  onNavigate?: (view: string) => void;
  onAddService: (service: Omit<PeriodicService, 'id' | 'createdAt'>) => Promise<void>;
  onEditService?: (id: number, service: Partial<PeriodicService>) => Promise<void>;
  onDeleteService?: (id: number) => Promise<void>;
}

interface ServiceRowItem {
  id: string;
  existingId?: number;
  serviceType: string;
  nextKm?: number;
  nextDate?: string;
  partSource?: 'warehouse' | 'supplier' | 'none';
  partId?: number;
  partName: string;
  quantity?: number;
  rawQuantityInput?: string;
  unitPrice?: number;
  supplierId?: number;
  supplierName?: string;
  cost: number;
}

export interface AssignedMechanicItem {
  id: string;
  mechanicId?: string;
  mechanicName: string;
  repairShopName?: string;
  wages: number;
}

interface DeleteConfirmationState {
  isOpen: boolean;
  type: 'session' | 'item';
  session?: ServiceSession;
  item?: PeriodicService;
  title: string;
  message: string;
  vehicleName: string;
  dateStr: string;
}

export interface ServiceSession {
  id: string;
  vehicleId: number;
  serviceDate: string;
  currentKm: number;
  totalCost: number;
  partsCost?: number;
  wages?: number;
  driverName?: string;
  company?: string;
  plaque?: string;
  notes?: string;
  createdAt: string;
  items: PeriodicService[];
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

/**
 * نرمال‌سازی رشته تاریخ شمسی برای مقایسه رشته‌ای دقیق (با تبدیل ارقام فارسی و انگلیسی)
 */
function normalizeToComparableJalali(dateStr?: string | null): string {
  if (!dateStr) return '';
  const enStr = String(dateStr)
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .trim();
  const parts = enStr.split(/[\/\-]/);
  if (parts.length < 3) return enStr;
  const y = parts[0].padStart(4, '0');
  const m = parts[1].padStart(2, '0');
  const d = parts[2].padStart(2, '0');
  return `${y}/${m}/${d}`;
}

export default function ServicesView({
  vehicles,
  services,
  persons = [],
  serviceDefinitions = [],
  parts = [],
  mechanics = [],
  suppliers = [],
  failures = [],
  workflows = [],
  insurances = [],
  inspections = [],
  onNavigate,
  onAddService,
  onEditService,
  onDeleteService
}: ServicesViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [sortKey, setSortKey] = useState<string>('serviceDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [docNum] = useState(() => Math.floor(100000 + Math.random() * 900000));

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
    return vehicles.find(v => v.id.toString() === vehicleFilter) || null;
  }, [vehicles, vehicleFilter]);

  const handleSelectVehicle = (v: Vehicle) => {
    setVehicleFilter(v.id.toString());
    setSearchTerm('');
    setIsSearchOpen(false);
  };

  const printInvoiceContent = (
    currentVeh: Vehicle | undefined,
    printDate: string,
    printDocNum: string | number,
    printKm: number,
    printCost: number,
    printNotes: string,
    printItems: { id: string; serviceType: string; partName: string; cost: number; partSource?: string; supplierName?: string; quantity?: number; unitPrice?: number }[],
    printNextKm: number,
    printNextDate: string,
    printDriver?: string,
    printMechanic?: string,
    printPartsTotal?: number,
    printWagesTotal?: number
  ) => {
    const partsTotal = printPartsTotal !== undefined ? printPartsTotal : printItems.reduce((acc, it) => acc + (Number(it.cost) || 0), 0);
    const wagesTotal = printWagesTotal !== undefined ? printWagesTotal : Math.max(0, printCost - partsTotal);
    const totalAmount = printCost || (partsTotal + wagesTotal);
    const driverDisplay = printDriver || currentVeh?.driverName || '---';

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fa" dir="rtl">
        <head>
          <meta charset="utf-8">
          <title>فاکتور رسمی سرویس و نگهداری خودرو</title>
          <style>
            @page { size: A4 portrait; margin: 12mm 15mm; }
            * { box-sizing: border-box; font-family: "IRANYekanX", "Yekan Bakh", "Vazirmatn", Tahoma, sans-serif; }
            body { background: #fff; color: #111; margin: 0; padding: 20px; font-size: 13px; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
            .title { font-size: 18px; font-weight: 900; margin: 0 0 4px 0; }
            .subtitle { font-size: 11px; color: #444; margin: 0; }
            .meta-box { border: 1px solid #333; border-radius: 8px; padding: 8px 12px; font-size: 11px; min-width: 170px; line-height: 1.8; }
            .card-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; border: 1px solid #333; border-radius: 8px; padding: 10px; margin-bottom: 16px; background: #fafafa; }
            .card-label { font-size: 10px; color: #666; display: block; }
            .card-value { font-weight: bold; font-size: 13px; margin-top: 2px; }
            .section-title { font-size: 13px; font-weight: 900; border-right: 4px solid #000; padding-right: 8px; margin: 16px 0 8px 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 14px; border: 1px solid #333; border-radius: 8px; overflow: hidden; }
            th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: right; font-size: 12px; }
            th { background: #f0f0f0; font-weight: bold; }
            .text-left { text-align: left; }
            .text-center { text-align: center; }
            .total-box { display: flex; flex-direction: column; gap: 6px; border: 1.5px solid #000; border-radius: 8px; padding: 12px 14px; margin-bottom: 14px; background: #fdfdfd; }
            .total-row { display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
            .total-final { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #000; padding-top: 8px; margin-top: 4px; font-weight: bold; font-size: 14px; }
            .next-service-box { border: 1px solid #333; border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; font-size: 12px; }
            .notes-box { border: 1px solid #333; border-radius: 8px; padding: 10px; margin-bottom: 24px; font-size: 11.5px; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 30px; }
            .sign-card { border: 1px solid #444; border-radius: 8px; padding: 12px; text-align: center; height: 100px; display: flex; flex-direction: column; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">فاکتور رسمی خدمات سرویس و نگهداری خودرو</h1>
              <p class="subtitle">مدیریت ناوگان خودرویی یاس - برگه رسمی سرویس و تعمیرات</p>
            </div>
            <div class="meta-box">
              <div><strong>تاریخ صدور:</strong> ${toPersianDigits(printDate)}</div>
              <div><strong>شماره سند:</strong> #${toPersianDigits(printDocNum)}</div>
              <div><strong>وضعیت:</strong> تسویه / ثبت قطعی</div>
            </div>
          </div>

          <div class="card-grid">
            <div>
              <span class="card-label">نام خودرو</span>
              <div class="card-value">${currentVeh?.name || '---'}</div>
            </div>
            <div>
              <span class="card-label">شماره پلاک</span>
              <div class="card-value">${toPersianDigits(currentVeh?.plaque || '---')}</div>
            </div>
            <div>
              <span class="card-label">راننده / تحویل‌دهنده</span>
              <div class="card-value">${driverDisplay}</div>
            </div>
            <div>
              <span class="card-label">کارکرد ثبت‌شده</span>
              <div class="card-value">${formatNumber(printKm)} کیلومتر</div>
            </div>
          </div>

          ${printMechanic ? `
            <div style="border: 1px solid #ddd; border-radius: 6px; padding: 8px 12px; margin-bottom: 14px; background: #f9f9f9; font-size: 11.5px;">
              <strong>تعمیرکار / مرکز خدمات:</strong> ${printMechanic}
            </div>
          ` : ''}

          <div class="section-title">شرح خدمات انجام شده و قطعات مصرفی</div>
          <table>
            <thead>
              <tr>
                <th style="width: 35px;" class="text-center">#</th>
                <th>شرح خدمت / تعمیر</th>
                <th>منبع و قطعه مصرفی</th>
                <th style="width: 60px;" class="text-center">تعداد</th>
                <th style="width: 110px;" class="text-left">قیمت واحد (ریال)</th>
                <th style="width: 120px;" class="text-left">قیمت کل (ریال)</th>
              </tr>
            </thead>
            <tbody>
              ${printItems.map((row, idx) => {
                let sourceDisplay = 'بدون قطعه انبار';
                if (row.partSource === 'supplier' || row.supplierName) {
                  sourceDisplay = `تامین‌کننده: ${row.supplierName || 'خارجی'} ${row.partName ? `(${row.partName})` : ''}`;
                } else if (row.partName) {
                  sourceDisplay = `انبار شرکت: ${row.partName}`;
                }
                const rowQty = row.quantity && row.quantity > 0 ? row.quantity : 1;
                const rowUnitPrice = row.unitPrice !== undefined ? row.unitPrice : (row.cost ? Math.round(row.cost / rowQty) : 0);
                return `
                <tr>
                  <td class="text-center">${toPersianDigits(idx + 1)}</td>
                  <td><strong>${row.serviceType}</strong></td>
                  <td>${sourceDisplay}</td>
                  <td class="text-center font-mono">${toPersianDigits(rowQty)}</td>
                  <td class="text-left" style="font-family: monospace;">${formatPrice(rowUnitPrice)}</td>
                  <td class="text-left" style="font-family: monospace; font-weight: bold;">${formatPrice(row.cost)}</td>
                </tr>
              `}).join('')}
            </tbody>
          </table>

          <div class="total-box">
            <div class="total-row">
              <span>مجموع هزینه اقلام و قطعات مصرفی:</span>
              <span style="font-family: monospace; font-weight: bold;">${formatPrice(partsTotal)} ریال</span>
            </div>
            ${wagesTotal > 0 ? `
              <div class="total-row">
                <span>مجموع اجرت و دستمزد تعمیرکاران:</span>
                <span style="font-family: monospace; font-weight: bold;">${formatPrice(wagesTotal)} ریال</span>
              </div>
            ` : ''}
            <div class="total-final">
              <span>مبلغ کل پرداختی و نهایی فاکتور:</span>
              <span style="font-family: monospace; font-size: 16px;">${formatPrice(totalAmount)} ریال</span>
            </div>
          </div>

          <div class="next-service-box">
            <div>
              <strong>برنامه پایش و سررسید سرویس بعدی خودرو:</strong>
              <div style="font-size: 11px; color: #555; margin-top: 2px;">مراجعه بعدی جهت حفظ سلامت فنی بر اساس کارکرد یا تاریخ پیشنهاد می‌گردد.</div>
            </div>
            <div style="text-align: left; font-size: 12px; font-weight: bold; line-height: 1.6;">
              <div>سررسید کیلومتر: ${formatNumber(printNextKm)} km</div>
              <div>سررسید تاریخ: ${toPersianDigits(printNextDate || '---')}</div>
            </div>
          </div>

          ${printNotes ? `
            <div class="notes-box">
              <strong>توضیحات و یادداشت تکمیلی:</strong>
              <div style="margin-top: 4px;">${printNotes}</div>
            </div>
          ` : ''}

          <div class="signatures">
            <div class="sign-card">
              <span style="font-weight: bold;">مهر و امضاء تعمیرگاه / سرویس‌کار</span>
              <span style="border-bottom: 1px dashed #666; width: 80%; margin: 0 auto;"></span>
            </div>
            <div class="sign-card">
              <span style="font-weight: bold;">امضاء مدیر ناوگان / تحویل‌گیرنده</span>
              <span style="border-bottom: 1px dashed #666; width: 80%; margin: 0 auto;"></span>
            </div>
          </div>
        </body>
      </html>
    `;

    // ساخت آی‌فریم موقت جهت چاپ مطمئن حتی داخل مودال و محیط iframe پلتفرم
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

  const handlePrintSessionInvoice = (session: ServiceSession) => {
    const currentVeh = vehicles.find(v => v.id === session.vehicleId);
    const printDate = session.serviceDate;
    const printDocNum = session.items[0]?.id || '101';
    const printKm = session.currentKm;
    const printCost = session.totalCost;
    const printNotes = session.notes || session.items.map(i => i.notes).filter(Boolean).join(' | ');
    const printItems = session.items.map((i, idx) => {
      let partName = i.partName || '';
      if (!partName && i.notes && i.notes.includes('[برند/قطعه انبار:')) {
        const match = i.notes.match(/\[برند\/قطعه انبار:\s*([^\]]+)\]/);
        if (match) partName = match[1];
      }
      if (!partName && i.partId) {
        partName = parts?.find(p => p.id === i.partId)?.partName || '';
      }
      const q = i.quantity && i.quantity > 0 ? i.quantity : 1;
      const c = Number(i.cost) || 0;
      const up = i.unitPrice !== undefined ? i.unitPrice : (c > 0 ? Math.round(c / q) : 0);
      return {
        id: i.id ? i.id.toString() : idx.toString(),
        serviceType: i.serviceType,
        partSource: i.partSource,
        partName: partName,
        supplierName: i.supplierName,
        quantity: q,
        unitPrice: up,
        cost: c
      };
    });
    const printNextKm = session.items[0]?.nextKm || 0;
    const printNextDate = session.items[0]?.nextDate || '';

    const firstWithMech = session.items.find(i => i.mechanicName || i.repairShopName);
    const mechDisplay = firstWithMech
      ? `${firstWithMech.mechanicName || ''} ${firstWithMech.repairShopName ? `(${firstWithMech.repairShopName})` : ''}`.trim()
      : undefined;

    const partsTotal = session.partsCost !== undefined ? session.partsCost : printItems.reduce((acc, it) => acc + (Number(it.cost) || 0), 0);
    const wagesTotal = session.wages !== undefined ? session.wages : Math.max(0, printCost - partsTotal);

    printInvoiceContent(
      currentVeh,
      printDate,
      printDocNum,
      printKm,
      printCost,
      printNotes,
      printItems,
      printNextKm,
      printNextDate,
      session.driverName || currentVeh?.driverName,
      mechDisplay,
      partsTotal,
      wagesTotal
    );
  };

  const handleDirectPrintInvoice = () => {
    if (!vehicleId) {
      alert('لطفاً ابتدا نام خودرو را انتخاب کنید.');
      return;
    }
    if (serviceRows.length === 0) {
      alert('لطفاً حداقل یک ردیف سرویس اضافه کنید.');
      return;
    }

    const currentVeh = vehicles.find(v => v.id.toString() === vehicleId);
    const printItems = serviceRows.map(r => ({
      id: r.id,
      serviceType: r.serviceType,
      partSource: r.partSource,
      partName: r.partName || '',
      supplierName: r.supplierName,
      quantity: r.quantity || 1,
      unitPrice: r.unitPrice || 0,
      cost: Number(r.cost) || 0
    }));

    const primaryNextKm = serviceRows.find(r => r.nextKm)?.nextKm || 0;
    const primaryNextDate = serviceRows.find(r => r.nextDate)?.nextDate || '';

    const allMechNames = assignedMechanics
      .map(m => {
        if (m.mechanicId) {
          const found = mechanics.find(mech => mech.id.toString() === m.mechanicId);
          return found ? `${found.name}${found.shopName ? ` (${found.shopName})` : ''}` : m.mechanicName;
        }
        return `${m.mechanicName || ''}${m.repairShopName ? ` (${m.repairShopName})` : ''}`.trim();
      })
      .filter(Boolean)
      .join('، ');

    const partsTotal = printItems.reduce((acc, it) => acc + (Number(it.cost) || 0), 0);
    const wagesTotal = assignedMechanics.reduce((sum, m) => sum + (Number(m.wages) || 0), 0);

    printInvoiceContent(
      currentVeh,
      serviceDate,
      docNum,
      currentKm,
      cost,
      notes,
      printItems,
      primaryNextKm,
      primaryNextDate,
      driverName || currentVeh?.driverName,
      allMechNames || undefined,
      partsTotal,
      wagesTotal
    );
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // تب فعال (در حال ارائه سرویس / سرویس شده) و حالت فرم (پذیرش / اتمام / ویرایش قبل از فاکتور / ویرایش بعد از فاکتور)
  const [activeTab, setActiveTab] = useState<'in_progress' | 'completed'>('in_progress');
  const [formMode, setFormMode] = useState<'reception' | 'completion' | 'edit_reception' | 'edit_completion'>('reception');

  const isReceptionStyle = formMode === 'reception' || formMode === 'edit_reception';
  const isCompletionStyle = formMode === 'completion' || formMode === 'edit_completion';

  // فیلدهای فرم
  const [vehicleId, setVehicleId] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [isVehicleDropdownOpen, setIsVehicleDropdownOpen] = useState(false);
  const [serviceRows, setServiceRows] = useState<ServiceRowItem[]>([]);
  const [serviceDate, setServiceDate] = useState(() => getCurrentJalaliDate());
  const [currentKm, setCurrentKm] = useState<number>(0);
  const [cost, setCost] = useState<number>(0);
  const [notes, setNotes] = useState('');
  
  // فیلدهای ارجاع به تعمیرکار و اجرت سرویس (پشتیبانی از چند تعمیرکار و تفکیک اجرت)
  const [assignedMechanics, setAssignedMechanics] = useState<AssignedMechanicItem[]>([
    {
      id: 'mech-init',
      mechanicId: '',
      mechanicName: '',
      repairShopName: '',
      wages: 0
    }
  ]);
  const [mechanicId, setMechanicId] = useState<string>('');
  const [mechanicName, setMechanicName] = useState<string>('');
  const [repairShopName, setRepairShopName] = useState<string>('');
  const [wages, setWages] = useState<number>(0);

  // استیت‌های مدال جزئیات و پرونده در حال ویرایش
  const [selectedDetailSession, setSelectedDetailSession] = useState<ServiceSession | null>(null);
  const [editingSession, setEditingSession] = useState<ServiceSession | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // استخراج اطلاعات دوره قبل پذیرش خودرو جهت محاسبه تفاضل کیلومتر، تحلیل بازه سررسیدها و اعتبارسنجی حداقل کیلومتر
  const lastReceptionInfo = useMemo(() => {
    if (!vehicleId) return null;
    const vId = Number(vehicleId);
    const pastRecords = services.filter(
      s => s.vehicleId === vId &&
           (s.currentKm || 0) > 0 &&
           (!editingSession || !editingSession.items.some(it => it.id === s.id))
    );

    if (pastRecords.length === 0) {
      return null;
    }

    // گروه‌بندی سوابق ثبت‌شده خودرو به تفکیک دوره‌ها / نوبت‌های پذیرش
    // هر دوره بر اساس ترکیب تاریخ استاندارد و کیلومتر ثبت‌شده تمایز می‌یابد
    const sessionMap = new Map<string, {
      currentKm: number;
      serviceDate: string;
      stdDate: string;
      serviceTypes: string[];
      count: number;
    }>();

    pastRecords.forEach(rec => {
      const km = rec.currentKm || 0;
      const d = rec.serviceDate || '';
      const std = toJalaliStandardString(d);
      const key = `${std}_${km}`;
      if (!sessionMap.has(key)) {
        sessionMap.set(key, {
          currentKm: km,
          serviceDate: d,
          stdDate: std,
          serviceTypes: rec.serviceType ? [rec.serviceType] : [],
          count: 1
        });
      } else {
        const item = sessionMap.get(key)!;
        if (rec.serviceType && !item.serviceTypes.includes(rec.serviceType)) {
          item.serviceTypes.push(rec.serviceType);
        }
        item.count += 1;
      }
    });

    const distinctSessions = Array.from(sessionMap.values());

    // مرتب‌سازی دوره‌های پذیرش قبلی بر اساس بالاترین کیلومتر ثبت‌شده (دوره قبل پذیرش)
    distinctSessions.sort((a, b) => {
      if (b.currentKm !== a.currentKm) {
        return b.currentKm - a.currentKm;
      }
      return b.stdDate.localeCompare(a.stdDate);
    });

    // آخرین نوبت/دوره قبل که خودرو پذیرش شده است (نزدیک‌ترین نوبت قبلی)
    const latestPrior = distinctSessions[0];

    return {
      lastKm: latestPrior.currentKm || 0,
      lastDate: latestPrior.serviceDate || '',
      serviceType: latestPrior.serviceTypes.join('، '),
      recordCount: pastRecords.length,
      totalSessions: distinctSessions.length
    };
  }, [vehicleId, services, editingSession]);

  // حداقل کیلومتر مجاز: دقیقاً برابر با کیلومتر دوره قبل که پذیرش شده است (بدون کم یا زیاد)
  const previousKm = useMemo(() => {
    if (!vehicleId || !lastReceptionInfo) return 0;
    return lastReceptionInfo.lastKm || 0;
  }, [vehicleId, lastReceptionInfo]);

  // آخرین تاریخ پذیرش قبلی خودرو
  const previousServiceDate = useMemo(() => {
    if (!vehicleId || !lastReceptionInfo) return '';
    return lastReceptionInfo.lastDate || '';
  }, [vehicleId, lastReceptionInfo]);

  // بررسی نامعتبر بودن کیلومتر فعلی (کمتر بودن از کیلومتر قبلی خودرو)
  const isKmInvalid = useMemo(() => {
    if (!previousKm || previousKm <= 0) return false;
    if (currentKm === undefined || currentKm <= 0) return false;
    return currentKm < previousKm;
  }, [currentKm, previousKm]);

  // بررسی نامعتبر بودن تاریخ پذیرش/سرویس (قبل‌تر بودن از تاریخ آخرین پذیرش قبلی خودرو)
  const isDateInvalid = useMemo(() => {
    if (!previousServiceDate || !serviceDate) return false;
    const prevComp = normalizeToComparableJalali(previousServiceDate);
    const currComp = normalizeToComparableJalali(serviceDate);
    if (!prevComp || !currComp) return false;
    return currComp < prevComp;
  }, [serviceDate, previousServiceDate]);

  // تشخیص آیا این خودرو برای بار اول به پذیرش مراجعه می‌کند یا سابقه سرویس قبلی در سیستم ندارد
  const isFirstTimeReceptionVehicle = useMemo(() => {
    return !lastReceptionInfo;
  }, [lastReceptionInfo]);

  // استخراج وضعیت مدارک قانونی خودرو (بیمه شخص ثالث، بیمه بدنه، معاینه فنی) در بالای فرم پذیرش
  const vehicleInsuranceSummary = useMemo(() => {
    if (!vehicleId) return null;
    const vId = Number(vehicleId);
    if (!vId) return null;

    const vInsurances = insurances.filter(i => i.vehicleId === vId);
    const vInspections = inspections.filter(i => i.vehicleId === vId);

    // آخرین بیمه شخص ثالث ثبت شده
    const thirdParty = vInsurances
      .filter(i => i.insuranceType === 'third_party')
      .sort((a, b) => b.endDate.localeCompare(a.endDate))[0] || null;

    // آخرین بیمه بدنه ثبت شده
    const collision = vInsurances
      .filter(i => i.insuranceType === 'collision')
      .sort((a, b) => b.endDate.localeCompare(a.endDate))[0] || null;

    // آخرین گواهی معاینه فنی
    const latestInspection = vInspections
      .sort((a, b) => b.expiryDate.localeCompare(a.expiryDate))[0] || null;

    const today = getCurrentJalaliDate();

    // وضعیت شخص ثالث
    let tpDiff: number | null = null;
    let tpStatus: 'valid' | 'expiring_soon' | 'expired' | 'none' = 'none';
    if (thirdParty) {
      tpDiff = jalaliDayDifference(today, thirdParty.endDate);
      if (tpDiff < 0) tpStatus = 'expired';
      else if (tpDiff <= 30) tpStatus = 'expiring_soon';
      else tpStatus = 'valid';
    }

    // وضعیت بیمه بدنه
    let colDiff: number | null = null;
    let colStatus: 'valid' | 'expiring_soon' | 'expired' | 'none' = 'none';
    if (collision) {
      colDiff = jalaliDayDifference(today, collision.endDate);
      if (colDiff < 0) colStatus = 'expired';
      else if (colDiff <= 30) colStatus = 'expiring_soon';
      else colStatus = 'valid';
    }

    // وضعیت معاینه فنی
    let inspDiff: number | null = null;
    let inspStatus: 'valid' | 'expiring_soon' | 'expired' | 'none' = 'none';
    if (latestInspection) {
      inspDiff = jalaliDayDifference(today, latestInspection.expiryDate);
      if (inspDiff < 0) inspStatus = 'expired';
      else if (inspDiff <= 30) inspStatus = 'expiring_soon';
      else inspStatus = 'valid';
    }

    return {
      thirdParty,
      tpDiff,
      tpStatus,
      collision,
      colDiff,
      colStatus,
      latestInspection,
      inspDiff,
      inspStatus
    };
  }, [vehicleId, insurances, inspections]);

  // کنترل نمایش وضعیت مدارک قانونی (بیمه و معاینه فنی) در فرم پذیرش سرویس دوره‌ای
  const [showInsuranceStatus, setShowInsuranceStatus] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('fleet_service_show_insurance');
      return saved === 'true'; // به صورت پیش‌فرض خاموش است
    } catch {
      return false;
    }
  });

  const toggleInsuranceStatus = () => {
    setShowInsuranceStatus(prev => {
      const next = !prev;
      try {
        localStorage.setItem('fleet_service_show_insurance', String(next));
      } catch {}
      return next;
    });
  };

  // استیت مودال تایید حذف (بله/خیر)
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmationState | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // محاسبه کیلومتر و تاریخ سررسید بعدی برای یک خدمت مشخص و خودروی انتخابی بر اساس فواصل و سوابق گذشته
  const calculateServiceRowDefaults = (
    serviceType: string,
    targetVehId: number,
    baseKm: number,
    baseDate: string
  ) => {
    const matchedDef = findMatchingServiceDef(serviceType, serviceDefinitions);
    let interval = matchedDef ? Number(matchedDef.intervalKm) || 0 : 0;
    if (!interval || interval <= 0) {
      const norm = normalizePersianText(serviceType);
      if (norm.includes('گیربکس') || norm.includes('واسکازین')) {
        interval = 30000;
      } else if (norm.includes('تسمه') || norm.includes('تایم')) {
        interval = 60000;
      } else if (norm.includes('شمع')) {
        interval = 30000;
      } else if (norm.includes('لنت جلو')) {
        interval = 25000;
      } else if (norm.includes('لنت عقب')) {
        interval = 35000;
      } else if (norm.includes('لنت')) {
        interval = 25000;
      } else if (norm.includes('ضدیخ')) {
        interval = 20000;
      } else if (norm.includes('لاستیک')) {
        interval = 50000;
      } else if (norm.includes('روغن')) {
        interval = 5000;
      } else if (norm.includes('فیلتر')) {
        interval = 10000;
      } else {
        interval = 10000;
      }
    }

    const safeBaseKm = Number(baseKm) || 0;
    const safeInterval = Number(interval) || 0;

    // محاسبه دقیق عددی: کیلومتر سررسید بعدی = کیلومتر فعلی خودرو + دوره سرویس
    const calculatedNextKm = safeBaseKm > 0 ? (safeBaseKm + safeInterval) : 0;

    // بخش اول: پذیرش خودرو - محاسبه خودکار موعد بعدی بر اساس میانگین کارکرد در دفعات مراجعه خودرو
    // در نوبت‌های دوم و بعدی خودرو، میانگین پیمایش روزانه از روی فواصل مراجعات محاسبه و تاریخ بعدی تعیین می‌شود
    const recCalc = safeBaseKm > 0 ? calculateReceptionNextService({
      vehicleId: targetVehId,
      serviceType,
      currentServiceDate: baseDate || getCurrentJalaliDate(),
      currentServiceKm: safeBaseKm,
      intervalKm: safeInterval,
      allServices: services,
      allFailures: failures,
      allVehicles: vehicles,
      editingSessionItems: editingSession ? editingSession.items : undefined
    }) : { hasHistory: false, nextDate: '' };

    return {
      nextKm: calculatedNextKm,
      nextDate: recCalc.hasHistory && recCalc.nextDate ? recCalc.nextDate : ''
    };
  };

  // باز کردن فرم ویرایش (قبل از ثبت فاکتور مثل فرم پذیرش و بعد از ثبت فاکتور مثل فرم فاکتور)
  const handleOpenEditSession = (session: ServiceSession) => {
    setEditingSession(session);
    const isInProgress = session.items.some(i => i.status === 'in_progress');
    setFormMode(isInProgress ? 'edit_reception' : 'edit_completion');
    setVehicleId(session.vehicleId.toString());
    setDriverName(session.driverName || session.items[0]?.driverName || '');
    setServiceDate(session.serviceDate);
    setCurrentKm(session.currentKm);

    // استخراج اطلاعات تعمیرکار و مرکز خدمات (با تفکیک چند تعمیرکار)
    const firstWithMech = session.items.find(i => i.mechanicId || i.mechanicName || i.repairShopName || (i.wages && i.wages > 0));
    setMechanicId(firstWithMech?.mechanicId ? firstWithMech.mechanicId.toString() : '');
    setMechanicName(firstWithMech?.mechanicName || '');
    setRepairShopName(firstWithMech?.repairShopName || '');
    const totalWages = session.items.reduce((acc, i) => acc + (i.wages || 0), 0);
    setWages(totalWages);

    if (firstWithMech?.mechanicName && firstWithMech.mechanicName.includes('،')) {
      const names = firstWithMech.mechanicName.split('،').map(n => n.trim()).filter(Boolean);
      const wagePerMech = totalWages > 0 ? Math.round(totalWages / names.length) : 0;
      setAssignedMechanics(names.map((name, mIdx) => {
        const matched = mechanics.find(m => m.name === name);
        return {
          id: `edit-mech-${mIdx}-${Date.now()}`,
          mechanicId: matched ? matched.id.toString() : '',
          mechanicName: name,
          repairShopName: matched?.shopName || firstWithMech.repairShopName || '',
          wages: wagePerMech
        };
      }));
    } else {
      setAssignedMechanics([
        {
          id: 'edit-mech-0',
          mechanicId: firstWithMech?.mechanicId ? firstWithMech.mechanicId.toString() : '',
          mechanicName: firstWithMech?.mechanicName || '',
          repairShopName: firstWithMech?.repairShopName || '',
          wages: totalWages || 0
        }
      ]);
    }

    // متن توضیحات (پاکسازی پیشوندهای سیستمی)
    let cleanNotes = session.notes || session.items[0]?.notes || '';
    cleanNotes = cleanNotes
      .replace(/\[ثبت گروهی \d+ سرویس\]\s*/g, '')
      .replace(/\[تامین‌کننده:[^\]]+\]\s*/g, '')
      .replace(/\[برند\/قطعه انبار:[^\]]+\]\s*/g, '')
      .trim();
    setNotes(cleanNotes);

    // نگاشت آیتم‌های پرونده به ردیف‌های جدول خدمات و قطعات
    const rows: ServiceRowItem[] = session.items.map((item, idx) => {
      let partName = item.partName || '';
      let supplierName = item.supplierName || '';
      let partSource = item.partSource || (item.supplierId || item.supplierName ? 'supplier' : item.partId ? 'warehouse' : 'none');

      if (!partName && item.notes && item.notes.includes('[برند/قطعه انبار:')) {
        const match = item.notes.match(/\[برند\/قطعه انبار:\s*([^\]]+)\]/);
        if (match) partName = match[1];
      }
      if (!supplierName && item.notes && item.notes.includes('[تامین‌کننده:')) {
        const matchSup = item.notes.match(/\[تامین‌کننده:\s*([^\]\-]+)/);
        if (matchSup) {
          supplierName = matchSup[1].trim();
          partSource = 'supplier';
        }
      }

      const matchedPart = parts.find(p => p.id === item.partId || (partName && p.partName === partName));
      const matchedSupplier = suppliers.find(s => s.id === item.supplierId || (supplierName && s.name === supplierName));

      const q = item.quantity && item.quantity > 0 ? item.quantity : 1;
      const totalCost = Number(item.cost) || 0;
      const up = item.unitPrice !== undefined ? item.unitPrice : (totalCost > 0 ? Math.round(totalCost / q) : (matchedPart?.unitPrice || 0));

      let rowNextKm = item.nextKm && Number(item.nextKm) > 0 ? Number(item.nextKm) : 0;
      let rowNextDate = item.nextDate;
      if (!rowNextKm) {
        const def = findMatchingServiceDef(item.serviceType, serviceDefinitions);
        const interval = def ? Number(def.intervalKm) || 5000 : 5000;
        rowNextKm = Number(session.currentKm || 0) + interval;
      }

      return {
        id: item.id ? item.id.toString() : `edit-row-${idx}-${Date.now()}`,
        existingId: item.id,
        serviceType: item.serviceType,
        nextKm: rowNextKm,
        nextDate: rowNextDate || '',
        partSource: partSource as 'warehouse' | 'supplier' | 'none',
        partId: matchedPart ? matchedPart.id : (item.partId || undefined),
        partName: partName,
        supplierId: matchedSupplier ? matchedSupplier.id : (item.supplierId || undefined),
        supplierName: matchedSupplier ? matchedSupplier.name : supplierName,
        quantity: q,
        unitPrice: up,
        cost: totalCost || (q * up)
      };
    });

    setServiceRows(rows);
    setCost(session.totalCost);
    setIsFormOpen(true);
  };

  const requestDeleteServiceItem = (service: PeriodicService) => {
    if (!onDeleteService) return;
    const v = vehicles.find(veh => String(veh.id) === String(service.vehicleId) || Number(veh.id) === Number(service.vehicleId));
    setDeleteConfirm({
      isOpen: true,
      type: 'item',
      item: service,
      vehicleName: v ? `${v.name} - پلاک [${toPersianDigits(v.plaque)}]` : (service.plaque ? `پلاک [${toPersianDigits(service.plaque)}]` : '—'),
      dateStr: toJalaliDate(service.serviceDate),
      title: 'تایید حذف قلم سرویس',
      message: `آیا از حذف ردیف سرویس «${service.serviceType}» برای خودروی «${v ? v.name : ''}» در تاریخ ${toJalaliDate(service.serviceDate)} اطمینان دارید؟`
    });
  };

  const requestDeleteSession = (session: ServiceSession) => {
    if (!onDeleteService) return;
    const v = vehicles.find(veh => String(veh.id) === String(session.vehicleId) || Number(veh.id) === Number(session.vehicleId));
    const count = session.items.length;
    setDeleteConfirm({
      isOpen: true,
      type: 'session',
      session,
      vehicleName: v ? `${v.name} - پلاک [${toPersianDigits(v.plaque)}]` : (session.plaque ? `پلاک [${toPersianDigits(session.plaque)}]` : '—'),
      dateStr: toJalaliDate(session.serviceDate),
      title: 'تایید حذف پرونده سرویس دوره‌ای',
      message: count > 1
        ? `آیا از حذف این پرونده سرویس شامل ${toPersianDigits(count)} ردیف خدمت برای خودروی «${v ? v.name : 'انتخابی'}» در تاریخ ${toJalaliDate(session.serviceDate)} اطمینان دارید؟ این عملیات غیرقابل بازگشت است.`
        : `آیا از حذف پرونده سرویس «${session.items[0]?.serviceType || ''}» برای خودروی «${v ? v.name : 'انتخابی'}» در تاریخ ${toJalaliDate(session.serviceDate)} اطمینان دارید؟`
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm || !onDeleteService) return;
    setIsDeleting(true);
    try {
      if (deleteConfirm.type === 'session' && deleteConfirm.session) {
        for (const item of deleteConfirm.session.items) {
          await onDeleteService(item.id);
        }
        if (selectedDetailSession?.id === deleteConfirm.session.id) {
          setSelectedDetailSession(null);
        }
      } else if (deleteConfirm.type === 'item' && deleteConfirm.item) {
        await onDeleteService(deleteConfirm.item.id);
        if (selectedDetailSession) {
          const updatedItems = selectedDetailSession.items.filter(i => i.id !== deleteConfirm.item!.id);
          if (updatedItems.length === 0) {
            setSelectedDetailSession(null);
          } else {
            setSelectedDetailSession({
              ...selectedDetailSession,
              items: updatedItems,
              totalCost: updatedItems.reduce((sum, item) => sum + (Number(item.cost) || 0), 0)
            });
          }
        }
        if (editingSession && editingSession.items.some(i => i.id === deleteConfirm.item!.id)) {
          setEditingSession(null);
          setIsFormOpen(false);
        }
      }
      setDeleteConfirm(null);
    } catch (err) {
      console.error(err);
      alert('خطا در حذف سابقه سرویس.');
    } finally {
      setIsDeleting(false);
    }
  };

  // لیست عناوین سرویس‌های قابل انتخاب (ترکیب تعریف‌شده‌ها + عناوین متداول)
  const defaultServicePresets = [
    'تعویض روغن موتور و فیلترها',
    'تعویض فیلتر کابین و بنزین',
    'تعویض تسمه تایم و هرزگردها',
    'تعویض لنت ترمز جلو',
    'تعویض لنت ترمز عقب',
    'تعویض شمع و وایر موتور',
    'سرویس واسکازین و روغن گیربکس',
    'تعویض ضدیخ و مایع خنک‌کننده',
    'بازدید و تعویض لاستیک‌ها'
  ];

  const availableServiceOptions = Array.from(new Set([
    ...serviceDefinitions.map(s => s.serviceType),
    ...defaultServicePresets
  ]));

  // پیدا کردن قطعات منطبق در انبار بر اساس موجودی انبار
  const getMatchingParts = (serviceType?: string): PartInventory[] => {
    if (!parts || parts.length === 0) return [];
    return [...parts].sort((a, b) => (b.quantity > 0 ? 1 : 0) - (a.quantity > 0 ? 1 : 0));
  };

  // محاسبه مجموع هزینه کل ردیف‌ها به همراه اجرت تمام تعمیرکاران
  const calculateTotalCost = (rows: ServiceRowItem[], mechs: AssignedMechanicItem[] = assignedMechanics) => {
    const partsTotal = rows.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);
    const wagesTotal = mechs.reduce((acc, curr) => acc + (Number(curr.wages) || 0), 0);
    setCost(partsTotal + wagesTotal);
  };

  // افزودن یک تعمیرکار دیگر به لیست
  const handleAddMechanic = () => {
    const newMech: AssignedMechanicItem = {
      id: `mech-${Math.random().toString(36).substring(2, 9)}`,
      mechanicId: '',
      mechanicName: '',
      repairShopName: '',
      wages: 0
    };
    const updated = [...assignedMechanics, newMech];
    setAssignedMechanics(updated);
    calculateTotalCost(serviceRows, updated);
  };

  // حذف یک تعمیرکار از لیست
  const handleRemoveMechanic = (id: string) => {
    const updated = assignedMechanics.filter(m => m.id !== id);
    setAssignedMechanics(updated);
    calculateTotalCost(serviceRows, updated);
  };

  // ویرایش اطلاعات یا اجرت یک تعمیرکار
  const handleUpdateMechanic = (id: string, updates: Partial<AssignedMechanicItem>) => {
    const updated = assignedMechanics.map(m => {
      if (m.id === id) {
        const merged = { ...m, ...updates };
        if ('mechanicId' in updates) {
          const val = updates.mechanicId || '';
          if (val.startsWith('custom:')) {
            merged.mechanicId = '';
            merged.mechanicName = '';
            merged.repairShopName = val.replace('custom:', '');
          } else if (val) {
            const found = mechanics.find(mech => mech.id.toString() === val);
            if (found) {
              merged.mechanicName = found.name;
              merged.repairShopName = found.shopName || found.name;
            }
          } else {
            merged.mechanicId = '';
            merged.mechanicName = '';
            merged.repairShopName = '';
          }
        }
        return merged;
      }
      return m;
    });
    setAssignedMechanics(updated);
    calculateTotalCost(serviceRows, updated);
  };

  // افزودن مستقیم ردیف سرویس با انتخاب از لیست
  const handleAddServiceRowDirectly = (typeToAdd: string) => {
    if (!typeToAdd) return;

    let defNextKm: number | undefined = undefined;
    let defNextDate: string | undefined = undefined;

    if (formMode === 'reception' || formMode === 'edit_reception') {
      const defs = calculateServiceRowDefaults(typeToAdd, Number(vehicleId), currentKm, serviceDate);
      defNextKm = defs.nextKm;
      defNextDate = defs.nextDate;
    }

    const newRow: ServiceRowItem = {
      id: Math.random().toString(36).substring(2, 9),
      serviceType: typeToAdd,
      nextKm: defNextKm,
      nextDate: defNextDate || '',
      partSource: undefined,
      partId: undefined,
      partName: '',
      supplierId: undefined,
      supplierName: '',
      quantity: undefined,
      rawQuantityInput: '',
      unitPrice: 0,
      cost: 0
    };

    const updated = [...serviceRows, newRow];
    setServiceRows(updated);
    calculateTotalCost(updated);
  };

  // افزودن ردیف خالی/جدید
  const handleAddServiceRow = () => {
    const defaultType = availableServiceOptions[0] || 'تعویض روغن موتور و فیلترها';
    handleAddServiceRowDirectly(defaultType);
  };

  // افزودن دسته‌جمعی تمام خدمات تعریفی موجود در سیستم به صورت یکجا
  const handleAddAllAvailableServices = () => {
    const listToUse = availableServiceOptions.length > 0
      ? availableServiceOptions
      : (serviceDefinitions && serviceDefinitions.length > 0 ? serviceDefinitions.map(d => d.serviceType) : ['تعویض روغن موتور و فیلترها']);

    const newRows: ServiceRowItem[] = [];
    listToUse.forEach(serviceTypeName => {
      const isAlreadyAdded = serviceRows.some(r => r.serviceType === serviceTypeName) ||
                             newRows.some(r => r.serviceType === serviceTypeName);
      if (!isAlreadyAdded) {
        let defNextKm: number | undefined = undefined;
        let defNextDate: string | undefined = undefined;

        if (formMode === 'reception' || formMode === 'edit_reception') {
          const defs = calculateServiceRowDefaults(serviceTypeName, Number(vehicleId), currentKm, serviceDate);
          defNextKm = defs.nextKm;
          defNextDate = defs.nextDate;
        }

        newRows.push({
          id: Math.random().toString(36).substring(2, 9),
          serviceType: serviceTypeName,
          nextKm: defNextKm,
          nextDate: defNextDate || '',
          partSource: undefined,
          partId: undefined,
          partName: '',
          supplierId: undefined,
          supplierName: '',
          quantity: undefined,
          rawQuantityInput: '',
          unitPrice: 0,
          cost: 0
        });
      }
    });

    if (newRows.length > 0) {
      const updated = [...serviceRows, ...newRows];
      setServiceRows(updated);
      calculateTotalCost(updated);
    }
  };

  // تغییر منبع تامین قطعه در ردیف
  const handleSelectPartSourceInRow = (rowId: string, source: 'warehouse' | 'supplier' | 'none') => {
    const updated = serviceRows.map(row => {
      if (row.id === rowId) {
        const q = row.quantity && row.quantity > 0 ? row.quantity : 1;
        if (source === 'warehouse') {
          const matched = getMatchingParts(row.serviceType);
          const firstPart = matched[0];
          const up = firstPart ? (firstPart.sellPrice || firstPart.unitPrice || 0) : (row.unitPrice || 0);
          return {
            ...row,
            partSource: 'warehouse' as const,
            partId: firstPart ? firstPart.id : undefined,
            partName: firstPart ? firstPart.partName : '',
            supplierId: undefined,
            supplierName: 'انبار شرکت',
            quantity: q,
            unitPrice: up,
            cost: q * up
          };
        } else if (source === 'supplier') {
          const firstSup = suppliers[0];
          return {
            ...row,
            partSource: 'supplier' as const,
            partId: undefined,
            supplierId: firstSup ? firstSup.id : undefined,
            supplierName: firstSup ? firstSup.name : ''
          };
        } else {
          return {
            ...row,
            partSource: 'none' as const,
            partId: undefined,
            supplierId: undefined,
            supplierName: ''
          };
        }
      }
      return row;
    });
    setServiceRows(updated);
    calculateTotalCost(updated);
  };

  // انتخاب تامین‌کننده برای یک ردیف
  const handleSelectSupplierInRow = (rowId: string, supVal: string) => {
    const updated = serviceRows.map(row => {
      if (row.id === rowId) {
        if (supVal === 'warehouse') {
          return {
            ...row,
            partSource: 'warehouse' as const,
            supplierId: undefined,
            supplierName: 'انبار شرکت'
          };
        } else if (supVal && supVal.startsWith('mech_')) {
          const mechId = supVal.replace('mech_', '');
          const selectedMech = (mechanics || []).find(m => m.id.toString() === mechId);
          const mechName = selectedMech ? (selectedMech.shopName ? `${selectedMech.name} (${selectedMech.shopName})` : selectedMech.name) : supVal;
          return {
            ...row,
            partSource: 'supplier' as const,
            supplierId: undefined,
            supplierName: mechName,
            partId: undefined
          };
        } else if (supVal) {
          const selectedSupplier = suppliers.find(s => s.id.toString() === supVal);
          return {
            ...row,
            partSource: 'supplier' as const,
            supplierId: selectedSupplier ? selectedSupplier.id : undefined,
            supplierName: selectedSupplier ? selectedSupplier.name : supVal,
            partId: undefined
          };
        } else {
          return {
            ...row,
            partSource: undefined,
            supplierId: undefined,
            supplierName: '',
            partId: undefined,
            partName: ''
          };
        }
      }
      return row;
    });
    setServiceRows(updated);
    calculateTotalCost(updated);
  };

  // ویرایش فیلدهای یک ردیف با پشتیبانی از فیلدهای تکی یا گروهی و محاسبه خودکار قیمت کل
  const handleUpdateServiceRow = (id: string, fieldOrUpdates: 'serviceType' | 'cost' | 'partName' | 'supplierName' | 'quantity' | 'unitPrice' | 'nextKm' | 'nextDate' | Partial<ServiceRowItem>, value?: any) => {
    const updates: Partial<ServiceRowItem> = typeof fieldOrUpdates === 'string' ? { [fieldOrUpdates]: value } : fieldOrUpdates;

    const updated = serviceRows.map(row => {
      if (row.id === id) {
        const merged: ServiceRowItem = { ...row, ...updates };

        if ('serviceType' in updates && (formMode === 'reception' || formMode === 'edit_reception')) {
          const newType = updates.serviceType as string;
          const defs = calculateServiceRowDefaults(newType, Number(vehicleId), currentKm, serviceDate);
          merged.nextKm = defs.nextKm;
          merged.nextDate = defs.nextDate;
        }

        const q = merged.quantity !== undefined && merged.quantity > 0 ? merged.quantity : 1;

        if (('quantity' in updates || 'unitPrice' in updates) && !('cost' in updates)) {
          const up = merged.unitPrice !== undefined ? merged.unitPrice : 0;
          merged.cost = merged.quantity !== undefined ? (merged.quantity * up) : 0;
        } else if ('cost' in updates && !('unitPrice' in updates)) {
          merged.unitPrice = q > 0 ? Math.round((merged.cost || 0) / q) : merged.cost;
        }
        return merged;
      }
      return row;
    });
    setServiceRows(updated);
    calculateTotalCost(updated);
  };

  // انتخاب قطعه انبار برای یک ردیف
  const handleSelectPartInRow = (rowId: string, partIdStr: string) => {
    const selectedPart = parts.find(p => p.id.toString() === partIdStr);
    const updated = serviceRows.map(row => {
      if (row.id === rowId) {
        if (selectedPart) {
          const q = row.quantity && row.quantity > 0 ? row.quantity : undefined;
          const up = selectedPart.sellPrice || selectedPart.unitPrice || 0;
          return {
            ...row,
            partSource: 'warehouse' as const,
            partId: selectedPart.id,
            partName: selectedPart.partName,
            supplierId: undefined,
            supplierName: 'انبار شرکت',
            quantity: q,
            unitPrice: up,
            cost: q ? (q * up) : 0
          };
        } else {
          return {
            ...row,
            partId: undefined,
            partName: ''
          };
        }
      }
      return row;
    });
    setServiceRows(updated);
    calculateTotalCost(updated);
  };

  // حذف یک ردیف
  const handleRemoveServiceRow = (id: string) => {
    const updated = serviceRows.filter(row => row.id !== id);
    setServiceRows(updated);
    calculateTotalCost(updated);
  };

  // باز کردن فرم پذیرش سرویس دوره‌ای جدید (مرحله ۱)
  const handleOpenForm = (presetVehicleId?: string, presetServiceType?: string) => {
    setEditingSession(null);
    setFormMode('reception');
    setMechanicId('');
    setMechanicName('');
    setRepairShopName('');
    setWages(0);
    setAssignedMechanics([
      {
        id: `mech-${Math.random().toString(36).substring(2, 9)}`,
        mechanicId: '',
        mechanicName: '',
        repairShopName: '',
        wages: 0
      }
    ]);

    const targetVehId = presetVehicleId || vehicles[0]?.id.toString() || '';
    setVehicleId(targetVehId);
    const selV = vehicles.find(v => v.id.toString() === targetVehId);
    setDriverName(selV?.driverName || '');

    // طبق خواسته: در فرم پذیرش خودرو، فیلد کیلومتر خالی است تا کاربر به صورت دستی بنویسد
    setCurrentKm(0);

    const currDate = getCurrentJalaliDate();
    setServiceDate(currDate);

    // طبق خواسته کاربر: به صورت پیش‌فرض هیچ خدمتی ثبت نباشد تا کاربر خدمات مورد نظر را انتخاب نماید
    const initialRows: ServiceRowItem[] = presetServiceType ? [
      {
        id: Math.random().toString(36).substring(2, 9),
        serviceType: presetServiceType,
        nextKm: 0,
        nextDate: '',
        partSource: undefined,
        partName: '',
        quantity: undefined,
        rawQuantityInput: '',
        unitPrice: 0,
        cost: 0
      }
    ] : [];

    setServiceRows(initialRows);
    calculateTotalCost(initialRows, [{
      id: 'init-mech',
      mechanicId: '',
      mechanicName: '',
      repairShopName: '',
      wages: 0
    }]);
    setNotes('');
    setIsFormOpen(true);
  };

  // باز کردن فرم تکمیل کار و صدور فاکتور (مرحله ۲)
  const handleOpenCompletionModal = (session: ServiceSession) => {
    setEditingSession(session);
    setFormMode('completion');
    setVehicleId(session.vehicleId.toString());
    setDriverName(session.driverName || session.items[0]?.driverName || '');
    setServiceDate(session.serviceDate);
    setCurrentKm(session.currentKm);

    const firstWithMech = session.items.find(i => i.mechanicId || i.mechanicName || i.repairShopName || (i.wages && i.wages > 0));
    setMechanicId(firstWithMech?.mechanicId ? firstWithMech.mechanicId.toString() : '');
    setMechanicName(firstWithMech?.mechanicName || '');
    setRepairShopName(firstWithMech?.repairShopName || '');
    const totalWages = session.items.reduce((acc, i) => acc + (i.wages || 0), 0);
    setWages(totalWages);

    if (firstWithMech?.mechanicName && firstWithMech.mechanicName.includes('،')) {
      const names = firstWithMech.mechanicName.split('،').map(n => n.trim()).filter(Boolean);
      const wagePerMech = totalWages > 0 ? Math.round(totalWages / names.length) : 0;
      setAssignedMechanics(names.map((name, mIdx) => {
        const matched = mechanics.find(m => m.name === name);
        return {
          id: `comp-mech-${mIdx}-${Date.now()}`,
          mechanicId: matched ? matched.id.toString() : '',
          mechanicName: name,
          repairShopName: matched?.shopName || firstWithMech.repairShopName || '',
          wages: wagePerMech
        };
      }));
    } else {
      setAssignedMechanics([
        {
          id: 'comp-mech-0',
          mechanicId: firstWithMech?.mechanicId ? firstWithMech.mechanicId.toString() : '',
          mechanicName: firstWithMech?.mechanicName || '',
          repairShopName: firstWithMech?.repairShopName || '',
          wages: totalWages || 0
        }
      ]);
    }

    let cleanNotes = session.notes || session.items[0]?.notes || '';
    cleanNotes = cleanNotes
      .replace(/\[ثبت گروهی \d+ سرویس\]\s*/g, '')
      .replace(/\[تامین‌کننده:[^\]]+\]\s*/g, '')
      .replace(/\[برند\/قطعه انبار:[^\]]+\]\s*/g, '')
      .trim();
    setNotes(cleanNotes);

    const rows: ServiceRowItem[] = session.items.map((item, idx) => {
      let partName = item.partName || '';
      let supplierName = item.supplierName || '';
      let partSource = item.partSource || (item.supplierId || item.supplierName ? 'supplier' : item.partId ? 'warehouse' : 'none');

      const matchedPart = parts.find(p => p.id === item.partId || (partName && p.partName === partName));
      const matchedSupplier = suppliers.find(s => s.id === item.supplierId || (supplierName && s.name === supplierName));

      const q = item.quantity && item.quantity > 0 ? item.quantity : 1;
      const totalCost = Number(item.cost) || 0;
      const up = item.unitPrice !== undefined ? item.unitPrice : (totalCost > 0 ? Math.round(totalCost / q) : (matchedPart?.unitPrice || 0));

      return {
        id: item.id ? item.id.toString() : `comp-row-${idx}-${Date.now()}`,
        existingId: item.id,
        serviceType: item.serviceType,
        nextKm: item.nextKm,
        nextDate: item.nextDate || '',
        partSource: partSource as 'warehouse' | 'supplier' | 'none',
        partId: matchedPart ? matchedPart.id : (item.partId || undefined),
        partName: partName,
        supplierId: matchedSupplier ? matchedSupplier.id : (item.supplierId || undefined),
        supplierName: matchedSupplier ? matchedSupplier.name : supplierName,
        quantity: q,
        unitPrice: up,
        cost: totalCost || (q * up)
      };
    });

    setServiceRows(rows);
    setCost(session.totalCost);
    setIsFormOpen(true);
  };

  // تغییر خودرو در فرم
  const handleVehicleChangeInForm = (vId: string) => {
    setVehicleId(vId);
    const selectedVehicle = vehicles.find(v => v.id.toString() === vId);
    if (selectedVehicle?.driverName && selectedVehicle.driverName !== 'ثبت نشده') {
      setDriverName(selectedVehicle.driverName);
    }
    
    const vKm = Number(selectedVehicle?.currentKm) || 0;
    const targetKm = currentKm > 0 ? Number(currentKm) : vKm;
    if (currentKm <= 0 && vKm > 0) {
      setCurrentKm(vKm);
    }
    
    const vNum = Number(vId);
    const updated = serviceRows.map(r => {
      if (!targetKm || targetKm <= 0) {
        return {
          ...r,
          nextKm: 0,
          nextDate: ''
        };
      }
      const defs = calculateServiceRowDefaults(r.serviceType, vNum, targetKm, serviceDate);
      return {
        ...r,
        nextKm: defs.nextKm,
        nextDate: defs.nextDate
      };
    });
    setServiceRows(updated);
  };

  // تغییر تاریخ انجام سرویس
  const handleServiceDateChange = (newDate: string) => {
    setServiceDate(newDate);
    if (formMode === 'reception' || formMode === 'edit_reception') {
      const vNum = Number(vehicleId);
      const safeKm = Number(currentKm) || 0;
      const updated = serviceRows.map(r => {
        const defs = calculateServiceRowDefaults(r.serviceType, vNum, safeKm, newDate);
        return {
          ...r,
          nextDate: defs.nextDate
        };
      });
      setServiceRows(updated);
    }
  };

  // تغییر دستی کیلومتر فعلی
  const handleCurrentKmChange = (val: number) => {
    const safeVal = Number(val) || 0;
    setCurrentKm(safeVal);
    if (formMode === 'reception' || formMode === 'edit_reception') {
      const vNum = Number(vehicleId);
      const updated = serviceRows.map(r => {
        if (!safeVal || safeVal <= 0) {
          return {
            ...r,
            nextKm: 0,
            nextDate: ''
          };
        }
        const defs = calculateServiceRowDefaults(r.serviceType, vNum, safeVal, serviceDate);
        return {
          ...r,
          nextKm: defs.nextKm,
          nextDate: defs.nextDate
        };
      });
      setServiceRows(updated);
    }
  };

  const handleSubmit = async (e?: React.FormEvent, overrideStatus?: 'in_progress' | 'completed') => {
    if (e) {
      e.preventDefault();
    }
    if (!vehicleId) {
      alert('لطفاً نام ماشین را انتخاب کنید.');
      return;
    }

    if (serviceRows.length === 0) {
      alert('لطفاً حداقل یک ردیف سرویس از لیست انتخاب کنید.');
      return;
    }

    if (!serviceDate || currentKm === undefined || currentKm <= 0) {
      alert('لطفاً کیلومتر پذیرش خودرو را به صورت دستی وارد نمایید.');
      return;
    }

    if (previousKm > 0 && currentKm < previousKm) {
      alert(`خطا: کیلومتر فعلی وارد شده (${formatNumber(currentKm)} کیلومتر) نمی‌تواند کمتر از آخرین کیلومتر ثبت‌شده قبلی خودرو (${formatNumber(previousKm)} کیلومتر) باشد. لطفاً کیلومتر را اصلاح فرمایید.`);
      return;
    }

    if (previousServiceDate && serviceDate) {
      const prevComp = normalizeToComparableJalali(previousServiceDate);
      const currComp = normalizeToComparableJalali(serviceDate);
      if (prevComp && currComp && currComp < prevComp) {
        alert(`خطا: تاریخ پذیرش/سرویس وارد شده (${toPersianDigits(serviceDate)}) نمی‌تواند قبل از آخرین تاریخ پذیرش قبلی خودرو (${toPersianDigits(previousServiceDate)}) باشد. لطفاً تاریخ را اصلاح فرمایید.`);
        return;
      }
    }

    setIsEditSubmitting(true);
    try {
      const primaryMech = assignedMechanics[0];
      const allMechNames = assignedMechanics
        .map(m => {
          if (m.mechanicId) {
            const found = mechanics.find(mech => mech.id.toString() === m.mechanicId);
            return found ? found.name : m.mechanicName;
          }
          return m.mechanicName;
        })
        .filter(Boolean)
        .join('، ');

      const allShopNames = assignedMechanics
        .map(m => {
          if (m.mechanicId) {
            const found = mechanics.find(mech => mech.id.toString() === m.mechanicId);
            return found?.shopName || m.repairShopName;
          }
          return m.repairShopName;
        })
        .filter(Boolean)
        .join('، ');

      const totalWages = assignedMechanics.reduce((sum, m) => sum + (Number(m.wages) || 0), 0);
      const selectedVeh = vehicles.find(v => v.id.toString() === vehicleId);

      // تعیین وضعیت جدید (پذیرش / ویرایش پذیرش یا ذخیره موقت: in_progress | اتمام / ویرایش فاکتور: completed)
      const newStatus: 'in_progress' | 'completed' = overrideStatus || (
        (formMode === 'reception' || formMode === 'edit_reception') ? 'in_progress' : 'completed'
      );

      if (editingSession && onEditService) {
        // ۱. بروزرسانی یا افزودن ردیف‌های سرویس به این پرونده
        for (const row of serviceRows) {
          const matchedDef = findMatchingServiceDef(row.serviceType, serviceDefinitions);
          const safeCurrentKm = Number(currentKm) || 0;
          const intervalKm = matchedDef ? Number(matchedDef.intervalKm) || 5000 : 5000;
          const itemNextKm = (row.nextKm !== undefined && Number(row.nextKm) > 0)
            ? Number(row.nextKm)
            : (safeCurrentKm + intervalKm);
          const itemNextDate = row.nextDate || '';

          let serviceNote = notes;
          if (row.partSource === 'supplier' && row.supplierName) {
            serviceNote = `[تامین‌کننده: ${row.supplierName}${row.partName ? ` - قطعه: ${row.partName}` : ''}] ${serviceNote}`.trim();
          } else if (row.partName.trim()) {
            serviceNote = `[برند/قطعه انبار: ${row.partName.trim()}] ${serviceNote}`.trim();
          }
          if (serviceRows.length > 1) {
            serviceNote = `[ثبت گروهی ${serviceRows.length} سرویس] ${serviceNote}`.trim();
          }

          const isVehicleChanged = Number(vehicleId) !== editingSession.vehicleId;
          const origDriver = editingSession.driverName || (editingSession.items && editingSession.items[0]?.driverName);
          const origCompany = editingSession.company || (editingSession.items && editingSession.items[0]?.company);
          const origPlaque = editingSession.plaque || (editingSession.items && editingSession.items[0]?.plaque);

          const payload: Partial<PeriodicService> = {
            vehicleId: Number(vehicleId),
            serviceType: row.serviceType,
            serviceDate,
            currentKm: Number(currentKm),
            nextKm: itemNextKm,
            nextDate: itemNextDate,
            quantity: Number(row.quantity) || 1,
            unitPrice: Number(row.unitPrice) || 0,
            cost: Number(row.cost) || 0,
            notes: serviceNote,
            partSource: row.partSource || (row.supplierId || row.supplierName ? 'supplier' : row.partId ? 'warehouse' : 'none'),
            partId: row.partSource === 'warehouse' ? row.partId : undefined,
            partName: row.partName || undefined,
            supplierId: row.partSource === 'supplier' ? row.supplierId : undefined,
            supplierName: row.partSource === 'supplier' ? row.supplierName : undefined,
            driverName: isVehicleChanged ? (selectedVeh?.driverName || 'ثبت نشده') : (origDriver || selectedVeh?.driverName || 'ثبت نشده'),
            company: isVehicleChanged ? (selectedVeh?.company || 'ثبت نشده') : (origCompany || selectedVeh?.company || 'ثبت نشده'),
            plaque: isVehicleChanged ? (selectedVeh?.plaque || 'ثبت نشده') : (origPlaque || selectedVeh?.plaque || 'ثبت نشده'),
            mechanicId: primaryMech?.mechanicId ? Number(primaryMech.mechanicId) : undefined,
            mechanicName: allMechNames || undefined,
            repairShopName: allShopNames || undefined,
            wages: totalWages,
            status: newStatus
          };

          if (row.existingId && editingSession.items.some(i => i.id === row.existingId)) {
            await onEditService(row.existingId, payload);
          } else {
            await onAddService(payload as Omit<PeriodicService, 'id' | 'createdAt'>);
          }
        }

        // ۲. حذف ردیف‌هایی که در حین ویرایش پاک شده‌اند
        if (onDeleteService) {
          const remainingExistingIds = new Set(serviceRows.map(r => r.existingId).filter(Boolean));
          for (const origItem of editingSession.items) {
            if (!remainingExistingIds.has(origItem.id)) {
              await onDeleteService(origItem.id);
            }
          }
        }
      } else {
        // ثبت سرویس دوره‌ای جدید
        for (const row of serviceRows) {
          const matchedDef = findMatchingServiceDef(row.serviceType, serviceDefinitions);
          const safeCurrentKm = Number(currentKm) || 0;
          const intervalKm = matchedDef ? Number(matchedDef.intervalKm) || 5000 : 5000;
          const itemNextKm = (row.nextKm !== undefined && Number(row.nextKm) > 0)
            ? Number(row.nextKm)
            : (safeCurrentKm + intervalKm);
          const itemNextDate = row.nextDate || '';

          let serviceNote = notes;
          if (row.partSource === 'supplier' && row.supplierName) {
            serviceNote = `[تامین‌کننده: ${row.supplierName}${row.partName ? ` - قطعه: ${row.partName}` : ''}] ${serviceNote}`.trim();
          } else if (row.partName.trim()) {
            serviceNote = `[برند/قطعه انبار: ${row.partName.trim()}] ${serviceNote}`.trim();
          }
          if (serviceRows.length > 1) {
            serviceNote = `[ثبت گروهی ${serviceRows.length} سرویس] ${serviceNote}`.trim();
          }

          await onAddService({
            vehicleId: Number(vehicleId),
            serviceType: row.serviceType,
            serviceDate,
            currentKm: Number(currentKm),
            nextKm: itemNextKm,
            nextDate: itemNextDate,
            quantity: Number(row.quantity) || 1,
            unitPrice: Number(row.unitPrice) || 0,
            cost: Number(row.cost) || 0,
            notes: serviceNote,
            partSource: row.partSource || (row.supplierId || row.supplierName ? 'supplier' : row.partId ? 'warehouse' : 'none'),
            partId: row.partSource === 'warehouse' ? row.partId : undefined,
            partName: row.partName || undefined,
            supplierId: row.partSource === 'supplier' ? row.supplierId : undefined,
            supplierName: row.partSource === 'supplier' ? row.supplierName : undefined,
            driverName: selectedVeh?.driverName,
            company: selectedVeh?.company,
            plaque: selectedVeh?.plaque,
            mechanicId: primaryMech?.mechanicId ? Number(primaryMech.mechanicId) : undefined,
            mechanicName: allMechNames || undefined,
            repairShopName: allShopNames || undefined,
            wages: totalWages,
            status: newStatus
          });
        }
      }

      // ریست فرم و خروج از صفحه ثبت/ویرایش
      setServiceRows([]);
      setNotes('');
      setCost(0);
      setMechanicId('');
      setMechanicName('');
      setRepairShopName('');
      setWages(0);
      setAssignedMechanics([
        {
          id: 'mech-reset',
          mechanicId: '',
          mechanicName: '',
          repairShopName: '',
          wages: 0
        }
      ]);
      setEditingSession(null);
      setIsFormOpen(false);

      if (newStatus === 'completed') {
        setActiveTab('completed');
      } else {
        setActiveTab('in_progress');
      }
    } catch (err) {
      console.error(err);
      alert('خطا در ذخیره‌سازی سرویس دوره‌ای');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // دریافت پیش‌بینی و تحلیل سررسید تمام خدمات یک خودرو در یک کیلومتر مشخص
  const getDueRecommendations = (vIdStr: string, currentKilometer: number) => {
    if (!vIdStr || !serviceDefinitions || !currentKilometer || currentKilometer <= 0) return [];
    const vId = Number(vIdStr);
    const selectedVeh = vehicles.find(v => v.id === vId);
    if (!selectedVeh) return [];

    const previousReceptionKm = lastReceptionInfo?.lastKm || 0;

    // ۱. اگر خودرو برای بار اول مراجعه می‌کند یا هیچ سابقه سرویس قبلی ندارد:
    // طبق دستور صریح: چون مشخص نیست قبلاً کی سرویس رفته، هیچ سرویسی به صورت پیشنهادی ارائه نمی‌شود
    if (isFirstTimeReceptionVehicle || !lastReceptionInfo || previousReceptionKm <= 0) {
      return [];
    }

    // ۲. اگر دفعه اولش نیست، از آخرین کیلومتری که سری قبل آمده برای سرویس و مراجعات قبلی تحلیل انجام می‌شود
    return serviceDefinitions.map(def => {
      const lastEvent = findLastServiceOrRepairEvent(
        vId,
        def,
        services,
        failures,
        workflows,
        parts
      );

      // مبنای محاسبه: آخرین باری که این خدمت در سیستم ثبت شده، یا در صورت عدم ثبت مجزا، آخرین کیلومتری که سری قبل خودرو آمده برای سرویس
      const lastKm = Number(lastEvent.lastServicedKm) > 0 ? Number(lastEvent.lastServicedKm) : Number(previousReceptionKm);
      const intervalKm = Number(def.intervalKm) || 5000;
      const targetKm = lastKm + intervalKm;
      const remainingKm = targetKm - currentKilometer;
      const warningKm = Number(def.warningKm) || 500;
      const warningStartKm = targetKm - warningKm;

      let status: 'overdue' | 'warning' | 'ok' = 'ok';
      if (remainingKm <= 0) {
        status = 'overdue';
      } else if (remainingKm <= warningKm) {
        status = 'warning';
      }

      // آیا سررسید یا اخطار در بازه مراجعه قبلی تا کیلومتر فعلی واقع شده است
      const isDueInThisPeriod = targetKm <= currentKilometer;
      const isWarningInThisPeriod = currentKilometer >= warningStartKm && currentKilometer < targetKm;

      // محاسبه موعد مراجعه بعدی بر اساس میانگین بازه دوره‌های قبلی خودرو
      const recCalc = calculateReceptionNextService({
        vehicleId: vId,
        serviceType: def.serviceType,
        currentServiceDate: serviceDate || getCurrentJalaliDate(),
        currentServiceKm: currentKilometer,
        intervalKm: def.intervalKm,
        allServices: services,
        allFailures: failures,
        allVehicles: vehicles,
        editingSessionItems: editingSession ? editingSession.items : undefined
      });

      return {
        def,
        lastService: lastEvent,
        lastKm,
        targetKm,
        warningStartKm,
        remainingKm,
        status,
        isDueInThisPeriod,
        isWarningInThisPeriod,
        previousReceptionKm,
        isFromRepair: lastEvent.isFromRepair,
        sourceLabel: lastEvent.sourceLabel,
        details: lastEvent.details,
        // اطلاعات محاسبه تاریخ مراجعه بر اساس میانگین دوره‌های قبل
        hasHistory: recCalc.hasHistory,
        nextVisitDate: recCalc.nextDate || '',
        dailyMileage: recCalc.dailyMileage,
        estimatedDays: recCalc.estimatedDays,
        basis: recCalc.basis
      };
    });
  };

  // دریافت پیش‌بینی سررسید و بازه اخطار خدمات در کیلومتر سررسید بعدی (Future Milestone Projection)
  const getFutureMilestoneRecommendations = (vIdStr: string, activeCurrentKm: number, targetNextKm: number) => {
    if (!vIdStr || !serviceDefinitions) return [];
    const vId = Number(vIdStr);
    const selectedVeh = vehicles.find(v => v.id === vId);
    if (!selectedVeh) return [];

    const milestoneKm = targetNextKm > activeCurrentKm ? targetNextKm : activeCurrentKm + 5000;

    return serviceDefinitions.map(def => {
      const defLower = def.serviceType.toLowerCase();
      const keywords = ['روغن', 'فیلتر', 'لنت', 'تسمه', 'باتری', 'شمع', 'واسکازین', 'ضدیخ', 'لاستیک'];
      const matchedKws = keywords.filter(kw => defLower.includes(kw));

      // آیا این نوع خدمت همین الان در ردیف‌های سرویس جاری فاکتور قرار دارد؟
      const isBeingServicedNow = serviceRows.some(r => {
        const rLower = r.serviceType.toLowerCase();
        if (rLower === defLower) return true;
        if (matchedKws.length > 0 && matchedKws.some(kw => rLower.includes(kw))) return true;
        return false;
      });

      let lastKm = 0;
      if (isBeingServicedNow) {
        // اگر الان در حال تعویض است، مبنا کیلومتر فعلی خودرو محاسبه می‌شود
        lastKm = activeCurrentKm;
      } else {
        // در غیر این صورت آخرین کیلومتر انجام شده در سوابق قبلی خودرو (سرویس یا تعمیرگاه) را پیدا می‌کنیم
        const lastEvent = findLastServiceOrRepairEvent(
          vId,
          def,
          services,
          failures,
          workflows,
          parts
        );
        lastKm = lastEvent.lastServicedKm;
      }

      const intervalKm = Number(def.intervalKm) || 5000;
      const warningKm = Number(def.warningKm) || 500;
      const targetKm = Number(lastKm) + intervalKm;
      const warningStartKm = targetKm - warningKm;
      const remainingKmAtMilestone = targetKm - milestoneKm;

      let statusAtMilestone: 'overdue' | 'warning' | 'ok' = 'ok';
      if (milestoneKm >= targetKm) {
        statusAtMilestone = 'overdue';
      } else if (milestoneKm >= warningStartKm) {
        statusAtMilestone = 'warning';
      } else {
        statusAtMilestone = 'ok';
      }

      return {
        def,
        lastKm,
        targetKm,
        warningStartKm,
        remainingKmAtMilestone,
        statusAtMilestone,
        isBeingServicedNow,
        kmDiffFromCurrent: milestoneKm - activeCurrentKm
      };
    });
  };

  // افزودن دسته‌جمعی تمام خدمات سررسیدشده یا در بازه اخطار به جدول به صورت یکجا
  const handleAddAllDueServices = (vIdStr: string, currentKilometer: number) => {
    const recs = getDueRecommendations(vIdStr, currentKilometer);
    const dueItems = recs.filter(r => r.status === 'overdue' || r.status === 'warning');

    const newRows: ServiceRowItem[] = [];
    dueItems.forEach(item => {
      const isAlreadyAdded = serviceRows.some(r => r.serviceType === item.def.serviceType) ||
                             newRows.some(r => r.serviceType === item.def.serviceType);
      if (!isAlreadyAdded) {
        let defNextKm: number | undefined = undefined;
        let defNextDate: string | undefined = undefined;

        if (formMode === 'reception' || formMode === 'edit_reception') {
          const defs = calculateServiceRowDefaults(item.def.serviceType, Number(vIdStr), currentKilometer, serviceDate);
          defNextKm = defs.nextKm;
          defNextDate = defs.nextDate;
        }

        newRows.push({
          id: Math.random().toString(36).substring(2, 9),
          serviceType: item.def.serviceType,
          nextKm: defNextKm,
          nextDate: defNextDate || '',
          partSource: undefined,
          partId: undefined,
          partName: '',
          supplierId: undefined,
          supplierName: '',
          quantity: undefined,
          rawQuantityInput: '',
          unitPrice: 0,
          cost: 0
        });
      }
    });

    if (newRows.length > 0) {
      const updated = [...serviceRows, ...newRows];
      setServiceRows(updated);
      calculateTotalCost(updated);
    }
  };

  // محاسبه مجموع اجرت‌های یک جلسه سرویس
  const getSessionWages = (items: PeriodicService[]) => {
    if (!items || items.length === 0) return 0;
    const firstWithWage = items.find(i => (i.wages || 0) > 0);
    if (!firstWithWage) return 0;
    const allSameWage = items.every(i => (i.wages || 0) === (firstWithWage.wages || 0));
    if (allSameWage) return firstWithWage.wages || 0;
    return items.reduce((acc, i) => acc + (Number(i.wages) || 0), 0);
  };

  // گروه‌بندی سوابق سرویس بر اساس نوبت انجام (خودرو + تاریخ انجام + کیلومتر ثبت‌شده)
  const serviceSessions: ServiceSession[] = useMemo(() => {
    const sessionMap = new Map<string, ServiceSession>();

    // مرتب‌سازی بر اساس شناسه نزولی برای حفظ ترتیب
    const sorted = [...services].sort((a, b) => (b.id || 0) - (a.id || 0));

    sorted.forEach(s => {
      const sessionKey = `${s.vehicleId}_${s.serviceDate}_${s.currentKm || 0}`;
      const v = vehicles.find(veh => String(veh.id) === String(s.vehicleId) || Number(veh.id) === Number(s.vehicleId));

      if (sessionMap.has(sessionKey)) {
        const existing = sessionMap.get(sessionKey)!;
        existing.items.push(s);
        if (!existing.notes && s.notes) {
          existing.notes = s.notes;
        }
      } else {
        sessionMap.set(sessionKey, {
          id: sessionKey,
          vehicleId: s.vehicleId,
          serviceDate: s.serviceDate,
          currentKm: s.currentKm || 0,
          totalCost: 0,
          partsCost: 0,
          wages: 0,
          driverName: s.driverName || v?.driverName,
          company: s.company || v?.company,
          plaque: s.plaque || v?.plaque,
          notes: s.notes,
          createdAt: s.createdAt,
          items: [s]
        });
      }
    });

    const sessions = Array.from(sessionMap.values());
    sessions.forEach(session => {
      const partsTotal = session.items.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
      const sessionWages = getSessionWages(session.items);
      session.partsCost = partsTotal;
      session.wages = sessionWages;
      session.totalCost = partsTotal + sessionWages;
    });

    return sessions;
  }, [services, vehicles]);

  // تفکیک جلسات سرویس به «در حال ارائه سرویس / پذیرش شده» و «سرویس شده / تکمیلی»
  const inProgressSessions = useMemo(() => {
    return serviceSessions.filter(session => session.items.some(i => i.status === 'in_progress'));
  }, [serviceSessions]);

  const completedSessions = useMemo(() => {
    return serviceSessions.filter(session => session.items.every(i => i.status !== 'in_progress'));
  }, [serviceSessions]);

  const activeTabSessions = activeTab === 'in_progress' ? inProgressSessions : completedSessions;

  // فیلترهای سبک اکسل ستون‌ها
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [filterMenu, setFilterMenu] = useState<FilterMenuState | null>(null);

  const getSessionColValue = (session: ServiceSession, colKey: string): string => {
    const v = vehicles.find(veh => String(veh.id) === String(session.vehicleId) || Number(veh.id) === Number(session.vehicleId));
    if (colKey === 'serviceDate') return session.serviceDate || '—';
    if (colKey === 'vehicleName') {
      if (v) return `${v.name} - پلاک [${toPersianDigits(v.plaque)}]`;
      if (session.plaque) return `پلاک [${toPersianDigits(session.plaque)}]`;
      if (session.driverName) return `خودرو ${session.driverName}`;
      return '—';
    }
    if (colKey === 'serviceCount') return `${session.items.length} خدمت`;
    if (colKey === 'currentKm') return `${session.currentKm} km`;
    if (colKey === 'cost') return formatPrice(session.totalCost);
    return String((session as any)[colKey] ?? '—');
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
    serviceSessions.forEach(sess => {
      const val = getSessionColValue(sess, filterMenu.colKey);
      valMap.set(val, (valMap.get(val) || 0) + 1);
    });
    return Array.from(valMap.entries()).map(([value, count]) => ({ value, count }));
  }, [filterMenu, serviceSessions, vehicles]);

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

  // لیست خودروها منطبق با عبارت جستجوی نام خودرو (فقط نام و کد خودرو)
  const matchedVehicles = useMemo(() => {
    const query = searchTerm.trim();
    return query
      ? vehicles.filter(v => startsWithPrefix(v.name, query) || startsWithPrefix(v.code, query))
      : vehicles;
  }, [vehicles, searchTerm]);

  // فیلتر کردن نوبت‌های سرویس (فقط بر اساس نام خودرو، بازه تاریخ و فیلترهای ستونی)
  const filteredSessions = useMemo(() => {
    return activeTabSessions.filter(session => {
      const v = vehicles.find(veh => veh.id === session.vehicleId);
      
      const searchLower = searchTerm.trim();
      const matchesSearch = 
        !searchLower ||
        (v && (startsWithPrefix(v.name, searchLower) || startsWithPrefix(v.code, searchLower)));

      const matchesVehicle = vehicleFilter === 'all' || !vehicleFilter || session.vehicleId.toString() === vehicleFilter;

      // فیلتر بازه تاریخ (از تاریخ / تا تاریخ)
      const startComp = normalizeToComparableJalali(startDate);
      const endComp = normalizeToComparableJalali(endDate);
      const sessionComp = normalizeToComparableJalali(session.serviceDate);

      if (startComp && sessionComp && sessionComp < startComp) return false;
      if (endComp && sessionComp && sessionComp > endComp) return false;

      if (!matchesSearch || !matchesVehicle) return false;

      for (const [key, selectedVals] of Object.entries(columnFilters)) {
        if (!selectedVals || !Array.isArray(selectedVals)) continue;
        const val = getSessionColValue(session, key);
        if (!selectedVals.includes(val)) return false;
      }

      return true;
    });
  }, [activeTabSessions, vehicles, searchTerm, vehicleFilter, startDate, endDate, columnFilters]);

  const sortedSessions = sortData<ServiceSession>(filteredSessions, sortKey, sortDirection, {
    vehicleName: (sess: ServiceSession) => {
      const v = vehicles.find(veh => veh.id === sess.vehicleId);
      return v ? v.name : '';
    },
    serviceDate: (sess: ServiceSession) => sess.serviceDate || '',
    serviceCount: (sess: ServiceSession) => sess.items.length || 0,
    currentKm: (sess: ServiceSession) => sess.currentKm || 0,
    cost: (sess: ServiceSession) => sess.totalCost || 0,
  });

  const totalPages = Math.ceil(sortedSessions.length / pageSize) || 1;
  const paginatedSessions = sortedSessions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // خروجی فایل اکسل از اطلاعات بازه تاریخی یا کل سوابق سرویس‌های دوره‌ای
  const handleExportExcel = () => {
    try {
      const sanitize = (val: any) => {
        if (val === undefined || val === null) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const startComp = normalizeToComparableJalali(startDate);
      const endComp = normalizeToComparableJalali(endDate);

      const itemsToExport = serviceSessions.filter(session => {
        const sessionComp = normalizeToComparableJalali(session.serviceDate);
        if (startComp && sessionComp && sessionComp < startComp) return false;
        if (endComp && sessionComp && sessionComp > endComp) return false;
        if (vehicleFilter && vehicleFilter !== 'all' && session.vehicleId.toString() !== vehicleFilter) return false;
        return true;
      });

      const fileName = (startDate || endDate)
        ? `گزارش_سرویس_های_دوره_ای_از_${startDate || 'ابتدا'}_تا_${endDate || 'انتها'}`
        : 'گزارش_جامع_سرویس_های_دوره_ای';

      const headers = [
        'ردیف',
        'تاریخ سرویس',
        'کد خودرو',
        'نام خودرو',
        'پلاک خودرو',
        'راننده',
        'شرکت',
        'کیلومتر ثبت شده',
        'تعداد خدمات',
        'شرح خدمات و قطعات',
        'هزینه فاکتور (ریال)',
        'توضیحات'
      ];

      const rows = itemsToExport.map((sess, idx) => {
        const v = vehicles.find(veh => String(veh.id) === String(sess.vehicleId) || Number(veh.id) === Number(sess.vehicleId));
        const serviceTitles = sess.items.map(it => {
          const partName = it.partId ? parts?.find(p => p.id === it.partId)?.partName : '';
          return partName ? `${it.serviceType} (${partName})` : it.serviceType;
        }).join('، ');

        const sessionDriver = sess.driverName || (sess.items && sess.items[0]?.driverName) || v?.driverName || '—';
        const sessionCompany = sess.company || (sess.items && sess.items[0]?.company) || v?.company || '—';
        const sessionPlaque = sess.plaque || (sess.items && sess.items[0]?.plaque) || v?.plaque || '—';

        return [
          idx + 1,
          toJalaliDate(sess.serviceDate),
          v?.code || '—',
          v ? `${v.name} - پلاک [${toPersianDigits(v.plaque)}]` : (sessionPlaque !== '—' ? `پلاک [${toPersianDigits(sessionPlaque)}]` : '—'),
          sessionPlaque,
          sessionDriver,
          sessionCompany,
          sess.currentKm || 0,
          sess.items.length,
          serviceTitles || '—',
          sess.totalCost || 0,
          sess.notes || '—'
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
      link.setAttribute('download', `${fileName}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export Excel error:', err);
    }
  };



  // کامپوننت فاکتور رسمی جهت چاپ مستقیم از طریق پنجره پرینت مرورگر
  const renderPrintableInvoice = () => {
    const isPrintingDetail = !!selectedDetailSession;
    const currentVeh = isPrintingDetail
      ? vehicles.find(v => v.id === selectedDetailSession.vehicleId)
      : vehicles.find(v => v.id.toString() === vehicleId);

    const printDate = isPrintingDetail ? selectedDetailSession.serviceDate : serviceDate;
    const printDocNum = isPrintingDetail ? (selectedDetailSession.items[0]?.id || '101') : docNum;
    const printKm = isPrintingDetail ? selectedDetailSession.currentKm : currentKm;
    const printCost = isPrintingDetail ? selectedDetailSession.totalCost : cost;
    const printNotes = isPrintingDetail
      ? (selectedDetailSession.notes || selectedDetailSession.items.map(i => i.notes).filter(Boolean).join(' | '))
      : notes;

    const printItems = isPrintingDetail
      ? selectedDetailSession.items.map((i, idx) => ({
          id: i.id.toString(),
          serviceType: i.serviceType,
          partName: i.partId ? (parts?.find(p => p.id === i.partId)?.partName || '') : '',
          cost: Number(i.cost) || 0
        }))
      : serviceRows;

    const printNextKm = isPrintingDetail
      ? (selectedDetailSession.items.find(i => i.nextKm)?.nextKm || selectedDetailSession.items[0]?.nextKm || 0)
      : (serviceRows.find(r => r.nextKm)?.nextKm || 0);

    const printNextDate = isPrintingDetail
      ? (selectedDetailSession.items.find(i => i.nextDate)?.nextDate || selectedDetailSession.items[0]?.nextDate || '')
      : (serviceRows.find(r => r.nextDate)?.nextDate || '');

    return (
      <div id="printable-service-invoice-area" className="hidden print:block text-black bg-white p-6 rounded-2xl w-full dir-rtl font-sans">
        {/* هدر فاکتور */}
        <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-black text-white rounded-xl flex items-center justify-center font-black text-xl">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-black tracking-tight">فاکتور رسمی خدمات سرویس و نگهداری</h1>
              <p className="text-xs text-black mt-1">مدیریت ناوگان خودرویی یاس - برگه رسمی سرویس و تعمیرات</p>
            </div>
          </div>
          <div className="text-left font-mono text-xs space-y-1 p-2.5 rounded-xl border border-black min-w-[170px]">
            <div><span className="font-bold">تاریخ صدور:</span> {toPersianDigits(printDate)}</div>
            <div><span className="font-bold">شماره سند:</span> <span className="font-extrabold">#{toPersianDigits(printDocNum)}</span></div>
            <div><span className="font-bold">وضعیت پرداخت:</span> <span className="font-extrabold">تسویه / ثبت قطعی</span></div>
          </div>
        </div>

        {/* مشخصات خودرو در جدول کارتی */}
        <div className="grid grid-cols-4 gap-3 p-3.5 rounded-xl border border-black mb-4 font-sans">
          <div className="space-y-0.5">
            <span className="text-[10px] text-black block">نام خودرو</span>
            <span className="font-bold text-black text-sm">{currentVeh?.name || '---'}</span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-black block">شماره پلاک</span>
            <span className="font-mono font-bold text-black text-sm inline-block">{toPersianDigits(currentVeh?.plaque || '---')}</span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-black block">کد اختصاصی</span>
            <span className="font-mono font-bold text-black text-sm">{toPersianDigits(currentVeh?.code || '---')}</span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-black block">کارکرد فعلی</span>
            <span className="font-mono font-bold text-black text-sm">{formatNumber(printKm)} کیلومتر</span>
          </div>
        </div>

        {/* جدول اقلام و خدمات */}
        <div className="space-y-2 mb-4">
          <div className="font-extrabold text-black text-sm flex items-center gap-1.5 border-r-4 border-black pr-2">
            <span>شرح خدمات انجام شده و اقلام مصرفی</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-black">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="border-b border-black font-bold">
                  <th className="py-2 px-3 w-12 text-center border-l border-black">#</th>
                  <th className="py-2 px-3 border-l border-black">شرح خدمت / تعمیر</th>
                  <th className="py-2 px-3 border-l border-black">قطعه انبار مصرفی</th>
                  <th className="py-2 px-3 text-left">مبلغ (ریال)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black">
                {printItems.map((row, idx) => (
                  <tr key={row.id}>
                    <td className="py-2 px-3 text-center font-mono font-bold border-l border-black">{toPersianDigits(idx + 1)}</td>
                    <td className="py-2 px-3 font-bold border-l border-black">{row.serviceType}</td>
                    <td className="py-2 px-3 font-medium border-l border-black">{row.partName || 'بدون قطعه انبار'}</td>
                    <td className="py-2 px-3 text-left font-mono font-extrabold">{formatPrice(row.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* جمع فاکتور */}
        <div className="flex justify-between items-center p-3.5 rounded-xl border border-black mb-4">
          <span className="font-bold text-sm">جمع کل پرداختی این دوره سرویس:</span>
          <span className="font-mono text-base font-black">{formatPrice(printCost)} ریال</span>
        </div>

        {/* پیش‌بینی و سررسید سرویس بعدی */}
        <div className="p-3.5 border border-black rounded-xl text-black text-xs space-y-1 flex items-center justify-between mb-4">
          <div>
            <div className="font-extrabold mb-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-black inline-block"></span>
              <span>برنامه پایش و سررسید سرویس بعدی خودرو:</span>
            </div>
            <div className="text-black text-[11px]">مراجعه بعدی جهت حفظ سلامت فنی بر اساس کارکرد یا تاریخ پیشنهاد می‌گردد.</div>
          </div>
          <div className="text-left font-mono font-bold p-2.5 rounded-lg border border-black space-y-0.5 min-w-[160px]">
            <div>سررسید کیلومتر: <span>{formatNumber(printNextKm)} km</span></div>
            <div>سررسید تاریخ: <span>{toPersianDigits(printNextDate || '---')}</span></div>
          </div>
        </div>

        {printNotes && (
          <div className="text-xs text-black p-3.5 rounded-xl border border-black space-y-1 mb-6">
            <span className="font-bold block">توضیحات تکمیلی و یادداشت تعمیرگاه:</span>
            <p className="text-black leading-relaxed">{printNotes}</p>
          </div>
        )}

        {/* بخش امضاها و مهر */}
        <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs text-black">
          <div className="p-4 rounded-xl border border-black space-y-10">
            <div className="font-bold">مهر و امضاء تعمیرگاه / سرویس‌کار مجاز</div>
            <div className="border-b border-dashed border-black w-3/4 mx-auto"></div>
          </div>
          <div className="p-4 rounded-xl border border-black space-y-10">
            <div className="font-bold">امضاء مدیر ناوگان / تحویل‌گیرنده</div>
            <div className="border-b border-dashed border-black w-3/4 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  };

  // ۲. اگر کاربر صفحه ثبت سرویس جدید را باز کرده است (نمایش تمام‌صفحه هماهنگ و یکپارچه با بخش تعمیرات)
  if (isFormOpen) {
    const selectedVeh = vehicles.find(v => v.id.toString() === vehicleId);

    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-[#111113] rounded-lg w-full border border-slate-200 dark:border-[#2d2d30] flex flex-col overflow-hidden space-y-0">
          
          {/* هدر صفحه اختصاصی ثبت یا ویرایش سرویس */}
          <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                {formMode === 'reception' ? (
                  <>
                    <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <span>صفحه پذیرش سرویس دوره‌ای خودرو</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-300 dark:border-indigo-500/30">
                      مرحله اول: پذیرش اولیه
                    </span>
                  </>
                ) : formMode === 'edit_reception' ? (
                  <>
                    <Edit2 className="w-5 h-5 text-amber-500" />
                    <span>ویرایش پذیرش سرویس دوره‌ای خودرو</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded border border-amber-300 dark:border-amber-500/30">
                      ویرایش پذیرش قبل از فاکتور
                    </span>
                  </>
                ) : formMode === 'completion' ? (
                  <>
                    <Receipt className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <span>ثبت اتمام کار، فاکتور و ترخیص سرویس دوره‌ای</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded border border-indigo-200 dark:border-indigo-500/20">
                      مرحله دوم: اتمام کار و فاکتور
                    </span>
                  </>
                ) : (
                  <>
                    <Edit2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <span>ویرایش فاکتور سرویس دوره‌ای خودرو</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded border border-indigo-200 dark:border-indigo-500/20">
                      ویرایش فاکتور نهایی
                    </span>
                  </>
                )}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                {isReceptionStyle
                  ? 'ثبت خودرو، کیلومتر پذیرش و انتخاب عناوین خدمات با محاسبه خودکار سررسید بعدی'
                  : selectedVeh
                  ? (
                    <>
                      خودرو: <strong className="text-slate-900 dark:text-white">{selectedVeh.name} ({selectedVeh.code})</strong> | پلاک: <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{toPersianDigits(selectedVeh.plaque)}</strong> | تخصیص قطعات، هزینه، اجرت و صدور فاکتور
                    </>
                  )
                  : 'تخصیص قطعات، هزینه، اجرت و صدور فاکتور سرویس دوره‌ای'}
              </p>
            </div>
            <button 
              onClick={() => {
                setEditingSession(null);
                setIsFormOpen(false);
              }} 
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors border border-transparent hover:border-slate-300 dark:border-[#2d2d30] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* بدنه فرم ثبت یا ویرایش سرویس */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs bg-white dark:bg-[#111113]">
            
            {/* ۱. ردیف اول: نام خودرو، تاریخ پذیرش / انجام و کارکرد فعلی */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
              {/* انتخاب خودرو */}
              <div className="md:col-span-6 space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  نام ماشین (جستجو و انتخاب) <span className="text-rose-500">*</span>
                </label>
                <CustomSelect
                  value={vehicleId}
                  onChange={(val) => handleVehicleChangeInForm(String(val))}
                  placeholder="جستجو و انتخاب خودرو از لیست..."
                  searchable={true}
                  quickAddType="vehicle"
                  options={vehicles.map(v => ({
                    value: v.id.toString(),
                    label: `${v.name} - پلاک [${toPersianDigits(v.plaque)}] (کد: ${toPersianDigits(v.code)})`
                  }))}
                />
                <input type="hidden" value={vehicleId} required />
              </div>

              {/* تاریخ پذیرش / انجام سرویس */}
              <div className="md:col-span-3 space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  {isReceptionStyle ? 'تاریخ پذیرش' : 'تاریخ سرویس'} <span className="text-rose-500">*</span>
                </label>
                <JalaliDatePicker 
                  value={serviceDate} 
                  onChange={handleServiceDateChange}
                  className="w-full"
                  inputClassName={`h-[38px] text-xs font-bold rounded-md ${
                    isDateInvalid ? 'border-rose-500 ring-1 ring-rose-500' : ''
                  }`}
                />
                {isDateInvalid && (
                  <div className="flex items-center gap-1.5 pt-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                    <span>
                      خطا: تاریخ پذیرش نمی‌تواند قبل از پذیرش قبلی ({toPersianDigits(previousServiceDate)}) باشد!
                    </span>
                  </div>
                )}
              </div>

              {/* کارکرد فعلی (کیلومتر) */}
              <div className="md:col-span-3 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                    کیلومتر فعلی <span className="text-rose-500">*</span>
                  </label>
                </div>
                <input 
                  type="text" 
                  inputMode="numeric"
                  value={currentKm && currentKm > 0 ? formatNumber(currentKm) : ''} 
                  onChange={e => handleCurrentKmChange(parsePersianNumber(e.target.value))} 
                  placeholder="مثال: ۱۲۵،۰۰۰"
                  className={`w-full h-[38px] px-3 rounded-md border bg-white dark:bg-[#161619] text-slate-900 dark:text-white focus:outline-none font-mono font-bold text-xs shadow-2xs transition-colors ${
                    isKmInvalid
                      ? 'border-rose-500 dark:border-rose-500 ring-1 ring-rose-500 focus:ring-rose-500 bg-rose-50/20'
                      : 'border-slate-300 dark:border-[#2d2d30] focus:ring-1 focus:ring-indigo-500'
                  }`}
                  required 
                />
                {isKmInvalid && (
                  <div className="flex items-center gap-1.5 pt-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                    <span>
                      خطا: کیلومتر فعلی ({formatNumber(currentKm)}) نمی‌تواند کمتر از دوره قبل پذیرش ({formatNumber(previousKm)}) باشد!
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* وضعیت مدارک قانونی در قسمت بالایی پذیرش خودرو: بیمه‌نامه شخص ثالث، بیمه بدنه و معاینه فنی */}
            {vehicleInsuranceSummary && (
              <div className="bg-slate-50 dark:bg-[#161619] rounded-xl border border-slate-200 dark:border-[#2d2d30] overflow-hidden text-xs transition-all">
                {/* هدر بخش وضعیت مدارک به همراه دکمه سوئیچ خاموش / روشن */}
                <div className={`flex items-center justify-between gap-3 p-2.5 sm:px-3 bg-white/70 dark:bg-[#18181c]/70 ${
                  showInsuranceStatus ? 'border-b border-slate-200/80 dark:border-[#2d2d30]/80' : ''
                }`}>
                  <div 
                    className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 text-xs cursor-pointer select-none"
                    onClick={toggleInsuranceStatus}
                  >
                    <div className={`p-1 rounded-full border transition-colors ${
                      showInsuranceStatus
                        ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20'
                        : 'bg-slate-100 dark:bg-[#202024] text-slate-400 border-slate-200 dark:border-[#2d2d30]'
                    }`}>
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                    <span className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                      وضعیت بیمه‌نامه و معاینه فنی خودرو
                    </span>
                  </div>

                  {/* دکمه سوئیچ ظریف و جمع‌وجور با تناسبات و مرکزیت ریاضی صد در صد دقیق وکتوری */}
                  <div dir="ltr" className="flex items-center">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showInsuranceStatus}
                      onClick={toggleInsuranceStatus}
                      className="group relative inline-flex items-center justify-center p-0.5 border-0 bg-transparent cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-full"
                      title={showInsuranceStatus ? 'خاموش کردن نمایش وضعیت بیمه و معاینه فنی' : 'روشن کردن نمایش وضعیت بیمه و معاینه فنی'}
                    >
                      <svg
                        width="36"
                        height="20"
                        viewBox="0 0 36 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="block overflow-visible"
                      >
                        {/* کپسول پس‌زمینه با مرکز عمودی دقیق ۱۰ */}
                        <rect
                          x="0"
                          y="0"
                          width="36"
                          height="20"
                          rx="10"
                          className={`transition-colors duration-200 ${
                            showInsuranceStatus
                              ? 'fill-indigo-600 dark:fill-indigo-500'
                              : 'fill-slate-300 dark:fill-[#38383c]'
                          }`}
                        />
                        {/* دایره سفید که به صورت قطعی در cy=10 (مرکز دقیق عمودی) قرار دارد */}
                        <circle
                          cx={showInsuranceStatus ? 26 : 10}
                          cy="10"
                          r="7.5"
                          fill="#ffffff"
                          className="transition-all duration-200 ease-in-out"
                          style={{
                            filter: 'drop-shadow(0px 0.5px 1.5px rgba(0, 0, 0, 0.2))'
                          }}
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* نمایش کارت‌ها منحصراً در صورت روشن بودن سوئیچ */}
                {showInsuranceStatus && (
                  <div className="p-3 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* ۱. بیمه شخص ثالث */}
                      <div className={`p-2.5 rounded-lg border flex flex-col justify-between transition-colors ${
                        vehicleInsuranceSummary.tpStatus === 'valid'
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200'
                          : vehicleInsuranceSummary.tpStatus === 'expiring_soon'
                          ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200'
                          : 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40 text-rose-900 dark:text-rose-200'
                      }`}>
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="font-extrabold text-[11px] flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            بیمه شخص ثالث (اجباری)
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                            vehicleInsuranceSummary.tpStatus === 'valid'
                              ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                              : vehicleInsuranceSummary.tpStatus === 'expiring_soon'
                              ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                              : 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40'
                          }`}>
                            {vehicleInsuranceSummary.tpStatus === 'valid' ? 'معتبر' : vehicleInsuranceSummary.tpStatus === 'expiring_soon' ? 'نزدیک انقضا' : vehicleInsuranceSummary.tpStatus === 'expired' ? 'منقضی شده' : 'ثبت‌نشده'}
                          </span>
                        </div>
                        <div className="text-[11px]">
                          {vehicleInsuranceSummary.thirdParty ? (
                            <div className="text-slate-700 dark:text-slate-300 flex items-center justify-between gap-1">
                              <span>انقضا: <strong className="font-mono font-bold text-slate-900 dark:text-white">{toJalaliDate(vehicleInsuranceSummary.thirdParty.endDate)}</strong></span>
                              {vehicleInsuranceSummary.tpDiff !== null && (
                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                  ({vehicleInsuranceSummary.tpDiff >= 0 ? `${toPersianDigits(vehicleInsuranceSummary.tpDiff)} روز مانده` : `${toPersianDigits(Math.abs(vehicleInsuranceSummary.tpDiff))} روز گذشته`})
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="text-slate-500 dark:text-slate-400 text-[10px]">اطلاعات بیمه‌نامه در سیستم ثبت نشده است.</div>
                          )}
                        </div>
                      </div>

                      {/* ۲. بیمه بدنه */}
                      <div className={`p-2.5 rounded-lg border flex flex-col justify-between transition-colors ${
                        vehicleInsuranceSummary.colStatus === 'valid'
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200'
                          : vehicleInsuranceSummary.colStatus === 'expiring_soon'
                          ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200'
                          : vehicleInsuranceSummary.colStatus === 'expired'
                          ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40 text-rose-900 dark:text-rose-200'
                          : 'bg-slate-100/70 dark:bg-[#1a1a1c] border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400'
                      }`}>
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="font-extrabold text-[11px] flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            بیمه بدنه (اختیاری)
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                            vehicleInsuranceSummary.colStatus === 'valid'
                              ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                              : vehicleInsuranceSummary.colStatus === 'expiring_soon'
                              ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                              : vehicleInsuranceSummary.colStatus === 'expired'
                              ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40'
                              : 'bg-slate-200 dark:bg-[#252528] text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-[#353538]'
                          }`}>
                            {vehicleInsuranceSummary.colStatus === 'valid' ? 'معتبر' : vehicleInsuranceSummary.colStatus === 'expiring_soon' ? 'نزدیک انقضا' : vehicleInsuranceSummary.colStatus === 'expired' ? 'منقضی شده' : 'فاقد پوشش'}
                          </span>
                        </div>
                        <div className="text-[11px]">
                          {vehicleInsuranceSummary.collision ? (
                            <div className="text-slate-700 dark:text-slate-300 flex items-center justify-between gap-1">
                              <span>انقضا: <strong className="font-mono font-bold text-slate-900 dark:text-white">{toJalaliDate(vehicleInsuranceSummary.collision.endDate)}</strong></span>
                              {vehicleInsuranceSummary.colDiff !== null && (
                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                  ({vehicleInsuranceSummary.colDiff >= 0 ? `${toPersianDigits(vehicleInsuranceSummary.colDiff)} روز مانده` : `${toPersianDigits(Math.abs(vehicleInsuranceSummary.colDiff))} روز گذشته`})
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="text-slate-500 dark:text-slate-400 text-[10px]">فاقد بیمه‌نامه بدنه ثبت‌شده.</div>
                          )}
                        </div>
                      </div>

                      {/* ۳. معاینه فنی دوره‌ای */}
                      <div className={`p-2.5 rounded-lg border flex flex-col justify-between transition-colors ${
                        vehicleInsuranceSummary.inspStatus === 'valid'
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200'
                          : vehicleInsuranceSummary.inspStatus === 'expiring_soon'
                          ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200'
                          : 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40 text-rose-900 dark:text-rose-200'
                      }`}>
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="font-extrabold text-[11px] flex items-center gap-1">
                            <CheckSquare className="w-3 h-3" />
                            معاینه فنی دوره‌ای
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                            vehicleInsuranceSummary.inspStatus === 'valid'
                              ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                              : vehicleInsuranceSummary.inspStatus === 'expiring_soon'
                              ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                              : 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40'
                          }`}>
                            {vehicleInsuranceSummary.inspStatus === 'valid' ? 'معتبر' : vehicleInsuranceSummary.inspStatus === 'expiring_soon' ? 'نزدیک انقضا' : vehicleInsuranceSummary.inspStatus === 'expired' ? 'منقضی شده' : 'ثبت‌نشده'}
                          </span>
                        </div>
                        <div className="text-[11px]">
                          {vehicleInsuranceSummary.latestInspection ? (
                            <div className="text-slate-700 dark:text-slate-300 flex items-center justify-between gap-1">
                              <span>انقضا: <strong className="font-mono font-bold text-slate-900 dark:text-white">{toJalaliDate(vehicleInsuranceSummary.latestInspection.expiryDate)}</strong></span>
                              {vehicleInsuranceSummary.inspDiff !== null && (
                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                  ({vehicleInsuranceSummary.inspDiff >= 0 ? `${toPersianDigits(vehicleInsuranceSummary.inspDiff)} روز مانده` : `${toPersianDigits(Math.abs(vehicleInsuranceSummary.inspDiff))} روز گذشته`})
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="text-slate-500 dark:text-slate-400 text-[10px]">گواهی معاینه فنی در سیستم ثبت نشده است.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ۲. بخش جدول اقلام و خدمات سرویس دوره‌ای (دقیقاً با استایل جدول قطعات بخش تعمیرات) */}
            <div className="space-y-2.5 bg-slate-50 dark:bg-[#161618] rounded-xl border border-slate-200 dark:border-[#2d2d30] p-3">
              {/* هدر بخش خدمات */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-[#2d2d30]">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded border border-indigo-200 dark:border-indigo-500/20">
                    <Package className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                      {isReceptionStyle ? 'عناوین خدمات درخواستی و سررسید بعدی' : 'عناوین خدمات و قطعات مصرفی فاکتور'}
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {isReceptionStyle
                        ? 'انتخاب عناوین خدمات و محاسبه هوشمند کیلومتر و تاریخ سررسید بعدی بر اساس سوابق گذشته'
                        : 'تخصیص قطعات انبار یا تأمین‌کننده آزاد به همراه مقدار، قیمت واحد و قیمت کل هر ردیف'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddServiceRow}
                  className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold rounded border border-indigo-200 dark:border-indigo-800/60 transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن خدمت</span>
                </button>
              </div>

              {/* نوار پیشنهادات هوشمند سریع در صورت وجود سررسید یا اخطار در بازه کیلومتر وارد شده */}
              {vehicleId && currentKm > 0 && isReceptionStyle && (() => {
                const dueRecs = getDueRecommendations(vehicleId, currentKm).filter(
                  r => (r.status === 'overdue' || r.status === 'warning') &&
                       !serviceRows.some(row => row.serviceType === r.def.serviceType)
                );
                if (dueRecs.length === 0) return null;

                const overdueCount = dueRecs.filter(r => r.status === 'overdue').length;
                const warningCount = dueRecs.filter(r => r.status === 'warning').length;
                const prevKm = lastReceptionInfo?.lastKm || 0;
                const avgDailyKm = dueRecs[0]?.dailyMileage ? Math.round(dueRecs[0].dailyMileage) : 0;

                return (
                  <div className="p-2.5 bg-amber-50/60 dark:bg-amber-950/20 rounded-lg border border-amber-200/80 dark:border-amber-500/20 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-950 dark:text-amber-200 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>سرویس‌های سررسید شده دوره (کارکرد: {toPersianDigits(formatNumber(currentKm))} کیلومتر):</span>
                        <div className="flex items-center gap-1 mr-1">
                          {overdueCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-[10px] font-bold font-mono">
                              {toPersianDigits(overdueCount)} سررسید
                            </span>
                          )}
                          {warningCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-[10px] font-bold font-mono">
                              {toPersianDigits(warningCount)} اخطار
                            </span>
                          )}
                        </div>
                      </div>

                      {/* دکمه افزودن دسته‌جمعی همه پیشنهادات این دوره */}
                      <button
                        type="button"
                        onClick={() => handleAddAllDueServices(vehicleId, currentKm)}
                        className="px-2.5 py-1 bg-amber-100/80 hover:bg-amber-200 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-[11px] font-bold rounded border border-amber-300 dark:border-amber-700/60 transition-all flex items-center gap-1.5 cursor-pointer"
                        title="افزودن تمام سرویس‌های سررسید شده به جدول"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>افزودن همه</span>
                      </button>
                    </div>

                    {/* شبکه منظم و مرتب خدمات دارای سررسید */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                      {dueRecs.map(rec => (
                        <button
                          key={rec.def.id}
                          type="button"
                          onClick={() => handleAddServiceRowDirectly(rec.def.serviceType)}
                          className={`w-full text-[11px] font-bold px-2.5 py-1.5 rounded border transition-all flex items-center justify-between gap-2 cursor-pointer shadow-2xs text-right ${
                            rec.status === 'overdue'
                              ? 'bg-white dark:bg-[#1a1a1c] border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 hover:bg-rose-50/70 dark:hover:bg-rose-950/30 hover:border-rose-300'
                              : 'bg-white dark:bg-[#1a1a1c] border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 hover:bg-amber-50/70 dark:hover:bg-amber-950/30 hover:border-amber-300'
                          }`}
                          title="کلیک جهت افزودن این خدمت به جدول"
                        >
                          <div className="flex items-center gap-1.5 min-w-0 truncate">
                            <Plus className="w-3.5 h-3.5 shrink-0 opacity-70" />
                            <span className="truncate">{rec.def.serviceType}</span>
                          </div>
                          <span className={`shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                            rec.status === 'overdue'
                              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                              : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                          }`}>
                            سررسید: {toPersianDigits(formatNumber(rec.targetKm))}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* جدول ردیف‌ها با استایل فشرده و منظم */}
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#2d2d30] bg-white dark:bg-[#111113]">
                <table className="w-full text-right text-xs font-mono font-bold text-slate-700 dark:text-slate-300 border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-[#161618] border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-mono font-bold text-xs">
                      <th className="py-2 px-2 text-center w-8 text-xs font-mono font-bold">#</th>
                      <th className="py-2 px-2 min-w-[180px]">عنوان خدمت <span className="text-rose-500">*</span></th>
                      {isReceptionStyle ? (
                        <>
                          <th className="py-2 px-2 w-36 min-w-[130px]">کیلومتر سررسید بعدی</th>
                          <th className="py-2 px-2 w-44 min-w-[140px]">تاریخ سررسید بعدی</th>
                        </>
                      ) : (
                        <>
                          <th className="py-2 px-2 min-w-[150px]">قطعه مصرفی</th>
                          <th className="py-2 px-2 min-w-[140px]">تأمین‌کننده / منبع</th>
                          <th className="py-2 px-2 text-center w-20 min-w-[70px]">مقدار / تعداد</th>
                          <th className="py-2 px-2 text-left w-28 min-w-[105px]">قیمت واحد (ریال)</th>
                          <th className="py-2 px-2 text-left w-32 min-w-[115px]">قیمت کل (ریال)</th>
                        </>
                      )}
                      <th className="py-2 px-2 text-center w-10">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                    {serviceRows.length === 0 ? (
                      <tr>
                        <td colSpan={isReceptionStyle ? 5 : 8} className="text-center py-6 text-slate-500 font-bold text-[11px]">
                          هیچ خدمتی ثبت نشده است. روی دکمه «+ افزودن خدمت» کلیک کنید.
                        </td>
                      </tr>
                    ) : (
                      serviceRows.map((row, index) => {
                        const supplierSelectValue = (() => {
                          if (row.partSource === 'warehouse' || (row.partId && row.supplierName === 'انبار شرکت')) {
                            return 'warehouse';
                          }
                          if (row.supplierId) {
                            return row.supplierId.toString();
                          }
                          if (row.supplierName && row.supplierName !== 'انبار شرکت') {
                            const matchedMech = (mechanics || []).find(m => {
                              const full = m.shopName ? `${m.name} (${m.shopName})` : m.name;
                              return full === row.supplierName || m.name === row.supplierName;
                            });
                            if (matchedMech) {
                              return `mech_${matchedMech.id}`;
                            }
                            const matchedSup = suppliers.find(s => s.name === row.supplierName);
                            if (matchedSup) {
                              return matchedSup.id.toString();
                            }
                            return row.supplierName;
                          }
                          return '';
                        })();

                        const isExternalSupplier = Boolean(
                          row.partSource === 'supplier' || (row.supplierId || (row.supplierName && row.supplierName !== 'انبار شرکت'))
                        );

                        const rowQuantity = row.quantity && row.quantity > 0 ? row.quantity : 1;
                        const rowUnitPrice = row.unitPrice !== undefined ? row.unitPrice : (row.cost ? Math.round(row.cost / rowQuantity) : 0);

                        return (
                          <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/40 transition-colors">
                            <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-400 dark:text-slate-500 text-[10px]">
                              {toPersianDigits(index + 1)}
                            </td>

                            {/* ۱. عنوان خدمت */}
                            <td className="py-1.5 px-2">
                              <CustomSelect
                                value={row.serviceType}
                                onChange={(val) => handleUpdateServiceRow(row.id, 'serviceType', val)}
                                placeholder="انتخاب عنوان خدمت..."
                                searchable={true}
                                size="xs"
                                quickAddType="service"
                                options={availableServiceOptions.map(preset => ({ value: preset, label: preset }))}
                              />
                            </td>

                            {isReceptionStyle ? (
                              <>
                                {/* ۲. کیلومتر سررسید بعدی این خدمت (محاسبه خودکار و امکان ویرایش دستی) */}
                                <td className="py-1.5 px-2">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={row.nextKm && Number(row.nextKm) > 0 ? formatNumber(row.nextKm) : ''}
                                    onChange={e => {
                                      const val = parsePersianNumber(e.target.value);
                                      handleUpdateServiceRow(row.id, 'nextKm', val > 0 ? val : undefined);
                                    }}
                                    placeholder={currentKm > 0 ? 'محاسبه...' : '—'}
                                    className="w-full h-6 px-2 rounded border border-slate-200 dark:border-[#2d2d30] bg-white dark:bg-[#18181b] text-indigo-700 dark:text-indigo-300 font-mono font-bold text-[10px] text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                                    title={`کیلومتر سررسید بعدی (محاسبه: کیلومتر جاری ${toPersianDigits(formatNumber(currentKm))} + دوره خدمت) - در صورت نیاز می‌توانید دستی ویرایش کنید`}
                                  />
                                </td>

                                {/* ۳. تاریخ سررسید بعدی این خدمت (محاسبه خودکار بر اساس میانگین کارکرد مراجعات و امکان ویرایش دستی) */}
                                <td className="py-1.5 px-2">
                                  <input
                                    type="text"
                                    value={row.nextDate ? toPersianDigits(row.nextDate) : ''}
                                    onChange={e => {
                                      handleUpdateServiceRow(row.id, 'nextDate', toEnglishDigits(e.target.value).trim());
                                    }}
                                    placeholder="—"
                                    className={`w-full h-6 px-2 rounded border font-mono text-[10px] text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors ${
                                      row.nextDate 
                                        ? 'border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-bold'
                                        : 'border-slate-200 dark:border-[#2d2d30] bg-white dark:bg-[#18181b] text-slate-700 dark:text-slate-300'
                                    }`}
                                    title={
                                      row.nextDate 
                                        ? `تاریخ سررسید بعدی: ${toPersianDigits(row.nextDate)} (قابل ویرایش دستی)`
                                        : 'در صورت تمایل تاریخ سررسید بعدی را دستی وارد نمایید'
                                    }
                                  />
                                </td>
                              </>
                            ) : (
                              <>
                                {/* ۲. انتخاب قطعه */}
                                <td className="py-1.5 px-2">
                                  {isExternalSupplier ? (
                                    <input
                                      type="text"
                                      placeholder="نام یا مدل قطعه..."
                                      value={row.partName || ''}
                                      onChange={e => handleUpdateServiceRow(row.id, 'partName', e.target.value)}
                                      className="w-full h-6 px-2 rounded border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-slate-800 dark:text-slate-200 text-[10px] focus:ring-1 focus:ring-indigo-500"
                                    />
                                  ) : (
                                    <CustomSelect
                                      value={row.partId ? row.partId.toString() : ''}
                                      onChange={(val) => handleSelectPartInRow(row.id, String(val))}
                                      placeholder=""
                                      showEmptyAsBlank={true}
                                      searchable={true}
                                      size="xs"
                                      quickAddType="part"
                                      options={[
                                        { value: '', label: 'بدون قطعه انبار' },
                                        ...parts.map(p => ({
                                          value: p.id.toString(),
                                          label: p.partName
                                        }))
                                      ]}
                                    />
                                  )}
                                </td>

                                {/* ۳. تامین‌کننده */}
                                <td className="py-1.5 px-2">
                                  <CustomSelect
                                    value={supplierSelectValue}
                                    onChange={(val) => handleSelectSupplierInRow(row.id, String(val))}
                                    placeholder=""
                                    showEmptyAsBlank={true}
                                    searchable={true}
                                    size="xs"
                                    quickAddType="supplier"
                                    options={[
                                      { value: '', label: 'بدون تامین‌کننده' },
                                      { value: 'warehouse', label: 'انبار شرکت' },
                                      ...suppliers.map(s => ({
                                        value: s.id.toString(),
                                        label: s.name
                                      })),
                                      ...(mechanics || []).map(m => ({
                                        value: `mech_${m.id}`,
                                        label: m.shopName ? `${m.name} (${m.shopName})` : m.name
                                      }))
                                    ]}
                                  />
                                </td>

                                {/* ۴. مقدار / تعداد (با پشتیبانی کامل از اعشار) */}
                                <td className="py-1.5 px-2">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="مقدار..."
                                    value={row.rawQuantityInput !== undefined ? row.rawQuantityInput : (row.quantity !== undefined ? formatQuantity(row.quantity) : '')}
                                    onChange={e => {
                                      const rawVal = e.target.value;
                                      if (rawVal.trim() === '') {
                                        handleUpdateServiceRow(row.id, {
                                          rawQuantityInput: '',
                                          quantity: undefined
                                        });
                                      } else {
                                        const val = parsePersianNumber(rawVal);
                                        handleUpdateServiceRow(row.id, {
                                          rawQuantityInput: rawVal,
                                          quantity: isNaN(val) ? undefined : val
                                        });
                                      }
                                    }}
                                    onBlur={() => {
                                      handleUpdateServiceRow(row.id, {
                                        rawQuantityInput: undefined
                                      });
                                    }}
                                    className="w-full h-6 px-1.5 rounded border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white font-mono font-bold text-center focus:ring-1 focus:ring-indigo-500 text-[10px]"
                                  />
                                </td>

                                {/* ۵. قیمت واحد (ریال) */}
                                <td className="py-1.5 px-2">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="۰"
                                    value={row.unitPrice !== undefined ? (row.unitPrice ? formatPrice(row.unitPrice) : '۰') : (row.cost && rowQuantity ? formatPrice(Math.round(row.cost / rowQuantity)) : '')}
                                    onChange={e => {
                                      const up = parsePersianNumber(e.target.value) || 0;
                                      handleUpdateServiceRow(row.id, { unitPrice: up });
                                    }}
                                    className="w-full h-6 px-2 rounded border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-slate-800 dark:text-slate-200 font-mono text-left focus:ring-1 focus:ring-indigo-500 text-[10px]"
                                  />
                                </td>

                                {/* ۶. قیمت کل (ریال) */}
                                <td className="py-1.5 px-2">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="۰"
                                    value={row.cost ? formatPrice(row.cost) : '۰'}
                                    onChange={e => {
                                      const totalCost = parsePersianNumber(e.target.value) || 0;
                                      handleUpdateServiceRow(row.id, { cost: totalCost });
                                    }}
                                    className="w-full h-6 px-2 rounded border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-emerald-600 dark:text-emerald-400 font-mono font-bold text-left focus:ring-1 focus:ring-indigo-500 text-[10px]"
                                  />
                                </td>
                              </>
                            )}

                            {/* ۷. حذف ردیف */}
                            <td className="py-1.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveServiceRow(row.id)}
                                className="w-6 h-6 inline-flex items-center justify-center bg-slate-100 dark:bg-[#1a1a1c] hover:bg-rose-50 dark:hover:bg-rose-600/20 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded border border-slate-200 dark:border-[#2d2d30] transition-colors cursor-pointer"
                                title="حذف ردیف"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* جمع‌های تفکیکی زیر جدول در حالت فاکتور */}
              {isCompletionStyle && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 dark:text-slate-400">
                      تعداد خدمات: <strong className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{toPersianDigits(serviceRows.length)} مورد</strong>
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      جمع هزینه‌های اقلام: <strong className="font-mono text-slate-700 dark:text-slate-300 font-bold">{formatPrice(serviceRows.reduce((sum, r) => sum + (Number(r.cost) || 0), 0))} ریال</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ۳. بخش تعمیرکاران و اجرت‌های تفکیکی + تسویه مالی فاکتور (در حالت فاکتور و ویرایش بعد از فاکتور) */}
            {isCompletionStyle && (
              <div className="p-3 bg-slate-50 dark:bg-[#161618] rounded-xl border border-slate-200 dark:border-[#2d2d30] space-y-3">
                {/* هدر بخش تعمیرکاران با دکمه افزودن */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#2d2d30]">
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded border border-indigo-200 dark:border-indigo-500/20">
                      <Wrench className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                        تعمیرکاران و مراکز خدمات اعزامی / مجری
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        امکان ثبت یک یا چند تعمیرکار به همراه اجرت اختصاصی هر کدام
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddMechanic}
                    className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold rounded border border-indigo-200 dark:border-indigo-800/60 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن تعمیرکار</span>
                  </button>
                </div>

                {/* جدول تعمیرکاران و اجرت‌ها با ساختار مشابه جدول خدمات */}
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#2d2d30] bg-white dark:bg-[#111113]">
                  <table className="w-full text-right text-xs font-mono font-bold text-slate-700 dark:text-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-[#161618] border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-mono font-bold text-xs">
                        <th className="py-2 px-2 text-center w-8 text-xs font-mono font-bold">#</th>
                        <th className="py-2 px-2 min-w-[200px]">تعمیرکار / مرکز خدمات اعزامی <span className="text-rose-500">*</span></th>
                        <th className="py-2 px-2 w-48 min-w-[140px] text-left">اجرت (ریال)</th>
                        <th className="py-2 px-2 text-center w-10">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                      {assignedMechanics.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-4 text-slate-500 font-bold text-[11px]">
                            هیچ تعمیرکاری ثبت نشده است. روی دکمه «+ افزودن تعمیرکار» کلیک کنید.
                          </td>
                        </tr>
                      ) : (
                        assignedMechanics.map((mechItem, mIndex) => {
                          const selectVal = mechItem.mechanicId || (mechItem.repairShopName ? `custom:${mechItem.repairShopName}` : '');
                          return (
                            <tr key={mechItem.id} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/40 transition-colors">
                              <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-400 dark:text-slate-500 text-[10px]">
                                {toPersianDigits(mIndex + 1)}
                              </td>

                              <td className="py-1.5 px-2">
                                <CustomSelect
                                  value={selectVal}
                                  onChange={(val) => handleUpdateMechanic(mechItem.id, { mechanicId: String(val) })}
                                  placeholder=""
                                  showEmptyAsBlank={true}
                                  searchable={true}
                                  size="xs"
                                  quickAddType="mechanic"
                                  options={[
                                    { value: '', label: 'بدون تعمیرکار' },
                                    ...mechanics.map(m => ({
                                      value: m.id.toString(),
                                      label: `${m.name}${m.shopName ? ` (${m.shopName})` : ''} - ${m.specialty || 'تعمیرگاه/سرویس‌کار'}`
                                    }))
                                  ]}
                                />
                              </td>

                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="۰"
                                  value={mechItem.wages ? formatPrice(mechItem.wages) : ''}
                                  onChange={e => handleUpdateMechanic(mechItem.id, { wages: parsePersianNumber(e.target.value) || 0 })}
                                  className="w-full h-6 px-2 rounded border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white font-mono font-bold text-[10px] text-left focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                />
                              </td>

                              <td className="py-1.5 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMechanic(mechItem.id)}
                                  className="w-6 h-6 inline-flex items-center justify-center bg-slate-100 dark:bg-[#1a1a1c] hover:bg-rose-50 dark:hover:bg-rose-600/20 text-slate-400 hover:text-rose-600 rounded border border-slate-200 dark:border-[#2d2d30] transition-colors cursor-pointer"
                                  title="حذف این تعمیرکار"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* توضیحات سرویس و خلاصه مالی فاکتور */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch pt-2 border-t border-slate-200 dark:border-[#2d2d30]">
                  {/* توضیحات */}
                  <div className="md:col-span-6 space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                      شرح خدمات یا توضیحات و ملاحظات سرویس‌کار
                    </label>
                    <input 
                      type="text" 
                      value={notes} 
                      onChange={e => setNotes(e.target.value)} 
                      placeholder="مثال: تعویض روغن ۱۰W۴۰ بهران، فیلترها و آچارکشی اولیه..."
                      className="w-full h-[38px] px-3 rounded-md border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#161619] text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs placeholder-slate-400 dark:placeholder-slate-600 font-medium" 
                    />
                  </div>

                  {/* جمع اجرت‌ها و جمع کل فاکتور نهایی */}
                  <div className="md:col-span-6 grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                        مجموع اجرت‌ها (ریال)
                      </label>
                      <div className="w-full h-[38px] px-3 rounded-md border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] flex items-center justify-between select-none">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">اجرت کل:</span>
                        <div className="text-xs font-black text-slate-900 dark:text-white font-mono">
                          {formatPrice(assignedMechanics.reduce((sum, m) => sum + (Number(m.wages) || 0), 0))} <span className="text-[10px] font-normal text-slate-500">ریال</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                        مبلغ کل فاکتور نهایی (ریال) <span className="text-rose-500">*</span>
                      </label>
                      <div className="w-full h-[38px] px-3 rounded-md border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] flex items-center justify-between select-none">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">مجموع کل:</span>
                        <div className="text-xs font-black text-slate-900 dark:text-white font-mono">
                          {formatPrice(cost)} <span className="text-[10px] font-normal text-slate-500">ریال</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ۵. نوار دکمه‌های اقدام انتهای صفحه (کاملاً هماهنگ با بخش تعمیرات) */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-[#2d2d30]">
              {isCompletionStyle ? (
                <button 
                  type="button"
                  onClick={handleDirectPrintInvoice}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-400 font-bold rounded-md transition-colors border border-slate-200 dark:border-[#2d2d30] text-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                  <span>چاپ فاکتور این دوره</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button 
                  type="button" 
                  onClick={() => {
                    setEditingSession(null);
                    setIsFormOpen(false);
                  }} 
                  className="px-3 py-1.5 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-400 font-bold rounded-md transition-colors border border-slate-200 dark:border-[#2d2d30] text-xs cursor-pointer"
                >
                  انصراف
                </button>

                {/* دکمه ذخیره اطلاعات / ذخیره موقت در حالت تکمیل فاکتور (بدون ترخیص و باقی ماندن در در حال انجام) */}
                {formMode === 'completion' && (
                  <button
                    type="button"
                    disabled={isEditSubmitting || isKmInvalid || isDateInvalid}
                    onClick={() => handleSubmit(undefined, 'in_progress')}
                    className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold rounded-md border border-indigo-200 dark:border-indigo-800/60 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isKmInvalid ? `کیلومتر وارد شده کمتر از کیلومتر قبلی (${formatNumber(previousKm)}) است` : isDateInvalid ? `تاریخ وارد شده قبل از آخرین پذیرش قبلی (${toPersianDigits(previousServiceDate)}) است` : "ذخیره اقلام و اطلاعات تکمیل‌شده بدون اتمام پرونده (خودرو در وضعیت در حال انجام باقی می‌ماند تا مابقی کارها انجام شود)"}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isEditSubmitting ? 'در حال ذخیره...' : 'ذخیره اطلاعات (در حال انجام)'}</span>
                  </button>
                )}

                <button 
                  type="submit" 
                  disabled={isEditSubmitting || isKmInvalid || isDateInvalid}
                  title={isKmInvalid ? `کیلومتر فعلی وارد شده کمتر از کیلومتر قبلی (${formatNumber(previousKm)}) است و امکان ثبت وجود ندارد` : isDateInvalid ? `تاریخ وارد شده قبل از آخرین پذیرش قبلی (${toPersianDigits(previousServiceDate)}) است و امکان ثبت وجود ندارد` : undefined}
                  className={`px-4 py-1.5 text-white font-bold rounded-md transition-colors active:scale-95 text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs ${
                    formMode === 'completion'
                      ? 'bg-indigo-600 hover:bg-indigo-500'
                      : formMode === 'edit_completion'
                      ? 'bg-indigo-600 hover:bg-indigo-500'
                      : formMode === 'edit_reception'
                      ? 'bg-amber-600 hover:bg-amber-500'
                      : 'bg-indigo-600 hover:bg-indigo-500'
                  }`}
                >
                  {isEditSubmitting ? (
                    <span>در حال ذخیره...</span>
                  ) : formMode === 'completion' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>ثبت اتمام کار و صدور فاکتور</span>
                    </>
                  ) : formMode === 'edit_completion' ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>ذخیره تغییرات فاکتور</span>
                    </>
                  ) : formMode === 'edit_reception' ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>ذخیره تغییرات پذیرش</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4" />
                      <span>ثبت پذیرش و ارجاع به سرویس</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </form>
        </div>
        {renderPrintableInvoice()}
      </div>
    );
  }

  // ۳. نمایش صفحه اصلی لیست سوابق سرویس‌ها
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* هدر بخش سرویس‌های دوره‌ای */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-[#111113] p-4 rounded-lg border border-slate-200 dark:border-[#2d2d30]">
        <div>
          <h1 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Wrench className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            سرویس‌های دوره‌ای و نگهداری ناوگان
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            ثبت و پیگیری دو مرحله‌ای سرویس‌های دوره‌ای (پذیرش اولیه {'->'} اتمام کار، تخصیص قطعه، تعمیرگاه و تسویه)
          </p>
        </div>
        <button 
          type="button"
          onClick={() => handleOpenForm()} 
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>پذیرش سرویس دوره‌ای جدید</span>
        </button>
      </div>

      {/* تب‌های جابجایی بین بخش‌ها با ترنزیشن نرم و متحرک (مشابه بخش تعمیرات) */}
      <div className="flex border-b border-slate-200 dark:border-[#2d2d30] gap-2 overflow-x-auto relative">
        <button
          type="button"
          onClick={() => setActiveTab('in_progress')}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'in_progress'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>خودروهای در حال ارائه سرویس</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 font-mono font-bold">
            {toPersianDigits(inProgressSessions.length)}
          </span>
          {activeTab === 'in_progress' && (
            <motion.div
              layoutId="activeServiceTabIndicator"
              className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('completed')}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'completed'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>خودروهای سرویس شده</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 font-mono font-bold">
            {toPersianDigits(completedSessions.length)}
          </span>
          {activeTab === 'completed' && (
            <motion.div
              layoutId="activeServiceTabIndicator"
              className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>
      </div>

      {/* ابزار جستجو (فقط نام خودرو مشابه بخش حسابداری و تعمیرات) و فیلترهای تاریخ و خروجی اکسل */}
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
                          <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#1a1a1e] px-2 py-0.5 rounded border border-slate-200 dark:border-[#2d2d30]">
                            پلاک: {toPersianDigits(v.plaque)}
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

        {/* فیلترهای بازه تاریخی و دکمه خروجی اکسل */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex-1 sm:w-36">
            <JalaliDatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="از تاریخ"
              inputClassName="h-[34px] text-[11px] rounded-lg px-2.5 pr-2.5 pl-7"
            />
          </div>

          <div className="flex-1 sm:w-36">
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
            className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-2xs shrink-0 group"
            title={startDate || endDate ? `دریافت خروجی اکسل در بازه تاریخی (${startDate || 'ابتدا'} تا ${endDate || 'انتها'})` : 'دریافت خروجی اکسل کل اطلاعات'}
          >
            <FileSpreadsheet className="w-4 h-4 transition-transform group-hover:scale-110" />
          </button>
        </div>
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
          {/* جدول نمایش پرونده‌های سرویس بر اساس بخش فعال */}
          <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex justify-between items-center">
              <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
                <List className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>
                  {activeTab === 'in_progress' ? 'خودروهای در حال ارائه سرویس' : 'سوابق سرویس‌های انجام‌شده'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {activeTab === 'in_progress' ? (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                    <Receipt className="w-3 h-3" />
                    جهت اتمام کار، «ثبت فاکتور» را بزنید
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    سرویس‌های پایان‌یافته
                  </span>
                )}
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  {toPersianDigits(sortedSessions.length)} مورد
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] text-slate-600 dark:text-slate-400 font-medium text-xs">
                    <th className="py-2 px-3 text-center w-12 text-xs font-medium">ردیف</th>
                    
                    <TableColumnHeader
                      title={activeTab === 'in_progress' ? 'تاریخ پذیرش' : 'تاریخ انجام'}
                      colKey="serviceDate"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      isFiltered={!!columnFilters['serviceDate']}
                      onOpenFilter={handleOpenFilterMenu}
                      width="130px"
                    />

                    <TableColumnHeader
                      title="خودرو"
                      colKey="vehicleName"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      isFiltered={!!columnFilters['vehicleName']}
                      onOpenFilter={handleOpenFilterMenu}
                      width="200px"
                    />

                    <TableColumnHeader
                      title="عناوین خدمات"
                      colKey="serviceCount"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      isFiltered={!!columnFilters['serviceCount']}
                      onOpenFilter={handleOpenFilterMenu}
                    />

                    <TableColumnHeader
                      title="کارکرد کیلومتر"
                      colKey="currentKm"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      isFiltered={!!columnFilters['currentKm']}
                      onOpenFilter={handleOpenFilterMenu}
                      width="130px"
                    />

                    {activeTab === 'completed' && (
                      <TableColumnHeader
                        title="هزینه کل فاکتور"
                        colKey="cost"
                        sortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        isFiltered={!!columnFilters['cost']}
                        onOpenFilter={handleOpenFilterMenu}
                        width="140px"
                      />
                    )}

                    <th className="py-2 px-3 text-center w-36 text-xs font-medium">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                  {paginatedSessions.length === 0 ? (
                    <tr>
                      <td colSpan={activeTab === 'completed' ? 7 : 6} className="text-center py-8 text-slate-500 text-[11px]">
                        {activeTab === 'in_progress' 
                          ? 'هیچ سرویسی در حال حاضر در وضعیت در حال ارائه سرویس وجود ندارد.'
                          : 'هیچ پرونده سرویس تکمیلی منطبق با فیلتر یافت نشد.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedSessions.map((session, index) => {
                      const v = vehicles.find(veh => String(veh.id) === String(session.vehicleId) || Number(veh.id) === Number(session.vehicleId));
                      const itemCount = session.items.length;
                      
                      return (
                        <tr 
                          key={session.id} 
                          onClick={() => handleOpenEditSession(session)}
                          title="برای مشاهده و ویرایش این پرونده سرویس کلیک کنید"
                          className="h-9 hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/60 transition-colors cursor-pointer text-[11px]"
                        >
                          <td className="py-1 px-3 text-center text-slate-500 text-[11px] align-middle">
                            {toPersianDigits((currentPage - 1) * pageSize + index + 1)}
                          </td>
                          <td className="py-1 px-3 text-slate-700 dark:text-slate-300 text-[11px] align-middle">
                            {toJalaliDate(session.serviceDate)}
                          </td>
                          <td className="py-1 px-3 whitespace-nowrap align-middle">
                            <span className="text-slate-900 dark:text-white text-[11px] font-bold">
                              {v ? `${v.name} - پلاک [${toPersianDigits(v.plaque)}]` : (session.plaque ? `پلاک [${toPersianDigits(session.plaque)}]` : '—')}
                            </span>
                          </td>
                          <td className="py-1 px-3 align-middle">
                            <div className="flex items-center gap-1.5 truncate max-w-xs md:max-w-md">
                              <span className="h-[20px] px-1.5 inline-flex items-center justify-center rounded text-[10px] bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20 whitespace-nowrap shrink-0">
                                <span>{toPersianDigits(itemCount)} مورد</span>
                              </span>
                              <span className="text-[11px] text-slate-700 dark:text-slate-300 truncate">
                                {session.items.map(it => it.serviceType).join('، ')}
                              </span>
                            </div>
                          </td>
                          <td className="py-1 px-3 whitespace-nowrap align-middle">
                            <div className="flex items-center gap-1 text-slate-800 dark:text-slate-200">
                              <span className="text-slate-900 dark:text-white text-[11px]">
                                {session.currentKm ? formatNumber(session.currentKm) : '۰'}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                                کیلومتر
                              </span>
                            </div>
                          </td>
                          {activeTab === 'completed' && (
                            <td className="py-1 px-3 align-middle">
                              <div className="text-[11px]">
                                <div className="text-emerald-600 dark:text-emerald-400 font-bold leading-tight">
                                  {Number(session.totalCost) > 0 ? (
                                    <>
                                      {formatPrice(session.totalCost)} <span className="text-[9px] font-normal text-slate-500">ریال</span>
                                    </>
                                  ) : (
                                    'بدون هزینه'
                                  )}
                                </div>
                              </div>
                            </td>
                          )}
                          <td className="py-1 px-3 text-center align-middle">
                            <div className="flex items-center justify-center gap-1">
                              {activeTab === 'in_progress' ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenCompletionModal(session);
                                  }}
                                  className="h-[22px] px-2 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold rounded border border-indigo-200 dark:border-indigo-800 transition-colors inline-flex items-center gap-1 text-[10px] whitespace-nowrap cursor-pointer"
                                  title="ثبت فاکتور، قطعات مصرفی و ترخیص به سرویس شده"
                                >
                                  <Receipt className="w-3 h-3" />
                                  <span>ثبت فاکتور</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDetailSession(session);
                                  }}
                                  title="مشاهده جزئیات فاکتور"
                                  className="w-[22px] h-[22px] flex items-center justify-center bg-slate-100 dark:bg-[#1a1a1c] hover:bg-indigo-100 dark:hover:bg-indigo-600/20 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 rounded border border-slate-200 dark:border-[#2d2d30] transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" />
                                </button>
                              )}

                              {onDeleteService && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    requestDeleteSession(session);
                                  }}
                                  title="حذف پرونده"
                                  className="w-[22px] h-[22px] flex items-center justify-center bg-slate-100 dark:bg-[#1a1a1c] hover:bg-rose-100 dark:hover:bg-rose-600/20 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded border border-slate-200 dark:border-[#2d2d30] transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
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
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={sortedSessions.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
            />
          </div>
        </motion.div>
      </AnimatePresence>

      {/* مدال مشاهده جزئیات کامل پرونده سرویس دوره‌ای - تمام‌صفحه و هماهنگ با ثبت سرویس */}
      {selectedDetailSession && (() => {
        const v = vehicles.find(veh => String(veh.id) === String(selectedDetailSession.vehicleId) || Number(veh.id) === Number(selectedDetailSession.vehicleId));

        return (
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
                      <span>جزئیات کامل پرونده سرویس دوره‌ای</span>
                      <span className="text-xs font-mono font-normal text-slate-500 dark:text-slate-400">
                        ({toPersianDigits(selectedDetailSession.items.length)} ردیف خدمت)
                      </span>
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                      تاریخ انجام: {toJalaliDate(selectedDetailSession.serviceDate)} | کارکرد ثبت‌شده: {formatNumber(selectedDetailSession.currentKm)} کیلومتر
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDetailSession(null)}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* بدنه اسکرول‌خور جزئیات */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
                {/* کارت مشخصات کلی خودرو و نوبت مراجعه */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/80 dark:bg-[#161618]/80 p-4 rounded-xl border border-slate-200 dark:border-[#2d2d30]">
                  <div>
                    <span className="text-slate-500 text-[11px] block mb-0.5">نام خودرو:</span>
                    <strong className="text-slate-900 dark:text-white font-extrabold text-sm">
                      {v ? `${v.name} - پلاک [${toPersianDigits(v.plaque)}]` : (selectedDetailSession.plaque ? `پلاک [${toPersianDigits(selectedDetailSession.plaque)}]` : '—')}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block mb-0.5">شماره پلاک:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                      {v?.plaque ? toPersianDigits(v.plaque) : '---'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block mb-0.5">نام راننده:</span>
                    <span className="text-slate-800 dark:text-slate-200 font-medium">
                      {selectedDetailSession.driverName || v?.driverName || '---'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block mb-0.5">شرکت:</span>
                    <span className="text-slate-800 dark:text-slate-200 font-medium">
                      {selectedDetailSession.company || v?.company || '---'}
                    </span>
                  </div>
                </div>

                {/* کارت اطلاعات تعمیرکار و محل سرویس */}
                {selectedDetailSession.items.some(i => i.mechanicName || i.repairShopName || (i.wages && i.wages > 0)) && (() => {
                  const firstWithMech = selectedDetailSession.items.find(i => i.mechanicName || i.repairShopName || (i.wages && i.wages > 0));
                  const totalWages = selectedDetailSession.items.reduce((acc, i) => acc + (i.wages || 0), 0);
                  const mechanicDisplay = [firstWithMech?.mechanicName, firstWithMech?.repairShopName].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' - ') || 'تعمیرگاه آزاد / نامشخص';

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-indigo-50/50 dark:bg-indigo-950/20 p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-500/20">
                      <div>
                        <span className="text-slate-500 text-[11px] block mb-0.5">تعمیرکار / مرکز خدمات:</span>
                        <strong className="text-indigo-900 dark:text-indigo-200 font-bold text-xs">
                          {mechanicDisplay}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[11px] block mb-0.5">اجرت و دستمزد خدمات:</span>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                          {totalWages > 0 ? `${formatPrice(totalWages)} ریال` : '---'}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* جدول ریز خدمات انجام‌شده در این نوبت */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 border-r-2 border-indigo-500 pr-2">
                      <Wrench className="w-3.5 h-3.5 text-indigo-500" />
                      <span>ریز خدمات انجام‌شده در این نوبت ({toPersianDigits(selectedDetailSession.items.length)} مورد)</span>
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#2d2d30]">
                    <table className="w-full text-right text-xs text-slate-700 dark:text-slate-300 border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-[#1a1a1c] border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-bold">
                          <th className="py-2.5 px-3 w-10 text-center">#</th>
                          <th className="py-2.5 px-3">نوع خدمت / سرویس</th>
                          <th className="py-2.5 px-3">منبع و قطعه مصرفی</th>
                          <th className="py-2.5 px-3 text-center w-14">تعداد</th>
                          <th className="py-2.5 px-3 text-left">قیمت واحد (ریال)</th>
                          <th className="py-2.5 px-3">تاریخ سررسید</th>
                          <th className="py-2.5 px-3">کیلومتر سررسید</th>
                          <th className="py-2.5 px-3 text-left">قیمت کل (ریال)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                        {selectedDetailSession.items.map((item, idx) => {
                          let partName = item.partName || '';
                          let supplierName = item.supplierName || '';
                          const isSupplier = item.partSource === 'supplier' || item.supplierId || item.supplierName;

                          if (!partName && item.notes && item.notes.includes('[برند/قطعه انبار:')) {
                            const match = item.notes.match(/\[برند\/قطعه انبار:\s*([^\]]+)\]/);
                            if (match) partName = match[1];
                          }
                          if (!supplierName && item.notes && item.notes.includes('[تامین‌کننده:')) {
                            const matchSup = item.notes.match(/\[تامین‌کننده:\s*([^\]\-]+)/);
                            if (matchSup) supplierName = matchSup[1].trim();
                          }
                          if (!partName && item.partId) {
                            partName = parts?.find(p => p.id === item.partId)?.partName || '';
                          }

                          const q = item.quantity && item.quantity > 0 ? item.quantity : 1;
                          const up = item.unitPrice !== undefined ? item.unitPrice : (item.cost ? Math.round(item.cost / q) : 0);

                          return (
                            <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/40 transition-colors">
                              <td className="py-2.5 px-3 text-center font-mono text-slate-400 dark:text-slate-500 font-bold text-[11px]">
                                {toPersianDigits(idx + 1)}
                              </td>
                              <td className="py-2.5 px-3 font-extrabold text-slate-900 dark:text-white">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                                  <span>{item.serviceType}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 font-medium">
                                {isSupplier ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold text-[11px] border border-amber-200 dark:border-amber-500/20">
                                    <Store className="w-3 h-3 text-amber-500" />
                                    <span>تامین‌کننده: {supplierName || 'خارجی'}{partName ? ` (${partName})` : ''}</span>
                                  </span>
                                ) : partName ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] border border-indigo-200 dark:border-indigo-500/20">
                                    <Package className="w-3 h-3 text-indigo-500" />
                                    <span>انبار: {partName}</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-500 text-[11px]">بدون قطعه انبار</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                                {toPersianDigits(q)}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300 text-left">
                                {formatPrice(up)}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                                {item.nextDate ? toJalaliDate(item.nextDate) : '—'}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                <span className="text-slate-900 dark:text-white font-mono font-bold text-xs">
                                  {item.nextKm ? formatNumber(item.nextKm) : '—'}
                                </span>
                                {item.nextKm ? (
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal mr-1 font-sans">
                                    کیلومتر
                                  </span>
                                ) : null}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-left">
                                {formatPrice(item.cost)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* کارت مالی جمع کل */}
                <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/20 p-4 rounded-xl flex justify-between items-center">
                  <span className="text-slate-700 dark:text-slate-300 font-bold text-xs">مبلغ کل فاکتور این دوره سرویس:</span>
                  <div className="text-emerald-700 dark:text-emerald-400 font-mono font-black text-base">
                    {formatPrice(selectedDetailSession.totalCost)} <span className="text-xs font-normal text-slate-600 dark:text-slate-400">ریال</span>
                  </div>
                </div>

                {/* توضیحات و یادداشت */}
                {(selectedDetailSession.notes || selectedDetailSession.items.some(i => i.notes)) && (
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 font-bold text-xs block mb-1">توضیحات و مشخصات ثبت‌شده:</span>
                    <div className="bg-slate-50 dark:bg-[#161618] border border-slate-200 dark:border-[#2d2d30] rounded-xl p-3 text-slate-800 dark:text-slate-200 leading-relaxed text-xs">
                      {selectedDetailSession.notes || selectedDetailSession.items.map(i => i.notes).filter(Boolean).join(' | ')}
                    </div>
                  </div>
                )}
              </div>

              {/* فوتر دکمه‌های عملیاتی جزئیات */}
              <div className="flex justify-between items-center p-4 border-t border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] shrink-0">
                <div className="flex items-center gap-2">
                  {onDeleteService && (
                    <button
                      onClick={() => requestDeleteSession(selectedDetailSession)}
                      className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-lg border border-rose-200 dark:border-rose-500/30 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>حذف کل پرونده</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => handlePrintSessionInvoice(selectedDetailSession)}
                    className="px-4 py-2 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-300 font-bold rounded-lg transition-colors border border-slate-200 dark:border-[#2d2d30] text-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    <span>چاپ فاکتور</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDetailSession(null)}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    بستن
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* مودال تایید حذف سفارشی (بله / خیر) */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-60 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {deleteConfirm.title}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {deleteConfirm.vehicleName} - {deleteConfirm.dateStr}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-[#161618] rounded-lg border border-slate-200 dark:border-[#2d2d30] text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
              {deleteConfirm.message}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-300 font-bold rounded-lg transition-colors border border-slate-200 dark:border-[#2d2d30] text-xs cursor-pointer disabled:opacity-50"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg transition-all active:scale-95 text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'در حال حذف...' : 'بله، حذف شود'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {renderPrintableInvoice()}

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
