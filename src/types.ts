/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// نقش‌های کاربران سامانه
export type UserRole = 'admin' | 'user';

// تنظیمات استایل و دیداری اختصاصی هر کاربر
export interface UserPreferences {
  theme?: 'light' | 'dark';
  fontFamily?: string;
  accentColor?: string;
  borderRadius?: number;
}

// کاربر سامانه (برای ورود به سیستم و دسترسی‌ها)
export interface User {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  allowedViews?: string[]; // تسک‌ها و بخش‌های مجاز برای کاربر
  company?: string; // شرکت مرتبط با کاربر
  phone?: string;
  password?: string; // کلمه عبور کاربر (در صورت تعیین رمز اختصاصی)
  status: 'active' | 'inactive';
  createdAt: string;
  preferences?: UserPreferences; // تنظیمات استایل ذخیره‌شده کاربر در دیتابیس
}

// شخص / پرسنل سازمان (بدون اطلاعات کاربری و دسترسی سیستم)
export interface Person {
  id: number;
  fullName: string;
  position: string; // سمت (مانند راننده، مکانیک، حسابدار، مدیر پروژه، ...)
  phone?: string;
  nationalCode?: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

// وضعیت‌های ممکن خودرو
export type VehicleStatus = 'active' | 'in_repair' | 'broken' | 'ready_service';

// اطلاعات خودرو
export interface Vehicle {
  id: number;
  code: string; // کد خودرو
  company: string; // شرکت
  project: string; // پروژه
  department: string; // بخش
  location: string; // محل استقرار
  driverName: string; // نام راننده
  driverPhone: string; // شماره تماس
  plaque: string; // پلاک خودرو
  name: string; // نام خودرو
  brand: string; // برند
  model: string; // مدل
  productionYear: number; // سال ساخت
  color: string; // رنگ
  engineNumber: string; // شماره موتور
  chassisNumber: string; // شماره شاسی
  vin: string; // VIN
  status: VehicleStatus; // وضعیت خودرو
  currentKm?: number; // کیلومتر کارکرد فعلی خودرو
  imageUrl?: string; // تصویر خودرو
  cardImageUrl?: string; // تصویر کارت خودرو
  qrCode?: string; // کد QR
  createdAt: string;
}

// تعریف کلی خدمات و قطعات مصرفی (تسمه تایم، روغن، لنت، ...) با دوره کیلومتر و بازه اخطار
export interface ServiceDefinition {
  id: number;
  vehicleId?: number; // اختیاری (برای پشتیبانی از نسخه‌های قبلی یا ارجاع به خودرو)
  serviceType: string; // عنوان خدمت (مانند تعویض روغن موتور)
  intervalKm: number; // کیلومتر دوره تعویض (مثلاً 5000)
  warningKm: number; // بازه اخطار کیلومتری (مثلاً 200 کیلومتر قبل)
  lastServicedKm?: number; // کیلومتر آخرین تعویض اختیاری
  currentKm?: number; // کارکرد فعلی اختیاری
  notes?: string; // توضیحات تکمیلی
  createdAt: string;
}

// نوع سرویس دوره‌ای
export interface PeriodicService {
  id: number;
  vehicleId: number;
  driverName?: string; // اسنپ‌شات نام راننده در زمان ثبت
  company?: string; // اسنپ‌شات شرکت در زمان ثبت
  plaque?: string; // اسنپ‌شات پلاک در زمان ثبت
  serviceType: string; // تعویض روغن، تسمه تایم، لنت و ...
  serviceDate: string; // تاریخ انجام
  currentKm: number; // کیلومتر انجام
  nextKm: number; // کیلومتر بعدی
  nextDate: string; // تاریخ بعدی
  cost: number; // هزینه کل
  quantity?: number; // مقدار / تعداد کالا
  unitPrice?: number; // قیمت واحد
  partSource?: 'warehouse' | 'supplier' | 'none'; // منبع قطعه مصرفی: انبار شرکت، خرید از تامین‌کننده خارجی یا بدون قطعه
  partId?: number; // شناسه قطعه انبار استفاده شده
  partName?: string; // نام قطعه مصرفی
  supplierId?: number; // شناسه تامین‌کننده در صورت خرید از بیرون
  supplierName?: string; // نام تامین‌کننده طرف قرارداد/خرید
  mechanicId?: number; // تعمیرکار / تعمیرگاه ارجاع‌شده
  mechanicName?: string; // نام تعمیرکار مجری
  repairShopName?: string; // نام تعمیرگاه
  wages?: number; // اجرت تعمیرکار
  status?: 'in_progress' | 'completed'; // وضعیت سرویس: پذیرش شده/در حال انجام یا تکمیل‌شده
  invoiceImage?: string; // تصویر فاکتور
  notes?: string; // توضیحات
  createdAt: string;
}

// نوع بیمه‌نامه
export type InsuranceType = 'third_party' | 'collision' | (string & {}); // ثالث یا بدنه یا سفارشی

// اطلاعات بیمه‌نامه
export interface Insurance {
  id: number;
  vehicleId: number;
  driverName?: string;
  company?: string;
  plaque?: string;
  insuranceType: InsuranceType;
  policyNumber: string;
  startDate: string;
  endDate: string;
  insuranceCompany: string;
  cost: number;
  insuranceImage?: string;
  createdAt: string;
}

// معاینه فنی
export interface TechnicalInspection {
  id: number;
  vehicleId: number;
  driverName?: string;
  company?: string;
  plaque?: string;
  inspectionDate: string;
  expiryDate: string;
  inspectionCenter: string;
  trackingCode: string;
  inspectionImage?: string;
  createdAt: string;
}

// نوع خرابی خودرو
export type FailureType = 'electrical' | 'mechanical' | 'body' | 'tires' | 'engine' | 'other' | string;
export type FailurePriority = 'low' | 'medium' | 'high';
export type FailureStatus = 'reported' | 'assigned' | 'in_repair' | 'completed' | 'approved';
export type SatisfactionLevel = 'weak' | 'medium' | 'good' | 'excellent';

// تعریف خرابی خودرو
export interface FailureDefinition {
  id: number;
  failureType: string; // عنوان یا نوع خرابی (مثلاً: روغن‌ریزی موتور، سوختن واشر سرسیلندر)
  category: string; // دسته خرابی (مثلاً: مکانیکی، برقی، جلوبندی، ...)
  description?: string; // توضیحات تکمیلی
  createdAt: string;
}

// دسته خرابی خودرو
export interface FailureCategory {
  id: number;
  name: string; // عنوان دسته خرابی
  description?: string; // توضیحات
  createdAt: string;
}

// اقلام و ردیف‌های خرابی ثبت‌شده برای یک خودرو
export interface FailureItem {
  id?: string;
  definitionId?: string;
  failureType?: string;
  category?: string;
  mechanicId?: number;
  description?: string;
  wage?: number;
  satisfactionLevel?: SatisfactionLevel;
}

// گزارش خرابی خودرو
export interface VehicleFailure {
  id: number;
  vehicleId: number;
  driverId?: number;
  driverName?: string;
  company?: string;
  plaque?: string;
  failureDate: string;
  failureTime: string;
  odometer: number;
  description: string;
  failureType: FailureType;
  priority: FailurePriority;
  status: FailureStatus;
  assignedMechanicId?: number;
  repairShopName?: string;
  startDate?: string;
  endDate?: string;
  attachmentUrl?: string;
  satisfactionLevel?: SatisfactionLevel;
  wages?: number;
  totalCost?: number;
  partsUsed?: Record<string, number>;
  shopPartsUsed?: Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number }>;
  replacedServiceTypes?: string[];
  failureItems?: FailureItem[];
  createdAt: string;
}

// گردش کار و اطلاعات تعمیرگاه
export interface RepairWorkflow {
  id: number;
  failureId: number;
  technicianId?: number; // تعمیرکار ارجاع داده شده
  repairShopName: string; // محل تعمیرگاه
  partsUsed: Record<string, number>; // قطعات مصرفی انبار شرکت و تعداد آنها
  shopPartsUsed?: Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number }>; // قطعات تأمین‌شده توسط تعمیرگاه
  wages: number; // اجرت تعمیرکار
  totalCost: number; // کل هزینه
  startDate?: string;
  endDate?: string;
  isDelivered: boolean; // تحویل داده شده؟
  isApprovedByManager: boolean; // تایید مدیر کل؟
  replacedServiceTypes?: string[]; // خدمات دوره‌ای / تعویض‌های انجام شده در این تعمیر (مثلاً تعویض تسمه تایم)
  satisfactionLevel?: SatisfactionLevel; // سطح رضایت از کار (ضعیف، متوسط، خوب، عالی)
  notes?: string; // توضیحات فاکتور
  createdAt: string;
}

// انبار قطعات
export interface PartInventory {
  id: number;
  partName: string;
  sku: string;
  quantity: number;
  minQuantity: number;
  unitPrice: number; // قیمت خرید / پایه انبار
  buyPrice?: number; // آخرین قیمت خرید
  sellPrice?: number; // آخرین قیمت فروش
  warehouseLocation?: string;
  serviceCategory?: string; // دسته خدمات قطعه (مانند روغن و روانکارها، سیستم ترمز و ...)
  serviceType?: string; // خدمت / نوع سرویس مرتبط با این قطعه (مانند تعویض روغن، تعویض لنت)
  createdAt: string;
}

// ثبت هزینه‌ها و اسناد حسابداری دوبل (بدهکار / بستانکار)
export type ExpenseType = 'fuel' | 'repair' | 'oil' | 'parts' | 'insurance' | 'tax' | 'toll' | 'carwash' | 'payment' | 'receipt' | 'other';

export interface Expense {
  id: number;
  vehicleId: number;
  driverName?: string;
  company?: string;
  plaque?: string;
  expenseType: ExpenseType;
  expenseDate: string;
  cost: number;
  description?: string;
  createdAt: string;
  mechanicId?: number;
  repairShopName?: string;
  supplierId?: number;
  supplierName?: string;
  partyType?: 'vehicle' | 'mechanic' | 'supplier' | 'warehouse' | 'treasury' | 'expense' | 'other';
  paymentMethod?: string;
  referenceNumber?: string;
  // فیلدهای سند حسابداری دوبل (Double-Entry Accounting)
  documentNumber?: string; // شماره سند حسابداری
  debitAccount?: string; // طرف بدهکار (حساب بدهکار)
  creditAccount?: string; // طرف بستانکار (حساب بستانکار)
  debitPartyType?: 'vehicle' | 'mechanic' | 'supplier' | 'warehouse' | 'treasury' | 'expense' | 'other';
  debitPartyId?: number | string;
  creditPartyType?: 'vehicle' | 'mechanic' | 'supplier' | 'warehouse' | 'treasury' | 'expense' | 'other';
  creditPartyId?: number | string;
  entryType?: 'debit' | 'credit' | 'both'; // نوع تاثیر سند بر حساب اصلی
}

// سابقه تغییرات راننده، شرکت و پلاک خودرو
export interface VehicleHistoryEntry {
  id: number;
  vehicleId: number;
  vehicleCode: string;
  vehicleName: string;
  field: 'driverName' | 'company' | 'plaque';
  fieldLabel: string;
  oldValue: string;
  newValue: string;
  changeDate: string;
  changedBy?: string;
}

// لاگ فعالیت‌های کاربران
export interface ActivityLog {
  id: number;
  userId?: number;
  username?: string;
  action: string;
  actionDetails: string;
  ipAddress?: string;
  createdAt: string;
}

// خلاصه وضعیت برای داشبورد
export interface DashboardStats {
  totalVehicles: number;
  activeVehicles: number;
  inRepairVehicles: number;
  brokenVehicles: number;
  readyServiceVehicles: number;
  expiringInsuranceCount: number;
  expiringInspectionCount: number;
  monthlyCost: number;
  yearlyCost: number;
}

// اطلاعات تعمیرکار
export interface Mechanic {
  id: number;
  name: string;
  phone: string;
  specialty: string; // تخصص
  shopName: string; // نام تعمیرگاه
  status: 'active' | 'inactive';
  createdAt: string;
}

// اطلاعات شرکت / سازمان
export interface Company {
  id: number;
  name: string;
  code: string;
  managerName: string;
  phone: string;
  address: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

// اطلاعات تامین‌کننده کالا و قطعات
export interface Supplier {
  id: number;
  name: string; // نام تامین‌کننده / فروشگاه / بازرگانی
  code?: string; // کد تامین‌کننده
  contactPerson?: string; // شخص رابط / مسئول فروش
  phone: string; // تلفن تماس ثابت
  mobile?: string; // شماره همراه
  address?: string; // آدرس
  category?: string; // زمینه فعالیت (روغن و روانکار، قطعات یدکی، لاستیک و رینگ، باطری و برق، فیلترجات، سایر)
  status: 'active' | 'inactive';
  notes?: string; // توضیحات تکمیلی
  createdAt: string;
}

// تراکنش‌های ورود و خروج انبار (رسید و حواله)
export interface InventoryTransaction {
  id: number;
  partId: number;
  partName: string;
  sku?: string;
  type: 'in' | 'out'; // ورود (رسید خرید) یا خروج (حواله مصرف / تعمیرات)
  quantity: number;
  unitPrice: number; // قیمت واحد در زمان ثبت تراکنش
  buyPrice?: number; // قیمت خرید واحد
  sellPrice?: number; // قیمت فروش واحد
  totalPrice: number;
  previousQuantity?: number;
  newQuantity?: number;
  reference?: string; // شماره فاکتور، کد خرابی، خودرو یا شماره حواله
  recipientOrSupplier?: string; // تامین‌کننده در ورود یا تحویل‌گیرنده در خروج
  vehicleId?: number;
  notes?: string;
  createdAt: string;
}

// ثبت استعلام تلفنی / پیامکی کیلومتر کارکرد از راننده و پایش هوشمند سرویس‌ها
export interface OdometerLog {
  id: number;
  vehicleId: number;
  driverName?: string;
  driverPhone?: string;
  company?: string;
  plaque?: string;
  vehicleName?: string;
  inquiryDate: string; // تاریخ تماس / استعلام
  inquiryTime?: string; // ساعت تماس
  odometerKm: number; // کیلومتر اعلامی راننده
  previousKm?: number; // کیلومتر قبلی ثبت‌شده در سیستم
  differenceKm?: number; // تفاوت کارکرد از آخرین استعلام
  dailyAverageKm?: number; // تخمین کارکرد روزانه
  recordedBy?: string; // ثبت‌کننده (کاربر تماس‌گیرنده یا پیامک خودکار)
  source?: 'phone' | 'sms' | 'manual'; // نحوه دریافت (تلفنی، پیامک راننده، دستی)
  rawSmsText?: string; // متن خام پیامک در صورت دریافت پیامکی
  notes?: string; // توضیحات راننده
  createdAt: string;
}

// لاگ پیامک‌های دریافتی رانندگان و وضعیت پردازش هوشمند
export interface SmsInboundLog {
  id: number;
  smsId?: string;
  senderPhone: string;
  rawText: string;
  extractedKm?: number;
  status: 'success' | 'unknown_driver' | 'invalid_km' | 'error';
  statusMessage: string;
  vehicleId?: number;
  vehicleName?: string;
  vehiclePlaque?: string;
  driverName?: string;
  replyMessage?: string;
  createdAt: string;
}

// تنظیمات یادآوری پیامکی استعلام کارکرد پس از گذشت روزهای معین
export interface SmsReminderSettings {
  daysThreshold: number; // تعداد روز گذشته از آخرین مراجعه/استعلام (مثلا ۷ یا ۱۵ روز)
  autoSendEnabled: boolean; // فعال بودن حالت ارسال خودکار پیامک
  checkBasedOn: 'last_inquiry_or_service' | 'last_inquiry' | 'last_service'; // مبنای محاسبه روزها
  smsTemplate: string; // الگوی متن پیامک
  preventDuplicateHours: number; // جلوگیری از ارسال مکرر طی چند ساعت (مثلا ۲۴ یا ۴۸ ساعت)
  provider?: string; // پنل پیامکی انتخابی
  lineNumber?: string; // سرشماره پیامک
  apiKey?: string; // کلید اتصال
}

// لاگ پیامک‌های ارسالی یادآوری به رانندگان
export interface SmsOutboundLog {
  id: number;
  vehicleId: number;
  vehicleName: string;
  vehiclePlaque: string;
  driverName: string;
  driverPhone: string;
  daysSinceLastVisit: number;
  lastVisitDate: string;
  messageText: string;
  status: 'sent' | 'failed' | 'scheduled';
  sentMode: 'manual' | 'automatic';
  sentAt: string;
  responseInfo?: string;
}

// وضعیت خودرو/راننده نیازمند استعلام پیامکی
export interface OverdueDriverItem {
  vehicleId: number;
  vehicleName: string;
  vehiclePlaque: string;
  company?: string;
  driverName: string;
  driverPhone: string;
  lastVisitDate: string;
  lastVisitType: 'inquiry' | 'service' | 'none';
  daysPassed: number;
  currentKm: number;
  lastSmsSentAt?: string;
  smsAlreadySentRecently: boolean;
  recommendedText: string;
}

// زیرمجموعه و اقدامات هر تسک در دسترسی سریع
export interface DashboardQuickSubTask {
  id: string;
  title: string;
  targetView: string; // نام ویوی مقصد در سیستم
  completed?: boolean;
}

// تسک‌ها و میانبرهای دسترسی سریع شخصی‌سازی شده در داشبورد
export interface DashboardQuickTask {
  id: string;
  title: string;
  description: string;
  targetView: string; // نام ویوی مقصد در سیستم (مثلا 'odometer', 'services', 'failures', 'parts', 'accounting', 'vehicles', ...)
  iconName: 'Gauge' | 'PhoneCall' | 'MessageSquare' | 'Wrench' | 'AlertTriangle' | 'Package' | 'TrendingUp' | 'ShieldCheck' | 'Car' | 'FileText' | 'Send' | 'Layers' | 'Settings' | 'Users';
  color: 'indigo' | 'violet' | 'emerald' | 'amber' | 'rose' | 'blue' | 'cyan';
  isCustom?: boolean; // آیا توسط کاربر ساخته شده است
  isPinned?: boolean; // آیا سنجاق شده است
  completed?: boolean; // وضعیت انجام شده
  subTasks?: DashboardQuickSubTask[]; // لیست زیرمجموعه‌ها و اقدامات وابسته به این تسک
  createdAt?: string;
}

// اولویت‌های یادآوری
export type ReminderPriority = 'low' | 'normal' | 'high' | 'urgent';

// وضعیت‌های یادآوری
export type ReminderStatus = 'pending' | 'reminded' | 'completed' | 'cancelled';

// دسته‌بندی موضوعی یادآوری
export type ReminderCategory = 'service' | 'repair' | 'insurance' | 'driver' | 'financial' | 'vehicle' | 'general' | (string & {});

export interface ReminderCategoryItem {
  id: string;
  label: string;
  isCustom?: boolean;
}

// تعریف کامل ساختار یادآوری و پیگیری
export interface Reminder {
  id: number;
  title: string;                 // موضوع و عنوان یادآوری
  description?: string;          // شرح و جزئیات تکمیلی
  reminderDate: string;          // تاریخ شمسی یادآوری (مثلا 1403/07/15)
  reminderTime?: string;         // ساعت یادآوری (اختیاری مثلا 09:30)
  targetType?: 'user' | 'person' | 'driver' | 'custom_phone'; // نوع گیرنده
  targetId?: number | string;    // شناسه کاربر یا پرسنل
  targetName?: string;           // نام کاربر/راننده/مخاطب
  targetPhone?: string;          // شماره تماس جهت ارسال پیامک
  sendSms: boolean;              // ارسال پیامک خودکار در موعد
  smsSent?: boolean;             // وضعیت ارسال پیامک
  smsSentAt?: string;            // تاریخ و زمان ارسال پیامک
  smsResponse?: string;          // پاسخ دریافتی از درگاه پیامک
  priority: ReminderPriority;    // اولویت (عادی، مهم، فوری)
  status: ReminderStatus;        // وضعیت (در انتظار، یادآوری‌شده، انجام‌شده، لغو شده)
  category: ReminderCategory;    // دسته‌بندی
  vehicleId?: number;            // خودروی مرتبط (اختیاری)
  vehicleName?: string;          // نام یا پلاک خودرو مرتبط
  createdAt: string;             // تاریخ ثبت
  createdBy?: string;            // کاربر ثبت‌کننده
  completedAt?: string;          // تاریخ انجام شدن
  notes?: string;                // یادداشت‌های مدیر
}



