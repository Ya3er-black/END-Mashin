/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  PhoneCall, Check, X, AlertTriangle, Phone, 
  Gauge, Edit2, AlertCircle, Sparkles, Wrench, Clock, Calendar, TrendingUp, Trash2
} from 'lucide-react';
import { Vehicle, OdometerLog, User, PeriodicService, ServiceDefinition, VehicleFailure } from '../types';
import { toPersianDigits, formatNumber, parsePersianNumber } from '../utils/numberUtils';
import { JalaliDatePicker } from './JalaliDatePicker';
import { CustomSelect } from './CustomSelect';
import { calculateInquiryServicePrediction } from '../utils/predictionEngine';
import { getVehicleDisplayName } from '../utils/vehicleUtils';
import { jalaliDayDifference, getCurrentJalaliDate } from '../utils/date';
import { getLatestVehicleKm } from '../utils/serviceMatching';

interface OdometerInquiryFormViewProps {
  editingLog: OdometerLog | null;
  vehicles: Vehicle[];
  services?: PeriodicService[];
  failures?: VehicleFailure[];
  odometerLogs?: OdometerLog[];
  serviceDefinitions?: ServiceDefinition[];
  currentUser?: User | null;
  initialVehicleId?: number;
  onClose: () => void;
  onDelete?: (id: number) => Promise<void>;
  onSubmit: (data: {
    vehicleId: number;
    inquiryDate: string;
    inquiryTime: string;
    odometerKm: number;
    notes: string;
  }) => Promise<void>;
}

export const OdometerInquiryFormView: React.FC<OdometerInquiryFormViewProps> = ({
  editingLog,
  vehicles,
  services = [],
  failures = [],
  odometerLogs = [],
  serviceDefinitions = [],
  currentUser: _currentUser,
  initialVehicleId,
  onClose,
  onDelete,
  onSubmit
}) => {
  const [vehicleId, setVehicleId] = useState<number>(() => {
    if (editingLog) return editingLog.vehicleId;
    if (initialVehicleId && initialVehicleId > 0) return initialVehicleId;
    return vehicles[0]?.id || 0;
  });

  const rawSelectedVehicle = vehicles.find(v => v.id === vehicleId);

  // محاسبه آخرین کارکرد ثبت‌شده خودرو در دیتابیس (استعلام‌ها، سرویس‌ها، تعمیرات و کیلومتر مبدا)
  const latestDbKm = useMemo(() => {
    if (!rawSelectedVehicle) return 0;
    return getLatestVehicleKm(rawSelectedVehicle, odometerLogs, services, failures) || rawSelectedVehicle.currentKm || 0;
  }, [rawSelectedVehicle, odometerLogs, services, failures]);

  // تعریف خودرو مجهز به آخرین کارکرد ذخیره‌شده در دیتابیس جهت استفاده در محاسبات، تعاریف و پایش
  const selectedVehicle = useMemo(() => {
    if (!rawSelectedVehicle) return undefined;
    return {
      ...rawSelectedVehicle,
      currentKm: latestDbKm
    };
  }, [rawSelectedVehicle, latestDbKm]);

  const [inquiryDate, setInquiryDate] = useState<string>(() => {
    if (editingLog) return editingLog.inquiryDate;
    return new Date().toLocaleDateString('fa-IR-u-nu-latn').split('/').map(p => p.padStart(2, '0')).join('/');
  });

  const [inquiryTime] = useState<string>(() => {
    if (editingLog?.inquiryTime) return editingLog.inquiryTime;
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  const [odometerKm, setOdometerKm] = useState<number | ''>(() => {
    if (editingLog) return editingLog.odometerKm;
    const initialId = initialVehicleId && initialVehicleId > 0 ? initialVehicleId : (vehicles[0]?.id || 0);
    const target = vehicles.find(v => v.id === initialId);
    if (target) {
      const targetLatestKm = getLatestVehicleKm(target, odometerLogs, services, failures) || target.currentKm;
      return targetLatestKm || '';
    }
    return '';
  });

  const [notes, setNotes] = useState<string>(editingLog?.notes || '');
  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleVehicleChange = (val: string | number) => {
    const newId = Number(val);
    setVehicleId(newId);
    const target = vehicles.find(v => v.id === newId);
    if (target) {
      const targetLatestKm = getLatestVehicleKm(target, odometerLogs, services, failures) || target.currentKm;
      setOdometerKm(targetLatestKm || '');
    } else {
      setOdometerKm('');
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId) {
      setFormError('لطفاً یک خودرو را انتخاب نمایید.');
      return;
    }
    if (odometerKm === '' || Number(odometerKm) < 0) {
      setFormError('لطفاً کیلومتر معتبر کارکرد خودرو را وارد نمایید.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      await onSubmit({
        vehicleId,
        inquiryDate,
        inquiryTime: inquiryTime || '10:00',
        odometerKm: Number(odometerKm),
        notes
      });
    } catch (err: any) {
      setFormError(err?.message || 'خطا در ثبت استعلام');
      setIsSubmitting(false);
    }
  };

  const prevKm = latestDbKm;
  const currentKmNum = odometerKm === '' ? 0 : Number(odometerKm);
  const diffKm = currentKmNum - prevKm;

  // سوابق قبلی استعلام این خودرو
  const vehicleLogs = useMemo(() => {
    if (!vehicleId) return [];
    const logs = odometerLogs.filter(l => l.vehicleId === vehicleId);
    return [...logs].sort((a, b) => {
      const dateDiff = String(b.inquiryDate || '').localeCompare(String(a.inquiryDate || ''));
      if (dateDiff !== 0) return dateDiff;
      return Number(b.id || 0) - Number(a.id || 0);
    });
  }, [odometerLogs, vehicleId]);

  // محاسبه زنده پیش‌بینی تاریخ سررسید قطعات: قبل و بعد از ورود کیلومتر
  const livePredictions = useMemo(() => {
    if (!selectedVehicle || !serviceDefinitions || serviceDefinitions.length === 0) return [];
    return serviceDefinitions.map(def => {
      return calculateInquiryServicePrediction({
        vehicle: selectedVehicle,
        serviceDef: def,
        services,
        failures,
        odometerLogs,
        activeInquiryInput: {
          inquiryDate,
          odometerKm: odometerKm !== '' ? Number(odometerKm) : ''
        }
      });
    });
  }, [selectedVehicle, serviceDefinitions, services, failures, odometerLogs, inquiryDate, odometerKm]);

  // آخرین سرویس دوره‌ای این خودرو برای محاسبه تاخیر از آخرین سرویس
  const lastService = useMemo(() => {
    if (!vehicleId || !services || services.length === 0) return null;
    const vehicleServices = services.filter(
      s => Number(s.vehicleId) === Number(vehicleId) && s.status !== 'in_progress'
    );
    if (vehicleServices.length === 0) return null;
    return [...vehicleServices].sort((a, b) => {
      const dateDiff = String(b.serviceDate || '').localeCompare(String(a.serviceDate || ''));
      if (dateDiff !== 0) return dateDiff;
      return Number(b.id || 0) - Number(a.id || 0);
    })[0];
  }, [vehicleId, services]);

  // محاسبه تاخیر از آخرین مراجعه به سرویس دوره‌ای
  const serviceDelayInfo = useMemo(() => {
    if (!lastService || !lastService.serviceDate) return null;
    const targetDate = inquiryDate || getCurrentJalaliDate();
    const days = Math.max(0, jalaliDayDifference(lastService.serviceDate, targetDate));
    const currentEnteredKm = odometerKm !== '' && Number(odometerKm) > 0 ? Number(odometerKm) : prevKm;
    const kmPassed = lastService.currentKm ? Math.max(0, currentEnteredKm - Number(lastService.currentKm)) : null;

    return {
      lastServiceDate: lastService.serviceDate,
      lastServiceKm: lastService.currentKm,
      serviceType: lastService.serviceType,
      daysPassed: days,
      kmPassed
    };
  }, [lastService, inquiryDate, odometerKm, prevKm]);

  // بررسی وضعیت پیش‌بینی (قبل یا بعد از کیلومتر)
  const isAfterKmActive = livePredictions.some(p => p.state === 'after_km');
  const samplePrediction = livePredictions[0];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#111113] rounded-lg w-full border border-slate-200 dark:border-[#2d2d30] flex flex-col overflow-hidden space-y-0">
        
        {/* هدر صفحه اختصاصی ثبت یا ویرایش استعلام کارکرد (دقیقاً هماهنگ با صفحه ثبت سرویس) */}
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              {editingLog ? (
                <>
                  <Edit2 className="w-5 h-5 text-amber-500" />
                  <span>ویرایش استعلام کارکرد خودرو</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded border border-amber-300 dark:border-amber-500/30">
                    شناسه استعلام: #{toPersianDigits(editingLog.id)}
                  </span>
                </>
              ) : (
                <>
                  <PhoneCall className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <span>صفحه ثبت استعلام کارکرد روزانه خودرو از راننده</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-300 dark:border-indigo-500/30">
                    پایش کارکرد ناوگان
                  </span>
                </>
              )}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              {selectedVehicle ? (
                <>
                  خودرو: <strong className="text-slate-900 dark:text-white">{selectedVehicle.name} ({toPersianDigits(selectedVehicle.code)})</strong> | پلاک: <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{toPersianDigits(selectedVehicle.plaque)}</strong> | راننده: <strong className="text-slate-800 dark:text-slate-200">{selectedVehicle.driverName || 'ثبت نشده'}</strong>
                </>
              ) : (
                'ثبت آخرین کارکرد کیلومتر اعلامی توسط راننده ناوگان، پایش وضعیت مصرف قطعات و بروزرسانی هوشمند موعدهای تعویض'
              )}
            </p>
          </div>
          
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors border border-transparent hover:border-slate-300 dark:border-[#2d2d30] cursor-pointer"
            title="بستن فرم و بازگشت"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* بدنه فرم ثبت یا ویرایش استعلام */}
        <form onSubmit={handleFormSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs bg-white dark:bg-[#111113]">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-bold">{formError}</span>
            </div>
          )}

          {/* ۱. ردیف اول: نام خودرو، تاریخ استعلام و کارکرد اعلامی */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
            {/* انتخاب خودرو */}
            <div className="md:col-span-6 space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                نام ماشین (جستجو و انتخاب) <span className="text-rose-500">*</span>
              </label>
              <CustomSelect
                value={vehicleId ? vehicleId.toString() : ''}
                onChange={(val) => handleVehicleChange(val)}
                placeholder="جستجو و انتخاب خودرو از لیست..."
                searchable={true}
                quickAddType="vehicle"
                options={vehicles.map(v => ({
                  value: v.id.toString(),
                  label: getVehicleDisplayName(v)
                }))}
              />
              <input type="hidden" value={vehicleId} required />
            </div>

            {/* تاریخ استعلام */}
            <div className="md:col-span-3 space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                تاریخ استعلام <span className="text-rose-500">*</span>
              </label>
              <JalaliDatePicker 
                value={inquiryDate} 
                onChange={setInquiryDate}
                className="w-full"
                inputClassName="h-[38px] text-xs font-bold rounded-md"
              />
            </div>

            {/* کارکرد اعلامی راننده (کیلومتر) */}
            <div className="md:col-span-3 space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                کارکرد اعلامی راننده (کیلومتر) <span className="text-rose-500">*</span>
              </label>
              <input 
                type="text" 
                inputMode="numeric"
                value={odometerKm !== '' ? toPersianDigits(formatNumber(odometerKm)) : ''} 
                onChange={e => {
                  const raw = parsePersianNumber(e.target.value.replace(/,/g, ''));
                  if (raw === 0 && e.target.value.trim() === '') {
                    setOdometerKm('');
                  } else {
                    setOdometerKm(raw);
                  }
                }} 
                placeholder="مثال: ۱۲۵،۰۰۰"
                className="w-full h-[38px] px-3 rounded-md border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#161619] text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono font-bold text-xs shadow-2xs"
                required 
              />
            </div>
          </div>

          {/* ۲. بخش جزئیات راننده، مقایسه پیمایش و پایش هوشمند قطعات */}
          <div className="space-y-2.5 bg-slate-50 dark:bg-[#161618] rounded-xl border border-slate-200 dark:border-[#2d2d30] p-3">
            {/* هدر بخش وضعیت و تحلیل */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-[#2d2d30]">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded border border-indigo-200 dark:border-indigo-500/20">
                  <Gauge className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    مشخصات راننده، کارکرد قبلی و وضعیت پیمایش
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    مقایسه خودکار کارکرد جدید با سابقه قبلی و پایش قطعات در آستانه سررسید
                  </p>
                </div>
              </div>

              {selectedVehicle?.driverPhone && (
                <a
                  href={`tel:${selectedVehicle.driverPhone}`}
                  className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold rounded border border-emerald-200 dark:border-emerald-800/60 transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                  title="تماس تلفنی با راننده"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>تماس با راننده ({toPersianDigits(selectedVehicle.driverPhone)})</span>
                </a>
              )}
            </div>

            {/* کارت‌های خلاصه مشخصات، مقایسه کارکرد و تاخیر از آخرین سرویس */}
            {selectedVehicle ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
                <div className="bg-white dark:bg-[#1a1a1c] p-2.5 rounded-lg border border-slate-200 dark:border-[#2d2d30] flex flex-col justify-center">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">نام راننده:</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mt-0.5 truncate">{selectedVehicle.driverName || 'بدون راننده'}</span>
                </div>

                <div className="bg-white dark:bg-[#1a1a1c] p-2.5 rounded-lg border border-slate-200 dark:border-[#2d2d30] flex flex-col justify-center">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">شماره پلاک:</span>
                  <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 block mt-0.5 truncate">{toPersianDigits(selectedVehicle.plaque)}</span>
                </div>

                <div className="bg-white dark:bg-[#1a1a1c] p-2.5 rounded-lg border border-slate-200 dark:border-[#2d2d30] flex flex-col justify-center">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">آخرین کارکرد ثبت‌شده:</span>
                  <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 block mt-0.5 truncate">
                    {toPersianDigits(formatNumber(prevKm))} کیلومتر
                  </span>
                </div>

                <div className="bg-white dark:bg-[#1a1a1c] p-2.5 rounded-lg border border-slate-200 dark:border-[#2d2d30] flex flex-col justify-center">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">وضعیت تغییر پیمایش:</span>
                  {odometerKm !== '' ? (
                    diffKm > 0 ? (
                      <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 block mt-0.5 truncate">
                        +{toPersianDigits(formatNumber(diffKm))} km افزایش
                      </span>
                    ) : diffKm < 0 ? (
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400 block mt-0.5 truncate">
                        {toPersianDigits(formatNumber(Math.abs(diffKm)))} km کمتر!
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block mt-0.5 truncate">
                        بدون تغییر کارکرد
                      </span>
                    )
                  ) : (
                    <span className="text-[11px] text-slate-400 block mt-0.5">در انتظار ورود</span>
                  )}
                </div>

                <div className="bg-white dark:bg-[#1a1a1c] p-2.5 rounded-lg border border-slate-200 dark:border-[#2d2d30] flex flex-col justify-center">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">آخرین مراجعه به سرویس:</span>
                  {serviceDelayInfo ? (
                    <div className="mt-0.5 truncate">
                      <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        {toPersianDigits(serviceDelayInfo.lastServiceDate)}
                      </span>
                      {serviceDelayInfo.lastServiceKm && (
                        <span className="text-[10px] text-slate-400 font-mono block">
                          در {toPersianDigits(formatNumber(serviceDelayInfo.lastServiceKm))} km
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 block mt-0.5">بدون سابقه سرویس</span>
                  )}
                </div>

                <div className="bg-white dark:bg-[#1a1a1c] p-2.5 rounded-lg border border-slate-200 dark:border-[#2d2d30] flex flex-col justify-center">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">تاخیر از آخرین سرویس:</span>
                  {serviceDelayInfo ? (
                    <div className="mt-0.5 truncate">
                      <span className={`text-xs font-bold font-mono block ${
                        serviceDelayInfo.daysPassed > 30 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        {toPersianDigits(serviceDelayInfo.daysPassed)} روز تاخیر
                      </span>
                      {serviceDelayInfo.kmPassed !== null && (
                        <span className="text-[10px] text-slate-400 font-mono block">
                          +{toPersianDigits(formatNumber(serviceDelayInfo.kmPassed))} km پیمایش
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 block mt-0.5">بدون سابقه</span>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* ۳. بخش پیش‌بینی هوشمند تاریخ سررسید قطعات (قبل و بعد از ورود کیلومتر) */}
          {livePredictions.length > 0 && (
            <div className="space-y-2 bg-white dark:bg-[#111113] rounded-xl border border-slate-200 dark:border-[#2d2d30] p-3 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-[#2d2d30]">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded border border-violet-200 dark:border-violet-500/20">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-2">
                      <span>پیش‌بینی تاریخ سررسید قطعات و خدمات</span>
                      {isAfterKmActive ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50">
                          به‌روزرسانی شده بر اساس پیمایش این بازه ({toPersianDigits(samplePrediction?.recentDailyMileage || 0)} کیلومتر/روز)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700/50">
                          بر مبنای سوابق تاریخی گذشته ({toPersianDigits(samplePrediction?.historicalDailyMileage || 0)} کیلومتر/روز)
                        </span>
                      )}
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {isAfterKmActive && samplePrediction ? (
                        <>
                          در بازه مراجعه قبلی تا تاریخ اعلام: <strong className="text-slate-800 dark:text-slate-200">{toPersianDigits(samplePrediction.daysSinceLastService || 0)} روز</strong> سپری شده و <strong className="text-indigo-600 dark:text-indigo-400">{toPersianDigits(formatNumber(samplePrediction.distanceSinceLastService || 0))} کیلومتر</strong> تردد داشته است.
                        </>
                      ) : (
                        'پیش از ثبت کیلومتر جدید، تاریخ سررسید بر اساس سوابق گذشته محاسبه شده و با ثبت کیلومتر بر اساس پیمایش واقعی بازه به‌روزرسانی می‌شود.'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* جدول پیش‌بینی قطعات */}
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#2d2d30]">
                <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-[#161618] border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-bold text-[10px]">
                      <th className="py-2 px-2.5">عنوان خدمت</th>
                      <th className="py-2 px-2.5 text-center">آخرین تعویض</th>
                      <th className="py-2 px-2.5 text-center">موعد بعدی (کیلومتر)</th>
                      <th className="py-2 px-2.5 text-center">مانده کیلومتر</th>
                      <th className="py-2 px-2.5 text-center">تاریخ سررسید پیش‌بینی‌شده</th>
                      <th className="py-2 px-2.5 text-center">وضعیت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]">
                    {livePredictions.map(item => {
                      const isNoHistory = !item.hasHistory || item.status === 'no_history';
                      const isOverdue = !isNoHistory && item.status === 'overdue';
                      const isWarning = !isNoHistory && item.status === 'warning';

                      return (
                        <tr key={item.definitionId} className="hover:bg-slate-50/50 dark:hover:bg-[#1a1a1c]/40">
                          <td className="py-2 px-2.5 font-bold text-slate-900 dark:text-white">
                            {item.serviceType}
                          </td>
                          <td className="py-2 px-2.5 text-center font-mono text-[10px] text-slate-600 dark:text-slate-400">
                            {!isNoHistory && item.lastServicedKm > 0 ? `${toPersianDigits(formatNumber(item.lastServicedKm))} کیلومتر (${toPersianDigits(item.lastServicedDate)})` : 'فاقد سابقه قبلی'}
                          </td>
                          <td className="py-2 px-2.5 text-center font-mono font-bold text-slate-900 dark:text-white">
                            {item.targetDueKm > 0 ? toPersianDigits(formatNumber(item.targetDueKm)) : '—'}
                          </td>
                          <td className="py-2 px-2.5 text-center font-mono font-bold">
                            {isNoHistory ? (
                              <span className="text-emerald-600 dark:text-emerald-400 text-xs">
                                {item.remainingKm > 0 ? `${toPersianDigits(formatNumber(item.remainingKm))} کیلومتر مانده` : '—'}
                              </span>
                            ) : isOverdue ? (
                              <span className="text-rose-600 dark:text-rose-400">
                                {toPersianDigits(formatNumber(Math.abs(item.remainingKm)))} کیلومتر گذشته
                              </span>
                            ) : (
                              <span className={isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                                {toPersianDigits(formatNumber(item.remainingKm))} کیلومتر مانده
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2.5 text-center">
                            {isNoHistory ? (
                              <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                                {item.predictedDate && item.predictedDate !== 'نامشخص (فاقد سابقه گذشته)' ? toPersianDigits(item.predictedDate) : '—'}
                              </span>
                            ) : isOverdue ? (
                              <span className="text-rose-600 dark:text-rose-400 font-bold text-[10px]">
                                سررسید شده (اقدام فوری)
                              </span>
                            ) : (
                              <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                                {toPersianDigits(item.predictedDate)}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isNoHistory
                                ? 'bg-slate-100 text-slate-700 dark:bg-[#202024] dark:text-slate-300 border border-slate-200 dark:border-[#2d2d30]'
                                : isOverdue
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                : isWarning
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            }`}>
                              {isNoHistory ? 'مبدا ورود (موعد اول)' : isOverdue ? 'منقضی' : isWarning ? 'در بازه اخطار' : 'سالم'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ۴. سوابق قبلی استعلام این خودرو در صورت وجود */}
          {vehicleLogs.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px] flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  <span>سوابق استعلام‌های قبلی ثبت‌شده برای این خودرو ({toPersianDigits(vehicleLogs.length)} مورد)</span>
                </span>
                <span className="text-[10px] text-slate-400">امکان حذف استعلام‌های اشتباه با دکمه سطل زباله</span>
              </div>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-[#2d2d30] bg-slate-50/50 dark:bg-[#151518]/50">
                <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-100/70 dark:bg-[#1a1a1e] text-slate-500 dark:text-slate-400 text-[10px]">
                      <th className="py-1.5 px-2 text-center w-8">#</th>
                      <th className="py-1.5 px-2">تاریخ و ساعت</th>
                      <th className="py-1.5 px-2">کارکرد (کیلومتر)</th>
                      <th className="py-1.5 px-2">اختلاف</th>
                      <th className="py-1.5 px-2">ثبت‌کننده / منبع</th>
                      <th className="py-1.5 px-2 text-center w-16">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-[#2d2d30]/60">
                    {vehicleLogs.map((l, i) => {
                      const isCurrentEditing = editingLog?.id === l.id;
                      return (
                        <tr 
                          key={l.id} 
                          className={`hover:bg-slate-100/80 dark:hover:bg-[#1f1f24] transition-colors ${
                            isCurrentEditing ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''
                          }`}
                        >
                          <td className="py-1 px-2 text-center text-slate-400 text-[10px]">{toPersianDigits(i + 1)}</td>
                          <td className="py-1 px-2 whitespace-nowrap">
                            <span className="font-mono font-medium">{toPersianDigits(l.inquiryDate)}</span>
                            {l.inquiryTime && (
                              <span className="text-[10px] text-slate-400 mr-1.5 font-mono">({toPersianDigits(l.inquiryTime)})</span>
                            )}
                          </td>
                          <td className="py-1 px-2 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {toPersianDigits(formatNumber(l.odometerKm))}
                          </td>
                          <td className="py-1 px-2 font-mono text-slate-500 text-[10px]">
                            {l.differenceKm !== undefined ? `+${toPersianDigits(formatNumber(l.differenceKm))}` : '-'}
                          </td>
                          <td className="py-1 px-2 text-slate-500 text-[10px] truncate max-w-[120px]">
                            {l.recordedBy || l.source || '-'}
                          </td>
                          <td className="py-1 px-2 text-center">
                            {onDelete && (
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm(`آیا از حذف استعلام ${toPersianDigits(formatNumber(l.odometerKm))} کیلومتر تاریخ ${toPersianDigits(l.inquiryDate)} اطمینان دارید؟`)) {
                                    try {
                                      await onDelete(l.id);
                                    } catch (err: any) {
                                      setFormError(err?.message || 'خطا در حذف استعلام');
                                    }
                                  }
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                                title="حذف این استعلام"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ۵. شرح استعلام یا توضیحات و گزارش راننده */}
          <div className="space-y-1 pt-1">
            <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
              شرح استعلام یا توضیحات و گزارش راننده (اختیاری)
            </label>
            <input 
              type="text" 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              placeholder="مثال: راننده گزارش داد خودرو در مسیر تردد عادی است و وضعیت کارکرد منظم می‌باشد..."
              className="w-full h-[38px] px-3 rounded-md border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#161619] text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs placeholder-slate-400 dark:placeholder-slate-600 font-medium shadow-2xs" 
            />
          </div>

          {/* ۶. نوار دکمه‌های اقدام انتهای فرم */}
          <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-[#2d2d30]">
            <div>
              {editingLog && onDelete && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={async () => {
                    if (confirm(`آیا از حذف استعلام شماره #${toPersianDigits(editingLog.id)} (${toPersianDigits(formatNumber(editingLog.odometerKm))} کیلومتر در تاریخ ${toPersianDigits(editingLog.inquiryDate)}) اطمینان دارید؟`)) {
                      setIsSubmitting(true);
                      try {
                        await onDelete(editingLog.id);
                        onClose();
                      } catch (err: any) {
                        setFormError(err?.message || 'خطا در حذف استعلام');
                        setIsSubmitting(false);
                      }
                    }
                  }}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 font-bold rounded-md transition-colors border border-rose-200 dark:border-rose-900/50 text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="حذف این استعلام"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف این استعلام</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button 
                type="button" 
                onClick={onClose} 
                className="px-3 py-1.5 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-400 font-bold rounded-md transition-colors border border-slate-200 dark:border-[#2d2d30] text-xs cursor-pointer"
              >
                انصراف
              </button>

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-md transition-colors text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'در حال ثبت...' : editingLog ? 'بروزرسانی استعلام' : 'ثبت استعلام و بروزرسانی کارکرد'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

