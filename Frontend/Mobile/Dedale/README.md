# Dedale

Application mobile de navigation hors-ligne avec cartes personnalisées.

## Configuration

### 1. Utilisation de la carte (MapView) et clé API Google Maps

L'application utilise le composant `MapView` de `react-native-maps` pour afficher la carte. Selon la plateforme, la gestion de la clé API Google Maps diffère :

- **Android** : En développement, la carte fonctionne grâce aux services Google Play installés sur l'appareil. Pour la publication sur le Play Store ou l'utilisation de fonctionnalités avancées (styles personnalisés, géocodage, etc.), il est recommandé d'ajouter une clé API Google Maps dans la configuration Android.
- **iOS** : Par défaut, c'est Apple Maps qui est utilisé.

### 2. Obtenir une clé API Google Maps (Optionnel)

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un projet ou sélectionnez-en un existant
3. Activez l'API "Maps SDK for Android"
4. Dans "Identifiants", créez une clé API
5. Copiez la clé dans votre fichier `.env`

**Note** : La clé API est gratuite et nécessaire uniquement pour initialiser le SDK. L'application fonctionne 100% hors-ligne avec vos tuiles personnalisées.

### 3. Variables d'environnement

Copiez le fichier `.env.example` en `.env` :

```bash
cp .env.example .env
```

Puis modifiez `.env` et remplacez `your_api_key_here` par votre clé API Google Maps.

### 4. Développement

```bash
npx expo start
```

### 5. Build de production

_ici la clé API Google Maps est nécessaire_

```bash
npx expo run:android
```

## Structure des tuiles

Les tuiles de carte sont stockées dans `assets/maps/{z}/{x}/{y}.png` et automatiquement copiées dans le build Android.

**Important** : Ne commitez jamais votre fichier `.env` sur GitHub !
