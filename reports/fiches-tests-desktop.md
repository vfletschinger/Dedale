# Fiches de tests - Desktop (Tauri)

## Preconditions communes
- Application desktop lancee
- Base locale initialisee
- Un evenement de test existe (ou en creer un)
- Pour les tests offline: couper Internet, garder reseau local actif

## Tests fonctionnels

### D-001 Carte locale chargee
- Objectif: valider affichage carte Strasbourg offline
- Etapes:
  1. Ouvrir ou créer un Évenement
  2. Pan/zoom sur la carte
- Attendu:
  - La carte apparait sans connexion Internet
  - Pan/zoom fluide
- Obtenu:
  - Fluidité parfaite
  - Fonctionne sans aucune connexion
  - Zoom fonctionnel
- Résultat: OK
  
### D-002 Recherche adresse locale
- Objectif: recherche d adresses via base locale
- Etapes:
  1. Ouvrir Recherche adresse
  2. Saisir un nom de rue
  3. Selectionner un resultat
- Attendu:
  - Resultats affiches sans Internet
  - La carte se centre sur le resultat selectionné
- Obtenu:
  - Liste dynamique des résultats
  - L'appuie sur un résultat permet l'apparition d'un "pin" et la carte se centre sur celui-ci.
- Résultat: OK

### D-003 Creation évenement
- Objectif: CRUD évenement
- Etapes:
  1. Creer un evenement (nom + dates)
  2. Modifier le nom
  3. Supprimer l'évenement
- Attendu:
  - Creation, edition, suppression fonctionnent
  - Messages d'erreurs clairs en cas de champs ou informations manquantes
- Obtenu:
  - La création est fonctionnelle et un message toast clair s'affiche en cas d'erreur de formulaire.
  - La modification des metas est fonctionnelle et un message toast clair s'affiche en cas d'erreur de formulaire.
  - La suppression fonctionne avec une modal de confirmation
- Résultat: OK

### D-004 Ajout zone
- Objectif: ajout d une zone (polygon)
- Etapes:
  1. Activer mode zone
  2. Tracer un polygon
  3. Sauver avec nom/couleur
  4. UD
- Attendu:
  - Zone affichee sur carte
  - Messages d'erreurs clairs en cas de champs ou informations manquantes
- Obtenu:
  - La création est fonctionnelle et un message toast clair s'affiche en cas d'erreur de formulaire.
  - La suppression fonctionne avec une modal de confirmation
  - L'UD fonctionne correctement avec un menu contextuel
- Résultat: OK

### D-005 Ajout parcours
- Objectif: ajout parcours (polyline) avec infos chrono
- Etapes:
  1. Activer mode parcours
  2. Tracer une ligne
  3. Renseigner date/heure et vitesses
  4. Activer le mode chronologique
- Attendu:
  - Parcours affiche, infos enregistrees
  - Zone de course affiché selon la chronologie
- Obtenu:
  - La création est fonctionnelle et un message toast clair s'affiche en cas d'erreur de formulaire.
  - L'UD fonctionne correctement avec un menu contextuel
  - Impossible d'afficher la zone de course courante selon l'heure
- Résultat: KO


### D-006 Ajout point d interet (attention)
- Objectif: ajout point attention
- Etapes:
  1. Activer mode point d interet
  2. Placer le point
  3. Ajouter une description
- Attendu:
  - Symbole ! sur carte + description
- Obtenu:
  - La création est fonctionnelle et un message toast clair s'affiche en cas d'erreur de formulaire.
  - La modification des metas est fonctionnelle et un message toast clair s'affiche en cas d'erreur de formulaire.
  - La suppression fonctionne avec une modal de confirmation
- Résultat: OK

### D-007 Ajout equipement en polyligne
- Objectif: barriera/bloc en polyligne + quantite
- Etapes:
  1. Activer mode equipement
  2. Tracer une polyligne
  3. Choisir type + quantite
- Attendu:
  - Equipement visible
  - Quantite proposee selon longueur
- Obtenu:
  - La création est fonctionnelle et un message toast clair s'affiche en cas d'erreur de formulaire.
  - La modification des metas est fonctionnelle et un message toast clair s'affiche en cas d'erreur de formulaire.
  - La suppression fonctionne avec une modal de confirmation
  - La quantité est coherente (division arrondie au superieur)
- Résultat: OK

### D-008 Filtre equipements par type
- Objectif: filtrage des equipements
- Etapes:
  1. Ouvrir filtre types
  2. Deselectionner un type
- Attendu:
  - Equipements filtrés sur la carte
- Obtenu:
  - Seules les equipements d'un type coché sont affichées
- Résultat: OK

### D-009 Timeline equipements
- Objectif: affichage chrono
- Etapes:
  1. Passer en mode "Frise Chronologique"
  2. Deplacer le curseur temporel
- Attendu:
  - Equipements visibles selon la date
- Obtenu:
    - Seules les equipements dont les dates-heures indique une présence sont affichées
- Résultat: OK

### D-010 Gestion equipes
- Objectif: CRUD equipe + membres
- Etapes:
  1. Creer une equipe
  2. Ajouter un membre
  3. Retirer un membre
  4. Supprimer l equipe
- Attendu:
  - CRUD OK
  - Messages d'erreurs clairs en cas de champs ou informations manquantes
- Résultat: OK

### D-011 Gestion personnes
- Objectif: CRUD personne
- Etapes:
  1. Creer une personne
  2. Editer email/telephone
  3. Supprimer la personne
- Attendu:
  - CRUD OK
  - Messages d'erreurs clairs en cas de champs ou informations manquantes
- Résultat: OK

### D-012 Affectation actions pose/depose
- Objectif: affecter equipements à une équipe
- Etapes:
  1. Ouvrir une équipe
  2. Ajouter une action pose/depose
  3. Retirer une action
- Attendu:
  - Actions enregistrees
- Résultat: OK

### D-013 Planning par equipe (PDF)
- Objectif: generation PDF planning
- Etapes:
  1. Ouvrir Planning
  2. Génèrer PDF pour une équipe
- Attendu:
  - PDF exporté sur le disque de la machine
  - PDF lisible et incluant les informations nécessaires mais uniquement celle d'une équipe
- Obtenu:
  - Le PDF est lisible avec un logiciel standard
  - Aucune information sensible qui n'appartient pas à une equipe n'est présente.
- Résultat: OK

### D-014 Export Excel
- Objectif: export Excel des points
- Etapes:
  1. Ouvrir Donnees
  2. Lancer export Excel
- Attendu:
  - XLSX exporté sur le disque de la machine
  - XSLX lisible et incluant les informations du projet
- Obtenu:
  - Le XSLC est lisible avec un logiciel standard
- Résultat: OK


### D-015 PDF global
- Objectif: export PDF global
- Etapes:
  1. Ouvrir Donnees
  2. Lancer generation PDF
- Attendu:
  - PDF exporté sur le disque de la machine
- Obtenu:
  - Le PDF est lisible avec un logiciel standard
- Résultat: OK

### D-016 Sync mobile -> desktop (QR)
- Objectif: import via QR
- Etapes:
  1. Ouvrir Donnees, mode Recevoir
  2. Scanner avec mobile
  3. Attendre import
- Attendu:
  - Points importes et visibles
- Commentaires:
La fonctionnalité semble fonctionner mais uniquement en IPv4 (excluant donc un fonctionnement sur des réseaux IPv6-Only), aussi, seule la première interface non-loopback est bindé (excluant une communication sur un réseau qui ne serait pas sur la première interface trouvé)
- Résultat: Partiel


### D-017 Authentification
- Objectif: login securisé
- Etapes:
  1. Lancer l'app apres création d'un admin
  2. Verifier présence d'un écran login
- Attendu:
  - Ecran de création de compte lors de la première utilisation
  - Ecran login présent et obligatoire
  - Un mauvais id/mdp ne permet pas la connexion est un message clair s'affiche.
- Obtenu
  - Ecran de création de compte qui s'affiche et qui fonctionne
  - Aucune connexion demandé pour les demarrages suivants.
- Commentaires: Ni l'analyse statique, ni l'analyse dynamique ne m'a permis de conclure que cette connexion "automatique" se faisait grace une clé du TrustStore de l'OS ou d'une clé HSM résidente, il y a donc à conclure qu'aucune forme d'authentification (ni de l'utilisateur, ni de la machine) n'est concu.
- Résultat: KO
