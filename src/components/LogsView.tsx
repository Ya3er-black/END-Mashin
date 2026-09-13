/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Search, ShieldAlert, History, User, Clock, Terminal } from 'lucide-react';
import { ActivityLog } from '../types';
import { Pagination } from './Pagination';
import { toPersianDigits } from '../utils/numberUtils';

interface LogsViewProps {
  logs: ActivityLog[];
}

export default function LogsView({ logs }: LogsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredLogs = logs.filter(log => 
    (log.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.actionDetails || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      
      {/* هدر اصلی */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-[#111113] p-4 rounded-lg border border-slate-200 dark:border-[#2d2d30]">
        <div>
          <h1 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            تاریخچه ثبت رویدادها و گزارش امنیت سیستم
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            رهگیری دقیق تمامی فعالیت‌ها، تغییرات مالی، فاکتورها، افزودن خودروها و جابجایی کالا در انبار
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 rounded-md font-mono text-[10px] border border-slate-200 dark:border-[#2d2d30] self-start sm:self-auto font-bold">
          <Terminal className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
          SYSTEM_AUDIT: OK (LIVE)
        </div>
      </div>

      {/* نوار جستجو */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-3 top-2.5" />
        <input 
          type="text" 
          placeholder="جستجوی سریع در شرح فعالیت، نام کاربری یا جزئیات..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white dark:bg-[#111113] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-[#2d2d30] rounded-lg pr-9 pl-3 py-2 text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* جدول استاندارد لاگ‌ها */}
      <div className="bg-white dark:bg-[#111113] rounded-lg border border-slate-200 dark:border-[#2d2d30] overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2d2d30] bg-slate-50 dark:bg-[#151518] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-900 dark:text-white font-extrabold text-[11px]">
            <History className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>رویدادنگاری زنده سیستم (System Audit Logs)</span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{toPersianDigits(filteredLogs.length)} مورد</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-[11px] text-slate-700 dark:text-slate-300 border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#161618] border-b border-slate-200 dark:border-[#2d2d30] text-slate-600 dark:text-slate-400 font-medium text-xs">
                <th className="py-2 px-3 w-12 text-center text-xs font-medium">ردیف</th>
                <th className="py-2 px-3 w-36 text-xs font-medium">تاریخ و زمان</th>
                <th className="py-2 px-3 w-32 text-xs font-medium">کاربر</th>
                <th className="py-2 px-3 w-36 text-xs font-medium">نوع فعالیت</th>
                <th className="py-2 px-3 text-xs font-medium">جزئیات و مشخصات</th>
                <th className="py-2 px-3 w-28 text-xs font-medium">آدرس IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d30]/60">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500 text-[11px]">
                    هیچ رویداد سیستمی ثبت نشده است.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log, index) => {
                  const formattedDate = new Date(log.createdAt).toLocaleString('fa-IR');
                  const isDanger = log.action.includes('حذف') || log.action.includes('مسدود');

                  return (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1c]/40 transition-colors text-[11px]">
                      <td className="py-1.5 px-3 text-center text-slate-500 text-[11px]">
                        {toPersianDigits((currentPage - 1) * pageSize + index + 1)}
                      </td>
                      <td className="py-1.5 px-3 text-slate-500 dark:text-slate-400 text-[11px]">
                        {toPersianDigits(formattedDate)}
                      </td>
                      <td className="py-1.5 px-3 text-[11px]">
                        <span className="text-emerald-600 dark:text-emerald-400">
                          @{log.username}
                        </span>
                      </td>
                      <td className="py-1.5 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] inline-block ${
                          isDanger ? 'bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30' : 'bg-slate-100 dark:bg-[#1a1a1c] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#2d2d30]'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-slate-800 dark:text-slate-200 text-[11px]">
                        {log.actionDetails || '---'}
                      </td>
                      <td className="py-1.5 px-3 text-slate-500 dark:text-slate-400 text-[11px]">
                        {log.ipAddress || '127.0.0.1'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredLogs.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}
