# 🐛 RAPPORT DE BUG : [BUG-desktop-001]

## 1. Informations Générales

- **ID Unique :** `BUG-desktop-001`
- **Date de détection :** 26/05/2026
- **Détecté par :** Clémence B.

---

## 2. Résumé du Problème

> **Titre :** [Export Excel] - Export excel incomplet (informations sur les obstacles manquantes)

---

## 3. Contexte & Environnement

| Paramètre             | Valeur                      |
| :-------------------- | :-------------------------- |
| **Application / API** | Frontend application lourde |
| **Module**            | Exports                     |
| **Environnement**     | Local                       |
| **OS / Config**       | Windows 11                  |

---

## 4. Sévérité & Priorité

- **Gravité (Impact technique) :**
  - [ ] 🟥 **Bloquant** _(empêche l'utilisation)_
  - [ ] 🟧 **Majeur** _(impact fort mais contournable)_
  - [x] 🟨 **Mineur** _(Impact faible)_
  - [ ] 🟩 **Cosmétique** _(interface uniquement)_
- **Priorité :** [ ] Haute &nbsp;&nbsp; [x] Moyenne &nbsp;&nbsp; [ ] Basse

---

## 5. Description du Dysfonctionnement

### Comportement observé

Lorsqu'on tente d'exporter les données en Excel, les obstacles ne sont pas incluses dans le fichier exporté. Pourtant des colonnes `Obstacle Nom` ou encore `Obstacle Description` sont présentes dans le fichier.

### Comportement attendu

L'export Excel doit inclure toutes les informations visibles dans l'application, y compris les obstacles (nom, description, nombre d'obstacles, largeur, longueur)

---

## 6. Étapes pour reproduire

1. Sélectionner un projet d'événement contenant des obstacles.
2. Aller sur la page de **Données** d'un événement.
3. Cliquer sur le bouton **"Exporter en Excel"**.
4. Visualiser le fichier Excel exporté.

---

## 7. Diagnostics & Preuves

### Résultat obtenu

Obstacles manquants dans le fichier Excel exporté, bien qu'il y en ai dans l'événement sélectionné.

### Résultat attendu

L'export Excel doit inclure toutes les informations pertinentes de l'événement, comprenant les obstacles (nom, description, nombre d'obstacles, largeur, longueur).

### Pièces Jointes & Logs

- **Captures d'écran / Vidéos :**
  ![Excel éléments manquants](../img/excel_missing_data.png)

---

## 8. Analyse & Hypothèses

- **Fichier concerné :** `Frontend/Web/Dedale/src-tauri/src/excel.rs`

- **Hypothèse 1 :** Le backend ne gère pas les obstacles lors de la génération du fichier Excel, ce qui entraîne leur absence dans le fichier exporté.

Une remarque des développeurs ligne 65 l'indique :

```rust
// Version simplifiée : Point n'a plus de champ obstacles
```
