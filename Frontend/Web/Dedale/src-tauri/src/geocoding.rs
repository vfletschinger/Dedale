// Module de géocodage local pour Tauri
// Recherche d'adresses dans la base SQLite embarquée

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub lat: String,
    pub lon: String,
    pub display_name: String,
}

/// Obtient le chemin vers la base de données d'adresses
fn get_addresses_db_path() -> Result<PathBuf, String> {
    // Obtenir le répertoire de l'exécutable
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Impossible d'obtenir le chemin de l'exécutable: {}", e))?;

    println!("[geocoding] Exécutable: {:?}", exe_path);

    let exe_dir = exe_path
        .parent()
        .ok_or_else(|| "Impossible d'obtenir le dossier parent".to_string())?;

    println!("[geocoding] Dossier exécutable: {:?}", exe_dir);

    // Liste des chemins possibles à tester
    let possible_paths = vec![
        // Mode dev - chemin relatif depuis target/debug
        exe_dir
            .join("..")
            .join("..")
            .join("..")
            .join("resources")
            .join("addresses.db"),
        // Mode dev - autre structure
        exe_dir.join("resources").join("addresses.db"),
        // Mode prod - ressources à côté de l'exécutable
        exe_dir.join("addresses.db"),
        // Chemin absolu de fallback pour le dev
        PathBuf::from("src-tauri/resources/addresses.db"),
    ];

    for path in &possible_paths {
        println!("[geocoding] Test du chemin: {:?}", path);
        if path.exists() {
            let canonical = path.canonicalize().unwrap_or_else(|_| path.clone());
            println!("[geocoding] ✓ Trouvé: {:?}", canonical);
            return Ok(canonical);
        }
    }

    // Afficher tous les chemins testés pour le debug
    let paths_str: Vec<String> = possible_paths
        .iter()
        .map(|p| format!("  - {:?}", p))
        .collect();

    Err(format!(
        "Base de données d'adresses non trouvée.\nChemins testés:\n{}",
        paths_str.join("\n")
    ))
}

/// Commande Tauri pour rechercher des adresses localement
#[tauri::command]
pub async fn search_address(query: String) -> Result<Vec<SearchResult>, String> {
    println!("[geocoding] === Nouvelle recherche ===");
    println!("[geocoding] Query: '{}'", query);

    // Ignorer les requêtes trop courtes
    if query.trim().len() < 2 {
        println!("[geocoding] Query trop courte, ignorée");
        return Ok(vec![]);
    }

    let db_path = get_addresses_db_path()?;
    println!("[geocoding] Utilisation de la base: {:?}", db_path);

    // Ouvrir la connexion SQLite en mode lecture seule
    let conn =
        rusqlite::Connection::open_with_flags(&db_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|e| {
                let err = format!("Erreur d'ouverture de la base: {}", e);
                println!("[geocoding] {}", err);
                err
            })?;

    println!("[geocoding] Connexion SQLite ouverte");

    // Préparer le pattern de recherche pour LIKE
    let search_pattern = format!("%{}%", query.trim());
    let start_pattern = format!("{}%", query.trim());

    println!("[geocoding] Pattern de recherche: {}", search_pattern);

    // Utiliser LIKE avec COLLATE NOCASE pour une recherche insensible à la casse
    let mut stmt = conn
        .prepare(
            "SELECT lat, lon, display_name
             FROM addresses
             WHERE display_name LIKE ?1 COLLATE NOCASE
             ORDER BY
                CASE
                    WHEN display_name LIKE ?2 COLLATE NOCASE THEN 0
                    ELSE 1
                END,
                length(display_name)
             LIMIT 10",
        )
        .map_err(|e| {
            let err = format!("Erreur de préparation de la requête: {}", e);
            println!("[geocoding] {}", err);
            err
        })?;

    println!("[geocoding] Requête préparée, exécution...");

    let results: Vec<SearchResult> = stmt
        .query_map([&search_pattern, &start_pattern], |row| {
            Ok(SearchResult {
                lat: format!("{}", row.get::<_, f64>(0)?),
                lon: format!("{}", row.get::<_, f64>(1)?),
                display_name: row.get(2)?,
            })
        })
        .map_err(|e| {
            let err = format!("Erreur d'exécution de la requête: {}", e);
            println!("[geocoding] {}", err);
            err
        })?
        .filter_map(|r| r.ok())
        .collect();

    println!(
        "[geocoding] Recherche '{}' -> {} résultats",
        query,
        results.len()
    );

    for (i, r) in results.iter().enumerate() {
        println!("[geocoding]   {}. {}", i + 1, r.display_name);
    }

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_search_result_serialization() {
        let result = SearchResult {
            lat: "48.5833".to_string(),
            lon: "7.7458".to_string(),
            display_name: "1 Place Kléber, Strasbourg".to_string(),
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("Place Kléber"));
    }
}
