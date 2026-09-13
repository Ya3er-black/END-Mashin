import React, { useState } from 'react';
import { X, Wrench, AlertCircle } from 'lucide-react';
import { addStoredMechanicSpecialty } from '../utils/mechanicSpecialties';

interface AddMechanicSpecialtyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSpecialtyAdded: (newSpecialty: string) => void;
  existingSpecialties: string[];
}

export function AddMechanicSpecialtyModal({
  isOpen,
  onClose,
  onSpecialtyAdded,
  existingSpecialties,
}: AddMechanicSpecialtyModalProps) {
  const [newSpecialtyName, setNewSpecialtyName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newSpecialtyName.trim();
    if (!trimmed) return;

    if (existingSpecialties.some(s => s.trim().toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg('این تخصص قبلاً در لیست ثبت شده است.');
      return;
    }

    addStoredMechanicSpecialty(trimmed);
    onSpecialtyAdded(trimmed);
    setNewSpecialtyName('');
    setErrorMsg('');
    onClose();
  };

  const handleClose = () => {
    setNewSpecialtyName('');
    setErrorMsg('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 overflow-y-auto" dir="rtl">
      <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* هدر مدال */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-[#202024] rounded-lg border border-slate-200 dark:border-[#303035] shadow-xs">
              <Wrench className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-slate-900 dark:text-white text-sm font-bold">
                ثبت تخصص جدید تعمیرکار
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                افزودن به لیست گزینه‌های تخصص اصلی مراکز خدمات و تعمیرکاران
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* فرم مدال */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 text-xs bg-white dark:bg-[#111113]">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300 block">
              عنوان تخصص <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="مثال: تنظیم موتور و دیاگ، تودوزی و تریم، کولر و تهویه مطبوع..."
              value={newSpecialtyName}
              onChange={(e) => {
                setNewSpecialtyName(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
              required
            />
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              این تخصص در لیست ذخیره شده و بلافاصله برای این تعمیرکار انتخاب خواهد شد.
            </p>
          </div>

          {/* دکمه‌های ثبت و انصراف */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-[#2d2d30]">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 border border-slate-300 dark:border-[#2d2d30] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a1a1c] font-bold rounded-lg transition-colors text-xs cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors shadow-xs active:scale-95 text-xs cursor-pointer"
            >
              ثبت تخصص
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
