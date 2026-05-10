'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import ConfirmModal from '@/components/ConfirmModal';
import { addPerson, deletePerson } from '@/lib/firestore';
import { formatCurrency } from '@/lib/utils';
import type { PersonType } from '@/lib/types';
import { Plus, X, Trash2, UserCircle } from 'lucide-react';

export default function PersonsPage() {
  const { user } = useAuth();
  const { persons, loading, error, isError, refresh } = useData();

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<PersonType>('loan');
  const [personNote, setPersonNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await addPerson(user.uid, { name, type, note: personNote });
      refresh();
      setShowModal(false); 
      setName(''); 
      setPersonNote('');
    } catch (e: any) { 
      console.error(e);
      setFormError(e.message || 'Failed to add person');
    } finally { 
      setSubmitting(false); 
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deletePerson(confirmDelete);
      refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setConfirmDelete(null);
    }
  };

  if (loading) return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}</div>;




  const personsList = persons || [];

  return (
    <>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>People</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Manage financial relationships</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary text-sm flex items-center gap-2" id="add-person-btn">
          <Plus size={16} /> Add Person
        </button>
      </div>

      {isError && (
        <div className="p-4 rounded-xl flex items-center justify-between gap-4 animate-fade-in" 
          style={{ background: 'rgba(255, 107, 107, 0.1)', border: '1px solid rgba(255, 107, 107, 0.2)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--accent-danger)' }}>
              <UserCircle size={20} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Sync Error</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Could not fetch latest data. Please check your connection or ad-blocker.</p>
            </div>
          </div>
          <button onClick={refresh} className="btn-secondary text-xs px-4 py-2">Retry</button>
        </div>
      )}

      {personsList.length === 0 ? (
        <div className="text-center py-16 stat-card">
          <UserCircle size={48} className="mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-lg mb-2" style={{ color: 'var(--text-tertiary)' }}>No people added yet</p>
          <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>Add people to track loans and shared finances</p>
          <button onClick={() => setShowModal(true)} className="btn-primary text-sm">Add First Person</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {personsList.map((p, i) => (
            <div key={p.id} className="stat-card group animate-fade-in-up" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                  style={{ background: 'var(--gradient-primary)', color: '#fff' }}>
                  {p.name[0].toUpperCase()}
                </div>
                <button onClick={() => setConfirmDelete(p.id)} className="opacity-0 group-hover:opacity-100 transition-opacity btn-ghost p-1" style={{ color: 'var(--accent-danger)' }}>
                  <Trash2 size={16} />
                </button>
              </div>
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{p.name}</h3>
              {p.note && <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{p.note}</p>}
              <div className="flex items-center justify-between mt-3">
                <span className={`badge ${p.type === 'self' ? 'badge-income' : p.type === 'managed' ? 'badge-transfer' : 'badge-loan'}`}>{p.type}</span>
                <p className="text-lg font-bold" style={{ color: p.balance > 0 ? 'var(--accent-success)' : p.balance < 0 ? 'var(--accent-danger)' : 'var(--text-secondary)' }}>
                  {p.balance > 0 ? 'Owes you ' : p.balance < 0 ? 'You owe ' : ''}{formatCurrency(Math.abs(p.balance))}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Add Person</h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1"><X size={20} /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Person's name" className="input-field" required id="person-name" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Type</label>
                <div className="flex gap-2">
                  {(['self', 'managed', 'loan'] as PersonType[]).map(t => (
                    <button key={t} type="button" onClick={() => setType(t)} className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize ${type === t ? 'text-white' : ''}`}
                      style={type === t ? { background: 'var(--accent-primary)' } : { background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Note (optional)</label>
                <input value={personNote} onChange={e => setPersonNote(e.target.value)} placeholder="Relationship, context..." className="input-field" id="person-note" />
              </div>

              {formError && (
                <div className="p-3 rounded-lg text-xs font-medium" style={{ background: 'var(--accent-danger)20', color: 'var(--accent-danger)' }}>
                  {formError}
                </div>
              )}

              <button type="submit" disabled={submitting} className="btn-primary w-full py-3" id="person-submit">
                {submitting ? 'Adding...' : 'Add Person'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>

      <ConfirmModal
        open={!!confirmDelete}
        title="Delete Person"
        message="This will permanently delete this person and all their loan transactions."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>  
  );
}
