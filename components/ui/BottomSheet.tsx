'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  height?: 'auto' | 'full' | 'half';
}

export default function BottomSheet({ title, onClose, children, height = 'auto' }: BottomSheetProps) {
  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const [startY, setStartY] = useState<number | null>(null);
  const [currentY, setCurrentY] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
    setCurrentY(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY === null) return;
    const y = e.touches[0].clientY;
    if (y > startY) {
      // Prevent scrolling the body underneath if we're swiping down
      // Actually, just record the Y
      setCurrentY(y);
    }
  };

  const handleTouchEnd = () => {
    if (startY !== null && currentY !== null) {
      if (currentY - startY > 50) {
        onClose();
      }
    }
    setStartY(null);
    setCurrentY(null);
  };

  const heights = {
    auto: 'max-h-[90dvh]',
    full: 'h-[90dvh]',
    half: 'h-[50dvh]',
  };

  const deltaY = (currentY !== null && startY !== null) ? currentY - startY : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end animate-fade-in"
      style={{ background: 'var(--color-sheet-backdrop)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`flex flex-col rounded-t-[1.35rem] animate-slide-up shadow-2xl ${heights[height]}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          background: 'var(--color-surface)',
          borderTop: '1px solid color-mix(in oklab, var(--color-border) 80%, transparent)',
          transform: deltaY > 0 ? `translateY(${deltaY}px)` : 'translateY(0)',
          transition: currentY === null ? 'transform 0.2s ease-out' : 'none',
        }}
      >
        {/* Handle bar */}
        <div className="flex shrink-0 justify-center pb-1 pt-2.5 pointer-events-none">
          <div className="rounded-full" style={{ width: 40, height: 5, background: 'var(--color-border-2)' }} />
        </div>

        {/* Header */}
        {title && (
          <div
            className="flex shrink-0 items-center justify-between px-4 py-2.5"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <h2 className="text-base font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-xl transition-opacity duration-150 active:opacity-80"
              style={{
                background: 'var(--color-surface-2)',
                color: 'var(--color-text-muted)',
              }}
              aria-label="Close"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">{children}</div>

        {/* Safe area bottom */}
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  );
}
