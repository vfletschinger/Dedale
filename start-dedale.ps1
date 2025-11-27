# Forcer l'encodage en UTF-8 pour la console
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ProjectRoot = Get-Location

Write-Host "=== Lancement du projet Dédale ===" -ForegroundColor Cyan
Write-Host ""

# Vérifier Docker
try {
    docker info | Out-Null
} catch {
    Write-Host "❌ Docker n'est pas en cours d'exécution." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Docker est en cours d'exécution" -ForegroundColor Green
Write-Host ""

# Menu
Write-Host "======================================" -ForegroundColor Yellow
Write-Host "    MENU DE LANCEMENT DÉDALE" -ForegroundColor Yellow
Write-Host "======================================" -ForegroundColor Yellow
Write-Host "1. Mode Web - Lancer tout (Tauri + Docker)" -ForegroundColor White
Write-Host "2. Mode Web - Build + Lancer tout" -ForegroundColor White
Write-Host ""
Write-Host "3. Mode Mobile - Lancer tout (Expo + TileServer)" -ForegroundColor White
Write-Host "4. Mode Mobile - Build + Lancer tout" -ForegroundColor White
Write-Host ""
Write-Host "5. ALL - Lancer TOUT (Web + Mobile + Docker)" -ForegroundColor White
Write-Host "6. ALL - Build + Lancer TOUT" -ForegroundColor White
Write-Host ""
Write-Host "0. Quitter" -ForegroundColor Red
Write-Host ""

$choice = Read-Host "Votre choix"

switch ($choice) {
    "1" {
        Write-Host "📦 Docker Web..." -ForegroundColor Cyan
        docker-compose --profile web up -d
        
        Write-Host "🚀 Tauri..." -ForegroundColor Cyan
        Push-Location "Frontend\Web\Dedale"
        try {
            npm install -ci
            npm run tauri dev
        } finally {
            Pop-Location
        }
    }
    "2" {
        Write-Host "🔨 Build Docker Web..." -ForegroundColor Cyan
        docker-compose --profile=web build
        docker-compose --profile=web up -d
        
        Write-Host "🚀 Tauri..." -ForegroundColor Cyan
        Push-Location "Frontend\Web\Dedale"
        try {
            npm install -ci
            npm run tauri dev
        } finally {
            Pop-Location
        }
    }
    "3" {
        Write-Host "📦 Tile-Server..." -ForegroundColor Cyan
        docker-compose --profile=mobile up -d mobile-tile-server
        
        Write-Host "🚀 Expo..." -ForegroundColor Cyan
        Push-Location "Frontend\Mobile\Dedale"
        try {
            npm install -ci
            npx expo start -c
        } finally {
            Pop-Location
        }
    }
    "4" {
        Write-Host "🔨 Build Tile-Server..." -ForegroundColor Cyan
        docker-compose --profile=mobile build mobile-tile-server
        docker-compose --profile=mobile up -d mobile-tile-server
        
        Write-Host "🚀 Expo..." -ForegroundColor Cyan
        Push-Location "Frontend\Mobile\Dedale"
        try {
            npm install -ci
            npx expo start -c
        } finally {
            Pop-Location
        }
    }
    "5" {
        Write-Host "📦 Docker (Tous)..." -ForegroundColor Cyan
        docker-compose --profile web up -d
        docker-compose --profile mobile up -d mobile-tile-server
        
        Write-Host "🚀 Lancement Tauri..." -ForegroundColor Cyan
        $tauriCmd = "Set-Location '$ProjectRoot\Frontend\Web\Dedale'; npm install; npm run tauri dev"
        Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $tauriCmd
        
        Write-Host "🚀 Lancement Expo..." -ForegroundColor Cyan
        Push-Location "Frontend\Mobile\Dedale"
        try {
            npm install -ci
            npx expo start -c
        } finally {
            Pop-Location
        }
    }
    "6" {
        Write-Host "🔨 Build Tous..." -ForegroundColor Cyan
        docker-compose --profile web build
        docker-compose --profile mobile build mobile-tile-server
        
        Write-Host "📦 Lancement Docker..." -ForegroundColor Cyan
        docker-compose --profile web up -d
        docker-compose --profile mobile up -d mobile-tile-server
        
        Write-Host "🚀 Lancement Tauri..." -ForegroundColor Cyan
        $tauriCmd = "Set-Location '$ProjectRoot\Frontend\Web\Dedale'; npm install; npm run tauri dev"
        Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $tauriCmd
        
        Write-Host "🚀 Lancement Expo..." -ForegroundColor Cyan
        Push-Location "Frontend\Mobile\Dedale"
        try {
            npm install -ci
            npx expo start -c
        } finally {
            Pop-Location
        }
    }
    "0" {
        Write-Host "👋 Au revoir !" -ForegroundColor Cyan
    }
    default {
        Write-Host "❌ Choix invalide" -ForegroundColor Red
    }
}