'use client';

import { useState, useEffect } from 'react';
import BottomNav from './BottomNav';
import MoreDrawer from '../tabs/MoreDrawer';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [showMore, setShowMore] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof window !== 'undefined' ? navigator.onLine : true
  );

  // Listen for keyboard-toggle to remove bottom padding when keyboard is open
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setKeyboardOpen(detail?.open ?? false);
    };
    window.addEventListener('keyboard-toggle', handler);
    return () => window.removeEventListener('keyboard-toggle', handler);
  }, []);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      {!isOnline && (
        <div
          className="text-center text-[10px] py-1 font-medium px-4 leading-tight"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}
        >
          You are offline. Entries will be saved locally and synced when you reconnect.
        </div>
      )}
      <main
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
        style={{ paddingBottom: keyboardOpen ? 0 : 'var(--app-bottom-nav-pad)' }}
      >
        {children}
      </main>
      <BottomNav onMoreClick={() => setShowMore(true)} />
      {showMore && <MoreDrawer onClose={() => setShowMore(false)} />}
    </div>
  );
}
