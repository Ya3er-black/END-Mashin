import React from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { toPersianDigits } from '../utils/numberUtils';
import { CustomSelect } from './CustomSelect';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100]
}: PaginationProps) {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 py-1.5 bg-white dark:bg-[#151518] border-t border-slate-200 dark:border-[#2d2d30] text-[11px] text-slate-700 dark:text-slate-300">
      <div className="flex items-center gap-2">
        <span>نمایش</span>
        <div className="w-16">
          <CustomSelect
            size="xs"
            matchTriggerWidth={true}
            value={pageSize}
            onChange={(val) => {
              onPageSizeChange(Number(val));
              onPageChange(1);
            }}
            options={pageSizeOptions.map(size => ({ value: size, label: toPersianDigits(size) }))}
          />
        </div>
        <span>مورد از کل {toPersianDigits(totalItems)} مورد (نمایش {toPersianDigits(startItem)} تا {toPersianDigits(endItem)})</span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          title="صفحه قبل"
          className="w-6 h-6 bg-slate-50 dark:bg-[#1a1a1c] hover:bg-slate-100 dark:hover:bg-[#252528] disabled:opacity-40 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-[#2d2d30] flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <span className="w-6 h-6 bg-slate-100 dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded font-bold text-indigo-600 dark:text-indigo-400 font-mono flex items-center justify-center text-[10px]">
          {toPersianDigits(currentPage)}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          title="صفحه بعد"
          className="w-6 h-6 bg-slate-50 dark:bg-[#1a1a1c] hover:bg-slate-100 dark:hover:bg-[#252528] disabled:opacity-40 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-[#2d2d30] flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
