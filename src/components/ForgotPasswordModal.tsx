/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  KeyRound, 
  Lock, 
  Smartphone, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  X, 
  ShieldCheck, 
  MessageSquare,
  Sparkles,
  Check
} from 'lucide-react';
import { toPersianDigits } from '../utils/numberUtils';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessReset: (username: string, newPassword?: string) => void;
  theme: 'light' | 'dark';
}

type Step = 'request' | 'verify' | 'reset' | 'success';

export default function ForgotPasswordModal({
  isOpen,
  onClose,
  onSuccessReset,
  theme
}: ForgotPasswordModalProps) {
  const [step, setStep] = useState<Step>('request');
  const [identifier, setIdentifier] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [gatewayDelivered, setGatewayDelivered] = useState(true);
  const [gatewayInfo, setGatewayInfo] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resolvedUsername, setResolvedUsername] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [timerSeconds, setTimerSeconds] = useState(120);

  // تایمر ۲ دقیقه‌ای برای اعتبار کد تایید
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'verify' && timerSeconds > 0) {
      timer = setInterval(() => {
        setTimerSeconds(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, timerSeconds]);

  // بازنشانی فرم هنگام باز شدن
  useEffect(() => {
    if (isOpen) {
      setStep('request');
      setIdentifier('');
      setMaskedPhone('');
      setOtpCode('');
      setBackupCode('');
      setGatewayDelivered(true);
      setGatewayInfo('');
      setResetToken('');
      setNewPassword('');
      setConfirmPassword('');
      setErrorMsg('');
      setInfoMsg('');
      setTimerSeconds(120);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // مرحله ۱: ارسال درخواست دریافت کد تایید پیامکی
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!identifier.trim()) {
      setErrorMsg('لطفاً شماره تلفن همراه یا نام کاربری خود را وارد فرمایید.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setInfoMsg('');

    try {
      const res = await fetch('/api/auth/forgot-password/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMaskedPhone(data.maskedPhone || '');
        setTimerSeconds(data.expiresIn || 120);
        setGatewayDelivered(data.gatewayDelivered ?? true);
        setGatewayInfo(data.gatewayInfo || '');
        setBackupCode(data.backupCode || '');
        setInfoMsg(data.message || 'کد تایید با موفقیت به شماره شما پیامک شد.');
        setStep('verify');
      } else {
        setErrorMsg(data.message || 'خطا در ارسال پیامک. لطفاً مجدداً تلاش فرمایید.');
      }
    } catch {
      setErrorMsg('خطا در برقراری ارتباط با سرور سامانه.');
    } finally {
      setIsLoading(false);
    }
  };

  // مرحله ۲: بررسی و اعتبارسنجی کد پیامک شده
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otpCode.trim()) {
      setErrorMsg('لطفاً کد تایید ۵ رقمی پیامک شده را وارد فرمایید.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setInfoMsg('');

    try {
      const res = await fetch('/api/auth/forgot-password/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          identifier: identifier.trim(),
          code: otpCode.trim()
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResetToken(data.resetToken);
        setInfoMsg('کد تایید صحیح است. اکنون می‌توانید کلمه عبور جدید را تعیین نمایید.');
        setStep('reset');
      } else {
        setErrorMsg(data.message || 'کد تایید وارد شده نادرست است.');
      }
    } catch {
      setErrorMsg('خطا در اعتبارسنجی کد تایید.');
    } finally {
      setIsLoading(false);
    }
  };

  // مرحله ۳: ثبت رمز عبور جدید
  const handleResetPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newPassword) {
      setErrorMsg('لطفاً کلمه عبور جدید را وارد فرمایید.');
      return;
    }
    if (newPassword.length < 4) {
      setErrorMsg('کلمه عبور باید حداقل دارای ۴ کاراکتر باشد.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('کلمه عبور جدید با تکرار آن مطابقت ندارد.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setInfoMsg('');

    try {
      const res = await fetch('/api/auth/forgot-password/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          resetToken,
          newPassword: newPassword.trim()
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResolvedUsername(data.username || identifier);
        setStep('success');
      } else {
        setErrorMsg(data.message || 'خطا در ثبت رمز عبور جدید.');
      }
    } catch {
      setErrorMsg('خطا در ذخیره رمز عبور جدید بر روی سرور.');
    } finally {
      setIsLoading(false);
    }
  };

  // قالب‌بندی ثانیه‌ها به دقیقه و ثانیه (مثال: 01:45)
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const str = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return toPersianDigits(str);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-white dark:bg-[#121215] border border-slate-200 dark:border-white/10 rounded-[4px] shadow-2xl overflow-hidden flex flex-col transition-colors">
        
        {/* هدر پنجره */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/80 dark:bg-[#16161a]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[4px] bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                بازیابی کلمه عبور با پیامک
              </h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                مدیریت ناوگان خودرویی یاس
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-[4px] hover:bg-slate-200/60 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* بدنه و مراحل */}
        <div className="p-5 sm:p-6 space-y-4">
          
          {/* نوار وضعیت مراحل */}
          <div className="flex items-center justify-between px-2 pb-2 text-[10px] font-bold text-slate-400 border-b border-slate-100 dark:border-white/[0.05]">
            <span className={`flex items-center gap-1 ${step === 'request' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] bg-indigo-500/10 border border-indigo-500/20">۱</span>
              ورود شناسه
            </span>
            <span className="text-slate-300 dark:text-slate-700">←</span>
            <span className={`flex items-center gap-1 ${step === 'verify' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] bg-indigo-500/10 border border-indigo-500/20">۲</span>
              تایید پیامک
            </span>
            <span className="text-slate-300 dark:text-slate-700">←</span>
            <span className={`flex items-center gap-1 ${step === 'reset' || step === 'success' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] bg-indigo-500/10 border border-indigo-500/20">۳</span>
              رمز عبور جدید
            </span>
          </div>

          {/* پیام خطا */}
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-[4px] text-xs font-bold flex items-start gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* پیام راهنما/اطلاعات */}
          {infoMsg && (
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-[4px] text-xs font-bold flex items-start gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          {/* مرحله ۱: درخواست کد */}
          {step === 'request' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  نام کاربری یا شماره همراه پرسنل
                </label>
                <div className="relative">
                  <Smartphone className="absolute right-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="مثال: admin یا 09121111111"
                    autoFocus
                    className="w-full pr-10 pl-3 py-2.5 rounded-[4px] border border-slate-200 dark:border-white/10 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/70 dark:bg-[#18181c] text-slate-900 dark:text-white text-left font-mono transition-all"
                  />
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  کد تایید ۵ رقمی به شماره موبایل ثبت شده برای این حساب کاربری پیامک خواهد شد.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[4px] font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>در حال ارسال پیامک...</span>
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4" />
                    <span>ارسال کد تایید پیامکی</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* مرحله ۲: تایید کد پیامک شده */}
          {step === 'verify' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-[4px] border border-indigo-200 dark:border-indigo-800/40 text-xs">
                <div className="flex items-center justify-between text-indigo-900 dark:text-indigo-200 font-bold">
                  <span>کد ارسال شده به:</span>
                  <span className="font-mono text-xs dir-ltr">{toPersianDigits(maskedPhone)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    کد تایید ۵ رقمی پیامک شده
                  </label>
                  <span className={`text-[11px] font-mono font-bold ${timerSeconds > 0 ? 'text-amber-500 dark:text-amber-400' : 'text-rose-500'}`}>
                    {timerSeconds > 0 ? `اعتبار: ${formatTimer(timerSeconds)}` : 'منقضی شده'}
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="— — — — —"
                  autoFocus
                  className="w-full text-center py-2.5 tracking-[0.4em] font-mono text-lg rounded-[4px] border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/70 dark:bg-[#18181c] text-slate-900 dark:text-white transition-all"
                />
                <p className="text-[10px] text-slate-400 leading-relaxed text-center pt-1">
                  لطفاً کد دریافتی در صندوق پیامک‌های گوشی همراه خود را در کادر بالا وارد نمایید.
                </p>
              </div>

              {/* اعلان وضعیت درگاه پیامک در صورت نیاز به تایید خط در پنل اپراتور */}
              {!gatewayDelivered && gatewayInfo && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-[4px] text-[11px] space-y-1 text-amber-700 dark:text-amber-300">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span>وضعیت درگاه پیامک: {gatewayInfo}</span>
                  </div>
                  {backupCode && (
                    <div className="pt-1 flex items-center justify-between border-t border-amber-500/15">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">جهت تست آنی سیستم:</span>
                      <button
                        type="button"
                        onClick={() => setOtpCode(backupCode)}
                        className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 underline cursor-pointer hover:text-indigo-500"
                      >
                        درج کد تایید ({toPersianDigits(backupCode)})
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setStep('request')}
                  className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>تغییر نام کاربری</span>
                </button>

                <button
                  type="button"
                  disabled={timerSeconds > 0 || isLoading}
                  onClick={() => handleRequestOtp()}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 disabled:opacity-40 disabled:hover:text-indigo-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>ارسال مجدد پیامک</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading || !otpCode.trim()}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[4px] font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>در حال بررسی کد...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>تایید کد و ادامه</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* مرحله ۳: تعیین کلمه عبور جدید */}
          {step === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  کلمه عبور جدید
                </label>
                <div className="relative">
                  <Lock className="absolute right-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="حداقل ۴ کاراکتر"
                    autoFocus
                    className="w-full pr-10 pl-10 py-2.5 rounded-[4px] border border-slate-200 dark:border-white/10 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/70 dark:bg-[#18181c] text-slate-900 dark:text-white font-mono text-left transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  تکرار کلمه عبور جدید
                </label>
                <div className="relative">
                  <Lock className="absolute right-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="تکرار دقیق رمز جدید"
                    className="w-full pr-10 pl-10 py-2.5 rounded-[4px] border border-slate-200 dark:border-white/10 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/70 dark:bg-[#18181c] text-slate-900 dark:text-white font-mono text-left transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute left-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[4px] font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20 disabled:opacity-50 mt-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>در حال ذخیره رمز جدید...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>ثبت نهایی کلمه عبور جدید</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* مرحله ۴: پایان موفقیت‌آمیز */}
          {step === 'success' && (
            <div className="text-center py-4 space-y-4 animate-fadeIn">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto ring-4 ring-emerald-500/10">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  کلمه عبور با موفقیت بازنشانی شد!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  اکنون می‌توانید با حساب کاربری <span className="font-bold text-indigo-500">@{resolvedUsername}</span> و کلمه عبور جدید خود وارد سیستم شوید.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  onSuccessReset(resolvedUsername, newPassword);
                  onClose();
                }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[4px] font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
              >
                <span>ورود مستقیم به سامانه</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
