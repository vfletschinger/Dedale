# Script de lancement unifié pour le projet Dédale
$ProjectRoot = Get-Location
Set-Location $ProjectRoot

Write-Host "=== Lancement du projet Dédale ===" -ForegroundColor Cyan
Write-Host ""

# Vérifier que Docker est en cours d'exécution
try {
    docker info | Out-Null
} catch {
    Write-Host "❌ Docker n'est pas en cours d'exécution. Veuillez le démarrer." -ForegroundColor Red
    Set-Location $ProjectRoot
    exit 1
}

Write-Host "✅ Docker est en cours d'exécution" -ForegroundColor Green
Write-Host ""

# Menu principal
Write-Host "======================================" -ForegroundColor Yellow
Write-Host "    MENU DE LANCEMENT DÉDALE" -ForegroundColor Yellow
Write-Host "======================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Mode Web - Lancer les conteneurs + Application Tauri" -ForegroundColor White
Write-Host "2. Mode Web - Build, lancer les conteneurs + Application Tauri" -ForegroundColor White
Write-Host ""
Write-Host "3. Mode Mobile - Lancer tile-server + Expo" -ForegroundColor White
Write-Host "4. Mode Mobile - Build tile-server + Expo" -ForegroundColor White
Write-Host ""
Write-Host "5. All - Lancer Tauri + Expo + tous les services Docker" -ForegroundColor White
Write-Host "6. All - Build et lancer Tauri + Expo + tous les services Docker" -ForegroundColor White
Write-Host ""
Write-Host "0. Quitter" -ForegroundColor Red
Write-Host ""

$choice = Read-Host "Votre choix"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "📦 Lancement des services Docker Web en arrière-plan..." -ForegroundColor Cyan
        docker-compose --profile web up -d
        
        Write-Host ""
        Write-Host "🚀 Lancement de l'application Tauri..." -ForegroundColor Cyan
        Set-Location "Frontend\Web\Dedale"
        
        Write-Host "📥 Installation des dépendances npm..." -ForegroundColor Cyan
        npm install -ci
        
        Write-Host ""
        Write-Host "🎯 Lancement de Tauri..." -ForegroundColor Cyan
        npm run tauri dev
        
        # Retour au répertoire racine après fermeture
        Set-Location $ProjectRoot
    }
    "2" {
        Write-Host ""
        Write-Host "🔨 Build des images Docker Web..." -ForegroundColor Cyan
        docker-compose --profile=web build
        
        Write-Host ""
        Write-Host "📦 Lancement des services Docker Web en arrière-plan..." -ForegroundColor Cyan
        docker-compose --profile=web up -d
        
        Write-Host ""
        Write-Host "🚀 Lancement de l'application Tauri..." -ForegroundColor Cyan
        Set-Location "Frontend\Web\Dedale"
        
        Write-Host "📥 Installation des dépendances npm..." -ForegroundColor Cyan
        npm install -ci
        
        Write-Host ""
        Write-Host "🎯 Lancement de Tauri en mode développement..." -ForegroundColor Cyan
        npm run tauri dev
        
        Set-Location $ProjectRoot
    }
    "3" {
        Write-Host ""
        Write-Host "📦 Lancement du tile-server..." -ForegroundColor Cyan
        docker-compose --profile=mobile up -d mobile-tile-server
        
        Write-Host ""
        Write-Host "🚀 Lancement d'Expo..." -ForegroundColor Cyan
        Set-Location "Frontend\Mobile\Dedale"
        
        Write-Host "📥 Installation des dépendances npm..." -ForegroundColor Cyan
        npm install -ci
        
        Write-Host ""
        Write-Host "🎯 Lancement d'Expo (QR code disponible)..." -ForegroundColor Cyan
        npx expo start -c
        
        # Retour au répertoire racine après fermeture
        Set-Location $ProjectRoot
        Write-Host ""
        Write-Host "✅ Expo fermé. Retour au répertoire racine." -ForegroundColor Green
    }
    "4" {
        Write-Host ""
        Write-Host "🔨 Build de l'image mobile-tile-server..." -ForegroundColor Cyan
        docker-compose --profile=mobile build mobile-tile-server
        
        Write-Host ""
        Write-Host "📦 Lancement du tile-server mobile en arrière-plan..." -ForegroundColor Cyan
        docker-compose --profile=mobile up -d mobile-tile-server
        
        Write-Host ""
        Write-Host "🚀 Lancement d'Expo..." -ForegroundColor Cyan
        Set-Location "Frontend\Mobile\Dedale"
        
        Write-Host "📥 Installation des dépendances npm..." -ForegroundColor Cyan
        npm install -ci
        
        Write-Host ""
        Write-Host "🎯 Lancement d'Expo..." -ForegroundColor Cyan
        npx expo start -c
        
        # Retour au répertoire racine après fermeture
        Set-Location $ProjectRoot
    }
    "5" {
        Write-Host ""
        Write-Host "📦 Lancement de tous les services Docker en arrière-plan..." -ForegroundColor Cyan
        docker-compose --profile web up -d
        docker-compose --profile mobile up -d mobile-tile-server
        
        Write-Host ""
        Write-Host "🚀 Lancement de Tauri..." -ForegroundColor Cyan
        Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "Set-Location '$ProjectRoot\Frontend\Web\Dedale'; npm install; npm run tauri dev"
        
        Write-Host ""
        Write-Host "🚀 Lancement d'Expo..." -ForegroundColor Cyan
        Set-Location "Frontend\Mobile\Dedale"
        npm install
        npx expo start -c
        
        Set-Location $ProjectRoot
    }
    "6" {
        Write-Host ""
        Write-Host "🔨 Build de tous les services Docker..." -ForegroundColor Cyan
        docker-compose --profile web build
        docker-compose --profile mobile build mobile-tile-server
        
        Write-Host ""
        Write-Host "📦 Lancement de tous les services Docker en arrière-plan..." -ForegroundColor Cyan
        docker-compose --profile web up -d
        docker-compose --profile mobile up -d mobile-tile-server
        
        Write-Host ""
        Write-Host "🚀 Lancement de Tauri dans une nouvelle fenêtre..." -ForegroundColor Cyan
        Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "Set-Location '$ProjectRoot\Frontend\Web\Dedale'; npm install; npm run tauri dev"
        
        Write-Host ""
        Write-Host "🚀 Lancement d'Expo..." -ForegroundColor Cyan
        Set-Location "Frontend\Mobile\Dedale"
        npm install
        npx expo start -c
        
        Set-Location $ProjectRoot
    }
    "0" {
        Write-Host ""
        Write-Host "👋 Au revoir !" -ForegroundColor Cyan
    }
    default {
        Write-Host ""
        Write-Host "❌ Choix invalide" -ForegroundColor Red
    }
}

Set-Location $ProjectRoot
