'use client';

import { Pin, Archive, Trash2, MoreVertical, BookOpen } from 'lucide-react';
import type { MoneyWindow } from '@/lib/types';
import { useState } from 'react';

interface WindowCardProps {
  window: MoneyWindow;
  total?: number;
  entryCount?: number;
  onClick: () => void;
  onPin?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
}

export default function WindowCard({
  window: w,
  total = 0,
  entryCount = 0,
  onClick,
  onPin,
  onArchive,
  onDelete,
}: WindowCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const isPositive = total >= 0;

  return (
    <div
      className={`surface-card relative mx-4 mb-3 overflow-hidden rounded-2xl transition-shadow duration-200 ${showMenu ? 'z-20' : ''}`}
      style={{
        background: 'var(--color-surface)',
        border: `1px solid ${w.pinned ? 'color-mix(in oklab, var(--color-accent) 45%, var(--color-border))' : 'var(--color-border)'}`,
      }}
    >
      <button
        type="button"
        className="flex w-full items-center gap-3 p-4 text-left transition-[transform,opacity] duration-150 active:scale-[0.995] active:opacity-90"
        onClick={onClick}
      >
        {/* Icon */}
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'var(--color-surface-2)' }}
        >
          {w.autoMonthly ? (
            <span className="text-lg leading-none" aria-hidden>
              📅
            </span>
          ) : (
            <BookOpen size={18} strokeWidth={2} style={{ color: 'var(--color-accent)' }} />
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
              {w.title}
            </span>
            {w.pinned && <Pin size={12} strokeWidth={2} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />}
          </div>
          <span className="mt-1 block text-[0.6875rem] leading-none" style={{ color: 'var(--color-text-muted)' }}>
            {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {/* Total */}
        <div className="shrink-0 pr-10 text-right">
          <div
            className="amount-mono text-lg font-bold leading-none"
            style={{ color: isPositive ? 'var(--color-income)' : 'var(--color-expense)' }}
          >
            {isPositive ? '+' : ''}₹{Math.abs(total).toLocaleString('en-IN')}
          </div>
          <span className="mt-1 block text-[0.625rem] font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
            Total
          </span>
        </div>
      </button>

      {/* Menu button */}
      <button
        type="button"
        className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-150"
        style={{
          background: showMenu ? 'var(--color-surface-2)' : 'transparent',
          color: 'var(--color-text-muted)',
        }}
        aria-expanded={showMenu}
        aria-label="Page actions"
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
      >
        <MoreVertical size={18} strokeWidth={2} />
      </button>

      {/* Dropdown menu */}
      {showMenu && (
        <div
          className="animate-scale-in absolute right-2 top-12 z-20 overflow-hidden rounded-xl shadow-lg"
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            minWidth: 140,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {onPin && (
            <MenuBtn
              icon={<Pin size={14} />}
              label={w.pinned ? 'Unpin' : 'Pin'}
              onClick={() => { setShowMenu(false); onPin(); }}
            />
          )}
          {onArchive && (
            <MenuBtn
              icon={<Archive size={14} />}
              label="Archive"
              onClick={() => { setShowMenu(false); onArchive(); }}
            />
          )}
          {onDelete && (
            <MenuBtn
              icon={<Trash2 size={14} />}
              label="Delete"
              danger
              onClick={() => { setShowMenu(false); onDelete(); }}
            />
          )}
        </div>
      )}

      {showMenu && (
        <div className="fixed inset-0 z-10" aria-hidden onClick={() => setShowMenu(false)} />
      )}
    </div>
  );
}

function MenuBtn({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm font-medium transition-colors duration-150 active:bg-[var(--color-surface-3)]"
      style={{ color: danger ? 'var(--color-expense)' : 'var(--color-text)' }}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}
