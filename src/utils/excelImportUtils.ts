import * as XLSX from 'xlsx';
import { toEnglishDigits } from './numberUtils';

export type DefinitionEntityType = 
  | 'services'
  | 'failures'
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
  '#',
  'no',
  'no.'
];

/**
 * نرمال‌سازی دقیق سرستون‌ها با حذف علائم ستاره، پرانتز، دو نقطه، خط تیره، فاصله‌ها و نیم‌فاصله‌ها
 */
export function normalizeHeader(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/[*:\(\)\[\]،,\-\_]/g, ' ') // remove symbols, asterisks, colons, brackets, dashes
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200b\u200e\u200f\u00a0]/g, '') // remove zero-width spaces, LTR/RTL marks, and NBSP
    .replace(/\s+/g, '') // remove all whitespaces
    .trim()
    .toLowerCase();
}

export function isRowIndexHeader(header: string): boolean {
  if (!header) return false;
  const clean = normalizeHeader(header);
  return ROW_HEADER_ALIASES.some(alias => clean === normalizeHeader(alias));
}

export const DEFINITION_COLUMNS_CONFIG: Record<DefinitionEntityType, {
  title: string;
  sheetName: string;
  description: string;
  columns: DefinitionColumnConfig[];
}> = {
  services: {
    title: 'پذیرش و سرویس‌های دوره‌ای',
    sheetName: 'سرویس‌ها و پذیرش',
    description: 'پذیرش خودرو، ثبت تعویض روغن، فیلتر، لنت، تسمه تایم، قطعات مصرفی، منبع تأمین، کیلومتر، هزینه و فاکتور',
    columns: [
      { key: 'code', label: 'کد خودرو', required: true, sample: 'V-101', aliases: ['کد خودرو', 'کد', 'کد ناوگان', 'شناسه خودرو', 'کد ماشین', 'شماره کد', 'code', 'vehiclecode', 'carcode', 'id'] },
      { key: 'vehicleName', label: 'نام خودرو', required: true, sample: 'پژو پارس TU5', aliases: ['نام خودرو', 'مدل خودرو', 'خودرو', 'مدل', 'تیپ خودرو', 'نام ماشین', 'ماشین', 'نوع خودرو', 'عنوان خودرو', 'vehiclename', 'car', 'vehicle', 'name', 'model'] },
      { key: 'plaque', label: 'شماره پلاک', required: true, sample: '۱۲ ب ۳۶۵ ایران ۱۱', aliases: ['شماره پلاک', 'پلاک', 'شماره انتظامی', 'پلاک خودرو', 'پلاک ماشین', 'شماره پلاک خودرو', 'plaque', 'plate', 'pelak'] },
      { key: 'serviceType', label: 'نوع سرویس / خدمت', required: true, sample: 'تعویض روغن موتور و فیلترها', aliases: ['نوع سرویس / خدمت', 'نوع سرویس / عنوان خدمت', 'نوع سرویس', 'عنوان سرویس', 'شرح خدمت', 'سرویس', 'نوع خدمت', 'عنوان خدمت', 'خدمت', 'شرح سرویس', 'servicetype', 'service', 'title'] },
      { key: 'serviceDate', label: 'تاریخ انجام / پذیرش', required: true, sample: '1403/07/15', aliases: ['تاریخ انجام / پذیرش', 'تاریخ انجام', 'تاریخ پذیرش', 'تاریخ انجام سرویس', 'تاریخ سرویس', 'تاریخ', 'servicedate', 'date'] },
      { key: 'currentKm', label: 'کیلومتر پذیرش', required: true, sample: 65000, aliases: ['کیلومتر پذیرش', 'کیلومتر در زمان پذیرش', 'کیلومتر فعلی', 'کیلومتر', 'کارکرد', 'کیلومتر کارکرد', 'پیمایش', 'currentkm', 'km', 'odometer', 'mileage'] },
      { key: 'nextKm', label: 'کیلومتر سرویس بعدی', sample: 70000, aliases: ['کیلومتر سرویس بعدی', 'کیلومتر بعدی', 'سرویس بعدی', 'کارکرد بعدی', 'پیمایش بعدی', 'nextkm', 'nextservicekm'] },
      { key: 'mechanicName', label: 'تعمیرکار / سرویس‌کار', sample: 'تعمیرگاه مجاز مرکزی', aliases: ['تعمیرکار / سرویس‌کار', 'نام تعمیرکار یا تعمیرگاه', 'نام تعمیرکار یا سرویس‌کار', 'تعمیرکار', 'مکانیک', 'تعمیرگاه', 'سرویس کار', 'سرویس‌کار', 'نام تعمیرگاه', 'mechanic', 'mechanicname', 'repairshop'] },
      { key: 'partName', label: 'نام قطعه مصرفی', sample: 'روغن موتور بهران و فیلتر سرکان', aliases: ['نام قطعه مصرفی', 'نام قطعه', 'قطعه', 'قطعات', 'قطعات مصرفی', 'شرح کالا', 'نام کالا', 'کالا', 'partname', 'part', 'parts', 'item'] },
      { key: 'partSource', label: 'محل تأمین قطعه', sample: 'انبار شرکت', aliases: ['محل تأمین قطعه', 'محل تامین قطعه', 'محل تهیه قطعه', 'محل تهیه', 'منبع قطعه', 'محل تأمین', 'محل تامین', 'منبع تأمین', 'تامین از', 'نحوه تهیه قطعه', 'منبع', 'partsource', 'source'] },
      { key: 'supplierName', label: 'فروشگاه / تامین‌کننده قطعه', sample: 'فروشگاه ایران یدک', aliases: ['فروشگاه / تامین‌کننده قطعه', 'تامین‌کننده قطعات', 'تامین کننده', 'فروشگاه', 'محل خرید', 'فروشگاه قطعه', 'نام تامین کننده', 'تامین کننده قطعه', 'تامین‌کننده', 'خریداری شده از', 'خرید قطعه از', 'supplier', 'suppliername', 'vendor', 'store', 'shop'] },
      { key: 'quantity', label: 'تعداد قطعه', sample: 4, aliases: ['تعداد قطعه', 'تعداد / مقدار قطعه', 'تعداد', 'مقدار', 'مقدار مصرفی', 'حجم', 'quantity', 'qty', 'count'] },
      { key: 'unitPrice', label: 'قیمت واحد قطعه (ریال)', sample: 2500000, aliases: ['قیمت واحد قطعه (ریال)', 'قیمت واحد قطعه', 'قیمت واحد', 'فی', 'مبلغ واحد', 'مبلغ واحد قطعه', 'unitprice', 'price'] },
      { key: 'partsCost', label: 'هزینه کل قطعات (ریال)', sample: 10000000, aliases: ['هزینه کل قطعات (ریال)', 'هزینه قطعات (ریال)', 'هزینه کل قطعات', 'هزینه قطعات', 'هزینه قطعه', 'مبلغ قطعات', 'قیمت قطعات', 'partscost', 'partcost'] },
      { key: 'wages', label: 'اجرت و دستمزد (ریال)', sample: 3500000, aliases: ['اجرت و دستمزد (ریال)', 'اجرت و دستمزد', 'اجرت تعمیرکار', 'اجرت', 'دستمزد', 'هزینه دستمزد', 'اجرت سرویس', 'wages', 'wage', 'labor'] },
      { key: 'cost', label: 'هزینه کل فاکتور (ریال)', sample: 13500000, aliases: ['هزینه کل فاکتور (ریال)', 'هزینه فاکتور (ریال)', 'هزینه فاکتور', 'هزینه کل', 'مبلغ کل', 'هزینه', 'مبلغ', 'مبلغ فاکتور', 'قیمت کل', 'cost', 'totalcost', 'total', 'amount'] },
      { key: 'invoiceNumber', label: 'شماره فاکتور', sample: '45812', aliases: ['شماره فاکتور', 'شماره فاکتور خرید', 'شماره سند', 'کد فاکتور', 'شماره قبض', 'invoicenumber', 'invoiceno', 'factorno', 'factornumber'] },
      { key: 'driverName', label: 'نام راننده', sample: 'علی محمدی', aliases: ['نام راننده', 'راننده', 'تحویل دهنده', 'driver', 'drivername'] },
      { key: 'company', label: 'شرکت / پروژه', sample: 'ترابری مرکزی', aliases: ['شرکت / پروژه', 'شرکت', 'پروژه', 'نام شرکت', 'واحد', 'company', 'project'] },
      { key: 'status', label: 'وضعیت پذیرش', sample: 'تکمیل شده', aliases: ['وضعیت پذیرش', 'وضعیت', 'status'] },
      { key: 'notes', label: 'توضیحات تکمیلی', sample: 'سرویس ادواری ۶۵ هزار کیلومتر', aliases: ['توضیحات تکمیلی', 'توضیحات', 'ملاحظات', 'شرح', 'یادداشت', 'notes', 'description'] }
    ]
  },
  failures: {
    title: 'پذیرش خرابی و تعمیرگاه',
    sheetName: 'پذیرش خرابی‌ها',
    description: 'پذیرش خودرو در تعمیرگاه، ثبت عیب‌یابی، تخصیص مکانیک، قطعات مصرفی، منبع تأمین، هزینه تعمیرات، تاریخ ارجاع و ترخیص',
    columns: [
      { key: 'code', label: 'کد خودرو', required: true, sample: 'V-101', aliases: ['کد خودرو', 'کد', 'کد ناوگان', 'شناسه خودرو', 'کد ماشین', 'شماره کد', 'code', 'vehiclecode', 'carcode', 'id'] },
      { key: 'vehicleName', label: 'نام خودرو', required: true, sample: 'پژو پارس TU5', aliases: ['نام خودرو', 'مدل خودرو', 'خودرو', 'مدل', 'تیپ خودرو', 'نام ماشین', 'ماشین', 'نوع خودرو', 'عنوان خودرو', 'vehiclename', 'car', 'vehicle', 'name', 'model'] },
      { key: 'plaque', label: 'شماره پلاک', required: true, sample: '۱۲ ب ۳۶۵ ایران ۱۱', aliases: ['شماره پلاک', 'پلاک', 'شماره انتظامی', 'پلاک خودرو', 'پلاک ماشین', 'شماره پلاک خودرو', 'plaque', 'plate', 'pelak'] },
      { key: 'failureType', label: 'شرح عیب / خرابی', required: true, sample: 'سوختن واشر سرسیلندر', aliases: ['شرح عیب / خرابی', 'شرح عیب / نوع خرابی', 'شرح عیب', 'نوع خرابی', 'عنوان خرابی', 'عیب', 'خرابی', 'نقص فنی', 'شرح خرابی / اقدامات', 'شرح خرابی', 'علت خرابی', 'failuretype', 'failure', 'defect'] },
      { key: 'category', label: 'دسته خرابی', sample: 'موتور و قوای محرکه', aliases: ['دسته خرابی', 'دسته', 'گروه خرابی', 'دسته‌بندی', 'سیستم خرابی', 'category'] },
      { key: 'failureDate', label: 'تاریخ ارجاع', required: true, sample: '1403/07/15', aliases: ['تاریخ ارجاع', 'تاریخ ارجاع و پذیرش', 'تاریخ پذیرش', 'تاریخ شروع تعمیر', 'تاریخ شروع', 'تاریخ ثبت خرابی / ارجاع', 'تاریخ ثبت خرابی', 'تاریخ پذیرش / اعلام', 'تاریخ اعلام', 'تاریخ وقوع', 'تاریخ خرابی', 'تاریخ ارجاع به تعمیرگاه', 'تاریخ ورود', 'تاریخ', 'referraldate', 'startdate', 'failuredate', 'date'] },
      { key: 'dischargeDate', label: 'تاریخ ترخیص', sample: '1403/07/18', aliases: ['تاریخ ترخیص', 'تاریخ اتمام و ترخیص', 'تاریخ اتمام / ترخیص', 'تاریخ اتمام', 'تاریخ ترخیص و تحویل خودرو', 'تاریخ تحویل', 'تاریخ ترخیص و اتمام', 'تاریخ پایان', 'تاریخ ترخیص / پایان تعمیرات', 'تاریخ ترخیص / پایان', 'تاریخ خروج', 'تاریخ تحویل خودرو', 'dischargedate', 'enddate', 'completiondate', 'deliverydate'] },
      { key: 'odometer', label: 'کیلومتر خودرو', sample: 72000, aliases: ['کیلومتر خودرو', 'کیلومتر', 'کارکرد', 'کیلومتر پذیرش', 'پیمایش', 'odometer', 'km'] },
      { key: 'repairShopName', label: 'تعمیرگاه / مکانیک', sample: 'تعمیرگاه تخصصی مدرن', aliases: ['تعمیرگاه / مکانیک', 'تعمیرگاه', 'مکانیک', 'نام مکانیک', 'نام تعمیرگاه', 'محل تعمیر', 'repairshop', 'mechanic'] },
      { key: 'partName', label: 'نام قطعه مصرفی', sample: 'واشر سرسیلندر استاندارد', aliases: ['نام قطعه مصرفی', 'نام قطعه', 'قطعه', 'قطعات', 'قطعات تعویضی', 'قطعات مصرفی', 'شرح کالا', 'نام کالا', 'کالا', 'partname', 'part', 'parts', 'item'] },
      { key: 'partSource', label: 'محل تأمین قطعه', sample: 'انبار شرکت', aliases: ['محل تأمین قطعه', 'محل تامین قطعه', 'محل تهیه قطعه', 'محل تهیه', 'منبع قطعه', 'محل تأمین', 'محل تامین', 'منبع تأمین', 'تامین از', 'نحوه تهیه قطعه', 'منبع', 'partsource', 'source'] },
      { key: 'supplierName', label: 'فروشگاه / تامین‌کننده قطعه', sample: 'فروشگاه ایران یدک', aliases: ['فروشگاه / تامین‌کننده قطعه', 'تامین‌کننده قطعات', 'تامین کننده', 'فروشگاه', 'محل خرید', 'فروشگاه قطعه', 'نام تامین کننده', 'تامین کننده قطعه', 'تامین‌کننده', 'خریداری شده از', 'خرید قطعه از', 'supplier', 'suppliername', 'vendor', 'store', 'shop'] },
      { key: 'quantity', label: 'تعداد قطعه', sample: 1, aliases: ['تعداد قطعه', 'تعداد / مقدار قطعه', 'تعداد', 'مقدار', 'مقدار مصرفی', 'حجم', 'quantity', 'qty', 'count'] },
      { key: 'unitPrice', label: 'قیمت واحد قطعه (ریال)', sample: 18000000, aliases: ['قیمت واحد قطعه (ریال)', 'قیمت واحد قطعه', 'قیمت واحد', 'فی', 'مبلغ واحد', 'مبلغ واحد قطعه', 'unitprice', 'price'] },
      { key: 'partsCost', label: 'هزینه کل قطعات (ریال)', sample: 18000000, aliases: ['هزینه کل قطعات (ریال)', 'هزینه قطعات (ریال)', 'هزینه کل قطعات', 'هزینه قطعات', 'هزینه قطعه', 'مبلغ قطعات', 'قیمت قطعات', 'partscost', 'partcost'] },
      { key: 'wages', label: 'اجرت و دستمزد (ریال)', sample: 16000000, aliases: ['اجرت و دستمزد (ریال)', 'اجرت و دستمزد', 'اجرت تعمیرکار', 'اجرت', 'دستمزد', 'هزینه دستمزد', 'اجرت تعمیرات', 'اجرت تعمیرگاه', 'wages', 'wage', 'labor'] },
      { key: 'totalCost', label: 'هزینه کل فاکتور (ریال)', sample: 34000000, aliases: ['هزینه کل فاکتور (ریال)', 'هزینه کل فاکتور تعمیرات (ریال)', 'هزینه تعمیرات (ریال)', 'هزینه تعمیرات', 'هزینه کل', 'هزینه فاکتور (ریال)', 'هزینه فاکتور', 'مبلغ کل', 'مبلغ', 'هزینه', 'مبلغ فاکتور', 'totalcost', 'cost', 'price', 'amount'] },
      { key: 'invoiceNumber', label: 'شماره فاکتور', sample: '89102', aliases: ['شماره فاکتور', 'شماره فاکتور خرید', 'شماره سند', 'کد فاکتور', 'شماره قبض', 'invoicenumber', 'invoiceno', 'factorno', 'factornumber'] },
      { key: 'driverName', label: 'نام راننده', sample: 'علی محمدی', aliases: ['نام راننده', 'راننده', 'تحویل دهنده', 'driver', 'drivername'] },
      { key: 'company', label: 'شرکت / پروژه', sample: 'ترابری مرکزی', aliases: ['شرکت / پروژه', 'شرکت', 'پروژه', 'نام شرکت', 'واحد', 'company', 'project'] },
      { key: 'priority', label: 'سطح اولویت', sample: 'متوسط', aliases: ['سطح اولویت', 'اولویت', 'سطح فوریت', 'فوریت', 'priority'] },
      { key: 'status', label: 'وضعیت پذیرش', sample: 'ترخیص شده', aliases: ['وضعیت پذیرش', 'وضعیت', 'وضعیت گردش کار', 'وضعیت تعمیر', 'status'] },
      { key: 'description', label: 'توضیحات تکمیلی', sample: 'تراشکاری سرسیلندر و تعویض واشر', aliases: ['توضیحات تکمیلی', 'توضیحات', 'شرح', 'ملاحظات', 'شرح اقدامات', 'notes', 'description'] }
    ]
  },
  vehicles: {
    title: 'تعریف خودروها',
    sheetName: 'خودروها',
    description: 'مشخصات تعریف خودرو شامل کد، نام خودرو، شماره پلاک، سال ساخت، کارکرد فعلی، شرکت منتسب و راننده منتسب',
    columns: [
      { key: 'code', label: 'کد خودرو', required: true, sample: 'V-101', aliases: ['کد خودرو', 'کد', 'کد ناوگان', 'شناسه خودرو', 'شناسه', 'کد ماشین', 'code', 'vehiclecode', 'id'] },
      { key: 'name', label: 'نام خودرو', required: true, sample: 'پژو پارس TU5', aliases: ['نام خودرو', 'مدل خودرو', 'خودرو', 'مدل', 'تیپ خودرو', 'نام ماشین', 'ماشین', 'نوع خودرو', 'عنوان خودرو', 'vehicle', 'vehiclename', 'car', 'name'] },
      { key: 'plaque', label: 'شماره پلاک', required: true, sample: '۱۲ ب ۳۶۵ ایران ۱۱', aliases: ['شماره پلاک', 'پلاک', 'پلاک خودرو', 'شماره انتظامی', 'پلاک ماشین', 'شماره پلاک خودرو', 'plaque', 'plate', 'pelak'] },
      { key: 'productionYear', label: 'سال ساخت', sample: 1402, aliases: ['سال ساخت', 'مدل سال', 'سال', 'سال تولید', 'year', 'productionyear'] },
      { key: 'currentKm', label: 'کارکرد فعلی (کیلومتر)', sample: 45000, aliases: ['کارکرد فعلی (کیلومتر)', 'کارکرد فعلی', 'کارکرد اولیه', 'کیلومتر فعلی', 'کیلومتر', 'کارکرد', 'کیلومتر کارکرد', 'پیمایش', 'currentkm', 'km', 'odometer', 'mileage'] },
      { key: 'company', label: 'شرکت منتسب', sample: 'شرکت راهسازی سپید', aliases: ['شرکت منتسب', 'شرکت', 'نام شرکت', 'واحد سازمانی', 'شرکت بهره‌بردار', 'پروژه / شرکت', 'پروژه', 'نام سازمان', 'سازمان', 'company', 'organization'] },
      { key: 'driverName', label: 'راننده منتسب', sample: 'علی محمدی', aliases: ['راننده منتسب', 'راننده', 'نام راننده', 'شوفر', 'نام راننده منتسب', 'driver', 'drivername'] }
    ]
  },
  persons: {
    title: 'تعریف رانندگان',
    sheetName: 'رانندگان',
    description: 'مشخصات رانندگان شامل نام و نام خانوادگی و شماره تماس',
    columns: [
      { key: 'fullName', label: 'نام و نام خانوادگی', required: true, sample: 'علی رضایی', aliases: ['نام و نام خانوادگی', 'نام راننده', 'نام و نام خانوادگی راننده', 'نام کامل', 'پرسنل', 'راننده', 'نام پرسنل', 'نام', 'fullname', 'name', 'drivername'] },
      { key: 'phone', label: 'شماره تماس', required: true, sample: '09123456789', aliases: ['شماره تماس', 'شماره همراه', 'موبایل', 'تلفن', 'تلفن همراه', 'شماره تماس (موبایل)', 'شماره تلفن', 'شماره موبایل', 'همراه', 'phone', 'mobile', 'cellphone'] }
    ]
  },
  companies: {
    title: 'تعریف شرکت‌ها',
    sheetName: 'شرکت‌ها',
    description: 'مشخصات شرکت‌ها شامل نام شرکت / سازمان، وضعیت شرکت و آدرس کامل',
    columns: [
      { key: 'name', label: 'نام شرکت / سازمان', required: true, sample: 'شرکت ساختمانی یاس', aliases: ['نام شرکت / سازمان', 'نام شرکت', 'نام سازمان', 'شرکت', 'سازمان', 'نام پروژه', 'شرکت طرف قرارداد', 'عنوان شرکت', 'company', 'companyname', 'name'] },
      { key: 'status', label: 'وضعیت شرکت', sample: 'فعال', aliases: ['وضعیت شرکت', 'وضعیت', 'وضعیت فعالیت', 'status'] },
      { key: 'address', label: 'آدرس کامل', sample: 'تهران، خیابان ولیعصر', aliases: ['آدرس کامل', 'آدرس', 'آدرس شرکت', 'نشانی', 'محل', 'نشانی شرکت', 'address'] }
    ]
  },
  service_definitions: {
    title: 'تعاریف سرویس‌ها و خدمات',
    sheetName: 'تعاریف سرویس‌ها',
    description: 'تعیین استانداردهای دوره‌ای تعویض شامل عنوان خدمت، زمان / دوره تعویض و بازه اخطار',
    columns: [
      { key: 'serviceType', label: 'عنوان خدمت', required: true, sample: 'تعویض روغن موتور و فیلتر', aliases: ['عنوان خدمت', 'عنوان سرویس', 'نوع سرویس', 'نام سرویس', 'خدمت', 'سرویس', 'نوع خدمت', 'شرح خدمت', 'servicetype', 'service', 'title', 'name'] },
      { key: 'intervalKm', label: 'دوره تعویض (کیلومتر)', required: true, sample: 5000, aliases: ['دوره تعویض (کیلومتر)', 'دوره تعویض', 'زمان / دوره تعویض (کیلومتر)', 'دوره کیلومتر', 'کیلومتر تعویض', 'دوره کارکرد', 'کیلومتر دوره', 'فاصله تعویض', 'دوره', 'کیلومتر', 'intervalkm', 'interval', 'period'] },
      { key: 'warningKm', label: 'بازه اخطار (کیلومتر)', required: true, sample: 200, aliases: ['بازه اخطار (کیلومتر)', 'بازه اخطار', 'اخطار کیلومتر', 'اخطار', 'کیلومتر اخطار', 'هشدار', 'warningkm', 'warning'] }
    ]
  },
  failure_definitions: {
    title: 'تعاریف انواع خرابی',
    sheetName: 'تعاریف خرابی‌ها',
    description: 'ثبت و دسته‌بندی عیوب و نقص‌های فنی ناوگان خودرویی',
    columns: [
      { key: 'failureType', label: 'نوع خرابی (عنوان نقص فنی)', required: true, sample: 'سوختن واشر سرسیلندر', aliases: ['نوع خرابی (عنوان نقص فنی)', 'نوع خرابی', 'عنوان خرابی', 'نام خرابی', 'عیب', 'نقص فنی', 'نوع عیب', 'عنوان عیب', 'شرح خرابی', 'failuretype', 'failure', 'defect'] },
      { key: 'category', label: 'دسته خرابی', required: true, sample: 'مکانیکی (موتور / گیربکس / ترمز)', aliases: ['دسته خرابی', 'دسته', 'گروه خرابی', 'نوع سیستم', 'دسته‌بندی', 'دسته بندی', 'category', 'group'] },
      { key: 'description', label: 'توضیحات و علائم عیب‌یابی', sample: 'کم کردن آب رادیاتور و اختلاط آب و روغن', aliases: ['توضیحات و علائم عیب‌یابی', 'توضیحات و علائم عیب', 'توضیحات', 'شرح', 'شرح عیب', 'علائم', 'توضیح', 'description', 'notes', 'desc'] }
    ]
  },
  mechanics: {
    title: 'تعریف تعمیرکاران',
    sheetName: 'تعمیرکاران',
    description: 'مشخصات تعمیرکاران شامل نام و نام خانوادگی، شماره تماس، تخصص اصلی و آدرس',
    columns: [
      { key: 'name', label: 'نام و نام خانوادگی تعمیرکار', required: true, sample: 'رضا کریمی', aliases: ['نام و نام خانوادگی تعمیرکار', 'نام تعمیرکار', 'تعمیرکار', 'مکانیک', 'نام استادکار', 'نام و نام خانوادگی', 'نام', 'mechanicname', 'name'] },
      { key: 'phone', label: 'شماره تماس تعمیرکار', required: true, sample: '09123456789', aliases: ['شماره تماس تعمیرکار', 'شماره تماس', 'تلفن تماس', 'موبایل', 'تلفن', 'شماره همراه', 'phone', 'mobile'] },
      { key: 'specialty', label: 'تخصص اصلی', sample: 'مکانیک موتور و گیربکس', aliases: ['تخصص اصلی', 'تخصص', 'زمینه تخصصی', 'رشته', 'مهارت', 'تخصص تعمیرکار', 'specialty', 'skill'] },
      { key: 'shopName', label: 'آدرس (تعمیرگاه)', required: true, sample: 'تعمیرگاه مرکزی، خیابان آزادی', aliases: ['آدرس (تعمیرگاه)', 'آدرس', 'آدرس / نام تعمیرگاه', 'نام تعمیرگاه', 'تعمیرگاه', 'کارگاه', 'shopname', 'shop', 'address'] }
    ]
  },
  suppliers: {
    title: 'تعریف تامین‌کنندگان',
    sheetName: 'تامین‌کنندگان',
    description: 'مشخصات تامین‌کنندگان شامل نام تامین‌کننده / فروشگاه، شماره تماس و آدرس',
    columns: [
      { key: 'name', label: 'نام تامین‌کننده / فروشگاه', required: true, sample: 'بازرگانی پارت سنتر', aliases: ['نام تامین‌کننده / فروشگاه', 'نام تامین‌کننده', 'نام تامین کننده', 'نام فروشگاه', 'تامین‌کننده', 'تامین کننده', 'فروشگاه', 'نام مرکز', 'suppliername', 'name'] },
      { key: 'phone', label: 'شماره تماس', required: true, sample: '02133991122', aliases: ['شماره تماس', 'تلفن', 'تلفن ثابت', 'موبایل', 'شماره همراه', 'شماره تلفن', 'phone', 'mobile'] },
      { key: 'address', label: 'آدرس', sample: 'تهران، خیابان چراغ برق، پاساژ کاشانی، پلاک ۱۲', aliases: ['آدرس', 'نشانی', 'محل', 'آدرس فروشگاه', 'address'] }
    ]
  }
};

/**
 * تشخیص خودکار نوع موجودیت بر اساس نام شیت یا ستون‌های جدول
 */
export function detectEntityTypeFromColumns(headers: string[], sheetName?: string): DefinitionEntityType | null {
  if (sheetName) {
    const sName = normalizeHeader(sheetName);
    if (sName.includes('پذیرشخرابی') || (sName.includes('خرابی') && (sName.includes('تعمیر') || sName.includes('گزارش')))) return 'failures';
    if (sName.includes('پذیرش') || sName.includes('سرویسدوره') || (sName.includes('سرویس') && !sName.includes('تعریف'))) return 'services';
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
  const normalizedHeaders = dataHeaders.map(h => normalizeHeader(h)).filter(Boolean);

  let bestMatch: DefinitionEntityType | null = null;
  let maxScore = 0;

  const entityTypes: DefinitionEntityType[] = ['services', 'failures', 'companies', 'vehicles', 'persons', 'service_definitions', 'failure_definitions', 'mechanics', 'suppliers'];

  for (const type of entityTypes) {
    const config = DEFINITION_COLUMNS_CONFIG[type];
    let score = 0;
    const matchedCols = new Set<string>();

    normalizedHeaders.forEach(header => {
      for (const col of config.columns) {
        if (matchedCols.has(col.key)) continue;

        // تطبیق دقیق دارای بالاترین اولویت و وزن است
        const isExact = col.aliases.some(alias => {
          const normAlias = normalizeHeader(alias);
          return header === normAlias;
        });

        if (isExact) {
          score += col.required ? 5 : 3;
          matchedCols.add(col.key);
          break;
        }

        // تطبیق جزیی فقط در صورتی که طول الیاس معنادار باشد (حداقل ۳ حرف)
        const isPartial = col.aliases.some(alias => {
          const normAlias = normalizeHeader(alias);
          return normAlias.length >= 3 && (header.includes(normAlias) || normAlias.includes(header));
        });

        if (isPartial) {
          score += col.required ? 2 : 1;
          matchedCols.add(col.key);
          break;
        }
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

    const cleanHeader = normalizeHeader(fileHeader);
    if (!cleanHeader) return;

    for (const col of config.columns) {
      if (usedKeys.has(col.key)) continue;

      const isExact = col.aliases.some(alias => {
        const normAlias = normalizeHeader(alias);
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

    const cleanHeader = normalizeHeader(fileHeader);
    if (!cleanHeader) return;

    for (const col of config.columns) {
      if (usedKeys.has(col.key)) continue;

      const isPartial = col.aliases.some(alias => {
        const normAlias = normalizeHeader(alias);
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
        if (val === undefined || val === null) {
          val = '';
        }
        if (typeof val === 'string') {
          val = toEnglishDigits(val.trim());
        }
        entity[targetKey] = val;
      }
    });

    // نرمال‌سازی اختصاصی بر اساس نوع موجودیت
    if (entityType === 'services') {
      if (entity.code) entity.code = String(entity.code).trim();
      if (entity.vehicleName) entity.vehicleName = String(entity.vehicleName).trim();
      if (entity.plaque) entity.plaque = String(entity.plaque).trim();

      // تفکیک هوشمند در صورتی که نام خودرو، پلاک یا کد در یک ستون تلفیق شده باشند
      if (entity.vehicleName && !entity.plaque) {
        const plateMatch = entity.vehicleName.match(/(\d{2}\s*[\u0600-\u06FF]\s*\d{3}\s*(?:ایران)?\s*\d{2})/);
        if (plateMatch) {
          entity.plaque = plateMatch[1].trim();
          entity.vehicleName = entity.vehicleName.replace(plateMatch[0], '').replace(/[-–\[\]\(\)]/g, '').trim();
        }
      }
      if (entity.vehicleName && !entity.code) {
        const codeMatch = entity.vehicleName.match(/^([a-zA-Z0-9]{1,4}[-_]\d{1,5})/);
        if (codeMatch) {
          entity.code = codeMatch[1].trim();
          entity.vehicleName = entity.vehicleName.replace(codeMatch[0], '').replace(/^[-–:\s]+/, '').trim();
        }
      }

      if (entity.serviceType) entity.serviceType = String(entity.serviceType).trim();
      if (entity.serviceDate) entity.serviceDate = String(entity.serviceDate).trim();
      if (entity.partName) entity.partName = String(entity.partName).trim();
      if (entity.partSource) entity.partSource = String(entity.partSource).trim();
      if (entity.supplierName) entity.supplierName = String(entity.supplierName).trim();
      if (entity.mechanicName) entity.mechanicName = String(entity.mechanicName).trim();
      if (entity.invoiceNumber) entity.invoiceNumber = String(entity.invoiceNumber).trim();
      if (entity.driverName) entity.driverName = String(entity.driverName).trim();
      if (entity.company) entity.company = String(entity.company).trim();

      if (entity.quantity) entity.quantity = Number(toEnglishDigits(String(entity.quantity)).replace(/,/g, '')) || 1;
      if (entity.unitPrice) entity.unitPrice = Number(toEnglishDigits(String(entity.unitPrice)).replace(/,/g, '')) || 0;
      if (entity.partsCost) entity.partsCost = Number(toEnglishDigits(String(entity.partsCost)).replace(/,/g, '')) || 0;
      if (!entity.partsCost && entity.unitPrice && entity.quantity) {
        entity.partsCost = entity.unitPrice * entity.quantity;
      }
      if (entity.wages) entity.wages = Number(toEnglishDigits(String(entity.wages)).replace(/,/g, '')) || 0;
      if (entity.currentKm) entity.currentKm = Number(toEnglishDigits(String(entity.currentKm)).replace(/,/g, '')) || 0;
      if (entity.nextKm) entity.nextKm = Number(toEnglishDigits(String(entity.nextKm)).replace(/,/g, '')) || 0;
      if (!entity.nextKm && entity.currentKm) entity.nextKm = entity.currentKm + 5000;

      if (entity.cost) entity.cost = Number(toEnglishDigits(String(entity.cost)).replace(/,/g, '')) || 0;
      if (!entity.cost && (entity.partsCost || entity.wages)) {
        entity.cost = (entity.partsCost || 0) + (entity.wages || 0);
      }

      if (!entity.status) entity.status = 'completed';
      if (entity.status === 'تکمیل شده' || entity.status === 'انجام شده') entity.status = 'completed';
      if (entity.status === 'در حال انجام' || entity.status === 'پذیرش شده') entity.status = 'in_progress';
    } else if (entityType === 'failures') {
      if (entity.code) entity.code = String(entity.code).trim();
      if (entity.vehicleName) entity.vehicleName = String(entity.vehicleName).trim();
      if (entity.plaque) entity.plaque = String(entity.plaque).trim();

      // تفکیک هوشمند در صورتی که نام خودرو، پلاک یا کد در یک ستون تلفیق شده باشند
      if (entity.vehicleName && !entity.plaque) {
        const plateMatch = entity.vehicleName.match(/(\d{2}\s*[\u0600-\u06FF]\s*\d{3}\s*(?:ایران)?\s*\d{2})/);
        if (plateMatch) {
          entity.plaque = plateMatch[1].trim();
          entity.vehicleName = entity.vehicleName.replace(plateMatch[0], '').replace(/[-–\[\]\(\)]/g, '').trim();
        }
      }
      if (entity.vehicleName && !entity.code) {
        const codeMatch = entity.vehicleName.match(/^([a-zA-Z0-9]{1,4}[-_]\d{1,5})/);
        if (codeMatch) {
          entity.code = codeMatch[1].trim();
          entity.vehicleName = entity.vehicleName.replace(codeMatch[0], '').replace(/^[-–:\s]+/, '').trim();
        }
      }

      if (entity.failureType) entity.failureType = String(entity.failureType).trim();
      if (entity.category) entity.category = String(entity.category).trim();
      if (entity.failureDate) entity.failureDate = String(entity.failureDate).trim();
      if (entity.dischargeDate) entity.dischargeDate = String(entity.dischargeDate).trim();
      if (entity.partName) entity.partName = String(entity.partName).trim();
      if (entity.partSource) entity.partSource = String(entity.partSource).trim();
      if (entity.supplierName) entity.supplierName = String(entity.supplierName).trim();
      if (entity.repairShopName) entity.repairShopName = String(entity.repairShopName).trim();
      if (entity.invoiceNumber) entity.invoiceNumber = String(entity.invoiceNumber).trim();
      if (entity.driverName) entity.driverName = String(entity.driverName).trim();
      if (entity.company) entity.company = String(entity.company).trim();

      if (entity.quantity) entity.quantity = Number(toEnglishDigits(String(entity.quantity)).replace(/,/g, '')) || 1;
      if (entity.unitPrice) entity.unitPrice = Number(toEnglishDigits(String(entity.unitPrice)).replace(/,/g, '')) || 0;
      if (entity.partsCost) entity.partsCost = Number(toEnglishDigits(String(entity.partsCost)).replace(/,/g, '')) || 0;
      if (!entity.partsCost && entity.unitPrice && entity.quantity) {
        entity.partsCost = entity.unitPrice * entity.quantity;
      }
      if (entity.wages) entity.wages = Number(toEnglishDigits(String(entity.wages)).replace(/,/g, '')) || 0;
      if (entity.odometer) entity.odometer = Number(toEnglishDigits(String(entity.odometer)).replace(/,/g, '')) || 0;
      if (entity.totalCost) entity.totalCost = Number(toEnglishDigits(String(entity.totalCost)).replace(/,/g, '')) || 0;
      if (!entity.totalCost && (entity.partsCost || entity.wages)) {
        entity.totalCost = (entity.partsCost || 0) + (entity.wages || 0);
      }

      if (!entity.priority) entity.priority = 'medium';
      if (!entity.status) {
        entity.status = entity.dischargeDate ? 'completed' : 'in_repair';
      }
      if (entity.status === 'ترخیص شده' || entity.status === 'تکمیل شده' || entity.status === 'ترخیص') entity.status = 'completed';
      if (entity.status === 'در حال تعمیر' || entity.status === 'در تعمیرگاه' || entity.status === 'پذیرش شده' || entity.status === 'در حال انجام') entity.status = 'in_progress';
    } else if (entityType === 'vehicles') {
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
      if (entity.phone) {
        let p = String(entity.phone).trim();
        p = toEnglishDigits(p);
        if (p.length === 10 && p.startsWith('9')) p = '0' + p;
        entity.phone = p;
      }
    } else if (entityType === 'mechanics') {
      if (entity.phone) {
        let p = String(entity.phone).trim();
        p = toEnglishDigits(p);
        if (p.length === 10 && p.startsWith('9')) p = '0' + p;
        entity.phone = p;
      }
    } else if (entityType === 'suppliers') {
      if (entity.phone) {
        let p = String(entity.phone).trim();
        p = toEnglishDigits(p);
        if (p.length === 10 && p.startsWith('9')) p = '0' + p;
        entity.phone = p;
      }
    }

    return entity;
  }).filter(item => {
    // رکوردهایی که فاقد هرگونه داده معنادار هستند فیلتر شوند
    return Object.values(item).some(v => v !== '' && v !== null && v !== undefined && v !== 0);
  });

  return { items, mappedColumns, unmappedColumns };
}

/**
 * خواندن فایل اکسل و استخراج داده‌های شیت‌ها با پشتیبانی مطمئن از UTF-8 و تشخیص هوشمند ردیف سرستون
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
        const workbook = XLSX.read(data, { type: 'array', codepage: 65001 });

        const sheets = workbook.SheetNames.map(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) return { sheetName, rows: [], headers: [] };

          // دریافت ماتریس دوبعدی ردیف‌ها
          const rawMatrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          if (!rawMatrix || rawMatrix.length === 0) {
            return { sheetName, rows: [], headers: [] };
          }

          // جستجوی هوشمند برای یافتن ردیف سرستون در ۱۰ ردیف اول
          let headerRowIndex = 0;
          let maxHeaderScore = -1;

          const maxSearchRows = Math.min(rawMatrix.length, 10);
          for (let r = 0; r < maxSearchRows; r++) {
            const row = rawMatrix[r];
            if (!Array.isArray(row) || row.length === 0) continue;

            const nonBlankCells = row.filter(cell => cell !== undefined && cell !== null && String(cell).trim() !== '');
            if (nonBlankCells.length === 0) continue;

            // محاسبه امتیاز این سطر به عنوان سطر سرستون
            let score = 0;
            row.forEach(cell => {
              if (typeof cell === 'string' && cell.trim()) {
                const norm = normalizeHeader(cell);
                if (ROW_HEADER_ALIASES.some(a => normalizeHeader(a) === norm)) {
                  score += 4;
                } else if (norm.includes('نام') || norm.includes('کد') || norm.includes('پلاک') || norm.includes('سرویس') || norm.includes('خرابی') || norm.includes('تلفن') || norm.includes('آدرس') || norm.includes('عنوان') || norm.includes('شرکت') || norm.includes('تعمیر') || norm.includes('تامین')) {
                  score += 3;
                } else if (isNaN(Number(cell))) {
                  score += 1;
                }
              }
            });

            if (score > maxHeaderScore) {
              maxHeaderScore = score;
              headerRowIndex = r;
            }
          }

          const rawHeaderRow = rawMatrix[headerRowIndex] || [];
          const headers: string[] = [];
          const headerCounts: Record<string, number> = {};

          rawHeaderRow.forEach((cell, colIdx) => {
            let colName = String(cell || '').trim();
            if (!colName) {
              colName = `ستون_${colIdx + 1}`;
            }
            if (headerCounts[colName]) {
              headerCounts[colName]++;
              headers.push(`${colName}_${headerCounts[colName]}`);
            } else {
              headerCounts[colName] = 1;
              headers.push(colName);
            }
          });

          // تبدیل ردیف‌های داده پس از سطر سرستون
          const rows: any[] = [];
          for (let r = headerRowIndex + 1; r < rawMatrix.length; r++) {
            const row = rawMatrix[r];
            if (!Array.isArray(row) || row.length === 0) continue;

            const isBlank = row.every(cell => cell === undefined || cell === null || String(cell).trim() === '');
            if (isBlank) continue;

            const rowObj: any = {};
            headers.forEach((header, colIdx) => {
              rowObj[header] = row[colIdx] !== undefined ? row[colIdx] : '';
            });
            rows.push(rowObj);
          }

          return { sheetName, rows, headers };
        }).filter(s => s.rows.length > 0 || s.headers.length > 0);

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
 * ستون اول به صورت پیش‌فرض ستون «ردیف» قرار می‌گیرد تا فیلد داده‌ای به اشتباه در ستون اول ننشیند.
 */
export function downloadExcelTemplate(entityType?: DefinitionEntityType) {
  const wb = XLSX.utils.book_new();

  if (entityType) {
    // ایجاد یک شیت اختصاصی
    const config = DEFINITION_COLUMNS_CONFIG[entityType];
    const headers = ['ردیف', ...config.columns.map(c => c.label)];
    const sampleRow = [1, ...config.columns.map(c => c.sample)];

    const wsData = [
      headers,
      sampleRow
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // تنظیم عرض ستون‌ها
    ws['!cols'] = [{ wch: 8 }, ...config.columns.map(c => ({ wch: Math.max(18, c.label.length * 2 + 4) }))];

    XLSX.utils.book_append_sheet(wb, ws, config.sheetName);
    XLSX.writeFile(wb, `قالب_اکسل_${config.sheetName}.xlsx`);
  } else {
    // ایجاد فایل قالب جامع با تمامی شیت‌ها
    const types: DefinitionEntityType[] = ['services', 'failures', 'vehicles', 'persons', 'companies', 'service_definitions', 'failure_definitions', 'mechanics', 'suppliers'];

    types.forEach(type => {
      const config = DEFINITION_COLUMNS_CONFIG[type];
      const headers = ['ردیف', ...config.columns.map(c => c.label)];
      const sampleRow = [1, ...config.columns.map(c => c.sample)];

      const wsData = [
        headers,
        sampleRow
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 8 }, ...config.columns.map(c => ({ wch: Math.max(18, c.label.length * 2 + 4) }))];
      XLSX.utils.book_append_sheet(wb, ws, config.sheetName);
    });

    XLSX.writeFile(wb, `قالب_جامع_اکسل_تعاریف_ناوگان.xlsx`);
  }
}

