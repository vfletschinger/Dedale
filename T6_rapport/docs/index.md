# Compte-rendu de prise en main - Projet Dédale

## 1. Introduction et état des lieux de la documentation

L'objectif de cette première phase a été de récupérer le projet Dédale (développé en Rust/React avec Tauri pour l'application desktop, et React Native/Expo pour le mobile) afin d'évaluer sa documentation et sa procédure d'installation.

### La procédure existante

Le projet inclus une procédure d'installation automatisée via un script de lancement (`start-dedale.sh` ou `start-dedale.ps1`). Nous avons pu relever quelques soucis concernant cette procédure :

- La documentation est fragmentée : un `README.md` spécifique au développement mobile est présent dans `Frontend/Mobile/Dedale/` mais n'est pas mentionné dans la documentation principale.
- Aucune procédure de compilation ou de génération d'un exécutable de l'application lourde pour les utilisateurs finaux n'était documentée.
- `README.md` mobile qui manque un peu de clareté concernant la clé API Google par exemple.
- Aucun document de type Foire Aux Questions (FAQ) ou guide de résolution des problèmes n'est présent dans le projet.

## 2. Processus d'installation et tests par environnement

Lors des tests sur différents environnements, quelques difficultées non signalées dans la documentation ont été rencontrées :

### Environnement Linux (Machines IUT / Debian)

- **Résultat :** Échec de l'installation.
- **Analyse :** Le lancement de la version Web (via Tauri) nécessite la compilation de bibliothèques système natives. L'erreur `The system library glib-2.0 required by crate glib-sys was not found` bloque la compilation. La résolution nécessite l'installation de paquets systèmes manquant, ce qui n'est pas possible sur les machines de l'IUT sans droits administrateur (sudo). La suite de l'installation n'a donc pas pû être testée.

### Environnement Windows

- **Version Desktop :** Le lancement s'effectue correctement. L'application est fonctionnelle, bien que quelques bugs mineures non-bloquants aient été repérées au niveau de la gestion des dessins.
- **Version Mobile (Expo) :** Le lancement initial est correct, mais nécessite une attention particulière lors du choix de l'environnement (Development build vs Expo Go) et de l'authentification (connexion ou poursuivre en anonyme).

### Environnement Linux (git bash / Windows)

- **Résultat :** Script exécuté sans erreur
- **Remarque :** git bash peut lancer le script.sh sans soucis mais utilise les variables d'environnement de Windows et une version Windows de Rust.
Puisque l'OS n'est pas UNIX, peut-être qu'un environnement linux natif ne marchera pas.
Lors du lancement du script via WSL, le fichier n'est pas reconnu avec le message suivant `/bin/bash^M: bad interpreter: No such file or directory` (StackOverflow n'a pas su résoudre le problème).


## 3. Améliorations de la procédure d'installation

Aucun changement de technologie n'a été effectué, la stack (Tauri/React/Expo) restant cohérente. Cependant, procédure d'installation et la documentation ont été adaptés :

- Citation du `README.md` mobile et précisions sur le script d'installation dans la documentation racine.
- Ajout de précision sur la section prérequis du `README.md`
- Ajout d'une procédure de build de l'application Desktop dans le `README.md`.
- Clarification concernant l'utilité de la clé API Maps et retrait de la section concernant le serveur de tuiles local pour Expo Go, qui semble être un reliquat.

## 4. Pipeline CI/CD

Le pipeline CI/CD du projet est configuré pour automatiser les étapes de build, test, et release :

- À chaque push sur la branche `main`, la CI/CD génère automatiquement un installeur Windows (.exe) de l'application lourde et le publie dans une release GitLab.
- Les étapes intermédiaires incluent la vérification de la qualité du code (lint, clippy), les tests unitaires et end-to-end, puis le packaging et la publication.

### Contrainte technique

Lors de l'analyse du fichier .gitlab-ci.yml, une contrainte technique a été identifiée concernant l'environnement d'exécution du pipeline :

**Docker-in-Docker (dind)** : Le job initial de la CI (build_ci_image) utilise le service Docker pour construire une image à la volée. Cela requiert obligatoirement que le GitLab Runner assigné soit configuré avec l'option privileged = true. Pour des raisons de sécurité, les serveurs d'intégration continue partagés n'autorisent généralement pas ce mode, ce qui bloque l'exécution du pipeline en l'état.

Pour faire fonctionner le pipeline, il faudrait déployer et enregistrer un GitLab Runner Docker personnalisé disposant des droits privilégiés nécessaires pour la création de l'image.

### Modifications nécessaires et estimations

Bien que fonctionnel sous les bonnes conditions d'infrastructure, le pipeline nécessite des modifications pour étendre la distribution de l'application :

- **Ajout d'une procédure de build/packaging pour Linux** : Il serait pertinent d'ajouter un job dans la CI/CD pour générer une version installable (AppImage ou .deb) de l'application desktop sous Linux.

-> La documentation Tauri donne des informations sur les différentes façon de distribuer son application : https://v2.tauri.app/fr/distribute/

- **Temps estimé** : Environ une demi journée pour configurer, tester et documenter l'ajout des runners Linux et du job de packaging dans le fichier .gitlab-ci.yml.
