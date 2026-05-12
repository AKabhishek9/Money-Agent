'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, MoreVertical, Pin, Archive, Trash2, Pencil } from 'lucide-react';
import { formatAmount } from '@/lib/parser';
import type { MoneyWindow, Entry } from '@/lib/types';

interface WindowCardProps {
  window: MoneyWindow;
  total: number;
  entryCount: number;
  recentEntries?: Entry[];
  onClick: () => void;
  onPin: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onRename: () => void;
}

export default function WindowCard({
  window: w,
  total,
  entryCount,
  recentEntries = [],
  onClick,
  onPin,
  onArchive,
  onDelete,
  onRename,
}: WindowCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isPositive = total >= 0;

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  return (
    <div className="relative group w-full">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full flex-col rounded-[1.25rem] p-4 text-left transition-all duration-200 active:opacity-90"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-card-sm)',
        }}
      >
        {/* Title */}
        <div className="flex items-start justify-between w-full mb-3 pr-6">
          <p className="text-[0.9375rem] font-semibold leading-tight tracking-tight" style={{ color: 'var(--color-text)' }}>
            {w.pinned && <span style={{ color: 'var(--color-gold)' }}>📌 </span>}
            {w.title}
          </p>
        </div>

        {/* Recent Entries preview */}
        {recentEntries && recentEntries.length > 0 && (
          <div className="flex flex-col gap-1.5 mb-4 w-full opacity-80">
            {entryCount > recentEntries.length && (
              <span className="text-[0.65rem] mb-0.5" style={{ color: 'var(--color-text-dim)' }}>
                {entryCount - recentEntries.length} earlier entries...
              </span>
            )}
            {recentEntries.map((entry) => (
              <div key={entry.id} className="flex flex-col text-xs leading-tight">
                <span className="truncate" style={{ color: 'var(--color-text-muted)' }}>
                  {entry.amount > 0 ? `+${formatAmount(entry.amount)}` : formatAmount(entry.amount)}
                  {entry.note ? ` ${entry.note}` : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Total Footer */}
        <div className="mt-auto w-full flex items-end justify-between pt-3 border-t" style={{ borderColor: 'var(--color-border-2)' }}>
          <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Total</span>
          <span
            className="amount-mono text-[0.875rem] font-semibold tabular-nums"
            style={{ color: isPositive ? 'var(--color-income)' : 'var(--color-expense)' }}
          >
            {formatAmount(total)}
          </span>
        </div>
      </button>

      {/* 3-dot menu */}
      <div className="absolute right-2 top-3" ref={menuRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-xl transition-opacity active:opacity-70"
          style={{ color: 'var(--color-text-dim)' }}
          aria-label="More options"
        >
          <MoreVertical size={16} />
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 top-10 z-30 animate-fade-in overflow-hidden rounded-xl py-1"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border-2)',
              boxShadow: 'var(--shadow-card)',
              minWidth: 160,
            }}
          >
            <MenuItem
              icon={<Pencil size={14} />}
              label="Rename"
              onClick={() => { setMenuOpen(false); onRename(); }}
            />
            <MenuItem
              icon={<Pin size={14} />}
              label={w.pinned ? 'Unpin' : 'Pin to top'}
              onClick={() => { setMenuOpen(false); onPin(); }}
            />
            <MenuItem
              icon={<Archive size={14} />}
              label="Archive"
              onClick={() => { setMenuOpen(false); onArchive(); }}
            />
            <MenuItem
              icon={<Trash2 size={14} />}
              label="Delete"
              danger
              onClick={() => { setMenuOpen(false); onDelete(); }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[0.8125rem] font-medium transition-opacity active:opacity-80"
      style={{
        color: danger ? 'var(--color-expense)' : 'var(--color-text)',
      }}
    >
      {icon}
      {label}
    </button>
  );
}
