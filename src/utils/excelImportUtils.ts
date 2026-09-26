import * as XLSX from 'xlsx';
import { toEnglishDigits } from './numberUtils';

export type DefinitionEntityType = 
  | 'vehicles' 
  | 'persons' 
  | 'companies' 
  | 'service_definitions' 
  | 'failure_definitions' 
  | 'mechanics' 
  | 'suppliers';

export interface DefinitionColumnConfig {
  key: string;
  label: string;
  required?: boolean;
  sample: string | number;
  aliases: string[];
}

export const ROW_HEADER_ALIASES = [
  'ردیف',
  'شماره ردیف',
  'شماره',
  'row',
  'radif',
  'index',
  'idx',
  '#'
];

export function isRowIndexHeader(header: string): boolean {
  if (!header) return false;
  const clean = header.trim().toLowerCase().replace(/[\s_\-]+/g, '');
  return ROW_HEADER_ALIASES.some(alias => clean === alias.toLowerCase().replace(/[\s_\-]+/g, ''));
}

export const DEFINITION_COLUMNS_CONFIG: Record<DefinitionEntityType, {
  title: string;
  sheetName: string;
  description: string;
  columns: DefinitionColumnConfig[];
}> = {
  vehicles: {
    title: 'تعریف خودروها',
    sheetName: 'خودروها',
    description: 'مشخصات تعریف خودرو شامل کد، نام خودرو، سال ساخت، کارکرد فعلی، شرکت منتسب، راننده منتسب و پلاک',
    columns: [
      { key: 'code', label: 'کد خودرو', required: true, sample: 'V-101', aliases: ['کد خودرو', 'کد', 'کد ناوگان', 'شناسه خودرو', 'code', 'vehiclecode'] },
      { key: 'name', label: 'نام خودرو', required: true, sample: 'پژو پارس TU5', aliases: ['نام خودرو', 'مدل خودرو', 'خودرو', 'مدل', 'تیپ خودرو', 'نام ماشین', 'ماشین', 'vehicle', 'vehiclename'] },
      { key: 'productionYear', label: 'سال ساخت', sample: 1402, aliases: ['سال ساخت', 'مدل سال', 'سال', 'year', 'productionyear'] },
      { key: 'currentKm', label: 'کارکرد فعلی (کیلومتر)', sample: 45000, aliases: ['کارکرد فعلی', 'کارکرد اولیه', 'کیلومتر فعلی', 'کیلومتر', 'کارکرد', 'currentkm', 'km', 'odometer'] },
      { key: 'company', label: 'شرکت منتسب', sample: 'شرکت راهسازی سپید', aliases: ['شرکت', 'شرکت منتسب', 'نام شرکت', 'واحد سازمانی', 'شرکت بهره‌بردار', 'پروژه / شرکت', 'پروژه', 'نام سازمان', 'company', 'organization'] },
      { key: 'driverName', label: 'راننده منتسب', sample: 'علی محمدی', aliases: ['راننده', 'راننده منتسب', 'نام راننده', 'شوفر', 'driver', 'drivername'] },
      { key: 'plaque', label: 'شماره پلاک', required: true, sample: '۱۲ ب ۳۶۵ ایران ۱۱', aliases: ['شماره پلاک', 'پلاک', 'پلاک خودرو', 'شماره انتظامی', 'plaque', 'plate'] }
    ]
  },
  persons: {
    title: 'تعریف رانندگان',
    sheetName: 'رانندگان',
    description: 'مشخصات رانندگان شامل نام و نام خانوادگی و شماره تماس',
    columns: [
      { key: 'fullName', label: 'نام و نام خانوادگی', required: true, sample: 'علی رضایی', aliases: ['نام و نام خانوادگی', 'نام راننده', 'نام و نام خانوادگی راننده', 'نام کامل', 'پرسنل', 'راننده', 'نام پرسنل', 'fullname', 'name'] },
      { key: 'phone', label: 'شماره تماس', required: true, sample: '09123456789', aliases: ['شماره تماس', 'شماره همراه', 'موبایل', 'تلفن', 'تلفن همراه', 'شماره تماس (موبایل)', 'phone', 'mobile'] }
    ]
  },
  companies: {
    title: 'تعریف شرکت‌ها',
    sheetName: 'شرکت‌ها',
    description: 'مشخصات شرکت‌ها شامل نام شرکت / سازمان، وضعیت شرکت و آدرس کامل',
    columns: [
      { key: 'name', label: 'نام شرکت / سازمان', required: true, sample: 'شرکت ساختمانی یاس', aliases: ['نام شرکت / سازمان', 'نام شرکت', 'نام سازمان', 'شرکت', 'سازمان', 'نام پروژه', 'شرکت طرف قرارداد', 'company', 'companyname', 'name'] },
      { key: 'status', label: 'وضعیت شرکت', sample: 'فعال', aliases: ['وضعیت شرکت', 'وضعیت', 'وضعیت فعالیت', 'status'] },
      { key: 'address', label: 'آدرس کامل', sample: 'تهران، خیابان ولیعصر', aliases: ['آدرس کامل', 'آدرس', 'آدرس شرکت', 'نشانی', 'محل', 'address'] }
    ]
  },
  service_definitions: {
    title: 'تعاریف سرویس‌ها و خدمات',
    sheetName: 'تعاریف سرویس‌ها',
    description: 'تعیین استانداردهای دوره‌ای تعویض شامل عنوان خدمت، زمان / دوره تعویض و بازه اخطار',
    columns: [
      { key: 'serviceType', label: 'عنوان خدمت', required: true, sample: 'تعویض روغن موتور و فیلتر', aliases: ['عنوان خدمت', 'عنوان سرویس', 'نوع سرویس', 'نام سرویس', 'خدمت', 'servicetype', 'title'] },
      { key: 'intervalKm', label: 'دوره تعویض (کیلومتر)', required: true, sample: 5000, aliases: ['دوره تعویض (کیلومتر)', 'دوره تعویض', 'زمان / دوره تعویض (کیلومتر)', 'دوره کیلومتر', 'کیلومتر تعویض', 'دوره کارکرد', 'کیلومتر دوره', 'فاصله تعویض', 'intervalkm', 'interval'] },
      { key: 'warningKm', label: 'بازه اخطار (کیلومتر)', required: true, sample: 200, aliases: ['بازه اخطار (کیلومتر)', 'بازه اخطار', 'اخطار کیلومتر', 'اخطار', 'warningkm', 'warning'] }
    ]
  },
  failure_definitions: {
    title: 'تعاریف انواع خرابی',
    sheetName: 'تعاریف خرابی‌ها',
    description: 'ثبت و دسته‌بندی عیوب و نقص‌های فنی ناوگان خودرویی',
    columns: [
      { key: 'failureType', label: 'نوع خرابی (عنوان نقص فنی)', required: true, sample: 'سوختن واشر سرسیلندر', aliases: ['نوع خرابی (عنوان نقص فنی)', 'نوع خرابی', 'عنوان خرابی', 'نام خرابی', 'عیب', 'نقص فنی', 'نوع عیب', 'failuretype'] },
      { key: 'category', label: 'دسته خرابی', required: true, sample: 'مکانیکی (موتور / گیربکس / ترمز)', aliases: ['دسته خرابی', 'دسته', 'گروه خرابی', 'نوع سیستم', 'category'] },
      { key: 'description', label: 'توضیحات و علائم عیب‌یابی', sample: 'کم کردن آب رادیاتور و اختلاط آب و روغن', aliases: ['توضیحات و علائم عیب‌یابی', 'توضیحات و علائم عیب', 'توضیحات', 'شرح', 'شرح عیب', 'علائم', 'description', 'notes'] }
    ]
  },
  mechanics: {
    title: 'تعریف تعمیرکاران',
    sheetName: 'تعمیرکاران',
    description: 'مشخصات تعمیرکاران شامل نام و نام خانوادگی، شماره تماس، تخصص اصلی و آدرس',
    columns: [
      { key: 'name', label: 'نام و نام خانوادگی تعمیرکار', required: true, sample: 'رضا کریمی', aliases: ['نام و نام خانوادگی تعمیرکار', 'نام تعمیرکار', 'تعمیرکار', 'مکانیک', 'نام استادکار', 'mechanicname', 'name'] },
      { key: 'phone', label: 'شماره تماس تعمیرکار', required: true, sample: '09123456789', aliases: ['شماره تماس تعمیرکار', 'شماره تماس', 'تلفن تماس', 'موبایل', 'تلفن', 'phone', 'mobile'] },
      { key: 'specialty', label: 'تخصص اصلی', sample: 'مکانیک موتور و گیربکس', aliases: ['تخصص اصلی', 'تخصص', 'زمینه تخصصی', 'رشته', 'مهارت', 'specialty'] },
      { key: 'shopName', label: 'آدرس (تعمیرگاه)', required: true, sample: 'تعمیرگاه مرکزی، خیابان آزادی', aliases: ['آدرس', 'آدرس (تعمیرگاه)', 'آدرس / نام تعمیرگاه', 'نام تعمیرگاه', 'تعمیرگاه', 'کارگاه', 'shopname', 'shop', 'address'] }
    ]
  },
  suppliers: {
    title: 'تعریف تامین‌کنندگان',
    sheetName: 'تامین‌کنندگان',
    description: 'مشخصات تامین‌کنندگان شامل نام تامین‌کننده / فروشگاه، شماره تماس و آدرس',
    columns: [
      { key: 'name', label: 'نام تامین‌کننده / فروشگاه', required: true, sample: 'بازرگانی پارت سنتر', aliases: ['نام تامین‌کننده / فروشگاه', 'نام تامین‌کننده', 'نام فروشگاه', 'تامین‌کننده', 'فروشگاه', 'suppliername', 'name'] },
      { key: 'phone', label: 'شماره تماس', required: true, sample: '02133991122', aliases: ['شماره تماس', 'تلفن', 'تلفن ثابت', 'موبایل', 'شماره همراه', 'phone', 'mobile'] },
      { key: 'address', label: 'آدرس', sample: 'تهران، خیابان چراغ برق، پاساژ کاشانی، پلاک ۱۲', aliases: ['آدرس', 'نشانی', 'محل', 'address'] }
    ]
  }
};

/**
 * تشخیص خودکار نوع موجودیت بر اساس نام شیت یا ستون‌های جدول
 */
export function detectEntityTypeFromColumns(headers: string[], sheetName?: string): DefinitionEntityType | null {
  if (sheetName) {
    const sName = sheetName.trim().toLowerCase();
    if (sName.includes('خودرو') || sName.includes('ماشین') || sName.includes('vehicle') || sName.includes('car')) return 'vehicles';
    if (sName.includes('راننده') || sName.includes('پرسنل') || sName.includes('شخص') || sName.includes('اشخاص') || sName.includes('driver') || sName.includes('person')) return 'persons';
    if (sName.includes('شرکت') || sName.includes('سازمان') || sName.includes('company') || sName.includes('org')) return 'companies';
    if (sName.includes('سرویس') || sName.includes('خدمت') || sName.includes('service')) return 'service_definitions';
    if (sName.includes('خرابی') || sName.includes('عیب') || sName.includes('نقص') || sName.includes('failure') || sName.includes('defect')) return 'failure_definitions';
    if (sName.includes('تعمیر') || sName.includes('مکانیک') || sName.includes('mechanic')) return 'mechanics';
    if (sName.includes('تامین') || sName.includes('فروشگاه') || sName.includes('supplier') || sName.includes('vendor')) return 'suppliers';
  }

  // حذف ستون ردیف از فرآیند امتیازدهی تشخیص موجودیت
  const dataHeaders = headers.filter(h => !isRowIndexHeader(h));
  const normalizedHeaders = dataHeaders.map(h => String(h).trim().toLowerCase().replace(/[\s_\-]+/g, ''));

  let bestMatch: DefinitionEntityType | null = null;
  let maxScore = 0;

  const entityTypes: DefinitionEntityType[] = ['companies', 'vehicles', 'persons', 'service_definitions', 'failure_definitions', 'mechanics', 'suppliers'];

  for (const type of entityTypes) {
    const config = DEFINITION_COLUMNS_CONFIG[type];
    let score = 0;
    const matchedCols = new Set<string>();

    normalizedHeaders.forEach(header => {
      for (const col of config.columns) {
        if (matchedCols.has(col.key)) continue;

        // تطبیق دقیق دارای بالاترین اولویت و وزن است
        const isExact = col.aliases.some(alias => {
          const normAlias = alias.toLowerCase().replace(/[\s_\-]+/g, '');
          return header === normAlias;
        });

        if (isExact) {
          score += col.required ? 5 : 3;
          matchedCols.add(col.key);
          break;
        }

        // تطبیق جزیی فقط در صورتی که طول الیاس معنادار باشد (حداقل ۳ حرف)
        const isPartial = col.aliases.some(alias => {
          const normAlias = alias.toLowerCase().replace(/[\s_\-]+/g, '');
          return normAlias.length >= 3 && (header.includes(normAlias) || normAlias.includes(header));
        });

        if (isPartial) {
          score += col.required ? 2 : 1;
          matchedCols.add(col.key);
          break;
        }
      }
    });

    if (score > maxScore && score >= 3) {
      maxScore = score;
      bestMatch = type;
    }
  }

  return bestMatch;
}

/**
 * مپینگ هوشمند ستون‌های فایل اکسل به کلیدهای استاندارد موجودیت
 * با اولویت تطبیق دقیق و نادیده‌گرفتن ایمن ستون ردیف
 */
export function mapExcelRowsToEntities(
  rows: any[], 
  entityType: DefinitionEntityType
): { items: any[]; mappedColumns: Record<string, string>; unmappedColumns: string[] } {
  if (!rows || rows.length === 0) {
    return { items: [], mappedColumns: {}, unmappedColumns: [] };
  }

  const config = DEFINITION_COLUMNS_CONFIG[entityType];
  const sampleRow = rows[0];
  const fileHeaders = Object.keys(sampleRow);

  const mappedColumns: Record<string, string> = {}; // fileHeader -> entityKey
  const unmappedColumns: string[] = [];
  const usedKeys = new Set<string>();

  // گام اول: تطبیق صد در صد دقیق (Exact Matches)
  fileHeaders.forEach(fileHeader => {
    // ستون ردیف به عنوان شماره ترتیبی در نظر گرفته می‌شود و وارد نگاشت فیلدهای داده‌ای نمی‌گردد
    if (isRowIndexHeader(fileHeader)) return;

    const cleanHeader = fileHeader.trim().toLowerCase().replace(/[\s_\-]+/g, '');

    for (const col of config.columns) {
      if (usedKeys.has(col.key)) continue;

      const isExact = col.aliases.some(alias => {
        const normAlias = alias.toLowerCase().replace(/[\s_\-]+/g, '');
        return cleanHeader === normAlias;
      });

      if (isExact) {
        mappedColumns[fileHeader] = col.key;
        usedKeys.add(col.key);
        break;
      }
    }
  });

  // گام دوم: تطبیق جزیی (Partial Matches) برای سرستون‌های باقیمانده
  fileHeaders.forEach(fileHeader => {
    if (isRowIndexHeader(fileHeader) || mappedColumns[fileHeader]) return;

    const cleanHeader = fileHeader.trim().toLowerCase().replace(/[\s_\-]+/g, '');

    for (const col of config.columns) {
      if (usedKeys.has(col.key)) continue;

      const isPartial = col.aliases.some(alias => {
        const normAlias = alias.toLowerCase().replace(/[\s_\-]+/g, '');
        if (normAlias.length < 3) return false;
        return cleanHeader.includes(normAlias) || normAlias.includes(cleanHeader);
      });

      if (isPartial) {
        mappedColumns[fileHeader] = col.key;
        usedKeys.add(col.key);
        break;
      }
    }

    if (!mappedColumns[fileHeader]) {
      unmappedColumns.push(fileHeader);
    }
  });

  const items = rows.map(row => {
    const entity: any = {};
    fileHeaders.forEach(header => {
      const targetKey = mappedColumns[header];
      if (targetKey) {
        let val = row[header];
        if (typeof val === 'string') {
          val = toEnglishDigits(val.trim());
        }
        entity[targetKey] = val;
      }
    });

    // نرمال‌سازی اختصاصی بر اساس نوع موجودیت
    if (entityType === 'vehicles') {
      if (entity.productionYear) entity.productionYear = Number(toEnglishDigits(String(entity.productionYear))) || 1400;
      if (entity.currentKm) entity.currentKm = Number(toEnglishDigits(String(entity.currentKm))) || 0;
      if (!entity.status) entity.status = 'active';
    } else if (entityType === 'companies') {
      if (entity.name) entity.name = String(entity.name).trim();
      if (!entity.status) entity.status = 'active';
      if (entity.status === 'فعال') entity.status = 'active';
      if (entity.status === 'غیرفعال') entity.status = 'inactive';
    } else if (entityType === 'service_definitions') {
      if (entity.intervalKm) entity.intervalKm = Number(toEnglishDigits(String(entity.intervalKm))) || 5000;
      if (entity.warningKm) entity.warningKm = Number(toEnglishDigits(String(entity.warningKm))) || 500;
    } else if (entityType === 'persons') {
      if (!entity.position) entity.position = 'راننده';
      if (!entity.status) entity.status = 'active';
    }

    return entity;
  });

  return { items, mappedColumns, unmappedColumns };
}

/**
 * خواندن فایل اکسل و استخراج داده‌های شیت‌ها با پشتیبانی مطمئن از UTF-8
 */
export async function parseExcelFile(file: File): Promise<{
  sheets: { sheetName: string; rows: any[]; headers: string[] }[];
  fileName: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });

        const sheets = workbook.SheetNames.map(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          const headers: string[] = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
          return { sheetName, rows: rawRows, headers };
        });

        resolve({ sheets, fileName: file.name });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * ایجاد و دانلود فایل نمونه قالب اکسل استاندارد
 * ستون اول به صورت پیش‌فرض ستون «ردیف» قرار می‌گیرد تا فیلد داده‌ای (مانند نام شرکت) به اشتباه در ستون اول ننشیند.
 */
export function downloadExcelTemplate(entityType?: DefinitionEntityType) {
  const wb = XLSX.utils.book_new();

  if (entityType) {
    // ایجاد یک شیت اختصاصی
    const config = DEFINITION_COLUMNS_CONFIG[entityType];
    const headers = ['ردیف', ...config.columns.map(c => c.label + (c.required ? ' *' : ''))];
    const sampleRow = [1, ...config.columns.map(c => c.sample)];

    const wsData = [
      headers,
      sampleRow
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // تنظیم عرض ستون‌ها
    ws['!cols'] = [{ wch: 8 }, ...config.columns.map(() => ({ wch: 22 }))];

    XLSX.utils.book_append_sheet(wb, ws, config.sheetName);
    XLSX.writeFile(wb, `قالب_اکسل_${config.sheetName}.xlsx`);
  } else {
    // ایجاد فایل قالب جامع با تمامی شیت‌ها
    const types: DefinitionEntityType[] = ['companies', 'vehicles', 'persons', 'service_definitions', 'failure_definitions', 'mechanics', 'suppliers'];

    types.forEach(type => {
      const config = DEFINITION_COLUMNS_CONFIG[type];
      const headers = ['ردیف', ...config.columns.map(c => c.label + (c.required ? ' *' : ''))];
      const sampleRow = [1, ...config.columns.map(c => c.sample)];

      const wsData = [
        headers,
        sampleRow
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 8 }, ...config.columns.map(() => ({ wch: 22 }))];
      XLSX.utils.book_append_sheet(wb, ws, config.sheetName);
    });

    XLSX.writeFile(wb, `قالب_جامع_اکسل_تعاریف_ناوگان.xlsx`);
  }
}
