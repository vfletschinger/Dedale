# Tests automatisés — Dédale Desktop & Mobile

## Vue d'ensemble

Les deux applications (Desktop Web et Mobile) disposent d'une suite de tests automatisés couvrant les composants UI, la logique métier, les hooks, les services et les contextes. Les tests sont exclusivement **unitaires et d'intégration légère** ; les tests fonctionnels bout-en-bout sont traités séparément dans les fiches de tests manuels.

---

## Desktop (Web — Vite/React)

### Outillage

| Outil | Rôle |
|---|---|
| **Vitest** | Framework de test (runner + assertions) |
| **React Testing Library** | Rendu et interaction avec les composants React |
| **jsdom** | Simulation du DOM navigateur |
| **v8** | Collecte de couverture de code |

### Commande d'exécution

```bash
cd Frontend/Web/Dedale
npm run test:run
```

### Seuils de couverture configurés

| Métrique | Seuil minimum |
|---|---|
| Branches | 75 % |
| Fonctions | 85 % |
| Lignes | 80 % |
| Instructions | 80 % |

### Résultats

- **12 suites**, **169 tests** — tous en succès, 0 échec
- Quelques avertissements `act(...)` (non bloquants, liés à des mises à jour d'état asynchrones dans les tests)

### Suites de tests

#### Composants (`src/__tests__/components/`)

| Fichier | Ce qui est testé |
|---|---|
| `AddPointForm.test.tsx` | Formulaire d'ajout de point d'intérêt : rendu des champs, interactions (nom, type, statut, commentaire), soumission (données envoyées, erreur sans eventId, gestion d'erreur, état de chargement), validation (nom vide), fermeture (bouton Annuler et ×). |
| `AdminForm.test.tsx` | Formulaire d'authentification admin : rendu (champs username/password), saisie, validation (champs vides, partiels), soumission (callback, état chargement, erreur), état du bouton (activé/désactivé). |
| `EquipementForm.test.tsx` | Formulaire équipement : suggestion automatique de quantité en fonction de la longueur de ligne, blocage de soumission si la date de pose est postérieure à la date de dépose. |
| `LoadingScreen.test.tsx` | Écran de chargement : présence du logo, structure du conteneur, indicateurs animés, centrage, accessibilité (alt text), classes responsives. |
| `Navigation.test.tsx` | Barre de navigation : affichage logo/titre, onglets, état sans événement sélectionné, affichage du nom d'événement, bouton de désélection, navigation au clic, désactivation des onglets sans sélection, mise en évidence de la page active. |
| `SelectableList.test.tsx` | Liste sélectionnable : rendu de tous les items, sélection simple (clic), désélection, remplacement de sélection, sélection multiple (Ctrl+clic), classes CSS personnalisées. |

> **Commentaire** : La couverture des composants est très complète. Chaque composant possède des blocs `describe` distincts pour le rendu, les interactions, la soumission et les cas d'erreur, ce qui facilite la lecture des rapports.

#### Hooks (`src/__tests__/hooks/`)

| Fichier | Ce qui est testé |
|---|---|
| `useEvents.test.ts` | Hook `useEvents` : état initial, `loadEvents` (succès, chargement, erreur), `selectEvent`, `addEvent` (succès, rechargement, erreur), `editEvent`, `removeEvent` (succès, rechargement, désélection si supprimé), `clearError`, `clearSelection`. |
| `useNavigation.test.ts` | Hook `useNavigation` : initialisation (page par défaut ou personnalisée, pages visitées), navigation (nouvelle page, même page ignorée, historique), retour arrière (`canGoBack`, retour effectif, premier item), reset. |

> **Commentaire** : Les hooks sont testés de manière isolée avec des mocks de la couche service. Cela permet de valider la logique d'état sans dépendre du DOM.

#### Services (`src/__tests__/services/`)

| Fichier | Ce qui est testé |
|---|---|
| `database.test.ts` | Service base de données — gestion des personnes : `getAllPersons`, `getPersonById` (validation ID), `createPerson` (validation email, rôle, champs obligatoires), `updatePerson`, `deletePerson` (gestion d'erreurs). |
| `eventService.test.ts` | Service événements : `fetchEvents`, `fetchEventById` (non trouvé, erreur), `createEvent`, `updateEvent`, `deleteEvent` — tous avec cas nominal et cas d'erreur. |

> **Commentaire** : Les services sont mockés au niveau `fetch`/driver de BDD, ce qui permet de tester la logique de transformation et de gestion d'erreur indépendamment du backend.

#### Utilitaires (`src/__tests__/utils/`)

| Fichier | Ce qui est testé |
|---|---|
| `mapStyles.test.ts` | Fonctions de style cartographique. |
| `mapUtils.test.ts` | Fonctions utilitaires de la carte (calculs géométriques, conversions). |

---

## Mobile (React Native — Expo)

### Outillage

| Outil | Rôle |
|---|---|
| **Jest 29** | Framework de test |
| **jest-expo** | Preset Expo : transformations Babel, mocks natifs |
| **React Test Renderer** | Rendu des composants React Native |
| **jest-junit** | Export des résultats en XML (CI) |

### Commande d'exécution

```bash
cd Frontend/Mobile/Dedale
CI=1 npm test -- --runInBand
```

> `--runInBand` force l'exécution séquentielle des suites pour éviter les conflits de ressources (BDD locale SQLite mockée).

### Résultats

- **17 suites**, **125 tests** — tous en succès, 0 échec
- Avertissements non bloquants :
  - `NativeEventEmitter` : mock React Native incomplet (attendu avec jest-expo)
  - `baseline-browser-mapping` obsolète (dépendance transitoire)
  - `console.error` dans `TeamGuidanceScreen` et `Helper` : chemins d'erreur volontairement testés

### Suites de tests

#### Composants (`src/tests/components/`)

| Fichier | Ce qui est testé |
|---|---|
| `ObstacleSelector.test.tsx` | Sélecteur d'obstacles : rendu invisible si non visible, titre modal (mode édition vs ajout), chargement des types depuis la BDD, sélection/incrément/décrément, pré-sélection, dropdown, saisie numérique personnalisée, suppression, callback `onSave` / `onClose`, obstacles multiples, réinitialisation après sauvegarde, gestion d'erreur BDD, désactivation du bouton si aucun type sélectionné, message état vide. |

> **Commentaire** : Suite très dense (17 cas) couvrant tous les états interactifs du composant, y compris les cas aux limites (erreur BDD, annulation, reset).

#### Contextes (`src/tests/context/`)

| Fichier | Ce qui est testé |
|---|---|
| `EventContext.test.tsx` | Contexte événements : erreur si utilisé hors provider, chargement + calcul de statut + tri, tri par date (même statut), sélection d'événement, événement inexistant, erreur BDD. |
| `GeometriesContext.test.tsx` | Contexte géométries : chargement et regroupement par `event_id`, rafraîchissement des données. |
| `PointsContext.test.tsx` | Contexte points : chargement et tri au démarrage, rafraîchissement via `refreshPoints`. |
| `WebSocketContext.test.tsx` | Contexte WebSocket : erreur hors provider, valeurs par défaut, mise à jour de `wsClient`/`isConnected`, `sendEvent` (client null, non connecté, succès, exception). |

> **Commentaire** : Les contextes React sont testés avec un provider réel et des consommateurs de test, ce qui valide à la fois le contrat d'interface et les effets de bord (BDD, WebSocket).

#### Logique métier (`src/tests/logic/`)

| Fichier | Ce qui est testé |
|---|---|
| `ConnectEvent.test.tsx` | Écran de connexion à un événement : état vide, liste d'événements, toggle scanner QR, sélection d'événement (stats, contexte, navigation). Fonction `sortEventsByStatus` : priorité actif > planifié > passé, statut manquant. |
| `Map.test.ts` | Parsing WKT : `POINT`, `LINESTRING`, `POLYGON`, WKT invalide, chaîne vide — tous avec vérification de la valeur retournée. |
| `WebSocketClient.test.ts` | Client WebSocket : connexion + réception JSON, message spécial `"fini"`, envoi de données, détection d'erreur de connexion. |

> **Commentaire** : Le parsing WKT et le client WebSocket sont testés sans dépendances UI, ce qui permet une validation rapide de la logique bas niveau.

#### Écrans (`src/tests/screens/`)

| Fichier | Ce qui est testé |
|---|---|
| `InterestPointsScreen.test.tsx` | Écran points d'intérêt : loader, titre/compteur, état vide + bouton ajout, changement de tri (plus proche / plus récent), navigation, filtrage par événement, singulier/pluriel, absence d'événement sélectionné, intégration hooks (`useEvent`, `usePoints`, `useNavigation`, `getDatabase`). |
| `PlanningScreen.test.tsx` | Écran planning : affichage équipe + liste d'actions, navigation vers `TeamGuidance`, toggle scanner QR, état vide (aucune équipe). |
| `PointDetails.test.tsx` & `RegisterPointScreen.test.tsx` | Persistance critique `savePointToDB` : sauvegarde complète (commentaire, images, obstacles), sauvegarde minimale (sans images ni obstacles), échec image non bloquant pour la sauvegarde du point. |
| `SettingsScreen.test.tsx` | Écran paramètres : rendu de l'événement et des boutons, ouverture modale de changement d'événement, mode Recevoir (scanner), mode Envoyer (scanner + suppression sur succès), blocage si aucun événement. |
| `TeamGuidanceScreen.test.tsx` | Guidage équipe : état de chargement puis carte + actions, requête OSRM, actions toutes terminées, ouverture Google Maps (lien `https`), fallback sur coordonnées directes, maintien du tracé en cas d'échec OSRM, détection de proximité + validation via `Alert`. |

> **Commentaire** : Les écrans sont testés avec des mocks des hooks de navigation et de contexte. La suite `TeamGuidanceScreen` est particulièrement complète car elle couvre des comportements réseau (OSRM) et de géolocalisation.

#### Services (`src/tests/services/`)

| Fichier | Ce qui est testé |
|---|---|
| `databaseAcces.test.ts` | Accès BDD SQLite : commentaires (update, delete, add), images (add avec UUID, update, delete), équipements/obstacles (add sans et avec coordonnées, update, delete), points (update coordonnées, delete, update timestamp avec et sans erreur). |
| `Helper.test.ts` | Utilitaires : `generateUUID` (format v4, unicité), `shortId` (troncature, falsy), `calculateDistance` (euclidienne, points identiques), `getUserLocation` (permission accordée/refusée), `getAddressFromCoords` (formatage, champs manquants, erreur), `getShortAddressFromCoords` (priorité rue > ville > nom). |
| `ImageHelper.test.ts` | Gestion images : `imageToBase64` (URI → base64), `saveImageToBDD` (conversion + ID + insert, erreur BDD), `pickImage` (permission accordée, refusée, annulation, erreur). |

> **Commentaire** : Le service `databaseAcces` est testé en vérifiant les requêtes SQL générées via un mock de `expo-sqlite`, ce qui garantit l'exactitude des opérations sans base de données réelle.

---

## Commentaires généraux

### Points forts

- **Couverture large** : 29 suites au total couvrant composants, hooks, contextes, logique, écrans et services.
- **Isolation** : chaque couche est testée indépendamment grâce à des mocks précis (BDD, WebSocket, géolocalisation, navigation).
- **Cas d'erreur systématiques** : chaque service et hook dispose de cas nominaux *et* de cas d'erreur, ce qui renforce la robustesse.
- **Tests de contrat de contexte** : la vérification que les contextes lèvent une erreur lorsqu'ils sont utilisés hors provider est une bonne pratique rarement mise en place.

### Limites et axes d'amélioration

- **Tests end-to-end absents** : aucun test de navigation complète entre écrans ni de flux complet (connexion → création de point → synchronisation WebSocket). Ces scénarios sont couverts par les fiches manuelles.
- **Avertissements `act()`** (Desktop) : signalent que certaines mises à jour d'état ne sont pas enveloppées dans `act()`. Non bloquants aujourd'hui mais à corriger pour éviter de masquer de vrais problèmes.
- **Mocks natifs partiels** (Mobile) : `NativeEventEmitter` et quelques APIs Expo sont mockés superficiellement ; des comportements edge-case liés à ces APIs ne sont pas testés.
- **Duplication** `PointDetails` / `RegisterPointScreen` : les deux fichiers testent la même fonction `savePointToDB` avec les mêmes cas — à fusionner.
