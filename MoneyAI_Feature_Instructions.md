# MoneyAI — Agent Implementation Instructions
> Read this entire file before writing a single line of code.
> This is a feature addition to an existing working project — do NOT rewrite what already works.
> Backend stays the same: Firebase Auth + Firestore + GitHub + Firebase Hosting.

---

## UNDERSTAND THE PROJECT FIRST

MoneyAI is a **digital accounting notebook** — not a finance SaaS.

Users type entries like a notebook:
```
-1200 ration
+5000 salary
5000-1200-300
```

The app auto-calculates totals. No forms. No dropdowns for basic entries.

**Current project already has (DO NOT touch these):**
- Firebase Auth (email + Google) — `contexts/AuthContext.tsx`
- Firebase config — `lib/firebase.ts`
- Firestore operations — `lib/firestore.ts`
- Smart entry parser — `lib/parser.ts`
- All UI components — `components/`
- Personal tab with windows/pages — `app/personal/page.tsx`
- People tab with person ledgers — `app/people/page.tsx`
- Vault tab — `app/vault/page.tsx`
- Search, Archive, Settings pages
- Bottom navigation — mobile-first
- CSS design tokens — `app/globals.css`
- CSV export — `lib/export.ts`
- Firestore rules + indexes

**What you are adding (4 features):**
1. Offline-first with Dexie.js (IndexedDB as primary storage)
2. Per-entry running balance in all ledger views
3. Double-entry: person entries affect personal balance
4. PDF export

---

## ARCHITECTURE OVERVIEW

```
USER TYPES ENTRY
      ↓
  Dexie (IndexedDB)  ← PRIMARY WRITE — instant, always works offline
      ↓
  Zustand Store     ← in-memory state, reads from Dexie, drives UI
      ↓
  React Components  ← reads from store only
      ↓
  Sync Service      ← background worker, pushes Dexie → Firestore when online
      ↓
  Firestore         ← cloud backup only, never read directly after first login
```

**Golden rule: Every write goes to IndexedDB first. Firestore is just a backup.**

---

## STEP 1 — INSTALL DEPENDENCIES

Run these commands:

```bash
npm install dexie dexie-react-hooks pdf-lib @types/uuid uuid
```

Verify `package.json` now contains all of these.

---

## STEP 2 — CREATE DEXIE DATABASE (`lib/db.ts`)

Create this file from scratch:

```typescript
import Dexie, { type Table } from 'dexie';
import type { Tab, MoneyWindow, Entry, Person, PersonEntry, VaultItem } from './types';

// ─── Sync Queue Item ───────────────────────────────────────────────────────
export interface SyncQueueItem {
  id?: number; // auto-increment
  collection: 'tabs' | 'windows' | 'entries' | 'persons' | 'personEntries' | 'vault';
  operation: 'upsert' | 'delete';
  documentId: string;
  data?: Record<string, unknown>;
  createdAt: number;
  retries: number;
}

// ─── Dexie Database Class ──────────────────────────────────────────────────
export class MoneyAIDb extends Dexie {
  tabs!: Table<Tab & { id: string }>;
  windows!: Table<MoneyWindow & { id: string }>;
  entries!: Table<Entry & { id: string }>;
  persons!: Table<Person & { id: string }>;
  personEntries!: Table<PersonEntry & { id: string }>;
  vault!: Table<VaultItem & { id: string }>;
  syncQueue!: Table<SyncQueueItem, number>;

  constructor() {
    super('MoneyAI');
    this.version(1).stores({
      tabs:          'id, userId, type, order',
      windows:       'id, tabId, userId, archived, inRecycleBin, monthKey, order',
      entries:       'id, windowId, userId, entryDate, linkedPersonId',
      persons:       'id, userId, order',
      personEntries: 'id, personId, userId, entryDate, linkedEntryId',
      vault:         'id, userId',
      syncQueue:     '++id, collection, documentId, createdAt',
    });
  }
}

// Singleton — browser only
let _db: MoneyAIDb | null = null;

export function getDb(): MoneyAIDb {
  if (typeof window === 'undefined') throw new Error('Dexie only runs in browser');
  if (!_db) _db = new MoneyAIDb();
  return _db;
}
```

---

## STEP 3 — UPDATE TYPES (`lib/types.ts`)

Add these new fields to existing interfaces. DO NOT remove any existing fields.

**Add to `Entry` interface:**
```typescript
export interface Entry {
  id: string;
  userId: string;
  windowId: string;
  rawText: string;
  amount: number;
  note: string;
  type: EntryType;
  entryDate: Date;
  createdAt: Date;
  updatedAt: Date;
  // NEW FIELDS — add these:
  linkedPersonId?: string;   // if this entry is linked to a person (double-entry)
  linkedPersonName?: string; // cached person name for display
}
```

**Add to `PersonEntry` interface:**
```typescript
export interface PersonEntry {
  id: string;
  userId: string;
  personId: string;
  rawText: string;
  amount: number;
  note: string;
  entryDate: Date;
  createdAt: Date;
  updatedAt: Date;
  // NEW FIELDS — add these:
  linkedEntryId?: string;    // the window entry that created this person entry
  linkedWindowId?: string;   // which window the linked entry is in
}
```

---

## STEP 4 — CREATE SYNC SERVICE (`lib/sync.ts`)

Create this file from scratch:

```typescript
'use client';

import {
  doc, setDoc, deleteDoc, collection,
  getDocs, query, where, Timestamp, writeBatch,
} from 'firebase/firestore';
import { db as firestoreDb } from '@/lib/firebase';
import { getDb } from '@/lib/db';
import type { Tab, MoneyWindow, Entry, Person, PersonEntry, VaultItem } from '@/lib/types';

type SyncRecord = Tab | MoneyWindow | Entry | Person | PersonEntry | VaultItem;

// Convert Date objects to Firestore Timestamps for storage
function toFirestore(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val instanceof Date) {
      result[key] = Timestamp.fromDate(val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

// ─── Queue a sync operation ────────────────────────────────────────────────
export async function queueSync(
  collection_: 'tabs' | 'windows' | 'entries' | 'persons' | 'personEntries' | 'vault',
  operation: 'upsert' | 'delete',
  documentId: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = getDb();
  await db.syncQueue.add({
    collection: collection_,
    operation,
    documentId,
    data,
    createdAt: Date.now(),
    retries: 0,
  });
  // Try to sync immediately if online
  if (navigator.onLine) {
    processSyncQueue().catch(() => {});
  }
}

// ─── Process pending queue (called when online) ────────────────────────────
export async function processSyncQueue(): Promise<void> {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  const db = getDb();
  const items = await db.syncQueue.orderBy('createdAt').limit(100).toArray();
  if (items.length === 0) return;

  for (const item of items) {
    try {
      if (item.operation === 'upsert' && item.data) {
        const ref = doc(firestoreDb, item.collection, item.documentId);
        await setDoc(ref, toFirestore(item.data), { merge: true });
      } else if (item.operation === 'delete') {
        await deleteDoc(doc(firestoreDb, item.collection, item.documentId));
      }
      await db.syncQueue.delete(item.id!);
    } catch {
      const retries = (item.retries || 0) + 1;
      if (retries >= 5) {
        await db.syncQueue.delete(item.id!);
      } else {
        await db.syncQueue.update(item.id!, { retries });
      }
    }
  }
}

// ─── First-time hydration from Firestore → Dexie ─────────────────────────
// Called once on first login or when switching to a new device
export async function hydrateFromFirestore(userId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = getDb();

  // Check if we already have local data
  const existingTabs = await db.tabs.where('userId').equals(userId).count();
  if (existingTabs > 0) return; // already hydrated

  // Pull all data from Firestore
  const collections = ['tabs', 'windows', 'entries', 'persons', 'personEntries', 'vault'] as const;

  for (const coll of collections) {
    const q = query(collection(firestoreDb, coll), where('userId', '==', userId));
    const snap = await getDocs(q);
    if (snap.empty) continue;

    const records = snap.docs.map(d => {
      const data = d.data();
      // Convert Timestamps back to Dates
      const converted: Record<string, unknown> = { ...data, id: d.id };
      for (const [key, val] of Object.entries(converted)) {
        if (val instanceof Timestamp) converted[key] = val.toDate();
      }
      return converted;
    });

    // Bulk insert into Dexie
    const table = db[coll] as ReturnType<typeof db.table>;
    await table.bulkPut(records);
  }
}

// ─── Setup online listener ─────────────────────────────────────────────────
export function setupSyncListener(): () => void {
  const handler = () => processSyncQueue();
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
```

---

## STEP 5 — CREATE ZUSTAND STORE (`store/useStore.ts`)

This replaces all the scattered `useState` + direct Firestore calls in each page component.

```typescript
'use client';

import { create } from 'zustand';
import { getDb } from '@/lib/db';
import { queueSync } from '@/lib/sync';
import type { Tab, MoneyWindow, Entry, Person, PersonEntry, VaultItem } from '@/lib/types';

interface StoreState {
  // Data
  tabs: Tab[];
  windows: MoneyWindow[];
  persons: Person[];
  isLoaded: boolean;
  userId: string | null;

  // Actions
  init: (userId: string) => Promise<void>;
  reset: () => void;

  // Tabs
  loadTabs: (userId: string) => Promise<Tab[]>;
  addTab: (userId: string, data: { name: string; icon: string }) => Promise<string>;
  updateTab: (id: string, data: Partial<Tab>) => Promise<void>;
  deleteTab: (id: string) => Promise<void>;

  // Windows
  loadWindows: (userId: string, tabId: string) => Promise<MoneyWindow[]>;
  addWindow: (userId: string, tabId: string, title: string, extra?: Partial<MoneyWindow>) => Promise<string>;
  updateWindow: (id: string, data: Partial<MoneyWindow>) => Promise<void>;
  softDeleteWindow: (id: string) => Promise<void>;
  restoreWindow: (id: string) => Promise<void>;
  hardDeleteWindow: (id: string) => Promise<void>;

  // Persons
  loadPersons: (userId: string) => Promise<Person[]>;
  addPerson: (userId: string, name: string, note: string) => Promise<string>;
  updatePerson: (id: string, data: Partial<Person>) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
}

export const useStore = create<StoreState>((set, get) => ({
  tabs: [],
  windows: [],
  persons: [],
  isLoaded: false,
  userId: null,

  init: async (userId: string) => {
    const db = getDb();
    const [tabs, persons] = await Promise.all([
      db.tabs.where('userId').equals(userId).sortBy('order'),
      db.persons.where('userId').equals(userId).sortBy('order'),
    ]);
    set({ tabs, persons, isLoaded: true, userId });
  },

  reset: () => set({ tabs: [], windows: [], persons: [], isLoaded: false, userId: null }),

  // ── Tabs ──────────────────────────────────────────────────────────────
  loadTabs: async (userId) => {
    const db = getDb();
    const tabs = await db.tabs.where('userId').equals(userId).sortBy('order');
    set({ tabs });
    return tabs;
  },

  addTab: async (userId, data) => {
    const db = getDb();
    const { v4: uuid } = await import('uuid');
    const id = uuid();
    const now = new Date();
    const existing = await db.tabs.where('userId').equals(userId).count();
    const tab: Tab = {
      id, userId,
      name: data.name, icon: data.icon,
      type: 'custom',
      order: existing,
      pinned: false, archived: false, isSystem: false,
      createdAt: now,
    };
    await db.tabs.add(tab);
    await queueSync('tabs', 'upsert', id, tab as unknown as Record<string, unknown>);
    set(s => ({ tabs: [...s.tabs, tab] }));
    return id;
  },

  updateTab: async (id, data) => {
    const db = getDb();
    await db.tabs.update(id, data);
    await queueSync('tabs', 'upsert', id, data as Record<string, unknown>);
    set(s => ({ tabs: s.tabs.map(t => t.id === id ? { ...t, ...data } : t) }));
  },

  deleteTab: async (id) => {
    const db = getDb();
    // Cascade: delete all windows and entries in this tab
    const wins = await db.windows.where('tabId').equals(id).toArray();
    for (const w of wins) {
      await db.entries.where('windowId').equals(w.id).delete();
      await queueSync('entries', 'delete', w.id);
    }
    await db.windows.where('tabId').equals(id).delete();
    await db.tabs.delete(id);
    await queueSync('tabs', 'delete', id);
    set(s => ({ tabs: s.tabs.filter(t => t.id !== id) }));
  },

  // ── Windows ───────────────────────────────────────────────────────────
  loadWindows: async (userId, tabId) => {
    const db = getDb();
    const wins = await db.windows
      .where('[userId+tabId]')
      .equals([userId, tabId])
      .filter(w => !w.archived && !w.inRecycleBin)
      .sortBy('order');
    // Sort: pinned first, then by order
    const sorted = wins.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      // Monthly windows: newest month first
      if (a.monthKey && b.monthKey) return b.monthKey.localeCompare(a.monthKey);
      return (a.order || 0) - (b.order || 0);
    });
    return sorted;
  },

  addWindow: async (userId, tabId, title, extra = {}) => {
    const db = getDb();
    const { v4: uuid } = await import('uuid');
    const id = uuid();
    const now = new Date();
    const count = await db.windows.where('tabId').equals(tabId).count();
    const win: MoneyWindow = {
      id, userId, tabId, title,
      order: count,
      pinned: false, archived: false, inRecycleBin: false,
      autoMonthly: false,
      createdAt: now,
      ...extra,
    };
    await db.windows.add(win);
    await queueSync('windows', 'upsert', id, win as unknown as Record<string, unknown>);
    return id;
  },

  updateWindow: async (id, data) => {
    const db = getDb();
    await db.windows.update(id, data);
    await queueSync('windows', 'upsert', id, data as Record<string, unknown>);
  },

  softDeleteWindow: async (id) => {
    await get().updateWindow(id, { inRecycleBin: true });
  },

  restoreWindow: async (id) => {
    await get().updateWindow(id, { inRecycleBin: false });
  },

  hardDeleteWindow: async (id) => {
    const db = getDb();
    await db.entries.where('windowId').equals(id).delete();
    await db.windows.delete(id);
    await queueSync('windows', 'delete', id);
  },

  // ── Persons ───────────────────────────────────────────────────────────
  loadPersons: async (userId) => {
    const db = getDb();
    const persons = await db.persons.where('userId').equals(userId).sortBy('order');
    set({ persons });
    return persons;
  },

  addPerson: async (userId, name, note) => {
    const db = getDb();
    const { v4: uuid } = await import('uuid');
    const id = uuid();
    const now = new Date();
    const count = await db.persons.where('userId').equals(userId).count();
    const person: Person = {
      id, userId, name, note,
      order: count,
      createdAt: now, updatedAt: now,
    };
    await db.persons.add(person);
    await queueSync('persons', 'upsert', id, person as unknown as Record<string, unknown>);
    set(s => ({ persons: [...s.persons, person] }));
    return id;
  },

  updatePerson: async (id, data) => {
    const db = getDb();
    const updated = { ...data, updatedAt: new Date() };
    await db.persons.update(id, updated);
    await queueSync('persons', 'upsert', id, updated as Record<string, unknown>);
    set(s => ({ persons: s.persons.map(p => p.id === id ? { ...p, ...updated } : p) }));
  },

  deletePerson: async (id) => {
    const db = getDb();
    await db.personEntries.where('personId').equals(id).delete();
    await db.persons.delete(id);
    await queueSync('persons', 'delete', id);
    set(s => ({ persons: s.persons.filter(p => p.id !== id) }));
  },
}));
```

---

## STEP 6 — CREATE ENTRY OPERATIONS (`lib/entries.ts`)

Create this new file. This is where all entry writes live — both local and sync.

```typescript
'use client';

import { getDb } from '@/lib/db';
import { queueSync } from '@/lib/sync';
import type { Entry, PersonEntry } from '@/lib/types';

// ─── Add a regular window entry ────────────────────────────────────────────
export async function localAddEntry(
  userId: string,
  windowId: string,
  data: {
    rawText: string;
    amount: number;
    note: string;
    type: string;
    entryDate: Date;
    linkedPersonId?: string;
    linkedPersonName?: string;
  }
): Promise<Entry> {
  const db = getDb();
  const { v4: uuid } = await import('uuid');
  const id = uuid();
  const now = new Date();
  const entry: Entry = {
    id, userId, windowId,
    rawText: data.rawText,
    amount: data.amount,
    note: data.note,
    type: data.type as Entry['type'],
    entryDate: data.entryDate,
    linkedPersonId: data.linkedPersonId,
    linkedPersonName: data.linkedPersonName,
    createdAt: now,
    updatedAt: now,
  };
  await db.entries.add(entry);
  await queueSync('entries', 'upsert', id, entry as unknown as Record<string, unknown>);
  return entry;
}

// ─── Add a person entry ────────────────────────────────────────────────────
export async function localAddPersonEntry(
  userId: string,
  personId: string,
  data: {
    rawText: string;
    amount: number;
    note: string;
    entryDate: Date;
    linkedEntryId?: string;
    linkedWindowId?: string;
  }
): Promise<PersonEntry> {
  const db = getDb();
  const { v4: uuid } = await import('uuid');
  const id = uuid();
  const now = new Date();
  const entry: PersonEntry = {
    id, userId, personId,
    rawText: data.rawText,
    amount: data.amount,
    note: data.note,
    entryDate: data.entryDate,
    linkedEntryId: data.linkedEntryId,
    linkedWindowId: data.linkedWindowId,
    createdAt: now,
    updatedAt: now,
  };
  await db.personEntries.add(entry);
  await queueSync('personEntries', 'upsert', id, entry as unknown as Record<string, unknown>);
  return entry;
}

// ─── Update an entry ───────────────────────────────────────────────────────
export async function localUpdateEntry(id: string, data: Partial<Entry>): Promise<void> {
  const db = getDb();
  const updated = { ...data, updatedAt: new Date() };
  await db.entries.update(id, updated);
  await queueSync('entries', 'upsert', id, updated as Record<string, unknown>);
}

// ─── Update a person entry ─────────────────────────────────────────────────
export async function localUpdatePersonEntry(id: string, data: Partial<PersonEntry>): Promise<void> {
  const db = getDb();
  const updated = { ...data, updatedAt: new Date() };
  await db.personEntries.update(id, updated);
  await queueSync('personEntries', 'upsert', id, updated as Record<string, unknown>);
}

// ─── Delete an entry ───────────────────────────────────────────────────────
export async function localDeleteEntry(id: string): Promise<void> {
  const db = getDb();

  // Check if this entry has a linked person entry — delete that too
  const linkedPersonEntries = await db.personEntries.where('linkedEntryId').equals(id).toArray();
  for (const pe of linkedPersonEntries) {
    await db.personEntries.delete(pe.id);
    await queueSync('personEntries', 'delete', pe.id);
  }

  await db.entries.delete(id);
  await queueSync('entries', 'delete', id);
}

// ─── Delete a person entry ─────────────────────────────────────────────────
export async function localDeletePersonEntry(id: string): Promise<void> {
  const db = getDb();

  // If this person entry was created from a window entry, update that window entry
  const pe = await db.personEntries.get(id);
  if (pe?.linkedEntryId) {
    await db.entries.update(pe.linkedEntryId, { linkedPersonId: undefined, linkedPersonName: undefined });
    await queueSync('entries', 'upsert', pe.linkedEntryId, {
      linkedPersonId: undefined,
      linkedPersonName: undefined,
    });
  }

  await db.personEntries.delete(id);
  await queueSync('personEntries', 'delete', id);
}

// ─── Load entries for a window (from Dexie) ───────────────────────────────
export async function localGetEntries(windowId: string): Promise<Entry[]> {
  const db = getDb();
  return db.entries
    .where('windowId')
    .equals(windowId)
    .sortBy('entryDate');
}

// ─── Load person entries (from Dexie) ─────────────────────────────────────
export async function localGetPersonEntries(personId: string): Promise<PersonEntry[]> {
  const db = getDb();
  return db.personEntries
    .where('personId')
    .equals(personId)
    .sortBy('entryDate');
}

// ─── Compute running balance (oldest→newest order, returns reversed) ───────
export function computeRunningBalance<T extends { amount: number; entryDate: Date }>(
  entries: T[]
): (T & { runningBalance: number })[] {
  // Sort oldest first for correct running balance
  const sorted = [...entries].sort(
    (a, b) => a.entryDate.getTime() - b.entryDate.getTime()
  );

  let running = 0;
  const withBalance = sorted.map(e => {
    running += e.amount;
    return { ...e, runningBalance: running };
  });

  // Return newest first for display (reverse)
  return withBalance.reverse();
}
```

---

## STEP 7 — UPDATE `contexts/AuthContext.tsx`

The auth context needs to initialize Dexie on login and set up sync.
Find the `signIn`, `signUp`, `signInWithGoogle` callbacks and after each successful `initializeUserData(r.user.uid)` call, add:

```typescript
// Add this import at the top:
import { hydrateFromFirestore, setupSyncListener } from '@/lib/sync';

// Inside the useEffect where onAuthStateChanged fires:
useEffect(() => {
  const unsub = onAuthStateChanged(auth, async (u) => {
    setUser((prev) => {
      if (prev?.uid === u?.uid) return prev;
      return u;
    });
    // NEW: hydrate local DB when user signs in
    if (u) {
      await hydrateFromFirestore(u.uid);
    }
    setLoading(false);
  });

  // NEW: setup background sync listener
  const cleanupSync = typeof window !== 'undefined' ? setupSyncListener() : () => {};

  return () => { unsub(); cleanupSync(); };
}, []);
```

---

## STEP 8 — UPDATE `components/windows/WindowView.tsx` (Running Balance + Dexie)

This is the main ledger view. Replace ALL Firestore calls with Dexie calls and add running balance.

**Replace the import section:**
```typescript
import { localGetEntries, localAddEntry, localDeleteEntry, localUpdateEntry, computeRunningBalance } from '@/lib/entries';
// Remove: import { getEntries, addEntry, deleteEntry, updateEntry } from '@/lib/firestore';
```

**Replace the `load` function:**
```typescript
const load = useCallback(async () => {
  try {
    const data = await localGetEntries(w.id);
    setEntries(data);
  } finally {
    setLoading(false);
  }
}, [w.id]);
```

**Replace the `handleAdd` function:**
```typescript
const handleAdd = async (rawText: string, amount: number, note: string, type: string, linkedPersonId?: string, linkedPersonName?: string) => {
  const entry = await localAddEntry(userId, w.id, {
    rawText, amount, note, type,
    entryDate: new Date(),
    linkedPersonId,
    linkedPersonName,
  });
  setEntries(prev => [entry, ...prev]);
};
```

**Replace the `handleDelete` function:**
```typescript
const handleDelete = async (entry: Entry) => {
  await localDeleteEntry(entry.id);
  setEntries(prev => prev.filter(e => e.id !== entry.id));
};
```

**Replace the `handleEdit` function:**
```typescript
const handleEdit = async (entry: Entry, rawText: string) => {
  const parsed = parseEntry(rawText);
  if (!parsed.isValid) return;
  await localUpdateEntry(entry.id, {
    rawText: parsed.rawText, amount: parsed.amount, note: parsed.note, type: parsed.type,
  });
  setEntries(prev =>
    prev.map(e =>
      e.id === entry.id
        ? { ...e, rawText: parsed.rawText, amount: parsed.amount, note: parsed.note, type: parsed.type as Entry['type'] }
        : e
    )
  );
};
```

**Replace the entries rendering section with running balance:**

Replace the `grouped` variable and the rendering below it:
```typescript
// REMOVE the grouped logic and replace with:
const entriesWithBalance = computeRunningBalance(entries);

// Group by date for display
const grouped = entriesWithBalance.reduce<Record<string, typeof entriesWithBalance>>((acc, e) => {
  const key = formatDate(e.entryDate);
  if (!acc[key]) acc[key] = [];
  acc[key].push(e);
  return acc;
}, {});
```

Update the `EntryItem` in the JSX to pass the running balance:
```tsx
{dayEntries.map((entry) => (
  <EntryItem
    key={entry.id}
    entry={entry}
    runningBalance={entry.runningBalance}  // ADD THIS PROP
    showDate={false}
    onDelete={() => handleDelete(entry)}
    onEdit={() => setEditEntry(entry)}
  />
))}
```

Also update `EntryInput` to pass person linking:
```tsx
<EntryInput
  onAdd={handleAdd}
  persons={persons}      // ADD — list of persons for person linking
/>
```

Add persons to the component:
```typescript
// Add to WindowViewProps:
interface WindowViewProps {
  window: MoneyWindow;
  userId: string;
  onBack: () => void;
  persons: Person[]; // ADD
}
```

---

## STEP 9 — UPDATE `components/entry/EntryItem.tsx` (Show Running Balance)

Add `runningBalance` prop and display it on the right side.

**Add to props interface:**
```typescript
interface EntryItemProps {
  entry: AnyEntry;
  onDelete: () => void;
  onEdit?: () => void;
  showDate?: boolean;
  runningBalance?: number;  // ADD THIS
}
```

**Add running balance display in the amount section:**

Find the amount display section and add a balance line below it:
```tsx
{/* Amount + Running Balance */}
<div className="flex flex-col items-end gap-0.5 shrink-0">
  <span
    className="font-mono font-semibold text-base"
    style={{ color: isPositive ? 'var(--color-income)' : 'var(--color-expense)' }}
  >
    {formatAmount(entry.amount)}
  </span>
  {runningBalance !== undefined && (
    <span
      className="font-mono text-xs"
      style={{ color: 'var(--color-text-muted)' }}
    >
      = {runningBalance < 0 ? '-' : ''}₹{Math.abs(runningBalance).toLocaleString('en-IN')}
    </span>
  )}
</div>
```

Also add linked person indicator below the note:
```tsx
{/* Linked person badge */}
{'linkedPersonName' in entry && entry.linkedPersonName && (
  <div
    className="flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-md w-fit"
    style={{ background: 'var(--color-accent-bg)' }}
  >
    <span style={{ fontSize: 10, color: 'var(--color-accent)' }}>👤 {entry.linkedPersonName}</span>
  </div>
)}
```

---

## STEP 10 — UPDATE `components/entry/EntryInput.tsx` (Double-Entry Person Linking)

This is the input bar at the bottom. Add an optional person selector toggle.

**Add to props:**
```typescript
import type { Person } from '@/lib/types';

interface EntryInputProps {
  onAdd: (rawText: string, amount: number, note: string, type: string, linkedPersonId?: string, linkedPersonName?: string) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  persons?: Person[];  // ADD
}
```

**Add person linking state:**
```typescript
const [linkedPerson, setLinkedPerson] = useState<Person | null>(null);
const [showPersonPicker, setShowPersonPicker] = useState(false);
```

**Update `handleSubmit` to pass linked person:**
```typescript
await onAdd(p.rawText, p.amount, p.note, p.type, linkedPerson?.id, linkedPerson?.name);
setLinkedPerson(null); // reset after submit
```

**Add person picker UI above the input row:**
```tsx
{/* Person link toggle — only show if persons exist */}
{persons && persons.length > 0 && (
  <div className="flex items-center gap-2 mb-2">
    {linkedPerson ? (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium"
        style={{ background: 'var(--color-accent-bg)', color: 'var(--color-accent)' }}
      >
        <span>👤 {linkedPerson.name}</span>
        <button onClick={() => setLinkedPerson(null)}>
          <X size={12} />
        </button>
      </div>
    ) : (
      <button
        onClick={() => setShowPersonPicker(!showPersonPicker)}
        className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs"
        style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-dim)' }}
      >
        <span>👤</span> Link person
      </button>
    )}
  </div>
)}

{/* Person picker dropdown */}
{showPersonPicker && persons && persons.length > 0 && (
  <div
    className="mb-2 rounded-xl overflow-hidden"
    style={{ border: '1px solid var(--color-border)' }}
  >
    {persons.map(p => (
      <button
        key={p.id}
        className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-left"
        style={{
          background: linkedPerson?.id === p.id ? 'var(--color-accent-bg)' : 'var(--color-surface-2)',
          color: linkedPerson?.id === p.id ? 'var(--color-accent)' : 'var(--color-text)',
          borderBottom: '1px solid var(--color-border)',
        }}
        onClick={() => {
          setLinkedPerson(p);
          setShowPersonPicker(false);
        }}
      >
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-muted)' }}
        >
          {p.name[0].toUpperCase()}
        </span>
        {p.name}
      </button>
    ))}
  </div>
)}
```

---

## STEP 11 — UPDATE `components/people/PersonLedger.tsx` (Dexie + Running Balance)

Replace Firestore calls with Dexie calls:

```typescript
// Replace imports:
import { localGetPersonEntries, localAddPersonEntry, localDeletePersonEntry, localUpdatePersonEntry, computeRunningBalance } from '@/lib/entries';
// Remove: import { getPersonEntries, addPersonEntry, deletePersonEntry, updatePersonEntry } from '@/lib/firestore';
```

Replace `load`:
```typescript
const load = useCallback(async () => {
  try {
    const data = await localGetPersonEntries(person.id);
    setEntries(data);
  } finally {
    setLoading(false);
  }
}, [person.id]);
```

Replace `handleAdd`:
```typescript
const handleAdd = async (rawText: string, amount: number, note: string) => {
  const entry = await localAddPersonEntry(userId, person.id, {
    rawText, amount, note, entryDate: new Date(),
  });
  setEntries(prev => [entry, ...prev]);
};
```

Replace `handleDelete`:
```typescript
const handleDelete = async (e: PersonEntry) => {
  await localDeletePersonEntry(e.id);
  setEntries(prev => prev.filter(x => x.id !== e.id));
};
```

Add running balance to rendering:
```typescript
const entriesWithBalance = computeRunningBalance(entries);
```

Pass `runningBalance` to each `EntryItem`:
```tsx
{entriesWithBalance.map((entry) => (
  <EntryItem
    key={entry.id}
    entry={entry}
    runningBalance={entry.runningBalance}
    onDelete={() => handleDelete(entry)}
    onEdit={() => setEditEntry(entry)}
  />
))}
```

---

## STEP 12 — ADD PDF EXPORT (`lib/pdf.ts`)

Create this file:

```typescript
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { Entry, PersonEntry } from '@/lib/types';
import { computeRunningBalance } from '@/lib/entries';
import { formatAmount } from '@/lib/parser';

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function createBasePdf(title: string): Promise<{ pdfDoc: PDFDocument; page: ReturnType<PDFDocument['addPage']>; font: Awaited<ReturnType<PDFDocument['embedFont']>>; boldFont: Awaited<ReturnType<PDFDocument['embedFont']>>; y: number; pageWidth: number }> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width } = page.getSize();

  // Header
  page.drawRectangle({ x: 0, y: 792, width, height: 50, color: rgb(0.49, 0.43, 0.97) });
  page.drawText('MoneyAI', { x: 40, y: 810, size: 14, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText(title, { x: 40, y: 795, size: 11, font, color: rgb(0.9, 0.9, 1) });
  page.drawText(`Generated: ${new Date().toLocaleDateString('en-IN')}`, {
    x: width - 160, y: 802, size: 9, font, color: rgb(0.9, 0.9, 1),
  });

  return { pdfDoc, page, font, boldFont, y: 770, pageWidth: width };
}

export async function exportWindowToPDF(windowTitle: string, entries: Entry[]): Promise<void> {
  const { pdfDoc, page, font, boldFont, pageWidth } = await createBasePdf(windowTitle);
  const { height } = page.getSize();
  let y = height - 80;
  const margin = 40;
  const col = { date: margin, note: margin + 80, amount: pageWidth - 160, balance: pageWidth - 60 };

  // Column headers
  const drawHeader = (pg: ReturnType<PDFDocument['addPage']>, yPos: number) => {
    pg.drawLine({ start: { x: margin, y: yPos }, end: { x: pageWidth - margin, y: yPos }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    pg.drawText('Date', { x: col.date, y: yPos - 14, size: 8, font: boldFont, color: rgb(0.5, 0.5, 0.5) });
    pg.drawText('Description', { x: col.note, y: yPos - 14, size: 8, font: boldFont, color: rgb(0.5, 0.5, 0.5) });
    pg.drawText('Amount', { x: col.amount - 30, y: yPos - 14, size: 8, font: boldFont, color: rgb(0.5, 0.5, 0.5) });
    pg.drawText('Balance', { x: col.balance - 30, y: yPos - 14, size: 8, font: boldFont, color: rgb(0.5, 0.5, 0.5) });
    return yPos - 28;
  };

  y = drawHeader(page, y);
  const withBalance = computeRunningBalance(entries);
  let currentPage = page;

  for (const entry of withBalance) {
    if (y < 60) {
      currentPage = pdfDoc.addPage([595, 842]);
      y = 800;
      y = drawHeader(currentPage, y);
    }

    const isPositive = entry.amount >= 0;
    const amtColor = isPositive ? rgb(0.13, 0.83, 0.63) : rgb(0.97, 0.44, 0.44);
    const balColor = entry.runningBalance >= 0 ? rgb(0.13, 0.83, 0.63) : rgb(0.97, 0.44, 0.44);

    currentPage.drawText(formatDate(entry.entryDate), { x: col.date, y, size: 8, font, color: rgb(0.3, 0.3, 0.3) });

    const noteText = (entry.note || entry.rawText).slice(0, 35);
    currentPage.drawText(noteText, { x: col.note, y, size: 9, font, color: rgb(0.1, 0.1, 0.1) });

    const amtText = formatAmount(entry.amount);
    currentPage.drawText(amtText, { x: col.amount - amtText.length * 4, y, size: 9, font: boldFont, color: amtColor });

    const balText = `₹${Math.abs(entry.runningBalance).toLocaleString('en-IN')}`;
    currentPage.drawText(balText, { x: col.balance - balText.length * 4, y, size: 9, font: boldFont, color: balColor });

    currentPage.drawLine({
      start: { x: margin, y: y - 4 },
      end: { x: pageWidth - margin, y: y - 4 },
      thickness: 0.3,
      color: rgb(0.93, 0.93, 0.93),
    });
    y -= 20;
  }

  // Total row
  const total = entries.reduce((s, e) => s + e.amount, 0);
  if (y < 60) { currentPage = pdfDoc.addPage([595, 842]); y = 800; }
  currentPage.drawLine({ start: { x: margin, y: y }, end: { x: pageWidth - margin, y }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
  currentPage.drawText('TOTAL', { x: col.note, y: y - 14, size: 9, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
  const totalText = formatAmount(total);
  const totalColor = total >= 0 ? rgb(0.13, 0.83, 0.63) : rgb(0.97, 0.44, 0.44);
  currentPage.drawText(totalText, { x: col.balance - totalText.length * 4, y: y - 14, size: 11, font: boldFont, color: totalColor });

  const pdfBytes = await pdfDoc.save();
  downloadPdf(pdfBytes, `${windowTitle}.pdf`);
}

export async function exportPersonToPDF(personName: string, entries: PersonEntry[]): Promise<void> {
  const { pdfDoc, page, font, boldFont, pageWidth } = await createBasePdf(`${personName} — Ledger`);
  const { height } = page.getSize();
  let y = height - 80;
  const margin = 40;

  const withBalance = computeRunningBalance(entries);
  for (const entry of withBalance) {
    if (y < 60) { pdfDoc.addPage([595, 842]); y = 800; }
    const isPositive = entry.amount >= 0;
    page.drawText(formatDate(entry.entryDate), { x: margin, y, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
    page.drawText((entry.note || entry.rawText).slice(0, 40), { x: margin + 80, y, size: 9, font, color: rgb(0.1, 0.1, 0.1) });
    const amtText = formatAmount(entry.amount);
    page.drawText(amtText, { x: pageWidth - 160, y, size: 9, font: boldFont, color: isPositive ? rgb(0.13, 0.83, 0.63) : rgb(0.97, 0.44, 0.44) });
    const balText = `₹${Math.abs(entry.runningBalance).toLocaleString('en-IN')}`;
    page.drawText(balText, { x: pageWidth - 60 - balText.length * 4, y, size: 9, font: boldFont, color: entry.runningBalance >= 0 ? rgb(0.13, 0.83, 0.63) : rgb(0.97, 0.44, 0.44) });
    y -= 20;
  }

  const pdfBytes = await pdfDoc.save();
  downloadPdf(pdfBytes, `${personName}-ledger.pdf`);
}

function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

## STEP 13 — ADD PDF BUTTON TO WindowView AND PersonLedger

**In `WindowView.tsx`**, add PDF export button next to the CSV button:

```typescript
// Add import:
import { exportWindowToPDF } from '@/lib/pdf';
```

```tsx
// Next to the CSV button:
<button
  onClick={() => exportWindowToPDF(w.title, entries)}
  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
  style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
>
  <Download size={13} />
  PDF
</button>
```

**In `PersonLedger.tsx`**, add PDF export next to CSV:

```typescript
import { exportPersonToPDF } from '@/lib/pdf';
```

```tsx
<button
  onClick={() => exportPersonToPDF(person.name, entries)}
  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
  style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
>
  <Download size={13} />
  PDF
</button>
```

---

## STEP 14 — UPDATE `app/personal/page.tsx` (Use Dexie Instead of Firestore)

Replace the Firestore imports and calls:

```typescript
// REMOVE these imports:
// import { getTabs, getWindows, addWindow, updateWindow, softDeleteWindow, getEntries, ensureMonthWindow } from '@/lib/firestore';

// ADD these imports:
import { useStore } from '@/store/useStore';
import { getDb } from '@/lib/db';
import { localGetEntries } from '@/lib/entries';
import { getMonthKey, getMonthWindowTitle } from '@/lib/utils';
```

Replace the `load` function in `PersonalContent`:
```typescript
const { loadWindows, addWindow, updateWindow: updateWindowStore, softDeleteWindow } = useStore();

const load = useCallback(async () => {
  if (!user) return;
  try {
    const db = getDb();

    // Get personal tab from Dexie
    const tabs = await db.tabs.where('userId').equals(user.uid).toArray();
    const pTab = tabs.find(t => t.type === 'personal') || null;
    setPersonalTab(pTab);
    if (!pTab) { setLoading(false); return; }

    // Ensure current month window exists
    const key = getMonthKey();
    const existing = await db.windows
      .where('tabId').equals(pTab.id)
      .filter(w => w.monthKey === key)
      .count();

    if (existing === 0) {
      await addWindow(user.uid, pTab.id, getMonthWindowTitle(), { autoMonthly: true, monthKey: key, pinned: true });
    }

    const wins = await loadWindows(user.uid, pTab.id);
    setWindows(wins);

    // Load totals from Dexie
    const stats: Record<string, { total: number; count: number }> = {};
    await Promise.all(wins.map(async (w) => {
      const entries = await localGetEntries(w.id);
      stats[w.id] = {
        total: entries.reduce((s, e) => s + e.amount, 0),
        count: entries.length,
      };
    }));
    setWindowStats(stats);
  } finally {
    setLoading(false);
  }
}, [user, addWindow, loadWindows]);
```

Pass `persons` to `WindowView`:
```typescript
const { persons } = useStore();
// ...
<WindowView window={selectedWindow} userId={user.uid} onBack={handleBack} persons={persons} />
```

---

## STEP 15 — UPDATE `app/people/page.tsx` (Use Dexie)

Similar pattern to personal page — replace all Firestore calls with Dexie/store calls.

```typescript
import { useStore } from '@/store/useStore';
import { getDb } from '@/lib/db';
import { localGetPersonEntries } from '@/lib/entries';

// In PeopleContent, replace load:
const { loadPersons, addPerson: addPersonStore, deletePerson: deletePersonStore } = useStore();

const load = useCallback(async () => {
  if (!user) return;
  try {
    const pList = await loadPersons(user.uid);
    setPersons(pList);

    const bal: Record<string, { balance: number; count: number }> = {};
    await Promise.all(pList.map(async (p) => {
      const entries = await localGetPersonEntries(p.id);
      bal[p.id] = {
        balance: entries.reduce((s, e) => s + e.amount, 0),
        count: entries.length,
      };
    }));
    setBalances(bal);
  } finally {
    setLoading(false);
  }
}, [user, loadPersons]);
```

---

## STEP 16 — UPDATE `app/vault/page.tsx` (Use Dexie)

```typescript
import { getDb } from '@/lib/db';
import { queueSync } from '@/lib/sync';
import { v4 as uuid } from 'uuid';

// Replace load:
const load = useCallback(async () => {
  if (!user) return;
  try {
    const db = getDb();
    const data = await db.vault.where('userId').equals(user.uid).reverse().sortBy('createdAt');
    setItems(data);
  } finally {
    setLoading(false);
  }
}, [user]);

// Replace handleAdd:
const handleAdd = async (type: VaultType, title: string, fields: Record<string, string>) => {
  if (!user) return;
  const db = getDb();
  const id = uuid();
  const now = new Date();
  const item = { id, userId: user.uid, type, title, fields, createdAt: now, updatedAt: now };
  await db.vault.add(item);
  await queueSync('vault', 'upsert', id, item as unknown as Record<string, unknown>);
  load();
};

// Replace handleDelete:
const handleDelete = async (item: VaultItem) => {
  const db = getDb();
  await db.vault.delete(item.id);
  await queueSync('vault', 'delete', item.id);
  setDeleteTarget(null);
  load();
};
```

---

## STEP 17 — UPDATE `app/search/page.tsx` (Use Dexie)

```typescript
import { getDb } from '@/lib/db';
// Remove: import { searchEntries } from '@/lib/firestore';

// Replace the allEntries fetch:
if (!pool) {
  setLoading(true);
  try {
    const db = getDb();
    pool = await db.entries.where('userId').equals(user!.uid).reverse().sortBy('entryDate');
    setAllEntries(pool);
  } finally {
    setLoading(false);
  }
}
```

---

## STEP 18 — UPDATE `app/archive/page.tsx` (Use Dexie)

```typescript
import { getDb } from '@/lib/db';
import { useStore } from '@/store/useStore';
// Remove Firestore imports for windows

// Replace load:
const load = useCallback(async () => {
  if (!user) return;
  try {
    const db = getDb();
    const [archivedWins, recycledWins, tabs] = await Promise.all([
      db.windows.where('userId').equals(user.uid).filter(w => w.archived && !w.inRecycleBin).toArray(),
      db.windows.where('userId').equals(user.uid).filter(w => w.inRecycleBin).toArray(),
      db.tabs.where('userId').equals(user.uid).toArray(),
    ]);
    setArchived(archivedWins);
    setRecycled(recycledWins);
    setTabs(tabs);
  } finally {
    setLoading(false);
  }
}, [user]);
```

---

## STEP 19 — DOUBLE-ENTRY LOGIC IN `localAddEntry`

This is already handled in `lib/entries.ts` via the `linkedPersonId` parameter.

When the user selects a person in the EntryInput and submits:
1. `localAddEntry` saves the window entry with `linkedPersonId` set
2. After `localAddEntry` returns, the calling code (WindowView `handleAdd`) also calls `localAddPersonEntry` with the reverse amount

**Update `WindowView.tsx` `handleAdd`:**
```typescript
const handleAdd = async (
  rawText: string,
  amount: number,
  note: string,
  type: string,
  linkedPersonId?: string,
  linkedPersonName?: string
) => {
  // Step 1: Save window entry
  const entry = await localAddEntry(userId, w.id, {
    rawText, amount, note, type,
    entryDate: new Date(),
    linkedPersonId,
    linkedPersonName,
  });

  // Step 2: If linked to a person, create the mirror person entry
  // Person entry amount is OPPOSITE sign — if you spent -1000 (personal went down),
  // then person now owes you +1000
  if (linkedPersonId) {
    await localAddPersonEntry(userId, linkedPersonId, {
      rawText: `${note || rawText} (from ${w.title})`,
      amount: -amount, // opposite direction
      note: note || rawText,
      entryDate: new Date(),
      linkedEntryId: entry.id,
      linkedWindowId: w.id,
    });
  }

  setEntries(prev => [entry, ...prev]);
};
```

---

## STEP 20 — FIRESTORE INDEXES UPDATE (`firestore.indexes.json`)

Add these new indexes for the `linkedPersonId` and `linkedEntryId` fields:

```json
{
  "collectionGroup": "entries",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "linkedPersonId", "order": "ASCENDING" },
    { "fieldPath": "entryDate", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "personEntries",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "personId", "order": "ASCENDING" },
    { "fieldPath": "linkedEntryId", "order": "ASCENDING" }
  ]
}
```

---

## STEP 21 — DEPLOY

After all changes compile:

```bash
npm run build
```

If build passes:
```bash
git add .
git commit -m "feat: offline-first Dexie, running balance, double-entry, PDF export"
git push origin main
```

Firebase auto-deploys via GitHub Actions.

Also deploy Firestore indexes and rules:
```bash
firebase deploy --only firestore:indexes,firestore:rules
```

---

## EXECUTION ORDER

```
[ ] STEP 1  — Install packages
[ ] STEP 2  — Create lib/db.ts
[ ] STEP 3  — Update lib/types.ts (add linkedPersonId, linkedEntryId)
[ ] STEP 4  — Create lib/sync.ts
[ ] STEP 5  — Create store/useStore.ts
[ ] STEP 6  — Create lib/entries.ts
[ ] STEP 7  — Update contexts/AuthContext.tsx
[ ] STEP 8  — Update components/windows/WindowView.tsx
[ ] STEP 9  — Update components/entry/EntryItem.tsx (running balance)
[ ] STEP 10 — Update components/entry/EntryInput.tsx (person linking)
[ ] STEP 11 — Update components/people/PersonLedger.tsx
[ ] STEP 12 — Create lib/pdf.ts
[ ] STEP 13 — Add PDF buttons to WindowView + PersonLedger
[ ] STEP 14 — Update app/personal/page.tsx
[ ] STEP 15 — Update app/people/page.tsx
[ ] STEP 16 — Update app/vault/page.tsx
[ ] STEP 17 — Update app/search/page.tsx
[ ] STEP 18 — Update app/archive/page.tsx
[ ] STEP 19 — Double-entry logic in WindowView handleAdd
[ ] STEP 20 — Update firestore.indexes.json
[ ] STEP 21 — npm run build → git push
```

---

## FINAL TEST CHECKLIST

```
OFFLINE-FIRST
[ ] Turn off internet → add 3 entries → turn internet back on
    → entries should sync to Firestore automatically
[ ] Open app with no internet → all existing data visible immediately
[ ] Refresh page → data loads instantly from IndexedDB, no loading spinner

RUNNING BALANCE
[ ] Add 5 entries in a window → each row shows running balance on right
[ ] Delete middle entry → running balances of all subsequent entries update
[ ] Edit an entry amount → running balances recalculate

DOUBLE-ENTRY
[ ] In Personal window, type "-1000 ration", link to Sahil
    → Sahil's People ledger shows +₹1,000 automatically
[ ] Delete that entry → Sahil's +₹1,000 also disappears
[ ] In Sahil's ledger, manually add "-500 returned"
    → Sahil's balance goes from +1000 to +500

PDF EXPORT
[ ] Open any window → click PDF → PDF downloads with running balance column
[ ] Open any person ledger → click PDF → PDF downloads with correct balance

MOBILE
[ ] All pages usable on 375px screen
[ ] Person picker in entry input works on mobile tap
[ ] Running balance column fits on small screen
[ ] PDF/CSV buttons accessible on mobile
```

---

## GEMINI API KEY — FUTURE USE

Keep `NEXT_PUBLIC_GEMINI_API_KEY` in `.env.local` and `.env.example`.
Do not remove it. It is reserved for a future AI advisor feature.
No code changes needed for this now.

---

*Agent instructions for MoneyAI · May 2026*
