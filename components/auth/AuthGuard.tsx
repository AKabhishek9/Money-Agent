'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Loader from '@/components/ui/Loader';
import { useStore } from '@/store/useStore';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const storeUserId = useStore((s) => s.userId);

  useEffect(() => {
    if (!loading && !user && !storeUserId) router.replace('/login');
  }, [user, loading, router, storeUserId]);

  if (loading && !storeUserId) {
    return <Loader fullScreen label="Loading Money Ledger..." />;
  }

  if (!user && !storeUserId) return null;

  return <>{children}</>;
}
