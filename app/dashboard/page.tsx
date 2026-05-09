'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { TrendingUp, TrendingDown, Wallet, PiggyBank, ArrowUpRight, ArrowDownRight, ArrowRightLeft } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useAuth();
  const { sections, transactions, loading } = useData();

  const totalBalance = sections.reduce((s, sec) => s + sec.balance, 0);
  const now = new Date();
  const thisMonthTx = transactions.filter(t => {
    const d = t.date instanceof Date ? t.date : new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthIncome = thisMonthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const monthExpense = thisMonthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const savings = monthIncome - monthExpense;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="skeleton h-64 rounded-xl lg:col-span-2" />
          <div className="skeleton h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  const stats = [
    { label: 'Total Balance', value: formatCurrency(totalBalance), icon: Wallet, color: '#6c5ce7', gradient: 'var(--gradient-primary)' },
    { label: 'Monthly Income', value: formatCurrency(monthIncome), icon: TrendingUp, color: '#00b894', gradient: 'var(--gradient-income)' },
    { label: 'Monthly Expenses', value: formatCurrency(monthExpense), icon: TrendingDown, color: '#e17055', gradient: 'var(--gradient-expense)' },
    { label: 'Net Savings', value: formatCurrency(savings), icon: PiggyBank, color: '#00cec9', gradient: 'var(--gradient-transfer)' },
  ];

  const txIcon = (type: string) => {
    if (type === 'income') return <ArrowUpRight size={16} style={{ color: 'var(--accent-success)' }} />;
    if (type === 'expense') return <ArrowDownRight size={16} style={{ color: 'var(--accent-danger)' }} />;
    return <ArrowRightLeft size={16} style={{ color: '#74b9ff' }} />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Good {now.getHours() < 12 ? 'Morning' : now.getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.displayName?.split(' ')[0] || 'there'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Link href="/dashboard/transactions" className="btn-primary text-sm px-4 py-2 no-underline" id="add-tx-btn">
          + Add Transaction
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={s.label} className="stat-card animate-fade-in-up" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{s.label}</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${s.color}20` }}>
                <s.icon size={16} style={{ color: s.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Section Balances */}
        <div className="lg:col-span-2 stat-card animate-fade-in-up delay-400">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Section Balances</h2>
            <Link href="/dashboard/sections" className="text-xs font-medium hover:underline" style={{ color: 'var(--accent-primary)' }} id="view-sections">View All</Link>
          </div>
          {sections.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>No sections yet. They will be created automatically.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sections.map(sec => (
                <div key={sec.id} className="flex items-center gap-3 p-3 rounded-xl transition-colors" style={{ background: 'var(--bg-surface-hover)' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm" style={{ background: `${sec.color}20`, color: sec.color }}>
                    {sec.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{sec.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{sec.type}</p>
                  </div>
                  <p className="text-sm font-semibold" style={{ color: sec.balance >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                    {formatCurrency(sec.balance)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="stat-card animate-fade-in-up delay-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Transactions</h2>
            <Link href="/dashboard/transactions" className="text-xs font-medium hover:underline" style={{ color: 'var(--accent-primary)' }} id="view-transactions">View All</Link>
          </div>
          {transactions.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>No transactions yet.</p>
          ) : (
            <div className="space-y-2">
              {transactions.slice(0, 8).map(tx => (
                <div key={tx.id} className="flex items-center gap-3 py-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-surface-hover)' }}>
                    {txIcon(tx.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {tx.category || tx.note || tx.type}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {formatDate(tx.date instanceof Date ? tx.date : new Date(tx.date))}
                    </p>
                  </div>
                  <p className="text-sm font-semibold" style={{ color: tx.type === 'income' ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
