/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Gauge, PhoneCall, MessageSquare, Wrench, AlertTriangle, Package, 
  TrendingUp, ShieldCheck, Car, FileText, Send, Layers, Plus, 
  Trash2, Pin, ArrowLeft, ArrowUpRight, Sparkles, 
  RotateCcw, X, Edit3, Check, Search, ExternalLink, Users, 
  Settings, Activity, BarChart3, ChevronDown, ChevronUp, SlidersHorizontal, Cog
} from 'lucide-react';
import { DashboardQuickTask } from '../types';
import { toPersianDigits } from '../utils/numberUtils';

interface DashboardQuickTasksSectionProps {
  onNavigate: (view: string) => void;
}

const AVAILABLE_ICONS = [
  { name: 'PhoneCall', label: 'استعلام تلفنی', icon: PhoneCall },
  { name: 'MessageSquare', label: 'پیامک و وب‌هوک', icon: MessageSquare },
  { name: 'Gauge', label: 'کیلومترشمار', icon: Gauge },
  { name: 'Wrench', label: 'سرویس و نگهداری', icon: Wrench },
  { name: 'AlertTriangle', label: 'خرابی و تعمیرگاه', icon: AlertTriangle },
  { name: 'Package', label: 'انبار و قطعات', icon: Package },
  { name: 'TrendingUp', label: 'هزینه و مالی', icon: TrendingUp },
  { name: 'Car', label: 'پرونده ناوگان', icon: Car },
  { name: 'ShieldCheck', label: 'بیمه و معاینه', icon: ShieldCheck },
  { name: 'FileText', label: 'گزارش جامع', icon: FileText },
  { name: 'BarChart3', label: 'گزارش تحلیلی', icon: TrendingUp },
  { name: 'Users', label: 'رانندگان و پرسنل', icon: Users },
  { name: 'Settings', label: 'تنظیمات و دسترسی', icon: Settings },
  { name: 'Activity', label: 'رویدادنگاری زنده', icon: Activity },
  { name: 'Send', label: 'ارسال پیامک', icon: Send },
  { name: 'Layers', label: 'سایر بخش‌ها', icon: Layers }
];

export const SYSTEM_SECTIONS = [
  { 
    id: 'odometer', 
    name: 'استعلام کارکرد رانندگان و پیش‌بینی سرویس', 
    category: 'پایش و استعلام', 
    badge: 'استعلام کارکرد',
    description: 'تماس تلفنی با رانندگان، ثبت کیلومتر، ارسال پیامک یادآوری و ماتریس سلامت قطعات' 
  },
  { 
    id: 'services', 
    name: 'سرویس‌های دوره‌ای و نگهداری', 
    category: 'فنی و نگهداری', 
    badge: 'سرویس‌های دوره‌ای',
    description: 'ثبت تعویض روغن، فیلترها، لنت، تسمه تایم و پایش هشدارهای سررسید کیلومتری' 
  },
  { 
    id: 'failures', 
    name: 'پذیرش تعمیرگاه و مدیریت خرابی', 
    category: 'فنی و نگهداری', 
    badge: 'تعمیرات و خرابی',
    description: 'پذیرش خودرو، ثبت عیب‌یابی، تخصیص مکانیک، صدور قطعات و حواله ترخیص نهایی' 
  },
  { 
    id: 'parts', 
    name: 'انبارداری و قطعات یدکی', 
    category: 'انبار و کالا', 
    badge: 'انبار قطعات',
    description: 'مدیریت موجودی قطعات، ثبت رسید خرید ورود به انبار و صدور حواله خروج قطعه' 
  },
  { 
    id: 'accounting', 
    name: 'حسابداری و ثبت هزینه‌ها', 
    category: 'مالی و اسناد', 
    badge: 'حسابداری و مخارج',
    description: 'ثبت فاکتورهای مالی، هزینه‌های تعمیرگاهی، سوخت، بیمه و تحلیل مخارج ناوگان' 
  },
  { 
    id: 'vehicles', 
    name: 'بانک اطلاعات و پرونده خودروها', 
    category: 'اطلاعات پایه', 
    badge: 'پرونده خودروها',
    description: 'شناسنامه خودروها، مشخصات فنی، وضعیت استقرار، پلاک، VIN و کارت ماشین' 
  },
  { 
    id: 'insurance', 
    name: 'بیمه‌نامه‌ها و معاینه فنی', 
    category: 'اسناد قانونی', 
    badge: 'بیمه و معاینه',
    description: 'ثبت بیمه شخص ثالث، بدنه، معاینه فنی و پایش هشدارهای سررسید انقضا' 
  },
  { 
    id: 'service_definitions', 
    name: 'تعریف استانداردهای خدمات', 
    category: 'اطلاعات پایه', 
    badge: 'تعاریف خدمات',
    description: 'تعیین دوره‌های تعویض کیلومتری استاندارد و بازه‌های اخطار پیش از موعد' 
  },
  { 
    id: 'persons', 
    name: 'مدیریت رانندگان و پرسنل', 
    category: 'اطلاعات پایه', 
    badge: 'رانندگان و پرسنل',
    description: 'پرونده رانندگان، شماره‌های تماس، پرسنل ترابری و انتساب خودرو' 
  },
  { 
    id: 'mechanics', 
    name: 'مدیریت تعمیرکاران و پیمانکاران', 
    category: 'اطلاعات پایه', 
    badge: 'تعمیرکاران',
    description: 'بانک اطلاعات تعمیرگاه‌ها، استادکاران، شماره‌های تماس و تخصص‌ها' 
  },
  { 
    id: 'companies', 
    name: 'مدیریت شرکت‌ها و پروژه‌ها', 
    category: 'اطلاعات پایه', 
    badge: 'شرکت‌ها و پروژه‌ها',
    description: 'تعریف شرکت‌های مادر، پروژه‌های تابعه و تفکیک مالکیت خودروها' 
  },
  { 
    id: 'reports', 
    name: 'گزارش جامع پرونده خودروها', 
    category: 'گزارشات', 
    badge: 'گزارش جامع',
    description: 'شناسنامه تجمیعی هر خودرو، تاریخچه کامل خدمات، تعمیرات، سوخت و اسناد' 
  },
  { 
    id: 'reports_analytics', 
    name: 'گزارشات تحلیلی و آماری ناوگان', 
    category: 'گزارشات', 
    badge: 'گزارش تحلیلی',
    description: 'نمودارهای مقایسه‌ای هزینه‌ها، نرخ خرابی، کارکرد ماهانه و شاخص‌های بهره‌وری' 
  },
  { 
    id: 'reports_drivers', 
    name: 'گزارش عملکرد و کارکرد رانندگان', 
    category: 'گزارشات', 
    badge: 'گزارش رانندگان',
    description: 'پایش پیمایش، نظم استعلام کارکرد و ارزیابی رفتاری رانندگان' 
  },
  { 
    id: 'reports_failures', 
    name: 'گزارش تخصصی خرابی‌ها و توقفات', 
    category: 'گزارشات', 
    badge: 'گزارش خرابی‌ها',
    description: 'تحلیل علل تکرارشونده خرابی‌ها، زمان خواب خودرو و هزینه‌های تعمیراتی' 
  },
  { 
    id: 'settings', 
    name: 'تنظیمات سیستم و دسترسی کاربران', 
    category: 'مدیریت سیستم', 
    badge: 'تنظیمات و دسترسی',
    description: 'مدیریت کاربران، سطوح دسترسی بر اساس نقش، شرکت و کنترل مجوزها' 
  },
  { 
    id: 'logs', 
    name: 'رویدادنگاری زنده سیستم', 
    category: 'مدیریت سیستم', 
    badge: 'لاگ فعالیت‌ها',
    description: 'مشاهده لاگ‌های امنیتی، ثبت ورود، تغییرات داده‌ها و پیامک‌های ارسالی' 
  }
];

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; badgeBg: string; hoverBorder: string; lightBg: string; buttonBg: string; buttonHover: string; solidBg: string }> = {
  indigo: { 
    bg: 'bg-indigo-50 dark:bg-indigo-500/10', 
    text: 'text-indigo-600 dark:text-indigo-400', 
    border: 'border-indigo-200 dark:border-indigo-500/20', 
    badgeBg: 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/20', 
    hoverBorder: 'hover:border-indigo-400 dark:hover:border-indigo-500/50', 
    lightBg: 'bg-indigo-50 dark:bg-indigo-500/10',
    buttonBg: 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white',
    buttonHover: 'group-hover:bg-indigo-600 group-hover:text-white',
    solidBg: 'bg-indigo-600'
  },
  violet: { 
    bg: 'bg-violet-50 dark:bg-violet-500/10', 
    text: 'text-violet-600 dark:text-violet-400', 
    border: 'border-violet-200 dark:border-violet-500/20', 
    badgeBg: 'bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-500/20', 
    hoverBorder: 'hover:border-violet-400 dark:hover:border-violet-500/50', 
    lightBg: 'bg-violet-50 dark:bg-violet-500/10',
    buttonBg: 'bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 hover:bg-violet-600 hover:text-white',
    buttonHover: 'group-hover:bg-violet-600 group-hover:text-white',
    solidBg: 'bg-violet-600'
  },
  emerald: { 
    bg: 'bg-emerald-50 dark:bg-emerald-500/10', 
    text: 'text-emerald-600 dark:text-emerald-400', 
    border: 'border-emerald-200 dark:border-emerald-500/20', 
    badgeBg: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20', 
    hoverBorder: 'hover:border-emerald-400 dark:hover:border-emerald-500/50', 
    lightBg: 'bg-emerald-50 dark:bg-emerald-500/10',
    buttonBg: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white',
    buttonHover: 'group-hover:bg-emerald-600 group-hover:text-white',
    solidBg: 'bg-emerald-600'
  },
  amber: { 
    bg: 'bg-amber-50 dark:bg-amber-500/10', 
    text: 'text-amber-600 dark:text-amber-400', 
    border: 'border-amber-200 dark:border-amber-500/20', 
    badgeBg: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/20', 
    hoverBorder: 'hover:border-amber-400 dark:hover:border-amber-500/50', 
    lightBg: 'bg-amber-50 dark:bg-amber-500/10',
    buttonBg: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-600 hover:text-white',
    buttonHover: 'group-hover:bg-amber-600 group-hover:text-white',
    solidBg: 'bg-amber-500'
  },
  rose: { 
    bg: 'bg-rose-50 dark:bg-rose-500/10', 
    text: 'text-rose-600 dark:text-rose-400', 
    border: 'border-rose-200 dark:border-rose-500/20', 
    badgeBg: 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/20', 
    hoverBorder: 'hover:border-rose-400 dark:hover:border-rose-500/50', 
    lightBg: 'bg-rose-50 dark:bg-rose-500/10',
    buttonBg: 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 hover:bg-rose-600 hover:text-white',
    buttonHover: 'group-hover:bg-rose-600 group-hover:text-white',
    solidBg: 'bg-rose-600'
  },
  blue: { 
    bg: 'bg-blue-50 dark:bg-blue-500/10', 
    text: 'text-blue-600 dark:text-blue-400', 
    border: 'border-blue-200 dark:border-blue-500/20', 
    badgeBg: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/20', 
    hoverBorder: 'hover:border-blue-400 dark:hover:border-blue-500/50', 
    lightBg: 'bg-blue-50 dark:bg-blue-500/10',
    buttonBg: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white',
    buttonHover: 'group-hover:bg-blue-600 group-hover:text-white',
    solidBg: 'bg-blue-600'
  },
  cyan: { 
    bg: 'bg-cyan-50 dark:bg-cyan-500/10', 
    text: 'text-cyan-600 dark:text-cyan-400', 
    border: 'border-cyan-200 dark:border-cyan-500/20', 
    badgeBg: 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/20', 
    hoverBorder: 'hover:border-cyan-400 dark:hover:border-cyan-500/50', 
    lightBg: 'bg-cyan-50 dark:bg-cyan-500/10',
    buttonBg: 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-600 hover:text-white',
    buttonHover: 'group-hover:bg-cyan-600 group-hover:text-white',
    solidBg: 'bg-cyan-600'
  },
};

export default function DashboardQuickTasksSection({ onNavigate }: DashboardQuickTasksSectionProps) {
  const [tasks, setTasks] = useState<DashboardQuickTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isExpanded, setIsExpanded] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<DashboardQuickTask | null>(null);

  // Form Fields
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskTargetView, setTaskTargetView] = useState('odometer');
  const [taskIcon, setTaskIcon] = useState<any>('PhoneCall');
  const [taskColor, setTaskColor] = useState<any>('indigo');
  const [taskIsPinned, setTaskIsPinned] = useState(false);

  // Fetch tasks from backend
  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard/quick-tasks');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (e) {
      console.error('Error loading dashboard quick tasks:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const saveTasksToBackend = async (newTasks: DashboardQuickTask[]) => {
    setTasks(newTasks);
    try {
      await fetch('/api/dashboard/quick-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTasks)
      });
    } catch (e) {
      console.error('Error saving dashboard quick tasks:', e);
    }
  };

  const handleOpenAddModal = () => {
    setEditingTask(null);
    setTaskTitle('');
    setTaskDescription('');
    setTaskTargetView('odometer');
    setTaskIcon('PhoneCall');
    setTaskColor('indigo');
    setTaskIsPinned(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (t: DashboardQuickTask, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTask(t);
    setTaskTitle(t.title);
    setTaskDescription(t.description);
    setTaskTargetView(t.targetView);
    setTaskIcon(t.iconName);
    setTaskColor(t.color || 'indigo');
    setTaskIsPinned(!!t.isPinned);
    setIsModalOpen(true);
  };

  const handleTargetViewChange = (newView: string) => {
    setTaskTargetView(newView);
    const matchedSection = SYSTEM_SECTIONS.find(s => s.id === newView);
    if (matchedSection && !editingTask) {
      if (!taskTitle) setTaskTitle(matchedSection.name);
      if (!taskDescription) setTaskDescription(matchedSection.description);
    }
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    if (editingTask) {
      const updated = tasks.map(t => {
        if (t.id === editingTask.id) {
          return {
            ...t,
            title: taskTitle.trim(),
            description: taskDescription.trim(),
            targetView: taskTargetView,
            iconName: taskIcon,
            color: taskColor,
            isPinned: taskIsPinned
          };
        }
        return t;
      });
      await saveTasksToBackend(updated);
    } else {
      const newTask: DashboardQuickTask = {
        id: `custom_task_${Date.now()}`,
        title: taskTitle.trim(),
        description: taskDescription.trim() || 'دسترسی سریع و مستقیم به این بخش از سامانه',
        targetView: taskTargetView,
        iconName: taskIcon,
        color: taskColor,
        isCustom: true,
        isPinned: taskIsPinned,
        completed: false,
        createdAt: new Date().toISOString()
      };
      await saveTasksToBackend([newTask, ...tasks]);
    }

    setIsModalOpen(false);
  };

  const handleTogglePin = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = tasks.map(t => t.id === taskId ? { ...t, isPinned: !t.isPinned } : t);
    updated.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
    await saveTasksToBackend(updated);
  };

  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('آیا از حذف این میانبر اطمینان دارید؟')) {
      const updated = tasks.filter(t => t.id !== taskId);
      await saveTasksToBackend(updated);
    }
  };

  const handleResetDefaults = async () => {
    if (confirm('آیا مایلید تمام میانبرها به حالت پیش‌فرض سیستم بازگردند؟')) {
      try {
        const res = await fetch('/api/dashboard/quick-tasks/reset', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          setTasks(data);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const renderIcon = (iconName: string) => {
    const item = AVAILABLE_ICONS.find(i => i.name === iconName) || AVAILABLE_ICONS[0];
    const IconComponent = item.icon;
    return <IconComponent className="w-4 h-4" />;
  };

  const getSectionInfo = (viewId: string) => {
    return SYSTEM_SECTIONS.find(s => s.id === viewId) || {
      id: viewId,
      name: viewId,
      category: 'سایر بخش‌ها',
      badge: viewId,
      description: ''
    };
  };

  const categories = useMemo(() => {
    const cats = new Set<string>();
    tasks.forEach(t => {
      const info = getSectionInfo(t.targetView);
      if (info?.category) cats.add(info.category);
    });
    return ['all', ...Array.from(cats)];
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const info = getSectionInfo(task.targetView);
      const matchSearch = 
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        info.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        info.badge.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchCategory = selectedCategory === 'all' || info.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [tasks, searchQuery, selectedCategory]);

  return (
    <div className="bg-white dark:bg-[#121214] rounded-xl border border-slate-200 dark:border-[#27272a] shadow-xs overflow-hidden">
      {/* سربرگ بخش (قابلیت باز و بسته شدن) */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3.5 sm:px-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-[#161619] transition-colors select-none"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span>مدیریت و سفارشی‌سازی میانبرهای اختصاصی</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-[#202024] text-slate-600 dark:text-slate-400 font-mono">
                {toPersianDigits(tasks.length)}
              </span>
            </h3>
            <p className="text-[10px] text-slate-400">
              امکان تعریف میانبرهای جدید، سنجاق کردن در بالا یا تغییر بخش‌های مقصد
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hidden sm:inline">
            {isExpanded ? 'بستن پنل سفارشی' : 'نمایش و مدیریت'}
          </span>
          <div className="p-1 rounded-md text-slate-400">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* محتوای بازشونده برای مدیریت و جستجوی میانبرها */}
      {isExpanded && (
        <div className="p-4 border-t border-slate-100 dark:border-[#202024] space-y-3.5 bg-slate-50/50 dark:bg-[#0e0e10]">
          {/* نوار اکشن‌ها و جستجو */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
            {/* دسته‌بندی‌ها */}
            <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 custom-scrollbar text-[11px]">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={(e) => { e.stopPropagation(); setSelectedCategory(cat); }}
                    className={`px-2 py-0.5 rounded-md font-bold whitespace-nowrap transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-[#18181b] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#27272a] hover:bg-slate-100 dark:hover:bg-[#202024]'
                    }`}
                  >
                    {cat === 'all' ? 'همه' : cat}
                  </button>
                );
              })}
            </div>

            {/* جستجو و دکمه‌های اقدام */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-48">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجوی میانبر..."
                  className="w-full bg-white dark:bg-[#18181b] border border-slate-200 dark:border-[#27272a] rounded-lg pr-7 pl-2.5 py-1 text-[11px] text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
                <Search className="w-3 h-3 text-slate-400 absolute right-2 top-2 pointer-events-none" />
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); handleOpenAddModal(); }}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن</span>
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); handleResetDefaults(); }}
                className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#202024] rounded-lg transition-colors cursor-pointer shrink-0"
                title="بازنشانی به پیش‌فرض"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* لیست میانبرهای سفارشی */}
          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <Cog className="w-6 h-6 text-indigo-500 animate-spin" />
              <span>در حال بارگذاری...</span>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-4 text-center border border-dashed border-slate-200 dark:border-[#27272a] rounded-lg text-slate-400 text-xs">
              میانبری با این مشخصات یافت نشد.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {filteredTasks.map((task) => {
                const colorScheme = COLOR_MAP[task.color] || COLOR_MAP.indigo;
                const sectionInfo = getSectionInfo(task.targetView);

                return (
                  <div
                    key={task.id}
                    onClick={() => onNavigate(task.targetView)}
                    className={`group relative bg-white dark:bg-[#141416] p-2.5 rounded-xl border border-slate-200 dark:border-[#27272a] ${colorScheme.hoverBorder} transition-all flex flex-col justify-between cursor-pointer hover:shadow-xs hover:-translate-y-0.5`}
                  >
                    {task.isPinned && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs z-10" title="سنجاق شده">
                        <Pin className="w-2 h-2" />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`p-1.5 rounded-lg ${colorScheme.bg} ${colorScheme.text} border ${colorScheme.border} flex-shrink-0`}>
                            {renderIcon(task.iconName)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                              {task.title}
                            </h4>
                            <span className="text-[9px] text-slate-400 truncate block">
                              {sectionInfo.badge}
                            </span>
                          </div>
                        </div>

                        {/* اکشن‌های سریع */}
                        <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleTogglePin(task.id, e)}
                            className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-[#202024] cursor-pointer ${
                              task.isPinned ? 'text-amber-500' : 'text-slate-400'
                            }`}
                            title="سنجاق"
                          >
                            <Pin className="w-3 h-3" />
                          </button>

                          <button
                            onClick={(e) => handleOpenEditModal(task, e)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#202024] cursor-pointer"
                            title="ویرایش"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>

                          {task.isCustom && (
                            <button
                              onClick={(e) => handleDeleteTask(task.id, e)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-[#202024] cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                        {task.description}
                      </p>
                    </div>

                    <div className="pt-2 mt-2 border-t border-slate-100 dark:border-[#202024] flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">{sectionInfo.category}</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-0.5">
                        انتقال <ArrowLeft className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* مودال ایجاد یا ویرایش میانبر */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141417] border border-slate-200 dark:border-[#27272a] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* هدر */}
            <div className="p-3.5 border-b border-slate-200 dark:border-[#27272a] flex items-center justify-between bg-slate-50 dark:bg-[#18181b]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                  {editingTask ? 'ویرایش میانبر' : 'افزودن میانبر جدید'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-[#202024] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* فرم */}
            <form onSubmit={handleSaveTask} className="p-4 space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                  بخش مقصد در سامانه:
                </label>
                <select
                  value={taskTargetView}
                  onChange={(e) => handleTargetViewChange(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#27272a] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-bold"
                >
                  {SYSTEM_SECTIONS.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                  عنوان میانبر:
                </label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="مثال: استعلام تلفنی کارکرد"
                  className="w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#27272a] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">توضیحات کوتاه:</label>
                <input
                  type="text"
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="توضیح کوتاه..."
                  className="w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#27272a] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* آیکون */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">آیکون:</label>
                <div className="grid grid-cols-8 gap-1.5">
                  {AVAILABLE_ICONS.map(i => {
                    const IconComp = i.icon;
                    const isSelected = taskIcon === i.name;
                    return (
                      <button
                        type="button"
                        key={i.name}
                        onClick={() => setTaskIcon(i.name)}
                        className={`p-1.5 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-indigo-50 dark:bg-indigo-600/30 border-indigo-500 text-indigo-600 dark:text-indigo-300' 
                            : 'bg-slate-50 dark:bg-[#18181b] border-slate-200 dark:border-[#27272a] text-slate-400 hover:text-slate-800 dark:hover:text-white'
                        }`}
                        title={i.label}
                      >
                        <IconComp className="w-3.5 h-3.5" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* رنگ */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">تم رنگی:</label>
                <div className="flex items-center gap-1.5">
                  {Object.keys(COLOR_MAP).map(c => {
                    const isSelected = taskColor === c;
                    const scheme = COLOR_MAP[c];
                    return (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setTaskColor(c)}
                        className={`w-6 h-6 rounded-full ${scheme.solidBg} border border-black/10 flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                          isSelected ? 'ring-2 ring-offset-1 ring-indigo-500 scale-110 shadow-sm' : 'opacity-80 hover:opacity-100 hover:scale-105'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3] drop-shadow-xs" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* سنجاق */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="taskPinCheck"
                  checked={taskIsPinned}
                  onChange={(e) => setTaskIsPinned(e.target.checked)}
                  className="rounded text-indigo-600 cursor-pointer"
                />
                <label htmlFor="taskPinCheck" className="text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer font-bold">
                  سنجاق در ابتدای لیست
                </label>
              </div>

              {/* دکمه‌های مودال */}
              <div className="pt-3 border-t border-slate-200 dark:border-[#27272a] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1e1e24] text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer shadow-xs"
                >
                  {editingTask ? 'ذخیره' : 'ایجاد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
