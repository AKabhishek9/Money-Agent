'use client';

import { useState } from 'react';
import { MoreVertical, Trash2, Pencil } from 'lucide-react';
import type { Person } from '@/lib/types';
import { formatAmount } from '@/lib/parser';

interface PersonCardProps {
  person: Person;
  balance: number;
  entryCount: number;
  onClick: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

export default function PersonCard({
  person,
  balance,
  entryCount,
  onClick,
  onDelete,
  onEdit,
}: PersonCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const isPositive = balance > 0;
  const isZero = balance === 0;

  return (
    <div
      className={`surface-card relative mx-4 mb-3 overflow-hidden rounded-2xl transition-shadow duration-200 ${showMenu ? 'z-20' : ''}`}
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      <button
        type="button"
        className="flex w-full items-center gap-3 p-4 text-left transition-[transform,opacity] duration-150 active:scale-[0.995] active:opacity-90"
        onClick={onClick}
      >
        {/* Avatar */}
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-bold text-base"
          style={{
            background: isZero
              ? 'var(--color-surface-2)'
              : isPositive
              ? 'var(--color-income-bg)'
              : 'var(--color-expense-bg)',
            color: isZero
              ? 'var(--color-text-muted)'
              : isPositive
              ? 'var(--color-income)'
              : 'var(--color-expense)',
          }}
        >
          {person.name.charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-text)' }}>
            {person.name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
            {person.note ? ` · ${person.note}` : ''}
          </p>
        </div>

        {/* Balance */}
        <div className="mr-10 shrink-0 text-right">
          {isZero ? (
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
              Settled
            </span>
          ) : (
            <>
              <p
                className="amount-mono text-lg font-bold leading-none tracking-tight"
                style={{ color: isPositive ? 'var(--color-income)' : 'var(--color-expense)' }}
              >
                {formatAmount(balance)}
              </p>
              <p className="mt-1 text-[0.625rem] font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                {isPositive ? 'Owes you' : 'You owe'}
              </p>
            </>
          )}
        </div>
      </button>

      {/* Menu button */}
      <button
        type="button"
        className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-150"
        style={{ color: 'var(--color-text-muted)' }}
        aria-expanded={showMenu}
        aria-label="Person actions"
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
      >
        <MoreVertical size={18} strokeWidth={2} />
      </button>

      {showMenu && (
        <>
          <div
            className="animate-scale-in absolute right-2 top-12 z-20 overflow-hidden rounded-xl shadow-lg"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              minWidth: 130,
            }}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm font-medium transition-colors duration-150 active:bg-[var(--color-surface-3)]"
              style={{ color: 'var(--color-text)' }}
              onClick={() => {
                setShowMenu(false);
                onEdit();
              }}
            >
              <Pencil size={14} strokeWidth={2} />
              Edit
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm font-medium transition-colors duration-150 active:bg-[var(--color-surface-3)]"
              style={{ color: 'var(--color-expense)' }}
              onClick={() => {
                setShowMenu(false);
                onDelete();
              }}
            >
              <Trash2 size={14} strokeWidth={2} />
              Delete
            </button>
          </div>
          <div className="fixed inset-0 z-10" aria-hidden onClick={() => setShowMenu(false)} />
        </>
      )}
    </div>
  );
}
