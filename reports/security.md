# Rapport d'Audit de Sécurité — Dédale (Desktop & Mobile)

## Tableau Récapitulatif

| # | Application | Composant | Vulnérabilité | Sévérité | CWE | CVSS v3 estimé |
|---|-------------|-----------|---------------|----------|-----|---------------|
| 1 | Desktop | `tauri.conf.json` | CSP désactivée (`null`) | **Critique** | CWE-16 | 9.1 |
| 2 | Desktop | `socket.rs` | Serveur WebSocket sans authentification | **Critique** | CWE-306 | 8.6 |
| 3 | Desktop & Mobile | `socket.rs` / `QrCodeScanner.tsx` | Transfert de données en clair (`ws://`) | **Critique** | CWE-319 | 8.1 |
| 4 | Mobile | `QrCodeScanner.tsx` | Confiance aveugle dans le contenu du QR code | **Critique** | CWE-20 | 8.1 |
| 5 | Mobile | `Helper.ts` | UUID généré avec `Math.random()` (PRNG faible) | **Critique** | CWE-338 | 7.5 |
| 6 | Desktop | `tauri.conf.json` | Scope `assetProtocol` trop permissif (`**`) | **Élevée** | CWE-22 | 7.5 |
| 7 | Desktop | `socket.rs` | Serveur WebSocket accessible sur le réseau local sans restriction | **Élevée** | CWE-284 | 7.2 |
| 8 | Desktop | `db/mod.rs` | Absence de politique de mot de passe | **Élevée** | CWE-521 | 6.5 |
| 9 | Desktop | `db/mod.rs` | Absence de limitation de tentatives d'authentification | **Élevée** | CWE-307 | 6.5 |
| 10 | Mobile | Tous les écrans | Absence totale d'authentification | **Élevée** | CWE-306 | 6.5 |
| 11 | Mobile | `databaseAcces.ts` | Absence de validation des entrées utilisateur | **Élevée** | CWE-20 | 6.3 |
| 12 | Desktop | `socket.rs`, `geocoding.rs`, `utils.rs` | Usage de `unwrap()`/`expect()` dans du code de production | **Moyenne** | CWE-248 | 5.3 |
| 13 | Desktop & Mobile | Multiple fichiers | Journalisation excessive d'informations sensibles | **Moyenne** | CWE-532 | 4.7 |
| 14 | Mobile | `ImageHelper.ts` | Images sensibles stockées en base64 non chiffrée | **Moyenne** | CWE-312 | 4.3 |
| 15 | Mobile | `package.json` | Dépendance `express` déclarée mais non utilisée (surface d'attaque inutile) | **Faible** | CWE-1104 | 3.1 |

---

## Détail des Vulnérabilités

---

### VUL-01 — Content Security Policy (CSP) désactivée

**Application :** Desktop  
**Fichier :** [`Frontend/Web/Dedale/src-tauri/tauri.conf.json`](../Frontend/Web/Dedale/src-tauri/tauri.conf.json#L21)  
**Sévérité :** Critique | **CWE :** CWE-16 | **CVSS estimé :** 9.1  
**Classification OWASP :** A05:2021 – Security Misconfiguration

**Description :**  
La CSP est explicitement définie à `null` dans la configuration Tauri :

```json
"security": {
  "csp": null,
  ...
}
```

Sans CSP, le WebView Tauri n'impose aucune restriction sur l'exécution de scripts inline, le chargement de ressources externes ou les connexions vers des origines arbitraires. Si un attaquant parvient à injecter du contenu (par exemple via des données malveillantes dans la base SQLite ou via un message WebSocket), il peut exécuter du JavaScript arbitraire dans le contexte de l'application avec accès complet aux commandes Tauri.

**Impact :** Exécution de code arbitraire (XSS → RCE via l'API Tauri), exfiltration de données, élévation de privilèges vers le système d'exploitation.

**Recommandation :**  
Définir une CSP stricte :
```json
"csp": "default-src 'self'; script-src 'self'; connect-src 'self' ws://localhost:* ipc:; img-src 'self' data: blob:;"
```

---

### VUL-02 — Serveur WebSocket sans authentification

**Application :** Desktop  
**Fichier :** [`Frontend/Web/Dedale/src-tauri/src/socket.rs`](../Frontend/Web/Dedale/src-tauri/src/socket.rs#L669)  
**Sévérité :** Critique | **CWE :** CWE-306 | **CVSS estimé :** 8.6  
**Classification OWASP :** A07:2021 – Identification and Authentication Failures

**Description :**  
Les trois serveurs WebSocket (`start_server`, `start_receive_server`, `start_server_planning`) acceptent toute connexion entrante sans aucune vérification d'identité. Il n'existe aucun mécanisme de token, de challenge ou de validation d'origine (header `Origin`).

```rust
for stream in listener.incoming() {
    match stream {
        Ok(stream) => {
            match accept(stream) {  // Connexion acceptée sans contrôle
                Ok(ws) => { ... }
```

N'importe quel client sur le réseau local (ou ayant deviné le port) peut :
- Récupérer l'intégralité des données d'événements
- Injecter des points, équipements ou actions frauduleux dans la base de données de l'application mobile
- Déclencher la terminaison du serveur via la commande `terminate`

**Recommandation :**  
Implémenter un token à usage unique (nonce) inclus dans le QR code et vérifié lors de la connexion WebSocket (`Sec-WebSocket-Protocol` ou un handshake applicatif).

---

### VUL-03 — Transmission de données en clair (ws://)

**Application :** Desktop & Mobile  
**Fichiers :**  
- [`Frontend/Web/Dedale/src-tauri/src/socket.rs`](../Frontend/Web/Dedale/src-tauri/src/socket.rs#L683)  
- [`Frontend/Mobile/Dedale/src/components/QrCodeScanner.tsx`](../Frontend/Mobile/Dedale/src/components/QrCodeScanner.tsx#L830)  
**Sévérité :** Critique | **CWE :** CWE-319 | **CVSS estimé :** 8.1  
**Classification OWASP :** A02:2021 – Cryptographic Failures

**Description :**  
Tous les échanges entre l'application desktop et l'application mobile utilisent le protocole WebSocket non chiffré (`ws://`). L'URI générée côté serveur et encodée dans le QR code est explicitement construite en `ws://` :

```rust
let ws_uri = format!("ws://{}:{}", ip, port);
```

Côté mobile, l'application accepte cette URI et peut également construire une URI `ws://` si le contenu du QR code n'inclut pas le protocole :

```typescript
const websocketUri: string = data.startsWith("ws")
  ? data
  : `ws://${data}`;
```

Les données transmises incluent : coordonnées GPS de points sensibles, images (base64), plannings opérationnels, informations d'équipes. Tout acteur présent sur le même réseau Wi-Fi peut capturer ces données via une écoute passive.

**Recommandation :**  
Utiliser `wss://` (WebSocket Secure via TLS). Générer un certificat auto-signé pour le réseau local ou utiliser une librairie comme `rustls` avec `tungstenite`.

---

### VUL-04 — Confiance aveugle dans le contenu du QR code

**Application :** Mobile  
**Fichier :** [`Frontend/Mobile/Dedale/src/components/QrCodeScanner.tsx`](../Frontend/Mobile/Dedale/src/components/QrCodeScanner.tsx#L821)  
**Sévérité :** Critique | **CWE :** CWE-20 | **CVSS estimé :** 8.1  
**Classification OWASP :** A03:2021 – Injection

**Description :**  
Lorsque l'utilisateur scanne un QR code, l'application mobile extrait l'URI contenue dans le code et s'y connecte directement sans aucune validation :

```typescript
const handleBarCodeScanned = ({ type, data }: BarcodeScanningResult) => {
    // 'data' est le contenu brut du QR code — aucune validation
    const websocketUri: string = data.startsWith("ws")
      ? data
      : `ws://${data}`;
    const client = new WebSocketClient(websocketUri);
    // Connexion immédiate vers n'importe quelle adresse
```

Un attaquant peut présenter un QR code malveillant contenant l'adresse d'un serveur qu'il contrôle. L'application mobile s'y connecte et envoie l'intégralité des données de l'événement sélectionné (points, images, équipements).

**Recommandation :**  
- Valider que l'URI commence par `ws://` ou `wss://`
- Valider le format de l'IP (réseau local uniquement, ex: `192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`)
- Afficher l'adresse à l'utilisateur et demander une confirmation explicite avant connexion
- Implémenter un token de validation inclus dans le QR code

---

### VUL-05 — UUID généré avec `Math.random()` (PRNG non cryptographique)

**Application :** Mobile  
**Fichier :** [`Frontend/Mobile/Dedale/src/services/Helper.ts`](../Frontend/Mobile/Dedale/src/services/Helper.ts#L7)  
**Sévérité :** Critique | **CWE :** CWE-338 | **CVSS estimé :** 7.5  
**Classification OWASP :** A02:2021 – Cryptographic Failures

**Description :**  
Tous les identifiants uniques (points d'intérêt, photos, équipements) sont générés avec `Math.random()`, un PRNG non cryptographique dont la sortie est prévisible :

```typescript
export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;  // NON cryptographique
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};
```

Un attaquant connaissant les conditions initiales du générateur peut prédire les UUID générés, permettant l'énumération des ressources ou des attaques par collision d'ID lors des transferts desktop ↔ mobile.

**Recommandation :**  
Utiliser `expo-crypto` ou le module natif `crypto` :
```typescript
import * as Crypto from 'expo-crypto';
const uuid = Crypto.randomUUID();
```

---

### VUL-06 — Scope `assetProtocol` trop permissif

**Application :** Desktop  
**Fichier :** [`Frontend/Web/Dedale/src-tauri/tauri.conf.json`](../Frontend/Web/Dedale/src-tauri/tauri.conf.json#L22)  
**Sévérité :** Élevée | **CWE :** CWE-22 | **CVSS estimé :** 7.5  
**Classification OWASP :** A01:2021 – Broken Access Control

**Description :**  
L'`assetProtocol` est configuré avec un scope wildcard `**` autorisant l'accès à tous les fichiers sans restriction de chemin :

```json
"assetProtocol": {
  "enable": true,
  "scope": ["**"]
}
```

Couplé à l'absence de CSP (VUL-01), un code malveillant s'exécutant dans le WebView peut utiliser le protocole `asset://` pour lire des fichiers arbitraires sur le système de l'utilisateur, incluant la base de données SQLite, les fichiers de configuration, ou des fichiers système sensibles.

**Recommandation :**  
Restreindre le scope aux seuls répertoires nécessaires :
```json
"scope": ["$RESOURCE/**", "$APPDATA/dedale/**"]
```

---

### VUL-07 — Serveur WebSocket accessible sur tout le réseau local

**Application :** Desktop  
**Fichier :** [`Frontend/Web/Dedale/src-tauri/src/socket.rs`](../Frontend/Web/Dedale/src-tauri/src/socket.rs#L676)  
**Sévérité :** Élevée | **CWE :** CWE-284 | **CVSS estimé :** 7.2  
**Classification OWASP :** A01:2021 – Broken Access Control

**Description :**  
Le serveur WebSocket se lie à l'adresse IP locale de la machine (via `local_ip()`) plutôt qu'à `127.0.0.1`. Cette IP est accessible à tous les appareils du réseau local :

```rust
let ip = local_ip().map_err(|e| e.to_string())?;
let port = random_port();
let socket = SocketAddr::new(ip, port);
// Bind sur l'IP LAN, pas sur loopback
std::net::TcpListener::bind(socket).expect(...)
```

Bien que le port soit aléatoire (1025–65534), la plage est suffisamment restreinte pour être parcourue en quelques minutes par un scanner réseau. Sans authentification (VUL-02), n'importe quel appareil du réseau peut se connecter.

**Recommandation :**  
Lier le serveur sur `127.0.0.1` par défaut et n'exposer l'IP LAN que si explicitement nécessaire, avec une confirmation utilisateur.

---

### VUL-08 — Absence de politique de mot de passe

**Application :** Desktop  
**Fichier :** [`Frontend/Web/Dedale/src-tauri/src/db/mod.rs`](../Frontend/Web/Dedale/src-tauri/src/db/mod.rs#L292)  
**Sévérité :** Élevée | **CWE :** CWE-521 | **CVSS estimé :** 6.5  
**Classification OWASP :** A07:2021 – Identification and Authentication Failures

**Description :**  
La création du compte administrateur initial (`create_initial_admin_cmd`) ne comporte aucune validation de la complexité du mot de passe. N'importe quelle chaîne, y compris une chaîne vide, est acceptée et hachée.

```rust
pub async fn create_initial_admin_cmd(
    app: AppHandle,
    username: String,
    password: String,  // Aucune validation de complexité
) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;
    create_initial_admin(&pool, &username, &password).await...
```

**Recommandation :**  
Imposer une longueur minimale de 12 caractères, la présence de majuscules, minuscules, chiffres et caractères spéciaux. Valider côté Rust avant le hachage.

---

### VUL-09 — Absence de limitation des tentatives d'authentification

**Application :** Desktop  
**Fichier :** [`Frontend/Web/Dedale/src-tauri/src/db/mod.rs`](../Frontend/Web/Dedale/src-tauri/src/db/mod.rs)  
**Sévérité :** Élevée | **CWE :** CWE-307 | **CVSS estimé :** 6.5  
**Classification OWASP :** A07:2021 – Identification and Authentication Failures

**Description :**  
La commande `verify_credentials_cmd` ne comporte aucun mécanisme anti-brute-force : pas de délai progressif, pas de verrouillage de compte, pas de journalisation des tentatives échouées. Bien que bcrypt soit correctement utilisé pour le hachage, l'absence de rate-limiting permet de tenter des milliers de mots de passe.

**Recommandation :**  
Implémenter un compteur d'échecs en mémoire avec un verrouillage temporaire après 5 tentatives infructueuses. Logger les tentatives échouées avec horodatage.

---

### VUL-10 — Absence totale d'authentification sur l'application mobile

**Application :** Mobile  
**Fichiers :** Tous les écrans  
**Sévérité :** Élevée | **CWE :** CWE-306 | **CVSS estimé :** 6.5  
**Classification OWASP :** A07:2021 – Identification and Authentication Failures

**Description :**  
L'application mobile ne comporte aucun mécanisme d'authentification. Au démarrage, l'accès à toutes les données (événements, points, équipes, plannings, photos) est immédiat sans aucun PIN, mot de passe ou authentification biométrique. En cas de perte ou de vol du dispositif, l'intégralité des données opérationnelles est accessible à quiconque récupère l'appareil.

**Recommandation :**  
Implémenter une authentification par PIN ou par données biométriques via `expo-local-authentication` au démarrage de l'application. Chiffrer la base SQLite avec `expo-sqlite` et SQLCipher.

---

### VUL-11 — Absence de validation des entrées utilisateur

**Application :** Mobile  
**Fichier :** [`Frontend/Mobile/Dedale/src/services/databaseAcces.ts`](../Frontend/Mobile/Dedale/src/services/databaseAcces.ts)  
**Sévérité :** Élevée | **CWE :** CWE-20 | **CVSS estimé :** 6.3  
**Classification OWASP :** A03:2021 – Injection

**Description :**  
Les fonctions de la couche d'accès aux données ne valident ni la longueur ni le contenu des chaînes avant de les persister. Des champs comme `comment`, `name` ou les URLs d'images sont insérés directement en base :

```typescript
export const addComment = (pointId: string, value: string, db: any) => {
  return db.runSync("UPDATE point SET comment = ? WHERE id = ?", [value, pointId]);
  // 'value' sans validation de longueur ni de contenu
};
```

Bien que les requêtes paramétrées protègent contre l'injection SQL, l'absence de limite de longueur peut provoquer une saturation de la base de données locale (déni de service), et l'absence de validation du contenu peut permettre le stockage de données malveillantes réinjectées lors de la synchronisation avec le desktop.

**Recommandation :**  
Définir des limites de longueur pour chaque champ. Valider les entrées à l'aide d'une librairie comme `zod`. Typer le paramètre `db` avec `SQLiteDatabase` au lieu de `any`.

---

### VUL-12 — `unwrap()`/`expect()` dans le code de production Rust

**Application :** Desktop  
**Fichiers :**  
- [`Frontend/Web/Dedale/src-tauri/src/socket.rs`](../Frontend/Web/Dedale/src-tauri/src/socket.rs#L700) (ligne 700, 726, 852, 864, 913, 925)  
- [`Frontend/Web/Dedale/src-tauri/src/utils.rs`](../Frontend/Web/Dedale/src-tauri/src/utils.rs#L7) (lignes 7, 9)  
- [`Frontend/Web/Dedale/src-tauri/src/db/mod.rs`](../Frontend/Web/Dedale/src-tauri/src/db/mod.rs#L292) (ligne 292)  
**Sévérité :** Moyenne | **CWE :** CWE-248 | **CVSS estimé :** 5.3  
**Classification OWASP :** A05:2021 – Security Misconfiguration

**Description :**  
Plusieurs appels `.expect()` et `.unwrap()` sont présents dans des chemins de code de production (hors tests), en particulier dans le serveur WebSocket :

```rust
// socket.rs ligne 700
std::net::TcpListener::bind(socket).expect("Impossible de binder le socket WebSocket");

// socket.rs ligne 726
let rt = tokio::runtime::Runtime::new().unwrap();

// utils.rs ligne 7
let mut path: PathBuf = data_dir().expect("Impossible de récupérer data_dir");
```

Si ces opérations échouent (port déjà utilisé, espace disque insuffisant), le thread ou l'application entière panique, constituant un vecteur de déni de service.

**Recommandation :**  
Remplacer par une gestion d'erreur explicite avec `Result` et `?`, propagée jusqu'à la commande Tauri qui renvoie une erreur au frontend.

---

### VUL-13 — Journalisation excessive d'informations sensibles

**Application :** Desktop & Mobile  
**Fichiers :** `socket.rs` (81 occurrences `println`), code mobile (99 occurrences `console.log`)  
**Sévérité :** Moyenne | **CWE :** CWE-532 | **CVSS estimé :** 4.7  
**Classification OWASP :** A09:2021 – Security Logging and Monitoring Failures

**Description :**  
Le code de production contient un nombre très élevé de traces de débogage qui exposent des données opérationnelles sensibles :

**Desktop (Rust) — Exemples dans `socket.rs` :**
```rust
println!("📋 [DATA EXPORT] Event '{}' récupéré avec {} parcours...", event_row.get::<String, _>("name"), ...);
println!("📦 Envoi de l'événement {} au mobile...", event.id);
println!("[DB] Toutes les tables ont été synchronisées...");
```

**Mobile (TypeScript) :**
```typescript
console.log("📋 DONNÉES BRUTES REÇUES:");
console.log(JSON.stringify(rawData, null, 2));  // Données complètes en clair
console.log("ID:", event.id);
console.log("Nom:", event.name);
```

Ces traces sont accessibles via ADB (`adb logcat`) sur Android sans débogueur, et via les logs système sur desktop. Elles exposent les IDs d'événements, noms, statistiques et données de transfert.

**Recommandation :**  
Supprimer ou conditionner tous les `println!`/`console.log` derrière un flag de compilation (`#[cfg(debug_assertions)]` en Rust, `__DEV__` en React Native).

---

### VUL-14 — Images stockées en base64 non chiffrée dans SQLite

**Application :** Mobile  
**Fichier :** [`Frontend/Mobile/Dedale/src/services/ImageHelper.ts`](../Frontend/Mobile/Dedale/src/services/ImageHelper.ts)  
**Sévérité :** Moyenne | **CWE :** CWE-312 | **CVSS estimé :** 4.3  
**Classification OWASP :** A02:2021 – Cryptographic Failures

**Description :**  
Les photos prises sur le terrain sont converties en base64 et stockées directement dans la table `picture` de la base SQLite non chiffrée :

```typescript
export const saveImageToBDD = async (file: string, pointId: string) => {
    const base64 = await imageToBase64(file);
    const result = db.runSync(
      'INSERT INTO picture (id, point_id, image) VALUES (?, ?, ?)',
      [pictureId, pointId, base64]  // Images en clair
    );
```

Sur un appareil Android rooté ou via une sauvegarde ADB non chiffrée, l'intégralité des photos (potentiellement sensibles) est directement extractible depuis la base SQLite.

**Recommandation :**  
- Stocker les images sur le système de fichiers avec `expo-file-system` dans un répertoire privé de l'application
- Utiliser SQLCipher pour chiffrer la base de données
- Ne stocker en base que le chemin du fichier, pas le contenu

---

### VUL-15 — Dépendance `express` déclarée mais non utilisée

**Application :** Mobile  
**Fichier :** [`Frontend/Mobile/Dedale/package.json`](../Frontend/Mobile/Dedale/package.json)  
**Sévérité :** Faible | **CWE :** CWE-1104 | **CVSS estimé :** 3.1  
**Classification OWASP :** A06:2021 – Vulnerable and Outdated Components

**Description :**  
Le fichier `package.json` de l'application mobile déclare `express: "^5.1.0"` et `mime: "^4.1.0"` comme dépendances directes, mais aucun usage dans le code source. Ces dépendances augmentent inutilement la surface d'attaque et le poids du bundle.
