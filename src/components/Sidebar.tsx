/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, Truck, Wrench, ShieldAlert, Package, 
  Wallet, Users, Terminal, FileText, LogOut, Shield, ArrowLeftRight, UserCog,
  ChevronDown, ClipboardList, Building2, Car, Settings, BarChart4, Building, DollarSign,
  Sun, Moon, PhoneCall, Store, Pin, X, FileSpreadsheet, AlertOctagon, Bell
} from 'lucide-react';
import { User, UserRole } from '../types';
import { toPersianDigits } from '../utils/numberUtils';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  currentUser: User | null;
  onLogout: () => void;
  onSimulateRole: (role: UserRole) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isHovered?: boolean;
  onHoverChange?: (hovered: boolean) => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  dueRemindersCount?: number;
}

export default function Sidebar({
  activeView,
  onNavigate,
  currentUser,
  onLogout,
  onSimulateRole,
  isCollapsed,
  onToggleCollapse,
  isHovered = false,
  onHoverChange,
  theme,
  onToggleTheme,
  isMobileOpen = false,
  onMobileClose,
  dueRemindersCount = 0
}: SidebarProps) {
  
  const receptionIds = ['services', 'failures', 'insurance'];
  const definitionIds = ['vehicles', 'service_definitions', 'failure_definitions', 'companies', 'persons', 'mechanics', 'suppliers', 'definitions_excel_import'];
  const reportIds = ['reports', 'reports_comprehensive', 'reports_analytics', 'reports_drivers', 'reports_failures', 'reports_companies', 'reports_services', 'reports_insurance'];

  // مدیریت باز و بسته شدن هوشمند سایدبار با هاور موس
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    // باز شدن سریع و نرم بدون تریگرهای تصادفی
    hoverTimeoutRef.current = setTimeout(() => {
      onHoverChange?.(true);
    }, 40);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    // مهلت خروج ۲۰۰ میلی‌ثانیه‌ای تا حرکت موس ناگهانی باعث پرش نشود
    hoverTimeoutRef.current = setTimeout(() => {
      onHoverChange?.(false);
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // وضعیت باز بودن موثر: اگر در موبایل باز است یا در دسکتاپ سایدبار باز است یا موس روی آن قرار دارد
  const isEffectiveOpen = isMobileOpen ? true : (!isCollapsed || isHovered);
  const effectiveCollapsed = isMobileOpen ? false : (!isEffectiveOpen);

  // مدیریت باز بودن گروه‌ها به صورت آکاردئونی (وقتی روی تسک یا منوی جدید می‌زنیم، تسک قدیمی بسته شود)
  const [openGroup, setOpenGroup] = useState<string | null>(() => {
    if (receptionIds.includes(activeView)) return 'reception';
    if (definitionIds.includes(activeView)) return 'definitions';
    if (reportIds.includes(activeView)) return 'reports';
    return null;
  });

  useEffect(() => {
    if (receptionIds.includes(activeView)) {
      setOpenGroup('reception');
    } else if (definitionIds.includes(activeView)) {
      setOpenGroup('definitions');
    } else if (reportIds.includes(activeView)) {
      setOpenGroup('reports');
    } else {
      setOpenGroup(null);
    }
  }, [activeView]);

  const handleNavigate = (viewId: string) => {
    if (receptionIds.includes(viewId)) {
      setOpenGroup('reception');
    } else if (definitionIds.includes(viewId)) {
      setOpenGroup('definitions');
    } else if (reportIds.includes(viewId)) {
      setOpenGroup('reports');
    } else {
      setOpenGroup(null);
    }
    onNavigate(viewId);
    onMobileClose?.();
  };

  if (!currentUser) return null;

  const roleLabels: Record<UserRole, string> = {
    admin: 'مدیر کل سیستم',
    user: 'کاربر عادی / پرسنل'
  };

  const hasAccess = (itemId: string) => {
    if (currentUser.role === 'admin') return true;
    if (itemId === 'definitions_excel_import') {
      return definitionIds.some(id => id !== 'definitions_excel_import' && currentUser.allowedViews?.includes(id));
    }
    if (itemId === 'accounting' || itemId === 'expenses') {
      return (currentUser.allowedViews?.includes('accounting') || currentUser.allowedViews?.includes('expenses')) || false;
    }
    if (itemId === 'settings' || itemId === 'users' || itemId === 'system_settings') {
      return (currentUser.allowedViews?.includes('settings') || currentUser.allowedViews?.includes('users')) || false;
    }
    if (itemId.startsWith('reports_')) {
      return (currentUser.allowedViews?.includes(itemId) || currentUser.allowedViews?.includes('reports')) || false;
    }
    return currentUser.allowedViews?.includes(itemId) || false;
  };

  // ۱. داشبورد مدیریتی
  const dashboardItem = { id: 'dashboard', label: 'داشبورد مدیریتی', icon: LayoutDashboard };

  // ۲. زیرمجموعه‌های گروه اصلی "پذیرش خودرو"
  const receptionSubItems = [
    { id: 'services', label: 'ثبت سرویس دوره‌ای', icon: Wrench },
    { id: 'failures', label: 'ثبت گزارش خرابی', icon: ShieldAlert },
    { id: 'insurance', label: 'بیمه‌نامه و معاینه فنی', icon: Shield },
  ];

  // ۳. زیرمجموعه‌های گروه اصلی "تعاریف"
  const definitionSubItems = [
    { id: 'vehicles', label: 'تعریف خودروها', icon: Car },
    { id: 'service_definitions', label: 'تعاریف سرویس‌ها', icon: Settings },
    { id: 'failure_definitions', label: 'تعریف خرابی‌ها', icon: AlertOctagon },
    { id: 'companies', label: 'تعریف شرکت‌ها', icon: Building2 },
    { id: 'persons', label: 'تعریف رانندگان', icon: Users },
    { id: 'mechanics', label: 'تعریف تعمیرکاران', icon: Wrench },
    { id: 'suppliers', label: 'تعریف تامین‌کنندگان', icon: Store },
    { id: 'definitions_excel_import', label: 'ورود تعاریف از اکسل', icon: FileSpreadsheet, badge: 'اکسل' },
  ];

  // ۴. منوهای عملیاتی: استعلام کارکرد، یادآوری‌ها و پیگیری‌ها، حسابداری و مالی، انبارداری و قطعات
  const operationsMenuItems = [
    { id: 'odometer', label: 'استعلام کارکرد', icon: PhoneCall },
    { id: 'reminders', label: 'یادآوری‌ها و پیگیری‌ها', icon: Bell, badgeCount: dueRemindersCount },
    { id: 'accounting', label: 'حسابداری و مالی', icon: Wallet },
    { id: 'parts', label: 'انبارداری و قطعات', icon: Package },
  ];

  // ۵. زیرمجموعه‌های گروه اصلی "گزارش‌گیری"
  const reportSubItems = [
    { id: 'reports', label: 'گزارش جامع ناوگان', icon: FileText },
    { id: 'reports_analytics', label: 'تحلیل آماری و هزینه‌ها', icon: BarChart4 },
    { id: 'reports_drivers', label: 'کارکرد و هزینه‌های رانندگان', icon: Users },
    { id: 'reports_failures', label: 'گزارش خرابی‌ها و تعمیرات', icon: ShieldAlert },
    { id: 'reports_companies', label: 'گزارش تحلیلی شرکت‌ها', icon: Building },
    { id: 'reports_services', label: 'گزارش وضعیت سرویس‌ها', icon: ClipboardList },
    { id: 'reports_insurance', label: 'گزارش و یادآور بیمه‌ها', icon: Shield },
  ];

  // ۶. منوهای مدیریتی و نظارتی انتهای سایدبار
  const menuItemsAfter = [
    { id: 'settings', label: 'مدیریت کاربران و تنظیمات', icon: UserCog },
    { id: 'logs', label: 'رویدادنگاری زنده سیستم', icon: Terminal }
  ];

  const visibleReceptionSubItems = receptionSubItems.filter(item => hasAccess(item.id));
  const visibleDefinitionSubItems = definitionSubItems.filter(item => hasAccess(item.id));
  const visibleReportSubItems = reportSubItems.filter(item => hasAccess(item.id));

  const isReceptionActive = visibleReceptionSubItems.some(item => item.id === activeView);
  const isDefinitionActive = visibleDefinitionSubItems.some(item => item.id === activeView);
  const isReportActive = visibleReportSubItems.some(item => item.id === activeView);

  const toggleGroup = (groupName: string) => {
    if (openGroup === groupName) {
      setOpenGroup(null);
    } else {
      setOpenGroup(groupName);
    }
  };

  const isDark = theme === 'dark';

  const getActiveItemStyle = (isActive: boolean) => {
    if (!isActive) return undefined;
    return isDark ? {
      backgroundColor: 'color-mix(in srgb, var(--primary-500) 22%, #1e1e24)',
      borderColor: 'color-mix(in srgb, var(--primary-400) 38%, transparent)'
    } : {
      backgroundColor: 'color-mix(in srgb, var(--primary-600) 8%, #f8fafc)',
      borderColor: 'color-mix(in srgb, var(--primary-500) 22%, transparent)'
    };
  };

  const getActiveIconStyle = (isActive: boolean) => {
    if (!isActive) return undefined;
    return isDark ? {
      color: 'color-mix(in srgb, var(--primary-400) 80%, #ffffff)'
    } : {
      color: 'var(--primary-600)'
    };
  };

  const renderSingleMenuItem = (item: { id: string; label: string; icon: any; badgeCount?: number }) => {
    if (!hasAccess(item.id)) return null;
    const Icon = item.icon;
    const isActive = activeView === item.id;
    const hasBadge = Boolean(item.badgeCount && item.badgeCount > 0);
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleNavigate(item.id)}
        title={effectiveCollapsed ? item.label : undefined}
        style={getActiveItemStyle(isActive)}
        className={`h-8.5 flex items-center rounded-lg transition-colors duration-150 cursor-pointer select-none group/item ${
          effectiveCollapsed 
            ? 'w-8.5 mx-auto justify-center p-0 aspect-square relative' 
            : 'w-full px-2 justify-between'
        } ${
          isActive 
            ? 'border shadow-xs dark:bg-transparent text-black dark:text-white' 
            : 'text-slate-800 dark:text-slate-200 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#222228] border border-transparent hover:border-slate-200 dark:hover:border-[#383842]'
        }`}
      >
        <div className="flex items-center min-w-0">
          <div className="w-8.5 h-8.5 shrink-0 flex items-center justify-center relative">
            <Icon 
              style={getActiveIconStyle(isActive)}
              className={`w-[18px] h-[18px] shrink-0 transition-colors duration-150 ${isActive ? 'text-black dark:text-white' : 'text-slate-700 dark:text-slate-300 group-hover/item:text-black dark:group-hover/item:text-white'}`} 
              strokeWidth={1.8} 
            />
            {effectiveCollapsed && hasBadge && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-[#111113] animate-pulse" />
            )}
          </div>
          <span className={`text-xs whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-200 font-normal ${
            effectiveCollapsed ? 'w-0 max-w-0 opacity-0 pointer-events-none' : 'max-w-[170px] opacity-100 mr-1.5'
          } ${
            isActive 
              ? 'text-black dark:text-white' 
              : 'text-slate-800 dark:text-slate-200 group-hover/item:text-black dark:group-hover/item:text-white'
          }`}>
            {item.label}
          </span>
        </div>

        {!effectiveCollapsed && hasBadge && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-mono animate-pulse shrink-0">
            {toPersianDigits(item.badgeCount!)}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      {/* بک‌دراپ تاریک و مات برای موبایل هنگامی که منو باز است */}
      {isMobileOpen && (
        <div 
          onClick={onMobileClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity animate-in fade-in duration-200 touch-none cursor-pointer"
          aria-hidden="true"
        />
      )}

      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          width: isEffectiveOpen ? '16rem' : '3.5rem',
          transition: 'width 320ms cubic-bezier(0.25, 1, 0.5, 1), transform 320ms cubic-bezier(0.25, 1, 0.5, 1)'
        }}
        className={`group bg-white dark:bg-[#111113] text-slate-800 dark:text-[#e2e8f0] flex flex-col justify-between h-screen fixed top-0 right-0 border-l border-slate-200 dark:border-[#2d2d30] z-50 md:z-40 print:hidden overflow-x-hidden overscroll-contain select-none shadow-2xl md:shadow-sm dark:shadow-xl transition-transform duration-300 ease-out ${
          isMobileOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        }`}
      >
        
        {/* هدر برندینگ و دکمه‌های بستن/سنجاق کردن */}
        <div className="h-14 flex items-center justify-between px-2 border-b border-slate-200 dark:border-[#2d2d30] overflow-hidden shrink-0">
          <div className="flex items-center min-w-0">
            <div 
              style={{ backgroundColor: 'var(--primary-600)' }}
              className="w-9 h-9 flex items-center justify-center rounded-lg shrink-0 shadow-sm transition-colors duration-300"
            >
              <Truck className="w-[18px] h-[18px] text-white" strokeWidth={2} stroke="#ffffff" />
            </div>
            <div className={`flex flex-col whitespace-nowrap overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
              effectiveCollapsed ? 'w-0 max-w-0 opacity-0 pointer-events-none' : 'max-w-[190px] opacity-100 mr-2.5'
            }`}>
              <h1 className="font-extrabold text-slate-900 dark:text-white text-xs tracking-tight leading-relaxed">
                مدیریت ناوگان خودرویی یاس
              </h1>
            </div>
          </div>

          {/* دکمه‌های کنترلی هدر سایدبار */}
          <div className="flex items-center">
            {/* دکمه بستن دراور منو برای موبایل */}
            <button
              type="button"
              onClick={onMobileClose}
              className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#222228] transition-colors cursor-pointer"
              aria-label="بستن منو"
            >
              <X className="w-5 h-5" />
            </button>

            {/* دکمه سنجاق کردن سایدبار (مخصوص دسکتاپ) */}
            <div className={`hidden md:block transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
              effectiveCollapsed ? 'w-0 max-w-0 opacity-0 pointer-events-none overflow-hidden' : 'opacity-100'
            }`}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse();
                }}
                style={!isCollapsed ? {
                  backgroundColor: 'color-mix(in srgb, var(--primary-600) 18%, transparent)',
                  color: 'var(--primary-600)',
                  borderColor: 'color-mix(in srgb, var(--primary-500) 40%, transparent)'
                } : undefined}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer ${
                  !isCollapsed
                    ? 'border shadow-xs hover:brightness-110'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200 dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#222228] dark:hover:border-[#383842]'
                }`}
                title={isCollapsed ? 'سنجاق کردن منو (همیشه باز بماند)' : 'برداشتن سنجاق (جمع‌شدن خودکار با کنار رفتن ماوس)'}
              >
                <Pin 
                  style={!isCollapsed ? { fill: 'var(--primary-600)' } : undefined}
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    !isCollapsed ? '-rotate-45' : 'rotate-0'
                  }`} 
                  strokeWidth={1.9} 
                />
              </button>
            </div>
          </div>
        </div>

      {/* منوی ناوبری */}
      <nav className="flex-1 overflow-y-auto px-2 py-1.5 space-y-0.5 custom-scrollbar">
        
        {/* ۱. داشبورد مدیریتی */}
        {renderSingleMenuItem(dashboardItem)}

        {/* ۲. گروه اصلی "پذیرش خودرو" */}
        {visibleReceptionSubItems.length > 0 && (
          <div className="group">
            <button
              type="button"
              onClick={() => toggleGroup('reception')}
              title={effectiveCollapsed ? 'پذیرش خودرو' : undefined}
              style={getActiveItemStyle(isReceptionActive)}
              className={`h-8.5 flex items-center rounded-lg transition-colors duration-150 cursor-pointer select-none group/groupbtn ${
                effectiveCollapsed 
                  ? 'w-8.5 mx-auto justify-center p-0 aspect-square' 
                  : 'w-full px-2 justify-between'
              } ${
                isReceptionActive
                  ? 'border shadow-xs dark:bg-transparent text-black dark:text-white'
                  : openGroup === 'reception'
                    ? 'text-black dark:text-white bg-slate-100 dark:bg-[#1c1c22] border border-slate-200 dark:border-[#383842]'
                    : 'text-slate-800 dark:text-slate-200 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#222228] border border-transparent hover:border-slate-200 dark:hover:border-[#383842]'
              }`}
            >
              <div className="flex items-center">
                <div className="w-8.5 h-8.5 shrink-0 flex items-center justify-center">
                  <Car 
                    style={getActiveIconStyle(isReceptionActive)}
                    className={`w-[18px] h-[18px] shrink-0 transition-colors duration-150 ${isReceptionActive ? 'text-black dark:text-white' : 'text-slate-700 dark:text-slate-300 group-hover/groupbtn:text-black dark:group-hover/groupbtn:text-white'}`} 
                    strokeWidth={1.8} 
                  />
                </div>
                <span className={`text-xs whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-200 font-normal ${
                  effectiveCollapsed ? 'w-0 max-w-0 opacity-0 pointer-events-none' : 'max-w-[150px] opacity-100 mr-1.5'
                } ${
                  isReceptionActive 
                    ? 'text-black dark:text-white' 
                    : 'text-slate-800 dark:text-slate-200 group-hover/groupbtn:text-black dark:group-hover/groupbtn:text-white'
                }`}>
                  پذیرش خودرو
                </span>
              </div>
              {!effectiveCollapsed && (
                <motion.span
                  animate={{ rotate: openGroup === 'reception' ? 180 : 0 }}
                  transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
                  className={`transition-opacity duration-200 flex items-center justify-center ml-1 ${
                    openGroup === 'reception' ? 'opacity-100' : 'opacity-70 group-hover/groupbtn:opacity-100'
                  }`}
                >
                  <ChevronDown className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300 group-hover/groupbtn:text-black dark:group-hover/groupbtn:text-white" />
                </motion.span>
              )}
            </button>

            {/* زیرمجموعه‌های پذیرش خودرو با انیمیشن آرام‌بند */}
            <AnimatePresence initial={false}>
              {openGroup === 'reception' && !effectiveCollapsed && (
                <motion.div
                  key="reception-content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ 
                    height: 'auto', 
                    opacity: 1,
                    transition: {
                      height: { duration: 0.28, ease: [0.25, 1, 0.5, 1] },
                      opacity: { duration: 0.2, delay: 0.05 }
                    }
                  }}
                  exit={{ 
                    height: 0, 
                    opacity: 0,
                    transition: {
                      height: { duration: 0.2, ease: [0.25, 1, 0.5, 1] },
                      opacity: { duration: 0.15 }
                    }
                  }}
                  className="overflow-hidden"
                >
                  <div className="mr-3 pr-2 ml-0.5 border-r border-slate-200 dark:border-[#2d2d30] flex flex-col gap-0.5 pt-1 pb-0.5">
                    {visibleReceptionSubItems.map(subItem => {
                      const SubIcon = subItem.icon;
                      const isSubActive = activeView === subItem.id;
                      return (
                        <button
                          key={subItem.id}
                          type="button"
                          onClick={() => handleNavigate(subItem.id)}
                          style={getActiveItemStyle(isSubActive)}
                          className={`w-full min-w-0 h-8 flex items-center gap-2 px-2 text-[11px] rounded-lg transition-colors duration-150 cursor-pointer whitespace-nowrap overflow-hidden group/subitem ${
                            isSubActive
                              ? 'border shadow-xs dark:bg-transparent text-black dark:text-white'
                              : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#25252c] hover:text-black dark:hover:text-white border border-transparent hover:border-slate-200 dark:hover:border-[#3a3a44]'
                          }`}
                        >
                          <SubIcon 
                            style={getActiveIconStyle(isSubActive)}
                            className={`w-3.5 h-3.5 shrink-0 transition-colors duration-150 ${isSubActive ? 'text-black dark:text-white' : 'text-slate-600 dark:text-slate-300 group-hover/subitem:text-black dark:group-hover/subitem:text-white'}`} 
                            strokeWidth={1.8} 
                          />
                          <span className={`truncate font-normal transition-colors duration-150 ${
                            isSubActive 
                              ? 'text-black dark:text-white' 
                              : 'text-slate-800 dark:text-slate-200 group-hover/subitem:text-black dark:group-hover/subitem:text-white'
                          }`}>
                            {subItem.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ۳. گروه اصلی "تعاریف" */}
        {visibleDefinitionSubItems.length > 0 && (
          <div className="group">
            <button
              type="button"
              onClick={() => toggleGroup('definitions')}
              title={effectiveCollapsed ? 'تعاریف' : undefined}
              style={getActiveItemStyle(isDefinitionActive)}
              className={`h-8.5 flex items-center rounded-lg transition-colors duration-150 cursor-pointer select-none group/groupbtn ${
                effectiveCollapsed 
                  ? 'w-8.5 mx-auto justify-center p-0 aspect-square' 
                  : 'w-full px-2 justify-between'
              } ${
                isDefinitionActive
                  ? 'border shadow-xs dark:bg-transparent text-black dark:text-white'
                  : openGroup === 'definitions'
                    ? 'text-black dark:text-white bg-slate-100 dark:bg-[#1c1c22] border border-slate-200 dark:border-[#383842]'
                    : 'text-slate-800 dark:text-slate-200 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#222228] border border-transparent hover:border-slate-200 dark:hover:border-[#383842]'
              }`}
            >
              <div className="flex items-center">
                <div className="w-8.5 h-8.5 shrink-0 flex items-center justify-center">
                  <ClipboardList 
                    style={getActiveIconStyle(isDefinitionActive)}
                    className={`w-[18px] h-[18px] shrink-0 transition-colors duration-150 ${isDefinitionActive ? 'text-black dark:text-white' : 'text-slate-700 dark:text-slate-300 group-hover/groupbtn:text-black dark:group-hover/groupbtn:text-white'}`} 
                    strokeWidth={1.8} 
                  />
                </div>
                <span className={`text-xs whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-200 font-normal ${
                  effectiveCollapsed ? 'w-0 max-w-0 opacity-0 pointer-events-none' : 'max-w-[150px] opacity-100 mr-1.5'
                } ${
                  isDefinitionActive 
                    ? 'text-black dark:text-white' 
                    : 'text-slate-800 dark:text-slate-200 group-hover/groupbtn:text-black dark:group-hover/groupbtn:text-white'
                }`}>
                  تعاریف
                </span>
              </div>
              {!effectiveCollapsed && (
                <motion.span
                  animate={{ rotate: openGroup === 'definitions' ? 180 : 0 }}
                  transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
                  className={`transition-opacity duration-200 flex items-center justify-center ml-1 ${
                    openGroup === 'definitions' ? 'opacity-100' : 'opacity-70 group-hover/groupbtn:opacity-100'
                  }`}
                >
                  <ChevronDown className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300 group-hover/groupbtn:text-black dark:group-hover/groupbtn:text-white" />
                </motion.span>
              )}
            </button>

            {/* زیرمجموعه‌های تعاریف با انیمیشن آرام‌بند */}
            <AnimatePresence initial={false}>
              {openGroup === 'definitions' && !effectiveCollapsed && (
                <motion.div
                  key="definitions-content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ 
                    height: 'auto', 
                    opacity: 1,
                    transition: {
                      height: { duration: 0.28, ease: [0.25, 1, 0.5, 1] },
                      opacity: { duration: 0.2, delay: 0.05 }
                    }
                  }}
                  exit={{ 
                    height: 0, 
                    opacity: 0,
                    transition: {
                      height: { duration: 0.2, ease: [0.25, 1, 0.5, 1] },
                      opacity: { duration: 0.15 }
                    }
                  }}
                  className="overflow-hidden"
                >
                  <div className="mr-3 pr-2 ml-0.5 border-r border-slate-200 dark:border-[#2d2d30] flex flex-col gap-0.5 pt-1 pb-0.5">
                    {visibleDefinitionSubItems.map(subItem => {
                      const SubIcon = subItem.icon;
                      const isSubActive = activeView === subItem.id;
                      return (
                        <button
                          key={subItem.id}
                          type="button"
                          onClick={() => handleNavigate(subItem.id)}
                          style={getActiveItemStyle(isSubActive)}
                          className={`w-full min-w-0 h-8 flex items-center gap-2 px-2 text-[11px] rounded-lg transition-colors duration-150 cursor-pointer whitespace-nowrap overflow-hidden group/subitem ${
                            isSubActive
                              ? 'border shadow-xs dark:bg-transparent text-black dark:text-white'
                              : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#25252c] hover:text-black dark:hover:text-white border border-transparent hover:border-slate-200 dark:hover:border-[#3a3a44]'
                          }`}
                        >
                          <SubIcon 
                            style={getActiveIconStyle(isSubActive)}
                            className={`w-3.5 h-3.5 shrink-0 transition-colors duration-150 ${isSubActive ? 'text-black dark:text-white' : 'text-slate-600 dark:text-slate-300 group-hover/subitem:text-black dark:group-hover/subitem:text-white'}`} 
                            strokeWidth={1.8} 
                          />
                          <span className={`truncate font-normal transition-colors duration-150 ${
                            isSubActive 
                              ? 'text-black dark:text-white' 
                              : 'text-slate-800 dark:text-slate-200 group-hover/subitem:text-black dark:group-hover/subitem:text-white'
                          }`}>
                            {subItem.label}
                          </span>
                          {(subItem as any).badge && (
                            <span className="mr-auto px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              {(subItem as any).badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ۴. استعلام کارکرد، ۵. حسابداری و مالی، ۶. انبارداری و قطعات */}
        {operationsMenuItems.map(renderSingleMenuItem)}

        {/* ۷. گروه اصلی "گزارش‌گیری" */}
        {visibleReportSubItems.length > 0 && (
          <div className="group">
            <button
              type="button"
              onClick={() => toggleGroup('reports')}
              title={effectiveCollapsed ? 'گزارش‌گیری' : undefined}
              style={getActiveItemStyle(isReportActive)}
              className={`h-8.5 flex items-center rounded-lg transition-colors duration-150 cursor-pointer select-none group/groupbtn ${
                effectiveCollapsed 
                  ? 'w-8.5 mx-auto justify-center p-0 aspect-square' 
                  : 'w-full px-2 justify-between'
              } ${
                isReportActive
                  ? 'border shadow-xs dark:bg-transparent text-black dark:text-white'
                  : openGroup === 'reports'
                    ? 'text-black dark:text-white bg-slate-100 dark:bg-[#1c1c22] border border-slate-200 dark:border-[#383842]'
                    : 'text-slate-800 dark:text-slate-200 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#222228] border border-transparent hover:border-slate-200 dark:hover:border-[#383842]'
              }`}
            >
              <div className="flex items-center">
                <div className="w-8.5 h-8.5 shrink-0 flex items-center justify-center">
                  <FileText 
                    style={getActiveIconStyle(isReportActive)}
                    className={`w-[18px] h-[18px] shrink-0 transition-colors duration-150 ${isReportActive ? 'text-black dark:text-white' : 'text-slate-700 dark:text-slate-300 group-hover/groupbtn:text-black dark:group-hover/groupbtn:text-white'}`} 
                    strokeWidth={1.8} 
                  />
                </div>
                <span className={`text-xs whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-200 font-normal ${
                  effectiveCollapsed ? 'w-0 max-w-0 opacity-0 pointer-events-none' : 'max-w-[150px] opacity-100 mr-1.5'
                } ${
                  isReportActive 
                    ? 'text-black dark:text-white' 
                    : 'text-slate-800 dark:text-slate-200 group-hover/groupbtn:text-black dark:group-hover/groupbtn:text-white'
                }`}>
                  گزارش‌گیری
                </span>
              </div>
              {!effectiveCollapsed && (
                <motion.span
                  animate={{ rotate: openGroup === 'reports' ? 180 : 0 }}
                  transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
                  className={`transition-opacity duration-200 flex items-center justify-center ml-1 ${
                    openGroup === 'reports' ? 'opacity-100' : 'opacity-70 group-hover/groupbtn:opacity-100'
                  }`}
                >
                  <ChevronDown className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300 group-hover/groupbtn:text-black dark:group-hover/groupbtn:text-white" />
                </motion.span>
              )}
            </button>

            {/* زیرمجموعه‌های گزارش‌گیری با انیمیشن آرام‌بند */}
            <AnimatePresence initial={false}>
              {openGroup === 'reports' && !effectiveCollapsed && (
                <motion.div
                  key="reports-content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ 
                    height: 'auto', 
                    opacity: 1,
                    transition: {
                      height: { duration: 0.28, ease: [0.25, 1, 0.5, 1] },
                      opacity: { duration: 0.2, delay: 0.05 }
                    }
                  }}
                  exit={{ 
                    height: 0, 
                    opacity: 0,
                    transition: {
                      height: { duration: 0.2, ease: [0.25, 1, 0.5, 1] },
                      opacity: { duration: 0.15 }
                    }
                  }}
                  className="overflow-hidden"
                >
                  <div className="mr-3 pr-2 ml-0.5 border-r border-slate-200 dark:border-[#2d2d30] flex flex-col gap-0.5 pt-1 pb-0.5">
                    {visibleReportSubItems.map(subItem => {
                      const SubIcon = subItem.icon;
                      const isSubActive = activeView === subItem.id;
                      return (
                        <button
                          key={subItem.id}
                          type="button"
                          onClick={() => handleNavigate(subItem.id)}
                          style={getActiveItemStyle(isSubActive)}
                          className={`w-full min-w-0 h-8 flex items-center gap-2 px-2 text-[11px] rounded-lg transition-colors duration-150 cursor-pointer whitespace-nowrap overflow-hidden group/subitem ${
                            isSubActive
                              ? 'border shadow-xs dark:bg-transparent text-black dark:text-white'
                              : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#25252c] hover:text-black dark:hover:text-white border border-transparent hover:border-slate-200 dark:hover:border-[#3a3a44]'
                          }`}
                        >
                          <SubIcon 
                            style={getActiveIconStyle(isSubActive)}
                            className={`w-3.5 h-3.5 shrink-0 transition-colors duration-150 ${isSubActive ? 'text-black dark:text-white' : 'text-slate-600 dark:text-slate-300 group-hover/subitem:text-black dark:group-hover/subitem:text-white'}`} 
                            strokeWidth={1.8} 
                          />
                          <span className={`truncate font-normal transition-colors duration-150 ${
                            isSubActive 
                              ? 'text-black dark:text-white' 
                              : 'text-slate-800 dark:text-slate-200 group-hover/subitem:text-black dark:group-hover/subitem:text-white'
                          }`}>
                            {subItem.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ۸. دوتای آخری: مدیریت کاربران و تنظیمات، رویدادنگاری سیستم */}
        {menuItemsAfter.map(renderSingleMenuItem)}
      </nav>

      {/* بخش دکمه‌های فوتر سایدبار (تغییر تم و خروج) */}
      <div className={`p-2 border-t border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#0d0d0f] flex shrink-0 ${
        effectiveCollapsed ? 'flex-col items-center gap-1.5' : 'items-center gap-2'
      }`}>
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            title={theme === 'light' ? 'فعالسازی حالت تاریک' : 'فعالسازی حالت روشن'}
            className={`bg-white dark:bg-[#1a1a1e] hover:bg-slate-100 dark:hover:bg-[#282830] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-200 dark:border-[#2d2d30] hover:border-slate-300 dark:hover:border-[#3e3e48] transition-colors cursor-pointer flex items-center justify-center shrink-0 shadow-xs ${
              effectiveCollapsed ? 'w-9 h-9 aspect-square mx-auto' : 'w-9 h-9'
            }`}
          >
            {theme === 'light' ? (
              <Moon 
                style={{ color: 'var(--primary-600)' }} 
                className="w-[18px] h-[18px] transition-colors" 
                strokeWidth={1.8} 
              />
            ) : (
              <Sun className="w-[18px] h-[18px] text-amber-400" strokeWidth={1.8} />
            )}
          </button>
        )}
        {currentUser && (
          <button
            type="button"
            onClick={() => {
              onMobileClose?.();
              onLogout();
            }}
            title={effectiveCollapsed ? 'خروج از حساب' : undefined}
            className={`flex items-center justify-center bg-white dark:bg-[#1a1a1e] hover:bg-rose-50 dark:hover:bg-rose-500/15 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-500/30 rounded-lg font-bold text-xs border border-slate-200 dark:border-[#2d2d30] transition-colors cursor-pointer shadow-xs group/logout ${
              effectiveCollapsed ? 'w-9 h-9 aspect-square mx-auto p-0' : 'flex-1 h-9 px-2 gap-2'
            }`}
          >
            <div className="w-9 h-9 shrink-0 flex items-center justify-center">
              <LogOut className="w-[18px] h-[18px] text-rose-500 dark:text-rose-400 group-hover/logout:text-rose-600 shrink-0 transition-colors" strokeWidth={1.8} />
            </div>
            {!effectiveCollapsed && (
              <span className="whitespace-nowrap overflow-hidden transition-all duration-300 ml-1 text-slate-700 dark:text-slate-300 group-hover/logout:text-rose-600 dark:group-hover/logout:text-rose-400">
                خروج از حساب
              </span>
            )}
          </button>
        )}
      </div>
    </aside>
  </>
  );
}
