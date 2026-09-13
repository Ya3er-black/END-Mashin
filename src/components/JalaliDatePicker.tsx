import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, Check, X } from 'lucide-react';
import { toPersianDigits } from '../utils/numberUtils';

interface JalaliDatePickerProps {
  value: string;
  onChange: (dateStr: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  inputClassName?: string;
}

const MONTH_NAMES = [
  'فروردین', 'اردیبهشت', 'خرداد',
  'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر',
  'دی', 'بهمن', 'اسفند'
];

const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

// Helper to determine if a Jalali year is leap
function isJalaliLeapYear(year: number): boolean {
  const r = (year - 474) % 2820;
  const leapRegistry = [
    0, 4, 8, 12, 16, 20, 24, 29, 33, 37, 41, 45, 49, 53, 57, 62, 66, 70, 74, 78, 82, 86, 90, 95, 99, 103, 107, 111, 115, 119, 124, 128, 132, 136, 140, 144, 148, 153, 157, 161, 165, 169, 173, 177, 182, 186, 190, 194, 198, 202, 206, 211, 215, 219, 223, 227, 231, 235, 240, 244, 248, 252, 256, 260, 264, 269, 273, 277, 281, 285, 289, 293, 298, 302, 306, 310, 314, 318, 322, 327, 331, 335, 339, 343, 347, 351, 356, 360, 364, 368, 372, 376, 380, 385, 389, 393, 397, 401, 405, 409, 414, 418, 422, 426, 430, 434, 438, 443, 447, 451, 455, 459, 463, 467, 472, 476, 480, 484, 488, 492, 496, 501, 505, 509, 513, 517, 521, 525, 530, 534, 538, 542, 546, 550, 554, 559, 563, 567, 571, 575, 579, 583, 588, 592, 596, 600, 604, 608, 612, 617, 621, 625, 629, 633, 637, 641, 646, 650, 654, 658, 662, 666, 670, 675, 679, 683, 687, 691, 695, 699, 704, 708, 712, 716, 720, 724, 728, 733, 737, 741, 745, 749, 753, 757, 762, 766, 770, 774, 778, 782, 786, 791, 795, 799, 803, 807, 811, 815, 820, 824, 828, 832, 836, 840, 844, 849, 853, 857, 861, 865, 869, 873, 878, 882, 886, 890, 894, 898, 902, 907, 911, 915, 919, 923, 927, 931, 936, 940, 944, 948, 952, 956, 960, 965, 969, 973, 977, 981, 985, 989, 994, 998, 1002, 1006, 1010, 1014, 1018, 1023, 1027, 1031, 1035, 1039, 1043, 1047, 1052, 1056, 1060, 1064, 1068, 1072, 1076, 1081, 1085, 1089, 1093, 1097, 1101, 1105, 1110, 1114, 1118, 1122, 1126, 1130, 1134, 1139, 1143, 1147, 1151, 1155, 1159, 1163, 1168, 1172, 1176, 1180, 1184, 1188, 1192, 1197, 1201, 1205, 1209, 1213, 1217, 1221, 1226, 1230, 1234, 1238, 1242, 1246, 1250, 1255, 1259, 1263, 1267, 1271, 1275, 1279, 1284, 1288, 1292, 1296, 1300, 1304, 1308, 1313, 1317, 1321, 1325, 1329, 1333, 1337, 1342, 1346, 1350, 1354, 1358, 1362, 1366, 1371, 1375, 1379, 1383, 1387, 1391, 1395, 1400, 1404, 1408, 1412, 1416, 1420, 1424, 1429, 1433, 1437, 1441, 1445, 1449, 1453, 1458, 1462, 1466, 1470, 1474, 1478, 1482, 1487, 1491, 1495, 1499, 1503, 1507, 1511, 1516, 1520, 1524, 1528, 1532, 1536, 1540, 1545, 1549, 1553, 1557, 1561, 1565, 1569, 1574, 1578, 1582, 1586, 1590, 1594, 1598, 1603, 1607, 1611, 1615, 1619, 1623, 1627, 1632, 1636, 1640, 1644, 1648, 1652, 1656, 1661, 1665, 1669, 1673, 1677, 1681, 1685, 1690, 1694, 1698, 1702, 1706, 1710, 1714, 1719, 1723, 1727, 1731, 1735, 1739, 1743, 1748, 1752, 1756, 1760, 1764, 1768, 1772, 1777, 1781, 1785, 1789, 1793, 1797, 1801, 1806, 1810, 1814, 1818, 1822, 1826, 1830, 1835, 1839, 1843, 1847, 1851, 1855, 1859, 1864, 1868, 1872, 1876, 1880, 1884, 1888, 1893, 1897, 1901, 1905, 1909, 1913, 1917, 1922, 1926, 1930, 1934, 1938, 1942, 1946, 1951, 1955, 1959, 1963, 1967, 1971, 1975, 1980, 1984, 1988, 1992, 1996, 2000, 2004, 2009, 2013, 2017, 2021, 2025, 2029, 2033, 2038, 2042, 2046, 2050, 2054, 2058, 2062, 2067, 2071, 2075, 2079, 2083, 2087, 2091, 2096, 2100, 2104, 2108, 2112, 2116, 2120, 2125, 2129, 2133, 2137, 2141, 2145, 2149, 2154, 2158, 2162, 2166, 2170, 2174, 2178, 2183, 2187, 2191, 2195, 2199, 2203, 2207, 2212, 2216, 2220, 2224, 2228, 2232, 2236, 2241, 2245, 2249, 2253, 2257, 2261, 2265, 2270, 2274, 2278, 2282, 2286, 2290, 2294, 2299, 2303, 2307, 2311, 2315, 2319, 2323, 2328, 2332, 2336, 2340, 2344, 2348, 2352, 2357, 2361, 2365, 2369, 2373, 2377, 2381, 2386, 2390, 2394, 2398, 2402, 2406, 2410, 2415, 2419, 2423, 2427, 2431, 2435, 2439, 2444, 2448, 2452, 2456, 2460, 2464, 2468, 2473, 2477, 2481, 2485, 2489, 2493, 2497, 2502, 2506, 2510, 2514, 2518, 2522, 2526, 2531, 2535, 2539, 2543, 2547, 2551, 2555, 2560, 2564, 2568, 2572, 2576, 2580, 2584, 2589, 2593, 2597, 2601, 2605, 2609, 2613, 2618, 2622, 2626, 2630, 2634, 2638, 2642, 2647, 2651, 2655, 2659, 2663, 2667, 2671, 2676, 2680, 2684, 2688, 2692, 2696, 2700, 2705, 2709, 2713, 2717, 2721, 2725, 2729, 2734, 2738, 2742, 2746, 2750, 2754, 2758, 2763, 2767, 2771, 2775, 2779, 2783, 2787, 2792, 2796, 2800, 2804, 2808, 2812, 2816
  ];
  return leapRegistry.includes(r);
}

// Get number of days in a Jalali year/month
function getDaysInJalaliMonth(year: number, month: number): number {
  if (month >= 1 && month <= 6) return 31;
  if (month >= 7 && month <= 11) return 30;
  if (month === 12) {
    return isJalaliLeapYear(year) ? 30 : 29;
  }
  return 30;
}

// Exact Jalali to Gregorian conversion algorithm
function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  jy += 1595;
  let days = -355668 + (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + jd;
  if (jm < 7) {
    days += (jm - 1) * 31;
  } else {
    days += ((jm - 7) * 30) + 186;
  }
  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const salA = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 0; gm < 13; gm++) {
    const v = salA[gm];
    if (gd <= v) break;
    gd -= v;
  }
  return [gy, gm, gd];
}

// Get the weekday index of the 1st of a Jalali year/month (0 = Sat, 1 = Sun, ..., 6 = Fri)
function getFirstDayOfJalaliMonthWeekday(year: number, month: number): number {
  try {
    const [gy, gm, gd] = jalaliToGregorian(year, month, 1);
    const gDate = new Date(gy, gm - 1, gd);
    const jsDay = gDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    return (jsDay + 1) % 7; // Convert to Persian index where 0 = Saturday (شنبه)
  } catch (e) {
    return 0;
  }
}

// Helper to get current Jalali Date parts (year, month, day)
function getTodayJalaliParts(): { year: number; month: number; day: number } {
  try {
    const parts = new Date().toLocaleDateString('fa-IR-u-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).split('/');
    return {
      year: Number(parts[0]) || 1404,
      month: Number(parts[1]) || 1,
      day: Number(parts[2]) || 1
    };
  } catch (e) {
    return { year: 1404, month: 1, day: 1 };
  }
}

export const JalaliDatePicker: React.FC<JalaliDatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = 'انتخاب تاریخ...',
  required = false,
  className = '',
  inputClassName = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const today = getTodayJalaliParts();
  const [currentYear, setCurrentYear] = useState(today.year);
  const [currentMonth, setCurrentMonth] = useState(today.month);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const monthMenuRef = useRef<HTMLDivElement>(null);
  const yearMenuRef = useRef<HTMLDivElement>(null);
  const selectedYearRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isYearDropdownOpen && selectedYearRef.current) {
      selectedYearRef.current.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
  }, [isYearDropdownOpen]);

  useEffect(() => {
    if (!isOpen) {
      setIsMonthDropdownOpen(false);
      setIsYearDropdownOpen(false);
    }
  }, [isOpen]);

  // Sync state whenever value changes or picker opens
  useEffect(() => {
    if (value) {
      let str = String(value).trim();
      const englishVal = str.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
      let cleanVal = englishVal.replace(/-/g, '/');

      // If not starting with Jalali 13xx or 14xx, try parsing as ISO date
      if (!/^(13|14)\d{2}/.test(cleanVal)) {
        try {
          const d = new Date(str);
          if (!isNaN(d.getTime())) {
            cleanVal = d.toLocaleDateString('fa-IR-u-nu-latn', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            });
          }
        } catch (e) {
          // ignore
        }
      }

      const parts = cleanVal.split('/');
      if (parts.length >= 3) {
        const y = Number(parts[0]);
        const m = Number(parts[1]);
        if (y && !isNaN(y)) setCurrentYear(y);
        if (m && !isNaN(m)) setCurrentMonth(m);
      }
    } else {
      setCurrentYear(today.year);
      setCurrentMonth(today.month);
    }
  }, [value, isOpen]);

  const [coords, setCoords] = useState<{
    top: number;
    bottom: number;
    left: number;
    openUpwards: boolean;
  }>({
    top: 0,
    bottom: 0,
    left: 0,
    openUpwards: false,
  });

  const updatePosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUpwards = spaceBelow < 320 && spaceAbove > spaceBelow;

      const popupWidth = 280;
      let left = rect.right - popupWidth;
      if (left < 10) left = 10;
      if (left + popupWidth > window.innerWidth - 10) {
        left = window.innerWidth - popupWidth - 10;
      }

      setCoords({
        top: rect.bottom + 6,
        bottom: window.innerHeight - rect.top + 6,
        left,
        openUpwards,
      });
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (monthMenuRef.current && !monthMenuRef.current.contains(target)) {
        setIsMonthDropdownOpen(false);
      }
      if (yearMenuRef.current && !yearMenuRef.current.contains(target)) {
        setIsYearDropdownOpen(false);
      }
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popupRef.current &&
        !popupRef.current.contains(target)
      ) {
        setIsMonthDropdownOpen(false);
        setIsYearDropdownOpen(false);
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (isMonthDropdownOpen) {
          setIsMonthDropdownOpen(false);
          return;
        }
        if (isYearDropdownOpen) {
          setIsYearDropdownOpen(false);
          return;
        }
        setIsOpen(false);
      }
    }

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, isMonthDropdownOpen, isYearDropdownOpen]);

  const handleDaySelect = (day: number) => {
    setIsMonthDropdownOpen(false);
    setIsYearDropdownOpen(false);
    const formattedMonth = String(currentMonth).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    onChange(`${currentYear}/${formattedMonth}/${formattedDay}`);
    setIsOpen(false);
  };

  const nextMonth = () => {
    setIsMonthDropdownOpen(false);
    setIsYearDropdownOpen(false);
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const prevMonth = () => {
    setIsMonthDropdownOpen(false);
    setIsYearDropdownOpen(false);
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  // Generate Year Options (پوشش کامل سال‌های گذشته و آینده)
  const yearsRange: number[] = [];
  for (let y = 1370; y <= 1420; y++) {
    yearsRange.push(y);
  }

  const totalDays = getDaysInJalaliMonth(currentYear, currentMonth);
  const firstDayWeekday = getFirstDayOfJalaliMonthWeekday(currentYear, currentMonth);

  const daysGrid: (number | null)[] = [];
  for (let i = 0; i < firstDayWeekday; i++) {
    daysGrid.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    daysGrid.push(d);
  }

  const isSelected = (day: number) => {
    if (!value) return false;
    const englishVal = String(value).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    const parts = englishVal.replace(/-/g, '/').split('/');
    if (parts.length === 3) {
      return (
        Number(parts[0]) === currentYear &&
        Number(parts[1]) === currentMonth &&
        Number(parts[2]) === day
      );
    }
    return false;
  };

  const isToday = (day: number) => {
    return (
      today.year === currentYear &&
      today.month === currentMonth &&
      today.day === day
    );
  };

  const displayValue = React.useMemo(() => {
    if (!value) return '';
    let str = String(value).trim();
    if (!/^(13|14)\d{2}/.test(str)) {
      try {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
          str = d.toLocaleDateString('fa-IR-u-nu-latn', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });
        }
      } catch (e) {}
    }
    return toPersianDigits(str.replace(/-/g, '/'));
  }, [value]);

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex justify-between items-center">
          <span>{label}</span>
          {required && <span className="text-rose-500 font-normal">* الزامی</span>}
        </label>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          readOnly
          onClick={() => {
            updatePosition();
            setIsOpen(true);
          }}
          placeholder={placeholder}
          className={`w-full box-border ${inputClassName?.includes('h-') || inputClassName?.includes('h-[') ? 'py-0 leading-none' : 'h-[38px] py-1.5'} ${inputClassName?.includes('rounded') ? '' : 'rounded-lg'} px-3 pr-3 pl-8 border border-slate-300 dark:border-[#2d2d30] bg-white dark:bg-[#161619] text-slate-900 dark:text-white hover:border-indigo-500 dark:hover:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-sans cursor-pointer select-none font-bold text-xs transition-all shadow-2xs ${inputClassName}`}
          required={required}
        />
        
        {value ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-rose-500 rounded transition-colors cursor-pointer"
            title="پاک کردن تاریخ"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
        )}
      </div>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={popupRef}
          dir="rtl"
          style={{
            position: 'fixed',
            left: `${coords.left}px`,
            width: '280px',
            maxWidth: 'calc(100vw - 20px)',
            zIndex: 99999,
            ...(coords.openUpwards
              ? { bottom: `${coords.bottom}px` }
              : { top: `${coords.top}px` }),
          }}
          className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-xl shadow-2xl p-3 text-right no-print animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Month / Year Header */}
          <div className="flex items-center justify-between gap-1 border-b border-slate-200 dark:border-[#2d2d30] pb-2 mb-2 relative">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 hover:bg-slate-100 dark:hover:bg-[#1a1a1c] rounded text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
              title="ماه قبل"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 relative">
              {/* لیست بازشونده اختصاصی انتخاب ماه */}
              <div className="relative" ref={monthMenuRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsYearDropdownOpen(false);
                    setIsMonthDropdownOpen(!isMonthDropdownOpen);
                  }}
                  className={`flex items-center gap-1 bg-slate-50 dark:bg-[#18181b] hover:bg-slate-100 dark:hover:bg-[#222226] text-slate-800 dark:text-slate-200 text-xs font-bold rounded-lg px-2 py-1 transition-all cursor-pointer border ${
                    isMonthDropdownOpen 
                      ? 'border-indigo-500 ring-1 ring-indigo-500/30' 
                      : 'border-slate-200 dark:border-[#2d2d30]'
                  }`}
                >
                  <span>{MONTH_NAMES[currentMonth - 1]}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${isMonthDropdownOpen ? 'rotate-180 text-indigo-500' : ''}`} />
                </button>

                {isMonthDropdownOpen && (
                  <div className="absolute top-full mt-1.5 right-0 z-50 w-44 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-[#2d2d30] rounded-xl shadow-2xl p-1.5 grid grid-cols-2 gap-1 animate-in fade-in zoom-in-95 duration-100">
                    {MONTH_NAMES.map((name, idx) => {
                      const m = idx + 1;
                      const isCurr = m === currentMonth;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentMonth(m);
                            setIsMonthDropdownOpen(false);
                          }}
                          className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer text-right ${
                            isCurr
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 font-bold'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#24242a]'
                          }`}
                        >
                          <span>{name}</span>
                          {isCurr && <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* لیست بازشونده اختصاصی انتخاب سال */}
              <div className="relative" ref={yearMenuRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMonthDropdownOpen(false);
                    setIsYearDropdownOpen(!isYearDropdownOpen);
                  }}
                  className={`flex items-center gap-1 bg-slate-50 dark:bg-[#18181b] hover:bg-slate-100 dark:hover:bg-[#222226] text-slate-800 dark:text-slate-200 text-xs font-bold rounded-lg px-2 py-1 transition-all cursor-pointer font-mono border ${
                    isYearDropdownOpen 
                      ? 'border-indigo-500 ring-1 ring-indigo-500/30' 
                      : 'border-slate-200 dark:border-[#2d2d30]'
                  }`}
                >
                  <span>{toPersianDigits(currentYear)}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${isYearDropdownOpen ? 'rotate-180 text-indigo-500' : ''}`} />
                </button>

                {isYearDropdownOpen && (
                  <div className="absolute top-full mt-1.5 left-0 z-50 w-28 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-[#2d2d30] rounded-xl shadow-2xl p-1.5 max-h-52 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
                    {yearsRange.map((y) => {
                      const isCurr = y === currentYear;
                      return (
                        <button
                          key={y}
                          ref={isCurr ? selectedYearRef : undefined}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentYear(y);
                            setIsYearDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono transition-colors cursor-pointer text-right my-0.5 ${
                            isCurr
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 font-bold'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#24242a]'
                          }`}
                        >
                          <span>{toPersianDigits(y)}</span>
                          {isCurr && <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={nextMonth}
              className="p-1 hover:bg-slate-100 dark:hover:bg-[#1a1a1c] rounded text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
              title="ماه بعد"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Names */}
          <div className="grid grid-cols-7 gap-1 text-center text-slate-400 dark:text-slate-500 font-bold text-[11px] mb-1.5">
            {WEEKDAYS.map((day, idx) => (
              <div key={idx} className="py-0.5">
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center font-mono">
            {daysGrid.map((day, idx) => {
              if (day === null) {
                return <div key={idx} className="p-1"></div>;
              }

              const isSel = isSelected(day);
              const isTod = isToday(day);

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleDaySelect(day)}
                  className={`h-7 rounded-md text-xs transition-all font-sans font-bold flex items-center justify-center cursor-pointer ${
                    isSel
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : isTod
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40 hover:bg-indigo-100'
                      : 'hover:bg-slate-100 dark:hover:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {toPersianDigits(day)}
                </button>
              );
            })}
          </div>

          {/* Today & Close footer */}
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#242428] flex justify-between items-center text-[11px]">
            <button
              type="button"
              onClick={() => {
                setCurrentYear(today.year);
                setCurrentMonth(today.month);
                handleDaySelect(today.day);
              }}
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-bold cursor-pointer transition-colors"
            >
              امروز ({toPersianDigits(today.day)} {MONTH_NAMES[today.month - 1]})
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold cursor-pointer transition-colors"
            >
              بستن
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

