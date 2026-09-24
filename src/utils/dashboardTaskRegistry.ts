/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Wrench, ShieldAlert, Shield, Car, Settings, AlertOctagon, 
  Building2, Users, Store, FileSpreadsheet, PhoneCall, Bell, 
  Wallet, Package, FileText, BarChart4, ClipboardList, Building, 
  UserCog, Terminal
} from 'lucide-react';

export interface TaskDefinition {
  id: string;
  label: string;
  category: string;
  description: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>;
}

export const ALL_SIDEBAR_TASKS: TaskDefinition[] = [
  // ۱. پذیرش خودرو
  {
    id: 'services',
    label: 'ثبت سرویس دوره‌ای',
    category: 'پذیرش خودرو',
    description: 'ثبت روغن، فیلترها، لنت، تسمه تایم و پایش هشدارهای سررسید کیلومتری',
    icon: Wrench
  },
  {
    id: 'failures',
    label: 'ثبت گزارش خرابی',
    category: 'پذیرش خودرو',
    description: 'پذیرش خودرو در تعمیرگاه، ثبت عیب‌یابی، تخصیص مکانیک و حواله ترخیص',
    icon: ShieldAlert
  },
  {
    id: 'insurance',
    label: 'بیمه‌نامه و معاینه فنی',
    category: 'پذیرش خودرو',
    description: 'پایش موعد انقضای ثالث، بدنه و کارت معاینه فنی با آستانه هشدار خودکار',
    icon: Shield
  },

  // ۲. عملیات ناوگان
  {
    id: 'odometer',
    label: 'استعلام کارکرد',
    category: 'عملیات پایش',
    description: 'ثبت کیلومتر روزانه، پیش‌بینی موعد تعویض و تماس با رانندگان',
    icon: PhoneCall
  },
  {
    id: 'reminders',
    label: 'یادآوری‌ها و پیگیری‌ها',
    category: 'عملیات پایش',
    description: 'مدیریت وظایف موعددار، یادآوری‌های تمدید و تماس‌های دوره‌ای',
    icon: Bell
  },
  {
    id: 'accounting',
    label: 'حسابداری و مالی',
    category: 'مالی و اسناد',
    description: 'ثبت فاکتورهای مالی، هزینه‌های تعمیرات، سوخت و تحلیل مخارج ناوگان',
    icon: Wallet
  },
  {
    id: 'parts',
    label: 'انبارداری و قطعات',
    category: 'انبار و کالا',
    description: 'موجودی قطعات یدکی، ثبت رسید خرید ورود به انبار و صدور حواله مصرف',
    icon: Package
  },

  // ۳. تعاریف پایه
  {
    id: 'vehicles',
    label: 'تعریف خودروها',
    category: 'تعاریف پایه',
    description: 'بانک پرونده خودروها، مشخصات فنی، راننده، VIN و محل استقرار',
    icon: Car
  },
  {
    id: 'service_definitions',
    label: 'تعاریف سرویس‌ها',
    category: 'تعاریف پایه',
    description: 'استانداردهای کیلومتری و آستانه هشدارهای سرویس برای انواع خودروها',
    icon: Settings
  },
  {
    id: 'failure_definitions',
    label: 'تعریف خرابی‌ها',
    category: 'تعاریف پایه',
    description: 'دسته‌بندی و تعریف عیوب فنی متداول جهت تسریع در پذیرش تعمیرگاه',
    icon: AlertOctagon
  },
  {
    id: 'companies',
    label: 'تعریف شرکت‌ها',
    category: 'تعاریف پایه',
    description: 'شرکت‌های تحت پوشش ناوگان یا مراکز هزینه و تفکیک خودروها',
    icon: Building2
  },
  {
    id: 'persons',
    label: 'تعریف رانندگان',
    category: 'تعاریف پایه',
    description: 'اطلاعات پرسنلی رانندگان، گواهینامه، شماره تماس و سوابق رانندگی',
    icon: Users
  },
  {
    id: 'mechanics',
    label: 'تعریف تعمیرکاران',
    category: 'تعاریف پایه',
    description: 'تعمیرگاه‌ها، پیمانکاران فنی و استادکاران طرف قرارداد سامانه',
    icon: Wrench
  },
  {
    id: 'suppliers',
    label: 'تعریف تامین‌کنندگان',
    category: 'تعاریف پایه',
    description: 'فروشگاه‌ها و تامین‌کنندگان قطعات یدکی و لوازم مصرفی خودروها',
    icon: Store
  },
  {
    id: 'definitions_excel_import',
    label: 'ورود تعاریف از اکسل',
    category: 'تعاریف پایه',
    description: 'درون‌ریزی سریع اطلاعات پایه خودروها و قطعات از فایل اکسل',
    icon: FileSpreadsheet
  },

  // ۴. گزارش‌گیری
  {
    id: 'reports',
    label: 'گزارش جامع ناوگان',
    category: 'گزارش‌گیری',
    description: 'شناسنامه جامع خودرو، سوابق سرویس و تعمیرات و خروجی چاپی',
    icon: FileText
  },
  {
    id: 'reports_analytics',
    label: 'تحلیل آماری و هزینه‌ها',
    category: 'گزارش‌گیری',
    description: 'نمودار مخارج، تراز مالی و مقایسه دوره‌ای هزینه‌های جاری ناوگان',
    icon: BarChart4
  },
  {
    id: 'reports_drivers',
    label: 'کارکرد و هزینه‌های رانندگان',
    category: 'گزارش‌گیری',
    description: 'پایش پیمایش، مخارج و سوابق رانندگان ناوگان',
    icon: Users
  },
  {
    id: 'reports_failures',
    label: 'گزارش خرابی‌ها و تعمیرات',
    category: 'گزارش‌گیری',
    description: 'تحلیل فراوانی عیوب فنی، مدت زمان خواب خودرو در تعمیرگاه و مخارج',
    icon: ShieldAlert
  },
  {
    id: 'reports_companies',
    label: 'گزارش تحلیلی شرکت‌ها',
    category: 'گزارش‌گیری',
    description: 'تسهیم هزینه‌ها و عملکرد ناوگان به تفکیک شرکت‌های تابعه',
    icon: Building
  },
  {
    id: 'reports_services',
    label: 'گزارش وضعیت سرویس‌ها',
    category: 'گزارش‌گیری',
    description: 'سوابق سرویس‌های انجام شده و پایش اقلام نیازمند اقدام در ناوگان',
    icon: ClipboardList
  },
  {
    id: 'reports_insurance',
    label: 'گزارش و یادآور بیمه‌ها',
    category: 'گزارش‌گیری',
    description: 'جدول کامل بیمه‌نامه‌ها، معاینه فنی و زمان‌بندی تمدید',
    icon: Shield
  },

  // ۵. مدیریت سیستم
  {
    id: 'settings',
    label: 'مدیریت کاربران و تنظیمات',
    category: 'مدیریت سیستم',
    description: 'سطوح دسترسی، نقش‌های کاربران و تنظیمات عمومی سامانه',
    icon: UserCog
  },
  {
    id: 'logs',
    label: 'رویدادنگاری زنده سیستم',
    category: 'مدیریت سیستم',
    description: 'ثبت و پایش وقایع، لاگ‌های امنیتی و تغییرات لحظه‌ای در سیستم',
    icon: Terminal
  }
];

export function getTaskById(taskId: string): TaskDefinition | undefined {
  return ALL_SIDEBAR_TASKS.find(t => t.id === taskId);
}
