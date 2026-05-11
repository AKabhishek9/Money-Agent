'use client';

import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import type { Table } from 'dexie';
import { getDb } from '@/lib/db';
import { db as firestoreDb } from '@/lib/firebase';

type SyncCollection = 'tabs' | 'windows' | 'entries' | 'persons' | 'personEntries' | 'vault';

function toFirestore(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Date) {
      result[key] = Timestamp.fromDate(value);
    } else if (value === undefined) {
      result[key] = deleteField();
    } else {
      result[key] = value;
    }
  }

  return result;
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
    } catch {
      const retries = item.retries + 1;

      if (retries >= 5) {
        await db.syncQueue.delete(item.id);
      } else {
        await db.syncQueue.update(item.id, { retries });
      }
    }
  }
}

export async function hydrateFromFirestore(userId: string): Promise<void> {
  if (typeof window === 'undefined') return;

  const db = getDb();
  // Pull everything from Firestore and merge with local data using bulkPut (upsert)
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
