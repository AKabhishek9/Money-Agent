'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import AuthGuard from '@/components/auth/AuthGuard';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import PersonCard from '@/components/people/PersonCard';
import PersonLedger from '@/components/people/PersonLedger';
import BottomSheet from '@/components/ui/BottomSheet';
import Confirm from '@/components/ui/Confirm';
import Loader from '@/components/ui/Loader';
import { useAuth } from '@/contexts/AuthContext';
import { localGetPersonEntries } from '@/lib/entries';
import { formatAmount, calcTotal } from '@/lib/parser';
import { useStore } from '@/store/useStore';
import type { Person } from '@/lib/types';

export default function PeoplePage() {
  return (
    <AuthGuard>
      <AppLayout>
        <PeopleContent />
      </AppLayout>
    </AuthGuard>
  );
}

function PeopleContent() {
  const { user } = useAuth();
  const {
    addPerson: addPersonStore,
    deletePerson: deletePersonStore,
    loadPersons,
    persons: cachedPersons,
    updatePerson: updatePersonStore,
  } = useStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const personId = searchParams.get('p');

  const [persons, setPersons] = useState<Person[]>(cachedPersons);
  const [balances, setBalances] = useState<Record<string, { balance: number; count: number }>>({});
  const [loading, setLoading] = useState(cachedPersons.length === 0);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState<Person | null>(null);
  const [newName, setNewName] = useState('');
  const [newNote, setNewNote] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null);

  const selectedPerson = persons.find((p) => p.id === personId) || null;

  useEffect(() => {
    if (cachedPersons.length === 0) return;
    setPersons(cachedPersons);
    setLoading(false);
  }, [cachedPersons]);

  const load = useCallback(async () => {
    if (!user) return;
    const storePersons = useStore.getState().persons;
    if (storePersons.length > 0) {
      setPersons(storePersons);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const pList = await loadPersons(user.uid);
      setPersons(pList);
      const bal: Record<string, { balance: number; count: number }> = {};
      await Promise.all(
        pList.map(async (p) => {
          const entries = await localGetPersonEntries(p.id);
          bal[p.id] = {
            balance: calcTotal(entries.map((e) => e.amount)),
            count: entries.length,
          };
        })
      );
      setBalances(bal);
    } finally {
      setLoading(false);
    }
  }, [user, loadPersons]);

  useEffect(() => { load(); }, [load]);

  const handleAddPerson = async () => {
    if (!user || !newName.trim()) return;
    await addPersonStore(user.uid, newName.trim(), newNote.trim());
    setNewName('');
    setNewNote('');
    setShowAddSheet(false);
    load();
  };

  const handleDeletePerson = async (p: Person) => {
    await deletePersonStore(p.id);
    setDeleteTarget(null);
    if (personId === p.id) router.replace('/people');
    load();
  };

  const handleEditSave = async (p: Person) => {
    await updatePersonStore(p.id, { name: newName.trim(), note: newNote.trim() });
    setShowEditSheet(null);
    load();
  };

  const combinedBalance = Object.values(balances).reduce((s, b) => s + b.balance, 0);

  // ── Person ledger view ──
  if (selectedPerson) {
    return (
      <div className="flex flex-col h-[100dvh] overflow-hidden">
        <Header
          title={selectedPerson.name}
          subtitle="Personal Ledger"
          showBack
          onBack={() => router.replace('/people')}
        />
        <div className="flex-1 overflow-hidden flex flex-col">
          <PersonLedger person={selectedPerson} userId={user!.uid} />
        </div>
      </div>
    );
  }

  // ── People list ──
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="People"
        subtitle="Person-based ledgers"
        rightAction={
          <button
            onClick={() => { setNewName(''); setNewNote(''); setShowAddSheet(true); }}
            className="p-2 rounded-xl"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-accent)' }}
          >
            <Plus size={20} />
          </button>
        }
      />

      {/* Combined total banner */}
      {persons.length > 0 && (
        <div
          className="surface-card mx-4 mb-3 mt-4 flex items-center justify-between gap-3 rounded-2xl p-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <div className="min-w-0">
            <p className="text-balance-label mb-1">Combined net</p>
            <p
              className="amount-mono text-xl font-bold leading-none tracking-tight"
              style={{
                color:
                  combinedBalance > 0
                    ? 'var(--color-income)'
                    : combinedBalance < 0
                      ? 'var(--color-expense)'
                      : 'var(--color-text)',
              }}
            >
              {formatAmount(combinedBalance)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              {persons.length} {persons.length === 1 ? 'person' : 'people'}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <Loader label="Loading people..." />
      ) : persons.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="text-5xl mb-4">👥</div>
          <p className="font-semibold text-base mb-1" style={{ color: 'var(--color-text)' }}>
            No people yet
          </p>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Tap + to add a person and track money exchanges
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pt-2 pb-24">
          {persons.map((p) => (
            <PersonCard
              key={p.id}
              person={p}
              balance={balances[p.id]?.balance ?? 0}
              entryCount={balances[p.id]?.count ?? 0}
              onClick={() => router.push(`/people?p=${p.id}`)}
              onDelete={() => setDeleteTarget(p)}
              onEdit={() => {
                setNewName(p.name);
                setNewNote(p.note || '');
                setShowEditSheet(p);
              }}
            />
          ))}
        </div>
      )}

      {/* Add person sheet */}
      {showAddSheet && (
        <BottomSheet title="Add Person" onClose={() => setShowAddSheet(false)}>
          <div className="p-4 flex flex-col gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name (e.g. Rahul)"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAddPerson()}
            />
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Note (optional)"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
            />
            <button
              onClick={handleAddPerson}
              disabled={!newName.trim()}
              className="w-full py-3 rounded-xl text-sm font-semibold"
              style={{
                background: newName.trim() ? 'var(--color-accent)' : 'var(--color-text-dim)',
                color: '#fff',
              }}
            >
              Add Person
            </button>
          </div>
        </BottomSheet>
      )}

      {/* Edit person sheet */}
      {showEditSheet && (
        <BottomSheet title="Edit Person" onClose={() => setShowEditSheet(null)}>
          <div className="p-4 flex flex-col gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
              autoFocus
            />
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Note (optional)"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowEditSheet(null)}
                className="flex-1 py-3 rounded-xl text-sm"
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleEditSave(showEditSheet)}
                disabled={!newName.trim()}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{
                  background: newName.trim() ? 'var(--color-accent)' : 'var(--color-text-dim)',
                  color: '#fff',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <Confirm
          title={`Delete ${deleteTarget.name}?`}
          message="All ledger entries for this person will be permanently deleted."
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDeletePerson(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
