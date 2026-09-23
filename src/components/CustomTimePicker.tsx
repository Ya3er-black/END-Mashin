/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Check, ChevronDown, X } from 'lucide-react';
import { toPersianDigits } from '../utils/numberUtils';

interface CustomTimePickerProps {
  value: string; // e.g. "09:30"
  onChange: (val: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export const CustomTimePicker: React.FC<CustomTimePickerProps> = ({
  value,
  onChange,
  placeholder = 'انتخاب ساعت...',
  disabled = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  // مختصات قرارگیری برای Portal
  const [coords, setCoords] = useState<{
    top: number;
    bottom: number;
    left: number;
    width: number;
    openUpwards: boolean;
  }>({
    top: 0,
    bottom: 0,
    left: 0,
    width: 220,
    openUpwards: false
  });

  // استخراج ساعت و دقیقه
  const [selectedHour, setSelectedHour] = useState<string>(() => {
    if (value && value.includes(':')) {
      return value.split(':')[0].padStart(2, '0');
    }
    return '09';
  });

  const [selectedMinute, setSelectedMinute] = useState<string>(() => {
    if (value && value.includes(':')) {
      return value.split(':')[1].padStart(2, '0');
    }
    return '00';
  });

  // هماهنگی با تغییرات بیرونی value
  useEffect(() => {
    if (value && value.includes(':')) {
      const parts = value.split(':');
      setSelectedHour(parts[0].padStart(2, '0'));
      setSelectedMinute(parts[1].padStart(2, '0'));
    }
  }, [value]);

  // محاسبه موقعیت نمایش منو نسبت به صفحه برای جلوگیری از بریده‌شدن
  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dropdownHeight = 270;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpwards = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

    const popupWidth = Math.max(rect.width, 220);
    let leftPos = rect.left;
    if (leftPos + popupWidth > window.innerWidth - 10) {
      leftPos = window.innerWidth - popupWidth - 10;
    }
    if (leftPos < 10) leftPos = 10;

    setCoords({
      top: rect.bottom + 6,
      bottom: window.innerHeight - rect.top + 6,
      left: leftPos,
      width: popupWidth,
      openUpwards
    });
  }, []);

  // بستن منو هنگام کلیک بیرون یا تغییر اندازه پنجره
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        popupRef.current && !popupRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      if (isOpen) {
        updatePosition();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('scroll', handleScrollOrResize, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  // اسکرول به آیتم انتخاب‌شده پس از باز شدن
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      setTimeout(() => {
        if (hourListRef.current) {
          const selectedHourEl = hourListRef.current.querySelector('[data-selected="true"]') as HTMLElement | null;
          if (selectedHourEl) {
            hourListRef.current.scrollTop = selectedHourEl.offsetTop - hourListRef.current.clientHeight / 2 + selectedHourEl.clientHeight / 2;
          }
        }
        if (minuteListRef.current) {
          const selectedMinuteEl = minuteListRef.current.querySelector('[data-selected="true"]') as HTMLElement | null;
          if (selectedMinuteEl) {
            minuteListRef.current.scrollTop = selectedMinuteEl.offsetTop - minuteListRef.current.clientHeight / 2 + selectedMinuteEl.clientHeight / 2;
          }
        }
      }, 50);
    }
  }, [isOpen, updatePosition]);

  const handleSelectHour = (h: string) => {
    const newH = h.padStart(2, '0');
    setSelectedHour(newH);
    onChange(`${newH}:${selectedMinute}`);
  };

  const handleSelectMinute = (m: string) => {
    const newM = m.padStart(2, '0');
    setSelectedMinute(newM);
    onChange(`${selectedHour}:${newM}`);
  };

  // لیست ساعات از ۰۰ تا ۲۳
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  // لیست دقایق با گام‌های ۵ دقیقه‌ای
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {/* دکمه بازکردن انتخابگر ساعت */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            updatePosition();
            setIsOpen(!isOpen);
          }
        }}
        className={`w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white border border-slate-300 dark:border-[#2d2d30] hover:border-indigo-500 dark:hover:border-indigo-500 rounded-lg px-3 py-2 text-xs font-mono flex items-center justify-between transition-all cursor-pointer shadow-2xs focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
          isOpen ? 'ring-1 ring-indigo-500 border-indigo-500' : ''
        }`}
      >
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className={value ? 'font-bold text-slate-900 dark:text-white text-xs' : 'text-slate-400 dark:text-slate-500'}>
            {value ? toPersianDigits(value) : placeholder}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-0.5 hover:text-rose-500 text-slate-400 rounded transition-colors"
              title="پاک کردن ساعت"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
        </div>
      </button>

      {/* پنجره بازشونده انتخابگر پورتال‌شده بدون مشکل برش و لبه‌ها */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={popupRef}
          dir="rtl"
          style={{
            position: 'fixed',
            left: `${coords.left}px`,
            width: `${Math.max(coords.width, 220)}px`,
            zIndex: 99999,
            ...(coords.openUpwards
              ? { bottom: `${coords.bottom}px` }
              : { top: `${coords.top}px` })
          }}
          className="bg-white dark:bg-[#151518] rounded-xl border border-slate-200 dark:border-[#2d2d30] shadow-2xl p-2.5 animate-in fade-in zoom-in-95 duration-100"
        >
          {/* هدر نمایش ساعت انتخابی */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#242428] text-xs font-bold text-slate-800 dark:text-slate-200">
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 text-[11px]">
              <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>تنظیم ساعت</span>
            </span>
            <span className="font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded text-xs font-bold">
              {toPersianDigits(`${selectedHour}:${selectedMinute}`)}
            </span>
          </div>

          {/* ستون‌های انتخاب ساعت و دقیقه */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            {/* ستون ساعت */}
            <div>
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 text-center">
                ساعت
              </div>
              <div
                ref={hourListRef}
                className="h-44 overflow-y-auto space-y-0.5 pl-1 custom-scrollbar text-center border border-slate-100 dark:border-[#242428] rounded-lg p-1 bg-slate-50/50 dark:bg-[#111113]/50"
              >
                {hours.map((h) => {
                  const isSelected = selectedHour === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      data-selected={isSelected}
                      onClick={() => handleSelectHour(h)}
                      className={`w-full py-1.5 rounded-md text-xs font-mono transition-colors cursor-pointer text-center ${
                        isSelected
                          ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                          : 'hover:bg-slate-200/60 dark:hover:bg-[#222226] text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {toPersianDigits(h)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ستون دقیقه */}
            <div>
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 text-center">
                دقیقه
              </div>
              <div
                ref={minuteListRef}
                className="h-44 overflow-y-auto space-y-0.5 pl-1 custom-scrollbar text-center border border-slate-100 dark:border-[#242428] rounded-lg p-1 bg-slate-50/50 dark:bg-[#111113]/50"
              >
                {minutes.map((m) => {
                  const isSelected = selectedMinute === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      data-selected={isSelected}
                      onClick={() => handleSelectMinute(m)}
                      className={`w-full py-1.5 rounded-md text-xs font-mono transition-colors cursor-pointer text-center ${
                        isSelected
                          ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                          : 'hover:bg-slate-200/60 dark:hover:bg-[#222226] text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {toPersianDigits(m)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* دکمه تایید نهایی */}
          <div className="pt-2 mt-2 border-t border-slate-100 dark:border-[#242428]">
            <button
              type="button"
              onClick={() => {
                onChange(`${selectedHour}:${selectedMinute}`);
                setIsOpen(false);
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-1.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>تایید {toPersianDigits(`${selectedHour}:${selectedMinute}`)}</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
