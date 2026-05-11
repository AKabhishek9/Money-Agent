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
    } else {
      // Even if pathname matches, we might have query params (like ?w=...)
      // so we should push to clear them if the user clicks the nav item again
      router.push(item.href);
    }
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-end justify-around safe-bottom backdrop-blur-md supports-[backdrop-filter]:bg-[color-mix(in_oklab,var(--color-nav)_92%,transparent)]"
      style={{
        background: 'var(--color-nav)',
        borderTop: '1px solid var(--color-border)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 10px)',
        paddingTop: '6px',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(item);
        return (
          <button
            type="button"
            key={item.label}
            onClick={() => handleClick(item)}
            className="relative flex min-h-[52px] min-w-[56px] flex-col items-center justify-end gap-0.5 rounded-xl px-3 pb-1 pt-1 transition-[color,transform] duration-200"
            style={{
              color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
            }}
          >
            <div
              className="flex h-8 items-center justify-center transition-transform duration-200 ease-out"
              style={{ transform: active ? 'translateY(-1px)' : 'translateY(0)' }}
            >
              {item.icon}
            </div>
            <span className="text-[0.625rem] font-semibold uppercase tracking-wide">{item.label}</span>
            {active && (
              <span
                className="absolute left-1/2 top-1 h-0.5 w-7 -translate-x-1/2 rounded-full"
                style={{ background: 'var(--color-accent)', opacity: 0.95 }}
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
