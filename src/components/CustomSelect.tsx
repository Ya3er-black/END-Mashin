import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, Plus, ExternalLink } from 'lucide-react';
import { 
  QuickEntityType, 
  navigateToEntityDefinition, 
  openQuickEntityModal,
  ENTITY_DEFINITION_TARGETS 
} from '../utils/navigation';
import { toPersianDigits, toEnglishDigits } from '../utils/numberUtils';

export interface Option {
  value: string | number;
  label: string;
  subLabel?: string;
}

interface CustomSelectProps {
  options: Option[];
  value: string | number;
  onChange: (value: any) => void;
  placeholder?: string;
  searchable?: boolean;
  className?: string;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md' | '8';
  matchTriggerWidth?: boolean;
  minMenuWidth?: number;
  onAddNew?: () => void;
  addNewLabel?: string;
  quickAddType?: QuickEntityType;
  showEmptyAsBlank?: boolean;
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = 'انتخاب کنید...',
  searchable = false,
  className = '',
  disabled = false,
  size = 'md',
  matchTriggerWidth = false,
  minMenuWidth,
  onAddNew,
  addNewLabel,
  quickAddType,
  showEmptyAsBlank = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleAddNewAction = onAddNew
    ? onAddNew
    : quickAddType
    ? () => {
        setIsOpen(false);
        openQuickEntityModal(quickAddType, (createdItem) => {
          if (createdItem && onChange) {
            if (quickAddType === 'company' && createdItem.name) {
              onChange(createdItem.name);
            } else if (quickAddType === 'driver' && createdItem.fullName) {
              onChange(createdItem.fullName);
            } else if (createdItem.id !== undefined) {
              const hasNumeric = options.some(o => o.value === createdItem.id || o.value === String(createdItem.id));
              if (hasNumeric) {
                onChange(createdItem.id);
              } else if (createdItem.name || createdItem.fullName || createdItem.title) {
                onChange(createdItem.name || createdItem.fullName || createdItem.title);
              } else {
                onChange(String(createdItem.id));
              }
            }
          }
        });
      }
    : undefined;

  const resolvedAddNewLabel =
    addNewLabel ||
    (quickAddType
      ? ENTITY_DEFINITION_TARGETS[quickAddType]?.addNewButtonLabel
      : 'افزودن مورد جدید...');

  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    openUpward: boolean;
  }>({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 280,
    openUpward: false,
  });

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  const filteredOptions = searchable
    ? options.filter((opt) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        const qEng = toEnglishDigits(q).toLowerCase();
        const qPer = toPersianDigits(q).toLowerCase();
        const searchTerms = [q, qEng, qPer].filter(Boolean);

        const l = opt.label.toLowerCase();
        const lEng = toEnglishDigits(l).toLowerCase();
        const sl = opt.subLabel ? opt.subLabel.toLowerCase() : '';
        const slEng = opt.subLabel ? toEnglishDigits(opt.subLabel).toLowerCase() : '';

        const matchesPrefixOrSub = (text: string) => {
          if (!text) return false;
          return searchTerms.some(st => {
            if (text.includes(st)) return true;
            const words = text.split(/[\s\-_\/()\[\]:]+/);
            return words.some(w => w.startsWith(st));
          });
        };

        return matchesPrefixOrSub(l) || matchesPrefixOrSub(lEng) || (sl ? matchesPrefixOrSub(sl) || matchesPrefixOrSub(slEng) : false);
      })
    : options;

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const itemHeight = size === 'xs' ? 28 : 36;
      const headerFooterHeight = (searchable ? 48 : 0) + (handleAddNewAction ? 48 : 0);
      const totalEstimatedHeight = options.length * itemHeight + headerFooterHeight + 12;

      // Determine if dropdown should open upward
      // If below space is tight (<260 or less than estimated) and above has more space, open upward
      const openUpward = (spaceBelow < Math.min(280, totalEstimatedHeight) && spaceAbove > spaceBelow) || (spaceBelow < 180 && spaceAbove > 120);

      const availableHeight = openUpward 
        ? Math.max(120, Math.min(320, spaceAbove - 16))
        : Math.max(120, Math.min(320, spaceBelow - 16));

      const resolvedW = matchTriggerWidth
        ? rect.width
        : minMenuWidth !== undefined
        ? Math.max(rect.width, minMenuWidth)
        : Math.max(rect.width, size === 'xs' ? 200 : 220);

      // In RTL layout, align with trigger button right edge, clamped to viewport
      let left = matchTriggerWidth ? rect.left : rect.right - resolvedW;
      if (left < 8) left = 8;
      if (left + resolvedW > window.innerWidth - 8) {
        left = window.innerWidth - resolvedW - 8;
      }

      setCoords({
        top: openUpward ? rect.top - 4 : rect.bottom + 4,
        left: left,
        width: resolvedW,
        maxHeight: availableHeight,
        openUpward,
      });
    }
  };

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
      setSearchQuery('');
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen]);

  const dropdownMenu = isOpen && typeof document !== 'undefined' ? (
    createPortal(
      <div
        ref={dropdownRef}
        dir="rtl"
        style={{
          position: 'fixed',
          top: coords.openUpward ? undefined : `${coords.top}px`,
          bottom: coords.openUpward ? `${Math.max(4, window.innerHeight - coords.top)}px` : undefined,
          left: `${coords.left}px`,
          width: `${coords.width}px`,
          maxHeight: `${coords.maxHeight}px`,
          zIndex: 999999,
        }}
        className={`bg-white dark:bg-[#18181b] border border-slate-200 dark:border-[#2d2d30] ${
          size === 'xs' || size === '8' ? 'rounded-md text-[11px]' : 'rounded-xl text-xs'
        } shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col`}
      >
        {searchable && (
          <div className="p-2 border-b border-slate-200 dark:border-[#2d2d30] relative bg-slate-50/50 dark:bg-[#121215] shrink-0">
            <Search className="absolute right-3.5 top-3 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="جستجو..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-[#1a1a1e] text-slate-900 dark:text-white placeholder-slate-400 border border-slate-200 dark:border-[#2d2d30] rounded-lg pr-8 pl-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
          </div>
        )}

        <div 
          className={`overflow-y-auto flex-1 min-h-0 ${size === 'xs' || size === '8' ? 'p-0.5 space-y-0.5' : 'p-1 space-y-0.5'} custom-scrollbar`}
        >
          {filteredOptions.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                  setSearchQuery('');
                }}
                className={`w-full flex items-center justify-between ${
                  size === 'xs' || size === '8'
                    ? 'px-1.5 py-1 rounded text-[11px]'
                    : 'px-3 py-2 rounded-lg text-xs'
                } transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 font-bold'
                    : 'hover:bg-slate-100 dark:hover:bg-[#232328] text-slate-800 dark:text-slate-200 font-medium'
                }`}
              >
                <div className="flex flex-col truncate flex-1 min-w-0 text-right">
                  <span className="truncate text-right">{opt.label}</span>
                  {opt.subLabel && opt.subLabel !== 'راننده ناوگان' && opt.subLabel !== 'راننده' && (
                    <span className={`text-[10px] truncate text-right ${isSelected ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-400'}`}>{opt.subLabel}</span>
                  )}
                </div>
                {isSelected && (
                  <div className={`${size === 'xs' || size === '8' ? 'w-3.5 h-3.5' : 'w-4 h-4'} bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shrink-0 mr-1.5 check-indicator shadow-2xs transition-all`}>
                    <Check className={`${size === 'xs' || size === '8' ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-white stroke-[3]`} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {handleAddNewAction && (
          <div className="p-1.5 border-t border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#121215] shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                handleAddNewAction();
              }}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer border border-dashed border-indigo-200 dark:border-indigo-900/60"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{resolvedAddNewLabel}</span>
            </button>
          </div>
        )}
      </div>,
      document.body
    )
  ) : null;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`w-full ${size === 'xs' ? 'h-6 px-2 text-[10px] rounded' : size === 'sm' ? 'h-7 px-2.5 text-[11px] rounded-md' : size === '8' ? 'h-8 px-2 text-xs rounded-md' : 'h-[38px] px-3 text-xs rounded-lg'} flex items-center justify-between border transition-all font-bold cursor-pointer text-right ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-[#151518] border-slate-200 dark:border-[#2d2d30] text-slate-400'
            : 'bg-white dark:bg-[#161619] border-slate-300 dark:border-[#2d2d30] text-slate-900 dark:text-white hover:border-indigo-500 dark:hover:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs'
        }`}
      >
        <span className="truncate flex-1 text-right">
          {showEmptyAsBlank && (value === '' || value === undefined || value === null)
            ? ''
            : selectedOption
            ? selectedOption.label
            : <span className="text-slate-400 font-normal">{placeholder}</span>}
        </span>
        <ChevronDown
          className={`${size === 'xs' || size === '8' ? 'w-3 h-3' : 'w-4 h-4'} text-slate-400 transition-transform duration-200 shrink-0 mr-1 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {dropdownMenu}
    </div>
  );
}
