import React from 'react';
import { X, ArrowDownLeft, ArrowUpRight, Package, TrendingUp } from 'lucide-react';
import { PartInventory, Vehicle } from '../../types';
import { toPersianDigits, formatPrice, formatNumber, parsePersianNumber } from '../../utils/numberUtils';
import { CustomSelect } from '../CustomSelect';

// ----------------------------------------------------
// مدال ورود کالا (رسید خرید و بروزرسانی قیمت‌ها)
// ----------------------------------------------------
interface StockInModalProps {
  isOpen: boolean;
  onClose: () => void;
  parts: PartInventory[];
  stockInPartId: number | null;
  setStockInPartId: (id: number | null) => void;
  stockInQuantity: number;
  setStockInQuantity: (qty: number) => void;
  stockInBuyPrice: number;
  setStockInBuyPrice: (price: number) => void;
  stockInSellPrice: number;
  setStockInSellPrice: (price: number) => void;
  stockInWarehouseLocation?: string;
  setStockInWarehouseLocation?: (loc: string) => void;
  stockInSupplier?: string;
  setStockInSupplier?: (supplier: string) => void;
  stockInInvoice?: string;
  setStockInInvoice?: (inv: string) => void;
  stockInNotes?: string;
  setStockInNotes?: (notes: string) => void;
  isNewPartMode: boolean;
  setIsNewPartMode: (mode: boolean) => void;
  newPartName: string;
  setNewPartName: (name: string) => void;
  isEditing?: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export const StockInModal: React.FC<StockInModalProps> = ({
  isOpen,
  onClose,
  parts,
  stockInPartId,
  setStockInPartId,
  stockInQuantity,
  setStockInQuantity,
  stockInBuyPrice,
  setStockInBuyPrice,
  stockInSellPrice,
  setStockInSellPrice,
  stockInWarehouseLocation = '',
  setStockInWarehouseLocation,
  stockInSupplier,
  setStockInSupplier,
  stockInInvoice,
  setStockInInvoice,
  stockInNotes,
  setStockInNotes,
  isNewPartMode,
  setIsNewPartMode,
  newPartName,
  setNewPartName,
  isEditing = false,
  onSubmit
}) => {
  if (!isOpen) return null;
  const selectedPart = !isNewPartMode ? parts.find(p => p.id === stockInPartId) : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111113] rounded-lg w-full border border-slate-200 dark:border-[#2d2d30] flex flex-col overflow-hidden space-y-0 shadow-2xs">
        
        {/* هدر صفحه اختصاصی ورود کالا */}
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <ArrowDownLeft className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>{isEditing ? 'ویرایش رسید ورود به انبار' : 'صفحه ورود کالا به انبار'}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-300 dark:border-indigo-500/30">
                {isEditing ? 'ویرایش رسید خرید و گردش ورود' : 'ثبت رسید خرید و افزایش موجودی'}
              </span>
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              {isEditing 
                ? 'ویرایش اطلاعات رسید خرید، تعداد وارده، نرخ خرید و فروش و محل جاگذاری کالا'
                : 'ثبت کالا، تعداد، نرخ خرید، نرخ فروش، محل جاگذاری و افزایش موجودی قطعات انبار'}
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors border border-transparent hover:border-slate-300 dark:border-[#2d2d30] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* بدنه فرم ورود کالا */}
        <form onSubmit={onSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs bg-white dark:bg-[#111113]">
          
          {/* ۱. انتخاب یا تعریف کالا */}
          <div className="bg-slate-50 dark:bg-[#161619] p-3.5 sm:p-4 rounded-lg border border-slate-200 dark:border-[#2d2d30] space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#252529] pb-2">
              <span className="font-extrabold text-[12px] text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                {isNewPartMode ? 'تعریف و ثبت کالای جدید' : 'انتخاب کالا از موجودی انبار'}
              </span>
              {isNewPartMode && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-300 dark:border-indigo-500/30">
                  حالت تعریف کالای جدید
                </span>
              )}
            </div>

            {isNewPartMode ? (
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  نام کامل قطعه یا کالای جدید <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="مثال: لنت ترمز جلو، روغن موتور، فیلتر هوا..."
                    value={newPartName}
                    onChange={e => setNewPartName(e.target.value)}
                    className="flex-1 h-[38px] px-3 rounded-md border-2 border-indigo-500 bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white font-bold focus:outline-none text-xs"
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewPartMode(false);
                      if (parts.length > 0) {
                        const first = parts[0];
                        setStockInPartId(first.id);
                        const bPrice = first.buyPrice ?? first.unitPrice ?? 0;
                        const sPrice = first.sellPrice ?? Math.round(bPrice * 1.25);
                        setStockInBuyPrice(bPrice);
                        setStockInSellPrice(sPrice);
                        if (setStockInWarehouseLocation) {
                          setStockInWarehouseLocation(first.warehouseLocation || '');
                        }
                      }
                    }}
                    className="h-[38px] w-[38px] min-w-[38px] bg-slate-200 dark:bg-[#202024] hover:bg-slate-300 dark:hover:bg-[#2b2b30] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-[#35353a] rounded-md flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                    title="بازگشت به انتخاب از لیست انبار"
                  >
                    <Package className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  انتخاب قطعه / کالا از لیست انبار <span className="text-rose-500">*</span>
                </label>
                <CustomSelect
                  value={stockInPartId ? String(stockInPartId) : ''}
                  onChange={(val) => {
                    const pId = Number(val);
                    setStockInPartId(pId);
                    const selected = parts.find(p => p.id === pId);
                    if (selected) {
                      const bPrice = selected.buyPrice ?? selected.unitPrice ?? 0;
                      const sPrice = selected.sellPrice ?? Math.round(bPrice * 1.25);
                      setStockInBuyPrice(bPrice);
                      setStockInSellPrice(sPrice);
                      if (setStockInWarehouseLocation) {
                        setStockInWarehouseLocation(selected.warehouseLocation || '');
                      }
                    }
                  }}
                  placeholder="جستجو و انتخاب کالا از انبار..."
                  searchable={true}
                  quickAddType="part"
                  options={parts.map(p => ({
                    value: String(p.id),
                    label: p.partName
                  }))}
                />
              </div>
            )}
          </div>

          {/* ۲. مقادیر وارده، نرخ خرید و نرخ فروش */}
          <div className="bg-slate-50 dark:bg-[#161619] p-3.5 sm:p-4 rounded-lg border border-slate-200 dark:border-[#2d2d30] space-y-3">
            <h4 className="font-extrabold text-[12px] text-slate-800 dark:text-slate-200 flex items-center gap-1.5 border-b border-slate-200 dark:border-[#252529] pb-2">
              <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              مقادیر وارده، نرخ خرید و نرخ فروش
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  تعداد وارده جدید <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="مثال: ۱۰"
                  value={stockInQuantity ? formatNumber(stockInQuantity) : ''}
                  onChange={e => setStockInQuantity(parsePersianNumber(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-emerald-600 dark:text-emerald-400 font-mono font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs"
                  required
                />
                {selectedPart && !isNewPartMode && (
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-0.5 px-0.5">
                    <span>موجودی فعلی انبار:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatNumber(selectedPart.quantity)} عدد
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  قیمت خرید واحد (ریال) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="مثال: ۱۲۰,۰۰۰"
                  value={stockInBuyPrice ? formatNumber(stockInBuyPrice) : ''}
                  onChange={e => {
                    const newBuy = parsePersianNumber(e.target.value);
                    setStockInBuyPrice(newBuy);
                    if (!stockInSellPrice || stockInSellPrice === Math.round((stockInBuyPrice || 0) * 1.25)) {
                      setStockInSellPrice(Math.round(newBuy * 1.25));
                    }
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-emerald-600 dark:text-emerald-400 font-mono font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs"
                  required
                />
                {selectedPart && !isNewPartMode && (
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-0.5 px-0.5">
                    <span>آخرین نرخ خرید قبلی:</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      {formatPrice(selectedPart.buyPrice ?? selectedPart.unitPrice ?? 0)} ریال
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  قیمت فروش واحد (ریال) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="مثال: ۱۵۰,۰۰۰"
                  value={stockInSellPrice ? formatNumber(stockInSellPrice) : ''}
                  onChange={e => setStockInSellPrice(parsePersianNumber(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-indigo-600 dark:text-indigo-400 font-mono font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs"
                  required
                />
                {selectedPart && !isNewPartMode && (
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-0.5 px-0.5">
                    <span>آخرین نرخ فروش قبلی:</span>
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {formatPrice(selectedPart.sellPrice ?? Math.round((selectedPart.buyPrice ?? selectedPart.unitPrice ?? 0) * 1.25))} ریال
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* نوار محاسباتی سود و ارزش خرید */}
            {(stockInBuyPrice > 0 || stockInSellPrice > 0) && (
              <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                  <span className="text-slate-500 dark:text-slate-400">ارزش کل خرید این محموله:</span>
                  <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                    {formatPrice((stockInQuantity || 0) * (stockInBuyPrice || 0))} ریال
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold">
                  <span className="text-slate-500 dark:text-slate-400">حاشیه سود فروش:</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 font-extrabold">
                    {stockInBuyPrice > 0 ? `${toPersianDigits(Math.round(((stockInSellPrice - stockInBuyPrice) / stockInBuyPrice) * 100))}%` : '۰%'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ۳. محل جاگذاری در انبار */}
          <div className="bg-slate-50 dark:bg-[#161619] p-3.5 sm:p-4 rounded-lg border border-slate-200 dark:border-[#2d2d30] space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#252529] pb-2">
              <h4 className="font-extrabold text-[12px] text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span>محل جاگذاری در انبار</span>
              </h4>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                قفسه، راهرو یا موقعیت‌های چندگانه
              </span>
            </div>

            <div className="space-y-2">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  محل جاگذاری (قفسه / انبار)
                </label>
                <input
                  type="text"
                  placeholder="مثال: قفسه A-3 یا برای چند مکان: قفسه A-3، انبار فرعی B-1"
                  value={stockInWarehouseLocation}
                  onChange={e => setStockInWarehouseLocation && setStockInWarehouseLocation(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs"
                />
              </div>

              {/* راهنما و برچسب‌های سریع موقعیت */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px] text-slate-500 dark:text-slate-400">
                <span>
                  💡 اگر کالا در دو یا چند محل قرار دارد، آنها را با ویرگول (،) جدا کنید (مانند: <span className="font-bold text-slate-700 dark:text-slate-300">قفسه A-12، انبار شماره ۲</span>).
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-400 text-[9.5px]">پیشنهاد سریع:</span>
                  {['قفسه A-1', 'قفسه A-2', 'قفسه B-1', 'قفسه B-2', 'انبار مرکزی', 'انبار فرعی'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        if (!setStockInWarehouseLocation) return;
                        if (!stockInWarehouseLocation || !stockInWarehouseLocation.trim()) {
                          setStockInWarehouseLocation(preset);
                        } else if (!stockInWarehouseLocation.includes(preset)) {
                          setStockInWarehouseLocation(`${stockInWarehouseLocation.trim()}، ${preset}`);
                        }
                      }}
                      className="px-1.5 py-0.5 bg-slate-200/80 dark:bg-[#222226] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-600 dark:text-slate-300 rounded text-[9.5px] font-medium border border-slate-300 dark:border-[#333338] transition-colors cursor-pointer"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* فوتر دکمه‌ها */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-[#2d2d30]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-300 font-bold rounded-md border border-slate-200 dark:border-[#2d2d30] transition-colors cursor-pointer text-xs"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md transition-all cursor-pointer text-xs flex items-center gap-1.5 shadow-xs"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>{isEditing ? 'ذخیره تغییرات رسید ورود' : 'ورود کالا به انبار'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ----------------------------------------------------
// مدال خروج کالا (حواله مصرف از انبار)
// ----------------------------------------------------
interface StockOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  parts: PartInventory[];
  vehicles: Vehicle[];
  stockOutPartId: number | null;
  setStockOutPartId: (id: number | null) => void;
  stockOutQuantity: number;
  setStockOutQuantity: (qty: number) => void;
  stockOutBuyPrice: number;
  setStockOutBuyPrice: (price: number) => void;
  stockOutSellPrice: number;
  setStockOutSellPrice: (price: number) => void;
  stockOutVehicleId: number | null;
  setStockOutVehicleId: (id: number | null) => void;
  stockOutRecipient: string;
  setStockOutRecipient: (rec: string) => void;
  stockOutReason: string;
  setStockOutReason: (reason: string) => void;
  stockOutNotes: string;
  setStockOutNotes: (notes: string) => void;
  isEditing?: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export const StockOutModal: React.FC<StockOutModalProps> = ({
  isOpen,
  onClose,
  parts,
  vehicles,
  stockOutPartId,
  setStockOutPartId,
  stockOutQuantity,
  setStockOutQuantity,
  stockOutBuyPrice,
  setStockOutBuyPrice,
  stockOutSellPrice,
  setStockOutSellPrice,
  stockOutVehicleId,
  setStockOutVehicleId,
  stockOutRecipient,
  setStockOutRecipient,
  stockOutReason,
  setStockOutReason,
  stockOutNotes,
  setStockOutNotes,
  isEditing = false,
  onSubmit
}) => {
  if (!isOpen) return null;
  const selectedPart = parts.find(p => p.id === stockOutPartId);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111113] rounded-lg w-full border border-slate-200 dark:border-[#2d2d30] flex flex-col overflow-hidden space-y-0 shadow-2xs">
        
        {/* هدر صفحه اختصاصی حواله خروج */}
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>{isEditing ? 'ویرایش حواله خروج از انبار' : 'حواله خروج از انبار'}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-300 dark:border-indigo-500/30">
                {isEditing ? 'ویرایش حواله و گردش مصرف کالا' : 'ثبت حواله خروج و مصرف کالا'}
              </span>
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              {isEditing 
                ? 'ویرایش اطلاعات حواله مصرف، تخصیص به خودرو، تعداد و نرخ‌های خروج از انبار'
                : 'ثبت خروج کالا از موجودی انبار، تخصیص به خودرو یا راننده، محاسبه نرخ فروش و بهای تمام‌شده'}
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors border border-transparent hover:border-slate-300 dark:border-[#2d2d30] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* بدنه فرم حواله خروج */}
        <form onSubmit={onSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs bg-white dark:bg-[#111113]">
          
          {/* ۱. انتخاب کالا */}
          <div className="bg-slate-50 dark:bg-[#161619] p-3.5 sm:p-4 rounded-lg border border-slate-200 dark:border-[#2d2d30] space-y-3">
            <h4 className="font-extrabold text-[12px] text-slate-800 dark:text-slate-200 flex items-center gap-1.5 border-b border-slate-200 dark:border-[#252529] pb-2">
              <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              انتخاب کالا از موجودی انبار
            </h4>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                نام کالا / قطعه <span className="text-rose-500">*</span>
              </label>
              <CustomSelect
                value={stockOutPartId ? String(stockOutPartId) : ''}
                onChange={(val) => {
                  const pId = Number(val);
                  setStockOutPartId(pId);
                  const selected = parts.find(p => p.id === pId);
                  if (selected) {
                    const bPrice = selected.buyPrice ?? selected.unitPrice ?? 0;
                    const sPrice = selected.sellPrice ?? Math.round(bPrice * 1.25);
                    setStockOutBuyPrice(bPrice);
                    setStockOutSellPrice(sPrice);
                  }
                }}
                placeholder="جستجو و انتخاب کالا از لیست انبار..."
                searchable={true}
                quickAddType="part"
                options={parts.map(p => ({
                  value: String(p.id),
                  label: p.partName
                }))}
              />
            </div>
          </div>

          {/* ۲. تعداد، قیمت خرید مبنا و قیمت فروش خروج */}
          <div className="bg-slate-50 dark:bg-[#161619] p-3.5 sm:p-4 rounded-lg border border-slate-200 dark:border-[#2d2d30] space-y-3">
            <h4 className="font-extrabold text-[12px] text-slate-800 dark:text-slate-200 flex items-center gap-1.5 border-b border-slate-200 dark:border-[#252529] pb-2">
              <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              تعداد خروجی و نرخ‌های مبنا
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  تعداد خروجی <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="مثال: ۲"
                  value={stockOutQuantity ? formatNumber(stockOutQuantity) : ''}
                  onChange={e => setStockOutQuantity(parsePersianNumber(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white font-mono font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs"
                  required
                />
                {selectedPart && (
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-0.5 px-0.5">
                    <span>موجودی فعلی انبار:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatNumber(selectedPart.quantity)} عدد
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  قیمت خرید مبنا (ریال)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="مثال: ۱۲۰,۰۰۰"
                  value={stockOutBuyPrice ? formatNumber(stockOutBuyPrice) : ''}
                  onChange={e => setStockOutBuyPrice(parsePersianNumber(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-emerald-600 dark:text-emerald-400 font-mono font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs"
                />
                {selectedPart && (
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-0.5 px-0.5">
                    <span>نرخ خرید قبلی:</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      {formatPrice(selectedPart.buyPrice ?? selectedPart.unitPrice ?? 0)} ریال
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  قیمت فروش خروج (ریال)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="مثال: ۱۵۰,۰۰۰"
                  value={stockOutSellPrice ? formatNumber(stockOutSellPrice) : ''}
                  onChange={e => setStockOutSellPrice(parsePersianNumber(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-indigo-600 dark:text-indigo-400 font-mono font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs"
                />
                {selectedPart && (
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-0.5 px-0.5">
                    <span>نرخ فروش پیش‌فرض:</span>
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {formatPrice(selectedPart.sellPrice ?? Math.round((selectedPart.buyPrice ?? selectedPart.unitPrice ?? 0) * 1.25))} ریال
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* خلاصه ارزش حواله خروج */}
            {selectedPart && (
              <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                  <span className="text-slate-500 dark:text-slate-400">ارزش کل فروش خروجی:</span>
                  <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400">
                    {formatPrice((stockOutQuantity || 0) * (stockOutSellPrice || selectedPart.sellPrice || 0))} ریال
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-xs">
                  <span>بهای تمام‌شده خرید:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatPrice((stockOutQuantity || 0) * (stockOutBuyPrice || selectedPart.buyPrice || selectedPart.unitPrice || 0))} ریال
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ۳. خودروی مقصد و مشخصات تحویل */}
          <div className="bg-slate-50 dark:bg-[#161619] p-3.5 sm:p-4 rounded-lg border border-slate-200 dark:border-[#2d2d30] space-y-3">
            <h4 className="font-extrabold text-[12px] text-slate-800 dark:text-slate-200 flex items-center gap-1.5 border-b border-slate-200 dark:border-[#252529] pb-2">
              خودروی مصرف‌کننده، تحویل‌گیرنده و علت خروج
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  خودروی مصرف‌کننده (ناوگان)
                </label>
                <CustomSelect
                  value={stockOutVehicleId ? String(stockOutVehicleId) : ''}
                  onChange={(val) => setStockOutVehicleId(val ? Number(val) : null)}
                  placeholder="-- عمومی / بدون تخصیص به خودرو --"
                  searchable={true}
                  quickAddType="vehicle"
                  options={[
                    { value: '', label: '-- عمومی / بدون تخصیص به خودرو --' },
                    ...vehicles.map(v => ({
                      value: String(v.id),
                      label: `${v.name} - پلاک [${toPersianDigits(v.plaque)}] (کد: ${toPersianDigits(v.code)}) - راننده: ${v.driverName || 'نامشخص'}`
                    }))
                  ]}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  تحویل‌گیرنده / تعمیرکار
                </label>
                <input
                  type="text"
                  placeholder="مثال: علی رضایی، تعمیرگاه مرکزی..."
                  value={stockOutRecipient}
                  onChange={e => setStockOutRecipient(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  علت / شماره دستور کار
                </label>
                <input
                  type="text"
                  placeholder="مثال: تعویض روغن دوره‌ای، دستور کار ۱۰۴..."
                  value={stockOutReason}
                  onChange={e => setStockOutReason(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  توضیحات تکمیلی
                </label>
                <input
                  type="text"
                  placeholder="یادداشت اختیاری..."
                  value={stockOutNotes}
                  onChange={e => setStockOutNotes(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs"
                />
              </div>
            </div>
          </div>

          {/* فوتر دکمه‌ها */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-[#2d2d30]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-300 font-bold rounded-md border border-slate-200 dark:border-[#2d2d30] transition-colors cursor-pointer text-xs"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md transition-all cursor-pointer text-xs flex items-center gap-1.5 shadow-xs"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>{isEditing ? 'ذخیره تغییرات حواله خروج' : 'حواله خروج از انبار'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ----------------------------------------------------
// مدال تعریف و ویرایش مشخصات کالا
// ----------------------------------------------------
interface PartFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingPartId: number | null;
  partName: string;
  setPartName: (name: string) => void;
  serviceType?: string;
  setServiceType?: (service: string) => void;
  availableServiceOptions?: string[];
  buyPrice: number;
  setBuyPrice: (price: number) => void;
  sellPrice: number;
  setSellPrice: (price: number) => void;
  minQuantity: number;
  setMinQuantity: (qty: number) => void;
  warehouseLocation: string;
  setWarehouseLocation: (loc: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isNavigated?: boolean;
}

export const PartFormModal: React.FC<PartFormModalProps> = ({
  isOpen,
  onClose,
  editingPartId,
  partName,
  setPartName,
  buyPrice,
  setBuyPrice,
  sellPrice,
  setSellPrice,
  minQuantity,
  setMinQuantity,
  warehouseLocation,
  setWarehouseLocation,
  onSubmit,
  isNavigated = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3">
      <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-3.5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518]">
          <h2 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            {editingPartId ? 'ویرایش مشخصات و قیمت‌های کالا' : 'تعریف قطعه و کالای جدید در انبار'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white p-1 rounded-md bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#2d2d30] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-4 space-y-3.5 text-[11px]">
          {/* نام قطعه */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300 block">
              نام قطعه / کالا <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="مثال: لنت ترمز جلو، روغن ۱۰W۴۰، فیلتر هوا..."
              value={partName}
              onChange={e => setPartName(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder-slate-400 dark:placeholder-slate-500 font-bold text-[11px]"
              required
            />
          </div>

          {/* قیمت خرید، قیمت فروش و حداقل هشدار */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">
                قیمت خرید واحد (ریال)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={buyPrice ? formatNumber(buyPrice) : ''}
                onChange={e => {
                  const newBuy = parsePersianNumber(e.target.value);
                  setBuyPrice(newBuy);
                  if (!sellPrice || sellPrice === Math.round((buyPrice || 0) * 1.25)) {
                    setSellPrice(Math.round(newBuy * 1.25));
                  }
                }}
                placeholder="مثال: ۲۰۰,۰۰۰"
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-emerald-600 dark:text-emerald-400 font-mono font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none text-[11px]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">
                قیمت فروش واحد (ریال)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={sellPrice ? formatNumber(sellPrice) : ''}
                onChange={e => setSellPrice(parsePersianNumber(e.target.value))}
                placeholder="مثال: ۲۵۰,۰۰۰"
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-indigo-600 dark:text-indigo-400 font-mono font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none text-[11px]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">
                حداقل هشدار (تعداد)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={minQuantity ? formatNumber(minQuantity) : ''}
                onChange={e => setMinQuantity(parsePersianNumber(e.target.value))}
                placeholder="مثال: ۵"
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono text-[11px]"
              />
            </div>
          </div>

          {/* موقعیت در انبار */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300 block">
              موقعیت فیزیکی در انبار
            </label>
            <input
              type="text"
              placeholder="مثال: قفسه A-3، ردیف ۲ انبار مرکزی"
              value={warehouseLocation}
              onChange={e => setWarehouseLocation(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder-slate-400 dark:placeholder-slate-500 text-[11px]"
            />
          </div>

          {/* فوتر دکمه‌ها */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-[#2d2d30]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-300 font-bold rounded-md border border-slate-200 dark:border-[#2d2d30] transition-colors cursor-pointer text-[11px]"
            >
              {isNavigated ? 'انصراف و بازگشت' : 'انصراف'}
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md transition-all cursor-pointer text-[11px]"
            >
              {editingPartId ? 'بروزرسانی قطعه و قیمت‌ها' : (isNavigated ? 'ذخیره کالا و بازگشت' : 'ذخیره اطلاعات کالا')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
