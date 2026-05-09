'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { addTransaction, deleteTransaction } from '@/lib/firestore';
import { formatCurrency, formatDate, formatDateInput } from '@/lib/utils';
import type { Section, Person, Transaction, TransactionType } from '@/lib/types';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/types';
import { Plus, X, ArrowUpRight, ArrowDownRight, ArrowRightLeft, Search, Filter, Trash2 } from 'lucide-react';

export default function TransactionsPage() {
  const { user } = useAuth();
  const { transactions, sections, persons, loading, refresh } = useData();
  
  const [showModal, setShowModal] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [toSectionId, setToSectionId] = useState('');
  const [personId, setPersonId] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(formatDateInput(new Date()));
  const [loanDir, setLoanDir] = useState<'given' | 'received'>('given');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount || !sectionId) return;
    setSubmitting(true);
    try {
      await addTransaction(user.uid, {
        sectionId, type: txType, amount: parseFloat(amount), category, note,
        date: new Date(date),
        ...(txType === 'transfer' ? { toSectionId } : {}),
        ...(txType === 'loan' ? { personId, loanDirection: loanDir } : {}),
      });
      refresh(); // Refresh central cache
      setSubmitting(false);
      setShowModal(false); 
      setAmount(''); setNote(''); setCategory('');
    } catch (err) { 
      console.error(err); 
      setSubmitting(false);
    }
  };

  const filtered = transactions.filter(tx => {
    if (filterType !== 'all' && tx.type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (tx.category?.toLowerCase().includes(q) || tx.note?.toLowerCase().includes(q) || tx.type.includes(q));
    }
    return true;
  });

  const txIcon = (type: string) => {
    if (type === 'income') return <ArrowUpRight size={16} style={{ color: 'var(--accent-success)' }} />;
    if (type === 'expense') return <ArrowDownRight size={16} style={{ color: 'var(--accent-danger)' }} />;
    return <ArrowRightLeft size={16} style={{ color: '#74b9ff' }} />;
  };

  const exportToCSV = () => {
    if (filtered.length === 0) return;
    const headers = ['Date', 'Type', 'Amount', 'Section', 'Category', 'Note'];
    const csvContent = [
      headers.join(','),
      ...filtered.map(tx => {
        const sec = sections.find(s => s.id === tx.sectionId)?.name || 'Unknown';
        const d = formatDateInput(tx.date instanceof Date ? tx.date : new Date(tx.date));
        return `${d},${tx.type},${tx.amount},"${sec}","${tx.category || ''}","${tx.note || ''}"`;
      })
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `money_agent_transactions_${formatDateInput(new Date())}.csv`;
    link.click();
  };

  const categories = txType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  if (loading) return <div className="space-y-4">{[1,2,3,4,5].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Transactions</h1>
        <div className="flex items-center gap-2">
          <button onClick={exportToCSV} className="btn-secondary text-sm flex items-center gap-2" id="export-csv-btn">
            Export CSV
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary text-sm flex items-center gap-2" id="new-tx-btn">
            <Plus size={16} /> New Transaction
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search transactions..." className="input-field pl-10 text-sm" id="tx-search" />
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-surface)' }}>
          {['all', 'income', 'expense', 'transfer', 'loan'].map(t => (
            <button key={t} onClick={() => setFilterType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${filterType === t ? 'text-white' : ''}`}
              style={filterType === t ? { background: 'var(--accent-primary)' } : { color: 'var(--text-secondary)' }} id={`filter-${t}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 stat-card">
            <p className="text-lg mb-2" style={{ color: 'var(--text-tertiary)' }}>No transactions found</p>
            <button onClick={() => setShowModal(true)} className="btn-primary text-sm">Add your first transaction</button>
          </div>
        ) : filtered.map(tx => {
          const sec = sections.find(s => s.id === tx.sectionId);
          return (
            <div key={tx.id} className="flex items-center gap-4 p-4 rounded-xl transition-colors hover:border-[var(--border-default)] group"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-surface-hover)' }}>
                {txIcon(tx.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{tx.category || tx.note || tx.type}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  {sec?.name || 'Unknown'} · {formatDate(tx.date instanceof Date ? tx.date : new Date(tx.date))}
                </p>
              </div>
              <span className={`badge badge-${tx.type} text-xs`}>{tx.type}</span>
              <p className="text-sm font-bold min-w-[80px] text-right" style={{ color: tx.type === 'income' ? 'var(--accent-success)' : tx.type === 'expense' ? 'var(--accent-danger)' : 'var(--text-primary)' }}>
                {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}{formatCurrency(tx.amount)}
              </p>
              <button
                onClick={async () => {
                  if (!confirm('Delete this transaction? This will reverse the balance changes.')) return;
                  try {
                    await deleteTransaction(tx.id);
                    refresh();
                  } catch (e) { console.error(e); }
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity btn-ghost p-1"
                style={{ color: 'var(--accent-danger)' }}
                title="Delete transaction"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add Transaction Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>New Transaction</h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1"><X size={20} /></button>
            </div>

            {/* Type Tabs */}
            <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: 'var(--bg-surface)' }}>
              {(['expense', 'income', 'transfer', 'loan'] as TransactionType[]).map(t => (
                <button key={t} onClick={() => setTxType(t)} className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize ${txType === t ? 'text-white' : ''}`}
                  style={txType === t ? { background: t === 'income' ? 'var(--accent-success)' : t === 'expense' ? 'var(--accent-danger)' : 'var(--accent-primary)' } : { color: 'var(--text-secondary)' }}>
                  {t}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Amount (₹)</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="input-field text-2xl font-bold" required min="0.01" step="0.01" id="tx-amount" />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  {txType === 'transfer' ? 'From Section' : 'Section'}
                </label>
                <select value={sectionId} onChange={e => setSectionId(e.target.value)} className="input-field" id="tx-section">
                  {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {txType === 'transfer' && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>To Section</label>
                  <select value={toSectionId} onChange={e => setToSectionId(e.target.value)} className="input-field" id="tx-to-section">
                    <option value="">Select destination</option>
                    {sections.filter(s => s.id !== sectionId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              {txType === 'loan' && (
                <>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Person</label>
                    <select value={personId} onChange={e => setPersonId(e.target.value)} className="input-field" id="tx-person">
                      <option value="">Select person</option>
                      {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    {(['given', 'received'] as const).map(d => (
                      <button key={d} type="button" onClick={() => setLoanDir(d)} className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize ${loanDir === d ? 'text-white' : ''}`}
                        style={loanDir === d ? { background: d === 'given' ? 'var(--accent-danger)' : 'var(--accent-success)' } : { background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                        {d}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {(txType === 'income' || txType === 'expense') && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Category</label>
                  <div className="grid grid-cols-5 gap-2">
                    {categories.map(c => (
                      <button key={c.name} type="button" onClick={() => setCategory(c.name)}
                        className="flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-all"
                        style={{ background: category === c.name ? `${c.color}20` : 'var(--bg-surface)', border: category === c.name ? `1px solid ${c.color}40` : '1px solid transparent', color: 'var(--text-secondary)' }}>
                        <span className="text-lg">{c.icon}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-field" id="tx-date" />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Note (optional)</label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note..." className="input-field" id="tx-note" />
              </div>

              <button type="submit" disabled={submitting} className="btn-primary w-full py-3" id="tx-submit">
                {submitting ? 'Adding...' : 'Add Transaction'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
