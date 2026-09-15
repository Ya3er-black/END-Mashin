/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Settings, Shield, User, Plus, CheckCircle, XCircle, X, Edit2, 
  Key, Lock, Users, Building, Search, ArrowUpDown, ArrowUp, ArrowDown,
  PhoneCall, ClipboardList, ShieldAlert, Truck, Wrench, Building2,
  UserCog, Package, Wallet, BarChart4, Terminal, LayoutDashboard,
  CheckSquare, Square, ListTodo, Eye, Sparkles, Check, RefreshCw, Car,
  Sun, Moon, Type, Sliders, Palette, RotateCcw, Shapes, Pipette
} from 'lucide-react';
import { motion } from 'motion/react';
import { User as UserType, UserRole, Company } from '../types';
import { toPersianDigits } from '../utils/numberUtils';
import { sortData, SortDirection } from '../utils/sortUtils';
import { Pagination } from './Pagination';
import { CustomSelect } from './CustomSelect';

interface SettingsViewProps {
  users: UserType[];
  companies: Company[];
  onAddUser: (user: Omit<UserType, 'id' | 'createdAt'>) => Promise<void>;
  onEditUser: (id: number, user: Partial<UserType>) => Promise<void>;
  theme?: 'light' | 'dark';
  onThemeChange?: (theme: 'light' | 'dark') => void;
  fontFamily?: string;
  onFontFamilyChange?: (font: string) => void;
  borderRadius?: number;
  onBorderRadiusChange?: (radius: number) => void;
  accentColor?: string;
  onAccentColorChange?: (color: string) => void;
}

// ساختار زیرمجموعه دسترسی
interface PermissionSubTask {
  id: string;
  label: string;
  icon: any;
}

// ساختار گروه یا تسک اصلی دسترسی
interface PermissionTaskGroup {
  id: string;
  label: string;
  icon: any;
  color: string;
  subTasks: PermissionSubTask[];
}

// تعریف سلسله‌مراتبی تسک‌ها و زیرمجموعه‌های دسترسی کاربران در سامانه (تمامی ۲۲ تسک با نام‌های مشخص و ساده)
const PERMISSION_GROUPS: PermissionTaskGroup[] = [
  {
    id: 'grp_odometer',
    label: 'پایش و کارکرد ناوگان',
    icon: PhoneCall,
    color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200/80 dark:border-indigo-500/25',
    subTasks: [
      { id: 'odometer', label: 'استعلام کارکرد و موعد تعویض', icon: PhoneCall },
    ]
  },
  {
    id: 'grp_reception',
    label: 'پذیرش و خدمات فنی',
    icon: Car,
    color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200/80 dark:border-indigo-500/25',
    subTasks: [
      { id: 'services', label: 'سرویس‌های دوره‌ای و نگهداری', icon: Wrench },
      { id: 'failures', label: 'تعمیرات و مدیریت خرابی', icon: ShieldAlert },
      { id: 'insurance', label: 'بیمه‌نامه و معاینه فنی', icon: ClipboardList },
    ]
  },
  {
    id: 'grp_definitions',
    label: 'تعاریف پایه و پرونده‌ها',
    icon: Truck,
    color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200/80 dark:border-indigo-500/25',
    subTasks: [
      { id: 'vehicles', label: 'بانک اطلاعات خودروها', icon: Truck },
      { id: 'service_definitions', label: 'تعاریف و استانداردهای خدمات', icon: ListTodo },
      { id: 'companies', label: 'شرکت‌ها و پروژه‌ها', icon: Building2 },
      { id: 'persons', label: 'پرسنل و رانندگان', icon: Users },
      { id: 'mechanics', label: 'تعمیرکاران و مراکز خدمات', icon: Wrench },
      { id: 'suppliers', label: 'تامین‌کنندگان قطعات و کالا', icon: Building },
    ]
  },
  {
    id: 'grp_logistics',
    label: 'انبارداری و قطعات یدکی',
    icon: Package,
    color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200/80 dark:border-indigo-500/25',
    subTasks: [
      { id: 'parts', label: 'انبار قطعات و حواله مصرف', icon: Package },
    ]
  },
  {
    id: 'grp_finance',
    label: 'امور مالی و حسابداری',
    icon: Wallet,
    color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200/80 dark:border-indigo-500/25',
    subTasks: [
      { id: 'accounting', label: 'حسابداری و ثبت هزینه‌ها', icon: Wallet },
    ]
  },
  {
    id: 'grp_reports',
    label: 'گزارش‌گیری و آمار سازمانی',
    icon: BarChart4,
    color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200/80 dark:border-indigo-500/25',
    subTasks: [
      { id: 'reports', label: 'شناسنامه جامع خودرو', icon: BarChart4 },
      { id: 'reports_analytics', label: 'گزارشات تحلیلی و آماری', icon: Sparkles },
      { id: 'reports_drivers', label: 'گزارش عملکرد رانندگان', icon: Users },
      { id: 'reports_companies', label: 'گزارش تفکیکی شرکت‌ها', icon: Building2 },
      { id: 'reports_failures', label: 'گزارش خرابی‌ها و تعمیرات', icon: ShieldAlert },
      { id: 'reports_services', label: 'گزارش سرویس‌های دوره‌ای', icon: Wrench },
      { id: 'reports_insurance', label: 'گزارش بیمه و معاینه فنی', icon: ClipboardList },
    ]
  },
  {
    id: 'grp_admin',
    label: 'مدیریت سامانه و امنیت',
    icon: Shield,
    color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200/80 dark:border-indigo-500/25',
    subTasks: [
      { id: 'dashboard', label: 'داشبورد مدیریتی', icon: LayoutDashboard },
      { id: 'settings', label: 'تنظیمات سیستم و کاربران', icon: UserCog },
      { id: 'logs', label: 'رویدادنگاری زنده سیستم', icon: Terminal },
    ]
  }
];

// لیست مسطح همه شناسه‌های مجاز
const ALL_SUBTASK_IDS = PERMISSION_GROUPS.flatMap(g => g.subTasks.map(s => s.id));
const SUBTASK_LABEL_MAP: Record<string, string> = Object.fromEntries(
  PERMISSION_GROUPS.flatMap(g => g.subTasks).map(s => [s.id, s.label])
);

// لیست فونت‌های فارسی قابل انتخاب در سامانه
const PERSIAN_FONTS = [
  {
    id: 'iranyekan',
    name: 'ایران یکان (IRANYekan)',
    englishName: 'IRANYekan',
    cssFamily: '"IRANYekanX", "IranYekan", Tahoma, -apple-system, sans-serif',
  },
  {
    id: 'vazir',
    name: 'وزیرمتن (Vazirmatn)',
    englishName: 'Vazirmatn',
    cssFamily: '"Vazirmatn", "Vazir", system-ui, -apple-system, sans-serif',
  },
  {
    id: 'dana',
    name: 'دانا (Dana)',
    englishName: 'Dana',
    cssFamily: '"Dana", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  {
    id: 'iransans',
    name: 'ایران سنس (IRANSans)',
    englishName: 'IRANSans',
    cssFamily: '"IRANSans", "IRANSansX", "IRANSansMobile", -apple-system, sans-serif',
  },
  {
    id: 'yekanbakh',
    name: 'یکان بخ (Yekan Bakh)',
    englishName: 'Yekan Bakh',
    cssFamily: '"Yekan Bakh", "YekanBakh", "Yekan Bakh FaNum", -apple-system, sans-serif',
  },
];

// پالت‌های رنگی اصلی قابل انتخاب در سامانه
const ACCENT_COLOR_OPTIONS = [
  {
    id: 'blue',
    name: 'آبی یاسی',
    colorHex: '#4f46e5',
    secondaryHex: '#6366f1',
  },
  {
    id: 'purple',
    name: 'بنفش رویال',
    colorHex: '#9333ea',
    secondaryHex: '#a855f7',
  },
  {
    id: 'orange',
    name: 'نارنجی',
    colorHex: '#ea580c',
    secondaryHex: '#f97316',
  },
  {
    id: 'green',
    name: 'سبز زمردی',
    colorHex: '#16a34a',
    secondaryHex: '#22c55e',
  },
  {
    id: 'teal',
    name: 'سبز آبی / فیروزه‌ای',
    colorHex: '#0d9488',
    secondaryHex: '#14b8a6',
  },
  {
    id: 'red',
    name: 'قرمز یاقوتی',
    colorHex: '#dc2626',
    secondaryHex: '#ef4444',
  },
  {
    id: 'black',
    name: 'مشکی / زغالی',
    colorHex: '#27272a',
    secondaryHex: '#52525b',
  },
];

// گزینه‌های آماده میزان گردی گوشه‌ها
const RADIUS_PRESETS = [
  { label: '۰px', value: 0 },
  { label: '۴px', value: 4 },
  { label: '۶px', value: 6 },
  { label: '۸px', value: 8 },
  { label: '۱۲px', value: 12 },
  { label: '۱۶px', value: 16 },
  { label: '۲۰px', value: 20 },
];

export default function SettingsView({
  users,
  companies,
  onAddUser,
  onEditUser,
  theme = 'dark',
  onThemeChange,
  fontFamily = 'iranyekan',
  onFontFamilyChange,
  borderRadius = 6,
  onBorderRadiusChange,
  accentColor = 'blue',
  onAccentColorChange
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'general'>('users');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [viewingUserPermissions, setViewingUserPermissions] = useState<UserType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string>('fullName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [customColorInput, setCustomColorInput] = useState<string>(() => accentColor.startsWith('#') ? accentColor : '#d946ef');

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const filteredUsers = users.filter(u => {
    return (
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.company && u.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.phone && u.phone.includes(searchTerm))
    );
  });

  const sortedUsers = sortData(filteredUsers, sortKey, sortDirection);
  const totalPages = Math.ceil(sortedUsers.length / pageSize) || 1;
  const paginatedUsers = sortedUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Form state for User Creation & Access
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [company, setCompany] = useState('');
  const [allowedViews, setAllowedViews] = useState<string[]>([
    'dashboard',
    'odometer',
    'vehicles',
    'services',
    'failures'
  ]);
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const handleOpenCreateForm = () => {
    setEditingUserId(null);
    setUsername('');
    setFullName('');
    setRole('user');
    setCompany('');
    setAllowedViews(['dashboard', 'odometer', 'vehicles', 'services', 'failures']);
    setPhone('');
    setStatus('active');
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (u: UserType) => {
    setEditingUserId(u.id);
    setUsername(u.username);
    setFullName(u.fullName);
    setRole(u.role);
    setCompany(u.company || '');
    setAllowedViews(u.allowedViews || ['dashboard', 'odometer', 'vehicles']);
    setPhone(u.phone || '');
    setStatus(u.status);
    setIsFormOpen(true);
  };

  // تیک زدن یا برداشتن تیک یک زیرمجموعه
  const handleToggleSubTask = (subTaskId: string) => {
    if (allowedViews.includes(subTaskId)) {
      setAllowedViews(allowedViews.filter(id => id !== subTaskId));
    } else {
      setAllowedViews([...allowedViews, subTaskId]);
    }
  };

  // تیک زدن یا برداشتن کل زیرمجموعه‌های یک تسک / گروه اصلی
  const handleToggleGroup = (group: PermissionTaskGroup) => {
    const groupSubIds = group.subTasks.map(s => s.id);
    const allGroupChecked = groupSubIds.every(id => allowedViews.includes(id));

    if (allGroupChecked) {
      // لغو انتخاب تمام زیرمجموعه‌های این تسک
      setAllowedViews(allowedViews.filter(id => !groupSubIds.includes(id)));
    } else {
      // اضافه کردن تمام زیرمجموعه‌های این تسک
      const merged = Array.from(new Set([...allowedViews, ...groupSubIds]));
      setAllowedViews(merged);
    }
  };

  const handleToggleStatus = async (u: UserType) => {
    const newStatus = u.status === 'active' ? 'inactive' : 'active';
    if (confirm(`آیا از ${newStatus === 'active' ? 'فعالسازی' : 'غیرفعالسازی'} حساب کاربر ${u.fullName} اطمینان دارید؟`)) {
      await onEditUser(u.id, { status: newStatus });
    }
  };

  const cleanUsername = username.trim().toLowerCase();
  const isDuplicateUsername = Boolean(
    cleanUsername && users.some(u => u.username.toLowerCase() === cleanUsername && u.id !== editingUserId)
  );
  const isInvalidUsername = cleanUsername.length > 0 && !/^[a-z][a-z0-9_.]*$/.test(cleanUsername);

  const cleanPhone = phone.trim();
  const isDuplicatePhone = Boolean(
    cleanPhone && users.some(u => u.phone && u.phone.trim() === cleanPhone && u.id !== editingUserId)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalUsername = username.trim().toLowerCase();
    const finalFullName = fullName.trim();
    const finalPhone = phone.trim();

    if (!finalUsername || !finalFullName) {
      alert('لطفاً نام کاربری و نام و نام خانوادگی را وارد کنید.');
      return;
    }

    if (!/^[a-z][a-z0-9_.]*$/.test(finalUsername)) {
      alert('نام کاربری فقط می‌تواند شامل حروف کوچک انگلیسی (a-z)، اعداد و نقطه باشد و باید با یک حرف شروع شود.');
      return;
    }

    if (isDuplicateUsername) {
      alert(`نام کاربری «${finalUsername}» تکراری است و قبلاً برای کاربر دیگری در سامانه ثبت شده است.`);
      return;
    }

    if (finalPhone && isDuplicatePhone) {
      alert(`شماره تماس «${toPersianDigits(finalPhone)}» تکراری است و قبلاً برای کاربر دیگری ثبت شده است. امکان ثبت شماره تماس تکراری وجود ندارد.`);
      return;
    }

    const payload = {
      username: finalUsername,
      fullName: finalFullName,
      role,
      company,
      allowedViews: role === 'admin' ? ALL_SUBTASK_IDS : allowedViews,
      phone: finalPhone,
      status
    };

    try {
      if (editingUserId) {
        await onEditUser(editingUserId, payload);
      } else {
        await onAddUser(payload);
      }
      setIsFormOpen(false);
    } catch (err: any) {
      alert(err?.message || 'خطا در ثبت اطلاعات کاربر');
    }
  };

  // فرم ایجاد یا ویرایش کاربر
  if (isFormOpen) {
    return (
      <div className="space-y-6 animate-fadeIn pb-12">
        <div className="bg-white dark:bg-[#111113] rounded-2xl w-full border border-slate-200 dark:border-[#2d2d30] flex flex-col overflow-hidden shadow-2xl">
          
          {/* هدر صفحه فرم */}
          <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                <Key className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-slate-900 dark:text-white text-base font-extrabold flex items-center gap-2">
                  <span>{editingUserId ? 'ویرایش حساب کاربری و دسترسی‌ها' : 'تعریف کاربر جدید با تخصیص دسترسی به تسک‌ها'}</span>
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">مشخصات هویتی، نقش سازمانی و انتخاب دقیق تسک‌های مجاز برای کاربر</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="p-2 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors border border-transparent hover:border-slate-300 dark:hover:border-[#2d2d30] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* فرم اصلی */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6 text-xs bg-white dark:bg-[#111113]">
            
            {/* بخش اول: اطلاعات هویتی و پرسنلی */}
            <div className="space-y-4">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-[#2d2d30]">
                <User className="w-4 h-4 text-indigo-500" />
                <span>مشخصات هویتی و اطلاعات حساب</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    نام کاربری ورود (فقط حروف کوچک انگلیسی): <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: a.hosseini"
                    value={username}
                    onChange={e => {
                      const clean = e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '');
                      setUsername(clean);
                    }}
                    dir="ltr"
                    className={`w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg px-3 py-2 text-xs font-bold font-mono focus:outline-none focus:ring-1 ${
                      isDuplicateUsername || isInvalidUsername
                        ? 'border-rose-500 focus:ring-rose-500 bg-rose-500/5'
                        : 'border-slate-300 dark:border-[#2d2d30] focus:ring-indigo-500'
                    }`}
                  />
                  {isDuplicateUsername ? (
                    <span className="text-[11px] font-bold text-rose-500 flex items-center gap-1 mt-1">
                      <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      این نام کاربری قبلاً ثبت شده است (تکراری مجاز نیست).
                    </span>
                  ) : isInvalidUsername ? (
                    <span className="text-[11px] font-bold text-amber-500 flex items-center gap-1 mt-1">
                      نام کاربری باید با حرف انگلیسی آغاز شود.
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-1">
                      فقط حروف کوچک انگلیسی (a-z)، ارقام و نقطه مجاز است.
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    نام و نام خانوادگی پرسنل: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: علیرضا حسینی"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    شماره تماس مستقیم (یکتا و غیرتکراری)
                  </label>
                  <input
                    type="text"
                    placeholder="09123456789"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    dir="ltr"
                    className={`w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:ring-1 font-mono ${
                      isDuplicatePhone
                        ? 'border-rose-500 focus:ring-rose-500 bg-rose-500/5'
                        : 'border-slate-300 dark:border-[#2d2d30] focus:ring-indigo-500'
                    }`}
                  />
                  {isDuplicatePhone ? (
                    <span className="text-[11px] font-bold text-rose-500 flex items-center gap-1 mt-1">
                      <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      شماره تماس تکراری است و قبلاً برای کاربر دیگری ثبت شده است.
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-1">
                      شماره تماس باید برای هر کاربر یکتا باشد.
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">شرکت یا پروژه مرتبط</label>
                  <CustomSelect
                    value={company}
                    onChange={(val) => setCompany(val)}
                    placeholder="بدون انتساب به شرکت خاص"
                    searchable={true}
                    options={[
                      { value: '', label: 'بدون انتساب به شرکت خاص' },
                      ...companies.map(c => ({ value: c.name, label: c.name }))
                    ]}
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">وضعیت حساب کاربری</label>
                  <CustomSelect
                    value={status}
                    onChange={(val) => setStatus(val as 'active' | 'inactive')}
                    options={[
                      { value: 'active', label: 'فعال (امکان ورود)' },
                      { value: 'inactive', label: 'غیرفعال (مسدود)' }
                    ]}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">سطح نقش کلی در سامانه</label>
                <CustomSelect
                  value={role}
                  onChange={(val) => setRole(val as UserRole)}
                  options={[
                    { value: 'user', label: 'کاربر با دسترسی‌های انتسابی (تعیین تسک‌ها در جدول زیر)' },
                    { value: 'admin', label: 'مدیر ارشد سامانه (دسترسی کامل به تمام تسک‌ها و تنظیمات)' }
                  ]}
                />
              </div>
            </div>

            {/* بخش دوم: تسک‌ها و زیرمجموعه‌های دسترسی کاربر */}
            {role === 'user' ? (
              <div className="space-y-3 pt-2">
                {/* هدر بخش تسک‌ها */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#161619] p-3.5 rounded-xl border border-slate-200 dark:border-[#2d2d30]">
                  <div className="flex items-center gap-2">
                    <ListTodo className="w-4 h-4 text-indigo-500" />
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">دسترسی به تسک‌ها و بخش‌های سیستم</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (allowedViews.length === ALL_SUBTASK_IDS.length) {
                          setAllowedViews([]);
                        } else {
                          setAllowedViews([...ALL_SUBTASK_IDS]);
                        }
                      }}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer py-1 px-1.5 rounded-md"
                    >
                      {allowedViews.length === ALL_SUBTASK_IDS.length ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                      <span>{allowedViews.length === ALL_SUBTASK_IDS.length ? 'لغو انتخاب همه' : 'انتخاب همه'}</span>
                    </button>

                    <span className="text-xs px-3 py-1 bg-indigo-50 dark:bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 font-extrabold rounded-lg border border-indigo-200 dark:border-indigo-500/30 font-mono">
                      {toPersianDigits(allowedViews.length)} از {toPersianDigits(ALL_SUBTASK_IDS.length)} تسک مجاز
                    </span>
                  </div>
                </div>

                {/* ماتریس ساده‌شده و تمیز تسک‌ها */}
                <div className="space-y-3">
                  {PERMISSION_GROUPS.map((group) => {
                    const GroupIcon = group.icon;
                    const groupSubIds = group.subTasks.map(s => s.id);
                    const selectedCount = groupSubIds.filter(id => allowedViews.includes(id)).length;
                    const isAllChecked = groupSubIds.length > 0 && selectedCount === groupSubIds.length;
                    const isPartiallyChecked = selectedCount > 0 && selectedCount < groupSubIds.length;

                    return (
                      <div 
                        key={group.id}
                        className="bg-white dark:bg-[#161619] rounded-xl border border-slate-200 dark:border-[#27272c] overflow-hidden shadow-xs"
                      >
                        {/* سربرگ گروه */}
                        <div className="px-3.5 py-2.5 bg-slate-50/80 dark:bg-[#1c1c21] border-b border-slate-200 dark:border-[#27272c] flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`p-1 rounded-md border ${group.color}`}>
                              <GroupIcon className="w-3.5 h-3.5" />
                            </div>
                            <span className="font-extrabold text-xs text-slate-900 dark:text-white">{group.label}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200/70 dark:bg-[#26262e] text-slate-700 dark:text-slate-300 font-bold">
                              {toPersianDigits(selectedCount)} از {toPersianDigits(group.subTasks.length)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleGroup(group)}
                            className="px-2 py-1 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                          >
                            {isAllChecked ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                            <span>{isAllChecked ? 'لغو انتخاب' : 'انتخاب همه'}</span>
                          </button>
                        </div>

                        {/* لیست تسک‌ها به صورت ساده و پس‌زمینه سفید در تم روشن، بدون کادر و بدون آیکون */}
                        <div className="p-3 bg-white dark:bg-[#161619] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5">
                          {group.subTasks.map((sub) => {
                            const isChecked = allowedViews.includes(sub.id);
                            return (
                              <button
                                type="button"
                                key={sub.id}
                                onClick={() => handleToggleSubTask(sub.id)}
                                className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg bg-white dark:bg-[#161619] hover:bg-slate-50 dark:hover:bg-[#222228] transition-colors cursor-pointer select-none text-right"
                              >
                                <div 
                                  style={{
                                    ...(isChecked ? { backgroundColor: 'var(--primary-600)', borderColor: 'var(--primary-600)' } : {}),
                                    borderRadius: `${Math.min(borderRadius, 6)}px`
                                  }}
                                  className={`w-4 h-4 check-indicator flex items-center justify-center border transition-colors flex-shrink-0 ${
                                    isChecked 
                                      ? 'text-white shadow-2xs' 
                                      : 'border-slate-300 dark:border-slate-600 bg-transparent'
                                  }`}
                                >
                                  {isChecked && <Check className="w-3 h-3 text-white stroke-[3]" />}
                                </div>
                                <span className={`text-xs truncate ${isChecked ? 'font-bold text-slate-950 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-400'}`}>
                                  {sub.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-500 dark:text-amber-400 text-xs flex items-center gap-2 font-bold">
                <Shield className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0" />
                <span>نقش «مدیر کل سیستم» انتخاب شده است. این حساب به صورت خودکار به تمام تسک‌ها و امکانات سامانه دسترسی کامل خواهد داشت.</span>
              </div>
            )}

            {/* دکمه‌های ثبت و انصراف */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-[#2d2d30]">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-400 font-bold rounded-lg transition-colors border border-slate-200 dark:border-[#2d2d30] text-xs cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={isDuplicateUsername || isInvalidUsername || isDuplicatePhone}
                className={`px-6 py-2 font-bold rounded-lg transition-colors active:scale-95 text-xs shadow-lg shadow-indigo-600/20 ${
                  isDuplicateUsername || isInvalidUsername || isDuplicatePhone
                    ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                }`}
              >
                {editingUserId ? 'ذخیره تغییرات کاربر' : 'ایجاد حساب کاربری'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300 pb-12">
      {/* هدر بخش تنظیمات و مدیریت کاربران */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-[#111113] p-4 rounded-lg border border-slate-200 dark:border-[#2d2d30]">
        <div>
          <h1 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings 
              style={{ color: 'var(--primary-600)' }}
              className="w-4 h-4" 
            />
            <span>تنظیمات سیستم و مدیریت کاربران</span>
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            مدیریت دسترسی‌های تفکیکی کاربران به تسک‌ها و زیرمجموعه‌ها، تعریف حساب‌های کاربری و شخصی‌سازی ظاهر سامانه
          </p>
        </div>
        {activeTab === 'users' && (
          <button 
            type="button"
            onClick={handleOpenCreateForm} 
            style={{ backgroundColor: 'var(--primary-600)', color: '#ffffff' }}
            className="text-white !text-white font-bold px-3 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto shadow-xs hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5 text-white stroke-[2.5]" stroke="#ffffff" />
            <span className="text-white !text-white">تعریف کاربر جدید</span>
          </button>
        )}
      </div>

      {/* تب‌های جابجایی بین بخش‌ها با ترنزیشن نرم و متحرک */}
      <div className="flex border-b border-slate-200 dark:border-[#2d2d30] gap-2 overflow-x-auto relative">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          style={activeTab === 'users' ? { color: 'var(--primary-600)' } : undefined}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'users'
              ? ''
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>مدیریت کاربران و دسترسی‌ها</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 font-mono font-bold">
            {toPersianDigits(users.length)}
          </span>
          {activeTab === 'users' && (
            <motion.div
              layoutId="activeSettingsTabIndicator"
              style={{ backgroundColor: 'var(--primary-600)' }}
              className="absolute bottom-0 right-0 left-0 h-0.5 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('general')}
          style={activeTab === 'general' ? { color: 'var(--primary-600)' } : undefined}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'general'
              ? ''
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>اطلاعات عمومی و ظاهر سامانه</span>
          {activeTab === 'general' && (
            <motion.div
              layoutId="activeSettingsTabIndicator"
              style={{ backgroundColor: 'var(--primary-600)' }}
              className="absolute bottom-0 right-0 left-0 h-0.5 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>
      </div>

      {activeTab === 'users' ? (
        <div className="space-y-3 animate-in fade-in duration-300">
          {/* نوار جستجوی کاربران مشابه بخش پذیرش */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="جستجوی نام، نام کاربری، شرکت مرتبط یا شماره تماس..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full h-[34px] bg-white dark:bg-[#111113] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg pr-9 pl-8 text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="پاک کردن جستجو"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* جدول لیست کاربران کاملاً مطابق با سبک و تایپوگرافی جدول پذیرش */}
          <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex justify-between items-center">
              <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
                <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>لیست حساب‌های کاربری و دسترسی‌ها</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hidden sm:flex items-center gap-1">
                  <UserCog className="w-3 h-3" />
                  جهت ویرایش هر کاربر روی ردیف آن کلیک کنید
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  {toPersianDigits(sortedUsers.length)} کاربر
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] text-slate-600 dark:text-slate-400 font-medium text-xs">
                    <th className="py-2 px-3 text-center w-12 text-xs font-medium">ردیف</th>
                    <th 
                      onClick={() => handleSort('fullName')}
                      className="py-2 px-3 cursor-pointer select-none hover:text-slate-950 dark:hover:text-white transition-colors text-xs font-medium"
                      title="کلیک برای مرتب‌سازی"
                    >
                      <div className="flex items-center gap-1">
                        <span>نام و نام کاربری</span>
                        {sortKey === 'fullName' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('role')}
                      className="py-2 px-3 w-28 cursor-pointer select-none hover:text-slate-950 dark:hover:text-white transition-colors text-xs font-medium"
                      title="کلیک برای مرتب‌سازی"
                    >
                      <div className="flex items-center gap-1">
                        <span>نقش</span>
                        {sortKey === 'role' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th className="py-2 px-3 text-xs font-medium">تسک‌ها و زیرمجموعه‌های مجاز</th>
                    <th className="py-2 px-3 w-36 text-xs font-medium">شرکت مرتبط</th>
                    <th className="py-2 px-3 w-32 text-xs font-medium">شماره تماس</th>
                    <th className="py-2 px-3 text-center w-24 text-xs font-medium">وضعیت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
                  {paginatedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500 text-[11px]">
                        هیچ کاربری با این مشخصات یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map((u, index) => {
                      const userViews = u.role === 'admin' ? ALL_SUBTASK_IDS : (u.allowedViews || []);
                      return (
                        <tr 
                          key={u.id} 
                          onClick={() => handleOpenEditForm(u)}
                          title="برای مشاهده و ویرایش مشخصات و دسترسی‌های این کاربر کلیک کنید"
                          className="h-9 hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/60 transition-colors cursor-pointer text-[11px]"
                        >
                          <td className="py-1 px-3 text-center text-slate-500 text-[11px] align-middle">
                            {toPersianDigits((currentPage - 1) * pageSize + index + 1)}
                          </td>
                          <td className="py-1 px-3 whitespace-nowrap align-middle">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-900 dark:text-white text-[11px]">
                                {u.fullName}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                (@{u.username})
                              </span>
                            </div>
                          </td>
                          <td className="py-1 px-3 whitespace-nowrap align-middle">
                            <span className="text-slate-700 dark:text-slate-300 text-[11px]">
                              {u.role === 'admin' ? 'مدیر ارشد' : 'کاربر پرسنل'}
                            </span>
                          </td>
                          <td className="py-1 px-3 align-middle">
                            <div className="flex items-center gap-1.5 truncate max-w-xs md:max-w-md">
                              <span className="h-[20px] px-1.5 inline-flex items-center justify-center rounded text-[10px] bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20 whitespace-nowrap shrink-0">
                                <span>{u.role === 'admin' ? 'دسترسی کامل' : `${toPersianDigits(userViews.length)} مورد`}</span>
                              </span>
                              <span className="text-[11px] text-slate-700 dark:text-slate-300 truncate">
                                {u.role === 'admin' 
                                  ? 'تمامی بخش‌ها و تسک‌های سیستم' 
                                  : userViews.map(id => SUBTASK_LABEL_MAP[id] || id).join('، ')}
                              </span>
                            </div>
                          </td>
                          <td className="py-1 px-3 whitespace-nowrap align-middle text-slate-700 dark:text-slate-300 text-[11px]">
                            {u.company || 'تعیین نشده'}
                          </td>
                          <td className="py-1 px-3 whitespace-nowrap align-middle font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                            {u.phone ? toPersianDigits(u.phone) : 'ثبت نشده'}
                          </td>
                          <td className="py-1 px-3 text-center align-middle whitespace-nowrap">
                            <span className="text-[11px] text-slate-700 dark:text-slate-300">
                              {u.status === 'active' ? 'فعال' : 'غیرفعال'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filteredUsers.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* هدر بخش تنظیمات عمومی و شخصی‌سازی ظاهر سامانه */}
          <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-lg p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 dark:border-[#2d2d30] pb-4">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Palette className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  اطلاعات عمومی و شخصی‌سازی ظاهر سامانه
                </h2>
              </div>

              {/* دکمه بازنشانی تنظیمات به پیش‌فرض */}
              <button
                type="button"
                onClick={() => {
                  onThemeChange?.('dark');
                  onAccentColorChange?.('blue');
                  onFontFamilyChange?.('iranyekan');
                  onBorderRadiusChange?.(4);
                }}
                className="px-3 py-1.5 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-300 font-bold rounded-md transition-colors border border-slate-200 dark:border-[#2d2d30] text-[11px] flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                title="بازنشانی تمام تنظیمات دیداری به حالت پیش‌فرض سامانه"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>بازنشانی به پیش‌فرض</span>
              </button>
            </div>

            {/* بخش ۱: تنظیم حالت تم (روشن / تیره) */}
            <div className="pt-2 pb-5 space-y-3">
              <h3 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Sun className="w-4 h-4 text-amber-500" />
                <span>حالت قالب سامانه (روشن / تیره)</span>
              </h3>

              <div className="flex flex-wrap items-center gap-2">
                {/* دکمه حالت روشن */}
                <button
                  type="button"
                  onClick={() => onThemeChange?.('light')}
                  style={theme === 'light' ? {
                    backgroundColor: 'var(--primary-600)',
                    borderColor: 'var(--primary-600)',
                    color: '#ffffff',
                    borderRadius: `${borderRadius}px`
                  } : {
                    borderRadius: `${borderRadius}px`
                  }}
                  className={`px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 border ${
                    theme === 'light'
                      ? ''
                      : 'bg-white dark:bg-[#161619] hover:bg-slate-100 dark:hover:bg-[#202026] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2d2d30]'
                  }`}
                >
                  <Sun className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-white' : 'text-amber-500'}`} />
                  <span>حالت روشن</span>
                </button>

                {/* دکمه حالت تیره */}
                <button
                  type="button"
                  onClick={() => onThemeChange?.('dark')}
                  style={theme === 'dark' ? {
                    backgroundColor: 'var(--primary-600)',
                    borderColor: 'var(--primary-600)',
                    color: '#ffffff',
                    borderRadius: `${borderRadius}px`
                  } : {
                    borderRadius: `${borderRadius}px`
                  }}
                  className={`px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 border ${
                    theme === 'dark'
                      ? ''
                      : 'bg-white dark:bg-[#161619] hover:bg-slate-100 dark:hover:bg-[#202026] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2d2d30]'
                  }`}
                >
                  <Moon className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-white' : 'text-indigo-400'}`} />
                  <span>حالت تیره</span>
                </button>
              </div>
            </div>

            {/* بخش ۲: انتخاب پالت رنگ اصلی سامانه (Theme Accent Color) */}
            <div className="pt-5 pb-5 border-t border-slate-200 dark:border-[#2d2d30] space-y-3">
              <h3 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Palette 
                  style={{ color: 'var(--primary-600)' }}
                  className="w-4 h-4" 
                />
                <span>رنگ و تم سامانه (Accent Color)</span>
              </h3>

              <div className="flex flex-wrap items-center gap-2">
                {ACCENT_COLOR_OPTIONS.map(color => {
                  const isSelected = accentColor === color.id;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => onAccentColorChange?.(color.id)}
                      style={isSelected ? {
                        backgroundColor: 'var(--primary-600)',
                        borderColor: 'var(--primary-600)',
                        color: '#ffffff',
                        borderRadius: `${borderRadius}px`
                      } : {
                        borderRadius: `${borderRadius}px`
                      }}
                      className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 border ${
                        isSelected
                          ? ''
                          : 'bg-white dark:bg-[#161619] hover:bg-slate-100 dark:hover:bg-[#202026] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2d2d30]'
                      }`}
                    >
                      <span 
                        className={`w-3 h-3 rounded-full shrink-0 border ${isSelected ? 'border-white/70' : 'border-black/20'}`}
                        style={{ backgroundColor: color.colorHex }}
                      />
                      <span>{color.name}</span>
                    </button>
                  );
                })}

                {/* دکمه انتخاب رنگ دلخواه */}
                <label
                  style={accentColor.startsWith('#') ? {
                    backgroundColor: 'var(--primary-600)',
                    borderColor: 'var(--primary-600)',
                    color: '#ffffff',
                    borderRadius: `${borderRadius}px`
                  } : {
                    borderRadius: `${borderRadius}px`
                  }}
                  className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 border ${
                    accentColor.startsWith('#')
                      ? ''
                      : 'bg-white dark:bg-[#161619] hover:bg-slate-100 dark:hover:bg-[#202026] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2d2d30]'
                  }`}
                  title="کلیک برای انتخاب رنگ سفارشی دلخواه"
                >
                  <input 
                    type="color"
                    value={accentColor.startsWith('#') ? accentColor : (customColorInput || '#d946ef')}
                    onChange={e => {
                      setCustomColorInput(e.target.value);
                      onAccentColorChange?.(e.target.value);
                    }}
                    className="sr-only"
                  />
                  <span 
                    className={`w-3 h-3 rounded-full shrink-0 flex items-center justify-center border ${accentColor.startsWith('#') ? 'border-white/70' : 'border-black/20'}`}
                    style={{ backgroundColor: accentColor.startsWith('#') ? accentColor : (customColorInput || '#d946ef') }}
                  >
                    <Pipette className="w-2 h-2 text-white drop-shadow-sm" />
                  </span>
                  <span>رنگ دلخواه</span>
                </label>
              </div>
            </div>

            {/* بخش ۳: انتخاب فونت سامانه */}
            <div className="pt-5 pb-5 border-t border-slate-200 dark:border-[#2d2d30] space-y-3">
              <h3 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Type 
                  style={{ color: 'var(--primary-600)' }}
                  className="w-4 h-4" 
                />
                <span>فونت قلم سامانه (Font Family)</span>
              </h3>

              <div className="flex flex-wrap items-center gap-2">
                {PERSIAN_FONTS.map(font => {
                  const isSelected = fontFamily === font.id;
                  return (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => onFontFamilyChange?.(font.id)}
                      style={isSelected ? {
                        backgroundColor: 'var(--primary-600)',
                        borderColor: 'var(--primary-600)',
                        color: '#ffffff',
                        borderRadius: `${borderRadius}px`,
                        fontFamily: font.cssFamily
                      } : {
                        borderRadius: `${borderRadius}px`,
                        fontFamily: font.cssFamily
                      }}
                      className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer border ${
                        isSelected
                          ? ''
                          : 'bg-white dark:bg-[#161619] hover:bg-slate-100 dark:hover:bg-[#202026] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2d2d30]'
                      }`}
                    >
                      {font.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* بخش ۴: تنظیم میزان گردی گوشه‌ها در تم (Border Radius) */}
            <div className="pt-5 pb-5 border-t border-slate-200 dark:border-[#2d2d30] space-y-3">
              <h3 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Shapes 
                  style={{ color: 'var(--primary-600)' }}
                  className="w-4 h-4" 
                />
                <span>میزان گردی گوشه‌ها (Border Radius)</span>
              </h3>

              {/* گزینه‌های سریع گردی */}
              <div className="flex flex-wrap items-center gap-2">
                {RADIUS_PRESETS.map(preset => {
                  const isActive = borderRadius === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => onBorderRadiusChange?.(preset.value)}
                      style={isActive ? {
                        backgroundColor: 'var(--primary-600)',
                        borderColor: 'var(--primary-600)',
                        color: '#ffffff',
                        borderRadius: `${preset.value}px`
                      } : {
                        borderRadius: `${preset.value}px`
                      }}
                      className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer border ${
                        isActive
                          ? ''
                          : 'bg-white dark:bg-[#161619] hover:bg-slate-100 dark:hover:bg-[#202026] hover:border-slate-400 dark:hover:border-slate-500 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2d2d30]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* مودال مشاهده جزئیات تسک‌ها و زیرمجموعه‌های مجاز کاربر */}
      {viewingUserPermissions && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141417] border border-slate-200 dark:border-[#2d2d30] rounded-2xl w-full max-w-xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 dark:border-[#2d2d30] flex items-center justify-between bg-slate-50/90 dark:bg-[#19191d]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/30">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>دسترسی‌های فعال کاربر: {viewingUserPermissions.fullName}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-500/30">
                      @{viewingUserPermissions.username}
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">لیست تسک‌های اصلی و زیرمجموعه‌هایی که این کاربر به آن‌ها دسترسی دارد</p>
                </div>
              </div>
              <button
                onClick={() => setViewingUserPermissions(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#25252a] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar space-y-3.5 text-xs bg-white dark:bg-[#141417]">
              {PERMISSION_GROUPS.map(group => {
                const GroupIcon = group.icon;
                const groupSubIds = group.subTasks.map(s => s.id);
                const userViews = viewingUserPermissions.role === 'admin' ? ALL_SUBTASK_IDS : (viewingUserPermissions.allowedViews || []);
                const allowedInGroup = group.subTasks.filter(s => userViews.includes(s.id));

                if (allowedInGroup.length === 0) return null;

                return (
                  <div key={group.id} className="bg-white dark:bg-[#19191e] p-3.5 rounded-xl border border-slate-200 dark:border-[#2d2d35] space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-[#262630]">
                      <div className="flex items-center gap-2">
                        <div className={`p-1 rounded-md border ${group.color}`}>
                          <GroupIcon className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-extrabold text-slate-900 dark:text-white text-xs">{group.label}</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-[#25252d] text-indigo-600 dark:text-indigo-300 font-bold border border-slate-200 dark:border-transparent">
                        {toPersianDigits(allowedInGroup.length)} زیرمجموعه مجاز
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 pt-1">
                      {allowedInGroup.map(sub => (
                        <div key={sub.id} className="py-1 px-1.5 flex items-center gap-2 text-slate-700 dark:text-slate-200">
                          <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                          <span className="font-medium text-xs truncate">{sub.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161619] flex justify-end">
              <button
                type="button"
                onClick={() => setViewingUserPermissions(null)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
