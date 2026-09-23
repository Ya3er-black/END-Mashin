/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Search, Wrench, Calendar, Clock, List,
  ChevronRight, CheckCircle2, X, ClipboardList,
  UserCheck, MapPin, Package, Settings, BadgeDollarSign, Truck, ShieldCheck,
  ArrowUpDown, ArrowUp, ArrowDown, Sparkles, Check, Trash2, Eye, Receipt, DollarSign,
  AlertCircle, History, FileText, CheckCircle, RefreshCw, Edit2, FileSpreadsheet, Printer, Tag
} from 'lucide-react';
import { Vehicle, VehicleFailure, RepairWorkflow, FailurePriority, FailureType, SatisfactionLevel, PartInventory, User, Mechanic, ServiceDefinition, Supplier, Person, FailureDefinition, FailureCategory, FailureItem } from '../types';
import { toJalaliDate, getCurrentJalaliDate, toJalaliStandardString } from '../utils/date';
import { JalaliDatePicker } from './JalaliDatePicker';
import { toPersianDigits, formatPrice, formatNumber, parsePersianNumber } from '../utils/numberUtils';
import { sortData, SortDirection } from '../utils/sortUtils';
import { Pagination } from './Pagination';
import { CustomSelect } from './CustomSelect';
import { TableColumnHeader, ColumnFilterMenu, FilterMenuState } from './TableFilterSort';
import { detectReplacedServicesInRepair } from '../utils/serviceMatching';
import { getVehicleDisplayName, getVehicleSelectOption, matchesVehicleSearch } from '../utils/vehicleUtils';

const SATISFACTION_OPTIONS: { id: SatisfactionLevel; label: string }[] = [
  { id: 'weak', label: 'ضعیف' },
  { id: 'medium', label: 'متوسط' },
  { id: 'good', label: 'خوب' },
  { id: 'excellent', label: 'عالی' },
];

const SATISFACTION_SELECT_OPTIONS = [
  { value: '', label: '-- انتخاب --' },
  { value: 'excellent', label: 'عالی' },
  { value: 'good', label: 'خوب' },
  { value: 'medium', label: 'متوسط' },
  { value: 'weak', label: 'ضعیف' },
];

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

interface FailuresViewProps {
  vehicles: Vehicle[];
  failures: VehicleFailure[];
  workflows: RepairWorkflow[];
  parts: PartInventory[];
  serviceDefinitions?: ServiceDefinition[];
  failureDefinitions?: FailureDefinition[];
  failureCategories?: FailureCategory[];
  persons?: Person[];
  users: User[];
  mechanics?: Mechanic[];
  suppliers?: Supplier[];
  currentUserRole: string;
  onAddFailure: (failure: Omit<VehicleFailure, 'id' | 'createdAt'> & { assignedMechanicId?: number; repairShopName?: string; startDate?: string }) => Promise<void>;
  onUpdateFailure?: (id: number, failure: Partial<VehicleFailure>) => Promise<void>;
  onDeleteFailure?: (id: number) => Promise<void>;
  onUpdateWorkflow: (id: number, workflow: Partial<RepairWorkflow> & { markReady?: boolean }) => Promise<void>;
  onNavigate?: (view: string) => void;
}

type MainTabType = 'in_repair' | 'completed';

interface InvoicePartRowItem {
  id: string;
  source: string; // 'warehouse' | 'shop' | supplierId (string)
  supplierId?: number;
  supplierName?: string;
  partName: string;
  quantity: number;
  unitPrice: number;
  cost: number;
}

interface FailureItemRow {
  id: string;
  definitionId: string;
  failureType: string;
  category: string;
  mechanicId: string;
  satisfactionLevel: string;
  wage?: number;
  description: string;
}

const createInitialFailureRow = (): FailureItemRow => ({
  id: Math.random().toString(36).substring(2, 9),
  definitionId: '',
  failureType: '',
  category: '',
  mechanicId: '',
  satisfactionLevel: '',
  wage: 0,
  description: ''
});

export default function FailuresView({
  vehicles,
  failures,
  workflows,
  parts,
  serviceDefinitions = [],
  failureDefinitions = [],
  failureCategories: propFailureCategories = [],
  persons = [],
  users,
  mechanics = [],
  suppliers = [],
  currentUserRole,
  onAddFailure,
  onUpdateFailure,
  onDeleteFailure,
  onUpdateWorkflow,
  onNavigate
}: FailuresViewProps) {
  // کلا دو بخش اصلی: در حال تعمیر و آماده شده
  const [activeTab, setActiveTab] = useState<MainTabType>('in_repair');
  const [searchTerm, setSearchTerm] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [sortKey, setSortKey] = useState<string>('failureDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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

  // کنترل مدال‌ها
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [returnInvoiceFailure, setReturnInvoiceFailure] = useState<VehicleFailure | null>(null);
  const [viewDetailsFailure, setViewDetailsFailure] = useState<VehicleFailure | null>(null);

  // فیلدهای فرم ثبت خرابی و ارجاع مستقیم به «در حال تعمیر»
  const [vehicleId, setVehicleId] = useState('');
  const [reportDriverName, setReportDriverName] = useState('');
  const [assignedMechanicId, setAssignedMechanicId] = useState('');
  const [customShopName, setCustomShopName] = useState('');
  const [repairStartDate, setRepairStartDate] = useState(getCurrentJalaliDate());
  const [description, setDescription] = useState('');
  const [failureType, setFailureType] = useState<FailureType>('mechanical');
  const [priority, setPriority] = useState<FailurePriority>('medium');
  const [odometer, setOdometer] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failureRows, setFailureRows] = useState<FailureItemRow[]>([
    createInitialFailureRow(),
    createInitialFailureRow(),
    createInitialFailureRow()
  ]);

  const handleAddFailureRow = () => {
    setFailureRows(prev => [...prev, createInitialFailureRow()]);
  };

  const handleRemoveFailureRow = (id: string) => {
    setFailureRows(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter(r => r.id !== id);
    });
  };

  const handleUpdateFailureRow = (id: string, updates: Partial<FailureItemRow>) => {
    setFailureRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const merged = { ...r, ...updates };

      // اگر عنوان تعریف خرابی تغییر کرد، دسته‌بندی و شرح خودکار پر شوند
      if (updates.definitionId !== undefined) {
        if (!updates.definitionId) {
          merged.failureType = '';
        } else {
          const def = failureDefinitions.find(d => d.id.toString() === updates.definitionId);
          if (def) {
            merged.failureType = def.failureType;
            if (def.category) {
              merged.category = def.category;
            }
            if (!merged.description) {
              merged.description = def.description || def.failureType;
            }
          }
        }
      }
      return merged;
    }));
  };

  // لیست دسته‌بندی‌های نقص فنی با پشتیبانی از localStorage و قابلیت افزودن دسته جدید
  const [failureCategories, setFailureCategories] = useState<{ value: string; label: string }[]>(() => {
    const defaults = [
      { value: 'mechanical', label: 'مکانیکی (موتور / گیربکس / ترمز)' },
      { value: 'electrical', label: 'برقی و سیستم الکترونیک' },
      { value: 'body', label: 'بدنه، نقاشی و صافکاری' },
      { value: 'tires', label: 'لاستیک، جلوبندی و سیستم تعلیق' },
      { value: 'other', label: 'سایر موارد و سرویس‌های تخصصی' }
    ];
    try {
      const saved = localStorage.getItem('fleet_failure_categories');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load failure categories', e);
    }
    return defaults;
  });

  // همگام‌سازی دسته‌بندی‌های سرور با لیست محلی
  useEffect(() => {
    if (propFailureCategories && propFailureCategories.length > 0) {
      setFailureCategories(prev => {
        const map = new Map<string, { value: string; label: string }>();
        prev.forEach(p => map.set(p.label, p));
        propFailureCategories.forEach(c => {
          if (!map.has(c.name)) {
            map.set(c.name, { value: c.name, label: c.name });
          }
        });
        return Array.from(map.values());
      });
    }
  }, [propFailureCategories]);

  // استیت‌های مودال افزودن دسته‌بندی نقص فنی جدید
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryErrorMsg, setCategoryErrorMsg] = useState('');
  const [categoryTargetForm, setCategoryTargetForm] = useState<'create' | 'edit' | 'invoice'>('create');
  const [categoryTargetRowId, setCategoryTargetRowId] = useState<string | null>(null);

  const handleAddFailureCategory = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    if (failureCategories.some(c => c.label.toLowerCase() === trimmed.toLowerCase() || c.value.toLowerCase() === trimmed.toLowerCase())) {
      setCategoryErrorMsg('این دسته‌بندی قبلاً در لیست ثبت شده است.');
      return;
    }
    const newCat = { value: trimmed, label: trimmed };
    const updated = [...failureCategories, newCat];
    setFailureCategories(updated);
    try {
      localStorage.setItem('fleet_failure_categories', JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }
    if (categoryTargetRowId) {
      if (categoryTargetForm === 'create') {
        handleUpdateFailureRow(categoryTargetRowId, { category: trimmed });
      } else if (categoryTargetForm === 'invoice') {
        handleInvoiceUpdateFailureRow(categoryTargetRowId, { category: trimmed });
      } else {
        handleEditUpdateFailureRow(categoryTargetRowId, { category: trimmed });
      }
      setCategoryTargetRowId(null);
    } else if (categoryTargetForm === 'create') {
      setFailureType(trimmed);
    } else {
      setEditCategory(trimmed);
      setEditFailureType(trimmed);
    }
    setNewCategoryName('');
    setCategoryErrorMsg('');
    setIsAddCategoryModalOpen(false);
  };

  // فیلدهای فرم ثبت فاکتور، قطعات مصرفی و انتقال به «آماده شده»
  const [invoiceEndDate, setInvoiceEndDate] = useState(getCurrentJalaliDate());
  const [invoiceMechanicId, setInvoiceMechanicId] = useState<string>('');
  const [invoiceRepairShopName, setInvoiceRepairShopName] = useState<string>('');
  const [invoicePartRows, setInvoicePartRows] = useState<InvoicePartRowItem[]>([]);
  const [invoiceWages, setInvoiceWages] = useState<number>(0);
  const [invoiceTotalCost, setInvoiceTotalCost] = useState<number>(0);
  const [shopInvoiceNotes, setShopInvoiceNotes] = useState<string>('');
  const [selectedReplacedServiceTypes, setSelectedReplacedServiceTypes] = useState<string[]>([]);
  const [invoiceSatisfaction, setInvoiceSatisfaction] = useState<SatisfactionLevel | undefined>(undefined);
  const [invoiceFailureRows, setInvoiceFailureRows] = useState<FailureItemRow[]>([
    createInitialFailureRow()
  ]);

  // استیت دیالوگ مشاهده و ثبت شرح نقص فنی
  const [selectedFailureDescModal, setSelectedFailureDescModal] = useState<{
    rowIndex: number;
    failureType: string;
    description: string;
    isInvoiceForm?: boolean;
  } | null>(null);

  const handleInvoiceAddFailureRow = () => {
    setInvoiceFailureRows(prev => [...prev, createInitialFailureRow()]);
  };

  const handleInvoiceRemoveFailureRow = (id: string) => {
    setInvoiceFailureRows(prev => {
      if (prev.length <= 1) return prev;
      const updated = prev.filter(r => r.id !== id);
      const sumWages = updated.reduce((acc, r) => acc + (Number(r.wage) || 0), 0);
      setInvoiceWages(sumWages);
      calculateTotalInvoiceCost(invoicePartRows, sumWages);
      return updated;
    });
  };

  const handleInvoiceUpdateFailureRow = (id: string, updates: Partial<FailureItemRow>) => {
    setInvoiceFailureRows(prev => {
      const updated = prev.map(r => {
        if (r.id !== id) return r;
        const merged = { ...r, ...updates };

        if (updates.definitionId !== undefined) {
          if (!updates.definitionId) {
            merged.failureType = '';
          } else {
            const def = failureDefinitions.find(d => d.id.toString() === updates.definitionId);
            if (def) {
              merged.failureType = def.failureType;
              if (def.category) {
                merged.category = def.category;
              }
              if (!merged.description) {
                merged.description = def.description || def.failureType;
              }
            }
          }
        }
        return merged;
      });

      if (updates.wage !== undefined) {
        const sumWages = updated.reduce((acc, r) => acc + (Number(r.wage) || 0), 0);
        setInvoiceWages(sumWages);
        calculateTotalInvoiceCost(invoicePartRows, sumWages);
      }

      return updated;
    });
  };

  // استیت‌های مدال ویرایش جامع پرونده خرابی / تعمیرات
  const [editingFailure, setEditingFailure] = useState<VehicleFailure | null>(null);
  const [editVehicleId, setEditVehicleId] = useState('');
  const [editDefinitionId, setEditDefinitionId] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editMechanicId, setEditMechanicId] = useState('');
  const [editRepairShopName, setEditRepairShopName] = useState('');
  const [editFailureDate, setEditFailureDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editFailureType, setEditFailureType] = useState<FailureType>('mechanical');
  const [editPriority, setEditPriority] = useState<FailurePriority>('medium');
  const [editOdometer, setEditOdometer] = useState<number>(0);
  const [editFailureRows, setEditFailureRows] = useState<FailureItemRow[]>([
    createInitialFailureRow()
  ]);

  const handleEditAddFailureRow = () => {
    setEditFailureRows(prev => [...prev, createInitialFailureRow()]);
  };

  const handleEditRemoveFailureRow = (id: string) => {
    setEditFailureRows(prev => {
      if (prev.length <= 1) return prev;
      const updated = prev.filter(r => r.id !== id);
      const sumWages = updated.reduce((acc, r) => acc + (Number(r.wage) || 0), 0);
      setEditWages(sumWages);
      calculateEditTotalCost(editPartRows, sumWages);
      return updated;
    });
  };

  const handleEditUpdateFailureRow = (id: string, updates: Partial<FailureItemRow>) => {
    setEditFailureRows(prev => {
      const updated = prev.map(r => {
        if (r.id !== id) return r;
        const merged = { ...r, ...updates };

        if (updates.definitionId !== undefined) {
          if (!updates.definitionId) {
            merged.failureType = '';
          } else {
            const def = failureDefinitions.find(d => d.id.toString() === updates.definitionId);
            if (def) {
              merged.failureType = def.failureType;
              if (def.category) {
                merged.category = def.category;
              }
              if (!merged.description) {
                merged.description = def.description || def.failureType;
              }
            }
          }
        }
        return merged;
      });

      if (updates.wage !== undefined) {
        const sumWages = updated.reduce((acc, r) => acc + (Number(r.wage) || 0), 0);
        setEditWages(sumWages);
        calculateEditTotalCost(editPartRows, sumWages);
      }

      return updated;
    });
  };

  const [editPartRows, setEditPartRows] = useState<InvoicePartRowItem[]>([]);
  const [editWages, setEditWages] = useState<number>(0);
  const [editTotalCost, setEditTotalCost] = useState<number>(0);
  const [editSelectedReplacedServiceTypes, setEditSelectedReplacedServiceTypes] = useState<string[]>([]);
  const [editSatisfaction, setEditSatisfaction] = useState<SatisfactionLevel | undefined>(undefined);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // گزینه‌های دسته‌بندی به همراه پوشش مقادیر پیشین یا خاص
  const activeFailureCategoryOptions = useMemo(() => {
    const base = [...failureCategories];
    const ensureValue = (val?: string) => {
      if (!val) return;
      if (!base.some(c => c.value === val)) {
        if (val === 'engine') {
          base.push({ value: 'engine', label: 'موتور و قوای محرکه' });
        } else {
          base.push({ value: val, label: val });
        }
      }
    };
    ensureValue(failureType);
    ensureValue(editFailureType);
    return base;
  }, [failureCategories, failureType, editFailureType]);

  const calculateEditTotalCost = (rows: InvoicePartRowItem[], wages: number) => {
    const partsSum = rows.reduce((acc, r) => acc + (Number(r.cost) || 0), 0);
    setEditTotalCost(partsSum + (Number(wages) || 0));
  };

  const handleEditAddPartRow = (source: string = 'warehouse') => {
    let defaultPartName = '';
    let defaultUnitPrice = 0;
    let supplierId: number | undefined = undefined;
    let supplierName: string | undefined = undefined;

    if (source === 'warehouse' && parts.length > 0) {
      const available = parts.find(p => !editPartRows.some(r => r.source === 'warehouse' && r.partName === p.partName)) || parts[0];
      defaultPartName = available?.partName || '';
      defaultUnitPrice = available?.unitPrice || 0;
    } else if (source !== 'warehouse' && source !== 'shop') {
      const sup = suppliers.find(s => s.id.toString() === source);
      if (sup) {
        supplierId = sup.id;
        supplierName = sup.name;
      }
    }

    const newRow: InvoicePartRowItem = {
      id: Math.random().toString(36).substring(2, 9),
      source,
      supplierId,
      supplierName,
      partName: defaultPartName,
      quantity: 1,
      unitPrice: defaultUnitPrice,
      cost: defaultUnitPrice
    };

    const updated = [...editPartRows, newRow];
    setEditPartRows(updated);
    calculateEditTotalCost(updated, editWages);
  };

  const handleEditUpdatePartRow = (id: string, updates: Partial<InvoicePartRowItem>) => {
    const updated = editPartRows.map(row => {
      if (row.id !== id) return row;
      const merged = { ...row, ...updates };

      if (updates.source && updates.source !== row.source) {
        if (updates.source === 'warehouse') {
          const p = parts.find(item => item.partName === merged.partName) || parts[0];
          merged.partName = p?.partName || '';
          merged.unitPrice = p?.unitPrice || 0;
          merged.supplierId = undefined;
          merged.supplierName = undefined;
        } else if (updates.source === 'shop') {
          merged.supplierId = undefined;
          merged.supplierName = undefined;
        } else {
          const sup = suppliers.find(s => s.id.toString() === updates.source);
          merged.supplierId = sup?.id;
          merged.supplierName = sup?.name;
        }
      }

      if (updates.partName !== undefined && merged.source === 'warehouse') {
        const p = parts.find(item => item.partName === updates.partName);
        if (p) {
          merged.unitPrice = p.unitPrice || 0;
        }
      }

      const q = Number(merged.quantity) || 0;
      const up = Number(merged.unitPrice) || 0;
      merged.cost = q * up;

      return merged;
    });

    setEditPartRows(updated);
    calculateEditTotalCost(updated, editWages);
  };

  const handleEditRemovePartRow = (id: string) => {
    const updated = editPartRows.filter(r => r.id !== id);
    setEditPartRows(updated);
    calculateEditTotalCost(updated, editWages);
  };

  // استخراج لیست اشیاء تمام تعمیرکاران منتسب به یک پرونده خرابی (از روی ردیف‌های نقص فنی و رکورد اصلی)
  const getFailureMechanicsList = (f: VehicleFailure, wf?: RepairWorkflow): Mechanic[] => {
    const result: Mechanic[] = [];
    const addedIds = new Set<number>();

    // ۱. بررسی ردیف‌های خرابی (failureItems)
    if (f.failureItems && Array.isArray(f.failureItems)) {
      for (const item of f.failureItems) {
        if (item.mechanicId !== undefined && item.mechanicId !== null) {
          const mId = Number(item.mechanicId);
          if (!isNaN(mId) && !addedIds.has(mId)) {
            addedIds.add(mId);
            const found = mechanics.find(m => m.id === mId);
            if (found) {
              result.push(found);
            }
          }
        }
      }
    }

    // ۲. بررسی شناسه تعمیرکار در رکورد پرونده یا گردش کار
    const primaryId = wf?.technicianId !== undefined && wf?.technicianId !== null
      ? Number(wf.technicianId)
      : (f.assignedMechanicId !== undefined && f.assignedMechanicId !== null ? Number(f.assignedMechanicId) : undefined);

    if (primaryId !== undefined && !isNaN(primaryId) && !addedIds.has(primaryId)) {
      addedIds.add(primaryId);
      const found = mechanics.find(m => m.id === primaryId);
      if (found) {
        result.push(found);
      }
    }

    return result;
  };

  // ساخت متن نمایشی تعمیرکاران / تعمیرگاه جهت نمایش در جدول، جستجو، فیلتر ستونی و خروجی اکسل
  const getFailureMechanicsDisplay = (f: VehicleFailure, wf?: RepairWorkflow): string => {
    const mechs = getFailureMechanicsList(f, wf);
    if (mechs.length > 0) {
      return mechs
        .map(m => `${m.name}${m.shopName ? ` (${m.shopName})` : ''}`)
        .join('، ');
    }
    return wf?.repairShopName || f.repairShopName || 'تعمیرگاه مرکزی';
  };

  // پرینت رسمی فاکتور تعمیرات و ترخیص خودرو
  const printRepairInvoiceContent = (
    currentVeh: Vehicle | undefined,
    failure: VehicleFailure,
    wf: RepairWorkflow | undefined,
    mech: Mechanic | undefined
  ) => {
    const printDate = wf?.endDate || failure.failureDate || getCurrentJalaliDate();
    const printDocNum = failure.id.toString();
    const printKm = failure.odometer || currentVeh?.currentKm || 0;
    const printCost = wf?.totalCost || failure.totalCost || 0;
    const printWages = wf?.wages || failure.wages || 0;
    const printShopName = getFailureMechanicsDisplay(failure, wf);
    const printDescription = failure.description || '---';

    // گردآوری اقلام مصرفی و خدمات
    const items: Array<{
      title: string;
      source: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }> = [];

    // قطعات انبار شرکت
    const partsUsed = wf?.partsUsed || failure.partsUsed;
    if (partsUsed && Object.keys(partsUsed).length > 0) {
      Object.entries(partsUsed).forEach(([name, qty]) => {
        const partObj = parts.find(p => p.partName === name);
        const count = Number(qty) || 0;
        const unitPrice = partObj?.unitPrice || 0;
        const rowCost = unitPrice * count;
        items.push({
          title: name,
          source: 'انبار مرکزی شرکت',
          quantity: count,
          unitPrice,
          totalPrice: rowCost,
        });
      });
    }

    // قطعات تأمین‌شده توسط تعمیرگاه (خرید آزاد)
    const shopPartsUsed = wf?.shopPartsUsed || failure.shopPartsUsed;
    if (shopPartsUsed && shopPartsUsed.length > 0) {
      shopPartsUsed.forEach(sp => {
        const count = Number(sp.quantity) || 1;
        const unitPrice = sp.unitPrice || 0;
        const rowCost = sp.totalPrice || (count * unitPrice);
        items.push({
          title: sp.name,
          source: 'خرید آزاد تعمیرگاه',
          quantity: count,
          unitPrice,
          totalPrice: rowCost,
        });
      });
    }

    // ردیف اجرت و دستمزد در صورت وجود
    if (printWages > 0) {
      items.push({
        title: `اجرت و دستمزد تخصصی تعمیرات (${printShopName})`,
        source: 'خدمات فنی و دستمزد',
        quantity: 1,
        unitPrice: printWages,
        totalPrice: printWages,
      });
    }

    const priorityLabel = failure.priority === 'high' ? 'فوری / بالا' : failure.priority === 'medium' ? 'عادی / متوسط' : 'پایین';

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
        <head>
          <meta charset="utf-8">
          <title>فاکتور رسمی تعمیرات و خدمات خودرو #${printDocNum}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            * { box-sizing: border-box; font-family: Tahoma, 'Vazirmatn', sans-serif; }
            body { background: #fff; color: #111; margin: 0; padding: 20px; font-size: 12.5px; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 14px; }
            .title { font-size: 17px; font-weight: 900; margin: 0 0 4px 0; }
            .subtitle { font-size: 11px; color: #444; margin: 0; }
            .meta-box { border: 1px solid #333; border-radius: 8px; padding: 8px 12px; font-size: 11px; min-width: 180px; line-height: 1.8; }
            .card-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; border: 1px solid #333; border-radius: 8px; padding: 10px; margin-bottom: 14px; background: #fafafa; }
            .card-label { font-size: 10px; color: #666; display: block; }
            .card-value { font-weight: bold; font-size: 12.5px; margin-top: 2px; }
            .section-title { font-size: 12.5px; font-weight: 900; border-right: 4px solid #000; padding-right: 8px; margin: 14px 0 8px 0; }
            .info-box { border: 1px solid #333; border-radius: 8px; padding: 10px; margin-bottom: 14px; background: #fafafa; font-size: 11.5px; line-height: 1.6; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 14px; border: 1px solid #333; border-radius: 8px; overflow: hidden; }
            th, td { border: 1px solid #ddd; padding: 7px 9px; text-align: right; font-size: 11.5px; }
            th { background: #f0f0f0; font-weight: bold; }
            .text-left { text-align: left; }
            .text-center { text-align: center; }
            .total-box { display: flex; justify-content: space-between; align-items: center; border: 1px solid #000; border-radius: 8px; padding: 10px 14px; font-weight: bold; font-size: 13.5px; margin-bottom: 14px; background: #fdfdfd; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-top: 26px; }
            .sign-card { border: 1px solid #444; border-radius: 8px; padding: 10px; text-align: center; height: 95px; display: flex; flex-direction: column; justify-content: space-between; font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">فاکتور رسمی و صورت‌وضعیت تعمیرات خودرو</h1>
              <p class="subtitle">مدیریت ناوگان خودرویی یاس - برگه رسمی تعمیرات و رفع خرابی</p>
            </div>
            <div class="meta-box">
              <div><strong>تاریخ صدور / ترخیص:</strong> ${toPersianDigits(printDate)}</div>
              <div><strong>شماره پرونده / سند:</strong> #${toPersianDigits(printDocNum)}</div>
              <div><strong>اولویت:</strong> ${priorityLabel}</div>
              <div><strong>وضعیت:</strong> تسویه و ترخیص قطعی</div>
            </div>
          </div>

          <div class="card-grid">
            <div>
              <span class="card-label">نام خودرو</span>
              <div class="card-value">${currentVeh?.name || '---'}</div>
            </div>
            <div>
              <span class="card-label">شماره پلاک انتظامی</span>
              <div class="card-value">${toPersianDigits(currentVeh?.plaque || failure.plaque || '---')}</div>
            </div>
            <div>
              <span class="card-label">کد خودرو</span>
              <div class="card-value">${toPersianDigits(currentVeh?.code || '---')}</div>
            </div>
            <div>
              <span class="card-label">کارکرد ثبت‌شده</span>
              <div class="card-value">${formatNumber(printKm)} کیلومتر</div>
            </div>
            <div>
              <span class="card-label">نام راننده / تحویل‌گیرنده</span>
              <div class="card-value">${failure.driverName || currentVeh?.driverName || '---'}</div>
            </div>
            <div>
              <span class="card-label">شرکت / واحد سازمانی</span>
              <div class="card-value">${failure.company || currentVeh?.company || '---'}</div>
            </div>
            <div>
              <span class="card-label">تعمیرگاه / کارشناس فنی</span>
              <div class="card-value">${printShopName}</div>
            </div>
            <div>
              <span class="card-label">تاریخ پذیرش</span>
              <div class="card-value">${toPersianDigits(toJalaliDate(failure.failureDate))}</div>
            </div>
          </div>

          <div class="section-title">شرح نقص فنی و اقدامات تعمیراتی صورت‌گرفته</div>
          <div class="info-box">
            ${printDescription}
          </div>

          <div class="section-title">ریز قطعات مصرفی، خدمات و دستمزد تخصصی</div>
          ${items.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th style="width: 35px;" class="text-center">#</th>
                  <th>شرح قطعه یا خدمت</th>
                  <th style="width: 140px;">منبع تأمین</th>
                  <th style="width: 60px;" class="text-center">تعداد</th>
                  <th style="width: 120px;" class="text-left">بهای واحد (ریال)</th>
                  <th style="width: 130px;" class="text-left">جمع کل (ریال)</th>
                </tr>
              </thead>
              <tbody>
                ${items.map((it, idx) => `
                  <tr>
                    <td class="text-center">${toPersianDigits(idx + 1)}</td>
                    <td><strong>${it.title}</strong></td>
                    <td>${it.source}</td>
                    <td class="text-center" style="font-family: monospace; font-weight: bold;">${toPersianDigits(it.quantity)}</td>
                    <td class="text-left" style="font-family: monospace;">${it.unitPrice > 0 ? formatNumber(it.unitPrice) : '---'}</td>
                    <td class="text-left" style="font-family: monospace; font-weight: bold;">${it.totalPrice > 0 ? formatNumber(it.totalPrice) : '---'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            <div class="info-box" style="text-align: center; color: #666;">
              خدمات تعمیراتی بدون کسر مستقیم قطعه از انبار شرکت انجام شده است.
            </div>
          `}

          <div class="total-box">
            <div>
              <span>جمع کل هزینه فاکتور تعمیرات:</span>
              ${printWages > 0 ? `<span style="font-size: 11px; color: #555; margin-right: 8px;">(شامل ${formatNumber(printWages)} ریال اجرت و دستمزد)</span>` : ''}
            </div>
            <span style="font-family: monospace; font-size: 16px; font-weight: 900;">${formatPrice(printCost)} ریال</span>
          </div>

          <div class="signatures">
            <div class="sign-card">
              <span style="font-weight: bold;">مهر و امضاء تعمیرگاه / کارشناس فنی</span>
              <span style="border-bottom: 1px dashed #666; width: 80%; margin: 0 auto;"></span>
            </div>
            <div class="sign-card">
              <span style="font-weight: bold;">امضاء راننده / تحویل‌گیرنده خودرو</span>
              <span style="border-bottom: 1px dashed #666; width: 80%; margin: 0 auto;"></span>
            </div>
            <div class="sign-card">
              <span style="font-weight: bold;">تأیید و امضاء مدیر ترابری / ناوگان</span>
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
      }, 350);
    } else {
      window.print();
    }
  };

  const handlePrintRepairInvoice = (failure: VehicleFailure) => {
    const currentVeh = vehicles.find(v => v.id === failure.vehicleId);
    const wf = workflows.find(w => w.failureId === failure.id);
    const mech = mechanics.find(m => m.id === wf?.technicianId);
    printRepairInvoiceContent(currentVeh, failure, wf, mech);
  };

  const handleOpenEditModal = (f: VehicleFailure) => {
    const wf = workflows.find(w => w.failureId === f.id);
    const mechId = wf?.technicianId !== undefined && wf?.technicianId !== null
      ? wf.technicianId
      : (f.assignedMechanicId !== undefined && f.assignedMechanicId !== null ? f.assignedMechanicId : undefined);
    const mech = mechanics.find(m => m.id === mechId);
    setEditingFailure(f);
    setEditVehicleId(f.vehicleId.toString());
    setEditMechanicId(mechId !== undefined ? mechId.toString() : '');
    setEditRepairShopName(wf?.repairShopName || f.repairShopName || (mech ? (mech.shopName || mech.name) : ''));
    setEditFailureDate(toJalaliStandardString(f.failureDate));
    setEditEndDate(wf?.endDate ? toJalaliStandardString(wf.endDate) : (f.endDate ? toJalaliStandardString(f.endDate) : ''));
    setEditDescription(f.description || '');
    
    // شناسایی نوع خرابی از بین تعاریف
    const matchingDef = failureDefinitions.find(d => 
      d.failureType === f.description || 
      d.failureType === f.failureType || 
      (f.description && f.description.includes(d.failureType))
    );
    setEditDefinitionId(matchingDef ? matchingDef.id.toString() : '');
    setEditCategory(f.failureType || matchingDef?.category || 'mechanical');
    setEditFailureType(f.failureType || 'mechanical');
    setEditPriority(f.priority || 'medium');
    setEditOdometer(f.odometer || 0);

    const existingWages = wf?.wages || f.wages || 0;
    if (f.failureItems && Array.isArray(f.failureItems) && f.failureItems.length > 0) {
      const rows = f.failureItems.map(item => ({
        id: item.id || Math.random().toString(36).substring(2, 9),
        definitionId: item.definitionId || '',
        failureType: item.failureType || '',
        category: item.category || 'mechanical',
        mechanicId: item.mechanicId !== undefined && item.mechanicId !== null ? String(item.mechanicId) : (mechId !== undefined ? mechId.toString() : ''),
        satisfactionLevel: (item.satisfactionLevel as string) || (f.satisfactionLevel as string) || '',
        wage: item.wage !== undefined ? item.wage : 0,
        description: item.description || ''
      }));
      const sumW = rows.reduce((acc, r) => acc + (Number(r.wage) || 0), 0);
      if (sumW === 0 && existingWages > 0 && rows.length > 0) {
        rows[0].wage = existingWages;
      }
      setEditFailureRows(rows);
    } else {
      setEditFailureRows([
        {
          id: Math.random().toString(36).substring(2, 9),
          definitionId: matchingDef ? matchingDef.id.toString() : '',
          failureType: f.failureType || matchingDef?.failureType || '',
          category: f.failureType || matchingDef?.category || 'mechanical',
          mechanicId: (mechId !== undefined ? mechId.toString() : ''),
          satisfactionLevel: (f.satisfactionLevel as string) || '',
          wage: existingWages,
          description: f.description || ''
        }
      ]);
    }

    // بارگذاری قطعات
    const initialRows: InvoicePartRowItem[] = [];
    if (wf?.partsUsed && Object.keys(wf.partsUsed).length > 0) {
      Object.entries(wf.partsUsed).forEach(([name, qty]) => {
        const partObj = parts.find(p => p.partName === name);
        const q = Number(qty) || 1;
        const uPrice = partObj?.unitPrice || 0;
        initialRows.push({
          id: Math.random().toString(36).substring(2, 9),
          source: 'warehouse',
          partName: name,
          quantity: q,
          unitPrice: uPrice,
          cost: q * uPrice
        });
      });
    }

    if (wf?.shopPartsUsed && Array.isArray(wf.shopPartsUsed) && wf.shopPartsUsed.length > 0) {
      wf.shopPartsUsed.forEach(sp => {
        const q = Number(sp.quantity) || 1;
        const uPrice = Number(sp.unitPrice) || 0;
        initialRows.push({
          id: Math.random().toString(36).substring(2, 9),
          source: 'shop',
          partName: sp.name,
          quantity: q,
          unitPrice: uPrice,
          cost: sp.totalPrice || (q * uPrice)
        });
      });
    }

    setEditPartRows(initialRows);

    const initialWages = wf?.wages !== undefined ? Number(wf.wages) : (f.wages !== undefined ? Number(f.wages) : 0);
    setEditWages(initialWages);

    const partsTotal = initialRows.reduce((acc, r) => acc + (Number(r.cost) || 0), 0);
    const initialTotal = (wf?.totalCost && Number(wf.totalCost) > 0)
      ? Number(wf.totalCost)
      : ((f.totalCost && Number(f.totalCost) > 0) ? Number(f.totalCost) : (partsTotal + initialWages));
    setEditTotalCost(initialTotal);

    setEditSatisfaction(wf?.satisfactionLevel || f.satisfactionLevel || undefined);

    if (wf?.replacedServiceTypes && wf.replacedServiceTypes.length > 0) {
      setEditSelectedReplacedServiceTypes(wf.replacedServiceTypes);
    } else {
      const detected = detectReplacedServicesInRepair(f, wf, parts, serviceDefinitions);
      setEditSelectedReplacedServiceTypes(detected.map(d => d.serviceType));
    }
  };

  const handleSaveEditFailure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFailure || !onUpdateFailure) return;
    if (!editVehicleId) {
      alert('لطفاً خودرو را مشخص نمایید.');
      return;
    }

    setIsEditSubmitting(true);
    try {
      const wf = workflows.find(w => w.failureId === editingFailure.id);

      const activeRows = editFailureRows.filter(r => 
        r.failureType.trim() || r.category.trim() || r.description.trim() || r.mechanicId
      );
      const rowsToSave = activeRows.length > 0 ? activeRows : editFailureRows;
      const primaryRow = rowsToSave[0];

      const mechsInRows: Mechanic[] = [];
      const addedMIds = new Set<number>();
      for (const r of rowsToSave) {
        if (r.mechanicId) {
          const mId = Number(r.mechanicId);
          if (!isNaN(mId) && !addedMIds.has(mId)) {
            addedMIds.add(mId);
            const found = mechanics.find(m => m.id === mId);
            if (found) mechsInRows.push(found);
          }
        }
      }
      if (editMechanicId) {
        const mId = Number(editMechanicId);
        if (!isNaN(mId) && !addedMIds.has(mId)) {
          addedMIds.add(mId);
          const found = mechanics.find(m => m.id === mId);
          if (found) mechsInRows.push(found);
        }
      }
      const mechanicIdNum = mechsInRows[0]?.id || (editMechanicId ? Number(editMechanicId) : undefined);
      const finalShopName = editRepairShopName || (mechsInRows.length > 0
        ? mechsInRows.map(m => m.shopName || m.name).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join('، ')
        : '');

      const finalDesc = rowsToSave.length === 1
        ? (rowsToSave[0].description.trim() || rowsToSave[0].failureType || 'گزارش عیب فنی')
        : rowsToSave.map((r, i) => `${toPersianDigits(i + 1)}. ${r.failureType || 'عیب فنی'}${r.description ? ` (${r.description})` : ''}`).join(' | ');
      const finalCat = (primaryRow?.category as FailureType) || (primaryRow?.failureType as FailureType) || editFailureType || 'mechanical';

      await onUpdateFailure(editingFailure.id, {
        vehicleId: Number(editVehicleId),
        description: finalDesc,
        failureType: finalCat,
        priority: editPriority,
        odometer: Number(editOdometer),
        failureDate: editFailureDate,
        endDate: editEndDate || editingFailure.endDate || undefined,
        assignedMechanicId: mechanicIdNum,
        repairShopName: finalShopName,
        startDate: editFailureDate,
        failureItems: rowsToSave.map(r => ({
          id: r.id,
          definitionId: r.definitionId,
          failureType: r.failureType,
          category: r.category,
          mechanicId: r.mechanicId ? Number(r.mechanicId) : undefined,
          wage: Number(r.wage) || 0,
          satisfactionLevel: (r.satisfactionLevel as SatisfactionLevel) || undefined,
          description: r.description
        }))
      } as any);

      if (wf) {
        await onUpdateWorkflow(wf.id, {
          technicianId: mechanicIdNum,
          repairShopName: finalShopName,
          startDate: editFailureDate,
          endDate: editEndDate || wf.endDate || undefined
        });
      }

      setEditingFailure(null);
    } catch (err) {
      console.error(err);
      alert('خطا در ذخیره ویرایش پرونده خرابی.');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // باز کردن مدال ثبت خرابی جدید
  const handleOpenReportModal = () => {
    const firstVeh = vehicles[0];
    setVehicleId(firstVeh ? firstVeh.id.toString() : '');
    setReportDriverName(firstVeh?.driverName || '');
    setOdometer(firstVeh?.currentKm || 0);
    setDescription('');
    setFailureType('mechanical');
    setPriority('medium');
    setAssignedMechanicId(mechanics[0]?.id.toString() || '');
    setCustomShopName(mechanics[0]?.shopName || '');
    setRepairStartDate(getCurrentJalaliDate());
    setFailureRows([
      createInitialFailureRow(),
      createInitialFailureRow(),
      createInitialFailureRow()
    ]);
    setIsReportModalOpen(true);
  };

  // ثبت خرابی و انتقال مستقیم به بخش «در حال تعمیر»
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId || !odometer) {
      alert('لطفاً مشخصات خودرو و کارکرد فعلی (کیلومتر) را تکمیل نمایید.');
      return;
    }

    const activeRows = failureRows.filter(r => 
      r.failureType.trim() || r.category.trim() || r.description.trim() || r.mechanicId
    );

    if (activeRows.length === 0) {
      alert('لطفاً حداقل یک ردیف خرابی با مشخص کردن نوع عیب یا شرح خرابی وارد نمایید.');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedVeh = vehicles.find(v => v.id.toString() === vehicleId);

      const mechsInActiveRows: Mechanic[] = [];
      const addedMechIds = new Set<number>();
      for (const r of activeRows) {
        if (r.mechanicId) {
          const mId = Number(r.mechanicId);
          if (!isNaN(mId) && !addedMechIds.has(mId)) {
            addedMechIds.add(mId);
            const found = mechanics.find(m => m.id === mId);
            if (found) mechsInActiveRows.push(found);
          }
        }
      }
      if (assignedMechanicId) {
        const mId = Number(assignedMechanicId);
        if (!isNaN(mId) && !addedMechIds.has(mId)) {
          addedMechIds.add(mId);
          const found = mechanics.find(m => m.id === mId);
          if (found) mechsInActiveRows.push(found);
        }
      }
      const primaryMechId = mechsInActiveRows[0]?.id || (assignedMechanicId ? Number(assignedMechanicId) : undefined);
      const shopName = customShopName || (mechsInActiveRows.length > 0 
        ? mechsInActiveRows.map(m => m.shopName || m.name).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join('، ')
        : 'تعمیرگاه');

      const fDesc = activeRows.length === 1
        ? (activeRows[0].description.trim() || activeRows[0].failureType || 'گزارش عیب فنی')
        : activeRows.map((r, i) => `${toPersianDigits(i + 1)}. ${r.failureType || 'عیب فنی'}${r.description ? ` (${r.description})` : ''}`).join(' | ');

      const primaryCat = (activeRows[0]?.category as FailureType) || (activeRows[0]?.failureType as FailureType) || 'mechanical';

      await onAddFailure({
        vehicleId: Number(vehicleId),
        driverName: reportDriverName || selectedVeh?.driverName || 'ثبت نشده',
        company: selectedVeh?.company || 'ثبت نشده',
        plaque: selectedVeh?.plaque || 'ثبت نشده',
        failureDate: new Date().toISOString().split('T')[0],
        failureTime: new Date().toLocaleTimeString('fa-IR', { hour12: false }).substring(0, 5),
        odometer: Number(odometer),
        description: fDesc,
        failureType: primaryCat,
        priority,
        status: 'in_repair', // مستقیماً در حال تعمیر
        assignedMechanicId: primaryMechId,
        repairShopName: shopName,
        startDate: repairStartDate,
        failureItems: activeRows.map(r => ({
          id: r.id,
          definitionId: r.definitionId,
          failureType: r.failureType,
          category: r.category,
          mechanicId: r.mechanicId ? Number(r.mechanicId) : undefined,
          description: r.description
        }))
      });

      setIsReportModalOpen(false);
      setActiveTab('in_repair'); // هدایت کاربر به بخش در حال تعمیر
    } catch (err) {
      console.error(err);
      alert('خطا در ثبت خرابی و ارجاع خودرو.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // محاسبه هزینه کل فاکتور (مجموع اقلام + اجرت)
  const calculateTotalInvoiceCost = (rows: InvoicePartRowItem[], currentWages: number) => {
    const partsSum = rows.reduce((acc, row) => acc + (Number(row.cost) || 0), 0);
    setInvoiceTotalCost(partsSum + (Number(currentWages) || 0));
  };

  // باز کردن مدال ثبت فاکتور و قطعات برای ترخیص به بخش «آماده شده»
  const handleOpenReturnInvoiceModal = (fail: VehicleFailure) => {
    const wf = workflows.find(w => w.failureId === fail.id);
    const mechId = wf?.technicianId !== undefined && wf?.technicianId !== null
      ? wf.technicianId
      : (fail.assignedMechanicId !== undefined && fail.assignedMechanicId !== null ? fail.assignedMechanicId : undefined);
    const mech = mechanics.find(m => m.id === mechId);

    setReturnInvoiceFailure(fail);
    setInvoiceEndDate(getCurrentJalaliDate());
    setInvoiceMechanicId(mechId !== undefined ? mechId.toString() : '');
    setInvoiceRepairShopName(wf?.repairShopName || fail.repairShopName || (mech ? (mech.shopName || mech.name) : ''));
    
    const initialRows: InvoicePartRowItem[] = [];

    // 1. بارگذاری قطعات ثبت شده قبلی از انبار شرکت
    if (wf?.partsUsed && Object.keys(wf.partsUsed).length > 0) {
      Object.entries(wf.partsUsed).forEach(([name, qty]) => {
        const partObj = parts.find(p => p.partName === name);
        const q = Number(qty) || 1;
        const uPrice = partObj?.unitPrice || 0;
        initialRows.push({
          id: Math.random().toString(36).substring(2, 9),
          source: 'warehouse',
          partName: name,
          quantity: q,
          unitPrice: uPrice,
          cost: q * uPrice
        });
      });
    }

    // 2. بارگذاری قطعات تأمین‌شده توسط تعمیرگاه
    if (wf?.shopPartsUsed && Array.isArray(wf.shopPartsUsed) && wf.shopPartsUsed.length > 0) {
      wf.shopPartsUsed.forEach(sp => {
        const q = Number(sp.quantity) || 1;
        const uPrice = Number(sp.unitPrice) || 0;
        initialRows.push({
          id: Math.random().toString(36).substring(2, 9),
          source: 'shop',
          partName: sp.name,
          quantity: q,
          unitPrice: uPrice,
          cost: sp.totalPrice || (q * uPrice)
        });
      });
    }

    setInvoicePartRows(initialRows);
    const existingWages = wf?.wages || fail.wages || 0;
    setInvoiceWages(existingWages);
    setShopInvoiceNotes(wf?.notes || '');
    setInvoiceSatisfaction(wf?.satisfactionLevel || fail.satisfactionLevel || undefined);

    // بارگذاری ردیف‌های خرابی
    if (fail.failureItems && Array.isArray(fail.failureItems) && fail.failureItems.length > 0) {
      const rows = fail.failureItems.map(item => {
        const itemMechId = item.mechanicId !== undefined && item.mechanicId !== null
          ? String(item.mechanicId)
          : (mechId !== undefined ? String(mechId) : '');
        return {
          id: item.id || Math.random().toString(36).substring(2, 9),
          definitionId: item.definitionId || '',
          failureType: item.failureType || '',
          category: item.category || 'mechanical',
          mechanicId: itemMechId,
          satisfactionLevel: (item.satisfactionLevel as string) || (fail.satisfactionLevel as string) || '',
          wage: item.wage !== undefined ? item.wage : 0,
          description: item.description || ''
        };
      });

      const sumW = rows.reduce((acc, r) => acc + (Number(r.wage) || 0), 0);
      if (sumW === 0 && existingWages > 0 && rows.length > 0) {
        rows[0].wage = existingWages;
      }
      setInvoiceFailureRows(rows);
    } else {
      const matchingDef = failureDefinitions.find(d => 
        d.failureType === fail.failureType || 
        (fail.description && fail.description.includes(d.failureType))
      );
      setInvoiceFailureRows([
        {
          id: Math.random().toString(36).substring(2, 9),
          definitionId: matchingDef ? matchingDef.id.toString() : '',
          failureType: fail.failureType || matchingDef?.failureType || '',
          category: fail.failureType || matchingDef?.category || 'mechanical',
          mechanicId: (mechId !== undefined ? mechId.toString() : ''),
          satisfactionLevel: (fail.satisfactionLevel as string) || '',
          wage: existingWages,
          description: fail.description || ''
        }
      ]);
    }
    
    // تشخیص هوشمند خدمات و سرویس‌های دوره‌ای متناظر با این تعمیر
    if (wf?.replacedServiceTypes && wf.replacedServiceTypes.length > 0) {
      setSelectedReplacedServiceTypes(wf.replacedServiceTypes);
    } else {
      const detected = detectReplacedServicesInRepair(fail, wf, parts, serviceDefinitions);
      setSelectedReplacedServiceTypes(detected.map(d => d.serviceType));
    }

    if (wf?.totalCost && Number(wf.totalCost) > 0) {
      setInvoiceTotalCost(Number(wf.totalCost));
    } else {
      calculateTotalInvoiceCost(initialRows, existingWages);
    }
  };

  // افزودن ردیف جدید قطعه
  const handleAddPartRow = (source: string = 'warehouse') => {
    let defaultPartName = '';
    let defaultUnitPrice = 0;
    let supplierId: number | undefined = undefined;
    let supplierName: string | undefined = undefined;

    if (source === 'warehouse' && parts.length > 0) {
      // انتخاب اولین قطعه انبار که هنوز در لیست نیست، یا اولین قطعه
      const available = parts.find(p => !invoicePartRows.some(r => r.source === 'warehouse' && r.partName === p.partName)) || parts[0];
      defaultPartName = available?.partName || '';
      defaultUnitPrice = available?.sellPrice || available?.unitPrice || 0;
    } else if (source !== 'warehouse' && source !== 'shop') {
      const sup = suppliers.find(s => s.id.toString() === source);
      if (sup) {
        supplierId = sup.id;
        supplierName = sup.name;
      }
    }

    const newRow: InvoicePartRowItem = {
      id: Math.random().toString(36).substring(2, 9),
      source,
      supplierId,
      supplierName,
      partName: defaultPartName,
      quantity: 1,
      unitPrice: defaultUnitPrice,
      cost: defaultUnitPrice
    };

    const updated = [...invoicePartRows, newRow];
    setInvoicePartRows(updated);
    calculateTotalInvoiceCost(updated, invoiceWages);
  };

  // بروزرسانی یک فیلد از ردیف قطعه
  const handleUpdatePartRow = (id: string, updates: Partial<InvoicePartRowItem>) => {
    const updated = invoicePartRows.map(row => {
      if (row.id !== id) return row;
      const merged = { ...row, ...updates };

      // در صورت تغییر منبع تأمین
      if (updates.source && updates.source !== row.source) {
        if (updates.source === 'warehouse') {
          const p = parts.find(item => item.partName === merged.partName) || parts[0];
          merged.partName = p?.partName || '';
          merged.unitPrice = p?.sellPrice || p?.unitPrice || 0;
          merged.supplierId = undefined;
          merged.supplierName = undefined;
        } else if (updates.source === 'shop') {
          merged.supplierId = undefined;
          merged.supplierName = undefined;
        } else {
          const sup = suppliers.find(s => s.id.toString() === updates.source);
          merged.supplierId = sup?.id;
          merged.supplierName = sup?.name;
        }
      }

      // در صورت تغییر نام قطعه از انبار
      if (updates.partName !== undefined && merged.source === 'warehouse') {
        const p = parts.find(item => item.partName === updates.partName);
        if (p) {
          merged.unitPrice = p.sellPrice || p.unitPrice || 0;
        }
      }

      // محاسبه مجدد هزینه ردیف
      const q = Number(merged.quantity) || 0;
      const up = Number(merged.unitPrice) || 0;
      merged.cost = q * up;

      return merged;
    });

    setInvoicePartRows(updated);
    calculateTotalInvoiceCost(updated, invoiceWages);
  };

  // حذف یک ردیف از لیست قطعات
  const handleRemovePartRow = (id: string) => {
    const updated = invoicePartRows.filter(r => r.id !== id);
    setInvoicePartRows(updated);
    calculateTotalInvoiceCost(updated, invoiceWages);
  };

  // ثبت نهایی فاکتور و انتقال قطعی به بخش «آماده شده»
  const handleSubmitReturnInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnInvoiceFailure) return;

    if (Number(invoiceTotalCost) < 0) {
      alert('مبلغ فاکتور نمی‌تواند منفی باشد.');
      return;
    }

    // اعتبارسنجی موجودی قطعات انبار شرکت
    const warehouseRows = invoicePartRows.filter(r => r.source === 'warehouse' && r.partName);
    const warehousePartsMap: Record<string, number> = {};

    for (const row of warehouseRows) {
      const p = parts.find(item => item.partName === row.partName);
      const existing = warehousePartsMap[row.partName] || 0;
      const totalNeeded = existing + (Number(row.quantity) || 1);
      if (p && p.quantity < totalNeeded) {
        alert(`موجودی قطعه «${row.partName}» در انبار شرکت کافی نیست!\nموجودی فعلی: ${toPersianDigits(p.quantity)} عدد\nمقدار درخواستی: ${toPersianDigits(totalNeeded)} عدد.`);
        return;
      }
      warehousePartsMap[row.partName] = totalNeeded;
    }

    // قطعات خارج از انبار (تعمیرگاه یا تامین‌کنندگان کالا)
    const nonWarehouseRows = invoicePartRows.filter(r => r.source !== 'warehouse' && r.partName.trim());
    const shopPartsList = nonWarehouseRows.map(r => ({
      name: r.partName.trim(),
      quantity: Number(r.quantity) || 1,
      unitPrice: Number(r.unitPrice) || 0,
      totalPrice: Number(r.cost) || 0
    }));

    const wf = workflows.find(w => w.failureId === returnInvoiceFailure.id);
    if (!wf) {
      alert('گردش کار مرتبط با این خرابی یافت نشد.');
      return;
    }

    setIsSubmitting(true);
    try {
      const activeRows = invoiceFailureRows.filter(r => 
        r.failureType.trim() || r.category.trim() || r.description.trim() || r.mechanicId || (r.wage && r.wage > 0)
      );
      const rowsToSave = activeRows.length > 0 ? activeRows : invoiceFailureRows;
      const primaryRow = rowsToSave[0];

      const mechsInReturnRows: Mechanic[] = [];
      const addedReturnMIds = new Set<number>();
      for (const r of rowsToSave) {
        if (r.mechanicId) {
          const mId = Number(r.mechanicId);
          if (!isNaN(mId) && !addedReturnMIds.has(mId)) {
            addedReturnMIds.add(mId);
            const found = mechanics.find(m => m.id === mId);
            if (found) mechsInReturnRows.push(found);
          }
        }
      }
      if (invoiceMechanicId) {
        const mId = Number(invoiceMechanicId);
        if (!isNaN(mId) && !addedReturnMIds.has(mId)) {
          addedReturnMIds.add(mId);
          const found = mechanics.find(m => m.id === mId);
          if (found) mechsInReturnRows.push(found);
        }
      }
      const mechanicIdNum = mechsInReturnRows[0]?.id || (invoiceMechanicId ? Number(invoiceMechanicId) : undefined);
      const finalShopName = invoiceRepairShopName || (mechsInReturnRows.length > 0
        ? mechsInReturnRows.map(m => m.shopName || m.name).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join('، ')
        : '');

      const rowWithSat = rowsToSave.find(r => r.satisfactionLevel);
      const finalSatisfaction = (invoiceSatisfaction || rowWithSat?.satisfactionLevel) as SatisfactionLevel | undefined;

      const updatedFailureItems: FailureItem[] = rowsToSave.map(r => ({
        id: r.id,
        definitionId: r.definitionId,
        failureType: r.failureType,
        category: r.category,
        mechanicId: r.mechanicId ? Number(r.mechanicId) : undefined,
        wage: Number(r.wage) || 0,
        satisfactionLevel: (r.satisfactionLevel as SatisfactionLevel) || undefined,
        description: r.description
      }));

      await onUpdateWorkflow(wf.id, {
        technicianId: mechanicIdNum,
        repairShopName: finalShopName,
        partsUsed: warehousePartsMap, // قطعات انبار جهت کسر خودکار
        shopPartsUsed: shopPartsList, // قطعات تأمین‌شده توسط تعمیرگاه
        wages: Number(invoiceWages) || 0,
        totalCost: Number(invoiceTotalCost) || 0,
        endDate: invoiceEndDate,
        notes: shopInvoiceNotes,
        replacedServiceTypes: selectedReplacedServiceTypes,
        satisfactionLevel: finalSatisfaction,
        isDelivered: true,
        markReady: true
      });

      if (onUpdateFailure) {
        await onUpdateFailure(returnInvoiceFailure.id, {
          assignedMechanicId: mechanicIdNum,
          repairShopName: finalShopName,
          endDate: invoiceEndDate,
          partsUsed: warehousePartsMap,
          shopPartsUsed: shopPartsList,
          wages: Number(invoiceWages) || 0,
          totalCost: Number(invoiceTotalCost) || 0,
          satisfactionLevel: finalSatisfaction,
          failureItems: updatedFailureItems,
          status: 'completed'
        });
      }

      setReturnInvoiceFailure(null);
      setActiveTab('completed'); // هدایت کاربر به تب «آماده شده»
    } catch (err) {
      console.error(err);
      alert('خطا در ثبت فاکتور و ترخیص به بخش آماده شده.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // شمارنده‌های دو بخش
  const countInRepair = failures.filter(f => f.status === 'in_repair' || f.status === 'reported' || f.status === 'assigned').length;
  const countCompleted = failures.filter(f => f.status === 'completed' || f.status === 'approved').length;

  // فیلترهای سبک اکسل ستون‌ها
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [filterMenu, setFilterMenu] = useState<FilterMenuState | null>(null);

  const getFailureColValue = (f: VehicleFailure, colKey: string): string => {
    const v = vehicles.find(veh => String(veh.id) === String(f.vehicleId) || Number(veh.id) === Number(f.vehicleId));
    const wf = workflows.find(w => w.failureId === f.id);

    if (colKey === 'failureDate') {
      return activeTab === 'in_repair' 
        ? toJalaliDate(wf?.startDate || f.failureDate) 
        : toJalaliDate(wf?.endDate || f.failureDate);
    }
    if (colKey === 'vehicleName') {
      if (v) return `${v.name} - پلاک [${toPersianDigits(v.plaque)}]`;
      if (f.plaque) return `پلاک [${toPersianDigits(f.plaque)}]`;
      if (f.driverName) return `خودرو ${f.driverName}`;
      return '—';
    }
    if (colKey === 'shopName') return getFailureMechanicsDisplay(f, wf);
    if (colKey === 'priority') {
      return f.priority === 'high' ? 'بحرانی' : f.priority === 'medium' ? 'متوسط' : 'جزیی';
    }
    if (colKey === 'cost') {
      return wf && Number(wf.totalCost) > 0 ? formatPrice(wf.totalCost) : 'بدون هزینه';
    }
    return String((f as any)[colKey] ?? '-');
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
    failures.forEach(f => {
      // فقط رکوردهای تب فعال بررسی شوند
      const isTabMatched = activeTab === 'in_repair'
        ? (f.status === 'in_repair' || f.status === 'reported' || f.status === 'assigned')
        : (f.status === 'completed' || f.status === 'approved');
      if (!isTabMatched) return;

      const val = getFailureColValue(f, filterMenu.colKey);
      valMap.set(val, (valMap.get(val) || 0) + 1);
    });
    return Array.from(valMap.entries()).map(([value, count]) => ({ value, count }));
  }, [filterMenu, failures, activeTab, vehicles, workflows, mechanics]);

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

  // لیست خودروها منطبق با عبارت جستجوی نام خودرو، راننده و کد خودرو
  const matchedVehicles = useMemo(() => {
    const query = searchTerm.trim();
    return query
      ? vehicles.filter(v => matchesVehicleSearch(v, query))
      : vehicles;
  }, [vehicles, searchTerm]);

  // فیلتر کردن خرابی‌ها بر اساس دو بخش
  const filteredFailures: VehicleFailure[] = useMemo(() => {
    return failures.filter((f: VehicleFailure) => {
      const v = vehicles.find(veh => veh.id === f.vehicleId);
      const wf = workflows.find(w => w.failureId === f.id);
      const displayShop = getFailureMechanicsDisplay(f, wf);

      const searchLower = searchTerm.trim();
      const matchesSearch = 
        !searchLower ||
        (v && matchesVehicleSearch(v, searchLower)) ||
        (f.description && f.description.toLowerCase().includes(searchLower.toLowerCase())) ||
        (displayShop && displayShop.toLowerCase().includes(searchLower.toLowerCase()));

      const matchesPriority = priorityFilter === 'all' || f.priority === priorityFilter;
      const matchesVehicle = vehicleFilter === 'all' || !vehicleFilter || f.vehicleId.toString() === vehicleFilter;

      // فیلتر بازه تاریخ (از تاریخ / تا تاریخ)
      const startComp = normalizeToComparableJalali(startDate);
      const endComp = normalizeToComparableJalali(endDate);
      const itemRawDate = activeTab === 'in_repair' 
        ? (wf?.startDate || f.failureDate) 
        : (wf?.endDate || f.failureDate);
      const itemComp = normalizeToComparableJalali(itemRawDate);

      if (startComp && itemComp && itemComp < startComp) return false;
      if (endComp && itemComp && itemComp > endComp) return false;

      let matchesTab = false;
      if (activeTab === 'in_repair') {
        matchesTab = f.status === 'in_repair' || f.status === 'reported' || f.status === 'assigned';
      } else if (activeTab === 'completed') {
        matchesTab = f.status === 'completed' || f.status === 'approved';
      }

      if (!matchesSearch || !matchesPriority || !matchesVehicle || !matchesTab) return false;

      for (const [key, selectedVals] of Object.entries(columnFilters)) {
        if (!selectedVals || !Array.isArray(selectedVals)) continue;
        const val = getFailureColValue(f, key);
        if (!selectedVals.includes(val)) return false;
      }

      return true;
    });
  }, [failures, vehicles, workflows, searchTerm, priorityFilter, vehicleFilter, startDate, endDate, activeTab, columnFilters]);

  const sortedFailures = sortData<VehicleFailure>(filteredFailures, sortKey, sortDirection, {
    vehicleName: (f: VehicleFailure) => {
      const v = vehicles.find(veh => veh.id === f.vehicleId);
      return v ? v.name : '';
    },
    failureDate: (f: VehicleFailure) => {
      const wf = workflows.find(w => w.failureId === f.id);
      return activeTab === 'in_repair' 
        ? (wf?.startDate || f.failureDate || '') 
        : (wf?.endDate || f.failureDate || '');
    },
    priority: (f: VehicleFailure) => {
      const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
      return priorityWeight[f.priority] || 0;
    },
    shopName: (f: VehicleFailure) => {
      const wf = workflows.find(w => w.failureId === f.id);
      return getFailureMechanicsDisplay(f, wf);
    },
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, priorityFilter, vehicleFilter, startDate, endDate, activeTab]);

  const totalPages = Math.ceil(sortedFailures.length / pageSize) || 1;
  const paginatedFailures = sortedFailures.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getPriorityBadge = (p: FailurePriority) => {
    switch (p) {
      case 'high':
        return <span className="h-[22px] px-2 inline-flex items-center justify-center bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 rounded font-bold text-[10px] whitespace-nowrap">بحرانی</span>;
      case 'medium':
        return <span className="h-[22px] px-2 inline-flex items-center justify-center bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 rounded font-bold text-[10px] whitespace-nowrap">متوسط</span>;
      case 'low':
        return <span className="h-[22px] px-2 inline-flex items-center justify-center bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-[#2d2d30] rounded font-bold text-[10px] whitespace-nowrap">جزیی</span>;
    }
  };

  // خروجی فایل اکسل از اطلاعات بازه تاریخی یا کل اطلاعات
  const handleExportExcel = () => {
    try {
      const sanitize = (val: any) => {
        if (val === undefined || val === null) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const startComp = normalizeToComparableJalali(startDate);
      const endComp = normalizeToComparableJalali(endDate);

      const itemsToExport = failures.filter(f => {
        const wf = workflows.find(w => w.failureId === f.id);
        const itemRawDate = activeTab === 'in_repair'
          ? (wf?.startDate || f.failureDate)
          : (wf?.endDate || f.failureDate);
        const itemComp = normalizeToComparableJalali(itemRawDate);

        if (startComp && itemComp && itemComp < startComp) return false;
        if (endComp && itemComp && itemComp > endComp) return false;
        if (vehicleFilter && vehicleFilter !== 'all' && f.vehicleId.toString() !== vehicleFilter) return false;

        let matchesTab = false;
        if (activeTab === 'in_repair') {
          matchesTab = f.status === 'in_repair' || f.status === 'reported' || f.status === 'assigned';
        } else if (activeTab === 'completed') {
          matchesTab = f.status === 'completed' || f.status === 'approved';
        }
        return matchesTab;
      });

      const sectionTitle = activeTab === 'in_repair' ? 'خودروهای_در_حال_تعمیر' : 'خودروهای_آماده_شده';
      const fileName = (startDate || endDate)
        ? `گزارش_${sectionTitle}_از_${startDate || 'ابتدا'}_تا_${endDate || 'انتها'}`
        : `گزارش_جامع_${sectionTitle}`;

      const headers = [
        'ردیف',
        'تاریخ شروع تعمیر',
        'تاریخ اتمام / ترخیص',
        'کد خودرو',
        'نام خودرو',
        'پلاک خودرو',
        'راننده',
        'شرکت',
        'وضعیت',
        'سطح فوریت',
        'تعمیرگاه / مکانیک',
        'شماره فاکتور',
        'شرح خرابی / اقدامات',
        'هزینه فاکتور (ریال)'
      ];

      const rows = itemsToExport.map((f, idx) => {
        const v = vehicles.find(veh => String(veh.id) === String(f.vehicleId) || Number(veh.id) === Number(f.vehicleId));
        const wf = workflows.find(w => w.failureId === f.id);
        const shopName = getFailureMechanicsDisplay(f, wf);

        let statusLabel = 'در حال تعمیر';
        if (f.status === 'completed' || f.status === 'approved') statusLabel = 'آماده شده / تسویه';
        else if (f.status === 'assigned') statusLabel = 'ارجاع به تعمیرگاه';

        let priorityLabel = 'جزیی';
        if (f.priority === 'high') priorityLabel = 'بحرانی و توقف کامل';
        else if (f.priority === 'medium') priorityLabel = 'متوسط';

        const failureDriver = f.driverName || v?.driverName || '—';
        const failureCompany = f.company || v?.company || '—';
        const failurePlaque = f.plaque || v?.plaque || '—';

        return [
          idx + 1,
          toJalaliDate(wf?.startDate || f.failureDate),
          wf?.endDate ? toJalaliDate(wf.endDate) : '—',
          v?.code || '—',
          v ? `${v.name} - پلاک [${toPersianDigits(v.plaque)}]` : (failurePlaque !== '—' ? `پلاک [${toPersianDigits(failurePlaque)}]` : '—'),
          failurePlaque,
          failureDriver,
          failureCompany,
          statusLabel,
          priorityLabel,
          shopName,
          wf?.id ? `#${wf.id}` : '—',
          f.description || wf?.notes || '—',
          wf?.totalCost || 0
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

  // ۱. اگر کاربر صفحه ثبت خرابی جدید را باز کرده است (نمایش تمام‌صفحه فرم ثبت خرابی هماهنگ با استایل سرویس دوره‌ای)
  if (isReportModalOpen) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-[#111113] rounded-lg w-full border border-slate-200 dark:border-[#2d2d30] flex flex-col overflow-hidden space-y-0">
          
          {/* هدر صفحه اختصاصی ثبت خرابی */}
          <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Wrench className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>صفحه ثبت خرابی و ارجاع خودرو به تعمیرگاه</span>
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                ثبت مشخصات فنی عیب، کارکرد فعلی، تعیین تعمیرکار و انتقال مستقیم خودرو به وضعیت «در حال تعمیر»
              </p>
            </div>
            <button 
              onClick={() => setIsReportModalOpen(false)} 
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors border border-transparent hover:border-slate-300 dark:hover:border-[#2d2d30] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* بدنه فرم ثبت خرابی */}
          <form onSubmit={handleReportSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs bg-white dark:bg-[#111113]">
            
            {/* ۱. ردیف بالا: نام ماشین، تاریخ ارجاع، کارکرد فعلی و اولویت ارجاع */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
              {/* انتخاب خودرو */}
              <div className="md:col-span-4 space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  نام ماشین (جستجو و انتخاب) <span className="text-rose-500">*</span>
                </label>
                <CustomSelect
                  value={vehicleId}
                  onChange={(val) => {
                    setVehicleId(val);
                    const selectedV = vehicles.find(v => v.id === Number(val));
                    if (selectedV) {
                      setOdometer(selectedV.currentKm || 0);
                      setReportDriverName(selectedV.driverName || '');
                    }
                  }}
                  placeholder="جستجو و انتخاب خودرو از لیست..."
                  searchable={true}
                  matchTriggerWidth={true}
                  quickAddType="vehicle"
                  options={vehicles.map(v => ({ 
                    value: v.id, 
                    label: getVehicleDisplayName(v)
                  }))}
                />
              </div>

              {/* تاریخ ارجاع و پذیرش */}
              <div className="md:col-span-3 space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  تاریخ ارجاع و پذیرش <span className="text-rose-500">*</span>
                </label>
                <JalaliDatePicker
                  value={repairStartDate}
                  onChange={setRepairStartDate}
                  className="w-full"
                  inputClassName="h-[38px] text-xs font-bold rounded-md"
                />
              </div>

              {/* کارکرد فعلی (کیلومتر) */}
              <div className="md:col-span-2 space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  کارکرد فعلی (کیلومتر) <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  placeholder="مثال: ۴۵۲،۰۰۰"
                  value={odometer ? formatNumber(odometer) : ''} 
                  onChange={e => setOdometer(parsePersianNumber(e.target.value))} 
                  className="w-full h-[38px] px-3 rounded-md border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#161619] text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono font-bold text-xs shadow-2xs transition-colors"
                  required
                />
              </div>

              {/* سطح فوریت و اولویت ارجاع */}
              <div className="md:col-span-3 space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  سطح فوریت و اولویت ارجاع <span className="text-rose-500">*</span>
                </label>
                <CustomSelect
                  value={priority}
                  onChange={(val) => setPriority(val as FailurePriority)}
                  matchTriggerWidth={true}
                  options={[
                    { value: 'medium', label: 'اولویت متوسط (نیازمند رسیدگی سریع)' },
                    { value: 'high', label: 'بحرانی و اضطراری (توقف کامل خودرو)' },
                    { value: 'low', label: 'اشکال جزیی و غیراضطراری' }
                  ]}
                />
              </div>
            </div>

            {/* ۲. بخش جدول خرابی‌های گزارش شده (دقیقاً با استایل جدول سرویس دوره‌ای) */}
            <div className="space-y-2.5 bg-slate-50 dark:bg-[#161618] rounded-xl border border-slate-200 dark:border-[#2d2d30] p-3">
              
              {/* هدر بخش خرابی‌ها */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-[#2d2d30]">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded border border-indigo-200 dark:border-indigo-500/20">
                    <Wrench className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                      خرابی‌های گزارش‌شده <span className="text-rose-500">*</span>
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      ثبت انواع خرابی با دسته و تعمیرکار مربوطه
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddFailureRow}
                  className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold rounded border border-indigo-200 dark:border-indigo-800/60 transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن خرابی</span>
                </button>
              </div>

              {/* جدول اقلام خرابی */}
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#2d2d30] bg-white dark:bg-[#111113]">
                <table className="w-full text-right text-xs font-mono font-bold text-slate-700 dark:text-slate-300 border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-[#161618] border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-mono font-bold text-xs">
                      <th className="py-2 px-2 text-center w-8 text-xs font-mono font-bold">#</th>
                      <th className="py-2 px-2 min-w-[190px]">نوع خرابی <span className="text-rose-500">*</span></th>
                      <th className="py-2 px-2 min-w-[140px]">دسته خرابی</th>
                      <th className="py-2 px-2 min-w-[160px]">تعمیرکار</th>
                      <th className="py-2 px-2 min-w-[200px]">شرح خرابی</th>
                      <th className="py-2 px-2 text-center w-10">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                    {failureRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-slate-500 font-bold text-[11px]">
                          هیچ ردیف خرابی ثبت نشده است. روی دکمه «+ افزودن خرابی» کلیک کنید.
                        </td>
                      </tr>
                    ) : (
                      failureRows.map((row, index) => (
                        <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/40 transition-colors">
                          {/* شماره ردیف */}
                          <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-400 dark:text-slate-500 text-[10px]">
                            {toPersianDigits(index + 1)}
                          </td>

                          {/* نوع خرابی */}
                          <td className="py-1.5 px-2 font-sans font-bold">
                            <CustomSelect
                              value={row.definitionId}
                              onChange={(val) => handleUpdateFailureRow(row.id, { definitionId: String(val) })}
                              placeholder="انتخاب نوع خرابی..."
                              searchable={true}
                              size="xs"
                              matchTriggerWidth={true}
                              quickAddType="failure"
                              options={[
                                { value: '', label: '-- بدون انتخاب --' },
                                ...failureDefinitions.map(def => ({
                                  value: def.id.toString(),
                                  label: def.failureType
                                }))
                              ]}
                            />
                          </td>

                          {/* دسته خرابی */}
                          <td className="py-1.5 px-2 font-sans font-medium">
                            <CustomSelect
                              value={row.category}
                              onChange={(val) => handleUpdateFailureRow(row.id, { category: String(val) })}
                              placeholder="انتخاب دسته..."
                              searchable={true}
                              size="xs"
                              matchTriggerWidth={true}
                              onAddNew={() => {
                                setCategoryTargetRowId(row.id);
                                setCategoryTargetForm('create');
                                setIsAddCategoryModalOpen(true);
                              }}
                              addNewLabel="افزودن دسته‌بندی جدید..."
                              options={[
                                { value: '', label: 'انتخاب کنید...' },
                                ...activeFailureCategoryOptions.map(cat => ({
                                  value: cat.value,
                                  label: cat.label
                                }))
                              ]}
                            />
                          </td>

                          {/* تعمیرکار */}
                          <td className="py-1.5 px-2 font-sans font-medium">
                            <CustomSelect
                              value={row.mechanicId}
                              onChange={(val) => handleUpdateFailureRow(row.id, { mechanicId: String(val) })}
                              placeholder=""
                              showEmptyAsBlank={true}
                              searchable={true}
                              size="xs"
                              matchTriggerWidth={true}
                              quickAddType="mechanic"
                              options={[
                                { value: '', label: '-- بدون تعمیرکار --' },
                                ...mechanics.map(m => ({
                                  value: m.id.toString(),
                                  label: m.shopName ? `${m.name} (${m.shopName})` : m.name
                                }))
                              ]}
                            />
                          </td>

                          {/* شرح خرابی */}
                          <td className="py-1.5 px-2">
                            <input
                              type="text"
                              value={row.description}
                              onChange={e => handleUpdateFailureRow(row.id, { description: e.target.value })}
                              placeholder="علائم این خرابی..."
                              className="w-full h-6 px-2 rounded border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#161619] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans font-medium text-xs placeholder-slate-400 dark:placeholder-slate-600 shadow-2xs"
                            />
                          </td>

                          {/* دکمه حذف ردیف */}
                          <td className="py-1.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveFailureRow(row.id)}
                              disabled={failureRows.length <= 1}
                              className="w-6 h-6 inline-flex items-center justify-center bg-slate-100 dark:bg-[#1a1a1c] hover:bg-rose-50 dark:hover:bg-rose-600/20 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded border border-slate-200 dark:border-[#2d2d30] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer mx-auto"
                              title="حذف ردیف"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* دکمه‌های اقدام انتهای صفحه */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-[#2d2d30]">
              <button 
                type="button" 
                onClick={() => setIsReportModalOpen(false)} 
                className="px-3 py-1.5 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-400 font-bold rounded-md transition-colors border border-slate-200 dark:border-[#2d2d30] text-xs cursor-pointer"
              >
                انصراف
              </button>

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md transition-colors active:scale-95 text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>ثبت خرابی و ارجاع به تعمیرگاه</span>
              </button>
            </div>
          </form>
        </div>

        {/* مودال ثبت و تعریف دسته‌بندی نقص فنی جدید درون فرم ثبت */}
        {isAddCategoryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 overflow-y-auto" dir="rtl">
            <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-auto">
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white dark:bg-[#202024] rounded-lg border border-slate-200 dark:border-[#303035] shadow-xs">
                    <Tag className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-slate-900 dark:text-white text-sm font-bold">
                      ثبت دسته‌بندی نقص فنی جدید
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      افزودن به لیست گزینه‌های دسته‌بندی خرابی و ارجاع
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNewCategoryName('');
                    setCategoryErrorMsg('');
                    setIsAddCategoryModalOpen(false);
                    setCategoryTargetRowId(null);
                  }}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddFailureCategory} className="p-4 sm:p-5 space-y-4 text-xs bg-white dark:bg-[#111113]">
                {categoryErrorMsg && (
                  <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-700 dark:text-rose-300 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{categoryErrorMsg}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    عنوان دسته‌بندی <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: هیدرولیک و فرمان، سیستم خنک‌کاری، گیربکس اتوماتیک..."
                    value={newCategoryName}
                    onChange={(e) => {
                      setNewCategoryName(e.target.value);
                      if (categoryErrorMsg) setCategoryErrorMsg('');
                    }}
                    className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    autoFocus
                    required
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    این دسته‌بندی در لیست ذخیره شده و بلافاصله برای این ردیف انتخاب خواهد شد.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-[#2d2d30]">
                  <button
                    type="button"
                    onClick={() => {
                      setNewCategoryName('');
                      setCategoryErrorMsg('');
                      setIsAddCategoryModalOpen(false);
                      setCategoryTargetRowId(null);
                    }}
                    className="px-4 py-2 border border-slate-300 dark:border-[#2d2d30] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a1a1c] font-bold rounded-lg transition-colors text-xs cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors shadow-xs active:scale-95 text-xs cursor-pointer"
                  >
                    ثبت دسته‌بندی
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ۲. اگر کاربر صفحه ثبت فاکتور و ترخیص را باز کرده است (نمایش تمام‌صفحه دقیقاً مانند ثبت خرابی)
  if (returnInvoiceFailure) {
    const v = vehicles.find(veh => veh.id === returnInvoiceFailure.vehicleId);
    const warehouseTotal = invoicePartRows
      .filter(r => r.source === 'warehouse')
      .reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
    const shopPartsTotal = invoicePartRows
      .filter(r => r.source !== 'warehouse')
      .reduce((sum, r) => sum + (Number(r.cost) || 0), 0);

    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-[#111113] rounded-lg w-full border border-slate-200 dark:border-[#2d2d30] flex flex-col overflow-hidden space-y-0">
          
          {/* هدر صفحه اختصاصی ثبت فاکتور و ترخیص */}
          <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>ثبت فاکتور هزینه‌ها و قطعات (ترخیص خودرو)</span>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono">#{toPersianDigits(returnInvoiceFailure.id)}</span>
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                خودرو: <strong className="text-slate-900 dark:text-white">{v?.name} ({v?.code})</strong> | پلاک: <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{toPersianDigits(v?.plaque || '')}</strong> | راننده: <strong className="text-slate-800 dark:text-slate-200">{v?.driverName || '—'}</strong>
              </p>
            </div>
            <button 
              onClick={() => setReturnInvoiceFailure(null)} 
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors border border-transparent hover:border-slate-300 dark:border-[#2d2d30] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* فرم ثبت فاکتور تمام‌صفحه */}
          <form onSubmit={handleSubmitReturnInvoice} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs bg-white dark:bg-[#111113]">
            
            {/* ۱. ردیف اول: مشخصات خودرو، کارکرد، تاریخ پذیرش، تاریخ ترخیص (اجباری) و اولویت */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
              {/* نام خودرو */}
              <div className="md:col-span-3 space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  نام ماشین و پلاک
                </label>
                <div className="w-full h-[38px] px-3 rounded-md border border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] flex items-center justify-between font-bold text-xs text-slate-900 dark:text-white truncate">
                  <span className="truncate">{v?.name || returnInvoiceFailure.driverName || 'خودرو'}</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300 shrink-0 mr-2 text-[11px]">
                    {toPersianDigits(v?.plaque || returnInvoiceFailure.plaque || '')}
                  </span>
                </div>
              </div>

              {/* کارکرد کیلومتر */}
              <div className="md:col-span-2 space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  کارکرد (کیلومتر)
                </label>
                <div className="w-full h-[38px] px-3 rounded-md border border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] flex items-center font-mono font-bold text-xs text-slate-900 dark:text-white">
                  {formatNumber(returnInvoiceFailure.odometer || v?.currentKm || 0)} <span className="text-[10px] text-slate-500 font-sans mr-1">ک‌م</span>
                </div>
              </div>

              {/* تاریخ ثبت خرابی / پذیرش */}
              <div className="md:col-span-2 space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  تاریخ ثبت خرابی / پذیرش
                </label>
                <div className="w-full h-[38px] px-3 rounded-md border border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] flex items-center font-mono font-bold text-xs text-slate-900 dark:text-white">
                  {toJalaliDate(returnInvoiceFailure.failureDate)}
                </div>
              </div>

              {/* تاریخ تکمیل تعمیرات و ترخیص */}
              <div className="md:col-span-2 space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  تاریخ ترخیص و تحویل خودرو <span className="text-rose-500">*</span>
                </label>
                <JalaliDatePicker
                  value={invoiceEndDate}
                  onChange={setInvoiceEndDate}
                  inputClassName="h-[38px] text-xs font-bold rounded-md"
                />
              </div>

              {/* سطح فوریت */}
              <div className="md:col-span-3 space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  سطح فوریت
                </label>
                <div className="w-full h-[38px] px-3 rounded-md border border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] flex items-center font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                  <span className="truncate">
                    {returnInvoiceFailure.priority === 'high' 
                      ? 'بحرانی و اضطراری (توقف کامل خودرو)' 
                      : returnInvoiceFailure.priority === 'medium'
                      ? 'اولویت متوسط (نیازمند رسیدگی سریع)'
                      : 'اشکال جزیی و غیراضطراری'}
                  </span>
                </div>
              </div>
            </div>

            {/* ۲. بخش جدول خرابی‌های گزارش‌شده و ارجاعی به تعمیرگاه */}
            <div className="space-y-2.5 bg-slate-50 dark:bg-[#161618] rounded-xl border border-slate-200 dark:border-[#2d2d30] p-3">
              
              {/* هدر بخش خرابی‌ها */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-[#2d2d30]">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded border border-indigo-200 dark:border-indigo-500/20">
                    <Wrench className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                      خرابی‌های ارجاعی و اجرت تعمیرات <span className="text-rose-500">*</span>
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      تعیین اجرت، تعمیرکار و سطح رضایت کیفیت کار به تفکیک هر ردیف خرابی
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleInvoiceAddFailureRow}
                  className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold rounded border border-indigo-200 dark:border-indigo-800/60 transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن خرابی</span>
                </button>
              </div>

              {/* جدول اقلام خرابی فاکتور */}
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#2d2d30] bg-white dark:bg-[#111113]">
                <table className="w-full text-right text-xs font-mono font-bold text-slate-700 dark:text-slate-300 border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-[#161618] border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-mono font-bold text-xs">
                      <th className="py-2 px-2 text-center w-8 text-xs font-mono font-bold">#</th>
                      <th className="py-2 px-2 min-w-[160px]">نوع خرابی <span className="text-rose-500">*</span></th>
                      <th className="py-2 px-2 min-w-[130px]">دسته خرابی</th>
                      <th className="py-2 px-2 min-w-[140px]">تعمیرکار / تعمیرگاه</th>
                      <th className="py-2 px-2 text-center w-14">شرح</th>
                      <th className="py-2 px-2 text-left w-36 min-w-[120px]">اجرت (ریال)</th>
                      <th className="py-2 px-2 text-center w-32 min-w-[110px]">سطح رضایت</th>
                      <th className="py-2 px-2 text-center w-10">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                    {invoiceFailureRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-6 text-slate-500 font-bold text-[11px]">
                          هیچ ردیف خرابی ثبت نشده است. روی دکمه «+ افزودن خرابی» کلیک کنید.
                        </td>
                      </tr>
                    ) : (
                      invoiceFailureRows.map((row, index) => (
                        <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/40 transition-colors">
                          {/* شماره ردیف */}
                          <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-400 dark:text-slate-500 text-[10px]">
                            {toPersianDigits(index + 1)}
                          </td>

                          {/* نوع خرابی */}
                          <td className="py-1.5 px-2 font-sans font-bold">
                            <CustomSelect
                              value={row.definitionId}
                              onChange={(val) => handleInvoiceUpdateFailureRow(row.id, { definitionId: String(val) })}
                              placeholder="انتخاب نوع خرابی..."
                              searchable={true}
                              size="xs"
                              matchTriggerWidth={true}
                              quickAddType="failure"
                              options={[
                                { value: '', label: '-- بدون انتخاب --' },
                                ...failureDefinitions.map(def => ({
                                  value: def.id.toString(),
                                  label: def.failureType
                                }))
                              ]}
                            />
                          </td>

                          {/* دسته خرابی */}
                          <td className="py-1.5 px-2 font-sans font-medium">
                            <CustomSelect
                              value={row.category}
                              onChange={(val) => handleInvoiceUpdateFailureRow(row.id, { category: String(val) })}
                              placeholder="انتخاب دسته..."
                              searchable={true}
                              size="xs"
                              matchTriggerWidth={true}
                              onAddNew={() => {
                                setCategoryTargetRowId(row.id);
                                setCategoryTargetForm('invoice');
                                setIsAddCategoryModalOpen(true);
                              }}
                              addNewLabel="افزودن دسته‌بندی جدید..."
                              options={[
                                { value: '', label: 'انتخاب کنید...' },
                                ...activeFailureCategoryOptions.map(cat => ({
                                  value: cat.value,
                                  label: cat.label
                                }))
                              ]}
                            />
                          </td>

                          {/* تعمیرکار */}
                          <td className="py-1.5 px-2 font-sans font-medium">
                            <CustomSelect
                              value={row.mechanicId}
                              onChange={(val) => handleInvoiceUpdateFailureRow(row.id, { mechanicId: String(val) })}
                              placeholder=""
                              showEmptyAsBlank={true}
                              searchable={true}
                              size="xs"
                              matchTriggerWidth={true}
                              quickAddType="mechanic"
                              options={[
                                { value: '', label: '-- بدون تعمیرکار --' },
                                ...mechanics.map(m => ({
                                  value: m.id.toString(),
                                  label: m.shopName ? `${m.name} (${m.shopName})` : m.name
                                }))
                              ]}
                            />
                          </td>

                          {/* دکمه مشاهده و ویرایش جزئیات شرح خرابی */}
                          <td className="py-1.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedFailureDescModal({
                                rowIndex: index,
                                failureType: row.failureType || 'عیب فنی',
                                description: row.description || '',
                                isInvoiceForm: true
                              })}
                              className={`w-7 h-7 rounded border transition-colors flex items-center justify-center mx-auto cursor-pointer shadow-2xs relative ${
                                row.description && row.description.trim()
                                  ? 'border-slate-300 dark:border-[#38383c] bg-white dark:bg-[#1a1a1c] text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252528]'
                                  : 'border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100'
                              }`}
                              title={row.description && row.description.trim() ? `شرح: ${row.description}` : 'ثبت شرح خرابی'}
                            >
                              <FileText className="w-3.5 h-3.5" />
                              {row.description && row.description.trim() && (
                                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-slate-500 dark:bg-slate-400" />
                              )}
                            </button>
                          </td>

                          {/* اجرت (ریال) */}
                          <td className="py-1.5 px-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="۰"
                              value={row.wage ? formatPrice(row.wage) : ''}
                              onChange={e => {
                                const val = parsePersianNumber(e.target.value);
                                handleInvoiceUpdateFailureRow(row.id, { wage: val });
                              }}
                              className="w-full h-6 px-2 rounded border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#161619] text-slate-900 dark:text-white text-left font-mono font-bold focus:ring-1 focus:ring-indigo-500 text-xs shadow-2xs"
                            />
                          </td>

                          {/* سطح رضایت */}
                          <td className="py-1.5 px-2 font-sans font-medium">
                            <CustomSelect
                              value={row.satisfactionLevel || ''}
                              onChange={val => handleInvoiceUpdateFailureRow(row.id, { satisfactionLevel: (val || undefined) as SatisfactionLevel | undefined })}
                              placeholder="انتخاب رضایت..."
                              size="xs"
                              matchTriggerWidth={true}
                              options={SATISFACTION_SELECT_OPTIONS}
                            />
                          </td>

                          {/* دکمه حذف ردیف */}
                          <td className="py-1.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleInvoiceRemoveFailureRow(row.id)}
                              disabled={invoiceFailureRows.length <= 1}
                              className="w-6 h-6 inline-flex items-center justify-center bg-slate-100 dark:bg-[#1a1a1c] hover:bg-rose-50 dark:hover:bg-rose-600/20 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded border border-slate-200 dark:border-[#2d2d30] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer mx-auto"
                              title="حذف ردیف"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* خلاصه اجرت ردیف‌های خرابی در مودال فاکتور */}
                <div className="p-2 bg-slate-50 dark:bg-[#161618] border-t border-slate-200 dark:border-[#2d2d30] flex flex-wrap items-center justify-between text-xs font-bold gap-2">
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                    تعداد خرابی‌های ثبت‌شده: <strong className="text-slate-800 dark:text-slate-200 font-mono">{toPersianDigits(invoiceFailureRows.length)}</strong>
                  </span>
                  <div className="text-slate-700 dark:text-slate-300 text-[11px] flex items-center gap-1">
                    <span>مجموع اجرت ردیف‌های خرابی:</span>
                    <strong className="font-mono text-indigo-600 dark:text-indigo-400">{formatPrice(invoiceWages)}</strong>
                    <span className="text-[10px] text-slate-400 font-normal">ریال</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ۳. بخش قطعات مصرفی با طراحی فشرده شبیه ثبت خدمات سرویس دوره‌ای */}
            <div className="space-y-2.5 bg-slate-50 dark:bg-[#161618] rounded-xl border border-slate-200 dark:border-[#2d2d30] p-3">
              {/* هدر بخش قطعات همراه دکمه‌های کوچک افزودن */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-[#2d2d30]">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded border border-indigo-200 dark:border-indigo-500/20">
                    <Package className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                      اقلام و قطعات مصرفی فاکتور
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      ثبت قطعات دریافتی از انبار شرکت یا تأمین‌شده توسط خودِ تعمیرگاه همراه با قیمت واحد و تعداد
                    </p>
                  </div>
                </div>

                {/* دکمه افزودن ردیف قطعه */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => handleAddPartRow()}
                    className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold rounded border border-indigo-200 dark:border-indigo-800/60 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن قطعه</span>
                  </button>
                </div>
              </div>

              {/* جدول ردیف‌های اقلام با فیلدهای کوچک و جمع‌وجور */}
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#2d2d30] bg-white dark:bg-[#111113]">
                <table className="w-full text-right text-xs font-mono font-bold text-slate-700 dark:text-slate-300 border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-[#161618] border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-mono font-bold text-xs">
                      <th className="py-2 px-2 text-center w-8 text-xs font-mono font-bold">#</th>
                      <th className="py-2 px-2 min-w-[150px] text-xs font-bold">منبع تأمین</th>
                      <th className="py-2 px-2 min-w-[180px] text-xs font-bold">عنوان و مشخصات قطعه</th>
                      <th className="py-2 px-2 text-center w-16 text-xs font-bold">تعداد</th>
                      <th className="py-2 px-2 text-left w-32 min-w-[110px] text-xs font-bold">قیمت واحد (ریال)</th>
                      <th className="py-2 px-2 text-left w-32 min-w-[115px] text-xs font-bold">جمع ردیف (ریال)</th>
                      <th className="py-2 px-2 text-center w-10 text-xs font-bold">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                    {invoicePartRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-6 text-slate-500 font-bold text-[11px]">
                          هیچ قطعه‌ای ثبت نشده است. روی دکمه «+ افزودن قطعه» کلیک کنید.
                        </td>
                      </tr>
                    ) : (
                      invoicePartRows.map((row, index) => {
                        const isWarehouse = row.source === 'warehouse';
                        
                        return (
                          <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/40 transition-colors">
                            {/* ردیف */}
                            <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-400 dark:text-slate-500 text-[10px]">
                              {toPersianDigits(index + 1)}
                            </td>

                            {/* منبع تأمین */}
                            <td className="py-1.5 px-2">
                              <CustomSelect
                                value={row.source}
                                onChange={(val) => handleUpdatePartRow(row.id, { source: val })}
                                size="xs"
                                searchable={true}
                                matchTriggerWidth={true}
                                quickAddType="supplier"
                                placeholder="-- انتخاب تامین‌کننده --"
                                options={[
                                  { value: 'warehouse', label: 'انبار شرکت' },
                                  { value: 'shop', label: 'تأمین تعمیرگاه' },
                                  ...suppliers.map(s => ({
                                    value: s.id.toString(),
                                    label: `${s.name}${s.category ? ` (${s.category})` : ''}`
                                  }))
                                ]}
                              />
                            </td>

                            {/* عنوان قطعه */}
                            <td className="py-1.5 px-2">
                              {isWarehouse ? (
                                <CustomSelect
                                  value={row.partName}
                                  onChange={(val) => handleUpdatePartRow(row.id, { partName: val })}
                                  placeholder="انتخاب قطعه انبار..."
                                  searchable={true}
                                  matchTriggerWidth={true}
                                  size="xs"
                                  quickAddType="part"
                                  options={parts.map(p => ({
                                    value: p.partName,
                                    label: p.partName
                                  }))}
                                />
                              ) : (
                                <input
                                  type="text"
                                  placeholder="نام و مشخصات قطعه..."
                                  value={row.partName}
                                  onChange={(e) => handleUpdatePartRow(row.id, { partName: e.target.value })}
                                  className="w-full h-6 px-2 rounded border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#161619] text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 text-xs font-medium"
                                />
                              )}
                            </td>

                            {/* تعداد */}
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={row.quantity ? toPersianDigits(row.quantity) : '۱'}
                                onChange={(e) => {
                                  const q = parsePersianNumber(e.target.value);
                                  handleUpdatePartRow(row.id, { quantity: q > 0 ? q : 1 });
                                }}
                                className="w-full h-6 px-1 rounded border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#161619] text-slate-900 dark:text-white text-center font-mono font-bold focus:ring-1 focus:ring-indigo-500 text-xs"
                              />
                            </td>

                            {/* قیمت واحد */}
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder="۰"
                                value={row.unitPrice ? formatPrice(row.unitPrice) : ''}
                                onChange={(e) => {
                                  const p = parsePersianNumber(e.target.value);
                                  handleUpdatePartRow(row.id, { unitPrice: p });
                                }}
                                className="w-full h-6 px-2 rounded border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#161619] text-slate-900 dark:text-white text-left font-mono font-medium focus:ring-1 focus:ring-indigo-500 text-xs"
                              />
                            </td>

                            {/* جمع ردیف */}
                            <td className="py-1.5 px-2 whitespace-nowrap">
                              <div className="h-6 px-2 rounded border border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] flex items-center justify-end text-slate-800 dark:text-slate-200 font-mono font-bold text-xs">
                                {formatPrice(row.cost)}
                              </div>
                            </td>

                            {/* دکمه حذف */}
                            <td className="py-1.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemovePartRow(row.id)}
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

              {/* جمع‌های تفکیکی زیر جدول */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 dark:text-slate-400">
                    قطعات انبار شرکت: <strong className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{formatPrice(warehouseTotal)} ریال</strong>
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    قطعات تعمیرگاه (آزاد): <strong className="font-mono text-slate-700 dark:text-slate-300 font-bold">{formatPrice(shopPartsTotal)} ریال</strong>
                  </span>
                </div>
                <div className="font-bold text-slate-700 dark:text-slate-300 font-mono">
                  مجموع قطعات: <span className="text-slate-900 dark:text-white font-bold">{formatPrice(warehouseTotal + shopPartsTotal)} ریال</span>
                </div>
              </div>
            </div>

            {/* ۳. هزینه‌های فاکتور، اجرت و جمع کل */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch p-3 bg-slate-50 dark:bg-[#161618] rounded-xl border border-slate-200 dark:border-[#2d2d30]">
              {/* اجرت و دستمزد تعمیرکار */}
              <div className="space-y-1 md:col-span-6 flex flex-col justify-between">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  اجرت و دستمزد تعمیرکار (ریال)
                </label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  placeholder="مثال: ۲,۰۰۰,۰۰۰"
                  value={invoiceWages ? formatPrice(invoiceWages) : ''} 
                  onChange={e => {
                    const val = parsePersianNumber(e.target.value);
                    setInvoiceWages(val);
                    calculateTotalInvoiceCost(invoicePartRows, val);
                  }}
                  className="w-full h-[38px] px-3 rounded-md border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white font-mono font-bold text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-left"
                />
              </div>

              {/* مبلغ کل فاکتور نهایی */}
              <div className="space-y-1 md:col-span-6 flex flex-col justify-between">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  مبلغ کل فاکتور نهایی (ریال) <span className="text-rose-500">*</span>
                </label>
                <div className="w-full h-[38px] px-3 rounded-md border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] flex items-center justify-between select-none">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">مجموع کل:</span>
                  <div className="text-xs font-black text-slate-900 dark:text-white font-mono">
                    {formatPrice(invoiceTotalCost || 0)} <span className="text-[10px] font-normal text-slate-500">ریال</span>
                  </div>
                </div>
              </div>

              {/* شرح خدمات و یادداشت فاکتور */}
              <div className="space-y-1 md:col-span-12">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  شرح خدمات یا توضیحات تکمیلی فاکتور تعمیرگاه (اختیاری)
                </label>
                <input 
                  type="text" 
                  placeholder="مثال: رفع عیب سیستم برق، تعویض تسمه و تحویل به راننده..."
                  value={shopInvoiceNotes}
                  onChange={e => setShopInvoiceNotes(e.target.value)}
                  className="w-full h-[38px] px-3 rounded-md border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#161619] text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs placeholder-slate-400 dark:placeholder-slate-600 font-medium shadow-2xs"
                />
              </div>
            </div>

            {/* دکمه‌های اقدام انتهای صفحه */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-[#2d2d30]">
              <button 
                type="button" 
                onClick={() => setReturnInvoiceFailure(null)} 
                className="px-3 py-1.5 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-400 font-bold rounded-md transition-colors border border-slate-200 dark:border-[#2d2d30] text-xs cursor-pointer"
              >
                انصراف
              </button>

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md transition-colors active:scale-95 text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ثبت فاکتور و ترخیص به «آماده شده»</span>
              </button>
            </div>
          </form>
        </div>

        {/* مدال مشاهده و ویرایش جزئیات شرح خرابی */}
        {selectedFailureDescModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 overflow-y-auto" dir="rtl">
            <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-auto">
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-slate-900 dark:text-white text-sm font-bold flex items-center gap-2">
                      <span>جزئیات و شرح نقص فنی</span>
                      <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono">
                        (ردیف {toPersianDigits(selectedFailureDescModal.rowIndex + 1)})
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      نوع خرابی: <strong className="text-slate-800 dark:text-slate-200">{selectedFailureDescModal.failureType || 'نقص فنی'}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFailureDescModal(null)}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-5 space-y-3 bg-white dark:bg-[#111113]">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block text-xs">
                    شرح کامل عیوب، علائم خرابی و گزارش راننده یا پذیرش:
                  </label>
                  <textarea
                    rows={5}
                    value={selectedFailureDescModal.description}
                    onChange={(e) => {
                      const newDesc = e.target.value;
                      setSelectedFailureDescModal(prev => prev ? { ...prev, description: newDesc } : null);
                      if (selectedFailureDescModal.isInvoiceForm) {
                        const targetRow = invoiceFailureRows[selectedFailureDescModal.rowIndex];
                        if (targetRow) {
                          handleInvoiceUpdateFailureRow(targetRow.id, { description: newDesc });
                        }
                      } else {
                        const targetRow = editFailureRows[selectedFailureDescModal.rowIndex];
                        if (targetRow) {
                          handleEditUpdateFailureRow(targetRow.id, { description: newDesc });
                        }
                      }
                    }}
                    placeholder="توضیحات تکمیلی نقص فنی، علل ایجاد یا توضیحات راننده..."
                    className="w-full bg-slate-50 dark:bg-[#161619] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg p-3 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 p-3 sm:px-5 sm:py-3.5 border-t border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
                <button
                  type="button"
                  onClick={() => setSelectedFailureDescModal(null)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors text-xs cursor-pointer shadow-xs active:scale-95"
                >
                  تأیید و بستن
                </button>
              </div>
            </div>
          </div>
        )}

        {/* مودال ثبت و تعریف دسته‌بندی نقص فنی جدید */}
        {isAddCategoryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 overflow-y-auto" dir="rtl">
            <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-auto">
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white dark:bg-[#202024] rounded-lg border border-slate-200 dark:border-[#303035] shadow-xs">
                    <Tag className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-slate-900 dark:text-white text-sm font-bold">
                      ثبت دسته‌بندی نقص فنی جدید
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      افزودن به لیست گزینه‌های دسته‌بندی خرابی و ارجاع
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNewCategoryName('');
                    setCategoryErrorMsg('');
                    setIsAddCategoryModalOpen(false);
                    setCategoryTargetRowId(null);
                  }}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddFailureCategory} className="p-4 sm:p-5 space-y-4 text-xs bg-white dark:bg-[#111113]">
                {categoryErrorMsg && (
                  <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-700 dark:text-rose-300 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{categoryErrorMsg}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    عنوان دسته‌بندی <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: هیدرولیک و فرمان، سیستم خنک‌کاری، گیربکس اتوماتیک..."
                    value={newCategoryName}
                    onChange={(e) => {
                      setNewCategoryName(e.target.value);
                      if (categoryErrorMsg) setCategoryErrorMsg('');
                    }}
                    className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    autoFocus
                    required
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    این دسته‌بندی در لیست ذخیره شده و بلافاصله برای این ردیف انتخاب خواهد شد.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-[#2d2d30]">
                  <button
                    type="button"
                    onClick={() => {
                      setNewCategoryName('');
                      setCategoryErrorMsg('');
                      setIsAddCategoryModalOpen(false);
                      setCategoryTargetRowId(null);
                    }}
                    className="px-4 py-2 border border-slate-300 dark:border-[#2d2d30] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a1a1c] font-bold rounded-lg transition-colors text-xs cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors shadow-xs active:scale-95 text-xs cursor-pointer"
                  >
                    ثبت دسته‌بندی
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ۳. اگر کاربر روی ردیف کلیک کرده و صفحه ویرایش پرونده خرابی باز شده است (نمایش تمام‌صفحه)
  if (editingFailure) {
    const v = vehicles.find(veh => veh.id === editingFailure.vehicleId);
    const wf = workflows.find(w => w.failureId === editingFailure.id);
    const isCompletedOrApproved = editingFailure.status === 'completed' || editingFailure.status === 'approved' || Boolean(wf && (wf.isDelivered || (wf.endDate && Number(wf.totalCost) > 0)));

    const warehouseTotal = editPartRows
      .filter(r => r.source === 'warehouse')
      .reduce((acc, r) => acc + (Number(r.cost) || 0), 0);

    const shopPartsTotal = editPartRows
      .filter(r => r.source !== 'warehouse')
      .reduce((acc, r) => acc + (Number(r.cost) || 0), 0);

    const totalPartsCost = warehouseTotal + shopPartsTotal;

    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-[#111113] rounded-lg w-full border border-slate-200 dark:border-[#2d2d30] flex flex-col overflow-hidden space-y-0 shadow-sm">
          
          {/* هدر صفحه اختصاصی ویرایش پرونده */}
          <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-500" />
                <span>صفحه ویرایش جامع پرونده خرابی، تعمیرات و فاکتور</span>
                <span className="text-xs text-amber-500 dark:text-amber-400 font-mono">#{toPersianDigits(editingFailure.id)}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  isCompletedOrApproved 
                    ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30' 
                    : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30'
                }`}>
                  {isCompletedOrApproved ? 'تکمیل و آماده شده' : 'در حال انجام تعمیرات'}
                </span>
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                {isCompletedOrApproved 
                  ? 'ویرایش مشخصات خودرو، تاریخ ثبت خرابی، تاریخ ترخیص، اقلام مصرفی انبار و تعمیرگاه، اجرت و مبالغ فاکتور'
                  : 'ویرایش مشخصات خودرو، تاریخ ثبت خرابی، اقلام مصرفی انبار و تعمیرگاه، اجرت و مشخصات پرونده خرابی'}
              </p>
            </div>
            <button 
              type="button"
              onClick={() => setEditingFailure(null)} 
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors border border-transparent hover:border-slate-300 dark:border-[#2d2d30] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* فرم ویرایش تمام‌صفحه */}
          <form onSubmit={handleSaveEditFailure} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs bg-white dark:bg-[#111113]">
            
            {/* ۱. ردیف اول: نام خودرو، کارکرد کیلومتر، تاریخ ثبت خرابی، تاریخ ترخیص (فقط پس از ثبت فاکتور) و سطح فوریت */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
              {/* نام خودرو */}
              <div className={`${isCompletedOrApproved ? 'md:col-span-3' : 'md:col-span-4'} space-y-1`}>
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  نام ماشین (جستجو و انتخاب) <span className="text-rose-500">*</span>
                </label>
                <CustomSelect
                  value={editVehicleId}
                  onChange={val => {
                    setEditVehicleId(val);
                    const selectedV = vehicles.find(vItem => vItem.id.toString() === val);
                    if (selectedV && (!editOdometer || editOdometer === 0)) {
                      setEditOdometer(selectedV.currentKm || 0);
                    }
                  }}
                  placeholder="جستجو و انتخاب خودرو از لیست..."
                  searchable={true}
                  matchTriggerWidth={true}
                  quickAddType="vehicle"
                  options={vehicles.map(veh => ({ 
                    value: veh.id.toString(), 
                    label: getVehicleDisplayName(veh) 
                  }))}
                />
              </div>

              {/* کارکرد کیلومتر */}
              <div className="md:col-span-2 space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  کارکرد (کیلومتر) <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text"
                  inputMode="numeric"
                  value={editOdometer ? formatNumber(editOdometer) : ''}
                  onChange={e => setEditOdometer(parsePersianNumber(e.target.value))}
                  placeholder="مثال: ۱۲۰،۰۰۰"
                  className="w-full h-[38px] px-3 rounded-md border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#161619] text-slate-900 dark:text-white font-mono font-bold text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none shadow-2xs"
                  required
                />
              </div>

              {/* تاریخ ثبت خرابی / ارجاع */}
              <div className={`${isCompletedOrApproved ? 'md:col-span-2' : 'md:col-span-3'} space-y-1`}>
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  تاریخ ثبت خرابی / ارجاع <span className="text-rose-500">*</span>
                </label>
                <JalaliDatePicker
                  value={editFailureDate}
                  onChange={setEditFailureDate}
                  inputClassName="h-[38px] text-xs font-bold rounded-md"
                />
              </div>

              {/* تاریخ ترخیص / پایان (فقط در صورتی که فاکتور ثبت شده یا ترخیص انجام شده باشد) */}
              {isCompletedOrApproved && (
                <div className="md:col-span-2 space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                    تاریخ ترخیص / پایان تعمیرات
                  </label>
                  <JalaliDatePicker
                    value={editEndDate}
                    onChange={setEditEndDate}
                    inputClassName="h-[38px] text-xs font-bold rounded-md"
                  />
                </div>
              )}

              {/* سطح فوریت */}
              <div className="md:col-span-3 space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  سطح فوریت و اولویت ارجاع <span className="text-rose-500">*</span>
                </label>
                <CustomSelect
                  value={editPriority}
                  onChange={val => setEditPriority(val as FailurePriority)}
                  matchTriggerWidth={true}
                  options={[
                    { value: 'high', label: 'بحرانی و اضطراری (توقف کامل خودرو)' },
                    { value: 'medium', label: 'اولویت متوسط (نیازمند رسیدگی سریع)' },
                    { value: 'low', label: 'اشکال جزیی و غیراضطراری' }
                  ]}
                />
              </div>
            </div>

            {/* ۲. بخش جدول خرابی‌های گزارش‌شده */}
            <div className="space-y-2.5 bg-slate-50 dark:bg-[#161618] rounded-xl border border-slate-200 dark:border-[#2d2d30] p-3">
              
              {/* هدر بخش خرابی‌ها */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-[#2d2d30]">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded border border-indigo-200 dark:border-indigo-500/20">
                    <Wrench className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                      خرابی‌های گزارش‌شده <span className="text-rose-500">*</span>
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      ویرایش و ثبت انواع خرابی با دسته و تعمیرکار مربوطه
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleEditAddFailureRow}
                  className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold rounded border border-indigo-200 dark:border-indigo-800/60 transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن خرابی</span>
                </button>
              </div>

              {/* جدول اقلام خرابی */}
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#2d2d30] bg-white dark:bg-[#111113]">
                <table className="w-full text-right text-xs font-mono font-bold text-slate-700 dark:text-slate-300 border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-[#161618] border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-mono font-bold text-xs">
                      <th className="py-2 px-2 text-center w-8 text-xs font-mono font-bold">#</th>
                      <th className="py-2 px-2 min-w-[160px]">نوع خرابی <span className="text-rose-500">*</span></th>
                      <th className="py-2 px-2 min-w-[130px]">دسته خرابی</th>
                      <th className="py-2 px-2 min-w-[140px]">تعمیرکار</th>
                      <th className="py-2 px-2 text-center w-14">شرح</th>
                      <th className="py-2 px-2 text-center w-10">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                    {editFailureRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-slate-500 font-bold text-[11px]">
                          هیچ ردیف خرابی ثبت نشده است. روی دکمه «+ افزودن خرابی» کلیک کنید.
                        </td>
                      </tr>
                    ) : (
                      editFailureRows.map((row, index) => (
                        <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/40 transition-colors">
                          {/* شماره ردیف */}
                          <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-400 dark:text-slate-500 text-[10px]">
                            {toPersianDigits(index + 1)}
                          </td>

                          {/* نوع خرابی */}
                          <td className="py-1.5 px-2 font-sans font-bold">
                            <CustomSelect
                              value={row.definitionId}
                              onChange={(val) => handleEditUpdateFailureRow(row.id, { definitionId: String(val) })}
                              placeholder="انتخاب نوع خرابی..."
                              searchable={true}
                              size="xs"
                              matchTriggerWidth={true}
                              quickAddType="failure"
                              options={[
                                { value: '', label: '-- بدون انتخاب --' },
                                ...failureDefinitions.map(def => ({
                                  value: def.id.toString(),
                                  label: def.failureType
                                }))
                              ]}
                            />
                          </td>

                          {/* دسته خرابی */}
                          <td className="py-1.5 px-2 font-sans font-medium">
                            <CustomSelect
                              value={row.category}
                              onChange={(val) => handleEditUpdateFailureRow(row.id, { category: String(val) })}
                              placeholder="انتخاب دسته..."
                              searchable={true}
                              size="xs"
                              matchTriggerWidth={true}
                              onAddNew={() => {
                                setCategoryTargetRowId(row.id);
                                setCategoryTargetForm('edit');
                                setIsAddCategoryModalOpen(true);
                              }}
                              addNewLabel="افزودن دسته‌بندی جدید..."
                              options={[
                                { value: '', label: 'انتخاب کنید...' },
                                ...activeFailureCategoryOptions.map(cat => ({
                                  value: cat.value,
                                  label: cat.label
                                }))
                              ]}
                            />
                          </td>

                          {/* تعمیرکار */}
                          <td className="py-1.5 px-2 font-sans font-medium">
                            <CustomSelect
                              value={row.mechanicId}
                              onChange={(val) => handleEditUpdateFailureRow(row.id, { mechanicId: String(val) })}
                              placeholder=""
                              showEmptyAsBlank={true}
                              searchable={true}
                              size="xs"
                              matchTriggerWidth={true}
                              quickAddType="mechanic"
                              options={[
                                { value: '', label: '-- بدون تعمیرکار --' },
                                ...mechanics.map(m => ({
                                  value: m.id.toString(),
                                  label: m.shopName ? `${m.name} (${m.shopName})` : m.name
                                }))
                              ]}
                            />
                          </td>

                          {/* دکمه مشاهده و ویرایش جزئیات شرح خرابی */}
                          <td className="py-1.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedFailureDescModal({
                                rowIndex: index,
                                failureType: row.failureType || 'عیب فنی',
                                description: row.description || '',
                                isInvoiceForm: false
                              })}
                              className={`w-7 h-7 rounded border transition-colors flex items-center justify-center mx-auto cursor-pointer shadow-2xs relative ${
                                row.description && row.description.trim()
                                  ? 'border-slate-300 dark:border-[#38383c] bg-white dark:bg-[#1a1a1c] text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252528]'
                                  : 'border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100'
                              }`}
                              title={row.description && row.description.trim() ? `شرح: ${row.description}` : 'ثبت شرح خرابی'}
                            >
                              <FileText className="w-3.5 h-3.5" />
                              {row.description && row.description.trim() && (
                                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-slate-500 dark:bg-slate-400" />
                              )}
                            </button>
                          </td>

                          {/* دکمه حذف ردیف */}
                          <td className="py-1.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleEditRemoveFailureRow(row.id)}
                              disabled={editFailureRows.length <= 1}
                              className="w-6 h-6 inline-flex items-center justify-center bg-slate-100 dark:bg-[#1a1a1c] hover:bg-rose-50 dark:hover:bg-rose-600/20 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded border border-slate-200 dark:border-[#2d2d30] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer mx-auto"
                              title="حذف ردیف"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* خلاصه ردیف‌های خرابی در مودال ویرایش */}
                <div className="p-2 bg-slate-50 dark:bg-[#161618] border-t border-slate-200 dark:border-[#2d2d30] flex flex-wrap items-center justify-between text-xs font-bold gap-2">
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                    تعداد خرابی‌های ثبت‌شده: <strong className="text-slate-800 dark:text-slate-200 font-mono">{toPersianDigits(editFailureRows.length)}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* دکمه‌های اقدام انتهای صفحه */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-[#2d2d30]">
              <button 
                type="button" 
                onClick={() => setEditingFailure(null)} 
                className="px-4 py-2 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-400 font-bold rounded-md transition-colors border border-slate-200 dark:border-[#2d2d30] text-xs cursor-pointer"
              >
                انصراف
              </button>

              <button 
                type="submit" 
                disabled={isEditSubmitting}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md transition-colors active:scale-95 text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <Edit2 className="w-4 h-4" />
                <span>{isEditSubmitting ? 'در حال ذخیره...' : 'ذخیره تغییرات پرونده'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* مدال مشاهده و ویرایش جزئیات شرح خرابی */}
        {selectedFailureDescModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 overflow-y-auto" dir="rtl">
            <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-auto">
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-slate-900 dark:text-white text-sm font-bold flex items-center gap-2">
                      <span>جزئیات و شرح نقص فنی</span>
                      <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono">
                        (ردیف {toPersianDigits(selectedFailureDescModal.rowIndex + 1)})
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      نوع خرابی: <strong className="text-slate-800 dark:text-slate-200">{selectedFailureDescModal.failureType || 'نقص فنی'}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFailureDescModal(null)}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-5 space-y-3 bg-white dark:bg-[#111113]">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block text-xs">
                    شرح کامل عیوب، علائم خرابی و گزارش راننده یا پذیرش:
                  </label>
                  <textarea
                    rows={5}
                    value={selectedFailureDescModal.description}
                    onChange={(e) => {
                      const newDesc = e.target.value;
                      setSelectedFailureDescModal(prev => prev ? { ...prev, description: newDesc } : null);
                      if (selectedFailureDescModal.isInvoiceForm) {
                        const targetRow = invoiceFailureRows[selectedFailureDescModal.rowIndex];
                        if (targetRow) {
                          handleInvoiceUpdateFailureRow(targetRow.id, { description: newDesc });
                        }
                      } else {
                        const targetRow = editFailureRows[selectedFailureDescModal.rowIndex];
                        if (targetRow) {
                          handleEditUpdateFailureRow(targetRow.id, { description: newDesc });
                        }
                      }
                    }}
                    placeholder="توضیحات تکمیلی نقص فنی، علل ایجاد یا توضیحات راننده..."
                    className="w-full bg-slate-50 dark:bg-[#161619] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg p-3 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 p-3 sm:px-5 sm:py-3.5 border-t border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
                <button
                  type="button"
                  onClick={() => setSelectedFailureDescModal(null)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors text-xs cursor-pointer shadow-xs active:scale-95"
                >
                  تأیید و بستن
                </button>
              </div>
            </div>
          </div>
        )}

        {/* مودال ثبت و تعریف دسته‌بندی نقص فنی جدید */}
        {isAddCategoryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 overflow-y-auto" dir="rtl">
            <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-auto">
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white dark:bg-[#202024] rounded-lg border border-slate-200 dark:border-[#303035] shadow-xs">
                    <Tag className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-slate-900 dark:text-white text-sm font-bold">
                      ثبت دسته‌بندی نقص فنی جدید
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      افزودن به لیست گزینه‌های دسته‌بندی خرابی و ارجاع
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNewCategoryName('');
                    setCategoryErrorMsg('');
                    setIsAddCategoryModalOpen(false);
                    setCategoryTargetRowId(null);
                  }}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddFailureCategory} className="p-4 sm:p-5 space-y-4 text-xs bg-white dark:bg-[#111113]">
                {categoryErrorMsg && (
                  <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-700 dark:text-rose-300 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{categoryErrorMsg}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    عنوان دسته‌بندی <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: هیدرولیک و فرمان، سیستم خنک‌کاری، گیربکس اتوماتیک..."
                    value={newCategoryName}
                    onChange={(e) => {
                      setNewCategoryName(e.target.value);
                      if (categoryErrorMsg) setCategoryErrorMsg('');
                    }}
                    className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    autoFocus
                    required
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    این دسته‌بندی در لیست ذخیره شده و بلافاصله برای این ردیف انتخاب خواهد شد.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-[#2d2d30]">
                  <button
                    type="button"
                    onClick={() => {
                      setNewCategoryName('');
                      setCategoryErrorMsg('');
                      setIsAddCategoryModalOpen(false);
                      setCategoryTargetRowId(null);
                    }}
                    className="px-4 py-2 border border-slate-300 dark:border-[#2d2d30] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a1a1c] font-bold rounded-lg transition-colors text-xs cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors shadow-xs active:scale-95 text-xs cursor-pointer"
                  >
                    ثبت دسته‌بندی
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* هدر بخش و دکمه ثبت خرابی */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-[#111113] p-4 rounded-lg border border-slate-200 dark:border-[#2d2d30]">
        <div>
          <h1 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Wrench className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            مدیریت خرابی و تعمیرگاه
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            ثبت و ردیابی خرابی‌های ناوگان، ارجاع به تعمیرگاه و صدور فاکتور ترخیص
          </p>
        </div>

        <button 
          onClick={handleOpenReportModal}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>ثبت خرابی جدید</span>
        </button>
      </div>

      {/* تب‌های جابجایی بین بخش‌ها با ترنزیشن نرم و متحرک */}
      <div className="flex border-b border-slate-200 dark:border-[#2d2d30] gap-2 overflow-x-auto relative">
        <button
          type="button"
          onClick={() => setActiveTab('in_repair')}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'in_repair'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>خودروهای در حال تعمیر</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 font-mono font-bold">
            {toPersianDigits(countInRepair)}
          </span>
          {activeTab === 'in_repair' && (
            <motion.div
              layoutId="activeFailureTabIndicator"
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
          <span>خودروهای آماده شده</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 font-mono font-bold">
            {toPersianDigits(countCompleted)}
          </span>
          {activeTab === 'completed' && (
            <motion.div
              layoutId="activeFailureTabIndicator"
              className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>
      </div>

      {/* ابزار جستجو و فیلترهای تاریخ و خروجی اکسل */}
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

        {/* دکمه خروجی اکسل */}
        <button
          type="button"
          onClick={handleExportExcel}
          className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-2xs shrink-0 group self-center"
          title={startDate || endDate ? `دریافت خروجی اکسل در بازه تاریخی (${startDate || 'ابتدا'} تا ${endDate || 'انتها'})` : 'دریافت خروجی اکسل کل اطلاعات'}
        >
          <FileSpreadsheet className="w-4 h-4 transition-transform group-hover:scale-110" />
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
          {/* جدول نمایش خودروها بر اساس بخش فعال */}
          <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex justify-between items-center">
          <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
            <List className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>
              {activeTab === 'in_repair' ? 'خودروهای در حال تعمیر' : 'خودروهای آماده شده'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'in_repair' ? (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                <Receipt className="w-3 h-3" />
                جهت ترخیص، «ثبت فاکتور» را بزنید
              </span>
            ) : (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                تعمیرات پایان‌یافته
              </span>
            )}
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              {toPersianDigits(sortedFailures.length)} مورد
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] text-slate-600 dark:text-slate-400 font-medium text-xs">
                <th className="py-2 px-3 text-center w-12 text-xs font-medium">ردیف</th>
                
                <TableColumnHeader
                  title={activeTab === 'in_repair' ? 'تاریخ شروع' : 'تاریخ ترخیص'}
                  colKey="failureDate"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['failureDate']}
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
                  title="تعمیرگاه / مکانیک"
                  colKey="shopName"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['shopName']}
                  onOpenFilter={handleOpenFilterMenu}
                />

                {activeTab === 'in_repair' ? (
                  <TableColumnHeader
                    title="سطح فوریت"
                    colKey="priority"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    isFiltered={!!columnFilters['priority']}
                    onOpenFilter={handleOpenFilterMenu}
                    width="110px"
                  />
                ) : (
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
              {paginatedFailures.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500 text-[11px]">
                    {activeTab === 'in_repair' ? 'هیچ خودرویی در حال حاضر در حال تعمیر نیست.' : 'هیچ خودرویی در بخش آماده شده ثبت نشده است.'}
                  </td>
                </tr>
              ) : (
                paginatedFailures.map((f, index) => {
                  const v = vehicles.find(veh => String(veh.id) === String(f.vehicleId) || Number(veh.id) === Number(f.vehicleId));
                  const wf = workflows.find(w => w.failureId === f.id);
                  const mechsList = getFailureMechanicsList(f, wf);
                  const displayShopName = getFailureMechanicsDisplay(f, wf);

                  return (
                    <tr 
                      key={f.id} 
                      onClick={() => handleOpenEditModal(f)}
                      className="group relative h-9 hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/60 transition-colors cursor-pointer text-[11px]"
                      title="برای مشاهده و ویرایش این پرونده کلیک کنید"
                    >
                      <td className="py-1 px-3 text-center text-slate-500 text-[11px] align-middle">
                        {toPersianDigits((currentPage - 1) * pageSize + index + 1)}
                      </td>
                      <td className="py-1 px-3 text-slate-700 dark:text-slate-300 text-[11px] align-middle">
                        {activeTab === 'in_repair' ? (
                          toJalaliDate(wf?.startDate || f.failureDate)
                        ) : (
                          toJalaliDate(wf?.endDate || f.failureDate)
                        )}
                      </td>
                      <td className="py-1 px-3 whitespace-nowrap align-middle">
                        <span className="text-slate-900 dark:text-white text-[11px] font-bold">
                          {v ? `${v.name} - پلاک [${toPersianDigits(v.plaque)}]` : (f.plaque ? `پلاک [${toPersianDigits(f.plaque)}]` : '—')}
                        </span>
                      </td>
                      <td className="py-1 px-3 whitespace-nowrap align-middle" title={displayShopName}>
                        <div className="flex items-center gap-1.5 max-w-[280px]">
                          <span className="text-slate-800 dark:text-slate-200 text-[11px] truncate">
                            {displayShopName}
                          </span>
                          {mechsList.length > 1 && (
                            <span 
                              className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 shrink-0"
                              title={`${toPersianDigits(mechsList.length)} تعمیرکار منتسب`}
                            >
                              {toPersianDigits(mechsList.length)}
                            </span>
                          )}
                        </div>
                      </td>
                      
                      <td className="py-1 px-3 align-middle relative">
                        {activeTab === 'in_repair' ? (
                          getPriorityBadge(f.priority)
                        ) : (
                          <div className="text-[11px]">
                            <div className="text-emerald-600 dark:text-emerald-400 font-bold leading-tight">
                              {wf && Number(wf.totalCost) > 0 ? (
                                <>
                                  {formatPrice(wf.totalCost)} <span className="text-[9px] font-normal text-slate-500">ریال</span>
                                </>
                              ) : (
                                'بدون هزینه'
                              )}
                            </div>
                          </div>
                        )}

                        {/* دکمه‌های عملیات شناور - فقط هنگام بردن موس روی ردیف */}
                        <div className="absolute inset-y-0 left-0 pl-2.5 pr-14 flex items-center gap-1 bg-gradient-to-r from-slate-50 via-slate-50 via-70% to-transparent dark:from-[#1a1a1c] dark:via-[#1a1a1c] dark:via-70% dark:to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 z-20 pointer-events-none group-hover:pointer-events-auto">
                          {activeTab === 'in_repair' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenReturnInvoiceModal(f);
                              }}
                              className="h-[22px] px-2 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold rounded border border-indigo-200 dark:border-indigo-800 transition-colors inline-flex items-center gap-1 text-[10px] whitespace-nowrap cursor-pointer"
                              title="ثبت فاکتور، قطعات مصرفی و ترخیص به آماده شده"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>ثبت فاکتور</span>
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenReturnInvoiceModal(f);
                                }}
                                className="h-[22px] px-2 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-bold rounded border border-amber-200 dark:border-amber-800 transition-colors inline-flex items-center gap-1 text-[10px] whitespace-nowrap cursor-pointer"
                                title="ویرایش فاکتور، قطعات، اجرت و سطح رضایت"
                              >
                                <Receipt className="w-3 h-3" />
                                <span>ویرایش فاکتور</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewDetailsFailure(f);
                                }}
                                className="w-[22px] h-[22px] flex items-center justify-center bg-slate-100 dark:bg-[#1a1a1c] hover:bg-indigo-100 dark:hover:bg-indigo-600/20 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 rounded border border-slate-200 dark:border-[#2d2d30] transition-colors cursor-pointer"
                                title="مشاهده جزئیات فاکتور"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                            </>
                          )}

                          {onDeleteFailure && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm('آیا از حذف این پرونده خرابی اطمینان دارید؟')) {
                                  onDeleteFailure(f.id);
                                }
                              }}
                              className="w-[22px] h-[22px] flex items-center justify-center bg-slate-100 dark:bg-[#1a1a1c] hover:bg-rose-100 dark:hover:bg-rose-600/20 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded border border-slate-200 dark:border-[#2d2d30] transition-colors cursor-pointer"
                              title="حذف پرونده"
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
          totalItems={sortedFailures.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>
        </motion.div>
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* ۲. مدال مشاهده جزئیات پرونده و فاکتور نهایی (کاملاً هماهنگ با سرویس دوره‌ای) */}
      {/* ========================================================================= */}
      {viewDetailsFailure && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {(() => {
              const v = vehicles.find(veh => String(veh.id) === String(viewDetailsFailure.vehicleId) || Number(veh.id) === Number(viewDetailsFailure.vehicleId));
              const wf = workflows.find(w => w.failureId === viewDetailsFailure.id);
              const mech = mechanics.find(m => m.id === wf?.technicianId);
              const isInRepair = viewDetailsFailure.status === 'in_repair';

              return (
                <>
                  {/* هدر مدال هماهنگ با سرویس دوره‌ای */}
                  <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
                        <Eye className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                          <span>جزئیات کامل پرونده تعمیرات و فاکتور</span>
                          <span className="text-xs font-mono font-normal text-slate-500 dark:text-slate-400">
                            (شماره پرونده: #{toPersianDigits(viewDetailsFailure.id)})
                          </span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                            isInRepair
                              ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                              : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                          }`}>
                            {isInRepair ? 'در حال تعمیر' : 'آماده شده و ترخیص'}
                          </span>
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                          تاریخ پذیرش: {toJalaliDate(viewDetailsFailure.failureDate)} {wf?.endDate ? `| تاریخ ترخیص: ${toJalaliDate(wf.endDate)}` : ''} | کارکرد ثبت‌شده: {formatNumber(viewDetailsFailure.odometer || v?.currentKm || 0)} کیلومتر
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setViewDetailsFailure(null)} 
                      className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* بدنه اسکرول‌پذیر با کارت‌های منظم و شیک */}
                  <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
                    {/* ۱. کارت اطلاعات کلی خودرو و نوبت مراجعه */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/80 dark:bg-[#161618]/80 p-4 rounded-xl border border-slate-200 dark:border-[#2d2d30]">
                      <div>
                        <span className="text-slate-500 text-[11px] block mb-0.5">نام خودرو:</span>
                        <strong className="text-slate-900 dark:text-white font-extrabold text-sm">
                          {v ? `${v.name} - پلاک [${toPersianDigits(v.plaque)}]` : (viewDetailsFailure.plaque ? `پلاک [${toPersianDigits(viewDetailsFailure.plaque)}]` : '—')}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[11px] block mb-0.5">شماره پلاک:</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                          {v?.plaque ? toPersianDigits(v.plaque) : (viewDetailsFailure.plaque ? toPersianDigits(viewDetailsFailure.plaque) : '---')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[11px] block mb-0.5">نام راننده:</span>
                        <span className="text-slate-800 dark:text-slate-200 font-medium">
                          {viewDetailsFailure.driverName || v?.driverName || '---'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[11px] block mb-0.5">شرکت:</span>
                        <span className="text-slate-800 dark:text-slate-200 font-medium">
                          {viewDetailsFailure.company || v?.company || '---'}
                        </span>
                      </div>
                    </div>

                    {/* ۲. کارت اطلاعات تعمیرگاه و مرکز خدمات */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-indigo-50/50 dark:bg-indigo-950/20 p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-500/20">
                      <div>
                        <span className="text-slate-500 text-[11px] block mb-0.5">تعمیرکار / مرکز خدمات:</span>
                        <strong className="text-indigo-900 dark:text-indigo-200 font-bold text-xs leading-relaxed block">
                          {getFailureMechanicsDisplay(viewDetailsFailure, wf)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[11px] block mb-0.5">اجرت و دستمزد تعمیرات:</span>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                          {(wf?.wages || viewDetailsFailure.wages || 0) > 0 ? `${formatPrice(wf?.wages || viewDetailsFailure.wages || 0)} ریال` : '---'}
                        </span>
                      </div>
                    </div>

                    {/* ۳. شرح کامل نقص فنی و اقدامات */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 border-r-2 border-indigo-500 pr-2">
                        <FileText className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                          شرح کامل نقص فنی و خرابی‌های ثبت‌شده:
                        </span>
                      </div>
                      
                      {viewDetailsFailure.failureItems && viewDetailsFailure.failureItems.length > 0 ? (
                        <div className="border border-slate-200 dark:border-[#2d2d30] rounded-xl overflow-hidden">
                          <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                            <thead className="bg-slate-50 dark:bg-[#161618] text-slate-600 dark:text-slate-400 font-medium text-xs border-b border-slate-200 dark:border-[#2d2d30]">
                              <tr>
                                <th className="py-2 px-3 text-center w-8 text-xs font-mono font-bold">#</th>
                                <th className="py-2 px-3 text-xs font-bold">نوع خرابی</th>
                                <th className="py-2 px-3 text-xs font-bold">دسته</th>
                                <th className="py-2 px-3 text-xs font-bold">تعمیرکار منتسب</th>
                                <th className="py-2 px-3 text-xs font-bold">شرح / توضیحات نقص</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                              {viewDetailsFailure.failureItems.map((fi, idx) => {
                                const rowMech = mechanics.find(m => m.id === fi.mechanicId);
                                const primaryId = wf?.technicianId ?? viewDetailsFailure.assignedMechanicId;
                                const defaultMech = primaryId !== undefined ? mechanics.find(m => m.id === primaryId) : undefined;
                                const effectiveMech = rowMech || defaultMech;
                                return (
                                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-[#1a1a1c]/40 text-[11px]">
                                    <td className="py-2 px-3 text-center text-slate-400 font-mono font-bold">{toPersianDigits(idx + 1)}</td>
                                    <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">{fi.failureType || '—'}</td>
                                    <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{fi.category || '—'}</td>
                                    <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                                      {effectiveMech ? (effectiveMech.shopName ? `${effectiveMech.name} (${effectiveMech.shopName})` : effectiveMech.name) : '—'}
                                    </td>
                                    <td className="py-2 px-3 text-slate-800 dark:text-slate-200">{fi.description || '—'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="bg-slate-50 dark:bg-[#161618] border border-slate-200 dark:border-[#2d2d30] rounded-xl p-3 text-slate-800 dark:text-slate-200 leading-relaxed text-xs">
                          {viewDetailsFailure.description || 'توضیحاتی ثبت نشده است.'}
                        </div>
                      )}
                    </div>

                    {/* ۴. جدول ریز قطعات مصرفی و خدمات فاکتور */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 border-r-2 border-indigo-500 pr-2">
                          <Wrench className="w-3.5 h-3.5 text-indigo-500" />
                          <span>ریز قطعات مصرفی و خدمات صورت‌گرفته</span>
                        </span>
                      </div>

                      {((wf?.partsUsed && Object.keys(wf.partsUsed).length > 0) || (wf?.shopPartsUsed && wf.shopPartsUsed.length > 0)) ? (
                        <div className="space-y-3">
                          {/* قطعات انبار شرکت */}
                          {wf?.partsUsed && Object.keys(wf.partsUsed).length > 0 && (
                            <div className="border border-slate-200 dark:border-[#2d2d30] rounded-xl overflow-hidden">
                              <div className="bg-slate-100 dark:bg-[#1a1a1e] p-2.5 flex items-center justify-between border-b border-slate-200 dark:border-[#2d2d30]">
                                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-xs">
                                  <Package className="w-4 h-4 text-indigo-500" />
                                  <span>قطعات تأمین‌شده از انبار مرکزی شرکت</span>
                                </div>
                                <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 font-bold">
                                  {toPersianDigits(Object.keys(wf.partsUsed).length)} قلم کالا
                                </span>
                              </div>
                              <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                                <thead className="bg-slate-50 dark:bg-[#161618] text-slate-600 dark:text-slate-400 font-medium text-xs border-b border-slate-200 dark:border-[#2d2d30]">
                                  <tr>
                                    <th className="py-2 px-3 text-xs font-medium">نام قطعه</th>
                                    <th className="py-2 px-3 text-center w-24 text-xs font-medium">تعداد</th>
                                    <th className="py-2 px-3 text-left w-36 text-xs font-medium">بهای واحد (ریال)</th>
                                    <th className="py-2 px-3 text-left w-36 text-xs font-medium">جمع ردیف (ریال)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                                  {Object.entries(wf.partsUsed).map(([name, qty]) => {
                                    const partObj = parts.find(p => p.partName === name);
                                    const count = Number(qty) || 0;
                                    const unitPrice = partObj?.unitPrice || 0;
                                    const rowCost = unitPrice * count;
                                    return (
                                      <tr key={name} className="hover:bg-slate-50/50 dark:hover:bg-[#1a1a1c]/40 text-[11px]">
                                        <td className="py-1.5 px-3 text-slate-900 dark:text-white">{name}</td>
                                        <td className="py-1.5 px-3 text-center text-slate-700 dark:text-slate-300">{toPersianDigits(count)}</td>
                                        <td className="py-1.5 px-3 text-left text-slate-600 dark:text-slate-400">{unitPrice > 0 ? formatPrice(unitPrice) : '---'}</td>
                                        <td className="py-1.5 px-3 text-left text-slate-800 dark:text-slate-200">{rowCost > 0 ? formatPrice(rowCost) : '---'}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* قطعات تأمین‌شده توسط تعمیرگاه */}
                          {wf?.shopPartsUsed && wf.shopPartsUsed.length > 0 && (
                            <div className="border border-slate-200 dark:border-[#2d2d30] rounded-xl overflow-hidden">
                              <div className="bg-slate-100 dark:bg-[#1a1a1e] p-2.5 flex items-center justify-between border-b border-slate-200 dark:border-[#2d2d30]">
                                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-medium text-xs">
                                  <Wrench className="w-4 h-4 text-indigo-500" />
                                  <span>قطعات تأمین‌شده توسط تعمیرگاه (خرید آزاد)</span>
                                </div>
                                <span className="text-[10px] text-slate-600 dark:text-slate-400">
                                  {toPersianDigits(wf.shopPartsUsed.length)} قلم کالا
                                </span>
                              </div>
                              <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                                <thead className="bg-slate-50 dark:bg-[#161618] text-slate-600 dark:text-slate-400 font-medium text-xs border-b border-slate-200 dark:border-[#2d2d30]">
                                  <tr>
                                    <th className="py-2 px-3 text-xs font-medium">نام قطعه</th>
                                    <th className="py-2 px-3 text-center w-24 text-xs font-medium">تعداد</th>
                                    <th className="py-2 px-3 text-left w-36 text-xs font-medium">بهای واحد (ریال)</th>
                                    <th className="py-2 px-3 text-left w-36 text-xs font-medium">جمع ردیف (ریال)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                                  {wf.shopPartsUsed.map((sp, idx) => {
                                    const count = Number(sp.quantity) || 1;
                                    const unitPrice = sp.unitPrice || 0;
                                    const rowCost = sp.totalPrice || (count * unitPrice);
                                    return (
                                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-[#1a1a1c]/40 text-[11px]">
                                        <td className="py-1.5 px-3 text-slate-900 dark:text-white">{sp.name}</td>
                                        <td className="py-1.5 px-3 text-center text-slate-700 dark:text-slate-300">{toPersianDigits(count)}</td>
                                        <td className="py-1.5 px-3 text-left text-slate-600 dark:text-slate-400">{unitPrice > 0 ? formatPrice(unitPrice) : '---'}</td>
                                        <td className="py-1.5 px-3 text-left text-slate-800 dark:text-slate-200">{rowCost > 0 ? formatPrice(rowCost) : '---'}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-3 bg-slate-50 dark:bg-[#161618] rounded-xl border border-slate-200 dark:border-[#2d2d30] flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                            <Receipt className="w-4 h-4 text-slate-400" />
                            <span>وضعیت قطعات مصرفی:</span>
                          </div>
                          <span className="px-2.5 py-1 bg-slate-100 dark:bg-[#202024] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#2d2d30] rounded-lg font-bold text-[11px]">
                            تعمیر بدون کسر مستقیم از انبار شرکت انجام شده است
                          </span>
                        </div>
                      )}
                    </div>

                    {/* ۵. وضعیت سطح رضایت از کار */}
                    {(() => {
                      const satisfaction = wf?.satisfactionLevel || viewDetailsFailure.satisfactionLevel;
                      if (!satisfaction) return null;
                      const opt = SATISFACTION_OPTIONS.find(o => o.id === satisfaction);
                      return (
                        <div className="bg-slate-50 dark:bg-[#161618] border border-slate-200 dark:border-[#2d2d30] p-3 rounded-xl flex justify-between items-center">
                          <span className="text-slate-600 dark:text-slate-400 text-xs font-bold">سطح رضایت از کیفیت کار و خدمات:</span>
                          <span className="px-3 py-1 rounded-lg bg-indigo-600 !text-white text-white font-bold text-xs shadow-2xs">
                            {opt?.label || satisfaction}
                          </span>
                        </div>
                      );
                    })()}

                    {/* ۶. کارت مالی جمع کل فاکتور هماهنگ با سرویس دوره‌ای */}
                    <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/20 p-4 rounded-xl flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-slate-700 dark:text-slate-300 font-bold text-xs">مبلغ کل فاکتور و صورت‌حساب تعمیرات:</span>
                        {(wf?.wages || viewDetailsFailure.wages || 0) > 0 && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            (شامل {formatPrice(wf?.wages || viewDetailsFailure.wages || 0)} ریال اجرت و دستمزد تخصصی)
                          </span>
                        )}
                      </div>
                      <div className="text-emerald-700 dark:text-emerald-400 font-mono font-black text-base">
                        {formatPrice(wf?.totalCost || viewDetailsFailure.totalCost || 0)} <span className="text-xs font-normal text-slate-600 dark:text-slate-400">ریال</span>
                      </div>
                    </div>
                  </div>

                  {/* فوتر مدال همراه دکمه‌های بستن، حذف و چاپ فاکتور */}
                  <div className="flex justify-between items-center p-4 border-t border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] shrink-0">
                    <div className="flex items-center gap-2">
                      {onDeleteFailure && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('آیا از حذف این پرونده تعمیرات اطمینان دارید؟')) {
                              onDeleteFailure(viewDetailsFailure.id);
                              setViewDetailsFailure(null);
                            }
                          }}
                          className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-lg border border-rose-200 dark:border-rose-500/30 transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>حذف پرونده</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          const fToEdit = viewDetailsFailure;
                          setViewDetailsFailure(null);
                          handleOpenReturnInvoiceModal(fToEdit);
                        }}
                        className="px-4 py-2 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-bold rounded-lg transition-colors border border-amber-200 dark:border-amber-800 text-xs cursor-pointer flex items-center gap-1.5"
                      >
                        <Receipt className="w-4 h-4" />
                        <span>ویرایش فاکتور</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrintRepairInvoice(viewDetailsFailure)}
                        className="px-4 py-2 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-300 font-bold rounded-lg transition-colors border border-slate-200 dark:border-[#2d2d30] text-xs cursor-pointer flex items-center gap-1.5"
                      >
                        <Printer className="w-4 h-4" />
                        <span>چاپ فاکتور</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewDetailsFailure(null)}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        بستن
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* مودال ثبت و تعریف دسته‌بندی نقص فنی جدید */}
      {isAddCategoryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 overflow-y-auto" dir="rtl">
          <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* هدر مدال */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-[#202024] rounded-lg border border-slate-200 dark:border-[#303035] shadow-xs">
                  <Tag className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-slate-900 dark:text-white text-sm font-bold">
                    ثبت دسته‌بندی نقص فنی جدید
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    افزودن به لیست گزینه‌های دسته‌بندی خرابی و ارجاع
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewCategoryName('');
                  setCategoryErrorMsg('');
                  setIsAddCategoryModalOpen(false);
                }}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* فرم مدال */}
            <form onSubmit={handleAddFailureCategory} className="p-4 sm:p-5 space-y-4 text-xs bg-white dark:bg-[#111113]">
              {categoryErrorMsg && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-700 dark:text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{categoryErrorMsg}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  عنوان دسته‌بندی <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="مثال: هیدرولیک و فرمان، سیستم خنک‌کاری، گیربکس اتوماتیک..."
                  value={newCategoryName}
                  onChange={(e) => {
                    setNewCategoryName(e.target.value);
                    if (categoryErrorMsg) setCategoryErrorMsg('');
                  }}
                  className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  autoFocus
                  required
                />
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  این دسته‌بندی در لیست ذخیره شده و بلافاصله برای این پرونده انتخاب خواهد شد.
                </p>
              </div>

              {/* دکمه‌های ثبت و انصراف */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-[#2d2d30]">
                <button
                  type="button"
                  onClick={() => {
                    setNewCategoryName('');
                    setCategoryErrorMsg('');
                    setIsAddCategoryModalOpen(false);
                  }}
                  className="px-4 py-2 border border-slate-300 dark:border-[#2d2d30] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a1a1c] font-bold rounded-lg transition-colors text-xs cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors shadow-xs active:scale-95 text-xs cursor-pointer"
                >
                  ثبت دسته‌بندی
                </button>
              </div>
            </form>
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
}
