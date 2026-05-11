'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  accent?: string;
}

export default function Header({
  title,
  subtitle,
  onBack,
  showBack,
  rightAction,
  accent,
}: HeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-2 px-4 py-2.5 safe-top backdrop-blur-md supports-[backdrop-filter]:bg-[color-mix(in_oklab,var(--color-nav)_88%,transparent)]"
      style={{
        background: 'var(--color-nav)',
        borderBottom: '1px solid var(--color-border)',
        minHeight: 52,
      }}
    >
      {showBack && (
        <button
          type="button"
          onClick={handleBack}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-[opacity,transform] duration-150 active:scale-[0.97] -ml-1"
          style={{ color: 'var(--color-accent)' }}
          aria-label="Back"
        >
          <ChevronLeft size={22} strokeWidth={2} />
        </button>
      )}

      <div className="flex-1 min-w-0 py-0.5">
        <h1
          className="truncate text-[1.0625rem] font-semibold leading-snug tracking-tight"
          style={{ color: accent || 'var(--color-text)' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 truncate text-[0.8125rem] leading-tight" style={{ color: 'var(--color-text-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>

      {rightAction && (
        <div className="flex shrink-0 items-center gap-1 [&_button]:min-h-[44px] [&_button]:min-w-[44px] [&_button]:justify-center">
          {rightAction}
        </div>
      )}
    </header>
  );
}
