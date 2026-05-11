# Money Ledger — Agent Replacement Prompt

## Mission

Replace the old `Money-Agent-main` project files entirely with the new Money Ledger project. The new project is a complete rewrite with a different architecture, schema, and UI.

## Step-by-Step Instructions

### PHASE 1 — Backup Critical Config

Before deleting anything, copy these files from the OLD project:
- `.env.local` (if it exists — contains real Firebase credentials)
- `.firebaserc` (contains the Firebase project ID)
- `.github/workflows/` (CI/CD pipelines)

---

### PHASE 2 — Delete Old Files

Delete ALL old source files. Do NOT keep anything except:
- `node_modules/` (will reinstall)
- `.git/` (preserve git history)
- `.env.local` (backed up above)

Files/folders to delete from old project root:
```
app/
components/
contexts/
lib/
public/ (everything except favicon/icons you want to keep)
skills-lock.json
AGENTS.md (old one)
CLAUDE.md (old one)
README.md
package.json
package-lock.json
next.config.ts
tsconfig.json
postcss.config.mjs
tailwind.config.ts (if exists)
firebase.json
firestore.rules
firestore.indexes.json
.firebaserc
eslint.config.mjs
.gitignore
.env.example
```

---

### PHASE 3 — Copy New Files

Copy ALL files from the new Money Ledger project into the repository root, preserving the directory structure:

```
app/
  globals.css
  layout.tsx
  page.tsx
  login/page.tsx
  personal/page.tsx
  people/page.tsx
  vault/page.tsx
  tab/page.tsx
  search/page.tsx
  archive/page.tsx
  settings/page.tsx

components/
  auth/AuthGuard.tsx
  entry/EntryInput.tsx
  entry/EntryItem.tsx
  layout/AppLayout.tsx
  layout/BottomNav.tsx
  layout/Header.tsx
  people/PersonCard.tsx
  people/PersonLedger.tsx
  tabs/MoreDrawer.tsx
  ui/BottomSheet.tsx
  ui/Confirm.tsx
  vault/VaultCard.tsx
  vault/VaultForm.tsx
  windows/EditEntrySheet.tsx
  windows/WindowCard.tsx
  windows/WindowView.tsx

contexts/
  AuthContext.tsx

lib/
  export.ts
  firebase.ts
  firestore.ts
  parser.ts
  types.ts
  utils.ts

CLAUDE.md
AGENTS.md
.env.example
.gitignore
.firebaserc
eslint.config.mjs
firebase.json
firestore.indexes.json
firestore.rules
next.config.ts
package.json
postcss.config.mjs
tsconfig.json
```

---

### PHASE 4 — Restore Config

- Restore `.env.local` with real Firebase credentials
- Restore `.firebaserc` if the project ID differs (keep project ID = `moneyai-e3cf9`)
- Restore `.github/workflows/` CI files

---

### PHASE 5 — Install & Verify

```bash
# Install dependencies
npm install

# Type check
npx tsc --noEmit

# Build
npm run build
```

Expected build output:
```
Route (app)
○ /
○ /_not-found
○ /archive
○ /login
○ /people
○ /personal
○ /search
○ /settings
○ /tab
○ /vault
```

If TypeScript errors appear, fix them before deploying.

---

### PHASE 6 — Update Firestore Rules

Deploy the new Firestore security rules:
```bash
firebase deploy --only firestore:rules
```

The new rules cover these collections:
- `users`, `tabs`, `windows`, `entries`, `persons`, `personEntries`, `vault`

OLD collections (`sections`, `transactions`) are no longer used by this app.
You may optionally clean up old Firestore data but DO NOT delete old collections automatically — let the user decide.

---

### PHASE 7 — Deploy

```bash
firebase deploy
```

Or push to the `main` branch to trigger GitHub Actions auto-deploy.

---

## Verification Checklist

After deployment, test:

- [ ] Login page loads (`/login`)
- [ ] Sign up with email creates account and redirects to `/personal`
- [ ] Google sign in works
- [ ] Personal tab shows current month window automatically
- [ ] Adding an entry `+5000 salary` parses correctly (green preview)
- [ ] Adding an entry `-1200 ration` parses correctly (red preview)
- [ ] Math expression `5000-1200-300` evaluates to 3500
- [ ] Total updates instantly after adding entry
- [ ] People tab — add a person, open ledger, add entries
- [ ] Vault tab — add a bank account item, expand to reveal
- [ ] Search — finds entries by note text
- [ ] Archive — archive a window, restore it
- [ ] Trash — delete a window, restore it, delete permanently
- [ ] Custom tab — create via More drawer, add pages and entries
- [ ] CSV export works on a window
- [ ] Settings shows user info and sign out works
- [ ] Offline: disable network, app still shows existing data

---

## Schema Migration Note

The new app uses DIFFERENT Firestore collections than the old `Money-Agent-main`:

| Old Collection | New Collection | Notes |
|---|---|---|
| `sections` | `tabs` + `windows` | Tabs contain windows |
| `transactions` | `entries` + `personEntries` | Text-based entries |
| `persons` | `persons` + `personEntries` | Separate entry collection |
| `vault` | `vault` | Same, but `data` → `fields` |

Old data is NOT automatically migrated. New users start fresh.
Existing users of the old app will need to re-enter data.

---

## Key Architecture Differences

| Old (Money-Agent) | New (Money Ledger) |
|---|---|
| SWR for data fetching | Direct async/await |
| Form-based entry UI | Natural text input with smart parser |
| Analytics/charts dashboard | Ledger-style notebook |
| Fixed wallet sections | Flexible tabs + windows system |
| Balance stored in Firestore | Balance calculated from entries |
| Complex transaction types | Simple +/- text entries |
