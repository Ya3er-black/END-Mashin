/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Vehicle, PeriodicService, VehicleFailure, RepairWorkflow, PartInventory, ServiceDefinition, OdometerLog } from '../types';
import { getCurrentJalaliDate, addDaysToJalaliDate } from './date';
import { calculateInquiryServicePrediction } from './predictionEngine';

// نگاشت کلیدواژه‌های هوشمند برای تطبیق خودکار قطعات و تعمیرات با خدمات دوره‌ای
const SERVICE_KEYWORDS_MAP: Record<string, string[]> = {
  'تسمه تایم': ['تسمه تایم', 'تسمه تایمینگ', 'تایمینگ', 'timing belt', 'هرزگرد تایم', 'سفت‌کن تایم', 'کیت تایم', 'تسمه ۴۰۵', 'تسمه tu5', 'تسمه ef7'],
  'تسمه دینام': ['تسمه دینام', 'تسمه کولر', 'تسمه هیدرولیک', 'هرزگرد دینام', 'alternator belt'],
  'روغن موتور': ['روغن موتور', 'تعویض روغن', 'فیلتر روغن', 'فیلتر هوا', 'فیلتر کابین', 'سرویس روغن', 'روغن 10w40', 'روغن 5w30', 'روغن 20w50', 'سرکان', 'بهران', 'کاسترول', 'ایرانول'],
  'روغن گیربکس': ['واسکازین', 'روغن گیربکس', 'گیربکس', 'دیفرانسیل', 'روغن دنده', 'gearbox oil', 'روغن اتومات'],
  'لنت ترمز جلو': ['لنت ترمز جلو', 'لنت جلو', 'دیسک چرخ جلو', 'brake pad front', 'لنت چرخ جلو'],
  'لنت ترمز عقب': ['لنت ترمز عقب', 'لنت عقب', 'کفشک ترمز', 'کاسه چرخ', 'brake pad rear', 'لنت چرخ عقب'],
  'لنت': ['لنت ترمز', 'لنت', 'کفشک', 'دیسک ترمز'],
  'شمع': ['شمع', 'شمع موتور', 'وایر شمع', 'وایر', 'spark plug', 'شمع سوزنی', 'شمع بوش', 'شمع ان جی کی', 'ngk'],
  'ضدیخ': ['ضدیخ', 'خنک‌کننده', 'مایع رادیاتور', 'رادیاتور', 'واترپمپ', 'واتر پمپ', 'کولانت', 'antifreeze'],
  'لاستیک': ['لاستیک', 'تایر', 'رویه لاستیک', 'بارز', 'کویر', 'یزد تایر', 'میشلن', 'هانکوک', 'tire'],
  'باتری': ['باتری', 'باطری', 'battery', '۷۴ آمپر', '۶۰ آمپر', '۵۵ آمپر', 'سپاهان', 'صبا باتری', 'اوربیتال', 'برنا'],
  'کلاچ': ['دیسک و صفحه', 'کلاچ', 'کلاج', 'بلبرینگ کلاچ', 'کیت کلاچ', 'والئو', 'سکو'],
  'کمک فنر': ['کمک فنر', 'کمک جلو', 'کمک عقب', 'جلوبندی', 'سیبک', 'طبق', 'بوش طبق', 'پلوس']
};

/**
 * بررسی تطبیق نام یک قطعه یا متن شرح تعمیر با عنوان یک خدمت دوره‌ای
 */
export function doesItemMatchService(
  serviceType: string,
  partName: string = '',
  partCategory: string = '',
  partExplicitServiceType: string = '',
  repairText: string = ''
): boolean {
  const normService = serviceType.trim().toLowerCase();
  const normPartName = partName.trim().toLowerCase();
  const normCategory = partCategory.trim().toLowerCase();
  const normPartService = partExplicitServiceType.trim().toLowerCase();
  const normText = repairText.trim().toLowerCase();

  // ۱. تطبیق مستقیم بر اساس نوع خدمت مشخص شده در تعریف کالا
  if (normPartService && (normPartService === normService || normService.includes(normPartService) || normPartService.includes(normService))) {
    return true;
  }

  // ۲. تطبیق مستقیم نام خدمت در نام قطعه یا متن تعمیر
  if (normPartName && (normPartName.includes(normService) || normService.includes(normPartName))) {
    return true;
  }

  // ۳. تطبیق بر اساس واژگان کلیدی
  for (const [key, keywords] of Object.entries(SERVICE_KEYWORDS_MAP)) {
    if (normService.includes(key.toLowerCase())) {
      // این خدمت شامل این کلیدواژه است (مثلاً تسمه تایم)
      const partHasKeyword = normPartName && keywords.some(kw => normPartName.includes(kw.toLowerCase()));
      const catHasKeyword = normCategory && keywords.some(kw => normCategory.includes(kw.toLowerCase()));
      const textHasKeyword = normText && keywords.some(kw => normText.includes(kw.toLowerCase()));

      if (partHasKeyword || catHasKeyword || textHasKeyword) {
        return true;
      }
    }
  }

  // ۴. تطبیق کلمات تک‌به‌تک معنادار
  const meaningfulWords = normService.split(/\s+/).filter(w => w.length >= 4 && !['تعویض', 'سرویس', 'بازدید', 'تنظیم'].includes(w));
  for (const word of meaningfulWords) {
    if (normPartName.includes(word) || normText.includes(word)) {
      return true;
    }
  }

  return false;
}

export interface LastServiceOrRepairEvent {
  lastServicedKm: number;
  lastServicedDate: string;
  source: 'periodic_service' | 'repair' | 'initial';
  sourceLabel: string;
  details: string;
  referenceId?: number;
  isFromRepair: boolean;
  hasHistory: boolean;
}

/**
 * نرمال‌سازی رشته تاریخ شمسی برای مقایسه رشته‌ای دقیق (با تبدیل ارقام فارسی و انگلیسی)
 */
export function normalizeToComparableJalali(dateStr?: string | null): string {
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

/**
 * یافتن آخرین رویداد تعویض یا سرویس یک قطعه/خدمت دوره‌ای، چه در بخش سرویس‌های دوره‌ای و چه در بخش تعمیرات
 */
export function findLastServiceOrRepairEvent(
  vehicleId: number,
  serviceDef: ServiceDefinition,
  services: PeriodicService[] = [],
  failures: VehicleFailure[] = [],
  workflows: RepairWorkflow[] = [],
  parts: PartInventory[] = []
): LastServiceOrRepairEvent {
  const serviceType = serviceDef.serviceType;
  const events: Array<LastServiceOrRepairEvent & { sortKm: number; sortDate: string }> = [];

  // ۱. بررسی سرویس‌های دوره‌ای ثبت شده
  (services || [])
    .filter(s => s && s.vehicleId === vehicleId && (
      (s.serviceType || '').trim() === (serviceType || '').trim() ||
      doesItemMatchService(serviceType, '', '', s.serviceType, '')
    ))
    .forEach(s => {
      events.push({
        lastServicedKm: s.currentKm || 0,
        lastServicedDate: s.serviceDate || 'ثبت شده',
        source: 'periodic_service',
        sourceLabel: 'سرویس دوره‌ای',
        details: `ثبت شده در سرویس دوره‌ای #${s.id} مورخ ${s.serviceDate || '-'}`,
        referenceId: s.id,
        isFromRepair: false,
        hasHistory: true,
        sortKm: s.currentKm || 0,
        sortDate: s.serviceDate || ''
      });
    });

  // ۲. بررسی تعمیرات و خرابی‌های انجام شده (تعویض در تعمیرگاه)
  failures
    .filter(f => f.vehicleId === vehicleId)
    .forEach(f => {
      const wf = workflows.find(w => w.failureId === f.id);
      
      // فقط خرابی‌های تکمیل‌شده یا دارای تسویه و تحویل معتبر
      const isCompleted = f.status === 'completed' || f.status === 'approved' || Boolean(wf && (wf.isDelivered || (wf.endDate && Number(wf.totalCost) > 0)));
      if (!isCompleted) return;

      let matchedInThisRepair = false;
      let matchedPartName = '';

      // الف. بررسی قطعات انبار مصرف شده در تعمیر
      if (wf?.partsUsed) {
        for (const [partName, qty] of Object.entries(wf.partsUsed)) {
          if (Number(qty) > 0) {
            const partObj = parts.find(p => p.partName === partName);
            if (doesItemMatchService(serviceType, partName, partObj?.serviceCategory, partObj?.serviceType, '')) {
              matchedInThisRepair = true;
              matchedPartName = partName;
              break;
            }
          }
        }
      }

      // ب. بررسی قطعات تأمین‌شده توسط تعمیرگاه در فاکتور
      if (!matchedInThisRepair && wf?.shopPartsUsed && Array.isArray(wf.shopPartsUsed)) {
        for (const sp of wf.shopPartsUsed) {
          if (sp.name && doesItemMatchService(serviceType, sp.name, '', '', '')) {
            matchedInThisRepair = true;
            matchedPartName = sp.name;
            break;
          }
        }
      }

      // ج. بررسی شرح خرابی یا یادداشت فاکتور
      if (!matchedInThisRepair) {
        const fullText = `${f.description || ''} ${wf?.notes || ''}`;
        if (doesItemMatchService(serviceType, '', '', '', fullText)) {
          matchedInThisRepair = true;
          matchedPartName = f.description.slice(0, 30);
        }
      }

      // د. بررسی فیلد صریح replacedServiceTypes
      if (!matchedInThisRepair && wf?.replacedServiceTypes && Array.isArray(wf.replacedServiceTypes)) {
        if (wf.replacedServiceTypes.includes(serviceType)) {
          matchedInThisRepair = true;
          matchedPartName = serviceType;
        }
      }

      if (matchedInThisRepair && f.odometer && f.odometer > 0) {
        const repairDate = wf?.endDate || wf?.startDate || f.failureDate || '';
        const shopTitle = wf?.repairShopName || 'تعمیرگاه';
        events.push({
          lastServicedKm: f.odometer,
          lastServicedDate: repairDate || 'ثبت در تعمیرات',
          source: 'repair',
          sourceLabel: 'تعمیرات و تعویض قطعه',
          details: `تعویض در پرونده تعمیرات #${f.id} (${shopTitle}) - قطعه: ${matchedPartName || serviceType}`,
          referenceId: f.id,
          isFromRepair: true,
          hasHistory: true,
          sortKm: f.odometer,
          sortDate: repairDate
        });
      }
    });

  // اگر رویدادی یافت نشد، مقدار اولیه تعریف خدمت یا صفر را برمی‌گردانیم (بدون سابقه تاریخی در سیستم)
  if (events.length === 0) {
    const initialKm = serviceDef.lastServicedKm || 0;
    return {
      lastServicedKm: initialKm,
      lastServicedDate: initialKm > 0 ? 'کیلومتر مبدا خودرو' : 'ثبت اولیه',
      source: 'initial',
      sourceLabel: initialKm > 0 ? 'مبدا اولیه خودرو' : 'بدون سابقه',
      details: initialKm > 0 ? `مبدا ثبت اولیه در کیلومتر ${initialKm.toLocaleString('fa-IR')}` : 'تاکنون تعویض یا سرویسی برای این قطعه ثبت نشده است.',
      isFromRepair: false,
      hasHistory: false
    };
  }

  // مرتب‌سازی بر اساس بالاترین کیلومتر و تازه‌ترین تاریخ
  events.sort((a, b) => {
    if (b.sortKm !== a.sortKm) {
      return b.sortKm - a.sortKm;
    }
    const dateA = normalizeToComparableJalali(a.sortDate);
    const dateB = normalizeToComparableJalali(b.sortDate);
    return dateB.localeCompare(dateA);
  });

  return {
    ...events[0],
    hasHistory: true
  };
}

/**
 * تشخیص هوشمند کلیه خدمات دوره‌ای که در یک تعمیر یا فاکتور تعویض شده‌اند
 */
export function detectReplacedServicesInRepair(
  failure: VehicleFailure,
  workflow: RepairWorkflow | undefined,
  parts: PartInventory[],
  serviceDefinitions: ServiceDefinition[]
): ServiceDefinition[] {
  const matchedDefs: ServiceDefinition[] = [];

  serviceDefinitions.forEach(def => {
    let isMatched = false;

    // الف. قطعات انبار
    if (workflow?.partsUsed) {
      for (const [partName, qty] of Object.entries(workflow.partsUsed)) {
        if (Number(qty) > 0) {
          const partObj = parts.find(p => p.partName === partName);
          if (doesItemMatchService(def.serviceType, partName, partObj?.serviceCategory, partObj?.serviceType, '')) {
            isMatched = true;
            break;
          }
        }
      }
    }

    // ب. قطعات تعمیرگاه
    if (!isMatched && workflow?.shopPartsUsed && Array.isArray(workflow.shopPartsUsed)) {
      for (const sp of workflow.shopPartsUsed) {
        if (sp.name && doesItemMatchService(def.serviceType, sp.name, '', '', '')) {
          isMatched = true;
          break;
        }
      }
    }

    // ج. متن شرح
    if (!isMatched) {
      const fullText = `${failure.description || ''} ${workflow?.notes || ''}`;
      if (doesItemMatchService(def.serviceType, '', '', '', fullText)) {
        isMatched = true;
      }
    }

    // د. فیلد صریح
    if (!isMatched && workflow?.replacedServiceTypes?.includes(def.serviceType)) {
      isMatched = true;
    }

    if (isMatched && !matchedDefs.some(d => d.id === def.id)) {
      matchedDefs.push(def);
    }
  });

  return matchedDefs;
}

export interface ComprehensiveServiceHealth {
  definitionId: number;
  serviceType: string;
  intervalKm: number;
  warningKm: number;
  lastServicedKm: number;
  lastServicedDate: string;
  source: 'periodic_service' | 'repair' | 'initial';
  sourceLabel: string;
  sourceDetails: string;
  isFromRepair: boolean;
  hasHistory: boolean;
  targetDueKm: number;
  remainingKm: number;
  elapsedKm: number;
  progressPercent: number;
  status: 'safe' | 'warning' | 'overdue' | 'no_history';
  statusLabel: string;
  daysRemaining: number;
  estimatedDate: string;
  notes?: string;

  // فیلدهای پیش‌بینی هوشمند دو وضعیتی استعلام و پایش (بخش دوم دستورالعمل)
  predictionState?: 'before_km' | 'after_km' | 'no_history';
  predictionType?: string; // «پیش‌بینی بر اساس سوابق تاریخی» یا «پیش‌بینی به‌روزرسانی شده بر اساس پیمایش واقعی»
  basisLabel?: string; // «سوابق قبلی خودرو» یا «پیمایش واقعی از آخرین سرویس»
  predictedDateLabel?: string;
  historicalDailyMileage?: number;
  recentDailyMileage?: number;
  updatedDailyMileage?: number;
  daysSinceLastService?: number;
  distanceSinceLastService?: number;
}

/**
 * محاسبه جامع وضعیت سلامت و سررسید قطعه برای خودرو با در نظر گرفتن هم‌زمان سرویس‌ها و تعمیرات
 * و اعمال منطق دو وضعیتی استعلام (قبل و بعد از ثبت کیلومتر فعلی)
 */
export function calculateComprehensiveServiceHealth(
  vehicle: Vehicle,
  serviceDef: ServiceDefinition,
  services: PeriodicService[] = [],
  failures: VehicleFailure[] = [],
  workflows: RepairWorkflow[] = [],
  parts: PartInventory[] = [],
  dailyRate: number = 75,
  odometerLogs: OdometerLog[] = []
): ComprehensiveServiceHealth {
  // اطمینان از استفاده از آخرین کیلومتر ذخیره‌شده برای ماشین در دیتابیس (استعلام‌ها، سرویس‌ها، تعمیرات یا کیلومتر پایه)
  const latestKm = getLatestVehicleKm(vehicle, odometerLogs, services, failures);
  const vehicleWithLatestKm: Vehicle = {
    ...vehicle,
    currentKm: latestKm > 0 ? latestKm : (vehicle.currentKm || 0)
  };

  const lastEvent = findLastServiceOrRepairEvent(
    vehicle.id,
    serviceDef,
    services,
    failures,
    workflows,
    parts
  );

  // محاسبه پیش‌بینی بر اساس منطق دو وضعیتی استعلام (Prediction Engine)
  const pred = calculateInquiryServicePrediction({
    vehicle: vehicleWithLatestKm,
    serviceDef,
    services,
    failures,
    workflows,
    parts,
    odometerLogs,
    customDailyRate: dailyRate > 0 ? dailyRate : undefined
  });

  return {
    definitionId: serviceDef.id,
    serviceType: serviceDef.serviceType,
    intervalKm: pred.intervalKm,
    warningKm: pred.warningKm,
    lastServicedKm: lastEvent.lastServicedKm,
    lastServicedDate: lastEvent.lastServicedDate,
    source: lastEvent.source,
    sourceLabel: lastEvent.sourceLabel,
    sourceDetails: lastEvent.details,
    isFromRepair: lastEvent.isFromRepair,
    hasHistory: lastEvent.hasHistory,
    targetDueKm: pred.targetDueKm,
    remainingKm: pred.remainingKm,
    elapsedKm: pred.elapsedKm,
    progressPercent: pred.progressPercent,
    status: pred.status,
    statusLabel: pred.statusLabel,
    daysRemaining: pred.daysRemaining,
    estimatedDate: pred.predictedDate,
    notes: serviceDef.notes,

    // اتصال فیلدهای پیش‌بینی دو وضعیتی
    predictionState: pred.state,
    predictionType: pred.predictionType,
    basisLabel: pred.basisLabel,
    predictedDateLabel: pred.predictedDateLabel,
    historicalDailyMileage: pred.historicalDailyMileage,
    recentDailyMileage: pred.recentDailyMileage,
    updatedDailyMileage: pred.updatedDailyMileage,
    daysSinceLastService: pred.daysSinceLastService,
    distanceSinceLastService: pred.distanceSinceLastService
  };
}

/**
 * نرمال‌سازی متون فارسی برای رفع اختلافات نویسه، ی/ي، ک/ك، نیم‌فاصله‌ها و فواصل اضافی
 */
export function normalizePersianText(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200b\u200e\u200f\u00a0]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * یافتن نزدیک‌ترین و دقیق‌ترین تعریف خدمت منطبق با عنوان خدمت انتخاب شده
 */
export function findMatchingServiceDef(
  serviceType: string,
  definitions: ServiceDefinition[]
): ServiceDefinition | undefined {
  if (!serviceType || !definitions || definitions.length === 0) return undefined;
  const normType = normalizePersianText(serviceType);

  // ۱. تطابق دقیق متن نرمال‌شده
  const exact = definitions.find(d => normalizePersianText(d.serviceType) === normType);
  if (exact) return exact;

  // ۲. تطابق بر اساس شمول عنوان
  const partial = definitions.find(d => {
    const dNorm = normalizePersianText(d.serviceType);
    return normType.includes(dNorm) || dNorm.includes(normType);
  });
  if (partial) return partial;

  // ۳. تطابق هوشمند با کلیدواژه‌ها (روغن گیربکس، واسکازین، تسمه تایم، لنت و ...)
  for (const [key, keywords] of Object.entries(SERVICE_KEYWORDS_MAP)) {
    const normKey = normalizePersianText(key);
    if (normType.includes(normKey) || keywords.some(kw => normType.includes(normalizePersianText(kw)))) {
      const match = definitions.find(d => {
        const dNorm = normalizePersianText(d.serviceType);
        return dNorm.includes(normKey) || keywords.some(kw => dNorm.includes(normalizePersianText(kw)));
      });
      if (match) return match;
    }
  }

  return undefined;
}

/**
 * استخراج آخرین کیلومتر ثبت‌شده برای خودرو در دیتابیس
 * بررسی همه‌جانبه بر اساس جدیدترین استعلام، آخرین سرویس دوره‌ای، تعمیرات و کیلومتر خودرو
 */
export function getLatestVehicleKm(
  vehicle: Vehicle | { id: number; currentKm?: number; createdAt?: string } | null | undefined,
  odometerLogs: OdometerLog[] = [],
  services: PeriodicService[] = [],
  failures: VehicleFailure[] = []
): number {
  if (!vehicle) return 0;
  const vId = Number(vehicle.id);

  type Reading = { date: string; time: string; km: number; id: number };
  const readings: Reading[] = [];

  // ۱. استعلام‌های کارکرد ثبت‌شده (Odometer Logs)
  (odometerLogs || []).forEach(log => {
    if (Number(log.vehicleId) === vId && Number(log.odometerKm) > 0) {
      readings.push({
        date: log.inquiryDate || '1300/01/01',
        time: log.inquiryTime || '00:00',
        km: Number(log.odometerKm),
        id: Number(log.id) || 0
      });
    }
  });

  // ۲. سوابق سرویس‌های دوره‌ای (Periodic Services)
  (services || []).forEach(s => {
    if (Number(s.vehicleId) === vId && Number(s.currentKm) > 0 && s.status !== 'in_progress') {
      readings.push({
        date: s.serviceDate || '1300/01/01',
        time: '12:00',
        km: Number(s.currentKm),
        id: Number(s.id) || 0
      });
    }
  });

  // ۳. سوابق خرابی و تعمیرات خودرو (Vehicle Failures)
  (failures || []).forEach(f => {
    const fKm = Number((f as any).currentKm) || Number(f.odometer) || 0;
    if (Number(f.vehicleId) === vId && fKm > 0) {
      readings.push({
        date: f.failureDate || (f as any).startDate || '1300/01/01',
        time: f.failureTime || '12:00',
        km: fKm,
        id: Number(f.id) || 0
      });
    }
  });

  const baseKm = Number(vehicle.currentKm) || 0;

  if (readings.length === 0) {
    return baseKm;
  }

  // مرتب‌سازی نزولی بر اساس تاریخ (جدیدترین اول)، سپس ساعت و سپس شناسه
  readings.sort((a, b) => {
    const dDiff = String(b.date).localeCompare(String(a.date));
    if (dDiff !== 0) return dDiff;
    const tDiff = String(b.time).localeCompare(String(a.time));
    if (tDiff !== 0) return tDiff;
    return b.id - a.id;
  });

  const latestReading = readings[0];
  return Math.max(latestReading.km, baseKm);
}
