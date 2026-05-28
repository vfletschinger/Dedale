# 🐛 RAPPORT DE BUG : [BUG-desktop-003]

## 1. Informations Générales

- **ID Unique :** `BUG-desktop-003`
- **Date de détection :** 26/05/2026
- **Détecté par :** Clémence B.

---

## 2. Résumé du Problème

> **Titre :** [Tracés divers] - Entamer un dessin puis annuler celui-ci ouvre quand même la modale de validation de l'élément.

---

## 3. Contexte & Environnement

| Paramètre             | Valeur                      |
| :-------------------- | :-------------------------- |
| **Application / API** | Frontend application lourde |
| **Module**            | Tracé d'obstacles           |
| **Environnement**     | Local                       |
| **OS / Config**       | Windows 11                  |

---

## 4. Sévérité & Priorité

- **Gravité (Impact technique) :**
  - [ ] 🟥 **Bloquant** _(empêche l'utilisation)_
  - [ ] 🟧 **Majeur** _(impact fort mais contournable)_
  - [ ] 🟨 **Mineur** _(Impact faible)_
  - [x] 🟩 **Cosmétique** _(interface uniquement)_
- **Priorité :** [ ] Haute &nbsp;&nbsp; [ ] Moyenne &nbsp;&nbsp; [x] Basse

---

## 5. Description du Dysfonctionnement

### Comportement observé

Lorsqu'on entame un dessin puis qu'on annule celui-ci, la modale de validation de l'élément s'ouvre quand même.

### Comportement attendu

Le bouton d'annulation d'un dessin doit fermer le dessin en cours et ne pas ouvrir la modale de validation de l'élément.

## 6. Étapes pour reproduire

1. Commencer un dessin de n'importe quel type
2. Cliquer sur le bouton d'annulation du dessin
3. Observer la modale de validation de l'élément qui s'ouvre malgré l'annulation du dessin

---

## 7. Diagnostics & Preuves

### Résultat obtenu

Lorsqu'on entame un dessin puis qu'on annule celui-ci, la modale de validation de l'élément s'ouvre quand même.
Ce qui n'est pas bloquant puisque l'on peut fermer la modale.

### Résultat attendu

Le bouton d'annulation d'un dessin doit fermer le dessin en cours et ne pas ouvrir la modale de validation de l'élément.

### Pièces Jointes & Logs

- **Captures d'écran / Vidéos :**
  ![Tracé](../img/BUG-desktop-003-1_img.png)
  ![Modale](../img/BUG-desktop-003-2_img.png)
