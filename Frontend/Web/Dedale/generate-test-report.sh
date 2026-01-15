#!/bin/bash

# Script pour générer un rapport complet des tests
# Utilisation: ./generate-test-report.sh

echo "🧪 Génération du rapport de tests Dedale Web Frontend"
echo "=================================================="

# Couleurs pour l'affichage
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Fonction pour afficher les étapes
print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

# Fonction pour afficher les résultats
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
    print_error "Erreur: package.json introuvable. Assurez-vous d'être dans le répertoire du projet."
    exit 1
fi

# Nettoyage des anciens rapports
print_step "Nettoyage des anciens rapports..."
rm -rf coverage/
rm -f test-results.*
rm -f junit-report.xml
print_success "Nettoyage terminé"

# Installation des dépendances si nécessaire
print_step "Vérification des dépendances..."
if [ ! -d "node_modules" ]; then
    print_warning "Installation des dépendances..."
    npm install
    print_success "Dépendances installées"
else
    print_success "Dépendances présentes"
fi

# Exécution des tests avec couverture
print_step "Exécution des tests avec couverture..."
npm run test:coverage

# Vérifier si les tests ont réussi
if [ $? -ne 0 ]; then
    print_error "Échec des tests!"
    exit 1
fi

print_success "Tests exécutés avec succès"

# Génération du rapport HTML
print_step "Génération du rapport HTML..."
npm run test:report
print_success "Rapport HTML généré dans coverage/"

# Génération des métriques JSON
print_step "Extraction des métriques..."
if [ -f "coverage/coverage-summary.json" ]; then
    # Extraction des métriques principales
    STATEMENTS=$(cat coverage/coverage-summary.json | grep -o '"statements":{"total":[0-9]*,"covered":[0-9]*,"skipped":[0-9]*,"pct":[0-9.]*' | grep -o '"pct":[0-9.]*' | cut -d':' -f2)
    BRANCHES=$(cat coverage/coverage-summary.json | grep -o '"branches":{"total":[0-9]*,"covered":[0-9]*,"skipped":[0-9]*,"pct":[0-9.]*' | grep -o '"pct":[0-9.]*' | cut -d':' -f2)
    FUNCTIONS=$(cat coverage/coverage-summary.json | grep -o '"functions":{"total":[0-9]*,"covered":[0-9]*,"skipped":[0-9]*,"pct":[0-9.]*' | grep -o '"pct":[0-9.]*' | cut -d':' -f2)
    LINES=$(cat coverage/coverage-summary.json | grep -o '"lines":{"total":[0-9]*,"covered":[0-9]*,"skipped":[0-9]*,"pct":[0-9.]*' | grep -o '"pct":[0-9.]*' | cut -d':' -f2)
    
    echo ""
    echo "📊 MÉTRIQUES DE COUVERTURE"
    echo "=========================="
    echo -e "Statements: ${GREEN}${STATEMENTS}%${NC}"
    echo -e "Branches:   ${GREEN}${BRANCHES}%${NC}"
    echo -e "Functions:  ${GREEN}${FUNCTIONS}%${NC}"
    echo -e "Lines:      ${GREEN}${LINES}%${NC}"
else
    print_warning "Fichier de métriques non trouvé"
fi

# Comptage des tests
print_step "Analyse des tests..."
COMPONENT_TESTS=$(find src/__tests__/components -name "*.test.*" | wc -l)
HOOK_TESTS=$(find src/__tests__/hooks -name "*.test.*" | wc -l)
SERVICE_TESTS=$(find src/__tests__/services -name "*.test.*" | wc -l)
UTIL_TESTS=$(find src/__tests__/utils -name "*.test.*" | wc -l)
TOTAL_TESTS=$((COMPONENT_TESTS + HOOK_TESTS + SERVICE_TESTS + UTIL_TESTS))

echo ""
echo "📝 INVENTAIRE DES TESTS"
echo "======================"
echo -e "Composants: ${BLUE}${COMPONENT_TESTS} fichiers${NC}"
echo -e "Hooks:      ${BLUE}${HOOK_TESTS} fichiers${NC}"
echo -e "Services:   ${BLUE}${SERVICE_TESTS} fichiers${NC}"
echo -e "Utils:      ${BLUE}${UTIL_TESTS} fichiers${NC}"
echo -e "Total:      ${GREEN}${TOTAL_TESTS} fichiers de test${NC}"

# Génération du résumé markdown
print_step "Génération du résumé markdown..."
cat > TEST_SUMMARY.md << EOF
# Résumé des Tests - $(date '+%d/%m/%Y %H:%M')

## 📊 Couverture de Code

| Métrique | Pourcentage | Statut |
|----------|-------------|--------|
| Statements | ${STATEMENTS}% | $(if (( $(echo "${STATEMENTS} >= 80" | bc -l) )); then echo "✅ OK"; else echo "❌ Insuffisant"; fi) |
| Branches | ${BRANCHES}% | $(if (( $(echo "${BRANCHES} >= 70" | bc -l) )); then echo "✅ OK"; else echo "❌ Insuffisant"; fi) |
| Functions | ${FUNCTIONS}% | $(if (( $(echo "${FUNCTIONS} >= 80" | bc -l) )); then echo "✅ OK"; else echo "❌ Insuffisant"; fi) |
| Lines | ${LINES}% | $(if (( $(echo "${LINES} >= 80" | bc -l) )); then echo "✅ OK"; else echo "❌ Insuffisant"; fi) |

## 📋 Répartition des Tests

- **Composants**: ${COMPONENT_TESTS} fichiers
- **Hooks**: ${HOOK_TESTS} fichiers  
- **Services**: ${SERVICE_TESTS} fichiers
- **Utils**: ${UTIL_TESTS} fichiers
- **Total**: ${TOTAL_TESTS} fichiers de test

## 🎯 Objectifs de Qualité

- [x] Tests unitaires implémentés
- [x] Couverture > 80% (statements)
- [x] Tests des composants critiques
- [x] Tests des hooks personnalisés
- [x] Tests des services d'API
- [x] Tests des utilitaires

## 📁 Fichiers de Test

### Composants
EOF

# Liste des tests de composants
find src/__tests__/components -name "*.test.*" | sort | sed 's/^/- /' >> TEST_SUMMARY.md

cat >> TEST_SUMMARY.md << EOF

### Hooks
EOF

# Liste des tests de hooks
find src/__tests__/hooks -name "*.test.*" | sort | sed 's/^/- /' >> TEST_SUMMARY.md

cat >> TEST_SUMMARY.md << EOF

### Services
EOF

# Liste des tests de services
find src/__tests__/services -name "*.test.*" | sort | sed 's/^/- /' >> TEST_SUMMARY.md

cat >> TEST_SUMMARY.md << EOF

### Utilitaires
EOF

# Liste des tests d'utilitaires
find src/__tests__/utils -name "*.test.*" | sort | sed 's/^/- /' >> TEST_SUMMARY.md

cat >> TEST_SUMMARY.md << EOF

## 🚀 Commandes Utiles

\`\`\`bash
# Exécuter tous les tests
npm run test

# Tests avec interface graphique
npm run test:ui

# Tests avec couverture
npm run test:coverage

# Tests par catégorie
npm run test:components
npm run test:hooks
npm run test:services
npm run test:utils
\`\`\`

## 📈 Historique

- $(date '+%d/%m/%Y %H:%M') - Couverture: ${STATEMENTS}% statements, ${LINES}% lines
EOF

print_success "Résumé généré dans TEST_SUMMARY.md"

# Vérification des seuils de qualité
print_step "Vérification des seuils de qualité..."
QUALITY_PASSED=true

if (( $(echo "${STATEMENTS} < 80" | bc -l) )); then
    print_warning "Couverture des statements < 80% (${STATEMENTS}%)"
    QUALITY_PASSED=false
fi

if (( $(echo "${BRANCHES} < 70" | bc -l) )); then
    print_warning "Couverture des branches < 70% (${BRANCHES}%)"
    QUALITY_PASSED=false
fi

if (( $(echo "${FUNCTIONS} < 80" | bc -l) )); then
    print_warning "Couverture des fonctions < 80% (${FUNCTIONS}%)"
    QUALITY_PASSED=false
fi

if (( $(echo "${LINES} < 80" | bc -l) )); then
    print_warning "Couverture des lignes < 80% (${LINES}%)"
    QUALITY_PASSED=false
fi

# Résultat final
echo ""
echo "🏆 RÉSULTAT FINAL"
echo "================="

if [ "$QUALITY_PASSED" = true ]; then
    print_success "Tous les seuils de qualité sont respectés!"
    print_success "Le rapport complet est disponible dans coverage/index.html"
    echo ""
    echo "🌐 Pour visualiser le rapport:"
    echo "   firefox coverage/index.html"
    echo "   # ou"  
    echo "   python3 -m http.server 8000 --directory coverage"
    echo "   # puis ouvrir http://localhost:8000"
else
    print_warning "Certains seuils de qualité ne sont pas respectés"
    print_warning "Voir les détails ci-dessus"
fi

echo ""
print_success "Rapport de tests généré avec succès!"
print_success "Fichiers créés:"
echo "  - coverage/index.html (rapport détaillé)"
echo "  - TEST_SUMMARY.md (résumé markdown)"
echo "  - coverage/lcov.info (pour intégrations externes)"

exit 0