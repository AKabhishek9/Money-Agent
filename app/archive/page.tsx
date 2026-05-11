'use client';

import { useState, useEffect, useCallback } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import AuthGuard from '@/components/auth/AuthGuard';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import Loader from '@/components/ui/Loader';
import Confirm from '@/components/ui/Confirm';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/lib/db';
import { useStore } from '@/store/useStore';
import type { MoneyWindow, Tab } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export default function ArchivePage() {
  return (
    <AuthGuard>
      <AppLayout>
        <ArchiveContent />
      </AppLayout>
    </AuthGuard>
  );
}

function ArchiveContent() {
  const { user } = useAuth();
  const {
    hardDeleteWindow,
    restoreWindow,
    updateWindow: updateWindowStore,
  } = useStore();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [archived, setArchived] = useState<MoneyWindow[]>([]);
  const [recycled, setRecycled] = useState<MoneyWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'archive' | 'trash'>('archive');
  const [deleteTarget, setDeleteTarget] = useState<MoneyWindow | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const db = getDb();
      const [archivedWins, recycledWins, tabList] = await Promise.all([
        db.windows
          .where('userId')
          .equals(user.uid)
          .filter((w) => w.archived && !w.inRecycleBin)
          .toArray(),
        db.windows
          .where('userId')
          .equals(user.uid)
          .filter((w) => w.inRecycleBin)
          .toArray(),
        db.tabs.where('userId').equals(user.uid).toArray(),
      ]);
      setTabs(tabList);
      setArchived(archivedWins);
      setRecycled(recycledWins);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const getTabName = (tabId: string) =>
    tabs.find((t) => t.id === tabId)?.name || 'Unknown Tab';

  const handleRestoreFromTrash = async (w: MoneyWindow) => {
    await restoreWindow(w.id);
    load();
  };

  const handleRestoreFromArchive = async (w: MoneyWindow) => {
    await updateWindowStore(w.id, { archived: false });
    load();
  };

  const handlePermanentDelete = async (w: MoneyWindow) => {
    await hardDeleteWindow(w.id);
    setDeleteTarget(null);
    load();
  };

  const list = activeView === 'archive' ? archived : recycled;

  return (
    <div>
      <Header title="Archive & Trash" />

      {/* Segmented control */}
      <div className="px-4 pb-2 pt-2">
        <div
          className="flex gap-1 rounded-2xl p-1"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
          role="tablist"
        >
          {(['archive', 'trash'] as const).map((v) => {
            const active = activeView === v;
            return (
              <button
                type="button"
                key={v}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveView(v)}
                className="relative flex-1 rounded-xl py-2.5 text-center text-xs font-semibold uppercase tracking-wide transition-[color,transform,background] duration-200"
                style={{
                  background: active ? 'var(--color-surface)' : 'transparent',
                  color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
                  boxShadow: active ? '0 1px 0 rgba(255,255,255,0.06) inset' : undefined,
                }}
              >
                {v === 'archive' ? `Archive (${archived.length})` : `Trash (${recycled.length})`}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <Loader label="Loading archive..." />
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
          <div className="text-4xl mb-3">{activeView === 'archive' ? '📦' : '🗑️'}</div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
            {activeView === 'archive' ? 'No archived pages' : 'Trash is empty'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4 pb-6 pt-2">
          {list.map((w) => (
            <div
              key={w.id}
              className="surface-card rounded-2xl p-4"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
                    {w.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                    {getTabName(w.tabId)} · {formatDate(w.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    activeView === 'archive' ? handleRestoreFromArchive(w) : handleRestoreFromTrash(w)
                  }
                  className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-opacity duration-150 active:opacity-80"
                  style={{ background: 'var(--color-accent-bg)', color: 'var(--color-accent)' }}
                >
                  <RotateCcw size={14} strokeWidth={2} />
                  Restore
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(w)}
                  className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-opacity duration-150 active:opacity-80"
                  style={{ background: 'var(--color-expense-bg)', color: 'var(--color-expense)' }}
                >
                  <Trash2 size={14} strokeWidth={2} />
                  Delete forever
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <Confirm
          title="Delete forever?"
          message={`"${deleteTarget.title}" and all its entries will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete Forever"
          danger
          onConfirm={() => handlePermanentDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
