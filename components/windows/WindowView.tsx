'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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


interface WindowViewProps {
  window: MoneyWindow;
  userId: string;
  onBack: () => void;
  persons: Person[];
}

export default function WindowView({ window: w, userId, persons }: WindowViewProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const prevLengthRef = useRef(0);
  const didInitialEntriesLoadRef = useRef(false);

  // LOW-04: error state on load failure
  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const data = await localGetEntries(w.id);
      setEntries(data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [w.id]);

  useEffect(() => { load(); }, [load]);

  // HIGH-01 fixed: removed memory leak (missing removeEventListener)
  // MEDIUM-01 fixed: removed redundant 30s polling interval
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };
    const handleRemoteSync = (event: Event) => {
      const collection = (event as CustomEvent<{ collection?: string }>).detail?.collection;
      if (collection === 'entries') load();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('money-ledger-remote-sync', handleRemoteSync);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('money-ledger-remote-sync', handleRemoteSync);
    };
  }, [load]);

  useEffect(() => {
    if (didInitialEntriesLoadRef.current && entries.length > prevLengthRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }

    if (!loading) {
      didInitialEntriesLoadRef.current = true;
    }
    prevLengthRef.current = entries.length;
  }, [entries.length, loading]);

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
        type: amount < 0 ? 'income' : 'expense',
        entryDate,
        linkedEntryId: entry.id,
        linkedWindowId: w.id,
      });
    }

    setEntries((prev) => [...prev, entry]);
  };

  const handleDelete = async (entry: Entry) => {
    await localDeleteEntry(entry.id);
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
  };

  // HIGH-04: handleEdit now accepts optional newDate
  const handleEdit = async (entry: Entry, rawText: string, newDate?: Date) => {
    const parsed = parseEntry(rawText);
    if (!parsed.isValid) return;
    await localUpdateEntry(entry.id, {
      rawText: parsed.rawText,
      amount: parsed.amount,
      note: parsed.note,
      type: parsed.type,
      ...(newDate ? { entryDate: newDate } : {}),
    });
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entry.id
          ? {
              ...e,
              rawText: parsed.rawText,
              amount: parsed.amount,
              note: parsed.note,
              type: parsed.type as Entry['type'],
              ...(newDate ? { entryDate: newDate } : {}),
            }
          : e
      )
    );
  };

  const { total, incomeTotal, expenseTotal, grouped } = useMemo(() => {
    const t = calcTotal(entries.map((e) => e.amount));
    const inc = calcTotal(entries.filter((e) => e.amount > 0).map((e) => e.amount));
    const exp = calcTotal(entries.filter((e) => e.amount < 0).map((e) => e.amount));
    const withBalance = computeRunningBalance(entries);
    const grp = withBalance.reduce<Record<string, typeof withBalance>>((acc, e) => {
      const key = formatDate(e.entryDate);
      if (!acc[key]) acc[key] = [];
      acc[key].push(e);
      return acc;
    }, {});

    return {
      total: t,
      incomeTotal: inc,
      expenseTotal: exp,
      grouped: grp,
    };
  }, [entries]);
  const isPositive = total >= 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary card */}
      <div className="shrink-0 px-4 pt-4 pb-2">
        <div
          className="rounded-2xl p-4"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-2)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-balance-label mb-1.5">Total Balance</p>
              <p
                className="amount-mono truncate text-[1.85rem] font-bold leading-none tracking-tight"
                style={{ color: isPositive ? 'var(--color-income)' : 'var(--color-expense)' }}
              >
                {formatAmount(total)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => exportWindowToCSV(w.title, entries)}
                className="flex h-10 items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold transition-opacity duration-150 active:opacity-80"
                style={{
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-muted)',
                }}
              >
                <Download size={13} strokeWidth={2} />
                CSV
              </button>
              <button
                type="button"
                onClick={() => exportWindowToPDF(w.title, entries)}
                className="flex h-10 items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold transition-opacity duration-150 active:opacity-80"
                style={{
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-muted)',
                }}
              >
                <Download size={13} strokeWidth={2} />
                PDF
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-4 flex gap-6">
            <Stat label="Income" value={incomeTotal} color="var(--color-income)" />
            <Stat label="Expense" value={Math.abs(expenseTotal)} color="var(--color-expense)" />
            <Stat label="Entries" value={entries.length} isCount />
          </div>
        </div>
      </div>

      {/* Entries list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="px-4 py-3 space-y-px">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center justify-between py-3 px-1">
                <div className="flex flex-col gap-1.5 flex-1">
                  <div
                    className="h-3.5 rounded-md animate-pulse"
                    style={{ width: `${55 + (i % 3) * 15}%`, background: 'var(--color-surface-2)' }}
                  />
                  <div
                    className="h-2.5 rounded-md animate-pulse"
                    style={{ width: '30%', background: 'var(--color-surface-2)', opacity: 0.6 }}
                  />
                </div>
                <div className="flex flex-col items-end gap-1.5 ml-4">
                  <div
                    className="h-3.5 w-16 rounded-md animate-pulse"
                    style={{ background: 'var(--color-surface-2)' }}
                  />
                  <div
                    className="h-2.5 w-12 rounded-md animate-pulse"
                    style={{ background: 'var(--color-surface-2)', opacity: 0.6 }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : loadError ? (
          // LOW-04: error state with retry
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-expense)' }}>
              Failed to load entries
            </p>
            <button
              onClick={load}
              className="mt-3 text-sm px-4 py-2 rounded-xl"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-accent)' }}
            >
              Try Again
            </button>
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
                className="px-4 py-2.5"
                style={{ background: 'color-mix(in oklab, var(--color-surface) 92%, transparent)' }}
              >
                <span
                  className="text-[0.6875rem] font-bold uppercase tracking-widest"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {dateLabel}
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

      {/* Edit sheet — HIGH-04: passes newDate back to handleEdit */}
      {editEntry && (
        <EditEntrySheet
          entry={editEntry}
          onSave={(raw: string, newDate?: Date) => { handleEdit(editEntry, raw, newDate); setEditEntry(null); }}
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
