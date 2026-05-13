'use client';

import { useState, useCallback, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/auth/AuthGuard';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import Loader from '@/components/ui/Loader';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/lib/db';
import { formatAmount } from '@/lib/parser';
import { formatRelativeDate, debounce } from '@/lib/utils';

interface SearchResult {
  id: string;
  kind: 'entry' | 'personEntry' | 'vault' | 'window' | 'tab';
  title: string;
  subtitle: string;
  amount?: number;
  date?: Date;
  href?: string;
  searchText: string;
}

export default function SearchPage() {
  return (
    <AuthGuard>
      <AppLayout>
        <SearchContent />
      </AppLayout>
    </AuthGuard>
  );
}

function SearchContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [allResults, setAllResults] = useState<SearchResult[] | null>(null);

  // Pre-warm the search pool on mount
  useEffect(() => {
    if (user?.uid) {
      loadSearchResults(user.uid).then(setAllResults).catch(() => undefined);
    }
  }, [user]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const doSearch = useCallback(
    debounce((q: unknown, pool: unknown) => {
      const queryStr = q as string;
      const resultPool = pool as SearchResult[] | null;
      
      if (!queryStr.trim()) { 
        setResults([]); 
        setSearched(false); 
        return; 
      }

      const lower = queryStr.toLowerCase();
      const filtered = (resultPool || []).filter(
        (result) =>
          result.searchText.includes(lower) ||
          (result.amount !== undefined && String(Math.abs(result.amount)).includes(lower))
      );
      setResults(filtered);
      setSearched(true);
    }, 200),
    []
  );

  const handleChange = (val: string) => {
    setQuery(val);
    doSearch(val, allResults);
  };

  const isPositive = (result: SearchResult) => (result.amount ?? 0) >= 0;

  return (
    <div>
      <Header title="Search" />

      {/* Search input */}
      <div className="px-4 pb-2 pt-1">
        <div
          className="surface-card flex min-h-[48px] items-center gap-2 rounded-2xl px-3 py-2 transition-[border-color,box-shadow] duration-200"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: query.trim() ? '0 0 0 1px color-mix(in oklab, var(--color-accent) 18%, transparent)' : undefined,
          }}
        >
          <Search size={18} strokeWidth={2} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Search entries, notes, amounts…"
            className="min-w-0 flex-1 bg-transparent py-2 text-[0.9375rem] outline-none"
            style={{ color: 'var(--color-text)', caretColor: 'var(--color-accent)' }}
            autoFocus
          />
          {query && (
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-opacity duration-150 active:opacity-70"
              onClick={() => handleChange('')}
              aria-label="Clear search"
            >
              <X size={18} strokeWidth={2} style={{ color: 'var(--color-text-muted)' }} />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <Loader label="Searching..." />
      ) : searched && results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
          <div className="text-4xl mb-3">🔍</div>
          <p className="font-medium text-sm" style={{ color: 'var(--color-text-muted)' }}>
            No results for &ldquo;{query}&rdquo;
          </p>
        </div>
      ) : !searched ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Type to search across all your entries
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-dim)' }}>
            Searches pages, people ledgers, vault, notes, and amounts
          </p>
        </div>
      ) : (
        <div className="pb-4">
          <p className="text-balance-label px-4 pb-2 pt-1">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </p>
          <div className="flex flex-col gap-2 px-4">
            {results.map((entry) => (
              <button
                key={`${entry.kind}-${entry.id}`}
                type="button"
                onClick={() => entry.href && router.push(entry.href)}
                className="surface-card flex items-start gap-3 rounded-2xl p-3 text-left transition-[transform,opacity] duration-150 active:scale-[0.99] active:opacity-90"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div
                  className="mt-1 w-1 shrink-0 self-stretch rounded-full"
                  style={{
                    background: isPositive(entry) ? 'var(--color-income)' : 'var(--color-expense)',
                    minHeight: 28,
                    opacity: 0.85,
                  }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold leading-snug tracking-tight" style={{ color: 'var(--color-text)' }}>
                    {entry.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                    {entry.subtitle}
                    {entry.date ? ` · ${formatRelativeDate(entry.date)}` : ''}
                  </p>
                </div>
                {entry.amount !== undefined && (
                  <span
                    className="amount-mono shrink-0 text-sm font-semibold tabular-nums"
                    style={{ color: isPositive(entry) ? 'var(--color-income)' : 'var(--color-expense)' }}
                  >
                    {formatAmount(entry.amount)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

async function loadSearchResults(userId: string): Promise<SearchResult[]> {
  const db = getDb();
  const [entries, personEntries, vaultItems, windows, tabs, persons] = await Promise.all([
    db.entries.where('userId').equals(userId).sortBy('entryDate'),
    db.personEntries.where('userId').equals(userId).sortBy('entryDate'),
    db.vault.where('userId').equals(userId).sortBy('createdAt'),
    db.windows.where('userId').equals(userId).toArray(),
    db.tabs.where('userId').equals(userId).toArray(),
    db.persons.where('userId').equals(userId).toArray(),
  ]);

  const tabsById = new Map(tabs.map((tab) => [tab.id, tab]));
  const windowsById = new Map(windows.map((window) => [window.id, window]));
  const personsById = new Map(persons.map((person) => [person.id, person]));

  const entryResults: SearchResult[] = entries.map((entry) => {
    const window = windowsById.get(entry.windowId);
    const tab = window ? tabsById.get(window.tabId) : undefined;
    const href = window
      ? tab?.type === 'personal'
        ? `/personal?w=${window.id}`
        : `/tab?t=${window.tabId}&w=${window.id}`
      : undefined;

    return {
      id: entry.id,
      kind: 'entry',
      title: entry.note || entry.rawText,
      subtitle: `${window?.title || 'Page'}${tab ? ` · ${tab.name}` : ''}`,
      amount: entry.amount,
      date: entry.entryDate,
      href,
      searchText: [
        entry.note,
        entry.rawText,
        entry.linkedPersonName,
        window?.title,
        tab?.name,
      ].join(' ').toLowerCase(),
    };
  });

  const personEntryResults: SearchResult[] = personEntries.map((entry) => {
    const person = personsById.get(entry.personId);
    return {
      id: entry.id,
      kind: 'personEntry',
      title: entry.note || entry.rawText,
      subtitle: `${person?.name || 'Person'} ledger`,
      amount: entry.amount,
      date: entry.entryDate,
      href: `/people?p=${entry.personId}`,
      searchText: [entry.note, entry.rawText, person?.name].join(' ').toLowerCase(),
    };
  });

  const vaultResults: SearchResult[] = vaultItems.map((item) => ({
    id: item.id,
    kind: 'vault',
    title: item.title,
    subtitle: `Vault · ${item.type}`,
    href: '/vault',
    searchText: [item.title, item.type, ...Object.values(item.fields)].join(' ').toLowerCase(),
  }));

  const windowResults: SearchResult[] = windows.map((window) => {
    const tab = tabsById.get(window.tabId);
    return {
      id: window.id,
      kind: 'window',
      title: window.title,
      subtitle: `Page${tab ? ` · ${tab.name}` : ''}`,
      date: window.createdAt,
      href: tab?.type === 'personal' ? `/personal?w=${window.id}` : `/tab?t=${window.tabId}&w=${window.id}`,
      searchText: [window.title, tab?.name].join(' ').toLowerCase(),
    };
  });

  const tabResults: SearchResult[] = tabs.map((tab) => ({
    id: tab.id,
    kind: 'tab',
    title: tab.name,
    subtitle: 'Tab',
    href:
      tab.type === 'personal'
        ? '/personal'
        : tab.type === 'people'
        ? '/people'
        : tab.type === 'vault'
        ? '/vault'
        : `/tab?t=${tab.id}`,
    searchText: [tab.name, tab.type].join(' ').toLowerCase(),
  }));

  return [
    ...entryResults,
    ...personEntryResults,
    ...vaultResults,
    ...windowResults,
    ...tabResults,
  ].reverse();
}
