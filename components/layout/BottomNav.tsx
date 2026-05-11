'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { BookOpen, Users, Shield, Search, MoreHorizontal } from 'lucide-react';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  href: string;
  match: string[];
}

const NAV_ITEMS: NavItem[] = [
  {
    icon: <BookOpen size={22} />,
    label: 'Personal',
    href: '/personal',
    match: ['/personal'],
  },
  {
    icon: <Users size={22} />,
    label: 'People',
    href: '/people',
    match: ['/people'],
  },
  {
    icon: <Shield size={22} />,
    label: 'Vault',
    href: '/vault',
    match: ['/vault'],
  },
  {
    icon: <Search size={22} />,
    label: 'Search',
    href: '/search',
    match: ['/search'],
  },
  {
    icon: <MoreHorizontal size={22} />,
    label: 'More',
    href: '/settings',
    match: ['/settings', '/archive', '/tab'],
  },
];

interface BottomNavProps {
  onMoreClick?: () => void;
}

export default function BottomNav({ onMoreClick }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    NAV_ITEMS.filter((item) => item.label !== 'More').forEach((item) => router.prefetch(item.href));
  }, [router]);

  const isActive = (item: NavItem) =>
    item.match.some((m) => pathname === m || pathname.startsWith(m + '?'));

  const handleClick = (item: NavItem) => {
    if (item.label === 'More' && onMoreClick) {
      onMoreClick();
    } else if (pathname !== item.href) {
      router.push(item.href);
    }
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around safe-bottom"
      style={{
        background: 'var(--color-nav)',
        borderTop: '1px solid var(--color-border)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
        paddingTop: '8px',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(item);
        return (
          <button
            key={item.label}
            onClick={() => handleClick(item)}
            className="flex flex-col items-center gap-1 px-4 py-1 rounded-xl transition-all duration-150 relative"
            style={{
              color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
              minWidth: 56,
            }}
          >
            <div
              className="transition-transform duration-150"
              style={{ transform: active ? 'scale(1.1)' : 'scale(1)' }}
            >
              {item.icon}
            </div>
            <span
              className="text-xs font-medium"
              style={{ fontSize: 10 }}
            >
              {item.label}
            </span>
            {active && (
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
                style={{
                  width: 32,
                  height: 2,
                  background: 'var(--color-accent)',
                  borderRadius: '0 0 2px 2px',
                }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
