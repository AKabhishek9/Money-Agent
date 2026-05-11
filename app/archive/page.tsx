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

      {/* Tab switch */}
      <div className="flex gap-2 px-4 py-3">
        {(['archive', 'trash'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setActiveView(v)}
            className="flex-1 py-2 rounded-xl text-sm font-medium"
            style={{
              background: activeView === v ? 'var(--color-accent)' : 'var(--color-surface)',
              color: activeView === v ? '#fff' : 'var(--color-text-muted)',
              border: '1px solid var(--color-border)',
            }}
          >
            {v === 'archive' ? `📦 Archive (${archived.length})` : `🗑️ Trash (${recycled.length})`}
          </button>
        ))}
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
        <div className="px-4 flex flex-col gap-3 pt-2">
          {list.map((w) => (
            <div
              key={w.id}
              className="rounded-2xl p-4"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                    {w.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {getTabName(w.tabId)} · {formatDate(w.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    activeView === 'archive'
                      ? handleRestoreFromArchive(w)
                      : handleRestoreFromTrash(w)
                  }
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium"
                  style={{ background: 'var(--color-accent-bg)', color: 'var(--color-accent)' }}
                >
                  <RotateCcw size={13} />
                  Restore
                </button>
                <button
                  onClick={() => setDeleteTarget(w)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium"
                  style={{ background: 'var(--color-expense-bg)', color: 'var(--color-expense)' }}
                >
                  <Trash2 size={13} />
                  Delete Forever
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
