# Étape 1 : Prise en main et déploiement
## Procédure d'installation
### **Observations préliminaires**
Aucune étape clairement définie n'est actuellement documentée pour installer et exécuter le projet en environnement de développement ou de production. La pipeline CI/CD n'est pas conçue pour générer un installateur auto-extractible (type _setup.exe_), et une analyse approfondie ainsi que des tests seront menés pour en valider le fonctionnement. Deux scripts (un pour Linux et un pour Windows) permettent de lancer tout ou partie du projet selon les options choisies au démarrage.
### Installation pour le developpement
#### Script sous Linux
Le script s'exécute directement via la commande `bash start-dedale.sh` et affiche immédiatement un menu pour choisir la partie du projet à lancer.
![](images/c39c126a-c7f2-4d0a-9fda-ad4eb9411269.png)


![](images/dc0effc5-a3bc-4332-b78f-b6676d9c44d4.png)

L'application Mobile avec Expo GO ne recontre elle pas de problème particulier et se lance correctement avec la dernière version d'Expo disponible à ce jour.

#### Correction du Script pour le lancement du "Web"

##### Première tentative
Une recherche rapide mets en avant un problème potentielle avec un besoin de passer en "nightly" concernant la version de rust: `rustup install nightly` . C'est malheuresement un echec.
Un override de la version à utiliser dans le projet avec `rustup override set nightly` a du etre effectué afin de poursuivte.

Un autre problème, non mentionné et sans de documentation,  à eu lieu: 
![](images/6764fd70-c73a-49b5-80cf-65e22e014e34.png)
 Une recherche m'a permis de trouver la commande à executer: `sudo apt-get install libgtk-3-dev` . Mais pas de chance, Ce paquet n'existe pas pour ma distribution...

##### Creattion d'un environnement systeme arbitraire
Ayant une distribution Linux un peu particulière (FloX-OS, une distribution Debian-Like sous ARM64), j'ai estimé que le plus simple etait de creer un environnement de developpement plus "standard"
J'ai donc utilisé [Incus](https://linuxcontainers.org/fr/incus/introduction/) pour creer un système paravirtualisé avec crossing d'architecture semi-acceleré (qemu-userspace + LXCFS + ShiftFS) sous Ubuntu 24.04.4 LTS (Repo Default + Universe + Contrib)
Et quelques configurations du threading, de l'interception des Syscall (mknod + mkdnat, plus d'info [ici](https://linuxcontainers.org/incus/docs/main/syscall-interception/) ) et de la traversé d'une interface OVN ( [documentation](https://linuxcontainers.org/incus/docs/main/reference/devices_nic/#nic-ovn) ), j'ai pu essayer l'installation à nouveau.

##### Lancement
Une fois ces etapes effectué, le logiciel s'est lancé normalement après environ 1 minute de compilation de dependances.
![](images/bc60131e-b215-4cfe-a761-48c48f602e76.png)

#### Commentaires
Malgré ma configuration système qui peut expliquer quelques points de blocages, je note l'absence de guide ou d'information concernant les prerequis système et le dependances pour la compilation. Le seul moyena  donc été l'essai-erreur en boucle jusqu'a obtenir la fin de la phase de compilation. 
La présence d'un guide des erreurs courantes "Troobleshooting" aurait permis d'eviter a faire des recherches parfois inutilement longues.

### Installation pour la Production

#### Sous Windows
A premiere vu, le pipeline d'integration est concu pour creer automartiquement un installateur, j'ai donc téléchargé l'artefact du dernier Job de Build et l'est executé dans une Machine Virtuel Windows Server 2025 et Windows 11 Pro for Workstations. 
L'installation a été très simple, un simple double clic sur l'executable permet de l'ouvrir
![](images/5489bb37-03a9-4f87-bff1-a93c5da02692.png)
Il suffit de se laisser guider et l'application s'ouvre ensuite automatiquement.

#### Sous Linux
Aucun n'installateur ou procedure n'est precisé.








