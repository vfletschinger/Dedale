# FAQ / Troubleshooting

**Q : La compilation Tauri échoue sous Linux avec une erreur du style "The system library `glib-2.0` was not found", que faire ?**

- **R :** Tauri a besoin de dépendances graphiques natives. Si vous avez les droits administrateur, installez les paquets requis (ex: `sudo apt install libwebkit2gtk-4.1-dev build-essential libglib2.0-dev`). Sans droits d'administration (ex: machines universitaires), le build natif Linux n'est pas possible. Il est recommandé de lancer uniquement la partie React via `npm run dev` dans ce cas.

**Q : La compilation Tauri échoue à cause de fichiers trop lourds, quel est le problème ?**

- **R :** C'est un problème de version de Rust. Il existe plusieurs versions de Rust dont GNU et MSVC, la version GNU ne supporte pas la taille de certaines librairies.

**Q : comment résoudre l'erreur *"Linker link.exe not found"* ? (suite à la version MSVC de Rust)**

- **R :** Le langage Rust utilise des librairies de Visual Studio. Cette erreur survient lorsque Visual Studio (pas Code) n'a pas l'extension C++ "*Desktop development with C++*". Il est donc nécessaire de l'avoir pour que le script de lancement fonctionne sans emcombre.

**Q : L'application mobile crash lorsque j'ouvre un événement récupéré depuis l'onglet données.**

- **R :** Ce crash peut être dû à une erreur d'autorisation de localisation. Assurez-vous d'avoir explicitement accordé les droits de localisation à l'application (ou Expo Go) dans les paramètres de votre téléphone.

**Q : Faut-il configurer une clé API Google Maps pour la version mobile ?**

- **R :** Non. Bien que le fichier `README.md` du dossier Mobile mentionne une clé API Maps, le module `MapView` de React Native utilise directement la cartographie native du système d'exploitation du téléphone. La clé n'est donc pas requise en développement local.
