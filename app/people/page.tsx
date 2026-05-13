'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
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
import type { Person, PersonEntry } from '@/lib/types';

export default function PeoplePage() {
  return (
    <AuthGuard>
      <AppLayout>
        <Suspense fallback={<Loader label="Loading..." />}>
          <PeopleContent />
        </Suspense>
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
  const [balances, setBalances] = useState<Record<string, { balance: number; count: number; recentEntries: PersonEntry[] }>>({});
  const [loading, setLoading] = useState(cachedPersons.length === 0);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState<Person | null>(null);
  const [newName, setNewName] = useState('');
  const [newNote, setNewNote] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null);

  const selectedPerson = persons.find((p) => p.id === personId) || null;
  const prevPersonIdRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevPersonIdRef.current;
    prevPersonIdRef.current = personId;

    if (prev !== null && personId === null && persons.length > 0) {
      // User navigated back — refresh balances for all persons
      persons.forEach(async (p) => {
        const entries = await localGetPersonEntries(p.id);
        setBalances((prevBalances) => ({
          ...prevBalances,
          [p.id]: {
            balance: calcTotal(entries.map((e) => e.amount)),
            count: entries.length,
            recentEntries: entries.slice(-5),
          },
        }));
      });
    }
  }, [personId, persons]);

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
      const bal: Record<string, { balance: number; count: number; recentEntries: PersonEntry[] }> = {};
      await Promise.all(
        pList.map(async (p) => {
          const entries = await localGetPersonEntries(p.id);
          bal[p.id] = {
            balance: calcTotal(entries.map((e) => e.amount)),
            count: entries.length,
            recentEntries: entries.slice(-5),
          };
        })
      );
      setBalances(bal);
    } finally {
      setLoading(false);
    }
  }, [user, loadPersons]);

  useEffect(() => { load(); }, [load]);


  useEffect(() => {
    const handleRemoteSync = (event: Event) => {
      const collection = (event as CustomEvent<{ collection?: string }>).detail?.collection;

      if (collection === 'persons') {
        load();
        return;
      }

      if (collection === 'personEntries') {
        const currentPersons = useStore.getState().persons;
        Promise.all(
          currentPersons.map(async (person) => {
            const entries = await localGetPersonEntries(person.id);
            setBalances((prevBalances) => ({
              ...prevBalances,
              [person.id]: {
                balance: calcTotal(entries.map((entry) => entry.amount)),
                count: entries.length,
                recentEntries: entries.slice(-5),
              },
            }));
          })
        ).catch(() => undefined);
      }
    };

    window.addEventListener('money-ledger-remote-sync', handleRemoteSync);
    return () => window.removeEventListener('money-ledger-remote-sync', handleRemoteSync);
  }, [load]);
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
    if (personId === p.id) router.push('/people');
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
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Header
          title={selectedPerson.name}
          subtitle="Personal Ledger"
          showBack
          onBack={() => router.push('/people')}
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
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
          >
            <Plus size={20} />
          </button>
        }
      />

      {/* Combined total banner */}
      {persons.length > 0 && (
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
              <p className="text-balance-label mb-1">Combined Net</p>
              <p
                className="amount-mono text-[1.5rem] font-bold leading-none tracking-tight"
                style={{
                  color: combinedBalance === 0 ? 'var(--color-text-muted)' : combinedBalance > 0 ? 'var(--color-income)' : 'var(--color-expense)',
                }}
              >
                {combinedBalance === 0 ? '₹0' : formatAmount(combinedBalance)}
              </p>
            </div>
            <div className="h-10 w-10 flex items-center justify-center rounded-full bg-black/20" style={{ color: 'var(--color-text-muted)' }}>
              <span className="text-xl">👥</span>
            </div>
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
        <div className="flex-1 overflow-y-auto pt-3 pb-24 px-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {persons.map((p) => (
              <div key={p.id}>
                <PersonCard
                  person={p}
                  balance={balances[p.id]?.balance ?? 0}
                  entryCount={balances[p.id]?.count ?? 0}
                  recentEntries={balances[p.id]?.recentEntries ?? []}
                  onClick={() => router.push(`/people?p=${p.id}`)}
                  onDelete={() => setDeleteTarget(p)}
                  onEdit={() => {
                    setNewName(p.name);
                    setNewNote(p.note || '');
                    setShowEditSheet(p);
                  }}
                />
              </div>
            ))}
          </div>
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
                color: 'var(--color-on-accent)',
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
                  color: 'var(--color-on-accent)',
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
