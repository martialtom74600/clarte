# Clarté — Simulateur Financier de Séparation

Outil B2C pour simuler la répartition patrimoniale lors d'une séparation (Concubinage, PACS, Mariage).

## Structure

```
separation/
├── apps/web          # Application Next.js B2C
├── packages/
│   ├── engine        # Moteur de calcul pur
│   ├── schemas       # Schémas Zod partagés
│   ├── lead-scoring  # Scoring CPL
│   └── ui            # Composants UI partagés
└── docs/             # Documentation légale
```

## Démarrage

```bash
npm install
npm run dev
```

## Variables d'environnement

Copiez `apps/web/.env.example` vers `apps/web/.env.local` et renseignez les clés.

## Disclaimer

Cet outil fournit une simulation indicative. Il ne remplace pas un conseil juridique ou notarial.
