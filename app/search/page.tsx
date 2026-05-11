'use client';

import { useState, useCallback } from 'react';
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const doSearch = useCallback(
    debounce(async (q: unknown, entries: unknown) => {
      const queryStr = q as string;
      const resultPool = entries as SearchResult[] | null;
      if (!queryStr.trim()) { setResults([]); setSearched(false); return; }

      let pool = resultPool;
      if (!pool) {
        setLoading(true);
        try {
          pool = await loadSearchResults(user!.uid);
          setAllResults(pool);
        } finally {
          setLoading(false);
        }
      }

      const lower = queryStr.toLowerCase();
      const filtered = (pool || []).filter(
        (result) =>
          result.searchText.includes(lower) ||
          (result.amount !== undefined && String(Math.abs(result.amount)).includes(lower))
      );
      setResults(filtered);
      setSearched(true);
    }, 400),
    [user]
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
      <div className="px-4 py-3">
        <div
          className="flex items-center gap-2 px-3 py-3 rounded-2xl"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <Search size={18} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Search entries, notes, amounts…"
            className="flex-1 text-sm outline-none bg-transparent"
            style={{ color: 'var(--color-text)', caretColor: 'var(--color-accent)' }}
            autoFocus
          />
          {query && (
            <button onClick={() => handleChange('')}>
              <X size={16} style={{ color: 'var(--color-text-muted)' }} />
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
        <div>
          <p className="px-4 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {results.length} result{results.length !== 1 ? 's' : ''}
          </p>
          {results.map((entry) => (
            <button
              key={`${entry.kind}-${entry.id}`}
              type="button"
              onClick={() => entry.href && router.push(entry.href)}
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: '1px solid var(--color-border)' }}
            >
              <div
                className="w-1 self-stretch rounded-full"
                style={{
                  background: isPositive(entry) ? 'var(--color-income)' : 'var(--color-expense)',
                  minHeight: 32,
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                  {entry.title}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  {entry.subtitle}
                  {entry.date ? ` · ${formatRelativeDate(entry.date)}` : ''}
                </p>
              </div>
              {entry.amount !== undefined && (
                <span
                  className="font-mono font-semibold text-sm"
                  style={{ color: isPositive(entry) ? 'var(--color-income)' : 'var(--color-expense)' }}
                >
                  {formatAmount(entry.amount)}
                </span>
              )}
            </button>
          ))}
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
