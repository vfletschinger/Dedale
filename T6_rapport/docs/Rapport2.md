# Compte rendu d'état des lieux et tests

## État des lieux

### Fonctionnalités

Un document qui recense les fonctionnalités demandées est présent dans `features_list.md` ou l'onglet correspondant.

### Tests présents pour l'application lourde :

Du côté de l'application lourde, on retrouve des tests unitaires et d'intégration. Le backend utilise le framework de test natif de Rust, exécuté via `cargo test`. Le frontend utilise Vitest comme framework de test et @testing-library/react pour interagir avec les composants, exécutés via `npm test`.

164 tests exécutés pour le Frontend

226 tests sont implémentés côté Backend, mais seulement 92 sont exécutés.
134 tests unitaires backend sont définis dans les fichiers db_test.rs, excel_test.rs et pdf_test.rs mais ne peuvent pas s'exécuter car les fonctions helper correspondantes ne sont pas implémentées dans le code source. Ces fonctions sont commentées dans `t5-crs\Frontend\Web\Dedale\src-tauri\src\tests\mod.rs` avec la mention "fonctions helper non implémentées".

Ces tests backend couvrent les fonctionnalités de la base de données, de l'exportation Excel et de la génération de PDF, en se basant sur une architecture qui n'est pas implémentée dans le code source actuel. Par conséquent, ces tests ne peuvent pas être exécutés tant que les fonctions helper nécessaires ne sont pas développées et intégrées dans le projet.

L'option 1 serait de développer d'autres tests pour ces fonctionnalités, mais ils seraient alors plus complexes à implémenter et à maintenir, tandis que l'option 2 serait de développer les fonctions helper nécessaires pour permettre l'exécution des tests unitaires déjà définis, ce qui pourrait être plus efficace à long terme pour assurer la qualité du code et la couverture des tests (l'option 2 est à préconiser).

### Tests présents pour l'application mobile :

Du coté de l'application mobile, on retrouve un fichier `test-report.md` contenant un rapport de tests unitaires (75 tests, tous passent).
Les tests se lancent via la commandes npm tests, MAIS la commande affiche 120 tests effectués contrairement aux 75 mentionnées dans le fichier de rapport de tests (tous passent tout de même).

Sur la structure des fichiers de tests, on remarque 5 catégories principales de tests:
- components
- context
- logic
- screen
- services

Un dossier `coverage/lcov-report` est disponible, on y trouve une couverture de code de plus de 60% en moyenne datant du 15 janvier 2026 (moment du rendu):
- Statements : 639/1015 (62.95%)
- Branches : 296/576 (51.38%)
- Functions : 126/192 (65.62%)
- Lines : 630/989 (63.7%)

## Notre approche

Face au nombre déjà important de tests unitaires et d'intégration automatisés existants, nous avons choisi de concentrer nos efforts sur la rédaction d'un plan de tests manuels end-to-end fonctionnels, destiné à être exécuté par un testeur humain.

Cette approche se justifie pour plusieurs raisons :

- La mise en place de tests automatisés end-to-end pour une application aussi complexe que Dédale nécessiterait un investissement en temps et en ressources considérable, d'autant plus que nous ne maîtrisons pas la stack technique (Tauri).
- Les tests manuels permettent de tester des scénarios utilisateurs complets, notamment les interactions avec les cartes, le scan QR code ou les exports de fichiers, qui sont difficiles à simuler de façon automatisée.
- Un testeur humain peut détecter des problèmes d'ergonomie, de lisibilité ou de cohérence visuelle qu'un test automatisé ne peut identifier.

Concernant l'application mobile, il est compliqué de simuler le scan d'un QR Code.
Le transfert est déjà testé via le fichier de test `Frontend/Mobile/Dedale/src/tests/logic/WebSocketClient.test.ts`.
Au lancement de l'application mobile, on ne peut que scanner un QR Code pour récupérer un évènement de l'application lourde et enfin commencer à ajouter des points d'intérêts, etc.