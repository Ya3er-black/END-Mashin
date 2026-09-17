import React from 'react';
import { X, FileSpreadsheet } from 'lucide-react';
import DefinitionsExcelImportView from './DefinitionsExcelImportView';
import { DefinitionEntityType } from '../utils/excelImportUtils';

interface DefinitionsExcelImportModalProps {
  isOpen: boolean;
  initialType?: DefinitionEntityType;
  onClose: () => void;
  onSuccess?: (summary: any, data: any) => void;
  onNavigate?: (view: string) => void;
}

export default function DefinitionsExcelImportModal({
  isOpen,
  initialType = 'vehicles',
  onClose,
  onSuccess,
  onNavigate
}: DefinitionsExcelImportModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div 
        className="bg-white dark:bg-[#111113] w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-[#2d2d32] overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
        dir="rtl"
      >
        {/* هدر مودال */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-[#26262b] flex items-center justify-between bg-slate-50/70 dark:bg-[#151518]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                بارگذاری اکسل و تعریف خودکار
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                ورود اطلاعات دسته‌جمعی از فایل‌های Excel و CSV به سامانه
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#25252b] flex items-center justify-center transition-colors cursor-pointer"
            title="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* بدنه مودال با اسکرول */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 custom-scrollbar">
          <DefinitionsExcelImportView
            initialType={initialType}
            isModal={true}
            onClose={onClose}
            onSuccess={onSuccess}
            onNavigate={onNavigate}
          />
        </div>
      </div>
    </div>
  );
}
