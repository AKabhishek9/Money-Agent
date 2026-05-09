'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { addVaultItem, deleteVaultItem } from '@/lib/firestore';
import { encryptField, decryptField } from '@/lib/encryption';
import type { VaultItem, VaultItemType } from '@/lib/types';
import { Plus, X, Trash2, Shield, CreditCard, FileText, Eye, EyeOff, Lock } from 'lucide-react';

export default function VaultPage() {
  const { user } = useAuth();
  const { vault: items, loading, refresh } = useData();

  const [showModal, setShowModal] = useState(false);
  const [vaultType, setVaultType] = useState<VaultItemType>('bank');
  const [title, setTitle] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [decryptedItems, setDecryptedItems] = useState<VaultItem[]>([]);

  const typeFields: Record<VaultItemType, string[]> = {
    bank: ['Bank Name', 'Account Number', 'IFSC Code', 'Account Holder'],
    card: ['Card Number', 'Expiry Date', 'CVV', 'Card Holder'],
    note: ['Content'],
  };

  // Sensitive fields that should be encrypted
  const sensitiveFields = ['Account Number', 'Card Number', 'CVV', 'IFSC Code', 'Content'];

  // Decrypt items when they load
  useEffect(() => {
    if (!user || !items?.length) {
      setDecryptedItems([]);
      return;
    }
    const decrypt = async () => {
      const result = await Promise.all(
        items.map(async (item) => {
          const decryptedData: Record<string, string> = {};
          for (const [key, val] of Object.entries(item.data || {})) {
            const stringVal = String(val);
            if (sensitiveFields.includes(key) && stringVal) {
              decryptedData[key] = await decryptField(stringVal, user.uid);
            } else {
              decryptedData[key] = stringVal;
            }
          }
          return { ...item, data: decryptedData };
        })
      );
      setDecryptedItems(result);
    };
    decrypt();
  }, [items, user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title) return;
    setSubmitting(true);
    try {
      // Encrypt sensitive fields before saving
      const encryptedData: Record<string, string> = {};
      for (const [key, val] of Object.entries(fields)) {
        if (sensitiveFields.includes(key) && val) {
          encryptedData[key] = await encryptField(val, user.uid);
        } else {
          encryptedData[key] = val;
        }
      }
      await addVaultItem(user.uid, { type: vaultType, title, data: encryptedData });
      refresh();
      setShowModal(false); 
      setTitle(''); 
      setFields({});
    } catch (e) { 
      console.error(e); 
    } finally { 
      setSubmitting(false); 
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this vault item?')) return;
    try {
      await deleteVaultItem(id);
      refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleReveal = (id: string) => setRevealed(r => ({ ...r, [id]: !r[id] }));

  const typeIcon = (type: string) => {
    if (type === 'bank') return <Shield size={20} style={{ color: '#6c5ce7' }} />;
    if (type === 'card') return <CreditCard size={20} style={{ color: '#00cec9' }} />;
    return <FileText size={20} style={{ color: '#fdcb6e' }} />;
  };

  const mask = (val: string) => val.replace(/./g, '•');

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}</div>;

  const itemsList = decryptedItems || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Lock size={22} style={{ color: 'var(--accent-primary)' }} /> Secure Vault
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Store sensitive financial information securely</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary text-sm flex items-center gap-2" id="add-vault-btn">
          <Plus size={16} /> Add Item
        </button>
      </div>

      {itemsList.length === 0 ? (
        <div className="text-center py-16 stat-card">
          <Shield size={48} className="mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-lg mb-2" style={{ color: 'var(--text-tertiary)' }}>Your vault is empty</p>
          <button onClick={() => setShowModal(true)} className="btn-primary text-sm">Add First Item</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {itemsList.map((item, i) => (
            <div key={item.id} className="stat-card group animate-fade-in-up" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-surface-hover)' }}>
                    {typeIcon(item.type)}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.title}</h3>
                    <span className="badge badge-transfer text-xs">{item.type}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => toggleReveal(item.id)} className="btn-ghost p-1" title="Toggle visibility">
                    {revealed[item.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="opacity-0 group-hover:opacity-100 btn-ghost p-1" style={{ color: 'var(--accent-danger)' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 mt-3">
                {Object.entries(item.data || {}).map(([key, val]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span style={{ color: 'var(--text-tertiary)' }}>{key}</span>
                    <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {revealed[item.id] ? val : mask(val as string)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Add Vault Item</h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1"><X size={20} /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Type</label>
                <div className="flex gap-2">
                  {(['bank', 'card', 'note'] as VaultItemType[]).map(t => (
                    <button key={t} type="button" onClick={() => { setVaultType(t); setFields({}); }} className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize ${vaultType === t ? 'text-white' : ''}`}
                      style={vaultType === t ? { background: 'var(--accent-primary)' } : { background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. SBI Savings" className="input-field" required id="vault-title" />
              </div>
              {typeFields[vaultType].map(f => (
                <div key={f}>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{f}</label>
                  <input value={fields[f] || ''} onChange={e => setFields(p => ({ ...p, [f]: e.target.value }))} className="input-field" placeholder={f} id={`vault-${f.toLowerCase().replace(/\s/g, '-')}`} />
                </div>
              ))}
              <button type="submit" disabled={submitting} className="btn-primary w-full py-3" id="vault-submit">
                {submitting ? 'Saving...' : 'Save to Vault'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
