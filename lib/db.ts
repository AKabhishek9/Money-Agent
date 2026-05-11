import Dexie, { type Table } from 'dexie';
import type { Entry, MoneyWindow, Person, PersonEntry, Tab, VaultItem } from './types';

export interface SyncQueueItem {
  id?: number;
  collection: 'tabs' | 'windows' | 'entries' | 'persons' | 'personEntries' | 'vault';
  operation: 'upsert' | 'delete';
  documentId: string;
  data?: Record<string, unknown>;
  createdAt: number;
  retries: number;
}

export class MoneyLedgerDb extends Dexie {
  tabs!: Table<Tab, string>;
  windows!: Table<MoneyWindow, string>;
  entries!: Table<Entry, string>;
  persons!: Table<Person, string>;
  personEntries!: Table<PersonEntry, string>;
  vault!: Table<VaultItem, string>;
  syncQueue!: Table<SyncQueueItem, number>;

  constructor() {
    super('MoneyLedger');
    this.version(1).stores({
      tabs: 'id, userId, type, order',
      windows: 'id, tabId, userId, [userId+tabId], archived, inRecycleBin, monthKey, order',
      entries: 'id, windowId, userId, entryDate, linkedPersonId',
      persons: 'id, userId, order',
      personEntries: 'id, personId, userId, entryDate, linkedEntryId',
      vault: 'id, userId',
      syncQueue: '++id, collection, documentId, createdAt',
    });
  }
}

let dbInstance: MoneyLedgerDb | null = null;

export function getDb(): MoneyLedgerDb {
  if (typeof window === 'undefined') {
    throw new Error('Dexie only runs in browser');
  }

  if (!dbInstance) {
    dbInstance = new MoneyLedgerDb();
  }

  return dbInstance;
}
