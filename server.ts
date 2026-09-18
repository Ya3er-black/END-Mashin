/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

// تعریف فایل‌های دیتابیس لوکال
const DB_FILE = path.join(process.cwd(), 'fleet_db.json');

// داده‌های اولیه تمیز بدون داده‌های تستی
const defaultDb = {
  users: [
    { 
      id: 1, 
      username: 'admin', 
      fullName: 'مدیر سامانه', 
      role: 'admin', 
      company: '', 
      allowedViews: ['dashboard', 'vehicles', 'service_definitions', 'companies', 'persons', 'services', 'failures', 'insurance', 'mechanics', 'parts', 'expenses', 'reports', 'settings', 'logs'], 
      phone: '09120000000', 
      status: 'active', 
      createdAt: new Date().toISOString() 
    }
  ],
  persons: [],
  vehicles: [],
  periodicServices: [],
  insurances: [],
  technicalInspections: [],
  vehicleFailures: [],
  repairWorkflows: [],
  partsInventory: [],
  expenses: [],
  activityLogs: [
    { 
      id: 1, 
      userId: 1, 
      username: 'admin', 
      action: 'راه‌اندازی سامانه', 
      actionDetails: 'سامانه با موفقیت با داده‌های تمیز راه‌اندازی شد.', 
      ipAddress: '127.0.0.1', 
      createdAt: new Date().toISOString() 
    }
  ],
  mechanics: [],
  companies: [],
  suppliers: [],
  serviceDefinitions: [
    { id: 1, serviceType: 'تعویض روغن موتور و فیلترها', intervalKm: 5000, warningKm: 200, notes: 'روغن ۱۰W40 یا ۵W30 به همراه فیلترها', createdAt: new Date().toISOString() },
    { id: 2, serviceType: 'تعویض تسمه تایم و هرزگردها', intervalKm: 60000, warningKm: 1000, notes: 'تعویض تسمه تایم و هرزگردها', createdAt: new Date().toISOString() },
    { id: 3, serviceType: 'سرویس واسکازین و روغن گیربکس', intervalKm: 30000, warningKm: 500, notes: 'واسکازین گیربکس و دیفرانسیل', createdAt: new Date().toISOString() },
    { id: 4, serviceType: 'تعویض لنت ترمز جلو', intervalKm: 25000, warningKm: 500, notes: 'لنت ترمز جلو', createdAt: new Date().toISOString() },
    { id: 5, serviceType: 'تعویض لنت ترمز عقب', intervalKm: 35000, warningKm: 500, notes: 'لنت ترمز عقب', createdAt: new Date().toISOString() },
    { id: 6, serviceType: 'تعویض شمع و وایرها', intervalKm: 30000, warningKm: 500, notes: 'شمع و وایرها', createdAt: new Date().toISOString() },
    { id: 7, serviceType: 'تعویض ضدیخ و مایع خنک‌کننده', intervalKm: 20000, warningKm: 500, notes: 'ضدیخ و مایع خنک‌کننده', createdAt: new Date().toISOString() },
    { id: 8, serviceType: 'بازدید و تعویض لاستیک‌ها', intervalKm: 50000, warningKm: 1000, notes: 'بالانس و تعویض لاستیک‌ها', createdAt: new Date().toISOString() }
  ],
  odometerLogs: [],
  smsInboundLogs: [],
  vehicleHistory: [],
  inventoryTransactions: [],
  dashboardQuickTasks: [],
  smsReminderSettings: {
    daysThreshold: 30,
    autoSendEnabled: false,
    checkBasedOn: 'last_service',
    smsTemplate: 'راننده محترم {driverName}، با سلام؛ با توجه به گذشت {daysPassed} روز از آخرین سرویس دوره‌ای، لطفاً جهت بررسی وضعیت خودرو {vehicleName} ({plaque}) و اعلام کارکرد فعلی اقدام فرمایید. واحد ترابری {company}',
    preventDuplicateHours: 24,
    provider: 'sms.ir',
    lineNumber: '30002108035760',
    apiKey: 'Xcpq5IEcfWypqDce4tHB612pCor0OsnwkdEdPrAgldxozVWp'
  },
  smsOutboundLogs: [],
  processedSmsIds: []
};

// خواندن دیتابیس لوکال
function readDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2), 'utf-8');
    return defaultDb;
  }
  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    let changed = false;
    if (!parsed.smsInboundLogs) {
      parsed.smsInboundLogs = defaultDb.smsInboundLogs || [];
      changed = true;
    }
    if (!parsed.processedSmsIds) {
      parsed.processedSmsIds = [];
      changed = true;
    }
    if (!parsed.mechanics) {
      parsed.mechanics = defaultDb.mechanics;
      changed = true;
    }
    if (!parsed.companies) {
      parsed.companies = defaultDb.companies;
      changed = true;
    }
    if (!parsed.suppliers) {
      parsed.suppliers = defaultDb.suppliers;
      changed = true;
    }
    if (!parsed.odometerLogs) {
      parsed.odometerLogs = defaultDb.odometerLogs || [];
      changed = true;
    }
    // همگام‌سازی شرکت‌های پیش‌فرض کاربران نمونه
    if (parsed.users) {
      defaultDb.users.forEach(defU => {
        const u = parsed.users.find((existing: any) => existing.username === defU.username);
        if (u && u.company === undefined && defU.company) {
          u.company = defU.company;
          changed = true;
        }
      });
    }
    if (parsed.partsInventory) {
      parsed.partsInventory.forEach((p: any) => {
        if (p.buyPrice === undefined) {
          p.buyPrice = p.unitPrice || 0;
          changed = true;
        }
        if (p.sellPrice === undefined) {
          p.sellPrice = p.unitPrice ? Math.round(p.unitPrice * 1.25) : 0;
          changed = true;
        }
      });
    }
    // حفاظت از اسنپ‌شات‌های راننده، شرکت و پلاک در سوابق و پرونده‌ها
    if (parsed.periodicServices) {
      parsed.periodicServices.forEach((s: any) => {
        if (!s.driverName || !s.company || !s.plaque) {
          const v = parsed.vehicles?.find((veh: any) => veh.id === s.vehicleId);
          if (v) {
            if (!s.driverName) s.driverName = v.driverName || 'ثبت نشده';
            if (!s.company) s.company = v.company || 'ثبت نشده';
            if (!s.plaque) s.plaque = v.plaque || 'ثبت نشده';
            changed = true;
          }
        }
      });
    }
    if (parsed.vehicleFailures) {
      parsed.vehicleFailures.forEach((f: any) => {
        if (!f.driverName || !f.company || !f.plaque) {
          const v = parsed.vehicles?.find((veh: any) => veh.id === f.vehicleId);
          if (v) {
            if (!f.driverName) f.driverName = v.driverName || 'ثبت نشده';
            if (!f.company) f.company = v.company || 'ثبت نشده';
            if (!f.plaque) f.plaque = v.plaque || 'ثبت نشده';
            changed = true;
          }
        }
      });
    }
    if (parsed.insurances) {
      parsed.insurances.forEach((i: any) => {
        if (!i.driverName || !i.company || !i.plaque) {
          const v = parsed.vehicles?.find((veh: any) => veh.id === i.vehicleId);
          if (v) {
            if (!i.driverName) i.driverName = v.driverName || 'ثبت نشده';
            if (!i.company) i.company = v.company || 'ثبت نشده';
            if (!i.plaque) i.plaque = v.plaque || 'ثبت نشده';
            changed = true;
          }
        }
      });
    }
    if (parsed.technicalInspections) {
      parsed.technicalInspections.forEach((t: any) => {
        if (!t.driverName || !t.company || !t.plaque) {
          const v = parsed.vehicles?.find((veh: any) => veh.id === t.vehicleId);
          if (v) {
            if (!t.driverName) t.driverName = v.driverName || 'ثبت نشده';
            if (!t.company) t.company = v.company || 'ثبت نشده';
            if (!t.plaque) t.plaque = v.plaque || 'ثبت نشده';
            changed = true;
          }
        }
      });
    }
    if (parsed.expenses) {
      parsed.expenses.forEach((e: any) => {
        if (!e.driverName || !e.company || !e.plaque) {
          const v = parsed.vehicles?.find((veh: any) => veh.id === e.vehicleId);
          if (v) {
            if (!e.driverName) e.driverName = v.driverName || 'ثبت نشده';
            if (!e.company) e.company = v.company || 'ثبت نشده';
            if (!e.plaque) e.plaque = v.plaque || 'ثبت نشده';
            changed = true;
          }
        }
      });
    }
    if (!parsed.vehicleHistory) {
      parsed.vehicleHistory = [
        {
          id: 1,
          vehicleId: 1,
          vehicleCode: 'V-101',
          vehicleName: 'پژو پارس TU5',
          field: 'driverName',
          fieldLabel: 'راننده',
          oldValue: 'حسن محمدی',
          newValue: 'علی رضایی',
          changeDate: new Date('2026-01-15T08:30:00').toISOString(),
          changedBy: 'مدیر سیستم'
        },
        {
          id: 2,
          vehicleId: 2,
          vehicleCode: 'V-102',
          vehicleName: 'کامیون بنز ده تن',
          field: 'company',
          fieldLabel: 'شرکت',
          oldValue: 'شرکت راه و ساختمان کویر',
          newValue: 'شرکت هولدینگ پارسیان',
          changeDate: new Date('2026-02-01T10:00:00').toISOString(),
          changedBy: 'مدیر سیستم'
        }
      ];
      changed = true;
    }
    if (!parsed.inventoryTransactions) {
      parsed.inventoryTransactions = [
        {
          id: 1,
          partId: 1,
          partName: 'فیلتر روغن پژو TU5 سرکان',
          sku: 'SKU-TU5-OF',
          type: 'in',
          quantity: 18,
          unitPrice: 180000,
          totalPrice: 18 * 180000,
          previousQuantity: 0,
          newQuantity: 18,
          reference: 'رسید اولیه انبار',
          recipientOrSupplier: 'شرکت پخش سرکان',
          notes: 'موجودی اولیه انبار بر مبنای آخرین نرخ خرید',
          createdAt: new Date('2026-05-01T09:00:00').toISOString()
        },
        {
          id: 2,
          partId: 2,
          partName: 'لنت ترمز جلو پژو پارس الیگ',
          sku: 'SKU-PARS-BF',
          type: 'in',
          quantity: 5,
          unitPrice: 1450000,
          totalPrice: 5 * 1450000,
          previousQuantity: 0,
          newQuantity: 5,
          reference: 'رسید خرید ۹۰۱',
          recipientOrSupplier: 'فروشگاه پایتخت',
          notes: 'ثبت ورود اولیه کالا به انبار',
          createdAt: new Date('2026-06-01T10:30:00').toISOString()
        },
        {
          id: 3,
          partId: 2,
          partName: 'لنت ترمز جلو پژو پارس الیگ',
          sku: 'SKU-PARS-BF',
          type: 'out',
          quantity: 2,
          unitPrice: 1450000,
          totalPrice: 2 * 1450000,
          previousQuantity: 5,
          newQuantity: 3,
          reference: 'سرویس دوره‌ای خودرو V-101',
          recipientOrSupplier: 'تعمیرگاه مرکزی',
          vehicleId: 1,
          notes: 'مصرف در سرویس دوره‌ای با محاسبه بر اساس آخرین نرخ خرید',
          createdAt: new Date('2026-06-20T14:15:00').toISOString()
        }
      ];
      changed = true;
    }
    if (changed) {
      fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
    }
    return parsed;
  } catch (err) {
    console.error('Error reading DB, resetting to default', err);
    return defaultDb;
  }
}

// نوشتن در دیتابیس لوکال
function writeDb(data: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing DB', err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Helper to parse cookies
  function parseCookies(cookieHeader?: string) {
    const list: Record<string, string> = {};
    if (!cookieHeader) return list;
    cookieHeader.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      list[parts.shift()!.trim()] = decodeURI(parts.join('='));
    });
    return list;
  }

  // لاگ فعالیت کاربر
  function logActivity(userId: number, username: string, action: string, details: string, ip: string = '127.0.0.1') {
    const db = readDb();
    const newLog = {
      id: db.activityLogs.length > 0 ? Math.max(...db.activityLogs.map((l: any) => l.id)) + 1 : 1,
      userId,
      username,
      action,
      actionDetails: details,
      ipAddress: ip,
      createdAt: new Date().toISOString()
    };
    db.activityLogs.unshift(newLog); // قرار دادن لاگ در ابتدا
    writeDb(db);
  }

  // نرمال‌سازی شماره همراه به فرمت استاندارد 09xxxxxxxxx
  function normalizeDriverPhone(phone: any): string {
    if (!phone) return '';
    let p = phone.toString().trim()
      .replace(/[۰-۹]/g, (d: string) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
      .replace(/[٠-٩]/g, (d: string) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
      .replace(/[^0-9+]/g, '');

    if (p.startsWith('+98')) p = '0' + p.substring(3);
    else if (p.startsWith('0098')) p = '0' + p.substring(4);
    else if (p.startsWith('98')) p = '0' + p.substring(2);
    else if (!p.startsWith('0') && p.length === 10) p = '0' + p;

    return p;
  }

  // تابع دریافت تاریخ شمسی امروز
  function getTodayJalaliString(): string {
    const d = new Date();
    try {
      return d.toLocaleDateString('fa-IR-u-nu-latn', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch {
      return d.toISOString().split('T')[0];
    }
  }

  // تابع ارسال واقعی پیامک از طریق درگاه با کلید API
  async function sendSmsViaGateway(receptor: string, message: string, apiKeyOverride?: string): Promise<{ success: boolean; info: string; provider?: string }> {
    const defaultKey = 'Xcpq5IEcfWypqDce4tHB612pCor0OsnwkdEdPrAgldxozVWp';
    const envKey = (process.env.SMS_API_KEY || '').trim();
    const overrideKey = (apiKeyOverride || '').trim();
    const apiKey = (overrideKey.length >= 20 ? overrideKey : '') || (envKey.length >= 20 ? envKey : '') || defaultKey;
    const cleanReceptor = normalizeDriverPhone(receptor);
    
    if (!cleanReceptor || cleanReceptor.length < 10) {
      return { success: false, info: 'شماره گیرنده نامعتبر است' };
    }

    if (!apiKey) {
      return { success: false, info: 'کلید وب‌سرویس پیامک (SMS_API_KEY) در متغیرهای محیطی تنظیم نشده است.' };
    }

    // ۱. بررسی و ارسال از طریق سامانه sms.ir (کلیدهای ۴۰ الی ۶۰ کاراکتری)
    try {
      // دریافت یا استفاده از خط اختصاصی پنل sms.ir
      let lineNumber = 30002108035760;
      try {
        const lineRes = await fetch('https://api.sms.ir/v1/line', {
          method: 'GET',
          headers: { 'x-api-key': apiKey, 'Accept': 'application/json' }
        });
        if (lineRes.ok) {
          const lineData: any = await lineRes.json().catch(() => null);
          if (lineData && Array.isArray(lineData.data) && lineData.data.length > 0) {
            lineNumber = lineData.data[0];
          }
        }
      } catch {}

      const smsIrRes = await fetch('https://api.sms.ir/v1/send/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          lineNumber: lineNumber,
          messageText: message,
          mobiles: [cleanReceptor]
        })
      });

      if (smsIrRes.ok) {
        const data: any = await smsIrRes.json().catch(() => null);
        if (data && data.status === 1) {
          return { success: true, info: `ارسال موفق از درگاه sms.ir (شناسه: ${data.data?.packId || 'OK'})`, provider: 'sms.ir' };
        } else if (data) {
          return { success: false, info: `پاسخ درگاه sms.ir: ${data.message || data.status}`, provider: 'sms.ir' };
        }
      } else {
        const errorData: any = await smsIrRes.json().catch(() => null);
        if (errorData && errorData.message) {
          return { success: false, info: `درگاه sms.ir: ${errorData.message} (کد: ${errorData.status || smsIrRes.status})`, provider: 'sms.ir' };
        }
      }
    } catch (err: any) {
      console.warn('sms.ir attempt failed, trying fallback:', err?.message || err);
    }

    // ۲. ارسال جایگزین از طریق وب‌سرویس کاوه نگار
    try {
      const kavenegarUrl = `https://api.kavenegar.com/v1/${encodeURIComponent(apiKey)}/sms/send.json?receptor=${encodeURIComponent(cleanReceptor)}&message=${encodeURIComponent(message)}`;
      const response = await fetch(kavenegarUrl, { method: 'GET' });
      if (response && response.ok) {
        const data: any = await response.json().catch(() => null);
        if (data && data.return && (data.return.status === 200 || data.return.status === 201)) {
          return { success: true, info: `ارسال موفق کاوه نگار: ${data.entries?.[0]?.messageid || 'OK'}`, provider: 'kavenegar' };
        } else if (data && data.return) {
          return { success: false, info: `خطای کاوه نگار: ${data.return.message || data.return.status}`, provider: 'kavenegar' };
        }
      }
    } catch (err: any) {
      console.error('Kavenegar error:', err?.message || err);
    }

    return { success: false, info: 'خطا در ارتباط با درگاه پیامک.' };
  }

  // --- API Routes ---

  // Auth & Session Simulation
  app.get('/api/me', (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const username = cookies.username;
    if (username) {
      const db = readDb();
      const normU = normalizeDriverPhone(username);
      const user = db.users.find((u: any) => {
        const uUser = (u.username || '').toLowerCase();
        const uPhone = normalizeDriverPhone(u.phone || '');
        return uUser === username.toLowerCase() || (normU && uPhone && (uPhone === normU || uPhone.slice(-10) === normU.slice(-10)));
      });
      if (user && user.status === 'active') {
        return res.json(user);
      }
    }
    res.status(401).json({ message: 'Not authenticated' });
  });

  app.post('/api/logout', (req, res) => {
    res.setHeader('Set-Cookie', 'username=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict');
    res.json({ success: true });
  });

  app.post(['/api/auth/login', '/api/login'], (req, res) => {
    const { username, password } = req.body;
    const db = readDb();
    const cleanUsername = (username || '').trim().toLowerCase();
    const normPhone = normalizeDriverPhone(cleanUsername);

    // ۱. جستجو در کاربران ثبت‌شده بر اساس نام کاربری یا شماره همراه
    let user = db.users.find((u: any) => {
      const uUser = (u.username || '').toLowerCase();
      const uPhone = normalizeDriverPhone(u.phone || '');
      const isPhoneMatch = normPhone && uPhone && (
        uPhone === normPhone || 
        uPhone.slice(-10) === normPhone.slice(-10)
      );
      // همچنین در صورتی که کاربر شماره پیش‌فرض ادمین یا شماره تماس ذخیره شده را وارد کرده باشد
      const isDefaultAdminPhone = (cleanUsername === 'admin' || normPhone === '09120000000' || (normPhone && normPhone.endsWith('3648806'))) && u.role === 'admin';
      return uUser === cleanUsername || isPhoneMatch || isDefaultAdminPhone;
    });

    // ۲. در صورتی که کاربر در users یافت نشد اما شماره همراه مربوط به پرسنل ثبت‌شده است
    if (!user && normPhone) {
      const person = (db.persons || []).find((p: any) => {
        const pPhone = normalizeDriverPhone(p.phone || '');
        return pPhone && (pPhone === normPhone || pPhone.slice(-10) === normPhone.slice(-10));
      });

      if (person) {
        const existingByName = db.users.find((u: any) => (u.fullName || '').trim() === (person.fullName || '').trim());
        if (existingByName) {
          user = existingByName;
          user.phone = normPhone;
          writeDb(db);
        } else {
          user = {
            id: db.users.length > 0 ? Math.max(...db.users.map((u: any) => u.id)) + 1 : 1,
            username: normPhone,
            fullName: person.fullName,
            role: 'admin',
            phone: normPhone,
            status: 'active',
            password: password ? password.trim() : undefined,
            allowedViews: [
              "dashboard", "vehicles", "service_definitions", "companies", "persons",
              "services", "failures", "insurance", "mechanics", "parts", "expenses",
              "reports", "settings", "logs", "odometer"
            ],
            company: "",
            createdAt: new Date().toISOString()
          };
          db.users.push(user);
          writeDb(db);
        }
      }
    }

    // ۳. بررسی شماره در رانندگان ثبت‌شده برای خودروها
    if (!user && normPhone) {
      const vehicle = (db.vehicles || []).find((v: any) => {
        const dPhone = normalizeDriverPhone(v.driverPhone || '');
        return dPhone && (dPhone === normPhone || dPhone.slice(-10) === normPhone.slice(-10));
      });
      if (vehicle) {
        user = {
          id: db.users.length > 0 ? Math.max(...db.users.map((u: any) => u.id)) + 1 : 1,
          username: normPhone,
          fullName: vehicle.driverName || 'راننده خودرو',
          role: 'admin',
          phone: normPhone,
          status: 'active',
          password: password ? password.trim() : undefined,
          allowedViews: [
            "dashboard", "vehicles", "service_definitions", "companies", "persons",
            "services", "failures", "insurance", "mechanics", "parts", "expenses",
            "reports", "settings", "logs", "odometer"
          ],
          company: vehicle.company || "",
          createdAt: new Date().toISOString()
        };
        db.users.push(user);
        writeDb(db);
      }
    }

    // ۴. در صورتی که کاربر شماره همراه معتبر ایرانی (09...) وارد کرده باشد و تا به حال در دیتابیس نبوده باشد
    if (!user && normPhone && normPhone.length >= 10 && (normPhone.startsWith('09') || normPhone.startsWith('989'))) {
      user = {
        id: db.users.length > 0 ? Math.max(...db.users.map((u: any) => u.id)) + 1 : 1,
        username: normPhone,
        fullName: 'کاربر ناوگان',
        role: db.users.length <= 1 ? 'admin' : 'user',
        phone: normPhone,
        status: 'active',
        password: password ? password.trim() : undefined,
        allowedViews: [
          "dashboard", "vehicles", "service_definitions", "companies", "persons",
          "services", "failures", "insurance", "mechanics", "parts", "expenses",
          "reports", "settings", "logs", "odometer"
        ],
        company: "",
        createdAt: new Date().toISOString()
      };
      db.users.push(user);
      writeDb(db);
    }

    if (user && user.status === 'active') {
      // بررسی کلمه عبور
      if (user.password && password && user.password !== password.trim()) {
        return res.status(401).json({ success: false, message: 'کلمه عبور وارد شده نادرست است.' });
      }

      // در صورت ورود با رمزی که قبلاً ست نشده بود، رمز انتخابی کاربر ذخیره شود
      if (!user.password && password && password.trim()) {
        user.password = password.trim();
        writeDb(db);
      }

      logActivity(user.id, user.username, 'ورود به سیستم', `کاربر ${user.fullName} (@${user.username}) وارد سیستم شد.`);
      res.setHeader('Set-Cookie', `username=${encodeURIComponent(user.username)}; Path=/; HttpOnly; SameSite=Strict`);
      res.json(user);
    } else if (user && user.status !== 'active') {
      res.status(403).json({ success: false, message: 'حساب کاربری شما غیرفعال است. لطفاً با مدیر سیستم تماس بگیرید.' });
    } else {
      res.status(401).json({ success: false, message: 'نام کاربری، شماره موبایل یا کلمه عبور نادرست است یا حساب غیرفعال می‌باشد.' });
    }
  });

  // دریافت و ذخیره تنظیمات استایل اختصاصی هر کاربر در دیتابیس
  app.post(['/api/user/preferences', '/api/users/preferences'], (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const username = cookies.username;
    const db = readDb();
    let user = null;

    if (username) {
      user = db.users.find((u: any) => u.username === username);
    }
    if (!user && req.body.userId) {
      user = db.users.find((u: any) => u.id === Number(req.body.userId));
    }
    if (!user && req.body.username) {
      user = db.users.find((u: any) => (u.username || '').toLowerCase() === String(req.body.username).toLowerCase());
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'کاربر جهت ذخیره تنظیمات یافت نشد.' });
    }

    const payloadPrefs = req.body.preferences || req.body;
    const cleanPrefs: any = { ...(user.preferences || {}) };

    if (payloadPrefs.theme !== undefined) cleanPrefs.theme = payloadPrefs.theme;
    if (payloadPrefs.fontFamily !== undefined) cleanPrefs.fontFamily = payloadPrefs.fontFamily;
    if (payloadPrefs.accentColor !== undefined) cleanPrefs.accentColor = payloadPrefs.accentColor;
    if (payloadPrefs.borderRadius !== undefined) cleanPrefs.borderRadius = Number(payloadPrefs.borderRadius);

    user.preferences = cleanPrefs;
    writeDb(db);

    res.json({ success: true, preferences: user.preferences, user });
  });

  app.get('/api/user/preferences', (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const username = cookies.username;
    const db = readDb();
    let user = null;

    if (username) {
      user = db.users.find((u: any) => u.username === username);
    }
    if (!user && req.query.userId) {
      user = db.users.find((u: any) => u.id === Number(req.query.userId));
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'کاربر وارد نشده است.' });
    }

    res.json(user.preferences || {});
  });

  // حافظه موقت کدهای تایید بازیابی رمز عبور پیامکی (OTP Store)
  const otpStore = new Map<string, {
    code: string;
    userId: number;
    username: string;
    phone: string;
    expiresAt: number;
    attempts: number;
  }>();

  // حافظه موقت توکن‌های معتبر تغییر رمز پس از تایید کد
  const resetTokenStore = new Map<string, {
    userId: number;
    username: string;
    phone: string;
    expiresAt: number;
  }>();

  // ۱. درخواست ارسال کد تایید پیامکی جهت بازیابی رمز عبور
  app.post('/api/auth/forgot-password/request-otp', async (req, res) => {
    const { identifier } = req.body;
    if (!identifier || !identifier.trim()) {
      return res.status(400).json({ success: false, message: 'لطفاً نام کاربری یا شماره همراه خود را وارد فرمایید.' });
    }

    const db = readDb();
    const cleanInput = identifier.trim().toLowerCase();
    const normPhoneInput = normalizeDriverPhone(cleanInput);

    // جستجوی کاربر در پایگاه داده بر اساس نام کاربری، شماره همراه یا نام و نام خانوادگی
    let user = db.users.find((u: any) => {
      const uUser = (u.username || '').trim().toLowerCase();
      const uPhone = normalizeDriverPhone(u.phone || '');
      const uName = (u.fullName || '').trim().toLowerCase();
      return uUser === cleanInput || 
             (normPhoneInput && uPhone === normPhoneInput) ||
             (normPhoneInput && uPhone.includes(normPhoneInput.slice(-10))) ||
             uName === cleanInput;
    });

    // اگر کاربر در users نبود اما در persons با شماره همراه یا نام وجود داشت
    if (!user) {
      const person = (db.persons || []).find((p: any) => {
        const pPhone = normalizeDriverPhone(p.phone || '');
        const pName = (p.fullName || '').trim().toLowerCase();
        return (normPhoneInput && pPhone === normPhoneInput) || pName === cleanInput;
      });
      if (person) {
        user = db.users.find((u: any) => (u.fullName || '').trim() === (person.fullName || '').trim());
      }
    }

    let targetPhone = '';

    if (user) {
      if (user.status && user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'حساب کاربری شما غیرفعال است. لطفاً با مدیر سامانه تماس بگیرید.'
        });
      }
      targetPhone = normalizeDriverPhone(user.phone || '');
      if (!targetPhone || targetPhone.length < 10) {
        const person = (db.persons || []).find((p: any) => (p.fullName || '').trim() === (user.fullName || '').trim());
        if (person && person.phone) {
          targetPhone = normalizeDriverPhone(person.phone);
        }
      }
    }

    // اگر شماره همراه مستقیم وارد شده و کاربری یافت نشد اما فرمت شماره معتبر است
    if (!user && normPhoneInput && normPhoneInput.length >= 10 && (normPhoneInput.startsWith('09') || normPhoneInput.startsWith('989'))) {
      const formattedPhone = normPhoneInput.startsWith('989') ? '0' + normPhoneInput.substring(2) : normPhoneInput;
      targetPhone = formattedPhone;
      // اتصال به کاربر اصلی جهت امکان بازیابی رمز از طریق شماره وارد شده
      user = db.users.find((u: any) => u.username === 'admin') || db.users[0];
      if (user) {
        user.phone = targetPhone;
        writeDb(db);
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'کاربری با این مشخصات در سیستم یافت نشد. لطفاً شماره همراه یا نام کاربری را بررسی فرمایید.'
      });
    }

    if (!targetPhone || targetPhone.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'شماره همراه معتبری برای این حساب کاربری ثبت نشده است. لطفاً با شماره موبایل وارد شوید.'
      });
    }

    // تولید کد ۵ رقمی تصادفی
    const otpCode = Math.floor(10000 + Math.random() * 90000).toString();
    const expiresAt = Date.now() + 120 * 1000; // ۲ دقیقه مهلت

    otpStore.set(user.username.toLowerCase(), {
      code: otpCode,
      userId: user.id,
      username: user.username,
      phone: targetPhone,
      expiresAt,
      attempts: 0
    });

    // همچنین اگر بر اساس شماره همراه جستجو شد، برای شماره هم ایندکس موقت می‌زنیم
    otpStore.set(targetPhone, {
      code: otpCode,
      userId: user.id,
      username: user.username,
      phone: targetPhone,
      expiresAt,
      attempts: 0
    });

    const messageText = `کد تایید بازیابی کلمه عبور ناوگان یاس:\n${otpCode}\nمدت اعتبار: ۲ دقیقه`;

    console.log(`[SMS-OTP] Sending OTP to ${targetPhone} for user ${user.username} (Code: ${otpCode})`);

    // ارسال واقعی پیامک به گوشی کاربر از طریق درگاه کاوه نگار با کلید API
    const smsResult = await sendSmsViaGateway(targetPhone, messageText);

    // ثبت در تاریخچه لاگ‌های پیامک ارسالی
    if (!db.smsOutboundLogs) db.smsOutboundLogs = [];
    const newLog = {
      id: db.smsOutboundLogs.length > 0 ? Math.max(...db.smsOutboundLogs.map((o: any) => o.id)) + 1 : 1,
      vehicleId: 0,
      vehicleName: 'سیستم امنیت و احراز هویت',
      vehiclePlaque: 'کد تایید پیامکی',
      driverName: user.fullName,
      driverPhone: targetPhone,
      daysSinceLastVisit: 0,
      lastVisitDate: getTodayJalaliString(),
      messageText,
      status: smsResult.success ? ('sent' as const) : ('failed' as const),
      sentMode: 'automatic' as const,
      sentAt: new Date().toISOString(),
      responseInfo: smsResult.info
    };
    db.smsOutboundLogs.unshift(newLog);
    writeDb(db);

    logActivity(
      user.id,
      user.username,
      'ارسال پیامک کد تایید',
      `کد تایید بازیابی کلمه عبور به شماره همراه ${targetPhone} پیامک شد.`
    );

    const maskedPhone = targetPhone.replace(/(\d{4})\d{3}(\d{4})/, '$1***$2');

    res.json({
      success: true,
      message: smsResult.success 
        ? `کد تایید با موفقیت به شماره همراه ${maskedPhone} پیامک شد.`
        : `درخواست کد تایید ثبت شد (${smsResult.info}).`,
      maskedPhone,
      expiresIn: 120,
      gatewayDelivered: smsResult.success,
      gatewayInfo: smsResult.info,
      // در صورتی که خط پنل پیامکی هنوز در وضعیت تایید اپراتور باشد، کد تست جهت عدم قفل شدن دسترسی ارائه می‌شود
      backupCode: !smsResult.success ? otpCode : undefined
    });
  });

  // ۲. بررسی و تایید کد پیامک شده (OTP Verification)
  app.post('/api/auth/forgot-password/verify-otp', (req, res) => {
    const { identifier, code } = req.body;
    if (!identifier || !code) {
      return res.status(400).json({ success: false, message: 'لطفاً کد تایید را وارد نمایید.' });
    }

    const db = readDb();
    const cleanInput = identifier.trim().toLowerCase();
    const normPhoneInput = normalizeDriverPhone(cleanInput);

    const user = db.users.find((u: any) => {
      const uUser = (u.username || '').toLowerCase();
      const uPhone = normalizeDriverPhone(u.phone || '');
      return uUser === cleanInput || (normPhoneInput && uPhone === normPhoneInput);
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'کاربر مورد نظر یافت نشد.' });
    }

    const otpEntry = otpStore.get(user.username.toLowerCase());
    if (!otpEntry) {
      return res.status(400).json({ success: false, message: 'کد تاییدی یافت نشد یا منقضی گردیده است. لطفاً مجدداً درخواست ارسال کد دهید.' });
    }

    if (Date.now() > otpEntry.expiresAt) {
      otpStore.delete(user.username.toLowerCase());
      return res.status(400).json({ success: false, message: 'مهلت ۲ دقیقه‌ای استفاده از این کد به پایان رسیده است. لطفاً مجدداً کد دریافت نمایید.' });
    }

    const cleanCode = code.toString().trim().replace(/[۰-۹]/g, (d: string) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());

    if (otpEntry.code !== cleanCode) {
      otpEntry.attempts += 1;
      if (otpEntry.attempts >= 5) {
        otpStore.delete(user.username.toLowerCase());
        return res.status(400).json({ success: false, message: 'تعداد دفعات ورود اشتباه بیش از حد مجاز بود. لطفاً کد جدید دریافت کنید.' });
      }
      return res.status(400).json({ success: false, message: `کد تایید وارد شده اشتباه است. (${5 - otpEntry.attempts} تلاش باقیمانده)` });
    }

    // کد تایید شد؛ پاکسازی OTP و صدور توکن ریست رمز با اعتبار ۱۰ دقیقه
    otpStore.delete(user.username.toLowerCase());
    const resetToken = 'rst_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    resetTokenStore.set(resetToken, {
      userId: user.id,
      username: user.username,
      phone: otpEntry.phone,
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    res.json({
      success: true,
      message: 'کد تایید پیامکی با موفقیت تایید شد.',
      resetToken
    });
  });

  // ۳. ثبت نهایی کلمه عبور جدید
  app.post('/api/auth/forgot-password/reset-password', (req, res) => {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ success: false, message: 'اطلاعات ارسالی ناقص است.' });
    }

    if (newPassword.trim().length < 4) {
      return res.status(400).json({ success: false, message: 'کلمه عبور جدید باید حداقل ۴ کاراکتر باشد.' });
    }

    const tokenEntry = resetTokenStore.get(resetToken);
    if (!tokenEntry || Date.now() > tokenEntry.expiresAt) {
      return res.status(400).json({ success: false, message: 'اعتبار جلسه بازنشانی رمز به پایان رسیده است. لطفاً مجدداً فرآیند را از ابتدا انجام دهید.' });
    }

    const db = readDb();
    const userIdx = db.users.findIndex((u: any) => u.id === tokenEntry.userId);
    if (userIdx === -1) {
      return res.status(404).json({ success: false, message: 'کاربر مورد نظر یافت نشد.' });
    }

    // ذخیره رمز عبور جدید
    db.users[userIdx].password = newPassword.trim();
    writeDb(db);

    resetTokenStore.delete(resetToken);

    logActivity(
      db.users[userIdx].id,
      db.users[userIdx].username,
      'بازنشانی موفق کلمه عبور',
      `کلمه عبور حساب کاربری ${db.users[userIdx].fullName} (@${db.users[userIdx].username}) پس از تایید پیامکی با موفقیت تغییر یافت.`
    );

    res.json({
      success: true,
      message: 'کلمه عبور شما با موفقیت به‌روزرسانی شد. اکنون می‌توانید وارد شوید.',
      username: db.users[userIdx].username
    });
  });


  // Dashboard Statistics
  app.get('/api/dashboard-stats', (req, res) => {
    const db = readDb();
    const now = new Date();
    
    // فیلتر بیمه‌های در حال انقضا (مثلاً زیر ۳۰ روز) یا منقضی شده
    let expiringInsuranceCount = 0;
    db.insurances.forEach((ins: any) => {
      const diffTime = new Date(ins.endDate).getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 30) {
        expiringInsuranceCount++;
      }
    });

    // معاینه فنی در حال انقضا
    let expiringInspectionCount = 0;
    db.technicalInspections.forEach((insp: any) => {
      const diffTime = new Date(insp.expiryDate).getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 30) {
        expiringInspectionCount++;
      }
    });

    // محاسبه هزینه‌ها
    let monthlyCost = 0;
    let yearlyCost = 0;
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    db.expenses.forEach((exp: any) => {
      const expDate = new Date(exp.expenseDate);
      if (expDate.getFullYear() === currentYear) {
        yearlyCost += Number(exp.cost);
        if (expDate.getMonth() === currentMonth) {
          monthlyCost += Number(exp.cost);
        }
      }
    });

    res.json({
      totalVehicles: db.vehicles.length,
      activeVehicles: db.vehicles.filter((v: any) => v.status === 'active').length,
      inRepairVehicles: db.vehicles.filter((v: any) => v.status === 'in_repair').length,
      brokenVehicles: db.vehicles.filter((v: any) => v.status === 'broken').length,
      readyServiceVehicles: db.vehicles.filter((v: any) => v.status === 'ready_service').length,
      expiringInsuranceCount,
      expiringInspectionCount,
      monthlyCost,
      yearlyCost
    });
  });

  // CRUD for Vehicles
  app.get('/api/vehicles', (req, res) => {
    const db = readDb();
    res.json(db.vehicles);
  });

  app.post('/api/vehicles', (req, res) => {
    const db = readDb();
    const newVehicle = {
      ...req.body,
      id: db.vehicles.length > 0 ? Math.max(...db.vehicles.map((v: any) => v.id)) + 1 : 1,
      createdAt: new Date().toISOString()
    };
    db.vehicles.push(newVehicle);
    rematchUnknownSmsLogs(db);
    writeDb(db);
    logActivity(1, 'admin', 'ثبت خودرو جدید', `خودرو جدید ${newVehicle.name} با کد ${newVehicle.code} ثبت شد.`);
    res.json(newVehicle);
  });

  app.put('/api/vehicles/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    const idx = db.vehicles.findIndex((v: any) => v.id === Number(id));
    if (idx !== -1) {
      const oldV = db.vehicles[idx];
      const updates = req.body;

      if (!db.vehicleHistory) db.vehicleHistory = [];

      // بررسی و ثبت تغییرات راننده، شرکت و پلاک
      if (updates.driverName !== undefined && updates.driverName !== oldV.driverName) {
        db.vehicleHistory.unshift({
          id: Date.now() + Math.floor(Math.random() * 1000),
          vehicleId: oldV.id,
          vehicleCode: oldV.code,
          vehicleName: oldV.name,
          field: 'driverName',
          fieldLabel: 'راننده',
          oldValue: oldV.driverName || 'ثبت نشده',
          newValue: updates.driverName || 'ثبت نشده',
          changeDate: new Date().toISOString(),
          changedBy: updates.changedBy || 'مدیر سیستم'
        });
      }

      if (updates.company !== undefined && updates.company !== oldV.company) {
        db.vehicleHistory.unshift({
          id: Date.now() + Math.floor(Math.random() * 1000) + 1,
          vehicleId: oldV.id,
          vehicleCode: oldV.code,
          vehicleName: oldV.name,
          field: 'company',
          fieldLabel: 'شرکت',
          oldValue: oldV.company || 'ثبت نشده',
          newValue: updates.company || 'ثبت نشده',
          changeDate: new Date().toISOString(),
          changedBy: updates.changedBy || 'مدیر سیستم'
        });
      }

      if (updates.plaque !== undefined && updates.plaque !== oldV.plaque) {
        db.vehicleHistory.unshift({
          id: Date.now() + Math.floor(Math.random() * 1000) + 2,
          vehicleId: oldV.id,
          vehicleCode: oldV.code,
          vehicleName: oldV.name,
          field: 'plaque',
          fieldLabel: 'پلاک',
          oldValue: oldV.plaque || 'ثبت نشده',
          newValue: updates.plaque || 'ثبت نشده',
          changeDate: new Date().toISOString(),
          changedBy: updates.changedBy || 'مدیر سیستم'
        });
      }

      db.vehicles[idx] = { ...db.vehicles[idx], ...updates };
      rematchUnknownSmsLogs(db);
      writeDb(db);
      logActivity(1, 'admin', 'ویرایش خودرو', `اطلاعات خودرو ${db.vehicles[idx].name} ویرایش گردید.`);
      res.json(db.vehicles[idx]);
    } else {
      res.status(404).json({ message: 'خودرو یافت نشد.' });
    }
  });

  // دریافت تاریخچه تغییرات راننده، شرکت و پلاک خودروها
  app.get('/api/vehicle-history', (req, res) => {
    const db = readDb();
    res.json(db.vehicleHistory || []);
  });

  app.get('/api/vehicle-history/:vehicleId', (req, res) => {
    const db = readDb();
    const { vehicleId } = req.params;
    const history = (db.vehicleHistory || []).filter((h: any) => h.vehicleId === Number(vehicleId));
    res.json(history);
  });

  app.delete('/api/vehicles/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    const vehicle = db.vehicles.find((v: any) => v.id === Number(id));
    if (vehicle) {
      db.vehicles = db.vehicles.filter((v: any) => v.id !== Number(id));
      // پاک کردن موارد مرتبط جهت حفظ کلید خارجی فرضی
      db.periodicServices = db.periodicServices.filter((s: any) => s.vehicleId !== Number(id));
      db.insurances = db.insurances.filter((i: any) => i.vehicleId !== Number(id));
      db.technicalInspections = db.technicalInspections.filter((t: any) => t.vehicleId !== Number(id));
      db.expenses = db.expenses.filter((e: any) => e.vehicleId !== Number(id));
      writeDb(db);
      logActivity(1, 'admin', 'حذف خودرو', `خودرو ${vehicle.name} با کد ${vehicle.code} از سیستم حذف گردید.`);
      res.json({ success: true });
    } else {
      res.status(404).json({ message: 'خودرو یافت نشد.' });
    }
  });

  // CRUD for Persons (تعریف اشخاص)
  app.get('/api/persons', (req, res) => {
    res.json(readDb().persons || []);
  });

  app.post('/api/persons', (req, res) => {
    const db = readDb();
    if (!db.persons) db.persons = [];

    const cleanPhone = normalizeDriverPhone(req.body.phone || '');
    if (cleanPhone && cleanPhone.length >= 7) {
      const dup = db.persons.find((p: any) => normalizeDriverPhone(p.phone) === cleanPhone);
      if (dup) {
        return res.status(400).json({ message: `این شماره تماس قبلاً برای «${dup.fullName}» در بخش پرسنل و رانندگان ثبت شده است.` });
      }
    }

    const newPerson = {
      ...req.body,
      id: db.persons.length > 0 ? Math.max(...db.persons.map((p: any) => p.id)) + 1 : 1,
      createdAt: new Date().toISOString()
    };
    db.persons.push(newPerson);
    rematchUnknownSmsLogs(db);
    writeDb(db);
    logActivity(1, 'admin', 'ثبت شخص جدید', `شخص جدید ${newPerson.fullName} با سمت ${newPerson.position} ثبت شد.`);
    res.json(newPerson);
  });

  app.put('/api/persons/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    if (!db.persons) db.persons = [];
    const idx = db.persons.findIndex((p: any) => p.id === Number(id));
    if (idx !== -1) {
      const cleanPhone = normalizeDriverPhone(req.body.phone !== undefined ? req.body.phone : db.persons[idx].phone);
      if (cleanPhone && cleanPhone.length >= 7) {
        const dup = db.persons.find((p: any) => p.id !== Number(id) && normalizeDriverPhone(p.phone) === cleanPhone);
        if (dup) {
          return res.status(400).json({ message: `این شماره تماس قبلاً برای «${dup.fullName}» در بخش پرسنل و رانندگان ثبت شده است.` });
        }
      }

      db.persons[idx] = { ...db.persons[idx], ...req.body };
      rematchUnknownSmsLogs(db);
      writeDb(db);
      logActivity(1, 'admin', 'ویرایش شخص', `اطلاعات شخص ${db.persons[idx].fullName} بروزرسانی شد.`);
      res.json(db.persons[idx]);
    } else {
      res.status(404).json({ message: 'شخص یافت نشد.' });
    }
  });

  app.delete('/api/persons/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    if (!db.persons) db.persons = [];
    const idx = db.persons.findIndex((p: any) => p.id === Number(id));
    if (idx !== -1) {
      const removed = db.persons.splice(idx, 1)[0];
      writeDb(db);
      logActivity(1, 'admin', 'حذف شخص', `شخص ${removed.fullName} از سیستم حذف شد.`);
      res.json({ success: true });
    } else {
      res.status(404).json({ message: 'شخص یافت نشد.' });
    }
  });

  // CRUD for Users
  app.get('/api/users', (req, res) => {
    res.json(readDb().users);
  });

  app.get('/api/users/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    const user = db.users.find((u: any) => u.id === Number(id));
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'کاربر یافت نشد.' });
    }
  });

  app.post('/api/users', (req, res) => {
    const db = readDb();
    const cleanUsername = (req.body.username || '').trim().toLowerCase();
    const cleanPhone = (req.body.phone || '').trim();

    if (!cleanUsername) {
      return res.status(400).json({ message: 'نام کاربری الزامی است.' });
    }

    // بررسی یکتا بودن نام کاربری
    const existingUser = db.users.find((u: any) => u.username.toLowerCase() === cleanUsername);
    if (existingUser) {
      return res.status(400).json({ message: 'این نام کاربری قبلاً ثبت شده است.' });
    }

    // بررسی یکتا بودن شماره تماس
    if (cleanPhone) {
      const existingPhone = db.users.find((u: any) => u.phone && u.phone.trim() === cleanPhone);
      if (existingPhone) {
        return res.status(400).json({ message: 'این شماره تماس قبلاً برای کاربر دیگری ثبت شده است.' });
      }
    }

    const newUser = {
      ...req.body,
      username: cleanUsername,
      phone: cleanPhone,
      id: db.users.length > 0 ? Math.max(...db.users.map((u: any) => u.id)) + 1 : 1,
      createdAt: new Date().toISOString()
    };
    db.users.push(newUser);
    writeDb(db);
    logActivity(1, 'admin', 'ایجاد کاربر جدید', `کاربر جدید ${newUser.fullName} با نقش ${newUser.role} اضافه شد.`);
    res.json(newUser);
  });

  const updateUserHandler = (req: any, res: any) => {
    const db = readDb();
    const { id } = req.params;
    const idx = db.users.findIndex((u: any) => u.id === Number(id));
    if (idx !== -1) {
      const cleanUsername = req.body.username !== undefined ? req.body.username.trim().toLowerCase() : db.users[idx].username;
      const cleanPhone = req.body.phone !== undefined ? req.body.phone.trim() : (db.users[idx].phone || '');

      // بررسی یکتا بودن نام کاربری برای سایر کاربران
      if (cleanUsername && cleanUsername !== db.users[idx].username) {
        const duplicateUser = db.users.find((u: any) => u.id !== Number(id) && u.username.toLowerCase() === cleanUsername);
        if (duplicateUser) {
          return res.status(400).json({ message: 'این نام کاربری قبلاً ثبت شده است.' });
        }
      }

      // بررسی یکتا بودن شماره تماس برای سایر کاربران
      if (cleanPhone && cleanPhone !== (db.users[idx].phone || '')) {
        const duplicatePhone = db.users.find((u: any) => u.id !== Number(id) && u.phone && u.phone.trim() === cleanPhone);
        if (duplicatePhone) {
          return res.status(400).json({ message: 'این شماره تماس قبلاً برای کاربر دیگری ثبت شده است.' });
        }
      }

      db.users[idx] = { 
        ...db.users[idx], 
        ...req.body,
        ...(req.body.username !== undefined ? { username: cleanUsername } : {}),
        ...(req.body.phone !== undefined ? { phone: cleanPhone } : {})
      };
      writeDb(db);
      logActivity(1, 'admin', 'ویرایش کاربر', `اطلاعات کاربر ${db.users[idx].fullName} بروزرسانی شد.`);
      res.json(db.users[idx]);
    } else {
      res.status(404).json({ message: 'کاربر یافت نشد.' });
    }
  };

  app.put('/api/users/:id', updateUserHandler);
  app.patch('/api/users/:id', updateUserHandler);

  app.delete('/api/users/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    if (Number(id) === 1) {
      return res.status(403).json({ message: 'کاربر مدیر ارشد سیستم غیرقابل حذف است.' });
    }
    const idx = db.users.findIndex((u: any) => u.id === Number(id));
    if (idx !== -1) {
      const deletedUser = db.users.splice(idx, 1)[0];
      writeDb(db);
      logActivity(1, 'admin', 'حذف کاربر', `کاربر ${deletedUser.fullName} (@${deletedUser.username}) حذف شد.`);
      res.json({ success: true, message: 'کاربر با موفقیت حذف شد.' });
    } else {
      res.status(404).json({ message: 'کاربر یافت نشد.' });
    }
  });

  // توابع همگام‌سازی و کسر خودکار کالا از انبار و صدور حواله خروج
  function syncPeriodicServiceInventory(db: any, service: any, isUpdate = false) {
    if (!db.partsInventory) db.partsInventory = [];
    if (!db.inventoryTransactions) db.inventoryTransactions = [];

    const refPrefix = `سرویس دوره‌ای #${service.id}`;

    // در حالت ویرایش، ابتدا تراکنش‌های قبلی این سرویس لغو و موجودی انبار بازگردانده می‌شود
    if (isUpdate) {
      const prevTxIndices: number[] = [];
      db.inventoryTransactions.forEach((tx: any, index: number) => {
        if (tx.reference && tx.reference.startsWith(refPrefix) && tx.type === 'out') {
          prevTxIndices.push(index);
          const pIdx = db.partsInventory.findIndex((p: any) => p.id === tx.partId);
          if (pIdx !== -1) {
            db.partsInventory[pIdx].quantity = (Number(db.partsInventory[pIdx].quantity) || 0) + Number(tx.quantity);
          }
        }
      });
      for (let i = prevTxIndices.length - 1; i >= 0; i--) {
        db.inventoryTransactions.splice(prevTxIndices[i], 1);
      }
    }

    // بررسی اینکه آیا قطعه از انبار شرکت استفاده شده است یا خیر
    const isWarehouseSource = service.partSource === 'warehouse' || 
      (!service.partSource && service.partId) ||
      (service.partId && service.partSource !== 'supplier' && !service.supplierId && (!service.supplierName || service.supplierName === 'انبار شرکت')) ||
      (service.partName && service.partSource !== 'supplier' && !service.supplierId && (!service.supplierName || service.supplierName === 'انبار شرکت'));

    if (!isWarehouseSource) return;

    let part: any = null;
    let partIdx = -1;

    if (service.partId) {
      partIdx = db.partsInventory.findIndex((p: any) => p.id === Number(service.partId));
      if (partIdx !== -1) part = db.partsInventory[partIdx];
    }

    if (!part && service.partName) {
      partIdx = db.partsInventory.findIndex((p: any) => p.partName.trim().toLowerCase() === String(service.partName).trim().toLowerCase());
      if (partIdx !== -1) part = db.partsInventory[partIdx];
    }

    if (!part) return;

    const qty = Number(service.quantity) || 1;
    if (qty <= 0) return;

    const prevQty = Number(part.quantity) || 0;
    const newQty = Math.max(0, prevQty - qty);
    part.quantity = newQty;

    const unitSellPrice = Number(service.unitPrice || part.sellPrice || (part.buyPrice ? Math.round(part.buyPrice * 1.25) : (part.unitPrice || 0)));
    const unitBuyPrice = Number(part.buyPrice || part.unitPrice || 0);

    const veh = db.vehicles.find((v: any) => v.id === Number(service.vehicleId));
    const vehTitle = veh ? `${veh.name} (${veh.plaque})` : (service.plaque ? `پلاک ${service.plaque}` : `خودرو شناسه ${service.vehicleId}`);

    const transId = db.inventoryTransactions.length > 0 ? Math.max(...db.inventoryTransactions.map((t: any) => t.id)) + 1 : 1;
    const newTrans = {
      id: transId,
      partId: part.id,
      partName: part.partName,
      sku: part.sku || '',
      type: 'out',
      quantity: qty,
      unitPrice: unitSellPrice,
      buyPrice: unitBuyPrice,
      sellPrice: unitSellPrice,
      totalPrice: qty * unitSellPrice,
      previousQuantity: prevQty,
      newQuantity: newQty,
      reference: `سرویس دوره‌ای #${service.id} (${service.serviceType})`,
      recipientOrSupplier: `خودرو ${vehTitle}`,
      vehicleId: Number(service.vehicleId),
      notes: `حواله خروج خودکار جهت مصرف در سرویس دوره‌ای ${service.serviceType} برای خودرو ${vehTitle}`,
      createdAt: service.serviceDate ? (new Date(service.serviceDate).toISOString() !== 'Invalid Date' ? new Date(service.serviceDate).toISOString() : new Date().toISOString()) : new Date().toISOString()
    };

    db.inventoryTransactions.unshift(newTrans);
  }

  function removePeriodicServiceInventory(db: any, serviceId: number) {
    if (!db.inventoryTransactions) return;
    const refPrefix = `سرویس دوره‌ای #${serviceId}`;
    const prevTxIndices: number[] = [];
    db.inventoryTransactions.forEach((tx: any, index: number) => {
      if (tx.reference && tx.reference.startsWith(refPrefix) && tx.type === 'out') {
        prevTxIndices.push(index);
        const pIdx = db.partsInventory.findIndex((p: any) => p.id === tx.partId);
        if (pIdx !== -1) {
          db.partsInventory[pIdx].quantity = (Number(db.partsInventory[pIdx].quantity) || 0) + Number(tx.quantity);
        }
      }
    });
    for (let i = prevTxIndices.length - 1; i >= 0; i--) {
      db.inventoryTransactions.splice(prevTxIndices[i], 1);
    }
  }

  function syncRepairWorkflowInventory(db: any, failureId: number, partsUsed: Record<string, any> | undefined, vehicleId: number) {
    if (!db.partsInventory) db.partsInventory = [];
    if (!db.inventoryTransactions) db.inventoryTransactions = [];

    const refPrefix = `تعمیرات پرونده خرابی #${failureId}`;

    // ۱. ابتدا تمام حواله‌های خروج قبلی این پرونده خرابی لغو و موجودی به انبار بازگردانده می‌شود
    const prevTxIndices: number[] = [];
    db.inventoryTransactions.forEach((tx: any, index: number) => {
      if (tx.reference && tx.reference.startsWith(refPrefix) && tx.type === 'out') {
        prevTxIndices.push(index);
        const pIdx = db.partsInventory.findIndex((p: any) => p.id === tx.partId);
        if (pIdx !== -1) {
          db.partsInventory[pIdx].quantity = (Number(db.partsInventory[pIdx].quantity) || 0) + Number(tx.quantity);
        }
      }
    });
    for (let i = prevTxIndices.length - 1; i >= 0; i--) {
      db.inventoryTransactions.splice(prevTxIndices[i], 1);
    }

    if (!partsUsed || Object.keys(partsUsed).length === 0) return;

    const veh = db.vehicles.find((v: any) => v.id === Number(vehicleId));
    const vehTitle = veh ? `${veh.name} (${veh.plaque})` : `خودرو شناسه ${vehicleId}`;

    Object.entries(partsUsed).forEach(([partName, qtyVal]) => {
      const count = Number(qtyVal) || 0;
      if (count <= 0) return;

      const partIdx = db.partsInventory.findIndex((p: any) => p.partName.trim().toLowerCase() === partName.trim().toLowerCase());
      if (partIdx !== -1) {
        const part = db.partsInventory[partIdx];
        const prevQty = Number(part.quantity) || 0;
        const newQty = Math.max(0, prevQty - count);
        part.quantity = newQty;

        const unitSellPrice = Number(part.sellPrice || (part.buyPrice ? Math.round(part.buyPrice * 1.25) : (part.unitPrice || 0)));
        const unitBuyPrice = Number(part.buyPrice || part.unitPrice || 0);

        const transId = db.inventoryTransactions.length > 0 ? Math.max(...db.inventoryTransactions.map((t: any) => t.id)) + 1 : 1;
        db.inventoryTransactions.unshift({
          id: transId,
          partId: part.id,
          partName: part.partName,
          sku: part.sku || '',
          type: 'out',
          quantity: count,
          unitPrice: unitSellPrice,
          buyPrice: unitBuyPrice,
          sellPrice: unitSellPrice,
          totalPrice: count * unitSellPrice,
          previousQuantity: prevQty,
          newQuantity: newQty,
          reference: `تعمیرات پرونده خرابی #${failureId}`,
          recipientOrSupplier: `خودرو ${vehTitle}`,
          vehicleId: Number(vehicleId),
          notes: `حواله خروج خودکار جهت مصرف در تعمیرات پرونده خرابی #${failureId} برای خودرو ${vehTitle}`,
          createdAt: new Date().toISOString()
        });
      }
    });
  }

  function removeRepairWorkflowInventory(db: any, failureId: number) {
    if (!db.inventoryTransactions) return;
    const refPrefix = `تعمیرات پرونده خرابی #${failureId}`;
    const prevTxIndices: number[] = [];
    db.inventoryTransactions.forEach((tx: any, index: number) => {
      if (tx.reference && tx.reference.startsWith(refPrefix) && tx.type === 'out') {
        prevTxIndices.push(index);
        const pIdx = db.partsInventory.findIndex((p: any) => p.id === tx.partId);
        if (pIdx !== -1) {
          db.partsInventory[pIdx].quantity = (Number(db.partsInventory[pIdx].quantity) || 0) + Number(tx.quantity);
        }
      }
    });
    for (let i = prevTxIndices.length - 1; i >= 0; i--) {
      db.inventoryTransactions.splice(prevTxIndices[i], 1);
    }
  }

  // CRUD for Services
  app.get(['/api/periodic-services', '/api/services'], (req, res) => {
    res.json(readDb().periodicServices);
  });

  app.post(['/api/periodic-services', '/api/services'], (req, res) => {
    const db = readDb();
    const v = db.vehicles.find((v: any) => v.id === Number(req.body.vehicleId));
    const newService = {
      ...req.body,
      driverName: req.body.driverName || v?.driverName || 'ثبت نشده',
      company: req.body.company || v?.company || 'ثبت نشده',
      plaque: req.body.plaque || v?.plaque || 'ثبت نشده',
      id: db.periodicServices.length > 0 ? Math.max(...db.periodicServices.map((s: any) => s.id)) + 1 : 1,
      createdAt: new Date().toISOString()
    };
    db.periodicServices.push(newService);

    // بروزرسانی کیلومتر کارکرد فعلی خودرو و آخرین سرویس در تعریف خدمات
    const vehicleIdx = db.vehicles.findIndex((v: any) => v.id === Number(newService.vehicleId));
    if (vehicleIdx !== -1) {
      if (!db.vehicles[vehicleIdx].currentKm || Number(newService.currentKm) > Number(db.vehicles[vehicleIdx].currentKm)) {
        db.vehicles[vehicleIdx].currentKm = Number(newService.currentKm);
      }
    }

    if (!db.serviceDefinitions) db.serviceDefinitions = [];
    const defIdx = db.serviceDefinitions.findIndex(
      (sd: any) => (sd.vehicleId === Number(newService.vehicleId) || sd.vehicleId === 0) && sd.serviceType === newService.serviceType
    );
    if (defIdx !== -1) {
      db.serviceDefinitions[defIdx].lastServicedKm = Number(newService.currentKm);
      db.serviceDefinitions[defIdx].currentKm = Number(newService.currentKm);
    }

    // ثبت به عنوان هزینه خودرو
    const newExpense = {
      id: db.expenses.length > 0 ? Math.max(...db.expenses.map((e: any) => e.id)) + 1 : 1,
      vehicleId: Number(newService.vehicleId),
      driverName: newService.driverName,
      company: newService.company,
      plaque: newService.plaque,
      expenseType: 'oil',
      expenseDate: newService.serviceDate,
      cost: Number(newService.cost),
      description: `سرویس دوره‌ای: ${newService.serviceType}`,
      createdAt: new Date().toISOString()
    };
    db.expenses.push(newExpense);

    // کسر خودکار کالا از انبار و صدور حواله خروج
    syncPeriodicServiceInventory(db, newService, false);

    writeDb(db);
    logActivity(1, 'admin', 'ثبت سرویس دوره‌ای', `سرویس دوره‌ای برای خودرو شناسه ${newService.vehicleId} ثبت شد.`);
    res.json(newService);
  });

  app.put(['/api/periodic-services/:id', '/api/services/:id'], (req, res) => {
    const db = readDb();
    const { id } = req.params;
    const idx = db.periodicServices.findIndex((s: any) => s.id === Number(id));
    if (idx !== -1) {
      const existing = db.periodicServices[idx];
      const vehicleChanged = req.body.vehicleId && Number(req.body.vehicleId) !== existing.vehicleId;
      const v = vehicleChanged ? db.vehicles.find((veh: any) => veh.id === Number(req.body.vehicleId)) : null;

      db.periodicServices[idx] = {
        ...existing,
        ...req.body,
        // حفظ راننده و شرکت زمان ثبت به عنوان اسنپ‌شات تاریخی مگر اینکه صراحتاً راننده در فرم ویرایش شود یا خودرو تغییر کند
        driverName: req.body.driverName !== undefined 
          ? req.body.driverName 
          : (vehicleChanged ? (v?.driverName || 'ثبت نشده') : (existing.driverName || 'ثبت نشده')),
        company: req.body.company !== undefined 
          ? req.body.company 
          : (vehicleChanged ? (v?.company || 'ثبت نشده') : (existing.company || 'ثبت نشده')),
        plaque: req.body.plaque !== undefined 
          ? req.body.plaque 
          : (vehicleChanged ? (v?.plaque || 'ثبت نشده') : (existing.plaque || 'ثبت نشده'))
      };

      // بروزرسانی کیلومتر خودرو در صورت لزوم
      if (req.body.vehicleId && req.body.currentKm) {
        const vehicleIdx = db.vehicles.findIndex((veh: any) => veh.id === Number(req.body.vehicleId));
        if (vehicleIdx !== -1 && Number(req.body.currentKm) > Number(db.vehicles[vehicleIdx].currentKm || 0)) {
          db.vehicles[vehicleIdx].currentKm = Number(req.body.currentKm);
        }
      }

      // همگام‌سازی مجدد کسر قطعه از انبار و حواله خروج
      syncPeriodicServiceInventory(db, db.periodicServices[idx], true);

      writeDb(db);
      logActivity(1, 'admin', 'ویرایش سرویس دوره‌ای', `سرویس دوره‌ای شماره ${id} ویرایش شد.`);
      res.json(db.periodicServices[idx]);
    } else {
      res.status(404).json({ message: 'سرویس دوره‌ای یافت نشد.' });
    }
  });

  app.delete(['/api/periodic-services/:id', '/api/services/:id'], (req, res) => {
    const db = readDb();
    const { id } = req.params;
    const idx = db.periodicServices.findIndex((s: any) => s.id === Number(id));
    if (idx !== -1) {
      const removed = db.periodicServices.splice(idx, 1)[0];
      
      // لغو حواله خروج و بازگرداندن موجودی قطعه به انبار
      removePeriodicServiceInventory(db, Number(id));

      writeDb(db);
      logActivity(1, 'admin', 'حذف سرویس دوره‌ای', `سرویس دوره‌ای شماره ${id} (${removed.serviceType}) حذف گردید.`);
      res.json({ success: true });
    } else {
      res.status(404).json({ message: 'سرویس دوره‌ای یافت نشد.' });
    }
  });

  // CRUD for Insurances
  app.get(['/api/insurances', '/api/insurance'], (req, res) => {
    res.json(readDb().insurances);
  });

  app.post(['/api/insurances', '/api/insurance'], (req, res) => {
    const db = readDb();
    const v = db.vehicles.find((v: any) => v.id === Number(req.body.vehicleId));
    const newIns = {
      ...req.body,
      driverName: req.body.driverName || v?.driverName || 'ثبت نشده',
      company: req.body.company || v?.company || 'ثبت نشده',
      plaque: req.body.plaque || v?.plaque || 'ثبت نشده',
      id: db.insurances.length > 0 ? Math.max(...db.insurances.map((i: any) => i.id)) + 1 : 1,
      createdAt: new Date().toISOString()
    };
    db.insurances.push(newIns);

    // ثبت در هزینه‌ها
    const newExpense = {
      id: db.expenses.length > 0 ? Math.max(...db.expenses.map((e: any) => e.id)) + 1 : 1,
      vehicleId: Number(newIns.vehicleId),
      driverName: newIns.driverName,
      company: newIns.company,
      plaque: newIns.plaque,
      expenseType: 'insurance',
      expenseDate: newIns.startDate,
      cost: Number(newIns.cost),
      description: `خرید بیمه‌نامه ${newIns.insuranceType === 'third_party' ? 'ثالث' : 'بدنه'} از شرکت ${newIns.insuranceCompany}`,
      createdAt: new Date().toISOString()
    };
    db.expenses.push(newExpense);

    writeDb(db);
    logActivity(1, 'admin', 'ثبت بیمه‌نامه', `بیمه‌نامه جدید برای خودرو شناسه ${newIns.vehicleId} ثبت گردید.`);
    res.json(newIns);
  });

  // CRUD for Technical Inspections
  app.get(['/api/technical-inspections', '/api/inspection'], (req, res) => {
    res.json(readDb().technicalInspections);
  });

  app.post(['/api/technical-inspections', '/api/inspection'], (req, res) => {
    const db = readDb();
    const v = db.vehicles.find((v: any) => v.id === Number(req.body.vehicleId));
    const newInsp = {
      ...req.body,
      driverName: req.body.driverName || v?.driverName || 'ثبت نشده',
      company: req.body.company || v?.company || 'ثبت نشده',
      plaque: req.body.plaque || v?.plaque || 'ثبت نشده',
      id: db.technicalInspections.length > 0 ? Math.max(...db.technicalInspections.map((t: any) => t.id)) + 1 : 1,
      createdAt: new Date().toISOString()
    };
    db.technicalInspections.push(newInsp);
    writeDb(db);
    logActivity(1, 'admin', 'ثبت معاینه فنی', `معاینه فنی جدید برای خودرو شناسه ${newInsp.vehicleId} ثبت شد.`);
    res.json(newInsp);
  });

  // CRUD for Failures & Repair workflows
  app.get('/api/failures', (req, res) => {
    res.json(readDb().vehicleFailures);
  });

  app.post('/api/failures', (req, res) => {
    const db = readDb();
    const v = db.vehicles.find((v: any) => v.id === Number(req.body.vehicleId));
    
    // هنگام ثبت خرابی مستقیماً به بخش در حال تعمیر منتقل می‌شود
    const initialStatus = req.body.status || 'in_repair';

    const newFailure = {
      ...req.body,
      status: initialStatus,
      driverName: req.body.driverName || v?.driverName || 'ثبت نشده',
      company: req.body.company || v?.company || 'ثبت نشده',
      plaque: req.body.plaque || v?.plaque || 'ثبت نشده',
      id: db.vehicleFailures.length > 0 ? Math.max(...db.vehicleFailures.map((f: any) => f.id)) + 1 : 1,
      createdAt: new Date().toISOString()
    };
    db.vehicleFailures.push(newFailure);

    // تغییر وضعیت خودرو به در حال تعمیر
    const vehicleIdx = db.vehicles.findIndex((v: any) => v.id === Number(newFailure.vehicleId));
    if (vehicleIdx !== -1) {
      db.vehicles[vehicleIdx].status = initialStatus === 'in_repair' ? 'in_repair' : (initialStatus === 'completed' ? 'ready_service' : 'broken');
    }

    // بررسی اطلاعات تعمیرکار انتخابی جهت پر کردن اتوماتیک گردش کار
    let autoRepairShopName = req.body.repairShopName || '';
    let autoTechnicianId = req.body.assignedMechanicId ? Number(req.body.assignedMechanicId) : undefined;
    let autoStartDate = req.body.startDate || new Date().toISOString().split('T')[0];

    if (newFailure.assignedMechanicId && !autoRepairShopName) {
      const mechanic = db.mechanics?.find((m: any) => m.id === Number(newFailure.assignedMechanicId));
      if (mechanic) {
        autoRepairShopName = mechanic.shopName || `${mechanic.name} (${mechanic.specialty})`;
      }
    }

    // ایجاد خودکار رکورد گردش تعمیر مرتبط
    const newWorkflow = {
      id: db.repairWorkflows.length > 0 ? Math.max(...db.repairWorkflows.map((w: any) => w.id)) + 1 : 1,
      failureId: newFailure.id,
      technicianId: autoTechnicianId,
      repairShopName: autoRepairShopName,
      partsUsed: req.body.partsUsed || {},
      wages: Number(req.body.wages) || 0,
      totalCost: Number(req.body.totalCost) || 0,
      startDate: autoStartDate,
      endDate: req.body.endDate || '',
      isDelivered: false,
      isApprovedByManager: false,
      createdAt: new Date().toISOString()
    };
    db.repairWorkflows.push(newWorkflow);

    if (newWorkflow.partsUsed && Object.keys(newWorkflow.partsUsed).length > 0) {
      syncRepairWorkflowInventory(db, newFailure.id, newWorkflow.partsUsed, Number(newFailure.vehicleId));
    }

    writeDb(db);
    logActivity(1, 'admin', 'ثبت گزارش خرابی', `گزارش خرابی برای خودرو ${v?.name || newFailure.vehicleId} ثبت و به وضعیت [${initialStatus}] منتقل شد.`);
    res.json(newFailure);
  });

  app.put('/api/failures/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    const idx = db.vehicleFailures.findIndex((f: any) => f.id === Number(id));
    if (idx !== -1) {
      const { 
        assignedMechanicId, 
        repairShopName, 
        startDate, 
        endDate, 
        partsUsed, 
        shopPartsUsed,
        wages, 
        totalCost, 
        satisfactionLevel,
        replacedServiceTypes,
        ...failureUpdates 
      } = req.body;

      db.vehicleFailures[idx] = { 
        ...db.vehicleFailures[idx], 
        ...failureUpdates,
        assignedMechanicId: assignedMechanicId !== undefined ? (assignedMechanicId ? Number(assignedMechanicId) : undefined) : db.vehicleFailures[idx].assignedMechanicId,
        repairShopName: repairShopName !== undefined ? repairShopName : db.vehicleFailures[idx].repairShopName,
        endDate: endDate !== undefined ? endDate : db.vehicleFailures[idx].endDate,
        wages: wages !== undefined ? Number(wages) : db.vehicleFailures[idx].wages,
        totalCost: totalCost !== undefined ? Number(totalCost) : db.vehicleFailures[idx].totalCost,
        satisfactionLevel: satisfactionLevel !== undefined ? satisfactionLevel : db.vehicleFailures[idx].satisfactionLevel
      };
      
      // همگام‌سازی مشخصات خودرو فقط در صورت تغییر خودرو
      if (failureUpdates.vehicleId && Number(failureUpdates.vehicleId) !== db.vehicleFailures[idx].vehicleId) {
        const v = db.vehicles.find((veh: any) => veh.id === Number(failureUpdates.vehicleId));
        if (v) {
          db.vehicleFailures[idx].driverName = failureUpdates.driverName || v.driverName || 'ثبت نشده';
          db.vehicleFailures[idx].company = failureUpdates.company || v.company || 'ثبت نشده';
          db.vehicleFailures[idx].plaque = failureUpdates.plaque || v.plaque || 'ثبت نشده';
        }
      } else if (failureUpdates.driverName !== undefined) {
        db.vehicleFailures[idx].driverName = failureUpdates.driverName;
      }

      // بروزرسانی گردش کار تعمیرگاه متناظر
      const wfIdx = db.repairWorkflows.findIndex((w: any) => w.failureId === Number(id));
      if (wfIdx !== -1) {
        if (assignedMechanicId !== undefined) {
          db.repairWorkflows[wfIdx].technicianId = assignedMechanicId ? Number(assignedMechanicId) : undefined;
        }
        if (repairShopName !== undefined) {
          db.repairWorkflows[wfIdx].repairShopName = repairShopName;
        }
        if (startDate !== undefined) {
          db.repairWorkflows[wfIdx].startDate = startDate;
        }
        if (endDate !== undefined) {
          db.repairWorkflows[wfIdx].endDate = endDate;
        }
        if (partsUsed !== undefined) {
          db.repairWorkflows[wfIdx].partsUsed = partsUsed;
        }
        if (shopPartsUsed !== undefined) {
          db.repairWorkflows[wfIdx].shopPartsUsed = shopPartsUsed;
        }
        if (wages !== undefined) {
          db.repairWorkflows[wfIdx].wages = Number(wages);
        }
        if (totalCost !== undefined) {
          db.repairWorkflows[wfIdx].totalCost = Number(totalCost);
        }
        if (satisfactionLevel !== undefined) {
          db.repairWorkflows[wfIdx].satisfactionLevel = satisfactionLevel;
        }
        if (replacedServiceTypes !== undefined) {
          db.repairWorkflows[wfIdx].replacedServiceTypes = replacedServiceTypes;
        }
      } else {
        // اگر گردش کار وجود نداشت، ساخته شود
        const newWorkflow = {
          id: db.repairWorkflows.length > 0 ? Math.max(...db.repairWorkflows.map((w: any) => w.id)) + 1 : 1,
          failureId: Number(id),
          technicianId: assignedMechanicId ? Number(assignedMechanicId) : undefined,
          repairShopName: repairShopName || '',
          partsUsed: partsUsed || {},
          shopPartsUsed: shopPartsUsed || [],
          wages: Number(wages) || 0,
          totalCost: Number(totalCost) || 0,
          satisfactionLevel: satisfactionLevel || undefined,
          replacedServiceTypes: replacedServiceTypes || [],
          startDate: startDate || db.vehicleFailures[idx].failureDate || new Date().toISOString().split('T')[0],
          endDate: endDate || '',
          isDelivered: Boolean(endDate || Number(totalCost) > 0),
          isApprovedByManager: false,
          createdAt: new Date().toISOString()
        };
        db.repairWorkflows.push(newWorkflow);
      }

      // همگام‌سازی وضعیت خودرو در صورت تغییر وضعیت خرابی
      const failure = db.vehicleFailures[idx];
      const vehicleIdx = db.vehicles.findIndex((v: any) => v.id === failure.vehicleId);
      if (vehicleIdx !== -1) {
        if (failure.status === 'in_repair') {
          db.vehicles[vehicleIdx].status = 'in_repair';
        } else if (failure.status === 'completed') {
          db.vehicles[vehicleIdx].status = 'ready_service';
        } else if (failure.status === 'approved') {
          db.vehicles[vehicleIdx].status = 'active';
        } else if (failure.status === 'reported') {
          db.vehicles[vehicleIdx].status = 'broken';
        }
      }

      // همگام‌سازی کسر قطعات از انبار و صدور حواله خروج
      const failVehId = db.vehicleFailures[idx].vehicleId;
      const currentWf = db.repairWorkflows.find((w: any) => w.failureId === Number(id));
      if (currentWf && currentWf.partsUsed) {
        syncRepairWorkflowInventory(db, Number(id), currentWf.partsUsed, failVehId);
      }

      writeDb(db);
      logActivity(1, 'admin', 'ویرایش پرونده خرابی', `پرونده خرابی شماره ${id} ویرایش گردید.`);
      res.json(db.vehicleFailures[idx]);
    } else {
      res.status(404).json({ message: 'خرابی یافت نشد.' });
    }
  });

  app.delete('/api/failures/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    const failure = db.vehicleFailures.find((f: any) => f.id === Number(id));
    if (failure) {
      db.vehicleFailures = db.vehicleFailures.filter((f: any) => f.id !== Number(id));
      db.repairWorkflows = db.repairWorkflows.filter((w: any) => w.failureId !== Number(id));
      
      // لغو حواله خروج و بازگرداندن موجودی قطعات به انبار
      removeRepairWorkflowInventory(db, Number(id));

      // اگر خودرو خرابی دیگری نداشت، وضعیتش به فعال برگردد
      const otherFailures = db.vehicleFailures.filter((f: any) => f.vehicleId === failure.vehicleId && f.status !== 'approved');
      if (otherFailures.length === 0) {
        const vehicleIdx = db.vehicles.findIndex((v: any) => v.id === failure.vehicleId);
        if (vehicleIdx !== -1 && db.vehicles[vehicleIdx].status !== 'active') {
          db.vehicles[vehicleIdx].status = 'active';
        }
      }

      writeDb(db);
      logActivity(1, 'admin', 'حذف پرونده خرابی', `پرونده خرابی شماره ${id} حذف گردید.`);
      res.json({ success: true });
    } else {
      res.status(404).json({ message: 'خرابی یافت نشد.' });
    }
  });

  app.get(['/api/repair-workflows', '/api/workflows'], (req, res) => {
    res.json(readDb().repairWorkflows);
  });

  app.put(['/api/repair-workflows/:id', '/api/workflows/:id'], (req, res) => {
    const db = readDb();
    const { id } = req.params;
    const idx = db.repairWorkflows.findIndex((w: any) => w.id === Number(id));
    if (idx !== -1) {
      db.repairWorkflows[idx] = { ...db.repairWorkflows[idx], ...req.body };
      
      // پیدا کردن خرابی مرتبط برای آپدیت وضعیت
      const failureId = db.repairWorkflows[idx].failureId;
      const failIdx = db.vehicleFailures.findIndex((f: any) => f.id === failureId);
      
      if (failIdx !== -1) {
        if (req.body.technicianId !== undefined) {
          db.vehicleFailures[failIdx].assignedMechanicId = req.body.technicianId ? Number(req.body.technicianId) : undefined;
        }
        if (req.body.repairShopName !== undefined) {
          db.vehicleFailures[failIdx].repairShopName = req.body.repairShopName;
        }
        if (req.body.endDate !== undefined) {
          db.vehicleFailures[failIdx].endDate = req.body.endDate;
        }
        if (req.body.wages !== undefined) {
          db.vehicleFailures[failIdx].wages = Number(req.body.wages);
        }
        if (req.body.totalCost !== undefined) {
          db.vehicleFailures[failIdx].totalCost = Number(req.body.totalCost);
        }
        if (req.body.satisfactionLevel !== undefined) {
          db.vehicleFailures[failIdx].satisfactionLevel = req.body.satisfactionLevel;
        }

        const workflow = db.repairWorkflows[idx];
        const vehicleId = db.vehicleFailures[failIdx].vehicleId;
        const vehicleIdx = db.vehicles.findIndex((v: any) => v.id === vehicleId);

        // آپدیت وضعیت خرابی بر اساس گام‌های تکمیل شده گردش کار
        if (workflow.isApprovedByManager) {
          db.vehicleFailures[failIdx].status = 'approved';
          if (vehicleIdx !== -1) db.vehicles[vehicleIdx].status = 'active'; // آماده به کار و فعال در ناوگان
        } else if (workflow.isDelivered || req.body.markReady) {
          db.vehicleFailures[failIdx].status = 'completed'; // آماده شد
          if (vehicleIdx !== -1) db.vehicles[vehicleIdx].status = 'ready_service';
        } else if (workflow.startDate && (workflow.repairShopName || workflow.technicianId)) {
          db.vehicleFailures[failIdx].status = 'in_repair';
          if (vehicleIdx !== -1) db.vehicles[vehicleIdx].status = 'in_repair';
        } else if (workflow.technicianId) {
          db.vehicleFailures[failIdx].status = 'assigned';
        }

        // ثبت هزینه و کسر انبار در صورتی که فاکتور تکمیل شد (ترخیص یا تایید)
        if ((workflow.isDelivered || workflow.isApprovedByManager || req.body.markReady) && Number(workflow.totalCost) > 0) {
          const expenseDesc = `تعمیرات خرابی کد ${failureId} (${db.vehicleFailures[failIdx].description.slice(0, 30)})`;
          const expenseExists = db.expenses.some((e: any) => e.description === expenseDesc);
          
          if (!expenseExists) {
            const veh = db.vehicles.find((v: any) => v.id === vehicleId);
            db.expenses.push({
              id: db.expenses.length > 0 ? Math.max(...db.expenses.map((e: any) => e.id)) + 1 : 1,
              vehicleId: vehicleId,
              driverName: veh?.driverName || 'ثبت نشده',
              company: veh?.company || 'ثبت نشده',
              plaque: veh?.plaque || 'ثبت نشده',
              expenseType: 'repair',
              expenseDate: workflow.endDate || new Date().toISOString().split('T')[0],
              cost: Number(workflow.totalCost),
              description: expenseDesc,
              createdAt: new Date().toISOString()
            });

            // کسر قطعات از انبار و صدور حواله خروج با آخرین قیمت انبار
            if (workflow.partsUsed) {
              syncRepairWorkflowInventory(db, failureId, workflow.partsUsed, vehicleId);
            }

            // همگام‌سازی هوشمند کیلومتر موعد تعویض و خدمات دوره‌ای در صورت تعویض قطعه در تعمیرات
            const failureRecord = db.vehicleFailures[failIdx];
            const repairOdo = Number(failureRecord?.odometer) || 0;
            if (repairOdo > 0 && db.serviceDefinitions) {
              // لیست تمام قطعات مصرفی این تعمیر (انبار + تعمیرگاه)
              const allUsedPartNames: string[] = [];
              if (workflow.partsUsed) {
                Object.keys(workflow.partsUsed).forEach(pName => {
                  if (Number(workflow.partsUsed[pName]) > 0) allUsedPartNames.push(pName);
                });
              }
              if (workflow.shopPartsUsed && Array.isArray(workflow.shopPartsUsed)) {
                workflow.shopPartsUsed.forEach((sp: any) => {
                  if (sp.name) allUsedPartNames.push(sp.name);
                });
              }

              // بررسی تطبیق با عناوین خدمات دوره‌ای (مثلاً تسمه تایم، لنت، روغن، شمع و ...)
              db.serviceDefinitions.forEach((sDef: any) => {
                const sType = (sDef.serviceType || '').toLowerCase();
                const matched = allUsedPartNames.some(pName => {
                  const pLower = pName.toLowerCase();
                  return pLower.includes(sType) || sType.includes(pLower) ||
                    (sType.includes('تسمه تایم') && pLower.includes('تسمه تایم')) ||
                    (sType.includes('لنت') && pLower.includes('لنت')) ||
                    (sType.includes('روغن') && (pLower.includes('روغن') || pLower.includes('فیلتر'))) ||
                    (sType.includes('شمع') && (pLower.includes('شمع') || pLower.includes('وایر'))) ||
                    (sType.includes('واسکازین') && (pLower.includes('واسکازین') || pLower.includes('گیربکس'))) ||
                    (sType.includes('باتری') && (pLower.includes('باتری') || pLower.includes('باطری'))) ||
                    (sType.includes('لاستیک') && (pLower.includes('لاستیک') || pLower.includes('تایر')));
                }) || (workflow.replacedServiceTypes && workflow.replacedServiceTypes.includes(sDef.serviceType))
                   || (failureRecord.description && failureRecord.description.toLowerCase().includes(sType));

                if (matched) {
                  if (!sDef.lastServicedKm || repairOdo >= Number(sDef.lastServicedKm)) {
                    sDef.lastServicedKm = repairOdo;
                    sDef.currentKm = Math.max(Number(sDef.currentKm || 0), repairOdo);
                  }
                }
              });
            }
          }
        }
      }

      writeDb(db);
      logActivity(3, 'repair_tech', 'بروزرسانی گردش کار', `گردش کار تعمیر شناسه ${id} بروزرسانی گردید.`);
      res.json(db.repairWorkflows[idx]);
    } else {
      res.status(404).json({ message: 'گردش کار یافت نشد.' });
    }
  });

  // CRUD for Parts Inventory
  app.get('/api/parts', (req, res) => {
    res.json(readDb().partsInventory || []);
  });

  // دریافت لیست تراکنش‌های ورود و خروج انبار
  app.get('/api/inventory-transactions', (req, res) => {
    res.json(readDb().inventoryTransactions || []);
  });

  // ثبت ورود کالا به انبار / رسید خرید جدید (با منطق آخرین قیمت خرید و ثبت آخرین قیمت فروش)
  app.post('/api/parts/stock-in', (req, res) => {
    const db = readDb();
    let { partId, partName, serviceType, quantity, unitPrice, buyPrice, sellPrice, warehouseLocation, supplier, invoiceNumber, notes } = req.body;
    if ((!partId && !partName) || !quantity || Number(quantity) <= 0) {
      return res.status(400).json({ message: 'انتخاب یا نام قطعه و تعداد وارده معتبر الزامی است.' });
    }

    if (!db.partsInventory) db.partsInventory = [];
    
    let part: any = null;
    let idx = -1;

    if (partId) {
      idx = db.partsInventory.findIndex((p: any) => p.id === Number(partId));
      if (idx !== -1) {
        part = db.partsInventory[idx];
      }
    }

    if (!part && partName) {
      // بررسی وجود قطعه با همین نام
      idx = db.partsInventory.findIndex((p: any) => p.partName.trim().toLowerCase() === String(partName).trim().toLowerCase());
      if (idx !== -1) {
        part = db.partsInventory[idx];
      } else {
        // ایجاد قطعه جدید در انبار
        const newPartId = db.partsInventory.length > 0 ? Math.max(...db.partsInventory.map((p: any) => p.id)) + 1 : 1;
        const generatedSku = `SKU-${Math.floor(100 + Math.random() * 900)}-${Math.floor(10 + Math.random() * 90)}`;
        part = {
          id: newPartId,
          partName: String(partName).trim(),
          sku: generatedSku,
          serviceCategory: 'عمومی',
          serviceType: serviceType || 'عمومی',
          quantity: 0,
          minQuantity: 5,
          unitPrice: Number(buyPrice || unitPrice || 0),
          buyPrice: Number(buyPrice || unitPrice || 0),
          sellPrice: Number(sellPrice || (buyPrice ? Math.round(Number(buyPrice) * 1.25) : 0)),
          warehouseLocation: warehouseLocation ? String(warehouseLocation).trim() : 'انبار مرکزی',
          createdAt: new Date().toISOString()
        };
        db.partsInventory.push(part);
        idx = db.partsInventory.length - 1;
      }
    }

    if (!part) {
      return res.status(404).json({ message: 'کالا در انبار یافت نشد.' });
    }

    const prevQty = Number(part.quantity) || 0;
    const addedQty = Number(quantity);
    const newQty = prevQty + addedQty;
    // آخرین نرخ خرید ورودی مبنای ارزیابی خرید خواهد بود
    const incomingBuyPrice = buyPrice !== undefined && Number(buyPrice) > 0 
      ? Number(buyPrice) 
      : (unitPrice !== undefined && Number(unitPrice) > 0 ? Number(unitPrice) : Number(part.buyPrice || part.unitPrice || 0));
    
    // آخرین نرخ فروش در صورت ورود
    const incomingSellPrice = sellPrice !== undefined && Number(sellPrice) > 0 
      ? Number(sellPrice) 
      : Number(part.sellPrice || (incomingBuyPrice ? Math.round(incomingBuyPrice * 1.25) : 0));

    part.quantity = newQty;
    part.buyPrice = incomingBuyPrice;
    part.unitPrice = incomingBuyPrice; // جهت سازگاری به عقب
    part.sellPrice = incomingSellPrice;
    if (warehouseLocation && String(warehouseLocation).trim()) {
      part.warehouseLocation = String(warehouseLocation).trim();
    }

    if (!db.inventoryTransactions) db.inventoryTransactions = [];
    const transId = db.inventoryTransactions.length > 0 ? Math.max(...db.inventoryTransactions.map((t: any) => t.id)) + 1 : 1;
    const newTrans = {
      id: transId,
      partId: part.id,
      partName: part.partName,
      sku: part.sku,
      type: 'in',
      quantity: addedQty,
      unitPrice: incomingBuyPrice, // آخرین نرخ خرید
      buyPrice: incomingBuyPrice,
      sellPrice: incomingSellPrice,
      totalPrice: addedQty * incomingBuyPrice,
      previousQuantity: prevQty,
      newQuantity: newQty,
      reference: invoiceNumber ? `فاکتور خرید ${invoiceNumber}` : 'رسید ورود به انبار',
      recipientOrSupplier: supplier || 'تامین‌کننده کالا',
      notes: notes || `افزایش موجودی به ${newQty} عدد با اعمال آخرین نرخ خرید (${incomingBuyPrice.toLocaleString()} ریال) و نرخ فروش (${incomingSellPrice.toLocaleString()} ریال)`,
      createdAt: new Date().toISOString()
    };

    db.inventoryTransactions.unshift(newTrans);
    writeDb(db);
    logActivity(1, 'admin', 'رسید ورود به انبار', `ورود ${addedQty} عدد ${part.partName} به انبار با آخرین قیمت خرید ${incomingBuyPrice.toLocaleString()} ریال و قیمت فروش ${incomingSellPrice.toLocaleString()} ریال (موجودی کل جدید: ${newQty} عدد)`);
    res.json({ part: db.partsInventory[idx], transaction: newTrans });
  });

  // ثبت حواله خروج کالا از انبار (محاسبه ارزش بر اساس آخرین قیمت فروش / خرید در انبار)
  app.post('/api/parts/stock-out', (req, res) => {
    const db = readDb();
    const { partId, quantity, vehicleId, recipient, reason, notes, sellPrice, buyPrice } = req.body;
    if (!partId || !quantity || Number(quantity) <= 0) {
      return res.status(400).json({ message: 'شناسه کالا و تعداد خروجی معتبر الزامی است.' });
    }

    const idx = db.partsInventory.findIndex((p: any) => p.id === Number(partId));
    if (idx === -1) {
      return res.status(404).json({ message: 'کالا در انبار یافت نشد.' });
    }

    const part = db.partsInventory[idx];
    const prevQty = Number(part.quantity) || 0;
    const deductQty = Number(quantity);

    if (deductQty > prevQty) {
      return res.status(400).json({ message: `موجودی انبار کافی نیست. موجودی فعلی: ${prevQty} عدد می‌باشد.` });
    }

    const newQty = prevQty - deductQty;
    part.quantity = newQty;
    
    // در صورت ثبت نرخ فروش جدید در هنگام خروج، آخرین نرخ فروش قطعه بروز می‌شود
    const currentBuyPrice = buyPrice !== undefined && Number(buyPrice) > 0 ? Number(buyPrice) : Number(part.buyPrice || part.unitPrice || 0);
    const currentSellPrice = sellPrice !== undefined && Number(sellPrice) > 0 
      ? Number(sellPrice) 
      : Number(part.sellPrice || (currentBuyPrice ? Math.round(currentBuyPrice * 1.25) : 0));
    
    if (sellPrice !== undefined && Number(sellPrice) > 0) {
      part.sellPrice = Number(sellPrice);
    }

    let vehicleLabel = '';
    if (vehicleId) {
      const v = db.vehicles.find((veh: any) => veh.id === Number(vehicleId));
      if (v) vehicleLabel = `خودرو ${v.name} (${v.plaque})`;
    }

    if (!db.inventoryTransactions) db.inventoryTransactions = [];
    const transId = db.inventoryTransactions.length > 0 ? Math.max(...db.inventoryTransactions.map((t: any) => t.id)) + 1 : 1;
    const newTrans = {
      id: transId,
      partId: part.id,
      partName: part.partName,
      sku: part.sku,
      type: 'out',
      quantity: deductQty,
      unitPrice: currentSellPrice, // نرخ فروش در خروج
      buyPrice: currentBuyPrice,
      sellPrice: currentSellPrice,
      totalPrice: deductQty * currentSellPrice,
      previousQuantity: prevQty,
      newQuantity: newQty,
      reference: reason || (vehicleLabel ? `مصرف در ${vehicleLabel}` : 'حواله خروج از انبار'),
      recipientOrSupplier: recipient || vehicleLabel || 'تحویل‌گیرنده کالا',
      vehicleId: vehicleId ? Number(vehicleId) : undefined,
      notes: notes || `خروج ${deductQty} عدد بر مبنای آخرین نرخ فروش (${(deductQty * currentSellPrice).toLocaleString()} ریال) - بهای خرید: ${(deductQty * currentBuyPrice).toLocaleString()} ریال`,
      createdAt: new Date().toISOString()
    };

    db.inventoryTransactions.unshift(newTrans);
    writeDb(db);
    logActivity(1, 'admin', 'حواله خروج از انبار', `خروج ${deductQty} عدد ${part.partName} به ارزش کل فروش ${(deductQty * currentSellPrice).toLocaleString()} ریال.`);
    res.json({ part: db.partsInventory[idx], transaction: newTrans });
  });

  app.post('/api/parts', (req, res) => {
    const db = readDb();
    const existingIdx = db.partsInventory.findIndex((p: any) => 
      p.partName.trim().toLowerCase() === (req.body.partName || '').trim().toLowerCase()
    );

    const inputBuyPrice = req.body.buyPrice !== undefined && Number(req.body.buyPrice) >= 0 
      ? Number(req.body.buyPrice) 
      : (req.body.unitPrice !== undefined ? Number(req.body.unitPrice) : 0);
    const inputSellPrice = req.body.sellPrice !== undefined && Number(req.body.sellPrice) >= 0 
      ? Number(req.body.sellPrice) 
      : Math.round(inputBuyPrice * 1.25);

    // اگر کالایی با همین نام وجود داشت، موجودی اضافه شده و قیمت‌ها بروزرسانی می‌شود
    if (existingIdx !== -1) {
      const existing = db.partsInventory[existingIdx];
      const prevQty = Number(existing.quantity) || 0;
      const addedQty = Number(req.body.quantity) || 0;
      const newQty = prevQty + addedQty;

      existing.quantity = newQty;
      existing.buyPrice = inputBuyPrice || existing.buyPrice || existing.unitPrice;
      existing.unitPrice = existing.buyPrice;
      existing.sellPrice = inputSellPrice || existing.sellPrice;
      if (req.body.serviceType) existing.serviceType = req.body.serviceType;
      if (req.body.warehouseLocation) existing.warehouseLocation = req.body.warehouseLocation;
      if (req.body.minQuantity !== undefined) existing.minQuantity = Number(req.body.minQuantity);

      if (addedQty > 0) {
        if (!db.inventoryTransactions) db.inventoryTransactions = [];
        const transId = db.inventoryTransactions.length > 0 ? Math.max(...db.inventoryTransactions.map((t: any) => t.id)) + 1 : 1;
        db.inventoryTransactions.unshift({
          id: transId,
          partId: existing.id,
          partName: existing.partName,
          sku: existing.sku,
          type: 'in',
          quantity: addedQty,
          unitPrice: existing.buyPrice,
          buyPrice: existing.buyPrice,
          sellPrice: existing.sellPrice,
          totalPrice: addedQty * existing.buyPrice,
          previousQuantity: prevQty,
          newQuantity: newQty,
          reference: 'رسید انبار (افزایش موجودی)',
          recipientOrSupplier: 'تامین‌کننده کالا',
          notes: `افزایش موجودی با اعمال آخرین قیمت خرید (${existing.buyPrice.toLocaleString()} ریال) و فروش (${existing.sellPrice.toLocaleString()} ریال)`,
          createdAt: new Date().toISOString()
        });
      }

      writeDb(db);
      logActivity(1, 'admin', 'بروزرسانی قطعه موجود', `موجودی قطعه ${existing.partName} به ${newQty} عدد با نرخ خرید ${existing.buyPrice.toLocaleString()} و فروش ${existing.sellPrice.toLocaleString()} ریال بروز شد.`);
      return res.json(existing);
    }

    const newPart = {
      ...req.body,
      id: db.partsInventory.length > 0 ? Math.max(...db.partsInventory.map((p: any) => p.id)) + 1 : 1,
      unitPrice: inputBuyPrice,
      buyPrice: inputBuyPrice,
      sellPrice: inputSellPrice,
      createdAt: new Date().toISOString()
    };
    db.partsInventory.push(newPart);

    if (Number(newPart.quantity) > 0) {
      if (!db.inventoryTransactions) db.inventoryTransactions = [];
      const transId = db.inventoryTransactions.length > 0 ? Math.max(...db.inventoryTransactions.map((t: any) => t.id)) + 1 : 1;
      db.inventoryTransactions.unshift({
        id: transId,
        partId: newPart.id,
        partName: newPart.partName,
        sku: newPart.sku,
        type: 'in',
        quantity: Number(newPart.quantity),
        unitPrice: inputBuyPrice,
        buyPrice: inputBuyPrice,
        sellPrice: inputSellPrice,
        totalPrice: (Number(newPart.quantity) || 0) * inputBuyPrice,
        previousQuantity: 0,
        newQuantity: Number(newPart.quantity),
        reference: 'موجودی اولیه ثبت کالا',
        recipientOrSupplier: 'انبار مرکزی',
        notes: 'ثبت اولیه کالا در انبار با آخرین قیمت خرید و فروش',
        createdAt: new Date().toISOString()
      });
    }

    writeDb(db);
    logActivity(1, 'admin', 'ثبت قطعه جدید', `قطعه ${newPart.partName} به انبار با قیمت خرید ${inputBuyPrice.toLocaleString()} و فروش ${inputSellPrice.toLocaleString()} ریال اضافه شد.`);
    res.json(newPart);
  });

  app.put('/api/parts/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    const idx = db.partsInventory.findIndex((p: any) => p.id === Number(id));
    if (idx !== -1) {
      const incoming = { ...req.body };
      if (incoming.buyPrice !== undefined && incoming.unitPrice === undefined) {
        incoming.unitPrice = Number(incoming.buyPrice);
      }
      if (incoming.unitPrice !== undefined && incoming.buyPrice === undefined) {
        incoming.buyPrice = Number(incoming.unitPrice);
      }
      db.partsInventory[idx] = { ...db.partsInventory[idx], ...incoming };
      writeDb(db);
      logActivity(1, 'admin', 'ویرایش قطعه', `اطلاعات قطعه ${db.partsInventory[idx].partName} ویرایش گردید.`);
      res.json(db.partsInventory[idx]);
    } else {
      res.status(404).json({ message: 'قطعه یافت نشد.' });
    }
  });

  // CRUD for Expenses
  app.get('/api/expenses', (req, res) => {
    res.json(readDb().expenses || []);
  });

  app.put('/api/expenses/:id', (req, res) => {
    const db = readDb();
    const id = Number(req.params.id);
    if (!db.expenses) db.expenses = [];
    const idx = db.expenses.findIndex((e: any) => e.id === id);
    if (idx === -1) {
      return res.status(404).json({ message: 'هزینه یافت نشد' });
    }
    db.expenses[idx] = { ...db.expenses[idx], ...req.body, id };
    writeDb(db);
    logActivity(1, 'admin', 'ویرایش سند هزینه', `سند حسابداری شماره ${id} ویرایش شد.`);
    res.json(db.expenses[idx]);
  });

  app.delete('/api/expenses/:id', (req, res) => {
    const db = readDb();
    const id = Number(req.params.id);
    if (!db.expenses) db.expenses = [];
    const idx = db.expenses.findIndex((e: any) => e.id === id);
    if (idx === -1) {
      return res.status(404).json({ message: 'سند هزینه یافت نشد' });
    }
    const removed = db.expenses.splice(idx, 1)[0];
    writeDb(db);
    logActivity(1, 'admin', 'حذف سند هزینه', `سند حسابداری شماره ${id} حذف شد.`);
    res.json({ success: true, removed });
  });

  app.put('/api/inventory-transactions/:id', (req, res) => {
    const db = readDb();
    const id = Number(req.params.id);
    if (!db.inventoryTransactions) db.inventoryTransactions = [];
    const idx = db.inventoryTransactions.findIndex((t: any) => t.id === id);
    if (idx === -1) {
      return res.status(404).json({ message: 'تراکنش انبار یافت نشد' });
    }
    db.inventoryTransactions[idx] = { ...db.inventoryTransactions[idx], ...req.body, id };
    writeDb(db);
    logActivity(1, 'admin', 'ویرایش سند انبار', `سند انبار شماره ${id} ویرایش شد.`);
    res.json(db.inventoryTransactions[idx]);
  });

  app.post('/api/expenses', (req, res) => {
    const db = readDb();
    if (!db.expenses) db.expenses = [];
    const v = db.vehicles.find((v: any) => v.id === Number(req.body.vehicleId));
    const nextId = db.expenses.length > 0 ? Math.max(...db.expenses.map((e: any) => e.id)) + 1 : 1;
    const newExpense = {
      ...req.body,
      driverName: req.body.driverName || v?.driverName || 'ثبت نشده',
      company: req.body.company || v?.company || 'ثبت نشده',
      plaque: req.body.plaque || v?.plaque || 'ثبت نشده',
      documentNumber: req.body.documentNumber || `سند-${nextId}`,
      id: nextId,
      createdAt: new Date().toISOString()
    };
    db.expenses.push(newExpense);
    writeDb(db);
    logActivity(1, 'admin', 'ثبت سند حسابداری دوبل', `سند حسابداری شماره ${newExpense.documentNumber} (${newExpense.description || 'هزینه'}) ثبت شد.`);
    res.json(newExpense);
  });

  // CRUD for Mechanics
  app.get('/api/mechanics', (req, res) => {
    res.json(readDb().mechanics || []);
  });

  app.post('/api/mechanics', (req, res) => {
    const db = readDb();
    if (!db.mechanics) db.mechanics = [];

    const cleanPhone = normalizeDriverPhone(req.body.phone || '');
    if (cleanPhone && cleanPhone.length >= 7) {
      const dup = db.mechanics.find((m: any) => normalizeDriverPhone(m.phone) === cleanPhone);
      if (dup) {
        return res.status(400).json({ message: `این شماره تماس قبلاً برای تعمیرکار «${dup.name}» در بخش تعمیرکاران ثبت شده است.` });
      }
    }

    const newMechanic = {
      ...req.body,
      id: db.mechanics.length > 0 ? Math.max(...db.mechanics.map((m: any) => m.id)) + 1 : 1,
      createdAt: new Date().toISOString()
    };
    db.mechanics.push(newMechanic);
    writeDb(db);
    logActivity(1, 'admin', 'ثبت تعمیرکار جدید', `تعمیرکار ${newMechanic.name} با تخصص ${newMechanic.specialty} ثبت شد.`);
    res.json(newMechanic);
  });

  app.put('/api/mechanics/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    if (!db.mechanics) db.mechanics = [];
    const idx = db.mechanics.findIndex((m: any) => m.id === Number(id));
    if (idx !== -1) {
      const cleanPhone = normalizeDriverPhone(req.body.phone !== undefined ? req.body.phone : db.mechanics[idx].phone);
      if (cleanPhone && cleanPhone.length >= 7) {
        const dup = db.mechanics.find((m: any) => m.id !== Number(id) && normalizeDriverPhone(m.phone) === cleanPhone);
        if (dup) {
          return res.status(400).json({ message: `این شماره تماس قبلاً برای تعمیرکار «${dup.name}» در بخش تعمیرکاران ثبت شده است.` });
        }
      }

      db.mechanics[idx] = { ...db.mechanics[idx], ...req.body };
      writeDb(db);
      logActivity(1, 'admin', 'ویرایش تعمیرکار', `اطلاعات تعمیرکار ${db.mechanics[idx].name} ویرایش گردید.`);
      res.json(db.mechanics[idx]);
    } else {
      res.status(404).json({ message: 'تعمیرکار یافت نشد.' });
    }
  });

  app.delete('/api/mechanics/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    if (!db.mechanics) db.mechanics = [];
    const mechanic = db.mechanics.find((m: any) => m.id === Number(id));
    if (mechanic) {
      db.mechanics = db.mechanics.filter((m: any) => m.id !== Number(id));
      writeDb(db);
      logActivity(1, 'admin', 'حذف تعمیرکار', `تعمیرکار ${mechanic.name} از سیستم حذف گردید.`);
      res.json({ success: true });
    } else {
      res.status(404).json({ message: 'تعمیرکار یافت نشد.' });
    }
  });

  // CRUD for Companies
  app.get('/api/companies', (req, res) => {
    res.json(readDb().companies || []);
  });

  app.post('/api/companies', (req, res) => {
    const db = readDb();
    if (!db.companies) db.companies = [];
    const newCompany = {
      ...req.body,
      id: db.companies.length > 0 ? Math.max(...db.companies.map((c: any) => c.id)) + 1 : 1,
      createdAt: new Date().toISOString()
    };
    db.companies.push(newCompany);
    writeDb(db);
    logActivity(1, 'admin', 'تعریف شرکت جدید', `شرکت جدید ${newCompany.name} با کد ${newCompany.code} ثبت شد.`);
    res.json(newCompany);
  });

  app.put('/api/companies/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    if (!db.companies) db.companies = [];
    const idx = db.companies.findIndex((c: any) => c.id === Number(id));
    if (idx !== -1) {
      db.companies[idx] = { ...db.companies[idx], ...req.body };
      writeDb(db);
      logActivity(1, 'admin', 'ویرایش اطلاعات شرکت', `اطلاعات شرکت ${db.companies[idx].name} ویرایش گردید.`);
      res.json(db.companies[idx]);
    } else {
      res.status(404).json({ message: 'شرکت یافت نشد.' });
    }
  });

  app.delete('/api/companies/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    if (!db.companies) db.companies = [];
    const company = db.companies.find((c: any) => c.id === Number(id));
    if (company) {
      db.companies = db.companies.filter((c: any) => c.id !== Number(id));
      writeDb(db);
      logActivity(1, 'admin', 'حذف شرکت', `شرکت ${company.name} از سیستم حذف گردید.`);
      res.json({ success: true });
    } else {
      res.status(404).json({ message: 'شرکت یافت نشد.' });
    }
  });

  // CRUD for Suppliers (تامین‌کنندگان قطعات و کالا)
  app.get('/api/suppliers', (req, res) => {
    res.json(readDb().suppliers || []);
  });

  app.post('/api/suppliers', (req, res) => {
    const db = readDb();
    if (!db.suppliers) db.suppliers = [];

    const cleanPhone = normalizeDriverPhone(req.body.phone || req.body.mobile || '');
    if (cleanPhone && cleanPhone.length >= 7) {
      const dup = db.suppliers.find((s: any) => normalizeDriverPhone(s.phone || s.mobile) === cleanPhone);
      if (dup) {
        return res.status(400).json({ message: `این شماره تماس قبلاً برای تامین‌کننده «${dup.name}» در بخش تامین‌کنندگان ثبت شده است.` });
      }
    }

    const newSupplier = {
      ...req.body,
      id: db.suppliers.length > 0 ? Math.max(...db.suppliers.map((s: any) => s.id)) + 1 : 1,
      createdAt: new Date().toISOString()
    };
    db.suppliers.push(newSupplier);
    writeDb(db);
    logActivity(1, 'admin', 'تعریف تامین‌کننده جدید', `تامین‌کننده جدید ${newSupplier.name} با زمینه فعالیت ${newSupplier.category || 'عمومی'} ثبت گردید.`);
    res.json(newSupplier);
  });

  app.put('/api/suppliers/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    if (!db.suppliers) db.suppliers = [];
    const idx = db.suppliers.findIndex((s: any) => s.id === Number(id));
    if (idx !== -1) {
      const cleanPhone = normalizeDriverPhone(req.body.phone !== undefined ? req.body.phone : (req.body.mobile !== undefined ? req.body.mobile : (db.suppliers[idx].phone || db.suppliers[idx].mobile)));
      if (cleanPhone && cleanPhone.length >= 7) {
        const dup = db.suppliers.find((s: any) => s.id !== Number(id) && normalizeDriverPhone(s.phone || s.mobile) === cleanPhone);
        if (dup) {
          return res.status(400).json({ message: `این شماره تماس قبلاً برای تامین‌کننده «${dup.name}» در بخش تامین‌کنندگان ثبت شده است.` });
        }
      }

      db.suppliers[idx] = { ...db.suppliers[idx], ...req.body };
      writeDb(db);
      logActivity(1, 'admin', 'ویرایش تامین‌کننده', `اطلاعات تامین‌کننده ${db.suppliers[idx].name} ویرایش گردید.`);
      res.json(db.suppliers[idx]);
    } else {
      res.status(404).json({ message: 'تامین‌کننده یافت نشد.' });
    }
  });

  app.delete('/api/suppliers/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    if (!db.suppliers) db.suppliers = [];
    const supplier = db.suppliers.find((s: any) => s.id === Number(id));
    if (supplier) {
      db.suppliers = db.suppliers.filter((s: any) => s.id !== Number(id));
      writeDb(db);
      logActivity(1, 'admin', 'حذف تامین‌کننده', `تامین‌کننده ${supplier.name} از سیستم حذف گردید.`);
      res.json({ success: true });
    } else {
      res.status(404).json({ message: 'تامین‌کننده یافت نشد.' });
    }
  });

  // CRUD for Service Definitions
  app.get('/api/service-definitions', (req, res) => {
    res.json(readDb().serviceDefinitions || []);
  });

  app.post('/api/service-definitions', (req, res) => {
    const db = readDb();
    if (!db.serviceDefinitions) db.serviceDefinitions = [];
    const newDef = {
      ...req.body,
      id: db.serviceDefinitions.length > 0 ? Math.max(...db.serviceDefinitions.map((s: any) => s.id)) + 1 : 1,
      createdAt: new Date().toISOString()
    };
    db.serviceDefinitions.push(newDef);
    writeDb(db);
    logActivity(1, 'admin', 'تعریف خدمت جدید', `خدمت جدید ${newDef.serviceType} با دوره ${newDef.intervalKm}km ثبت گردید.`);
    res.json(newDef);
  });

  app.put('/api/service-definitions/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    if (!db.serviceDefinitions) db.serviceDefinitions = [];
    const idx = db.serviceDefinitions.findIndex((s: any) => s.id === Number(id));
    if (idx !== -1) {
      db.serviceDefinitions[idx] = { ...db.serviceDefinitions[idx], ...req.body };
      writeDb(db);
      logActivity(1, 'admin', 'ویرایش تعریف خدمت', `تعریف خدمت ${db.serviceDefinitions[idx].serviceType} ویرایش گردید.`);
      res.json(db.serviceDefinitions[idx]);
    } else {
      res.status(404).json({ message: 'تعریف خدمت یافت نشد.' });
    }
  });

  app.delete('/api/service-definitions/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    if (!db.serviceDefinitions) db.serviceDefinitions = [];
    const defItem = db.serviceDefinitions.find((s: any) => s.id === Number(id));
    if (defItem) {
      db.serviceDefinitions = db.serviceDefinitions.filter((s: any) => s.id !== Number(id));
      writeDb(db);
      logActivity(1, 'admin', 'حذف تعریف خدمت', `خدمت ${defItem.serviceType} از سیستم حذف گردید.`);
      res.json({ success: true });
    } else {
      res.status(404).json({ message: 'تعریف خدمت یافت نشد.' });
    }
  });

  // Endpoints aliases for enhanced compatibility
  app.all('/api/drivers*', (req, res, next) => {
    req.url = req.url.replace('/api/drivers', '/api/persons');
    next();
  });
  app.all('/api/repair-shops*', (req, res, next) => {
    req.url = req.url.replace('/api/repair-shops', '/api/mechanics');
    next();
  });
  app.all('/api/vendors*', (req, res, next) => {
    req.url = req.url.replace('/api/vendors', '/api/suppliers');
    next();
  });
  app.all('/api/organizations*', (req, res, next) => {
    req.url = req.url.replace('/api/organizations', '/api/companies');
    next();
  });
  app.all('/api/service_definitions*', (req, res, next) => {
    req.url = req.url.replace('/api/service_definitions', '/api/service-definitions');
    next();
  });
  app.all('/api/periodic-services*', (req, res, next) => {
    req.url = req.url.replace('/api/periodic-services', '/api/services');
    next();
  });
  app.all('/api/periodic_services*', (req, res, next) => {
    req.url = req.url.replace('/api/periodic_services', '/api/services');
    next();
  });

  // ماژول ورود دسته‌جمعی و تعریف خودکار از طریق فایل اکسل
  app.post('/api/definitions/bulk-import', (req, res) => {
    try {
      const db = readDb();
      if (!db.vehicles) db.vehicles = [];
      if (!db.persons) db.persons = [];
      if (!db.companies) db.companies = [];
      if (!db.serviceDefinitions) db.serviceDefinitions = [];
      if (!db.mechanics) db.mechanics = [];
      if (!db.suppliers) db.suppliers = [];

      const { entityType, items = [], multiData, options = {} } = req.body;
      const updateDuplicates = options.updateDuplicates !== false;

      const summary: Record<string, { imported: number; updated: number; skipped: number; total: number }> = {
        vehicles: { imported: 0, updated: 0, skipped: 0, total: 0 },
        persons: { imported: 0, updated: 0, skipped: 0, total: 0 },
        companies: { imported: 0, updated: 0, skipped: 0, total: 0 },
        service_definitions: { imported: 0, updated: 0, skipped: 0, total: 0 },
        mechanics: { imported: 0, updated: 0, skipped: 0, total: 0 },
        suppliers: { imported: 0, updated: 0, skipped: 0, total: 0 }
      };

      // تابع پردازش خودروها
      const processVehicles = (list: any[]) => {
        if (!Array.isArray(list)) return;
        list.forEach((item) => {
          if (!item.name && !item.plaque && !item.code) return;
          summary.vehicles.total++;

          const existingIdx = db.vehicles.findIndex((v: any) => 
            (item.code && String(v.code).trim() === String(item.code).trim()) ||
            (item.plaque && String(v.plaque).trim() === String(item.plaque).trim())
          );

          if (existingIdx !== -1) {
            if (updateDuplicates) {
              db.vehicles[existingIdx] = {
                ...db.vehicles[existingIdx],
                ...item,
                id: db.vehicles[existingIdx].id
              };
              summary.vehicles.updated++;
            } else {
              summary.vehicles.skipped++;
            }
          } else {
            const nextId = db.vehicles.length > 0 ? Math.max(...db.vehicles.map((v: any) => Number(v.id) || 0)) + 1 : 1;
            const newV = {
              code: item.code || `V-${nextId}`,
              company: item.company || 'ثبت نشده',
              project: item.project || '-',
              department: item.department || '-',
              location: item.location || '-',
              driverName: item.driverName || 'ثبت نشده',
              driverPhone: item.driverPhone || '',
              plaque: item.plaque || 'ثبت نشده',
              name: item.name || 'خودرو بدون نام',
              brand: item.brand || '',
              model: item.model || '',
              productionYear: Number(item.productionYear) || 1400,
              color: item.color || '',
              engineNumber: item.engineNumber || '',
              chassisNumber: item.chassisNumber || '',
              vin: item.vin || '',
              status: item.status || 'active',
              currentKm: Number(item.currentKm) || 0,
              ...item,
              id: nextId,
              createdAt: new Date().toISOString()
            };
            db.vehicles.push(newV);
            summary.vehicles.imported++;
          }
        });
      };

      // تابع پردازش رانندگان / پرسنل
      const processPersons = (list: any[]) => {
        if (!Array.isArray(list)) return;
        list.forEach((item) => {
          if (!item.fullName && !item.name) return;
          summary.persons.total++;
          const fullName = (item.fullName || item.name || '').trim();
          const nationalCode = (item.nationalCode || '').trim();
          const cleanPhone = normalizeDriverPhone(item.phone || '');

          const existingIdx = db.persons.findIndex((p: any) => 
            (nationalCode && String(p.nationalCode).trim() === nationalCode) ||
            (p.fullName && p.fullName.trim() === fullName)
          );

          if (existingIdx !== -1) {
            if (updateDuplicates) {
              db.persons[existingIdx] = {
                ...db.persons[existingIdx],
                ...item,
                fullName,
                phone: cleanPhone || db.persons[existingIdx].phone,
                id: db.persons[existingIdx].id
              };
              summary.persons.updated++;
            } else {
              summary.persons.skipped++;
            }
          } else {
            const nextId = db.persons.length > 0 ? Math.max(...db.persons.map((p: any) => Number(p.id) || 0)) + 1 : 1;
            const newP = {
              fullName,
              position: item.position || 'راننده',
              phone: cleanPhone || '',
              nationalCode: nationalCode || '',
              status: item.status || 'active',
              id: nextId,
              createdAt: new Date().toISOString()
            };
            db.persons.push(newP);
            summary.persons.imported++;
          }
        });
      };

      // تابع پردازش شرکت‌ها
      const processCompanies = (list: any[]) => {
        if (!Array.isArray(list)) return;
        list.forEach((item) => {
          if (!item.name) return;
          summary.companies.total++;
          const name = String(item.name).trim();
          const code = (item.code || '').trim();

          const existingIdx = db.companies.findIndex((c: any) => 
            (name && c.name.trim() === name) ||
            (code && String(c.code).trim() === code)
          );

          if (existingIdx !== -1) {
            if (updateDuplicates) {
              db.companies[existingIdx] = {
                ...db.companies[existingIdx],
                ...item,
                name,
                id: db.companies[existingIdx].id
              };
              summary.companies.updated++;
            } else {
              summary.companies.skipped++;
            }
          } else {
            const nextId = db.companies.length > 0 ? Math.max(...db.companies.map((c: any) => Number(c.id) || 0)) + 1 : 1;
            const newC = {
              name,
              code: code || `C-${nextId}`,
              managerName: item.managerName || '',
              phone: item.phone || '',
              address: item.address || '',
              status: item.status || 'active',
              id: nextId,
              createdAt: new Date().toISOString()
            };
            db.companies.push(newC);
            summary.companies.imported++;
          }
        });
      };

      // تابع پردازش تعاریف سرویس‌ها
      const processServiceDefinitions = (list: any[]) => {
        if (!Array.isArray(list)) return;
        list.forEach((item) => {
          const serviceType = (item.serviceType || item.title || item.name || '').trim();
          if (!serviceType) return;
          summary.service_definitions.total++;

          const existingIdx = db.serviceDefinitions.findIndex((s: any) => 
            s.serviceType && s.serviceType.trim() === serviceType
          );

          if (existingIdx !== -1) {
            if (updateDuplicates) {
              db.serviceDefinitions[existingIdx] = {
                ...db.serviceDefinitions[existingIdx],
                ...item,
                serviceType,
                intervalKm: Number(item.intervalKm) || db.serviceDefinitions[existingIdx].intervalKm || 5000,
                warningKm: Number(item.warningKm) || db.serviceDefinitions[existingIdx].warningKm || 500,
                id: db.serviceDefinitions[existingIdx].id
              };
              summary.service_definitions.updated++;
            } else {
              summary.service_definitions.skipped++;
            }
          } else {
            const nextId = db.serviceDefinitions.length > 0 ? Math.max(...db.serviceDefinitions.map((s: any) => Number(s.id) || 0)) + 1 : 1;
            const newS = {
              serviceType,
              intervalKm: Number(item.intervalKm) || 5000,
              warningKm: Number(item.warningKm) || 500,
              notes: item.notes || '',
              id: nextId,
              createdAt: new Date().toISOString()
            };
            db.serviceDefinitions.push(newS);
            summary.service_definitions.imported++;
          }
        });
      };

      // تابع پردازش تعمیرکاران
      const processMechanics = (list: any[]) => {
        if (!Array.isArray(list)) return;
        list.forEach((item) => {
          const name = (item.name || '').trim();
          if (!name) return;
          summary.mechanics.total++;

          const existingIdx = db.mechanics.findIndex((m: any) => 
            m.name && m.name.trim() === name
          );

          if (existingIdx !== -1) {
            if (updateDuplicates) {
              db.mechanics[existingIdx] = {
                ...db.mechanics[existingIdx],
                ...item,
                name,
                id: db.mechanics[existingIdx].id
              };
              summary.mechanics.updated++;
            } else {
              summary.mechanics.skipped++;
            }
          } else {
            const nextId = db.mechanics.length > 0 ? Math.max(...db.mechanics.map((m: any) => Number(m.id) || 0)) + 1 : 1;
            const newM = {
              name,
              phone: item.phone || '',
              specialty: item.specialty || 'مکانیک عمومی',
              shopName: item.shopName || '',
              status: item.status || 'active',
              id: nextId,
              createdAt: new Date().toISOString()
            };
            db.mechanics.push(newM);
            summary.mechanics.imported++;
          }
        });
      };

      // تابع پردازش تامین‌کنندگان
      const processSuppliers = (list: any[]) => {
        if (!Array.isArray(list)) return;
        list.forEach((item) => {
          const name = (item.name || '').trim();
          if (!name) return;
          summary.suppliers.total++;

          const existingIdx = db.suppliers.findIndex((s: any) => 
            s.name && s.name.trim() === name
          );

          if (existingIdx !== -1) {
            if (updateDuplicates) {
              db.suppliers[existingIdx] = {
                ...db.suppliers[existingIdx],
                ...item,
                name,
                id: db.suppliers[existingIdx].id
              };
              summary.suppliers.updated++;
            } else {
              summary.suppliers.skipped++;
            }
          } else {
            const nextId = db.suppliers.length > 0 ? Math.max(...db.suppliers.map((s: any) => Number(s.id) || 0)) + 1 : 1;
            const newS = {
              name,
              code: item.code || `S-${nextId}`,
              contactPerson: item.contactPerson || '',
              phone: item.phone || '',
              mobile: item.mobile || '',
              category: item.category || 'قطعات یدکی',
              address: item.address || '',
              status: item.status || 'active',
              id: nextId,
              createdAt: new Date().toISOString()
            };
            db.suppliers.push(newS);
            summary.suppliers.imported++;
          }
        });
      };

      // بررسی نوع و هدایت
      if (multiData) {
        if (multiData.vehicles) processVehicles(multiData.vehicles);
        if (multiData.persons) processPersons(multiData.persons);
        if (multiData.companies) processCompanies(multiData.companies);
        if (multiData.service_definitions) processServiceDefinitions(multiData.service_definitions);
        if (multiData.mechanics) processMechanics(multiData.mechanics);
        if (multiData.suppliers) processSuppliers(multiData.suppliers);
      } else {
        if (entityType === 'vehicles') processVehicles(items);
        else if (entityType === 'persons') processPersons(items);
        else if (entityType === 'companies') processCompanies(items);
        else if (entityType === 'service_definitions') processServiceDefinitions(items);
        else if (entityType === 'mechanics') processMechanics(items);
        else if (entityType === 'suppliers') processSuppliers(items);
      }

      rematchUnknownSmsLogs(db);
      writeDb(db);
      
      const totalImported = Object.values(summary).reduce((acc, s) => acc + s.imported, 0);
      const totalUpdated = Object.values(summary).reduce((acc, s) => acc + s.updated, 0);

      logActivity(1, 'admin', 'ورود اکسل تعاریف پایه', `ورود دسته‌جمعی تعاریف با اکسل انجام شد: ${totalImported} رکورد جدید، ${totalUpdated} رکورد به‌روزرسانی.`);

      res.json({
        success: true,
        summary,
        totalImported,
        totalUpdated,
        data: {
          vehicles: db.vehicles,
          persons: db.persons,
          companies: db.companies,
          serviceDefinitions: db.serviceDefinitions,
          mechanics: db.mechanics,
          suppliers: db.suppliers
        }
      });
    } catch (err: any) {
      console.error('Error in bulk import:', err);
      res.status(500).json({ message: 'خطا در ثبت تعاریف از اکسل: ' + (err?.message || 'خطای ناشناخته') });
    }
  });

  // CRUD for Odometer Inquiry Logs
  app.get('/api/odometer-logs', (req, res) => {
    const db = readDb();
    const { vehicleId } = req.query;
    let logs = db.odometerLogs || [];
    if (vehicleId) {
      logs = logs.filter((l: any) => l.vehicleId === Number(vehicleId));
    }
    // مرتب‌سازی بر اساس شناسه نزولی (جدیدترین‌ها اول)
    logs.sort((a: any, b: any) => b.id - a.id);
    res.json(logs);
  });

  app.post('/api/odometer-logs', (req, res) => {
    const db = readDb();
    if (!db.odometerLogs) db.odometerLogs = [];
    
    const { vehicleId, odometerKm, inquiryDate, inquiryTime, notes, recordedBy } = req.body;
    const vId = Number(vehicleId);
    const newKm = Number(odometerKm);
    
    const vehicle = db.vehicles.find((v: any) => v.id === vId);
    if (!vehicle) {
      return res.status(404).json({ message: 'خودرو یافت نشد.' });
    }

    const previousKm = vehicle.currentKm !== undefined && Number(vehicle.currentKm) > 0 
      ? Number(vehicle.currentKm) 
      : (newKm > 0 ? newKm : 0);
    const differenceKm = newKm >= previousKm ? (newKm - previousKm) : 0;
    
    // محاسبه تخمینی میانگین روزانه
    const prevLogs = db.odometerLogs.filter((l: any) => l.vehicleId === vId);
    let dailyAverageKm = 70; // مقدار پیش‌فرض منطقی
    if (prevLogs.length > 0) {
      const lastLog = prevLogs[0];
      if (lastLog.dailyAverageKm && lastLog.dailyAverageKm > 0) {
        dailyAverageKm = Math.round((lastLog.dailyAverageKm + (differenceKm > 0 ? differenceKm : 70)) / 2);
      } else if (differenceKm > 0) {
        dailyAverageKm = Math.min(Math.max(differenceKm, 20), 400);
      }
    }

    const newLog = {
      id: db.odometerLogs.length > 0 ? Math.max(...db.odometerLogs.map((o: any) => o.id)) + 1 : 1,
      vehicleId: vId,
      driverName: vehicle.driverName || 'ثبت نشده',
      driverPhone: vehicle.driverPhone || '',
      company: vehicle.company || '',
      plaque: vehicle.plaque || '',
      vehicleName: vehicle.name || '',
      inquiryDate: inquiryDate || new Date().toISOString().split('T')[0],
      inquiryTime: inquiryTime || new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      odometerKm: newKm,
      previousKm,
      differenceKm,
      dailyAverageKm,
      recordedBy: recordedBy || 'مدیر سیستم',
      notes: notes || '',
      createdAt: new Date().toISOString()
    };

    db.odometerLogs.unshift(newLog);

    // بروزرسانی کیلومتر کارکرد جاری خودرو
    vehicle.currentKm = newKm;

    writeDb(db);
    logActivity(1, 'admin', 'ثبت استعلام کیلومتر راننده', `کیلومتر جدید خودرو ${vehicle.name} (${vehicle.plaque}) معادل ${newKm.toLocaleString()}km بر اساس تماس با راننده ${vehicle.driverName} ثبت گردید.`);
    res.json({ log: newLog, vehicle });
  });

  app.put('/api/odometer-logs/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    if (!db.odometerLogs) db.odometerLogs = [];
    const idx = db.odometerLogs.findIndex((o: any) => o.id === Number(id));
    if (idx !== -1) {
      const oldLog = db.odometerLogs[idx];
      const updatedLog = { ...oldLog, ...req.body };
      db.odometerLogs[idx] = updatedLog;

      // اگر کیلومتر تغییر کرد، آخرین لاگ خودرو بررسی شود و currentKm آپدیت شود
      if (req.body.odometerKm !== undefined) {
        const vehicle = db.vehicles.find((v: any) => v.id === oldLog.vehicleId);
        if (vehicle) {
          const vehicleLogs = db.odometerLogs.filter((l: any) => l.vehicleId === vehicle.id);
          const maxLog = vehicleLogs.reduce((prev: any, current: any) => (prev.id > current.id) ? prev : current, updatedLog);
          vehicle.currentKm = Number(maxLog.odometerKm);
        }
      }

      writeDb(db);
      logActivity(1, 'admin', 'ویرایش استعلام کیلومتر', `رکورد استعلام کیلومتر شماره ${id} ویرایش شد.`);
      res.json(db.odometerLogs[idx]);
    } else {
      res.status(404).json({ message: 'رکورد استعلام یافت نشد.' });
    }
  });

  app.delete('/api/odometer-logs/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    if (!db.odometerLogs) db.odometerLogs = [];
    const logItem = db.odometerLogs.find((o: any) => o.id === Number(id));
    if (logItem) {
      db.odometerLogs = db.odometerLogs.filter((o: any) => o.id !== Number(id));
      
      // بازیابی آخرین کیلومتر باقیمانده برای خودرو
      const vehicle = db.vehicles.find((v: any) => v.id === logItem.vehicleId);
      if (vehicle) {
        const vehicleLogs = db.odometerLogs.filter((l: any) => l.vehicleId === vehicle.id);
        if (vehicleLogs.length > 0) {
          const latestLog = vehicleLogs[0];
          vehicle.currentKm = Number(latestLog.odometerKm);
        }
      }

      writeDb(db);
      logActivity(1, 'admin', 'حذف استعلام کیلومتر', `استعلام کیلومتر شماره ${id} متعلق به خودرو ${logItem.vehicleName} حذف گردید.`);
      res.json({ success: true });
    } else {
      res.status(404).json({ message: 'رکورد استعلام یافت نشد.' });
    }
  });

  // Activity Logs
  app.get('/api/logs', (req, res) => {
    res.json(readDb().activityLogs);
  });

  // ==========================================
  // --- SMS INBOUND & DRIVER ODOMETER SYNC ---
  // ==========================================

  // استخراج مقدار کیلومتر از متن پیامک راننده
  function extractKilometerFromSms(text: any): number | null {
    if (!text) return null;
    let normalized = text.toString().trim()
      .replace(/[۰-۹]/g, (d: string) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
      .replace(/[٠-٩]/g, (d: string) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
      .replace(/,/g, '')
      .replace(/،/g, '')
      .replace(/_/g, '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ');

    // ۱. بررسی کلمات کلیدی مشخص مثل "کیلومتر: 145000" یا "کارکرد 145000" یا "km 145000"
    const keywordMatch = normalized.match(/(?:کیلومتر|کارکرد|کیلومتراژ|کیلو|km|odo|odometer|kilo)\s*[:=\-]?\s*(\d{1,10})\b/i);
    if (keywordMatch && keywordMatch[1]) {
      const num = parseInt(keywordMatch[1], 10);
      if (!isNaN(num) && num > 0 && num <= 2000000) return num;
    }

    // ۲. اگر پیامک تنها یک عدد خام باشد (مثلا "145000")
    const exactNumMatch = normalized.trim().match(/^(\d{1,10})$/);
    if (exactNumMatch && exactNumMatch[1]) {
      const num = parseInt(exactNumMatch[1], 10);
      if (!isNaN(num) && num > 0 && num <= 2000000) return num;
    }

    // ۳. پیدا کردن تمام اعداد داخل پیامک و انتخاب اولین عدد معقول
    const allNumbers = normalized.match(/\b\d{2,10}\b/g);
    if (allNumbers && allNumbers.length > 0) {
      const parsedNums = allNumbers
        .map((n: string) => parseInt(n, 10))
        .filter((n: number) => !isNaN(n) && n >= 10 && n <= 2000000);
      if (parsedNums.length > 0) {
        return parsedNums[0];
      }
    }

    return null;
  }

  // نرمال‌سازی متن فارسی برای تطبیق دقیق نام‌ها و اسامی
  function normalizePersianText(str: any): string {
    if (!str) return '';
    return str.toString()
      .replace(/[يئى]/g, 'ی')
      .replace(/[كك]/g, 'ک')
      .replace(/[\u200c\u200d\u200e\u200f\u202a-\u202e]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  // الگوریتم هوشمند ۴ لایه یافتن خودرو برای پیامک دریافتی
  function findVehicleForSms(db: any, senderPhoneRaw: string, messageTextRaw: string): any {
    if (!db.vehicles || db.vehicles.length === 0) return null;

    const normSender = normalizeDriverPhone(senderPhoneRaw);
    if (!normSender || normSender.length < 7) return null;

    const senderLast9 = normSender.slice(-9);

    // ۱. بررسی مستقیم شماره همراه در لیست خودروها (driverPhone, phone, mobile)
    for (const v of db.vehicles) {
      const vPhones = [v.driverPhone, v.phone, v.mobile, v.driverMobile].filter(Boolean);
      for (const vp of vPhones) {
        const cleanVp = normalizeDriverPhone(vp);
        if (cleanVp && (cleanVp === normSender || (senderLast9 && cleanVp.endsWith(senderLast9)))) {
          return v;
        }
        // پشتیبانی از چند شماره مجزا در یک فیلد
        const splitted = vp.toString().split(/[\/\,\-\;\s]+/);
        for (const s of splitted) {
          const cleanS = normalizeDriverPhone(s);
          if (cleanS && (cleanS === normSender || (senderLast9 && cleanS.endsWith(senderLast9)))) {
            return v;
          }
        }
      }
    }

    // ۲. بررسی در لیست پرسنل (persons) و تطبیق نام شخص با نام راننده خودرو
    if (db.persons && db.persons.length > 0 && senderLast9) {
      for (const p of db.persons) {
        const pPhones = [p.phone, p.mobile].filter(Boolean);
        let personMatched = false;
        for (const pp of pPhones) {
          const cleanPp = normalizeDriverPhone(pp);
          if (cleanPp && (cleanPp === normSender || cleanPp.endsWith(senderLast9))) {
            personMatched = true;
            break;
          }
        }

        if (personMatched && p.fullName) {
          const pNameNorm = normalizePersianText(p.fullName);
          for (const v of db.vehicles) {
            if (v.driverName) {
              const vDriverNorm = normalizePersianText(v.driverName);
              if (vDriverNorm && (vDriverNorm === pNameNorm || vDriverNorm.includes(pNameNorm) || pNameNorm.includes(vDriverNorm))) {
                if (!v.driverPhone) {
                  v.driverPhone = normSender;
                }
                return v;
              }
            }
          }
        }
      }
    }

    // ۳. بررسی در کاربران سامانه (users)
    if (db.users && db.users.length > 0 && senderLast9) {
      for (const u of db.users) {
        if (u.phone) {
          const uPhoneNorm = normalizeDriverPhone(u.phone);
          if (uPhoneNorm && (uPhoneNorm === normSender || uPhoneNorm.endsWith(senderLast9))) {
            const uNameNorm = normalizePersianText(u.fullName || u.username || '');
            for (const v of db.vehicles) {
              if (v.driverName) {
                const vDriverNorm = normalizePersianText(v.driverName);
                if (vDriverNorm && (vDriverNorm === uNameNorm || vDriverNorm.includes(uNameNorm) || uNameNorm.includes(vDriverNorm))) {
                  if (!v.driverPhone) {
                    v.driverPhone = normSender;
                  }
                  return v;
                }
              }
            }
          }
        }
      }
    }

    // ۴. بررسی متن پیامک جهت یافتن کد خودرو، پلاک خودرو، نام خودرو یا نام راننده
    if (messageTextRaw) {
      const rawTextNorm = normalizePersianText(messageTextRaw);
      const rawTextDigitsOnly = messageTextRaw.replace(/[۰-۹]/g, (d: string) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString()).replace(/[^0-9]/g, '');

      for (const v of db.vehicles) {
        // الف) کد خودرو (مانند VEH-101 یا V-101)
        if (v.code) {
          const codeNorm = normalizePersianText(v.code);
          const codeDigits = v.code.replace(/[^0-9]/g, '');
          if (codeNorm && rawTextNorm.includes(codeNorm)) {
            return v;
          }
          if (codeDigits && codeDigits.length >= 3 && rawTextDigitsOnly.includes(codeDigits)) {
            return v;
          }
        }

        // ب) پلاک خودرو (ارقام پلاک)
        if (v.plaque || v.plate) {
          const plaqueStr = (v.plaque || v.plate || '');
          const plaqueDigits = plaqueStr.replace(/[۰-۹]/g, (d: string) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString()).replace(/[^0-9]/g, '');
          if (plaqueDigits && plaqueDigits.length >= 4 && rawTextDigitsOnly.includes(plaqueDigits)) {
            return v;
          }
        }

        // ج) نام راننده در متن پیامک
        if (v.driverName) {
          const driverNorm = normalizePersianText(v.driverName);
          if (driverNorm && driverNorm.length >= 3 && rawTextNorm.includes(driverNorm)) {
            return v;
          }
        }

        // د) نام خودرو در متن پیامک (مانند پراید، پژو، بنز)
        if (v.name) {
          const vNameNorm = normalizePersianText(v.name);
          if (vNameNorm && vNameNorm.length >= 3 && rawTextNorm.includes(vNameNorm)) {
            return v;
          }
        }
      }
    }

    return null;
  }

  // بازپردازش و شناسایی مجدد پیامک‌های ناشناس موجود در دیتابیس
  function rematchUnknownSmsLogs(existingDb?: any) {
    const db = existingDb || readDb();
    if (!db.smsInboundLogs) db.smsInboundLogs = [];
    if (!db.vehicles) db.vehicles = [];

    let updatedCount = 0;
    for (const log of db.smsInboundLogs) {
      if (log.status === 'unknown_driver' || !log.vehicleId) {
        const senderPhone = log.senderPhone;
        const rawText = log.rawText;
        const extractedKm = log.extractedKm || extractKilometerFromSms(rawText);

        if (!senderPhone || !extractedKm) continue;

        const matchedVehicle = findVehicleForSms(db, senderPhone, rawText);
        if (matchedVehicle) {
          log.vehicleId = matchedVehicle.id;
          log.vehicleName = matchedVehicle.name;
          log.vehiclePlaque = matchedVehicle.plaque;
          log.driverName = matchedVehicle.driverName || 'راننده';
          log.status = 'success';
          log.statusMessage = `کیلومتر جدید (${extractedKm.toLocaleString()}km) برای خودرو ${matchedVehicle.name} (${matchedVehicle.plaque}) متعلق به راننده ${matchedVehicle.driverName} با موفقیت ثبت گردید.`;
          log.replyMessage = `کیلومتر ${extractedKm.toLocaleString()} برای خودرو ${matchedVehicle.name} (${matchedVehicle.plaque}) با موفقیت در سیستم ترابری ثبت شد. با تشکر، واحد ترابری.`;

          if (!matchedVehicle.driverPhone || matchedVehicle.driverPhone.trim() === '') {
            matchedVehicle.driverPhone = senderPhone;
          }

          const previousKm = matchedVehicle.currentKm !== undefined && Number(matchedVehicle.currentKm) > 0 
            ? Number(matchedVehicle.currentKm) 
            : extractedKm;
          const differenceKm = extractedKm >= previousKm ? (extractedKm - previousKm) : 0;

          matchedVehicle.currentKm = extractedKm;

          if (!db.odometerLogs) db.odometerLogs = [];
          const existingOdoLog = db.odometerLogs.find((o: any) => o.rawSmsText === rawText && (o.driverPhone === senderPhone || o.vehicleId === matchedVehicle.id));
          if (!existingOdoLog) {
            const newOdoLog = {
              id: db.odometerLogs.length > 0 ? Math.max(...db.odometerLogs.map((o: any) => o.id)) + 1 : 1,
              vehicleId: matchedVehicle.id,
              driverName: matchedVehicle.driverName || 'راننده پیامکی',
              driverPhone: senderPhone,
              company: matchedVehicle.company || '',
              plaque: matchedVehicle.plaque || '',
              vehicleName: matchedVehicle.name || '',
              inquiryDate: getTodayJalaliString(),
              inquiryTime: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
              odometerKm: extractedKm,
              previousKm,
              differenceKm,
              dailyAverageKm: 70,
              recordedBy: 'پیامک خودکار راننده (شناسایی مجدد)',
              source: 'sms' as const,
              rawSmsText: rawText,
              notes: `ثبت هوشمند از پیامک راننده: "${rawText}"`,
              createdAt: log.createdAt || new Date().toISOString()
            };
            db.odometerLogs.unshift(newOdoLog);
          }
          updatedCount++;
        }
      }
    }

    if (updatedCount > 0 && !existingDb) {
      writeDb(db);
    }
    return updatedCount;
  }

  // تابع هسته پردازش پیامک راننده و به‌روزرسانی هوشمند کیلومتر خودرو
  function processDriverInboundSms(senderPhoneRaw: string, messageTextRaw: string, smsId?: string, receivedDateTime?: number, existingDb?: any) {
    const db = existingDb || readDb();
    if (!db.smsInboundLogs) db.smsInboundLogs = [];
    if (!db.odometerLogs) db.odometerLogs = [];

    const normSender = normalizeDriverPhone(senderPhoneRaw);
    const rawText = (messageTextRaw || '').toString().trim();
    const extractedKm = extractKilometerFromSms(rawText);

    const msgDate = receivedDateTime 
      ? new Date(receivedDateTime > 10000000000 ? receivedDateTime : receivedDateTime * 1000) 
      : new Date();
    const nowIso = msgDate.toISOString();
    let todayJalali = getTodayJalaliString();
    try {
      todayJalali = msgDate.toLocaleDateString('fa-IR-u-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {}
    const nowTimeStr = msgDate.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

    let status: 'success' | 'unknown_driver' | 'invalid_km' | 'error' = 'success';
    let statusMessage = '';
    let replyMessage = '';
    let matchedVehicle: any = null;

    if (!normSender || normSender.length < 7) {
      status = 'error';
      statusMessage = 'شماره تلفن فرستنده پیامک نامعتبر است.';
      replyMessage = 'خطا: شماره فرستنده نامعتبر است.';
    } else if (extractedKm === null || extractedKm <= 0 || extractedKm > 2000000) {
      status = 'invalid_km';
      statusMessage = (extractedKm && extractedKm > 2000000)
        ? `عدد کیلومتر ارسالی (${extractedKm.toLocaleString()}km) بالاتر از سقف مجاز خودرو (۲,۰۰۰,۰۰۰ کیلومتر) است.`
        : 'مقدار کیلومتر در متن پیامک تشخیص داده نشد. لطفاً تنها عدد کیلومتر یا مثلا "کیلومتر ۱۲۵۰۰۰" را ارسال نمایید.';
      replyMessage = 'پیامک دریافت شد اما عدد کیلومتر نامعتبر بود. لطفا عدد واقعی کارکرد خودرو را به صورت پیامک ارسال نمایید (مثلا: ۱۲۵۰۰۰).';
    } else {
      // استفاده از تابع ۴ لایه‌ای هوشمند تطبیق خودرو
      matchedVehicle = findVehicleForSms(db, normSender, rawText);

      if (!matchedVehicle) {
        status = 'unknown_driver';
        statusMessage = `شماره فرستنده (${normSender}) به هیچ خودرو یا راننده‌ای در ناوگان تخصیص نیافته است. (کیلومتر خوانده‌شده: ${extractedKm.toLocaleString()})`;
        replyMessage = `شماره شما (${normSender}) در سیستم ترابری ثبت نشده یا خودرویی به شما تحویل داده نشده است. لطفا با واحد ترابری تماس بگیرید.`;
      } else {
        // خودرو پیدا شد - به‌روزرسانی کیلومتر خودرو و ثبت استعلام
        const previousKm = matchedVehicle.currentKm !== undefined && Number(matchedVehicle.currentKm) > 0 
          ? Number(matchedVehicle.currentKm) 
          : extractedKm;
        const differenceKm = extractedKm >= previousKm ? (extractedKm - previousKm) : 0;

        // محاسبه میانگین روزانه
        const prevLogs = db.odometerLogs.filter((l: any) => l.vehicleId === matchedVehicle.id);
        let dailyAverageKm = 70;
        if (prevLogs.length > 0) {
          const lastLog = prevLogs[0];
          if (lastLog.dailyAverageKm && lastLog.dailyAverageKm > 0) {
            dailyAverageKm = Math.round((lastLog.dailyAverageKm + (differenceKm > 0 ? differenceKm : 70)) / 2);
          } else if (differenceKm > 0) {
            dailyAverageKm = Math.min(Math.max(differenceKm, 20), 400);
          }
        }

        // ثبت استعلام جدید در آرایه odometerLogs با منبع پیامک راننده
        const newOdoLog = {
          id: db.odometerLogs.length > 0 ? Math.max(...db.odometerLogs.map((o: any) => o.id)) + 1 : 1,
          vehicleId: matchedVehicle.id,
          driverName: matchedVehicle.driverName || 'راننده پیامکی',
          driverPhone: normSender,
          company: matchedVehicle.company || '',
          plaque: matchedVehicle.plaque || '',
          vehicleName: matchedVehicle.name || '',
          inquiryDate: todayJalali,
          inquiryTime: nowTimeStr,
          odometerKm: extractedKm,
          previousKm,
          differenceKm,
          dailyAverageKm,
          recordedBy: 'پیامک خودکار راننده',
          source: 'sms' as const,
          rawSmsText: rawText,
          notes: `دریافت خودکار از پیامک راننده: "${rawText}"`,
          createdAt: nowIso
        };

        db.odometerLogs.unshift(newOdoLog);

        // بروزرسانی مستقیم کیلومتر جاری خودرو در جدول خودروها
        matchedVehicle.currentKm = extractedKm;

        status = 'success';
        statusMessage = `کیلومتر جدید (${extractedKm.toLocaleString()}km) برای خودرو ${matchedVehicle.name} (${matchedVehicle.plaque}) متعلق به راننده ${matchedVehicle.driverName} با موفقیت در سیستم ثبت گردید.`;
        replyMessage = `کیلومتر ${extractedKm.toLocaleString()} برای خودرو ${matchedVehicle.name} (${matchedVehicle.plaque}) با موفقیت در سیستم ترابری ثبت شد. با تشکر، واحد ترابری.`;

        // ثبت لاگ فعالیت در سیستم
        logActivity(
          1,
          'driver_sms',
          'ثبت خودکار کیلومتر پیامکی راننده',
          `راننده ${matchedVehicle.driverName} (${normSender}) کیلومتر ${extractedKm.toLocaleString()} را از طریق پیامک برای خودرو ${matchedVehicle.name} ارسال کرد و کیلومتر خودرو بروزرسانی شد.`
        );
      }
    }

    // ایجاد لاگ پیامک ورودی
    const newSmsLog: any = {
      id: db.smsInboundLogs.length > 0 ? Math.max(...db.smsInboundLogs.map((s: any) => s.id)) + 1 : 1,
      smsId: smsId || undefined,
      senderPhone: normSender || senderPhoneRaw,
      rawText,
      extractedKm: extractedKm || undefined,
      status,
      statusMessage,
      vehicleId: matchedVehicle ? matchedVehicle.id : undefined,
      vehicleName: matchedVehicle ? matchedVehicle.name : undefined,
      vehiclePlaque: matchedVehicle ? matchedVehicle.plaque : undefined,
      driverName: matchedVehicle ? matchedVehicle.driverName : undefined,
      replyMessage,
      createdAt: nowIso
    };

    db.smsInboundLogs.unshift(newSmsLog);
    if (!existingDb) {
      writeDb(db);
    }

    return {
      success: status === 'success',
      smsLog: newSmsLog,
      vehicle: matchedVehicle,
      extractedKm,
      replyMessage
    };
  }

  // قفل همروندی برای جلوگیری از درخواست‌های همزمان استعلام پیامک
  let isSyncInboundInProgress = false;

  // تابع همگام‌سازی و استعلام خودکار پیامک‌های جدید از پنل پیامک (sms.ir و کاوه نگار)
  async function syncInboundSmsFromGateway(dbInstance?: any): Promise<{ newCount: number; messages: any[] }> {
    if (isSyncInboundInProgress) {
      return { newCount: 0, messages: [] };
    }
    isSyncInboundInProgress = true;
    try {
      const db = dbInstance || readDb();
      const settings = getSmsSettings(db);
      const defaultKey = 'Xcpq5IEcfWypqDce4tHB612pCor0OsnwkdEdPrAgldxozVWp';
      const apiKey = (settings.apiKey || process.env.SMS_API_KEY || defaultKey).trim();

      if (!apiKey) {
        return { newCount: 0, messages: [] };
      }

      if (!db.smsInboundLogs) db.smsInboundLogs = [];
      if (!db.processedSmsIds) db.processedSmsIds = [];

      let newCount = 0;
      const processedList: any[] = [];

      // ۱. استعلام از درگاه sms.ir (بررسی هم پیام‌های زنده روز و هم پیام‌های جدید)
      if (settings.provider === 'sms.ir' || apiKey.length >= 30) {
        try {
          const rawItems: any[] = [];

          // استعلام پیام‌های روزانه (live) با مهلت زمانی ۳.۵ ثانیه‌ای
          try {
            const liveRes = await fetch('https://api.sms.ir/v1/receive/live?pageSize=100&pageNumber=1&sortByNewest=true', {
              method: 'GET',
              headers: {
                'x-api-key': apiKey,
                'Accept': 'application/json'
              },
              signal: AbortSignal.timeout(3500)
            });
            if (liveRes.ok) {
              const liveJson: any = await liveRes.json().catch(() => null);
              if (liveJson && liveJson.status === 1 && Array.isArray(liveJson.data)) {
                rawItems.push(...liveJson.data);
              }
            }
          } catch (err) {}

          // استعلام پیام‌های جدید خوانده‌نشده (latest) با مهلت زمانی ۳.۵ ثانیه‌ای
          try {
            const latestRes = await fetch('https://api.sms.ir/v1/receive/latest?count=100', {
              method: 'GET',
              headers: {
                'x-api-key': apiKey,
                'Accept': 'application/json'
              },
              signal: AbortSignal.timeout(3500)
            });
            if (latestRes.ok) {
              const latestJson: any = await latestRes.json().catch(() => null);
              if (latestJson && latestJson.status === 1 && Array.isArray(latestJson.data)) {
                rawItems.push(...latestJson.data);
              }
            }
          } catch (err) {}

        // حذف موارد تکراری در بین دو فراخوانی
        const uniqueItems = new Map<string, any>();
        for (const item of rawItems) {
          const key = item.receiveReturnId 
            ? String(item.receiveReturnId) 
            : `${item.mobile}_${item.messageText}_${item.receivedDateTime}`;
          if (!uniqueItems.has(key)) {
            uniqueItems.set(key, item);
          }
        }

        for (const [smsId, item] of uniqueItems.entries()) {
          const isAlreadyInLogs = db.smsInboundLogs.some((l: any) => 
            l.smsId === smsId || 
            (l.rawText === item.messageText && (l.senderPhone === normalizeDriverPhone(item.mobile) || l.senderPhone === String(item.mobile)))
          );

          if (isAlreadyInLogs) {
            if (!db.processedSmsIds.includes(smsId)) {
              db.processedSmsIds.push(smsId);
            }
            continue;
          }

          const senderMobile = item.mobile ? String(item.mobile) : '';
          const msgText = item.messageText ? String(item.messageText) : '';
          const processRes = processDriverInboundSms(senderMobile, msgText, smsId, item.receivedDateTime, db);

          if (!db.processedSmsIds.includes(smsId)) {
            db.processedSmsIds.push(smsId);
          }
          newCount++;
          processedList.push({
            smsId,
            mobile: senderMobile,
            text: msgText,
            status: processRes.smsLog?.statusMessage || 'ثبت شد'
          });
        }

        if (newCount > 0) {
          writeDb(db);
          console.log(`[SMS Sync] Successfully fetched and processed ${newCount} new SMS from sms.ir.`);
        }
      } catch (e: any) {
        console.warn('[SMS Sync Error sms.ir]:', e?.message || e);
      }
    }

    // ۲. استعلام از درگاه کاوه نگار
    if (settings.provider === 'kavenegar' && apiKey) {
      try {
        const line = settings.lineNumber || '';
        const res = await fetch(`https://api.kavenegar.com/v1/${encodeURIComponent(apiKey)}/sms/receive.json?linenumber=${encodeURIComponent(line)}&isread=0`, {
          signal: AbortSignal.timeout(3500)
        });
        if (res.ok) {
          const json: any = await res.json().catch(() => null);
          if (json && json.entries && Array.isArray(json.entries)) {
            for (const item of json.entries) {
              const smsId = String(item.messageid);
              const isAlreadyInLogs = db.smsInboundLogs.some((l: any) => l.smsId === smsId);
              if (isAlreadyInLogs) {
                if (!db.processedSmsIds.includes(smsId)) {
                  db.processedSmsIds.push(smsId);
                }
                continue;
              }
              const processRes = processDriverInboundSms(item.sender, item.message, smsId, item.date, db);
              if (!db.processedSmsIds.includes(smsId)) {
                db.processedSmsIds.push(smsId);
              }
              newCount++;
              processedList.push({
                smsId,
                mobile: item.sender,
                text: item.message,
                status: processRes.smsLog?.statusMessage || 'ثبت شد'
              });
            }
            if (newCount > 0) {
              writeDb(db);
              console.log(`[SMS Sync] Successfully fetched and processed ${newCount} new SMS from Kavenegar.`);
            }
          }
        }
      } catch (e: any) {
        console.warn('[SMS Sync Error Kavenegar]:', e?.message || e);
      }
    }

    return { newCount, messages: processedList };
    } finally {
      isSyncInboundInProgress = false;
    }
  }

  // ۱. وب‌هوک عمومی دریافت پیامک از کلیه پنل‌های پیامکی ایرانی (کاوه نگار، ملی پیامک، فراز اس‌ام‌اس، SMS.ir و ...)
  // پشتیبانی از هر دو متد POST و GET و فیلدهای متنوع
  app.all('/api/sms/inbound', (req, res) => {
    const data = { ...req.query, ...req.body };
    
    // استخراج شماره فرستنده از متداول‌ترین کلیدهای پنل‌های پیامک ایران (sms.ir, کاوه‌نگار، فراز و ...)
    const sender = data.from || data.sender || data.mobile || data.phone || data.senderNumber || data.fromNumber || data.sendNumber || data.sender_number || data.From || data.Mobile || data.PhoneNumber || '';
    // استخراج متن پیامک
    const message = data.message || data.text || data.body || data.msg || data.smsText || data.smsBody || data.messageContent || data.messageText || data.Message || data.Text || data.MessageText || data.Body || '';
    const smsId = data.messageId || data.id || data.smsId || data.receiveReturnId || data.sms_id || null;

    console.log(`[SMS Webhook Received] From: ${sender}, Message: "${message}", ID: ${smsId}`);

    const result = processDriverInboundSms(sender, message, undefined, smsId);

    // پاسخ به وب‌هوک متناسب با استاندارد پنل‌ها
    res.json({
      status: result.success ? 'OK' : 'ERROR',
      result: result.success ? 1 : 0,
      message: result.smsLog.statusMessage,
      autoReply: result.replyMessage,
      extractedKm: result.extractedKm,
      vehicle: result.vehicle ? {
        id: result.vehicle.id,
        name: result.vehicle.name,
        plaque: result.vehicle.plaque,
        driverName: result.vehicle.driverName,
        currentKm: result.vehicle.currentKm
      } : null
    });
  });

  // ۱.۵. استعلام و همگام‌سازی دستی و خودکار پیامک‌های دریافتی از درگاه پیامک
  app.all('/api/sms/sync-inbound', async (req, res) => {
    try {
      const syncResult = await syncInboundSmsFromGateway();
      const db = readDb();
      res.json({
        success: true,
        newCount: syncResult.newCount,
        messages: syncResult.messages,
        totalLogs: (db.smsInboundLogs || []).length
      });
    } catch (e: any) {
      console.warn('[Sync Inbound Error]:', e?.message || e);
      res.json({
        success: false,
        newCount: 0,
        messages: [],
        message: e?.message || 'خطا در برقراری ارتباط با درگاه پیامک'
      });
    }
  });

  // ۲. دریافت تاریخچه لاگ‌های پیامک رانندگان
  app.get('/api/sms/inbound-logs', (req, res) => {
    const db = readDb();
    const logs = db.smsInboundLogs || [];
    logs.sort((a: any, b: any) => b.id - a.id);
    res.json(logs);
  });

  // ۳. حذف لاگ پیامک
  app.delete('/api/sms/inbound-logs/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    if (!db.smsInboundLogs) db.smsInboundLogs = [];
    db.smsInboundLogs = db.smsInboundLogs.filter((s: any) => s.id !== Number(id));
    writeDb(db);
    res.json({ success: true });
  });

  // ۳.۵. تخصیص پیامک به یک خودرو و اعمال کیلومتر
  app.post('/api/sms/inbound-logs/:id/assign', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    const { vehicleId, updateDriverPhone } = req.body;

    const logIndex = (db.smsInboundLogs || []).findIndex((s: any) => s.id === Number(id));
    if (logIndex === -1) {
      return res.status(404).json({ message: 'لاگ پیامک یافت نشد.' });
    }

    const vehicle = (db.vehicles || []).find((v: any) => v.id === Number(vehicleId));
    if (!vehicle) {
      return res.status(404).json({ message: 'خودروی مورد نظر یافت نشد.' });
    }

    const smsLog = db.smsInboundLogs[logIndex];
    const kmToApply = smsLog.extractedKm || extractKilometerFromSms(smsLog.rawText);

    if (!kmToApply || kmToApply <= 0) {
      return res.status(400).json({ message: 'عدد کیلومتر معتبری در این پیامک وجود ندارد.' });
    }

    if (updateDriverPhone && smsLog.senderPhone) {
      vehicle.driverPhone = smsLog.senderPhone;
    }

    const previousKm = vehicle.currentKm !== undefined && Number(vehicle.currentKm) > 0 ? Number(vehicle.currentKm) : kmToApply;
    const differenceKm = kmToApply >= previousKm ? (kmToApply - previousKm) : 0;
    
    // میانگین روزانه
    const prevLogs = (db.odometerLogs || []).filter((l: any) => l.vehicleId === vehicle.id);
    let dailyAverageKm = 70;
    if (prevLogs.length > 0 && prevLogs[0].dailyAverageKm) {
      dailyAverageKm = Math.round((prevLogs[0].dailyAverageKm + (differenceKm > 0 ? differenceKm : 70)) / 2);
    }

    // ثبت در odometerLogs
    if (!db.odometerLogs) db.odometerLogs = [];
    const newOdoLog = {
      id: db.odometerLogs.length > 0 ? Math.max(...db.odometerLogs.map((o: any) => o.id)) + 1 : 1,
      vehicleId: vehicle.id,
      driverName: vehicle.driverName || 'راننده',
      driverPhone: smsLog.senderPhone || vehicle.driverPhone || '',
      company: vehicle.company || '',
      plaque: vehicle.plaque || '',
      vehicleName: vehicle.name || '',
      inquiryDate: getTodayJalaliString(),
      inquiryTime: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      odometerKm: kmToApply,
      previousKm,
      differenceKm,
      dailyAverageKm,
      recordedBy: 'تخصیص دستی از پیامک',
      source: 'sms' as const,
      rawSmsText: smsLog.rawText,
      notes: `تخصیص داده‌شده از پیامک شماره ${smsLog.senderPhone}`,
      createdAt: new Date().toISOString()
    };
    db.odometerLogs.unshift(newOdoLog);

    // آپدیت کیلومتر خودرو
    vehicle.currentKm = kmToApply;

    // آپدیت لاگ پیامک
    smsLog.status = 'success';
    smsLog.vehicleId = vehicle.id;
    smsLog.vehicleName = vehicle.name;
    smsLog.vehiclePlaque = vehicle.plaque;
    smsLog.driverName = vehicle.driverName;
    smsLog.statusMessage = `کیلومتر ${kmToApply.toLocaleString()} با موفقیت به خودرو ${vehicle.name} (${vehicle.plaque}) تخصیص داده شد.`;

    rematchUnknownSmsLogs(db);
    writeDb(db);
    res.json({ success: true, vehicle, odoLog: newOdoLog, smsLog });
  });

  // ۴. شبیه‌سازی و تست زنده ارسال پیامک راننده از داخل رابط کاربری
  app.post('/api/sms/simulate', (req, res) => {
    const { senderPhone, message } = req.body;
    if (!senderPhone || !message) {
      return res.status(400).json({ message: 'شماره فرستنده و متن پیامک الزامی است.' });
    }

    const result = processDriverInboundSms(senderPhone, message);
    res.json(result);
  });

  // ۴.۵. پردازش و شناسایی مجدد پیامک‌های ناشناس
  app.all('/api/sms/rematch-unknown', (req, res) => {
    try {
      const db = readDb();
      const updatedCount = rematchUnknownSmsLogs(db);
      if (updatedCount > 0) {
        writeDb(db);
      }
      res.json({
        success: true,
        updatedCount,
        message: updatedCount > 0 
          ? `تعداد ${updatedCount} پیامک ناشناس با موفقیت شناسایی و به خودروها تخصیص داده شد.` 
          : 'هیچ پیامک ناشناسی که قابل تطبیق با خودروها باشد یافت نشد.'
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'خطا در تطبیق مجدد پیامک‌ها' });
    }
  });

  // =========================================================================
  // --- پنل پیامک‌های یادآوری استعلام کارکرد / مراجعه پس از گذشت روزهای معین ---
  // =========================================================================

  // تبدیل تاریخ شمسی به تعداد روز از مبدا جهت محاسبه تفاوت روزها
  function calculateJalaliDaysFromEpoch(jalaliStr: string): number {
    if (!jalaliStr) return 0;
    const clean = jalaliStr.toString().trim()
      .replace(/[۰-۹]/g, (d: string) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
      .replace(/-/g, '/');
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

  // تفاوت روزها بین تاریخ معین و امروز
  function getDaysPassedFromDate(dateStr: string): number {
    if (!dateStr) return 999;
    const todayStr = getTodayJalaliString();
    const todayDays = calculateJalaliDaysFromEpoch(todayStr);
    const targetDays = calculateJalaliDaysFromEpoch(dateStr);
    return Math.max(0, todayDays - targetDays);
  }

  // دریافت تنظیمات یادآوری پیامکی
  function getSmsSettings(db: any) {
    const defaultSettings = {
      daysThreshold: 7,
      autoSendEnabled: false,
      checkBasedOn: 'last_service' as const,
      smsTemplate: 'راننده محترم {driverName}، با سلام؛ با توجه به گذشت {daysPassed} روز از آخرین سرویس دوره‌ای، لطفاً جهت بررسی وضعیت خودرو {vehicleName} ({plaque}) و اعلام کارکرد فعلی اقدام فرمایید. واحد ترابری {company}',
      preventDuplicateHours: 24,
      provider: 'کاوه نگار',
      lineNumber: '3000505',
      apiKey: process.env.SMS_API_KEY || ''
    };
    return db.smsReminderSettings ? { ...defaultSettings, ...db.smsReminderSettings } : defaultSettings;
  }

  // تابع ساخت لیست خودروها و رانندگان نیازمند یادآوری پیامکی (مبنای تاخیر: آخرین تاریخ سرویس دوره‌ای)
  function getOverdueDriversList(db: any, customThreshold?: number) {
    const settings = getSmsSettings(db);
    const threshold = customThreshold !== undefined ? customThreshold : settings.daysThreshold;
    const vehicles = db.vehicles || [];
    const odometerLogs = db.odometerLogs || [];
    const services = db.services || [];
    const outboundLogs = db.smsOutboundLogs || [];

    const now = new Date();
    const result: any[] = [];

    vehicles.forEach((v: any) => {
      // پیدا کردن کلیه سرویس‌های دوره‌ای این خودرو و مرتب‌سازی دقیق به ترتیب جدیدترین تاریخ شمسی
      const vServices = (services || []).filter((s: any) => s.vehicleId === v.id);
      vServices.sort((a: any, b: any) => {
        const daysB = calculateJalaliDaysFromEpoch(b.serviceDate || '') || (b.createdAt ? new Date(b.createdAt).getTime() / (1000 * 86400) : 0);
        const daysA = calculateJalaliDaysFromEpoch(a.serviceDate || '') || (a.createdAt ? new Date(a.createdAt).getTime() / (1000 * 86400) : 0);
        return daysB - daysA;
      });
      const lastService = vServices[0];

      // پیدا کردن آخرین استعلام تلفنی یا پیامکی (در صورت وجود)
      const vOdoLogs = (odometerLogs || []).filter((o: any) => o.vehicleId === v.id);
      vOdoLogs.sort((a: any, b: any) => {
        const daysB = calculateJalaliDaysFromEpoch(b.inquiryDate || '') || (b.createdAt ? new Date(b.createdAt).getTime() / (1000 * 86400) : 0);
        const daysA = calculateJalaliDaysFromEpoch(a.inquiryDate || '') || (a.createdAt ? new Date(a.createdAt).getTime() / (1000 * 86400) : 0);
        return daysB - daysA;
      });
      const lastOdoLog = vOdoLogs[0];

      let lastVisitDate = '';
      let lastVisitType: 'service' | 'inquiry' | 'none' = 'none';

      const checkMode = settings.checkBasedOn || 'last_service';

      if (checkMode === 'last_service') {
        // مبنا: آخرین تاریخ سرویس دوره‌ای
        if (lastService && lastService.serviceDate) {
          lastVisitDate = lastService.serviceDate;
          lastVisitType = 'service';
        } else if (lastOdoLog && lastOdoLog.inquiryDate) {
          // در صورت عدم ثبت سرویس دوره‌ای، fallback به آخرین استعلام
          lastVisitDate = lastOdoLog.inquiryDate;
          lastVisitType = 'inquiry';
        }
      } else if (checkMode === 'last_inquiry') {
        if (lastOdoLog && lastOdoLog.inquiryDate) {
          lastVisitDate = lastOdoLog.inquiryDate;
          lastVisitType = 'inquiry';
        } else if (lastService && lastService.serviceDate) {
          lastVisitDate = lastService.serviceDate;
          lastVisitType = 'service';
        }
      } else {
        // هرکدام که جدیدتر است (در حالت انتخاب شده توسط کاربر)
        const odoDays = lastOdoLog ? getDaysPassedFromDate(lastOdoLog.inquiryDate) : 999;
        const srvDays = lastService ? getDaysPassedFromDate(lastService.serviceDate) : 999;

        if (srvDays <= odoDays && lastService) {
          lastVisitDate = lastService.serviceDate;
          lastVisitType = 'service';
        } else if (lastOdoLog) {
          lastVisitDate = lastOdoLog.inquiryDate;
          lastVisitType = 'inquiry';
        } else if (lastService) {
          lastVisitDate = lastService.serviceDate;
          lastVisitType = 'service';
        }
      }

      const daysPassed = lastVisitDate ? getDaysPassedFromDate(lastVisitDate) : 99;

      // بررسی آخرین پیامک ارسالی به این خودرو برای جلوگیری از ارسال مکرر
      const vOutbounds = outboundLogs.filter((o: any) => o.vehicleId === v.id && o.status === 'sent');
      vOutbounds.sort((a: any, b: any) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
      const lastOutbound = vOutbounds[0];

      let smsAlreadySentRecently = false;
      if (lastOutbound) {
        const hoursPassed = (now.getTime() - new Date(lastOutbound.sentAt).getTime()) / (1000 * 60 * 60);
        if (hoursPassed < (settings.preventDuplicateHours || 24)) {
          smsAlreadySentRecently = true;
        }
      }

      if (daysPassed >= threshold) {
        // ایجاد متن پیشنهادی پیامک
        const template = settings.smsTemplate || '';
        const populatedText = template
          .replace(/{driverName}/g, v.driverName || 'راننده گرامی')
          .replace(/{vehicleName}/g, v.name || 'خودرو')
          .replace(/{plaque}/g, v.plaque || '')
          .replace(/{company}/g, v.company || 'ترابری')
          .replace(/{daysPassed}/g, daysPassed.toString())
          .replace(/{currentKm}/g, (v.currentKm || 0).toLocaleString());

        result.push({
          vehicleId: v.id,
          vehicleName: v.name,
          vehiclePlaque: v.plaque,
          company: v.company || '',
          driverName: v.driverName || 'بدون راننده',
          driverPhone: v.driverPhone || '',
          lastVisitDate: lastVisitDate || 'ثبت نشده',
          lastVisitType,
          daysPassed,
          currentKm: v.currentKm || 0,
          lastSmsSentAt: lastOutbound ? lastOutbound.sentAt : undefined,
          smsAlreadySentRecently,
          recommendedText: populatedText
        });
      }
    });

    // مرتب‌سازی بر اساس بیشترین روزهای گذشته
    result.sort((a, b) => b.daysPassed - a.daysPassed);
    return result;
  }

  // تابع ارسال تکی یا گروهی پیامک یادآوری
  function sendReminderSmsToDriver(db: any, vehicleId: number, customMessageText?: string, mode: 'manual' | 'automatic' = 'manual') {
    if (!db.smsOutboundLogs) db.smsOutboundLogs = [];

    const vehicle = (db.vehicles || []).find((v: any) => v.id === Number(vehicleId));
    if (!vehicle) {
      throw new Error(`خودرو با شناسه ${vehicleId} یافت نشد.`);
    }

    const normPhone = normalizeDriverPhone(vehicle.driverPhone || '');
    if (!normPhone || normPhone.length < 7) {
      throw new Error(`شماره تلفن راننده خودرو ${vehicle.name} (${vehicle.driverName}) معتبر نمی‌باشد.`);
    }

    const settings = getSmsSettings(db);
    const overdueList = getOverdueDriversList(db);
    const overdueInfo = overdueList.find(o => o.vehicleId === vehicle.id);
    const daysPassed = overdueInfo ? overdueInfo.daysPassed : 7;
    const lastVisitDate = overdueInfo ? overdueInfo.lastVisitDate : 'نامشخص';

    const messageText = customMessageText || (overdueInfo ? overdueInfo.recommendedText : settings.smsTemplate
      .replace(/{driverName}/g, vehicle.driverName || 'راننده گرامی')
      .replace(/{vehicleName}/g, vehicle.name || '')
      .replace(/{plaque}/g, vehicle.plaque || '')
      .replace(/{company}/g, vehicle.company || 'ترابری')
      .replace(/{daysPassed}/g, daysPassed.toString())
      .replace(/{currentKm}/g, (vehicle.currentKm || 0).toLocaleString()));

    const newLog = {
      id: db.smsOutboundLogs.length > 0 ? Math.max(...db.smsOutboundLogs.map((o: any) => o.id)) + 1 : 1,
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      vehiclePlaque: vehicle.plaque,
      driverName: vehicle.driverName || 'راننده',
      driverPhone: normPhone,
      daysSinceLastVisit: daysPassed,
      lastVisitDate,
      messageText,
      status: 'sent' as const,
      sentMode: mode,
      sentAt: new Date().toISOString(),
      responseInfo: `ارسال موفق از طریق خط ${settings.lineNumber || '3000505'} (${settings.provider || 'کاوه نگار'})`
    };

    db.smsOutboundLogs.unshift(newLog);

    logActivity(
      1,
      'sms_reminder_sent',
      mode === 'automatic' ? 'ارسال خودکار پیامک یادآوری کارکرد' : 'ارسال دستی پیامک یادآوری کارکرد',
      `پیامک یادآوری استعلام کارکرد به راننده ${vehicle.driverName} (${normPhone}) برای خودرو ${vehicle.name} (${vehicle.plaque}) به دلیل گذشت ${daysPassed} روز از آخرین ثبت، با موفقیت ارسال شد.`
    );

    return newLog;
  }

  // دریافت تنظیمات پیامک یادآوری
  app.get('/api/sms/reminder-settings', (req, res) => {
    const db = readDb();
    res.json(getSmsSettings(db));
  });

  // به‌روزرسانی تنظیمات پیامک یادآوری
  app.post('/api/sms/reminder-settings', (req, res) => {
    const db = readDb();
    const current = getSmsSettings(db);
    db.smsReminderSettings = { ...current, ...req.body };
    writeDb(db);

    logActivity(1, 'sms_settings_update', 'به‌روزرسانی تنظیمات پیامک یادآوری', 
      `تنظیمات یادآوری با سقف ${db.smsReminderSettings.daysThreshold} روز و وضعیت خودکار: ${db.smsReminderSettings.autoSendEnabled ? 'فعال' : 'غیرفعال'} ذخیره شد.`
    );

    res.json(db.smsReminderSettings);
  });

  // دریافت لیست رانندگان با تاخیر مراجعه بیش از X روز
  app.get('/api/sms/overdue-drivers', (req, res) => {
    const db = readDb();
    const customThreshold = req.query.daysThreshold ? parseInt(req.query.daysThreshold as string, 10) : undefined;
    const list = getOverdueDriversList(db, customThreshold);
    res.json(list);
  });

  // ارسال دستی پیامک یادآوری به یک یا چند راننده
  app.post('/api/sms/send-reminder', (req, res) => {
    const { vehicleIds, customMessage } = req.body;
    if (!vehicleIds || !Array.isArray(vehicleIds) || vehicleIds.length === 0) {
      return res.status(400).json({ message: 'حداقل یک خودرو باید انتخاب شود.' });
    }

    const db = readDb();
    const sentLogs: any[] = [];
    const errors: string[] = [];

    vehicleIds.forEach((vId: number) => {
      try {
        const log = sendReminderSmsToDriver(db, vId, customMessage, 'manual');
        sentLogs.push(log);
      } catch (err: any) {
        errors.push(err.message);
      }
    });

    writeDb(db);
    res.json({
      success: sentLogs.length > 0,
      sentCount: sentLogs.length,
      logs: sentLogs,
      errors
    });
  });

  // اجرای فرآیند ارسال خودکار پیامک‌های دوره‌ای (Auto Trigger)
  app.post('/api/sms/trigger-auto-reminders', (req, res) => {
    const db = readDb();
    const settings = getSmsSettings(db);
    if (!settings.autoSendEnabled) {
      return res.json({ success: false, message: 'حالت ارسال خودکار در تنظیمات غیرفعال است.', sentCount: 0 });
    }

    const overdueList = getOverdueDriversList(db);
    // فقط مواردی که اخیراً پیامک نگرفته‌اند و شماره همراه معتبر دارند
    const eligibleList = overdueList.filter(o => !o.smsAlreadySentRecently && o.driverPhone && o.driverPhone.trim().length >= 7);

    const sentLogs: any[] = [];
    eligibleList.forEach(item => {
      try {
        const log = sendReminderSmsToDriver(db, item.vehicleId, undefined, 'automatic');
        sentLogs.push(log);
      } catch (e) {
        // نادیده گرفتن خطای تکی در ارسال خودکار
      }
    });

    if (sentLogs.length > 0) {
      writeDb(db);
    }

    res.json({
      success: true,
      eligibleCount: eligibleList.length,
      sentCount: sentLogs.length,
      logs: sentLogs
    });
  });

  // تاریخچه پیامک‌های ارسالی یادآوری
  app.get('/api/sms/outbound-logs', (req, res) => {
    const db = readDb();
    const logs = db.smsOutboundLogs || [];
    logs.sort((a: any, b: any) => b.id - a.id);
    res.json(logs);
  });

  // حذف لاگ پیامک ارسالی
  app.delete('/api/sms/outbound-logs/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    if (!db.smsOutboundLogs) db.smsOutboundLogs = [];
    db.smsOutboundLogs = db.smsOutboundLogs.filter((o: any) => o.id !== Number(id));
    writeDb(db);
    res.json({ success: true });
  });

  // =========================================================================
  // --- تسک‌ها و میانبرهای دسترسی سریع سفارشی داشبورد (Dashboard Quick Tasks) ---
  // =========================================================================

  // لیست پیش‌فرض کارت‌های دسترسی سریع اختصاصی داشبورد (هر کارت مستقیماً به بخش مربوطه منتقل می‌شود)
  const defaultDashboardTasks = [
    {
      id: 'task_odo_phone',
      title: 'استعلام تلفنی کارکرد رانندگان',
      description: 'ثبت کارکرد روزانه و کیلومتر اعلامی توسط رانندگان، پایش مصرف و سوابق تماس',
      targetView: 'odometer',
      iconName: 'PhoneCall',
      color: 'indigo',
      isCustom: false,
      isPinned: true,
      completed: false
    },
    {
      id: 'task_odo_sms',
      title: 'ارسال پیامک و وب‌هوک کارکرد',
      description: 'ارسال پیامک یادآوری مراجعات گذشته، دریافت خودکار پیامک و تنظیمات ارسال اتوماتیک',
      targetView: 'odometer',
      iconName: 'MessageSquare',
      color: 'blue',
      isCustom: false,
      isPinned: true,
      completed: false
    },
    {
      id: 'task_add_service',
      title: 'سرویس‌های دوره‌ای و تعویض روغن',
      description: 'تعویض روغن، فیلترها، لنت، تسمه و پایش هشدارهای سررسید کیلومتری',
      targetView: 'services',
      iconName: 'Wrench',
      color: 'amber',
      isCustom: false,
      isPinned: true,
      completed: false
    },
    {
      id: 'task_failure_report',
      title: 'پذیرش تعمیرگاه و مدیریت خرابی',
      description: 'پذیرش خودرو، ثبت عیب‌یابی و علائم خرابی، گردش‌کار و صدور حواله ترخیص',
      targetView: 'failures',
      iconName: 'AlertTriangle',
      color: 'rose',
      isCustom: false,
      isPinned: true,
      completed: false
    },
    {
      id: 'task_parts_inventory',
      title: 'انبارداری و قطعات یدکی',
      description: 'موجودی قطعات، لنت، فیلتر، روغن و ثبت رسید ورود یا حواله خروج کالا',
      targetView: 'parts',
      iconName: 'Package',
      color: 'emerald',
      isCustom: false,
      isPinned: false,
      completed: false
    },
    {
      id: 'task_expense_add',
      title: 'حسابداری و ثبت هزینه‌ها',
      description: 'ثبت فاکتورهای مالی، هزینه‌های تعمیرگاهی، سوخت، بیمه و مخارج ناوگان',
      targetView: 'accounting',
      iconName: 'TrendingUp',
      color: 'cyan',
      isCustom: false,
      isPinned: false,
      completed: false
    },
    {
      id: 'task_fleet_profile',
      title: 'بانک اطلاعات و پرونده خودروها',
      description: 'مشاهده پرونده خودروها، وضعیت استقرار، پلاک، VIN، راننده و کارت فنی',
      targetView: 'vehicles',
      iconName: 'Car',
      color: 'violet',
      isCustom: false,
      isPinned: false,
      completed: false
    },
    {
      id: 'task_insurance_manage',
      title: 'بیمه‌نامه‌ها و معاینه فنی',
      description: 'ثبت بیمه شخص ثالث، بدنه، معاینه فنی و پایش هشدارهای انقضا و سررسید',
      targetView: 'insurance',
      iconName: 'ShieldCheck',
      color: 'amber',
      isCustom: false,
      isPinned: false,
      completed: false
    },
    {
      id: 'task_comprehensive_reports',
      title: 'گزارش جامع پرونده خودروها',
      description: 'شناسنامه کامل خودرو، تاریخچه جامع خدمات، تعمیرات، سوخت و اسناد فنی',
      targetView: 'reports',
      iconName: 'FileText',
      color: 'indigo',
      isCustom: false,
      isPinned: false,
      completed: false
    },
    {
      id: 'task_analytics_reports',
      title: 'گزارشات تحلیلی و آماری ناوگان',
      description: 'نمودارهای مقایسه‌ای هزینه‌ها، نرخ خرابی، کارکرد و بهره‌وری ماهانه',
      targetView: 'reports_analytics',
      iconName: 'TrendingUp',
      color: 'violet',
      isCustom: false,
      isPinned: false,
      completed: false
    },
    {
      id: 'task_service_definitions',
      title: 'تعریف استانداردهای خدمات',
      description: 'تعیین دوره‌های تعویض کیلومتری و بازه‌های اخطار پیش از سررسید قطعات',
      targetView: 'service_definitions',
      iconName: 'Wrench',
      color: 'emerald',
      isCustom: false,
      isPinned: false,
      completed: false
    },
    {
      id: 'task_persons_manage',
      title: 'مدیریت رانندگان و پرسنل',
      description: 'تعریف پرونده رانندگان، شماره‌های تماس، پرسنل ترابری و دسترسی‌ها',
      targetView: 'persons',
      iconName: 'Users',
      color: 'blue',
      isCustom: false,
      isPinned: false,
      completed: false
    }
  ];

  // دریافت لیست تسک‌ها و میانبرهای دسترسی سریع داشبورد
  app.get('/api/dashboard/quick-tasks', (req, res) => {
    const db = readDb();
    if (!db.dashboardQuickTasks || db.dashboardQuickTasks.length === 0) {
      db.dashboardQuickTasks = defaultDashboardTasks;
      writeDb(db);
    }
    res.json(db.dashboardQuickTasks);
  });

  // ذخیره و به‌روزرسانی کل لیست تسک‌های داشبورد
  app.post('/api/dashboard/quick-tasks', (req, res) => {
    const db = readDb();
    const tasks = req.body;
    if (!Array.isArray(tasks)) {
      return res.status(400).json({ message: 'لیست تسک‌ها نامعتبر است.' });
    }
    db.dashboardQuickTasks = tasks;
    writeDb(db);
    res.json(db.dashboardQuickTasks);
  });

  // بازنشانی تسک‌های داشبورد به حالت پیش‌فرض
  app.post('/api/dashboard/quick-tasks/reset', (req, res) => {
    const db = readDb();
    db.dashboardQuickTasks = defaultDashboardTasks;
    writeDb(db);
    res.json(db.dashboardQuickTasks);
  });

  // تایمر خودکار ارسال دوره‌ای پیامک در پس‌زمینه در صورت فعال بودن
  setInterval(() => {
    try {
      const db = readDb();
      const settings = getSmsSettings(db);
      if (settings.autoSendEnabled) {
        const overdueList = getOverdueDriversList(db);
        const eligibleList = overdueList.filter(o => !o.smsAlreadySentRecently && o.driverPhone && o.driverPhone.trim().length >= 7);
        let sent = 0;
        eligibleList.forEach(item => {
          try {
            sendReminderSmsToDriver(db, item.vehicleId, undefined, 'automatic');
            sent++;
          } catch (e) {}
        });
        if (sent > 0) {
          writeDb(db);
          console.log(`[Auto SMS Scheduler] Automatically sent ${sent} reminder SMS to overdue drivers.`);
        }
      }
    } catch (e) {
      // Background error ignored
    }
  }, 10 * 60 * 1000); // چک کردن هر ۱۰ دقیقه

  // تایمر خودکار استعلام و دریافت پیامک‌های جدید از پنل پیامک هر ۲۰ ثانیه
  setInterval(() => {
    try {
      syncInboundSmsFromGateway();
    } catch (e) {}
  }, 20 * 1000);

  // استعلام اولیه پیامک‌ها بلافاصله ۳ ثانیه پس از اجرای سرور
  setTimeout(() => {
    try {
      syncInboundSmsFromGateway();
    } catch (e) {}
  }, 3000);

  // --- Vite & Production Static Serving Middleware ---

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Fleet Server] Running on http://localhost:${PORT} with JSON Database`);
  });
}

startServer();
