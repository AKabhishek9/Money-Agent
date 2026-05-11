'use client';

import { useState } from 'react';
import BottomNav from './BottomNav';
import MoreDrawer from '../tabs/MoreDrawer';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [showMore, setShowMore] = useState(false);

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {children}
      </main>
      <BottomNav onMoreClick={() => setShowMore(true)} />
      {showMore && <MoreDrawer onClose={() => setShowMore(false)} />}
    </div>
  );
}
