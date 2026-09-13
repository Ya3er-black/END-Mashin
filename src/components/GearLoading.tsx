import React from 'react';
import { Cog } from 'lucide-react';

interface GearLoadingProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  subText?: string;
  fullScreen?: boolean;
  className?: string;
}

export const GearLoading: React.FC<GearLoadingProps> = ({
  size = 'md',
  text,
  subText,
  fullScreen = false,
  className = '',
}) => {
  // اندازه‌های مختلف برای چرخ دنده
  const sizeMap = {
    xs: { main: 'w-3.5 h-3.5', sub: 'w-2 h-2', container: 'w-4 h-4' },
    sm: { main: 'w-5 h-5', sub: 'w-3 h-3', container: 'w-6 h-6' },
    md: { main: 'w-8 h-8', sub: 'w-4.5 h-4.5', container: 'w-10 h-10' },
    lg: { main: 'w-12 h-12', sub: 'w-6 h-6', container: 'w-16 h-16' },
    xl: { main: 'w-16 h-16', sub: 'w-8 h-8', container: 'w-20 h-20' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  const content = (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className={`relative flex items-center justify-center ${currentSize.container}`}>
        {/* چرخ‌دنده اصلی با چرخش روان */}
        <Cog
          className={`${currentSize.main} text-indigo-500 animate-spin`}
          strokeWidth={2}
        />
        {/* چرخ‌دنده کوچک درگیر در گوشه برای سایزهای متوسط و بزرگ */}
        {(size === 'lg' || size === 'xl' || size === 'md') && (
          <Cog
            className={`${currentSize.sub} text-indigo-400 absolute -top-1 -left-1 animate-spin opacity-80`}
            style={{ animationDirection: 'reverse', animationDuration: '2.5s' }}
            strokeWidth={2}
          />
        )}
      </div>

      {text && (
        <div className="text-center space-y-1">
          <p className="text-xs font-bold text-slate-300 dark:text-slate-300">
            {text}
          </p>
          {subText && (
            <p className="text-[10px] text-slate-500 dark:text-slate-500">
              {subText}
            </p>
          )}
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center font-sans text-[#e2e8f0] p-4 select-none">
        {content}
      </div>
    );
  }

  return content;
};

export default GearLoading;
