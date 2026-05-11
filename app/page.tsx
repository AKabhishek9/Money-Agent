'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Loader from '@/components/ui/Loader';

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

  return <Loader fullScreen label="Loading Money Ledger..." />;
}
