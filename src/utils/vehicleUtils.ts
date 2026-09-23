import { Vehicle } from '../types';
import { toPersianDigits, toEnglishDigits } from './numberUtils';

/**
 * تولید عنوان نمایشی استاندارد برای خودرو در لیست‌های پیشنهادی و فیلدهای جستجو:
 * شامل نام خودرو + نام راننده + کد خودرو (بدون پلاک)
 */
export function getVehicleDisplayName(v?: Partial<Vehicle> | null): string {
  if (!v) return 'خودرو نامشخص';
  const name = v.name?.trim() || 'خودرو';
  const driver = v.driverName?.trim() ? v.driverName.trim() : 'بدون راننده';
  const code = v.code ? ` (کد: ${toPersianDigits(v.code)})` : '';
  return `${name} - ${driver}${code}`;
}

/**
 * ساخت آبجکت گزینه انتخابی برای CustomSelect و فرم‌ها
 */
export function getVehicleSelectOption(v: Vehicle) {
  const label = getVehicleDisplayName(v);
  return {
    value: v.id,
    label: label,
    subLabel: v.company ? `شرکت: ${v.company}` : undefined,
  };
}

/**
 * بررسی تطابق جستجو بر اساس نام خودرو، نام راننده و کد خودرو
 */
export function matchesVehicleSearch(v: Vehicle, query: string): boolean {
  if (!query || !query.trim()) return true;
  const q = query.trim().toLowerCase();
  const qEnglish = toEnglishDigits(q).toLowerCase();
  const qPersian = toPersianDigits(q).toLowerCase();

  const name = (v.name || '').toLowerCase();
  const driver = (v.driverName || '').toLowerCase();
  const code = (v.code || '').toLowerCase();
  const codeEnglish = toEnglishDigits(v.code || '').toLowerCase();
  const codePersian = toPersianDigits(v.code || '').toLowerCase();

  const checkPrefixOrIncludes = (text: string, searchTerms: string[]) => {
    if (!text) return false;
    return searchTerms.some(st => {
      if (!st) return false;
      if (text.includes(st)) return true;
      const words = text.split(/[\s\-_\/()\[\]]+/);
      return words.some(w => w.startsWith(st));
    });
  };

  const terms = [q, qEnglish, qPersian].filter(Boolean);

  return (
    checkPrefixOrIncludes(name, terms) ||
    checkPrefixOrIncludes(driver, terms) ||
    checkPrefixOrIncludes(code, terms) ||
    checkPrefixOrIncludes(codeEnglish, terms) ||
    checkPrefixOrIncludes(codePersian, terms)
  );
}
