# Money Ledger — Agent Context

## What is Money Ledger?

An offline-first personal accounting notebook. NOT a banking app, NOT a SaaS dashboard. A digital ledger book that replicates handwritten accounting notebooks with smart calculations.

## Tech Stack

- **Next.js 16** (static export → Firebase Hosting)
- **Tailwind CSS v4** (CSS variable theme, dark ledger aesthetic)
- **Firebase Auth** (email/password + Google)
- **Firebase Firestore** (offline persistence enabled via persistentLocalCache)
- **TypeScript** (strict mode)
- **Zustand** (available but not yet wired — use React state for now)

## Architecture Rules

- **Totals are NEVER stored** — always calculated dynamically from entries
- **Firestore = primary source of truth** (with offline persistence)
- **No SWR** — use direct async/await functions in `lib/firestore.ts`
- **Static export** — all pages must be client components or have no server dependencies
- **No dynamic routes** — use `?param=value` search params instead

## Collections (Firestore)

| Collection | Purpose |
|---|---|
| `users/{uid}` | User profile |
| `tabs/{tabId}` | Tabs (personal/people/vault/custom) |
| `windows/{windowId}` | Pages within tabs |
| `entries/{entryId}` | Text entries within windows |
| `persons/{personId}` | Person ledger headers |
| `personEntries/{entryId}` | Transactions in person ledgers |
| `vault/{itemId}` | Secure vault items |

## Key Files

| File | Purpose |
|---|---|
| `lib/firebase.ts` | Firebase init with offline persistence |
| `lib/firestore.ts` | ALL database operations |
| `lib/types.ts` | All TypeScript interfaces |
| `lib/parser.ts` | Smart entry parser (+5000 salary, -1200 ration, 5000-1200-300) |
| `lib/utils.ts` | Date formatting, debounce, etc |
| `lib/export.ts` | CSV export for windows and persons |
| `contexts/AuthContext.tsx` | Auth state (signIn, signUp, Google, signOut) |

## Routing (search params pattern)

- `/personal` → Personal tab window list
- `/personal?w=windowId` → Window detail with entries
- `/people` → People tab list
- `/people?p=personId` → Person ledger
- `/vault` → Vault items
- `/tab?t=tabId` → Custom tab window list
- `/tab?t=tabId&w=windowId` → Custom tab window detail
- `/search` → Global search
- `/archive` → Archive + Trash
- `/settings` → Settings + sign out

## Smart Entry Parser

From `lib/parser.ts`:
```
"+5000 salary"     → amount: +5000, note: "salary"
"-1200 ration"     → amount: -1200, note: "ration"
"5000-1200-300"    → amount: 3500, type: "expression"
"5000 income"      → amount: +5000, note: "income"  (plain = positive)
```

## Design System (CSS Variables)

```css
--color-bg          /* Main background */
--color-surface     /* Cards, panels */
--color-surface-2   /* Inputs, secondary areas */
--color-border      /* Borders */
--color-text        /* Primary text */
--color-text-muted  /* Secondary text */
--color-text-dim    /* Placeholder/disabled */
--color-income      /* Green for positive */
--color-expense     /* Red for negative */
--color-accent      /* Indigo - primary action color */
```

## Component Patterns

- `BottomSheet` — slide-up modal for forms
- `Confirm` — confirmation dialog
- `Header` — sticky top header with back button support
- `EntryInput` — smart text input with real-time parser preview
- `EntryItem` — entry row with expand-to-reveal edit/delete actions
- `WindowCard` — page/window card with pin/archive/delete menu
- `PersonCard` — person card with balance display

## Dev Commands

```bash
npm run dev     # Start local dev server
npm run build   # Build for production (static export → /out)
npm run lint    # ESLint check
```

## Deploy

This project deploys to Firebase Hosting. The GitHub Actions workflows in `.github/workflows/` handle automatic deployment on push.

```bash
firebase deploy   # Manual deploy
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your Firebase project credentials.

## What NOT to do

- Don't store totals in Firestore — calculate from entries always
- Don't use `useEffect` for data that changes with user actions — reload explicitly
- Don't add chart libraries or analytics dashboards — outside project scope
- Don't break static export — no server components with external dependencies
- Don't use dynamic Next.js routes — use search params instead
