#!/bin/bash

# Script de lancement unifié pour le projet Dédale
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo -e "\033[0;36m=== Lancement du projet Dédale ===\033[0m"
echo ""

# Vérifier que Docker est en cours d'exécution
if ! docker info > /dev/null 2>&1; then
    echo -e "\033[0;31m❌ Docker n'est pas en cours d'exécution. Veuillez le démarrer.\033[0m"
    cd "$PROJECT_ROOT"
    exit 1
fi

echo -e "\033[0;32m✅ Docker est en cours d'exécution\033[0m"
echo ""

# Menu principal
echo -e "\033[0;33m======================================\033[0m"
echo -e "\033[0;33m    MENU DE LANCEMENT DÉDALE\033[0m"
echo -e "\033[0;33m======================================\033[0m"
echo ""
echo -e "\033[0;37m1. Mode Web - Lancer les conteneurs + Application Tauri\033[0m"
echo -e "\033[0;37m2. Mode Web - Build, lancer les conteneurs + Application Tauri\033[0m"
echo ""
echo -e "\033[0;37m3. Mode Mobile - Lancer tile-server + Expo\033[0m"
echo -e "\033[0;37m4. Mode Mobile - Build tile-server + Expo\033[0m"
echo ""
echo -e "\033[0;37m5. All - Lancer Tauri + Expo + tous les services Docker\033[0m"
echo -e "\033[0;37m6. All - Build et lancer Tauri + Expo + tous les services Docker\033[0m"
echo ""
echo -e "\033[0;31m0. Quitter\033[0m"
echo ""

read -p "Votre choix: " choice

case $choice in
    1)
        echo ""
        echo -e "\033[0;36m📦 Lancement des services Docker Web en arrière-plan...\033[0m"
        docker-compose --profile web up -d
        
        echo ""
        echo -e "\033[0;36m🚀 Lancement de l'application Tauri...\033[0m"
        cd "Frontend/Web/Dedale"
        
        echo -e "\033[0;36m📥 Installation des dépendances npm...\033[0m"
        npm ci
        
        echo ""
        echo -e "\033[0;36m🎯 Lancement de Tauri...\033[0m"
        npm run tauri dev
        
        cd "$PROJECT_ROOT"
        ;;
    
    2)
        echo ""
        echo -e "\033[0;36m🔨 Build des images Docker Web...\033[0m"
        docker-compose --profile web build
        
        echo ""
        echo -e "\033[0;36m📦 Lancement des services Docker Web en arrière-plan...\033[0m"
        docker-compose --profile web up -d
        
        echo ""
        echo -e "\033[0;36m🚀 Lancement de l'application Tauri...\033[0m"
        cd "Frontend/Web/Dedale"
        
        echo -e "\033[0;36m📥 Installation des dépendances npm...\033[0m"
        npm ci
        
        echo ""
        echo -e "\033[0;36m🎯 Lancement de Tauri en mode développement...\033[0m"
        npm run tauri dev
        
        cd "$PROJECT_ROOT"
        ;;
    
    3)
        echo ""
        echo -e "\033[0;36m📦 Lancement du tile-server...\033[0m"
        docker-compose --profile mobile up -d mobile-tile-server
        
        echo ""
        echo -e "\033[0;36m🚀 Lancement d'Expo...\033[0m"
        cd "Frontend/Mobile/Dedale"
        
        echo -e "\033[0;36m📥 Installation des dépendances npm...\033[0m"
        npm ci
        
        echo ""
        echo -e "\033[0;36m🎯 Lancement d'Expo (QR code disponible)...\033[0m"
        npx expo start -c
        
        cd "$PROJECT_ROOT"
        echo ""
        echo -e "\033[0;32m✅ Expo fermé. Retour au répertoire racine.\033[0m"
        ;;
    
    4)
        echo ""
        echo -e "\033[0;36m🔨 Build de l'image mobile-tile-server...\033[0m"
        docker-compose --profile mobile build mobile-tile-server
        
        echo ""
        echo -e "\033[0;36m📦 Lancement du tile-server mobile en arrière-plan...\033[0m"
        docker-compose --profile mobile up -d mobile-tile-server
        
        echo ""
        echo -e "\033[0;36m🚀 Lancement d'Expo...\033[0m"
        cd "Frontend/Mobile/Dedale"
        
        echo -e "\033[0;36m📥 Installation des dépendances npm...\033[0m"
        npm ci
        
        echo ""
        echo -e "\033[0;36m🎯 Lancement d'Expo...\033[0m"
        npx expo start -c
        
        cd "$PROJECT_ROOT"
        ;;
    
    5)
        echo ""
        echo -e "\033[0;36m📦 Lancement de tous les services Docker en arrière-plan...\033[0m"
        docker-compose --profile web up -d
        docker-compose --profile mobile up -d mobile-tile-server
        
        echo ""
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
        
        echo ""
        echo -e "\033[0;36m🚀 Lancement d'Expo...\033[0m"
        cd "Frontend/Mobile/Dedale"
        npm install
        npx expo start -c
        
        cd "$PROJECT_ROOT"
        ;;
    
    6)
        echo ""
        echo -e "\033[0;36m🔨 Build de tous les services Docker...\033[0m"
        docker-compose --profile web build
        docker-compose --profile mobile build mobile-tile-server
        
        echo ""
        echo -e "\033[0;36m📦 Lancement de tous les services Docker en arrière-plan...\033[0m"
        docker-compose --profile web up -d
        docker-compose --profile mobile up -d mobile-tile-server
        
        echo ""
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
        
        echo ""
        echo -e "\033[0;36m🚀 Lancement d'Expo...\033[0m"
        cd "Frontend/Mobile/Dedale"
        npm install
        npx expo start -c
        
        cd "$PROJECT_ROOT"
        ;;
    
    0)
        echo ""
        echo -e "\033[0;36m👋 Au revoir !\033[0m"
        ;;
    
    *)
        echo ""
        echo -e "\033[0;31m❌ Choix invalide\033[0m"
        ;;
esac

cd "$PROJECT_ROOT"
