/**
 * Utility functions for converting digits and numbers to Persian format.
 */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/**
 * Converts any number or string containing Latin digits (0-9) to Persian digits (۰-۹).
 */
export function toPersianDigits(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '';
  const str = String(val);
  return str.replace(/\d/g, (digit) => PERSIAN_DIGITS[parseInt(digit, 10)]);
}

/**
 * Converts Persian and Arabic digits to English digits (0-9).
 */
export function toEnglishDigits(val: string | number | undefined | null): string {
  if (val === undefined || val === null || val === '') return '';
  return String(val)
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧۸۹'.indexOf(d)));
}

/**
 * Converts a string with Persian digits (۰-۹) or English digits (0-9), commas, and decimal separators into a JavaScript number.
 */
export function parsePersianNumber(val: string | number | undefined | null): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let str = String(val).trim();

  // Replace Persian and Arabic-Indic digits
  str = str
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/٫/g, '.') // Persian decimal separator
    .replace(/[,،٬\s_\u00a0\u200c]/g, ''); // Latin comma, Persian comma (،), Arabic thousands separator (٬), and spaces

  // If string contains a single slash like 2/5 (and is not a full date with 2 slashes)
  if (/^\d+\/\d+$/.test(str)) {
    str = str.replace('/', '.');
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Formats a quantity value (supports integers and decimals like 2.5 or 0.75) with Persian digits.
 */
export function formatQuantity(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '۱';
  const num = typeof val === 'number' ? val : parsePersianNumber(val);
  if (isNaN(num) || num <= 0) return '۱';

  if (Number.isInteger(num)) {
    return toPersianDigits(num);
  }

  // Format decimal up to 2 decimal places without trailing zeros
  const rounded = Math.round(num * 100) / 100;
  const str = rounded.toString();
  return toPersianDigits(str);
}

/**
 * Formats a number with comma separators (e.g., 1,250,000) and converts it to Persian digits.
 */
export function formatPrice(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null || amount === '') return '۰';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '۰';
  const formatted = num.toLocaleString('en-US');
  return toPersianDigits(formatted);
}

/**
 * Formats a number with commas and Persian digits.
 */
export function formatNumber(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '۰';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return toPersianDigits(val);
  const formatted = num.toLocaleString('en-US');
  return toPersianDigits(formatted);
}

/**
 * Formats kilometers with Persian digits and 'کیلومتر' suffix or raw Persian digits.
 */
export function formatKm(km: number | string | undefined | null): string {
  if (km === undefined || km === null || km === '') return '۰';
  return formatNumber(km);
}

/**
 * Converts an ISO date string or Date object to a readable Jalali date string in Persian (without time).
 */
export function toJalaliDate(isoString: string | undefined | null): string {
  if (!isoString) return '-';
  try {
    const str = String(isoString);
    // If already in 13xx or 14xx Jalali format (e.g. '1405-02-15' or '1405/02/15')
    if (/^(13|14)\d{2}[-/]\d{1,2}[-/]\d{1,2}/.test(str)) {
      return toPersianDigits(str.replace(/-/g, '/').split(' ')[0]);
    }

    const d = new Date(isoString);
    if (isNaN(d.getTime())) return toPersianDigits(isoString);
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    };
    const formatted = new Intl.DateTimeFormat('fa-IR', options).format(d);
    return formatted;
  } catch (e) {
    return toPersianDigits(isoString);
  }
}

/**
 * Converts integer numbers to Persian words for accounting and checks.
 */
export function numberToPersianWords(num: number | string | undefined | null): string {
  if (num === undefined || num === null || num === '') return '';
  const n = typeof num === 'number' ? Math.floor(Math.abs(num)) : Math.floor(Math.abs(parsePersianNumber(num)));
  if (isNaN(n) || n === 0) return 'صفر';

  const yekan = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
  const dahgan = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
  const dahha = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
  const sadgan = ['', 'یکصد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
  const tabaghat = ['', ' هزار', ' میلیون', ' میلیارد', ' تریلیون'];

  function threeDigitsToWord(val: number): string {
    const s = Math.floor(val / 100);
    const d = Math.floor((val % 100) / 10);
    const y = val % 10;
    const parts: string[] = [];

    if (s > 0) parts.push(sadgan[s]);

    if (d === 1) {
      parts.push(dahha[y]);
    } else {
      if (d > 1) parts.push(dahgan[d]);
      if (y > 0) parts.push(yekan[y]);
    }

    return parts.join(' و ');
  }

  let temp = n;
  let tabagheIdx = 0;
  const resultParts: string[] = [];

  while (temp > 0) {
    const three = temp % 1000;
    if (three > 0) {
      const word = threeDigitsToWord(three);
      resultParts.unshift(word + tabaghat[tabagheIdx]);
    }
    temp = Math.floor(temp / 1000);
    tabagheIdx++;
  }

  return resultParts.join(' و ');
}

