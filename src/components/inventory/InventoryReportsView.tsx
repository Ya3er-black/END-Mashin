import React, { useMemo } from 'react';
import { 
  BarChart3, DollarSign, Package, AlertTriangle, Layers, TrendingUp, 
  FileSpreadsheet, ArrowDownLeft, Printer, ShieldAlert, CheckCircle2, ShoppingCart
} from 'lucide-react';
import { PartInventory, InventoryTransaction } from '../../types';
import { toPersianDigits, formatPrice, formatNumber } from '../../utils/numberUtils';

interface InventoryReportsViewProps {
  parts: PartInventory[];
  transactions: InventoryTransaction[];
  onOpenStockIn: (part: PartInventory) => void;
}

export const InventoryReportsView: React.FC<InventoryReportsViewProps> = ({
  parts,
  transactions,
  onOpenStockIn
}) => {
  // محاسبات شاخص‌های کلیدی انبار
  const totalBuyValue = useMemo(() => {
    return parts.reduce((acc, p) => acc + (p.quantity * (p.buyPrice ?? p.unitPrice ?? 0)), 0);
  }, [parts]);

  const totalSellValue = useMemo(() => {
    return parts.reduce((acc, p) => acc + (p.quantity * (p.sellPrice ?? Math.round((p.buyPrice ?? p.unitPrice ?? 0) * 1.25))), 0);
  }, [parts]);

  const totalEstimatedProfit = totalSellValue - totalBuyValue;
  const profitMarginPercent = totalBuyValue > 0 ? Math.round((totalEstimatedProfit / totalBuyValue) * 100) : 0;
  const totalItemsCount = useMemo(() => parts.reduce((acc, p) => acc + p.quantity, 0), [parts]);

  const lowStockParts = useMemo(() => {
    return parts.filter(p => p.quantity <= p.minQuantity && p.quantity > 0);
  }, [parts]);

  const outOfStockParts = useMemo(() => {
    return parts.filter(p => p.quantity === 0);
  }, [parts]);

  const criticalAndLowParts = useMemo(() => {
    return parts.filter(p => p.quantity <= p.minQuantity);
  }, [parts]);

  // برآورد بودجه خرید برای رساندن موجودی اقلام کسری به دو برابر حد نصاب
  const totalReplenishmentBudget = useMemo(() => {
    return criticalAndLowParts.reduce((acc, p) => {
      const targetQty = (p.minQuantity * 2) || 10;
      const neededQty = Math.max(0, targetQty - p.quantity);
      const unitBuy = p.buyPrice ?? p.unitPrice ?? 0;
      return acc + (neededQty * unitBuy);
    }, 0);
  }, [criticalAndLowParts]);

  // گزارش تفکیک بر اساس نوع سرویس / دسته‌بندی
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, {
      category: string;
      itemCount: number;
      totalQty: number;
      buyVal: number;
      sellVal: number;
    }>();

    parts.forEach(p => {
      const cat = p.serviceType || 'سایر قطعات و عمومی';
      const existing = map.get(cat) || {
        category: cat,
        itemCount: 0,
        totalQty: 0,
        buyVal: 0,
        sellVal: 0
      };

      const bPrice = p.buyPrice ?? p.unitPrice ?? 0;
      const sPrice = p.sellPrice ?? Math.round(bPrice * 1.25);

      existing.itemCount += 1;
      existing.totalQty += p.quantity;
      existing.buyVal += (p.quantity * bPrice);
      existing.sellVal += (p.quantity * sPrice);

      map.set(cat, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.sellVal - a.sellVal);
  }, [parts]);

  // پرمصرف‌ترین اقلام انبار بر اساس تراکنش‌های خروج
  const topConsumedParts = useMemo(() => {
    const map = new Map<string, {
      partName: string;
      outCount: number;
      totalQtyOut: number;
      totalOutValue: number;
      currentStock: number;
    }>();

    transactions.filter(t => t.type === 'out').forEach(t => {
      const existing = map.get(t.partName) || {
        partName: t.partName,
        outCount: 0,
        totalQtyOut: 0,
        totalOutValue: 0,
        currentStock: 0
      };

      existing.outCount += 1;
      existing.totalQtyOut += t.quantity;
      existing.totalOutValue += t.totalPrice || (t.quantity * (t.sellPrice ?? t.unitPrice ?? 0));
      map.set(t.partName, existing);
    });

    // اضافه کردن موجودی فعلی
    map.forEach((val, key) => {
      const foundPart = parts.find(p => p.partName === key);
      if (foundPart) {
        val.currentStock = foundPart.quantity;
      }
    });

    return Array.from(map.values())
      .sort((a, b) => b.totalQtyOut - a.totalQtyOut)
      .slice(0, 10);
  }, [transactions, parts]);

  // خروجی اکسل گزارش انبار
  const handleExportReportExcel = () => {
    try {
      const sanitize = (val: any) => {
        if (val === undefined || val === null) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      let csv = '\uFEFF';
      csv += `"گزارش جامع آماری و مدیریتی انبار قطعات یدکی"\r\n\r\n`;

      csv += `"شاخص‌های کلیدی انبار"\r\n`;
      csv += `"ارزش کل خرید (ریال)",${totalBuyValue}\r\n`;
      csv += `"ارزش کل فروش (ریال)",${totalSellValue}\r\n`;
      csv += `"سود ناخالص برآوردی (ریال)",${totalEstimatedProfit}\r\n`;
      csv += `"درصد حاشیه سود",${profitMarginPercent}%\r\n`;
      csv += `"مجموع تعداد فیزیکی",${totalItemsCount}\r\n`;
      csv += `"تعداد کل اقلام",${parts.length}\r\n`;
      csv += `"اقلام کسری و اتمام",${criticalAndLowParts.length}\r\n\r\n`;

      csv += `"تفکیک موجودی بر اساس نوع سرویس و دسته‌بندی"\r\n`;
      csv += `"نام دسته‌بندی","تنوع اقلام","موجودی فیزیکی","ارزش خرید (ریال)","ارزش فروش (ریال)","سهم از ارزش فروش"\r\n`;
      categoryBreakdown.forEach(c => {
        const share = totalSellValue > 0 ? ((c.sellVal / totalSellValue) * 100).toFixed(1) : '0';
        csv += `${sanitize(c.category)},${c.itemCount},${c.totalQty},${c.buyVal},${c.sellVal},"${share}%"\r\n`;
      });
      csv += `\r\n`;

      csv += `"لیست اقلام نیازمند سفارش خرید فوری"\r\n`;
      csv += `"ردیف","نام قطعه","موجودی فعلی","حداقل هشدار","تعداد مورد نیاز","آخرین نرخ خرید (ریال)","برآورد بودجه لازم (ریال)"\r\n`;
      criticalAndLowParts.forEach((p, idx) => {
        const targetQty = (p.minQuantity * 2) || 10;
        const needed = Math.max(0, targetQty - p.quantity);
        const bPrice = p.buyPrice ?? p.unitPrice ?? 0;
        const budget = needed * bPrice;
        csv += `${idx + 1},${sanitize(p.partName)},${p.quantity},${p.minQuantity},${needed},${bPrice},${budget}\r\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `گزارش_تحلیلی_انبار_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* نوار بالایی ابزار گزارشات */}
      <div className="bg-white dark:bg-[#111113] p-3 rounded-lg border border-slate-200 dark:border-[#2d2d30] shadow-2xs flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-extrabold text-slate-900 dark:text-white">
            گزارش تحلیلی و مدیریتی موجودی، گردش مالی و هشدارهای تامین کالا
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportReportExcel}
            className="h-[32px] px-3 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>خروجی اکسل گزارش انبار</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="h-[32px] px-3 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#2d2d30] rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>چاپ گزارش</span>
          </button>
        </div>
      </div>

      {/* کارت‌های شاخص‌های مالی و فیزیکی انبار */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="bg-white dark:bg-[#111113] p-3 rounded-lg border border-slate-200 dark:border-[#2d2d30] shadow-2xs">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
            ارزش خرید کل انبار
          </div>
          <div className="text-xs font-mono font-extrabold text-emerald-600 dark:text-emerald-400 mt-1.5">
            {formatPrice(totalBuyValue)} <span className="text-[9px] font-sans font-normal text-slate-400">ریال</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111113] p-3 rounded-lg border border-slate-200 dark:border-[#2d2d30] shadow-2xs">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
            ارزش فروش کل انبار
          </div>
          <div className="text-xs font-mono font-extrabold text-indigo-600 dark:text-indigo-400 mt-1.5">
            {formatPrice(totalSellValue)} <span className="text-[9px] font-sans font-normal text-slate-400">ریال</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111113] p-3 rounded-lg border border-slate-200 dark:border-[#2d2d30] shadow-2xs">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5 text-cyan-500" />
            سود برآوردی انبار
          </div>
          <div className="text-xs font-mono font-extrabold text-cyan-600 dark:text-cyan-400 mt-1.5">
            {formatPrice(totalEstimatedProfit)} <span className="text-[9px] font-sans font-bold text-cyan-500">({toPersianDigits(profitMarginPercent)}%)</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111113] p-3 rounded-lg border border-slate-200 dark:border-[#2d2d30] shadow-2xs">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
            <Package className="w-3.5 h-3.5 text-blue-500" />
            مجموع موجودی فیزیکی
          </div>
          <div className="text-xs font-mono font-extrabold text-blue-600 dark:text-blue-400 mt-1.5">
            {formatNumber(totalItemsCount)} <span className="text-[9px] font-sans font-normal text-slate-400">عدد در انبار</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111113] p-3 rounded-lg border border-slate-200 dark:border-[#2d2d30] shadow-2xs">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            اقلام کسری انبار
          </div>
          <div className="text-xs font-mono font-extrabold text-amber-600 dark:text-amber-400 mt-1.5">
            {formatNumber(lowStockParts.length)} <span className="text-[9px] font-sans font-normal text-slate-400">قلم زیر نقطه هشدار</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111113] p-3 rounded-lg border border-slate-200 dark:border-[#2d2d30] shadow-2xs">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            اقلام اتمام موجودی
          </div>
          <div className="text-xs font-mono font-extrabold text-rose-600 dark:text-rose-400 mt-1.5">
            {formatNumber(outOfStockParts.length)} <span className="text-[9px] font-sans font-normal text-slate-400">قلم با موجودی صفر</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* جدول ۱: تفکیک ارزش و تنوع موجودی بر اساس نوع سرویس */}
        <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex justify-between items-center">
            <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
              <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>تفکیک ارزش و تنوع کالاها بر اساس سرویس</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              {toPersianDigits(categoryBreakdown.length)} دسته‌بندی
            </span>
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[360px]">
            <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-[#161618]">
                <tr className="border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-medium text-xs">
                  <th className="py-2 px-3 text-right text-xs font-medium">سرویس / دسته‌بندی</th>
                  <th className="py-2 px-3 text-center text-xs font-medium w-16">تنوع</th>
                  <th className="py-2 px-3 text-center text-xs font-medium w-20">موجودی</th>
                  <th className="py-2 px-3 text-center text-xs font-medium w-28">ارزش خرید</th>
                  <th className="py-2 px-3 text-center text-xs font-medium w-28">ارزش فروش</th>
                  <th className="py-2 px-3 text-center text-xs font-medium w-16">سهم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-[#2d2d30]/60">
                {categoryBreakdown.map((c, i) => {
                  const share = totalSellValue > 0 ? Math.round((c.sellVal / totalSellValue) * 100) : 0;
                  return (
                    <tr 
                      key={i} 
                      className="h-9 hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/60 transition-colors text-[11px]"
                    >
                      <td className="py-1 px-3 text-slate-800 dark:text-slate-200 font-medium text-[11px] align-middle">
                        <span className="truncate max-w-[140px] block">{c.category}</span>
                      </td>
                      <td className="py-1 px-3 text-center font-mono text-slate-700 dark:text-slate-300 text-[11px] align-middle">
                        {formatNumber(c.itemCount)}
                      </td>
                      <td className="py-1 px-3 text-center font-mono font-medium text-slate-800 dark:text-slate-200 text-[11px] align-middle">
                        {formatNumber(c.totalQty)}
                      </td>
                      <td className="py-1 px-3 text-center font-mono text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap align-middle">
                        {formatPrice(c.buyVal)}
                      </td>
                      <td className="py-1 px-3 text-center font-mono text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap align-middle">
                        {formatPrice(c.sellVal)}
                      </td>
                      <td className="py-1 px-3 text-center align-middle">
                        <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded text-[10px] font-mono font-bold">
                          {toPersianDigits(share)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* جدول ۲: پرمصرف‌ترین اقلام انبار */}
        <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex justify-between items-center">
            <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>پرمصرف‌ترین و پرگردش‌ترین قطعات (بیشترین خروج)</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              ۱۰ قلم برتر
            </span>
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[360px]">
            <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-[#161618]">
                <tr className="border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-medium text-xs">
                  <th className="py-2 px-3 text-center w-10 text-xs font-medium">رتبه</th>
                  <th className="py-2 px-3 text-right text-xs font-medium">نام قطعه</th>
                  <th className="py-2 px-3 text-center text-xs font-medium w-20">دفعات خروج</th>
                  <th className="py-2 px-3 text-center text-xs font-medium w-20">مجموع مصرف</th>
                  <th className="py-2 px-3 text-center text-xs font-medium w-28">ارزش کل مصرف</th>
                  <th className="py-2 px-3 text-center text-xs font-medium w-20">موجودی فعلی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-[#2d2d30]/60">
                {topConsumedParts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-500 dark:text-slate-400 text-xs">
                      هنوز سوابق خروجی ثبت نشده است.
                    </td>
                  </tr>
                ) : (
                  topConsumedParts.map((t, idx) => (
                    <tr 
                      key={idx} 
                      className="h-9 hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/60 transition-colors text-[11px]"
                    >
                      <td className="py-1 px-3 text-center font-mono text-slate-500 dark:text-slate-400 text-[11px] align-middle">
                        {toPersianDigits(idx + 1)}
                      </td>
                      <td className="py-1 px-3 text-slate-800 dark:text-slate-200 font-medium text-[11px] align-middle">
                        <span className="truncate max-w-[140px] block">{t.partName}</span>
                      </td>
                      <td className="py-1 px-3 text-center font-mono text-slate-700 dark:text-slate-300 text-[11px] align-middle">
                        {formatNumber(t.outCount)}
                      </td>
                      <td className="py-1 px-3 text-center font-mono font-medium text-slate-800 dark:text-slate-200 text-[11px] align-middle">
                        {formatNumber(t.totalQtyOut)}
                      </td>
                      <td className="py-1 px-3 text-center font-mono text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap align-middle">
                        {formatPrice(t.totalOutValue)}
                      </td>
                      <td className="py-1 px-3 text-center font-mono font-medium text-[11px] align-middle">
                        <span className={t.currentStock <= 5 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-800 dark:text-slate-200'}>
                          {formatNumber(t.currentStock)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* جدول ۳: اقلام نیازمند سفارش خرید فوری */}
      <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>لیست نیازسنجی و اقلام بحرانی جهت صدور درخواست خرید</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
              برآورد بودجه تامین: {formatPrice(totalReplenishmentBudget)} ریال
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              {toPersianDigits(criticalAndLowParts.length)} قلم نیازمند خرید
            </span>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[420px]">
          <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-[#161618]">
              <tr className="border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-medium text-xs">
                <th className="py-2 px-3 text-center w-12 text-xs font-medium">ردیف</th>
                <th className="py-2 px-3 text-right text-xs font-medium">نام قطعه / کالا</th>
                <th className="py-2 px-3 text-right text-xs font-medium w-28">سرویس مرتبط</th>
                <th className="py-2 px-3 text-center text-xs font-medium w-24">موجودی فعلی</th>
                <th className="py-2 px-3 text-center text-xs font-medium w-24">حداقل هشدار</th>
                <th className="py-2 px-3 text-center text-xs font-medium w-24">کسری تا سقف</th>
                <th className="py-2 px-3 text-center text-xs font-medium w-28">آخرین نرخ خرید</th>
                <th className="py-2 px-3 text-center text-xs font-medium w-28">بودجه برآوردی</th>
                <th className="py-2 px-3 text-center text-xs font-medium w-20">وضعیت</th>
                <th className="py-2 px-3 text-center w-24 text-xs font-medium">عملیات خرید</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-[#2d2d30]/60">
              {criticalAndLowParts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-emerald-600 dark:text-emerald-400 text-xs">
                    <div className="flex items-center justify-center gap-1.5 font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      وضعیت انبار عالی است. هیچ کالایی دچار کسری یا اتمام موجودی نمی‌باشد.
                    </div>
                  </td>
                </tr>
              ) : (
                criticalAndLowParts.map((p, idx) => {
                  const targetQty = (p.minQuantity * 2) || 10;
                  const neededQty = Math.max(0, targetQty - p.quantity);
                  const currentBuy = p.buyPrice ?? p.unitPrice ?? 0;
                  const estBudget = neededQty * currentBuy;

                  return (
                    <tr 
                      key={p.id} 
                      className="h-9 hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/60 transition-colors text-[11px]"
                    >
                      <td className="py-1 px-3 text-center text-slate-500 dark:text-slate-400 font-mono text-[11px] align-middle">
                        {toPersianDigits(idx + 1)}
                      </td>
                      <td className="py-1 px-3 text-slate-800 dark:text-slate-200 font-medium text-[11px] align-middle">
                        <span className="truncate max-w-[180px] block">{p.partName}</span>
                      </td>
                      <td className="py-1 px-3 text-slate-700 dark:text-slate-300 text-[11px] align-middle whitespace-nowrap">
                        {p.serviceType || 'عمومی'}
                      </td>
                      <td className="py-1 px-3 text-center font-mono font-medium text-[11px] align-middle">
                        <span className={p.quantity === 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-amber-600 dark:text-amber-400 font-bold'}>
                          {formatNumber(p.quantity)}
                        </span>
                      </td>
                      <td className="py-1 px-3 text-center font-mono text-slate-600 dark:text-slate-400 text-[11px] align-middle">
                        {formatNumber(p.minQuantity)}
                      </td>
                      <td className="py-1 px-3 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400 text-[11px] align-middle">
                        +{formatNumber(neededQty)}
                      </td>
                      <td className="py-1 px-3 text-center font-mono text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap align-middle">
                        {currentBuy ? formatPrice(currentBuy) : '-'}
                      </td>
                      <td className="py-1 px-3 text-center font-mono text-slate-800 dark:text-slate-200 font-medium text-[11px] whitespace-nowrap align-middle">
                        {formatPrice(estBudget)}
                      </td>
                      <td className="py-1 px-3 text-center align-middle whitespace-nowrap">
                        {p.quantity === 0 ? (
                          <span className="px-1.5 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded font-bold text-[10px]">
                            اتمام
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded font-bold text-[10px]">
                            کسری
                          </span>
                        )}
                      </td>
                      <td className="py-1 px-3 text-center align-middle whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onOpenStockIn(p)}
                          className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 rounded text-[10px] font-bold transition-all cursor-pointer inline-flex items-center gap-0.5 shadow-2xs"
                        >
                          <ArrowDownLeft className="w-2.5 h-2.5 text-emerald-600" />
                          <span>خرید</span>
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
  );
};
