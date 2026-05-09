// ===== USER =====
export interface User {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  createdAt: Date;
}

// ===== SECTIONS (WALLETS) =====
export type SectionType = 'default' | 'custom';

export interface Section {
  id: string;
  userId: string;
  name: string;
  type: SectionType;
  balance: number;
  icon: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_SECTIONS: Omit<Section, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'Daily Expenses', type: 'default', balance: 0, icon: 'wallet', color: '#6c5ce7' },
  { name: 'Savings', type: 'default', balance: 0, icon: 'piggy-bank', color: '#00b894' },
  { name: 'Bills', type: 'default', balance: 0, icon: 'receipt', color: '#e17055' },
  { name: 'Loans', type: 'default', balance: 0, icon: 'handshake', color: '#fdcb6e' },
];

// ===== PERSONS =====
export type PersonType = 'self' | 'managed' | 'loan';

export interface Person {
  id: string;
  userId: string;
  name: string;
  type: PersonType;
  balance: number;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ===== TRANSACTIONS =====
export type TransactionType = 'income' | 'expense' | 'transfer' | 'loan';

export interface Transaction {
  id: string;
  userId: string;
  sectionId: string;
  personId?: string;
  type: TransactionType;
  amount: number;
  category?: string;
  date: Date;
  note?: string;
  /** For transfers: destination section */
  toSectionId?: string;
  /** For loans: 'given' or 'received' */
  loanDirection?: 'given' | 'received';
  createdAt: Date;
}

// ===== VAULT =====
export type VaultItemType = 'bank' | 'card' | 'note';

export interface VaultItem {
  id: string;
  userId: string;
  type: VaultItemType;
  title: string;
  data: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

// ===== DASHBOARD =====
export interface DashboardStats {
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  savings: number;
  sectionBalances: { name: string; balance: number; color: string }[];
  recentTransactions: Transaction[];
  monthlyData: { month: string; income: number; expense: number }[];
  categoryBreakdown: { category: string; amount: number; color: string }[];
}

// ===== EXPENSE CATEGORIES =====
export const EXPENSE_CATEGORIES = [
  { name: 'Food & Dining', icon: '🍕', color: '#e17055' },
  { name: 'Transportation', icon: '🚗', color: '#0984e3' },
  { name: 'Shopping', icon: '🛍️', color: '#6c5ce7' },
  { name: 'Entertainment', icon: '🎮', color: '#fd79a8' },
  { name: 'Healthcare', icon: '💊', color: '#00b894' },
  { name: 'Education', icon: '📚', color: '#fdcb6e' },
  { name: 'Utilities', icon: '💡', color: '#74b9ff' },
  { name: 'Rent', icon: '🏠', color: '#a29bfe' },
  { name: 'Travel', icon: '✈️', color: '#00cec9' },
  { name: 'Other', icon: '📦', color: '#636e72' },
] as const;

// ===== INCOME CATEGORIES =====
export const INCOME_CATEGORIES = [
  { name: 'Salary', icon: '💼', color: '#00b894' },
  { name: 'Freelance', icon: '💻', color: '#6c5ce7' },
  { name: 'Investment', icon: '📈', color: '#0984e3' },
  { name: 'Business', icon: '🏢', color: '#fdcb6e' },
  { name: 'Gift', icon: '🎁', color: '#fd79a8' },
  { name: 'Other', icon: '📦', color: '#636e72' },
] as const;
