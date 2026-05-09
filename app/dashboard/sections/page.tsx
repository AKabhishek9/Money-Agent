'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { addSection, deleteSection } from '@/lib/firestore';
import { formatCurrency, getRandomColor } from '@/lib/utils';
import { Plus, X, Trash2, Wallet } from 'lucide-react';

export default function SectionsPage() {
  const { user } = useAuth();
  const { sections, loading, refresh } = useData();

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('wallet');
  const [color, setColor] = useState(getRandomColor());
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name) return;
    setSubmitting(true);
    try {
      await addSection(user.uid, { name, icon, color });
      refresh(); // Refresh central cache
      setShowModal(false); 
      setName(''); 
      setColor(getRandomColor());
    } catch (e) { 
      console.error(e); 
    } finally { 
      setSubmitting(false); 
    }
  };

  const handleDelete = async (id: string, type: string) => {
    if (type === 'default') return alert('Cannot delete default sections');
    if (!confirm('Delete this section?')) return;
    try {
      await deleteSection(id);
      refresh(); // Refresh central cache
    } catch (e) {
      console.error(e);
    }
  };

  const colors = ['#6c5ce7', '#00b894', '#0984e3', '#e17055', '#fd79a8', '#fdcb6e', '#00cec9', '#a29bfe', '#74b9ff', '#fab1a0'];

  if (loading) return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3,4].map(i => <div key={i} className="skeleton h-36 rounded-xl" />)}</div>;

  const sectionsList = sections || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Sections</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Organize your money into logical buckets</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary text-sm flex items-center gap-2" id="add-section-btn">
          <Plus size={16} /> New Section
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sectionsList.map((sec, i) => (
          <div key={sec.id} className="stat-card group animate-fade-in-up" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${sec.color}20` }}>
                <Wallet size={22} style={{ color: sec.color }} />
              </div>
              {sec.type === 'custom' && (
                <button onClick={() => handleDelete(sec.id, sec.type)} className="opacity-0 group-hover:opacity-100 transition-opacity btn-ghost p-1" style={{ color: 'var(--accent-danger)' }}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{sec.name}</h3>
            <p className="text-2xl font-bold" style={{ color: sec.balance >= 0 ? sec.color : 'var(--accent-danger)' }}>
              {formatCurrency(sec.balance)}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className={`badge ${sec.type === 'default' ? 'badge-transfer' : 'badge-income'}`}>{sec.type}</span>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>New Section</h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1"><X size={20} /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Section Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Travel Fund" className="input-field" required id="section-name" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Color</label>
                <div className="flex gap-2 flex-wrap">
                  {colors.map(c => (
                    <button key={c} type="button" onClick={() => setColor(c)} className="w-8 h-8 rounded-lg transition-transform"
                      style={{ background: c, transform: color === c ? 'scale(1.2)' : 'scale(1)', border: color === c ? '2px solid white' : 'none' }} />
                  ))}
                </div>
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full py-3" id="section-submit">
                {submitting ? 'Creating...' : 'Create Section'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
