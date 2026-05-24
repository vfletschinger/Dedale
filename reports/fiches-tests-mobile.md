# Fiches de tests - Mobile (Expo)

## Preconditions communes
- Application mobile installee
- Evènements disponibles (importé via QR depuis desktop)
- Pour tests offline: couper Internet, garder reseau local actif
> Pour le test d'etancheité, une regles de firewall (unifi object-based) permettait de logger toutes les communications externes de l'appareil de test et donc de determiner les échanges avec des services exterieurs.

## Tests fonctionnels

### M-001 Connexion QR (recevoir evenement)
- Objectif: lier mobile a un projet via QR
- Etapes:
  1. Ouvrir l'application
  2. Scanner le QR code genéré par l'application desktop
- Attendu:
  - Evènement importe et visible
- Obtenu:
  - L'évènement et les informations sont correctements receptionnés.
- Commentaires
La fonctionnalité semble fonctionner mais uniquement en IPv4 (excluant donc un fonctionnement sur des réseaux IPv6-Only), aussi, seule la première interface non-loopback est bindé (excluant une communication sur un réseau qui ne serait pas sur la première interface trouvé)
- Résultat: Partiel

### M-002 Affichage position actuelle
- Objectif: geolocalisation
- Etapes:
  1. Ouvrir l'pplication sur un projet chargé
- Attendu:
  - Position actuelle visible
- Commentaires
Mon smartphone sous GrapheneOS permet une granularité des permissions très largement superieur qui ne semble pas vraiment être prise en charge, le fait de désactiver certaines permissions ne declenche aucune erreur et aucun message. Cela rend la fonctionnalité inopérante sans aucune indication de la raison.
- Résultat: Partiel

### M-003 Enregistrer point d interet
- Objectif: création point + commentaire + photos
- Etapes:
  1. Ajouter un point sur la carte
  2. Ajouter commentaire
  3. Prendre une photo
  4. Sauvegarder
- Attendu:
  - Point enregistre avec coordonnees, commentaire, photos
- Résultat: OK


### M-004 Details d un point
- Objectif: édition point
- Etapes:
  1. Ouvrir un point
  2. Modifier commentaire
  3. Ajouter/supprimer photo
  4. Modifier position
- Attendu:
  - Modifs enregistrees en base locale
- Résultat: OK

### M-006 Visualiser geometries
- Objectif: voir zones/parcours
- Etapes:
  1. Ouvrir carte
  2. Verifier affichage zones et parcours
- Attendu:
  - Geometries visibles et correct selon l'application desktop
- Résultat: OK

### M-008 Import planning via QR
- Objectif: Récuperer planning depuis desktop
- Etapes:
  1. Ouvrir Planning
  2. Scanner QR code planning
- Attendu:
  - Actions importées et cohérentes
- Résultat: OK

### M-007 Planning équipe
- Objectif: affichage planning
- Etapes:
  1. Ouvrir Planning
  2. Verifier actions équipe
- Attendu:
  - Liste actions affichée
- Résultat: OK

### M-010 Export évènement vers desktop
- Objectif: énvoi évenement
- Etapes:
  1. Ouvrir Settings
  2. Scanner QR desktop (mode send)
  3. Attendre confirmation
- Attendu:
  - Evènement envoyé
  - Evènement supprime localement si succès
- Obtenu:
  - L'évènement est correctement envoyé
  - En cas d'echec, aucune supression, sinon suppression
- Résultat: OK

### M-011 Etanchéité
- Objectif: vérifier absence de communication avec Internet
- Etapes:
  2. Ouvrir carte, guidage, reverse geocode
  3. Verifier l'absence de requêtes externes
- Attendu:
  - Fonctionnalites OK sans Internet
- Obtenu: 
  - Dependances d'Internet dans le guidage entre les points
  - Affichage de la carte dépendante d'Internet.
- Résultat: KO