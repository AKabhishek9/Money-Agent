'use client';

import { useState } from 'react';
import { LogOut, User, Shield, Info, ChevronRight, BookOpen, Archive } from 'lucide-react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/auth/AuthGuard';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import Confirm from '@/components/ui/Confirm';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsPage() {
  return (
    <AuthGuard>
      <AppLayout>
        <SettingsContent />
      </AppLayout>
    </AuthGuard>
  );
}

function SettingsContent() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [showSignOut, setShowSignOut] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <div>
      <Header title="Settings" />

      {/* Profile card */}
      <div className="mx-4 mt-4 mb-6">
        <div
          className="rounded-2xl p-4 flex items-center gap-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold"
            style={{ background: 'var(--color-accent-bg)', color: 'var(--color-accent)' }}
          >
            {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="font-bold text-base" style={{ color: 'var(--color-text)' }}>
              {user?.displayName || 'User'}
            </p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {user?.email}
            </p>
          </div>
        </div>
      </div>

      {/* Settings groups */}
      <div className="px-4 flex flex-col gap-3">
        {/* Data */}
        <SettingsGroup
          label="Data"
          items={[
            {
              icon: <Archive size={18} />,
              label: 'Archive & Trash',
              onPress: () => router.push('/archive'),
            },
          ]}
        />

        {/* About */}
        <SettingsGroup
          label="About"
          items={[
            {
              icon: <BookOpen size={18} />,
              label: 'Money Ledger',
              value: 'v2.2.0',
            },
            {
              icon: <Shield size={18} />,
              label: 'Offline Mode',
              value: 'Active',
              valueColor: 'var(--color-income)',
            },
            {
              icon: <Info size={18} />,
              label: 'Your data synced to cloud',
            },
          ]}
        />

        {/* Sign out */}
        <button
          onClick={() => setShowSignOut(true)}
          className="flex items-center gap-3 px-4 py-4 rounded-2xl w-full text-left"
          style={{
            background: 'var(--color-expense-bg)',
            border: '1px solid var(--color-expense)',
          }}
        >
          <LogOut size={18} style={{ color: 'var(--color-expense)' }} />
          <span className="font-semibold text-sm" style={{ color: 'var(--color-expense)' }}>
            Sign Out
          </span>
        </button>
      </div>

      {showSignOut && (
        <Confirm
          title="Sign out?"
          message="You'll need to sign in again to access your data."
          confirmLabel="Sign Out"
          danger
          onConfirm={handleSignOut}
          onCancel={() => setShowSignOut(false)}
        />
      )}
    </div>
  );
}

interface SettingsGroupProps {
  label: string;
  items: {
    icon: React.ReactNode;
    label: string;
    value?: string;
    valueColor?: string;
    onPress?: () => void;
  }[];
}

function SettingsGroup({ label, items }: SettingsGroupProps) {
  return (
    <div>
      <p
        className="text-xs font-semibold uppercase tracking-wider px-1 mb-2"
        style={{ color: 'var(--color-text-dim)' }}
      >
        {label}
      </p>
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        {items.map((item, i) => (
          <div key={i}>
            {i > 0 && (
              <div className="ml-14 h-px" style={{ background: 'var(--color-border)' }} />
            )}
            <button
              className="flex items-center gap-3 w-full px-4 py-3.5 text-left"
              onClick={item.onPress}
              disabled={!item.onPress}
              style={{ cursor: item.onPress ? 'pointer' : 'default' }}
            >
              <span style={{ color: 'var(--color-text-muted)' }}>{item.icon}</span>
              <span className="flex-1 text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                {item.label}
              </span>
              {item.value && (
                <span
                  className="text-sm"
                  style={{ color: item.valueColor || 'var(--color-text-muted)' }}
                >
                  {item.value}
                </span>
              )}
              {item.onPress && (
                <ChevronRight size={16} style={{ color: 'var(--color-text-dim)' }} />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
