import * as XLSX from 'xlsx';
import { toEnglishDigits } from './numberUtils';

export type DefinitionEntityType = 
  | 'vehicles' 
  | 'persons' 
  | 'companies' 
  | 'service_definitions' 
  | 'mechanics' 
  | 'suppliers';

export interface DefinitionColumnConfig {
  key: string;
  label: string;
  required?: boolean;
  sample: string | number;
  aliases: string[];
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
      { key: 'name', label: 'نام خودرو', required: true, sample: 'پژو پارس TU5', aliases: ['نام خودرو', 'خودرو', 'نام', 'مدل', 'vehicle', 'vehiclename', 'name'] },
      { key: 'productionYear', label: 'سال ساخت', sample: 1402, aliases: ['سال ساخت', 'مدل سال', 'سال', 'year', 'productionyear'] },
      { key: 'currentKm', label: 'کارکرد فعلی (کیلومتر)', sample: 45000, aliases: ['کارکرد فعلی', 'کارکرد اولیه', 'کیلومتر فعلی', 'کیلومتر', 'کارکرد', 'currentkm', 'km', 'odometer'] },
      { key: 'company', label: 'شرکت منتسب', sample: 'شرکت راهسازی سپید', aliases: ['شرکت', 'شرکت منتسب', 'نام شرکت', 'واحد سازمانی', 'شرکت بهره‌بردار', 'company', 'organization'] },
      { key: 'driverName', label: 'راننده منتسب', sample: 'علی محمدی', aliases: ['راننده', 'راننده منتسب', 'نام راننده', 'driver', 'drivername'] },
      { key: 'plaque', label: 'شماره پلاک', required: true, sample: '۱۲ ب ۳۶۵ ایران ۱۱', aliases: ['شماره پلاک', 'پلاک', 'پلاک خودرو', 'plaque', 'plate'] }
    ]
  },
  persons: {
    title: 'تعریف رانندگان',
    sheetName: 'رانندگان',
    description: 'مشخصات رانندگان شامل نام و نام خانوادگی و شماره تماس',
    columns: [
      { key: 'fullName', label: 'نام راننده', required: true, sample: 'یاسر باقریان', aliases: ['نام راننده', 'نام و نام خانوادگی', 'نام', 'نام کامل', 'پرسنل', 'راننده', 'fullname', 'name'] },
      { key: 'phone', label: 'شماره تماس', required: true, sample: '09173648806', aliases: ['شماره تماس', 'شماره همراه', 'موبایل', 'تلفن', 'تلفن همراه', 'phone', 'mobile'] }
    ]
  },
  companies: {
    title: 'تعریف شرکت‌ها',
    sheetName: 'شرکت‌ها',
    description: 'مشخصات شرکت‌ها شامل نام شرکت، آدرس و وضعیت فعالیت',
    columns: [
      { key: 'name', label: 'نام شرکت', required: true, sample: 'شرکت ساختمانی یاس', aliases: ['نام شرکت', 'شرکت', 'سازمان', 'نام سازمان', 'company', 'name'] },
      { key: 'address', label: 'آدرس شرکت', sample: 'تهران، خیابان ولیعصر', aliases: ['آدرس شرکت', 'آدرس', 'نشانی', 'محل', 'address'] },
      { key: 'status', label: 'وضعیت فعالیت', sample: 'فعال', aliases: ['وضعیت فعالیت', 'وضعیت', 'status'] }
    ]
  },
  service_definitions: {
    title: 'تعاریف سرویس‌ها و خدمات',
    sheetName: 'تعاریف سرویس‌ها',
    description: 'تعیین استانداردهای دوره‌ای تعویض شامل عنوان خدمت، دوره تعویض کیلومتری و بازه اخطار',
    columns: [
      { key: 'serviceType', label: 'عنوان خدمت / سرویس', required: true, sample: 'تعویض روغن موتور و فیلتر', aliases: ['عنوان خدمت', 'عنوان سرویس', 'نوع سرویس', 'نام سرویس', 'خدمت', 'servicetype', 'title', 'name'] },
      { key: 'intervalKm', label: 'دوره تعویض (کیلومتر)', required: true, sample: 6000, aliases: ['دوره تعویض', 'دوره کیلومتر', 'کیلومتر تعویض', 'دوره کارکرد', 'کیلومتر دوره', 'فاصله تعویض', 'intervalkm', 'interval'] },
      { key: 'warningKm', label: 'بازه اخطار (کیلومتر)', sample: 200, aliases: ['بازه اخطار', 'اخطار کیلومتر', 'اخطار', 'warningkm', 'warning'] }
    ]
  },
  mechanics: {
    title: 'تعریف تعمیرکاران',
    sheetName: 'تعمیرکاران',
    description: 'مشخصات تعمیرکاران شامل نام تعمیرکار، نام تعمیرگاه، تخصص، تلفن تماس و وضعیت',
    columns: [
      { key: 'name', label: 'نام تعمیرکار', required: true, sample: 'استاد رضا عباسی', aliases: ['نام تعمیرکار', 'تعمیرکار', 'نام', 'مکانیک', 'name', 'mechanicname'] },
      { key: 'shopName', label: 'نام تعمیرگاه', sample: 'تعمیرگاه تخصصی پارس', aliases: ['نام تعمیرگاه', 'تعمیرگاه', 'کارگاه', 'shopname', 'shop'] },
      { key: 'specialty', label: 'تخصص', sample: 'مکانیک موتور و گیربکس', aliases: ['تخصص', 'زمینه تخصصی', 'رشته', 'مهارت', 'specialty'] },
      { key: 'phone', label: 'تلفن تماس', sample: '09121112233', aliases: ['تلفن تماس', 'شماره تماس', 'موبایل', 'تلفن', 'phone', 'mobile'] },
      { key: 'status', label: 'وضعیت', sample: 'فعال', aliases: ['وضعیت', 'وضعیت فعالیت', 'status'] }
    ]
  },
  suppliers: {
    title: 'تعریف تامین‌کنندگان',
    sheetName: 'تامین‌کنندگان',
    description: 'مشخصات تامین‌کنندگان شامل نام تامین‌کننده، شماره تماس و آدرس',
    columns: [
      { key: 'name', label: 'نام تامین‌کننده / فروشگاه', required: true, sample: 'لوازم یدکی اتحاد', aliases: ['نام تامین‌کننده', 'نام فروشگاه', 'تامین‌کننده', 'فروشگاه', 'name', 'suppliername'] },
      { key: 'phone', label: 'شماره تماس', required: true, sample: '02133990011', aliases: ['شماره تماس', 'تلفن', 'تلفن ثابت', 'موبایل', 'شماره همراه', 'phone', 'mobile'] },
      { key: 'address', label: 'آدرس', sample: 'خیابان چراغ برق، پلاک ۲۴', aliases: ['آدرس', 'نشانی', 'محل', 'address'] }
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
    if (sName.includes('تعمیر') || sName.includes('مکانیک') || sName.includes('mechanic')) return 'mechanics';
    if (sName.includes('تامین') || sName.includes('فروشگاه') || sName.includes('supplier') || sName.includes('vendor')) return 'suppliers';
  }

  const normalizedHeaders = headers.map(h => String(h).trim().toLowerCase().replace(/[\s_\-]+/g, ''));

  let bestMatch: DefinitionEntityType | null = null;
  let maxScore = 0;

  const entityTypes: DefinitionEntityType[] = ['vehicles', 'persons', 'companies', 'service_definitions', 'mechanics', 'suppliers'];

  for (const type of entityTypes) {
    const config = DEFINITION_COLUMNS_CONFIG[type];
    let score = 0;

    config.columns.forEach(col => {
      const isMatched = normalizedHeaders.some(header => {
        return col.aliases.some(alias => {
          const normAlias = alias.toLowerCase().replace(/[\s_\-]+/g, '');
          return header === normAlias || header.includes(normAlias) || normAlias.includes(header);
        });
      });

      if (isMatched) {
        score += col.required ? 3 : 1;
      }
    });

    if (score > maxScore && score >= 2) {
      maxScore = score;
      bestMatch = type;
    }
  }

  return bestMatch;
}

/**
 * مپینگ ستون‌های اکسل به کلیدهای استاندارداطلاعات
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

  fileHeaders.forEach(fileHeader => {
    const cleanHeader = fileHeader.trim().toLowerCase().replace(/[\s_\-]+/g, '');
    let matchedKey: string | null = null;

    for (const col of config.columns) {
      const match = col.aliases.some(alias => {
        const normAlias = alias.toLowerCase().replace(/[\s_\-]+/g, '');
        return cleanHeader === normAlias || cleanHeader.includes(normAlias) || normAlias.includes(cleanHeader);
      });

      if (match) {
        matchedKey = col.key;
        break;
      }
    }

    if (matchedKey) {
      mappedColumns[fileHeader] = matchedKey;
    } else {
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

    // نرمال‌سازی اختصاصی بر اساس نوع
    if (entityType === 'vehicles') {
      if (entity.productionYear) entity.productionYear = Number(toEnglishDigits(String(entity.productionYear))) || 1400;
      if (entity.currentKm) entity.currentKm = Number(toEnglishDigits(String(entity.currentKm))) || 0;
      if (!entity.status) entity.status = 'active';
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
 * خواندن فایل اکسل و استخراج داده‌های شیت‌ها
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
        const workbook = XLSX.read(data, { type: 'binary' });

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
    reader.readAsBinaryString(file);
  });
}

/**
 * ایجاد و دانلود فایل نمونه قالب اکسل استاندارد
 */
export function downloadExcelTemplate(entityType?: DefinitionEntityType) {
  const wb = XLSX.utils.book_new();

  if (entityType) {
    // ایجاد یک شیت اختصاصی
    const config = DEFINITION_COLUMNS_CONFIG[entityType];
    const headers = config.columns.map(c => c.label + (c.required ? ' *' : ''));
    const sampleRow = config.columns.map(c => c.sample);

    const wsData = [
      headers,
      sampleRow
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // تنظیم عرض ستون‌ها
    ws['!cols'] = config.columns.map(() => ({ wch: 22 }));

    XLSX.utils.book_append_sheet(wb, ws, config.sheetName);
    XLSX.writeFile(wb, `قالب_اکسل_${config.sheetName}.xlsx`);
  } else {
    // ایجاد فایل قالب جامع با تمامی شیت‌ها
    const types: DefinitionEntityType[] = ['vehicles', 'persons', 'companies', 'service_definitions', 'mechanics', 'suppliers'];

    types.forEach(type => {
      const config = DEFINITION_COLUMNS_CONFIG[type];
      const headers = config.columns.map(c => c.label + (c.required ? ' *' : ''));
      const sampleRow = config.columns.map(c => c.sample);

      const wsData = [
        headers,
        sampleRow
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = config.columns.map(() => ({ wch: 22 }));
      XLSX.utils.book_append_sheet(wb, ws, config.sheetName);
    });

    XLSX.writeFile(wb, `قالب_جامع_اکسل_تعاریف_ناوگان.xlsx`);
  }
}
