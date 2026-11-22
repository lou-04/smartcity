# Smart City : signalements urbains sur blockchain

DApp permettant aux citoyens de signaler des problèmes urbains et aux services municipaux d'en assurer le suivi, avec une traçabilité complète on-chain : smart contract Solidity, frontend React et import Excel/CSV.

## Fonctionnalités

- Création d'un signalement par un citoyen (localisation, description, catégorie, priorité)
- Identifiant unique par signalement (`issueId` numérique, plus un identifiant métier `CITY-2026-001` pour les imports)
- Affectation d'une équipe d'intervention (réservé à la municipalité)
- Cycle de vie : `Reported → Assigned → InProgress → Resolved → Closed` (une seule étape en avant)
- Historique non modifiable : date, statut, équipe, commentaire et adresse de l'acteur
- Consultation publique sans wallet
- Import Excel/CSV côté client : aperçu, validation, sélection des lignes, envoi par lots

## Structure

```
smartcity/
├── contracts-project/        Hardhat : contrat, tests, déploiement
│   ├── contracts/UrbanIssueRegistry.sol
│   ├── test/UrbanIssueRegistry.js
│   ├── scripts/deploy.js
│   └── hardhat.config.js
├── frontend/                 React + Vite + wagmi/viem + SheetJS
│   ├── src/
│   │   ├── wagmi.js          config réseau, ABI, messages d'erreur
│   │   ├── main.jsx · App.jsx
│   │   ├── Issues.jsx        consultation publique + historique
│   │   ├── Report.jsx        formulaire citoyen
│   │   ├── Municipal.jsx     affectation et changement de statut
│   │   └── Import.jsx        import Excel / CSV
│   └── generate-xlsx.cjs     génère les fichiers Excel d'exemple
├── urban_issues.xlsx                 fichier d'exemple valide
├── urban_issues-test-erreurs.xlsx    fichier avec erreurs volontaires
└── README.md
```

## Prérequis

- Node.js 18 ou 20 LTS (Hardhat 2 ne supporte pas officiellement Node 25)
- npm et Git
- Extension navigateur MetaMask

Vérification : `node -v && npm -v && git --version`

## Installation

```bash
cd contracts-project && npm install
cd ../frontend && npm install
```

## Lancer en local

**Terminal 1 : blockchain locale (à laisser ouvert)**

```bash
cd contracts-project
npx hardhat node
```

**Terminal 2 : tests puis déploiement**

```bash
cd contracts-project
npx hardhat test
npx hardhat run scripts/deploy.js --network localhost
```

Le script affiche `UrbanIssueRegistry déployé à : 0x...`. Copiez cette adresse complète (42 caractères) dans `frontend/.env` :

```
VITE_CONTRACT_ADDRESS=0x0165878A594ca255338adfa4d48449f69242Eb8F
```

**Terminal 3 : frontend**

```bash
cd frontend
npm run dev
```

Ouvrir http://localhost:5173.

> Vite ne lit `.env` qu'au démarrage : relancez `npm run dev` après toute modification.

## Configuration de MetaMask

1. Sélectionner le réseau **Localhost 8545** (RPC `http://127.0.0.1:8545`, Chain ID `31337`, symbole `ETH`).
2. Importer les clés privées des comptes affichés par `hardhat node` (clés de test publiques, sans valeur) :
   - **Compte #0** : déployeur, possède `DEFAULT_ADMIN_ROLE` et `MUNICIPAL_ROLE` (municipalité).
   - **Compte #1** : simple citoyen (aucun rôle).
3. **À chaque redémarrage du node** : redéployer, mettre à jour `frontend/.env`, relancer Vite, puis dans MetaMask faire *Settings → Advanced → Clear activity tab data* (sinon erreur « Nonce too high »).

## Utilisation

| Onglet | Qui | Action |
|---|---|---|
| **Signalements** | Tout le monde (sans wallet) | Liste des signalements. Le bouton *Détails* affiche l'historique complet. |
| **Signaler un problème** | Citoyen (wallet connecté) | Remplir le formulaire puis envoyer. Le hash de transaction s'affiche dans le journal. |
| **Municipalité** | Compte avec `MUNICIPAL_ROLE` | Charger un signalement par son ID, saisir un commentaire, affecter une équipe, puis passer au statut suivant. |
| **Import Excel** | Compte avec `MUNICIPAL_ROLE` | Choisir un fichier `.xlsx` ou `.csv`, vérifier l'aperçu, cocher les lignes, enregistrer. |

Un compte sans rôle municipal voit un avertissement rouge, et les erreurs du contrat sont traduites en messages lisibles.

## Format du fichier Excel (`urban_issues.xlsx`)

| Colonne | Exemple | Règle |
|---|---|---|
| issueId | CITY-2026-001 | obligatoire, unique (fichier et blockchain) |
| issueType | StreetLight | obligatoire |
| location | Avenue Mohammed V | obligatoire |
| description | Streetlight not working | obligatoire |
| reportDate | 2026-11-19 | obligatoire, format `AAAA-MM-JJ` |
| priority | High | `Low`, `Medium`, `High`, `Critical` (ou 0 à 3) |
| reportedBy | Citizen01 | libellé libre |
| assignedTo | UrbanTeam01 | obligatoire si le statut n'est pas `Reported` |
| status | Reported | `Reported`, `Assigned`, `InProgress`, `Resolved`, `Closed` |

- Les fichiers d'exemple se régénèrent avec `cd frontend && node generate-xlsx.cjs`.
- `urban_issues-test-erreurs.xlsx` contient des erreurs volontaires (champ vide, mauvaise date, statut sans équipe, doublon) pour tester la validation.
- La colonne `reportDate` doit être au format **Texte** dans Excel, sinon Excel la convertit en date.
- Les lignes invalides sont signalées en rouge et ne sont pas sélectionnables.
- L'envoi se fait par lots de 10 (limite du contrat : 20).

## Smart contract : `UrbanIssueRegistry`

| Fonction | Accès | Rôle |
|---|---|---|
| `reportIssue(...)` | tous | crée un signalement |
| `batchImportIssues(rows[])` | `MUNICIPAL_ROLE` | import en masse (max 20) |
| `assignTeam(id, team, note)` | `MUNICIPAL_ROLE` | affecte une équipe, statut `Assigned` |
| `updateStatus(id, status, note)` | `MUNICIPAL_ROLE` | avance d'une étape |
| `getIssue(id)` | public, `view` | lit un signalement |
| `getHistory(id)` | public, `view` | lit l'historique |
| `getIssueIdByExternalId(ref)` | public, `view` | retrouve un ID à partir de `CITY-2026-001` |

**Events :** `IssueReported`, `IssueAssigned`, `StatusUpdated` (avec `issueId` indexé).

**Règles métier :**
- Une seule étape en avant (pas de saut de `Reported` à `Closed`).
- Une équipe est obligatoire avant `InProgress`.
- `issueId` externe unique : refus des doublons.
- Historique en ajout seulement (aucune fonction ne modifie ni ne supprime une entrée).

## Tests

```bash
cd contracts-project
npx hardhat test
```

14 tests : création, droits d'accès, cycle de vie complet, transitions invalides, historique, réaffectation, import (rôle, doublons, statut sans équipe, lot vide).

## Déploiement

- **Réseau :** Hardhat local (chain ID 31337)
- **Adresse du contrat :** 0x0165878A594ca255338adfa4d48449f69242Eb8F

Déploiement Sepolia (optionnel) : renseigner `SEPOLIA_RPC_URL` et `PRIVATE_KEY` (compte de test dédié) dans `contracts-project/.env`, puis :

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

## Limites connues

- `reporter` on-chain est le compte qui signe : pour un import, c'est la municipalité. Le libellé `reportedBy` du fichier est stocké à part.
- `reportDate` est la date déclarée dans le fichier, alors que `createdAt` est la date d'enregistrement on-chain.
- Les données sont publiques et définitives sur la blockchain : ne pas y mettre de données personnelles sensibles.
- Un seul compte municipal par défaut : en production, utiliser un multisig et `grantRole` pour les agents.

## Sécurité

- Aucune clé privée dans le frontend : la signature passe par le wallet.
- Les fichiers `.env` sont exclus du dépôt (`.gitignore`).
- Contrôle d'accès par rôle (`AccessControl`) et validation des données côté client avant toute transaction.

## Captures d'écran

![Aperçu de l'import avec erreurs](screenshot-import.png)
![Historique d'un signalement](screenshot-historique.png)
![Avertissement de rôle](screenshot-role.png)