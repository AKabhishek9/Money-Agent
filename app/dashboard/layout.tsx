'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [collapsed, setCollapsedState] = useState(false);

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar-collapsed');
      if (saved !== null) setCollapsedState(JSON.parse(saved));
    } catch {}
  }, []);

  // Persist collapsed state to localStorage
  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    try {
      localStorage.setItem('sidebar-collapsed', JSON.stringify(value));
    } catch {}
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center animate-pulse"
            style={{ background: 'var(--gradient-primary)' }}
          >
            <span className="text-white text-xl">💰</span>
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading Money Agent...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <main 
        className={`flex-1 min-h-screen transition-all duration-300 ease-in-out`}
        style={{ marginLeft: collapsed ? '72px' : '280px' }}
      >
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-16 lg:pt-6">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
