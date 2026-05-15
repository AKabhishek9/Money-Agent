'use client';

import { getDb } from '@/lib/db';
import { queueSync } from '@/lib/sync';
import { v4 as uuid } from 'uuid';
import { getMonthKey, getMonthWindowTitle } from '@/lib/utils';
import { useStore } from '@/store/useStore';

const bootstrapPromises = new Map<string, Promise<void>>();

export async function ensureSystemData(userId: string): Promise<void> {
  if (bootstrapPromises.has(userId)) {
    return bootstrapPromises.get(userId)!;
  }

  const promise = (async () => {
    const db = getDb();
    const now = new Date();

    const existingTabs = await db.tabs.where('userId').equals(userId).toArray();

    // ── Ensure Personal Tab ──────────────────────────────────────────────────
    let personalTab = existingTabs.find((tab) => tab.type === 'personal');

    if (!personalTab) {
      // Double-check DB — Firestore hydration may have just populated it
      // This prevents creating a duplicate tab when site data was cleared
      const recheckTabs = await db.tabs.where('userId').equals(userId).toArray();
      personalTab = recheckTabs.find((tab) => tab.type === 'personal');
    }

    if (!personalTab) {
      personalTab = {
        id: `personal-${userId}`, // Maintain deterministic ID logic
        userId,
        name: 'Personal',
        icon: '📓',
        type: 'personal',
        order: 0,
        pinned: false,
        archived: false,
        isSystem: true,
        createdAt: now,
        updatedAt: now,  // ← required for delta sync
      };

      await db.tabs.add(personalTab);
      useStore.getState().patchTab(personalTab);
      await queueSync(
        'tabs',
        'upsert',
        personalTab.id,
        personalTab as unknown as Record<string, unknown>
      );
    }

    // ── Ensure Current Month Window ──────────────────────────────────────────
    const currentMonthKey = getMonthKey();

    const existingMonthWindow = await db.windows
      .where('tabId')
      .equals(personalTab.id)
      .filter((window) => window.monthKey === currentMonthKey)
      .first();

    if (!existingMonthWindow) {
      const monthWindow = {
        id: uuid(),
        userId,
        tabId: personalTab.id,
        title: getMonthWindowTitle(),
        order: 0,
        pinned: true,
        archived: false,
        inRecycleBin: false,
        autoMonthly: true,
        monthKey: currentMonthKey,
        createdAt: now,
        updatedAt: now,  // ← required for delta sync
      };

      await db.windows.add(monthWindow);
      useStore.getState().patchWindow(monthWindow);
      await queueSync(
        'windows',
        'upsert',
        monthWindow.id,
        monthWindow as unknown as Record<string, unknown>
      );
    }
  })();

  bootstrapPromises.set(userId, promise);

  try {
    await promise;
  } finally {
    bootstrapPromises.delete(userId);
  }
}
