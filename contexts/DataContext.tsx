'use client';

import React, { createContext, useContext, useMemo } from 'react';
import useSWR from 'swr';
import { useAuth } from './AuthContext';
import { getSections, getTransactions, getPersons, getVaultItems } from '@/lib/firestore';
import type { Section, Transaction, Person, VaultItem } from '@/lib/types';

interface DataContextType {
  sections: Section[];
  transactions: Transaction[];
  txLastDoc: unknown | null;
  persons: Person[];
  vault: VaultItem[];
  loading: boolean;
  error: Error | null;
  isError: boolean;
  refresh: () => void;
  refreshTransactions: () => void;
}

// Retry up to 3 times with exponential backoff (max 5 s)
const swrRetry = {
  shouldRetryOnError: true,
  errorRetryCount: 3,
  onErrorRetry: (_e: unknown, _k: string, _c: unknown, revalidate: (o: { retryCount: number }) => void, { retryCount }: { retryCount: number }) => {
    if (retryCount >= 3) return;
    setTimeout(() => revalidate({ retryCount }), Math.min(1000 * 2 ** retryCount, 5000));
  },
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  const { data: sections, isLoading: sLoading, error: sError, mutate: mSections } = useSWR(
    user ? `sections-${user.uid}` : null,
    () => getSections(user?.uid || ''),
    { revalidateOnFocus: false, dedupingInterval: 60000, ...swrRetry }
  );

  const { data: txResult, isLoading: tLoading, error: tError, mutate: mTransactions } = useSWR(
    user ? `transactions-${user.uid}` : null,
    () => getTransactions(user?.uid || '', 50),
    { revalidateOnFocus: false, dedupingInterval: 30000, ...swrRetry }
  );

  const { data: persons, isLoading: pLoading, error: pError, mutate: mPersons } = useSWR(
    user ? `persons-${user.uid}` : null,
    () => getPersons(user?.uid || ''),
    { revalidateOnFocus: false, dedupingInterval: 60000, ...swrRetry }
  );

  const { data: vault, isLoading: vLoading, error: vError, mutate: mVault } = useSWR(
    user ? `vault-${user.uid}` : null,
    () => getVaultItems(user?.uid || ''),
    { revalidateOnFocus: false, dedupingInterval: 60000, ...swrRetry }
  );

  const anyError = sError || tError || pError || vError || null;

  const value = useMemo(() => ({
    sections: sections || [],
    transactions: txResult?.data || [],
    txLastDoc: txResult?.lastDoc ?? null,
    persons: persons || [],
    vault: vault || [],
    loading: (sLoading || tLoading || pLoading || vLoading) && !sections && !txResult && !persons && !vault,
    error: anyError,
    isError: !!anyError,
    refresh: () => {
      mSections();
      mTransactions();
      mPersons();
      mVault();
    },
    refreshTransactions: mTransactions
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [sections, txResult, persons, vault, sLoading, tLoading, pLoading, vLoading, sError, tError, pError, vError, mSections, mTransactions, mPersons, mVault]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
