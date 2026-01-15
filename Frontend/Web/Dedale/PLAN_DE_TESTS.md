# Plan de Tests - Application Dedale (Frontend Web)

| Nombre total de tests : 186 | Couverture globale : ~85% | Tests Passés : 186 | Tests Skippés : 0 |
|---|---|---|---|

---

## Tests des Utilitaires (mapUtils.test.ts) - 43 tests

| Type de test | Titre | Scénario | Attendu | Observé | Résultat | Commentaire | Élément testé |
|---|---|---|---|---|---|---|---|
| Unitaire | formatDistance - meters | formatDistance(150) | "150 m" | "150 m" | ✅ OK | Distances < 1000m | formatDistance |
| Unitaire | formatDistance - kilometers | formatDistance(1500) | "1.5 km" | "1.5 km" | ✅ OK | Distances >= 1000m | formatDistance |
| Unitaire | formatDistance - zero | formatDistance(0) | "0 m" | "0 m" | ✅ OK | Valeur nulle | formatDistance |
| Unitaire | formatDistance - negative | formatDistance(-100) | "0 m" | "0 m" | ✅ OK | Valeurs négatives | formatDistance |
| Unitaire | formatDistance - rounding | formatDistance(1234) | "1.2 km" | "1.2 km" | ✅ OK | Arrondi décimales | formatDistance |
| Unitaire | formatDuration - seconds | formatDuration(30) | "30 seconds" | "30 seconds" | ✅ OK | Durée < 60s | formatDuration |
| Unitaire | formatDuration - minutes | formatDuration(120) | "2 minutes" | "2 minutes" | ✅ OK | Durée en minutes | formatDuration |
| Unitaire | formatDuration - mixed | formatDuration(90) | "1 minute 30 seconds" | "1 minute 30 seconds" | ✅ OK | Minutes + secondes | formatDuration |
| Unitaire | formatDuration - hours | formatDuration(3600) | "1 hour" | "1 hour" | ✅ OK | Durée en heures | formatDuration |
| Unitaire | formatDuration - zero | formatDuration(0) | "0 seconds" | "0 seconds" | ✅ OK | Valeur nulle | formatDuration |
| Unitaire | calculateDistance - two points | calculateDistance(strasbourg, colmar) | 50000 < d < 65000 | ~58000 | ✅ OK | Distance Haversine | calculateDistance |
| Unitaire | calculateDistance - same point | calculateDistance(point, point) | 0 | 0 | ✅ OK | Distance nulle | calculateDistance |
| Unitaire | calculateDistance - equator | calculateDistance(equator1, equator2) | 110000 < d < 112000 | ~111000 | ✅ OK | Distance équateur | calculateDistance |
| Unitaire | calculateDistance - poles | calculateDistance(pole1, pole2) | number > 0 | number > 0 | ✅ OK | Pôles géographiques | calculateDistance |
| Unitaire | calculateDistance - invalid | calculateDistance(valid, invalid) | throw Error | Error thrown | ✅ OK | Coords invalides | calculateDistance |
| Unitaire | calculateBearing - basic | calculateBearing(strasbourg, colmar) | 0 <= b < 360 | number in range | ✅ OK | Cap en degrés | calculateBearing |
| Unitaire | calculateBearing - north | calculateBearing(south, north) | ~0 | ~0 | ✅ OK | Direction nord | calculateBearing |
| Unitaire | calculateBearing - east | calculateBearing(west, east) | ~90 | ~90 | ✅ OK | Direction est | calculateBearing |
| Unitaire | calculateBearing - same point | calculateBearing(point, point) | 0 | 0 | ✅ OK | Points identiques | calculateBearing |
| Unitaire | formatCoordinates - decimal | formatCoordinates(48.5734, 7.7521) | "48.5734°N, 7.7521°E" | "48.5734°N, 7.7521°E" | ✅ OK | Format décimal | formatCoordinates |
| Unitaire | formatCoordinates - negative | formatCoordinates(-48.5734, -7.7521) | "48.5734°S, 7.7521°W" | "48.5734°S, 7.7521°W" | ✅ OK | Coords négatives | formatCoordinates |
| Unitaire | formatCoordinates - zero | formatCoordinates(0, 0) | "0.0000°N, 0.0000°E" | "0.0000°N, 0.0000°E" | ✅ OK | Point origine | formatCoordinates |
| Unitaire | formatCoordinates - precision | formatCoordinates(48.5734, 7.7521, 2) | "48.57°N, 7.75°E" | "48.57°N, 7.75°E" | ✅ OK | Précision custom | formatCoordinates |
| Unitaire | formatCoordinates - DMS | formatCoordinates(48.5734, 7.7521, 'DMS') | Contient °'" | Contient °'" | ✅ OK | Format DMS | formatCoordinates |
| Unitaire | validateCoordinates - valid | validateCoordinates(48.5734, 7.7521) | true | true | ✅ OK | Coords valides | validateCoordinates |
| Unitaire | validateCoordinates - boundaries | validateCoordinates(-90, -180) | true | true | ✅ OK | Limites valides | validateCoordinates |
| Unitaire | validateCoordinates - invalid lat | validateCoordinates(91, 7.7521) | false | false | ✅ OK | Latitude hors limites | validateCoordinates |
| Unitaire | validateCoordinates - invalid lon | validateCoordinates(48.5734, 181) | false | false | ✅ OK | Longitude hors limites | validateCoordinates |
| Unitaire | validateCoordinates - NaN | validateCoordinates(NaN, 7.7521) | false | false | ✅ OK | Valeur NaN | validateCoordinates |
| Unitaire | validateCoordinates - non-numeric | validateCoordinates('48', 7.7521) | false | false | ✅ OK | Type invalide | validateCoordinates |
| Unitaire | parseGeoJSON - valid | parseGeoJSON(validJSON) | FeatureCollection | FeatureCollection | ✅ OK | JSON valide | parseGeoJSON |
| Unitaire | parseGeoJSON - invalid JSON | parseGeoJSON('invalid') | throw Error | Error thrown | ✅ OK | JSON malformé | parseGeoJSON |
| Unitaire | parseGeoJSON - invalid structure | parseGeoJSON(invalidGeoJSON) | throw Error | Error thrown | ✅ OK | Structure invalide | parseGeoJSON |
| Unitaire | parseGeoJSON - empty | parseGeoJSON(emptyCollection) | features.length = 0 | features.length = 0 | ✅ OK | Collection vide | parseGeoJSON |
| Unitaire | validateEventData - valid | validateEventData(validEvent) | true | true | ✅ OK | Événement valide | validateEventData |
| Unitaire | validateEventData - no name | validateEventData(noName) | false | false | ✅ OK | Nom requis | validateEventData |
| Unitaire | validateEventData - invalid date | validateEventData(badDate) | false | false | ✅ OK | Format date | validateEventData |
| Unitaire | validateEventData - end before start | validateEventData(badDates) | false | false | ✅ OK | Ordre dates | validateEventData |
| Unitaire | sortEventsByDate - ascending | sortEventsByDate(events, 'asc') | Ordre croissant | Ordre croissant | ✅ OK | Tri ASC | sortEventsByDate |
| Unitaire | sortEventsByDate - descending | sortEventsByDate(events, 'desc') | Ordre décroissant | Ordre décroissant | ✅ OK | Tri DESC | sortEventsByDate |
| Unitaire | filterEventsByStatus - actif | filterEventsByStatus(events, 'actif') | Events actifs | Events actifs | ✅ OK | Filtre statut | filterEventsByStatus |
| Unitaire | filterEventsByStatus - empty | filterEventsByStatus([], 'actif') | [] | [] | ✅ OK | Cas vide | filterEventsByStatus |
| Unitaire | calculateMidpoint - basic | calculateMidpoint(point1, point2) | Point milieu | Point milieu | ✅ OK | Calcul milieu | calculateMidpoint |

---

## Tests Base de Données (database.test.ts) - 15 tests

| Type de test | Titre | Scénario | Attendu | Observé | Résultat | Commentaire | Élément testé |
|---|---|---|---|---|---|---|---|
| Unitaire | initDatabase - success | Initialisation DB | Promise resolved | Promise resolved | ✅ OK | Init OK | initDatabase |
| Unitaire | initDatabase - error | Erreur init | Gère erreur | Gère erreur | ✅ OK | Gestion erreur | initDatabase |
| Unitaire | executeQuery - select | SELECT query | Résultats array | Résultats array | ✅ OK | Query SELECT | executeQuery |
| Unitaire | executeQuery - insert | INSERT query | ID inséré | ID inséré | ✅ OK | Query INSERT | executeQuery |
| Unitaire | executeQuery - update | UPDATE query | Rows affected | Rows affected | ✅ OK | Query UPDATE | executeQuery |
| Unitaire | executeQuery - delete | DELETE query | Rows deleted | Rows deleted | ✅ OK | Query DELETE | executeQuery |
| Unitaire | executeQuery - params | Query avec params | Params bindés | Params bindés | ✅ OK | Paramètres | executeQuery |
| Unitaire | executeQuery - error | Query invalide | Erreur catchée | Erreur catchée | ✅ OK | Gestion erreur | executeQuery |
| Unitaire | getConnection - active | Connexion active | Connection obj | Connection obj | ✅ OK | Get connexion | getConnection |
| Unitaire | getConnection - closed | Connexion fermée | Reconnexion | Reconnexion | ✅ OK | Auto-reconnect | getConnection |
| Unitaire | closeConnection - success | Fermeture | Promise resolved | Promise resolved | ✅ OK | Close OK | closeConnection |
| Unitaire | transaction - commit | Transaction OK | Commit success | Commit success | ✅ OK | Transaction | runTransaction |
| Unitaire | transaction - rollback | Transaction erreur | Rollback | Rollback | ✅ OK | Rollback | runTransaction |
| Unitaire | batchInsert - multiple | Insert multiple | All inserted | All inserted | ✅ OK | Batch insert | batchInsert |
| Unitaire | batchInsert - empty | Tableau vide | No-op | No-op | ✅ OK | Cas vide | batchInsert |

---

## Tests Service Événements (eventService.test.ts) - 12 tests

| Type de test | Titre | Scénario | Attendu | Observé | Résultat | Commentaire | Élément testé |
|---|---|---|---|---|---|---|---|
| Unitaire | fetchEvents - success | Récupérer events | Array d'events | Array d'events | ✅ OK | Fetch OK | fetchEvents |
| Unitaire | fetchEvents - empty | Aucun event | [] | [] | ✅ OK | Cas vide | fetchEvents |
| Unitaire | fetchEvents - error | Erreur réseau | Throw error | Throw error | ✅ OK | Gestion erreur | fetchEvents |
| Unitaire | fetchEventById - success | Récup par ID | Event object | Event object | ✅ OK | Fetch by ID | fetchEventById |
| Unitaire | fetchEventById - not found | ID inexistant | null ou erreur | Erreur | ✅ OK | Not found | fetchEventById |
| Unitaire | fetchEventById - error | Erreur fetch | Throw error | Throw error | ✅ OK | Gestion erreur | fetchEventById |
| Unitaire | createEvent - success | Créer event | Event créé | Event créé | ✅ OK | Create OK | createEvent |
| Unitaire | createEvent - error | Erreur création | Throw error | Throw error | ✅ OK | Validation fail | createEvent |
| Unitaire | updateEvent - success | Maj event | Event mis à jour | Event maj | ✅ OK | Update OK | updateEvent |
| Unitaire | updateEvent - error | Erreur maj | Throw error | Throw error | ✅ OK | Update fail | updateEvent |
| Unitaire | deleteEvent - success | Suppr event | Void/success | Success | ✅ OK | Delete OK | deleteEvent |
| Unitaire | deleteEvent - error | Erreur suppr | Throw error | Throw error | ✅ OK | Delete fail | deleteEvent |

---

## Tests Hook useEvents (useEvents.test.ts) - 18 tests

| Type de test | Titre | Scénario | Attendu | Observé | Résultat | Commentaire | Élément testé |
|---|---|---|---|---|---|---|---|
| Unitaire | État Initial - events | État initial events | [] | [] | ✅ OK | Init vide | useEvents.events |
| Unitaire | État Initial - isLoading | État initial loading | boolean défini | boolean défini | ✅ OK | Loading state | useEvents.isLoading |
| Unitaire | État Initial - functions | Fonctions exposées | Toutes présentes | Toutes présentes | ✅ OK | API complète | useEvents |
| Unitaire | loadEvents - success | Charger events | Events chargés | Events chargés | ✅ OK | Load OK | loadEvents |
| Unitaire | loadEvents - updates state | State après load | State mis à jour | State maj | ✅ OK | State update | loadEvents |
| Unitaire | loadEvents - error | Erreur chargement | Error state | Error state | ✅ OK | Gestion erreur | loadEvents |
| Unitaire | selectEvent - success | Sélectionner event | selectedEvent set | selectedEvent set | ✅ OK | Select OK | selectEvent |
| Unitaire | selectEvent - error | Erreur sélection | Error state | Error state | ✅ OK | Select fail | selectEvent |
| Unitaire | addEvent - success | Ajouter event | Event ajouté | Event ajouté | ✅ OK | Add OK | addEvent |
| Unitaire | addEvent - updates list | Liste après ajout | Liste + 1 | Liste + 1 | ✅ OK | List update | addEvent |
| Unitaire | addEvent - error | Erreur ajout | Error state | Error state | ✅ OK | Add fail | addEvent |
| Unitaire | editEvent - success | Modifier event | Event modifié | Event modifié | ✅ OK | Edit OK | editEvent |
| Unitaire | editEvent - updates list | Liste après edit | Liste maj | Liste maj | ✅ OK | List update | editEvent |
| Unitaire | removeEvent - success | Supprimer event | Event supprimé | Event supprimé | ✅ OK | Remove OK | removeEvent |
| Unitaire | removeEvent - updates list | Liste après suppr | Liste - 1 | Liste - 1 | ✅ OK | List update | removeEvent |
| Unitaire | removeEvent - error | Erreur suppression | Error state | Error state | ✅ OK | Remove fail | removeEvent |
| Unitaire | clearError | Effacer erreur | error = null | error = null | ✅ OK | Clear error | clearError |
| Unitaire | clearSelection | Effacer sélection | selected = null | selected = null | ✅ OK | Clear select | clearSelection |

---

## Tests Hook useNavigation (useNavigation.test.ts) - 20 tests

| Type de test | Titre | Scénario | Attendu | Observé | Résultat | Commentaire | Élément testé |
|---|---|---|---|---|---|---|---|
| Unitaire | initial state | État initial | Values par défaut | Values par défaut | ✅ OK | Init state | useNavigation |
| Unitaire | initial position | Position initiale | null ou default | null | ✅ OK | No position | currentPosition |
| Unitaire | initial destination | Destination init | null | null | ✅ OK | No dest | destination |
| Unitaire | initial isNavigating | Navigation init | false | false | ✅ OK | Not navigating | isNavigating |
| Unitaire | setDestination | Définir destination | Destination set | Destination set | ✅ OK | Set dest | setDestination |
| Unitaire | setDestination coords | Coords destination | Coords valides | Coords valides | ✅ OK | Valid coords | setDestination |
| Unitaire | startNavigation | Démarrer nav | isNavigating true | isNavigating true | ✅ OK | Start nav | startNavigation |
| Unitaire | startNavigation no dest | Sans destination | Erreur ou no-op | No-op | ✅ OK | Needs dest | startNavigation |
| Unitaire | stopNavigation | Arrêter nav | isNavigating false | isNavigating false | ✅ OK | Stop nav | stopNavigation |
| Unitaire | stopNavigation clears | Clear state | State reset | State reset | ✅ OK | Reset state | stopNavigation |
| Unitaire | updatePosition | Maj position | Position maj | Position maj | ✅ OK | Update pos | updatePosition |
| Unitaire | updatePosition calculs | Calculs distance | Distance calculée | Distance calc | ✅ OK | Calc distance | updatePosition |
| Unitaire | getDistanceToDestination | Distance dest | Distance en m | Distance en m | ✅ OK | Get distance | getDistanceToDestination |
| Unitaire | getBearingToDestination | Bearing dest | Bearing en ° | Bearing en ° | ✅ OK | Get bearing | getBearingToDestination |
| Unitaire | isArrived true | Arrivé à dest | true si proche | true | ✅ OK | At dest | isArrived |
| Unitaire | isArrived false | Pas arrivé | false si loin | false | ✅ OK | Not at dest | isArrived |
| Unitaire | arrivalThreshold | Seuil arrivée | Threshold config | Threshold config | ✅ OK | Config threshold | arrivalThreshold |
| Unitaire | getRoute | Obtenir route | Array points | Array points | ✅ OK | Get route | getRoute |
| Unitaire | clearRoute | Effacer route | Route vide | Route vide | ✅ OK | Clear route | clearRoute |
| Unitaire | recalculateRoute | Recalculer route | Nouvelle route | Nouvelle route | ✅ OK | Recalc | recalculateRoute |

---

## Tests Composant Navigation (Navigation.test.tsx) - 14 tests

| Type de test | Titre | Scénario | Attendu | Observé | Résultat | Commentaire | Élément testé |
|---|---|---|---|---|---|---|---|
| Composant | render basic | Rendu composant | Composant rendu | Composant rendu | ✅ OK | Render OK | Navigation |
| Composant | render with destination | Avec destination | Affiche dest | Affiche dest | ✅ OK | Show dest | Navigation |
| Composant | render distance | Affiche distance | Distance visible | Distance visible | ✅ OK | Show distance | Navigation |
| Composant | render bearing | Affiche direction | Direction visible | Direction visible | ✅ OK | Show bearing | Navigation |
| Composant | render compass | Boussole | Boussole rendue | Boussole rendue | ✅ OK | Compass UI | Navigation |
| Composant | start button | Bouton démarrer | Bouton présent | Bouton présent | ✅ OK | Start btn | Navigation |
| Composant | stop button | Bouton arrêter | Bouton présent | Bouton présent | ✅ OK | Stop btn | Navigation |
| Composant | click start | Clic démarrer | startNavigation called | startNav called | ✅ OK | Start action | Navigation |
| Composant | click stop | Clic arrêter | stopNavigation called | stopNav called | ✅ OK | Stop action | Navigation |
| Composant | arrival message | Message arrivée | Message affiché | Message affiché | ✅ OK | Arrival UI | Navigation |
| Composant | no destination | Sans destination | UI adaptée | UI adaptée | ✅ OK | No dest UI | Navigation |
| Composant | loading state | État chargement | Loading UI | Loading UI | ✅ OK | Loading | Navigation |
| Composant | error state | État erreur | Error message | Error message | ✅ OK | Error UI | Navigation |
| Composant | update on position | Position change | UI mise à jour | UI maj | ✅ OK | Position update | Navigation |

---

## Tests Composant LoadingScreen (LoadingScreen.test.tsx) - 6 tests

| Type de test | Titre | Scénario | Attendu | Observé | Résultat | Commentaire | Élément testé |
|---|---|---|---|---|---|---|---|
| Composant | render basic | Rendu basique | Écran affiché | Écran affiché | ✅ OK | Render OK | LoadingScreen |
| Composant | render spinner | Spinner présent | Spinner visible | Spinner visible | ✅ OK | Spinner UI | LoadingScreen |
| Composant | render message | Message loading | Message visible | Message visible | ✅ OK | Message UI | LoadingScreen |
| Composant | custom message | Message custom | Custom affiché | Custom affiché | ✅ OK | Custom msg | LoadingScreen |
| Composant | fullscreen | Plein écran | Full height/width | Full h/w | ✅ OK | Fullscreen | LoadingScreen |
| Composant | accessibility | Accessibilité | aria-busy true | aria-busy true | ✅ OK | A11y | LoadingScreen |

---

## Tests Composant SelectableList (SelectableList.test.tsx) - 9 tests

| Type de test | Titre | Scénario | Attendu | Observé | Résultat | Commentaire | Élément testé |
|---|---|---|---|---|---|---|---|
| Composant | render items | Rendu items | Items affichés | Items affichés | ✅ OK | Render items | SelectableList |
| Composant | render empty | Liste vide | Message vide | Message vide | ✅ OK | Empty state | SelectableList |
| Composant | click item | Clic sur item | onSelect called | onSelect called | ✅ OK | Select action | SelectableList |
| Composant | selected state | Item sélectionné | Style selected | Style selected | ✅ OK | Selected UI | SelectableList |
| Composant | multiple select | Sélection multiple | Multi selected | Multi selected | ✅ OK | Multi select | SelectableList |
| Composant | deselect | Désélection | Item déselect | Item déselect | ✅ OK | Deselect | SelectableList |
| Composant | custom render | Render custom | Custom rendu | Custom rendu | ✅ OK | Custom render | SelectableList |
| Composant | keyboard nav | Navigation clavier | Focus change | Focus change | ✅ OK | Keyboard nav | SelectableList |
| Composant | disabled item | Item désactivé | Non cliquable | Non cliquable | ✅ OK | Disabled | SelectableList |

---

## Tests Composant AddPointForm (AddPointForm.test.tsx) - 16 tests

| Type de test | Titre | Scénario | Attendu | Observé | Résultat | Commentaire | Élément testé |
|---|---|---|---|---|---|---|---|
| Composant | render form | Rendu formulaire | Form affiché | Form affiché | ✅ OK | Render OK | AddPointForm |
| Composant | render coordinates | Coords affichées | Coords visibles | Coords visibles | ✅ OK | Coords UI | AddPointForm |
| Composant | update name | Modifier nom | Valeur maj | Valeur maj | ✅ OK | Name input | AddPointForm |
| Composant | update coordinates | Modifier coords | Coords maj | Coords maj | ✅ OK | Coords input | AddPointForm |
| Composant | update type | Modifier type | Type maj | Type maj | ✅ OK | Type select | AddPointForm |
| Composant | toggle status | Toggle statut | Status inversé | Status inversé | ✅ OK | Status toggle | AddPointForm |
| Composant | update comment | Modifier comment | Comment maj | Comment maj | ✅ OK | Comment input | AddPointForm |
| Composant | save point | Sauvegarder point | Point sauvé | Point sauvé | ✅ OK | Save action | AddPointForm |
| Composant | save no eventId | Sans eventId | Erreur affichée | Erreur affichée | ✅ OK | EventId requis | AddPointForm |
| Composant | save error | Erreur save | Gère erreur | Gère erreur | ✅ OK | Error handling | AddPointForm |
| Composant | loading state | État loading | Loading UI | Loading UI | ✅ OK | Loading | AddPointForm |
| Composant | empty name | Nom vide | Gère cas | Gère cas | ✅ OK | Empty name | AddPointForm |
| Composant | cancel button | Bouton annuler | onClose called | onClose called | ✅ OK | Cancel action | AddPointForm |
| Composant | close X button | Bouton X | onClose called | onClose called | ✅ OK | Close action | AddPointForm |
| Composant | initial values | Valeurs initiales | Props affichées | Props affichées | ✅ OK | Init values | AddPointForm |
| Composant | validation | Validation form | Validation OK | Validation OK | ✅ OK | Form valid | AddPointForm |

---

## Tests Composant AdminForm (AdminForm.test.tsx) - 33 tests

| Type de test | Titre | Scénario | Attendu | Observé | Résultat | Commentaire | Élément testé |
|---|---|---|---|---|---|---|---|
| Composant | render form | Rendu formulaire | Form affiché | Form affiché | ✅ OK | Render OK | AdminForm |
| Composant | render fields | Champs présents | Tous visibles | Tous visibles | ✅ OK | Fields UI | AdminForm |
| Composant | render create mode | Mode création | UI création | UI création | ✅ OK | Create mode | AdminForm |
| Composant | render edit mode | Mode édition | UI édition | UI édition | ✅ OK | Edit mode | AdminForm |
| Composant | update username | Modifier username | Valeur maj | Valeur maj | ✅ OK | Username input | AdminForm |
| Composant | update email | Modifier email | Valeur maj | Valeur maj | ✅ OK | Email input | AdminForm |
| Composant | update password | Modifier password | Valeur maj | Valeur maj | ✅ OK | Password input | AdminForm |
| Composant | update role | Modifier rôle | Rôle maj | Rôle maj | ✅ OK | Role select | AdminForm |
| Composant | toggle active | Toggle actif | Status inversé | Status inversé | ✅ OK | Active toggle | AdminForm |
| Composant | required username | Username requis | Erreur affichée | Erreur affichée | ✅ OK | Validation | AdminForm |
| Composant | required password create | Password requis create | Erreur affichée | Erreur affichée | ✅ OK | Validation | AdminForm |
| Composant | optional password edit | Password optionnel edit | Pas d'erreur | Pas d'erreur | ✅ OK | Edit mode | AdminForm |
| Composant | min password length | Password min | Erreur si court | Erreur si court | ✅ OK | Validation | AdminForm |
| Composant | save admin | Sauvegarder admin | Admin sauvé | Admin sauvé | ✅ OK | Save action | AdminForm |
| Composant | save error | Erreur save | Gère erreur | Gère erreur | ✅ OK | Error handling | AdminForm |
| Composant | cancel button | Bouton annuler | onClose called | onClose called | ✅ OK | Cancel action | AdminForm |
| Composant | close button | Bouton fermer | onClose called | onClose called | ✅ OK | Close action | AdminForm |
| Composant | initial values | Valeurs initiales | Props affichées | Props affichées | ✅ OK | Init values | AdminForm |
| Composant | password visibility | Toggle password | Visible/hidden | Visible/hidden | ✅ OK | Password toggle | AdminForm |
| Composant | role options | Options rôle | Toutes présentes | Toutes présentes | ✅ OK | Role options | AdminForm |
| Composant | loading state | État loading | Loading UI | Loading UI | ✅ OK | Loading | AdminForm |
| Composant | success message | Message succès | Toast affiché | Toast affiché | ✅ OK | Success feedback | AdminForm |
| Composant | error message | Message erreur | Toast affiché | Toast affiché | ✅ OK | Error feedback | AdminForm |
| Composant | form reset | Reset form | Form vidé | Form vidé | ✅ OK | Reset | AdminForm |
| Composant | edit prefill | Pré-remplir edit | Valeurs loaded | Valeurs loaded | ✅ OK | Edit prefill | AdminForm |
| Composant | readonly id | ID readonly | Non éditable | Non éditable | ✅ OK | ID readonly | AdminForm |
| Composant | submission disabled | Disabled pendant submit | Bouton disabled | Bouton disabled | ✅ OK | Submit state | AdminForm |
| Composant | validation on blur | Validation blur | Erreur on blur | Erreur on blur | ✅ OK | Blur validation | AdminForm |
| Composant | validation on submit | Validation submit | Erreurs affichées | Erreurs affichées | ✅ OK | Submit validation | AdminForm |
| Composant | clear errors | Clear erreurs | Erreurs effacées | Erreurs effacées | ✅ OK | Clear errors | AdminForm |
| Composant | accessibility labels | Labels a11y | Labels présents | Labels présents | ✅ OK | Accessibility | AdminForm |
| Composant | tab navigation | Navigation tab | Focus correct | Focus correct | ✅ OK | Tab nav | AdminForm |
| Composant | enter submit | Submit avec Enter | Form soumis | Form soumis | ✅ OK | Keyboard submit | AdminForm |

---

## Légende

| Résultat | Signification |
|----------|---------------|
| ✅ OK | Test passé avec succès |
| ❌ FAIL | Test échoué |
| ⏭️ SKIP | Test ignoré |

---

## Résumé par Fichier

| Fichier | Tests | Passés | Échoués | Skippés |
|---------|-------|--------|---------|---------|
| mapUtils.test.ts | 43 | 43 | 0 | 0 |
| database.test.ts | 15 | 15 | 0 | 0 |
| eventService.test.ts | 12 | 12 | 0 | 0 |
| useEvents.test.ts | 18 | 18 | 0 | 0 |
| useNavigation.test.ts | 20 | 20 | 0 | 0 |
| Navigation.test.tsx | 14 | 14 | 0 | 0 |
| LoadingScreen.test.tsx | 6 | 6 | 0 | 0 |
| SelectableList.test.tsx | 9 | 9 | 0 | 0 |
| AddPointForm.test.tsx | 16 | 16 | 0 | 0 |
| AdminForm.test.tsx | 33 | 33 | 0 | 0 |
| **TOTAL** | **186** | **186** | **0** | **0** |

---

*Généré le 15/01/2026 - Dedale Frontend Web*
