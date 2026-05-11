'use client';

import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import type { Table } from 'dexie';
import { getDb } from '@/lib/db';
import { db as firestoreDb } from '@/lib/firebase';

type SyncCollection = 'tabs' | 'windows' | 'entries' | 'persons' | 'personEntries' | 'vault';

/**
 * Recursively convert Date objects (and date-like ISO strings) to Firestore Timestamps.
 * This handles the case where IndexedDB serializes nested Dates back as strings.
 */
function toFirestore(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Date) {
      result[key] = Timestamp.fromDate(value);
    } else if (typeof value === 'string' && isIsoDateString(value)) {
      // IndexedDB may have serialised Date to ISO string inside nested 'data'
      result[key] = Timestamp.fromDate(new Date(value));
    } else if (value === undefined) {
      result[key] = deleteField();
    } else {
      result[key] = value;
    }
  }

  return result;
}

/** Check if a string looks like an ISO-8601 date */
function isIsoDateString(s: string): boolean {
  // Match: 2026-05-11T06:30:00.000Z  or  2026-05-11T12:06:43+05:30
  if (s.length < 20 || s.length > 35) return false;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s);
}

function fromFirestore(data: Record<string, unknown>, id: string): Record<string, unknown> {
  const converted: Record<string, unknown> = { ...data, id };

  for (const [key, value] of Object.entries(converted)) {
    if (value instanceof Timestamp) {
      converted[key] = value.toDate();
    }
  }

  return converted;
}

export async function queueSync(
  collectionName: SyncCollection,
  operation: 'upsert' | 'delete',
  documentId: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (typeof window === 'undefined') return;

  const db = getDb();
  await db.syncQueue.add({
    collection: collectionName,
    operation,
    documentId,
    data,
    createdAt: Date.now(),
    retries: 0,
  });

  if (navigator.onLine) {
    processSyncQueue().catch(() => undefined);
  }
}

export async function processSyncQueue(): Promise<void> {
  if (typeof window === 'undefined' || !navigator.onLine) return;

  const db = getDb();
  const items = await db.syncQueue.orderBy('createdAt').limit(100).toArray();
  if (items.length === 0) return;

  for (const item of items) {
    if (item.id === undefined) continue;

    try {
      if (item.operation === 'upsert' && item.data) {
        await setDoc(doc(firestoreDb, item.collection, item.documentId), toFirestore(item.data), {
          merge: true,
        });
      } else if (item.operation === 'delete') {
        await deleteDoc(doc(firestoreDb, item.collection, item.documentId));
      }

      await db.syncQueue.delete(item.id);
    } catch (err) {
      console.warn(`Sync failed for ${item.collection}/${item.documentId}:`, err);
      const retries = item.retries + 1;

      if (retries >= 5) {
        await db.syncQueue.delete(item.id);
      } else {
        await db.syncQueue.update(item.id, { retries });
      }
    }
  }
}

/**
 * Pull all data from Firestore and upsert into local Dexie.
 * Called on every app load / auth state change.
 */
export async function hydrateFromFirestore(userId: string): Promise<void> {
  if (typeof window === 'undefined') return;

  const db = getDb();
  const collections: SyncCollection[] = [
    'tabs',
    'windows',
    'entries',
    'persons',
    'personEntries',
    'vault',
  ];

  for (const collectionName of collections) {
    try {
      const q = query(collection(firestoreDb, collectionName), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      if (snapshot.empty) continue;

      const records = snapshot.docs.map((snapshotDoc) =>
        fromFirestore(snapshotDoc.data(), snapshotDoc.id)
      );
      const table = db.table(collectionName) as Table<Record<string, unknown>, string>;
      await table.bulkPut(records);
    } catch (err) {
      console.error(`Failed to hydrate ${collectionName}:`, err);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// REAL-TIME SYNC — Firestore onSnapshot listeners so other devices see changes
// ──────────────────────────────────────────────────────────────────────────────

type Unsubscribe = () => void;

let activeListeners: Unsubscribe[] = [];

/**
 * Start real-time Firestore listeners for all collections.
 * When another device writes to Firestore, these listeners update Dexie,
 * and the store re-initialises so the UI reflects the change.
 */
export function startRealtimeSync(userId: string): () => void {
  // Tear down any previous listeners first
  stopRealtimeSync();

  if (typeof window === 'undefined') return () => undefined;

  const db = getDb();
  const collections: SyncCollection[] = [
    'tabs',
    'windows',
    'entries',
    'persons',
    'personEntries',
    'vault',
  ];

  // Debounce store refresh — multiple snapshots fire close together
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleStoreRefresh = () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      try {
        // Dynamic import to avoid circular dependency
        const { useStore } = await import('@/store/useStore');
        const state = useStore.getState();
        if (state.userId) {
          await state.init(state.userId);
        }
      } catch {
        // Store not ready yet — ignore
      }
    }, 500);
  };

  for (const collectionName of collections) {
    try {
      const q = query(collection(firestoreDb, collectionName), where('userId', '==', userId));

      const unsub = onSnapshot(
        q,
        { includeMetadataChanges: false },
        async (snapshot) => {
          // Skip snapshots that originate from LOCAL writes (hasPendingWrites)
          // to avoid re-processing data we just wrote.
          if (snapshot.metadata.hasPendingWrites) return;

          const table = db.table(collectionName) as Table<Record<string, unknown>, string>;

          for (const change of snapshot.docChanges()) {
            if (change.type === 'removed') {
              try {
                await table.delete(change.doc.id);
              } catch {
                // Record might not exist locally — fine
              }
            } else {
              // 'added' or 'modified'
              const record = fromFirestore(change.doc.data(), change.doc.id);
              try {
                await table.put(record);
              } catch {
                // Schema mismatch or constraint — ignore
              }
            }
          }

          // Refresh store so UI picks up the changes
          scheduleStoreRefresh();
        },
        (error) => {
          console.warn(`Realtime listener error for ${collectionName}:`, error);
        }
      );

      activeListeners.push(unsub);
    } catch (err) {
      console.warn(`Failed to start listener for ${collectionName}:`, err);
    }
  }

  return () => stopRealtimeSync();
}

/** Tear down all active Firestore listeners. */
export function stopRealtimeSync(): void {
  for (const unsub of activeListeners) {
    try {
      unsub();
    } catch {
      // already cleaned up
    }
  }
  activeListeners = [];
}

/**
 * Setup online/offline event listener to flush sync queue.
 */
export function setupSyncListener(): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const handleOnline = () => {
    processSyncQueue().catch(() => undefined);
  };

  window.addEventListener('online', handleOnline);

  if (navigator.onLine) {
    handleOnline();
  }

  return () => window.removeEventListener('online', handleOnline);
}

export async function clearLocalData(): Promise<void> {
  const db = getDb();
  await Promise.all([
    db.tabs.clear(),
    db.windows.clear(),
    db.entries.clear(),
    db.persons.clear(),
    db.personEntries.clear(),
    db.vault.clear(),
    db.syncQueue.clear(),
  ]);
}
