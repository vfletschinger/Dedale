# Dedale

Application mobile de navigation hors-ligne avec cartes personnalisées.

## Configuration

### 1. Variables d'environnement

Copiez le fichier `.env.example` en `.env` :

```bash
cp .env.example .env
```

Puis modifiez `.env` et remplacez `your_api_key_here` par votre clé API Google Maps.

### 2. Obtenir une clé API Google Maps

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un projet ou sélectionnez-en un existant
3. Activez l'API "Maps SDK for Android"
4. Dans "Identifiants", créez une clé API
5. Copiez la clé dans votre fichier `.env`

**Note** : La clé API est gratuite et nécessaire uniquement pour initialiser le SDK. L'application fonctionne 100% hors-ligne avec vos tuiles personnalisées.

### 3. Développement

**Terminal 1** - Serveur de tuiles (pour Expo Go) :

```bash
node tile-server.js
```

**Terminal 2** - Expo :

```bash
npx expo start
```

### 4. Build de production

```bash
npx expo run:android
```

## Structure des tuiles

Les tuiles de carte sont stockées dans `assets/maps/{z}/{x}/{y}.png` et automatiquement copiées dans le build Android.

**Important** : Ne commitez jamais votre fichier `.env` sur GitHub !
