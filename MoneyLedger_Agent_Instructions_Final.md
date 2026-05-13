# Money Ledger — Agent Fix Instructions (Combined)
> Source: MoneyLedger_Analysis_v3.md + BUG-A through BUG-D additional findings
> All fixes are based on actual code read from Money-Ledger-main.zip (latest)
> Execute every fix in the exact order listed. Do not skip any.
> After every fix: run `npx tsc --noEmit` — zero errors before moving on.
> After all fixes: run `npm run build` then `git push`.

---

## RULES

1. Read this entire file before touching any code
2. Execute fixes in the numbered order — earlier fixes change files that later fixes depend on
3. Only change the exact lines described — do not refactor anything else
4. If a fix says "find this code" — use grep or search to locate it exactly before editing
5. Mark each fix [DONE] before moving to the next
6. Final step: `npm run build` must pass with zero errors

---

## FIX-01 — Rewrite `prepareLocalData` (Fixes New Device + Duplicate Tab + Double Hydration)
**File:** `contexts/AuthContext.tsx`
**Fixes:** BUG-A (duplicate Personal tab), FIX-01-v3 (new device shows empty), BUG-D (double hydration)
**Severity:** 🔴 Critical — new device login is broken without this

**Find this entire function (lines 169–195):**
```typescript
async function prepareLocalData(userId: string): Promise<void> {
  // 1. Ensure system data exists locally FIRST
  await ensureSystemData(userId);

  // 2. Populate Zustand from Dexie — UI renders instantly from here
  await useStore.getState().init(userId);

  // 3. Run all network sync in the background
  (async () => {
    // Push pending local writes first
    try {
      await processSyncQueue();
    } catch {
      // Non-fatal — offline scenario
    }

    // Incremental delta sync (or full hydration if first login on this device)
    try {
      await incrementalSync(userId);
    } catch {
      // Non-fatal — local data still valid
    }

    // Purge old bin items
    purgeExpiredBinItems(userId).catch(() => undefined);
  })();
}
```

**Replace with:**
```typescript
async function prepareLocalData(userId: string): Promise<void> {
  const db = await import('@/lib/db').then((m) => m.getDb());
  const hasLocalData = (await db.tabs.where('userId').equals(userId).count()) > 0;

  if (hasLocalData) {
    // Returning device — show local data instantly from Dexie
    await useStore.getState().init(userId);
  }
  // New device: don't show anything yet — wait for sync below

  // All network work runs in background — never blocks the UI
  (async () => {
    // Step 1: push any pending local writes first
    try {
      await processSyncQueue();
    } catch {
      // offline — fine
    }

    // Step 2: sync from Firestore
    // New device  → fullHydrateFromFirestore (all docs)
    // Old device  → delta sync (only changed docs since lastSyncTime)
    try {
      await incrementalSync(userId);
    } catch {
      // offline — local data still valid
    }

    // Step 3: AFTER sync, create system defaults if needed
    // Doing this after sync means we never duplicate tabs that already exist in Firestore
    await ensureSystemData(userId);

    // Step 4: refresh Zustand with the fully synced Dexie state
    await useStore.getState().init(userId);

    // Step 5: cleanup
    purgeExpiredBinItems(userId).catch(() => undefined);
  })();
}
```

**Also add `getDb` import at the top of `contexts/AuthContext.tsx`:**
```typescript
// Find the import block and add:
import { getDb } from '@/lib/db';
```

---

## FIX-02 — Move `startRealtimeSync` Inside Background Block (Stops Double Hydration)
**File:** `contexts/AuthContext.tsx`
**Fixes:** BUG-D — `onSnapshot` initial snapshot runs simultaneously with `incrementalSync`
**Severity:** 🟠 High — wastes bandwidth + battery on every login

**Find this block inside `useEffect` → `onAuthStateChanged`:**
```typescript
      if (u) {
        await prepareLocalData(u.uid);
        // Start real-time listeners so changes from other devices appear live.
        // Realtime listeners now patch only changed documents — no full reload.
        startRealtimeSync(u.uid);
      } else {
```

**Replace with:**
```typescript
      if (u) {
        await prepareLocalData(u.uid);
        // NOTE: startRealtimeSync is now called inside prepareLocalData's
        // background block AFTER incrementalSync completes, to avoid the
        // initial onSnapshot firing simultaneously with the sync query.
      } else {
```

**Then update the `prepareLocalData` function from FIX-01 — add `startRealtimeSync` at the end of Step 4:**
```typescript
    // Step 4: refresh Zustand with the fully synced Dexie state
    await useStore.getState().init(userId);

    // Step 4b: start realtime listeners AFTER initial sync
    // This prevents the initial onSnapshot from doing duplicate work
    startRealtimeSync(userId);

    // Step 5: cleanup
    purgeExpiredBinItems(userId).catch(() => undefined);
```

**Also ensure `startRealtimeSync` is still in the import list in `contexts/AuthContext.tsx`:**
```typescript
import {
  incrementalSync,
  setupSyncListener,
  clearLocalData,
  startRealtimeSync,   // ← keep this
  stopRealtimeSync,
  processSyncQueue,
  purgeExpiredBinItems,
} from '@/lib/sync';
```

---

## FIX-03 — Flush Sync Queue Before Sign Out (Prevents Data Loss)
**File:** `contexts/AuthContext.tsx`
**Fixes:** BUG-B — offline entries permanently lost on sign out
**Severity:** 🟠 High — silent permanent data loss

**Find:**
```typescript
  const signOut = useCallback(async () => {
    setError(null);
    stopRealtimeSync();
    await firebaseSignOut(auth);
    await clearLocalData();
    useStore.getState().reset();
  }, []);
```

**Replace with:**
```typescript
  const signOut = useCallback(async () => {
    setError(null);
    stopRealtimeSync();
    // Flush any pending offline writes before wiping local data
    if (navigator.onLine) {
      await processSyncQueue().catch(() => undefined);
    }
    await firebaseSignOut(auth);
    await clearLocalData();
    useStore.getState().reset();
  }, []);
```

---

## FIX-04 — Clear Linked Person References When Deleting a Person
**File:** `store/useStore.ts`
**Fixes:** BUG-C — deleted person leaves stale "👤 Name" badges on window entries
**Severity:** 🟡 Medium — UI shows wrong data after person deletion

**Find this function (around line 373):**
```typescript
  deletePerson: async (id) => {
    const db = getDb();
    const personEntries = await db.personEntries.where('personId').equals(id).toArray();

    for (const entry of personEntries) {
      await queueSync('personEntries', 'delete', entry.id);
    }

    await db.personEntries.where('personId').equals(id).delete();
    await db.persons.delete(id);
    await queueSync('persons', 'delete', id);
    set((state) => ({
      persons: state.persons.filter((person) => person.id !== id),
    }));
  },
```

**Replace with:**
```typescript
  deletePerson: async (id) => {
    const db = getDb();

    // Step 1: clear linkedPersonId from any window entries referencing this person
    const linkedWindowEntries = await db.entries
      .where('linkedPersonId')
      .equals(id)
      .toArray();

    for (const entry of linkedWindowEntries) {
      const now = new Date();
      await db.entries.update(entry.id, {
        linkedPersonId: undefined,
        linkedPersonName: undefined,
        updatedAt: now,
      });
      await queueSync('entries', 'upsert', entry.id, {
        id: entry.id,
        linkedPersonId: undefined,
        linkedPersonName: undefined,
        updatedAt: now,
      });
    }

    // Step 2: delete all person ledger entries
    const personEntries = await db.personEntries.where('personId').equals(id).toArray();
    for (const entry of personEntries) {
      await queueSync('personEntries', 'delete', entry.id);
    }
    await db.personEntries.where('personId').equals(id).delete();

    // Step 3: delete the person
    await db.persons.delete(id);
    await queueSync('persons', 'delete', id);

    set((state) => ({
      persons: state.persons.filter((person) => person.id !== id),
    }));
  },
```

---

## FIX-05 — Fix `recentEntries` Showing Oldest 5 Instead of Newest 5
**File:** `app/personal/page.tsx`
**Fixes:** HIGH from v3 report — window cards show stale old entries as preview
**Severity:** 🟠 High — every window card shows wrong entries

**There are 4 occurrences of `entries.slice(-5)` in this file.**
**Find and replace ALL 4:**

```typescript
// FIND (all 4 times):
recentEntries: entries.slice(-5),

// REPLACE WITH (all 4 times):
recentEntries: [...entries].reverse().slice(0, 5),
```

To confirm you got all 4, run after the fix:
```bash
grep -n "slice(-5)" app/personal/page.tsx
```
Result must be empty — zero remaining occurrences.

---

## FIX-06 — Pre-Warm Search Pool on Page Mount
**File:** `app/search/page.tsx`
**Fixes:** MEDIUM from v3 report — first character typed freezes for 300-500ms
**Severity:** 🟡 Medium — bad UX on search page open

**Find the `SearchContent` function. Find where the state declarations are:**
```typescript
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [allResults, setAllResults] = useState<SearchResult[] | null>(null);
```

**Add this `useEffect` immediately after those state declarations:**
```typescript
  // Pre-warm the search index as soon as the page opens
  // so the first keypress is instant (no freeze waiting for Dexie scan)
  useEffect(() => {
    if (!user) return;
    loadSearchResults(user.uid)
      .then(setAllResults)
      .catch(() => undefined);
  }, [user]);
```

Make sure `useEffect` is already in the import from React at the top of this file. If not:
```typescript
// Find: import { ... } from 'react';
// Add useEffect to the import list
```

---

## FIX-07 — Remove Dead `break-inside-avoid` Class from Grid Items
**File:** `app/personal/page.tsx`
**Fixes:** MEDIUM from v3 report — leftover column layout class has no effect in grid
**Severity:** 🟢 Low — dead code, harmless but messy

**Find:**
```tsx
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {windows.map((w) => (
              <div key={w.id} className="break-inside-avoid">
                <WindowCard
```

**Replace with:**
```tsx
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {windows.map((w) => (
              <WindowCard
                key={w.id}
```

**Important:** Remove the closing `</div>` that was wrapping each `WindowCard` too. Make sure the JSX closes correctly.

---

## FIX-08 — Add Swipe-to-Close Gesture to BottomSheet
**File:** `components/ui/BottomSheet.tsx`
**Fixes:** LOW from v3 report — mobile users expect swipe down to close
**Severity:** 🟢 Low — UX polish

**Add `useRef` to the React import at the top:**
```typescript
import { useEffect, useRef } from 'react';
```

**Inside `BottomSheet`, add refs and touch handlers before the return statement:**
```typescript
  const startYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    const deltaY = e.changedTouches[0].clientY - startYRef.current;
    startYRef.current = null;
    if (deltaY > 80) {
      onClose();
    }
  };
```

**Find the inner sheet div and add the touch handlers:**
```typescript
// Find:
        className={`flex flex-col rounded-t-[1.35rem] animate-slide-up shadow-2xl ${heights[height]}`}
        style={{
          background: 'var(--color-surface)',
          borderTop: '1px solid color-mix(in oklab, var(--color-border) 80%, transparent)',
        }}

// Replace with:
        className={`flex flex-col rounded-t-[1.35rem] animate-slide-up shadow-2xl ${heights[height]}`}
        style={{
          background: 'var(--color-surface)',
          borderTop: '1px solid color-mix(in oklab, var(--color-border) 80%, transparent)',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
```

---

## FIX-09 — Pass `type` to `localAddPersonEntry` in PersonLedger
**File:** `components/people/PersonLedger.tsx`
**Fixes:** LOW from v3 report — `type` field received but silently discarded
**Severity:** 🟢 Low — data inconsistency in PersonEntry records

**Find `handleAdd` in `PersonLedger.tsx`:**
```typescript
  const handleAdd = async (rawText: string, amount: number, note: string, type: string, entryDate: Date) => {
    const entry = await localAddPersonEntry(userId, person.id, {
      rawText,
      amount,
      note,
      entryDate,
    });
```

**Replace with:**
```typescript
  const handleAdd = async (rawText: string, amount: number, note: string, type: string, entryDate: Date) => {
    const entry = await localAddPersonEntry(userId, person.id, {
      rawText,
      amount,
      note,
      type,
      entryDate,
    });
```

---

## VERIFICATION CHECKLIST

Run through every item after all fixes are done:

```
TYPESCRIPT
[ ] npx tsc --noEmit → zero errors

BUILD
[ ] npm run build → completes successfully

NEW DEVICE LOGIN
[ ] Open app in incognito window → log in
[ ] Within 5-8 seconds, all your real windows and persons appear
[ ] No duplicate Personal tab in the list
[ ] Entries inside windows are correct

RETURNING DEVICE LOGIN
[ ] Open app → data shows in < 200ms (from Dexie cache)
[ ] No loading spinner before data appears

SIGN OUT WITH OFFLINE ENTRIES
[ ] Turn off internet → add 3 entries → turn internet back on → sign out
[ ] Sign back in → all 3 entries are still there

DELETE PERSON
[ ] Add an entry linked to "Sahil" in a window → it shows "👤 Sahil" badge
[ ] Delete Sahil from People tab
[ ] Open the window → the "👤 Sahil" badge is gone from that entry

WINDOW CARD PREVIEW
[ ] Add several entries to a window
[ ] Go back to Personal page
[ ] Window card shows the MOST RECENT entries (not oldest)

SEARCH SPEED
[ ] Open Search page → immediately type a character
[ ] No freeze — results appear instantly

SWIPE TO CLOSE
[ ] Open any BottomSheet (add window, rename, etc.)
[ ] Swipe down on the sheet → it closes

PERSON LEDGER TYPE
[ ] Add a positive entry in Sahil's ledger
[ ] Check Dexie in DevTools → entry should have type field set

DEPLOYMENT
[ ] git add .
[ ] git commit -m "fix: new device sync, data loss on signout, person delete cleanup, recentEntries order"
[ ] git push origin main
[ ] firebase deploy --only firestore:indexes,firestore:rules
```

---

## SUMMARY TABLE

| # | Fix | File | Severity | Time |
|---|---|---|---|---|
| FIX-01 | Rewrite `prepareLocalData` — new device + duplicate tab | AuthContext.tsx | 🔴 Critical | 20 min |
| FIX-02 | Move `startRealtimeSync` after `incrementalSync` | AuthContext.tsx | 🟠 High | 5 min |
| FIX-03 | Flush sync queue before sign out | AuthContext.tsx | 🟠 High | 5 min |
| FIX-04 | Clear person references on delete | useStore.ts | 🟡 Medium | 15 min |
| FIX-05 | Fix `recentEntries` to show newest 5 (4 places) | personal/page.tsx | 🟠 High | 5 min |
| FIX-06 | Pre-warm search pool on mount | search/page.tsx | 🟡 Medium | 5 min |
| FIX-07 | Remove dead `break-inside-avoid` class | personal/page.tsx | 🟢 Low | 2 min |
| FIX-08 | Swipe-to-close gesture on BottomSheet | BottomSheet.tsx | 🟢 Low | 15 min |
| FIX-09 | Pass `type` to `localAddPersonEntry` | PersonLedger.tsx | 🟢 Low | 2 min |

**Total estimated time: ~75 minutes**

---

*Combined from MoneyLedger_Analysis_v3.md + additional BUG-A/B/C/D findings · May 2026*
