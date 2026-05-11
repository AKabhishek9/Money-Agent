'use client';

import { useState } from 'react';
import { MoreVertical, Trash2, Pencil, User } from 'lucide-react';
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
      className={`relative mx-4 mb-3 rounded-2xl ${showMenu ? 'z-20' : ''}`}
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      <button
        className="w-full flex items-center gap-4 p-4 text-left active:opacity-80"
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
        <div className="text-right shrink-0 mr-8">
          {isZero ? (
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Settled
            </span>
          ) : (
            <>
              <p
                className="font-mono font-bold text-base"
                style={{ color: isPositive ? 'var(--color-income)' : 'var(--color-expense)' }}
              >
                {formatAmount(balance)}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {isPositive ? 'owes you' : 'you owe'}
              </p>
            </>
          )}
        </div>
      </button>

      {/* Menu button */}
      <button
        className="absolute top-3 right-3 p-1.5 rounded-lg"
        style={{ color: 'var(--color-text-muted)' }}
        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
      >
        <MoreVertical size={16} />
      </button>

      {showMenu && (
        <>
          <div
            className="absolute top-10 right-3 rounded-xl overflow-hidden z-10 animate-scale-in"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              minWidth: 130,
            }}
          >
            <button
              className="flex items-center gap-2 w-full px-3 py-2.5 text-sm"
              style={{ color: 'var(--color-text)' }}
              onClick={() => { setShowMenu(false); onEdit(); }}
            >
              <Pencil size={14} />
              Edit
            </button>
            <button
              className="flex items-center gap-2 w-full px-3 py-2.5 text-sm"
              style={{ color: 'var(--color-expense)' }}
              onClick={() => { setShowMenu(false); onDelete(); }}
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
          <div className="fixed inset-0 z-9" onClick={() => setShowMenu(false)} />
        </>
      )}
    </div>
  );
}
