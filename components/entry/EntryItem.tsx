'use client';

import { useState } from 'react';
import { Trash2, Pencil, Calendar, ChevronRight, UserRound } from 'lucide-react';
import type { Entry, PersonEntry } from '@/lib/types';
import { formatAmount, formatAmountAbs } from '@/lib/parser';
import { formatRelativeDate } from '@/lib/utils';

type AnyEntry = (Entry | PersonEntry) & { note: string; amount: number; entryDate: Date; rawText: string };

interface EntryItemProps {
  entry: AnyEntry;
  onDelete: () => void;
  onEdit?: () => void;
  showDate?: boolean;
  runningBalance?: number;
}

export default function EntryItem({
  entry,
  onDelete,
  onEdit,
  showDate = true,
  runningBalance,
}: EntryItemProps) {
  const [showActions, setShowActions] = useState(false);

  const isPositive = entry.amount >= 0;

  return (
    <div className="relative">
      {/* Main row — notebook line, tap to expand */}
      <button
        type="button"
        className="entry-item flex w-full items-start gap-3 px-4 py-3.5 text-left transition-opacity duration-150 active:opacity-[0.92]"
        style={{
          borderBottom: '1px solid color-mix(in oklab, var(--color-border) 70%, transparent)',
          background: showActions ? 'color-mix(in oklab, var(--color-surface-2) 55%, transparent)' : 'transparent',
        }}
        onClick={() => setShowActions(!showActions)}
      >
        {/* Amount indicator */}
        <div
          className="mt-0.5 w-1 shrink-0 self-stretch rounded-full"
          style={{
            background: isPositive ? 'var(--color-income)' : 'var(--color-expense)',
            minHeight: 36,
            opacity: 0.85,
          }}
          aria-hidden
        />

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div
            className="text-[0.9375rem] font-medium leading-snug tracking-tight"
            style={{ color: entry.note ? 'var(--color-text)' : 'var(--color-text-muted)' }}
          >
            <span className="line-clamp-2 text-left">{entry.note || entry.rawText}</span>
          </div>
          {showDate && (
            <div className="mt-1 flex items-center gap-1">
              <Calendar size={11} strokeWidth={2} style={{ color: 'var(--color-text-dim)' }} />
              <span className="text-[0.6875rem]" style={{ color: 'var(--color-text-dim)' }}>
                {formatRelativeDate(entry.entryDate)}
              </span>
            </div>
          )}
          {'linkedPersonName' in entry && entry.linkedPersonName && (
            <div
              className="mt-1.5 flex w-fit max-w-full items-center gap-1 rounded-lg px-2 py-1"
              style={{ background: 'var(--color-accent-bg)', color: 'var(--color-accent)' }}
            >
              <UserRound size={11} strokeWidth={2} />
              <span className="max-w-32 truncate text-[0.625rem] font-semibold leading-none">{entry.linkedPersonName}</span>
            </div>
          )}
        </div>

        {/* Amount + running balance */}
        <div className="flex shrink-0 items-start gap-1.5 pt-0.5">
          <div className="flex flex-col items-end gap-1">
            <span
              className="amount-mono text-base font-semibold leading-none"
              style={{ color: isPositive ? 'var(--color-income)' : 'var(--color-expense)' }}
            >
              {formatAmount(entry.amount)}
            </span>
            {runningBalance !== undefined && (
              <div className="flex flex-col items-end gap-0">
                <span className="text-[0.5625rem] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                  Balance
                </span>
                <span className="amount-mono text-xs font-medium leading-none" style={{ color: 'var(--color-text-muted)' }}>
                  {runningBalance < 0 ? '-' : ''}
                  {formatAmountAbs(runningBalance)}
                </span>
              </div>
            )}
          </div>
          <ChevronRight
            size={16}
            strokeWidth={2}
            className="mt-1 shrink-0 transition-transform duration-200 ease-out"
            style={{
              color: 'var(--color-text-dim)',
              transform: showActions ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
            aria-hidden
          />
        </div>
      </button>

      {/* Action panel */}
      {showActions && (
        <div
          className="animate-fade-in flex flex-wrap items-center gap-2 px-4 py-2.5"
          style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}
        >
          <span className="min-w-0 flex-1 truncate font-mono text-[0.6875rem] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            Raw: {entry.rawText}
          </span>
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowActions(false);
                onEdit();
              }}
              className="flex min-h-9 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-opacity duration-150 active:opacity-90"
              style={{ background: 'var(--color-accent-bg)', color: 'var(--color-accent)' }}
            >
              <Pencil size={14} strokeWidth={2} />
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowActions(false);
              onDelete();
            }}
            className="flex min-h-9 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-opacity duration-150 active:opacity-90"
            style={{ background: 'var(--color-expense-bg)', color: 'var(--color-expense)' }}
          >
            <Trash2 size={14} strokeWidth={2} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
