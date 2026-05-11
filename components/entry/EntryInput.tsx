'use client';

import { useState, useRef, useCallback } from 'react';
import { Send, UserRound, X } from 'lucide-react';
import { parseEntry, formatAmount } from '@/lib/parser';
import type { Person } from '@/lib/types';

interface EntryInputProps {
  onAdd: (
    rawText: string,
    amount: number,
    note: string,
    type: string,
    linkedPersonId?: string,
    linkedPersonName?: string
  ) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  persons?: Person[];
}

export default function EntryInput({ onAdd, disabled, persons }: EntryInputProps) {
  const [amountInput, setAmountInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [linkedPerson, setLinkedPerson] = useState<Person | null>(null);
  const [showPersonPicker, setShowPersonPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const combined = `${amountInput} ${noteInput}`.trim();
  const parsed = combined ? parseEntry(combined) : null;

  const handleSubmit = useCallback(async () => {
    if (!combined || loading) return;
    const p = parseEntry(combined);
    if (!p.isValid) return;

    setLoading(true);
    try {
      await onAdd(p.rawText, p.amount, p.note, p.type, linkedPerson?.id, linkedPerson?.name);
      setAmountInput('');
      setNoteInput('');
      setLinkedPerson(null);
      setShowPersonPicker(false);
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }, [combined, loading, linkedPerson, onAdd]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const isIncome = parsed?.isValid && parsed.amount > 0;
  const isExpense = parsed?.isValid && parsed.amount < 0;

  return (
    <div className="p-3 z-20" style={{ background: 'var(--color-nav)' }}>
      {/* Preview */}
      {parsed?.isValid && (
        <div
          className="flex items-center justify-between px-3 py-1.5 rounded-xl mb-2"
          style={{
            background: isIncome
              ? 'var(--color-income-bg)'
              : isExpense
                ? 'var(--color-expense-bg)'
                : 'var(--color-surface-2)',
          }}
        >
          <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-muted)' }}>
            {parsed.note ||
              (parsed.type === 'expression'
                ? 'Expression'
                : parsed.type === 'add'
                  ? 'Income'
                  : 'Expense')}
          </span>
          <span
            className="font-mono font-semibold text-sm ml-3 shrink-0"
            style={{
              color: isIncome
                ? 'var(--color-income)'
                : isExpense
                  ? 'var(--color-expense)'
                  : 'var(--color-text)',
            }}
          >
            {formatAmount(parsed.amount)}
          </span>
        </div>
      )}

      {parsed && !parsed.isValid && combined && (
        <div
          className="px-3 py-1.5 rounded-xl mb-2 text-xs"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
        >
          Type: +5000 salary · -1200 ration · 5000-1200
        </div>
      )}

      {persons && persons.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          {linkedPerson ? (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium max-w-full"
              style={{ background: 'var(--color-accent-bg)', color: 'var(--color-accent)' }}
            >
              <UserRound size={12} className="shrink-0" />
              <span className="truncate">{linkedPerson.name}</span>
              <button
                type="button"
                onClick={() => setLinkedPerson(null)}
                className="shrink-0"
                aria-label="Remove linked person"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowPersonPicker((open) => !open)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-dim)' }}
            >
              <UserRound size={12} />
              Link person
            </button>
          )}
        </div>
      )}

      {showPersonPicker && persons && persons.length > 0 && (
        <div
          className="mb-2 rounded-xl overflow-hidden max-h-44 overflow-y-auto"
          style={{ border: '1px solid var(--color-border)' }}
        >
          {persons.map((person, index) => (
            <button
              key={person.id}
              type="button"
              className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-left"
              style={{
                background:
                  linkedPerson?.id === person.id
                    ? 'var(--color-accent-bg)'
                    : 'var(--color-surface-2)',
                color:
                  linkedPerson?.id === person.id
                    ? 'var(--color-accent)'
                    : 'var(--color-text)',
                borderBottom:
                  index === persons.length - 1 ? 'none' : '1px solid var(--color-border)',
              }}
              onClick={() => {
                setLinkedPerson(person);
                setShowPersonPicker(false);
                inputRef.current?.focus();
              }}
            >
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{
                  background: 'var(--color-surface-3)',
                  color: 'var(--color-text-muted)',
                }}
              >
                {person.name.charAt(0).toUpperCase()}
              </span>
              <span className="truncate">{person.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="flex-1 flex items-center gap-2 rounded-xl px-3 min-w-0"
          style={{
            background: 'var(--color-surface-2)',
            border: `1px solid ${parsed?.isValid
              ? isIncome
                ? 'var(--color-income)'
                : 'var(--color-expense)'
              : 'var(--color-border)'
              }`,
            transition: 'border-color 0.15s',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Amount"
            disabled={disabled || loading}
            className="w-[60%] min-w-0 py-3 text-sm outline-none bg-transparent font-mono"
            style={{
              color: 'var(--color-text)',
              caretColor: 'var(--color-accent)',
            }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
          />
          <input
            type="text"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Note"
            disabled={disabled || loading}
            className="w-[40%] min-w-0 py-3 text-sm outline-none bg-transparent"
            style={{
              color: 'var(--color-text)',
              caretColor: 'var(--color-accent)',
            }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
          />
          {(amountInput || noteInput) && (
            <button
              type="button"
              onClick={() => {
                setAmountInput('');
                setNoteInput('');
              }}
              style={{ color: 'var(--color-text-muted)' }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!parsed?.isValid || loading}
          className="p-3 rounded-xl transition-all duration-150 shrink-0"
          style={{
            background:
              parsed?.isValid && !loading ? 'var(--color-accent)' : 'var(--color-surface-2)',
            color: parsed?.isValid && !loading ? '#fff' : 'var(--color-text-dim)',
          }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
