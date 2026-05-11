'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search } from 'lucide-react';
import AuthGuard from '@/components/auth/AuthGuard';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import Loader from '@/components/ui/Loader';
import { VaultCard } from '@/components/vault/VaultCard';
import VaultForm from '@/components/vault/VaultForm';
import Confirm from '@/components/ui/Confirm';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/lib/db';
import { queueSync } from '@/lib/sync';
import type { VaultItem, VaultType } from '@/lib/types';
import { v4 as uuid } from 'uuid';

export default function VaultPage() {
  return (
    <AuthGuard>
      <AppLayout>
        <VaultContent />
      </AppLayout>
    </AuthGuard>
  );
}

function VaultContent() {
  const { user } = useAuth();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VaultItem | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const db = getDb();
      const data = await db.vault.where('userId').equals(user.uid).sortBy('createdAt');
      setItems(data.reverse());
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (type: VaultType, title: string, fields: Record<string, string>) => {
    if (!user) return;
    const db = getDb();
    const now = new Date();
    const item: VaultItem = {
      id: uuid(),
      userId: user.uid,
      type,
      title,
      fields,
      createdAt: now,
      updatedAt: now,
    };
    await db.vault.add(item);
    await queueSync('vault', 'upsert', item.id, item as unknown as Record<string, unknown>);
    load();
  };

  const handleDelete = async (item: VaultItem) => {
    const db = getDb();
    await db.vault.delete(item.id);
    await queueSync('vault', 'delete', item.id);
    setDeleteTarget(null);
    load();
  };

  const filtered = search.trim()
    ? items.filter(
        (i) =>
          i.title.toLowerCase().includes(search.toLowerCase()) ||
          i.type.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  return (
    <div>
      <Header
        title="Vault"
        subtitle="Secure information storage"
        rightAction={
          <button
            onClick={() => setShowForm(true)}
            className="p-2 rounded-xl"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-accent)' }}
          >
            <Plus size={20} />
          </button>
        }
      />

      {/* Security notice */}
      <div
        className="mx-4 mt-4 mb-3 p-3 rounded-xl flex items-center gap-2"
        style={{ background: 'var(--color-gold-bg)', border: '1px solid var(--color-gold)' }}
      >
        <span>🔒</span>
        <p className="text-xs" style={{ color: 'var(--color-gold)' }}>
          Vault items are stored in your private account. Tap to expand and reveal.
        </p>
      </div>

      {/* Search bar */}
      {items.length > 3 && (
        <div className="px-4 mb-3">
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <Search size={15} style={{ color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vault…"
              className="flex-1 text-sm outline-none bg-transparent"
              style={{ color: 'var(--color-text)' }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <Loader label="Loading vault..." />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="text-5xl mb-4">🔐</div>
          <p className="font-semibold text-base mb-1" style={{ color: 'var(--color-text)' }}>
            {search ? 'No matches' : 'Vault is empty'}
          </p>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {search ? 'Try a different search' : 'Store bank details, cards, and secure notes'}
          </p>
        </div>
      ) : (
        <div className="pt-2">
          {filtered.map((item) => (
            <VaultCard
              key={item.id}
              item={item}
              onDelete={() => setDeleteTarget(item)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <VaultForm
          onSave={handleAdd}
          onClose={() => setShowForm(false)}
        />
      )}

      {deleteTarget && (
        <Confirm
          title="Delete vault item?"
          message={`"${deleteTarget.title}" will be permanently deleted.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
