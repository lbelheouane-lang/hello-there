# Migration ORUS → SaaS multi-tenant automatique

⚠️ Ce changement contredit la règle actuelle « mono-boutique ». Tu le demandes explicitement : je bascule vers un vrai multi-tenant partagé (une seule appli, une seule URL, bases isolées logiquement par `tenant_id`). Je mettrai à jour la mémoire projet en conséquence.

## Principe retenu

Chaque entreprise cliente = **1 tenant**. Toutes les données métier portent un `tenant_id`. Un utilisateur est rattaché à un tenant ; il ne voit **que** les lignes de son tenant. Le Super Admin voit tout. Le rattachement se fait **automatiquement** à la première connexion via une **clé d'accès** unique.

```text
Super Admin ──crée──> Tenant + Clé d'accès unique
        │
        └── remet la clé au client
                    │
   Client se connecte (même URL) ─1re fois─> saisit la clé
                    │
        Provisionnement AUTO : profile.tenant_id + rôle admin
        + paramètres boutique + catégories/données initiales
                    │
        Toutes ses données isolées par tenant_id (RLS)
```

## Étapes

### 1. Schéma — nouvelle table `tenants`
- `tenants` : `name`, `slug`, `status` (active/suspended), `created_by`, timestamps.
- `tenant_access_keys` : `tenant_id`, `key_hash` (clé hashée, jamais en clair), `label`, `status` (active/used/revoked), `max_uses`/`used_count`, `expires_at`. (Réutilise le principe des `access_keys` existants mais lié à un tenant.)
- Ajout `tenant_id uuid` sur `profiles` (le lien utilisateur→tenant).

### 2. Fonctions de sécurité (SECURITY DEFINER)
- `current_tenant_id()` : renvoie `profiles.tenant_id` de `auth.uid()`.
- `is_super_admin(auth.uid())` : déjà existante, réutilisée pour le bypass.
- `provision_tenant(name)` : crée tenant + settings + catégories par défaut (Super Admin uniquement).
- `redeem_tenant_key(key)` : valide la clé, rattache l'utilisateur au tenant, lui donne le rôle `admin` **scopé au tenant**, marque la clé consommée. Appelée à la 1re connexion.

### 3. Ajout de `tenant_id` sur toutes les tables métier
Tables concernées (remplies puis rendues `NOT NULL`) :
`products, customers, suppliers, sales, payments, invoices, purchases, expenses, expense_categories, product_categories, product_subcategories, jewelry_sets, jewelry_set_events, scrap_gold, scrap_gold_events, repairs, repair_status_history, daily_journals, stock_movements, gold_prices, store_settings, audit_logs, product_origin_events, product_quantity_events, backups, employees, clients, invitations`.

Défaut à l'insertion : `tenant_id` rempli automatiquement par trigger `set_tenant_id()` = `current_tenant_id()` — **aucune ligne de code applicatif à modifier pour les inserts**.

### 4. Réécriture des RLS
Pour chaque table métier, remplacement des policies par :
```sql
USING (tenant_id = current_tenant_id() OR is_super_admin(auth.uid()))
WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin(auth.uid()))
```
`user_roles` gagne aussi un `tenant_id` pour scoper le rôle admin/employé par tenant. `super_admin`/`developer` restent globaux. Les tables système (super_admin_*, owner_access, gold_sync_logs) restent inchangées.

### 5. Migration des données existantes
- Création d'un **tenant « Boutique principale »** rattaché aux clients actuels.
- Toutes les données existantes reçoivent ce `tenant_id` (les 2-3 clients actuels ne sont pas cassés, ils partagent ce tenant historique — comme aujourd'hui).
- Les profils existants sont rattachés à ce tenant.

### 6. Provisionnement automatique — flux 1re connexion
- Après login (email/mot de passe existant), si `profile.tenant_id` est `NULL` → redirection vers un nouvel écran **`/rejoindre`** (saisie de la clé d'accès).
- `redeem_tenant_key` rattache et provisionne, puis redirige vers le dashboard.
- Si `tenant.status = suspended` → accès bloqué avec message.

### 7. Interface Super Admin (`/super-admin`)
Nouvel onglet **« Tenants »** :
- Liste des tenants (nom, statut, nb utilisateurs, date).
- Bouton **« Créer un tenant »** → génère le tenant + **une clé d'accès unique affichée une seule fois**.
- Actions : révoquer/regénérer une clé, suspendre/réactiver un tenant.
- Serveur : fonctions dans `src/lib/super-admin.functions.ts` (déjà existant), protégées par `assertSuperAdmin`.

### 8. Serveur / code applicatif
- Les lectures/écritures front actuelles restent quasi inchangées grâce aux triggers + RLS (le `tenant_id` est injecté et filtré côté base).
- `useAuth` expose `tenantId` + état « sans tenant » pour piloter la redirection `/rejoindre`.
- `reset_instance_for_new_client` devient obsolète (remplacé par l'isolation par tenant) — conservé mais non nécessaire.

## Détails techniques / risques
- Migration exécutée en plusieurs migrations SQL ordonnées (ajout colonnes nullable → backfill → NOT NULL → triggers → RLS) pour éviter toute coupure.
- Les clés d'accès sont **hashées** (scrypt) comme les passkeys existantes ; jamais stockées ni loggées en clair.
- Le rôle par défaut d'un nouveau tenant = `admin` (le patron de la boutique) ; il gère ensuite ses employés via le module existant.
- Aucune donnée existante supprimée ; rollback possible tant que `tenant_id` reste nullable jusqu'à validation.

## Ce que je ne fais PAS (sauf demande)
- Pas de facturation/abonnements Stripe par tenant (peut venir après).
- Pas de sous-domaine par tenant : une seule URL comme demandé.

Confirme et je démarre par les migrations de schéma, tenant historique inclus, sans casser tes clients actuels.