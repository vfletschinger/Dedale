# Plan de tests manuels End-to-End - Application mobile

> **Date :** 28/05/2026

> **Application testée :** Dédale - Application mobile

---

## Légende

| Symbole | Signification                                     |
| ------- | ------------------------------------------------- |
| ✅      | Test passé                                        |
| ❌      | Test échoué                                       |
| ⚠️      | Test partiellement passé / comportement inattendu |
| ➖      | Test pas encore exécuté                           |

---

## 1 - Liaison avec l'application lourde

| ID    | Titre                                                   | Étapes                                                                               | Résultat attendu                                                                    | Résultat observé | Statut | Commentaire |
| ----- | ------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ---------------- | ------ | ----------- |
| D1-01 | Récupération d'un évènement via un QR Code              | Scanner le QR Code affiché lors de la synchronisation sur l'app lourde               | L'évènement partagé doit être visible sur l'application mobile                      |                  | ✅     |             |
| D1-02 | Récupération d'un planning de placement via un QR Code  | Scanner le QR Code affiché fourni par l'application lourde                           | Le planning partagé doit être visible sur l'application mobile                      |                  | ✅     |             |
| D1-03 | Envoi des points d'intérêts vers l'application lourde   | Scanner le QR Code affiché lors de la synchronisation sur l'app lourde               | Les points d'intérêts partagé doivent être visible sur l'application lourde         |                  | ✅     |             |
| D1-04 | Récupération d'un évènement via un QR Code              | Scanner le QR Code affiché lors de la synchronisation sur l'app lourde               | L'évènement partagé doit être visible sur l'application mobile                      |                  | ✅     |             |

## 2 - Carte

| ID    | Titre                                                   | Étapes                                                                               | Résultat attendu                                                                    | Résultat observé | Statut | Commentaire |
| ----- | ------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ---------------- | ------ | ----------- |
| D2-01 | La géolocalisation fonctionne                           | Regarder la carte (il y a un bouton pour se centrer)                                 | On voit un point correspondant à notre localisation sur la carte                    |                  | ✅     |             |
| D2-02 | Création d'un point d'intérêt (avec texte et image)     | Ajouter un point d'intérêt contenant du texte et une image                           | Un point d'intérêt est créé avec une image visible, un texte et l'adresse du point  | correcte         | ✅     |             |
| D2-03 | Visualisation des points d'intérêts                     | Aller sur la section "Points d'inté…"                                                | La liste de tous les points sont visibles                                           |                  | ✅     |             |
| D2-04 | Suivi du planning                                       | Lancer le guide vers les points de déposes/retraits                                  | Lance le GPS vers le prochain point de dépose/retrait                               |                  | ✅     |             |
| D2-05 | Validation d'arrivé automatique                         | Aller au point désigné par le guide                                                  | Valide automatiquement l'arrivé au point de dépose/retrait                          |                  | ⚠️     | trop précis |
