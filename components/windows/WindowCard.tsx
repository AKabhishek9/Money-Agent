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
      className={`relative mx-4 mb-3 rounded-2xl ${showMenu ? 'z-20' : ''}`}
      style={{
        background: 'var(--color-surface)',
        border: `1px solid ${w.pinned ? 'var(--color-accent)' : 'var(--color-border)'}`,
      }}
    >
      <button
        className="w-full flex items-center gap-4 p-4 text-left active:opacity-80"
        onClick={onClick}
      >
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'var(--color-surface-2)' }}
        >
          {w.autoMonthly ? (
            <span className="text-lg">📅</span>
          ) : (
            <BookOpen size={18} style={{ color: 'var(--color-accent)' }} />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="font-semibold text-sm truncate"
              style={{ color: 'var(--color-text)' }}
            >
              {w.title}
            </span>
            {w.pinned && (
              <Pin size={11} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
            )}
          </div>
          <span className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {/* Total */}
        <div className="text-right shrink-0 pr-8">
          <div
            className="font-mono font-bold text-base"
            style={{ color: isPositive ? 'var(--color-income)' : 'var(--color-expense)' }}
          >
            {isPositive ? '+' : ''}₹{Math.abs(total).toLocaleString('en-IN')}
          </div>
        </div>
      </button>

      {/* Menu button */}
      <button
        className="absolute top-3 right-3 p-1.5 rounded-lg"
        style={{
          background: showMenu ? 'var(--color-surface-2)' : 'transparent',
          color: 'var(--color-text-muted)',
        }}
        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
      >
        <MoreVertical size={16} />
      </button>

      {/* Dropdown menu */}
      {showMenu && (
        <div
          className="absolute top-10 right-3 rounded-xl overflow-hidden z-10 animate-scale-in"
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
        <div className="fixed inset-0 z-9" onClick={() => setShowMenu(false)} />
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
      className="flex items-center gap-2 w-full px-3 py-2.5 text-sm"
      style={{ color: danger ? 'var(--color-expense)' : 'var(--color-text)' }}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}
