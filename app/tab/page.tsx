'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import AuthGuard from '@/components/auth/AuthGuard';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import WindowCard from '@/components/windows/WindowCard';
import WindowView from '@/components/windows/WindowView';
import BottomSheet from '@/components/ui/BottomSheet';
import Confirm from '@/components/ui/Confirm';
import Loader from '@/components/ui/Loader';
import { useAuth } from '@/contexts/AuthContext';
import { localGetEntries } from '@/lib/entries';
import { useStore } from '@/store/useStore';
import type { Tab, MoneyWindow } from '@/lib/types';
import { Archive } from 'lucide-react';

export default function TabPage() {
  return (
    <AuthGuard>
      <AppLayout>
        <Suspense fallback={<Loader label="Loading..." />}>
          <TabContent />
        </Suspense>
      </AppLayout>
    </AuthGuard>
  );
}

function TabContent() {
  const { user } = useAuth();
  const {
    addWindow,
    deleteTab,
    loadTabs,
    loadWindows,
    persons,
    tabs,
    windowsByTabId,
    softDeleteWindow,
    updateWindow: updateWindowStore,
  } = useStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabId = searchParams.get('t');
  const windowId = searchParams.get('w');
  const cachedTab = useMemo(
    () => (tabId ? tabs.find((item) => item.id === tabId) || null : null),
    [tabId, tabs]
  );
  const cachedWindows = useMemo(
    () => (tabId ? windowsByTabId[tabId] || [] : []),
    [tabId, windowsByTabId]
  );

  const [tab, setTab] = useState<Tab | null>(cachedTab);
  const [windows, setWindows] = useState<MoneyWindow[]>(cachedWindows);
  const [windowStats, setWindowStats] = useState<Record<string, { total: number; count: number }>>({});
  const [loading, setLoading] = useState(!cachedTab);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [newWindowTitle, setNewWindowTitle] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MoneyWindow | null>(null);
  const [showDeleteTab, setShowDeleteTab] = useState(false);

  const selectedWindow = windows.find((w) => w.id === windowId) || null;

  useEffect(() => {
    if (!tabId) return;
    setTab(cachedTab);
    if (windowsByTabId[tabId]) {
      setWindows(cachedWindows);
      setLoading(false);
    }
  }, [cachedTab, cachedWindows, tabId, windowsByTabId]);

  const load = useCallback(async () => {
    if (!user || !tabId) return;
    const storeState = useStore.getState();
    const cachedStoreTab = storeState.tabs.find((item) => item.id === tabId) || null;
    const cachedStoreWindows = storeState.windowsByTabId[tabId];

    if (cachedStoreTab && cachedStoreWindows) {
      setTab(cachedStoreTab);
      setWindows(cachedStoreWindows);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const tabs = await loadTabs(user.uid);
      const t = tabs.find((x) => x.id === tabId) || null;
      setTab(t);
      if (!t) { setLoading(false); return; }

      const wins = await loadWindows(user.uid, tabId);
      setWindows(wins);
      setLoading(false);

      const stats: Record<string, { total: number; count: number }> = {};
      await Promise.all(
        wins.map(async (w) => {
          const entries = await localGetEntries(w.id);
          stats[w.id] = {
            total: entries.reduce((s, e) => s + e.amount, 0),
            count: entries.length,
          };
        })
      );
      setWindowStats(stats);
    } finally {
      setLoading(false);
    }
  }, [user, tabId, loadTabs, loadWindows]);

  useEffect(() => { load(); }, [load]);

  const handleAddWindow = async () => {
    if (!user || !tabId || !newWindowTitle.trim()) return;
    await addWindow(user.uid, tabId, newWindowTitle.trim());
    setNewWindowTitle('');
    setShowAddSheet(false);
    load();
  };

  const handleDeleteTab = async () => {
    if (!tabId) return;
    await deleteTab(tabId);
    router.push('/personal');
  };

  const handleDeleteWindow = async (w: MoneyWindow) => {
    await softDeleteWindow(w.id);
    setDeleteTarget(null);
    if (windowId === w.id) router.push(`/tab?t=${tabId}`);
    load();
  };

  if (!tabId) {
    return (
      <div className="flex items-center justify-center py-20">
        <p style={{ color: 'var(--color-text-muted)' }}>No tab selected</p>
      </div>
    );
  }

  // ── Window detail view ──
  if (selectedWindow) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Header
          title={selectedWindow.title}
          subtitle={tab?.name}
          showBack
          onBack={() => router.push(`/tab?t=${tabId}`)}
          rightAction={
            <button
              onClick={() => {
                updateWindowStore(selectedWindow.id, { archived: true });
                router.push(`/tab?t=${tabId}`);
              }}
              className="p-2 rounded-xl"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
            >
              <Archive size={20} />
            </button>
          }
        />
        <div className="flex-1 min-h-0 flex flex-col">
          <WindowView
            window={selectedWindow}
            userId={user!.uid}
            onBack={() => router.push(`/tab?t=${tabId}`)}
            persons={persons}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title={tab?.name || 'Custom Tab'}
        subtitle={`${tab?.icon || ''} Custom notebook`}
        showBack
        onBack={() => router.push('/personal')}
        rightAction={
          <div className="flex gap-1">
            <button
              onClick={() => setShowAddSheet(true)}
              className="p-2 rounded-xl"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-accent)' }}
            >
              <Plus size={20} />
            </button>
            <button
              onClick={() => setShowDeleteTab(true)}
              className="p-2 rounded-xl"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-expense)' }}
            >
              <Trash2 size={20} />
            </button>
          </div>
        }
      />

      {loading ? (
        <Loader label="Loading tab..." />
      ) : windows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="text-5xl mb-4">{tab?.icon || '📁'}</div>
          <p className="font-semibold text-base mb-1" style={{ color: 'var(--color-text)' }}>No pages yet</p>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Tap + to create a page</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pt-4 pb-24">
          {windows.map((w) => (
            <WindowCard
              key={w.id}
              window={w}
              total={windowStats[w.id]?.total ?? 0}
              entryCount={windowStats[w.id]?.count ?? 0}
              onClick={() => router.push(`/tab?t=${tabId}&w=${w.id}`)}
              onPin={() => { updateWindowStore(w.id, { pinned: !w.pinned }); load(); }}
              onArchive={() => { updateWindowStore(w.id, { archived: true }); load(); }}
              onDelete={() => setDeleteTarget(w)}
            />
          ))}
        </div>
      )}

      {showAddSheet && (
        <BottomSheet title="New Page" onClose={() => setShowAddSheet(false)}>
          <div className="p-4 flex flex-col gap-4">
            <input
              type="text"
              value={newWindowTitle}
              onChange={(e) => setNewWindowTitle(e.target.value)}
              placeholder="Page title"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              onKeyDown={(e) => e.key === 'Enter' && handleAddWindow()}
              autoFocus
            />
            <button
              onClick={handleAddWindow}
              disabled={!newWindowTitle.trim()}
              className="w-full py-3 rounded-xl text-sm font-semibold"
              style={{ background: newWindowTitle.trim() ? 'var(--color-accent)' : 'var(--color-text-dim)', color: 'var(--color-on-accent)' }}
            >
              Create Page
            </button>
          </div>
        </BottomSheet>
      )}

      {deleteTarget && (
        <Confirm
          title="Move to Trash?"
          message={`"${deleteTarget.title}" will be moved to the recycle bin.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDeleteWindow(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {showDeleteTab && (
        <Confirm
          title={`Delete tab "${tab?.name}"?`}
          message="All pages and entries in this tab will be permanently deleted."
          confirmLabel="Delete Tab"
          danger
          onConfirm={handleDeleteTab}
          onCancel={() => setShowDeleteTab(false)}
        />
      )}
    </div>
  );
}
