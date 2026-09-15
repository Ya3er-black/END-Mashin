/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Bell, AlertCircle, Sparkles, LogOut, CheckCircle2, 
  Terminal, ShieldCheck, RefreshCw, X, Building, Filter, ChevronDown,
  Calendar, Clock, Menu, Download
} from 'lucide-react';
import { toPersianDigits } from './utils/numberUtils';

import { 
  User, UserPreferences, Person, Vehicle, PeriodicService, Insurance, TechnicalInspection, 
  VehicleFailure, RepairWorkflow, PartInventory, Expense, UserRole, Mechanic, Company, ServiceDefinition, VehicleHistoryEntry, InventoryTransaction, OdometerLog, SmsInboundLog, Supplier 
} from './types';

import LoginView from './components/LoginView';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import VehiclesView from './components/VehiclesView';
import ServiceDefinitionsView from './components/ServiceDefinitionsView';
import ServicesView from './components/ServicesView';
import InsuranceView from './components/InsuranceView';
import FailuresView from './components/FailuresView';
import InventoryView from './components/InventoryView';
import PersonsView from './components/PersonsView';
import SettingsView from './components/SettingsView';
import ReportsView from './components/ReportsView';
import AccountingView from './components/AccountingView';
import LogsView from './components/LogsView';
import MechanicsView from './components/MechanicsView';
import CompaniesView from './components/CompaniesView';
import SuppliersView from './components/SuppliersView';
import OdometerTrackingView from './components/OdometerTrackingView';
import GearLoading from './components/GearLoading';
import GlobalEntityDefinitionModal from './components/GlobalEntityDefinitionModal';
import { setCurrentActiveView, QuickEntityType } from './utils/navigation';
import { calculateComprehensiveServiceHealth } from './utils/serviceMatching';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const isSidebarOpen = !isSidebarCollapsed || isSidebarHovered;
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsMobileSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // غیرفعال کردن اسکرول صفحه اصلی هنگام باز بودن منوی کشویی در موبایل جهت جلوگیری از اسکرول ناخواسته در گوشی
  useEffect(() => {
    if (!isMobileSidebarOpen) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileSidebarOpen]);

  // مدیریت ناوبری با بستن فوری منوی موبایل، بستن اعلانات و اسکرول نرم به بالا
  const handleNavigate = (view: string) => {
    setActiveView(view);
    setShowNotifications(false);
    setIsMobileSidebarOpen(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'dark';
  });

  const [fontFamily, setFontFamily] = useState<string>(() => {
    return localStorage.getItem('appFont') || 'iranyekan';
  });

  const [borderRadius, setBorderRadius] = useState<number>(() => {
    const saved = localStorage.getItem('appRadius');
    return saved !== null ? parseInt(saved, 10) : 4;
  });

  const [accentColor, setAccentColor] = useState<string>(() => {
    return localStorage.getItem('appAccentColor') || 'blue';
  });

  // ساعت و تقویم جاری زنده
  const [currentDateTime, setCurrentDateTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const headerDateInfo = useMemo(() => {
    const weekday = currentDateTime.toLocaleDateString('fa-IR', { weekday: 'long' });
    const day = currentDateTime.toLocaleDateString('fa-IR', { day: 'numeric' });
    const month = currentDateTime.toLocaleDateString('fa-IR', { month: 'long' });
    const year = currentDateTime.toLocaleDateString('fa-IR', { year: 'numeric' });
    return {
      weekday,
      short: `${day} ${month}`,
      year
    };
  }, [currentDateTime]);

  const formattedHeaderTime = useMemo(() => {
    return currentDateTime.toLocaleTimeString('fa-IR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }, [currentDateTime]);

  // اعمال کلاس تم به body و html
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light');
      document.body.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.body.classList.remove('light');
      document.body.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // تابع تولید هوشمند پالت رنگی استاندارد ۵۰ تا ۹۵۰ از روی هر کد رنگ هگز دلخواه
  const generatePaletteFromHex = (hex: string): Record<string, string> => {
    let cleanHex = hex.replace('#', '').trim();
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    if (!/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
      cleanHex = '4f46e5';
    }
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);

    const mix = (r2: number, g2: number, b2: number, weight: number) => {
      const nr = Math.round(r * (1 - weight) + r2 * weight);
      const ng = Math.round(g * (1 - weight) + g2 * weight);
      const nb = Math.round(b * (1 - weight) + b2 * weight);
      return `#${((1 << 24) + (nr << 16) + (ng << 8) + nb).toString(16).slice(1)}`;
    };

    return {
      '50': mix(255, 255, 255, 0.94),
      '100': mix(255, 255, 255, 0.86),
      '200': mix(255, 255, 255, 0.70),
      '300': mix(255, 255, 255, 0.50),
      '400': mix(255, 255, 255, 0.25),
      '500': `#${cleanHex}`,
      '600': mix(0, 0, 0, 0.15),
      '700': mix(0, 0, 0, 0.30),
      '800': mix(0, 0, 0, 0.45),
      '900': mix(0, 0, 0, 0.60),
      '950': mix(0, 0, 0, 0.78),
    };
  };

  // اعمال پالت رنگ اصلی انتخابی (پیش‌فرض‌ها یا رنگ سفارشی دلخواه)
  useEffect(() => {
    const predefinedPalettes: Record<string, Record<string, string>> = {
      blue: {
        '50': '#eef2ff', '100': '#e0e7ff', '200': '#c7d2fe', '300': '#a5b4fc',
        '400': '#818cf8', '500': '#6366f1', '600': '#4f46e5', '700': '#4338ca',
        '800': '#3730a3', '900': '#312e81', '950': '#1e1b4b'
      },
      purple: {
        '50': '#faf5ff', '100': '#f3e8ff', '200': '#e9d5ff', '300': '#d8b4fe',
        '400': '#c084fc', '500': '#a855f7', '600': '#9333ea', '700': '#7e22ce',
        '800': '#6b21a8', '900': '#581c87', '950': '#3b0764'
      },
      orange: {
        '50': '#fff7ed', '100': '#ffedd5', '200': '#fed7aa', '300': '#fdba74',
        '400': '#fb923c', '500': '#f97316', '600': '#ea580c', '700': '#c2410c',
        '800': '#9a3412', '900': '#7c2d12', '950': '#431407'
      },
      green: {
        '50': '#f0fdf4', '100': '#dcfce7', '200': '#bbf7d0', '300': '#86efac',
        '400': '#4ade80', '500': '#22c55e', '600': '#16a34a', '700': '#15803d',
        '800': '#166534', '900': '#14532d', '950': '#052e16'
      },
      teal: {
        '50': '#f0fdfa', '100': '#ccfbf1', '200': '#99f6e4', '300': '#5eead4',
        '400': '#2dd4bf', '500': '#14b8a6', '600': '#0d9488', '700': '#0f766e',
        '800': '#115e59', '900': '#134e4a', '950': '#042f2e'
      },
      red: {
        '50': '#fef2f2', '100': '#fee2e2', '200': '#fecaca', '300': '#fca5a5',
        '400': '#f87171', '500': '#ef4444', '600': '#dc2626', '700': '#b91c1c',
        '800': '#991b1b', '900': '#7f1d1d', '950': '#450a0a'
      },
      black: {
        '50': '#f4f4f5', '100': '#e4e4e7', '200': '#d4d4d8', '300': '#a1a1aa',
        '400': '#71717a', '500': '#52525b', '600': '#27272a', '700': '#18181b',
        '800': '#09090b', '900': '#050506', '950': '#000000'
      }
    };

    let palette: Record<string, string>;
    if (predefinedPalettes[accentColor]) {
      palette = predefinedPalettes[accentColor];
    } else if (accentColor.startsWith('#')) {
      palette = generatePaletteFromHex(accentColor);
    } else {
      palette = predefinedPalettes['blue'];
    }

    Object.entries(palette).forEach(([shade, hex]) => {
      document.documentElement.style.setProperty(`--primary-${shade}`, hex);
      document.documentElement.style.setProperty(`--color-indigo-${shade}`, hex);
      document.documentElement.style.setProperty(`--color-blue-${shade}`, hex);
      document.documentElement.style.setProperty(`--color-primary-${shade}`, hex);
    });

    // اطمینان از اعمال سریع و پوشش سراسری استایل‌های رنگی در کل DOM
    let dynamicStyle = document.getElementById('dynamic-accent-theme') as HTMLStyleElement | null;
    if (!dynamicStyle) {
      dynamicStyle = document.createElement('style');
      dynamicStyle.id = 'dynamic-accent-theme';
      document.head.appendChild(dynamicStyle);
    }
    dynamicStyle.textContent = `
      :root {
        --color-indigo-50: ${palette['50']} !important;
        --color-indigo-100: ${palette['100']} !important;
        --color-indigo-200: ${palette['200']} !important;
        --color-indigo-300: ${palette['300']} !important;
        --color-indigo-400: ${palette['400']} !important;
        --color-indigo-500: ${palette['500']} !important;
        --color-indigo-600: ${palette['600']} !important;
        --color-indigo-700: ${palette['700']} !important;
        --color-indigo-800: ${palette['800']} !important;
        --color-indigo-900: ${palette['900']} !important;
        --color-indigo-950: ${palette['950']} !important;
        --color-blue-50: ${palette['50']} !important;
        --color-blue-100: ${palette['100']} !important;
        --color-blue-200: ${palette['200']} !important;
        --color-blue-300: ${palette['300']} !important;
        --color-blue-400: ${palette['400']} !important;
        --color-blue-500: ${palette['500']} !important;
        --color-blue-600: ${palette['600']} !important;
        --color-blue-700: ${palette['700']} !important;
        --color-blue-800: ${palette['800']} !important;
        --color-blue-900: ${palette['900']} !important;
        --color-blue-950: ${palette['950']} !important;
      }
    `;
    localStorage.setItem('appAccentColor', accentColor);
  }, [accentColor]);

  // اعمال فونت انتخابی به سراسر سامانه
  useEffect(() => {
    const fontMap: Record<string, string> = {
      iranyekan: '"IRANYekanX", "IranYekan", Tahoma, -apple-system, sans-serif',
      vazir: '"Vazirmatn", "Vazir", system-ui, -apple-system, sans-serif',
      dana: '"Dana", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      iransans: '"IRANSans", "IRANSansX", "IRANSansMobile", -apple-system, sans-serif',
      yekanbakh: '"Yekan Bakh", "YekanBakh", "Yekan Bakh FaNum", -apple-system, sans-serif'
    };
    const selectedCss = fontMap[fontFamily] || fontMap['iranyekan'];
    document.documentElement.style.setProperty('--app-font', selectedCss);
    document.body.style.fontFamily = selectedCss;
    localStorage.setItem('appFont', fontFamily);
  }, [fontFamily]);

  // اعمال گردی گوشه‌ها به سراسر سامانه
  useEffect(() => {
    document.documentElement.style.setProperty('--app-radius', `${borderRadius}px`);
    localStorage.setItem('appRadius', borderRadius.toString());
  }, [borderRadius]);

  // تبدیل خودکار تمام اعداد به فارسی در سطح DOM جهت پوشش ۱۰۰٪ در سراسر اپلیکیشن
  useEffect(() => {
    const persianMap: Record<string, string> = {
      '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴',
      '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹'
    };

    const walkTextNodes = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.parentNode && ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'INPUT', 'TEXTAREA'].includes((node.parentNode as HTMLElement).tagName)) {
          return;
        }
        if (node.nodeValue && /\d/.test(node.nodeValue)) {
          node.nodeValue = node.nodeValue.replace(/\d/g, d => persianMap[d] || d);
        }
      } else {
        if (node.nodeType === Node.ELEMENT_NODE && ['INPUT', 'TEXTAREA', 'SCRIPT', 'STYLE'].includes((node as HTMLElement).tagName)) {
          return;
        }
        let child = node.firstChild;
        while (child) {
          walkTextNodes(child);
          child = child.nextSibling;
        }
      }
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const addedNode of mutation.addedNodes) {
          walkTextNodes(addedNode);
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    walkTextNodes(document.body);

    return () => {
      observer.disconnect();
    };
  }, []);

  // اعمال تنظیمات استایل اختصاصی کاربر از دیتابیس
  const applyUserPreferences = (user: User | null) => {
    if (!user || !user.preferences) return;
    const prefs = user.preferences;
    if (prefs.theme && (prefs.theme === 'light' || prefs.theme === 'dark')) {
      setTheme(prefs.theme);
      localStorage.setItem('theme', prefs.theme);
    }
    if (prefs.fontFamily) {
      setFontFamily(prefs.fontFamily);
      localStorage.setItem('appFont', prefs.fontFamily);
    }
    if (prefs.accentColor) {
      setAccentColor(prefs.accentColor);
      localStorage.setItem('appAccentColor', prefs.accentColor);
    }
    if (typeof prefs.borderRadius === 'number') {
      setBorderRadius(prefs.borderRadius);
      localStorage.setItem('appRadius', prefs.borderRadius.toString());
    }
  };

  // ذخیره برخط تنظیمات استایل در پایگاه داده اختصاصی کاربر
  const syncPreferenceToDb = async (newPrefs: Partial<UserPreferences>) => {
    if (!currentUser) return;
    try {
      const updatedPreferences = {
        ...(currentUser.preferences || {}),
        ...newPrefs
      };
      
      // به‌روزرسانی استیت کاربری در React
      setCurrentUser(prev => prev ? { ...prev, preferences: updatedPreferences } : null);

      await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          username: currentUser.username,
          preferences: newPrefs
        })
      });
    } catch (err) {
      console.warn('Could not sync user preferences to DB:', err);
    }
  };

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    syncPreferenceToDb({ theme: newTheme });
  };

  const handleFontFamilyChange = (newFont: string) => {
    setFontFamily(newFont);
    localStorage.setItem('appFont', newFont);
    syncPreferenceToDb({ fontFamily: newFont });
  };

  const handleAccentColorChange = (newColor: string) => {
    setAccentColor(newColor);
    localStorage.setItem('appAccentColor', newColor);
    syncPreferenceToDb({ accentColor: newColor });
  };

  const handleBorderRadiusChange = (newRadius: number) => {
    setBorderRadius(newRadius);
    localStorage.setItem('appRadius', newRadius.toString());
    syncPreferenceToDb({ borderRadius: newRadius });
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    handleThemeChange(nextTheme);
  };

  // پایگاه داده‌های زنده متصل به API
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [services, setServices] = useState<PeriodicService[]>([]);
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [inspections, setInspections] = useState<TechnicalInspection[]>([]);
  const [failures, setFailures] = useState<VehicleFailure[]>([]);
  const [workflows, setWorkflows] = useState<RepairWorkflow[]>([]);
  const [parts, setParts] = useState<PartInventory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [serviceDefinitions, setServiceDefinitions] = useState<ServiceDefinition[]>([]);
  const [vehicleHistory, setVehicleHistory] = useState<VehicleHistoryEntry[]>([]);
  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>([]);
  const [odometerLogs, setOdometerLogs] = useState<OdometerLog[]>([]);
  const [smsLogs, setSmsLogs] = useState<SmsInboundLog[]>([]);

  // نوتیفیکیشن‌ها و پیام‌های هشدار هوشمند
  const [notifications, setNotifications] = useState<string[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // واکشی کل اطلاعات به صورت تجمیعی
  const fetchAllData = async () => {
    try {
      const endpoints = [
        { path: '/api/vehicles', setter: setVehicles },
        { path: '/api/services', setter: setServices },
        { path: '/api/insurance', setter: setInsurances },
        { path: '/api/inspection', setter: setInspections },
        { path: '/api/failures', setter: setFailures },
        { path: '/api/workflows', setter: setWorkflows },
        { path: '/api/parts', setter: setParts },
        { path: '/api/expenses', setter: setExpenses },
        { path: '/api/users', setter: setUsers },
        { path: '/api/persons', setter: setPersons },
        { path: '/api/logs', setter: setLogs },
        { path: '/api/mechanics', setter: setMechanics },
        { path: '/api/companies', setter: setCompanies },
        { path: '/api/suppliers', setter: setSuppliers },
        { path: '/api/service-definitions', setter: setServiceDefinitions },
        { path: '/api/vehicle-history', setter: setVehicleHistory },
        { path: '/api/inventory-transactions', setter: setInventoryTransactions },
        { path: '/api/odometer-logs', setter: setOdometerLogs },
        { path: '/api/sms/inbound-logs', setter: setSmsLogs }
      ];

      await Promise.all(endpoints.map(async (ep) => {
        try {
          const res = await fetch(ep.path);
          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('application/json')) {
            const data = await res.json();
            ep.setter(data);
          }
        } catch (itemErr) {
          console.warn(`Could not load data from ${ep.path}:`, itemErr);
        }
      }));
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  // بررسی وضعیت احراز هویت اولیه در شروع برنامه
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/me');
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const user = await res.json();
          setCurrentUser(user);
          applyUserPreferences(user);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  // همگام‌سازی اطلاعات در صورت ورود موفق
  useEffect(() => {
    if (currentUser) {
      fetchAllData();
    }
  }, [currentUser]);

  // گوش دادن به تغییرات سراسری ناشی از ثبت سریع موجودیت‌ها
  useEffect(() => {
    const handleDataRefresh = () => {
      fetchAllData();
    };
    window.addEventListener('app:data-refresh', handleDataRefresh);
    return () => window.removeEventListener('app:data-refresh', handleDataRefresh);
  }, []);

  // وضعیت باز بودن مودال سراسری تعاریف سریع
  const [quickEntityModalType, setQuickEntityModalType] = useState<QuickEntityType | null>(null);

  useEffect(() => {
    const handleOpenQuickModal = (e: any) => {
      if (e.detail?.entityType) {
        setQuickEntityModalType(e.detail.entityType);
      }
    };
    window.addEventListener('app:open-quick-entity-modal', handleOpenQuickModal);
    return () => window.removeEventListener('app:open-quick-entity-modal', handleOpenQuickModal);
  }, []);

  // گوش دادن به درخواست ناوبری سریع به بخش‌های تعاریف
  useEffect(() => {
    const handleNavigateView = (e: any) => {
      if (e.detail?.view) {
        handleNavigate(e.detail.view);
      }
    };
    window.addEventListener('app:navigate-view', handleNavigateView);
    return () => window.removeEventListener('app:navigate-view', handleNavigateView);
  }, []);

  useEffect(() => {
    setCurrentActiveView(activeView);
  }, [activeView]);

  // فیلتر سطح شرکت (اگر کاربر به شرکت خاصی منتسب باشد یا ادمین شرکتی را انتخاب کند)
  const userAssignedCompany = currentUser?.company?.trim() || '';
  const [adminCompanyFilter, setAdminCompanyFilter] = useState<string>('all');

  // اگر کاربر شرکتی دارد، فقط شرکت خودش؛ اگر ادمین بدون شرکت است و فیلتر دستی گذاشته، آن فیلتر؛ در غیر این صورت همه
  const activeCompany = userAssignedCompany || (adminCompanyFilter !== 'all' ? adminCompanyFilter : '');
  const isCompanyFiltered = Boolean(activeCompany);

  // ۱. فیلتر کردن خودروهای ناوگان بر اساس شرکت کاربر
  const visibleVehicles = useMemo(() => {
    if (!isCompanyFiltered) return vehicles;
    return vehicles.filter(v => v.company === activeCompany);
  }, [vehicles, isCompanyFiltered, activeCompany]);

  const visibleVehicleIds = useMemo(() => {
    return new Set(visibleVehicles.map(v => v.id));
  }, [visibleVehicles]);

  // ۲. فیلتر کردن سوابق سرویس‌های دوره‌ای
  const visibleServices = useMemo(() => {
    if (!isCompanyFiltered) return services;
    return services.filter(s => visibleVehicleIds.has(s.vehicleId) || s.company === activeCompany);
  }, [services, visibleVehicleIds, isCompanyFiltered, activeCompany]);

  // ۳. فیلتر کردن بیمه‌نامه‌ها
  const visibleInsurances = useMemo(() => {
    if (!isCompanyFiltered) return insurances;
    return insurances.filter(i => visibleVehicleIds.has(i.vehicleId) || i.company === activeCompany);
  }, [insurances, visibleVehicleIds, isCompanyFiltered, activeCompany]);

  // ۴. فیلتر کردن معاینه فنی
  const visibleInspections = useMemo(() => {
    if (!isCompanyFiltered) return inspections;
    return inspections.filter(i => visibleVehicleIds.has(i.vehicleId) || i.company === activeCompany);
  }, [inspections, visibleVehicleIds, isCompanyFiltered, activeCompany]);

  // ۵. فیلتر کردن خرابی‌ها
  const visibleFailures = useMemo(() => {
    if (!isCompanyFiltered) return failures;
    return failures.filter(f => visibleVehicleIds.has(f.vehicleId) || f.company === activeCompany);
  }, [failures, visibleVehicleIds, isCompanyFiltered, activeCompany]);

  // ۶. فیلتر کردن گردش کار تعمیرات
  const visibleWorkflows = useMemo(() => {
    if (!isCompanyFiltered) return workflows;
    return workflows.filter(w => {
      const failure = failures.find(f => f.id === w.failureId);
      return failure ? (visibleVehicleIds.has(failure.vehicleId) || failure.company === activeCompany) : false;
    });
  }, [workflows, failures, visibleVehicleIds, isCompanyFiltered, activeCompany]);

  // ۷. فیلتر کردن مخارج و امور مالی
  const visibleExpenses = useMemo(() => {
    if (!isCompanyFiltered) return expenses;
    return expenses.filter(e => visibleVehicleIds.has(e.vehicleId) || e.company === activeCompany);
  }, [expenses, visibleVehicleIds, isCompanyFiltered, activeCompany]);

  // ۸. فیلتر کردن سوابق تغییرات خودرو
  const visibleVehicleHistory = useMemo(() => {
    if (!isCompanyFiltered) return vehicleHistory;
    return vehicleHistory.filter(h => visibleVehicleIds.has(h.vehicleId) || h.newValue === activeCompany || h.oldValue === activeCompany);
  }, [vehicleHistory, visibleVehicleIds, isCompanyFiltered, activeCompany]);

  // ۹. فیلتر کردن شرکت‌ها (فقط در صورتی که کاربر به شرکت مشخصی منتسب باشد، محدود می‌شود)
  const visibleCompanies = useMemo(() => {
    if (!userAssignedCompany) return companies;
    return companies.filter(c => c.name === userAssignedCompany);
  }, [companies, userAssignedCompany]);

  // ۱۰. فیلتر کردن استعلام‌های کیلومتر کارکرد
  const visibleOdometerLogs = useMemo(() => {
    if (!isCompanyFiltered) return odometerLogs;
    return odometerLogs.filter(o => visibleVehicleIds.has(o.vehicleId) || o.company === activeCompany);
  }, [odometerLogs, visibleVehicleIds, isCompanyFiltered, activeCompany]);

  // محاسبه نوتیفیکیشن‌ها و آلارم‌های فنی هوشمند
  useEffect(() => {
    if (!currentUser) return;

    const list: string[] = [];

    // ۱. بررسی قطعات رو به اتمام
    parts.forEach(p => {
      if (p.quantity === 0) {
        list.push(`کالای انبار [${p.partName}] به اتمام رسیده است!`);
      } else if (p.quantity <= p.minQuantity) {
        list.push(`هشدار کسری: موجودی قطعه [${p.partName}] پایین‌تر از حداقل آستانه است.`);
      }
    });

    // ۲. بررسی بیمه‌های منقضی شده یا در آستانه اتمام (۳۰ روز آینده)
    visibleInsurances.forEach(ins => {
      const v = visibleVehicles.find(veh => veh.id === ins.vehicleId);
      const vName = v ? v.name : 'خودرو';
      const diff = Math.ceil((new Date(ins.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (diff < 0) {
        list.push(`بیمه‌نامه شخص ثالث خودرو [${vName}] منقضی گردیده است! تمدید فوری.`);
      } else if (diff <= 30) {
        list.push(`بیمه‌نامه خودرو [${vName}] طی ${diff} روز آینده منقضی می‌گردد.`);
      }
    });

    // ۳. بررسی خرابی‌های بحرانی (فقط موارد فعال که هنوز ترخیص یا تکمیل نشده‌اند)
    visibleFailures.forEach(f => {
      if (f.priority === 'high' && f.status !== 'approved' && f.status !== 'completed') {
        const v = visibleVehicles.find(veh => veh.id === f.vehicleId);
        list.push(`خرابی بحرانی اعلام شده برای خودرو [${v ? v.name : 'N/A'}]؛ توقف کار تا تعمیر کامل.`);
      }
    });

    // ۴. بررسی خدمات دوره‌ای در بازه اخطار یا سررسید گذشته برای خودروهای ناوگان مجاز (همگام با سرویس‌ها و تعمیرات)
    visibleVehicles.forEach(v => {
      serviceDefinitions.forEach(sd => {
        const health = calculateComprehensiveServiceHealth(
          v,
          sd,
          visibleServices,
          visibleFailures,
          visibleWorkflows,
          parts,
          75,
          visibleOdometerLogs
        );

        if (health.hasHistory) {
          if (health.status === 'overdue') {
            list.push(`🚨 سررسید تعویض [${sd.serviceType}] برای ${v.name} (${v.plaque}) گذشته است! (${Math.abs(health.remainingKm).toLocaleString('fa-IR')} کیلومتر گذشت)`);
          } else if (health.status === 'warning') {
            list.push(`⚠️ اخطار تعویض [${sd.serviceType}] برای ${v.name} (${v.plaque}): فقط ${health.remainingKm.toLocaleString('fa-IR')} کیلومتر باقیمانده است.`);
          }
        }
      });
    });

    setNotifications(list);
  }, [parts, visibleInsurances, visibleFailures, visibleVehicles, visibleServices, visibleWorkflows, visibleOdometerLogs, serviceDefinitions, currentUser]);

  // متدهای احراز هویت
  const handleLogin = async (username: string, password?: string): Promise<boolean | { success: boolean; message?: string }> => {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data && (data.id || data.username)) {
        setCurrentUser(data);
        applyUserPreferences(data);
        setActiveView('dashboard');
        return true;
      }
      return { success: false, message: data?.message || 'نام کاربری، شماره موبایل یا کلمه عبور اشتباه است.' };
    } catch (err) {
      console.error(err);
      return { success: false, message: 'خطا در برقراری ارتباط با سرور سامانه.' };
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      setCurrentUser(null);
      setVehicles([]);
      setServices([]);
      setInsurances([]);
      setInspections([]);
      setFailures([]);
      setWorkflows([]);
      setParts([]);
      setExpenses([]);
    } catch (err) {
      console.error(err);
    }
  };

  // شبیه‌سازی نقش‌ها (تسهیل بررسی دمو برای استادار/ارزیاب)
  const handleSimulateRole = async (role: UserRole) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentUser(updated);
        alert(`نقش دسترسی شما به [${role}] تغییر یافت. اکنون منوها و دکمه‌ها منطبق با مسئولیت جدید هستند.`);
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // متدهای عملیات روی خودروها (CRUD)
  const handleAddVehicle = async (vehicle: Omit<Vehicle, 'id' | 'createdAt'>) => {
    const res = await fetch('/api/vehicles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vehicle)
    });
    if (res.ok) {
      const data = await res.json();
      await fetchAllData();
      return data;
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'خطا در ثبت خودرو');
    }
  };

  const handleUpdateVehicle = async (id: number, vehicle: Partial<Vehicle>) => {
    const res = await fetch(`/api/vehicles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vehicle)
    });
    if (res.ok) {
      await fetchAllData();
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'خطا در ویرایش خودرو');
    }
  };

  const handleDeleteVehicle = async (id: number) => {
    const res = await fetch(`/api/vehicles/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      await fetchAllData();
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'خطا در حذف خودرو');
    }
  };

  // متدهای تعریف خدمات (Service Definitions)
  const handleAddServiceDefinition = async (newDef: Omit<ServiceDefinition, 'id' | 'createdAt'>) => {
    const res = await fetch('/api/service-definitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDef)
    });
    if (res.ok) {
      const data = await res.json();
      await fetchAllData();
      return data;
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'خطا در ثبت تعریف خدمت');
    }
  };

  const handleEditServiceDefinition = async (id: number, updated: Partial<ServiceDefinition>) => {
    const res = await fetch(`/api/service-definitions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
    if (res.ok) {
      await fetchAllData();
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'خطا در ویرایش تعریف خدمت');
    }
  };

  const handleDeleteServiceDefinition = async (id: number) => {
    const res = await fetch(`/api/service-definitions/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      await fetchAllData();
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'خطا در حذف تعریف خدمت');
    }
  };

  // متدهای عملیات روی سایر موجودیت‌ها
  const handleAddService = async (service: Omit<PeriodicService, 'id' | 'createdAt'>) => {
    const res = await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(service)
    });
    if (res.ok) fetchAllData();
    else throw new Error();
  };

  const handleEditService = async (id: number, service: Partial<PeriodicService>) => {
    const res = await fetch(`/api/services/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(service)
    });
    if (res.ok) fetchAllData();
    else throw new Error();
  };

  const handleDeleteService = async (id: number) => {
    const res = await fetch(`/api/services/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) fetchAllData();
    else throw new Error();
  };

  const handleAddInsurance = async (ins: Omit<Insurance, 'id' | 'createdAt'>) => {
    const res = await fetch('/api/insurance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ins)
    });
    if (res.ok) fetchAllData();
    else throw new Error();
  };

  const handleAddInspection = async (insp: Omit<TechnicalInspection, 'id' | 'createdAt'>) => {
    const res = await fetch('/api/inspection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(insp)
    });
    if (res.ok) fetchAllData();
    else throw new Error();
  };

  const handleAddFailure = async (fail: Omit<VehicleFailure, 'id' | 'createdAt'> & { assignedMechanicId?: number; repairShopName?: string; startDate?: string }) => {
    const res = await fetch('/api/failures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fail)
    });
    if (res.ok) fetchAllData();
    else throw new Error();
  };

  const handleUpdateFailure = async (id: number, fail: Partial<VehicleFailure>) => {
    const res = await fetch(`/api/failures/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fail)
    });
    if (res.ok) fetchAllData();
    else throw new Error();
  };

  const handleDeleteFailure = async (id: number) => {
    const res = await fetch(`/api/failures/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) fetchAllData();
    else throw new Error();
  };

  const handleUpdateWorkflow = async (id: number, wf: Partial<RepairWorkflow> & { markReady?: boolean }) => {
    const res = await fetch(`/api/workflows/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wf)
    });
    if (res.ok) fetchAllData();
    else throw new Error();
  };

  const handleAddPart = async (part: Omit<PartInventory, 'id' | 'createdAt'>) => {
    const res = await fetch('/api/parts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(part)
    });
    if (res.ok) {
      const data = await res.json();
      await fetchAllData();
      return data;
    }
    else throw new Error();
  };

  const handleEditPart = async (id: number, part: Partial<PartInventory>) => {
    const res = await fetch(`/api/parts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(part)
    });
    if (res.ok) fetchAllData();
    else throw new Error();
  };

  const handleStockIn = async (data: { partId?: number | null; partName?: string; serviceType?: string; quantity: number; unitPrice?: number; buyPrice?: number; sellPrice?: number; warehouseLocation?: string; supplier?: string; invoiceNumber?: string; notes?: string }) => {
    const res = await fetch('/api/parts/stock-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) fetchAllData();
    else throw new Error();
  };

  const handleStockOut = async (data: { partId: number; quantity: number; vehicleId?: number; recipient?: string; reason?: string; notes?: string; buyPrice?: number; sellPrice?: number }) => {
    const res = await fetch('/api/parts/stock-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) fetchAllData();
    else throw new Error();
  };

  const handleEditInventoryTransaction = async (id: number, data: Partial<InventoryTransaction>) => {
    const res = await fetch(`/api/inventory-transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) fetchAllData();
    else throw new Error();
  };

  const handleAddExpense = async (exp: Omit<Expense, 'id' | 'createdAt'>) => {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exp)
    });
    if (res.ok) fetchAllData();
    else throw new Error();
  };

  const handleAddUser = async (u: Omit<User, 'id' | 'createdAt'>) => {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(u)
    });
    if (res.ok) {
      await fetchAllData();
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'خطا در ایجاد کاربر');
    }
  };

  const handleEditUser = async (id: number, u: Partial<User>) => {
    const res = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(u)
    });
    if (res.ok) {
      await fetchAllData();
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'خطا در ویرایش کاربر');
    }
  };

  const handleAddPerson = async (p: Omit<Person, 'id' | 'createdAt'>) => {
    const res = await fetch('/api/persons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p)
    });
    if (res.ok) {
      const data = await res.json();
      await fetchAllData();
      return data;
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'خطا در ثبت شخص/راننده');
    }
  };

  const handleEditPerson = async (id: number, p: Partial<Person>) => {
    const res = await fetch(`/api/persons/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p)
    });
    if (res.ok) {
      await fetchAllData();
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'خطا در ویرایش شخص/راننده');
    }
  };

  const handleDeletePerson = async (id: number) => {
    const res = await fetch(`/api/persons/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      await fetchAllData();
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'خطا در حذف شخص/راننده');
    }
  };

  const handleAddMechanic = async (m: Omit<Mechanic, 'id' | 'createdAt'>) => {
    const res = await fetch('/api/mechanics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(m)
    });
    if (res.ok) {
      const data = await res.json();
      await fetchAllData();
      return data;
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'خطا در ثبت مکانیک/تعمیرگاه');
    }
  };

  const handleEditMechanic = async (id: number, m: Partial<Mechanic>) => {
    const res = await fetch(`/api/mechanics/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(m)
    });
    if (res.ok) {
      await fetchAllData();
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'خطا در ویرایش مکانیک/تعمیرگاه');
    }
  };

  const handleDeleteMechanic = async (id: number) => {
    const res = await fetch(`/api/mechanics/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      await fetchAllData();
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'خطا در حذف مکانیک/تعمیرگاه');
    }
  };

  const handleAddCompany = async (c: Omit<Company, 'id' | 'createdAt'>) => {
    const res = await fetch('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c)
    });
    if (res.ok) {
      const data = await res.json();
      await fetchAllData();
      return data;
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'خطا در ثبت شرکت');
    }
  };

  const handleEditCompany = async (id: number, c: Partial<Company>) => {
    const res = await fetch(`/api/companies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c)
    });
    if (res.ok) {
      await fetchAllData();
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'خطا در ویرایش شرکت');
    }
  };

  const handleDeleteCompany = async (id: number) => {
    const res = await fetch(`/api/companies/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      await fetchAllData();
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'خطا در حذف شرکت');
    }
  };

  const handleAddSupplier = async (s: Omit<Supplier, 'id' | 'createdAt'>) => {
    const res = await fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s)
    });
    if (res.ok) {
      const data = await res.json();
      await fetchAllData();
      return data;
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'خطا در ثبت تأمین‌کننده');
    }
  };

  const handleEditSupplier = async (id: number, s: Partial<Supplier>) => {
    const res = await fetch(`/api/suppliers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s)
    });
    if (res.ok) {
      await fetchAllData();
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'خطا در ویرایش تأمین‌کننده');
    }
  };

  const handleDeleteSupplier = async (id: number) => {
    const res = await fetch(`/api/suppliers/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      await fetchAllData();
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'خطا در حذف تأمین‌کننده');
    }
  };

  const handleAddOdometerLog = async (log: Omit<OdometerLog, 'id' | 'createdAt'>) => {
    const res = await fetch('/api/odometer-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log)
    });
    if (res.ok) fetchAllData();
    else {
      const err = await res.json();
      throw new Error(err.message || 'خطا در ثبت استعلام');
    }
  };

  const handleEditOdometerLog = async (id: number, log: Partial<OdometerLog>) => {
    const res = await fetch(`/api/odometer-logs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log)
    });
    if (res.ok) fetchAllData();
    else {
      const err = await res.json();
      throw new Error(err.message || 'خطا در ویرایش استعلام');
    }
  };

  const handleDeleteOdometerLog = async (id: number) => {
    const res = await fetch(`/api/odometer-logs/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) fetchAllData();
    else throw new Error('خطا در حذف استعلام');
  };

  const handleSimulateSms = async (senderPhone: string, message: string) => {
    const res = await fetch('/api/sms/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderPhone, message })
    });
    const data = await res.json();
    await fetchAllData();
    return data;
  };

  const handleDeleteSmsLog = async (id: number) => {
    const res = await fetch(`/api/sms/inbound-logs/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) fetchAllData();
    else throw new Error('خطا در حذف لاگ پیامک');
  };

  const handleSyncSms = useCallback(async () => {
    try {
      const res = await fetch('/api/sms/sync-inbound', { 
        method: 'POST',
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) {
        return { success: false, newCount: 0, messages: [], message: 'خطا در ارتباط با سرور' };
      }
      const data = await res.json().catch(() => null);
      if (data && data.success) {
        if (data.newCount > 0) {
          await fetchAllData();
        }
        return data;
      }
      return data || { success: false, newCount: 0, messages: [], message: 'خطا در استعلام پیامک‌ها از سرور' };
    } catch (e: any) {
      console.warn('Sync SMS network status:', e?.message || e);
      return { success: false, newCount: 0, messages: [], message: e?.message || 'خطا در ارتباط با سرور' };
    }
  }, []);

  const handleAssignSms = async (id: number, vehicleId: number, updateDriverPhone: boolean) => {
    const res = await fetch(`/api/sms/inbound-logs/${id}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicleId, updateDriverPhone })
    });
    const data = await res.json();
    if (res.ok) {
      await fetchAllData();
      return data;
    } else {
      throw new Error(data.message || 'خطا در تخصیص خودرو');
    }
  };

  if (isLoading) {
    return (
      <GearLoading
        fullScreen
        size="lg"
        text="در حال بارگذاری اطلاعات مدیریت ناوگان خودرویی یاس..."
        subText="پایش، سرویس، نگهداری و ناوبری ناوگان خودروها"
      />
    );
  }

  // در صورتی که کاربر لاگین نکرده باشد، گیت ورود را نمایش می‌دهیم
  if (!currentUser) {
    return (
      <LoginView 
        onLogin={handleLogin} 
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0a0a0b] text-slate-800 dark:text-[#e2e8f0] font-sans antialiased flex" dir="rtl">
      
      {/* منوی کناری راست‌چین با قابلیت دراور در موبایل */}
      <Sidebar 
        activeView={activeView}
        onNavigate={handleNavigate}
        currentUser={currentUser}
        onLogout={handleLogout}
        onSimulateRole={handleSimulateRole}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isHovered={isSidebarHovered}
        onHoverChange={setIsSidebarHovered}
        theme={theme}
        onToggleTheme={toggleTheme}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* بخش اصلی محتوا (سمت چپ منوی کناری) - در موبایل تمام‌صفحه و در دسکتاپ هماهنگ با باز/بسته شدن سایدبار */}
      <main 
        style={{
          marginRight: isMobile ? '0rem' : (isSidebarOpen ? '16rem' : '3.5rem'),
          transition: 'margin-right 320ms cubic-bezier(0.25, 1, 0.5, 1)'
        }}
        className="flex-1 min-h-screen flex flex-col w-full min-w-0 max-w-full overflow-x-hidden"
      >
        
        {/* هدر بالایی با نمایش دکمه منو در موبایل، تاریخ، ساعت، اعلانات و نمایه کاربر */}
        <header className="bg-white/80 dark:bg-[#0a0a0b]/80 backdrop-blur-md border-b border-slate-200 dark:border-[#2d2d30] h-14 sm:h-16 flex items-center justify-between px-3 sm:px-6 sticky top-0 z-20 print:hidden w-full min-w-0">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              {/* دکمه باز کردن منوی کشویی در موبایل */}
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="md:hidden p-1.5 -mr-1 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1a1a1e] border border-slate-200 dark:border-[#2d2d30] transition-colors cursor-pointer shrink-0"
                aria-label="باز کردن منوی ناوبری"
                title="منوی ناوبری"
              >
                <Menu className="w-4 h-4" />
              </button>

              {/* تاریخ و ساعت جاری - کاملاً بدون کادر، تمیز و کاملاً واکنش‌گرا در موبایل */}
              <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium select-none min-w-0">
                <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                <span className="font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                  <span className="hidden md:inline">{toPersianDigits(headerDateInfo.weekday)} </span>
                  <span>{toPersianDigits(headerDateInfo.short)}</span>
                  <span className="hidden sm:inline"> {toPersianDigits(headerDateInfo.year)}</span>
                </span>
                <span className="text-slate-300 dark:text-slate-700 mx-0.5 shrink-0">•</span>
                <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                <span className="font-mono text-slate-600 dark:text-slate-300 shrink-0 font-medium">
                  {toPersianDigits(formattedHeaderTime)}
                </span>
              </div>

              {/* وضعیت تفکیک شرکت در صورت انتساب کاربر به شرکت خاص */}
              {userAssignedCompany && (
                <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 rounded-lg text-amber-800 dark:text-amber-400 text-xs font-extrabold shadow-xs shrink-0">
                  <Building className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">شرکت:</span>
                  <span className="truncate max-w-[120px]">{userAssignedCompany}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 relative">
              {/* دکمه نوتیفیکیشن‌ها */}
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1a1a1c] border border-transparent hover:border-slate-300 dark:hover:border-[#2d2d30] rounded-md transition-all cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span>
                )}
              </button>

              {/* دراپ‌دان نوتیفیکیشن‌های هوشمند */}
              {showNotifications && (
                <div className="absolute left-0 top-11 w-72 sm:w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-md p-3 z-30 space-y-3 shadow-lg">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1">
                      <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                      هشدارهای هوشمند ({notifications.length})
                    </span>
                    <button onClick={() => setShowNotifications(false)} className="text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 font-bold cursor-pointer">بستن</button>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                    {notifications.length === 0 ? (
                      <div className="text-center py-4 text-slate-400 dark:text-slate-500">هیچ هشدار اضطراری یا سررسیدی برای ناوگان یافت نشد.</div>
                    ) : (
                      notifications.map((note, idx) => (
                        <div key={idx} className="p-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-md text-amber-900 dark:text-amber-200 flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                          <span>{note}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* پروفایل هدر - نمایش فقط نام شخص */}
              <div className="flex items-center gap-1.5 sm:gap-2 border-r border-slate-200 dark:border-[#2d2d30] pr-2 sm:pr-3">
                <span className="text-[11px] font-extrabold text-slate-900 dark:text-white truncate max-w-[100px] sm:max-w-[150px] md:max-w-none">{currentUser.fullName}</span>
              </div>
            </div>
          </header>

        {/* بخش رندر پویای صفحات */}
        <div className="p-3 sm:p-4 md:p-5 flex-1 w-full min-w-0 max-w-full overflow-x-hidden">
          {activeView === 'dashboard' && (
            <DashboardView 
              vehicles={userAssignedCompany ? visibleVehicles : vehicles}
              services={userAssignedCompany ? visibleServices : services}
              insurances={userAssignedCompany ? visibleInsurances : insurances}
              inspections={userAssignedCompany ? visibleInspections : inspections}
              failures={userAssignedCompany ? visibleFailures : failures}
              expenses={userAssignedCompany ? visibleExpenses : expenses}
              companies={visibleCompanies}
              serviceDefinitions={serviceDefinitions}
              workflows={userAssignedCompany ? visibleWorkflows : workflows}
              parts={parts}
              odometerLogs={userAssignedCompany ? visibleOdometerLogs : odometerLogs}
              onNavigate={handleNavigate}
              selectedCompany={adminCompanyFilter}
              onSelectCompany={setAdminCompanyFilter}
            />
          )}

          {activeView === 'vehicles' && (
            <VehiclesView 
              vehicles={visibleVehicles}
              vehicleHistory={visibleVehicleHistory}
              companies={visibleCompanies}
              persons={persons}
              users={users}
              currentUser={currentUser}
              onAddVehicle={handleAddVehicle}
              onEditVehicle={handleUpdateVehicle}
              onDeleteVehicle={handleDeleteVehicle}
            />
          )}

          {activeView === 'service_definitions' && (
            <ServiceDefinitionsView 
              serviceDefinitions={serviceDefinitions}
              onAddDefinition={handleAddServiceDefinition}
              onEditDefinition={handleEditServiceDefinition}
              onDeleteDefinition={handleDeleteServiceDefinition}
            />
          )}

          {activeView === 'services' && (
            <ServicesView 
              vehicles={visibleVehicles}
              services={visibleServices}
              serviceDefinitions={serviceDefinitions}
              parts={parts}
              mechanics={mechanics}
              suppliers={suppliers}
              failures={visibleFailures}
              workflows={visibleWorkflows}
              persons={persons}
              insurances={visibleInsurances}
              inspections={visibleInspections}
              onNavigate={handleNavigate}
              onAddService={handleAddService}
              onEditService={handleEditService}
              onDeleteService={handleDeleteService}
            />
          )}

          {activeView === 'odometer' && (
            <OdometerTrackingView 
              vehicles={visibleVehicles}
              services={visibleServices}
              serviceDefinitions={serviceDefinitions}
              odometerLogs={visibleOdometerLogs}
              smsLogs={smsLogs}
              failures={visibleFailures}
              workflows={visibleWorkflows}
              parts={parts}
              currentUser={currentUser}
              onAddOdometerLog={handleAddOdometerLog}
              onEditOdometerLog={handleEditOdometerLog}
              onDeleteOdometerLog={handleDeleteOdometerLog}
              onSimulateSms={handleSimulateSms}
              onDeleteSmsLog={handleDeleteSmsLog}
              onSyncSms={handleSyncSms}
              onAssignSms={handleAssignSms}
              onNavigateToServices={(vId, sType) => {
                handleNavigate('services');
              }}
            />
          )}

          {activeView === 'insurance' && (
            <InsuranceView 
              vehicles={visibleVehicles}
              insurances={visibleInsurances}
              inspections={visibleInspections}
              onAddInsurance={handleAddInsurance}
              onAddInspection={handleAddInspection}
            />
          )}

          {activeView === 'failures' && (
            <FailuresView 
              vehicles={visibleVehicles}
              failures={visibleFailures}
              workflows={visibleWorkflows}
              parts={parts}
              persons={persons}
              users={users}
              mechanics={mechanics}
              suppliers={suppliers}
              currentUserRole={currentUser.role}
              onAddFailure={handleAddFailure}
              onUpdateFailure={handleUpdateFailure}
              onDeleteFailure={handleDeleteFailure}
              onUpdateWorkflow={handleUpdateWorkflow}
            />
          )}

          {activeView === 'mechanics' && (
            <MechanicsView 
              mechanics={mechanics}
              failures={visibleFailures}
              workflows={visibleWorkflows}
              onAddMechanic={handleAddMechanic}
              onEditMechanic={handleEditMechanic}
              onDeleteMechanic={handleDeleteMechanic}
            />
          )}

          {activeView === 'parts' && (
            <InventoryView 
              parts={parts}
              vehicles={visibleVehicles}
              serviceDefinitions={serviceDefinitions}
              inventoryTransactions={inventoryTransactions}
              onAddPart={handleAddPart}
              onEditPart={handleEditPart}
              onStockIn={handleStockIn}
              onStockOut={handleStockOut}
              onEditInventoryTransaction={handleEditInventoryTransaction}
            />
          )}

          {activeView === 'companies' && (
            <CompaniesView 
              companies={visibleCompanies}
              onAddCompany={handleAddCompany}
              onEditCompany={handleEditCompany}
              onDeleteCompany={handleDeleteCompany}
            />
          )}

          {activeView === 'suppliers' && (
            <SuppliersView 
              suppliers={suppliers}
              onAddSupplier={handleAddSupplier}
              onEditSupplier={handleEditSupplier}
              onDeleteSupplier={handleDeleteSupplier}
            />
          )}

          {activeView === 'persons' && (
            <PersonsView 
              persons={persons}
              onAddPerson={handleAddPerson}
              onEditPerson={handleEditPerson}
              onDeletePerson={handleDeletePerson}
            />
          )}

          {activeView === 'accounting' && (
            <AccountingView 
              vehicles={visibleVehicles}
              expenses={visibleExpenses}
              services={visibleServices}
              insurances={visibleInsurances}
              failures={visibleFailures}
              workflows={visibleWorkflows}
              parts={parts}
              mechanics={mechanics}
              suppliers={suppliers}
              inventoryTransactions={inventoryTransactions}
              onAddExpense={handleAddExpense}
            />
          )}

          {activeView === 'settings' && (
            <SettingsView 
              users={users}
              companies={companies}
              onAddUser={handleAddUser}
              onEditUser={handleEditUser}
              theme={theme}
              onThemeChange={handleThemeChange}
              fontFamily={fontFamily}
              onFontFamilyChange={handleFontFamilyChange}
              borderRadius={borderRadius}
              onBorderRadiusChange={handleBorderRadiusChange}
              accentColor={accentColor}
              onAccentColorChange={handleAccentColorChange}
            />
          )}

          {['reports', 'reports_comprehensive', 'reports_analytics', 'reports_drivers', 'reports_failures', 'reports_companies', 'reports_services', 'reports_insurance'].includes(activeView) && (
            <ReportsView 
              activeView={activeView}
              vehicles={visibleVehicles}
              services={visibleServices}
              insurances={visibleInsurances}
              inspections={visibleInspections}
              failures={visibleFailures}
              workflows={visibleWorkflows}
              expenses={visibleExpenses}
              parts={parts}
              vehicleHistory={visibleVehicleHistory}
            />
          )}

          {activeView === 'logs' && (
            <LogsView 
              logs={logs}
            />
          )}
        </div>
      </main>

      {/* مدال تعاریف رسمی و یکپارچه بدون جابجایی صفحه */}
      <GlobalEntityDefinitionModal
        isOpen={quickEntityModalType !== null}
        entityType={quickEntityModalType}
        onClose={() => setQuickEntityModalType(null)}
        companies={companies}
        persons={persons}
        mechanics={mechanics}
        suppliers={suppliers}
        serviceDefinitions={serviceDefinitions}
        onAddVehicle={handleAddVehicle}
        onAddPerson={handleAddPerson}
        onAddSupplier={handleAddSupplier}
        onAddMechanic={handleAddMechanic}
        onAddCompany={handleAddCompany}
        onAddServiceDefinition={handleAddServiceDefinition}
        onAddPart={handleAddPart}
      />
    </div>
  );
}
