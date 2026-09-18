import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';

export interface DeleteConfirmModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  message: string;
  isDeleting?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  title,
  subtitle,
  message,
  isDeleting = false,
  onConfirm,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-70 p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 relative text-right" 
        dir="rtl"
      >
        <button
          type="button"
          disabled={isDeleting}
          onClick={onClose}
          className="absolute top-4 left-4 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1a1a1c] transition-colors disabled:opacity-50 cursor-pointer"
          title="بستن"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div className="pr-1">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 dark:bg-[#161618] rounded-lg border border-slate-200 dark:border-[#2d2d30] text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <span>{message}</span>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-[#2d2d30]/60">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-300 font-bold rounded-lg transition-colors border border-slate-200 dark:border-[#2d2d30] text-xs cursor-pointer disabled:opacity-50"
          >
            انصراف
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg transition-all active:scale-95 text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'در حال حذف...' : 'بله، حذف شود'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
