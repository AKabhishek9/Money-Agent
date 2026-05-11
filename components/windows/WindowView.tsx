'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download } from 'lucide-react';
import type { Entry, MoneyWindow, Person } from '@/lib/types';
import {
  computeRunningBalance,
  localAddEntry,
  localAddPersonEntry,
  localDeleteEntry,
  localGetEntries,
  localUpdateEntry,
} from '@/lib/entries';
import { parseEntry, formatAmount, calcTotal } from '@/lib/parser';
import { formatDate } from '@/lib/utils';
import { exportWindowToCSV } from '@/lib/export';
import { exportWindowToPDF } from '@/lib/pdf';
import EntryInput from '@/components/entry/EntryInput';
import EntryItem from '@/components/entry/EntryItem';
import EditEntrySheet from './EditEntrySheet';
import { useRef } from 'react';

interface WindowViewProps {
  window: MoneyWindow;
  userId: string;
  onBack: () => void;
  persons: Person[];
}

export default function WindowView({ window: w, userId, onBack, persons }: WindowViewProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await localGetEntries(w.id);
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }, [w.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  const handleAdd = async (
    rawText: string,
    amount: number,
    note: string,
    type: string,
    entryDate: Date,
    linkedPersonId?: string,
    linkedPersonName?: string
  ) => {
    const entry = await localAddEntry(userId, w.id, {
      rawText,
      amount,
      note,
      type,
      entryDate,
      linkedPersonId,
      linkedPersonName,
    });

    if (linkedPersonId) {
      await localAddPersonEntry(userId, linkedPersonId, {
        rawText: `${note || rawText} (from ${w.title})`,
        amount: -amount,
        note: note || rawText,
        entryDate,
        linkedEntryId: entry.id,
        linkedWindowId: w.id,
      });
    }

    setEntries((prev) => [entry, ...prev]);
  };

  const handleDelete = async (entry: Entry) => {
    await localDeleteEntry(entry.id);
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
  };

  const handleEdit = async (entry: Entry, rawText: string) => {
    const parsed = parseEntry(rawText);
    if (!parsed.isValid) return;
    await localUpdateEntry(entry.id, {
      rawText: parsed.rawText,
      amount: parsed.amount,
      note: parsed.note,
      type: parsed.type,
    });
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entry.id
          ? { ...e, rawText: parsed.rawText, amount: parsed.amount, note: parsed.note, type: parsed.type as Entry['type'] }
          : e
      )
    );
  };

  const total = calcTotal(entries.map((e) => e.amount));
  const isPositive = total >= 0;
  const entriesWithBalance = computeRunningBalance(entries);

  // Group entries by date label
  const grouped = entriesWithBalance.reduce<Record<string, typeof entriesWithBalance>>((acc, e) => {
    const key = formatDate(e.entryDate);
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Totals bar — compact summary, thumb-friendly export */}
      <div className="surface-card shrink-0 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-balance-label mb-1">Total balance</p>
            <p
              className="amount-mono truncate text-[1.75rem] font-bold leading-none tracking-tight sm:text-[2rem]"
              style={{ color: isPositive ? 'var(--color-income)' : 'var(--color-expense)' }}
            >
              {formatAmount(total)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => exportWindowToCSV(w.title, entries)}
              className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-opacity duration-150 active:opacity-80"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
            >
              <Download size={14} strokeWidth={2} />
              CSV
            </button>
            <button
              type="button"
              onClick={() => exportWindowToPDF(w.title, entries)}
              className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-opacity duration-150 active:opacity-80"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
            >
              <Download size={14} strokeWidth={2} />
              PDF
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-3 flex gap-6">
          <Stat
            label="Income"
            value={calcTotal(entries.filter((e) => e.amount > 0).map((e) => e.amount))}
            color="var(--color-income)"
          />
          <Stat
            label="Expense"
            value={calcTotal(entries.filter((e) => e.amount < 0).map((e) => e.amount))}
            color="var(--color-expense)"
          />
          <Stat label="Entries" value={entries.length} isCount />
        </div>
      </div>

      {/* Entries list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm loading-pulse" style={{ color: 'var(--color-text-muted)' }}>
              Loading entries…
            </p>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="font-medium text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>
              No entries yet
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
              Type below to add your first entry
            </p>
          </div>
        ) : (
          Object.entries(grouped).map(([dateLabel, dayEntries]) => (
            <div key={dateLabel}>
              {/* Date header */}
              <div
                className="flex items-center gap-2 px-4 py-2"
                style={{ background: 'color-mix(in oklab, var(--color-surface-2) 92%, transparent)' }}
              >
                <span className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                  {dateLabel}
                </span>
                <div className="h-px flex-1" style={{ background: 'var(--color-border)' }} />
                <span className="amount-mono text-[0.6875rem] font-semibold" style={{ color: 'var(--color-text-dim)' }}>
                  {formatAmount(calcTotal(dayEntries.map((e) => e.amount)))}
                </span>
              </div>

              {dayEntries.map((entry) => (
                <EntryItem
                  key={entry.id}
                  entry={entry}
                  runningBalance={entry.runningBalance}
                  onDelete={() => handleDelete(entry)}
                  onEdit={() => setEditEntry(entry)}
                />
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Entry input */}
      <div className="shrink-0 border-t" style={{ borderColor: 'var(--color-border)', background: 'var(--color-nav)' }}>
        <EntryInput onAdd={handleAdd} persons={persons} />
      </div>

      {/* Edit sheet */}
      {editEntry && (
        <EditEntrySheet
          entry={editEntry}
          onSave={(raw) => { handleEdit(editEntry, raw); setEditEntry(null); }}
          onClose={() => setEditEntry(null)}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  isCount,
}: {
  label: string;
  value: number;
  color?: string;
  isCount?: boolean;
}) {
  return (
    <div>
      <p className="mb-0.5 text-[0.625rem] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
        {label}
      </p>
      <p className="amount-mono text-sm font-semibold tabular-nums" style={{ color: color || 'var(--color-text)' }}>
        {isCount ? value : formatAmount(value)}
      </p>
    </div>
  );
}
