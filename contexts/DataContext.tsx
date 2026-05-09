'use client';

import React, { createContext, useContext, useMemo } from 'react';
import useSWR from 'swr';
import { useAuth } from './AuthContext';
import { getSections, getTransactions, getPersons, getVaultItems } from '@/lib/firestore';

interface DataContextType {
  sections: any[];
  transactions: any[];
  persons: any[];
  vault: any[];
  loading: boolean;
  refresh: () => void;
  refreshTransactions: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  // Independent fetchers for parallel loading
  const { data: sections, isLoading: sLoading, mutate: mSections } = useSWR(
    user ? `sections-${user.uid}` : null,
    () => getSections(user?.uid || ''),
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const { data: transactions, isLoading: tLoading, mutate: mTransactions } = useSWR(
    user ? `transactions-${user.uid}` : null,
    () => getTransactions(user?.uid || '', 100),
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const { data: persons, isLoading: pLoading, mutate: mPersons } = useSWR(
    user ? `persons-${user.uid}` : null,
    () => getPersons(user?.uid || ''),
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const { data: vault, isLoading: vLoading, mutate: mVault } = useSWR(
    user ? `vault-${user.uid}` : null,
    () => getVaultItems(user?.uid || ''),
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const value = useMemo(() => ({
    sections: sections || [],
    transactions: transactions || [],
    persons: persons || [],
    vault: vault || [],
    // Loading is true only if AT LEAST ONE is loading and we have no data at all
    loading: (sLoading || tLoading || pLoading || vLoading) && (!sections && !transactions && !persons),
    refresh: () => {
      mSections();
      mTransactions();
      mPersons();
      mVault();
    },
    refreshTransactions: mTransactions
  }), [sections, transactions, persons, vault, sLoading, tLoading, pLoading, vLoading, mSections, mTransactions, mPersons, mVault]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
