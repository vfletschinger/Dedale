#!/bin/bash

# Script de lancement pour le projet Dédale
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo -e "\033[0;36m=== Lancement du projet Dédale ===\033[0m"
echo ""

# Menu principal
echo -e "\033[0;33m======================================\033[0m"
echo -e "\033[0;33m    MENU DE LANCEMENT DÉDALE\033[0m"
echo -e "\033[0;33m======================================\033[0m"
echo -e "\033[0;37m1. Web - Lancer Tauri\033[0m"
echo -e "\033[0;37m2. Mobile - Lancer Expo\033[0m"
echo -e "\033[0;37m3. Tout - Lancer Tauri + Expo\033[0m"
echo ""
echo -e "\033[0;31m0. Quitter\033[0m"
echo ""

read -p "Votre choix: " choice

case $choice in
    1)
        echo -e "\033[0;36m🚀 Lancement de Tauri...\033[0m"
        cd "Frontend/Web/Dedale"
        npm install
        npm run tauri dev
        cd "$PROJECT_ROOT"
        ;;
    
    2)
        echo -e "\033[0;36m🚀 Lancement d'Expo...\033[0m"
        cd "Frontend/Mobile/Dedale"
        npm install
        npx expo start -c
        cd "$PROJECT_ROOT"
        ;;
    
    3)
        echo -e "\033[0;36m🚀 Lancement de Tauri dans un nouveau terminal...\033[0m"
        
        # Détection du système et ouverture d'un nouveau terminal
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            osascript -e "tell app \"Terminal\" to do script \"cd '$PROJECT_ROOT/Frontend/Web/Dedale' && npm install && npm run tauri dev\""
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Linux - essaie plusieurs émulateurs de terminal
            if command -v gnome-terminal &> /dev/null; then
                gnome-terminal -- bash -c "cd '$PROJECT_ROOT/Frontend/Web/Dedale' && npm install && npm run tauri dev; exec bash"
            elif command -v konsole &> /dev/null; then
                konsole -e bash -c "cd '$PROJECT_ROOT/Frontend/Web/Dedale' && npm install && npm run tauri dev; exec bash"
            elif command -v xterm &> /dev/null; then
                xterm -e bash -c "cd '$PROJECT_ROOT/Frontend/Web/Dedale' && npm install && npm run tauri dev; exec bash" &
            else
                echo -e "\033[0;33m⚠️  Aucun émulateur de terminal trouvé. Tauri ne sera pas lancé automatiquement.\033[0m"
                echo -e "\033[0;33m   Lancez manuellement: cd Frontend/Web/Dedale && npm run tauri dev\033[0m"
            fi
        fi
        
        echo -e "\033[0;36m🚀 Lancement d'Expo...\033[0m"
        cd "Frontend/Mobile/Dedale"
        npm install
        npx expo start -c
        cd "$PROJECT_ROOT"
        ;;
    
    0)
        echo -e "\033[0;36m👋 Au revoir !\033[0m"
        ;;
    
    *)
        echo -e "\033[0;31m❌ Choix invalide\033[0m"
        ;;
esac

cd "$PROJECT_ROOT"
