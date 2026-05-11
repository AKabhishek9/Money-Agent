'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Settings, Archive, Trash2, LogOut } from 'lucide-react';
import BottomSheet from '@/components/ui/BottomSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/store/useStore';

interface MoreDrawerProps {
  onClose: () => void;
}

export default function MoreDrawer({ onClose }: MoreDrawerProps) {
  const { user, signOut } = useAuth();
  const { addTab, loadTabs, tabs } = useStore();
  const router = useRouter();
  const [showAddTab, setShowAddTab] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [newTabIcon, setNewTabIcon] = useState('📁');
  const [adding, setAdding] = useState(false);

  const customTabs = useMemo(() => tabs.filter((tab) => tab.type === 'custom'), [tabs]);

  useEffect(() => {
    if (!user) return;
    loadTabs(user.uid);
  }, [user, loadTabs]);

  const handleNavigate = (href: string) => {
    router.push(href);
    onClose();
  };

  const handleAddTab = async () => {
    if (!user || !newTabName.trim()) return;
    setAdding(true);
    try {
      const id = await addTab(user.uid, { name: newTabName.trim(), icon: newTabIcon });
      setNewTabName('');
      setShowAddTab(false);
      router.prefetch(`/tab?t=${id}`);
      handleNavigate(`/tab?t=${id}`);
    } finally {
      setAdding(false);
    }
  };

  const ICONS = ['📁', '💼', '🌾', '🏪', '🏠', '✈️', '⚡', '🎯', '🏋️', '🎸'];

  return (
    <BottomSheet title="More" onClose={onClose}>
      <div className="p-4 flex flex-col gap-2">
        {/* Custom tabs */}
        {customTabs.length > 0 && (
          <>
            <p className="text-xs font-medium px-1 mb-1" style={{ color: 'var(--color-text-muted)' }}>
              Custom Tabs
            </p>
            {customTabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                onClick={() => handleNavigate(`/tab?t=${tab.id}`)}
                className="surface-card flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-[transform,opacity] duration-150 active:scale-[0.99] active:opacity-90"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
              >
                <span className="text-xl leading-none">{tab.icon}</span>
                <span className="truncate text-sm font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
                  {tab.name}
                </span>
              </button>
            ))}
          </>
        )}

        {/* Add new tab */}
        {showAddTab ? (
          <div
            className="rounded-2xl p-4 flex flex-col gap-3 animate-scale-in"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
          >
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              New Tab
            </p>
            {/* Icon picker */}
            <div className="flex gap-2 flex-wrap">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  onClick={() => setNewTabIcon(ic)}
                  className="text-xl p-1.5 rounded-lg"
                  style={{
                    background: newTabIcon === ic ? 'var(--color-accent-bg)' : 'transparent',
                    border: `1px solid ${newTabIcon === ic ? 'var(--color-accent)' : 'transparent'}`,
                  }}
                >
                  {ic}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <span className="text-xl">{newTabIcon}</span>
              <input
                type="text"
                value={newTabName}
                onChange={(e) => setNewTabName(e.target.value)}
                placeholder="Tab name (e.g. Business)"
                className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTab()}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddTab(false)}
                className="flex-1 py-2 rounded-xl text-sm"
                style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddTab}
                disabled={adding || !newTabName.trim()}
                className="flex-1 py-2 rounded-xl text-sm font-semibold"
                style={{
                  background: newTabName.trim() ? 'var(--color-accent)' : 'var(--color-text-dim)',
                  color: '#fff',
                }}
              >
                {adding ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddTab(true)}
            className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-opacity duration-150 active:opacity-90"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px dashed var(--color-border-2)',
              color: 'var(--color-accent)',
            }}
          >
            <Plus size={18} strokeWidth={2} />
            <span className="text-sm font-semibold">New custom tab</span>
          </button>
        )}

        {/* Divider */}
        <div className="h-px my-1" style={{ background: 'var(--color-border)' }} />

        {/* Navigation items */}
        {[
          { icon: <Archive size={18} />, label: 'Archives', href: '/archive' },
          { icon: <Settings size={18} />, label: 'Settings', href: '/settings' },
        ].map((item) => (
          <button
            type="button"
            key={item.label}
            onClick={() => handleNavigate(item.href)}
            className="flex min-h-12 items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors duration-150 active:bg-[var(--color-surface-2)]"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {item.icon}
            <span className="text-sm font-semibold">{item.label}</span>
          </button>
        ))}

        {/* Sign out */}
        <button
          type="button"
          onClick={() => {
            signOut();
            onClose();
          }}
          className="flex min-h-12 items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors duration-150 active:bg-[var(--color-surface-2)]"
          style={{ color: 'var(--color-expense)' }}
        >
          <LogOut size={18} strokeWidth={2} />
          <span className="text-sm font-semibold">Sign out</span>
        </button>

        {user && (
          <p className="text-xs text-center py-2" style={{ color: 'var(--color-text-dim)' }}>
            {user.displayName || user.email}
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
