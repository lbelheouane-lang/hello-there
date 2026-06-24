## ORUS DZ — Public Read-Only Showroom Demo

### Goal
A public URL (`/demo`) and matching QR code that opens ORUS DZ with no login, showing realistic fictional data across all modules, fully read-only, with zero risk of exposing or mutating production data.

### Architecture decision (security-first)
The demo will **never touch production rows**. Two layers guarantee this:

1. **Database isolation** — Demo data already lives in tables flagged `is_demo = true` (the existing `seed_demo_data()` function). We add narrow `TO anon` SELECT policies that return **only** `is_demo = true` rows. Anonymous visitors get zero write policies, so no insert/update/delete is possible at the database level — the demo is structurally non-convertible.
2. **UI isolation** — A public `/demo/*` route tree (outside `_authenticated`, no PIN gate) renders the existing module screens through a `DemoModeProvider` that forces a synthetic read-only "admin" view, hides forbidden modules, and disables every mutating control.

```text
/auth, /acces ............ unchanged production login (untouched)
/_authenticated/* ........ unchanged production app (untouched)
/demo .................... public landing → redirects into demo shell
/demo/dashboard, /demo/stock, ... public read-only mirrors
```

### Data layer
- A `demoSupabase` client built with the publishable (anon) key, **no session persistence**. Because anon SELECT policies are scoped to `is_demo = true`, every read is automatically demo-only.
- Extend `seed_demo_data()` so all showroom modules have rich sample rows: products, jewelry sets, scrap gold, customers, suppliers, sales, invoices, payments, expenses, repairs, gold prices. Seed is run once via migration so the demo is populated out of the box.
- A small `DemoDataContext` exposes the demo client + `readOnly: true` so screens fetch from it instead of the authed `supabase`.

### Read-only enforcement
- `DemoModeProvider` sets a global `isDemo` flag.
- A `useReadOnly()` hook + `<DemoGuard>` wrapper disables/hides: Add, Edit, Delete, Save, Print (real docs), Export, Import, and all destructive dialogs. Buttons render disabled with a tooltip "Indisponible en mode démonstration".
- Forbidden modules are simply not registered in the demo nav: developer features, licenses/activation, backups, user management, real settings (Boutique/Paramètres show a read-only preview only).

### Available demo modules
Dashboard, Stock (Inventory), Parures (Jewelry Sets), Or Cassé (Scrap Gold), Clients (Customers), Fournisseurs (Suppliers), Ventes/Factures (Sales & Invoices), Paiements en attente (Pending Payments), Dépenses (Expenses), Reports (stock/expense reports view-only), Settings (read-only preview).

### Banner & footer
- Permanent top banner on every demo page:
  `ORUS DZ — VERSION DE DÉMONSTRATION · Mode lecture seule, données fictives.`
- Footer block:
  `Intéressé par ORUS DZ ? Contactez-nous pour activer la version complète sous licence.`

### Access surfaces
- **PC:** public link `https://orusdz.lovable.app/demo`.
- **Mobile:** a QR code (generated with the existing `qrcode` dep) pointing to the published `/demo` URL. Surfaced on the demo landing page and optionally in admin Settings → "Partager la démo".

### Security guarantees
- No anon write policies anywhere → modifications impossible.
- Anon SELECT policies filter `is_demo = true` → production data never returned.
- No activation/upgrade path inside demo → not convertible.
- Demo routes never import `supabaseAdmin` or service-role logic.

---

### Technical steps
1. **Migration**: add `GRANT SELECT ... TO anon` + `CREATE POLICY ... TO anon USING (is_demo = true)` on the demo-read tables; extend & run `seed_demo_data()` to cover expenses/repairs/payments/jewelry_sets/scrap_gold.
2. **`src/lib/demo/demo-client.ts`**: anon, session-less Supabase client.
3. **`src/lib/demo/demo-context.tsx`**: `DemoModeProvider`, `useDemoMode()`, `useReadOnly()`.
4. **`src/components/demo/DemoBanner.tsx`** + **`DemoFooter.tsx`** + **`DemoShell.tsx`** (sidebar/nav mirror of `AppShell`, demo nav list, no auth).
5. **`src/routes/demo.tsx`** (landing + QR) and `src/routes/demo.$module.tsx` mirrors that reuse existing module bodies refactored to accept a client/read-only prop, or thin demo wrappers.
6. **Read-only control wrapper** to neutralize mutating buttons across reused screens.
7. Wire QR/share entry point and verify with a headless browser pass (no console/auth errors, data renders, buttons disabled).

### Open question
Reusing the existing 11 module screens read-only is the bulk of the work. Two ways to do it:
- **(A) Refactor each module** to accept an injected data client + `readOnly` flag, so demo and production share one component (most maintainable, larger diff).
- **(B) Build dedicated lightweight demo pages** that re-present the same data with a simpler read-only layout (faster, but some duplication and slightly different look).

I recommend **(A)** for visual fidelity ("experience the complete interface"). Confirm A or B before I start.