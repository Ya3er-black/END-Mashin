/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PeriodicService, ServiceDefinition, Vehicle, OdometerLog, VehicleFailure } from '../types';
import { jalaliDayDifference, addDaysToJalaliDate, getCurrentJalaliDate } from './date';
import { doesItemMatchService, findLastServiceOrRepairEvent } from './serviceMatching';

/**
 * ساختار خروجی پیش‌بینی موعد سرویس در بخش پذیرش خودرو (بخش اول)
 */
export interface ReceptionPredictionResult {
  hasHistory: boolean;
  nextDate: string; // در صورت عدم وجود سابقه کافی حتماً خالی است
  nextKm: number;
  dailyMileage: number | null; // میانگین پیمایش روزانه وزنی
  estimatedDays: number | null;
  basis: string;
  sampleCount: number;
}

/**
 * ساختار خروجی پیش‌بینی موعد سرویس در بخش استعلام و پایش خودرو (بخش دوم)
 */
export interface InquiryPredictionResult {
  state: 'before_km' | 'after_km' | 'no_history';
  hasHistory: boolean;
  definitionId: number;
  serviceType: string;
  intervalKm: number;
  warningKm: number;
  lastServicedKm: number;
  lastServicedDate: string;
  targetDueKm: number;
  
  // مقادیر کیلومتر و مانده
  currentKm: number;
  remainingKm: number;
  elapsedKm: number;
  progressPercent: number;

  // اطلاعات پیمایش
  historicalDailyMileage: number;
  recentDailyMileage?: number;
  updatedDailyMileage?: number;
  daysSinceLastService?: number;
  distanceSinceLastService?: number;

  // وضعیت و پیش‌بینی
  status: 'safe' | 'warning' | 'overdue' | 'no_history';
  statusLabel: string;
  daysRemaining: number;
  predictedDate: string;
  predictedDateLabel: string; // «موعد احتمالی مراجعه: ...» یا «موعد پیشنهادی جدید: ...»
  predictionType: string; // «پیش‌بینی بر اساس سوابق تاریخی» یا «پیش‌بینی به‌روزرسانی شده بر اساس پیمایش واقعی»
  basisLabel: string; // «سوابق قبلی خودرو» یا «پیمایش واقعی از آخرین سرویس»
}

// ----------------------------------------------------------------------------------
// بخش اول: منطق پذیرش خودرو (Reception Logic)
// ----------------------------------------------------------------------------------

/**
 * محاسبه موعد بعدی سرویس برای یک خدمت در زمان پذیرش خودرو
 * 
 * قانون پذیرش:
 * - فقط اطلاعات تاریخی برای پیش‌بینی موعد بعدی استفاده می‌شود.
 * - سوابق قبلی همان خدمت بررسی می‌شود (تاریخ‌های قبلی و کیلومترهای قبلی).
 * - اگر سابقه قبلی وجود داشته باشد:
 *     Distance = Current_Service_Km - Previous_Service_Km
 *     Days = Current_Service_Date - Previous_Service_Date
 *     Daily_Mileage = Distance / Days
 *   در صورت وجود چند سابقه، میانگین وزنی محاسبه شده و داده‌های جدیدتر وزن بیشتری دارند.
 * - اگر سابقه کافی وجود نداشته باشد، تاریخ پیشنهادی خالی است و هیچ تاریخ فرضی تولید نمی‌شود.
 */
export function calculateReceptionNextService(params: {
  vehicleId: number;
  serviceType: string;
  currentServiceDate: string;
  currentServiceKm: number;
  intervalKm: number;
  allServices: PeriodicService[];
  allFailures?: VehicleFailure[];
  allVehicles?: Vehicle[];
  editingSessionItems?: PeriodicService[];
}): ReceptionPredictionResult {
  const {
    vehicleId,
    serviceType,
    currentServiceDate,
    currentServiceKm,
    intervalKm,
    allServices,
    allFailures = [],
    allVehicles = [],
    editingSessionItems = []
  } = params;

  const effectiveInterval = Number(intervalKm) > 0 ? Number(intervalKm) : 5000;
  const safeCurrentKm = Number(currentServiceKm) || 0;
  const nextKm = safeCurrentKm + effectiveInterval;

  if (!vehicleId || !currentServiceKm || !currentServiceDate) {
    return {
      hasHistory: false,
      nextDate: '',
      nextKm,
      dailyMileage: null,
      estimatedDays: null,
      basis: 'اطلاعات ناقص',
      sampleCount: 0
    };
  }

  // ۱. شناسه‌های ردیف‌های جلسه در حال ویرایش برای عدم احتساب تکراری
  const excludeServiceIds = new Set(editingSessionItems.map(i => i.id));

  interface HistoryVisitPoint {
    date: string;
    km: number;
    isMatchingService?: boolean;
  }

  // ۲. جمع‌آوری تمام دفعات مراجعه خودرو در سیستم (سرویس‌های دوره‌ای و تعمیرات قبلی)
  const rawPastPoints: HistoryVisitPoint[] = [];

  // از جدول سرویس‌های دوره‌ای (کلیه مراجعات ثبت‌شده خودرو قبل از این کیلومتر)
  allServices
    .filter(s => Number(s.vehicleId) === Number(vehicleId) && !excludeServiceIds.has(s.id))
    .forEach(s => {
      const sKm = Number(s.currentKm) || 0;
      if (s.serviceDate && sKm > 0 && sKm < safeCurrentKm) {
        const isMatch = doesItemMatchService(serviceType, '', '', s.serviceType, '');
        rawPastPoints.push({
          date: s.serviceDate,
          km: sKm,
          isMatchingService: isMatch
        });
      }
    });

  // از جدول تعمیرات/خرابی
  allFailures
    .filter(f => Number(f.vehicleId) === Number(vehicleId))
    .forEach(f => {
      const fKm = Number(f.odometer) || 0;
      if (f.failureDate && fKm > 0 && fKm < safeCurrentKm) {
        const isMatch = doesItemMatchService(serviceType, '', '', '', (f.description || '') + ' ' + (f.failureType || ''));
        rawPastPoints.push({
          date: f.failureDate,
          km: fKm,
          isMatchingService: isMatch
        });
      }
    });

  // مرتب‌سازی صعودی بر اساس کیلومتر
  rawPastPoints.sort((a, b) => Number(a.km) - Number(b.km));

  // پاکسازی مراجعات تکراری: اگر در یک روز و یک کیلومتر چند قلم ثبت شده، ۱ نوبت مراجعه شمرده شود
  const uniquePastVisits: HistoryVisitPoint[] = [];
  rawPastPoints.forEach(pt => {
    const existing = uniquePastVisits.find(u => u.km === pt.km || u.date === pt.date);
    if (!existing) {
      uniquePastVisits.push(pt);
    } else if (pt.isMatchingService) {
      existing.isMatchingService = true;
    }
  });

  // اگر هیچ سابقه گذشته‌ای وجود ندارد (این مراجعه، بار اول اول خودرو است) -> تاریخ پیشنهادی خالی می‌ماند
  if (uniquePastVisits.length === 0) {
    return {
      hasHistory: false,
      nextDate: '',
      nextKm,
      dailyMileage: null,
      estimatedDays: null,
      basis: 'خودرو فاقد سابقه مراجعه قبلی است',
      sampleCount: 0
    };
  }

  // ۳. تشکیل زنجیره کامل دفعاتی که خودرو آمده است (مراجعات قبلی + مراجعه فعلی)
  const currentPoint: HistoryVisitPoint = {
    date: currentServiceDate,
    km: currentServiceKm,
    isMatchingService: true
  };

  const visitsChain: HistoryVisitPoint[] = [...uniquePastVisits, currentPoint];

  // ۴. محاسبه فواصل بین دفعات مراجعه متوالی خودرو
  interface IntervalStat {
    distance: number;
    days: number;
    dailyMileage: number;
  }
  const intervals: IntervalStat[] = [];

  for (let i = 1; i < visitsChain.length; i++) {
    const prev = visitsChain[i - 1];
    const curr = visitsChain[i];
    const distance = curr.km - prev.km;
    let days = jalaliDayDifference(prev.date, curr.date);

    // در صورتی که تاریخ هر دو مراجعه در یک روز باشد، برای جلوگیری از تقسیم بر صفر حداقل ۱ روز در نظر گرفته می‌شود
    if (days <= 0 && distance > 0) {
      days = 1;
    }

    if (distance > 0 && days > 0) {
      const dailyMileage = distance / days;
      // بررسی بازه منطقی پیمایش خودرو
      if (dailyMileage >= 0.5 && dailyMileage <= 2000) {
        intervals.push({ distance, days, dailyMileage });
      }
    }
  }

  // در صورت عدم امکان محاسبه فاصله معتبر
  if (intervals.length === 0) {
    return {
      hasHistory: false,
      nextDate: '',
      nextKm,
      dailyMileage: null,
      estimatedDays: null,
      basis: 'فاصله کارکرد معتبری بین مراجعات محاسبه نشد',
      sampleCount: 0
    };
  }

  // ۵. محاسبه میانگین کارکرد روزانه از تعداد دفعاتی که خودرو آمده است
  // الف) مجموع کل کیلومتر طی شده در فواصل تقسیم بر مجموع کل روزها
  const totalDistance = intervals.reduce((acc, curr) => acc + curr.distance, 0);
  const totalDays = intervals.reduce((acc, curr) => acc + curr.days, 0);
  const overallAverageRate = totalDays > 0 ? (totalDistance / totalDays) : 0;

  // ب) میانگین وزنی فواصل (فواصل اخیر بیشترین ضریب و اهمیت را دارند)
  let totalWeightedMileage = 0;
  let totalWeights = 0;
  intervals.forEach((interval, idx) => {
    const weight = idx + 1;
    totalWeightedMileage += interval.dailyMileage * weight;
    totalWeights += weight;
  });
  const weightedDailyMileage = totalWeights > 0 ? (totalWeightedMileage / totalWeights) : overallAverageRate;

  // تلفیق بهینه: برای تک‌فاصله (دفعه دوم) دقیقاً برابر با همان بازه است، برای چند نوبت ترکیبی هوشمند
  const effectiveDailyMileage = intervals.length === 1 
    ? intervals[0].dailyMileage 
    : (weightedDailyMileage * 0.7 + overallAverageRate * 0.3);

  if (effectiveDailyMileage <= 0 || !isFinite(effectiveDailyMileage)) {
    return {
      hasHistory: false,
      nextDate: '',
      nextKm,
      dailyMileage: null,
      estimatedDays: null,
      basis: 'داده‌های کارکرد تاریخی ناکافی',
      sampleCount: intervals.length
    };
  }

  // ۶. تخمین روزهای باقیمانده تا سررسید سرویس بعدی بر اساس میانگین کارکرد دفعات مراجعه
  const estimatedDays = Math.max(1, Math.round(effectiveInterval / effectiveDailyMileage));
  const nextDate = addDaysToJalaliDate(currentServiceDate, estimatedDays);

  const totalVisitsCount = visitsChain.length;

  return {
    hasHistory: true,
    nextDate,
    nextKm,
    dailyMileage: Math.round(effectiveDailyMileage * 10) / 10,
    estimatedDays,
    basis: `محاسبه بر اساس میانگین کارکرد در ${totalVisitsCount} نوبت مراجعه خودرو (${Math.round(effectiveDailyMileage)} کیلومتر در روز)`,
    sampleCount: intervals.length
  };
}

// ----------------------------------------------------------------------------------
// بخش دوم: منطق استعلام خودرو (Inquiry & Monitoring Logic)
// ----------------------------------------------------------------------------------

/**
 * محاسبه میانگین پیمایش روزانه بر اساس سوابق تاریخی خودرو
 */
export function calculateVehicleHistoricalDailyMileage(
  vehicleId: number,
  allServices: PeriodicService[],
  allFailures: VehicleFailure[] = [],
  fallbackRate: number = 75
): number {
  interface HistoryEntry {
    date: string;
    km: number;
  }

  const entries: HistoryEntry[] = [];

  // جمع‌آوری کلیه مراجعات سرویس دوره‌ای
  allServices
    .filter(s => s.vehicleId === vehicleId && s.status !== 'in_progress' && s.serviceDate && s.currentKm)
    .forEach(s => entries.push({ date: s.serviceDate, km: s.currentKm }));

  // جمع‌آوری کلیه خرابی‌های ثبت‌شده
  allFailures
    .filter(f => f.vehicleId === vehicleId && f.failureDate && f.odometer)
    .forEach(f => entries.push({ date: f.failureDate, km: f.odometer }));

  if (entries.length < 2) {
    return fallbackRate;
  }

  // مرتب‌سازی بر اساس تاریخ و کیلومتر
  entries.sort((a, b) => a.km - b.km);

  // پاکسازی تکراری‌ها
  const uniqueEntries: HistoryEntry[] = [];
  entries.forEach(e => {
    if (!uniqueEntries.some(u => u.km === e.km || u.date === e.date)) {
      uniqueEntries.push(e);
    }
  });

  if (uniqueEntries.length < 2) {
    return fallbackRate;
  }

  // محاسبه فواصل متوالی
  const rates: { rate: number; weight: number }[] = [];
  for (let i = 1; i < uniqueEntries.length; i++) {
    const prev = uniqueEntries[i - 1];
    const curr = uniqueEntries[i];
    const dist = curr.km - prev.km;
    const days = jalaliDayDifference(prev.date, curr.date);
    if (dist > 0 && days > 0) {
      const daily = dist / days;
      if (daily >= 5 && daily <= 1000) {
        rates.push({ rate: daily, weight: i });
      }
    }
  }

  if (rates.length === 0) {
    return fallbackRate;
  }

  let sumRate = 0;
  let sumWeight = 0;
  rates.forEach(r => {
    sumRate += r.rate * r.weight;
    sumWeight += r.weight;
  });

  return Math.round(sumRate / sumWeight);
}

/**
 * محاسبه پیش‌بینی دو وضعیتی استعلام خودرو (قبل و بعد از ثبت کیلومتر فعلی)
 * 
 * وضعیت اول: قبل از ثبت کیلومتر فعلی
 *   Historical_Data -> Historical_Daily_Mileage -> Interval_Km -> Estimated_Remaining_Days -> Predicted_Service_Date
 *   خروجی: «موعد سررسید پیش‌بینی‌شده (بر اساس سوابق تاریخی): ...»
 * 
 * وضعیت دوم: بعد از ثبت کیلومتر فعلی
 *   اطلاعات بازه: تاریخ پذیرش/سرویس قبلی تا تاریخ اعلام کیلومتر فعلی
 *   Distance_Since_Last_Service = Current_Kilometer - Last_Service_Kilometer
 *   Days_Since_Last_Service = Current_Date - Last_Service_Date (تعداد روزهای سپری شده از مراجعه قبلی)
 *   Recent_Daily_Mileage = Distance_Since_Last_Service / Days_Since_Last_Service (نرخ پیمایش واقعی در این بازه)
 *   Remaining_Kilometer = Target_Kilometer - Current_Kilometer
 *   Estimated_Remaining_Days = Remaining_Kilometer / Recent_Daily_Mileage
 *   Updated_Service_Date = addDaysToJalaliDate(Current_Date, Estimated_Remaining_Days)
 *   خروجی:
 *   «تعداد روز گذشته از مراجعه قبلی: ... روز»
 *   «کیلومتر حرکت کرده در این بازه: ... کیلومتر»
 *   «نرخ پیمایش واقعی: ... کیلومتر در روز»
 *   «تاریخ سررسید به‌روزرسانی شده: ...»
 */
export function calculateInquiryServicePrediction(params: {
  vehicle: Vehicle;
  serviceDef: ServiceDefinition;
  services: PeriodicService[];
  failures?: VehicleFailure[];
  workflows?: any[];
  parts?: any[];
  odometerLogs?: OdometerLog[];
  // اگر کاربر در حال حاضر در فرم استعلام، مقادیر جدید را وارد کرده است
  activeInquiryInput?: {
    inquiryDate: string;
    odometerKm: number | '';
  } | null;
  customDailyRate?: number;
}): InquiryPredictionResult {
  const {
    vehicle,
    serviceDef,
    services,
    failures = [],
    workflows = [],
    parts = [],
    odometerLogs = [],
    activeInquiryInput,
    customDailyRate
  } = params;

  const intervalKm = serviceDef.intervalKm || 5000;
  const warningKm = serviceDef.warningKm || 300;

  // ۱. یافتن آخرین سرویس یا رویداد تعمیراتی برای این خدمت
  const lastEvent = findLastServiceOrRepairEvent(vehicle.id, serviceDef, services, failures, workflows, parts);
  const lastServicedKm = lastEvent.lastServicedKm;
  const lastServicedDate = lastEvent.lastServicedDate || vehicle.createdAt?.split('T')[0] || getCurrentJalaliDate();
  const targetDueKm = lastServicedKm + intervalKm;

  // ۲. محاسبه پیمایش روزانه تاریخی خودرو (Historical Daily Mileage)
  const historicalDailyMileage = customDailyRate && customDailyRate > 0
    ? customDailyRate
    : calculateVehicleHistoricalDailyMileage(vehicle.id, services, failures, 75);

  // اگر خودرو فاقد سابقه سرویس یا تعویض قبلی برای این قطعه در سیستم است:
  // طبق اصل سیستم: اطلاعات قبل از ورود خودرو به سیستم مشخص نیست، بنابراین مبنای محاسبه کیلومتر مبدا/جاری خودرو است
  // و موعد بعدی برابر با (کیلومتر ورود + بازه سرویس) محاسبه شده و نباید سررسید گذشته فرض شود.
  if (!lastEvent.hasHistory) {
    const baseKm = (vehicle.currentKm && vehicle.currentKm > 0)
      ? vehicle.currentKm
      : ((serviceDef.lastServicedKm && serviceDef.lastServicedKm > 0) ? serviceDef.lastServicedKm : 0);
    
    let currentKm = baseKm;
    let currentDate = vehicle.createdAt?.split('T')[0] || getCurrentJalaliDate();

    if (activeInquiryInput !== undefined && activeInquiryInput !== null) {
      if (activeInquiryInput.odometerKm !== '' && Number(activeInquiryInput.odometerKm) > 0) {
        currentKm = Number(activeInquiryInput.odometerKm);
        currentDate = activeInquiryInput.inquiryDate || getCurrentJalaliDate();
      }
    } else {
      const vehicleLogs = odometerLogs
        .filter(l => l.vehicleId === vehicle.id)
        .sort((a, b) => b.id - a.id);
      const latestLog = vehicleLogs[0];
      if (latestLog && latestLog.odometerKm > 0) {
        currentKm = latestLog.odometerKm;
        currentDate = latestLog.inquiryDate || getCurrentJalaliDate();
      }
    }

    const targetDueKm = baseKm + intervalKm;
    const remainingKm = targetDueKm - currentKm;
    const elapsedKm = Math.max(0, currentKm - baseKm);
    const progressPercent = Math.min(100, Math.max(0, Math.round((elapsedKm / intervalKm) * 100)));
    const daysRemaining = 0;
    const predictedDate = '-';

    const status: 'safe' | 'warning' | 'overdue' | 'no_history' = 'no_history';
    const statusLabel = 'فاقد سابقه از دوره قبل';

    return {
      state: 'no_history',
      hasHistory: false,
      definitionId: serviceDef.id,
      serviceType: serviceDef.serviceType,
      intervalKm,
      warningKm,
      lastServicedKm: 0,
      lastServicedDate: 'فاقد سابقه قبلی',
      targetDueKm,
      currentKm,
      remainingKm,
      elapsedKm,
      progressPercent,
      historicalDailyMileage,
      status,
      statusLabel,
      daysRemaining,
      predictedDate,
      predictedDateLabel: 'تاریخ سررسید: - (فاقد سابقه از دوره قبل)',
      predictionType: 'فاقد سابقه از دوره قبل',
      basisLabel: 'اطلاعات از دوره قبل ثبت نشده است'
    };
  }

  // ۳. بررسی وضعیت ثبت استعلام جدید یا مقدار در حال ورود
  let currentKm = lastServicedKm;
  let currentDate = lastServicedDate;
  let isAfterKm = false;

  if (activeInquiryInput !== undefined && activeInquiryInput !== null) {
    if (activeInquiryInput.odometerKm !== '' && Number(activeInquiryInput.odometerKm) > 0) {
      currentKm = Number(activeInquiryInput.odometerKm);
      currentDate = activeInquiryInput.inquiryDate || getCurrentJalaliDate();
      if (currentKm > lastServicedKm) {
        isAfterKm = true;
      }
    }
  } else {
    // بررسی آخرین استعلام ثبت‌شده در سیستم برای این خودرو
    const vehicleLogs = odometerLogs
      .filter(l => l.vehicleId === vehicle.id)
      .sort((a, b) => b.id - a.id);

    const latestLog = vehicleLogs[0];
    if (latestLog && latestLog.odometerKm > lastServicedKm) {
      currentKm = latestLog.odometerKm;
      currentDate = latestLog.inquiryDate;
      isAfterKm = true;
    } else if (vehicle.currentKm && vehicle.currentKm > lastServicedKm) {
      currentKm = vehicle.currentKm;
      currentDate = getCurrentJalaliDate();
      isAfterKm = true;
    }
  }

  // -------------------------------------------------------------
  // وضعیت اول: قبل از وارد کردن کیلومتر فعلی (Before recording current km)
  // نشان دادن تاریخ سررسید پیش‌بینی شده نسبت به گذشته
  // -------------------------------------------------------------
  if (!isAfterKm || currentKm <= lastServicedKm) {
    const remainingKm = intervalKm;
    const elapsedKm = 0;
    const progressPercent = 0;
    const daysRemaining = Math.max(1, Math.round(remainingKm / (historicalDailyMileage || 75)));
    const predictedDate = addDaysToJalaliDate(lastServicedDate, daysRemaining);

    return {
      state: 'before_km',
      hasHistory: true,
      definitionId: serviceDef.id,
      serviceType: serviceDef.serviceType,
      intervalKm,
      warningKm,
      lastServicedKm,
      lastServicedDate,
      targetDueKm,
      currentKm: lastServicedKm,
      remainingKm,
      elapsedKm,
      progressPercent,
      historicalDailyMileage,
      status: 'safe',
      statusLabel: 'کارکرد مطلوب (بر مبنای سوابق گذشته)',
      daysRemaining,
      predictedDate,
      predictedDateLabel: `موعد سررسید پیش‌بینی‌شده (سوابق گذشته): ${predictedDate}`,
      predictionType: 'پیش‌بینی بر اساس سوابق تاریخی',
      basisLabel: 'سوابق قبلی خودرو'
    };
  }

  // -------------------------------------------------------------
  // وضعیت دوم: بعد از ثبت کیلومتر فعلی (After recording current km)
  // محاسبه دقیق بر اساس تعداد روز گذشته از مراجعه قبلی و کیلومتر طی شده در آن بازه
  // -------------------------------------------------------------
  const distanceSinceLastService = Math.max(0, currentKm - lastServicedKm);
  const rawDays = jalaliDayDifference(lastServicedDate, currentDate);
  const daysSinceLastService = Math.max(1, rawDays);

  // نرخ پیمایش واقعی در بازه پذیرش قبلی تا تاریخ اعلام کیلومتر فعلی:
  let recentDailyMileage = distanceSinceLastService / daysSinceLastService;
  if (recentDailyMileage <= 0 || !isFinite(recentDailyMileage)) {
    recentDailyMileage = historicalDailyMileage;
  }

  // استفاده مستقیم از میانگین پیمایش واقعی در این بازه جهت محاسبه روزهای باقیمانده تا سررسید
  const effectiveDailyMileage = recentDailyMileage > 0 ? recentDailyMileage : (historicalDailyMileage || 75);
  const remainingKm = targetDueKm - currentKm;
  const elapsedKm = distanceSinceLastService;
  const progressPercent = Math.min(100, Math.max(0, Math.round((elapsedKm / intervalKm) * 100)));

  let status: 'safe' | 'warning' | 'overdue' = 'safe';
  let statusLabel = 'کارکرد مطلوب';
  let daysRemaining = 0;
  let predictedDate = '';

  if (remainingKm <= 0) {
    status = 'overdue';
    statusLabel = 'موعد تعویض گذشته (نیازمند اقدام)';
    daysRemaining = 0;
    predictedDate = 'هم‌اکنون سررسید شده';
  } else if (remainingKm <= warningKm) {
    status = 'warning';
    statusLabel = 'در بازه اخطار';
    daysRemaining = Math.max(1, Math.round(remainingKm / effectiveDailyMileage));
    predictedDate = addDaysToJalaliDate(currentDate, daysRemaining);
  } else {
    status = 'safe';
    statusLabel = 'کارکرد مطلوب';
    daysRemaining = Math.max(1, Math.round(remainingKm / effectiveDailyMileage));
    predictedDate = addDaysToJalaliDate(currentDate, daysRemaining);
  }

  return {
    state: 'after_km',
    hasHistory: true,
    definitionId: serviceDef.id,
    serviceType: serviceDef.serviceType,
    intervalKm,
    warningKm,
    lastServicedKm,
    lastServicedDate,
    targetDueKm,
    currentKm,
    remainingKm,
    elapsedKm,
    progressPercent,
    historicalDailyMileage,
    recentDailyMileage: Math.round(recentDailyMileage * 10) / 10,
    updatedDailyMileage: Math.round(effectiveDailyMileage),
    daysSinceLastService,
    distanceSinceLastService,
    status,
    statusLabel,
    daysRemaining,
    predictedDate,
    predictedDateLabel: status === 'overdue' ? 'سررسید شده - اقدام فوری' : `موعد سررسید به‌روزرسانی شده: ${predictedDate}`,
    predictionType: 'پیش‌بینی به‌روزرسانی شده بر اساس پیمایش واقعی',
    basisLabel: `پیمایش در بازه مراجعه قبلی تا تاریخ اعلام (${distanceSinceLastService} km در ${daysSinceLastService} روز)`
  };
}
