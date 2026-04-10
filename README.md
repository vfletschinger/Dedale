# Dédale

[![Rust](https://img.shields.io/badge/Backend-Rust-orange?logo=rust)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/Frontend-React-blue?logo=react)](https://react.dev/)
[![React Native](https://img.shields.io/badge/Mobile-React_Native-61DAFB?logo=react)](https://reactnative.dev/)

**Rapport T6** : https://t5-crs-t6-boucher-yang-98547dad96492efe265fd373dccf189e405f959b.pages.unistra.fr

## Présentation du projet

**Dédale** est une application développée pour le compte de **l’Eurométropole de Strasbourg**, destinée à la **gestion et à l’organisation de manifestations sportives et d’événements publics** (courses, événements urbains, etc.).

L’application permet de planifier les événements, d’organiser les équipements à installer, de gérer les zones de vigilance et de coordonner le personnel ainsi que les équipes impliquées dans la pose et la dépose du matériel.

Le projet se compose d’une **application desktop** destinée à la planification et à la supervision ainsi que d’une **application mobile** destinée au terrain et aux agents.

## Objectifs

- Centraliser la gestion des événements publics
- Organiser les équipements, zones et parcours
- Gérer le personnel, les équipes et leurs plannings
- Faciliter la coordination entre terrain et supervision
- Offrir une visualisation cartographique et temporelle des événements

## Technologies utilisées

### Application Desktop

- Tauri (Rust)
- React (TypeScript)

### Application Mobile

- Expo Go (React Native)

### Base de données

- SQLite (.db)

## Structure du dépôt

```
Frontend/
├── Web/
│   └── Dedale/        # Application desktop (Tauri + React)
├── Mobile/
│   └── Dedale/        # Application mobile (React Native)
└── start-dedale.sh          # Script de lancement global
```

## Installation et lancement

### Prérequis

- Node.js

- Rust MSVC (+ Visual Studio avec l'option "Desktop Development with C++")

- SQLite

- Expo Go (mobile ou émulateur)

### Lancement via script global

Pour faciliter l'installation et le lancement, le projet fournit deux scripts à la racine :

- **start-dedale.sh** (Linux/macOS)
- **start-dedale.ps1** (Windows)

#### Utilisation

- **Sous Linux/macOS** :
  ```bash
  ./start-dedale.sh
  ```
- **Sous Windows (PowerShell)** :
  ```powershell
  .\start-dedale.ps1
  ```

#### Que font ces scripts ?

Les scripts affichent un menu interactif permettant de :

- Lancer uniquement l’application desktop (Tauri)
- Lancer uniquement l’application mobile (Expo)
- Lancer les deux applications en parallèle (desktop + mobile)

Ils installent automatiquement les dépendances nécessaires (npm install) dans chaque sous-projet avant de démarrer les serveurs de développement.

### Application Desktop

Le code de l’application desktop se trouve dans : Frontend/Web/Dedale

L’application desktop est développée avec Tauri, combinant un backend Rust et une interface React. Elle est utilisée pour la planification, la supervision et la gestion globale des événements.

### Application Mobile

Le code de l’application mobile se trouve dans : Frontend/Mobile/Dedale

**Note** : Vous trouverez les détails concernant l'application mobile dans le [README](./Frontend/Mobile/Dedale/README.md) dédié.

### Fonctionnalités principales

- Gestion des événements

- Gestion du personnel

- Gestion des équipes

- Gestion des plannings

- Carte interactive avec gestion d'équipements, de zones de vigilance, de parcours et points d’intérêt et visualisation d'une timeline en direct

- Transfert de données par QR Code entre l’application mobile et l’application desktop

### Générer un exécutable (release)

#### Via la CI/CD (recommandé)

- Sur chaque push sur la branche `main`, la pipeline GitLab CI/CD build automatiquement un installeur Windows (.exe) pour l'application desktop (Tauri) et le publie dans une release GitLab.
- Le lien de téléchargement de l'installeur est disponible dans la page des releases du projet GitLab.

#### Manuellement (en local)

1. Placez-vous dans le dossier de l'application desktop :
   ```bash
   cd Frontend/Web/Dedale
   ```
2. Installez les dépendances :
   ```bash
   npm install
   ```
3. Lancez la commande de build Tauri afin de générer l'éxécutable :
   ```bash
   npm run tauri build
   ```

### Équipe

Projet réalisé dans le cadre d’un travail de groupe (équipe dedale/CRS/Krisprolls/ex-CRS/extreme-inateur) pour un client institutionnel : Eurométropole de Strasbourg
