import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
  writeBatch,
  Timestamp,
  limit,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Section, Person, Transaction, VaultItem, TransactionType } from '@/lib/types';

// Helper for timeouts
const withTimeout = <T>(promise: Promise<T>, ms: number = 15000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out after 15s')), ms)
    ),
  ]);
};

// ===== SECTIONS =====

export async function getSections(userId: string): Promise<Section[]> {
  const q = query(
    collection(db, 'sections'),
    where('userId', '==', userId)
    // Removed orderBy to avoid index requirement for now
  );
  const snap = await withTimeout(getDocs(q));
  return snap.docs
    .map((d) => ({
      ...d.data(),
      id: d.id,
      createdAt: (d.data().createdAt as Timestamp)?.toDate?.() || new Date(),
      updatedAt: (d.data().updatedAt as Timestamp)?.toDate?.() || new Date(),
    }))
    .sort((a: any, b: any) => a.createdAt - b.createdAt) as Section[];
}

export async function addSection(
  userId: string,
  data: { name: string; icon: string; color: string }
): Promise<string> {
  if (!userId) throw new Error('User ID is required');
  const docRef = doc(collection(db, 'sections'));
  await withTimeout(setDoc(docRef, {
    ...data,
    userId,
    type: 'custom',
    balance: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  return docRef.id;
}

export async function updateSection(id: string, data: Partial<Section>): Promise<void> {
  await withTimeout(updateDoc(doc(db, 'sections', id), {
    ...data,
    updatedAt: serverTimestamp(),
  }));
}

/**
 * Deletes a section and all its associated transactions.
 */
export async function deleteSection(id: string): Promise<void> {
  const batch = writeBatch(db);
  
  // 1. Delete the section
  batch.delete(doc(db, 'sections', id));

  // 2. Find and delete all transactions associated with this section
  const txQuery = query(collection(db, 'transactions'), where('sectionId', '==', id));
  const txSnap = await withTimeout(getDocs(txQuery));
  txSnap.forEach(d => batch.delete(d.ref));

  // 3. Also check for transactions where this was the destination section
  const toTxQuery = query(collection(db, 'transactions'), where('toSectionId', '==', id));
  const toTxSnap = await withTimeout(getDocs(toTxQuery));
  toTxSnap.forEach(d => batch.delete(d.ref));

  await withTimeout(batch.commit());
}

// ===== PERSONS =====

export async function getPersons(userId: string): Promise<Person[]> {
  const q = query(
    collection(db, 'persons'),
    where('userId', '==', userId)
    // Removed orderBy
  );
  const snap = await withTimeout(getDocs(q));
  return snap.docs
    .map((d) => ({
      ...d.data(),
      id: d.id,
      createdAt: (d.data().createdAt as Timestamp)?.toDate?.() || new Date(),
      updatedAt: (d.data().updatedAt as Timestamp)?.toDate?.() || new Date(),
    }))
    .sort((a: any, b: any) => a.createdAt - b.createdAt) as Person[];
}

export async function addPerson(
  userId: string,
  data: { name: string; type: string; note?: string }
): Promise<string> {
  if (!userId) throw new Error('User ID is required');
  const docRef = doc(collection(db, 'persons'));
  await withTimeout(setDoc(docRef, {
    ...data,
    userId,
    balance: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  return docRef.id;
}

export async function updatePerson(id: string, data: Partial<Person>): Promise<void> {
  await withTimeout(updateDoc(doc(db, 'persons', id), {
    ...data,
    updatedAt: serverTimestamp(),
  }));
}

/**
 * Deletes a person and all their associated transactions.
 */
export async function deletePerson(id: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'persons', id));

  const txQuery = query(collection(db, 'transactions'), where('personId', '==', id));
  const txSnap = await withTimeout(getDocs(txQuery));
  txSnap.forEach(d => batch.delete(d.ref));

  await withTimeout(batch.commit());
}

// ===== TRANSACTIONS =====

export async function getTransactions(
  userId: string,
  limitCount: number = 50
): Promise<Transaction[]> {
  const q = query(
    collection(db, 'transactions'),
    where('userId', '==', userId),
    // Removed orderBy, will sort in memory
    limit(limitCount)
  );
  const snap = await withTimeout(getDocs(q));
  return snap.docs
    .map((d) => ({
      ...d.data(),
      id: d.id,
      date: (d.data().date as Timestamp)?.toDate?.() || new Date(),
      createdAt: (d.data().createdAt as Timestamp)?.toDate?.() || new Date(),
    }))
    .sort((a: any, b: any) => b.date - a.date) as Transaction[];
}

export async function addTransaction(
  userId: string,
  data: {
    sectionId: string;
    personId?: string;
    type: TransactionType;
    amount: number;
    category?: string;
    date: Date;
    note?: string;
    toSectionId?: string;
    loanDirection?: 'given' | 'received';
  }
): Promise<string> {
  const sectionRef = doc(db, 'sections', data.sectionId);

  // Validate section exists before writing
  const sectionSnap = await getDoc(sectionRef);
  if (!sectionSnap.exists()) {
    throw new Error(`Section ${data.sectionId} does not exist.`);
  }

  const batch = writeBatch(db);

  // Add the transaction
  const txRef = doc(collection(db, 'transactions'));
  batch.set(txRef, {
    ...data,
    userId,
    date: Timestamp.fromDate(data.date instanceof Date ? data.date : new Date(data.date)),
    createdAt: serverTimestamp(),
  });

  // Update balances based on transaction type
  switch (data.type) {
    case 'income':
      batch.update(sectionRef, {
        balance: increment(data.amount),
        updatedAt: serverTimestamp(),
      });
      break;

    case 'expense':
      batch.update(sectionRef, {
        balance: increment(-data.amount),
        updatedAt: serverTimestamp(),
      });
      break;

    case 'transfer':
      if (data.toSectionId) {
        batch.update(sectionRef, {
          balance: increment(-data.amount),
          updatedAt: serverTimestamp(),
        });
        batch.update(doc(db, 'sections', data.toSectionId), {
          balance: increment(data.amount),
          updatedAt: serverTimestamp(),
        });
      }
      break;

    case 'loan':
      if (data.personId) {
        const personRef = doc(db, 'persons', data.personId);
        if (data.loanDirection === 'given') {
          batch.update(sectionRef, {
            balance: increment(-data.amount),
            updatedAt: serverTimestamp(),
          });
          batch.update(personRef, {
            balance: increment(data.amount),
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.update(sectionRef, {
            balance: increment(data.amount),
            updatedAt: serverTimestamp(),
          });
          batch.update(personRef, {
            balance: increment(-data.amount),
            updatedAt: serverTimestamp(),
          });
        }
      }
      break;
  }

  await withTimeout(batch.commit());
  return txRef.id;
}

/**
 * Deletes a transaction and REVERSES its effect on balances atomically.
 */
export async function deleteTransaction(txId: string): Promise<void> {
  const txRef = doc(db, 'transactions', txId);
  const txSnap = await getDoc(txRef);

  if (!txSnap.exists()) return;

  const tx = txSnap.data() as Transaction;
  const batch = writeBatch(db);

  const sectionRef = doc(db, 'sections', tx.sectionId);

  // Reverse logic
  switch (tx.type) {
    case 'income':
      // Substract the income back
      batch.update(sectionRef, { balance: increment(-tx.amount) });
      break;
    
    case 'expense':
      // Add the expense back
      batch.update(sectionRef, { balance: increment(tx.amount) });
      break;
    
    case 'transfer':
      if (tx.toSectionId) {
        // Add back to source, subtract from destination
        batch.update(sectionRef, { balance: increment(tx.amount) });
        batch.update(doc(db, 'sections', tx.toSectionId), { balance: increment(-tx.amount) });
      }
      break;
    
    case 'loan':
      if (tx.personId) {
        const personRef = doc(db, 'persons', tx.personId);
        if (tx.loanDirection === 'given') {
          // Add back to section, subtract from person's "owes you"
          batch.update(sectionRef, { balance: increment(tx.amount) });
          batch.update(personRef, { balance: increment(-tx.amount) });
        } else {
          // Subtract from section, add back to person's "you owe"
          batch.update(sectionRef, { balance: increment(-tx.amount) });
          batch.update(personRef, { balance: increment(tx.amount) });
        }
      }
      break;
  }

  batch.delete(txRef);
  await batch.commit();
}

// ===== VAULT =====

export async function getVaultItems(userId: string): Promise<VaultItem[]> {
  const q = query(
    collection(db, 'vault'),
    where('userId', '==', userId),
    where('userId', '==', userId)
    // Removed orderBy
  );
  const snap = await withTimeout(getDocs(q));
  return snap.docs
    .map((d) => ({
      ...d.data(),
      id: d.id,
      createdAt: (d.data().createdAt as Timestamp)?.toDate?.() || new Date(),
      updatedAt: (d.data().updatedAt as Timestamp)?.toDate?.() || new Date(),
    }))
    .sort((a: any, b: any) => b.createdAt - a.createdAt) as VaultItem[];
}

export async function addVaultItem(
  userId: string,
  data: { type: string; title: string; data: Record<string, string> }
): Promise<string> {
  const docRef = await withTimeout(addDoc(collection(db, 'vault'), {
    ...data,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  return docRef.id;
}

export async function deleteVaultItem(id: string): Promise<void> {
  await withTimeout(deleteDoc(doc(db, 'vault', id)));
}
