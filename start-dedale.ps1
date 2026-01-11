# Forcer l'encodage en UTF-8 pour la console
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ProjectRoot = Get-Location

Write-Host "=== Lancement du projet Dédale ===" -ForegroundColor Cyan
Write-Host ""

# Menu
Write-Host "======================================" -ForegroundColor Yellow
Write-Host "    MENU DE LANCEMENT DÉDALE" -ForegroundColor Yellow
Write-Host "======================================" -ForegroundColor Yellow
Write-Host "1. Web - Lancer Tauri" -ForegroundColor White
Write-Host "2. Mobile - Lancer Expo" -ForegroundColor White
Write-Host "3. Tout - Lancer Tauri + Expo" -ForegroundColor White
Write-Host ""
Write-Host "0. Quitter" -ForegroundColor Red
Write-Host ""

$choice = Read-Host "Votre choix"

switch ($choice) {
    "1" {
        Write-Host "🚀 Lancement de Tauri..." -ForegroundColor Cyan
        Push-Location "Frontend\Web\Dedale"
        try {
            npm install
            npm run tauri dev
        } finally {
            Pop-Location
        }
    }
    "2" {
        Write-Host "🚀 Lancement d'Expo..." -ForegroundColor Cyan
        Push-Location "Frontend\Mobile\Dedale"
        try {
            npm install
            npx expo start -c
        } finally {
            Pop-Location
        }
    }
    "3" {
        Write-Host "🚀 Lancement de Tauri dans un nouveau terminal..." -ForegroundColor Cyan
        $tauriCmd = "Set-Location '$ProjectRoot\Frontend\Web\Dedale'; npm install; npm run tauri dev"
        Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $tauriCmd
        
        Write-Host "🚀 Lancement d'Expo..." -ForegroundColor Cyan
        Push-Location "Frontend\Mobile\Dedale"
        try {
            npm install
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