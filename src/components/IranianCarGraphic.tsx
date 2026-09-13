/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Palette, Sparkles, Shield, Wrench } from 'lucide-react';

interface IranianCarGraphicProps {
  vehicleId: string;
  theme: 'light' | 'dark';
}

type CarColor = 'white' | 'silver' | 'gray' | 'black';

interface ColorOption {
  id: CarColor;
  name: string;
  paint: {
    base: string;
    light: string;
    dark: string;
    specular: string;
    shadow: string;
  };
}

const colorPalettes: Record<CarColor, ColorOption['paint']> = {
  white: {
    base: '#f8fafc',
    light: '#ffffff',
    dark: '#cbd5e1',
    specular: '#ffffff',
    shadow: '#94a3b8'
  },
  silver: {
    base: '#cbd5e1',
    light: '#f1f5f9',
    dark: '#94a3b8',
    specular: '#ffffff',
    shadow: '#64748b'
  },
  gray: {
    base: '#475569',
    light: '#64748b',
    dark: '#334155',
    specular: '#94a3b8',
    shadow: '#1e293b'
  },
  black: {
    base: '#0f172a',
    light: '#1e293b',
    dark: '#020617',
    specular: '#475569',
    shadow: '#000000'
  }
};

export default function IranianCarGraphic({ vehicleId, theme }: IranianCarGraphicProps) {
  const isDark = theme === 'dark';
  const [selectedColor, setSelectedColor] = useState<CarColor>('white');
  const paint = colorPalettes[selectedColor];

  return (
    <div className="w-full h-full relative flex flex-col items-center justify-between select-none overflow-hidden p-4">
      {/* استودیو عکاسی خودرویی مدرن با سیستم نورپردازی داینامیک */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* نور موضعی استودیویی بالا */}
          <radialGradient id="studioOverhead" cx="50%" cy="25%" r="70%">
            <stop offset="0%" stopColor={isDark ? '#3730a3' : '#e0e7ff'} stopOpacity={isDark ? "0.6" : "0.85"} />
            <stop offset="60%" stopColor={isDark ? '#1e1b4b' : '#f1f5f9'} stopOpacity={isDark ? "0.4" : "0.5"} />
            <stop offset="100%" stopColor={isDark ? '#09090b' : '#e2e8f0'} stopOpacity="1" />
          </radialGradient>

          {/* کف استودیو با خطوط بازتاب */}
          <linearGradient id="floorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isDark ? '#0f172a' : '#cbd5e1'} stopOpacity="0.8" />
            <stop offset="50%" stopColor={isDark ? '#09090b' : '#f8fafc'} stopOpacity="1" />
            <stop offset="100%" stopColor={isDark ? '#020617' : '#e2e8f0'} stopOpacity="1" />
          </linearGradient>

          {/* گرادینت بدنه سه‌بعدی خودرو بر اساس رنگ انتخابی */}
          <linearGradient id="body3DGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={paint.light} />
            <stop offset="30%" stopColor={paint.base} />
            <stop offset="70%" stopColor={paint.dark} />
            <stop offset="100%" stopColor={paint.shadow} />
          </linearGradient>

          {/* گرادینت کاپوت و انعکاس نور افقی */}
          <linearGradient id="hoodGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={paint.light} />
            <stop offset="45%" stopColor={paint.base} />
            <stop offset="85%" stopColor={paint.dark} />
            <stop offset="100%" stopColor={paint.shadow} />
          </linearGradient>

          {/* گرادینت شیشه دودی لوکس */}
          <linearGradient id="realWindshield" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#020617" stopOpacity="0.98" />
            <stop offset="40%" stopColor="#0f172a" stopOpacity="0.9" />
            <stop offset="80%" stopColor="#1e293b" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#334155" stopOpacity="0.75" />
          </linearGradient>

          {/* بازتاب افقی خط افق روی بدنه فلزی */}
          <linearGradient id="specularReflection" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="25%" stopColor="#ffffff" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.7" />
            <stop offset="75%" stopColor="#ffffff" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.3" />
          </linearGradient>

          {/* افکت نئون DRL چراغ خودرو */}
          <filter id="xenonGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur1" />
            <feGaussianBlur stdDeviation="8" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* بافت مشبک لانه زنبوری جلوپنجره */}
          <pattern id="honeycomb" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 4 0 L 8 2 L 8 6 L 4 8 L 0 6 L 0 2 Z" fill="#09090b" stroke="#27272a" strokeWidth="0.8" />
          </pattern>
        </defs>

        {/* پس‌زمینه استودیو */}
        <rect width="100%" height="100%" fill="url(#studioOverhead)" />
        <rect y="55%" width="100%" height="45%" fill="url(#floorGrad)" />

        {/* سایه سنگین زیر لاستیک‌ها و کف خودرو */}
        <ellipse cx="200" cy="285" rx="175" ry="28" fill="#000000" opacity={isDark ? "0.85" : "0.45"} />
        <ellipse cx="200" cy="285" rx="140" ry="16" fill="#000000" opacity={isDark ? "0.95" : "0.6"} />
      </svg>

      {/* بخش گرافیک سه‌بعدی و واقعی خودرو */}
      <div className="relative z-10 w-full max-w-[380px] my-auto">
        <svg viewBox="0 0 420 320" className="w-full h-auto drop-shadow-2xl" xmlns="http://www.w3.org/2000/svg">
          
          {/* ========================================================================= */}
          {/* ۱. مدل دنا پلاس توربو (IKCO DENA PLUS TURBO) */}
          {/* ========================================================================= */}
          {vehicleId === 'dena' && (
            <g id="dena-plus-photorealistic">
              {/* چرخ‌ها و لاستیک‌های پهن ۲۰۵ میشلن با دیسک ترمز خنک‌شونده */}
              <g id="wheels">
                {/* لاستیک چپ */}
                <ellipse cx="62" cy="265" rx="26" ry="18" fill="#09090b" stroke="#27272a" strokeWidth="3" />
                <ellipse cx="62" cy="265" rx="16" ry="11" fill="#475569" stroke="#cbd5e1" strokeWidth="2" />
                {/* لاستیک راست */}
                <ellipse cx="358" cy="265" rx="26" ry="18" fill="#09090b" stroke="#27272a" strokeWidth="3" />
                <ellipse cx="358" cy="265" rx="16" ry="11" fill="#475569" stroke="#cbd5e1" strokeWidth="2" />
              </g>

              {/* اتاق، ستون‌های A و سقف دنا پلاس */}
              <path d="M 115 75 L 305 75 L 345 145 L 75 145 Z" fill="url(#realWindshield)" stroke="#1e293b" strokeWidth="2.5" />
              
              {/* بازتاب شیشه جلو و آینه وسط */}
              <polygon points="125,80 220,80 150,140 85,140" fill="url(#specularReflection)" />
              <rect x="202" y="82" width="16" height="6" rx="2" fill="#0f172a" stroke="#475569" strokeWidth="1" />
              {/* سرنشینان / پشت‌سری صندلی‌ها */}
              <rect x="140" y="105" width="28" height="20" rx="6" fill="#09090b" opacity="0.8" />
              <rect x="252" y="105" width="28" height="20" rx="6" fill="#09090b" opacity="0.8" />

              {/* آینه‌های بغل راهنمادار دنا پلاس با چراغ LED */}
              <g id="mirrors">
                <path d="M 72 135 L 40 128 C 34 128, 32 140, 44 144 L 75 148 Z" fill="url(#body3DGrad)" stroke="#64748b" strokeWidth="1.5" />
                <line x1="39" y1="135" x2="62" y2="139" stroke="#f59e0b" strokeWidth="2.5" />
                <path d="M 348 135 L 380 128 C 386 128, 388 140, 376 144 L 345 148 Z" fill="url(#body3DGrad)" stroke="#64748b" strokeWidth="1.5" />
                <line x1="381" y1="135" x2="358" y2="139" stroke="#f59e0b" strokeWidth="2.5" />
              </g>

              {/* کاپوت عضلانی دنا با حجم‌دهی سه‌بعدی و شیارهای تیز */}
              <path d="M 75 145 L 345 145 L 360 196 L 60 196 Z" fill="url(#hoodGrad)" stroke={paint.shadow} strokeWidth="1.5" />
              {/* خطوط برجسته و عضلانی کاپوت دنا پلاس */}
              <path d="M 135 145 L 115 196" stroke={paint.shadow} strokeWidth="2" opacity="0.6" />
              <path d="M 137 145 L 117 196" stroke={paint.light} strokeWidth="1" opacity="0.8" />
              <path d="M 285 145 L 305 196" stroke={paint.shadow} strokeWidth="2" opacity="0.6" />
              <path d="M 283 145 L 303 196" stroke={paint.light} strokeWidth="1" opacity="0.8" />

              {/* سپر جلو و بالشتک‌های عضلانی دنا پلاس */}
              <path d="M 52 196 L 368 196 L 358 268 C 330 282, 90 282, 62 268 Z" fill="url(#body3DGrad)" stroke={paint.shadow} strokeWidth="2" />
              
              {/* جلوپنجره بزرگ مشکی پیانویی دنا با بافت زنبوری */}
              <path d="M 125 196 L 295 196 L 285 252 L 135 252 Z" fill="url(#honeycomb)" stroke="#09090b" strokeWidth="3" />
              
              {/* فریم کرومی دور جلوپنجره */}
              <path d="M 125 196 L 295 196 L 285 252 L 135 252 Z" fill="none" stroke="#e2e8f0" strokeWidth="2.5" />

              {/* لوگوی اسب درخشان دنا (نشان ایران خودرو) */}
              <g transform="translate(210, 212)">
                <ellipse cx="0" cy="0" rx="14" ry="11" fill="#09090b" stroke="#f8fafc" strokeWidth="2" />
                <path d="M -4 -6 Q 4 -3 2 4 Q -5 3 -4 -6 Z" fill="#f8fafc" />
              </g>

              {/* چراغ‌های خشن نئون و عدسی زنون دنا پلاس (راست و چپ) */}
              {/* چراغ چپ دنا */}
              <g id="headlight-left">
                <polygon points="56,196 125,196 120,230 68,224" fill="#020617" stroke="#475569" strokeWidth="1.5" />
                {/* نوار دی‌لایت L شکل نئون آبی روشن */}
                <path d="M 62 201 L 120 201 L 116 222" fill="none" stroke="#38bdf8" strokeWidth="3.5" filter="url(#xenonGlow)" />
                {/* لنز پروژکتور زنون کروی */}
                <circle cx="88" cy="214" r="8" fill="#f8fafc" stroke="#38bdf8" strokeWidth="2" filter="url(#xenonGlow)" />
                <circle cx="88" cy="214" r="4" fill="#ffffff" />
              </g>

              {/* چراغ راست دنا */}
              <g id="headlight-right">
                <polygon points="364,196 295,196 300,230 352,224" fill="#020617" stroke="#475569" strokeWidth="1.5" />
                {/* نوار دی‌لایت L شکل نئون */}
                <path d="M 358 201 L 300 201 L 304 222" fill="none" stroke="#38bdf8" strokeWidth="3.5" filter="url(#xenonGlow)" />
                {/* لنز پروژکتور زنون کروی */}
                <circle cx="332" cy="214" r="8" fill="#f8fafc" stroke="#38bdf8" strokeWidth="2" filter="url(#xenonGlow)" />
                <circle cx="332" cy="214" r="4" fill="#ffffff" />
              </g>

              {/* مه‌شکن‌های کریستالی دنا در پایین سپر */}
              <polygon points="76,248 112,246 106,260 82,260" fill="#09090b" stroke="#cbd5e1" strokeWidth="1.5" />
              <ellipse cx="94" cy="253" rx="8" ry="4" fill="#fef08a" filter="url(#xenonGlow)" />
              <polygon points="344,248 308,246 314,260 338,260" fill="#09090b" stroke="#cbd5e1" strokeWidth="1.5" />
              <ellipse cx="326" cy="253" rx="8" ry="4" fill="#fef08a" filter="url(#xenonGlow)" />

              {/* پلاک ملی باکیفیت ایران برای دنا پلاس */}
              <g id="plate-dena-hd" transform="translate(155, 252)">
                <rect width="110" height="24" rx="4" fill="#ffffff" stroke="#09090b" strokeWidth="2" />
                <path d="M 3 0 L 15 0 L 15 24 L 3 24 A 3 3 0 0 1 0 21 L 0 3 A 3 3 0 0 1 3 0 Z" fill="#0033cc" />
                {/* پرچم ایران تمام‌عرض با ضخامت بهتر */}
                <rect x="0" y="0" width="15" height="3" fill="#009933" />
                <rect x="0" y="3" width="15" height="3" fill="#ffffff" />
                <rect x="0" y="6" width="15" height="3" fill="#e50000" />
                <text x="7.5" y="17" fill="#ffffff" fontSize="7.5" fontWeight="600" textAnchor="middle" fontFamily="sans-serif">IR</text>
                <text x="62" y="16" fill="#09090b" fontSize="12" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">۷۷ | ۳۶۱ ج ۲۵</text>
                <text x="96" y="15" fill="#09090b" fontSize="8" fontWeight="bold" fontFamily="sans-serif">ایران</text>
              </g>
            </g>
          )}

          {/* ========================================================================= */}
          {/* ۲. مدل پژو ۲۰۶ (PEUGEOT 206) */}
          {/* ========================================================================= */}
          {vehicleId === 'peugeot206' && (
            <g id="peugeot-206-photorealistic">
              {/* چرخ‌ها و رینگ‌های مشهور چلنجر ۲۰۶ */}
              <g id="wheels-206">
                <ellipse cx="62" cy="265" rx="26" ry="18" fill="#09090b" stroke="#27272a" strokeWidth="3" />
                <ellipse cx="62" cy="265" rx="16" ry="11" fill="#94a3b8" stroke="#f8fafc" strokeWidth="2" />
                <ellipse cx="358" cy="265" rx="26" ry="18" fill="#09090b" stroke="#27272a" strokeWidth="3" />
                <ellipse cx="358" cy="265" rx="16" ry="11" fill="#94a3b8" stroke="#f8fafc" strokeWidth="2" />
              </g>

              {/* سقف آیرودینامیک و شیشه جلو محدب ۲۰۶ */}
              <path d="M 125 72 Q 210 60 295 72 L 350 148 L 70 148 Z" fill="url(#realWindshield)" stroke="#1e293b" strokeWidth="2.5" />
              <polygon points="135,76 225,76 145,142 80,142" fill="url(#specularReflection)" />
              
              {/* آینه‌های بغل بیضی شکل ۲۰۶ */}
              <ellipse cx="55" cy="144" rx="16" ry="10" fill="#09090b" stroke="#475569" strokeWidth="2" />
              <ellipse cx="365" cy="144" rx="16" ry="10" fill="#09090b" stroke="#475569" strokeWidth="2" />

              {/* کاپوت شیب‌دار با ورودی هوای دوبل ۲۰۶ */}
              <path d="M 70 148 L 350 148 L 362 196 L 58 196 Z" fill="url(#hoodGrad)" stroke={paint.shadow} strokeWidth="1.5" />
              {/* ورودی هوای دوبل روی کاپوت سمت راننده */}
              <rect x="255" y="156" width="22" height="4" rx="1.5" fill="#09090b" stroke="#334155" strokeWidth="1" />
              <rect x="255" y="163" width="22" height="4" rx="1.5" fill="#09090b" stroke="#334155" strokeWidth="1" />

              {/* سپر گرد و جذاب ۲۰۶ */}
              <path d="M 52 196 L 368 196 L 356 270 Q 210 285 64 270 Z" fill="url(#body3DGrad)" stroke={paint.shadow} strokeWidth="2" />

              {/* چراغ‌های چشم‌گربه‌ای کشیده و کریستالی ۲۰۶ */}
              <g id="headlight-left-206">
                <path d="M 58 196 Q 120 182 138 218 Q 98 228 65 215 Z" fill="#020617" stroke="#64748b" strokeWidth="1.5" />
                <path d="M 68 198 Q 118 190 128 214" stroke="#38bdf8" strokeWidth="3.5" filter="url(#xenonGlow)" />
                <circle cx="102" cy="208" r="7" fill="#ffffff" stroke="#38bdf8" strokeWidth="2" filter="url(#xenonGlow)" />
              </g>

              <g id="headlight-right-206">
                <path d="M 362 196 Q 300 182 282 218 Q 322 228 355 215 Z" fill="#020617" stroke="#64748b" strokeWidth="1.5" />
                <path d="M 352 198 Q 302 190 292 214" stroke="#38bdf8" strokeWidth="3.5" filter="url(#xenonGlow)" />
                <circle cx="318" cy="208" r="7" fill="#ffffff" stroke="#38bdf8" strokeWidth="2" filter="url(#xenonGlow)" />
              </g>

              {/* جلوپنجره باریک با نشان شیر کروم پژو */}
              <rect x="150" y="200" width="120" height="16" rx="4" fill="#09090b" stroke="#334155" strokeWidth="1.5" />
              <g transform="translate(210, 208)">
                <path d="M -5 -6 L 4 -6 L 3 5 L -3 5 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
              </g>

              {/* جلوپنجره خندان پایین سپر ۲۰۶ */}
              <path d="M 125 228 Q 210 245 295 228 L 290 250 Q 210 260 130 250 Z" fill="#09090b" stroke="#27272a" strokeWidth="2" />

              {/* مه‌شکن‌های گرد کروم ۲۰۶ */}
              <circle cx="85" cy="248" r="9" fill="#09090b" stroke="#cbd5e1" strokeWidth="2" />
              <circle cx="85" cy="248" r="5" fill="#fef08a" filter="url(#xenonGlow)" />
              <circle cx="335" cy="248" r="9" fill="#09090b" stroke="#cbd5e1" strokeWidth="2" />
              <circle cx="335" cy="248" r="5" fill="#fef08a" filter="url(#xenonGlow)" />

              {/* پلاک ملی ایران ۲۰۶ */}
              <g id="plate-206-hd" transform="translate(155, 252)">
                <rect width="110" height="24" rx="4" fill="#ffffff" stroke="#09090b" strokeWidth="2" />
                <path d="M 3 0 L 15 0 L 15 24 L 3 24 A 3 3 0 0 1 0 21 L 0 3 A 3 3 0 0 1 3 0 Z" fill="#0033cc" />
                <rect x="0" y="0" width="15" height="3" fill="#009933" />
                <rect x="0" y="3" width="15" height="3" fill="#ffffff" />
                <rect x="0" y="6" width="15" height="3" fill="#e50000" />
                <text x="7.5" y="17" fill="#ffffff" fontSize="7.5" fontWeight="600" textAnchor="middle" fontFamily="sans-serif">IR</text>
                <text x="62" y="16" fill="#09090b" fontSize="12" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">۱۱ | ۸۱۵ د ۴۸</text>
                <text x="96" y="15" fill="#09090b" fontSize="8" fontWeight="bold" fontFamily="sans-serif">ایران</text>
              </g>
            </g>
          )}

          {/* ========================================================================= */}
          {/* ۳. مدل سمند LX سازمانی (IKCO SAMAND LX) */}
          {/* ========================================================================= */}
          {vehicleId === 'samand' && (
            <g id="samand-photorealistic">
              {/* چرخ‌ها و رینگ‌های فابریک سمند */}
              <g id="wheels-samand">
                <ellipse cx="62" cy="265" rx="26" ry="18" fill="#09090b" stroke="#27272a" strokeWidth="3" />
                <ellipse cx="62" cy="265" rx="16" ry="11" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
                <ellipse cx="358" cy="265" rx="26" ry="18" fill="#09090b" stroke="#27272a" strokeWidth="3" />
                <ellipse cx="358" cy="265" rx="16" ry="11" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
              </g>

              {/* سقف و شیشه عریض سمند */}
              <path d="M 120 74 L 300 74 L 348 146 L 72 146 Z" fill="url(#realWindshield)" stroke="#1e293b" strokeWidth="2.5" />
              <polygon points="130,78 220,78 145,142 80,142" fill="url(#specularReflection)" />

              {/* آینه‌های سمند */}
              <path d="M 68 140 L 38 134 L 40 148 L 72 150 Z" fill="url(#body3DGrad)" stroke="#475569" strokeWidth="1.5" />
              <path d="M 352 140 L 382 134 L 380 148 L 348 150 Z" fill="url(#body3DGrad)" stroke="#475569" strokeWidth="1.5" />

              {/* کاپوت سمند با حجم‌دهی سه‌بعدی */}
              <path d="M 72 146 L 348 146 L 362 196 L 58 196 Z" fill="url(#hoodGrad)" stroke={paint.shadow} strokeWidth="1.5" />
              <line x1="125" y1="146" x2="115" y2="196" stroke={paint.shadow} strokeWidth="2" opacity="0.6" />
              <line x1="295" y1="146" x2="305" y2="196" stroke={paint.shadow} strokeWidth="2" opacity="0.6" />

              {/* سپر مستحکم و عضلانی سمند */}
              <path d="M 52 196 L 368 196 L 358 270 L 62 270 Z" fill="url(#body3DGrad)" stroke={paint.shadow} strokeWidth="2" />

              {/* جلوپنجره نعل‌اسبی سمند با پره‌های کرومی */}
              <path d="M 140 196 L 280 196 L 270 240 L 150 240 Z" fill="#09090b" stroke="#e2e8f0" strokeWidth="2.5" />
              <line x1="170" y1="198" x2="173" y2="238" stroke="#94a3b8" strokeWidth="2.5" />
              <line x1="190" y1="198" x2="191" y2="238" stroke="#94a3b8" strokeWidth="2.5" />
              <line x1="230" y1="198" x2="229" y2="238" stroke="#94a3b8" strokeWidth="2.5" />
              <line x1="250" y1="198" x2="247" y2="238" stroke="#94a3b8" strokeWidth="2.5" />

              {/* لوگوی سر اسب سمند در وسط */}
              <circle cx="210" cy="218" r="13" fill="#09090b" stroke="#f8fafc" strokeWidth="2" />
              <path d="M 207 210 Q 215 214 213 223 L 205 220 Z" fill="#f8fafc" />

              {/* چراغ‌های کریستالی چهارگوش سمند (راست و چپ) */}
              <polygon points="58,196 135,196 130,234 68,228" fill="#020617" stroke="#64748b" strokeWidth="1.5" />
              <circle cx="98" cy="215" r="9" fill="#ffffff" stroke="#38bdf8" strokeWidth="2" filter="url(#xenonGlow)" />
              <line x1="66" y1="205" x2="66" y2="225" stroke="#f59e0b" strokeWidth="4" />

              <polygon points="362,196 285,196 290,234 352,228" fill="#020617" stroke="#64748b" strokeWidth="1.5" />
              <circle cx="322" cy="215" r="9" fill="#ffffff" stroke="#38bdf8" strokeWidth="2" filter="url(#xenonGlow)" />
              <line x1="354" y1="205" x2="354" y2="225" stroke="#f59e0b" strokeWidth="4" />

              {/* مه‌شکن‌های سمند */}
              <rect x="76" y="246" width="34" height="14" rx="3" fill="#09090b" stroke="#cbd5e1" strokeWidth="1.5" />
              <rect x="80" y="249" width="26" height="8" fill="#fef08a" filter="url(#xenonGlow)" />
              <rect x="310" y="246" width="34" height="14" rx="3" fill="#09090b" stroke="#cbd5e1" strokeWidth="1.5" />
              <rect x="314" y="249" width="26" height="8" fill="#fef08a" filter="url(#xenonGlow)" />

              {/* پلاک ملی ایران سمند */}
              <g id="plate-samand-hd" transform="translate(155, 252)">
                <rect width="110" height="24" rx="4" fill="#ffffff" stroke="#09090b" strokeWidth="2" />
                <path d="M 3 0 L 15 0 L 15 24 L 3 24 A 3 3 0 0 1 0 21 L 0 3 A 3 3 0 0 1 3 0 Z" fill="#0033cc" />
                <rect x="0" y="0" width="15" height="3" fill="#009933" />
                <rect x="0" y="3" width="15" height="3" fill="#ffffff" />
                <rect x="0" y="6" width="15" height="3" fill="#e50000" />
                <text x="7.5" y="17" fill="#ffffff" fontSize="7.5" fontWeight="600" textAnchor="middle" fontFamily="sans-serif">IR</text>
                <text x="62" y="16" fill="#09090b" fontSize="12" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">۲۱ | ۹۳۴ ق ۱۲</text>
                <text x="96" y="15" fill="#09090b" fontSize="8" fontWeight="bold" fontFamily="sans-serif">ایران</text>
              </g>
            </g>
          )}

          {/* ========================================================================= */}
          {/* ۴. مدل پژو ۲۰۷i اسپرت (PEUGEOT 207i) */}
          {/* ========================================================================= */}
          {vehicleId === 'peugeot207' && (
            <g id="peugeot-207-photorealistic">
              {/* رینگ‌های آلومینیومی اسپرت ۲۰۷i */}
              <g id="wheels-207">
                <ellipse cx="62" cy="265" rx="26" ry="18" fill="#09090b" stroke="#27272a" strokeWidth="3" />
                <ellipse cx="62" cy="265" rx="16" ry="11" fill="#475569" stroke="#38bdf8" strokeWidth="2" />
                <ellipse cx="358" cy="265" rx="26" ry="18" fill="#09090b" stroke="#27272a" strokeWidth="3" />
                <ellipse cx="358" cy="265" rx="16" ry="11" fill="#475569" stroke="#38bdf8" strokeWidth="2" />
              </g>

              {/* سقف و شیشه جلو ۲۰۷ */}
              <path d="M 125 72 Q 210 60 295 72 L 350 148 L 70 148 Z" fill="url(#realWindshield)" stroke="#1e293b" strokeWidth="2.5" />
              <polygon points="135,76 225,76 145,142 80,142" fill="url(#specularReflection)" />

              {/* آینه‌های بغل با راهنمای LED ۲۰۷ */}
              <ellipse cx="55" cy="144" rx="16" ry="10" fill="url(#body3DGrad)" stroke="#475569" strokeWidth="1.5" />
              <line x1="46" y1="144" x2="62" y2="144" stroke="#f59e0b" strokeWidth="3" />
              <ellipse cx="365" cy="144" rx="16" ry="10" fill="url(#body3DGrad)" stroke="#475569" strokeWidth="1.5" />
              <line x1="358" y1="144" x2="374" y2="144" stroke="#f59e0b" strokeWidth="3" />

              {/* کاپوت با خطوط برجسته ۲۰۷ */}
              <path d="M 70 148 L 350 148 L 362 196 L 58 196 Z" fill="url(#hoodGrad)" stroke={paint.shadow} strokeWidth="1.5" />

              {/* سپر اسپرت و جلوپنجره بزرگ لانه زنبوری ۲۰۷ */}
              <path d="M 52 196 L 368 196 L 356 270 Q 210 285 64 270 Z" fill="url(#body3DGrad)" stroke={paint.shadow} strokeWidth="2" />

              {/* چراغ‌های بزرگ و پرنور ۲۰۷ با ابرویی دی‌لایت */}
              <g id="headlight-left-207">
                <path d="M 58 196 Q 125 180 142 220 Q 98 230 65 215 Z" fill="#020617" stroke="#475569" strokeWidth="1.5" />
                <path d="M 66 198 Q 120 188 134 215" stroke="#38bdf8" strokeWidth="4" filter="url(#xenonGlow)" />
                <circle cx="106" cy="210" r="8" fill="#ffffff" stroke="#38bdf8" strokeWidth="2" filter="url(#xenonGlow)" />
              </g>

              <g id="headlight-right-207">
                <path d="M 362 196 Q 295 180 278 220 Q 322 230 355 215 Z" fill="#020617" stroke="#475569" strokeWidth="1.5" />
                <path d="M 354 198 Q 300 188 286 215" stroke="#38bdf8" strokeWidth="4" filter="url(#xenonGlow)" />
                <circle cx="314" cy="210" r="8" fill="#ffffff" stroke="#38bdf8" strokeWidth="2" filter="url(#xenonGlow)" />
              </g>

              {/* جلوپنجره بزرگ زنبوری ۲۰۷ */}
              <path d="M 135 200 L 285 200 L 275 245 L 145 245 Z" fill="url(#honeycomb)" stroke="#09090b" strokeWidth="2.5" />
              {/* لوگوی بزرگ شیر کرومی ۲۰۷ روی کاپوت */}
              <g transform="translate(210, 196)">
                <path d="M -7 -6 L 6 -6 L 5 7 L -5 7 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
              </g>

              {/* مه‌شکن‌های نئون ۲۰۷ */}
              <circle cx="82" cy="248" r="10" fill="#09090b" stroke="#cbd5e1" strokeWidth="2" />
              <circle cx="82" cy="248" r="6" fill="#fef08a" filter="url(#xenonGlow)" />
              <circle cx="338" cy="248" r="10" fill="#09090b" stroke="#cbd5e1" strokeWidth="2" />
              <circle cx="338" cy="248" r="6" fill="#fef08a" filter="url(#xenonGlow)" />

              {/* پلاک ملی ایران ۲۰۷ */}
              <g id="plate-207-hd" transform="translate(155, 252)">
                <rect width="110" height="24" rx="4" fill="#ffffff" stroke="#09090b" strokeWidth="2" />
                <path d="M 3 0 L 15 0 L 15 24 L 3 24 A 3 3 0 0 1 0 21 L 0 3 A 3 3 0 0 1 3 0 Z" fill="#0033cc" />
                <rect x="0" y="0" width="15" height="3" fill="#009933" />
                <rect x="0" y="3" width="15" height="3" fill="#ffffff" />
                <rect x="0" y="6" width="15" height="3" fill="#e50000" />
                <text x="7.5" y="17" fill="#ffffff" fontSize="7.5" fontWeight="600" textAnchor="middle" fontFamily="sans-serif">IR</text>
                <text x="62" y="16" fill="#09090b" fontSize="12" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">۳۳ | ۵۴۲ ب ۹۶</text>
                <text x="96" y="15" fill="#09090b" fontSize="8" fontWeight="bold" fontFamily="sans-serif">ایران</text>
              </g>
            </g>
          )}

          {/* ========================================================================= */}
          {/* ۵. مدل تارا اتوماتیک (IKCO TARA V4) */}
          {/* ========================================================================= */}
          {vehicleId === 'tara' && (
            <g id="tara-photorealistic">
              {/* رینگ‌های آلومینیومی مدرن تارا */}
              <g id="wheels-tara">
                <ellipse cx="62" cy="265" rx="26" ry="18" fill="#09090b" stroke="#27272a" strokeWidth="3" />
                <ellipse cx="62" cy="265" rx="16" ry="11" fill="#475569" stroke="#cbd5e1" strokeWidth="2" />
                <ellipse cx="358" cy="265" rx="26" ry="18" fill="#09090b" stroke="#27272a" strokeWidth="3" />
                <ellipse cx="358" cy="265" rx="16" ry="11" fill="#475569" stroke="#cbd5e1" strokeWidth="2" />
              </g>

              {/* سقف و شیشه جلو تارا با شیب آیرودینامیک */}
              <path d="M 115 72 L 305 72 L 348 145 L 72 145 Z" fill="url(#realWindshield)" stroke="#1e293b" strokeWidth="2.5" />
              <polygon points="125,76 220,76 150,140 80,140" fill="url(#specularReflection)" />

              {/* آینه‌های بغل راهنمادار تارا */}
              <path d="M 70 138 L 38 132 C 32 132, 30 144, 42 148 L 74 150 Z" fill="url(#body3DGrad)" stroke="#475569" strokeWidth="1.5" />
              <line x1="38" y1="138" x2="62" y2="142" stroke="#f59e0b" strokeWidth="2.5" />
              <path d="M 350 138 L 382 132 C 388 132, 390 144, 378 148 L 346 150 Z" fill="url(#body3DGrad)" stroke="#475569" strokeWidth="1.5" />
              <line x1="382" y1="138" x2="358" y2="142" stroke="#f59e0b" strokeWidth="2.5" />

              {/* کاپوت کشیده تارا با خطوط تیز */}
              <path d="M 72 145 L 348 145 L 362 196 L 58 196 Z" fill="url(#hoodGrad)" stroke={paint.shadow} strokeWidth="1.5" />
              <line x1="130" y1="145" x2="115" y2="196" stroke={paint.shadow} strokeWidth="2" opacity="0.6" />
              <line x1="290" y1="145" x2="305" y2="196" stroke={paint.shadow} strokeWidth="2" opacity="0.6" />

              {/* سپر جلو زاویه‌دار و عضلانی تارا */}
              <path d="M 52 196 L 368 196 L 358 270 C 325 285, 95 285, 62 270 Z" fill="url(#body3DGrad)" stroke={paint.shadow} strokeWidth="2" />

              {/* جلوپنجره هندسی مدرن تارا با خطوط افقی کروم */}
              <path d="M 125 196 L 295 196 L 285 248 L 135 248 Z" fill="#09090b" stroke="#334155" strokeWidth="2" />
              <line x1="132" y1="208" x2="288" y2="208" stroke="#cbd5e1" strokeWidth="1.5" />
              <line x1="135" y1="220" x2="285" y2="220" stroke="#cbd5e1" strokeWidth="1.5" />
              <line x1="138" y1="232" x2="282" y2="232" stroke="#cbd5e1" strokeWidth="1.5" />

              {/* لوگوی اسب تارا در مرکز */}
              <g transform="translate(210, 212)">
                <ellipse cx="0" cy="0" rx="14" ry="11" fill="#09090b" stroke="#f8fafc" strokeWidth="2" />
                <path d="M -4 -6 Q 4 -3 2 4 Q -5 3 -4 -6 Z" fill="#f8fafc" />
              </g>

              {/* چراغ‌های مدرن و کشیده تارا با نوار LED یکپارچه */}
              <g id="headlight-left-tara">
                <polygon points="56,196 125,196 120,228 66,220" fill="#020617" stroke="#475569" strokeWidth="1.5" />
                <path d="M 60 200 L 122 200" stroke="#38bdf8" strokeWidth="3.5" filter="url(#xenonGlow)" />
                <circle cx="90" cy="212" r="7" fill="#ffffff" stroke="#38bdf8" strokeWidth="2" filter="url(#xenonGlow)" />
              </g>

              <g id="headlight-right-tara">
                <polygon points="364,196 295,196 300,228 354,220" fill="#020617" stroke="#475569" strokeWidth="1.5" />
                <path d="M 360 200 L 298 200" stroke="#38bdf8" strokeWidth="3.5" filter="url(#xenonGlow)" />
                <circle cx="330" cy="212" r="7" fill="#ffffff" stroke="#38bdf8" strokeWidth="2" filter="url(#xenonGlow)" />
              </g>

              {/* دی‌لایت‌های عمودی روی سپر تارا */}
              <rect x="74" y="244" width="8" height="18" rx="4" fill="#38bdf8" filter="url(#xenonGlow)" />
              <rect x="338" y="244" width="8" height="18" rx="4" fill="#38bdf8" filter="url(#xenonGlow)" />

              {/* پلاک ملی ایران تارا */}
              <g id="plate-tara-hd" transform="translate(155, 252)">
                <rect width="110" height="24" rx="4" fill="#ffffff" stroke="#09090b" strokeWidth="2" />
                <path d="M 3 0 L 15 0 L 15 24 L 3 24 A 3 3 0 0 1 0 21 L 0 3 A 3 3 0 0 1 3 0 Z" fill="#0033cc" />
                <rect x="0" y="0" width="15" height="3" fill="#009933" />
                <rect x="0" y="3" width="15" height="3" fill="#ffffff" />
                <rect x="0" y="6" width="15" height="3" fill="#e50000" />
                <text x="7.5" y="17" fill="#ffffff" fontSize="7.5" fontWeight="600" textAnchor="middle" fontFamily="sans-serif">IR</text>
                <text x="62" y="16" fill="#09090b" fontSize="12" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">۵۵ | ۷۲۸ ص ۱۸</text>
                <text x="96" y="15" fill="#09090b" fontSize="8" fontWeight="bold" fontFamily="sans-serif">ایران</text>
              </g>
            </g>
          )}

          {/* نشان وضعیت آنلاین تله‌ماتیک و سلامت ناوگان */}
          <g transform="translate(210, 305)">
            <rect x="-85" y="-10" width="170" height="18" rx="9" fill={isDark ? "rgba(15, 23, 42, 0.85)" : "rgba(255, 255, 255, 0.9)"} stroke={isDark ? "rgba(99, 102, 241, 0.4)" : "rgba(99, 102, 241, 0.3)"} strokeWidth="1" />
            <circle cx="-68" cy="-1" r="3.5" fill="#22c55e" filter="url(#xenonGlow)" />
            <text x="5" y="3" fill={isDark ? "#cbd5e1" : "#334155"} fontSize="8.5" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
              ناوگان متصل • وضعیت فنی فعال
            </text>
          </g>
        </svg>
      </div>

      {/* پالت تغییر رنگ بدنه خودروهای ایرانی به رنگ‌های فابریک کارخانه */}
      <div className="relative z-20 flex items-center justify-between w-full max-w-[340px] px-3 py-1.5 rounded-lg bg-black/40 dark:bg-[#111113]/80 backdrop-blur-md border border-white/10 text-white">
        <div className="flex items-center gap-1.5 text-[10px] font-bold opacity-90">
          <Palette className="w-3 h-3 text-indigo-400" />
          <span>رنگ بدنه:</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedColor('white')}
            title="سفید صدفی"
            className={`w-5 h-5 rounded-full bg-white border-2 cursor-pointer transition-transform ${
              selectedColor === 'white' ? 'border-indigo-500 scale-125 shadow-md ring-2 ring-white/50' : 'border-slate-300 hover:scale-110'
            }`}
          />
          <button
            type="button"
            onClick={() => setSelectedColor('silver')}
            title="نقره‌ای متالیک"
            className={`w-5 h-5 rounded-full bg-slate-300 border-2 cursor-pointer transition-transform ${
              selectedColor === 'silver' ? 'border-indigo-500 scale-125 shadow-md ring-2 ring-white/50' : 'border-slate-400 hover:scale-110'
            }`}
          />
          <button
            type="button"
            onClick={() => setSelectedColor('gray')}
            title="خاکستری متالیک (نوک‌مدادی)"
            className={`w-5 h-5 rounded-full bg-slate-600 border-2 cursor-pointer transition-transform ${
              selectedColor === 'gray' ? 'border-indigo-500 scale-125 shadow-md ring-2 ring-white/50' : 'border-slate-500 hover:scale-110'
            }`}
          />
          <button
            type="button"
            onClick={() => setSelectedColor('black')}
            title="مشکی متالیک (آبنوس)"
            className={`w-5 h-5 rounded-full bg-slate-950 border-2 cursor-pointer transition-transform ${
              selectedColor === 'black' ? 'border-indigo-500 scale-125 shadow-md ring-2 ring-white/50' : 'border-slate-700 hover:scale-110'
            }`}
          />
        </div>
      </div>
    </div>
  );
}
