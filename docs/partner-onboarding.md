# Onboarding partenaire beta (manuel)

## 1. Créer l'utilisateur Supabase Auth

Dans Supabase Dashboard → Authentication → Users → Invite user
Email : `notaire.demo@example.com`

Notez l'UUID généré (ex: `a1b2c3d4-...`).

## 2. Créer le partenaire

```sql
INSERT INTO partners (id, type, company_name, geo_zones, credit_balance, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'notaire',
  'Étude Demo Paris',
  ARRAY['75', '92', '93'],
  10,
  TRUE
);
```

## 3. Lier l'utilisateur auth au partenaire

```sql
INSERT INTO partner_users (id, partner_id, role, full_name)
VALUES (
  'UUID_AUTH_USER_ICI',
  '00000000-0000-0000-0000-000000000001',
  'owner',
  'Me Demo'
);
```

## 4. Connexion

Aller sur `/pro/login` → magic link → `/pro`

## 5. Ajuster les crédits manuellement

```sql
SELECT grant_partner_credits(
  '00000000-0000-0000-0000-000000000001',
  20,
  'admin_manual_grant',
  'beta-boost'
);
```

## 6. Publier un lead test

Effectuer une simulation B2C complète avec :
- Email + téléphone renseignés
- Opt-in "être mis en relation" coché à l'étape 7

Le lead apparaît sur `/pro/leads` si dept + type correspondent.
