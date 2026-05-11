'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Root() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace('/personal');
    } else {
      router.replace('/login');
    }
  }, [user, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="text-3xl">💰</div>
        <div className="text-sm loading-pulse" style={{ color: 'var(--color-text-muted)' }}>
          Loading Money Ledger…
        </div>
      </div>
    </div>
  );
}
