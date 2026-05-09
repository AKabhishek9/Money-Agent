'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import {
  LayoutDashboard,
  Wallet,
  ArrowRightLeft,
  Users,
  PieChart,
  Shield,
  Bot,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  Sparkles,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/transactions', label: 'Transactions', icon: ArrowRightLeft },
  { href: '/dashboard/sections', label: 'Sections', icon: Wallet },
  { href: '/dashboard/persons', label: 'People', icon: Users },
  { href: '/dashboard/analytics', label: 'Analytics', icon: PieChart },
  { href: '/dashboard/vault', label: 'Vault', icon: Shield },
  { href: '/dashboard/ai-advisor', label: 'AI Advisor', icon: Bot },
];

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export default function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden btn-ghost p-2 rounded-lg"
        aria-label="Open menu"
        id="sidebar-mobile-toggle"
      >
        <Menu size={22} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-50 flex flex-col
          transition-all duration-300 ease-in-out
          border-r border-[var(--border-subtle)]
          ${collapsed ? 'w-[72px]' : 'w-[280px]'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ background: 'var(--bg-secondary)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 h-[72px]">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2.5 no-underline">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--gradient-primary)' }}
              >
                <Sparkles size={18} className="text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Money<span className="gradient-text"> Agent</span>
              </span>
            </Link>
          )}

          {/* Desktop collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex btn-ghost p-1.5 rounded-lg ml-auto"
            aria-label="Toggle sidebar"
            id="sidebar-collapse-toggle"
          >
            <ChevronLeft
              size={18}
              className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Mobile close toggle */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden btn-ghost p-1.5 rounded-lg"
            aria-label="Close menu"
            id="sidebar-mobile-close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                id={`nav-${label.toLowerCase().replace(/\s/g, '-')}`}
                title={collapsed ? label : undefined}
              >
                <div className="min-w-[20px] flex items-center justify-center">
                   <Icon size={20} />
                </div>
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-[var(--border-subtle)]">
          {!collapsed && user && (
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: 'var(--gradient-primary)', color: '#fff' }}
              >
                {user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {user.displayName || 'User'}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                  {user.email}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={signOut}
            className="sidebar-nav-item w-full"
            id="sidebar-signout"
            title={collapsed ? 'Sign out' : undefined}
          >
             <div className="min-w-[20px] flex items-center justify-center">
                <LogOut size={20} />
             </div>
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
