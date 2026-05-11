'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import AuthGuard from '@/components/auth/AuthGuard';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import WindowCard from '@/components/windows/WindowCard';
import WindowView from '@/components/windows/WindowView';
import BottomSheet from '@/components/ui/BottomSheet';
import Confirm from '@/components/ui/Confirm';
import Loader from '@/components/ui/Loader';
import { useAuth } from '@/contexts/AuthContext';
import { ensureSystemData } from '@/lib/bootstrap';
import { getDb } from '@/lib/db';
import { localGetEntries } from '@/lib/entries';
import { getMonthKey, getMonthWindowTitle } from '@/lib/utils';
import { useStore } from '@/store/useStore';
import type { Tab, MoneyWindow } from '@/lib/types';
import { Archive } from 'lucide-react';

export default function PersonalPage() {
  return (
    <AuthGuard>
      <AppLayout>
        <Suspense fallback={<Loader label="Loading..." />}>
          <PersonalContent />
        </Suspense>
      </AppLayout>
    </AuthGuard>
  );
}

function PersonalContent() {
  const { user } = useAuth();
  const {
    addWindow,
    loadWindows,
    persons,
    tabs,
    windowsByTabId,
    softDeleteWindow,
    updateWindow: updateWindowStore,
  } = useStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const windowId = searchParams.get('w');
  const cachedPersonalTab = useMemo(
    () => tabs.find((tab) => tab.type === 'personal') || null,
    [tabs]
  );
  const cachedPersonalWindows = useMemo(
    () => (cachedPersonalTab ? windowsByTabId[cachedPersonalTab.id] || [] : []),
    [cachedPersonalTab, windowsByTabId]
  );

  const [personalTab, setPersonalTab] = useState<Tab | null>(cachedPersonalTab);
  const [windows, setWindows] = useState<MoneyWindow[]>(cachedPersonalWindows);
  const [windowStats, setWindowStats] = useState<Record<string, { total: number; count: number }>>({});
  const [loading, setLoading] = useState(!cachedPersonalTab);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [newWindowTitle, setNewWindowTitle] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MoneyWindow | null>(null);

  const selectedWindow = windows.find((w) => w.id === windowId) || null;

  useEffect(() => {
    if (!cachedPersonalTab) return;
    setPersonalTab(cachedPersonalTab);
    if (windowsByTabId[cachedPersonalTab.id]) {
      setWindows(cachedPersonalWindows);
      setLoading(false);
    }
  }, [cachedPersonalTab, cachedPersonalWindows, windowsByTabId]);

  const load = useCallback(async () => {
    if (!user) return;
    const storeState = useStore.getState();
    const cachedTab = storeState.tabs.find((tab) => tab.type === 'personal') || null;
    const cachedWindows = cachedTab ? storeState.windowsByTabId[cachedTab.id] : undefined;

    if (cachedTab && cachedWindows) {
      setPersonalTab(cachedTab);
      setWindows(cachedWindows);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const db = getDb();
      const tabs = await db.tabs.where('userId').equals(user.uid).toArray();
      const pTab = tabs.find((t) => t.type === 'personal') || null;
      setPersonalTab(pTab);
      if (!pTab) {
        await ensureSystemData(user.uid);

        const updatedTabs = await db.tabs.where('userId').equals(user.uid).toArray();
        const recoveredTab = updatedTabs.find((tab) => tab.type === 'personal') || null;

        if (!recoveredTab) {
          setLoading(false);
          return;
        }

        setPersonalTab(recoveredTab);

        const recoveredWindows = await loadWindows(user.uid, recoveredTab.id);
        setWindows(recoveredWindows);

        setLoading(false);
        return;
      }

      const monthKey = getMonthKey();
      const existingMonth = await db.windows
        .where('tabId')
        .equals(pTab.id)
        .filter((w) => w.monthKey === monthKey)
        .count();

      if (existingMonth === 0) {
        await addWindow(user.uid, pTab.id, getMonthWindowTitle(), {
          autoMonthly: true,
          monthKey,
          pinned: true,
        });
      }

      const wins = await loadWindows(user.uid, pTab.id);
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
  }, [user, addWindow, loadWindows]);

  useEffect(() => { load(); }, [load]);

  const handleAddWindow = async () => {
    if (!user || !personalTab || !newWindowTitle.trim()) return;
    await addWindow(user.uid, personalTab.id, newWindowTitle.trim());
    setNewWindowTitle('');
    setShowAddSheet(false);
    load();
  };

  const handlePin = async (w: MoneyWindow) => {
    await updateWindowStore(w.id, { pinned: !w.pinned });
    load();
  };

  const handleArchive = async (w: MoneyWindow) => {
    await updateWindowStore(w.id, { archived: true });
    load();
  };

  const handleDelete = async (w: MoneyWindow) => {
    await softDeleteWindow(w.id);
    setDeleteTarget(null);
    if (windowId === w.id) router.push('/personal');
    load();
  };

  // ── Window detail view ──
  if (selectedWindow) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Header
          title={selectedWindow.title}
          showBack
          onBack={() => router.push('/personal')}
          rightAction={
            <button
              onClick={() => {
                updateWindowStore(selectedWindow.id, { archived: true });
                router.push('/personal');
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
            onBack={() => router.push('/personal')}
            persons={persons}
          />
        </div>
      </div>
    );
  }

  // ── Windows list ──
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Personal"
        subtitle="Your accounting notebook"
        rightAction={
          <div className="flex items-center gap-1">
            <button
              onClick={() => router.push('/archive')}
              className="p-2 rounded-xl"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
            >
              <Archive size={20} />
            </button>
            <button
              onClick={() => setShowAddSheet(true)}
              className="p-2 rounded-xl"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-accent)' }}
            >
              <Plus size={20} />
            </button>
          </div>
        }
      />

      {loading ? (
        <Loader label="Loading pages..." />
      ) : windows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="text-5xl mb-4">📓</div>
          <p className="font-semibold text-base mb-1" style={{ color: 'var(--color-text)' }}>
            No pages yet
          </p>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Tap + to create a new page
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pt-4 pb-24">
          {windows.map((w) => (
            <WindowCard
              key={w.id}
              window={w}
              total={windowStats[w.id]?.total ?? 0}
              entryCount={windowStats[w.id]?.count ?? 0}
              onClick={() => router.push(`/personal?w=${w.id}`)}
              onPin={() => handlePin(w)}
              onArchive={() => handleArchive(w)}
              onDelete={() => setDeleteTarget(w)}
            />
          ))}
        </div>
      )}

      {/* Add window sheet */}
      {showAddSheet && (
        <BottomSheet title="New Page" onClose={() => setShowAddSheet(false)}>
          <div className="p-4 flex flex-col gap-4">
            <input
              type="text"
              value={newWindowTitle}
              onChange={(e) => setNewWindowTitle(e.target.value)}
              placeholder="Page title (e.g. Business Expenses)"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleAddWindow()}
              autoFocus
            />
            <button
              onClick={handleAddWindow}
              disabled={!newWindowTitle.trim()}
              className="w-full py-3 rounded-xl text-sm font-semibold"
              style={{
                background: newWindowTitle.trim() ? 'var(--color-accent)' : 'var(--color-text-dim)',
                color: 'var(--color-on-accent)',
              }}
            >
              Create Page
            </button>
          </div>
        </BottomSheet>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <Confirm
          title="Move to Trash?"
          message={`"${deleteTarget.title}" will be moved to the recycle bin.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
