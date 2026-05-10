'use client';

import { useMemo, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, PieChart as PieIcon, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';

// Lazy-load heavy chart components — only downloaded when user visits Analytics
const Bar = dynamic(() => import('react-chartjs-2').then(mod => {
  // Register Chart.js components when charts are loaded
  const { Chart, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler } = require('chart.js');
  Chart.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler);
  return { default: mod.Bar };
}), { ssr: false, loading: () => <div className="skeleton h-64 rounded-xl" /> });

const Pie = dynamic(() => import('react-chartjs-2').then(mod => ({ default: mod.Pie })), {
  ssr: false,
  loading: () => <div className="skeleton h-48 w-48 rounded-full" />,
});

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { transactions, sections, persons, loading, error, isError, refresh } = useData();

  if (loading) return <div className="space-y-6">{[1,2,3].map(i => <div key={i} className="skeleton h-64 rounded-xl" />)}</div>;




  // Memoize data processing to prevent memory pressure and redundant CPU work
  const processedData = useMemo(() => {
    if (!transactions.length) return null;

    // 1. Monthly Data (Last 6 months)
    const monthlyMap: Record<string, { income: number; expense: number }> = {};
    const months: string[] = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('default', { month: 'short' });
      months.push(label);
      monthlyMap[label] = { income: 0, expense: 0 };
    }

    transactions.forEach((tx: any) => {
      const date = tx.date instanceof Date ? tx.date : new Date(tx.date);
      const label = date.toLocaleString('default', { month: 'short' });
      if (monthlyMap[label]) {
        if (tx.type === 'income') monthlyMap[label].income += tx.amount;
        if (tx.type === 'expense') monthlyMap[label].expense += tx.amount;
      }
    });

    const monthlyData = months.map(m => ({
      month: m,
      income: monthlyMap[m].income,
      expense: monthlyMap[m].expense
    }));

    // 2. Category Data (All time)
    const catMap: Record<string, number> = {};
    transactions.forEach((tx: any) => {
      if (tx.type === 'expense' && tx.category) {
        catMap[tx.category] = (catMap[tx.category] || 0) + tx.amount;
      }
    });

    const catLabels = Object.keys(catMap);
    const catValues = Object.values(catMap);

    // 3. Person-wise Loans (Top 5)
    const personMap: Record<string, number> = {};
    transactions.forEach((tx: any) => {
      if (tx.type === 'loan' && tx.personId) {
        const p = persons.find(per => per.id === tx.personId);
        if (p) {
          personMap[p.name] = (personMap[p.name] || 0) + tx.amount;
        }
      }
    });

    const totalIncome = transactions.filter((t: any) => t.type === 'income').reduce((sum: number, t: any) => sum + t.amount, 0);
    const totalExpense = transactions.filter((t: any) => t.type === 'expense').reduce((sum: number, t: any) => sum + t.amount, 0);

    return {
      monthlyData,
      catLabels,
      catValues,
      catMap,
      personMap,
      totalIncome,
      totalExpense
    };
  }, [transactions, persons]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
      x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
    }
  }), []);

  const barData = useMemo(() => ({
    labels: processedData?.monthlyData.map(m => m.month) || [],
    datasets: [
      {
        label: 'Income',
        data: processedData?.monthlyData.map(m => m.income) || [],
        backgroundColor: '#00b894',
        borderRadius: 4,
      },
      {
        label: 'Expense',
        data: processedData?.monthlyData.map(m => m.expense) || [],
        backgroundColor: '#e17055',
        borderRadius: 4,
      }
    ]
  }), [processedData]);

  const pieData = useMemo(() => ({
    labels: processedData?.catLabels || [],
    datasets: [
      {
        data: processedData?.catValues || [],
        backgroundColor: ['#6c5ce7', '#00b894', '#e17055', '#fdcb6e', '#00cec9', '#fd79a8'],
        borderWidth: 0,
      }
    ]
  }), [processedData]);

  const pieOptions = useMemo(() => ({
    ...chartOptions,
    scales: undefined as any
  }), [chartOptions]);



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Financial Analytics</h1>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Total Savings</p>
            <p className="text-sm font-bold" style={{ color: 'var(--accent-success)' }}>
              {formatCurrency((processedData?.totalIncome || 0) - (processedData?.totalExpense || 0))}
            </p>
          </div>
        </div>
      </div>

      {isError && (
        <div className="p-4 rounded-xl flex items-center justify-between gap-4 animate-fade-in" 
          style={{ background: 'rgba(255, 107, 107, 0.1)', border: '1px solid rgba(255, 107, 107, 0.2)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--accent-danger)' }}>
              <TrendingUp size={20} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Sync Error</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Could not fetch latest data. Please check your connection or ad-blocker.</p>
            </div>
          </div>
          <button onClick={refresh} className="btn-secondary text-xs px-4 py-2">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <div className="stat-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp size={18} style={{ color: 'var(--accent-primary)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Monthly Comparison</h2>
          </div>
          <div className="h-64">
            <Bar data={barData} options={chartOptions} />
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="stat-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <PieIcon size={18} style={{ color: 'var(--accent-secondary)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Spending by Category</h2>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="w-48 h-48">
              <Pie data={pieData} options={pieOptions} />
            </div>
            <div className="flex-1 space-y-3 w-full">
              {[...(processedData?.catLabels || [])]
                .sort((a, b) => (processedData?.catMap[b] || 0) - (processedData?.catMap[a] || 0))
                .slice(0, 5)
                .map((cat, i) => {
                  const val = processedData?.catMap[cat] || 0;
                  const total = processedData?.totalExpense || 1;
                  const pct = Math.round((val / total) * 100);
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span style={{ color: 'var(--text-secondary)' }}>{cat}</span>
                        <span style={{ color: 'var(--text-primary)' }}>{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[var(--bg-surface-hover)] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ['#6c5ce7', '#00b894', '#e17055', '#fdcb6e', '#00cec9'][i % 5] }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="stat-card p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--accent-success)]/10">
              <ArrowUpRight size={20} style={{ color: 'var(--accent-success)' }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Highest Income</p>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {formatCurrency(Math.max(0, ...(processedData?.monthlyData.map(m => m.income) || [0])))}
              </p>
            </div>
          </div>
          <div className="stat-card p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--accent-danger)]/10">
              <ArrowDownRight size={20} style={{ color: 'var(--accent-danger)' }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Highest Expense</p>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {formatCurrency(Math.max(0, ...(processedData?.monthlyData.map(m => m.expense) || [0])))}
              </p>
            </div>
          </div>
          <div className="stat-card p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--accent-secondary)]/10">
              <BarChart3 size={20} style={{ color: 'var(--accent-secondary)' }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Total Transactions</p>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{transactions.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
