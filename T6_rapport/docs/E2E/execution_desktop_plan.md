# Plan de tests manuels End-to-End - Application lourde

> **Date :** 28/05/2026

> **Application testée :** Dédale - Application lourde

---

## Légende

| Symbole | Signification                                     |
| ------- | ------------------------------------------------- |
| ✅      | Test passé                                        |
| ❌      | Test échoué                                       |
| ⚠️      | Test partiellement passé / comportement inattendu |
| ➖      | Test pas encore exécuté                           |

---

## 1 - Gestion des événements

### Contexte

L'onglet "Événements" est la page d'accueil. Il permet de créer, visualiser, éditer, dupliquer et supprimer des événements.

### 1.1 Création d'un événement

| ID    | Titre                                                   | Étapes                                                                               | Résultat attendu                                                                    | Résultat observé | Statut | Commentaire |
| ----- | ------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ---------------- | ------ | ----------- |
| M1-01 | Ouverture du formulaire de création                     | Cliquer sur le bouton "+" ou "Créer un événement"                                    | Le formulaire de création s'affiche avec les champs Nom, Date de début, Date de fin |                  | ✅     |             |
| M1-02 | Création d'un événement valide                          | Remplir Nom = "Course du Rhin", Date début = aujourd'hui, Date fin = demain, valider | L'événement apparaît dans la liste                                                  |                  | ✅     |             |
| M1-03 | Création avec date de fin antérieure à la date de début | Remplir Date fin < Date début, valider                                               | Un message d'erreur s'affiche, l'événement n'est pas créé                           |                  | ✅     |             |
| M1-04 | Création sans nom                                       | Laisser le champ Nom vide, remplir les dates, valider                                | Un message d'erreur s'affiche                                                       |                  | ✅     |             |
| M1-05 | Annulation du formulaire                                | Ouvrir le formulaire, cliquer sur annuler / fermer                                   | Le formulaire se ferme, aucun événement n'est créé                                  |                  | ✅     |             |

### 1.2 Filtres et recherche

| ID    | Titre                        | Étapes                                                     | Résultat attendu                                                                | Résultat observé | Statut | Commentaire |
| ----- | ---------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------- | ------ | ----------- |
| M1-06 | Recherche par nom            | Taper un nom partiel dans la barre de recherche            | Seuls les événements dont le nom correspond s'affichent                         |                  | ✅     |             |
| M1-07 | Filtre par statut "En cours" | Sélectionner le filtre "En cours"                          | Seuls les événements en cours (date début ≤ aujourd'hui ≤ date fin) s'affichent |                  | ✅     |             |
| M1-08 | Filtre par statut "À venir"  | Sélectionner le filtre "À venir"                           | Seuls les événements futurs s'affichent                                         |                  | ✅     |             |
| M1-09 | Filtre par statut "Passé"    | Sélectionner le filtre "Passé"                             | Seuls les événements passés s'affichent                                         |                  | ✅     |             |
| M1-10 | Filtre par plage de dates    | Saisir une date de début et une date de fin dans le filtre | Seuls les événements compris dans la plage s'affichent                          |                  | ✅     |             |
| M1-11 | Réinitialisation des filtres | Appliquer un filtre, puis le supprimer                     | Tous les événements s'affichent à nouveau                                       |                  | ✅     |             |

### 1.3 Édition et duplication

| ID    | Titre                           | Étapes                                                                 | Résultat attendu                                                         | Résultat observé | Statut | Commentaire |
| ----- | ------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------- | ------ | ----------- |
| M1-12 | Édition d'un événement          | Cliquer sur l'icône d'édition d'un événement, modifier le nom, valider | Le nom de l'événement est mis à jour dans la liste                       |                  | ✅     |             |
| M1-13 | Duplication d'un événement      | Cliquer sur l'icône de copie d'un événement                            | Un événement dupliqué apparaît dans la liste avec les mêmes informations |                  | ✅     |             |
| M1-14 | Suppression d'un événement      | Cliquer sur l'icône de suppression d'un événement, confirmer           | L'événement disparaît de la liste                                        |                  | ✅     |             |
| M1-15 | Accès à la carte d'un événement | Cliquer sur un événement dans la liste                                 | L'onglet carte s'ouvre avec l'événement sélectionné                      |                  | ✅     |             |

---

## 2 - Carte

### Contexte

La carte permet d'ajouter et gérer des points, parcours, zones, équipements et points d'intérêt liés à un événement.

### 2.1 Navigation sur la carte

| ID    | Titre                    | Étapes                                              | Résultat attendu                         | Résultat observé | Statut | Commentaire |
| ----- | ------------------------ | --------------------------------------------------- | ---------------------------------------- | ---------------- | ------ | ----------- |
| M2-01 | Affichage de la carte    | Sélectionner un événement, accéder à l'onglet Carte | La carte s'affiche                       |                  | ✅     |             |
| M2-02 | Zoom avant/arrière       | Utiliser la molette ou double cliquer.              | La carte zoome/dézoome correctement      |                  | ✅     |             |
| M2-03 | Déplacement sur la carte | Cliquer-glisser sur la carte                        | La vue se déplace                        |                  | ✅     |             |
| M2-04 | Recherche d'adresse      | Saisir une adresse dans la barre de recherche       | La carte se centre sur l'adresse trouvée |                  | ✅     |             |

### 2.2 Points à sécuriser

| ID    | Titre                             | Étapes                                                   | Résultat attendu                                                           | Résultat observé                                                        | Statut | Commentaire |
| ----- | --------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | ----------- |
| M2-05 | Ajout d'un point via la carte     | Activer l'outil "Ajouter un point", cliquer sur la carte | Un formulaire s'affiche pour nommer le point                               |                                                                         | ✅     |             |
| M2-06 | Validation de l'ajout d'un point  | Remplir le nom du point, valider                         | Le point apparaît sur la carte et dans la liste                            |                                                                         | ✅     |             |
| M2-07 | Affichage des détails d'un point  | Cliquer sur un point existant sur la carte               | Une fiche de détails s'affiche (nom, adresse, statut, commentaire, photos) |                                                                         | ✅     |             |
| M2-08 | Ajout d'une photo à un point      | Dans les détails d'un point, ajouter une photo           | La photo s'affiche dans la fiche du point                                  | Il n'est pas possible d'ajouter de photo à un point depuis l'app lourde | ❌     |             |
| M2-09 | Modification du statut d'un point | Changer le statut d'un point.                            | Le statut est mis à jour                                                   |                                                                         | ✅     |             |
| M2-10 | Suppression d'un point            | Dans les détails d'un point, cliquer sur supprimer       | Le point disparaît de la carte et de la liste                              |                                                                         | ✅     |             |

### 2.3 Zones

| ID    | Titre                                            | Étapes                                                             | Résultat attendu                                                          | Résultat observé | Statut | Commentaire |
| ----- | ------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------- | ---------------- | ------ | ----------- |
| M2-11 | Création d'une zone                              | Activer l'outil "Zone", dessiner un polygone sur la carte, valider | La zone apparaît sur la carte.                                            |                  | ✅     |             |
| M2-12 | Attribution d'un nom et d'une couleur à une zone | Remplir le formulaire de zone (nom, couleur, description), valider | La zone est affichée avec les propriétés définies dans l'onglet éléments. |                  | ✅     |             |
| M2-13 | Suppression d'une zone                           | Sélectionner une zone et la supprimer                              | La zone disparaît de la carte                                             |                  | ✅     |             |

### 2.4 Parcours

| ID    | Titre                       | Étapes                                                                 | Résultat attendu                                   | Résultat observé | Statut | Commentaire |
| ----- | --------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------- | ---------------- | ------ | ----------- |
| M2-14 | Création d'un parcours      | Activer l'outil "Parcours", tracer un chemin sur la carte, valider     | Le parcours apparaît sur la carte                  |                  | ✅     |             |
| M2-15 | Configuration d'un parcours | Remplir le formulaire (nom, couleur, vitesse min/max, heure de départ) | Le parcours s'affiche avec les propriétés définies |                  | ✅     |             |
| M2-16 | Suppression d'un parcours   | Sélectionner un parcours et le supprimer                               | Le parcours disparaît de la carte                  |                  | ✅     |             |

### 2.5 Équipements

| ID    | Titre                        | Étapes                                                                               | Résultat attendu                                        | Résultat observé | Statut | Commentaire |
| ----- | ---------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------- | ---------------- | ------ | ----------- |
| M2-17 | Ajout d'un équipement        | Activer l'outil "Équipement", sélectionner un type, placer l'équipement sur la carte | L'équipement apparaît sur la carte                      |                  | ✅     |             |
| M2-18 | Filtre par type d'équipement | Utiliser le filtre de visibilité des équipements                                     | Seuls les équipements du type sélectionné sont affichés |                  | ✅     |             |
| M2-19 | Suppression d'un équipement  | Sélectionner un équipement et le supprimer                                           | L'équipement disparaît de la carte                      |                  | ✅     |             |

### 2.6 Points d'intérêt

| ID    | Titre                            | Étapes                                                                          | Résultat attendu                         | Résultat observé                                                | Statut | Commentaire |
| ----- | -------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------- | ------ | ----------- |
| M2-20 | Ajout d'un point d'intérêt       | Activer l'outil "Point d'intérêt", cliquer sur la carte, remplir la description | Le point d'intérêt apparaît sur la carte |                                                                 | ✅     |             |
| M2-21 | Suppression d'un point d'intérêt | Sélectionner un point d'intérêt et le supprimer                                 | Le point d'intérêt disparaît de la carte | Aucun bouton de suppression d'un point d'intérêt n'est visible. | ❌     |             |

### 2.7 Timeline

| ID    | Titre                       | Étapes                             | Résultat attendu                                                            | Résultat observé | Statut | Commentaire |
| ----- | --------------------------- | ---------------------------------- | --------------------------------------------------------------------------- | ---------------- | ------ | ----------- |
| M2-22 | Affichage de la timeline    | Accéder à la carte d'un événement. | La barre temporelle s'affiche en bas de la carte                            |                  | ✅     |             |
| M2-23 | Déplacement sur la timeline | Glisser le curseur de la timeline  | La carte met en évidence les éléments correspondant à l'instant sélectionné |                  | ✅     |             |

---

## 3 - Équipes et personnes

### Contexte

L'onglet "Équipes et personnes" permet de gérer les équipes et les participants d'un événement.

### 3.1 Gestion des personnes

| ID    | Titre                                    | Étapes                                                                             | Résultat attendu                                              | Résultat observé | Statut | Commentaire |
| ----- | ---------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------- | ------ | ----------- |
| M3-01 | Création d'une personne                  | Cliquer sur "Ajouter une personne", remplir prénom, nom, email, téléphone, valider | La personne apparaît dans la liste                            |                  | ✅     |             |
| M3-02 | Recherche d'une personne                 | Saisir un nom dans la barre de recherche des personnes                             | La liste est filtrée en temps réel                            |                  | ✅     |             |
| M3-03 | Affichage des détails d'une personne     | Cliquer sur une personne dans la liste                                             | La fiche détaillée s'affiche (nom, email, téléphone, équipes) |                  | ✅     |
| M3-04 | Filtre des équipes par nombre de membres | Utiliser le slider de filtre min/max membres                                       | Seules les équipes dans la plage sélectionnée s'affichent     |                  | ✅     |             |
| M3-05 | Recherche d'une équipe par nom           | Saisir un nom dans la barre de recherche des équipes                               | La liste est filtrée                                          |                  | ✅     |             |
| M3-06 | Suppression d'une équipe                 | Dans les détails d'une équipe, cliquer sur supprimer                               | L'équipe disparaît de la liste                                |                  | ✅     |             |

---

## 4 - Planning

### Contexte

L'onglet "Planning" permet d'assigner des actions aux équipes et de synchroniser le planning avec l'application mobile via QR code.

| ID    | Titre                                                             | Étapes                                                 | Résultat attendu                                                                | Résultat observé | Statut | Commentaire |
| ----- | ----------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------- | ---------------- | ------ | ----------- |
| M4-01 | Affichage du planning                                             | Accéder à l'onglet Planning avec un événement actif    | La liste des équipes avec leurs actions s'affiche                               |                  | ✅     |             |
| M4-02 | Affichage "Aucune action planifiée" pour une équipe sans planning | Sélectionner un événement sans actions configurées     | Un message "Aucune action planifiée" est affiché pour les équipes concernées    |                  | ✅     |             |
| M4-03 | Envoi du planning à une équipe via QR code                        | Cliquer sur "Envoyer" pour une équipe                  | Un QR code s'affiche dans une modale pour synchronisation.                      |                  | ✅     |             |
| M4-04 | Scan du QR code depuis l'application mobile                       | Scanner le QR code avec l'application mobile Dédale    | L'état passe à "Envoi en cours" puis "Succès", une notification toast s'affiche |                  | ✅     |             |
| M4-05 | Annulation de l'envoi                                             | Fermer le modal de synchronisation pendant l'étape QR  | Le modal se ferme.                                                              |                  | ✅     |             |
| M4-06 | Génération du PDF du planning                                     | Cliquer sur l'icône PDF pour une équipe                | Un PDF du planning est généré et sauvegardé                                     |                  | ✅     |             |
| M4-07 | Gestion d'erreur - équipe sans actions                            | Tenter d'envoyer le planning d'une équipe sans actions | Un message d'erreur s'affiche : "Aucune action à envoyer"                       |                  | ✅     |             |

---

## 5 - Données (Export / Import / Synchronisation)

### Contexte

L'onglet "Données" permet d'exporter les données en Excel ou PDF, de synchroniser avec l'application mobile, et de gérer la base de données.

### 5.1 Export Excel

| ID    | Titre                       | Étapes                                                     | Résultat attendu                                                    | Résultat observé | Statut | Commentaire |
| ----- | --------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------- | ---------------- | ------ | ----------- |
| M5-01 | Export Excel d'un événement | Sélectionner un événement, cliquer sur "Exporter en Excel" | Un fichier .xlsx est généré et une notification de succès s'affiche |                  | ✅     |             |

### 5.2 Export PDF

| ID    | Titre                     | Étapes                                                          | Résultat attendu                                                   | Résultat observé | Statut | Commentaire |
| ----- | ------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------- | ------ | ----------- |
| M5-02 | Export PDF d'un événement | Sélectionner un événement, cliquer sur "Générer un rapport PDF" | Un fichier .pdf est généré et une notification de succès s'affiche |                  | ✅     |             |

### 5.3 Synchronisation mobile - Export vers mobile

| ID    | Titre                               | Étapes                                                                  | Résultat attendu                                        | Résultat observé | Statut | Commentaire |
| ----- | ----------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- | ---------------- | ------ | ----------- |
| M5-03 | Affichage du QR code d'export       | Passer en mode "Export", sélectionner un événement, cliquer sur envoyer | Un QR code s'affiche                                    |                  | ✅     |             |
| M5-04 | Connexion d'un mobile pour l'export | Scanner le QR code avec l'application mobile                            | L'état passe à "Connecté", les données sont transférées |                  | ✅     |             |
| M5-05 | Déconnexion du mobile               | Fermer la connexion ou quitter sur le mobile                            | L'état revient à "idle"                                 |                  | ✅     |             |

### 5.4 Synchronisation mobile - Import depuis mobile

| ID    | Titre                                 | Étapes                                                                      | Résultat attendu                                                                                    | Résultat observé | Statut | Commentaire |
| ----- | ------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------- | ------ | ----------- |
| M5-06 | Passage en mode Import                | Cliquer sur l'onglet/bouton "Import"                                        | L'interface d'import s'affiche avec un QR code de réception                                         |                  | ✅     |             |
| M5-07 | Réception de données depuis le mobile | Scanner le QR code d'import avec l'application mobile et envoyer des points | Le nombre de points reçus s'incrémente (si il y en avait sur le mobile), une notification s'affiche |                  | ✅     |             |

---

## Récapitulatif

| Module                    | Nombre de tests | Passés | Échoués | Non testés |
| ------------------------- | --------------- | ------ | ------- | ---------- |
| M1 - Événements           | 15              | 15     |         |            |
| M2 - Carte                | 23              | 21     | 2       |            |
| M3 - Équipes et personnes | 6               | 6      |         |            |
| M4 - Planning             | 7               | 7      |         |            |
| M5 - Données              | 7               | 7      |         |            |
| **Total**                 | **58**          | 56     | 2       |            |
