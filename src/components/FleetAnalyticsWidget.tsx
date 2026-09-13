import React, { useState } from 'react';
import { 
  BarChart3, Filter, Calendar, Building, User, Car, ShieldAlert, 
  Wrench, DollarSign, ArrowUpDown, Award, TrendingUp 
} from 'lucide-react';
import { Vehicle, VehicleFailure, PeriodicService, Expense, Company } from '../types';
import { toPersianDigits, formatPrice, formatNumber } from '../utils/numberUtils';
import { CustomSelect } from './CustomSelect';

interface FleetAnalyticsWidgetProps {
  vehicles: Vehicle[];
  failures: VehicleFailure[];
  services: PeriodicService[];
  expenses: Expense[];
  companies: Company[];
}

export default function FleetAnalyticsWidget({
  vehicles,
  failures,
  services,
  expenses,
  companies
}: FleetAnalyticsWidgetProps) {
  // فیلترهای انتخابی کاربر
  const [timeRange, setTimeRange] = useState<'all' | 'month' | '3months' | 'year'>('all');
  const [reportType, setReportType] = useState<'failures' | 'services' | 'expenses'>('failures');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [selectedDriver, setSelectedDriver] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // استخراج لیست رانندگانتا یکتا برای فیلتر
  const allDrivers = Array.from(new Set([
    ...vehicles.map(v => v.driverName),
    ...failures.map(f => f.driverName),
    ...services.map(s => s.driverName)
  ])).filter(Boolean) as string[];

  // فیلتر زمانی
  const now = new Date();
  const checkDateInRange = (dateStr: string) => {
    if (!dateStr || timeRange === 'all') return true;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return true;
    
    const diffTime = now.getTime() - d.getTime();
    const diffDays = diffTime / (1000 * 3600 * 24);

    if (timeRange === 'month') return diffDays <= 30;
    if (timeRange === '3months') return diffDays <= 90;
    if (timeRange === 'year') return diffDays <= 365;
    return true;
  };

  // فیلتر داده‌ها بر اساس شرکت و راننده و بازه زمانی
  const filteredFailures = failures.filter(f => {
    const v = vehicles.find(veh => veh.id === f.vehicleId);
    const comp = f.company || v?.company || '';
    const drv = f.driverName || v?.driverName || '';

    if (selectedCompany !== 'all' && comp !== selectedCompany) return false;
    if (selectedDriver !== 'all' && drv !== selectedDriver) return false;
    if (!checkDateInRange(f.failureDate)) return false;
    return true;
  });

  const filteredServices = services.filter(s => {
    const v = vehicles.find(veh => veh.id === s.vehicleId);
    const comp = s.company || v?.company || '';
    const drv = s.driverName || v?.driverName || '';

    if (selectedCompany !== 'all' && comp !== selectedCompany) return false;
    if (selectedDriver !== 'all' && drv !== selectedDriver) return false;
    if (!checkDateInRange(s.serviceDate)) return false;
    return true;
  });

  const filteredExpenses = expenses.filter(e => {
    const v = vehicles.find(veh => veh.id === e.vehicleId);
    const comp = e.company || v?.company || '';

    if (selectedCompany !== 'all' && comp !== selectedCompany) return false;
    if (!checkDateInRange(e.expenseDate)) return false;
    return true;
  });

  // محاسبات رتبه‌بندی بر اساس نوع گزارش انتخابی
  const getRankedData = () => {
    const sortMultiplier = sortOrder === 'desc' ? -1 : 1;

    if (reportType === 'failures') {
      const counts: Record<string, { count: number; subtitle: string }> = {};
      filteredFailures.forEach(f => {
        const v = vehicles.find(veh => veh.id === f.vehicleId);
        const key = v ? `${v.name} (${v.plaque})` : `خودرو #${f.vehicleId}`;
        const subtitle = `شرکت: ${f.company || v?.company || 'نامشخص'} | راننده: ${f.driverName || v?.driverName || 'بدون راننده'}`;
        if (!counts[key]) counts[key] = { count: 0, subtitle };
        counts[key].count += 1;
      });

      return Object.entries(counts)
        .map(([name, data]) => ({ name, value: data.count, subtitle: data.subtitle, unit: 'مورد خرابی' }))
        .sort((a, b) => (b.value - a.value) * sortMultiplier);
    } 
    
    if (reportType === 'services') {
      const counts: Record<string, { count: number; totalCost: number; subtitle: string }> = {};
      filteredServices.forEach(s => {
        const v = vehicles.find(veh => veh.id === s.vehicleId);
        const key = v ? `${v.name} (${v.plaque})` : `خودرو #${s.vehicleId}`;
        const subtitle = `نوع خدمت اصلی: ${s.serviceType}`;
        if (!counts[key]) counts[key] = { count: 0, totalCost: 0, subtitle };
        counts[key].count += 1;
        counts[key].totalCost += s.cost || 0;
      });

      return Object.entries(counts)
        .map(([name, data]) => ({ name, value: data.count, totalCost: data.totalCost, subtitle: data.subtitle, unit: 'نوبت سرویس' }))
        .sort((a, b) => (b.value - a.value) * sortMultiplier);
    } 

    if (reportType === 'expenses') {
      const counts: Record<string, { totalCost: number; subtitle: string }> = {};
      filteredExpenses.forEach(e => {
        const v = vehicles.find(veh => veh.id === e.vehicleId);
        const key = v ? `${v.name} (${v.plaque})` : `خودرو #${e.vehicleId || 'متفرقه'}`;
        const subtitle = `نوع هزینه: ${e.expenseType || 'عمومی'}`;
        if (!counts[key]) counts[key] = { totalCost: 0, subtitle };
        counts[key].totalCost += e.cost || 0;
      });

      return Object.entries(counts)
        .map(([name, data]) => ({ name, value: data.totalCost, subtitle: data.subtitle, unit: 'ریال' }))
        .sort((a, b) => (b.value - a.value) * sortMultiplier);
    }

    return [];
  };

  const rankedData = getRankedData();
  const maxValue = rankedData.length > 0 ? Math.max(...rankedData.map(i => i.value), 1) : 1;

  // مجموع کل برای هدر آماری
  const totalFailuresCount = filteredFailures.length;
  const totalServicesCount = filteredServices.length;
  const totalExpensesSum = filteredExpenses.reduce((acc, curr) => acc + (curr.cost || 0), 0);

  return (
    <div className="bg-[#111113] border border-[#2d2d30] rounded-2xl p-6 space-y-6 shadow-md">
      {/* هدر ویجت */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#2d2d30]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white">داشبورد تحلیلی و گزارش‌گیری پیشرفته ناوگان</h2>
            <p className="text-xs text-slate-400 mt-0.5">گرافیک تعاملی، فیلترهای ترکیبی شرکت/راننده و رتبه‌بندی عملکردی</p>
          </div>
        </div>

        {/* انتخاب نوع گزارش (تب‌ها) */}
        <div className="flex items-center bg-[#1a1a1c] p-1 rounded-xl border border-[#2d2d30] self-start lg:self-center">
          <button
            onClick={() => setReportType('failures')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${reportType === 'failures' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            گزارش خرابی‌ها
          </button>
          <button
            onClick={() => setReportType('services')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${reportType === 'services' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            سرویس‌های دوره‌ای
          </button>
          <button
            onClick={() => setReportType('expenses')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${reportType === 'expenses' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            مخارج و هزینه‌ها
          </button>
        </div>
      </div>

      {/* نوار فیلترها (بازه زمانی، شرکت، راننده، ترتیب) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-[#161618] p-4 rounded-xl border border-[#2d2d30]">
        {/* بازه زمانی */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            بازه زمانی گزارش
          </label>
          <CustomSelect
            value={timeRange}
            onChange={(val) => setTimeRange(val as any)}
            options={[
              { value: 'all', label: 'همه زمان‌ها (تاریخچه کامل)' },
              { value: 'month', label: '۳۰ روز گذشته (ماه اخیر)' },
              { value: '3months', label: '۹۰ روز گذشته (۳ ماه)' },
              { value: 'year', label: 'یک سال گذشته' }
            ]}
          />
        </div>

        {/* فیلتر شرکت */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-amber-400" />
            فیلتر بر اساس شرکت / پروژه
          </label>
          <CustomSelect
            value={selectedCompany}
            onChange={(val) => setSelectedCompany(val)}
            searchable={true}
            options={[
              { value: 'all', label: 'همه شرکت‌ها و پروژه‌ها' },
              ...companies.map(c => ({ value: c.name, label: c.name }))
            ]}
          />
        </div>

        {/* فیلتر راننده */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-emerald-400" />
            فیلتر بر اساس راننده خودرو
          </label>
          <CustomSelect
            value={selectedDriver}
            onChange={(val) => setSelectedDriver(val)}
            searchable={true}
            options={[
              { value: 'all', label: 'همه رانندگان و پرسنل' },
              ...allDrivers.map(drv => ({ value: drv, label: drv }))
            ]}
          />
        </div>

        {/* ترتیب رتبه‌بندی */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-rose-400" />
            نوع رتبه‌بندی
          </label>
          <CustomSelect
            value={sortOrder}
            onChange={(val) => setSortOrder(val as any)}
            options={[
              { value: 'desc', label: 'بیشترین به کمترین (نزولی)' },
              { value: 'asc', label: 'کمترین به بیشترین (صعودی)' }
            ]}
          />
        </div>
      </div>

      {/* خلاصه آماری کارت‌های کوچک */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#161618] border border-[#2d2d30] p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs block">مجموع خرابی‌های فیلتر شده</span>
            <span className="text-rose-400 font-extrabold text-xl font-mono mt-1 block">{toPersianDigits(totalFailuresCount)} مورد</span>
          </div>
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#161618] border border-[#2d2d30] p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs block">مجموع سرویس‌های دوره‌ای</span>
            <span className="text-indigo-400 font-extrabold text-xl font-mono mt-1 block">{toPersianDigits(totalServicesCount)} نوبت</span>
          </div>
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <Wrench className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#161618] border border-[#2d2d30] p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs block">مجموع مخارج و هزینه‌ها</span>
            <span className="text-amber-400 font-extrabold text-lg font-mono mt-1 block">
              {reportType === 'expenses' ? formatPrice(totalExpensesSum) : formatPrice(filteredServices.reduce((a, b) => a + (b.cost || 0), 0))} <span className="text-xs">ریال</span>
            </span>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* بخش خروجی گرافیکی و رتبه‌بندی */}
      <div className="bg-[#161618] border border-[#2d2d30] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            رتبه‌بندی و نمودار میله‌ای مقایسه‌ای ({reportType === 'failures' ? 'بیشترین خرابی خودروها' : reportType === 'services' ? 'بیشترین سرویس دوره‌ای' : 'بیشترین مخارج مالی'})
          </h3>
          <span className="text-xs font-mono text-slate-400 bg-[#1a1a1c] px-2.5 py-1 rounded-lg border border-[#2d2d30]">
            تعداد رکوردها: {toPersianDigits(rankedData.length)}
          </span>
        </div>

        {rankedData.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs bg-[#1a1a1c] rounded-xl border border-[#2d2d30]">
            هیچ داده‌ای با فیلترهای انتخابی یافت نشد. بازه زمانی یا فیلترهای شرکت/راننده را تغییر دهید.
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {rankedData.map((item, idx) => {
              const percentage = Math.max(8, Math.round((item.value / maxValue) * 100));
              const isTop3 = idx < 3;

              return (
                <div key={item.name} className="bg-[#1a1a1c] border border-[#2d2d30] p-4 rounded-xl space-y-2 hover:border-indigo-500/40 transition-all">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                        idx === 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        idx === 1 ? 'bg-slate-300/20 text-slate-300 border border-slate-300/30' :
                        idx === 2 ? 'bg-amber-700/20 text-amber-600 border border-amber-700/30' :
                        'bg-[#252528] text-slate-400'
                      }`}>
                        {toPersianDigits(idx + 1)}
                      </span>
                      <div>
                        <span className="font-bold text-white text-sm">{item.name}</span>
                        <span className="text-slate-400 text-[11px] block mt-0.5">{item.subtitle}</span>
                      </div>
                    </div>
                    <div className="text-left font-mono font-bold text-sm">
                      {reportType === 'expenses' ? formatPrice(item.value) : formatNumber(item.value)}
                      <span className="text-xs font-normal text-slate-400 mr-1">{item.unit}</span>
                    </div>
                  </div>

                  {/* نوار گرافیکی */}
                  <div className="w-full bg-[#252528] h-2.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        reportType === 'failures' ? 'bg-gradient-to-l from-rose-600 to-rose-400' :
                        reportType === 'services' ? 'bg-gradient-to-l from-indigo-600 to-indigo-400' :
                        'bg-gradient-to-l from-amber-600 to-amber-400'
                      }`} 
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
