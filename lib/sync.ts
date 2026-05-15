'use client';

import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  getDocsFromServer,
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

const SYNC_COLLECTIONS: SyncCollection[] = [
  'tabs',
  'windows',
  'entries',
  'persons',
  'personEntries',
  'vault',
];

/** How long (ms) a recycle-bin window is kept before hard deletion. */
const BIN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

let isProcessing = false;

// ── Loop-guard: remember IDs we just wrote locally so incoming realtime
//    snapshots don't echo them back as "remote changes".
const recentLocalSyncIds = new Map<string, number>();
const RECENT_LOCAL_SYNC_TTL_MS = 30_000;

function syncDocumentKey(collectionName: SyncCollection, documentId: string): string {
  return `${collectionName}:${documentId}`;
}

function rememberLocalSync(collectionName: SyncCollection, documentId: string): void {
  recentLocalSyncIds.set(syncDocumentKey(collectionName, documentId), Date.now());
}

function isRecentLocalSync(collectionName: SyncCollection, documentId: string): boolean {
  const now = Date.now();
  for (const [key, createdAt] of recentLocalSyncIds) {
    if (now - createdAt > RECENT_LOCAL_SYNC_TTL_MS) {
      recentLocalSyncIds.delete(key);
    }
  }
  return recentLocalSyncIds.has(syncDocumentKey(collectionName, documentId));
}

function notifyRemoteSync(collectionName: SyncCollection): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('money-ledger-remote-sync', { detail: { collection: collectionName } })
  );
}

// ── Date / Timestamp helpers ──────────────────────────────────────────────────

/** Recursively convert Dates (and ISO strings) → Firestore Timestamps. */
function toFirestore(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Date) {
      result[key] = Timestamp.fromDate(value);
    } else if (typeof value === 'string' && isIsoDateString(value)) {
      result[key] = Timestamp.fromDate(new Date(value));
    } else if (value === undefined) {
      result[key] = deleteField();
    } else {
      result[key] = value;
    }
  }
  return result;
}

function isIsoDateString(s: string): boolean {
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

// ── lastSyncTime helpers ──────────────────────────────────────────────────────

async function getLastSyncTime(): Promise<Date | null> {
  const db = getDb();
  const record = await db.lastSync.get('global');
  return record ? new Date(record.value) : null;
}

async function saveLastSyncTime(time: Date = new Date()): Promise<void> {
  const db = getDb();
  await db.lastSync.put({ key: 'global', value: time.toISOString() });
}

// ── Sync Queue ────────────────────────────────────────────────────────────────

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
  if (isProcessing) return;

  isProcessing = true;
  const syncedAt = new Date();

  try {
    const db = getDb();
    const items = await db.syncQueue.orderBy('createdAt').limit(100).toArray();
    if (items.length === 0) return;

    let anySuccess = false;

    for (const item of items) {
      if (item.id === undefined) continue;

      try {
        if (item.operation === 'upsert' && item.data) {
          await setDoc(
            doc(firestoreDb, item.collection, item.documentId),
            toFirestore(item.data),
            { merge: true }
          );
        } else if (item.operation === 'delete') {
          await deleteDoc(doc(firestoreDb, item.collection, item.documentId));
        }

        rememberLocalSync(item.collection, item.documentId);
        await db.syncQueue.delete(item.id);
        anySuccess = true;
      } catch (err) {
        console.warn(`Sync failed for ${item.collection}/${item.documentId}:`, err);
        const retries = item.retries + 1;

        if (retries >= 5) {
          rememberLocalSync(item.collection, item.documentId);
          await db.syncQueue.delete(item.id);
        } else {
          await db.syncQueue.update(item.id, { retries });
        }
      }
    }

    // Persist lastSyncTime only after we successfully pushed something
    if (anySuccess) {
      await saveLastSyncTime(syncedAt);
    }
  } finally {
    isProcessing = false;
  }
}

// ── Full Hydration (new device — runs ONCE) ───────────────────────────────────

async function fullHydrateFromFirestore(userId: string): Promise<void> {
  const db = getDb();
  const syncedAt = new Date();
  let atLeastOneSynced = false;

  await Promise.allSettled(
    SYNC_COLLECTIONS.map(async (collectionName) => {
      let attempts = 0;
      while (attempts < 3) {
        attempts++;
        try {
          const q = query(
            collection(firestoreDb, collectionName),
            where('userId', '==', userId)
          );
          // getDocsFromServer bypasses Firestore's local IndexedDB cache.
          // Essential when user clears browser data — cache is wiped but
          // getDocs would return empty instead of fetching from server.
          const snapshot = await getDocsFromServer(q);
          if (snapshot.empty) break;

          const records = snapshot.docs.map((d) => fromFirestore(d.data(), d.id));
          const table = db.table(collectionName) as Table<Record<string, unknown>, string>;
          await table.bulkPut(records);
          atLeastOneSynced = true;
          break;
        } catch (err) {
          console.warn(`Hydration attempt ${attempts}/3 failed for ${collectionName}:`, err);
          if (attempts < 3) {
            await new Promise((r) => setTimeout(r, attempts * 1500));
          }
        }
      }
    })
  );

  // Only mark synced if at least one collection returned real data.
  // If all failed (offline/blocked), don't save lastSyncTime so next
  // app open tries full hydration again instead of delta sync.
  if (atLeastOneSynced) {
    await saveLastSyncTime(syncedAt);
  }
}

// ── Incremental Delta Sync (existing device) ──────────────────────────────────

/**
 * Exported: called on app startup.
 *
 * • New device  (lastSync == null) → full hydration, saves lastSyncTime
 * • Existing    (lastSync exists)  → only fetch docs where updatedAt > lastSyncTime
 */
export async function incrementalSync(userId: string): Promise<boolean> {
  if (typeof window === 'undefined' || !navigator.onLine) return false;

  const lastSyncTime = await getLastSyncTime();

  if (!lastSyncTime) {
    // ── NEW DEVICE: full hydration once ──
    await fullHydrateFromFirestore(userId);
    return true;
  }

  // ── EXISTING DEVICE: delta sync ──
  const db = getDb();
  const since = Timestamp.fromDate(lastSyncTime);
  const syncedAt = new Date();

  await Promise.allSettled(
    SYNC_COLLECTIONS.map(async (collectionName) => {
      try {
        const q = query(
          collection(firestoreDb, collectionName),
          where('userId', '==', userId),
          where('updatedAt', '>', since)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return;

        const table = db.table(collectionName) as Table<Record<string, unknown>, string>;

        for (const snapshotDoc of snapshot.docs) {
          const record = fromFirestore(snapshotDoc.data(), snapshotDoc.id);
          await table.put(record);
        }
      } catch (err) {
        console.warn(`Delta sync failed for ${collectionName}:`, err);
      }
    })
  );

  await saveLastSyncTime(syncedAt);
  return false;
}

/**
 * Legacy wrapper kept for any call sites that still use hydrateFromFirestore.
 * Routes to incrementalSync internally.
 */
export async function hydrateFromFirestore(userId: string): Promise<boolean> {
  return incrementalSync(userId);
}

// ── 30-day Recycle Bin Auto-Delete ───────────────────────────────────────────

/**
 * Hard-delete windows that have been in the recycle bin for more than 30 days.
 * Called once on app startup after local data is ready.
 */
export async function purgeExpiredBinItems(userId: string): Promise<void> {
  if (typeof window === 'undefined') return;

  const db = getDb();
  const cutoff = new Date(Date.now() - BIN_TTL_MS);

  const expiredWindows = await db.windows
    .where('userId')
    .equals(userId)
    .filter(
      (w) =>
        w.inRecycleBin === true &&
        // Use deletedAt if present, else fall back to updatedAt, then createdAt
        ((w.deletedAt ?? w.updatedAt ?? w.createdAt) as Date) < cutoff
    )
    .toArray();

  for (const window of expiredWindows) {
    // Delete all entries in this window
    const entries = await db.entries.where('windowId').equals(window.id).toArray();
    for (const entry of entries) {
      await db.entries.delete(entry.id);
      await queueSync('entries', 'delete', entry.id);
    }

    await db.windows.delete(window.id);
    await queueSync('windows', 'delete', window.id);
  }
}

// ── Real-time Sync — surgical Dexie + Zustand patches ────────────────────────

type Unsubscribe = () => void;
let activeListeners: Unsubscribe[] = [];

/**
 * Start real-time Firestore listeners for all collections.
 *
 * KEY CHANGE vs old code: instead of calling state.init() (which reloads
 * everything), we now patch ONLY the changed document directly into Dexie
 * and then notify the store via a targeted action.
 */
export function startRealtimeSync(userId: string): () => void {
  stopRealtimeSync();

  if (typeof window === 'undefined') return () => undefined;

  const db = getDb();

  for (const collectionName of SYNC_COLLECTIONS) {
    try {
      const q = query(
        collection(firestoreDb, collectionName),
        where('userId', '==', userId)
      );

      const unsub = onSnapshot(
        q,
        { includeMetadataChanges: true },
        async (snapshot) => {
          // Ignore writes that are still pending locally
          const hasServerChanges = snapshot.docChanges().some(
            (change) => !change.doc.metadata.hasPendingWrites
          );
          if (!hasServerChanges) return;

          const queuedIds = new Set(
            (await db.syncQueue.toArray()).map((item) => item.documentId)
          );

          const genuinelyRemoteChanges = snapshot.docChanges().filter(
            (change) =>
              !queuedIds.has(change.doc.id) &&
              !isRecentLocalSync(collectionName, change.doc.id) &&
              !change.doc.metadata.hasPendingWrites
          );

          if (genuinelyRemoteChanges.length === 0) return;

          const table = db.table(collectionName) as Table<Record<string, unknown>, string>;

          for (const change of genuinelyRemoteChanges) {
            if (change.type === 'removed') {
              await table.delete(change.doc.id).catch(() => undefined);
            } else {
              const record = fromFirestore(change.doc.data(), change.doc.id);
              await table.put(record).catch(() => undefined);

              // Surgically patch the Zustand store instead of reinitialising
              await patchStoreWithRemoteDoc(collectionName, record);
            }
          }

          notifyRemoteSync(collectionName);
          // Update lastSyncTime to now so next incremental sync is fresh
          await saveLastSyncTime();
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

/**
 * Patch only the affected document in the Zustand store.
 * This replaces the old `state.init()` full-reload pattern.
 */
async function patchStoreWithRemoteDoc(
  collectionName: SyncCollection,
  record: Record<string, unknown>
): Promise<void> {
  try {
    const { useStore } = await import('@/store/useStore');
    const state = useStore.getState();

    if (!state.userId) return;

    if (collectionName === 'tabs') {
      state.patchTab(record as never);
    } else if (collectionName === 'windows') {
      state.patchWindow(record as never);
    } else if (collectionName === 'persons') {
      state.patchPerson(record as never);
    }
    // entries/personEntries/vault are fetched fresh per-page from Dexie,
    // so notifyRemoteSync event is sufficient to trigger page-level reloads.
  } catch {
    // Store not ready — ignore
  }
}

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
    db.lastSync.clear(),
  ]);
  if (typeof window !== 'undefined') {
    localStorage.removeItem('money_ledger_last_uid');
  }
}
