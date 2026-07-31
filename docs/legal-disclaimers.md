# Disclaimers légaux — Clarté

## Usage de l'outil

Clarté est un outil de **simulation indicative** destiné à aider les utilisateurs à comprendre leur situation patrimoniale lors d'une séparation ou réorganisation de vie commune.

## Ce que Clarté n'est PAS

- Un conseil juridique personnalisé
- Un acte notarié ou une attestation officielle
- Une recommandation de stratégie patrimoniale "gagnante"
- Un substitut à l'intervention d'un juge aux affaires familiales le cas échéant
- Une offre de crédit ou un accord bancaire (désolidarisation, refinancement)

## Obligations de l'utilisateur

L'utilisateur doit consulter un **notaire**, **avocat** ou **expert-comptable** avant toute décision engageante (vente, rachat de parts, signature d'un protocole).

## Données personnelles

- Données sauvegardées localement par défaut (localStorage)
- Transmission serveur uniquement sur action explicite (email, partage)
- Conformité RGPD : droit d'accès, rectification, suppression

## Limitations du moteur de calcul (pack 2026.6)

- Simplification des régimes matrimoniaux complexes
- Pas de prise en compte des donations, héritages anticipés, ou clauses particulières
- Estimation DVF / barèmes marché indicative (±15-20 %) — fallback unique moteur partagé avec les API
- Frais d'acte estimés via **droit de partage CGI art. 746** (1,10 % mariage/PACS · 2,50 % concubinage / sortie d'indivision) **+ émoluments / CSI / débours ~1,5 %** de l'actif net — pas un forfait « 7,5 % »
- Frais de sortie vente : **~5 % agence** + **forfait diagnostics ~1 800 €** ; plus-value CGI **150 U / 150 VC** (exonération RP ; hors RP : prix d'acquisition + abattements durée + IR 19 % + PS 17,2 % + surtaxe)
- Location (`rent_out`) : loyer zone × surface − vacance (~6 %) − crédit − TF (~0,8 %/an) − PNO − gestion (~7 %) − micro-foncier (abatt. 30 % + IR indicatif + PS 17,2 %) — pas un bilan fiscal personnalisé
- Rachat (`keep_*`) : soulte + **indemnité d'occupation** indicative ; feu croisé financement / relogement ; apports = **créance** (815-13) ou **récompense 1469** (profit si prix d'acquisition), plus de rewrite silencieux des %
- Prestation compensatoire art. 270–271 : quantum forfaitaire indicatif (mariage)
- Mode « garder mon crédit » : **sous accord discrétionnaire de la banque** (désolidarisation)
- Actif net négatif (CRD > valeur) : alerte « dette à partager », pas de soulte
- Identifiants de portes unifiés : `keep_a` · `keep_b` · `sell` · `rent_out`

## Affichage obligatoire

Chaque page de résultat et chaque PDF doit afficher :

> Simulation indicative ne constituant pas un conseil juridique, fiscal ou notarial. Consultez un professionnel avant toute décision.
