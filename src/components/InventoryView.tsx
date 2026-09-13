/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Plus, Package, ArrowDownLeft, ArrowUpRight, History
} from 'lucide-react';
import { PartInventory, ServiceDefinition, InventoryTransaction, Vehicle } from '../types';
import { toPersianDigits, formatPrice, formatNumber } from '../utils/numberUtils';
import { sortData, SortDirection } from '../utils/sortUtils';
import { FilterMenuState, ColumnFilterMenu } from './TableFilterSort';
import { InventoryStockTable } from './inventory/InventoryStockTable';
import { InventoryKardexTable } from './inventory/InventoryKardexTable';
import { StockInModal, StockOutModal, PartFormModal } from './inventory/InventoryModals';
import { returnToOriginView, peekNavigationOrigin } from '../utils/navigation';

interface InventoryViewProps {
  parts: PartInventory[];
  vehicles?: Vehicle[];
  serviceDefinitions?: ServiceDefinition[];
  inventoryTransactions?: InventoryTransaction[];
  onAddPart: (part: Omit<PartInventory, 'id' | 'createdAt'>) => Promise<void>;
  onEditPart: (id: number, part: Partial<PartInventory>) => Promise<void>;
  onStockIn?: (data: { partId?: number | null; partName?: string; serviceType?: string; quantity: number; unitPrice?: number; buyPrice?: number; sellPrice?: number; warehouseLocation?: string; supplier?: string; invoiceNumber?: string; notes?: string }) => Promise<void>;
  onStockOut?: (data: { partId: number; quantity: number; vehicleId?: number; recipient?: string; reason?: string; notes?: string; buyPrice?: number; sellPrice?: number }) => Promise<void>;
  onEditInventoryTransaction?: (id: number, data: Partial<InventoryTransaction>) => Promise<void>;
}

export default function InventoryView({
  parts,
  vehicles = [],
  serviceDefinitions = [],
  inventoryTransactions = [],
  onAddPart,
  onEditPart,
  onStockIn,
  onStockOut,
  onEditInventoryTransaction
}: InventoryViewProps) {
  // ۲ تسک درخواستی کاربر: موجودی انبار و کاردکس کالا
  const [activeTab, setActiveTab] = useState<'inventory' | 'kardex'>('inventory');

  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string>('partName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // وضعیت‌های مدال
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartId, setEditingPartId] = useState<number | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);

  // مدال ورود کالا
  const [isStockInModalOpen, setIsStockInModalOpen] = useState(false);
  const [isNewPartMode, setIsNewPartMode] = useState(false);
  const [newPartName, setNewPartName] = useState('');
  const [stockInPartId, setStockInPartId] = useState<number | null>(null);
  const [stockInQuantity, setStockInQuantity] = useState<number>(10);
  const [stockInBuyPrice, setStockInBuyPrice] = useState<number>(0);
  const [stockInSellPrice, setStockInSellPrice] = useState<number>(0);
  const [stockInWarehouseLocation, setStockInWarehouseLocation] = useState('');
  const [stockInSupplier, setStockInSupplier] = useState('');
  const [stockInInvoice, setStockInInvoice] = useState('');
  const [stockInNotes, setStockInNotes] = useState('');

  // مدال خروج کالا
  const [isStockOutModalOpen, setIsStockOutModalOpen] = useState(false);
  const [stockOutPartId, setStockOutPartId] = useState<number | null>(null);
  const [stockOutQuantity, setStockOutQuantity] = useState<number>(1);
  const [stockOutBuyPrice, setStockOutBuyPrice] = useState<number>(0);
  const [stockOutSellPrice, setStockOutSellPrice] = useState<number>(0);
  const [stockOutVehicleId, setStockOutVehicleId] = useState<number | null>(null);
  const [stockOutRecipient, setStockOutRecipient] = useState('');
  const [stockOutReason, setStockOutReason] = useState('');
  const [stockOutNotes, setStockOutNotes] = useState('');

  // فیلدهای فرم ثبت/ویرایش کالا
  const [partName, setPartName] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [minQuantity, setMinQuantity] = useState<number>(5);
  const [buyPrice, setBuyPrice] = useState<number>(0);
  const [sellPrice, setSellPrice] = useState<number>(0);
  const [warehouseLocation, setWarehouseLocation] = useState('');

  const defaultServicePresets = [
    'تعویض روغن موتور و فیلترها',
    'تعویض فیلتر کابین و بنزین',
    'تعویض تسمه تایم و هرزگردها',
    'تعویض لنت ترمز جلو',
    'تعویض لنت ترمز عقب',
    'تعویض شمع و وایر موتور',
    'سرویس واسکازین و روغن گیربکس',
    'تعویض ضدیخ و مایع خنک‌کننده',
    'بازدید و تعویض باتری و برق',
    'بازدید و تعویض لاستیک‌ها'
  ];

  const availableServiceOptions = Array.from(new Set([
    ...serviceDefinitions.map(s => s.serviceType),
    ...defaultServicePresets
  ]));

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const [isNavigatedFromOrigin, setIsNavigatedFromOrigin] = useState(false);

  const handleOpenCreateForm = () => {
    setEditingPartId(null);
    setEditingTransactionId(null);
    setPartName('');
    setServiceType(availableServiceOptions[0] || 'تعویض روغن موتور و فیلترها');
    setMinQuantity(5);
    setBuyPrice(0);
    setSellPrice(0);
    setWarehouseLocation('');
    setIsModalOpen(true);
  };

  useEffect(() => {
    const handleOpenEvent = (e: any) => {
      if (e.detail?.entityType === 'part') {
        setIsNavigatedFromOrigin(Boolean(e.detail?.fromView || peekNavigationOrigin()));
        handleOpenCreateForm();
      }
    };
    window.addEventListener('app:open-create-form', handleOpenEvent);
    return () => window.removeEventListener('app:open-create-form', handleOpenEvent);
  }, [availableServiceOptions]);

  const handleCloseOrReturn = () => {
    setIsModalOpen(false);
    if (isNavigatedFromOrigin || peekNavigationOrigin()) {
      setIsNavigatedFromOrigin(false);
      returnToOriginView();
    }
  };

  const handleOpenEditForm = (p: PartInventory) => {
    setIsNavigatedFromOrigin(false);
    setEditingPartId(p.id);
    setEditingTransactionId(null);
    setPartName(p.partName);
    setServiceType(p.serviceType || availableServiceOptions[0] || '');
    setMinQuantity(p.minQuantity);
    const bPrice = p.buyPrice !== undefined ? p.buyPrice : (p.unitPrice || 0);
    const sPrice = p.sellPrice !== undefined ? p.sellPrice : Math.round(bPrice * 1.25);
    setBuyPrice(bPrice);
    setSellPrice(sPrice);
    setWarehouseLocation(p.warehouseLocation || '');
    setIsModalOpen(true);
  };

  const handleOpenStockIn = (p?: PartInventory) => {
    setEditingTransactionId(null);
    setIsNewPartMode(false);
    setNewPartName('');
    const targetPart = p || parts[0];
    if (targetPart) {
      const bPrice = targetPart.buyPrice !== undefined ? targetPart.buyPrice : (targetPart.unitPrice || 0);
      const sPrice = targetPart.sellPrice !== undefined ? targetPart.sellPrice : Math.round(bPrice * 1.25);
      setStockInPartId(targetPart.id);
      setStockInBuyPrice(bPrice);
      setStockInSellPrice(sPrice);
      setStockInWarehouseLocation(targetPart.warehouseLocation || '');
    } else {
      setStockInPartId(null);
      setStockInBuyPrice(0);
      setStockInSellPrice(0);
      setStockInWarehouseLocation('');
    }
    setStockInQuantity(10);
    setStockInSupplier('');
    setStockInInvoice('');
    setStockInNotes('');
    setIsStockInModalOpen(true);
  };

  const handleOpenStockOut = (p?: PartInventory) => {
    setEditingTransactionId(null);
    const targetPart = p || parts[0];
    if (targetPart) {
      const bPrice = targetPart.buyPrice !== undefined ? targetPart.buyPrice : (targetPart.unitPrice || 0);
      const sPrice = targetPart.sellPrice !== undefined ? targetPart.sellPrice : Math.round(bPrice * 1.25);
      setStockOutPartId(targetPart.id);
      setStockOutBuyPrice(bPrice);
      setStockOutSellPrice(sPrice);
    } else {
      setStockOutPartId(null);
      setStockOutBuyPrice(0);
      setStockOutSellPrice(0);
    }
    setStockOutQuantity(1);
    setStockOutVehicleId(vehicles.length > 0 ? vehicles[0].id : null);
    setStockOutRecipient('');
    setStockOutReason('');
    setStockOutNotes('');
    setIsStockOutModalOpen(true);
  };

  // باز کردن مودال ویرایش دقیق عملیات انجام شده در کاردکس
  const handleOpenEditTransaction = (t: InventoryTransaction) => {
    setEditingTransactionId(t.id);
    const targetPart = parts.find(p => (t.partId && p.id === t.partId) || p.partName === t.partName);

    if (t.type === 'in') {
      setIsNewPartMode(false);
      setNewPartName('');
      setStockInPartId(targetPart ? targetPart.id : (t.partId || null));
      setStockInQuantity(t.quantity || 1);
      const bPrice = t.buyPrice ?? t.unitPrice ?? (targetPart?.buyPrice ?? targetPart?.unitPrice ?? 0);
      const sPrice = t.sellPrice ?? (targetPart?.sellPrice ?? (bPrice ? Math.round(bPrice * 1.25) : 0));
      setStockInBuyPrice(bPrice);
      setStockInSellPrice(sPrice);
      setStockInWarehouseLocation(targetPart?.warehouseLocation || '');
      setStockInSupplier(t.recipientOrSupplier || '');
      setStockInInvoice(t.reference?.replace('فاکتور خرید ', '').replace('فاکتور شماره ', '') || '');
      setStockInNotes(t.notes || '');
      setIsStockInModalOpen(true);
    } else {
      setStockOutPartId(targetPart ? targetPart.id : (t.partId || null));
      setStockOutQuantity(t.quantity || 1);
      const bPrice = t.buyPrice ?? (targetPart?.buyPrice ?? targetPart?.unitPrice ?? 0);
      const sPrice = t.sellPrice ?? t.unitPrice ?? (targetPart?.sellPrice ?? (bPrice ? Math.round(bPrice * 1.25) : 0));
      setStockOutBuyPrice(bPrice);
      setStockOutSellPrice(sPrice);
      setStockOutVehicleId(t.vehicleId || null);
      setStockOutRecipient(t.recipientOrSupplier || '');
      setStockOutReason(t.reference || '');
      setStockOutNotes(t.notes || '');
      setIsStockOutModalOpen(true);
    }
  };

  const handleSubmitPart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partName.trim()) {
      alert('لطفاً نام قطعه یا کالا را وارد کنید.');
      return;
    }

    const currentEditingPart = editingPartId ? parts.find(p => p.id === editingPartId) : null;
    const generatedSku = currentEditingPart?.sku || `SKU-${Math.floor(100 + Math.random() * 900)}-${Math.floor(10 + Math.random() * 90)}`;
    const currentQuantity = currentEditingPart ? currentEditingPart.quantity : 0;

    const finalBuyPrice = Number(buyPrice) || 0;
    const finalSellPrice = sellPrice !== undefined && sellPrice > 0 ? Number(sellPrice) : Math.round(finalBuyPrice * 1.25);

    const payload = {
      partName: partName.trim(),
      sku: generatedSku,
      serviceCategory: 'عمومی',
      serviceType: serviceType || 'عمومی',
      quantity: currentQuantity,
      minQuantity: Number(minQuantity) || 0,
      unitPrice: finalBuyPrice,
      buyPrice: finalBuyPrice,
      sellPrice: finalSellPrice,
      warehouseLocation: warehouseLocation.trim()
    };

    try {
      if (editingPartId) {
        await onEditPart(editingPartId, payload);
      } else {
        await onAddPart(payload);
      }
      handleCloseOrReturn();
    } catch (err) {
      console.error(err);
      alert('خطا در ثبت قطعه');
    }
  };

  const handleSubmitStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNewPartMode && !stockInPartId) {
      alert('لطفاً کالا را انتخاب کنید.');
      return;
    }
    if (isNewPartMode && !newPartName.trim()) {
      alert('لطفاً نام قطعه جدید را وارد نمایید.');
      return;
    }
    if (!stockInQuantity || stockInQuantity <= 0) {
      alert('لطفاً تعداد ورودی معتبر وارد نمایید.');
      return;
    }
    if (stockInBuyPrice === undefined || stockInBuyPrice < 0) {
      alert('لطفاً قیمت خرید واحد جدید را وارد نمایید.');
      return;
    }

    const finalSellPrice = stockInSellPrice !== undefined && stockInSellPrice > 0 
      ? Number(stockInSellPrice) 
      : Math.round(stockInBuyPrice * 1.25);

    try {
      if (editingTransactionId) {
        const targetPart = !isNewPartMode ? parts.find(p => p.id === stockInPartId) : null;
        const payload = {
          partId: isNewPartMode ? undefined : (stockInPartId || undefined),
          partName: targetPart?.partName || (isNewPartMode ? newPartName.trim() : 'قطعه'),
          quantity: stockInQuantity,
          unitPrice: stockInBuyPrice,
          buyPrice: stockInBuyPrice,
          sellPrice: finalSellPrice,
          totalPrice: stockInQuantity * stockInBuyPrice,
          recipientOrSupplier: stockInSupplier.trim() || 'تامین‌کننده کالا',
          reference: stockInInvoice.trim() ? `فاکتور خرید ${stockInInvoice.trim()}` : 'رسید ورود به انبار',
          notes: stockInNotes.trim()
        };
        if (onEditInventoryTransaction) {
          await onEditInventoryTransaction(editingTransactionId, payload);
        } else {
          await fetch(`/api/inventory-transactions/${editingTransactionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }
        if (targetPart && stockInWarehouseLocation.trim() && targetPart.warehouseLocation !== stockInWarehouseLocation.trim()) {
          await onEditPart(targetPart.id, { ...targetPart, warehouseLocation: stockInWarehouseLocation.trim() });
        }
      } else if (onStockIn) {
        await onStockIn({
          partId: isNewPartMode ? null : stockInPartId,
          partName: isNewPartMode ? newPartName.trim() : undefined,
          serviceType: 'عمومی',
          quantity: stockInQuantity,
          unitPrice: stockInBuyPrice,
          buyPrice: stockInBuyPrice,
          sellPrice: finalSellPrice,
          warehouseLocation: stockInWarehouseLocation.trim(),
          supplier: stockInSupplier.trim(),
          invoiceNumber: stockInInvoice.trim(),
          notes: stockInNotes.trim()
        });
      }
      setIsStockInModalOpen(false);
      setIsNewPartMode(false);
      setNewPartName('');
      setEditingTransactionId(null);
    } catch (err) {
      console.error(err);
      alert('خطا در ثبت ورود کالا به انبار');
    }
  };

  const handleSubmitStockOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockOutPartId) {
      alert('لطفاً کالا را انتخاب کنید.');
      return;
    }
    const part = parts.find(p => p.id === stockOutPartId);
    if (!part) return;

    if (!stockOutQuantity || stockOutQuantity <= 0) {
      alert('لطفاً تعداد خروجی معتبر وارد نمایید.');
      return;
    }

    const finalBuyPrice = stockOutBuyPrice || part.buyPrice || part.unitPrice || 0;
    const finalSellPrice = stockOutSellPrice || part.sellPrice || (finalBuyPrice ? Math.round(finalBuyPrice * 1.25) : 0);

    try {
      if (editingTransactionId) {
        let vehicleLabel = '';
        if (stockOutVehicleId) {
          const v = vehicles.find(veh => veh.id === stockOutVehicleId);
          if (v) vehicleLabel = `خودرو ${v.name} (${v.plaque})`;
        }
        const payload = {
          partId: stockOutPartId,
          partName: part.partName,
          quantity: stockOutQuantity,
          unitPrice: finalSellPrice,
          buyPrice: finalBuyPrice,
          sellPrice: finalSellPrice,
          totalPrice: stockOutQuantity * finalSellPrice,
          vehicleId: stockOutVehicleId || undefined,
          recipientOrSupplier: stockOutRecipient.trim() || vehicleLabel || 'تحویل‌گیرنده کالا',
          reference: stockOutReason.trim() || (vehicleLabel ? `مصرف در ${vehicleLabel}` : 'حواله خروج از انبار'),
          notes: stockOutNotes.trim()
        };
        if (onEditInventoryTransaction) {
          await onEditInventoryTransaction(editingTransactionId, payload);
        } else {
          await fetch(`/api/inventory-transactions/${editingTransactionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }
      } else {
        if (stockOutQuantity > part.quantity) {
          alert(`موجودی انبار کافی نیست! موجودی فعلی: ${part.quantity} عدد`);
          return;
        }
        if (onStockOut) {
          await onStockOut({
            partId: stockOutPartId,
            quantity: stockOutQuantity,
            buyPrice: finalBuyPrice,
            sellPrice: finalSellPrice,
            vehicleId: stockOutVehicleId || undefined,
            recipient: stockOutRecipient.trim(),
            reason: stockOutReason.trim(),
            notes: stockOutNotes.trim()
          });
        }
      }
      setIsStockOutModalOpen(false);
      setEditingTransactionId(null);
    } catch (err) {
      console.error(err);
      alert('خطا در ثبت خروج کالا از انبار');
    }
  };

  // فیلترهای سبک اکسل ستون‌ها
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [filterMenu, setFilterMenu] = useState<FilterMenuState | null>(null);

  const getPartColValue = (p: PartInventory, colKey: string): string => {
    if (colKey === 'partName') return p.partName;
    if (colKey === 'serviceType') return p.serviceType || 'نامشخص';
    if (colKey === 'warehouseLocation') return p.warehouseLocation || 'تعیین‌نشده';
    if (colKey === 'buyPrice' || colKey === 'unitPrice') return formatPrice(p.buyPrice ?? p.unitPrice ?? 0);
    if (colKey === 'sellPrice') return formatPrice(p.sellPrice ?? Math.round((p.buyPrice ?? p.unitPrice ?? 0) * 1.25));
    if (colKey === 'quantity') return `${p.quantity} عدد`;
    if (colKey === 'totalSellPrice') return `${formatPrice(p.quantity * (p.sellPrice ?? Math.round((p.buyPrice ?? p.unitPrice ?? 0) * 1.25)))} ریال`;
    if (colKey === 'status') {
      if (p.quantity === 0) return 'اتمام موجودی';
      if (p.quantity <= p.minQuantity) return 'کسری / سفارش';
      return 'موجود';
    }
    return String((p as any)[colKey] ?? '-');
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
    parts.forEach(p => {
      const val = getPartColValue(p, filterMenu.colKey);
      valMap.set(val, (valMap.get(val) || 0) + 1);
    });
    return Array.from(valMap.entries()).map(([value, count]) => ({ value, count }));
  }, [filterMenu, parts]);

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

  const handleResetFilters = () => {
    setSearchTerm('');
    setColumnFilters({});
    setCurrentPage(1);
  };

  const hasActiveFilters = Object.keys(columnFilters).length > 0 || searchTerm !== '';

  const filteredParts = useMemo(() => {
    return parts.filter(p => {
      const matchesSearch = 
        p.partName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.serviceType && p.serviceType.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.warehouseLocation && p.warehouseLocation.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      for (const [key, selectedVals] of Object.entries(columnFilters)) {
        if (!selectedVals || !Array.isArray(selectedVals)) continue;
        const val = getPartColValue(p, key);
        if (!selectedVals.includes(val)) return false;
      }

      return true;
    });
  }, [parts, searchTerm, columnFilters]);

  const sortedParts = useMemo(() => {
    return sortData(filteredParts, sortKey, sortDirection, {
      totalSellPrice: (p: PartInventory) => p.quantity * (p.sellPrice ?? Math.round((p.buyPrice ?? p.unitPrice ?? 0) * 1.25))
    });
  }, [filteredParts, sortKey, sortDirection]);

  const totalPages = Math.ceil(sortedParts.length / pageSize) || 1;
  const paginatedParts = useMemo(() => {
    return sortedParts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [sortedParts, currentPage, pageSize]);

  // شاخص‌های کلیدی آماری
  const totalBuyValue = useMemo(() => parts.reduce((acc, p) => acc + (p.quantity * (p.buyPrice ?? p.unitPrice ?? 0)), 0), [parts]);
  const totalSellValue = useMemo(() => parts.reduce((acc, p) => acc + (p.quantity * (p.sellPrice ?? Math.round((p.buyPrice ?? p.unitPrice ?? 0) * 1.25))), 0), [parts]);
  const totalItemsCount = useMemo(() => parts.reduce((acc, p) => acc + p.quantity, 0), [parts]);
  const lowStockCount = useMemo(() => parts.filter(p => p.quantity <= p.minQuantity && p.quantity > 0).length, [parts]);
  const outOfStockCount = useMemo(() => parts.filter(p => p.quantity === 0).length, [parts]);

  // حالت تمام‌صفحه ثبت ورود کالا به انبار
  if (isStockInModalOpen) {
    return (
      <StockInModal
        isOpen={isStockInModalOpen}
        onClose={() => {
          setIsStockInModalOpen(false);
          setEditingTransactionId(null);
        }}
        parts={parts}
        stockInPartId={stockInPartId}
        setStockInPartId={setStockInPartId}
        stockInQuantity={stockInQuantity}
        setStockInQuantity={setStockInQuantity}
        stockInBuyPrice={stockInBuyPrice}
        setStockInBuyPrice={setStockInBuyPrice}
        stockInSellPrice={stockInSellPrice}
        setStockInSellPrice={setStockInSellPrice}
        stockInWarehouseLocation={stockInWarehouseLocation}
        setStockInWarehouseLocation={setStockInWarehouseLocation}
        stockInSupplier={stockInSupplier}
        setStockInSupplier={setStockInSupplier}
        stockInInvoice={stockInInvoice}
        setStockInInvoice={setStockInInvoice}
        stockInNotes={stockInNotes}
        setStockInNotes={setStockInNotes}
        isNewPartMode={isNewPartMode}
        setIsNewPartMode={setIsNewPartMode}
        newPartName={newPartName}
        setNewPartName={setNewPartName}
        isEditing={!!editingTransactionId}
        onSubmit={handleSubmitStockIn}
      />
    );
  }

  // حالت تمام‌صفحه ثبت حواله خروج از انبار
  if (isStockOutModalOpen) {
    return (
      <StockOutModal
        isOpen={isStockOutModalOpen}
        onClose={() => {
          setIsStockOutModalOpen(false);
          setEditingTransactionId(null);
        }}
        parts={parts}
        vehicles={vehicles}
        stockOutPartId={stockOutPartId}
        setStockOutPartId={setStockOutPartId}
        stockOutQuantity={stockOutQuantity}
        setStockOutQuantity={setStockOutQuantity}
        stockOutBuyPrice={stockOutBuyPrice}
        setStockOutBuyPrice={setStockOutBuyPrice}
        stockOutSellPrice={stockOutSellPrice}
        setStockOutSellPrice={setStockOutSellPrice}
        stockOutVehicleId={stockOutVehicleId}
        setStockOutVehicleId={setStockOutVehicleId}
        stockOutRecipient={stockOutRecipient}
        setStockOutRecipient={setStockOutRecipient}
        stockOutReason={stockOutReason}
        setStockOutReason={setStockOutReason}
        stockOutNotes={stockOutNotes}
        setStockOutNotes={setStockOutNotes}
        isEditing={!!editingTransactionId}
        onSubmit={handleSubmitStockOut}
      />
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      
      {/* هدر بخش انبارداری با دکمه‌های اقدام سریع */}
      <div className="bg-white dark:bg-[#111113] p-4 rounded-lg border border-slate-200 dark:border-[#2d2d30] shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              انبار قطعات یدکی، کاردکس و مدیریت موجودی و قیمت‌گذاری
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              کنترل ورود و خروج کالا، ثبت نرخ‌های خرید و فروش، دفتر کاردکس و گزارش‌های تحلیلی کسری انبار
            </p>
          </div>

          {/* دکمه‌های عملیاتی انبار */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenStockIn()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>ورود کالا به انبار</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenStockOut()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>حواله خروج از انبار</span>
            </button>
          </div>
        </div>
      </div>

      {/* تسک‌های سه‌گانه انبارداری (جایگزین تب‌ها طبق درخواست کاربر) */}
      <div className="flex border-b border-slate-200 dark:border-[#2d2d30] gap-2 overflow-x-auto relative">
        {/* تسک ۱: موجودی انبار */}
        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'inventory'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>موجودی انبار</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300">
            {toPersianDigits(parts.length)}
          </span>
          {activeTab === 'inventory' && (
            <motion.div
              layoutId="activeInventoryTabIndicator"
              className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>

        {/* تسک ۲: کاردکس کالا */}
        <button
          type="button"
          onClick={() => setActiveTab('kardex')}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'kardex'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          <span>کاردکس کالا</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300">
            {toPersianDigits(inventoryTransactions.length)}
          </span>
          {activeTab === 'kardex' && (
            <motion.div
              layoutId="activeInventoryTabIndicator"
              className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>
      </div>

      {/* نمایش محتوای تسک فعال */}
      {activeTab === 'inventory' && (
        <InventoryStockTable
          parts={parts}
          sortedParts={sortedParts}
          paginatedParts={paginatedParts}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          columnFilters={columnFilters}
          onOpenFilterMenu={handleOpenFilterMenu}
          onResetFilters={handleResetFilters}
          hasActiveFilters={hasActiveFilters}
          totalSellValue={totalSellValue}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          onOpenStockIn={handleOpenStockIn}
          onOpenStockOut={handleOpenStockOut}
          onOpenEditForm={handleOpenEditForm}
          onEditPart={onEditPart}
        />
      )}

      {activeTab === 'kardex' && (
        <InventoryKardexTable
          transactions={inventoryTransactions}
          parts={parts}
          vehicles={vehicles}
          onOpenEditPart={handleOpenEditForm}
          onOpenEditTransaction={handleOpenEditTransaction}
        />
      )}

      {/* مدال ۳: تعریف / ویرایش مشخصات کالا */}
      <PartFormModal
        isOpen={isModalOpen}
        onClose={handleCloseOrReturn}
        isNavigated={isNavigatedFromOrigin || Boolean(peekNavigationOrigin())}
        editingPartId={editingPartId}
        partName={partName}
        setPartName={setPartName}
        serviceType={serviceType}
        setServiceType={setServiceType}
        availableServiceOptions={availableServiceOptions}
        buyPrice={buyPrice}
        setBuyPrice={setBuyPrice}
        sellPrice={sellPrice}
        setSellPrice={setSellPrice}
        minQuantity={minQuantity}
        setMinQuantity={setMinQuantity}
        warehouseLocation={warehouseLocation}
        setWarehouseLocation={setWarehouseLocation}
        onSubmit={handleSubmitPart}
      />

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
