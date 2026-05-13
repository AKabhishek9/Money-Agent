'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useStore } from '@/store/useStore';
import type { Tab, MoneyWindow, Entry } from '@/lib/types';
import { formatAmount } from '@/lib/parser';
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
  const [windowStats, setWindowStats] = useState<Record<string, { total: number; count: number; recentEntries: Entry[] }>>({});
  const [loading, setLoading] = useState(!cachedPersonalTab);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [newWindowTitle, setNewWindowTitle] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MoneyWindow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<MoneyWindow | null>(null);
  const [renameTarget, setRenameTarget] = useState<MoneyWindow | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  const selectedWindow = windows.find((w) => w.id === windowId) || null;
  const prevWindowIdRef = useRef<string | null>(null);

  const globalTotalBalance = useMemo(() => {
    return Object.values(windowStats).reduce((sum, w) => sum + w.total, 0);
  }, [windowStats]);

  useEffect(() => {
    if (!cachedPersonalTab) return;
    setPersonalTab(cachedPersonalTab);
    if (windowsByTabId[cachedPersonalTab.id]) {
      setWindows(cachedPersonalWindows);
      setLoading(false);
    }
  }, [cachedPersonalTab, cachedPersonalWindows, windowsByTabId]);


  useEffect(() => {
    const prev = prevWindowIdRef.current;
    prevWindowIdRef.current = windowId;

    if (prev !== null && windowId === null && windows.length > 0) {
      Promise.all(
        windows.map(async (w) => {
          const entries = await localGetEntries(w.id);
          setWindowStats((prevStats) => ({
            ...prevStats,
            [w.id]: {
              total: entries.reduce((sum, entry) => sum + entry.amount, 0),
              count: entries.length,
              recentEntries: [...entries].reverse().slice(0, 5),
            },
          }));
        })
      ).catch(() => undefined);
    }
  }, [windowId, windows]);
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
      await ensureSystemData(user.uid);
      const db = getDb();
      const tabs = await db.tabs.where('userId').equals(user.uid).toArray();
      const pTab = tabs.find((t) => t.type === 'personal') || null;
      setPersonalTab(pTab);

      if (!pTab) {
        setLoading(false);
        return;
      }

      const wins = await loadWindows(user.uid, pTab.id);
      setWindows(wins);
      setLoading(false);

      wins.forEach(async (w) => {
        const entries = await localGetEntries(w.id);
        setWindowStats((prev) => ({
          ...prev,
          [w.id]: {
            total: entries.reduce((s, e) => s + e.amount, 0),
            count: entries.length,
            recentEntries: [...entries].reverse().slice(0, 5),
          },
        }));
      });
    } finally {
      setLoading(false);
    }
  }, [user, addWindow, loadWindows]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === 'visible' && windows.length > 0) {
        windows.forEach(async (w) => {
          const entries = await localGetEntries(w.id);
          setWindowStats((prev) => ({
            ...prev,
            [w.id]: {
              total: entries.reduce((s, e) => s + e.amount, 0),
              count: entries.length,
              recentEntries: [...entries].reverse().slice(0, 5),
            },
          }));
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisible);
    return () => document.removeEventListener('visibilitychange', handleVisible);
  }, [windows]);


  useEffect(() => {
    const handleRemoteSync = (event: Event) => {
      const collection = (event as CustomEvent<{ collection?: string }>).detail?.collection;

      if (collection === 'windows' || collection === 'tabs') {
        load();
        return;
      }

      if (collection === 'entries' && windows.length > 0) {
        windows.forEach(async (w) => {
          const entries = await localGetEntries(w.id);
          setWindowStats((prev) => ({
            ...prev,
            [w.id]: {
              total: entries.reduce((s, e) => s + e.amount, 0),
              count: entries.length,
              recentEntries: [...entries].reverse().slice(0, 5),
            },
          }));
        });
      }
    };

    window.addEventListener('money-ledger-remote-sync', handleRemoteSync);
    return () => window.removeEventListener('money-ledger-remote-sync', handleRemoteSync);
  }, [load, windows]);
  const handleAddWindow = async () => {
    if (!user || !personalTab || !newWindowTitle.trim()) return;
    await addWindow(user.uid, personalTab.id, newWindowTitle.trim());
    setNewWindowTitle('');
    setShowAddSheet(false);
    load();
  };

  const handlePin = async (w: MoneyWindow) => {
    await updateWindowStore(w.id, { pinned: !w.pinned });
  };

  const handleArchive = async (w: MoneyWindow) => {
    await updateWindowStore(w.id, { archived: true });
  };

  const handleDelete = async (w: MoneyWindow) => {
    await softDeleteWindow(w.id);
    setDeleteTarget(null);
    if (windowId === w.id) router.push('/personal');
  };

  const handleRename = async () => {
    if (!renameTarget || !renameTitle.trim()) return;
    await updateWindowStore(renameTarget.id, { title: renameTitle.trim() });
    setRenameTarget(null);
    setRenameTitle('');
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
              onClick={() => setArchiveTarget(selectedWindow)}
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
            >
              <Archive size={18} />
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
        {archiveTarget && (
          <Confirm
            title="Archive this page?"
            message={`"${archiveTarget.title}" will be moved to archive.`}
            confirmLabel="Archive"
            onConfirm={() => {
              updateWindowStore(archiveTarget.id, { archived: true });
              setArchiveTarget(null);
              router.push('/personal');
            }}
            onCancel={() => setArchiveTarget(null)}
          />
        )}
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/archive')}
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
            >
              <Archive size={18} />
            </button>
            <button
              onClick={() => setShowAddSheet(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
            >
              <Plus size={20} />
            </button>
          </div>
        }
      />

      {/* NET BALANCE card */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div
          className="rounded-3xl px-5 py-4 flex items-center justify-between"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-card-sm)',
          }}
        >
          <div>
            <p className="text-balance-label mb-1">Total Balance</p>
            <p
              className="amount-mono text-[1.5rem] font-bold leading-none tracking-tight"
              style={{
                color: globalTotalBalance === 0 ? 'var(--color-text-muted)' : globalTotalBalance > 0 ? 'var(--color-income)' : 'var(--color-expense)',
              }}
            >
              {globalTotalBalance === 0 ? '₹0' : formatAmount(globalTotalBalance)}
            </p>
          </div>
          <div className="h-10 w-10 flex items-center justify-center rounded-full bg-black/20" style={{ color: 'var(--color-text-muted)' }}>
            <span className="text-xl">💰</span>
          </div>
        </div>
      </div>

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
        <div className="flex-1 overflow-y-auto pt-3 pb-24 px-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {windows.map((w) => (
              <div key={w.id}>
                <WindowCard
                  window={w}
                  total={windowStats[w.id]?.total ?? 0}
                  entryCount={windowStats[w.id]?.count ?? 0}
                  recentEntries={windowStats[w.id]?.recentEntries ?? []}
                  onClick={() => router.push(`/personal?w=${w.id}`)}
                  onPin={() => handlePin(w)}
                  onArchive={() => handleArchive(w)}
                  onDelete={() => setDeleteTarget(w)}
                  onRename={() => {
                    setRenameTitle(w.title);
                    setRenameTarget(w);
                  }}
                />
              </div>
            ))}
          </div>
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

      {/* Rename window sheet */}
      {renameTarget && (
        <BottomSheet title="Rename Page" onClose={() => setRenameTarget(null)}>
          <div className="p-4 flex flex-col gap-4">
            <input
              type="text"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              placeholder="Page title"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              autoFocus
            />
            <button
              onClick={handleRename}
              disabled={!renameTitle.trim() || renameTitle.trim() === renameTarget.title}
              className="w-full py-3 rounded-xl text-sm font-semibold"
              style={{
                background: renameTitle.trim() && renameTitle.trim() !== renameTarget.title ? 'var(--color-accent)' : 'var(--color-text-dim)',
                color: 'var(--color-on-accent)',
              }}
            >
              Save
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
