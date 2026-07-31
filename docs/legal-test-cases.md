# Cas de test — Validation notaire (10 scénarios)

Ces cas de test doivent être validés par un notaire partenaire avant mise en production.
Exécuter avec : `npm run test --workspace=@separation/engine`

---

## Cas 1 — Concubinage indivision 50/50 simple

**Entrée :**
- Statut : concubinage
- Bien : 400 000 €, crédit 200 000 €, indivision 50/50
- Scénario : A rachète

**Attendu :**
- Valeur nette : 200 000 €
- Soulte A→B : 100 000 €
- Patrimoine net final : A = 100 000 €, B = 100 000 €

---

## Cas 2 — Concubinage quote-part 60/40

**Entrée :**
- Statut : concubinage
- Bien : 300 000 €, crédit 0 €, A=60%, B=40%
- Scénario : A rachète

**Attendu :**
- Soulte : 120 000 € (40% de 300 000 €)

---

## Cas 3 — Concubinage vente

**Entrée :**
- Statut : concubinage
- Bien : 400 000 €, crédit 200 000 €, 50/50, résidence principale
- Scénario : vente
- Frais d'agence : 5 % du brut + diagnostics forfait 1 800 €

**Attendu :**
- Agence : 20 000 € · Diagnostics : 1 800 €
- Produit net : 178 200 € (400 000 − 20 000 − 1 800 − 200 000)
- Chaque partie : 89 100 €
- Plus-value : exonération RP (CGI 150 U)

---

## Cas 4 — PACS avec compte joint

**Entrée :**
- Statut : PACS
- Compte joint (community) : 10 000 €
- Voiture propre B : 15 000 €

**Attendu :**
- A : 5 000 €, B : 20 000 €

---

## Cas 5 — Mariage communauté légale

**Entrée :**
- Statut : mariage, communauté légale
- Maison (community) : 300 000 €
- Livret A (own A) : 20 000 €

**Attendu :**
- A : 170 000 € (150 000 + 20 000)
- B : 150 000 €

---

## Cas 6 — Mariage séparation de biens

**Entrée :**
- Statut : mariage, séparation de biens
- Maison indivision 50/50 : 400 000 €, crédit 100 000 €
- Scénario : A rachète

**Attendu :**
- Soulte : 150 000 € (50% de 300 000 € net)

---

## Cas 7 — Communauté universelle

**Entrée :**
- Statut : mariage, communauté universelle
- Maison : 400 000 €, voiture A : 20 000 €
- Dette commune : 40 000 €

**Attendu :**
- Patrimoine net total : 380 000 €
- A : 190 000 €, B : 190 000 €

---

## Cas 8 — Soulte avec droit de partage + émoluments

**Entrée :**
- Concubinage, bien net 200 000 €, 50/50, A rachète
- Droit de partage CGI 746 : 2,50 % de l'actif net
- Émoluments / CSI / débours : ~1,5 % de l'actif net

**Attendu :**
- Soulte : 100 000 €
- Droit de partage : 5 000 €
- Émoluments : 3 000 €
- Cash total : 108 000 €

---

## Cas 9 — Patrimoine avec épargne et dettes perso

**Entrée :**
- Concubinage
- Bien : 300 000 € net
- Épargne A propre : 10 000 €
- Dette B propre : 5 000 €

**Attendu :**
- A : 160 000 € (150 000 + 10 000)
- B : 145 000 € (150 000 - 5 000)

---

## Cas 10 — Complexité élevée

**Entrée :**
- Mariage communauté légale
- Patrimoine > 600 000 €
- Enfants mineurs
- Crédit en cours
- Bien propre + dette commune

**Attendu :**
- Score complexité ≥ 60
- Warnings : MINOR_CHILDREN, HIGH_PATRIMONY, MIXED_OWNERSHIP_DEBT

---

## Checklist validation notaire

- [ ] Cas 1 validé
- [ ] Cas 2 validé
- [ ] Cas 3 validé
- [ ] Cas 4 validé
- [ ] Cas 5 validé
- [ ] Cas 6 validé
- [ ] Cas 7 validé
- [ ] Cas 8 validé
- [ ] Cas 9 validé
- [ ] Cas 10 validé
- [ ] Signataire : _________________
- [ ] Date : _________________
