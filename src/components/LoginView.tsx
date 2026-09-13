/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  Sun, 
  Moon, 
  KeyRound, 
  Car, 
  Cog
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ForgotPasswordModal from './ForgotPasswordModal';

interface LoginViewProps {
  onLogin: (username: string, password?: string) => Promise<boolean>;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export default function LoginView({ onLogin, theme, onToggleTheme }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  // کانواس متحرک امواج چندلایه، عمیق و روان تلمتری ناوگان (بدون وابستگی به موس با ذرات کاملاً پخش‌شده در کل صفحه)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const getDimensions = () => {
      const pWidth = canvas.parentElement?.clientWidth || 0;
      const pHeight = canvas.parentElement?.clientHeight || 0;
      const rect = canvas.getBoundingClientRect();
      const w = pWidth > 50 ? pWidth : (rect.width > 50 ? rect.width : Math.max(window.innerWidth * 0.55, 600));
      const h = pHeight > 50 ? pHeight : (rect.height > 50 ? rect.height : Math.max(window.innerHeight, 600));
      return { w, h };
    };

    let { w: width, h: height } = getDimensions();
    canvas.width = width;
    canvas.height = height;

    const isDark = theme === 'dark';
    let step = 0;

    // ذرات نوری معلق در میان امواج - پخش‌شده به صورت کاملاً تصادفی و یکنواخت در کل سطح صفحه از بدو ورود
    const particleCount = 45;
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      alpha: number;
      pulseSpeed: number;
      pulsePhase: number;
    }> = [];

    const initParticles = (currentWidth: number, currentHeight: number) => {
      particles.length = 0;
      const effectiveW = Math.max(currentWidth, window.innerWidth * 0.55, 600);
      const effectiveH = Math.max(currentHeight, window.innerHeight, 600);

      for (let i = 0; i < particleCount; i++) {
        const baseA = Math.random() * 0.35 + 0.2;
        particles.push({
          x: Math.random() * effectiveW,
          y: Math.random() * effectiveH,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.3,
          radius: Math.random() * 2 + 0.8,
          alpha: baseA,
          pulseSpeed: 0.02 + Math.random() * 0.02,
          pulsePhase: Math.random() * Math.PI * 2
        });
      }
    };

    initParticles(width, height);

    // لایه‌های امواج ارگانیک چندگانه با دامنه‌ها و رنگ‌های شیک و بدون استروک (کاملاً مستقل از موس)
    const waveLayers = [
      { speed: 0.012, amp: 48, freq: 0.0032, baseHeight: 0.82, color1: isDark ? 'rgba(79, 70, 229, 0.28)' : 'rgba(99, 102, 241, 0.16)', color2: isDark ? 'rgba(30, 27, 75, 0.65)' : 'rgba(199, 210, 254, 0.45)' },
      { speed: 0.018, amp: 58, freq: 0.0042, baseHeight: 0.68, color1: isDark ? 'rgba(99, 102, 241, 0.22)' : 'rgba(129, 140, 248, 0.2)'  , color2: isDark ? 'rgba(49, 46, 129, 0.5)'  : 'rgba(224, 231, 255, 0.35)' },
      { speed: 0.015, amp: 42, freq: 0.0052, baseHeight: 0.54, color1: isDark ? 'rgba(14, 165, 233, 0.2)'  : 'rgba(56, 189, 248, 0.16)', color2: isDark ? 'rgba(15, 23, 42, 0.45)'  : 'rgba(240, 249, 255, 0.28)' },
      { speed: 0.024, amp: 36, freq: 0.0062, baseHeight: 0.42, color1: isDark ? 'rgba(129, 140, 248, 0.16)': 'rgba(99, 102, 241, 0.13)', color2: isDark ? 'rgba(30, 27, 75, 0.35)' : 'rgba(224, 231, 255, 0.22)' },
      { speed: 0.010, amp: 68, freq: 0.0025, baseHeight: 0.88, color1: isDark ? 'rgba(67, 56, 202, 0.38)' : 'rgba(79, 70, 229, 0.25)', color2: isDark ? 'rgba(15, 23, 42, 0.9)'   : 'rgba(199, 210, 254, 0.65)' }
    ];

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      step += 1;

      // ۱. رسم شبکه ژئومتریک محو
      const gridSize = 48;
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(79, 70, 229, 0.035)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // ۲. رسم امواج ارگانیک چندلایه، روان و خالص (کاملاً بدون خط و بدون اثرپذیری از موس)
      waveLayers.forEach((wave) => {
        const currentSpeed = step * wave.speed;
        const currentBaseY = height * wave.baseHeight;

        ctx.beginPath();
        ctx.moveTo(0, height);

        for (let x = 0; x <= width + 20; x += 15) {
          const sin1 = Math.sin((x * wave.freq) + currentSpeed);
          const cos1 = Math.cos((x * wave.freq * 0.75) - currentSpeed * 0.7);
          const sin2 = Math.sin((x * wave.freq * 1.5) + currentSpeed * 1.2);

          const y = currentBaseY + (sin1 * wave.amp * 0.65) + (cos1 * wave.amp * 0.35) + (sin2 * wave.amp * 0.2);

          if (x === 0) ctx.lineTo(0, y);
          else ctx.lineTo(x, y);
        }

        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();

        const waveGrad = ctx.createLinearGradient(0, currentBaseY - wave.amp, 0, height);
        waveGrad.addColorStop(0, wave.color1);
        waveGrad.addColorStop(1, wave.color2);
        ctx.fillStyle = waveGrad;
        ctx.fill();
      });

      // ۳. رسم ذرات نورانی معلق - رندوم و بدون تجمع در گوشه‌ها (کاملاً مستقل از موس)
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // تغییر ملایم شفافیت ذرات به‌صورت خودکار و رندوم
        const currentAlpha = Math.max(0.15, Math.min(0.65, p.alpha + Math.sin(step * p.pulseSpeed + p.pulsePhase) * 0.15));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = isDark 
          ? `rgba(165, 180, 252, ${currentAlpha})` 
          : `rgba(99, 102, 241, ${currentAlpha * 0.9})`;
        ctx.fill();
      });

      animId = requestAnimationFrame(render);
    };

    const handleResize = () => {
      const dims = getDimensions();
      width = canvas.width = dims.w;
      height = canvas.height = dims.h;
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    window.addEventListener('resize', handleResize);
    render();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [theme]);

  const handleLoginSubmit = async (targetUser: string, targetPass?: string) => {
    if (!targetUser.trim()) {
      setErrorMsg('لطفاً نام کاربری را وارد فرمایید.');
      return;
    }
    const currentPass = targetPass !== undefined ? targetPass : password;
    if (!currentPass.trim()) {
      setErrorMsg('لطفاً کلمه عبور را وارد فرمایید.');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      const ok = await onLogin(targetUser.trim(), currentPass);
      if (!ok) {
        setErrorMsg('نام کاربری یا کلمه عبور اشتباه است یا دسترسی غیرفعال می‌باشد.');
      }
    } catch {
      setErrorMsg('خطا در برقراری ارتباط با پایگاه داده سامانه.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen h-screen w-full overflow-hidden flex flex-col lg:flex-row font-sans selection:bg-indigo-600 selection:text-white relative transition-colors duration-300 ${
      theme === 'dark' ? 'bg-[#0b0c10] text-slate-100' : 'bg-[#f4f6fb] text-slate-900'
    }`} dir="rtl">
      
      {/* مدال بازیابی کلمه عبور با پیامک */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        onSuccessReset={(resUsername, newPass) => {
          setUsername(resUsername);
          if (newPass) setPassword(newPass);
          handleLoginSubmit(resUsername, newPass);
        }}
        theme={theme}
      />

      {/* ========================================================================= */}
      {/* بخش اول (سمت راست در RTL): فرم ورود به سامانه                              */}
      {/* ========================================================================= */}
      <div className={`w-full lg:w-[48%] xl:w-[44%] h-full flex flex-col justify-between overflow-y-auto transition-colors duration-300 relative z-20 ${
        theme === 'dark' 
          ? 'bg-[#0b0c10] text-slate-100 border-l border-white/[0.07]' 
          : 'bg-[#f4f6fb] text-slate-900 border-l border-slate-200/90'
      }`}>
        
        {/* هدر بالای فرم (تغییر تم و عنوان سیستم) */}
        <div className="p-6 sm:p-8 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
              <Car className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-black text-slate-900 dark:text-white">مدیریت ناوگان خودرویی یاس</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">پرتال احراز هویت</span>
            </div>
          </div>

          {/* دکمه تغییر تم شیک و سریع */}
          <button
            onClick={onToggleTheme}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#151620] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-indigo-500 dark:hover:border-indigo-400 transition-all flex items-center gap-2 text-xs font-bold cursor-pointer shadow-2xs"
            title="تغییر حالت شب و روز"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>روز</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-600" />
                <span>شب</span>
              </>
            )}
          </button>
        </div>

        {/* بدنه مرکزی فرم ورود در قالب کارت تمیز و چشم‌نواز */}
        <div className="p-6 sm:p-8 xl:p-10 my-auto max-w-md w-full mx-auto space-y-6">
          
          {/* معرفی و عنوان */}
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              خوش آمدید
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              جهت دسترسی به اطلاعات و ابزارهای ناوگان، وارد حساب کاربری خود شوید.
            </p>
          </div>

          {/* نمایش خطا در صورت بروز */}
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold flex items-center gap-2.5"
            >
              <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-ping" />
              <span>{errorMsg}</span>
            </motion.div>
          )}

          {/* فرم اصلی ورود */}
          <form 
            onSubmit={(e) => { 
              e.preventDefault(); 
              handleLoginSubmit(username); 
            }} 
            className="space-y-4"
          >
            {/* فیلد نام کاربری */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                نام کاربری یا کدملی
              </label>
              <div className="relative group">
                <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثال: admin"
                  autoComplete="username"
                  className="w-full pr-10 pl-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-mono text-left bg-white dark:bg-[#13141c] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-600 dark:focus:border-indigo-500 transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* فیلد کلمه عبور */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  کلمه عبور
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 hover:underline cursor-pointer transition-colors"
                >
                  فراموشی کلمه عبور؟
                </button>
              </div>
              <div className="relative group">
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pr-10 pl-11 py-2.5 sm:py-3 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-mono text-left bg-white dark:bg-[#13141c] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-600 dark:focus:border-indigo-500 transition-all shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
                  title={showPassword ? 'مخفی‌سازی رمز' : 'نمایش رمز'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* گزینه مرا به خاطر بسپار */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-white/10 dark:bg-zinc-800"
                />
                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                  مرا در این دستگاه به خاطر بسپار
                </span>
              </label>
            </div>

            {/* دکمه اصلی ورود */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/25 disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <>
                  <Cog className="w-4 h-4 animate-spin" />
                  <span>در حال احراز هویت...</span>
                </>
              ) : (
                <>
                  <span>ورود به پنل کاربری</span>
                  <ArrowLeft className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

        </div>

        {/* پاورقی پایین بخش ورود */}
        <div className="p-6 sm:p-8 pt-0 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2 font-mono">
            <span>نسخه ۱.۴.۲ سازمانی</span>
            <span>•</span>
            <span>۱۴۰۴-۱۴۰۵</span>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* بخش دوم (سمت چپ در RTL): ویترین امواج پویا، سیال، مدرن و مینیمال           */}
      {/* ========================================================================= */}
      <div className={`hidden lg:flex lg:w-[52%] xl:w-[56%] h-full relative overflow-hidden flex-col justify-between p-10 xl:p-14 select-none transition-colors duration-300 ${
        theme === 'dark' 
          ? 'bg-[#0e0f15] text-white' 
          : 'bg-[#f8fafc] text-slate-900'
      }`}>

        {/* کانواس متحرک امواج چندلایه، عمیق و روان در پس‌زمینه (کاملاً مستقل از موس) */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full z-0 pointer-events-none"
        />

        {/* هاله‌های نوری محو و ملایم ایندیگو در پس‌زمینه */}
        <div className={`absolute top-[-10%] left-[-10%] w-[550px] h-[550px] rounded-full blur-[140px] pointer-events-none z-1 ${
          theme === 'dark' ? 'bg-indigo-600/15' : 'bg-indigo-400/12'
        }`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[130px] pointer-events-none z-1 ${
          theme === 'dark' ? 'bg-indigo-500/10' : 'bg-indigo-200/25'
        }`} />

        {/* هدر بالای ویترین: نشانگر بسیار شیک، مینیمال و یکپارچه */}
        <div className="relative z-10 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2.5">
            <span className={`text-xs font-black tracking-tight ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
            }`}>
              مدیریت ناوگان خودرویی یاس
            </span>
          </div>

          <div className={`flex items-center gap-2 px-3 py-1 rounded-full border backdrop-blur-md transition-all ${
            theme === 'dark'
              ? 'bg-[#151620]/60 border-white/10 text-slate-300'
              : 'bg-white/70 border-slate-200/80 text-slate-600 shadow-2xs'
          }`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono font-bold tracking-wider">
              ONLINE TELEMETRY
            </span>
          </div>
        </div>

        {/* فضای میانی: کاملاً باز، خالص و اختصاص‌یافته به جریان روان و آرام امواج */}
        <div className="relative z-10 my-auto pointer-events-none" />

        {/* فوتر پایین سمت چپ: مینیمال و آرام */}
        <div className={`relative z-10 flex items-center justify-between text-[11px] pointer-events-none pt-4 border-t ${
          theme === 'dark' ? 'border-white/10 text-slate-500' : 'border-slate-200/80 text-slate-400'
        }`}>
          <span className="font-medium">پایش لحظه‌ای و هوشمند ناوگان</span>
          <span className="font-mono text-[10px] tracking-wider">YAS NEXUS • 2026</span>
        </div>

      </div>

    </div>
  );
}

