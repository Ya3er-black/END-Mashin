/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  User,
  Person,
  Vehicle,
  PeriodicService,
  Insurance,
  TechnicalInspection,
  VehicleFailure,
  RepairWorkflow,
  PartInventory,
  Expense,
  ActivityLog
} from './types';

// کاربران سیستم (برای ورود و دسترسی‌ها)
export const initialUsers: User[] = [
  { 
    id: 1, 
    username: 'admin', 
    fullName: 'مدیر سامانه', 
    role: 'admin', 
    allowedViews: ['dashboard', 'vehicles', 'service_definitions', 'companies', 'persons', 'services', 'failures', 'insurance', 'mechanics', 'parts', 'expenses', 'reports', 'settings', 'logs'], 
    phone: '09120000000', 
    status: 'active', 
    createdAt: '2026-01-01T00:00:00Z' 
  }
];

// اشخاص و پرسنل سازمان (شروع با لیست خالی و تمیز)
export const initialPersons: Person[] = [];

// خودروها (شروع با لیست خالی و تمیز)
export const initialVehicles: Vehicle[] = [];

// سرویس‌های دوره‌ای (شروع با لیست خالی و تمیز)
export const initialPeriodicServices: PeriodicService[] = [];

// بیمه‌نامه‌ها (شروع با لیست خالی و تمیز)
export const initialInsurances: Insurance[] = [];

// معاینه فنی (شروع با لیست خالی و تمیز)
export const initialTechnicalInspections: TechnicalInspection[] = [];

// خرابی‌های ثبت شده (شروع با لیست خالی و تمیز)
export const initialVehicleFailures: VehicleFailure[] = [];

// گردش تعمیرات فعال (شروع با لیست خالی و تمیز)
export const initialRepairWorkflows: RepairWorkflow[] = [];

// مدیریت قطعات و انبار (شروع با لیست خالی و تمیز)
export const initialPartsInventory: PartInventory[] = [];

// لیست هزینه‌ها (شروع با لیست خالی و تمیز)
export const initialExpenses: Expense[] = [];

// لیست لاگ‌های سیستمی فعالیت کاربران
export const initialActivityLogs: ActivityLog[] = [
  { 
    id: 1, 
    userId: 1, 
    username: 'admin', 
    action: 'راه‌اندازی سامانه', 
    actionDetails: 'سامانه مدیریت ناوگان با داده‌های تمیز راه‌اندازی شد.', 
    ipAddress: '127.0.0.1', 
    createdAt: '2026-01-01T00:00:00Z' 
  }
];

