import { toPersianDigits } from './numberUtils';

/**
 * Utility functions for Jalali / Solar Hijri calendar formatting and conversions.
 */

// Ensure date is in standard Jalali format 'YYYY/MM/DD' with English digits for state/picker
export function toJalaliStandardString(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return getCurrentJalaliDate();
  const str = String(dateInput).trim();
  const enDigits = persianToEnglishDigits(str);
  
  // If already Jalali 13xx or 14xx
  if (/^(13|14)\d{2}[-/]\d{1,2}[-/]\d{1,2}/.test(enDigits)) {
    const parts = enDigits.replace(/-/g, '/').split('/');
    if (parts.length >= 3) {
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].split('T')[0].split(' ')[0].padStart(2, '0');
      return `${y}/${m}/${d}`;
    }
  }

  // Try parsing Gregorian date
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('fa-IR-u-nu-latn', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    }
  } catch (e) {
    // ignore
  }

  return enDigits;
}

// Convert Gregorian to Jalali representation using the Intl API
export function toJalaliDate(gregorianDateStr: string | Date | undefined): string {
  if (!gregorianDateStr) return '';
  const str = String(gregorianDateStr);
  
  // If already in 13xx or 14xx Jalali format (e.g., '1405-02-15' or '1405/02/15')
  if (/^(13|14)\d{2}[-/]\d{1,2}[-/]\d{1,2}/.test(str)) {
    return toPersianDigits(str.replace(/-/g, '/'));
  }
  
  const date = new Date(str);
  if (isNaN(date.getTime())) return toPersianDigits(str);
  
  // Intl format outputs Persian numbers.
  const persianFormatted = date.toLocaleDateString('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  return toPersianDigits(persianFormatted);
}

// Format number of days or relative time in Persian
export function formatRelativeDays(days: number): string {
  const pDays = toPersianDigits(Math.abs(days));
  if (days < 0) {
    return `منقضی شده (حدود ${pDays} روز قبل)`;
  }
  if (days === 0) {
    return 'امروز';
  }
  return `${pDays} روز آینده`;
}

// Convert Persian digits to English digits (for date inputs validation/processing)
export function persianToEnglishDigits(str: string): string {
  const persianDigits = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
  let out = str;
  for (let i = 0; i < 10; i++) {
    out = out.replace(persianDigits[i], String(i));
  }
  return out;
}

// Get current Jalali date as standard string in English digits (e.g. '1405/04/29')
export function getCurrentJalaliDate(): string {
  const date = new Date();
  try {
    return date.toLocaleDateString('fa-IR-u-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (e) {
    return '1405/04/29';
  }
}

// Add days to Jalali date string with accurate month length handling
export function addDaysToJalaliDate(jalaliStr: string, days: number): string {
  if (!jalaliStr) jalaliStr = getCurrentJalaliDate();
  const clean = persianToEnglishDigits(jalaliStr).replace(/-/g, '/').trim();
  const parts = clean.split('/').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return jalaliStr;
  }
  
  let [y, m, d] = parts;

  // Month days count helper for Jalali
  const getDaysInMonth = (year: number, month: number) => {
    if (month >= 1 && month <= 6) return 31;
    if (month >= 7 && month <= 11) return 30;
    // 12th month (Esfand): 29 days (or 30 in leap year)
    // Approximate leap year formula for Jalali
    const remainder = (year - 474) % 2820;
    const isLeap = (((remainder + 474 + 38) * 682) % 2816) < 682;
    return isLeap ? 30 : 29;
  };

  let remainingDays = days;

  if (remainingDays >= 0) {
    while (remainingDays > 0) {
      const daysInCurrentMonth = getDaysInMonth(y, m);
      const daysLeftInMonth = daysInCurrentMonth - d;

      if (remainingDays <= daysLeftInMonth) {
        d += remainingDays;
        remainingDays = 0;
      } else {
        remainingDays -= (daysLeftInMonth + 1);
        d = 1;
        m += 1;
        if (m > 12) {
          m = 1;
          y += 1;
        }
      }
    }
  } else {
    while (remainingDays < 0) {
      if (d + remainingDays >= 1) {
        d += remainingDays;
        remainingDays = 0;
      } else {
        remainingDays += d;
        m -= 1;
        if (m < 1) {
          m = 12;
          y -= 1;
        }
        d = getDaysInMonth(y, m);
      }
    }
  }

  return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
}

// Convert Jalali date string to total days from epoch (year 1300)
export function jalaliToDays(jalaliStr: string): number {
  if (!jalaliStr) return 0;
  const clean = persianToEnglishDigits(jalaliStr).replace(/-/g, '/').trim();
  const parts = clean.split('/').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return 0;
  let [y, m, d] = parts;

  let totalDays = d;
  for (let month = 1; month < m; month++) {
    if (month <= 6) totalDays += 31;
    else if (month <= 11) totalDays += 30;
    else totalDays += 29;
  }
  for (let year = 1300; year < y; year++) {
    const remainder = (year - 474) % 2820;
    const isLeap = (((remainder + 474 + 38) * 682) % 2816) < 682;
    totalDays += isLeap ? 366 : 365;
  }
  return totalDays;
}

// Convert any date string (Jalali, Gregorian, ISO) to standard Jalali string
export function toStandardJalali(dateStr: string | undefined): string {
  if (!dateStr) return getCurrentJalaliDate();
  const str = String(dateStr);
  if (/^(13|14)\d{2}[-/]\d{1,2}[-/]\d{1,2}/.test(str)) {
    return persianToEnglishDigits(str).replace(/-/g, '/');
  }
  return toJalaliDate(str);
}

// Calculate day difference between two dates (dateStr2 - dateStr1) supporting both Jalali and Gregorian strings
export function jalaliDayDifference(dateStr1: string, dateStr2: string): number {
  const std1 = toStandardJalali(dateStr1);
  const std2 = toStandardJalali(dateStr2);
  const days1 = jalaliToDays(std1);
  const days2 = jalaliToDays(std2);
  return days2 - days1;
}

export interface VehicleHistoricalRecord {
  date: string;
  mileage: number;
  serviceType?: string;
  source?: string;
}

export interface NextServiceCalculationParams {
  vehicle_history?: VehicleHistoricalRecord[];
  last_service_date?: string;
  last_service_mileage?: number;
  current_service_date: string;
  current_service_mileage: number;
  target_service_interval: number;
  default_daily_km?: number;
}

export interface NextServiceCalculationResult {
  hasHistory: boolean;
  nextDate: string;
  nextKm: number;
  avgDailyKm: number | null;
  estimatedDays: number | null;
  historySummary: string;
  sampleDays?: number;
  sampleKm?: number;
}

export function calculateNextServiceDate(params: NextServiceCalculationParams): NextServiceCalculationResult {
  const {
    vehicle_history = [],
    last_service_date,
    last_service_mileage,
    current_service_date,
    current_service_mileage,
    target_service_interval
  } = params;

  const nextKm = current_service_mileage + target_service_interval;

  // Build clean history array
  const cleanHistory: { date: string; mileage: number }[] = [];

  if (vehicle_history && vehicle_history.length > 0) {
    vehicle_history.forEach(h => {
      if (h.date && h.mileage && h.mileage < current_service_mileage) {
        cleanHistory.push({ date: h.date, mileage: h.mileage });
      }
    });
  }

  if (last_service_date && last_service_mileage !== undefined && last_service_mileage !== null && last_service_mileage < current_service_mileage) {
    cleanHistory.push({ date: last_service_date, mileage: last_service_mileage });
  }

  // Deduplicate and filter records that happened before current visit
  const validRecords = cleanHistory
    .map(rec => ({
      ...rec,
      daysDiff: jalaliDayDifference(rec.date, current_service_date),
      kmDiff: current_service_mileage - rec.mileage
    }))
    .filter(rec => rec.daysDiff > 0 && rec.kmDiff > 0)
    .sort((a, b) => b.daysDiff - a.daysDiff); // earliest first

  if (validRecords.length === 0) {
    // If no past records exist, do NOT write a next date (as requested)
    return {
      hasHistory: false,
      nextDate: '',
      nextKm,
      avgDailyKm: null,
      estimatedDays: null,
      historySummary: 'فاقد سابقه کارکرد گذشته'
    };
  }

  // Calculate based on earliest valid record or aggregate
  const baseRecord = validRecords[0];
  const totalDays = baseRecord.daysDiff;
  const totalKm = baseRecord.kmDiff;
  const avgDailyKm = totalKm / totalDays;

  if (avgDailyKm <= 0 || !isFinite(avgDailyKm)) {
    return {
      hasHistory: false,
      nextDate: '',
      nextKm,
      avgDailyKm: null,
      estimatedDays: null,
      historySummary: 'داده‌های کارکرد ناکافی'
    };
  }

  const estimatedDays = Math.max(1, Math.round(target_service_interval / avgDailyKm));
  const nextDate = addDaysToJalaliDate(current_service_date, estimatedDays);

  return {
    hasHistory: true,
    nextDate,
    nextKm,
    avgDailyKm: Math.round(avgDailyKm * 10) / 10,
    estimatedDays,
    sampleDays: totalDays,
    sampleKm: totalKm,
    historySummary: `پیمایش میانگین ${totalKm.toLocaleString('fa-IR')} کیلومتر در هر ${totalDays.toLocaleString('fa-IR')} روز (~${Math.round(avgDailyKm).toLocaleString('fa-IR')} کیلومتر در روز)`
  };
}

