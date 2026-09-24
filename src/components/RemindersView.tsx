/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Bell, Plus, Search, Calendar, Clock,
  User as UserIcon, Trash2, Check,
  Send, RefreshCw, X, AlertCircle, List,
  FileSpreadsheet, Printer
} from 'lucide-react';
import { Reminder, ReminderPriority, ReminderStatus, User, Person, Vehicle } from '../types';
import { JalaliDatePicker } from './JalaliDatePicker';
import { CustomTimePicker } from './CustomTimePicker';
import { Pagination } from './Pagination';
import { toPersianDigits } from '../utils/numberUtils';
import { getCurrentJalaliDate, jalaliDayDifference } from '../utils/date';
import { CustomSelect, Option } from './CustomSelect';
import { exportToCsv, printTableReport } from '../utils/exportPrintUtils';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { TableColumnHeader, ColumnFilterMenu, FilterMenuState } from './TableFilterSort';
import { sortData, SortDirection } from '../utils/sortUtils';

interface RemindersViewProps {
  reminders: Reminder[];
  users: User[];
  persons: Person[];
  vehicles: Vehicle[];
  onAddReminder: (reminderData: Omit<Reminder, 'id' | 'createdAt'>) => Promise<void>;
  onEditReminder: (id: number, reminderData: Partial<Reminder>) => Promise<void>;
  onDeleteReminder: (id: number) => Promise<void>;
  onSendSms: (id: number, phone?: string, customMessage?: string) => Promise<{ success: boolean; message: string }>;
  onCheckTodayReminders: () => Promise<void>;
  currentUser?: User | null;
}

export const RemindersView: React.FC<RemindersViewProps> = ({
  reminders = [],
  users = [],
  persons = [],
  vehicles = [],
  onAddReminder,
  onEditReminder,
  onDeleteReminder,
  onSendSms,
  onCheckTodayReminders,
  currentUser,
}) => {
  const todayJalali = getCurrentJalaliDate();

  // تب فعال
  const [activeTab, setActiveTab] = useState<'today' | 'pending' | 'sent' | 'all'>('today');

  // فیلترهای جستجو و تاریخ
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // مرتب‌سازی و فیلتر ستون‌ها
  const [sortKey, setSortKey] = useState<string>('reminderDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [filterMenu, setFilterMenu] = useState<FilterMenuState | null>(null);

  // صفحه‌بندی
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // استیت‌های مدال ثبت / ویرایش
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // استیت مدال حذف
  const [deleteTarget, setDeleteTarget] = useState<Reminder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // فیلدهای فرم ثبت / ویرایش
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formReminderDate, setFormReminderDate] = useState(todayJalali);
  const [formReminderTime, setFormReminderTime] = useState('09:00');
  const [formSelectedRecipientKey, setFormSelectedRecipientKey] = useState<string>('');
  const [formCustomTargetName, setFormCustomTargetName] = useState('');
  const [formCustomTargetPhone, setFormCustomTargetPhone] = useState('');
  const [formSendSms, setFormSendSms] = useState(true);
  const [formNotes, setFormNotes] = useState('');

  // پیامک و فیدبک
  const [sendingSmsId, setSendingSmsId] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // ساخت لیست گزینه‌های گیرنده
  const recipientOptions: Option[] = useMemo(() => {
    const list: Option[] = [];
    const addedNames = new Set<string>();

    if (currentUser && currentUser.fullName) {
      list.push({
        value: `user_${currentUser.id}`,
        label: currentUser.fullName
      });
      addedNames.add(currentUser.fullName);
    }

    (users || []).forEach(u => {
      if (u.fullName && !addedNames.has(u.fullName)) {
        list.push({
          value: `user_${u.id}`,
          label: u.fullName
        });
        addedNames.add(u.fullName);
      }
    });

    (vehicles || []).forEach(v => {
      if (v.driverName && !addedNames.has(v.driverName)) {
        list.push({
          value: `driver_${v.id}`,
          label: v.driverName
        });
        addedNames.add(v.driverName);
      }
    });

    (persons || []).forEach(p => {
      if (p.fullName && !addedNames.has(p.fullName)) {
        list.push({
          value: `person_${p.id}`,
          label: p.fullName
        });
        addedNames.add(p.fullName);
      }
    });

    list.push({
      value: 'custom_manual',
      label: 'ورود نام و شماره دستی...'
    });

    return list;
  }, [currentUser, users, vehicles, persons]);

  // شمارنده‌های تب‌ها
  const counts = useMemo(() => {
    let todayCount = 0;
    let pendingCount = 0;
    let sentCount = 0;

    (reminders || []).forEach((r) => {
      const isSent = r.smsSent || r.status === 'reminded';
      if (isSent) {
        sentCount++;
      } else if (r.status !== 'cancelled') {
        const diff = jalaliDayDifference(r.reminderDate, todayJalali);
        if (diff === 0) {
          todayCount++;
        }
        pendingCount++;
      }
    });

    return {
      today: todayCount,
      pending: pendingCount,
      sent: sentCount,
      all: (reminders || []).length
    };
  }, [reminders, todayJalali]);

  // استخراج مقدار ستون برای فیلتر و اکسل
  const getReminderStatusLabel = (r: Reminder, today: string): string => {
    if (r.status === 'completed') return 'انجام‌شده';
    if (r.smsSent || r.status === 'reminded') return 'پیامک ارسال شد';
    const diffDays = jalaliDayDifference(r.reminderDate, today);
    if (diffDays === 0) return 'موعد امروز';
    if (diffDays < 0) return 'سپری‌شده';
    return 'در انتظار';
  };

  const getReminderColValue = (r: Reminder, colKey: string): string => {
    if (colKey === 'title') return r.title || 'بدون عنوان';
    if (colKey === 'reminderDate') return r.reminderDate || '---';
    if (colKey === 'targetName') return r.targetName || 'بدون مخاطب';
    if (colKey === 'targetPhone') return r.targetPhone ? toPersianDigits(r.targetPhone) : 'ثبت نشده';
    if (colKey === 'status') {
      return getReminderStatusLabel(r, todayJalali);
    }
    return String((r as any)[colKey] ?? '---');
  };

  // مدیریت فیلتر ستون‌ها
  const handleOpenFilterMenu = (e: React.MouseEvent, colKey: string, colTitle: string) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 270;
    const menuHeight = 360;
    const clampedX = Math.max(10, Math.min(e.clientX - 100, window.innerWidth - menuWidth - 10));
    const clampedY = Math.max(10, Math.min(e.clientY + 8, window.innerHeight - menuHeight - 10));
    setFilterMenu({
      x: clampedX,
      y: clampedY,
      colKey,
      colTitle
    });
  };

  const currentMenuUniqueValues = useMemo(() => {
    if (!filterMenu) return [];
    const valMap = new Map<string, number>();
    reminders.forEach(r => {
      const val = getReminderColValue(r, filterMenu.colKey);
      valMap.set(val, (valMap.get(val) || 0) + 1);
    });
    return Array.from(valMap.entries()).map(([value, count]) => ({ value, count }));
  }, [filterMenu, reminders]);

  const currentSelectedValues = useMemo(() => {
    if (!filterMenu) return [];
    if (columnFilters[filterMenu.colKey]) {
      return columnFilters[filterMenu.colKey];
    }
    return currentMenuUniqueValues.map(v => v.value);
  }, [filterMenu, columnFilters, currentMenuUniqueValues]);

  const handleToggleColumnValue = (val: string) => {
    if (!filterMenu) return;
    const colKey = filterMenu.colKey;
    const allVals = currentMenuUniqueValues.map(v => v.value);
    const currSelected = columnFilters[colKey] ?? allVals;

    let updated: string[];
    if (currSelected.includes(val)) {
      updated = currSelected.filter(v => v !== val);
    } else {
      updated = [...currSelected, val];
    }

    if (updated.length === allVals.length) {
      const next = { ...columnFilters };
      delete next[colKey];
      setColumnFilters(next);
    } else {
      setColumnFilters({ ...columnFilters, [colKey]: updated });
    }
  };

  const handleSelectAllColumnValues = () => {
    if (!filterMenu) return;
    const next = { ...columnFilters };
    delete next[filterMenu.colKey];
    setColumnFilters(next);
  };

  const handleDeselectAllColumnValues = () => {
    if (!filterMenu) return;
    setColumnFilters({ ...columnFilters, [filterMenu.colKey]: [] });
  };

  const handleSelectOnlyColumnValue = (val: string) => {
    if (!filterMenu) return;
    setColumnFilters({ ...columnFilters, [filterMenu.colKey]: [val] });
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // فیلتر کردن لیست یادآوری‌ها بر اساس تب‌های جدید
  const filteredReminders = useMemo(() => {
    return (reminders || []).filter((r) => {
      const isSent = r.smsSent || r.status === 'reminded';

      // فیلتر تب
      if (activeTab === 'today') {
        const diff = jalaliDayDifference(r.reminderDate, todayJalali);
        if (diff !== 0 || isSent || r.status === 'cancelled') return false;
      } else if (activeTab === 'pending') {
        if (isSent || r.status === 'cancelled') return false;
      } else if (activeTab === 'sent') {
        if (!isSent) return false;
      }

      // فیلتر بازه تاریخ
      if (startDate && r.reminderDate < startDate) return false;
      if (endDate && r.reminderDate > endDate) return false;

      // فیلتر متن جستجو
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchTitle = (r.title || '').toLowerCase().includes(q);
        const matchDesc = (r.description || '').toLowerCase().includes(q);
        const matchTarget = (r.targetName || '').toLowerCase().includes(q);
        const matchPhone = (r.targetPhone || '').toLowerCase().includes(q);
        const matchDate = (r.reminderDate || '').includes(q);
        if (!matchTitle && !matchDesc && !matchTarget && !matchPhone && !matchDate) {
          return false;
        }
      }

      // فیلترهای ستونی
      for (const [key, selectedVals] of Object.entries(columnFilters)) {
        if (!selectedVals || !Array.isArray(selectedVals)) continue;
        const val = getReminderColValue(r, key);
        if (!selectedVals.includes(val)) return false;
      }

      return true;
    });
  }, [reminders, activeTab, startDate, endDate, searchTerm, columnFilters, todayJalali]);

  // مرتب‌سازی
  const sortedReminders = useMemo(() => {
    return sortData(filteredReminders, sortKey, sortDirection);
  }, [filteredReminders, sortKey, sortDirection]);

  // صفحه‌بندی
  const paginatedReminders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedReminders.slice(startIndex, startIndex + pageSize);
  }, [sortedReminders, currentPage, pageSize]);

  // باز کردن فرم ثبت
  const handleOpenCreateForm = () => {
    setEditingReminder(null);
    setFormTitle('');
    setFormDescription('');
    setFormReminderDate(todayJalali);
    setFormReminderTime('09:00');
    setFormSelectedRecipientKey(currentUser ? `user_${currentUser.id}` : (recipientOptions[0]?.value ? String(recipientOptions[0].value) : 'custom_manual'));
    setFormCustomTargetName(currentUser ? currentUser.fullName : '');
    setFormCustomTargetPhone(currentUser?.phone || '');
    setFormSendSms(true);
    setFormNotes('');
    setIsModalOpen(true);
  };

  // باز کردن فرم ویرایش
  const handleOpenEditForm = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setFormTitle(reminder.title);
    setFormDescription(reminder.description || '');
    setFormReminderDate(reminder.reminderDate);
    setFormReminderTime(reminder.reminderTime || '09:00');

    if (reminder.targetType === 'user' && reminder.targetId) {
      setFormSelectedRecipientKey(`user_${reminder.targetId}`);
    } else if (reminder.targetType === 'driver' && reminder.targetId) {
      setFormSelectedRecipientKey(`driver_${reminder.targetId}`);
    } else if (reminder.targetType === 'person' && reminder.targetId) {
      setFormSelectedRecipientKey(`person_${reminder.targetId}`);
    } else {
      setFormSelectedRecipientKey('custom_manual');
    }

    setFormCustomTargetName(reminder.targetName || '');
    setFormCustomTargetPhone(reminder.targetPhone || '');
    setFormSendSms(reminder.sendSms);
    setFormNotes(reminder.notes || '');
    setIsModalOpen(true);
  };

  // ارسال فرم
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('لطفاً موضوع و عنوان یادآوری را وارد نمایید.');
      return;
    }
    if (!formReminderDate) {
      alert('لطفاً تاریخ یادآوری را مشخص نمایید.');
      return;
    }
    if (!formReminderTime.trim()) {
      alert('لطفاً ساعت یادآوری را مشخص نمایید.');
      return;
    }

    setIsSubmitting(true);
    try {
      let targetType: 'user' | 'person' | 'driver' | 'custom_phone' = 'user';
      let targetId: number | string | undefined = undefined;
      let targetName = '';
      let targetPhone = '';

      if (formSelectedRecipientKey.startsWith('user_')) {
        const uId = formSelectedRecipientKey.replace('user_', '');
        const u = users.find(user => String(user.id) === uId) || (currentUser && String(currentUser.id) === uId ? currentUser : null);
        targetType = 'user';
        targetId = u ? u.id : uId;
        targetName = u ? u.fullName : 'کاربر';
        targetPhone = u?.phone || '';
      } else if (formSelectedRecipientKey.startsWith('driver_')) {
        const vId = Number(formSelectedRecipientKey.replace('driver_', ''));
        const v = vehicles.find(veh => veh.id === vId);
        targetType = 'driver';
        targetId = vId;
        targetName = v ? v.driverName : 'راننده';
        targetPhone = v?.driverPhone || '';
      } else if (formSelectedRecipientKey.startsWith('person_')) {
        const pId = Number(formSelectedRecipientKey.replace('person_', ''));
        const p = persons.find(pers => pers.id === pId);
        targetType = 'person';
        targetId = pId;
        targetName = p ? p.fullName : 'پرسنل';
        targetPhone = p?.phone || '';
      } else {
        targetType = 'custom_phone';
        targetName = formCustomTargetName.trim() || 'مخاطب';
        targetPhone = formCustomTargetPhone.trim();
      }

      const reminderPayload = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        reminderDate: formReminderDate,
        reminderTime: formReminderTime.trim() || '09:00',
        category: 'general',
        priority: 'normal' as ReminderPriority,
        targetType,
        targetId,
        targetName,
        targetPhone,
        sendSms: formSendSms,
        status: editingReminder ? editingReminder.status : ('pending' as ReminderStatus),
        notes: formNotes.trim() || undefined
      };

      if (editingReminder) {
        await onEditReminder(editingReminder.id, reminderPayload);
        setStatusMessage({ type: 'success', text: 'یادآوری با موفقیت ویرایش شد.' });
      } else {
        await onAddReminder(reminderPayload);
        setStatusMessage({ type: 'success', text: 'یادآوری جدید با موفقیت ثبت شد.' });
      }

      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'خطا در ثبت اطلاعات یادآوری');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // حذف
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await onDeleteReminder(deleteTarget.id);
      setStatusMessage({ type: 'success', text: 'یادآوری با موفقیت حذف شد.' });
      setDeleteTarget(null);
    } catch (err: any) {
      alert(err.message || 'خطا در حذف یادآوری');
    } finally {
      setIsDeleting(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // ارسال پیامک دستی
  const handleSendSingleSms = async (reminder: Reminder) => {
    if (!reminder.targetPhone) {
      alert('شماره موبایلی برای این یادآوری ثبت نشده است.');
      return;
    }

    setSendingSmsId(reminder.id);
    try {
      const res = await onSendSms(reminder.id, reminder.targetPhone);
      if (res.success) {
        setStatusMessage({ type: 'success', text: `پیامک یادآوری به ${reminder.targetName || reminder.targetPhone} ارسال شد.` });
      } else {
        setStatusMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'خطا در ارسال پیامک' });
    } finally {
      setSendingSmsId(null);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  // خروجی اکسل
  const handleExportExcel = () => {
    const headers = [
      'ردیف',
      'موضوع یادآوری',
      'تاریخ موعد',
      'گیرنده یادآوری',
      'شماره تماس',
      'وضعیت'
    ];

    const rows = sortedReminders.map((r, idx) => [
      idx + 1,
      r.title,
      r.reminderDate,
      r.targetName || '---',
      r.targetPhone || '---',
      getReminderStatusLabel(r, todayJalali)
    ]);

    exportToCsv('لیست_یادآوری_ها', headers, rows);
  };

  // چاپ گزارش
  const handlePrint = () => {
    const headers = [
      'ردیف',
      'موضوع یادآوری',
      'تاریخ موعد',
      'گیرنده',
      'شماره تماس',
      'وضعیت'
    ];

    const rows = sortedReminders.map((r, idx) => [
      toPersianDigits(idx + 1),
      r.title,
      toPersianDigits(r.reminderDate),
      r.targetName || '---',
      r.targetPhone ? toPersianDigits(r.targetPhone) : '---',
      getReminderStatusLabel(r, todayJalali)
    ]);

    printTableReport({
      title: 'گزارش یادآوری‌ها و پیگیری‌های ناوگان',
      subtitle: 'مدیریت ترابری و ناوگان یاس - لیست برنامه‌ها و موعدها',
      filterInfo: [
        { label: 'تعداد کل یادآوری‌های فهرست', value: `${toPersianDigits(sortedReminders.length)} مورد` },
        { label: 'فیلتر بخش فعال', value: activeTab === 'today' ? 'موعد امروز' : activeTab === 'pending' ? 'در انتظار موعد' : activeTab === 'sent' ? 'پیامک‌های ارسال‌شده' : 'همه یادآوری‌ها' },
        ...(startDate || endDate ? [{ label: 'بازه تاریخی', value: `${startDate || 'ابتدا'} تا ${endDate || 'انتها'}` }] : []),
        ...(searchTerm ? [{ label: 'عبارت جستجوشده', value: searchTerm }] : [])
      ],
      headers,
      rows,
      columnAligns: ['center', 'right', 'center', 'right', 'center', 'center'],
      summaryItems: [
        { label: 'موعدهای امروز', value: `${toPersianDigits(counts.today)} مورد` },
        { label: 'در انتظار موعد', value: `${toPersianDigits(counts.pending)} مورد` },
        { label: 'پیامک‌های ارسال‌شده', value: `${toPersianDigits(counts.sent)} مورد` },
        { label: 'کل یادآوری‌ها', value: `${toPersianDigits(sortedReminders.length)} مورد`, isHighlight: true }
      ]
    });
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* منوی فیلتر ستون‌ها */}
      <ColumnFilterMenu
        filterMenu={filterMenu}
        onClose={() => setFilterMenu(null)}
        uniqueValues={currentMenuUniqueValues}
        selectedValues={currentSelectedValues}
        onToggleValue={handleToggleColumnValue}
        onSelectAll={handleSelectAllColumnValues}
        onDeselectAll={handleDeselectAllColumnValues}
        onSelectOnly={handleSelectOnlyColumnValue}
      />

      {/* پیام فیدبک وضعیت */}
      {statusMessage && (
        <div className={`p-3 rounded-lg flex items-center justify-between text-xs font-medium border transition-all animate-in fade-in ${
          statusMessage.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
            : statusMessage.type === 'error'
            ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800'
            : 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
        }`}>
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? <AlertCircle className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{statusMessage.text}</span>
          </div>
          <button type="button" onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* هدر بخش و دکمه‌های عملیاتی (مشابه تعاریف) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-[#111113] p-4 rounded-lg border border-slate-200 dark:border-[#2d2d30]">
        <div>
          <h1 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>مدیریت یادآوری‌ها و پیگیری‌ها</span>
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            ثبت موعدهای کاری، پیگیری مدارک و اقدامات با قابلیت ارسال خودکار پیامک
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={onCheckTodayReminders}
            className="bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-300 font-bold px-3 py-1.5 rounded-md text-[11px] border border-slate-200 dark:border-[#2d2d30] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="بررسی فوری یادآوری‌های امروز و ارسال پیامک"
          >
            <RefreshCw className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>بررسی وضعیت امروز</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateForm}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ثبت یادآوری جدید</span>
          </button>
        </div>
      </div>

      {/* تب‌های جابجایی بین بخش‌ها */}
      <div className="flex border-b border-slate-200 dark:border-[#2d2d30] gap-2 overflow-x-auto relative">
        <button
          type="button"
          onClick={() => { setActiveTab('today'); setCurrentPage(1); }}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'today'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>موعدهای امروز</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1a1a1c] text-slate-600 dark:text-slate-400 font-mono font-bold">
            {toPersianDigits(counts.today)}
          </span>
          {activeTab === 'today' && (
            <motion.div
              layoutId="activeReminderTabIndicator"
              className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'pending'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>در انتظار موعد</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1a1a1c] text-slate-600 dark:text-slate-400 font-mono font-bold">
            {toPersianDigits(counts.pending)}
          </span>
          {activeTab === 'pending' && (
            <motion.div
              layoutId="activeReminderTabIndicator"
              className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('sent'); setCurrentPage(1); }}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'sent'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>پیامک‌های ارسال‌شده</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1a1a1c] text-slate-600 dark:text-slate-400 font-mono font-bold">
            {toPersianDigits(counts.sent)}
          </span>
          {activeTab === 'sent' && (
            <motion.div
              layoutId="activeReminderTabIndicator"
              className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
          className={`relative pb-2.5 px-4 text-xs font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'all'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <List className="w-4 h-4" />
          <span>همه یادآوری‌ها</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1a1a1c] text-slate-600 dark:text-slate-400 font-mono font-bold">
            {toPersianDigits(counts.all)}
          </span>
          {activeTab === 'all' && (
            <motion.div
              layoutId="activeReminderTabIndicator"
              className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>
      </div>

      {/* نوار ابزار جستجو و فیلتر */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        {/* فیلد جستجو */}
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input 
            type="text" 
            placeholder="جستجوی موضوع، نام مخاطب، شرح یا تاریخ..." 
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
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

        {/* فیلتر از تاریخ */}
        <div className="w-full sm:w-36">
          <JalaliDatePicker
            value={startDate}
            onChange={(val) => { setStartDate(val); setCurrentPage(1); }}
            placeholder="از تاریخ"
            inputClassName="h-[34px] text-[11px] rounded-lg px-2.5 pr-2.5 pl-7 font-mono"
          />
        </div>

        {/* فیلتر تا تاریخ */}
        <div className="w-full sm:w-36">
          <JalaliDatePicker
            value={endDate}
            onChange={(val) => { setEndDate(val); setCurrentPage(1); }}
            placeholder="تا تاریخ"
            inputClassName="h-[34px] text-[11px] rounded-lg px-2.5 pr-2.5 pl-7 font-mono"
          />
        </div>

        {/* دکمه خروجی اکسل */}
        <button
          type="button"
          onClick={handleExportExcel}
          className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-2xs shrink-0 group self-center"
          title="دریافت خروجی اکسل"
        >
          <FileSpreadsheet className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>

        {/* دکمه چاپ گزارش رسمی */}
        <button
          type="button"
          onClick={handlePrint}
          className="h-[34px] w-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111113] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-300 dark:border-[#2d2d30] hover:border-indigo-500 text-indigo-600 dark:text-indigo-400 transition-all cursor-pointer shadow-2xs shrink-0 group self-center"
          title="چاپ گزارش رسمی (نسخه چاپی / PDF)"
        >
          <Printer className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>
      </div>

      {/* جدول داده‌ها: ساختار دقیق بخش تعاریف با آیکون‌های عملیات شناور (بدون دکمه ویرایش) */}
      <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex justify-between items-center">
          <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-900 dark:text-white">
            <List className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>
              {activeTab === 'today'
                ? 'یادآوری‌های موعد امروز'
                : activeTab === 'pending'
                ? 'یادآوری‌های در انتظار موعد'
                : activeTab === 'completed'
                ? 'اقدامات انجام‌شده'
                : 'فهرست تمام یادآوری‌ها'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              {toPersianDigits(sortedReminders.length)} مورد
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618] text-slate-600 dark:text-slate-400 font-medium text-xs">
                <th className="py-2 px-3 text-center w-12 text-xs font-medium">ردیف</th>

                <TableColumnHeader
                  title="موضوع یادآوری"
                  colKey="title"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['title']}
                  onOpenFilter={handleOpenFilterMenu}
                />

                <TableColumnHeader
                  title="تاریخ موعد"
                  colKey="reminderDate"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['reminderDate']}
                  onOpenFilter={handleOpenFilterMenu}
                  className="w-28 text-center"
                />

                <TableColumnHeader
                  title="گیرنده یادآوری"
                  colKey="targetName"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['targetName']}
                  onOpenFilter={handleOpenFilterMenu}
                  className="w-36"
                />

                <TableColumnHeader
                  title="شماره تماس"
                  colKey="targetPhone"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['targetPhone']}
                  onOpenFilter={handleOpenFilterMenu}
                  className="w-28 text-center"
                />

                <TableColumnHeader
                  title="وضعیت"
                  colKey="status"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  isFiltered={!!columnFilters['status']}
                  onOpenFilter={handleOpenFilterMenu}
                  className="w-32 text-center"
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
              {paginatedReminders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500 text-[11px]">
                    هیچ موردی با شرایط انتخابی یافت نشد.
                  </td>
                </tr>
              ) : (
                paginatedReminders.map((r, idx) => {
                  const diffDays = jalaliDayDifference(r.reminderDate, todayJalali);
                  const isToday = diffDays === 0;
                  const isOverdue = diffDays < 0 && r.status !== 'completed';

                  return (
                    <tr
                      key={r.id}
                      onClick={() => handleOpenEditForm(r)}
                      title="برای ویرایش اطلاعات یادآوری کلیک کنید"
                      className="group relative hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/60 transition-colors cursor-pointer text-[11px]"
                    >
                      {/* ردیف */}
                      <td className="py-1.5 px-3 text-center text-slate-500 text-[11px]">
                        {toPersianDigits((currentPage - 1) * pageSize + idx + 1)}
                      </td>

                      {/* موضوع */}
                      <td className="py-1.5 px-3 max-w-xs truncate" title={r.title}>
                        <span className={`text-slate-900 dark:text-white text-[11px] truncate ${r.status === 'completed' ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>
                          {r.title}
                        </span>
                      </td>

                      {/* تاریخ موعد */}
                      <td className="py-1.5 px-3 text-center whitespace-nowrap">
                        <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                          {toPersianDigits(r.reminderDate)}
                        </span>
                      </td>

                      {/* گیرنده */}
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <span className="text-slate-900 dark:text-white text-[11px]">
                          {r.targetName || '---'}
                        </span>
                      </td>

                      {/* شماره تماس */}
                      <td className="py-1.5 px-3 text-center whitespace-nowrap">
                        <span className="font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                          {r.targetPhone ? toPersianDigits(r.targetPhone) : '---'}
                        </span>
                      </td>

                      {/* ستون وضعیت یکپارچه (شامل ارسال پیامک و وضعیت موعد) و آیکون‌های عملیات شناور */}
                      <td className="py-1.5 px-3 text-center whitespace-nowrap relative">
                        {r.status === 'completed' ? (
                          <span className="inline-block text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
                            انجام‌شده
                          </span>
                        ) : (r.smsSent || r.status === 'reminded') ? (
                          <span className="inline-block text-[10px] text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20 font-medium">
                            پیامک ارسال شد
                          </span>
                        ) : isToday ? (
                          <span className="inline-block text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-medium">
                            موعد امروز
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-block text-[10px] text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 font-medium">
                            سپری‌شده
                          </span>
                        ) : (
                          <span className="inline-block text-[10px] text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 font-medium">
                            در انتظار
                          </span>
                        )}

                        {/* دکمه‌های عملیات شناور - فقط هنگام بردن ماوس روی ردیف (دقیقاً مشابه تعاریف) */}
                        <div className="absolute inset-y-0 left-0 pl-2 pr-8 flex items-center gap-1 bg-gradient-to-r from-slate-50 via-slate-50 via-70% to-transparent dark:from-[#1a1a1c] dark:via-[#1a1a1c] dark:via-70% dark:to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 z-20 pointer-events-none group-hover:pointer-events-auto">
                          {/* ارسال پیامک دستی */}
                          {r.targetPhone && (
                            <button
                              type="button"
                              disabled={sendingSmsId === r.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSendSingleSms(r);
                              }}
                              className="w-[22px] h-[22px] flex items-center justify-center bg-slate-100 dark:bg-[#1a1a1c] hover:bg-blue-100 dark:hover:bg-blue-600/20 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded border border-slate-200 dark:border-[#2d2d30] transition-colors cursor-pointer disabled:opacity-50"
                              title="ارسال پیامک یادآوری"
                            >
                              <Send className="w-3 h-3" />
                            </button>
                          )}

                          {/* حذف */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(r);
                            }}
                            className="w-[22px] h-[22px] flex items-center justify-center bg-slate-100 dark:bg-[#1a1a1c] hover:bg-rose-100 dark:hover:bg-rose-600/20 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded border border-slate-200 dark:border-[#2d2d30] transition-colors cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* صفحه‌بندی */}
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(sortedReminders.length / pageSize) || 1}
          pageSize={pageSize}
          totalItems={sortedReminders.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* مدال ثبت / ویرایش یادآوری */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 overflow-y-auto" dir="rtl">
          <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-[#2d2d30] rounded-xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* سربرگ مدال */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#161618]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-[#202024] rounded-lg border border-slate-200 dark:border-[#303035] shadow-xs">
                  <Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-slate-900 dark:text-white text-sm font-bold">
                    {editingReminder ? 'ویرایش یادآوری' : 'ثبت یادآوری جدید'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    تعریف تاریخ موعد، ساعت و مشخصات گیرنده یادآوری
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1a1a1c] rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* بدنه فرم */}
            <form onSubmit={handleSubmitForm} className="p-4 sm:p-5 space-y-4 text-xs bg-white dark:bg-[#111113]">
              {/* موضوع */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  موضوع و عنوان یادآوری <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="مثال: پیگیری تمدید بیمه، سرویس دوره‌ای، چک، معاینه فنی..."
                  className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* تاریخ موعد و ساعت */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>تاریخ موعد <span className="text-rose-500">*</span></span>
                  </label>
                  <JalaliDatePicker
                    value={formReminderDate}
                    onChange={setFormReminderDate}
                    placeholder="انتخاب تاریخ موعد..."
                    inputClassName="h-[38px]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>ساعت یادآوری <span className="text-rose-500">*</span></span>
                  </label>
                  <CustomTimePicker
                    value={formReminderTime}
                    onChange={setFormReminderTime}
                    placeholder="انتخاب ساعت یادآوری..."
                    required={true}
                    buttonClassName="h-[38px]"
                  />
                </div>
              </div>

              {/* گیرنده یادآوری */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <UserIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>گیرنده یادآوری</span>
                </label>
                <CustomSelect
                  options={recipientOptions}
                  value={formSelectedRecipientKey}
                  onChange={(val) => setFormSelectedRecipientKey(String(val))}
                  searchable={true}
                  placeholder="انتخاب مخاطب..."
                />

                {/* در صورت انتخاب ورود دستی شماره */}
                {formSelectedRecipientKey === 'custom_manual' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 animate-in fade-in duration-150">
                    <div>
                      <input
                        type="text"
                        value={formCustomTargetName}
                        onChange={(e) => setFormCustomTargetName(e.target.value)}
                        placeholder="نام مخاطب"
                        className="w-full bg-white dark:bg-[#1a1a1c] border border-slate-300 dark:border-[#2d2d30] text-slate-900 dark:text-white text-xs rounded-lg px-2.5 py-2 font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={formCustomTargetPhone}
                        onChange={(e) => setFormCustomTargetPhone(e.target.value)}
                        placeholder="شماره موبایل (09...)"
                        className="w-full bg-white dark:bg-[#1a1a1c] border border-slate-300 dark:border-[#2d2d30] text-slate-900 dark:text-white text-xs rounded-lg px-2.5 py-2 font-mono text-left dir-ltr focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* شرح و توضیحات تکمیلی */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  شرح و جزئیات تکمیلی (اختیاری)
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="توضیحات بیشتر، اقدامات لازم و..."
                  className="w-full bg-white dark:bg-[#1a1a1c] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* فعال بودن ارسال خودکار پیامک */}
              <div className="p-3 bg-slate-50 dark:bg-[#161618] border border-slate-200 dark:border-[#2d2d30] rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-white dark:bg-[#202024] rounded-md border border-slate-200 dark:border-[#303035] text-indigo-600 dark:text-indigo-400">
                    <Send className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">ارسال پیامک در موعد یادآوری</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">اطلاع‌رسانی پیامکی خودکار در تاریخ موعد به شماره مخاطب</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formSendSms}
                  onChange={(e) => setFormSendSms(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded cursor-pointer accent-indigo-600"
                />
              </div>

              {/* دکمه‌های فرم */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-[#2d2d30]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-[#1a1a1c] hover:bg-slate-200 dark:hover:bg-[#252528] text-slate-700 dark:text-slate-300 font-bold rounded-lg transition-colors border border-slate-200 dark:border-[#2d2d30] text-xs cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors shadow-2xs disabled:opacity-50 inline-flex items-center gap-1.5 text-xs cursor-pointer active:scale-95"
                >
                  {isSubmitting ? (
                    <span>در حال ذخیره...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingReminder ? 'ذخیره تغییرات' : 'ثبت نهایی یادآوری'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* مدال تایید حذف */}
      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="حذف یادآوری"
        subtitle={deleteTarget ? deleteTarget.title : undefined}
        message="آیا از حذف این یادآوری اطمینان دارید؟ این عملیات غیرقابل بازگشت است."
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default RemindersView;
